-- Migration: 20260930000001_remove_uncontracted_store_type.sql
-- Step 3.1: Clean up uncontracted store type ('uncontracted' / 'اطلب اللي تبي')
-- All stores are now contracted: either 'contracted_menu' or 'contracted_text_only'.

-- 1. تحديث أي متجر مسجل حالياً كـ uncontracted ليصبح contracted_menu
UPDATE public.stores
SET store_type = 'contracted_menu'
WHERE store_type::TEXT = 'uncontracted';

-- 2. إضافة قيد صارم على جدول stores يقصر الأنواع على contracted_menu و contracted_text_only
ALTER TABLE public.stores
DROP CONSTRAINT IF EXISTS check_valid_store_type;

ALTER TABLE public.stores
ADD CONSTRAINT check_valid_store_type
CHECK (store_type::TEXT IN ('contracted_menu', 'contracted_text_only'));

-- 3. تحديث دالة التحقق من إضافة أقسام المنيو لمنع الإضافة للمتعاقد كتابة فقط
CREATE OR REPLACE FUNCTION public.check_store_allows_menu_fn()
RETURNS TRIGGER AS $$
DECLARE
  v_store_type public.store_type;
BEGIN
  SELECT store_type INTO v_store_type FROM public.stores WHERE id = NEW.store_id;
  IF v_store_type::TEXT = 'contracted_text_only' THEN
    RAISE EXCEPTION 'المتجر المتعاقد كتابة فقط لا يمكن إضافة منيو رقمي له (MER-046)';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. تحديث دالة customer_menu لحذف الإشارة إلى غير المتعاقد
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

  -- إذا كان المتجر متعاقد كتابة فقط (MER-046)
  IF v_store.store_type::TEXT = 'contracted_text_only' THEN
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

  -- التكرار على أقسام المنيو للمتجر
  FOR v_sec IN
    SELECT id, name_ar, name_en, sort_order
    FROM public.menu_sections
    WHERE store_id = p_store_id AND is_active = true
    ORDER BY sort_order ASC, created_at ASC
  LOOP
    v_items := '[]'::jsonb;

    -- الأصناف المتاحة والمنشورة في هذا القسم
    FOR v_item IN
      SELECT id, name_ar, name_en, description_ar, description_en,
             base_price_halalas, image_url, prep_time_minutes,
             calories_value, calories_min, calories_max, is_sfda_exempt,
             allergens, has_caffeine, caffeine_mg, is_high_salt,
             is_available, paused_until
      FROM public.menu_items
      WHERE section_id = v_sec.id
        AND is_published = true
        AND is_available = true
        AND (paused_until IS NULL OR paused_until <= now())
      ORDER BY created_at ASC
    LOOP
      -- حساب سعر الصنف للعميل متضمناً زيادة العقد إن وُجدت (PAY-004)
      SELECT customer_price_halalas INTO v_customer_item_price
      FROM public.calculate_customer_item_price(p_store_id, v_item.base_price_halalas);

      -- جلب الأحجام
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', mis.id,
          'name_ar', mis.name_ar,
          'name_en', mis.name_en,
          'price_delta_halalas', mis.price_delta_halalas,
          'calories_value', mis.calories_value,
          'is_default', mis.is_default
        ) ORDER BY mis.sort_order ASC
      ), '[]'::jsonb)
      INTO v_sizes
      FROM public.menu_item_sizes mis
      WHERE mis.item_id = v_item.id;

      -- جلب مجموعات الخيارات
      v_groups := '[]'::jsonb;
      FOR v_grp IN
        SELECT id, name_ar, name_en, is_required, min_selectable, max_selectable, sort_order
        FROM public.menu_item_option_groups
        WHERE item_id = v_item.id
        ORDER BY sort_order ASC
      LOOP
        -- جلب خيارات هذه المجموعة
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', mio.id,
            'name_ar', mio.name_ar,
            'name_en', mio.name_en,
            'price_delta_halalas', mio.price_delta_halalas,
            'calories_delta', mio.calories_delta,
            'is_default', mio.is_default
          ) ORDER BY mio.sort_order ASC
        ), '[]'::jsonb)
        INTO v_opts
        FROM public.menu_item_options mio
        WHERE mio.group_id = v_grp.id AND mio.is_available = true;

        v_groups := v_groups || jsonb_build_array(
          jsonb_build_object(
            'id', v_grp.id,
            'name_ar', v_grp.name_ar,
            'name_en', v_grp.name_en,
            'is_required', v_grp.is_required,
            'min_selectable', v_grp.min_selectable,
            'max_selectable', v_grp.max_selectable,
            'options', v_opts
          )
        );
      END LOOP;

      v_items := v_items || jsonb_build_array(
        jsonb_build_object(
          'id', v_item.id,
          'name_ar', v_item.name_ar,
          'name_en', v_item.name_en,
          'description_ar', v_item.description_ar,
          'description_en', v_item.description_en,
          'customer_price_halalas', v_customer_item_price,
          'image_url', v_item.image_url,
          'prep_time_minutes', v_item.prep_time_minutes,
          'calories_value', v_item.calories_value,
          'calories_min', v_item.calories_min,
          'calories_max', v_item.calories_max,
          'is_sfda_exempt', v_item.is_sfda_exempt,
          'allergens', v_item.allergens,
          'has_caffeine', v_item.has_caffeine,
          'caffeine_mg', v_item.caffeine_mg,
          'is_high_salt', v_item.is_high_salt,
          'sizes', v_sizes,
          'option_groups', v_groups
        )
      );
    END LOOP;

    v_sections := v_sections || jsonb_build_array(
      jsonb_build_object(
        'id', v_sec.id,
        'name_ar', v_sec.name_ar,
        'name_en', v_sec.name_en,
        'sort_order', v_sec.sort_order,
        'items', v_items
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'store_id', v_store.id,
    'store_name_ar', v_store.name_ar,
    'store_name_en', v_store.name_en,
    'store_type', v_store.store_type,
    'operation_type', v_store.operation_type,
    'logo_url', v_store.logo_url,
    'banner_url', v_store.banner_url,
    'is_text_only', false,
    'sections', v_sections
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
