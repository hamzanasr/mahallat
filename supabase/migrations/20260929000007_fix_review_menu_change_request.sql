-- ==============================================================================
-- الخطوة 1.5: تصحيح أسماء أعمدة سجل التدقيق في دوال مراجعة الأسعار والعقود
-- ==============================================================================

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
