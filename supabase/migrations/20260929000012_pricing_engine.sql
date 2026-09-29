-- Migration: 20260929000012_pricing_engine.sql
-- Step 2.4: Pricing Engine, Delivery Fees, Service Fees, Operating Hours, and Cart Quotation (PAY-004, PAY-013, PAY-021, ORD-011)

-- 1. إضافة مفاتيح الإعدادات المرنة لمحرك الأسعار (ADM-034, PAY-013, PAY-021, ORD-011, PAY-014, PAY-016)
INSERT INTO public.setting_definitions (key, name_ar, description_ar, type, min_value, max_value, default_value, allowed_levels, related_requirements, options)
VALUES
  ('delivery_base_fee_restaurants_halalas', 'رسم التوصيل الأساسي للمطاعم والمحلات', 'رسم التوصيل الأساسي بالهللة للمطاعم والمحلات المتنوعة', 'amount_halalas', 0, 10000, '1500'::jsonb, '{"global","city","store"}', '{"PAY-013"}', NULL),
  ('delivery_base_fee_mart_halalas', 'رسم التوصيل الأساسي للمارت والصيدليات', 'رسم التوصيل الأساسي بالهللة للمارت والصيدليات', 'amount_halalas', 0, 10000, '1200'::jsonb, '{"global","city","store"}', '{"PAY-013"}', NULL),
  ('delivery_base_included_km', 'الكيلومترات المشمولة في الرسم الأساسي', 'المسافة المشمولة في رسم التوصيل الأساسي بالكيلومتر', 'number', 0, 50, '3'::jsonb, '{"global","city","store"}', '{"PAY-013"}', NULL),
  ('delivery_per_extra_km_fee_halalas', 'سعر كل كيلومتر إضافي', 'رسم كل كيلومتر إضافي بعد المسافة المشمولة بالهللة', 'amount_halalas', 0, 2000, '100'::jsonb, '{"global","city","store"}', '{"PAY-013"}', NULL),
  ('delivery_min_fee_halalas', 'الحد الأدنى لرسوم التوصيل', 'أقل رسم توصيل يمكن تطبيقه بالهللة بعد الحسابات', 'amount_halalas', 0, 5000, '500'::jsonb, '{"global","city"}', '{"PAY-013"}', NULL),
  ('delivery_max_fee_halalas', 'الحد الأقصى لرسوم التوصيل', 'أعلى سقف لرسوم التوصيل بالهللة لحماية العميل', 'amount_halalas', 0, 10000, '3000'::jsonb, '{"global","city"}', '{"PAY-013"}', NULL),
  ('customer_service_fee_enabled', 'تفعيل رسوم الخدمة في المدينة', 'تحديد هل تُحسب رسوم خدمة للعميل في هذه المدينة أم لا', 'boolean', NULL, NULL, 'true'::jsonb, '{"global","city"}', '{"PAY-021"}', NULL),
  ('customer_service_fee_type', 'نوع رسوم الخدمة', 'طريقة احتساب رسوم الخدمة (نسبة أو مبلغ ثابت)', 'select', NULL, NULL, '"percentage"'::jsonb, '{"global","city"}', '{"PAY-021"}', '["percentage", "fixed"]'::jsonb),
  ('customer_service_fee_percentage', 'نسبة رسوم الخدمة', 'نسبة رسوم الخدمة من قيمة المنتجات والتوصيل', 'percentage', 0, 20, '2.5'::jsonb, '{"global","city"}', '{"PAY-021"}', NULL),
  ('customer_service_fee_fixed_halalas', 'مبلغ رسوم الخدمة الثابت', 'مبلغ رسوم الخدمة بالهللة في حال اختيار نوع ثابت', 'amount_halalas', 0, 2000, '0'::jsonb, '{"global","city"}', '{"PAY-021"}', NULL),
  ('estimated_delivery_speed_kmh', 'متوسط سرعة التوصيل للتقدير', 'متوسط سرعة المندوب بالكيلومتر في الساعة لتقدير وقت الوصول قبل الطلب', 'number', 5, 80, '25'::jsonb, '{"global","city"}', '{"ORD-011"}', NULL),
  ('estimated_time_range_window_minutes', 'عرض نطاق الوقت التقديري', 'الفرق بالدقائق بين الحد الأدنى والأعلى لنطاق الوقت المعروض للعميل', 'duration_minutes', 0, 60, '10'::jsonb, '{"global"}', '{"ORD-011"}', NULL),
  ('customer_display_prep_buffer_minutes', 'فارق وقت التحضير المعروض للعميل', 'دقائق إضافية تُضاف على وقت التحضير الفعلي عند العرض للعميل', 'duration_minutes', 0, 30, '5'::jsonb, '{"global"}', '{"ORD-011"}', NULL),
  ('customer_display_delivery_buffer_minutes', 'فارق وقت التوصيل المعروض للعميل', 'دقائق إضافية تُضاف على وقت قيادة المندوب للعميل', 'duration_minutes', 0, 30, '5'::jsonb, '{"global"}', '{"ORD-011"}', NULL),
  ('address_divergence_alert_threshold_meters', 'مسافة تنبيه تباعد موقع الجهاز عن العنوان', 'المسافة بالأمتار التي إذا تجاوزها موقع الجهاز يُنبه العميل للتأكد من العنوان', 'number', 50, 2000, '250'::jsonb, '{"global"}', '{"CUS-002"}', NULL),
  ('self_pickup_discount_percentage', 'نسبة خصم الاستلام الذاتي', 'نسبة الخصم الممنوحة للعميل عند اختيار الاستلام من الفرع', 'percentage', 0, 50, '0'::jsonb, '{"global","city","store"}', '{"PAY-014"}', NULL),
  ('vat_percentage', 'نسبة ضريبة القيمة المضافة', 'نسبة الضريبة المعمول بها نظامياً في المملكة', 'percentage', 0, 30, '15'::jsonb, '{"global"}', '{"PAY-016"}', NULL)
ON CONFLICT (key) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  description_ar = EXCLUDED.description_ar,
  type = EXCLUDED.type,
  min_value = EXCLUDED.min_value,
  max_value = EXCLUDED.max_value,
  default_value = EXCLUDED.default_value,
  allowed_levels = EXCLUDED.allowed_levels,
  related_requirements = EXCLUDED.related_requirements,
  options = EXCLUDED.options;

-- 2. دالة حساب سعر العميل للصنف (PAY-004, PAY-012)
-- لا تكشف سعر المحل ولا تفاصيل الزيادة للعميل
CREATE OR REPLACE FUNCTION public.calculate_customer_item_price(
  p_store_id UUID,
  p_base_price_halalas INT
) RETURNS INT AS $$
DECLARE
  v_op_type public.operation_type;
  v_contract public.store_contracts%ROWTYPE;
  v_markup_pct NUMERIC := 0.0;
  v_customer_price INT;
BEGIN
  IF p_base_price_halalas IS NULL OR p_base_price_halalas <= 0 THEN
    RETURN 0;
  END IF;

  -- معرفة نوع تشغيل المتجر
  SELECT operation_type INTO v_op_type
  FROM public.stores
  WHERE id = p_store_id;

  -- جلب العقد الساري للمتجر
  SELECT * INTO v_contract
  FROM public.store_contracts
  WHERE store_id = p_store_id
    AND (valid_until IS NULL OR valid_until > now())
  ORDER BY valid_from DESC
  LIMIT 1;

  IF v_op_type IN ('mart', 'pharmacy') THEN
    -- المارت والصيدليات: زيادة 5% على سعر المحل للعميل
    v_markup_pct := COALESCE(v_contract.mart_pharmacy_customer_markup_percentage, 5.00);
  ELSE
    -- المطاعم والمحلات المتنوعة: مجموع زيادة المنصة وزيادة التاجر
    v_markup_pct := COALESCE(v_contract.menu_markup_percentage, 0.00);
  END IF;

  -- الحساب بنوع numeric والتقريب للهللة لأقرب عدد صحيح (round)
  v_customer_price := ROUND((p_base_price_halalas::NUMERIC * (1.0 + (v_markup_pct / 100.0))))::INT;

  RETURN v_customer_price;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. دالة فحص ساعات عمل الفرع وتحديد حالة الفتح وموعد الإغلاق أو الفتح القادم (MER-001)
-- تدعم الدوام الذي يتجاوز منتصف الليل بتوقيت الرياض (UTC+3)
CREATE OR REPLACE FUNCTION public.check_branch_open_status(
  p_branch_id UUID,
  p_check_time TIMESTAMPTZ DEFAULT now()
) RETURNS JSONB AS $$
DECLARE
  v_branch public.store_branches%ROWTYPE;
  v_local_ts TIMESTAMP;
  v_cur_dow INT;
  v_prev_dow INT;
  v_cur_time TIME;
  v_hours JSONB;
  v_item JSONB;
  v_is_open BOOLEAN := false;
  v_closes_at TIMESTAMPTZ := NULL;
  v_next_open_at TIMESTAMPTZ := NULL;
  v_open_time TIME;
  v_close_time TIME;
  v_is_closed_day BOOLEAN;
  v_item_dow INT;
BEGIN
  SELECT * INTO v_branch FROM public.store_branches WHERE id = p_branch_id;
  IF v_branch.id IS NULL OR v_branch.is_active = false THEN
    RETURN jsonb_build_object(
      'is_open', false,
      'is_active', false,
      'reason', 'الفرع غير مفعّل'
    );
  END IF;

  -- فحص الإيقاف المؤقت (Paused Until)
  IF v_branch.paused_until IS NOT NULL AND v_branch.paused_until > p_check_time THEN
    RETURN jsonb_build_object(
      'is_open', false,
      'is_paused', true,
      'paused_until', v_branch.paused_until,
      'next_open_at', v_branch.paused_until
    );
  END IF;

  -- تحويل الوقت لتوقيت الرياض الفعلي
  v_local_ts := p_check_time AT TIME ZONE 'Asia/Riyadh';
  v_cur_dow := EXTRACT(DOW FROM v_local_ts)::INT;
  v_prev_dow := (v_cur_dow + 6) % 7;
  v_cur_time := v_local_ts::time;
  v_hours := v_branch.working_hours;

  -- إذا لم تكن هناك ساعات عمل مسجلة نعتبره مفتوحاً افتراضياً
  IF v_hours IS NULL OR jsonb_array_length(v_hours) = 0 THEN
    RETURN jsonb_build_object('is_open', true);
  END IF;

  -- فحص ساعات اليوم واليوم السابق للدوام المتجاوز لمنتصف الليل
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_hours)
  LOOP
    v_item_dow := COALESCE(
      (v_item->>'day_of_week')::INT,
      CASE LOWER(v_item->>'day')
        WHEN 'sunday' THEN 0
        WHEN 'monday' THEN 1
        WHEN 'tuesday' THEN 2
        WHEN 'wednesday' THEN 3
        WHEN 'thursday' THEN 4
        WHEN 'friday' THEN 5
        WHEN 'saturday' THEN 6
        ELSE -1
      END
    );
    v_is_closed_day := COALESCE((v_item->>'is_closed')::BOOLEAN, false);
    v_open_time := COALESCE(v_item->>'open_time', v_item->>'open', '00:00')::TIME;
    v_close_time := COALESCE(v_item->>'close_time', v_item->>'close', '23:59')::TIME;

    -- إذا كان الفحص لليوم الحالي
    IF v_item_dow = v_cur_dow AND NOT v_is_closed_day THEN
      IF v_close_time > v_open_time THEN
        -- دوام عادي خلال نفس اليوم (مثل 09:00 إلى 23:00)
        IF v_cur_time >= v_open_time AND v_cur_time < v_close_time THEN
          v_is_open := true;
          v_closes_at := ((v_local_ts::date + v_close_time) AT TIME ZONE 'Asia/Riyadh');
        ELSIF v_cur_time < v_open_time AND v_next_open_at IS NULL THEN
          v_next_open_at := ((v_local_ts::date + v_open_time) AT TIME ZONE 'Asia/Riyadh');
        END IF;
      ELSE
        -- دوام يتجاوز منتصف الليل (مثل 16:00 إلى 02:00)
        IF v_cur_time >= v_open_time THEN
          v_is_open := true;
          v_closes_at := (((v_local_ts::date + INTERVAL '1 day')::date + v_close_time) AT TIME ZONE 'Asia/Riyadh');
        ELSIF v_cur_time < v_open_time AND v_next_open_at IS NULL THEN
          v_next_open_at := ((v_local_ts::date + v_open_time) AT TIME ZONE 'Asia/Riyadh');
        END IF;
      END IF;
    END IF;

    -- فحص امتداد دوام الأمس بعد منتصف الليل
    IF v_item_dow = v_prev_dow AND NOT v_is_closed_day THEN
      IF v_close_time < v_open_time AND v_cur_time < v_close_time THEN
        v_is_open := true;
        v_closes_at := ((v_local_ts::date + v_close_time) AT TIME ZONE 'Asia/Riyadh');
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'is_open', v_is_open,
    'closes_at', v_closes_at,
    'next_open_at', v_next_open_at
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4. دالة حساب رسوم التوصيل (PAY-013)
-- تقرأ القيم من get_setting بدقة وتطبق الحدود الصارمة
CREATE OR REPLACE FUNCTION public.calculate_delivery_fee(
  p_store_id UUID,
  p_branch_id UUID,
  p_distance_km NUMERIC,
  p_city_id UUID
) RETURNS INT AS $$
DECLARE
  v_op_type public.operation_type;
  v_base_fee INT;
  v_included_km NUMERIC;
  v_extra_km_fee INT;
  v_min_fee INT;
  v_max_fee INT;
  v_extra_km NUMERIC;
  v_raw_fee NUMERIC;
  v_final_fee INT;
BEGIN
  -- استخراج نوع المتجر
  SELECT operation_type INTO v_op_type FROM public.stores WHERE id = p_store_id;

  -- 1. الرسم الأساسي حسب نوع المتجر
  IF v_op_type IN ('mart', 'pharmacy') THEN
    v_base_fee := COALESCE((public.get_setting('delivery_base_fee_mart_halalas', p_city_id, NULL, p_store_id)#>>'{}')::INT, 1200);
  ELSE
    v_base_fee := COALESCE((public.get_setting('delivery_base_fee_restaurants_halalas', p_city_id, NULL, p_store_id)#>>'{}')::INT, 1500);
  END IF;

  -- 2. الكيلومترات المشمولة في الأساس وسعر الكيلو الإضافي
  v_included_km := COALESCE((public.get_setting('delivery_base_included_km', p_city_id, NULL, p_store_id)#>>'{}')::NUMERIC, 3.0);
  v_extra_km_fee := COALESCE((public.get_setting('delivery_per_extra_km_fee_halalas', p_city_id, NULL, p_store_id)#>>'{}')::INT, 100);

  -- 3. الحدود الدنيا والقصوى
  v_min_fee := COALESCE((public.get_setting('delivery_min_fee_halalas', p_city_id)#>>'{}')::INT, 500);
  v_max_fee := COALESCE((public.get_setting('delivery_max_fee_halalas', p_city_id)#>>'{}')::INT, 3000);

  -- 4. احتساب الكيلومترات الإضافية (كل كيلو إضافي يبدأ يُحسب كاملاً بالتقريب لأعلى CEIL)
  IF p_distance_km > v_included_km THEN
    v_extra_km := CEIL(p_distance_km - v_included_km);
    v_raw_fee := v_base_fee + (v_extra_km * v_extra_km_fee);
  ELSE
    v_raw_fee := v_base_fee;
  END IF;

  -- 5. حصر الرسوم بين الحد الأدنى والحد الأقصى (PAY-013)
  v_final_fee := GREATEST(v_min_fee, LEAST(v_max_fee, ROUND(v_raw_fee)::INT));

  RETURN v_final_fee;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 5. دالة حساب رسوم الخدمة على العميل (PAY-021)
CREATE OR REPLACE FUNCTION public.calculate_service_fee(
  p_city_id UUID,
  p_products_halalas INT,
  p_delivery_halalas INT
) RETURNS INT AS $$
DECLARE
  v_enabled BOOLEAN;
  v_type TEXT;
  v_pct NUMERIC;
  v_fixed INT;
  v_base NUMERIC;
BEGIN
  -- هل رسوم الخدمة مفعّلة في هذه المدينة؟
  v_enabled := COALESCE((public.get_setting('customer_service_fee_enabled', p_city_id)#>>'{}')::BOOLEAN, true);
  IF NOT v_enabled THEN
    RETURN 0;
  END IF;

  v_type := COALESCE(public.get_setting('customer_service_fee_type', p_city_id)#>>'{}', 'percentage');

  IF v_type = 'fixed' THEN
    v_fixed := COALESCE((public.get_setting('customer_service_fee_fixed_halalas', p_city_id)#>>'{}')::INT, 0);
    RETURN v_fixed;
  ELSE
    -- نسبة من (المنتجات + التوصيل)
    v_pct := COALESCE((public.get_setting('customer_service_fee_percentage', p_city_id)#>>'{}')::NUMERIC, 2.5);
    v_base := (COALESCE(p_products_halalas, 0) + COALESCE(p_delivery_halalas, 0))::NUMERIC;
    RETURN ROUND((v_base * v_pct) / 100.0)::INT;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 6. دالة تقدير الوقت للعميل والتاجر والمندوب (ORD-011, CUS-005)
CREATE OR REPLACE FUNCTION public.estimate_delivery_time(
  p_prep_time_minutes INT,
  p_distance_km NUMERIC,
  p_city_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_prep_buffer INT;
  v_delivery_buffer INT;
  v_speed_kmh NUMERIC;
  v_travel_minutes INT;
  v_actual_prep INT;
  v_customer_prep INT;
  v_customer_delivery INT;
  v_total_minutes INT;
  v_rounded_min INT;
  v_range_window INT;
  v_max_minutes INT;
BEGIN
  v_prep_buffer := COALESCE((public.get_setting('customer_display_prep_buffer_minutes')#>>'{}')::INT, 5);
  v_delivery_buffer := COALESCE((public.get_setting('customer_display_delivery_buffer_minutes')#>>'{}')::INT, 5);
  v_speed_kmh := COALESCE((public.get_setting('estimated_delivery_speed_kmh', p_city_id)#>>'{}')::NUMERIC, 25.0);
  v_range_window := COALESCE((public.get_setting('estimated_time_range_window_minutes')#>>'{}')::INT, 10);

  v_actual_prep := COALESCE(p_prep_time_minutes, 20);
  v_customer_prep := v_actual_prep + v_prep_buffer;

  -- وقت السفر = (المسافة ÷ السرعة) × 60
  v_travel_minutes := ROUND((COALESCE(p_distance_km, 1.0) / GREATEST(v_speed_kmh, 10.0)) * 60.0)::INT;
  v_customer_delivery := v_travel_minutes + v_delivery_buffer;

  v_total_minutes := v_customer_prep + v_customer_delivery;
  -- التقريب لأعلى لأقرب 5 دقائق
  v_rounded_min := CEIL(v_total_minutes::NUMERIC / 5.0)::INT * 5;
  v_max_minutes := v_rounded_min + v_range_window;

  RETURN jsonb_build_object(
    'actual_prep_minutes', v_actual_prep,
    'customer_prep_minutes', v_customer_prep,
    'travel_time_minutes', v_travel_minutes,
    'customer_total_min', v_rounded_min,
    'customer_total_max', v_max_minutes,
    'display_range', format('%s–%s د', v_rounded_min, v_max_minutes)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 7. دالة منيو العميل customer_menu(store_id) (CUS-005, PAY-004)
-- تعيد فقط الأصناف والأقسام المتاحة والمنشورة بأسعار العميل المحسوبة بدقة
CREATE OR REPLACE FUNCTION public.customer_menu(p_store_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_sections JSONB := '[]'::jsonb;
  v_sec RECORD;
  v_items JSONB;
  v_item RECORD;
  v_sizes JSONB;
  v_groups JSONB;
  v_grp RECORD;
  v_opts JSONB;
  v_customer_item_price INT;
BEGIN
  FOR v_sec IN
    SELECT id, name_ar, name_en, sort_order
    FROM public.menu_sections
    WHERE store_id = p_store_id
      AND is_active = true
    ORDER BY sort_order ASC
  LOOP
    v_items := '[]'::jsonb;

    FOR v_item IN
      SELECT id, name_ar, name_en, description_ar, description_en,
             base_price_halalas, image_url, prep_time_minutes,
             calories, is_sfda_exempt, sfda_exemption_reason,
             allergens, high_salt, caffeine_content,
             is_available, paused_until
      FROM public.menu_items
      WHERE section_id = v_sec.id
        AND is_published = true
        AND is_available = true
        AND (paused_until IS NULL OR paused_until <= now())
      ORDER BY sort_order ASC
    LOOP
      -- حساب سعر الصنف للعميل بالهللة
      v_customer_item_price := public.calculate_customer_item_price(p_store_id, v_item.base_price_halalas);

      -- جلب الأحجام بأسعار العميل
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'name_ar', s.name_ar,
          'name_en', s.name_en,
          'customer_price_halalas', public.calculate_customer_item_price(p_store_id, v_item.base_price_halalas + s.price_delta_halalas),
          'price_delta_halalas', s.price_delta_halalas,
          'is_default', s.is_default
        ) ORDER BY s.sort_order
      ), '[]'::jsonb) INTO v_sizes
      FROM public.menu_item_sizes s
      WHERE s.item_id = v_item.id;

      -- جلب مجموعات الإضافات وخياراتها بأسعار العميل
      v_groups := '[]'::jsonb;
      FOR v_grp IN
        SELECT id, name_ar, name_en, is_required, min_selectable, max_selectable, sort_order
        FROM public.menu_item_option_groups
        WHERE item_id = v_item.id
        ORDER BY sort_order ASC
      LOOP
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', o.id,
            'name_ar', o.name_ar,
            'name_en', o.name_en,
            'customer_price_halalas', public.calculate_customer_item_price(p_store_id, o.price_delta_halalas),
            'calories_delta', o.calories_delta
          ) ORDER BY o.sort_order
        ), '[]'::jsonb) INTO v_opts
        FROM public.menu_item_options o
        WHERE o.group_id = v_grp.id;

        v_groups := v_groups || jsonb_build_object(
          'id', v_grp.id,
          'name_ar', v_grp.name_ar,
          'name_en', v_grp.name_en,
          'is_required', v_grp.is_required,
          'min_selectable', v_grp.min_selectable,
          'max_selectable', v_grp.max_selectable,
          'options', v_opts
        );
      END LOOP;

      v_items := v_items || jsonb_build_object(
        'id', v_item.id,
        'name_ar', v_item.name_ar,
        'name_en', v_item.name_en,
        'description_ar', v_item.description_ar,
        'description_en', v_item.description_en,
        'customer_price_halalas', v_customer_item_price,
        'image_url', v_item.image_url,
        'prep_time_minutes', v_item.prep_time_minutes,
        'calories', v_item.calories,
        'is_sfda_exempt', v_item.is_sfda_exempt,
        'sfda_exemption_reason', v_item.sfda_exemption_reason,
        'allergens', v_item.allergens,
        'high_salt', v_item.high_salt,
        'caffeine_content', v_item.caffeine_content,
        'sizes', v_sizes,
        'option_groups', v_groups
      );
    END LOOP;

    IF jsonb_array_length(v_items) > 0 THEN
      v_sections := v_sections || jsonb_build_object(
        'id', v_sec.id,
        'name_ar', v_sec.name_ar,
        'name_en', v_sec.name_en,
        'items', v_items
      );
    END IF;
  END LOOP;

  RETURN v_sections;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 8. دالة المتاجر المؤهلة لعنوان العميل stores_for_point (DSP-002, MER-046)
CREATE OR REPLACE FUNCTION public.stores_for_point(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_section TEXT DEFAULT NULL,
  p_category_id UUID DEFAULT NULL
) RETURNS TABLE (
  store_id UUID,
  store_name_ar TEXT,
  store_name_en TEXT,
  logo_url TEXT,
  banner_url TEXT,
  store_type public.store_type,
  operation_type public.operation_type,
  category_name_ar TEXT,
  category_name_en TEXT,
  serving_branch_id UUID,
  serving_branch_name_ar TEXT,
  distance_km NUMERIC,
  is_open BOOLEAN,
  next_open_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  min_order_halalas INT,
  delivery_fee_halalas INT,
  estimated_time_range TEXT,
  self_pickup_enabled BOOLEAN,
  self_pickup_discount_percentage NUMERIC
) AS $$
DECLARE
  v_city public.cities%ROWTYPE;
  v_point extensions.geography;
  v_section_setting_key TEXT;
  v_section_enabled BOOLEAN;
BEGIN
  -- التحقق من وقوع النقطة في مدينة مفعّلة
  SELECT * INTO v_city FROM public.city_for_point(p_lat, p_lng);
  IF v_city.id IS NULL THEN
    RETURN;
  END IF;

  v_point := extensions.ST_SetSRID(extensions.ST_Point(p_lng, p_lat), 4326)::extensions.geography;

  -- فحص تفعيل القسم المطلوب في إعدادات المدينة
  IF p_section IS NOT NULL AND p_section != 'self_pickup' THEN
    v_section_setting_key := 'section_' || p_section || '_enabled';
    v_section_enabled := COALESCE((public.get_setting(v_section_setting_key, v_city.id)#>>'{}')::BOOLEAN, true);
    IF NOT v_section_enabled THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  WITH store_nearest_branch AS (
    SELECT
      s.id AS s_id,
      s.name_ar AS s_name_ar,
      s.name_en AS s_name_en,
      s.logo_url AS s_logo_url,
      s.banner_url AS s_banner_url,
      s.store_type AS s_store_type,
      s.operation_type AS s_op_type,
      c.name_ar AS c_name_ar,
      c.name_en AS c_name_en,
      b.id AS b_id,
      b.name_ar AS b_name_ar,
      ROUND((extensions.ST_Distance(b.location, v_point) / 1000.0)::NUMERIC, 2) AS dist_km,
      b.default_prep_time_minutes AS b_prep_time,
      b.min_order_halalas AS b_min_order,
      b.working_hours AS b_hours,
      b.paused_until AS b_paused_until,
      COALESCE((public.get_setting('self_pickup_discount_percentage', v_city.id, NULL, s.id)#>>'{}')::NUMERIC, 0.0) AS pickup_disc,
      ROW_NUMBER() OVER (
        PARTITION BY s.id
        ORDER BY extensions.ST_Distance(b.location, v_point) ASC
      ) AS rank
    FROM public.stores s
    JOIN public.store_branches b ON b.store_id = s.id AND b.is_active = true
    LEFT JOIN public.store_categories c ON c.id = s.category_id
    WHERE s.city_id = v_city.id
      AND (p_section IS NULL OR p_section = 'self_pickup' OR s.operation_type::TEXT = p_section)
      AND (p_category_id IS NULL OR s.category_id = p_category_id)
      -- فحص قيود الزون المحدد للمتجر إن وُجد (MER-046)
      AND (
        NOT EXISTS (SELECT 1 FROM public.zones z WHERE z.store_id = s.id)
        OR EXISTS (
          SELECT 1 FROM public.zones z
          WHERE z.store_id = s.id
            AND extensions.ST_Covers(z.boundary, v_point)
        )
      )
  )
  SELECT
    snb.s_id,
    snb.s_name_ar,
    snb.s_name_en,
    snb.s_logo_url,
    snb.s_banner_url,
    snb.s_store_type,
    snb.s_op_type,
    snb.c_name_ar,
    snb.c_name_en,
    snb.b_id,
    snb.b_name_ar,
    snb.dist_km,
    (chk.status->>'is_open')::BOOLEAN,
    (chk.status->>'next_open_at')::TIMESTAMPTZ,
    (chk.status->>'closes_at')::TIMESTAMPTZ,
    snb.b_min_order,
    public.calculate_delivery_fee(snb.s_id, snb.b_id, snb.dist_km, v_city.id),
    (t_est.est->>'display_range')::TEXT,
    true, -- self pickup enabled
    snb.pickup_disc
  FROM store_nearest_branch snb
  CROSS JOIN LATERAL (SELECT public.check_branch_open_status(snb.b_id) AS status) chk
  CROSS JOIN LATERAL (SELECT public.estimate_delivery_time(snb.b_prep_time, snb.dist_km, v_city.id) AS est) t_est
  WHERE snb.rank = 1
  ORDER BY
    (chk.status->>'is_open')::BOOLEAN DESC,
    snb.dist_km ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 9. دالة تسعير السلة بالكامل في الخادم quote_cart (PAY-004, PAY-013, PAY-021, ORD-011, CRT-005)
CREATE OR REPLACE FUNCTION public.quote_cart(
  p_store_id UUID,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_items JSONB,
  p_device_lat DOUBLE PRECISION DEFAULT NULL,
  p_device_lng DOUBLE PRECISION DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_city public.cities%ROWTYPE;
  v_point extensions.geography;
  v_branch RECORD;
  v_distance_km NUMERIC;
  v_branch_status JSONB;
  v_contract public.store_contracts%ROWTYPE;
  v_item_elem JSONB;
  v_item_id UUID;
  v_size_id UUID;
  v_options_arr JSONB;
  v_qty INT;
  v_db_item RECORD;
  v_db_size RECORD;
  v_opt_id_elem JSONB;
  v_db_opt RECORD;
  v_item_unit_price INT;
  v_line_total INT;
  v_lines JSONB := '[]'::jsonb;
  v_products_total INT := 0;
  v_delivery_fee INT := 0;
  v_service_fee INT := 0;
  v_total INT := 0;
  v_max_prep_time INT := 0;
  v_time_est JSONB;
  v_min_order INT := 0;
  v_min_order_reached BOOLEAN := true;
  v_min_order_shortfall INT := 0;
  v_divergent_location BOOLEAN := false;
  v_divergence_threshold NUMERIC;
  v_device_dist_meters NUMERIC;
  v_snapshot JSONB;
  v_errors JSONB := '[]'::jsonb;
BEGIN
  -- 1. التحقق من تغطية المدينة
  SELECT * INTO v_city FROM public.city_for_point(p_lat, p_lng);
  IF v_city.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'الموقع المحدد خارج نطاق تغطية المدن المفعّلة'
    );
  END IF;

  v_point := extensions.ST_SetSRID(extensions.ST_Point(p_lng, p_lat), 4326)::extensions.geography;

  -- 2. تحديد أقرب فرع مفعّل يخدم هذه النقطة
  SELECT b.id, b.name_ar, b.default_prep_time_minutes, b.min_order_halalas,
         ROUND((extensions.ST_Distance(b.location, v_point) / 1000.0)::NUMERIC, 2) AS dist_km
  INTO v_branch
  FROM public.store_branches b
  WHERE b.store_id = p_store_id
    AND b.is_active = true
  ORDER BY extensions.ST_Distance(b.location, v_point) ASC
  LIMIT 1;

  IF v_branch.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'لا يوجد فرع مفعّل لهذا المتجر يخدم هذا العنوان'
    );
  END IF;

  v_distance_km := v_branch.dist_km;
  v_min_order := v_branch.min_order_halalas;
  v_max_prep_time := v_branch.default_prep_time_minutes;

  -- 3. حالة فتح الفرع
  v_branch_status := public.check_branch_open_status(v_branch.id);

  -- 4. فحص بنود العقد الساري للمتجر
  SELECT * INTO v_contract
  FROM public.store_contracts
  WHERE store_id = p_store_id
    AND (valid_until IS NULL OR valid_until > now())
  ORDER BY valid_from DESC
  LIMIT 1;

  -- 5. التحقق من كل صنف وحساب سعره للعميل (PAY-004, CUS-005)
  FOR v_item_elem IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id := (v_item_elem->>'item_id')::UUID;
    v_size_id := (v_item_elem->>'size_id')::UUID;
    v_options_arr := COALESCE(v_item_elem->'option_ids', '[]'::jsonb);
    v_qty := GREATEST(COALESCE((v_item_elem->>'quantity')::INT, 1), 1);

    -- جلب الصنف من قاعدة البيانات
    SELECT * INTO v_db_item
    FROM public.menu_items
    WHERE id = v_item_id AND store_id = p_store_id;

    IF v_db_item.id IS NULL THEN
      v_errors := v_errors || jsonb_build_object('item_id', v_item_id, 'reason', 'الصنف غير موجود');
      CONTINUE;
    END IF;

    IF NOT v_db_item.is_published OR NOT v_db_item.is_available OR (v_db_item.paused_until IS NOT NULL AND v_db_item.paused_until > now()) THEN
      v_errors := v_errors || jsonb_build_object('item_id', v_item_id, 'reason', 'الصنف غير متاح حالياً');
      CONTINUE;
    END IF;

    -- إذا كان للصنف أحجام، يلزم اختيار حجم معتمد
    IF EXISTS (SELECT 1 FROM public.menu_item_sizes WHERE item_id = v_item_id) THEN
      IF v_size_id IS NULL THEN
        v_errors := v_errors || jsonb_build_object('item_id', v_item_id, 'reason', 'يجب اختيار حجم للصنف');
        CONTINUE;
      END IF;

      SELECT * INTO v_db_size
      FROM public.menu_item_sizes
      WHERE id = v_size_id AND item_id = v_item_id;

      IF v_db_size.id IS NULL THEN
        v_errors := v_errors || jsonb_build_object('item_id', v_item_id, 'reason', 'الحجم المختار غير صحيح');
        CONTINUE;
      END IF;

      v_item_unit_price := public.calculate_customer_item_price(p_store_id, v_db_item.base_price_halalas + v_db_size.price_delta_halalas);
    ELSE
      v_item_unit_price := public.calculate_customer_item_price(p_store_id, v_db_item.base_price_halalas);
    END IF;

    -- إضافة أسعار الخيارات المختارة
    FOR v_opt_id_elem IN SELECT * FROM jsonb_array_elements(v_options_arr)
    LOOP
      SELECT * INTO v_db_opt
      FROM public.menu_item_options o
      JOIN public.menu_item_option_groups g ON g.id = o.group_id
      WHERE o.id = (v_opt_id_elem#>>'{}')::UUID
        AND g.item_id = v_item_id;

      IF v_db_opt.id IS NOT NULL THEN
        v_item_unit_price := v_item_unit_price + public.calculate_customer_item_price(p_store_id, v_db_opt.price_delta_halalas);
      END IF;
    END LOOP;

    -- سطر الصنف الإجمالي
    v_line_total := v_item_unit_price * v_qty;
    v_products_total := v_products_total + v_line_total;

    -- أطول مدة تحضير
    IF v_db_item.prep_time_minutes > v_max_prep_time THEN
      v_max_prep_time := v_db_item.prep_time_minutes;
    END IF;

    v_lines := v_lines || jsonb_build_object(
      'item_id', v_item_id,
      'item_name_ar', v_db_item.name_ar,
      'unit_price_halalas', v_item_unit_price,
      'quantity', v_qty,
      'line_total_halalas', v_line_total
    );
  END LOOP;

  -- 6. حساب رسوم التوصيل
  v_delivery_fee := public.calculate_delivery_fee(p_store_id, v_branch.id, v_distance_km, v_city.id);

  -- 7. حساب رسوم الخدمة
  v_service_fee := public.calculate_service_fee(v_city.id, v_products_total, v_delivery_fee);

  -- 8. المجموع الكلي: القاعدة الذهبية مجموع البنود = المجموع (CRT-005)
  v_total := v_products_total + v_delivery_fee + v_service_fee;

  -- 9. فحص الحد الأدنى للطلب
  IF v_products_total < v_min_order THEN
    v_min_order_reached := false;
    v_min_order_shortfall := v_min_order - v_products_total;
  END IF;

  -- 10. تقدير الوقت
  v_time_est := public.estimate_delivery_time(v_max_prep_time, v_distance_km, v_city.id);

  -- 11. فحص تباعد موقع الجهاز عن العنوان المختار (250 متر CUS-002)
  IF p_device_lat IS NOT NULL AND p_device_lng IS NOT NULL THEN
    v_divergence_threshold := COALESCE((public.get_setting('address_divergence_alert_threshold_meters')#>>'{}')::NUMERIC, 250.0);
    v_device_dist_meters := extensions.ST_Distance(
      v_point,
      extensions.ST_SetSRID(extensions.ST_Point(p_device_lng, p_device_lat), 4326)::extensions.geography
    );
    IF v_device_dist_meters > v_divergence_threshold THEN
      v_divergent_location := true;
    END IF;
  END IF;

  -- 12. لقطة التسعير المحفوظة (Snapshot)
  v_snapshot := jsonb_build_object(
    'contract_id', v_contract.id,
    'pricing_model', v_contract.pricing_model,
    'menu_markup_percentage', v_contract.menu_markup_percentage,
    'mart_pharmacy_customer_markup_percentage', v_contract.mart_pharmacy_customer_markup_percentage,
    'service_fee_type', public.get_setting('customer_service_fee_type', v_city.id)#>>'{}',
    'service_fee_percentage', public.get_setting('customer_service_fee_percentage', v_city.id)#>>'{}',
    'vat_percentage', public.get_setting('vat_percentage')#>>'{}',
    'calculated_at', now()
  );

  RETURN jsonb_build_object(
    'success', (jsonb_array_length(v_errors) = 0),
    'errors', v_errors,
    'store_id', p_store_id,
    'branch_id', v_branch.id,
    'branch_name_ar', v_branch.name_ar,
    'is_open', (v_branch_status->>'is_open')::BOOLEAN,
    'next_open_at', v_branch_status->>'next_open_at',
    'closes_at', v_branch_status->>'closes_at',
    'lines', v_lines,
    'products_total_halalas', v_products_total,
    'delivery_fee_halalas', v_delivery_fee,
    'service_fee_halalas', v_service_fee,
    'discount_halalas', 0,
    'tip_halalas', 0,
    'wallet_halalas', 0,
    'total_halalas', v_total,
    'min_order_halalas', v_min_order,
    'min_order_reached', v_min_order_reached,
    'min_order_shortfall_halalas', v_min_order_shortfall,
    'distance_km', v_distance_km,
    'time_estimate', v_time_est,
    'is_device_location_divergent', v_divergent_location,
    'pricing_snapshot', v_snapshot
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- منح صلاحيات التنفيذ للأدوار المصرح لها
GRANT EXECUTE ON FUNCTION public.calculate_customer_item_price(UUID, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_branch_open_status(UUID, TIMESTAMPTZ) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_delivery_fee(UUID, UUID, NUMERIC, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_service_fee(UUID, INT, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.estimate_delivery_time(INT, NUMERIC, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.customer_menu(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.stores_for_point(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.quote_cart(UUID, DOUBLE PRECISION, DOUBLE PRECISION, JSONB, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated, service_role;

