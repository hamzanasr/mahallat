-- Migration: 20260929000013_pricing_functions_update.sql
-- Step 2.4: Update customer_menu and quote_cart to match menu_item_sizes and options schema

-- 1. دالة منيو العميل customer_menu(store_id) (CUS-005, PAY-004)
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
             calories_value, is_sfda_exempt, sfda_exemption_reason_id,
             allergens, high_salt, caffeine_mg,
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

      -- جلب الأحجام بأسعار العميل (سعر الأساس + فارق الحجم)
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
        'calories_value', v_item.calories_value,
        'is_sfda_exempt', v_item.is_sfda_exempt,
        'sfda_exemption_reason_id', v_item.sfda_exemption_reason_id,
        'allergens', v_item.allergens,
        'high_salt', v_item.high_salt,
        'caffeine_mg', v_item.caffeine_mg,
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

-- 2. دالة تسعير السلة بالكامل في الخادم quote_cart (PAY-004, PAY-013, PAY-021, ORD-011, CRT-005)
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

GRANT EXECUTE ON FUNCTION public.customer_menu(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.quote_cart(UUID, DOUBLE PRECISION, DOUBLE PRECISION, JSONB, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated, service_role;
