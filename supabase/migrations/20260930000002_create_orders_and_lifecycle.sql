-- =============================================================================
-- Migration: 20260930000002_create_orders_and_lifecycle.sql
-- Step 3.1: إنشاء الطلب ودورة حياته (ORD-001, ORD-002, ORD-004, CUS-010)
-- =============================================================================

-- 1. تعريف إعداد مهلة التراجع في الإعدادات المرنة (ORD-002)
INSERT INTO public.setting_definitions (
  key,
  name_ar,
  description_ar,
  type,
  min_value,
  max_value,
  default_value,
  allowed_levels,
  related_requirements,
  options
) VALUES (
  'order_cooling_off_seconds',
  'مهلة التراجع بعد الدفع',
  'المهلة الزمنية المتاحة للعميل لإلغاء الطلب بلا تكلفة بعد نجاح الحجز بالثواني (ORD-002)',
  'duration_seconds',
  0,
  300,
  '60'::jsonb,
  '{"global"}',
  '{"ORD-002"}',
  NULL
) ON CONFLICT (key) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  description_ar = EXCLUDED.description_ar,
  default_value = EXCLUDED.default_value;

-- 2. متسلسلة ودالة توليد رقم الطلب المقروء للإنسان
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1001;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT AS $$
DECLARE
  v_num BIGINT;
  v_prefix TEXT;
BEGIN
  v_num := nextval('public.order_number_seq');
  v_prefix := 'MHL-' || TO_CHAR(NOW(), 'YYMM') || '-';
  RETURN v_prefix || LPAD(v_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 3. جدول الطلبات الأساسي (orders)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE DEFAULT public.generate_order_number(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.store_branches(id) ON DELETE RESTRICT,
  city_id UUID NOT NULL REFERENCES public.cities(id) ON DELETE RESTRICT,
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('delivery', 'self_pickup')),
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (
    status IN (
      'pending_payment',
      'cooling_off',
      'pending_driver',
      'preparing',
      'ready_for_pickup',
      'picked_up',
      'in_transit',
      'arrived',
      'delivered',
      'completed',
      'cancelled',
      'ended_no_response',
      'returned_to_pharmacy',
      'self_pickup_expired',
      'pending_invoice',
      'pending_invoice_payment'
    )
  ),
  idempotency_key TEXT UNIQUE,
  
  -- المبالغ المالية أعداد صحيحة بالهللة (القاعدة 3)
  items_total_halalas INTEGER NOT NULL CHECK (items_total_halalas >= 0),
  delivery_fee_halalas INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee_halalas >= 0),
  service_fee_halalas INTEGER NOT NULL DEFAULT 0 CHECK (service_fee_halalas >= 0),
  discount_halalas INTEGER NOT NULL DEFAULT 0 CHECK (discount_halalas >= 0),
  tip_halalas INTEGER NOT NULL DEFAULT 0 CHECK (tip_halalas >= 0),
  total_halalas INTEGER NOT NULL CHECK (total_halalas >= 0),
  
  -- تفضيلات العميل وملاحظاته
  customer_notes TEXT,
  out_of_stock_action TEXT NOT NULL DEFAULT 'refund' CHECK (out_of_stock_action IN ('refund', 'contact', 'cancel')),
  
  -- العنوان ولقطة العنوان
  delivery_address_id UUID REFERENCES public.customer_addresses(id) ON DELETE SET NULL,
  delivery_address_snapshot JSONB,
  
  -- لقطة الطلب الثابتة والجامدة (Immutable Snapshot)
  order_snapshot JSONB NOT NULL,
  
  -- أكواد الاستلام والتسليم (ORD-005)
  pickup_code TEXT,
  delivery_code TEXT,
  
  -- بيانات الإلغاء (ORD-004)
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_by_role TEXT CHECK (cancelled_by_role IN ('customer', 'merchant', 'driver', 'operations', 'system')),
  cancelled_at TIMESTAMPTZ,
  
  -- المهل والتوقيتات
  cooling_off_expires_at TIMESTAMPTZ,
  estimated_prep_time_minutes INTEGER NOT NULL DEFAULT 20,
  estimated_delivery_time_minutes INTEGER NOT NULL DEFAULT 25,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON public.orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON public.orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- 4. سجل حالات الطلب غير القابل للتعديل (order_status_history)
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_by_role TEXT NOT NULL DEFAULT 'system' CHECK (changed_by_role IN ('customer', 'merchant', 'driver', 'operations', 'system')),
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);

-- صمام أمان حظر تعديل أو حذف أي سجل حالات نهائياً (ORD-001)
CREATE OR REPLACE FUNCTION public.prevent_order_status_history_tampering()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'سجل حالات الطلب غير قابل للتعديل أو الحذف نهائياً (ORD-001)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_status_history_immutable ON public.order_status_history;
CREATE TRIGGER trg_order_status_history_immutable
BEFORE UPDATE OR DELETE ON public.order_status_history
FOR EACH ROW
EXECUTE FUNCTION public.prevent_order_status_history_tampering();

-- 5. محرك الانتقال بين الحالات (State Machine)
CREATE OR REPLACE FUNCTION public.transition_order_status(
  p_order_id UUID,
  p_new_status TEXT,
  p_reason TEXT DEFAULT NULL,
  p_changed_by_role TEXT DEFAULT 'system',
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS public.orders AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_current_status TEXT;
  v_user_id UUID;
  v_is_valid_transition BOOLEAN := false;
BEGIN
  v_user_id := auth.uid();
  
  -- قفل السطر للتحديث لمنع تضارب الحالات المتزامنة
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;
  
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'الطلب غير موجود: %', p_order_id;
  END IF;
  
  v_current_status := v_order.status;
  
  -- الحالات النهائية لا يعاد فتحها أو الانتقال منها إطلاقاً (ORD-001)
  IF v_current_status IN ('completed', 'cancelled', 'ended_no_response', 'self_pickup_expired', 'returned_to_pharmacy') THEN
    RAISE EXCEPTION 'لا يمكن تغيير حالة طلب في حالة نهائية (ORD-001): الحالة الحالية هي %', v_current_status;
  END IF;
  
  -- التحقق من الانتقالات المسموحة وفق مواصفات رحلة الطلب (04-journey.md)
  CASE v_current_status
    WHEN 'pending_payment' THEN
      IF p_new_status IN ('cooling_off', 'pending_driver', 'preparing', 'cancelled') THEN
        v_is_valid_transition := true;
      END IF;
      
    WHEN 'cooling_off' THEN
      IF p_new_status IN ('pending_driver', 'preparing', 'cancelled') THEN
        v_is_valid_transition := true;
      END IF;
      
    WHEN 'pending_driver' THEN
      IF p_new_status IN ('preparing', 'cancelled', 'self_pickup_expired') THEN
        v_is_valid_transition := true;
      END IF;
      
    WHEN 'preparing' THEN
      IF p_new_status IN ('ready_for_pickup', 'cancelled') THEN
        v_is_valid_transition := true;
      END IF;
      
    WHEN 'ready_for_pickup' THEN
      IF p_new_status IN ('picked_up', 'delivered', 'cancelled', 'self_pickup_expired') THEN
        v_is_valid_transition := true;
      END IF;
      
    WHEN 'picked_up' THEN
      IF p_new_status IN ('in_transit', 'returned_to_pharmacy', 'cancelled') THEN
        v_is_valid_transition := true;
      END IF;
      
    WHEN 'in_transit' THEN
      IF p_new_status IN ('arrived', 'returned_to_pharmacy', 'cancelled') THEN
        v_is_valid_transition := true;
      END IF;
      
    WHEN 'arrived' THEN
      IF p_new_status IN ('delivered', 'ended_no_response', 'returned_to_pharmacy', 'cancelled') THEN
        v_is_valid_transition := true;
      END IF;
      
    WHEN 'delivered' THEN
      IF p_new_status IN ('completed') THEN
        v_is_valid_transition := true;
      END IF;
      
    WHEN 'pending_invoice' THEN
      IF p_new_status IN ('pending_invoice_payment', 'cancelled') THEN
        v_is_valid_transition := true;
      END IF;
      
    WHEN 'pending_invoice_payment' THEN
      IF p_new_status IN ('preparing', 'cancelled') THEN
        v_is_valid_transition := true;
      END IF;
      
    ELSE
      v_is_valid_transition := false;
  END CASE;
  
  -- معيار قبول ORD-001: لا يسجل التسليم قبل الاستلام
  IF p_new_status = 'delivered' AND v_order.delivery_type = 'delivery' AND v_current_status NOT IN ('arrived', 'in_transit') THEN
    RAISE EXCEPTION 'لا يمكن تسجيل التسليم قبل الاستلام والوصول (ORD-001)';
  END IF;

  IF NOT v_is_valid_transition THEN
    RAISE EXCEPTION 'انتقال حالة غير مسموح به (ORD-001): من % إلى %', v_current_status, p_new_status;
  END IF;
  
  -- تحديث حالة الطلب
  UPDATE public.orders
  SET
    status = p_new_status,
    cancellation_reason = CASE WHEN p_new_status = 'cancelled' THEN COALESCE(p_reason, cancellation_reason) ELSE cancellation_reason END,
    cancelled_by = CASE WHEN p_new_status = 'cancelled' THEN COALESCE(v_user_id, cancelled_by) ELSE cancelled_by END,
    cancelled_by_role = CASE WHEN p_new_status = 'cancelled' THEN COALESCE(p_changed_by_role, cancelled_by_role) ELSE cancelled_by_role END,
    cancelled_at = CASE WHEN p_new_status = 'cancelled' THEN COALESCE(now(), cancelled_at) ELSE cancelled_at END,
    updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;
  
  -- تسجيل الانتقال في سجل الحالات المحمي
  INSERT INTO public.order_status_history (
    order_id,
    from_status,
    to_status,
    changed_by,
    changed_by_role,
    reason,
    metadata
  ) VALUES (
    p_order_id,
    v_current_status,
    p_new_status,
    v_user_id,
    p_changed_by_role,
    p_reason,
    p_metadata
  );
  
  RETURN v_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. دالة إلغاء العميل للطلب (ORD-004)
CREATE OR REPLACE FUNCTION public.cancel_customer_order(
  p_order_id UUID,
  p_reason TEXT
) RETURNS JSONB AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_user_id UUID;
  v_user_role TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'يجب تسجيل الدخول لإلغاء الطلب';
  END IF;
  
  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'سبب الإلغاء إلزامي (ORD-004)';
  END IF;
  
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id;
  
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'الطلب غير موجود';
  END IF;
  
  -- التحقق من صلاحية المستخدم (صاحب الطلب أو إداري)
  SELECT role INTO v_user_role FROM public.user_roles WHERE user_id = v_user_id LIMIT 1;
  
  IF v_order.customer_id != v_user_id AND v_user_role NOT IN ('super_admin', 'operations', 'support') THEN
    RAISE EXCEPTION 'غير مصرح لك بإلغاء هذا الطلب';
  END IF;
  
  -- التحقق من مرحلة الإلغاء (ORD-004): العميل يقدر يلغي قبل «جاري التجهيز»
  IF v_user_role IS NULL OR v_user_role NOT IN ('super_admin', 'operations') THEN
    IF v_order.status NOT IN ('pending_payment', 'cooling_off', 'pending_driver') THEN
      RAISE EXCEPTION 'لا يمكن للعميل إلغاء الطلب بعد بدء التجهيز، يرجى التواصل مع الدعم (ORD-004)';
    END IF;
  END IF;
  
  -- تنفيذ الانتقال
  PERFORM public.transition_order_status(
    p_order_id,
    'cancelled',
    p_reason,
    CASE WHEN v_user_role IN ('super_admin', 'operations') THEN 'operations' ELSE 'customer' END
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'status', 'cancelled',
    'message', 'تم إلغاء الطلب بنجاح'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. دالة إنشاء الطلب من العميل (RPC: create_customer_order)
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
    b.address,
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
      'branch_address', v_branch.address
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
      'address', v_branch.address
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

-- 8. سياسات أمان مستوى الصف (RLS Policies)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- العميل يرى طلباته الخاصة فقط
DROP POLICY IF EXISTS orders_customer_select ON public.orders;
CREATE POLICY orders_customer_select ON public.orders
FOR SELECT USING (
  auth.uid() = customer_id
);

-- الإدارة والعمليات والدعم يرون كل الطلبات
DROP POLICY IF EXISTS orders_admin_select ON public.orders;
CREATE POLICY orders_admin_select ON public.orders
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('super_admin', 'operations', 'support', 'finance')
  )
);

-- موظفو التاجر يرون طلبات متجرهم وفروعهم فقط (مع إخفاء اسم ورقم العميل في المواصفات)
DROP POLICY IF EXISTS orders_merchant_select ON public.orders;
CREATE POLICY orders_merchant_select ON public.orders
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.merchant_users mu
    JOIN public.stores s ON s.merchant_id = mu.merchant_id
    WHERE mu.user_id = auth.uid()
      AND s.id = orders.store_id
      AND (mu.branch_id IS NULL OR mu.branch_id = orders.branch_id)
      AND mu.can_manage_orders = true
  )
);

-- سياسات قراءة سجل حالات الطلب
DROP POLICY IF EXISTS order_history_customer_select ON public.order_status_history;
CREATE POLICY order_history_customer_select ON public.order_status_history
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_status_history.order_id
      AND o.customer_id = auth.uid()
  )
);

DROP POLICY IF EXISTS order_history_admin_select ON public.order_status_history;
CREATE POLICY order_history_admin_select ON public.order_status_history
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('super_admin', 'operations', 'support', 'finance')
  )
);

DROP POLICY IF EXISTS order_history_merchant_select ON public.order_status_history;
CREATE POLICY order_history_merchant_select ON public.order_status_history
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.stores s ON s.id = o.store_id
    JOIN public.merchant_users mu ON mu.merchant_id = s.merchant_id
    WHERE o.id = order_status_history.order_id
      AND mu.user_id = auth.uid()
      AND (mu.branch_id IS NULL OR mu.branch_id = o.branch_id)
      AND mu.can_manage_orders = true
  )
);

-- منح الصلاحيات
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.order_status_history TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_order(UUID, TEXT, UUID, DOUBLE PRECISION, DOUBLE PRECISION, JSONB, INTEGER, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_customer_order(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_order_status(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated, service_role;
