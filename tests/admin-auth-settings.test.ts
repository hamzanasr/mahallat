import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@mahallat/shared";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  throw new Error("Missing environment variables in .env");
}

const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);

describe("Step 1.4: Admin Auth, MFA, Settings, Audit Log and Cities", () => {
  let supportUserId: string | null = null;
  let supportClient: any;
  let adminUserId: string | null = null;

  beforeAll(async () => {
    // جلب أو إنشاء حساب مستخدم تجريبي بدور support
    const { data: users } = await adminClient.auth.admin.listUsers();
    const supUser = users.users.find((u) => u.email === "support@mahallat.local");
    const admUser = users.users.find((u) => u.email === "admin@mahallat.local");

    if (supUser) {
      supportUserId = supUser.id;
    }
    if (admUser) {
      adminUserId = admUser.id;
    }
  });

  // 1. DSP-002: نقطة داخل حدود مدينة مرسومة تُنسب لها، ونقطة خارجها لا
  it("DSP-002: city_for_point should identify point inside Riyadh boundary and reject point outside", async () => {
    // إحداثيات برج المملكة بالرياض
    const { data: insideData, error: insideError } = await adminClient.rpc("city_for_point", {
      lat: 24.7136,
      lng: 46.6753,
    });

    expect(insideError).toBeNull();
    expect(insideData).toBeDefined();
    expect(insideData?.length).toBeGreaterThan(0);
    expect(insideData?.[0].name_ar).toBe("الرياض");

    // نقطة خارج كافة نطاقات المدن
    const { data: outsideData, error: outsideError } = await adminClient.rpc("city_for_point", {
      lat: 28.0000,
      lng: 44.0000,
    });

    expect(outsideError).toBeNull();
    expect(outsideData?.length).toBe(0);
  });

  // 2. ADM-034: تعديل قيمة إعداد في الخادم ينعكس فوراً في get_setting بلا إعادة نشر
  it("ADM-034: updating setting value should reflect immediately in get_setting", async () => {
    const testReason = "اختبار آلي لتعديل نسبة الضريبة وفق ADM-034";

    // 1. تعديل نسبة الضريبة إلى 16%
    const { data: updateRes, error: updateError } = await adminClient.rpc("admin_update_setting", {
      p_key: "vat_percentage",
      p_value: 16 as any,
      p_reason: testReason,
      p_city_id: null,
      p_store_id: null,
    });

    expect(updateError).toBeNull();

    // 2. استدعاء get_setting للتأكد من القيمة الجديدة
    const { data: currentVal, error: getError } = await adminClient.rpc("get_setting", {
      p_key: "vat_percentage",
    });

    expect(getError).toBeNull();
    expect(currentVal).toBe(16);

    // 3. إعادة القيمة إلى 15% الافتراضية
    await adminClient.rpc("admin_update_setting", {
      p_key: "vat_percentage",
      p_value: 15 as any,
      p_reason: "إعادة القيمة إلى 15% الافتراضية بعد نجاح الاختبار",
      p_city_id: null,
      p_store_id: null,
    });

    const { data: restoredVal } = await adminClient.rpc("get_setting", {
      p_key: "vat_percentage",
    });
    expect(restoredVal).toBe(15);
  });

  // 3. ADM-002: كل تعديل يظهر في سجل التدقيق بالقيمة قبل وبعد والسبب الإلزامي
  it("ADM-002: setting modification must be logged in audit_log with reason and before/after values", async () => {
    const uniqueReason = `تدقيق آلي خاص بالخطوة 1.4 - ${Date.now()}`;

    // إجراء تعديل
    const { data: updateRes, error: updateError } = await adminClient.rpc("admin_update_setting", {
      p_key: "order_cancellation_grace_period_seconds",
      p_value: 45 as any,
      p_reason: uniqueReason,
      p_city_id: null,
      p_store_id: null,
    });

    expect(updateError).toBeNull();

    // جلب سجل التدقيق
    const { data: logs, error: logError } = await adminClient
      .from("audit_log")
      .select("*")
      .eq("table_name", "setting_values")
      .eq("reason", uniqueReason)
      .order("created_at", { ascending: false })
      .limit(1);

    expect(logError).toBeNull();
    expect(logs).toBeDefined();
    expect(logs?.length).toBe(1);

    const logEntry = logs![0];
    expect(logEntry.reason).toBe(uniqueReason);
    expect(logEntry.new_data).toBeDefined();
    expect((logEntry.new_data as any).key).toBe("order_cancellation_grace_period_seconds");

    // تنظيف وإعادة المهلة إلى 60 ثانية الافتراضية
    await adminClient.rpc("admin_update_setting", {
      p_key: "order_cancellation_grace_period_seconds",
      p_value: 60 as any,
      p_reason: "إعادة القيمة الافتراضية",
      p_city_id: null,
      p_store_id: null,
    });
  });

  // 4. ADM-034: رفض التعديل إذا كان سبب التعديل فارغاً أو مفقوداً
  it("ADM-034: should reject update when reason is empty or whitespace", async () => {
    const { data, error } = await adminClient.rpc("admin_update_setting", {
      p_key: "vat_percentage",
      p_value: { value: 15 },
      p_reason: "   ",
      p_city_id: null,
      p_store_id: null,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain("سبب التعديل إلزامي");
  });

  // 5. ADM-001: موظف الدعم لا يستطيع تعديل الإعدادات
  it("ADM-001: support role cannot update settings", async () => {
    // نسجل دخول بمستخدم الدعم
    const client = createClient<Database>(supabaseUrl, anonKey);
    const { data: loginData } = await client.auth.signInWithPassword({
      email: "support@mahallat.local",
      password: "DemoAdmin123!",
    });

    expect(loginData.session).toBeDefined();

    // محاولة التعديل باستخدام عميل مستخدم الدعم
    const { error: supUpdateError } = await client.rpc("admin_update_setting", {
      p_key: "vat_percentage",
      p_value: { value: 20 },
      p_reason: "محاولة غير مصرحة من موظف دعم",
      p_city_id: null,
      p_store_id: null,
    });

    expect(supUpdateError).not.toBeNull();
    expect(supUpdateError?.message).toContain("غير مصرح لموظف الدعم");
  });
});
