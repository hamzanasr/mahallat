-- Migration: 20260930000012_drivers_and_dispatch.sql
-- Description: Driver profiles, vehicle data, GPS tracking, dispatch engine, order offers, task stages, 100m geofence verification, and order transitions (Phase 4: DRV-001, DRV-002, DRV-003, DRV-004, DRV-007, DRV-010, DRV-011, DRV-015, DRV-017, DRV-027, DSP-001, DSP-003, ORD-005, ORD-006, ORD-008, ORD-010, CUS-007)

-- 1. جدول ملفات وبيانات المناديب (drivers)
CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  driver_type TEXT NOT NULL DEFAULT 'saudi_freelance' CHECK (driver_type IN ('saudi_freelance', 'resident_freelance', 'fleet_company')),
  national_id TEXT,
  date_of_birth DATE,
  license_number TEXT,
  license_expires_at DATE,
  vehicle_type TEXT NOT NULL DEFAULT 'car' CHECK (vehicle_type IN ('car', 'motorcycle')),
  vehicle_plate TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  vehicle_photos JSONB DEFAULT '[]'::jsonb,
  insurance_policy_number TEXT,
  insurance_expires_at DATE,
  is_verified_freelance BOOLEAN NOT NULL DEFAULT false, -- DRV-007 وثيقة العمل الحر
  freelance_doc_expires_at DATE,
  
  -- حالة الاعتماد والتشغيل
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('incomplete', 'pending_approval', 'approved', 'suspended', 'rejected')),
  is_active BOOLEAN NOT NULL DEFAULT false, -- متصل / جاهز للعمل
  uniform_acknowledged_at TIMESTAMPTZ, -- DRV-010 إقرار الزي الموحد عند بدء العمل
  
  -- الموقع وتزوير الـ GPS
  current_location GEOGRAPHY(POINT, 4326),
  location_updated_at TIMESTAMPTZ,
  mock_location_detected BOOLEAN NOT NULL DEFAULT false, -- DRV-027
  
  -- الصلاحيات والزونات
  taxi_enabled BOOLEAN NOT NULL DEFAULT false, -- DRV-001
  assigned_zone_id UUID REFERENCES public.zones(id) ON DELETE SET NULL, -- DSP-002
  city_id UUID REFERENCES public.cities(id) ON DELETE RESTRICT,
  
  -- المستوى والأداء وسقف الطلبات
  level TEXT NOT NULL DEFAULT 'new' CHECK (level IN ('new', 'under_probation', 'silver', 'gold', 'platinum')), -- DRV-015
  performance_score NUMERIC(5, 2) NOT NULL DEFAULT 100.0, -- DRV-017
  rating NUMERIC(3, 2) NOT NULL DEFAULT 5.0,
  active_orders_count INTEGER NOT NULL DEFAULT 0 CHECK (active_orders_count >= 0 AND active_orders_count <= 3), -- DSP-003
  max_active_orders INTEGER NOT NULL DEFAULT 3,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drivers_status_active ON public.drivers(status, is_active);
CREATE INDEX IF NOT EXISTS idx_drivers_city_id ON public.drivers(city_id);
CREATE INDEX IF NOT EXISTS idx_drivers_current_location ON public.drivers USING GIST(current_location);

-- 2. إضافة حقول المندوب والمهام لجدول الطلبات (orders)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'driver_id') THEN
    ALTER TABLE public.orders ADD COLUMN driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'driver_assigned_at') THEN
    ALTER TABLE public.orders ADD COLUMN driver_assigned_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'driver_at_store_at') THEN
    ALTER TABLE public.orders ADD COLUMN driver_at_store_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'driver_picked_up_at') THEN
    ALTER TABLE public.orders ADD COLUMN driver_picked_up_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'driver_arrived_at') THEN
    ALTER TABLE public.orders ADD COLUMN driver_arrived_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'driver_delivered_at') THEN
    ALTER TABLE public.orders ADD COLUMN driver_delivered_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'pickup_photo_url') THEN
    ALTER TABLE public.orders ADD COLUMN pickup_photo_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'delivery_proof_photo_url') THEN
    ALTER TABLE public.orders ADD COLUMN delivery_proof_photo_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'operations_override_code') THEN
    ALTER TABLE public.orders ADD COLUMN operations_override_code TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'is_leave_at_door') THEN
    ALTER TABLE public.orders ADD COLUMN is_leave_at_door BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON public.orders(driver_id);

-- 3. جدول عروض الطلبات للمناديب (driver_order_offers)
CREATE TABLE IF NOT EXISTS public.driver_order_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offered' CHECK (status IN ('offered', 'accepted', 'rejected', 'expired', 'cancelled')),
  offered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  rejection_reason TEXT,
  estimated_earnings_halalas INTEGER NOT NULL CHECK (estimated_earnings_halalas >= 0),
  distance_to_pickup_km NUMERIC(6, 2),
  distance_pickup_to_delivery_km NUMERIC(6, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_order_offers_driver_status ON public.driver_order_offers(driver_id, status);
CREATE INDEX IF NOT EXISTS idx_driver_order_offers_order_id ON public.driver_order_offers(order_id);

-- 4. جدول تتبع مواقع المندوب (driver_locations_log)
CREATE TABLE IF NOT EXISTS public.driver_locations_log (
  id BIGSERIAL PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  speed_kmh NUMERIC(5, 2),
  heading NUMERIC(5, 2),
  accuracy_meters NUMERIC(6, 2),
  is_mock BOOLEAN NOT NULL DEFAULT false,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_time ON public.driver_locations_log(driver_id, recorded_at DESC);

-- 5. دوال إدارة المندوب
-- إقرار الزي الموحد (DRV-010)
CREATE OR REPLACE FUNCTION public.driver_acknowledge_uniform(p_driver_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  IF v_caller_id IS NOT NULL AND v_caller_id != p_driver_id AND NOT (public.has_role(v_caller_id, 'super_admin') OR public.has_role(v_caller_id, 'operations')) THEN
    RAISE EXCEPTION 'غير مصرح لك بتسجيل إقرار الزي لهذا المندوب';
  END IF;

  UPDATE public.drivers
  SET uniform_acknowledged_at = now(),
      updated_at = now()
  WHERE id = p_driver_id;

  RETURN jsonb_build_object('success', true, 'acknowledged_at', now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- تحديث موقع المندوب وكشف التزوير (DRV-003, DRV-027)
CREATE OR REPLACE FUNCTION public.driver_update_location(
  p_driver_id UUID,
  p_lat NUMERIC,
  p_lng NUMERIC,
  p_speed_kmh NUMERIC DEFAULT NULL,
  p_heading NUMERIC DEFAULT NULL,
  p_accuracy_meters NUMERIC DEFAULT NULL,
  p_is_mock BOOLEAN DEFAULT false
) RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_point GEOGRAPHY;
BEGIN
  IF v_caller_id IS NOT NULL AND v_caller_id != p_driver_id AND NOT (public.has_role(v_caller_id, 'super_admin') OR public.has_role(v_caller_id, 'operations')) THEN
    RAISE EXCEPTION 'غير مصرح لك بتحديث موقع هذا المندوب';
  END IF;

  v_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;

  -- تسجيل في سجل المواقع
  INSERT INTO public.driver_locations_log (
    driver_id, location, speed_kmh, heading, accuracy_meters, is_mock, recorded_at
  ) VALUES (
    p_driver_id, v_point, p_speed_kmh, p_heading, p_accuracy_meters, p_is_mock, now()
  );

  -- إذا رُصد موقع وهمي (Mock Location)، يتم تعليق المندوب وإيقاف الإتاحة فوراً (DRV-027)
  IF p_is_mock THEN
    UPDATE public.drivers
    SET current_location = v_point,
        location_updated_at = now(),
        mock_location_detected = true,
        is_active = false,
        updated_at = now()
    WHERE id = p_driver_id;

    RETURN jsonb_build_object('success', false, 'error', 'MOCK_LOCATION_DETECTED', 'message', 'تم رصد موقع وهمي وتعليق استقبال المهام للمراجعة (DRV-027)');
  END IF;

  UPDATE public.drivers
  SET current_location = v_point,
      location_updated_at = now(),
      updated_at = now()
  WHERE id = p_driver_id;

  RETURN jsonb_build_object('success', true, 'updated_at', now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- تبديل حالة الاتصال/الإتاحة للعمل (DRV-001, DRV-010, DRV-027)
CREATE OR REPLACE FUNCTION public.driver_toggle_active(
  p_driver_id UUID,
  p_active BOOLEAN
) RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_driver public.drivers%ROWTYPE;
BEGIN
  IF v_caller_id IS NOT NULL AND v_caller_id != p_driver_id AND NOT (public.has_role(v_caller_id, 'super_admin') OR public.has_role(v_caller_id, 'operations')) THEN
    RAISE EXCEPTION 'غير مصرح لك بتعديل حالة هذا المندوب';
  END IF;

  SELECT * INTO v_driver FROM public.drivers WHERE id = p_driver_id;
  IF v_driver.id IS NULL THEN
    RAISE EXCEPTION 'المندوب غير مسجل';
  END IF;

  -- فحص الأهلية والاعتماد (DRV-001)
  IF p_active THEN
    IF v_driver.status != 'approved' THEN
      RAISE EXCEPTION 'لا يمكن تفعيل استقبال الطلبات: الحساب غير معتمد بعد (DRV-001)';
    END IF;

    IF v_driver.mock_location_detected THEN
      RAISE EXCEPTION 'لا يمكن تفعيل الحساب: تم رصد موقع وهمي سابقاً وهو قيد المراجعة (DRV-027)';
    END IF;

    -- اشتراط إقرار الزي الموحد (DRV-010)
    IF v_driver.uniform_acknowledged_at IS NULL THEN
      RAISE EXCEPTION 'لا يمكن بدء العمل دون الإقرار بالالتزام بالزي الموحد (DRV-010)';
    END IF;
  END IF;

  UPDATE public.drivers
  SET is_active = p_active,
      updated_at = now()
  WHERE id = p_driver_id;

  RETURN jsonb_build_object('success', true, 'is_active', p_active);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. محرك التوزيع الذكي (Dispatch Engine)
CREATE OR REPLACE FUNCTION public.dispatch_order_to_drivers(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_branch public.store_branches%ROWTYPE;
  v_branch_loc GEOGRAPHY;
  v_delivery_loc GEOGRAPHY;
  v_driver RECORD;
  v_candidate_count INTEGER := 0;
  v_offers_created INTEGER := 0;
  v_distance_pickup_km NUMERIC;
  v_distance_delivery_km NUMERIC;
  v_offer_expiry TIMESTAMPTZ := now() + interval '30 seconds';
  v_estimated_earnings INTEGER;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'الطلب غير موجود: %', p_order_id;
  END IF;

  IF v_order.delivery_type != 'delivery' THEN
    RETURN jsonb_build_object('success', false, 'message', 'طلب استلام ذاتي لا يحتاج مندوب');
  END IF;

  -- جلب موقع الفرع
  SELECT * INTO v_branch FROM public.store_branches WHERE id = v_order.branch_id;
  v_branch_loc := v_branch.location;

  -- جلب موقع التسليم
  IF v_order.delivery_address_id IS NOT NULL THEN
    SELECT location INTO v_delivery_loc FROM public.customer_addresses WHERE id = v_order.delivery_address_id;
  END IF;

  -- حساب أجر المندوب التقديري بالهللة (مثلاً 80% من رسوم التوصيل أو كامل رسوم التوصيل)
  v_estimated_earnings := GREATEST(v_order.delivery_fee_halalas, 1000);

  -- مسافة التوصيل التقريبية
  IF v_branch_loc IS NOT NULL AND v_delivery_loc IS NOT NULL THEN
    v_distance_delivery_km := ROUND((ST_Distance(v_branch_loc, v_delivery_loc) / 1000.0)::numeric, 2);
  ELSE
    v_distance_delivery_km := 3.0;
  END IF;

  -- البحث عن المناديب المؤهلين مرتبين حسب:
  -- 1. الموثق بوثيقة العمل الحر أولاً (DRV-007)
  -- 2. الأقرب جغرافياً لفرع المتجر (ST_Distance)
  -- 3. الدرجة والأداء (DRV-017)
  FOR v_driver IN
    SELECT 
      d.id,
      d.is_verified_freelance,
      d.performance_score,
      d.level,
      d.active_orders_count,
      ROUND((ST_Distance(d.current_location, v_branch_loc) / 1000.0)::numeric, 2) AS distance_to_store_km
    FROM public.drivers d
    WHERE d.status = 'approved'
      AND d.is_active = true
      AND d.mock_location_detected = false
      AND d.active_orders_count < d.max_active_orders
      AND (d.city_id = v_order.city_id OR d.city_id IS NULL)
      AND (d.assigned_zone_id IS NULL OR EXISTS (
        SELECT 1 FROM public.zones z 
        WHERE z.id = d.assigned_zone_id AND ST_Covers(z.boundary, v_branch_loc)
      ))
      -- استبعاد المناديب المحظورين من المتجر
      AND NOT EXISTS (
        SELECT 1 FROM public.store_blocked_drivers sbd
        WHERE sbd.store_id = v_order.store_id AND sbd.driver_id = d.id
      )
      -- استبعاد من رُفض منه الطلب سابقاً
      AND NOT EXISTS (
        SELECT 1 FROM public.driver_order_offers o
        WHERE o.order_id = p_order_id AND o.driver_id = d.id AND o.status IN ('rejected', 'cancelled')
      )
    ORDER BY 
      d.is_verified_freelance DESC, -- DRV-007: وثيقة العمل الحر أولاً
      ST_Distance(d.current_location, v_branch_loc) ASC, -- الأقرب للمتجر
      d.performance_score DESC
    LIMIT 5
  LOOP
    v_candidate_count := v_candidate_count + 1;
    
    -- إنشاء العرض بمهلة 30 ثانية
    INSERT INTO public.driver_order_offers (
      order_id,
      driver_id,
      status,
      offered_at,
      expires_at,
      estimated_earnings_halalas,
      distance_to_pickup_km,
      distance_pickup_to_delivery_km
    ) VALUES (
      p_order_id,
      v_driver.id,
      'offered',
      now(),
      v_offer_expiry,
      v_estimated_earnings,
      v_driver.distance_to_store_km,
      v_distance_delivery_km
    ) ON CONFLICT (order_id, driver_id) DO UPDATE
      SET status = 'offered',
          offered_at = now(),
          expires_at = v_offer_expiry;

    v_offers_created := v_offers_created + 1;
  END LOOP;

  -- نقل حالة الطلب إلى pending_driver إذا كان cooling_off أو pending_payment
  IF v_order.status IN ('cooling_off', 'pending_payment') THEN
    PERFORM public.transition_order_status(
      p_order_id := p_order_id,
      p_new_status := 'pending_driver',
      p_reason := 'تم بدء توزيع الطلب والبحث عن مندوب',
      p_changed_by_role := 'system'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'offers_created', v_offers_created,
    'order_id', p_order_id,
    'expires_at', v_offer_expiry
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. قبول المندوب للطلب (DSP-001, DSP-003, ORD-006)
CREATE OR REPLACE FUNCTION public.driver_accept_order(
  p_driver_id UUID,
  p_order_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_order public.orders%ROWTYPE;
  v_driver public.drivers%ROWTYPE;
  v_delivery_loc GEOGRAPHY;
  v_other_order RECORD;
  v_other_loc GEOGRAPHY;
  v_dist_meters NUMERIC;
BEGIN
  IF v_caller_id IS NOT NULL AND v_caller_id != p_driver_id AND NOT (public.has_role(v_caller_id, 'super_admin') OR public.has_role(v_caller_id, 'operations')) THEN
    RAISE EXCEPTION 'غير مصرح لك بقبول هذا الطلب';
  END IF;

  -- قفل صف المندوب للتحقق من عدد الطلبات النشطة ومنع التضارب
  SELECT * INTO v_driver FROM public.drivers WHERE id = p_driver_id FOR UPDATE;
  IF v_driver.id IS NULL THEN
    RAISE EXCEPTION 'المندوب غير موجود';
  END IF;

  -- سقف الطلبات المتزامنة (3 طلبات DSP-003)
  IF v_driver.active_orders_count >= v_driver.max_active_orders THEN
    RAISE EXCEPTION 'لا يمكنك قبول أكثر من % طلبات نشطة في الوقت نفسه (DSP-003)', v_driver.max_active_orders;
  END IF;

  -- قفل صف الطلب للتأكد من عدم قبوله من مندوب آخر (ORD-006, DSP-001)
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'الطلب غير موجود: %', p_order_id;
  END IF;

  IF v_order.driver_id IS NOT NULL OR v_order.status NOT IN ('pending_driver', 'cooling_off', 'pending_payment') THEN
    -- تم قبول الطلب من مندوب آخر أو تغيرت حالته
    UPDATE public.driver_order_offers
    SET status = 'expired', responded_at = now()
    WHERE order_id = p_order_id AND driver_id = p_driver_id;

    RAISE EXCEPTION 'الطلب لم يعد متاحاً، تم قبوله بواسطة مندوب آخر (ORD-006)';
  END IF;

  -- جلب موقع التسليم للطلب الجديد
  IF v_order.delivery_address_id IS NOT NULL THEN
    SELECT location INTO v_delivery_loc FROM public.customer_addresses WHERE id = v_order.delivery_address_id;
  END IF;

  -- التحقق من قاعدة التجميع (DSP-003): العملاء داخل نطاق 1 كم (1000 متر) من بعضهم
  IF v_driver.active_orders_count > 0 AND v_delivery_loc IS NOT NULL THEN
    FOR v_other_order IN 
      SELECT o.id, a.location AS other_loc
      FROM public.orders o
      LEFT JOIN public.customer_addresses a ON a.id = o.delivery_address_id
      WHERE o.driver_id = p_driver_id 
        AND o.status IN ('preparing', 'ready_for_pickup', 'picked_up', 'in_transit', 'arrived')
    LOOP
      IF v_other_order.other_loc IS NOT NULL THEN
        v_dist_meters := ST_Distance(v_delivery_loc, v_other_order.other_loc);
        IF v_dist_meters > 1000 THEN
          RAISE EXCEPTION 'لا يمكن قبول هذا الطلب: المسافة بين العميلين تتجاوز 1 كم (% متر) المسموحة للتجميع (DSP-003)', ROUND(v_dist_meters);
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- إسناد المندوب للطلب
  UPDATE public.orders
  SET driver_id = p_driver_id,
      driver_assigned_at = now(),
      updated_at = now()
  WHERE id = p_order_id;

  -- تحديث عدد طلبات المندوب النشطة
  UPDATE public.drivers
  SET active_orders_count = active_orders_count + 1,
      updated_at = now()
  WHERE id = p_driver_id;

  -- تحديث العرض الخاص بهذا المندوب
  UPDATE public.driver_order_offers
  SET status = 'accepted',
      responded_at = now()
  WHERE order_id = p_order_id AND driver_id = p_driver_id;

  -- إلغاء بقية العروض المعلقة للطلب
  UPDATE public.driver_order_offers
  SET status = 'cancelled'
  WHERE order_id = p_order_id AND driver_id != p_driver_id AND status = 'offered';

  -- نقل حالة الطلب إلى "جاري التجهيز" فور قبول المندوب (ORD-006: لا يصل للتاجر إلا بعد قبول مندوب واحد)
  PERFORM public.transition_order_status(
    p_order_id := p_order_id,
    p_new_status := 'preparing',
    p_reason := 'تم قبول الطلب من المندوب وبدء التجهيز بالمتجر (ORD-006)',
    p_changed_by_role := 'driver',
    p_metadata := jsonb_build_object('driver_id', p_driver_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'driver_id', p_driver_id,
    'status', 'preparing'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. رفض المندوب للطلب (DSP-001)
CREATE OR REPLACE FUNCTION public.driver_reject_order(
  p_driver_id UUID,
  p_order_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_caller_id UUID := auth.uid();
BEGIN
  IF v_caller_id IS NOT NULL AND v_caller_id != p_driver_id AND NOT (public.has_role(v_caller_id, 'super_admin') OR public.has_role(v_caller_id, 'operations')) THEN
    RAISE EXCEPTION 'غير مصرح لك برفض هذا الطلب';
  END IF;

  UPDATE public.driver_order_offers
  SET status = 'rejected',
      responded_at = now(),
      rejection_reason = p_reason
  WHERE order_id = p_order_id AND driver_id = p_driver_id;

  -- إعادة تشغيل التوزيع للبحث عن مرشحين إضافيين
  PERFORM public.dispatch_order_to_drivers(p_order_id);

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. مراحل المهمة الميدانية (DRV-004, ORD-005, ORD-008, ORD-010)

-- أ. وصول المندوب للمتجر والتحقق من قطر 100 متر (ORD-005)
CREATE OR REPLACE FUNCTION public.driver_arrive_at_store(
  p_driver_id UUID,
  p_order_id UUID,
  p_driver_lat NUMERIC,
  p_driver_lng NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_branch public.store_branches%ROWTYPE;
  v_driver_loc GEOGRAPHY;
  v_dist_meters NUMERIC;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'الطلب غير موجود';
  END IF;

  IF v_order.driver_id != p_driver_id THEN
    RAISE EXCEPTION 'هذا الطلب غير مسند لهذا المندوب';
  END IF;

  SELECT * INTO v_branch FROM public.store_branches WHERE id = v_order.branch_id;
  v_driver_loc := ST_SetSRID(ST_MakePoint(p_driver_lng, p_driver_lat), 4326)::geography;

  -- فحص المسافة داخل 100 متر عبر PostGIS (القاعدة 8 و ORD-005)
  v_dist_meters := ST_Distance(v_branch.location, v_driver_loc);
  IF v_dist_meters > 100 THEN
    RAISE EXCEPTION 'أنت تبعد % متراً عن المتجر؛ يجب أن تكون داخل نطاق 100 متر لتأكيد الوصول (ORD-005)', ROUND(v_dist_meters);
  END IF;

  UPDATE public.orders
  SET driver_at_store_at = now(),
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'distance_meters', ROUND(v_dist_meters), 'arrived_at_store_at', now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ب. استلام الطلب من المتجر بالكود والصورة داخل 100 متر (ORD-005)
CREATE OR REPLACE FUNCTION public.driver_pickup_order(
  p_driver_id UUID,
  p_order_id UUID,
  p_pickup_code TEXT,
  p_photo_url TEXT,
  p_driver_lat NUMERIC,
  p_driver_lng NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_branch public.store_branches%ROWTYPE;
  v_driver_loc GEOGRAPHY;
  v_dist_meters NUMERIC;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'الطلب غير موجود';
  END IF;

  IF v_order.driver_id != p_driver_id THEN
    RAISE EXCEPTION 'هذا الطلب غير مسند لهذا المندوب';
  END IF;

  -- التحقق من صورة التسليم (ORD-005)
  IF p_photo_url IS NULL OR trim(p_photo_url) = '' THEN
    RAISE EXCEPTION 'صورة استلام الطلب إلزامية (ORD-005)';
  END IF;

  -- فحص المسافة داخل 100 متر من الفرع (ORD-005)
  SELECT * INTO v_branch FROM public.store_branches WHERE id = v_order.branch_id;
  v_driver_loc := ST_SetSRID(ST_MakePoint(p_driver_lng, p_driver_lat), 4326)::geography;
  v_dist_meters := ST_Distance(v_branch.location, v_driver_loc);
  IF v_dist_meters > 100 THEN
    RAISE EXCEPTION 'أنت تبعد % متراً عن المتجر؛ لا يمكن الاستلام خارج نطاق 100 متر (ORD-005)', ROUND(v_dist_meters);
  END IF;

  -- التحقق من كود الاستلام (ORD-005)
  IF v_order.pickup_code IS DISTINCT FROM p_pickup_code THEN
    RAISE EXCEPTION 'كود الاستلام غير صحيح (ORD-005)';
  END IF;

  UPDATE public.orders
  SET driver_picked_up_at = now(),
      pickup_photo_url = p_photo_url,
      updated_at = now()
  WHERE id = p_order_id;

  -- نقل الحالة إلى ready_for_pickup أولاً إذا كانت preparing
  IF v_order.status = 'preparing' THEN
    PERFORM public.transition_order_status(
      p_order_id := p_order_id,
      p_new_status := 'ready_for_pickup',
      p_reason := 'جاهز للاستلام الفوري من المندوب',
      p_changed_by_role := 'system'
    );
  END IF;

  -- نقل الحالة إلى تم الاستلام ثم في الطريق
  PERFORM public.transition_order_status(
    p_order_id := p_order_id,
    p_new_status := 'picked_up',
    p_reason := 'تم استلام الطلب من المتجر بنجاح وتوثيق الصورة والكود',
    p_changed_by_role := 'driver'
  );

  PERFORM public.transition_order_status(
    p_order_id := p_order_id,
    p_new_status := 'in_transit',
    p_reason := 'المندوب في الطريق للعميل',
    p_changed_by_role := 'driver'
  );

  RETURN jsonb_build_object('success', true, 'status', 'in_transit');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ج. وصول المندوب للعميل والتحقق من قطر 100 متر (ORD-005, ORD-008)
CREATE OR REPLACE FUNCTION public.driver_arrive_at_customer(
  p_driver_id UUID,
  p_order_id UUID,
  p_driver_lat NUMERIC,
  p_driver_lng NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_delivery_loc GEOGRAPHY;
  v_driver_loc GEOGRAPHY;
  v_dist_meters NUMERIC;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'الطلب غير موجود';
  END IF;

  IF v_order.driver_id != p_driver_id THEN
    RAISE EXCEPTION 'هذا الطلب غير مسند لهذا المندوب';
  END IF;

  -- جلب موقع التسليم
  IF v_order.delivery_address_id IS NOT NULL THEN
    SELECT location INTO v_delivery_loc FROM public.customer_addresses WHERE id = v_order.delivery_address_id;
  END IF;

  IF v_delivery_loc IS NULL AND v_order.delivery_address_snapshot IS NOT NULL THEN
    v_delivery_loc := ST_SetSRID(ST_MakePoint(
      (v_order.delivery_address_snapshot->>'longitude')::numeric,
      (v_order.delivery_address_snapshot->>'latitude')::numeric
    ), 4326)::geography;
  END IF;

  v_driver_loc := ST_SetSRID(ST_MakePoint(p_driver_lng, p_driver_lat), 4326)::geography;

  IF v_delivery_loc IS NOT NULL THEN
    v_dist_meters := ST_Distance(v_delivery_loc, v_driver_loc);
    IF v_dist_meters > 100 THEN
      RAISE EXCEPTION 'أنت تبعد % متراً عن موقع العميل؛ يجب أن تكون داخل نطاق 100 متر لتأكيد الوصول (ORD-005)', ROUND(v_dist_meters);
    END IF;
  END IF;

  UPDATE public.orders
  SET driver_arrived_at = now(),
      updated_at = now()
  WHERE id = p_order_id;

  PERFORM public.transition_order_status(
    p_order_id := p_order_id,
    p_new_status := 'arrived',
    p_reason := 'المندوب وصل لموقع العميل وبدء مهلة الانتظار (ORD-008)',
    p_changed_by_role := 'driver'
  );

  RETURN jsonb_build_object('success', true, 'status', 'arrived', 'arrived_at', now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- د. تسليم الطلب للعميل بالكود والصورة داخل 100 متر (ORD-005, ORD-010)
CREATE OR REPLACE FUNCTION public.driver_deliver_order(
  p_driver_id UUID,
  p_order_id UUID,
  p_delivery_code TEXT,
  p_photo_url TEXT,
  p_is_leave_at_door BOOLEAN DEFAULT false,
  p_driver_lat NUMERIC DEFAULT NULL,
  p_driver_lng NUMERIC DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_delivery_loc GEOGRAPHY;
  v_driver_loc GEOGRAPHY;
  v_dist_meters NUMERIC;
  v_is_valid_code BOOLEAN := false;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'الطلب غير موجود';
  END IF;

  IF v_order.driver_id != p_driver_id THEN
    RAISE EXCEPTION 'هذا الطلب غير مسند لهذا المندوب';
  END IF;

  -- فحص المسافة داخل 100 متر
  IF p_driver_lat IS NOT NULL AND p_driver_lng IS NOT NULL THEN
    IF v_order.delivery_address_id IS NOT NULL THEN
      SELECT location INTO v_delivery_loc FROM public.customer_addresses WHERE id = v_order.delivery_address_id;
    END IF;
    IF v_delivery_loc IS NULL AND v_order.delivery_address_snapshot IS NOT NULL THEN
      v_delivery_loc := ST_SetSRID(ST_MakePoint(
        (v_order.delivery_address_snapshot->>'longitude')::numeric,
        (v_order.delivery_address_snapshot->>'latitude')::numeric
      ), 4326)::geography;
    END IF;

    IF v_delivery_loc IS NOT NULL THEN
      v_driver_loc := ST_SetSRID(ST_MakePoint(p_driver_lng, p_driver_lat), 4326)::geography;
      v_dist_meters := ST_Distance(v_delivery_loc, v_driver_loc);
      IF v_dist_meters > 100 THEN
        RAISE EXCEPTION 'لا يمكن التسليم خارج نطاق 100 متر (ORD-005)';
      END IF;
    END IF;
  END IF;

  -- التحقق من صحة الكود: كود العميل أو كود العمليات (ORD-005, ORD-008)
  IF v_order.delivery_code IS NOT NULL AND v_order.delivery_code = p_delivery_code THEN
    v_is_valid_code := true;
  ELSIF v_order.operations_override_code IS NOT NULL AND v_order.operations_override_code = p_delivery_code THEN
    v_is_valid_code := true;
  END IF;

  IF NOT v_is_valid_code THEN
    RAISE EXCEPTION 'كود التسليم غير صحيح (ORD-005)';
  END IF;

  -- اشتراط الصورة في حال الترك عند الباب أو التسليم (ORD-005, ORD-010)
  IF p_is_leave_at_door AND (p_photo_url IS NULL OR trim(p_photo_url) = '') THEN
    RAISE EXCEPTION 'صورة توثيق الترك عند الباب إلزامية (ORD-010)';
  END IF;

  UPDATE public.orders
  SET driver_delivered_at = now(),
      delivery_proof_photo_url = p_photo_url,
      is_leave_at_door = p_is_leave_at_door,
      updated_at = now()
  WHERE id = p_order_id;

  -- تقليل عدد طلبات المندوب النشطة
  UPDATE public.drivers
  SET active_orders_count = GREATEST(0, active_orders_count - 1),
      updated_at = now()
  WHERE id = p_driver_id;

  -- انتقال الحالة إلى delivered ثم completed
  PERFORM public.transition_order_status(
    p_order_id := p_order_id,
    p_new_status := 'delivered',
    p_reason := 'تم تسليم الطلب للعميل بنجاح',
    p_changed_by_role := 'driver'
  );

  PERFORM public.transition_order_status(
    p_order_id := p_order_id,
    p_new_status := 'completed',
    p_reason := 'اكتمال الطلب والتسليم بنجاح',
    p_changed_by_role := 'system'
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'completed',
    'delivered_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- هـ. إنهاء الطلب تلقائياً لعدم تجاوب العميل بعد 30 دقيقة من "وصلت" (ORD-008)
CREATE OR REPLACE FUNCTION public.auto_expire_unresponsive_customer_order(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'الطلب غير موجود';
  END IF;

  IF v_order.status != 'arrived' THEN
    RAISE EXCEPTION 'الطلب ليس في حالة وصول المندوب (arrived)';
  END IF;

  -- التحقق من مرور 30 دقيقة على الأقل
  IF v_order.driver_arrived_at IS NULL OR (now() - v_order.driver_arrived_at) < interval '30 minutes' THEN
    RAISE EXCEPTION 'لم تمر مهلة 30 دقيقة بعد من وصول المندوب (ORD-008)';
  END IF;

  -- تقليل عداد المندوب
  IF v_order.driver_id IS NOT NULL THEN
    UPDATE public.drivers
    SET active_orders_count = GREATEST(0, active_orders_count - 1),
        updated_at = now()
    WHERE id = v_order.driver_id;
  END IF;

  -- نقل الحالة إلى ended_no_response
  PERFORM public.transition_order_status(
    p_order_id := p_order_id,
    p_new_status := 'ended_no_response',
    p_reason := 'أُنهي الطلب تلقائياً بعد مرور 30 دقيقة من وصول المندوب دون تجاوب العميل (ORD-008)',
    p_changed_by_role := 'system'
  );

  RETURN jsonb_build_object('success', true, 'status', 'ended_no_response');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. إعدادات الأمان وسياسات RLS
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_order_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_locations_log ENABLE ROW LEVEL SECURITY;

-- سياسات drivers
DROP POLICY IF EXISTS drivers_admin_all ON public.drivers;
CREATE POLICY drivers_admin_all ON public.drivers
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'operations') OR 
    public.has_role(auth.uid(), 'support')
  );

DROP POLICY IF EXISTS drivers_self_select ON public.drivers;
CREATE POLICY drivers_self_select ON public.drivers
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS drivers_self_update ON public.drivers;
CREATE POLICY drivers_self_update ON public.drivers
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- سياسات driver_order_offers
DROP POLICY IF EXISTS offers_driver_select ON public.driver_order_offers;
CREATE POLICY offers_driver_select ON public.driver_order_offers
  FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

DROP POLICY IF EXISTS offers_admin_all ON public.driver_order_offers;
CREATE POLICY offers_admin_all ON public.driver_order_offers
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'operations')
  );

-- سياسات driver_locations_log
DROP POLICY IF EXISTS locations_driver_insert ON public.driver_locations_log;
CREATE POLICY locations_driver_insert ON public.driver_locations_log
  FOR INSERT TO authenticated
  WITH CHECK (driver_id = auth.uid());

DROP POLICY IF EXISTS locations_admin_select ON public.driver_locations_log;
CREATE POLICY locations_admin_select ON public.driver_locations_log
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin') OR 
    public.has_role(auth.uid(), 'operations')
  );

-- سياسات المندوب على orders
DROP POLICY IF EXISTS orders_driver_select ON public.orders;
CREATE POLICY orders_driver_select ON public.orders
  FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

DROP POLICY IF EXISTS orders_driver_update ON public.orders;
CREATE POLICY orders_driver_update ON public.orders
  FOR UPDATE TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

DROP POLICY IF EXISTS order_history_driver_select ON public.order_status_history;
CREATE POLICY order_history_driver_select ON public.order_status_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_status_history.order_id
        AND o.driver_id = auth.uid()
    )
  );

-- صلاحيات
GRANT SELECT, INSERT, UPDATE ON public.drivers TO authenticated;
GRANT SELECT, UPDATE ON public.driver_order_offers TO authenticated;
GRANT SELECT, INSERT ON public.driver_locations_log TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_acknowledge_uniform(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_update_location(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_toggle_active(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_order_to_drivers(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.driver_accept_order(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.driver_reject_order(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.driver_arrive_at_store(UUID, UUID, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_pickup_order(UUID, UUID, TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_arrive_at_customer(UUID, UUID, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_deliver_order(UUID, UUID, TEXT, TEXT, BOOLEAN, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_expire_unresponsive_customer_order(UUID) TO authenticated, service_role;
