-- تحديث دوال التوزيع لتضمين حالات الانتقال المرنة للطلبات التجريبية وتجهيز المتجر
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
    WHERE d.is_active = true
      AND d.status = 'approved'
      AND d.mock_location_detected = false
      AND d.active_orders_count < d.max_active_orders
      -- شرط المسافة القصوى لاستلام الطلب (مثلاً 15 كم)
      AND (
        d.current_location IS NULL 
        OR v_branch_loc IS NULL 
        OR ST_DWithin(d.current_location, v_branch_loc, 15000)
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
