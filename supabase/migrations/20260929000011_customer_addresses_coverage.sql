-- Migration: 20260929000011_customer_addresses_coverage.sql
-- Step 2.3: Addresses, Location Accuracy, and Out-of-Coverage Requests (CUS-002, ADM-033)

-- 1. جدول عناوين العميل
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'house' CHECK (type IN ('house', 'apartment', 'office', 'other')),
  location extensions.geography(Point, 4326) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  city_id UUID REFERENCES public.cities(id),
  district_name TEXT,
  street_name TEXT,
  building TEXT,
  floor TEXT,
  apartment TEXT,
  entry_instructions TEXT,
  no_answer_instructions TEXT,
  short_national_address TEXT,
  pin_confirmed_at TIMESTAMPTZ NOT NULL,
  corrected_entrance_location extensions.geography(Point, 4326),
  corrected_entrance_lat DOUBLE PRECISION,
  corrected_entrance_lng DOUBLE PRECISION,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.customer_addresses IS 'عناوين التوصيل للعملاء مع الدبوس الدقيق والتحقق من التغطية وتأكيد الدبوس الإلزامي CUS-002';
COMMENT ON COLUMN public.customer_addresses.pin_confirmed_at IS 'وقت تأكيد العميل للدبوس على الخريطة - إلزامي في قاعدة البيانات';
COMMENT ON COLUMN public.customer_addresses.corrected_entrance_location IS 'موقع المدخل المصحح من قبل المندوب في المرحلة 4';

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON public.customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_location ON public.customer_addresses USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_city_id ON public.customer_addresses(city_id);

-- دالة معالجة العنوان والتحقق من المدينة والتغطية وتأكيد الدبوس
CREATE OR REPLACE FUNCTION public.fn_process_customer_address()
RETURNS TRIGGER AS $$
DECLARE
  v_city public.cities%ROWTYPE;
BEGIN
  -- مزامنة الإحداثيات والنقطة الجغرافية
  IF NEW.location IS NULL THEN
    IF NEW.latitude IS NULL OR NEW.longitude IS NULL THEN
      RAISE EXCEPTION 'إحداثيات العنوان مطلوبة (lat, lng)';
    END IF;
    NEW.location := extensions.ST_SetSRID(extensions.ST_Point(NEW.longitude, NEW.latitude), 4326)::extensions.geography;
  ELSE
    NEW.latitude := extensions.ST_Y(NEW.location::extensions.geometry);
    NEW.longitude := extensions.ST_X(NEW.location::extensions.geometry);
  END IF;

  -- اشتراط تأكيد الدبوس الصريح CUS-002
  IF NEW.pin_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'وقت تأكيد الدبوس إلزامي لحفظ العنوان (CUS-002)';
  END IF;

  -- فحص وقوع الدبوس داخل إحدى المدن المفعّلة ADM-033
  SELECT * INTO v_city FROM public.city_for_point(NEW.latitude, NEW.longitude);
  IF v_city.id IS NULL THEN
    RAISE EXCEPTION 'الموقع المحدد خارج نطاق تغطية المدن المفعّلة (ADM-033)';
  END IF;

  NEW.city_id := v_city.id;
  NEW.updated_at := now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customer_address_before_insert_update ON public.customer_addresses;
CREATE TRIGGER trg_customer_address_before_insert_update
  BEFORE INSERT OR UPDATE ON public.customer_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_process_customer_address();

-- دالة إدارة العنوان الافتراضي
CREATE OR REPLACE FUNCTION public.fn_manage_customer_address_default()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.customer_addresses
    SET is_default = false
    WHERE customer_id = NEW.customer_id
      AND id != NEW.id;
  ELSE
    -- إذا كان هذا هو العنوان الوحيد للعميل نجعله افتراضياً تلقائياً
    IF NOT EXISTS (
      SELECT 1 FROM public.customer_addresses
      WHERE customer_id = NEW.customer_id
        AND id != NEW.id
    ) THEN
      NEW.is_default := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customer_address_default ON public.customer_addresses;
CREATE TRIGGER trg_customer_address_default
  BEFORE INSERT OR UPDATE OF is_default ON public.customer_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_manage_customer_address_default();

-- 2. جدول طلبات التغطية للمواقع غير المغطاة (ADM-033)
CREATE TABLE IF NOT EXISTS public.coverage_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location extensions.geography(Point, 4326) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  device_id TEXT,
  district_name TEXT,
  city_hint TEXT,
  note TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.coverage_requests IS 'طلبات تسجيل الاهتمام بالمناطق غير المغطاة ADM-033';

CREATE INDEX IF NOT EXISTS idx_coverage_requests_location ON public.coverage_requests USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_coverage_requests_created_at ON public.coverage_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coverage_requests_device_id ON public.coverage_requests(device_id);

-- دالة إرسال طلب التغطية مع فحص حد الإغراق
CREATE OR REPLACE FUNCTION public.submit_coverage_request(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_device_id TEXT DEFAULT NULL,
  p_district_name TEXT DEFAULT NULL,
  p_city_hint TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
) RETURNS public.coverage_requests AS $$
DECLARE
  v_user_id UUID;
  v_count INT;
  v_new_req public.coverage_requests%ROWTYPE;
BEGIN
  v_user_id := auth.uid();

  -- حماية من الإغراق: أقصى حد 5 طلبات في الساعة من نفس الجهاز أو الحساب
  IF v_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.coverage_requests
    WHERE customer_id = v_user_id
      AND created_at > now() - INTERVAL '1 hour';
  ELSIF p_device_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.coverage_requests
    WHERE device_id = p_device_id
      AND created_at > now() - INTERVAL '1 hour';
  ELSE
    v_count := 0;
  END IF;

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'تجاوزت الحد المسموح لإرسال طلبات التغطية في هذه الساعة. شكراً لاهتمامك.';
  END IF;

  INSERT INTO public.coverage_requests (
    location,
    latitude,
    longitude,
    customer_id,
    device_id,
    district_name,
    city_hint,
    note
  ) VALUES (
    extensions.ST_SetSRID(extensions.ST_Point(p_lng, p_lat), 4326)::extensions.geography,
    p_lat,
    p_lng,
    v_user_id,
    p_device_id,
    p_district_name,
    p_city_hint,
    p_note
  ) RETURNING * INTO v_new_req;

  RETURN v_new_req;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. صلاحيات الأمان والحماية RLS
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_addresses_select_own" ON public.customer_addresses;
CREATE POLICY "customer_addresses_select_own"
  ON public.customer_addresses FOR SELECT
  USING (
    customer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'operations', 'support', 'finance')
    )
  );

DROP POLICY IF EXISTS "customer_addresses_insert_own" ON public.customer_addresses;
CREATE POLICY "customer_addresses_insert_own"
  ON public.customer_addresses FOR INSERT
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "customer_addresses_update_own" ON public.customer_addresses;
CREATE POLICY "customer_addresses_update_own"
  ON public.customer_addresses FOR UPDATE
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "customer_addresses_delete_own" ON public.customer_addresses;
CREATE POLICY "customer_addresses_delete_own"
  ON public.customer_addresses FOR DELETE
  USING (customer_id = auth.uid());

ALTER TABLE public.coverage_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coverage_requests_insert_all" ON public.coverage_requests;
CREATE POLICY "coverage_requests_insert_all"
  ON public.coverage_requests FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "coverage_requests_select_admin" ON public.coverage_requests;
CREATE POLICY "coverage_requests_select_admin"
  ON public.coverage_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'operations')
    )
  );
