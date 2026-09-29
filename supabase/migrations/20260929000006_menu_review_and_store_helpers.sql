-- ==============================================================================
-- الخطوة 1.5: دوال مساعدة لإدارة مراجعة الأسعار، الفروع جغرافياً، وتأريخ العقود
-- المتطلبات: MER-001 · MER-002 · MER-009 · MER-025 · MER-040 · MER-046
-- ==============================================================================

-- 1. دالة مراجعة طلبات تعديل أسعار المنيو من قبل الإدارة (MER-002)
CREATE OR REPLACE FUNCTION public.review_menu_change_request(
  p_request_id UUID,
  p_action TEXT, -- 'approve' OR 'reject'
  p_rejection_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_req RECORD;
BEGIN
  -- التأكد من صلاحية الإدارة
  IF NOT (public.is_admin(auth.uid()) OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'غير مصرح لك بمراجعة طلبات التاجر';
  END IF;

  -- جلب الطلب المعلق
  SELECT * INTO v_req
  FROM public.menu_review_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'طلب المراجعة غير موجود';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'الطلب تمت معالجته مسبقاً بحالة %', v_req.status;
  END IF;

  -- معالجة القبول
  IF p_action = 'approve' THEN
    -- تحديث حالة الطلب
    UPDATE public.menu_review_requests
    SET
      status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now()
    WHERE id = p_request_id;

    -- تطبيق السعر الجديد على الصنف
    UPDATE public.menu_items
    SET
      base_price_halalas = v_req.proposed_price_halalas,
      updated_at = now()
    WHERE id = v_req.item_id;

    -- تسجيل في سجل التدقيق
    INSERT INTO public.audit_log (
      table_name, record_id, action, actor_id, old_data, new_data, reason
    ) VALUES (
      'menu_review_requests',
      p_request_id::TEXT,
      'UPDATE',
      auth.uid(),
      jsonb_build_object('status', 'pending', 'old_price', v_req.old_price_halalas),
      jsonb_build_object('status', 'approved', 'new_price', v_req.proposed_price_halalas),
      'اعتماد تعديل سعر الصنف من لوحة الإدارة (MER-002)'
    );

    RETURN jsonb_build_object(
      'success', true,
      'status', 'approved',
      'item_id', v_req.item_id,
      'new_price_halalas', v_req.proposed_price_halalas
    );

  -- معالجة الرفض (مع اشتراط السبب إجبارياً MER-002)
  ELSIF p_action = 'reject' THEN
    IF p_rejection_reason IS NULL OR trim(p_rejection_reason) = '' THEN
      RAISE EXCEPTION 'سبب الرفض إلزامي عند رفض طلب تعديل المنيو (MER-002)';
    END IF;

    -- تحديث حالة الطلب مع حفظ سبب الرفض
    UPDATE public.menu_review_requests
    SET
      status = 'rejected',
      rejection_reason = trim(p_rejection_reason),
      reviewed_by = auth.uid(),
      reviewed_at = now()
    WHERE id = p_request_id;

    -- تسجيل في سجل التدقيق
    INSERT INTO public.audit_log (
      table_name, record_id, action, actor_id, old_data, new_data, reason
    ) VALUES (
      'menu_review_requests',
      p_request_id::TEXT,
      'UPDATE',
      auth.uid(),
      jsonb_build_object('status', 'pending'),
      jsonb_build_object('status', 'rejected', 'rejection_reason', trim(p_rejection_reason)),
      'رفض تعديل سعر الصنف: ' || trim(p_rejection_reason) || ' (MER-002)'
    );

    RETURN jsonb_build_object(
      'success', true,
      'status', 'rejected',
      'rejection_reason', trim(p_rejection_reason)
    );

  ELSE
    RAISE EXCEPTION 'إجراء غير معروف. يجب أن يكون approve أو reject';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. دالة حفظ فرع المتجر جغرافياً
CREATE OR REPLACE FUNCTION public.admin_save_branch(
  p_id UUID,
  p_store_id UUID,
  p_name_ar TEXT,
  p_name_en TEXT,
  p_city_id UUID,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_address_text TEXT,
  p_working_hours JSONB DEFAULT '[]'::jsonb,
  p_default_prep_time_minutes INT DEFAULT 20,
  p_min_order_halalas INT DEFAULT 0,
  p_is_active BOOLEAN DEFAULT false
) RETURNS UUID AS $$
DECLARE
  v_branch_id UUID;
  v_point extensions.geography;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'غير مصرح لك بإدارة الفروع';
  END IF;

  v_point := extensions.ST_SetSRID(extensions.ST_MakePoint(p_longitude, p_latitude), 4326)::extensions.geography;

  IF p_id IS NOT NULL THEN
    UPDATE public.store_branches
    SET
      store_id = p_store_id,
      name_ar = p_name_ar,
      name_en = p_name_en,
      city_id = p_city_id,
      location = v_point,
      address_text = p_address_text,
      working_hours = p_working_hours,
      default_prep_time_minutes = p_default_prep_time_minutes,
      min_order_halalas = p_min_order_halalas,
      is_active = p_is_active,
      updated_at = now()
    WHERE id = p_id
    RETURNING id INTO v_branch_id;
  ELSE
    INSERT INTO public.store_branches (
      store_id, name_ar, name_en, city_id, location, address_text,
      working_hours, default_prep_time_minutes, min_order_halalas, is_active
    ) VALUES (
      p_store_id, p_name_ar, p_name_en, p_city_id, v_point, p_address_text,
      p_working_hours, p_default_prep_time_minutes, p_min_order_halalas, p_is_active
    )
    RETURNING id INTO v_branch_id;
  END IF;

  RETURN v_branch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. دالة جلب فروع المتجر بإحداثياتها
CREATE OR REPLACE FUNCTION public.get_store_branches(p_store_id UUID)
RETURNS TABLE (
  id UUID,
  store_id UUID,
  name_ar TEXT,
  name_en TEXT,
  city_id UUID,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  address_text TEXT,
  working_hours JSONB,
  default_prep_time_minutes INT,
  min_order_halalas INT,
  is_active BOOLEAN,
  paused_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.store_id,
    b.name_ar,
    b.name_en,
    b.city_id,
    extensions.ST_Y(b.location::extensions.geometry) AS latitude,
    extensions.ST_X(b.location::extensions.geometry) AS longitude,
    b.address_text,
    b.working_hours,
    b.default_prep_time_minutes,
    b.min_order_halalas,
    b.is_active,
    b.paused_until,
    b.created_at,
    b.updated_at
  FROM public.store_branches b
  WHERE b.store_id = p_store_id
  ORDER BY b.created_at ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4. دالة إنشاء عقد جديد وتأريخ العقد السابق
CREATE OR REPLACE FUNCTION public.admin_create_store_contract(
  p_store_id UUID,
  p_pricing_model public.contract_pricing_model,
  p_tier1_fee_halalas INT,
  p_tier1_order_threshold_halalas INT,
  p_tier2_fee_halalas INT,
  p_contract_per_customer_cap_halalas INT,
  p_contract_per_customer_period_days INT,
  p_contract_percentage NUMERIC,
  p_menu_markup_percentage NUMERIC,
  p_menu_markup_platform_share_percentage NUMERIC,
  p_payment_gateway_fee_percentage NUMERIC,
  p_payment_gateway_fee_fixed_halalas INT,
  p_mart_pharmacy_merchant_percentage NUMERIC,
  p_mart_pharmacy_customer_markup_percentage NUMERIC,
  p_text_orders_platform_fee_percentage NUMERIC
) RETURNS UUID AS $$
DECLARE
  v_new_contract_id UUID;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR auth.role() = 'service_role') THEN
    RAISE EXCEPTION 'غير مصرح لك بإدارة العقود المالية للمتاجر';
  END IF;

  -- إنهاء صلاحية العقد السابق
  UPDATE public.store_contracts
  SET valid_until = now()
  WHERE store_id = p_store_id AND (valid_until IS NULL OR valid_until > now());

  -- إدراج العقد الجديد
  INSERT INTO public.store_contracts (
    store_id, valid_from, valid_until, pricing_model,
    tier1_fee_halalas, tier1_order_threshold_halalas, tier2_fee_halalas,
    contract_per_customer_cap_halalas, contract_per_customer_period_days,
    contract_percentage, menu_markup_percentage, menu_markup_platform_share_percentage,
    payment_gateway_fee_percentage, payment_gateway_fee_fixed_halalas,
    mart_pharmacy_merchant_percentage, mart_pharmacy_customer_markup_percentage,
    text_orders_platform_fee_percentage
  ) VALUES (
    p_store_id, now(), NULL, p_pricing_model,
    p_tier1_fee_halalas, p_tier1_order_threshold_halalas, p_tier2_fee_halalas,
    p_contract_per_customer_cap_halalas, p_contract_per_customer_period_days,
    p_contract_percentage, p_menu_markup_percentage, p_menu_markup_platform_share_percentage,
    p_payment_gateway_fee_percentage, p_payment_gateway_fee_fixed_halalas,
    p_mart_pharmacy_merchant_percentage, p_mart_pharmacy_customer_markup_percentage,
    p_text_orders_platform_fee_percentage
  ) RETURNING id INTO v_new_contract_id;

  -- تسجيل في سجل التدقيق
  INSERT INTO public.audit_log (
    table_name, record_id, action, actor_id, new_data, reason
  ) VALUES (
    'store_contracts',
    v_new_contract_id::TEXT,
    'INSERT',
    auth.uid(),
    jsonb_build_object('store_id', p_store_id, 'pricing_model', p_pricing_model),
    'إنشاء عقد مالي جديد للمتجر وتأريخ العقد السابق'
  );

  RETURN v_new_contract_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. توسيع سياسات RLS لإدارة الجداول بالكامل
DROP POLICY IF EXISTS "الإدارة تدير المنشآت" ON public.merchants;
CREATE POLICY "الإدارة تدير المنشآت" ON public.merchants FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "الإدارة تدير الفروع" ON public.store_branches;
CREATE POLICY "الإدارة تدير الفروع" ON public.store_branches FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "الإدارة تدير المستندات المرفوعة" ON public.uploaded_documents;
CREATE POLICY "الإدارة تدير المستندات المرفوعة" ON public.uploaded_documents FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "الإدارة تدير طلبات المراجعة" ON public.menu_review_requests;
CREATE POLICY "الإدارة تدير طلبات المراجعة" ON public.menu_review_requests FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "الإدارة تدير مستخدمي التاجر" ON public.merchant_users;
CREATE POLICY "الإدارة تدير مستخدمي التاجر" ON public.merchant_users FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "الجميع يقرأ أسباب الإعفاء" ON public.sfda_exemption_reasons;
CREATE POLICY "الجميع يقرأ أسباب الإعفاء" ON public.sfda_exemption_reasons FOR SELECT USING (true);

DROP POLICY IF EXISTS "الإدارة تدير أسباب الإعفاء" ON public.sfda_exemption_reasons;
CREATE POLICY "الإدارة تدير أسباب الإعفاء" ON public.sfda_exemption_reasons FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "الإدارة تدير أقسام المنيو" ON public.menu_sections;
CREATE POLICY "الإدارة تدير أقسام المنيو" ON public.menu_sections FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "الإدارة تدير أصناف المنيو" ON public.menu_items;
CREATE POLICY "الإدارة تدير أصناف المنيو" ON public.menu_items FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "الإدارة تدير أحجام المنيو" ON public.menu_item_sizes;
CREATE POLICY "الإدارة تدير أحجام المنيو" ON public.menu_item_sizes FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "الإدارة تدير مجموعات خيارات المنيو" ON public.menu_item_option_groups;
CREATE POLICY "الإدارة تدير مجموعات خيارات المنيو" ON public.menu_item_option_groups FOR ALL USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "الإدارة تدير خيارات المنيو" ON public.menu_item_options;
CREATE POLICY "الإدارة تدير خيارات المنيو" ON public.menu_item_options FOR ALL USING (public.is_admin(auth.uid()));

-- 6. البيانات التأسيسية لأسباب إعفاء SFDA وأنواع المستندات
INSERT INTO public.sfda_exemption_reasons (code, reason_ar, reason_en)
VALUES
  ('SFDA-01', 'أطعمة ومشروبات يتم تحضيرها بناءً على طلب خاص ومحدد من العميل', 'Custom orders prepared specifically upon customer request'),
  ('SFDA-02', 'الأصناف المؤقتة أو الموسمية التي تُعرض لمدة تقل عن 30 يوماً', 'Temporary or seasonal items displayed for less than 30 days'),
  ('SFDA-03', 'التوابل والصلصات الجانبية المجانية التي تُقدم بكميات صغيرة', 'Free side condiments and sauces served in small portions'),
  ('SFDA-04', 'عينات التذوق المجانية', 'Free tasting samples')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.document_types (code, name_ar, name_en, applies_to, is_mandatory, requires_expiry_date)
VALUES
  ('cr', 'السجل التجاري', 'Commercial Registration', 'merchant', true, true),
  ('vat', 'شهادة ضريبة القيمة المضافة', 'VAT Certificate', 'merchant', true, false),
  ('baladiya', 'رخصة البلدية', 'Municipal License', 'branch', true, true),
  ('health', 'الشهادات الصحية للعاملين', 'Worker Health Certificates', 'branch', true, true),
  ('civil_defense', 'تصريح الدفاع المدني', 'Civil Defense Permit', 'branch', false, true)
ON CONFLICT (code) DO NOTHING;
