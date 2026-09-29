-- ==============================================================================
-- الخطوة 2.2: الدخول برقم الجوال وحساب العميل وسجل الموافقات (CUS-001, CUS-012, REG-004, ADM-001)
-- ==============================================================================

-- 1. سماح إنشاء الملف الشخصي للعميل (إذا لم يكن منشأ مسبقاً)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' AND policyname = 'المستخدم ينشئ ملفه الشخصي'
  ) THEN
    CREATE POLICY "المستخدم ينشئ ملفه الشخصي"
      ON public.profiles FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- دالة وتريغر لإنشاء profile ودور customer تلقائياً عند تسجيل مستخدم جديد
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- إدراج الملف الشخصي إذا لم يكن موجوداً
  INSERT INTO public.profiles (id, full_name, phone, preferred_language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'ar')
  )
  ON CONFLICT (id) DO UPDATE
  SET phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

  -- إضافة دور customer كدور افتراضي لأي مستخدم جديد يسجل برقم جوال
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 2. جدول سجل الموافقات (user_consents) - محمي وغير قابل للتعديل أو الحذف (REG-004)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('terms_and_privacy', 'age_18', 'marketing')),
  status TEXT NOT NULL CHECK (status IN ('granted', 'revoked')),
  version TEXT NOT NULL DEFAULT '1.0',
  device_info JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_consents IS 'سجل الموافقات الرقابي: الشروط، السن القانوني 18+، والتسويق (REG-004)';

-- تفعيل RLS على سجل الموافقات
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "العميل يقرأ موافقاته فقط والإدارة تقرأ الجميع"
  ON public.user_consents FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "العميل يضيف موافقاته الخاصة فقط"
  ON public.user_consents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- منع التعديل والحذف نهائياً لضمان النزاهة القانونية (REG-004)
CREATE OR REPLACE FUNCTION public.prevent_user_consents_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'سجل الموافقات محمي نظاماً وغير قابل للتعديل أو الحذف (REG-004)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_consents_immutable ON public.user_consents;
CREATE TRIGGER trg_user_consents_immutable
  BEFORE UPDATE OR DELETE ON public.user_consents
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_consents_mutation();

-- ==============================================================================
-- 3. جدول طلبات حذف الحساب (account_deletion_requests) - (CUS-001)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  reason TEXT,
  acknowledged_forfeiture BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.account_deletion_requests IS 'طلبات حذف الحساب المقدمة من العملاء مع إقرار إسقاط الأرصدة (CUS-001)';

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "العميل يقرأ طلب حذف حسابه والإدارة تقرأ الكل"
  ON public.account_deletion_requests FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "العميل ينشئ طلب حذف حسابه"
  ON public.account_deletion_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "الإدارة فقط تحدث طلب حذف الحساب"
  ON public.account_deletion_requests FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ==============================================================================
-- 4. جدول ودوال حدود رسائل الرمز OTP (ADM-001)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.otp_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  device_id TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_rate_limits_phone ON public.otp_rate_limits(phone, created_at);
CREATE INDEX IF NOT EXISTS idx_otp_rate_limits_device ON public.otp_rate_limits(device_id, created_at);

ALTER TABLE public.otp_rate_limits ENABLE ROW LEVEL SECURITY;

-- دالة أمنية لفحص وتسجيل طلب رمز التحقق وفرض الحدود
CREATE OR REPLACE FUNCTION public.check_and_record_otp_request(
  p_phone TEXT,
  p_device_id TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_max_phone INT;
  v_max_device INT;
  v_window_mins INT;
  v_count_phone INT;
  v_count_device INT;
  v_window_interval INTERVAL;
BEGIN
  -- قراءة الحدود من الإعدادات المرنة
  v_max_phone := COALESCE((public.get_setting('otp_max_requests_per_phone')#>>'{}')::INT, 5);
  v_max_device := COALESCE((public.get_setting('otp_max_requests_per_device')#>>'{}')::INT, 10);
  v_window_mins := COALESCE((public.get_setting('otp_rate_limit_window_minutes')#>>'{}')::INT, 15);
  v_window_interval := (v_window_mins || ' minutes')::INTERVAL;

  -- 1. فحص حد الهاتف
  SELECT COUNT(*) INTO v_count_phone
  FROM public.otp_rate_limits
  WHERE phone = p_phone
    AND created_at >= (now() - v_window_interval);

  IF v_count_phone >= v_max_phone THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'phone_limit_exceeded',
      'message', 'تم تجاوز الحد الأقصى لرسائل التحقق لهذا الرقم. يرجى الانتظار 15 دقيقة.'
    );
  END IF;

  -- 2. فحص حد الجهاز (إذا تم إرسال معرّف الجهاز)
  IF p_device_id IS NOT NULL AND p_device_id <> '' THEN
    SELECT COUNT(*) INTO v_count_device
    FROM public.otp_rate_limits
    WHERE device_id = p_device_id
      AND created_at >= (now() - v_window_interval);

    IF v_count_device >= v_max_device THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'device_limit_exceeded',
        'message', 'تم تجاوز الحد الأقصى للطلبات من هذا الجهاز. يرجى الانتظار لاحقاً.'
      );
    END IF;
  END IF;

  -- تسجيل الطلب بنجاح
  INSERT INTO public.otp_rate_limits (phone, device_id, ip_address)
  VALUES (p_phone, p_device_id, p_ip);

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining_phone', v_max_phone - v_count_phone - 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 5. إعدادات مرنة جديدة (ADM-001, REG-004)
-- ==============================================================================

INSERT INTO public.setting_definitions (key, name_ar, description_ar, type, default_value, allowed_levels, related_requirements)
VALUES
  (
    'otp_max_requests_per_phone',
    'الحد الأقصى لرسائل OTP لكل رقم',
    'الحد الأقصى لعدد رسائل رمز التحقق المسموح بها لرقم الهاتف الواحد خلال النافذة الزمنية',
    'number',
    '5'::jsonb,
    '{"global"}',
    '{"ADM-001"}'
  ),
  (
    'otp_max_requests_per_device',
    'الحد الأقصى لرسائل OTP لكل جهاز',
    'الحد الأقصى لعدد رسائل رمز التحقق المسموح بطلبها من نفس الجهاز خلال النافذة الزمنية',
    'number',
    '10'::jsonb,
    '{"global"}',
    '{"ADM-001"}'
  ),
  (
    'otp_rate_limit_window_minutes',
    'مدة نافذة حد رسائل OTP بالدقائق',
    'المدة الزمنية بالدقائق التي يُحتسب خلالها عدد رسائل رمز التحقق',
    'duration_minutes',
    '15'::jsonb,
    '{"global"}',
    '{"ADM-001"}'
  ),
  (
    'terms_version',
    'رقم النسخة الحالية للشروط وسياسة الخصوصية',
    'رقم النسخة المعتمدة؛ تغييره يتطلب موافقة العميل من جديد عند الدخول (REG-004)',
    'select',
    '"1.0"'::jsonb,
    '{"global"}',
    '{"REG-004", "CUS-012"}'
  )
ON CONFLICT (key) DO UPDATE
SET name_ar = EXCLUDED.name_ar,
    description_ar = EXCLUDED.description_ar,
    default_value = EXCLUDED.default_value,
    allowed_levels = EXCLUDED.allowed_levels,
    related_requirements = EXCLUDED.related_requirements;
