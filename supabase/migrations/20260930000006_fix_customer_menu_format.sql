-- =============================================================================
-- Migration: 20260930000006_fix_customer_menu_format.sql
-- Restore original customer_menu object format from migration 15
-- =============================================================================

CREATE OR REPLACE FUNCTION public.customer_menu(p_store_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_store RECORD;
  v_sec RECORD;
  v_item RECORD;
  v_sizes JSONB;
  v_groups JSONB;
  v_opts JSONB;
  v_grp RECORD;
  v_items JSONB := '[]'::jsonb;
  v_sections JSONB := '[]'::jsonb;
  v_customer_item_price INT;
BEGIN
  -- 1. استخراج المتجر
  SELECT id, name_ar, name_en, logo_url, banner_url, store_type, operation_type
  INTO v_store
  FROM public.stores
  WHERE id = p_store_id;

  IF v_store.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- إذا كان المتجر كتابة فقط (contracted_text_only)
  IF v_store.store_type = 'contracted_text_only' THEN
    RETURN jsonb_build_object(
      'store_id', v_store.id,
      'store_name_ar', v_store.name_ar,
      'store_name_en', v_store.name_en,
      'store_type', v_store.store_type,
      'operation_type', v_store.operation_type,
      'logo_url', v_store.logo_url,
      'banner_url', v_store.banner_url,
      'is_text_only', true,
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
