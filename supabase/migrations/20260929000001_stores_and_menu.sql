-- ==============================================================================
-- الخطوة 1.3: ملف الترحيل لجداول التجار، المتاجر، الفروع، العقود، والمنيو
-- المتطلبات: MER-001 · MER-002 · MER-009 · MER-046 · MER-040 · MER-025 · REG-002
-- ==============================================================================

-- 1. أنواع التعداد (Enums)
CREATE TYPE public.store_type AS ENUM (
  'contracted_menu',        -- متعاقد بمنيو
  'contracted_text_only',   -- متعاقد بلا منيو (طلبات كتابة فقط)
  'uncontracted'            -- غير متعاقد (آلية اطلب اللي تبي)
);

CREATE TYPE public.operation_type AS ENUM (
  'restaurant',   -- مطاعم
  'retail',       -- محلات متنوعة
  'mart',         -- مارت
  'pharmacy'      -- صيدليات
);

CREATE TYPE public.menu_permission_type AS ENUM (
  'full',             -- صلاحية كاملة بدون مراجعة
  'price_tolerance',  -- تعديل الأسعار بلا اعتماد في حدود نسبة
  'review_required'   -- بالمراجعة (الافتراضي)
);

CREATE TYPE public.contract_pricing_model AS ENUM (
  'per_customer',     -- رسوم لكل عميل
  'percentage',       -- نسبة من المبيعات
  'no_commission'     -- بدون خصم
);

CREATE TYPE public.pickup_cost_bearer AS ENUM (
  'platform',
  'merchant',
  'split'
);

CREATE TYPE public.document_entity_type AS ENUM (
  'merchant',
  'branch'
);

CREATE TYPE public.review_request_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

-- 2. جدول المنشآت / التجار (Merchants)
CREATE TABLE public.merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commercial_name TEXT NOT NULL,
  cr_number TEXT,
  vat_number TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.merchants IS 'سجل المنشآت والكيانات التجارية للتاجر (MER-001)';

-- 3. جدول الحسابات البنكية المحمي (Merchant Bank Accounts)
CREATE TABLE public.merchant_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL UNIQUE REFERENCES public.merchants(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  iban TEXT NOT NULL,
  beneficiary_name TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.merchant_bank_accounts IS 'الحسابات البنكية للتاجر مع التحقق وسجل التدقيق (MER-001)';

CREATE TRIGGER trg_audit_merchant_bank_accounts
AFTER INSERT OR UPDATE OR DELETE ON public.merchant_bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- 4. جدول تصنيفات المتاجر (Store Categories)
CREATE TABLE public.store_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  section_key TEXT NOT NULL,
  icon_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.store_categories IS 'تصنيفات المتاجر لتحديد موضع الظهور دون التأثير على الرسوم (MER-009)';

-- 5. جدول المتاجر (Stores)
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  store_type public.store_type NOT NULL DEFAULT 'contracted_menu',
  operation_type public.operation_type NOT NULL DEFAULT 'restaurant',
  category_id UUID REFERENCES public.store_categories(id) ON DELETE SET NULL,
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE RESTRICT,
  delivery_zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL, -- NULL يعني المحافظة كاملة
  min_order_halalas INT NOT NULL DEFAULT 0 CHECK (min_order_halalas >= 0),
  default_prep_time_minutes INT NOT NULL DEFAULT 20 CHECK (default_prep_time_minutes > 0),
  can_exceed_max_prep_time BOOLEAN NOT NULL DEFAULT false,
  menu_permission public.menu_permission_type NOT NULL DEFAULT 'review_required',
  menu_price_tolerance_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (menu_price_tolerance_percentage >= 0),
  custom_delivery_fee_halalas INT,
  self_pickup_enabled BOOLEAN NOT NULL DEFAULT false,
  self_pickup_discount_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (self_pickup_discount_percentage >= 0),
  self_pickup_cost_bearer public.pickup_cost_bearer NOT NULL DEFAULT 'merchant',
  self_pickup_platform_share_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  pos_system_name TEXT,
  menu_slug TEXT NOT NULL UNIQUE,
  pharmacy_license_number TEXT,
  pharmacy_license_expiry DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stores IS 'المتاجر التابعة للتجار مع إعدادات التشغيل والمنيو ونظام الكاشير (09-stores.md)';

-- 6. جدول عقود المتاجر (Store Contracts)
CREATE TABLE public.store_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  pricing_model public.contract_pricing_model NOT NULL DEFAULT 'per_customer',
  tier1_fee_halalas INT NOT NULL DEFAULT 200,
  tier1_order_threshold_halalas INT NOT NULL DEFAULT 2500,
  tier2_fee_halalas INT NOT NULL DEFAULT 500,
  contract_per_customer_cap_halalas INT NOT NULL DEFAULT 3000,
  contract_per_customer_period_days INT NOT NULL DEFAULT 365,
  contract_percentage NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  menu_markup_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  menu_markup_platform_share_percentage NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  payment_gateway_fee_percentage NUMERIC(5,2) NOT NULL DEFAULT 2.50,
  payment_gateway_fee_fixed_halalas INT NOT NULL DEFAULT 100,
  mart_pharmacy_merchant_percentage NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  mart_pharmacy_customer_markup_percentage NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  text_orders_platform_fee_percentage NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.store_contracts IS 'عقود المتاجر المالية المؤرخة والمستقلة (12-fees.md)';

-- تعبئة القيم الافتراضية للعقد الجديد من الإعدادات المرنة
CREATE OR REPLACE FUNCTION public.populate_contract_defaults_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_city_id UUID;
BEGIN
  SELECT city_id INTO v_city_id FROM public.stores WHERE id = NEW.store_id;

  -- قراءة القيم من دالة get_setting إذا لم يتم تمريرها
  IF NEW.tier1_fee_halalas IS NULL OR NEW.tier1_fee_halalas = 200 THEN
    NEW.tier1_fee_halalas := COALESCE((public.get_setting('tier1_fee_halalas', v_city_id, NULL, NEW.store_id)#>>'{}')::INT, 200);
  END IF;
  IF NEW.tier2_fee_halalas IS NULL OR NEW.tier2_fee_halalas = 500 THEN
    NEW.tier2_fee_halalas := COALESCE((public.get_setting('tier2_fee_halalas', v_city_id, NULL, NEW.store_id)#>>'{}')::INT, 500);
  END IF;
  IF NEW.contract_percentage IS NULL OR NEW.contract_percentage = 10.00 THEN
    NEW.contract_percentage := COALESCE((public.get_setting('store_contract_percentage', v_city_id, NULL, NEW.store_id)#>>'{}')::NUMERIC, 10.00);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_populate_contract_defaults
BEFORE INSERT ON public.store_contracts
FOR EACH ROW EXECUTE FUNCTION public.populate_contract_defaults_fn();

-- 7. جداول الكباتن المفضلين والمناديب المحظورين
CREATE TABLE public.store_favorite_drivers (
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, driver_id)
);

CREATE TABLE public.store_blocked_drivers (
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, driver_id)
);

-- 8. جداول المستندات (Document Types & Uploads)
CREATE TABLE public.document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  applies_to public.document_entity_type NOT NULL,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  requires_expiry_date BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.document_types IS 'أنواع المستندات الرسمية الإلزامية للمنشأة والفروع (MER-001)';

CREATE TABLE public.uploaded_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type_id UUID NOT NULL REFERENCES public.document_types(id) ON DELETE RESTRICT,
  entity_type public.document_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  file_url TEXT NOT NULL,
  expiry_date DATE,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.uploaded_documents IS 'المستندات المرفوعة مع تواريخ انتهائها وحالة التحقق منها (MER-001)';

-- 9. جدول الفروع (Store Branches)
CREATE TABLE public.store_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE RESTRICT,
  location extensions.geography(Point, 4326) NOT NULL,
  address_text TEXT NOT NULL,
  working_hours JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_prep_time_minutes INT NOT NULL DEFAULT 20 CHECK (default_prep_time_minutes > 0),
  min_order_halalas INT NOT NULL DEFAULT 0 CHECK (min_order_halalas >= 0),
  is_active BOOLEAN NOT NULL DEFAULT false,
  paused_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_store_branches_location ON public.store_branches USING GIST (location);
COMMENT ON TABLE public.store_branches IS 'فروع المتاجر ومواقعها وساعات عملها وحالة تفعيلها (MER-001)';

-- التحقق من المستندات الإلزامية قبل تفعيل الفرع (MER-001)
CREATE OR REPLACE FUNCTION public.check_branch_activation_documents_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_missing_doc_count INT;
BEGIN
  -- إذا كان الفرع سيتم تفعيله
  IF NEW.is_active = true THEN
    SELECT COUNT(*) INTO v_missing_doc_count
    FROM public.document_types dt
    WHERE dt.applies_to = 'branch'
      AND dt.is_mandatory = true
      AND NOT EXISTS (
        SELECT 1 FROM public.uploaded_documents ud
        WHERE ud.document_type_id = dt.id
          AND ud.entity_id = NEW.id
          AND (dt.requires_expiry_date = false OR ud.expiry_date IS NULL OR ud.expiry_date >= CURRENT_DATE)
      );

    IF v_missing_doc_count > 0 THEN
      RAISE EXCEPTION 'لا يمكن تفعيل الفرع ينقصه % مستند إلزامي ساري المفعول (MER-001)', v_missing_doc_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_branch_activation
BEFORE INSERT OR UPDATE OF is_active ON public.store_branches
FOR EACH ROW EXECUTE FUNCTION public.check_branch_activation_documents_fn();

-- 10. جدول أسباب إعفاء الغذاء والدواء (SFDA Exemption Reasons)
CREATE TABLE public.sfda_exemption_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  reason_ar TEXT NOT NULL,
  reason_en TEXT NOT NULL
);

COMMENT ON TABLE public.sfda_exemption_reasons IS 'أسباب الإعفاء النظامي من لائحة السعرات الغذائية المعتمدة من SFDA (REG-002)';

-- 11. جداول المنيو والكتالوج
CREATE TABLE public.menu_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.menu_sections IS 'أقسام المنيو للمتاجر المتعاقدة';

-- منع إضافة أقسام لمتجر غير متعاقد (MER-046)
CREATE OR REPLACE FUNCTION public.check_store_allows_menu_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_store_type public.store_type;
BEGIN
  SELECT store_type INTO v_store_type FROM public.stores WHERE id = NEW.store_id;
  IF v_store_type = 'uncontracted' THEN
    RAISE EXCEPTION 'متجر غير متعاقد لا يمكن إضافة منيو له (MER-046)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_store_allows_menu_sections
BEFORE INSERT ON public.menu_sections
FOR EACH ROW EXECUTE FUNCTION public.check_store_allows_menu_fn();

CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.menu_sections(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_ar TEXT,
  description_en TEXT,
  image_url TEXT,
  base_price_halalas INT NOT NULL CHECK (base_price_halalas >= 0),
  prep_time_minutes INT NOT NULL CHECK (prep_time_minutes > 0),
  available_hours JSONB,
  is_available BOOLEAN NOT NULL DEFAULT true,
  paused_until TIMESTAMPTZ,
  is_published BOOLEAN NOT NULL DEFAULT false,
  -- البيانات الغذائية (MER-025, CUS-019, REG-002)
  calories_value INT,
  calories_min INT,
  calories_max INT,
  allergens TEXT[] NOT NULL DEFAULT '{}',
  has_caffeine BOOLEAN NOT NULL DEFAULT false,
  caffeine_mg INT,
  sodium_mg INT,
  is_high_salt BOOLEAN NOT NULL DEFAULT false,
  dietary_tags TEXT[] NOT NULL DEFAULT '{}',
  is_sfda_exempt BOOLEAN NOT NULL DEFAULT false,
  sfda_exemption_reason_id UUID REFERENCES public.sfda_exemption_reasons(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.menu_items IS 'أصناف المنيو مع الأسعار ومدة التحضير والبيانات الغذائية (MER-025, MER-040)';

-- فحص سقف مدة التحضير (MER-040)
CREATE OR REPLACE FUNCTION public.check_menu_item_prep_time_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_store RECORD;
BEGIN
  SELECT s.can_exceed_max_prep_time INTO v_store
  FROM public.menu_sections sec
  JOIN public.stores s ON s.id = sec.store_id
  WHERE sec.id = NEW.section_id;

  IF NEW.prep_time_minutes > 40 AND NOT COALESCE(v_store.can_exceed_max_prep_time, false) THEN
    RAISE EXCEPTION 'مدة تحضير الصنف (% دقيقة) تتجاوز الحد الأقصى 40 دقيقة (MER-040)', NEW.prep_time_minutes;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_menu_item_prep_time
BEFORE INSERT OR UPDATE OF prep_time_minutes ON public.menu_items
FOR EACH ROW EXECUTE FUNCTION public.check_menu_item_prep_time_fn();

-- فحص البيانات الغذائية الإلزامية قبل النشر (MER-025, REG-002)
CREATE OR REPLACE FUNCTION public.check_menu_item_publishing_nutrition_fn()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_published = true THEN
    -- يجب توفر السعرات إما كقيمة أو كنطاق، إلا إذا كان الصنف معفياً بسبب مسجل
    IF NOT (
      NEW.calories_value IS NOT NULL OR
      (NEW.calories_min IS NOT NULL AND NEW.calories_max IS NOT NULL) OR
      (NEW.is_sfda_exempt = true AND NEW.sfda_exemption_reason_id IS NOT NULL)
    ) THEN
      RAISE EXCEPTION 'صنف ناقص حقول السعرات وغير موسوم بمعفى بنص نظامي لا يُعتمد للنشر (MER-025)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_menu_item_publishing_nutrition
BEFORE INSERT OR UPDATE OF is_published, calories_value, calories_min, calories_max, is_sfda_exempt, sfda_exemption_reason_id ON public.menu_items
FOR EACH ROW EXECUTE FUNCTION public.check_menu_item_publishing_nutrition_fn();

-- 12. جداول الأحجام والخيارات والإضافات
CREATE TABLE public.menu_item_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  price_delta_halalas INT NOT NULL DEFAULT 0,
  calories_value INT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE public.menu_item_option_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  min_selectable INT NOT NULL DEFAULT 0,
  max_selectable INT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE public.menu_item_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.menu_item_option_groups(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  price_delta_halalas INT NOT NULL DEFAULT 0,
  calories_delta INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);

-- 13. جدول طلبات مراجعة المنيو (Menu Review Requests)
CREATE TABLE public.menu_review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('price_update', 'item_create', 'item_edit')),
  old_price_halalas INT,
  proposed_price_halalas INT NOT NULL,
  status public.review_request_status NOT NULL DEFAULT 'pending',
  requested_by UUID REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

COMMENT ON TABLE public.menu_review_requests IS 'طلبات مراجعة المنيو والأسعار للتاجر (MER-002)';

-- 14. جدول مستخدمي التاجر وصلاحياتهم (Merchant Users)
CREATE TABLE public.merchant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.store_branches(id) ON DELETE CASCADE,
  can_view_finance BOOLEAN NOT NULL DEFAULT false,
  can_manage_menu BOOLEAN NOT NULL DEFAULT false,
  can_manage_orders BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_merchant_users UNIQUE NULLS NOT DISTINCT (merchant_id, user_id, branch_id)
);

COMMENT ON TABLE public.merchant_users IS 'ربط الموظفين والمديرين بالتاجر والفروع مع صلاحيات المالية والمنيو (MER-043)';

-- 15. دالة خادم لتحديث أسعار المنيو وفق صلاحيات التاجر (MER-002)
CREATE OR REPLACE FUNCTION public.submit_menu_item_price_update(
  p_item_id UUID,
  p_new_price_halalas INT
) RETURNS JSONB AS $$
DECLARE
  v_item RECORD;
  v_store RECORD;
  v_diff_pct NUMERIC;
BEGIN
  -- جلب الصنف والمتجر
  SELECT i.*, s.id as store_id, s.menu_permission, s.menu_price_tolerance_percentage
  INTO v_item
  FROM public.menu_items i
  JOIN public.menu_sections sec ON sec.id = i.section_id
  JOIN public.stores s ON s.id = sec.store_id
  WHERE i.id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'الصنف المطلوب غير موجود';
  END IF;

  -- 1. إذا كان المتجر يملك صلاحية كاملة -> تطبيق فوري
  IF v_item.menu_permission = 'full' THEN
    UPDATE public.menu_items
    SET base_price_halalas = p_new_price_halalas, updated_at = now()
    WHERE id = p_item_id;

    RETURN jsonb_build_object(
      'status', 'applied_immediately',
      'reason', 'full_permission',
      'old_price', v_item.base_price_halalas,
      'new_price', p_new_price_halalas
    );
  END IF;

  -- 2. إذا كان المتجر يملك صلاحية بنسبة سماح
  IF v_item.menu_permission = 'price_tolerance' THEN
    IF v_item.base_price_halalas > 0 THEN
      v_diff_pct := ABS(p_new_price_halalas - v_item.base_price_halalas) * 100.0 / v_item.base_price_halalas;
    ELSE
      v_diff_pct := 100.0;
    END IF;

    IF v_diff_pct <= v_item.menu_price_tolerance_percentage THEN
      UPDATE public.menu_items
      SET base_price_halalas = p_new_price_halalas, updated_at = now()
      WHERE id = p_item_id;

      RETURN jsonb_build_object(
        'status', 'applied_immediately',
        'reason', 'within_tolerance',
        'difference_percentage', v_diff_pct,
        'old_price', v_item.base_price_halalas,
        'new_price', p_new_price_halalas
      );
    ELSE
      -- تجاوز النسبة المسموحة -> إنشاء طلب مراجعة
      INSERT INTO public.menu_review_requests (
        store_id, item_id, change_type, old_price_halalas, proposed_price_halalas, requested_by
      ) VALUES (
        v_item.store_id, p_item_id, 'price_update', v_item.base_price_halalas, p_new_price_halalas, auth.uid()
      );

      RETURN jsonb_build_object(
        'status', 'pending_review',
        'reason', 'exceeds_tolerance',
        'difference_percentage', v_diff_pct,
        'tolerance', v_item.menu_price_tolerance_percentage
      );
    END IF;
  END IF;

  -- 3. في الوضع الافتراضي (بالمراجعة) -> إنشاء طلب مراجعة
  INSERT INTO public.menu_review_requests (
    store_id, item_id, change_type, old_price_halalas, proposed_price_halalas, requested_by
  ) VALUES (
    v_item.store_id, p_item_id, 'price_update', v_item.base_price_halalas, p_new_price_halalas, auth.uid()
  );

  RETURN jsonb_build_object(
    'status', 'pending_review',
    'reason', 'review_required',
    'old_price', v_item.base_price_halalas,
    'new_price', p_new_price_halalas
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 16. سياسات الحماية على مستوى الصف (RLS)
-- ==============================================================================

ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_favorite_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_blocked_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sfda_exemption_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_review_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_users ENABLE ROW LEVEL SECURITY;

-- أ) التصنيفات: قراءة عامة للجميع
CREATE POLICY "الجميع يقرأ التصنيفات المفعلة"
  ON public.store_categories FOR SELECT
  USING (is_active = true OR public.is_admin(auth.uid()));

CREATE POLICY "الإدارة تدير التصنيفات"
  ON public.store_categories FOR ALL
  USING (public.is_admin(auth.uid()));

-- ب) المتاجر: قراءة عامة، وإدارة للمالك والإدارة
CREATE POLICY "الجميع يقرأ المتاجر"
  ON public.stores FOR SELECT
  USING (true);

CREATE POLICY "الإدارة تدير المتاجر"
  ON public.stores FOR ALL
  USING (public.is_admin(auth.uid()));

-- ج) الفروع: قراءة الفروع المفعلة، أو فروع موظف التاجر
CREATE POLICY "الجميع يقرأ الفروع المفعلة"
  ON public.store_branches FOR SELECT
  USING (
    is_active = true
    OR public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.merchant_users mu
      JOIN public.stores s ON s.merchant_id = mu.merchant_id
      WHERE s.id = store_branches.store_id
        AND mu.user_id = auth.uid()
        AND (mu.branch_id IS NULL OR mu.branch_id = store_branches.id)
    )
  );

CREATE POLICY "الإدارة تدير الفروع"
  ON public.store_branches FOR ALL
  USING (public.is_admin(auth.uid()));

-- د) المنيو والأصناف: قراءة الأصناف المنشورة للجميع، أو التاجر لمتجره
CREATE POLICY "الجميع يقرأ أقسام المنيو النشطة"
  ON public.menu_sections FOR SELECT
  USING (is_active = true OR public.is_admin(auth.uid()));

CREATE POLICY "الجميع يقرأ الأصناف المنشورة"
  ON public.menu_items FOR SELECT
  USING (is_published = true OR public.is_admin(auth.uid()));

CREATE POLICY "قراءة أحجام الأصناف"
  ON public.menu_item_sizes FOR SELECT
  USING (true);

CREATE POLICY "قراءة مجموعات الخيارات"
  ON public.menu_item_option_groups FOR SELECT
  USING (true);

CREATE POLICY "قراءة الخيارات"
  ON public.menu_item_options FOR SELECT
  USING (true);

CREATE POLICY "قراءة أسباب إعفاء الغذاء والدواء"
  ON public.sfda_exemption_reasons FOR SELECT
  USING (true);

-- هـ) العقود والمالية: الإدارة، والتاجر ذو صلاحية المالية فقط (MER-043)
CREATE POLICY "الإدارة ومالك المتجر المالي يقرؤون العقود"
  ON public.store_contracts FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.merchant_users mu
      JOIN public.stores s ON s.merchant_id = mu.merchant_id
      WHERE s.id = store_contracts.store_id
        AND mu.user_id = auth.uid()
        AND mu.can_view_finance = true
    )
  );

CREATE POLICY "الإدارة فقط تعدل العقود"
  ON public.store_contracts FOR ALL
  USING (public.is_admin(auth.uid()));

-- و) الحسابات البنكية: الإدارة والتاجر صاحب الصلاحية المالية
CREATE POLICY "الإدارة وصاحب الصلاحية المالية يقرؤون الحساب البنكي"
  ON public.merchant_bank_accounts FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.merchant_users mu
      WHERE mu.merchant_id = merchant_bank_accounts.merchant_id
        AND mu.user_id = auth.uid()
        AND mu.can_view_finance = true
    )
  );

CREATE POLICY "الإدارة فقط تدير الحسابات البنكية مباشرة"
  ON public.merchant_bank_accounts FOR ALL
  USING (public.is_admin(auth.uid()));

-- ز) المستندات
CREATE POLICY "قراءة أنواع المستندات"
  ON public.document_types FOR SELECT
  USING (true);

CREATE POLICY "الإدارة تدير أنواع المستندات"
  ON public.document_types FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "الإدارة والتاجر يقرؤون مستنداتهم"
  ON public.uploaded_documents FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR (
      entity_type = 'merchant' AND EXISTS (
        SELECT 1 FROM public.merchant_users mu
        WHERE mu.merchant_id = uploaded_documents.entity_id AND mu.user_id = auth.uid()
      )
    )
    OR (
      entity_type = 'branch' AND EXISTS (
        SELECT 1 FROM public.merchant_users mu
        WHERE mu.branch_id = uploaded_documents.entity_id AND mu.user_id = auth.uid()
      )
    )
  );

-- ح) طلبات المراجعة
CREATE POLICY "الإدارة والتاجر يقرؤون طلبات مراجعة المنيو"
  ON public.menu_review_requests FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.merchant_users mu
      JOIN public.stores s ON s.merchant_id = mu.merchant_id
      WHERE s.id = menu_review_requests.store_id AND mu.user_id = auth.uid()
    )
  );

-- ط) مستخدمو التاجر
CREATE POLICY "الإدارة والتاجر يقرؤون مستخدمي التاجر"
  ON public.merchant_users FOR SELECT
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.merchant_users mu
      WHERE mu.merchant_id = merchant_users.merchant_id AND mu.user_id = auth.uid()
    )
  );
