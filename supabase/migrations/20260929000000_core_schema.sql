-- ==============================================================================
-- الخطوة 1.2: ملف الترحيل للأساس (الأدوار، التدقيق، المدن والزونات، الإعدادات المرنة)
-- المتطلبات: ADM-034 · ADM-002 · DSP-002 · ADM-001
-- ==============================================================================

-- 1. التوسيعات (Extensions)
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
-- pg_cron يتوفر في schema extensions أو pg_catalog حسب بيئة Supabase
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- 2. الأدوار والصلاحيات (ADM-001)
CREATE TYPE public.app_role AS ENUM (
  'super_admin',      -- مدير عام: صلاحية كاملة على كل شيء
  'operations',       -- تشغيل: إدارة العمليات، المدن، ومتابعة الطلبات
  'finance',          -- مالية: القيود المحاسبية، التسويات، التحويلات
  'support',          -- دعم: خدمة العملاء والشكاوى وتعديلات الطلبات المسموحة
  'marketing',        -- تسويق: العروض، الكوبونات، وبرامج الولاء
  'merchant_owner',   -- مالك متجر / تاجر: إدارة الفروع والمتاجر والمنيو
  'branch_staff',     -- موظف فرع: تحضير الطلبات واستلامها
  'fleet_manager',    -- مدير شركة توصيل: متابعة المناديب التابعين للشركة
  'driver',           -- مندوب: استلام وتوصيل الطلبات
  'customer'          -- عميل: تصفح وشراء وتتبع الطلبات
);

-- 3. الملف الشخصي للمستخدم (مرتبط بـ auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT UNIQUE,
  preferred_language TEXT NOT NULL DEFAULT 'ar' CHECK (preferred_language IN ('ar', 'en')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'الملف الشخصي للمستخدمين وحساباتهم الأساسية';

-- 4. ربط الأدوار بالمستخدمين (مع إمكانية تقييد النطاق بمتجر أو فرع أو شركة أو مدينة)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  store_id UUID,
  branch_id UUID,
  fleet_id UUID,
  city_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_roles UNIQUE NULLS NOT DISTINCT (user_id, role, store_id, branch_id, fleet_id, city_id)
);

COMMENT ON TABLE public.user_roles IS 'سجل أدوار المستخدمين مع النطاق الإداري أو الجغرافي المحدد لكل دور';

-- 5. دالة فحص الأدوار (has_role)
CREATE OR REPLACE FUNCTION public.has_role(
  _user_id UUID,
  _role public.app_role,
  _store_id UUID DEFAULT NULL,
  _branch_id UUID DEFAULT NULL,
  _fleet_id UUID DEFAULT NULL,
  _city_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  -- المدير العام يملك صلاحية دائمة ومطلقة
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (_store_id IS NULL OR store_id = _store_id OR store_id IS NULL)
      AND (_branch_id IS NULL OR branch_id = _branch_id OR branch_id IS NULL)
      AND (_fleet_id IS NULL OR fleet_id = _fleet_id OR fleet_id IS NULL)
      AND (_city_id IS NULL OR city_id = _city_id OR city_id IS NULL)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- دالة مساعدة لفحص هل المستخدم إداري في المنصة
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'operations', 'finance', 'support', 'marketing')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 6. سجل التدقيق (ADM-002)
-- لا يُعدَّل ولا يُحذف منه أي سجل حتى من قِبل المدير العام
CREATE TABLE public.audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_log IS 'سجل التدقيق غير القابل للتعديل أو الحذف لتوثيق جميع العمليات الحساسة';

-- منع التعديل والحذف على سجل التدقيق بقفل قاطع
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'سجل التدقيق غير قابل للتعديل أو الحذف إطلاقاً (ADM-002)'
    USING ERRCODE = '45000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_immutable
BEFORE UPDATE OR DELETE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_modification();

-- Trigger عام لتسجيل العمليات في الجداول الحساسة
CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id UUID;
  v_reason TEXT;
  v_record_id TEXT;
BEGIN
  v_actor_id := auth.uid();
  
  -- قراءة سبب التعديل الاختياري إن تم تمريره في سياق الجلسة
  BEGIN
    v_reason := current_setting('app.audit_reason', true);
  EXCEPTION WHEN OTHERS THEN
    v_reason := NULL;
  END;

  IF (TG_OP = 'INSERT') THEN
    v_record_id := COALESCE(to_jsonb(NEW)->>'id', to_jsonb(NEW)->>'key', 'unknown');
    INSERT INTO public.audit_log (actor_id, table_name, record_id, action, old_data, new_data, reason)
    VALUES (v_actor_id, TG_TABLE_NAME, v_record_id, 'INSERT', NULL, to_jsonb(NEW), v_reason);
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_record_id := COALESCE(to_jsonb(NEW)->>'id', to_jsonb(NEW)->>'key', 'unknown');
    INSERT INTO public.audit_log (actor_id, table_name, record_id, action, old_data, new_data, reason)
    VALUES (v_actor_id, TG_TABLE_NAME, v_record_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), v_reason);
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    v_record_id := COALESCE(to_jsonb(OLD)->>'id', to_jsonb(OLD)->>'key', 'unknown');
    INSERT INTO public.audit_log (actor_id, table_name, record_id, action, old_data, new_data, reason)
    VALUES (v_actor_id, TG_TABLE_NAME, v_record_id, 'DELETE', to_jsonb(OLD), NULL, v_reason);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. المدن والزونات (DSP-002)
CREATE TABLE public.cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  boundary extensions.geography(MultiPolygon, 4326),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cities_boundary ON public.cities USING GIST (boundary);
COMMENT ON TABLE public.cities IS 'قائمة المدن والمحافظات وحدودها الجغرافية (نطاق التوصيل الافتراضي)';

CREATE TABLE public.zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  zone_type TEXT NOT NULL CHECK (zone_type IN ('store_zone', 'driver_zone', 'fleet_allowed', 'fleet_excluded')),
  boundary extensions.geography(MultiPolygon, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_zones_boundary ON public.zones USING GIST (boundary);
COMMENT ON TABLE public.zones IS 'الزونات الجغرافية المخصصة داخل المدن للمتاجر أو المناديب أو أساطيل التوصيل';

-- دالة لمعرفة المدينة التي تقع فيها نقطة إحداثيات (lat, lng)
CREATE OR REPLACE FUNCTION public.city_for_point(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
) RETURNS SETOF public.cities AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.cities
  WHERE is_active = true
    AND boundary IS NOT NULL
    AND extensions.ST_Covers(
      boundary,
      extensions.ST_SetSRID(extensions.ST_Point(lng, lat), 4326)::extensions.geography
    )
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 8. نظام الإعدادات المرنة (ADM-034)
CREATE TYPE public.setting_type AS ENUM (
  'number',
  'percentage',
  'amount_halalas',
  'duration_minutes',
  'duration_seconds',
  'boolean',
  'select'
);

CREATE TABLE public.setting_definitions (
  key TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  description_ar TEXT,
  type public.setting_type NOT NULL,
  min_value NUMERIC,
  max_value NUMERIC,
  default_value JSONB NOT NULL,
  allowed_levels TEXT[] NOT NULL DEFAULT '{"global"}',
  related_requirements TEXT[] NOT NULL DEFAULT '{}',
  options JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.setting_definitions IS 'تعريفات وثوابت القيم المرنة وحدودها وقيمها الافتراضية ومستوياتها المسموحة';

CREATE TABLE public.setting_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL REFERENCES public.setting_definitions(key) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('global', 'city', 'merchant', 'store')),
  entity_id UUID,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_setting_values UNIQUE NULLS NOT DISTINCT (key, level, entity_id)
);

COMMENT ON TABLE public.setting_values IS 'القيم الفعلية المخصصة للإعدادات على المستويات المختلفة';

-- التحقق من صحة القيمة والمستوى والحدود قبل الحفظ
CREATE OR REPLACE FUNCTION public.validate_setting_value()
RETURNS TRIGGER AS $$
DECLARE
  v_def RECORD;
  v_num_val NUMERIC;
BEGIN
  SELECT * INTO v_def FROM public.setting_definitions WHERE key = NEW.key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'مفتاح الإعداد % غير معرف في النظام', NEW.key;
  END IF;

  -- التحقق من المستوى
  IF NOT (NEW.level = ANY(v_def.allowed_levels)) THEN
    RAISE EXCEPTION 'المستوى % غير مسموح للإعداد % (المسموح: %)', NEW.level, NEW.key, v_def.allowed_levels;
  END IF;

  -- التحقق من توافق entity_id
  IF NEW.level = 'global' AND NEW.entity_id IS NOT NULL THEN
    RAISE EXCEPTION 'المستوى العام global لا يمكن أن يحتوي على entity_id';
  ELSIF NEW.level <> 'global' AND NEW.entity_id IS NULL THEN
    RAISE EXCEPTION 'المستوى % يتطلب تحديد معرف entity_id', NEW.level;
  END IF;

  -- التحقق من نوع القيمة والحد الأدنى والأعلى
  IF v_def.type IN ('number', 'percentage', 'amount_halalas', 'duration_minutes', 'duration_seconds') THEN
    BEGIN
      v_num_val := (NEW.value#>>'{}')::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'القيمة % يجب أن تكون رقماً صالحاً للإعداد %', NEW.value, NEW.key;
    END;

    IF v_def.min_value IS NOT NULL AND v_num_val < v_def.min_value THEN
      RAISE EXCEPTION 'القيمة % أقل من الحد الأدنى المسموح % للإعداد %', v_num_val, v_def.min_value, NEW.key;
    END IF;

    IF v_def.max_value IS NOT NULL AND v_num_val > v_def.max_value THEN
      RAISE EXCEPTION 'القيمة % أكبر من الحد الأعلى المسموح % للإعداد %', v_num_val, v_def.max_value, NEW.key;
    END IF;
  ELSIF v_def.type = 'boolean' THEN
    IF jsonb_typeof(NEW.value) <> 'boolean' THEN
      RAISE EXCEPTION 'القيمة % يجب أن تكون منطقية (true/false) للإعداد %', NEW.value, NEW.key;
    END IF;
  ELSIF v_def.type = 'select' THEN
    IF v_def.options IS NOT NULL AND NOT (v_def.options ? (NEW.value#>>'{}')) THEN
      RAISE EXCEPTION 'القيمة % ليست من الخيارات المتاحة للإعداد % (الخيارات: %)', NEW.value, NEW.key, v_def.options;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_setting_value
BEFORE INSERT OR UPDATE ON public.setting_values
FOR EACH ROW EXECUTE FUNCTION public.validate_setting_value();

-- تفعيل التدقيق على جدول قيم الإعدادات وجدول الأدوار
CREATE TRIGGER trg_audit_setting_values
AFTER INSERT OR UPDATE OR DELETE ON public.setting_values
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER trg_audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- 9. الدالة المركزية لجلب الإعداد بالبحث المتدرج (get_setting)
-- المتجر ← التاجر ← المدينة ← العام ← الافتراضي
CREATE OR REPLACE FUNCTION public.get_setting(
  p_key TEXT,
  p_city_id UUID DEFAULT NULL,
  p_merchant_id UUID DEFAULT NULL,
  p_store_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_val JSONB;
  v_default JSONB;
BEGIN
  -- 1. فحص مستوى المتجر
  IF p_store_id IS NOT NULL THEN
    SELECT value INTO v_val
    FROM public.setting_values
    WHERE key = p_key AND level = 'store' AND entity_id = p_store_id;
    IF v_val IS NOT NULL THEN
      RETURN v_val;
    END IF;
  END IF;

  -- 2. فحص مستوى التاجر
  IF p_merchant_id IS NOT NULL THEN
    SELECT value INTO v_val
    FROM public.setting_values
    WHERE key = p_key AND level = 'merchant' AND entity_id = p_merchant_id;
    IF v_val IS NOT NULL THEN
      RETURN v_val;
    END IF;
  END IF;

  -- 3. فحص مستوى المدينة
  IF p_city_id IS NOT NULL THEN
    SELECT value INTO v_val
    FROM public.setting_values
    WHERE key = p_key AND level = 'city' AND entity_id = p_city_id;
    IF v_val IS NOT NULL THEN
      RETURN v_val;
    END IF;
  END IF;

  -- 4. فحص المستوى العام
  SELECT value INTO v_val
  FROM public.setting_values
  WHERE key = p_key AND level = 'global' AND entity_id IS NULL;
  IF v_val IS NOT NULL THEN
    RETURN v_val;
  END IF;

  -- 5. الرجوع للقيمة الافتراضية
  SELECT default_value INTO v_default
  FROM public.setting_definitions
  WHERE key = p_key;

  RETURN v_default;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ==============================================================================
-- 10. سياسات الأمان والحماية على مستوى الصف (Row Level Security - RLS)
-- ==============================================================================

-- تفعيل RLS على جميع الجداول
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setting_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setting_values ENABLE ROW LEVEL SECURITY;

-- أ) سياسات profiles
CREATE POLICY "المستخدم يقرأ ملفه الشخصي والإدارة تقرأ الجميع"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin(auth.uid()));

CREATE POLICY "المستخدم يحدث ملفه الشخصي فقط"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ب) سياسات user_roles
CREATE POLICY "المستخدم يرى أدواره والإدارة ترى أدوار الجميع"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "المدير العام فقط يضيف أو يعدل أو يحذف الأدوار"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

-- ج) سياسات audit_log
CREATE POLICY "المدير العام والتشغيل والمالية يقرؤون سجل التدقيق"
  ON public.audit_log FOR SELECT
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'finance'));

-- لا توجد سياسة INSERT أو UPDATE أو DELETE لـ audit_log؛ الحفظ حصراً عبر trigger أمني (SECURITY DEFINER)

-- د) سياسات cities
CREATE POLICY "الجميع يقرأ المدن المفعلة والإدارة تقرأ الكل"
  ON public.cities FOR SELECT
  USING (is_active = true OR public.is_admin(auth.uid()));

CREATE POLICY "المدير العام والتشغيل يديرون المدن"
  ON public.cities FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'operations'));

-- هـ) سياسات zones
CREATE POLICY "المستخدمون المسجلون يقرؤون الزونات"
  ON public.zones FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "المدير العام والتشغيل يديرون الزونات"
  ON public.zones FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'operations'));

-- و) سياسات setting_definitions
CREATE POLICY "فريق الإدارة فقط يقرأ تعريفات الإعدادات"
  ON public.setting_definitions FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "المدير العام فقط يدير تعريفات الإعدادات"
  ON public.setting_definitions FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'));

-- ز) سياسات setting_values
CREATE POLICY "فريق الإدارة فقط يقرأ قيم الإعدادات"
  ON public.setting_values FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "المدير العام والتشغيل يديرون قيم الإعدادات"
  ON public.setting_values FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'operations'));
