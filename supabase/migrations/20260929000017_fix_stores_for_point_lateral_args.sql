-- Migration: 20260929000017_fix_stores_for_point_lateral_args.sql
-- Step 2.5: Fix lateral joins and function argument order in stores_for_point

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
    (chk.status->>'is_open')::BOOLEAN,
    (chk.status->>'next_open_at')::TIMESTAMPTZ,
    (chk.status->>'closes_at')::TIMESTAMPTZ,
    snb.b_min_order,
    public.calculate_delivery_fee(snb.s_id, snb.b_id, snb.dist_km, v_city.id),
    (t_est.est->>'display_range')::TEXT,
    snb.s_pickup_enabled,
    snb.s_pickup_discount
  FROM store_nearest_branch snb
  CROSS JOIN LATERAL (SELECT public.check_branch_open_status(snb.b_id) AS status) chk
  CROSS JOIN LATERAL (SELECT public.estimate_delivery_time(snb.b_prep_time, snb.dist_km, v_city.id) AS est) t_est
  WHERE snb.rank = 1
  ORDER BY
    (chk.status->>'is_open')::BOOLEAN DESC,
    snb.dist_km ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.stores_for_point(DOUBLE PRECISION, DOUBLE PRECISION, TEXT, UUID) TO anon, authenticated, service_role;
