-- Migration: 20260930000011_localize_cancel_customer_order_errors.sql
-- Description: Localize cancel_customer_order exceptions to include Arabic per Rule 10 and maintain full test compatibility

CREATE OR REPLACE FUNCTION public.cancel_customer_order(
    p_order_id UUID,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_customer_id UUID;
    v_is_within_60s BOOLEAN := false;
BEGIN
    v_customer_id := auth.uid();
    IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: تسجيل الدخول مطلوب لإلغاء الطلب.';
    END IF;

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RAISE EXCEPTION 'REASON_REQUIRED: سبب الإلغاء إجباري (ORD-004).';
    END IF;

    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ORDER_NOT_FOUND: الطلب غير موجود: %', p_order_id;
    END IF;

    IF v_order.customer_id <> v_customer_id THEN
        RAISE EXCEPTION 'FORBIDDEN: غير مصرح لك بإلغاء هذا الطلب (You can only cancel your own orders).';
    END IF;

    -- Check if within 60s free cancellation window (ORD-002)
    IF v_order.free_cancellation_until IS NOT NULL AND now() <= v_order.free_cancellation_until THEN
        v_is_within_60s := true;
    END IF;

    -- Check if cancellation is permitted under ORD-004
    -- Permitted: pending_payment, cooling_off, pending_driver
    -- Forbidden: preparing and all subsequent states
    IF v_order.status IN ('preparing', 'ready_for_pickup', 'driver_at_store', 'picked_up', 'in_transit', 'arrived', 'delivered', 'completed') THEN
        RAISE EXCEPTION 'CANNOT_CANCEL_AFTER_PREPARATION: لا يمكن للعميل إلغاء الطلب بعد بدء التجهيز، يرجى التواصل مع الدعم (ORD-004). Current status: %', v_order.status;
    END IF;

    IF v_order.status IN ('cancelled', 'ended_no_response', 'self_pickup_expired', 'returned_to_pharmacy') THEN
        RAISE EXCEPTION 'ORDER_ALREADY_TERMINATED: الطلب في حالة نهائية بالفعل: %', v_order.status;
    END IF;

    -- If payment was authorized, record void transaction in ledger (PAY-001, PAY-003)
    IF v_order.payment_status = 'authorized' THEN
        INSERT INTO public.payment_transactions (
            order_id,
            customer_id,
            transaction_type,
            status,
            amount_halalas,
            gateway,
            gateway_reference,
            gateway_status,
            payment_method_brand,
            payment_method_last4,
            metadata
        ) VALUES (
            v_order.id,
            v_customer_id,
            'void',
            'success',
            v_order.total_halalas,
            'moyasar',
            v_order.payment_gateway_ref,
            'voided',
            v_order.payment_brand,
            v_order.payment_last4,
            jsonb_build_object(
                'cancellation_reason', p_reason,
                'within_60s_window', v_is_within_60s
            )
        );

        UPDATE public.orders
        SET payment_status = 'voided',
            voided_at = now(),
            updated_at = now()
        WHERE id = p_order_id;
    END IF;

    -- Transition order to cancelled (ORD-001)
    PERFORM public.transition_order_status(
        p_order_id := p_order_id,
        p_new_status := 'cancelled',
        p_reason := p_reason,
        p_changed_by_role := 'customer',
        p_metadata := jsonb_build_object(
            'cancelled_by', 'customer',
            'within_60s_window', v_is_within_60s
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'status', 'cancelled',
        'payment_status', CASE WHEN v_order.payment_status = 'authorized' THEN 'voided' ELSE v_order.payment_status END,
        'within_60s', v_is_within_60s
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
