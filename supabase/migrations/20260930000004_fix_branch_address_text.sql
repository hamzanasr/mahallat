-- =============================================================================
-- Migration: 20260930000004_fix_branch_address_text.sql
-- Fix address_text column name in create_customer_order RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_customer_order(
  p_branch_id UUID,
  p_delivery_type TEXT,
  p_address_id UUID DEFAULT NULL,
  p_customer_lat DOUBLE PRECISION DEFAULT NULL,
  p_customer_lng DOUBLE PRECISION DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_expected_total_halalas INTEGER DEFAULT NULL,
  p_customer_notes TEXT DEFAULT NULL,
  p_out_of_stock_action TEXT DEFAULT 'refund',
  p_idempotency_key TEXT DEFAULT NULL,
  p_tip_halalas INTEGER DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
  v_customer_id UUID;
  v_branch RECORD;
  v_store RECORD;
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
  v_addr RECORD;
  v_addr_snapshot JSONB := NULL;
  v_quote JSONB;
  v_products_total INT;
  v_delivery_fee INT := 0;
  v_service_fee INT := 0;
  v_discount INT := 0;
  v_tip INT := 0;
  v_total INT := 0;
  v_pickup_code TEXT;
  v_delivery_code TEXT;
  v_order_number TEXT;
  v_order_id UUID;
  v_snapshot JSONB;
  v_cooling_seconds INT;
  v_cooling_expires TIMESTAMPTZ;
  v_existing_order public.orders%ROWTYPE;
BEGIN
  -- أ) التحقق من هوية العميل
  v_customer_id := auth.uid();
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول لإنشاء الطلب';
  END IF;
  
  -- ب) التحقق من مفتاح منع التكرار (Idempotency)
  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) != '' THEN
    SELECT * INTO v_existing_order
    FROM public.orders
    WHERE idempotency_key = p_idempotency_key
      AND customer_id = v_customer_id;
      
    IF v_existing_order.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'order_id', v_existing_order.id,
        'order_number', v_existing_order.order_number,
        'status', v_existing_order.status,
        'total_halalas', v_existing_order.total_halalas,
        'is_replay', true
      );
    END IF;
  END IF;
  
  -- ج) التحقق من نوع الاستلام
  IF p_delivery_type NOT IN ('delivery', 'self_pickup') THEN
    RAISE EXCEPTION 'نوع التوصيل غير صالح: %', p_delivery_type;
  END IF;
  
  -- د) التحقق من الفرع والمتجر
  SELECT
    b.id,
    b.store_id,
    b.name_ar,
    b.name_en,
    b.address_text,
    b.is_active,
    b.paused_until,
    b.default_prep_time_minutes,
    b.location
  INTO v_branch
  FROM public.store_branches b
  WHERE b.id = p_branch_id;
  
  IF v_branch.id IS NULL THEN
    RAISE EXCEPTION 'الفرع المحدد غير موجود';
  END IF;
  
  IF NOT v_branch.is_active THEN
    RAISE EXCEPTION 'الفرع غير مفعّل حالياً لاستقبال الطلبات';
  END IF;
  
  IF v_branch.paused_until IS NOT NULL AND v_branch.paused_until > now() THEN
    RAISE EXCEPTION 'الفرع موقف مؤقتاً ولا يستقبل طلبات جديدة حالياً';
  END IF;
  
  SELECT * INTO v_store FROM public.stores WHERE id = v_branch.store_id;
  
  -- هـ) التحقق من العنوان وموقعه الجغرافي
  IF p_delivery_type = 'delivery' THEN
    IF p_address_id IS NOT NULL THEN
      SELECT * INTO v_addr
      FROM public.customer_addresses
      WHERE id = p_address_id AND customer_id = v_customer_id;
      
      IF v_addr.id IS NULL THEN
        RAISE EXCEPTION 'العنوان المحدد غير موجود أو لا يخص هذا الحساب';
      END IF;
      
      v_lat := extensions.ST_Y(v_addr.location::extensions.geometry);
      v_lng := extensions.ST_X(v_addr.location::extensions.geometry);
      
      v_addr_snapshot := jsonb_build_object(
        'id', v_addr.id,
        'title', v_addr.name,
        'short_address', v_addr.short_national_address,
        'lat', v_lat,
        'lng', v_lng,
        'district_name', v_addr.district_name,
        'street_name', v_addr.street_name,
        'building', v_addr.building,
        'floor', v_addr.floor,
        'apartment', v_addr.apartment,
        'entry_instructions', v_addr.entry_instructions,
        'pin_confirmed_at', v_addr.pin_confirmed_at
      );
    ELSE
      IF p_customer_lat IS NULL OR p_customer_lng IS NULL THEN
        RAISE EXCEPTION 'يجب تحديد عنوان التوصيل أو الإحداثيات للطلب';
      END IF;
      v_lat := p_customer_lat;
      v_lng := p_customer_lng;
      v_addr_snapshot := jsonb_build_object('lat', v_lat, 'lng', v_lng);
    END IF;
  ELSE
    -- استلام ذاتي: استخدام إحداثيات الفرع
    v_lat := extensions.ST_Y(v_branch.location::extensions.geometry);
    v_lng := extensions.ST_X(v_branch.location::extensions.geometry);
    v_addr_snapshot := jsonb_build_object(
      'delivery_type', 'self_pickup',
      'branch_id', v_branch.id,
      'branch_name', v_branch.name_ar,
      'branch_address', v_branch.address_text
    );
  END IF;
  
  -- و) إعادة تسعير السلة على الخادم حصراً (Server-side re-quoting via quote_cart)
  v_quote := public.quote_cart(
    v_store.id,
    v_lat,
    v_lng,
    p_items,
    p_customer_lat,
    p_customer_lng
  );
  
  IF NOT (v_quote->>'success')::BOOLEAN THEN
    RAISE EXCEPTION '%', COALESCE(v_quote->'errors'->0->>'message', v_quote->>'error', 'تعذر إتمام تسعير السلة');
  END IF;
  
  -- ز) التحقق من الحد الأدنى للطلب
  IF NOT (v_quote->>'min_order_reached')::BOOLEAN THEN
    RAISE EXCEPTION 'قيمة المنتجات أقل من الحد الأدنى للطلب (% ر.س)', ((v_quote->>'min_order_halalas')::INT / 100.0);
  END IF;
  
  -- ح) احتساب المبالغ المالية بدقة بالهللة
  v_products_total := (v_quote->>'products_total_halalas')::INT;
  v_service_fee := (v_quote->>'service_fee_halalas')::INT;
  v_tip := GREATEST(0, COALESCE(p_tip_halalas, 0));
  
  IF p_delivery_type = 'self_pickup' THEN
    v_delivery_fee := 0;
    IF v_store.self_pickup_discount_percentage > 0 THEN
      v_discount := ROUND(v_products_total * (v_store.self_pickup_discount_percentage / 100.0));
    ELSE
      v_discount := 0;
    END IF;
    v_total := v_products_total - v_discount + v_service_fee + v_tip;
  ELSE
    v_delivery_fee := (v_quote->>'delivery_fee_halalas')::INT;
    v_discount := 0;
    v_total := v_products_total + v_delivery_fee + v_service_fee + v_tip;
  END IF;
  
  -- ط) فحص تفاوت السعر مع المتوقع من العميل (Price Mismatch Protection)
  IF p_expected_total_halalas IS NOT NULL AND p_expected_total_halalas != v_total THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'PRICE_MISMATCH',
      'message', 'لقد تغيّرت الأسعار أو الرسوم. يرجى مراجعة ملخص السلة المحدّث وتأكيد الطلب.',
      'expected_total_halalas', p_expected_total_halalas,
      'new_total_halalas', v_total,
      'quote', v_quote
    );
  END IF;
  
  -- ي) توليد رقم الطلب وأكواد الاستلام والتسليم
  v_order_number := public.generate_order_number();
  v_pickup_code := LPAD(FLOOR(random() * 9000 + 1000)::TEXT, 4, '0');
  v_delivery_code := LPAD(FLOOR(random() * 9000 + 1000)::TEXT, 4, '0');
  
  -- ك) حفظ لقطة الطلب الثابتة والجامدة (Immutable Snapshot)
  v_snapshot := jsonb_build_object(
    'order_number', v_order_number,
    'store', jsonb_build_object(
      'id', v_store.id,
      'name_ar', v_store.name_ar,
      'name_en', v_store.name_en,
      'store_type', v_store.store_type,
      'operation_type', v_store.operation_type
    ),
    'branch', jsonb_build_object(
      'id', v_branch.id,
      'name_ar', v_branch.name_ar,
      'name_en', v_branch.name_en,
      'address', v_branch.address_text
    ),
    'items', v_quote->'lines',
    'financials', jsonb_build_object(
      'items_total_halalas', v_products_total,
      'delivery_fee_halalas', v_delivery_fee,
      'service_fee_halalas', v_service_fee,
      'discount_halalas', v_discount,
      'tip_halalas', v_tip,
      'total_halalas', v_total
    ),
    'pricing_snapshot', v_quote->'pricing_snapshot',
    'time_estimate', v_quote->'time_estimate',
    'frozen_at', now()
  );
  
  -- ل) احتساب مهلة التراجع بعد الدفع
  v_cooling_seconds := COALESCE((public.get_setting('order_cooling_off_seconds')#>>'{}')::INT, 60);
  v_cooling_expires := now() + (v_cooling_seconds || ' seconds')::INTERVAL;
  
  -- م) إدراج الطلب بحالة بانتظار الدفع (pending_payment)
  INSERT INTO public.orders (
    order_number,
    customer_id,
    store_id,
    branch_id,
    city_id,
    delivery_type,
    status,
    idempotency_key,
    items_total_halalas,
    delivery_fee_halalas,
    service_fee_halalas,
    discount_halalas,
    tip_halalas,
    total_halalas,
    customer_notes,
    out_of_stock_action,
    delivery_address_id,
    delivery_address_snapshot,
    order_snapshot,
    pickup_code,
    delivery_code,
    cooling_off_expires_at,
    estimated_prep_time_minutes,
    estimated_delivery_time_minutes
  ) VALUES (
    v_order_number,
    v_customer_id,
    v_store.id,
    v_branch.id,
    v_store.city_id,
    p_delivery_type,
    'pending_payment',
    p_idempotency_key,
    v_products_total,
    v_delivery_fee,
    v_service_fee,
    v_discount,
    v_tip,
    v_total,
    p_customer_notes,
    p_out_of_stock_action,
    p_address_id,
    v_addr_snapshot,
    v_snapshot,
    v_pickup_code,
    v_delivery_code,
    v_cooling_expires,
    COALESCE(v_branch.default_prep_time_minutes, 20),
    25
  ) RETURNING id INTO v_order_id;
  
  -- ن) تسجيل الحالة الابتدائية في سجل الحالات
  INSERT INTO public.order_status_history (
    order_id,
    from_status,
    to_status,
    changed_by,
    changed_by_role,
    reason,
    metadata
  ) VALUES (
    v_order_id,
    NULL,
    'pending_payment',
    v_customer_id,
    'customer',
    'إنشاء الطلب من تطبيق العميل',
    jsonb_build_object('total_halalas', v_total, 'order_number', v_order_number)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'order_number', v_order_number,
    'status', 'pending_payment',
    'total_halalas', v_total,
    'items_total_halalas', v_products_total,
    'delivery_fee_halalas', v_delivery_fee,
    'service_fee_halalas', v_service_fee,
    'discount_halalas', v_discount,
    'tip_halalas', v_tip,
    'pickup_code', v_pickup_code,
    'delivery_code', v_delivery_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
