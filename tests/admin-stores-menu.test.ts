import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@mahallat/shared";

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.SUPABASE_ANON_KEY!;

const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);
const anonClient = createClient<Database>(supabaseUrl, anonKey);

describe("Admin Stores & Menu Review (Step 1.5)", () => {
  let cityId: string;
  let merchantId: string;
  let storeId: string;
  let sectionId: string;
  let itemId: string;
  let requestId: string;

  beforeAll(async () => {
    // 1. مدينة للتجارب
    const { data: city } = await adminClient
      .from("cities")
      .select("id")
      .limit(1)
      .single();
    cityId = city!.id;

    // 2. منشأة / تاجر
    const { data: merchant } = await adminClient
      .from("merchants")
      .insert({
        commercial_name: "مؤسسة اختبار المراجعة",
        cr_number: "1010998877",
      })
      .select("id")
      .single();
    merchantId = merchant!.id;

    // 3. متجر
    const { data: store } = await adminClient
      .from("stores")
      .insert({
        merchant_id: merchantId,
        name_ar: "متجر اختبار المراجعة",
        name_en: "Review Test Store",
        city_id: cityId,
        menu_slug: "test-review-store-" + Date.now(),
        menu_permission: "review_required",
      })
      .select("id")
      .single();
    storeId = store!.id;

    // 4. قسم ومنتج
    const { data: section } = await adminClient
      .from("menu_sections")
      .insert({
        store_id: storeId,
        name_ar: "قسم تجريبي",
        name_en: "Test Section",
      })
      .select("id")
      .single();
    sectionId = section!.id;

    const { data: item } = await adminClient
      .from("menu_items")
      .insert({
        section_id: sectionId,
        name_ar: "ساندوتش اختبار",
        name_en: "Test Sandwich",
        base_price_halalas: 2000,
        prep_time_minutes: 15,
        calories_value: 450,
      })
      .select("id")
      .single();
    itemId = item!.id;
  }, 30000);

  afterAll(async () => {
    if (merchantId) {
      await adminClient.from("merchants").delete().eq("id", merchantId);
    }
  });

  it("MER-002: Rejection without a reason should be strictly rejected", async () => {
    // إنشاء طلب مراجعة جديد
    const { data: req } = await adminClient
      .from("menu_review_requests")
      .insert({
        store_id: storeId,
        item_id: itemId,
        change_type: "price_update",
        old_price_halalas: 2000,
        proposed_price_halalas: 2500,
      })
      .select("id")
      .single();

    requestId = req!.id;

    // محاولة الرفض بدون سبب
    const { error } = await adminClient.rpc("review_menu_change_request", {
      p_request_id: requestId,
      p_action: "reject",
      p_rejection_reason: "",
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain("سبب الرفض إلزامي");
  });

  it("MER-002: Rejection with a valid reason should update status and log to audit_log", async () => {
    const reason = "السعر المقترح غير متطابق مع أسعار قائمة المحل المعتمدة";
    const { data, error } = await adminClient.rpc("review_menu_change_request", {
      p_request_id: requestId,
      p_action: "reject",
      p_rejection_reason: reason,
    });

    expect(error).toBeNull();
    expect(data.status).toBe("rejected");
    expect(data.rejection_reason).toBe(reason);

    // التحقق من حالة الطلب في الجدول
    const { data: updatedReq } = await adminClient
      .from("menu_review_requests")
      .select("status, rejection_reason")
      .eq("id", requestId)
      .single();

    expect(updatedReq?.status).toBe("rejected");
    expect(updatedReq?.rejection_reason).toBe(reason);

    // التحقق من وجود العملية في سجل التدقيق (ADM-002)
    const { data: auditLogs } = await adminClient
      .from("audit_log")
      .select("*")
      .eq("record_id", requestId);

    expect(auditLogs && auditLogs.length > 0).toBe(true);
    expect(auditLogs![0].reason).toContain(reason);
  });

  it("MER-002: Approval of price update request should immediately apply new price to menu_items", async () => {
    // إنشاء طلب جديد
    const { data: req2 } = await adminClient
      .from("menu_review_requests")
      .insert({
        store_id: storeId,
        item_id: itemId,
        change_type: "price_update",
        old_price_halalas: 2000,
        proposed_price_halalas: 2800,
      })
      .select("id")
      .single();

    // الموافقة على الطلب
    const { data, error } = await adminClient.rpc("review_menu_change_request", {
      p_request_id: req2!.id,
      p_action: "approve",
    });

    expect(error).toBeNull();
    expect(data.status).toBe("approved");

    // التحقق من تحديث السعر في الصنف مباشرة
    const { data: item } = await adminClient
      .from("menu_items")
      .select("base_price_halalas")
      .eq("id", itemId)
      .single();

    expect(item?.base_price_halalas).toBe(2800);
  });

  it("MER-001: admin_save_branch and get_store_branches should store and return Geo location", async () => {
    const lat = 24.7136;
    const lng = 46.6753;

    const { data: branchId, error } = await adminClient.rpc("admin_save_branch", {
      p_id: null,
      p_store_id: storeId,
      p_name_ar: "فرع العليا التجريبي",
      p_name_en: "Olaya Test Branch",
      p_city_id: cityId,
      p_latitude: lat,
      p_longitude: lng,
      p_address_text: "شارع العليا العام، الرياض",
      p_working_hours: [{ day: "sunday", open: "08:00", close: "23:00" }],
      p_default_prep_time_minutes: 20,
      p_min_order_halalas: 2500,
      p_is_active: false,
    });

    expect(error).toBeNull();
    expect(branchId).toBeDefined();

    // جلب الفروع والتحقق من الإحداثيات
    const { data: branches, error: fetchErr } = await adminClient.rpc("get_store_branches", {
      p_store_id: storeId,
    });

    expect(fetchErr).toBeNull();
    expect(branches).toBeDefined();
    const created = branches?.find((b: any) => b.id === branchId);
    expect(created).toBeDefined();
    expect(Math.abs(created!.latitude - lat)).toBeLessThan(0.0001);
    expect(Math.abs(created!.longitude - lng)).toBeLessThan(0.0001);
  });

  it("MER-001 / MER-009: Creating a new contract should close previous contract with valid_until", async () => {
    // إنشاء عقد أولي
    const { data: contract1Id, error: err1 } = await adminClient.rpc("admin_create_store_contract", {
      p_store_id: storeId,
      p_pricing_model: "percentage",
      p_tier1_fee_halalas: 200,
      p_tier1_order_threshold_halalas: 2500,
      p_tier2_fee_halalas: 500,
      p_contract_per_customer_cap_halalas: 3000,
      p_contract_per_customer_period_days: 365,
      p_contract_percentage: 12.0,
      p_menu_markup_percentage: 0.0,
      p_menu_markup_platform_share_percentage: 100.0,
      p_payment_gateway_fee_percentage: 2.5,
      p_payment_gateway_fee_fixed_halalas: 100,
      p_mart_pharmacy_merchant_percentage: 5.0,
      p_mart_pharmacy_customer_markup_percentage: 5.0,
      p_text_orders_platform_fee_percentage: 5.0,
    });

    expect(err1).toBeNull();

    // إنشاء عقد جديد بنسبة 15%
    const { data: contract2Id, error: err2 } = await adminClient.rpc("admin_create_store_contract", {
      p_store_id: storeId,
      p_pricing_model: "percentage",
      p_tier1_fee_halalas: 200,
      p_tier1_order_threshold_halalas: 2500,
      p_tier2_fee_halalas: 500,
      p_contract_per_customer_cap_halalas: 3000,
      p_contract_per_customer_period_days: 365,
      p_contract_percentage: 15.0,
      p_menu_markup_percentage: 0.0,
      p_menu_markup_platform_share_percentage: 100.0,
      p_payment_gateway_fee_percentage: 2.5,
      p_payment_gateway_fee_fixed_halalas: 100,
      p_mart_pharmacy_merchant_percentage: 5.0,
      p_mart_pharmacy_customer_markup_percentage: 5.0,
      p_text_orders_platform_fee_percentage: 5.0,
    });

    expect(err2).toBeNull();

    // العقد الأول يجب أن يكون مؤرخاً (valid_until ليس فارغاً)
    const { data: oldContract } = await adminClient
      .from("store_contracts")
      .select("valid_until, contract_percentage")
      .eq("id", contract1Id)
      .single();

    expect(oldContract?.valid_until).not.toBeNull();
    expect(Number(oldContract?.contract_percentage)).toBe(12.0);

    // العقد الثاني هو النشط (valid_until فارغ)
    const { data: newContract } = await adminClient
      .from("store_contracts")
      .select("valid_until, contract_percentage")
      .eq("id", contract2Id)
      .single();

    expect(newContract?.valid_until).toBeNull();
    expect(Number(newContract?.contract_percentage)).toBe(15.0);
  });
});
