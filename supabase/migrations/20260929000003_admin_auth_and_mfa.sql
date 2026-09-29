-- ==============================================================================
-- الخطوة 1.4: تعزيز أمان لوحة الإدارة، التحقق بخطوتين (MFA / AAL2)، وجدول الدعوات
-- المتطلبات: ADM-001 · ADM-002 · ADM-034 · DSP-002
-- ==============================================================================

-- 1. دالة التحقق من اشتراط الخطوة الثانية للمديرين
CREATE OR REPLACE FUNCTION public.is_admin_aal2(_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- إذا كان الطلب من السكربتات الداخلية أو service_role يتجاوز فحص JWT
  IF auth.role() = 'service_role' THEN
    RETURN public.is_admin(_user_id);
  END IF;

  -- اشتراط التحقق بخطوتين (aal2)
  IF COALESCE(auth.jwt()->>'aal', 'aal1') <> 'aal2' THEN
    RETURN FALSE;
  END IF;

  RETURN public.is_admin(_user_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. جدول دعوات موظفي الإدارة (Admin Invitations)
CREATE TABLE IF NOT EXISTS public.admin_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role public.app_role NOT NULL,
  city_id UUID REFERENCES public.cities(id) ON DELETE SET NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

COMMENT ON TABLE public.admin_invitations IS 'دعوات موظفي الإدارة الجدد مع تحديد أدوارهم ونطاقهم الجغرافي (ADM-001)';

ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "المدير العام فقط يدير الدعوات"
  ON public.admin_invitations FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin') AND (auth.jwt()->>'aal' = 'aal2' OR auth.role() = 'service_role'));

-- 3. تحديث سياسات RLS لاشتراط الخطوة الثانية ومنع موظف الدعم من الشؤون المالية (ADM-001)

-- أ) سجل التدقيق: يتطلب aal2 وممنوع على الدعم
DROP POLICY IF EXISTS "المدير العام والتشغيل والمالية يقرؤون سجل التدقيق" ON public.audit_log;

CREATE POLICY "المدير العام والتشغيل والمالية يقرؤون سجل التدقيق بخطوتين"
  ON public.audit_log FOR SELECT
  USING (
    (
      public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'operations')
      OR public.has_role(auth.uid(), 'finance')
    )
    AND (auth.jwt()->>'aal' = 'aal2' OR auth.role() = 'service_role')
  );

-- ب) تعريفات الإعدادات: تتطلب aal2، وموظف الدعم لا يقرأ الإعدادات المالية
DROP POLICY IF EXISTS "فريق الإدارة فقط يقرأ تعريفات الإعدادات" ON public.setting_definitions;

CREATE POLICY "فريق الإدارة يقرأ تعريفات الإعدادات بخطوتين باستثناء مالية الدعم"
  ON public.setting_definitions FOR SELECT
  USING (
    public.is_admin(auth.uid())
    AND (auth.jwt()->>'aal' = 'aal2' OR auth.role() = 'service_role')
    AND (
      -- إذا كان دوره دعم فقط، يُحجب عنه أي إعداد مالي
      NOT (
        public.has_role(auth.uid(), 'support')
        AND NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance') OR public.has_role(auth.uid(), 'operations'))
        AND (
          key ILIKE '%fee%'
          OR key ILIKE '%contract%'
          OR key ILIKE '%vat%'
          OR key ILIKE '%halalas%'
          OR key ILIKE '%markup%'
          OR key ILIKE '%commission%'
          OR key ILIKE '%penalty%'
          OR key ILIKE '%fine%'
        )
      )
    )
  );

-- ج) تعديل قيم الإعدادات: يتطلب aal2 ولا يمكن للدعم التعديل
DROP POLICY IF EXISTS "المدير العام والتشغيل يديرون قيم الإعدادات" ON public.setting_values;
DROP POLICY IF EXISTS "فريق الإدارة فقط يقرأ قيم الإعدادات" ON public.setting_values;

CREATE POLICY "فريق الإدارة يقرأ قيم الإعدادات بخطوتين"
  ON public.setting_values FOR SELECT
  USING (
    public.is_admin(auth.uid())
    AND (auth.jwt()->>'aal' = 'aal2' OR auth.role() = 'service_role')
    AND (
      NOT (
        public.has_role(auth.uid(), 'support')
        AND NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'finance') OR public.has_role(auth.uid(), 'operations'))
        AND (
          key ILIKE '%fee%'
          OR key ILIKE '%contract%'
          OR key ILIKE '%vat%'
          OR key ILIKE '%halalas%'
          OR key ILIKE '%markup%'
          OR key ILIKE '%commission%'
          OR key ILIKE '%penalty%'
          OR key ILIKE '%fine%'
        )
      )
    )
  );

CREATE POLICY "المدير العام والتشغيل يديرون قيم الإعدادات بخطوتين"
  ON public.setting_values FOR ALL
  USING (
    (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'operations'))
    AND (auth.jwt()->>'aal' = 'aal2' OR auth.role() = 'service_role')
  );
