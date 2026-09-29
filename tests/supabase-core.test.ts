import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@mahallat/shared";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  throw new Error("Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_ANON_KEY in environment");
}

const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);
const anonClient = createClient<Database>(supabaseUrl, anonKey);

describe("Supabase Core Foundation (Step 1.2)", () => {
  let testCityId: string | null = null;
  const testStoreId = "00000000-0000-0000-0000-000000000001";
  const otherCityId = "00000000-0000-0000-0000-000000000002";

  beforeAll(async () => {
    // إنشاء مدينة تجريبية بحدود مضلعة حول الرياض (lat: 24.60..24.80, lng: 46.60..46.80)
    const { data, error } = await adminClient
      .from("cities")
      .insert({
        name_ar: "مدينة تجريبية",
        name_en: "Test City",
        boundary: "SRID=4326;MULTIPOLYGON(((46.60 24.60, 46.80 24.60, 46.80 24.80, 46.60 24.80, 46.60 24.60)))",
        is_active: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Failed to create test city:", error);
    } else {
      testCityId = data.id;
    }
  });

  afterAll(async () => {
    // تنظيف ما تم إنشاؤه
    if (testCityId) {
      await adminClient.from("setting_values").delete().eq("entity_id", testCityId);
      await adminClient.from("cities").delete().eq("id", testCityId);
    }
    await adminClient.from("setting_values").delete().eq("entity_id", testStoreId);
  });

  it("1. get_setting should return default value when no custom value is set", async () => {
    const { data, error } = await adminClient.rpc("get_setting", {
      p_key: "order_cancellation_grace_period_seconds",
    });

    expect(error).toBeNull();
    expect(data).toBe(60);
  });

  it("2. get_setting should respect hierarchy: City value overrides Default", async () => {
    expect(testCityId).toBeDefined();

    // إدخال قيمة مخصصة لإعداد يسمح بمستوى المدينة مثل referral_reward_credit_halalas
    const customCityValue = 2500;
    const { error: insertErr } = await adminClient.from("setting_values").insert({
      key: "referral_reward_credit_halalas",
      level: "city",
      entity_id: testCityId,
      value: customCityValue,
    });
    expect(insertErr).toBeNull();

    // طلب الإعداد لهذه المدينة
    const { data: cityVal } = await adminClient.rpc("get_setting", {
      p_key: "referral_reward_credit_halalas",
      p_city_id: testCityId!,
    });
    expect(cityVal).toBe(customCityValue);

    // طلب الإعداد لمدينة أخرى يرجع الافتراضي (1000)
    const { data: otherCityVal } = await adminClient.rpc("get_setting", {
      p_key: "referral_reward_credit_halalas",
      p_city_id: otherCityId,
    });
    expect(otherCityVal).toBe(1000);
  });

  it("3. get_setting should respect hierarchy: Store value overrides City and Default", async () => {
    // إدخال قيمة للمتجر لإعداد يسمح بالمتجر والمدينة مثل delivery_base_fee_halalas (الافتراضي 1200)
    const storeFee = 1800;
    const { error: storeErr } = await adminClient.from("setting_values").insert({
      key: "delivery_base_fee_halalas",
      level: "store",
      entity_id: testStoreId,
      value: storeFee,
    });
    expect(storeErr).toBeNull();

    // طلب الإعداد بالمتجر والمدينة معاً؛ يجب أن يعود بقيمة المتجر
    const { data: result } = await adminClient.rpc("get_setting", {
      p_key: "delivery_base_fee_halalas",
      p_city_id: testCityId!,
      p_store_id: testStoreId,
    });
    expect(result).toBe(storeFee);
  });

  it("4. Values outside min/max bounds should be rejected by database trigger", async () => {
    // order_cancellation_grace_period_seconds max is 300
    const { error } = await adminClient.from("setting_values").insert({
      key: "order_cancellation_grace_period_seconds",
      level: "global",
      entity_id: null,
      value: 9999, // خارج الحد الأعلى المسموح (300)
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain("أكبر من الحد الأعلى");
  });

  it("5. Modifying a setting_value should record an entry in audit_log", async () => {
    // تحديث قيمة إعداد المتجر
    const updatedStoreFee = 1900;
    const { error: updateErr } = await adminClient
      .from("setting_values")
      .update({ value: updatedStoreFee })
      .eq("key", "delivery_base_fee_halalas")
      .eq("level", "store")
      .eq("entity_id", testStoreId);

    expect(updateErr).toBeNull();

    // التحقق من وجود سجل في audit_log
    const { data: auditEntries, error: auditErr } = await adminClient
      .from("audit_log")
      .select("*")
      .eq("table_name", "setting_values")
      .order("created_at", { ascending: false })
      .limit(1);

    expect(auditErr).toBeNull();
    expect(auditEntries?.length).toBeGreaterThan(0);
    expect(auditEntries![0].action).toBe("UPDATE");
  });

  it("6. Deleting from audit_log should be strictly rejected (ADM-002)", async () => {
    const { data: entries } = await adminClient
      .from("audit_log")
      .select("id")
      .limit(1);

    if (entries && entries.length > 0) {
      const { error } = await adminClient
        .from("audit_log")
        .delete()
        .eq("id", entries[0].id);

      expect(error).not.toBeNull();
      expect(error?.message).toContain("سجل التدقيق غير قابل للتعديل أو الحذف إطلاقاً");
    }
  });

  it("7. Non-admin user (anonClient) should NOT read audit_log or setting_definitions (RLS)", async () => {
    const { data: auditData, error: auditErr } = await anonClient
      .from("audit_log")
      .select("*");

    // إما فارغ بسبب RLS أو خطأ صلاحية
    expect(auditData === null || auditData.length === 0).toBe(true);

    const { data: settingsData } = await anonClient
      .from("setting_definitions")
      .select("*");

    expect(settingsData === null || settingsData.length === 0).toBe(true);
  });

  it("8. city_for_point should return correct city for coordinates inside, and empty for outside", async () => {
    expect(testCityId).toBeDefined();

    // نقطة داخل مضلع المدينة التجريبية (lat: 24.71, lng: 46.67)
    const { data: insideData, error: insideErr } = await adminClient.rpc("city_for_point", {
      lat: 24.71,
      lng: 46.67,
    });

    expect(insideErr).toBeNull();
    expect(insideData?.length).toBe(1);
    expect(insideData![0].id).toBe(testCityId);

    // نقطة خارج المضلع
    const { data: outsideData, error: outsideErr } = await adminClient.rpc("city_for_point", {
      lat: 10.0,
      lng: 10.0,
    });

    expect(outsideErr).toBeNull();
    expect(outsideData?.length).toBe(0);
  });
});
