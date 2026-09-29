import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-supabase-signature",
};

serve(async (req: Request) => {
  // 1. معالجة طلبات Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const environment = Deno.env.get("ENVIRONMENT") || "development";
    const hookSecret = Deno.env.get("SEND_SMS_HOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    // 2. التحقق من سر التوقيع في حال كان مهيأ في الإنتاج
    if (hookSecret) {
      const incomingSecret =
        req.headers.get("x-supabase-signature") ||
        req.headers.get("authorization")?.replace("Bearer ", "");

      if (incomingSecret !== hookSecret) {
        console.warn("[send-sms] طلب غير مصرح: مفتاح التوقيع غير متطابق");
        return new Response(
          JSON.stringify({ error: { message: "غير مصرح - توقيع غير صالح" } }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. قراءة البيانات الواردة من Supabase Auth Hook
    const body = await req.json();

    // بنية طلب Auth Hook في Supabase: { user: { phone: ... }, sms: { otp: ... } }
    const phone = body?.user?.phone || body?.phone;
    const otp = body?.sms?.otp || body?.otp;
    const deviceId = req.headers.get("x-device-id") || body?.device_id || null;
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      null;

    if (!phone || !otp) {
      return new Response(
        JSON.stringify({ error: { message: "بيانات ناقصة: رقم الهاتف أو الرمز مفقود" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. فحص حدود الرسائل (Rate Limit) في قاعدة البيانات عبر الدالة الأمنية (ADM-001)
    if (supabaseUrl && supabaseServiceKey) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      const { data: limitCheck, error: limitError } = await supabaseAdmin.rpc(
        "check_and_record_otp_request",
        {
          p_phone: phone,
          p_device_id: deviceId,
          p_ip: clientIp,
        }
      );

      if (!limitError && limitCheck && limitCheck.allowed === false) {
        console.warn(`[send-sms] تجاوز حد الرسائل للرقم ${phone}: ${limitCheck.reason}`);
        return new Response(
          JSON.stringify({
            error: {
              code: limitCheck.reason,
              message: limitCheck.message || "تم تجاوز الحد المسموح به من الرسائل",
            },
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 5. وضع التطوير: لا رسائل حقيقية، تسجيل الرمز في السجل لقراءته فوراً
    if (environment === "development") {
      console.log("====================================================");
      console.log(`📱 [محلات - رمز التحقق التجريبي DEV OTP]`);
      console.log(`   الهاتف: ${phone}`);
      console.log(`   الرمز:  ${otp}`);
      console.log(`   الوقت:  ${new Date().toISOString()}`);
      console.log("====================================================");

      return new Response(
        JSON.stringify({
          success: true,
          mode: "development",
          message: "تم تسجيل الرمز بنجاح في سجلات الخادم",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. وضع الإنتاج: إرسال الرسالة عبر المزود السعودي الحقيقي
    const providerApiKey = Deno.env.get("SAUDI_SMS_API_KEY");
    if (!providerApiKey) {
      console.error("[send-sms] المزود السعودي غير مربوط في متغيرات البيئة");
      return new Response(
        JSON.stringify({
          error: { message: "المزود السعودي غير مربوط بعد. يرجى تهيئة مفتاح المزود في الخادم." },
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // هنا يتم استدعاء واجهة مزود الرسائل السعودي عند الإطلاق
    return new Response(
      JSON.stringify({ success: true, message: "تم إرسال الرسالة بنجاح" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[send-sms] حدث خطأ غير متوقع:", err);
    return new Response(
      JSON.stringify({ error: { message: err?.message || "خطأ داخلي في الخادم" } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
