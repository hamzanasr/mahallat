-- ==============================================================================
-- الخطوة 1.4: تصحيح دالة تحديث الإعدادات للتوافق مع أعمدة setting_values (level, entity_id)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_setting(
  p_key TEXT,
  p_value JSONB,
  p_reason TEXT,
  p_city_id UUID DEFAULT NULL,
  p_store_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_def RECORD;
  v_level TEXT;
  v_entity_id UUID;
  v_num NUMERIC;
BEGIN
  -- 1. اشتراط سبب التعديل
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'سبب التعديل إلزامي لتسجيله في سجل التدقيق';
  END IF;

  -- 2. موظف الدعم ممنوع تماماً
  IF public.has_role(auth.uid(), 'support') 
     AND NOT (public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'operations') OR public.has_role(auth.uid(), 'finance')) THEN
    RAISE EXCEPTION 'غير مصرح لموظف الدعم بتعديل أي إعداد';
  END IF;

  -- 3. التحقق من الصلاحيات للمدير العام أو العمليات أو الخدمة
  IF NOT (
    public.has_role(auth.uid(), 'super_admin') 
    OR public.has_role(auth.uid(), 'operations') 
    OR auth.role() = 'service_role'
  ) THEN
    RAISE EXCEPTION 'غير مصرح لك بتعديل الإعدادات';
  END IF;

  -- 4. تحديد المستوى ومعرف الكيان
  IF p_store_id IS NOT NULL THEN
    v_level := 'store';
    v_entity_id := p_store_id;
  ELSIF p_city_id IS NOT NULL THEN
    v_level := 'city';
    v_entity_id := p_city_id;
  ELSE
    v_level := 'global';
    v_entity_id := NULL;
  END IF;

  -- 5. جلب تعريف الإعداد وفحص القيود (Min / Max)
  SELECT * INTO v_def FROM public.setting_definitions WHERE key = p_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الإعداد غير موجود: %', p_key;
  END IF;

  -- فحص الحدود للأرقام والنسب والمهل
  IF v_def.type IN ('number', 'percentage', 'amount_halalas', 'duration_minutes', 'duration_seconds') THEN
    v_num := (p_value#>>'{}')::NUMERIC;
    IF v_def.min_value IS NOT NULL AND v_num < v_def.min_value THEN
      RAISE EXCEPTION 'القيمة % أقل من الحد الأدنى المسموح (%)', v_num, v_def.min_value;
    END IF;
    IF v_def.max_value IS NOT NULL AND v_num > v_def.max_value THEN
      RAISE EXCEPTION 'القيمة % أكبر من الحد الأعلى المسموح (%)', v_num, v_def.max_value;
    END IF;
  END IF;

  -- 6. تعيين سبب التعديل في جلسة PostgreSQL ليلتقطه trigger التدقيق
  PERFORM set_config('app.audit_reason', p_reason, true);

  -- 7. حفظ القيمة في جدول setting_values
  INSERT INTO public.setting_values (key, level, entity_id, value, updated_by)
  VALUES (p_key, v_level, v_entity_id, p_value, auth.uid())
  ON CONFLICT (key, level, entity_id)
  DO UPDATE SET
    value = EXCLUDED.value,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();

  RETURN jsonb_build_object('success', true, 'key', p_key, 'value', p_value);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
