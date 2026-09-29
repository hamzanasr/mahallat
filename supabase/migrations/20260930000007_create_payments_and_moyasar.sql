-- Migration: 20260930000007_create_payments_and_moyasar.sql
-- Description: Customer payment methods, payment transactions (audit-safe), orders payment fields, 60s cancellation, and Moyasar integration primitives

-- 1. Create customer_payment_methods table (saved tokens only, no sensitive PAN/CVV stored)
CREATE TABLE IF NOT EXISTS public.customer_payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    moyasar_token_id TEXT NOT NULL,
    brand TEXT NOT NULL CHECK (brand IN ('mada', 'visa', 'mastercard', 'amex', 'applepay')),
    last4 TEXT NOT NULL CHECK (length(last4) = 4),
    exp_month INTEGER NOT NULL CHECK (exp_month BETWEEN 1 AND 12),
    exp_year INTEGER NOT NULL CHECK (exp_year >= 2024),
    cardholder_name TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_customer_moyasar_token UNIQUE (customer_id, moyasar_token_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_payment_methods_customer_id
    ON public.customer_payment_methods(customer_id);

-- Trigger to maintain a single default payment method per customer
CREATE OR REPLACE FUNCTION public.handle_single_default_payment_method()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default THEN
        UPDATE public.customer_payment_methods
        SET is_default = false, updated_at = now()
        WHERE customer_id = NEW.customer_id
          AND id <> NEW.id
          AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_single_default_payment_method ON public.customer_payment_methods;
CREATE TRIGGER trg_single_default_payment_method
    BEFORE INSERT OR UPDATE OF is_default
    ON public.customer_payment_methods
    FOR EACH ROW
    WHEN (NEW.is_default = true)
    EXECUTE FUNCTION public.handle_single_default_payment_method();

-- Enable RLS on customer_payment_methods
ALTER TABLE public.customer_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_payment_methods_select
    ON public.customer_payment_methods
    FOR SELECT
    USING (customer_id = auth.uid());

CREATE POLICY customer_payment_methods_insert
    ON public.customer_payment_methods
    FOR INSERT
    WITH CHECK (customer_id = auth.uid());

CREATE POLICY customer_payment_methods_update
    ON public.customer_payment_methods
    FOR UPDATE
    USING (customer_id = auth.uid())
    WITH CHECK (customer_id = auth.uid());

CREATE POLICY customer_payment_methods_delete
    ON public.customer_payment_methods
    FOR DELETE
    USING (customer_id = auth.uid());

-- 2. Add payment fields to orders table
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
        CHECK (payment_status IN ('unpaid', 'authorized', 'captured', 'voided', 'refunded', 'failed')),
    ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES public.customer_payment_methods(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS payment_gateway_ref TEXT,
    ADD COLUMN IF NOT EXISTS payment_brand TEXT,
    ADD COLUMN IF NOT EXISTS payment_last4 TEXT,
    ADD COLUMN IF NOT EXISTS authorized_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS free_cancellation_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_gateway_ref ON public.orders(payment_gateway_ref);

-- 3. Create payment_transactions table (Strictly Immutable audit log for financial operations)
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('authorize', 'capture', 'void', 'refund')),
    status TEXT NOT NULL CHECK (status IN ('initiated', 'success', 'failed')),
    amount_halalas INTEGER NOT NULL CHECK (amount_halalas >= 0),
    gateway TEXT NOT NULL DEFAULT 'moyasar',
    gateway_reference TEXT,
    gateway_status TEXT,
    payment_method_brand TEXT,
    payment_method_last4 TEXT,
    error_code TEXT,
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_customer_id ON public.payment_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_gateway_ref ON public.payment_transactions(gateway_reference);

-- Financial audit trigger: Strictly forbid UPDATE or DELETE on payment_transactions
CREATE OR REPLACE FUNCTION public.prevent_payment_transactions_tampering()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'PAY-005: Modification or deletion of payment transactions is strictly forbidden. Financial records are immutable.'
        USING ERRCODE = '23505';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_payment_transactions_tampering ON public.payment_transactions;
CREATE TRIGGER trg_prevent_payment_transactions_tampering
    BEFORE UPDATE OR DELETE ON public.payment_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_payment_transactions_tampering();

-- Enable RLS on payment_transactions
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_transactions_select
    ON public.payment_transactions
    FOR SELECT
    USING (
        customer_id = auth.uid()
        OR public.is_admin(auth.uid())
    );

-- 4. RPC: Save customer payment method
CREATE OR REPLACE FUNCTION public.save_customer_payment_method(
    p_moyasar_token_id TEXT,
    p_brand TEXT,
    p_last4 TEXT,
    p_exp_month INTEGER,
    p_exp_year INTEGER,
    p_cardholder_name TEXT DEFAULT NULL,
    p_is_default BOOLEAN DEFAULT false
)
RETURNS UUID AS $$
DECLARE
    v_customer_id UUID;
    v_has_other_cards BOOLEAN;
    v_method_id UUID;
    v_should_be_default BOOLEAN;
BEGIN
    v_customer_id := auth.uid();
    IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: User must be authenticated to save payment method.';
    END IF;

    -- If this is the customer's first card, make it default automatically (PAY-023)
    SELECT EXISTS (
        SELECT 1 FROM public.customer_payment_methods WHERE customer_id = v_customer_id
    ) INTO v_has_other_cards;

    v_should_be_default := p_is_default OR NOT v_has_other_cards;

    INSERT INTO public.customer_payment_methods (
        customer_id,
        moyasar_token_id,
        brand,
        last4,
        exp_month,
        exp_year,
        cardholder_name,
        is_default
    ) VALUES (
        v_customer_id,
        p_moyasar_token_id,
        p_brand,
        p_last4,
        p_exp_month,
        p_exp_year,
        p_cardholder_name,
        v_should_be_default
    )
    ON CONFLICT (customer_id, moyasar_token_id)
    DO UPDATE SET
        exp_month = EXCLUDED.exp_month,
        exp_year = EXCLUDED.exp_year,
        cardholder_name = COALESCE(EXCLUDED.cardholder_name, public.customer_payment_methods.cardholder_name),
        is_default = CASE WHEN v_should_be_default THEN true ELSE public.customer_payment_methods.is_default END,
        updated_at = now()
    RETURNING id INTO v_method_id;

    RETURN v_method_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: Delete customer payment method
CREATE OR REPLACE FUNCTION public.delete_customer_payment_method(
    p_payment_method_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_customer_id UUID;
    v_was_default BOOLEAN;
BEGIN
    v_customer_id := auth.uid();
    IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: User must be authenticated.';
    END IF;

    SELECT is_default INTO v_was_default
    FROM public.customer_payment_methods
    WHERE id = p_payment_method_id AND customer_id = v_customer_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'NOT_FOUND: Payment method not found or access denied.';
    END IF;

    DELETE FROM public.customer_payment_methods
    WHERE id = p_payment_method_id AND customer_id = v_customer_id;

    -- If we deleted the default card, set another card as default if available
    IF v_was_default THEN
        UPDATE public.customer_payment_methods
        SET is_default = true, updated_at = now()
        WHERE id = (
            SELECT id FROM public.customer_payment_methods
            WHERE customer_id = v_customer_id
            ORDER BY created_at DESC
            LIMIT 1
        );
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: Record order payment authorization and activate 60s window (ORD-002, PAY-001)
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

    -- Advance order status to created (State machine transition)
    PERFORM public.transition_order_status(
        p_order_id := p_order_id,
        p_to_status := 'created',
        p_actor_type := 'customer',
        p_actor_id := v_customer_id,
        p_reason := 'Payment authorized successfully via Moyasar'
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

-- 7. Update cancel_customer_order to handle payment voiding (ORD-002, ORD-004, PAY-001)
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

    -- Execute status transition to cancelled
    PERFORM public.transition_order_status(
        p_order_id := p_order_id,
        p_to_status := 'cancelled',
        p_actor_type := 'customer',
        p_actor_id := v_customer_id,
        p_reason := p_reason
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
