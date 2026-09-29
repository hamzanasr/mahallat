import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PaymentRequestBody {
  action: "authorize" | "void" | "capture" | "refund";
  order_id: string;
  amount_halalas?: number;
  source?: {
    type: "token" | "creditcard";
    token?: string;
    number?: string;
    name?: string;
    month?: string | number;
    year?: string | number;
    cvc?: string;
  };
  callback_url?: string;
  reason?: string;
  payment_method_id?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticated Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Verify user JWT from request
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: Invalid user session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: PaymentRequestBody = await req.json().catch(() => ({ action: "authorize", order_id: "" }));
    const { action, order_id, amount_halalas, source, callback_url, reason, payment_method_id } = body;

    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required parameter: order_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch order details
    const { data: order, error: orderFetchError } = await supabase
      .from("orders")
      .select("*, customer_addresses(*)")
      .eq("id", order_id)
      .single();

    if (orderFetchError || !order) {
      return new Response(
        JSON.stringify({ success: false, error: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (order.customer_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden: You do not own this order" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const moyasarSecretKey = Deno.env.get("MOYASAR_SECRET_KEY") || "";

    // ==========================================
    // ACTION: AUTHORIZE (PAY-001, ORD-002)
    // ==========================================
    if (action === "authorize") {
      const orderTotal = order.total_halalas;
      if (amount_halalas && amount_halalas !== orderTotal) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `PRICE_MISMATCH: Provided amount (${amount_halalas}) does not match order total (${orderTotal})`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let moyasarPaymentId = "";
      let cardBrand = "mada";
      let cardLast4 = "1111";
      let gatewayStatus = "authorized";

      if (moyasarSecretKey) {
        // Live Moyasar Sandbox/Production API Call
        const moyasarPayload: Record<string, unknown> = {
          amount: orderTotal,
          currency: "SAR",
          description: `Order ${order.order_number}`,
          manual: true, // Authorization hold, not capture
          callback_url: callback_url || "https://mahallat.app/payment/callback",
          source: source?.type === "token"
            ? { type: "token", token: source.token }
            : {
                type: "creditcard",
                number: source?.number,
                name: source?.name,
                month: source?.month,
                year: source?.year,
                cvc: source?.cvc,
              },
          metadata: {
            order_id: order.id,
            order_number: order.order_number,
            customer_id: user.id,
          },
        };

        const moyasarRes = await fetch("https://api.moyasar.com/v1/payments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${btoa(moyasarSecretKey + ":")}`,
          },
          body: JSON.stringify(moyasarPayload),
        });

        const moyasarData = await moyasarRes.json();

        if (!moyasarRes.ok || moyasarData.status === "failed") {
          return new Response(
            JSON.stringify({
              success: false,
              error: moyasarData.message || "فشلت عملية الدفع من خلال ميسر",
              details: moyasarData,
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        moyasarPaymentId = moyasarData.id;
        gatewayStatus = moyasarData.status;
        cardBrand = moyasarData.source?.company || (moyasarData.source?.type === "mada" ? "mada" : "visa");
        cardLast4 = (moyasarData.source?.number || "").slice(-4) || "0000";

        // If 3D Secure verification is required by Moyasar
        if (moyasarData.status === "initiated" && moyasarData.source?.transaction_url) {
          return new Response(
            JSON.stringify({
              success: true,
              requires_3ds: true,
              transaction_url: moyasarData.source.transaction_url,
              payment_id: moyasarPaymentId,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        // Test Simulation Mode (when MOYASAR_SECRET_KEY is pending in development)
        moyasarPaymentId = `pay_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        if (source?.number) {
          const cleanNum = source.number.replace(/\s+/g, "");
          if (cleanNum.startsWith("588848") || cleanNum.startsWith("4")) {
            cardBrand = cleanNum.startsWith("588848") ? "mada" : "visa";
          } else {
            cardBrand = "mastercard";
          }
          cardLast4 = cleanNum.slice(-4) || "1111";
        }
      }

      // Record Authorization in Postgres via atomic function
      const { data: authRecordResult, error: recordError } = await supabase.rpc(
        "record_order_payment_authorization",
        {
          p_order_id: order.id,
          p_gateway_reference: moyasarPaymentId,
          p_amount_halalas: orderTotal,
          p_brand: cardBrand,
          p_last4: cardLast4,
          p_payment_method_id: payment_method_id || null,
          p_metadata: { gateway: "moyasar", mode: moyasarSecretKey ? "live" : "simulation" },
        }
      );

      if (recordError) {
        return new Response(
          JSON.stringify({ success: false, error: recordError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          order_id: order.id,
          payment_id: moyasarPaymentId,
          brand: cardBrand,
          last4: cardLast4,
          status: "authorized",
          order_status: "created",
          data: authRecordResult,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==========================================
    // ACTION: VOID (ORD-002, ORD-004, PAY-003)
    // ==========================================
    if (action === "void") {
      const cancelReason = reason || "إلغاء الطلب من قبل العميل";

      if (moyasarSecretKey && order.payment_gateway_ref) {
        try {
          await fetch(`https://api.moyasar.com/v1/payments/${order.payment_gateway_ref}/void`, {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(moyasarSecretKey + ":")}`,
            },
          });
        } catch (mErr) {
          console.error("Moyasar void call failed:", mErr);
        }
      }

      // Call cancel_customer_order RPC which voids the payment in DB ledger
      const { data: cancelResult, error: cancelError } = await supabase.rpc(
        "cancel_customer_order",
        {
          p_order_id: order.id,
          p_reason: cancelReason,
        }
      );

      if (cancelError) {
        return new Response(
          JSON.stringify({ success: false, error: cancelError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          order_id: order.id,
          status: "cancelled",
          payment_status: "voided",
          data: cancelResult,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Unsupported action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const error = err as Error;
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
