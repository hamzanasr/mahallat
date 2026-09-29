-- Migration: 20260929000018_cart_suggested_items.sql
-- Step 2.6: Add is_suggested_in_cart to menu_items and return suggested_items in quote_cart (CRT-003)

-- 1. إضافة عمود اقتراح الصنف في السلة
ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS is_suggested_in_cart BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.menu_items.is_suggested_in_cart IS 'تحديد ما إذا كان الصنف يُقترح للعميل في السلة لزيادة المبيعات (CRT-003)';

-- 2. تحديث دالة quote_cart لترجع حتى 5 أصناف مقترحة من نفس المتجر
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
  v_store RECORD;
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
  v_opt_id UUID;
  v_db_opt RECORD;
  v_unit_customer_price INT;
  v_options_delta_total INT;
  v_line_total INT;
  v_products_total INT := 0;
  v_delivery_fee INT := 0;
  v_service_fee INT := 0;
  v_total INT := 0;
  v_min_order INT := 0;
  v_min_order_reached BOOLEAN := true;
  v_min_order_shortfall INT := 0;
  v_max_prep_time INT := 20;
  v_time_est JSONB;
  v_divergent_location BOOLEAN := false;
  v_divergence_threshold NUMERIC;
  v_device_dist_meters NUMERIC;
  v_lines JSONB := '[]'::jsonb;
  v_errors JSONB := '[]'::jsonb;
  v_snapshot JSONB;
  v_suggested_items JSONB := '[]'::jsonb;
  v_sug_rec RECORD;
  v_sug_sizes JSONB;
  v_sug_groups JSONB;
  v_sug_grp RECORD;
  v_sug_opts JSONB;
  v_cart_item_ids UUID[] := '{}';
BEGIN
  -- 1. استخراج المتجر والمدينة
  SELECT * INTO v_store FROM public.stores WHERE id = p_store_id;
  IF v_store.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'errors', jsonb_build_array(jsonb_build_object('code', 'STORE_NOT_FOUND', 'message', 'المتجر غير موجود'))
    );
  END IF;

  SELECT * INTO v_city FROM public.city_for_point(p_lat, p_lng);
  IF v_city.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'errors', jsonb_build_array(jsonb_build_object('code', 'OUT_OF_COVERAGE', 'message', 'العنوان يقع خارج نطاق التغطية'))
    );
  END IF;

  v_point := extensions.ST_SetSRID(extensions.ST_Point(p_lng, p_lat), 4326)::extensions.geography;

  -- 2. إيجاد أقرب فرع مفعّل للمتجر يخدم هذه النقطة
  SELECT
    b.id,
    b.name_ar,
    b.name_en,
    b.min_order_halalas,
    b.default_prep_time_minutes,
    b.working_hours,
    b.paused_until,
    ROUND((extensions.ST_Distance(b.location, v_point) / 1000.0)::NUMERIC, 2) AS dist_km
  INTO v_branch
  FROM public.store_branches b
  WHERE b.store_id = p_store_id
    AND b.is_active = true
    AND (
      v_store.delivery_zone_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.zones z
        WHERE z.id = v_store.delivery_zone_id
          AND extensions.ST_Covers(z.boundary, v_point)
      )
    )
  ORDER BY extensions.ST_Distance(b.location, v_point) ASC
  LIMIT 1;

  IF v_branch.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'errors', jsonb_build_array(jsonb_build_object('code', 'STORE_NOT_SERVING_POINT', 'message', 'المتجر لا يخدم هذا العنوان حالياً'))
    );
  END IF;

  v_distance_km := v_branch.dist_km;
  v_min_order := v_branch.min_order_halalas;
  v_max_prep_time := v_branch.default_prep_time_minutes;

  -- 3. فحص حالة عمل الفرع
  v_branch_status := public.check_branch_open_status(v_branch.id);

  -- 4. جلب عقد المتجر الساري
  SELECT * INTO v_contract
  FROM public.store_contracts
  WHERE store_id = p_store_id
    AND valid_from <= now()
    AND (valid_until IS NULL OR valid_until > now())
  ORDER BY valid_from DESC
  LIMIT 1;

  -- 5. معالجة بنود السلة وحساب أسعار العميل
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item_elem IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_item_id := (v_item_elem->>'item_id')::UUID;
      v_size_id := NULL;
      IF v_item_elem->>'size_id' IS NOT NULL AND (v_item_elem->>'size_id') != '' THEN
        v_size_id := (v_item_elem->>'size_id')::UUID;
      END IF;
      v_options_arr := COALESCE(v_item_elem->'option_ids', '[]'::jsonb);
      v_qty := GREATEST(1, COALESCE((v_item_elem->>'quantity')::INT, 1));

      -- تجميع معرفات الأصناف في السلة لاستبعادها من الاقتراحات
      IF NOT (v_item_id = ANY(v_cart_item_ids)) THEN
        v_cart_item_ids := array_append(v_cart_item_ids, v_item_id);
      END IF;

      -- التحقق من الصنف في المنيو
      SELECT i.*, s.store_id AS s_store_id
      INTO v_db_item
      FROM public.menu_items i
      JOIN public.menu_sections s ON s.id = i.section_id
      WHERE i.id = v_item_id
        AND s.store_id = p_store_id;

      IF v_db_item.id IS NULL THEN
        v_errors := v_errors || jsonb_build_object('code', 'ITEM_NOT_FOUND', 'item_id', v_item_id, 'message', 'الصنف غير موجود بالمنيو');
        CONTINUE;
      END IF;

      IF NOT v_db_item.is_available OR NOT v_db_item.is_published OR (v_db_item.paused_until IS NOT NULL AND v_db_item.paused_until > now()) THEN
        v_errors := v_errors || jsonb_build_object('code', 'ITEM_UNAVAILABLE', 'item_id', v_item_id, 'item_name_ar', v_db_item.name_ar, 'message', 'الصنف غير متاح حالياً');
      END IF;

      -- فحص الأحجام الإلزامية (CUS-005)
      IF EXISTS (SELECT 1 FROM public.menu_item_sizes WHERE item_id = v_item_id) THEN
        IF v_size_id IS NULL THEN
          v_errors := v_errors || jsonb_build_object('code', 'SIZE_REQUIRED', 'item_id', v_item_id, 'item_name_ar', v_db_item.name_ar, 'message', 'يرجى اختيار الحجم المطلوب');
          CONTINUE;
        END IF;

        SELECT * INTO v_db_size
        FROM public.menu_item_sizes
        WHERE id = v_size_id AND item_id = v_item_id;

        IF v_db_size.id IS NULL THEN
          v_errors := v_errors || jsonb_build_object('code', 'SIZE_INVALID', 'item_id', v_item_id, 'size_id', v_size_id, 'message', 'الحجم المختار غير صالح');
          CONTINUE;
        END IF;

        v_unit_customer_price := public.calculate_customer_item_price(p_store_id, v_db_item.base_price_halalas + v_db_size.price_delta_halalas);
      ELSE
        v_unit_customer_price := public.calculate_customer_item_price(p_store_id, v_db_item.base_price_halalas);
      END IF;

      -- فحص الخيارات والإضافات
      v_options_delta_total := 0;
      FOR v_opt_id_elem IN SELECT * FROM jsonb_array_elements(v_options_arr)
      LOOP
        v_opt_id := (v_opt_id_elem#>>'{}')::UUID;
        SELECT o.* INTO v_db_opt
        FROM public.menu_item_options o
        JOIN public.menu_item_option_groups g ON g.id = o.group_id
        WHERE o.id = v_opt_id AND g.item_id = v_item_id;

        IF v_db_opt.id IS NOT NULL THEN
          v_options_delta_total := v_options_delta_total + v_db_opt.price_delta_halalas;
        END IF;
      END LOOP;

      v_line_total := (v_unit_customer_price + v_options_delta_total) * v_qty;
      v_products_total := v_products_total + v_line_total;

      IF v_db_item.prep_time_minutes > v_max_prep_time THEN
        v_max_prep_time := v_db_item.prep_time_minutes;
      END IF;

      v_lines := v_lines || jsonb_build_object(
        'item_id', v_item_id,
        'name_ar', v_db_item.name_ar,
        'name_en', v_db_item.name_en,
        'size_id', v_size_id,
        'size_name_ar', v_db_size.name_ar,
        'quantity', v_qty,
        'unit_price_halalas', v_unit_customer_price + v_options_delta_total,
        'line_total_halalas', v_line_total
      );
    END LOOP;
  END IF;

  -- 6. حساب رسوم التوصيل
  v_delivery_fee := public.calculate_delivery_fee(p_store_id, v_branch.id, v_distance_km, v_city.id);

  -- 7. حساب رسوم الخدمة
  v_service_fee := public.calculate_service_fee(v_products_total, v_delivery_fee, v_city.id);

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

  -- 12. جلب حتى 5 أصناف مقترحة من نفس المتجر ليست في السلة (CRT-003)
  FOR v_sug_rec IN
    SELECT mi.id, mi.name_ar, mi.name_en, mi.description_ar, mi.description_en,
           mi.base_price_halalas, mi.image_url, mi.calories_value, mi.is_sfda_exempt,
           mi.allergens, mi.is_high_salt, mi.caffeine_mg,
           EXISTS (SELECT 1 FROM public.menu_item_sizes sz WHERE sz.item_id = mi.id) AS has_sizes
    FROM public.menu_items mi
    JOIN public.menu_sections ms ON ms.id = mi.section_id
    WHERE ms.store_id = p_store_id
      AND ms.is_active = true
      AND mi.is_published = true
      AND mi.is_available = true
      AND (mi.paused_until IS NULL OR mi.paused_until <= now())
      AND NOT (mi.id = ANY(v_cart_item_ids))
    ORDER BY mi.is_suggested_in_cart DESC, mi.created_at ASC
    LIMIT 5
  LOOP
    -- جلب أحجام الصنف المقترح
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'name_ar', s.name_ar,
        'name_en', s.name_en,
        'customer_price_halalas', public.calculate_customer_item_price(p_store_id, v_sug_rec.base_price_halalas + s.price_delta_halalas),
        'price_delta_halalas', s.price_delta_halalas,
        'calories_value', s.calories_value,
        'is_default', s.is_default
      ) ORDER BY s.sort_order
    ), '[]'::jsonb) INTO v_sug_sizes
    FROM public.menu_item_sizes s
    WHERE s.item_id = v_sug_rec.id;

    -- جلب مجموعات خيارات الصنف المقترح
    v_sug_groups := '[]'::jsonb;
    FOR v_sug_grp IN
      SELECT id, name_ar, name_en, is_required, min_selectable, max_selectable, sort_order
      FROM public.menu_item_option_groups
      WHERE item_id = v_sug_rec.id
      ORDER BY sort_order ASC
    LOOP
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'name_ar', o.name_ar,
          'name_en', o.name_en,
          'price_delta_halalas', o.price_delta_halalas,
          'calories_delta', o.calories_delta
        ) ORDER BY o.sort_order
      ), '[]'::jsonb) INTO v_sug_opts
      FROM public.menu_item_options o
      WHERE o.group_id = v_sug_grp.id;

      v_sug_groups := v_sug_groups || jsonb_build_object(
        'id', v_sug_grp.id,
        'name_ar', v_sug_grp.name_ar,
        'name_en', v_sug_grp.name_en,
        'is_required', v_sug_grp.is_required,
        'min_selectable', v_sug_grp.min_selectable,
        'max_selectable', v_sug_grp.max_selectable,
        'options', v_sug_opts
      );
    END LOOP;

    v_suggested_items := v_suggested_items || jsonb_build_object(
      'id', v_sug_rec.id,
      'name_ar', v_sug_rec.name_ar,
      'name_en', v_sug_rec.name_en,
      'description_ar', v_sug_rec.description_ar,
      'description_en', v_sug_rec.description_en,
      'image_url', v_sug_rec.image_url,
      'customer_price_halalas', public.calculate_customer_item_price(p_store_id, v_sug_rec.base_price_halalas),
      'calories_value', v_sug_rec.calories_value,
      'is_sfda_exempt', v_sug_rec.is_sfda_exempt,
      'allergens', v_sug_rec.allergens,
      'is_high_salt', v_sug_rec.is_high_salt,
      'caffeine_mg', v_sug_rec.caffeine_mg,
      'has_sizes', v_sug_rec.has_sizes,
      'sizes', v_sug_sizes,
      'option_groups', v_sug_groups
    );
  END LOOP;

  -- 13. لقطة التسعير المحفوظة (Snapshot)
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
    'suggested_items', v_suggested_items,
    'pricing_snapshot', v_snapshot
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.quote_cart(UUID, DOUBLE PRECISION, DOUBLE PRECISION, JSONB, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated, service_role;
