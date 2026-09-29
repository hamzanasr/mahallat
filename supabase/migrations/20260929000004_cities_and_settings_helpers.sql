-- ==============================================================================
-- الخطوة 1.4: دوال مساعدة لإدارة المدن الجغرافية (GeoJSON) وتحديث الإعدادات مع التدقيق
-- ==============================================================================

-- 1. دالة تحديث أو إنشاء مدينة مع تحويل GeoJSON إلى MultiPolygon Geography
CREATE OR REPLACE FUNCTION public.admin_save_city(
  p_id UUID,
  p_name_ar TEXT,
  p_name_en TEXT,
  p_is_active BOOLEAN,
  p_geojson TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_city_id UUID;
  v_geom extensions.geometry;
  v_geog extensions.geography;
BEGIN
  -- التحقق من صلاحية المدير العام أو العمليات
  IF NOT (
    public.has_role(auth.uid(), 'super_admin') 
    OR public.has_role(auth.uid(), 'operations') 
    OR auth.role() = 'service_role'
  ) THEN
    RAISE EXCEPTION 'غير مصرح لك بإدارة المدن';
  END IF;

  -- تحويل GeoJSON إن وُجد
  IF p_geojson IS NOT NULL AND trim(p_geojson) <> '' THEN
    BEGIN
      v_geom := extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(p_geojson), 4326);
      v_geog := extensions.ST_Multi(v_geom)::extensions.geography;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'صيغة GeoJSON غير صالحة: %', SQLERRM;
    END;
  END IF;

  IF p_id IS NOT NULL THEN
    UPDATE public.cities
    SET
      name_ar = p_name_ar,
      name_en = p_name_en,
      is_active = p_is_active,
      boundary = CASE WHEN v_geog IS NOT NULL THEN v_geog ELSE boundary END,
      updated_at = now()
    WHERE id = p_id
    RETURNING id INTO v_city_id;
  ELSE
    INSERT INTO public.cities (name_ar, name_en, is_active, boundary)
    VALUES (p_name_ar, p_name_en, p_is_active, v_geog)
    RETURNING id INTO v_city_id;
  END IF;

  RETURN v_city_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. دالة جلب المدن مع حدودها بصيغة GeoJSON نصية للواجهة
CREATE OR REPLACE FUNCTION public.get_cities_geojson()
RETURNS TABLE (
  id UUID,
  name_ar TEXT,
  name_en TEXT,
  is_active BOOLEAN,
  geojson TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name_ar,
    c.name_en,
    c.is_active,
    extensions.ST_AsGeoJSON(c.boundary::extensions.geometry)::TEXT AS geojson,
    c.created_at,
    c.updated_at
  FROM public.cities c
  ORDER BY c.created_at ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. دالة تحديث الإعدادات مع تسجيل سبب التعديل الإلزامي في سجل التدقيق (ADM-034)
CREATE OR REPLACE FUNCTION public.admin_update_setting(
  p_key TEXT,
  p_value JSONB,
  p_reason TEXT,
  p_city_id UUID DEFAULT NULL,
  p_store_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_def RECORD;
  v_num NUMERIC;
BEGIN
  -- 1. اشتراط سبب التعديل
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'سبب التعديل إلزامي لتسجيله في سجل التدقيق';
  END IF;

  -- 2. التحقق من الصلاحيات
  IF NOT (
    public.has_role(auth.uid(), 'super_admin') 
    OR public.has_role(auth.uid(), 'operations') 
    OR auth.role() = 'service_role'
  ) THEN
    RAISE EXCEPTION 'غير مصرح لك بتعديل الإعدادات';
  END IF;

  -- 3. موظف الدعم ممنوع تماماً
  IF public.has_role(auth.uid(), 'support') 
     AND NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'operations')) THEN
    RAISE EXCEPTION 'غير مصرح لموظف الدعم بتعديل أي إعداد';
  END IF;

  -- 4. جلب تعريف الإعداد وفحص القيود (Min / Max)
  SELECT * INTO v_def FROM public.setting_definitions WHERE key = p_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الإعداد غير موجود: %', p_key;
  END IF;

  -- فحص الحدود للأرقام والنسب والمهل
  IF v_def.type IN ('number', 'percentage', 'amount_halalas', 'duration_minutes', 'duration_seconds') THEN
    v_num := (p_value->>'value')::NUMERIC;
    IF v_def.min_value IS NOT NULL AND v_num < v_def.min_value THEN
      RAISE EXCEPTION 'القيمة % أقل من الحد الأدنى المسموح (%)', v_num, v_def.min_value;
    END IF;
    IF v_def.max_value IS NOT NULL AND v_num > v_def.max_value THEN
      RAISE EXCEPTION 'القيمة % أكبر من الحد الأعلى المسموح (%)', v_num, v_def.max_value;
    END IF;
  END IF;

  -- 5. تعيين سبب التعديل في جلسة PostgreSQL ليلتقطه trigger التدقيق
  PERFORM set_config('app.audit_reason', p_reason, true);

  -- 6. حفظ القيمة في جدول setting_values
  INSERT INTO public.setting_values (key, city_id, store_id, value)
  VALUES (p_key, p_city_id, p_store_id, p_value)
  ON CONFLICT (key, city_id, store_id)
  DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = now();

  RETURN jsonb_build_object('success', true, 'key', p_key, 'value', p_value);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
