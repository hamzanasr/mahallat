-- Migration: 20260929000016_fix_store_type_and_zones_query.sql
-- Step 2.5: Fix store_type enum comparison in customer_menu and zones reference in stores_for_point

-- 1. تحديث دالة customer_menu
CREATE OR REPLACE FUNCTION public.customer_menu(p_store_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_store RECORD;
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
  -- جلب بيانات المتجر الأساسية
  SELECT id, name_ar, name_en, store_type, operation_type, logo_url, banner_url
  INTO v_store
  FROM public.stores
  WHERE id = p_store_id;

  IF v_store.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- إذا كان المتجر متعاقد كتابة فقط أو غير متعاقد (MER-046)
  IF v_store.store_type::TEXT IN ('contracted_text_only', 'uncontracted') THEN
    RETURN jsonb_build_object(
      'store_id', v_store.id,
      'store_name_ar', v_store.name_ar,
      'store_name_en', v_store.name_en,
      'store_type', v_store.store_type,
      'operation_type', v_store.operation_type,
      'logo_url', v_store.logo_url,
      'banner_url', v_store.banner_url,
      'sections', '[]'::jsonb
    );
  END IF;

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
             allergens, is_high_salt, caffeine_mg,
             is_available, paused_until
      FROM public.menu_items
      WHERE section_id = v_sec.id
        AND is_published = true
        AND is_available = true
        AND (paused_until IS NULL OR paused_until <= now())
      ORDER BY created_at ASC
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
          'calories_value', s.calories_value,
          'is_default', s.is_default
        ) ORDER BY s.sort_order
      ), '[]'::jsonb) INTO v_sizes
      FROM public.menu_item_sizes s
      WHERE s.item_id = v_item.id;

      -- جلب مجموعات الإضافات وخياراتها
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
            'price_delta_halalas', o.price_delta_halalas,
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
        'is_high_salt', v_item.is_high_salt,
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

  RETURN jsonb_build_object(
    'store_id', v_store.id,
    'store_name_ar', v_store.name_ar,
    'store_name_en', v_store.name_en,
    'store_type', v_store.store_type,
    'operation_type', v_store.operation_type,
    'logo_url', v_store.logo_url,
    'banner_url', v_store.banner_url,
    'sections', v_sections
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.customer_menu(UUID) TO anon, authenticated, service_role;

-- 2. تحديث stores_for_point لإصلاح فحص الزون (s.delivery_zone_id)
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

  -- فحص تفعيل القسم المطلوب في إعدادات المدينة (CUS-009)
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
      s.self_pickup_enabled AS s_pickup_enabled,
      s.self_pickup_discount_percentage AS s_pickup_discount,
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
      -- فحص نطاق الزون التابع للمتجر إن وُجد
      AND (
        s.delivery_zone_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.zones z
          WHERE z.id = s.delivery_zone_id
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
    (st.status->>'is_open')::BOOLEAN,
    (st.status->>'next_open_at')::TIMESTAMPTZ,
    (st.status->>'closes_at')::TIMESTAMPTZ,
    snb.b_min_order,
    fee.fee,
    (time_est.est->>'display_range')::TEXT,
    snb.s_pickup_enabled,
    snb.s_pickup_discount
  FROM store_nearest_branch snb
  CROSS JOIN LATERAL (
    SELECT public.check_branch_open_status(snb.b_hours, snb.b_paused_until) AS status
  ) st
  CROSS JOIN LATERAL (
    SELECT public.calculate_delivery_fee(snb.s_id, snb.b_id, v_city.id, snb.dist_km) AS fee
  ) fee
  CROSS JOIN LATERAL (
    SELECT public.estimate_delivery_time(snb.s_id, snb.b_id, v_city.id, snb.dist_km) AS est
  ) time_est
  WHERE snb.rank = 1
  ORDER BY
    (st.status->>'is_open')::BOOLEAN DESC,
    snb.dist_km ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.stores_for_point(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, UUID) TO anon, authenticated, service_role;
