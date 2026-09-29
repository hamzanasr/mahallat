-- Migration: 20260930000008_fix_transition_order_status_calls.sql
-- Description: Correct parameter names for transition_order_status in record_order_payment_authorization and cancel_customer_order

CREATE OR REPLACE FUNCTION public.record_order_payment_authorization(
    p_order_id UUID,
    p_gateway_reference TEXT,
    p_amount_halalas INTEGER,
    p_brand TEXT,
    p_last4 TEXT,
    p_payment_method_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_customer_id UUID;
    v_now TIMESTAMPTZ := now();
    v_free_cancellation_until TIMESTAMPTZ := v_now + INTERVAL '60 seconds';
    v_tx_id UUID;
BEGIN
    v_customer_id := auth.uid();
    IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: User must be authenticated.';
    END IF;

    -- Lock and verify order
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ORDER_NOT_FOUND: Order does not exist.';
    END IF;

    IF v_order.customer_id <> v_customer_id THEN
        RAISE EXCEPTION 'FORBIDDEN: You do not have permission to pay for this order.';
    END IF;

    IF v_order.status <> 'pending_payment' THEN
        -- If already authorized with same reference, return idempotent response
        IF v_order.payment_status = 'authorized' AND v_order.payment_gateway_ref = p_gateway_reference THEN
            RETURN jsonb_build_object(
                'success', true,
                'order_id', v_order.id,
                'status', v_order.status,
                'payment_status', v_order.payment_status,
                'free_cancellation_until', v_order.free_cancellation_until,
                'message', 'Already authorized'
            );
        END IF;
        RAISE EXCEPTION 'INVALID_ORDER_STATE: Order is not awaiting payment (current: %).', v_order.status;
    END IF;

    -- Strict Halalas amount verification against order snapshot (PAY-001)
    IF p_amount_halalas <> v_order.total_halalas THEN
        INSERT INTO public.payment_transactions (
            order_id,
            customer_id,
            transaction_type,
            status,
            amount_halalas,
            gateway,
            gateway_reference,
            error_code,
            error_message,
            metadata
        ) VALUES (
            p_order_id,
            v_customer_id,
            'authorize',
            'failed',
            p_amount_halalas,
            'moyasar',
            p_gateway_reference,
            'AMOUNT_MISMATCH',
            format('Authorized amount (%s) does not match order total (%s)', p_amount_halalas, v_order.total_halalas),
            p_metadata
        );

        RAISE EXCEPTION 'PRICE_MISMATCH: Amount authorized (%) does not match order total (%).',
            p_amount_halalas, v_order.total_halalas;
    END IF;

    -- Record successful authorization in immutable ledger (PAY-005)
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
        p_order_id,
        v_customer_id,
        'authorize',
        'success',
        p_amount_halalas,
        'moyasar',
        p_gateway_reference,
        'authorized',
        p_brand,
        p_last4,
        p_metadata
    ) RETURNING id INTO v_tx_id;

    -- Update order payment state & start 60s cancellation timer (ORD-002)
    UPDATE public.orders
    SET payment_status = 'authorized',
        payment_gateway_ref = p_gateway_reference,
        payment_brand = p_brand,
        payment_last4 = p_last4,
        payment_method_id = p_payment_method_id,
        authorized_at = v_now,
        free_cancellation_until = v_free_cancellation_until,
        updated_at = v_now
    WHERE id = p_order_id;

    -- Advance order status to created (State machine transition: p_new_status, p_reason, p_changed_by_role)
    PERFORM public.transition_order_status(
        p_order_id := p_order_id,
        p_new_status := 'created',
        p_reason := 'Payment authorized successfully via Moyasar',
        p_changed_by_role := 'customer'
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'transaction_id', v_tx_id,
        'status', 'created',
        'payment_status', 'authorized',
        'authorized_at', v_now,
        'free_cancellation_until', v_free_cancellation_until
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
        RAISE EXCEPTION 'AUTH_REQUIRED: User must be authenticated to cancel order.';
    END IF;

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RAISE EXCEPTION 'REASON_REQUIRED: Cancellation reason is mandatory (ORD-004).';
    END IF;

    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ORDER_NOT_FOUND: Order does not exist.';
    END IF;

    IF v_order.customer_id <> v_customer_id THEN
        RAISE EXCEPTION 'FORBIDDEN: You can only cancel your own orders.';
    END IF;

    -- Check if within 60s free cancellation window (ORD-002)
    IF v_order.free_cancellation_until IS NOT NULL AND now() <= v_order.free_cancellation_until THEN
        v_is_within_60s := true;
    END IF;

    -- Check if cancellation is permitted under ORD-004
    -- Permitted: pending_payment, created, scheduled, accepted_by_driver, driver_heading_to_store
    -- Forbidden: preparing and all subsequent states
    IF v_order.status IN ('preparing', 'ready_for_pickup', 'driver_at_store', 'picked_up', 'in_transit', 'arrived', 'delivered', 'completed') THEN
        RAISE EXCEPTION 'CANNOT_CANCEL_AFTER_PREPARATION: Order cannot be cancelled by customer after preparation has started (ORD-004). Current status: %', v_order.status;
    END IF;

    IF v_order.status IN ('cancelled', 'ended_no_response', 'self_pickup_expired', 'returned_to_pharmacy') THEN
        RAISE EXCEPTION 'ORDER_ALREADY_TERMINATED: Order is already in a terminal state (%).', v_order.status;
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
            voided_at = now()
        WHERE id = v_order.id;
    END IF;

    -- Execute status transition to cancelled (p_new_status, p_reason, p_changed_by_role)
    PERFORM public.transition_order_status(
        p_order_id := p_order_id,
        p_new_status := 'cancelled',
        p_reason := p_reason,
        p_changed_by_role := 'customer'
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
