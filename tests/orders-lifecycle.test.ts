import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import type { Database } from "@mahallat/shared";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

const adminClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

describe("Order Creation & Lifecycle Engine (Step 3.1 - ORD-001, ORD-002, ORD-004, CUS-010)", () => {
  let customer1Client: SupabaseClient<Database>;
  let customer2Client: SupabaseClient<Database>;
  let customer1Id: string;
  let customer2Id: string;
  let testCityId: string;
  let testMerchantId: string;
  let testStoreId: string;
  let testBranchId: string;
  let testItemId: string;
  let customer1AddressId: string;

  beforeAll(async () => {
    // 1. إنشاء حسابات عملاء تجريبية مع جلسات حقيقية
    const email1 = `test_cust1_${Date.now()}@mahallat.local`;
    const email2 = `test_cust2_${Date.now()}@mahallat.local`;
    const password = "TestPassword123!";

    const { data: u1 } = await adminClient.auth.admin.createUser({
      email: email1,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: "عميل تجريبي 1" },
    });
    customer1Id = u1.user!.id;

    const { data: u2 } = await adminClient.auth.admin.createUser({
      email: email2,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: "عميل تجريبي 2" },
    });
    customer2Id = u2.user!.id;

    // ضمان وجود صف في profiles لكلا المستخدمين
    await adminClient.from("profiles").upsert([
      { id: customer1Id, full_name: "عميل تجريبي 1", preferred_language: "ar" },
      { id: customer2Id, full_name: "عميل تجريبي 2", preferred_language: "ar" },
    ]);

    // تسجيل الدخول بالعميل 1 والعميل 2 للحصول على JWT حقيقي لاختبار RLS
    customer1Client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
    await customer1Client.auth.signInWithPassword({ email: email1, password });

    customer2Client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
    await customer2Client.auth.signInWithPassword({ email: email2, password });

    // 2. إنشاء مدينة تجريبية
    const { data: city } = await adminClient
      .from("cities")
      .insert({
        name_ar: "مدينة دورة الطلب",
        name_en: "Order Lifecycle City",
        boundary: "SRID=4326;MULTIPOLYGON(((39.10 21.40, 39.30 21.40, 39.30 21.60, 39.10 21.60, 39.10 21.40)))",
        is_active: true,
      })
      .select("id")
      .single();
    testCityId = city!.id;

    // 3. إنشاء عنوان موثق للعميل 1 داخل نطاق المدينة
    const { data: addr, error: addrErr } = await adminClient
      .from("customer_addresses")
      .insert({
        customer_id: customer1Id,
        name: "المنزل",
        type: "house",
        city_id: testCityId,
        location: "SRID=4326;POINT(39.18 21.50)",
        latitude: 21.50,
        longitude: 39.18,
        short_national_address: "جدة، حي الروضة، شارع الكيال",
        pin_confirmed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (addrErr) {
      console.error("خطأ إنشاء العنوان:", addrErr);
      throw addrErr;
    }
    customer1AddressId = addr!.id;

    // 4. إنشاء منشأة تاجر ومتجر وفرع
    const { data: merchant } = await adminClient
      .from("merchants")
      .insert({
        commercial_name: "شركة مطاعم دورة الطلب",
        cr_number: "1010" + Math.floor(100000 + Math.random() * 900000),
        vat_number: "3000" + Math.floor(10000000000 + Math.random() * 90000000000),
      })
      .select("id")
      .single();
    testMerchantId = merchant!.id;

    const { data: store, error: storeErr } = await adminClient
      .from("stores")
      .insert({
        merchant_id: testMerchantId,
        city_id: testCityId,
        name_ar: "مطعم البرجر السريع",
        name_en: "Fast Burger Store",
        store_type: "contracted_menu",
        operation_type: "restaurant",
        min_order_halalas: 2000, // 20 ر.س
        menu_slug: "fast-burger-test-" + Date.now(),
        self_pickup_enabled: true,
        self_pickup_discount_percentage: 10.0,
      })
      .select("id")
      .single();

    if (storeErr) {
      console.error("خطأ إنشاء المتجر:", storeErr);
      throw storeErr;
    }
    testStoreId = store!.id;

    // عقد المتجر
    await adminClient.rpc("admin_create_store_contract", {
      p_store_id: testStoreId,
      p_pricing_model: "percentage",
      p_contract_percentage: 10.0,
      p_tier1_fee_halalas: 200,
      p_tier1_order_threshold_halalas: 2500,
      p_tier2_fee_halalas: 500,
      p_contract_per_customer_cap_halalas: 3000,
      p_menu_markup_percentage: 0.0,
      p_payment_gateway_fee_percentage: 2.5,
      p_payment_gateway_fee_fixed_halalas: 100,
    });

    const { data: branch, error: brErr } = await adminClient
      .from("store_branches")
      .insert({
        store_id: testStoreId,
        name_ar: "فرع الروضة الرئيسي",
        name_en: "Al Rawdah Main Branch",
        city_id: testCityId,
        address_text: "شارع الكيال",
        location: "SRID=4326;POINT(39.18 21.50)",
        min_order_halalas: 2000,
        default_prep_time_minutes: 15,
        is_active: false,
      })
      .select("id")
      .single();

    if (brErr) {
      console.error("خطأ إنشاء الفرع:", brErr);
      throw brErr;
    }
    testBranchId = branch!.id;

    // تفعيل الفرع مع ترخيص
    const { data: docType } = await adminClient
      .from("document_types")
      .select("id")
      .eq("code", "baladiya_license")
      .single();

    await adminClient.from("uploaded_documents").insert({
      document_type_id: docType!.id,
      entity_type: "branch",
      entity_id: testBranchId,
      file_url: "https://example.com/license.pdf",
      expiry_date: "2030-01-01",
      is_verified: true,
    });

    await adminClient
      .from("store_branches")
      .update({ is_active: true })
      .eq("id", testBranchId);

    // قسم ومنتج في المنيو
    const { data: section } = await adminClient
      .from("menu_sections")
      .insert({
        store_id: testStoreId,
        name_ar: "وجبات البرجر",
        name_en: "Burgers",
      })
      .select("id")
      .single();

    const { data: item, error: itemErr } = await adminClient
      .from("menu_items")
      .insert({
        section_id: section!.id,
        name_ar: "برجر كلاسيك لحم",
        name_en: "Classic Beef Burger",
        description_ar: "برجر لحم مشوي طازج",
        base_price_halalas: 2500, // 25 ر.س
        calories_value: 550,
        prep_time_minutes: 12,
        is_published: true,
        is_available: true,
      })
      .select("id")
      .single();

    if (itemErr) {
      console.error("خطأ إنشاء الصنف:", itemErr);
      throw itemErr;
    }
    testItemId = item!.id;
  });

  afterAll(async () => {
    // تنظيف البيانات
    if (customer1Id) await adminClient.auth.admin.deleteUser(customer1Id);
    if (customer2Id) await adminClient.auth.admin.deleteUser(customer2Id);
    if (testStoreId) await adminClient.from("stores").delete().eq("id", testStoreId);
    if (testMerchantId) await adminClient.from("merchants").delete().eq("id", testMerchantId);
    if (testCityId) await adminClient.from("cities").delete().eq("id", testCityId);
  });

  it("1. create_customer_order creates order with pending_payment, readable order_number, and frozen snapshot", async () => {
    const items = [
      {
        item_id: testItemId,
        quantity: 1,
      },
    ];

    const { data: res, error } = await customer1Client.rpc("create_customer_order", {
      p_branch_id: testBranchId,
      p_delivery_type: "delivery",
      p_address_id: customer1AddressId,
      p_items: items as any,
      p_customer_notes: "بدون مخلل لو سمحت",
      p_out_of_stock_action: "refund",
      p_tip_halalas: 500, // 5 ر.س إكرامية
    });

    expect(error).toBeNull();
    const orderData = res as any;
    expect(orderData.success).toBe(true);
    expect(orderData.status).toBe("pending_payment");
    expect(orderData.order_number).toMatch(/^MHL-\d{4}-\d{4}$/);
    expect(orderData.items_total_halalas).toBe(2500);
    expect(orderData.tip_halalas).toBe(500);
    expect(orderData.pickup_code).toBeDefined();
    expect(orderData.delivery_code).toBeDefined();

    // التحقق من قاعدة البيانات مباشرة
    const { data: dbOrder } = await adminClient
      .from("orders")
      .select("*")
      .eq("id", orderData.order_id)
      .single();

    expect(dbOrder).not.toBeNull();
    expect(dbOrder?.customer_notes).toBe("بدون مخلل لو سمحت");
    expect(dbOrder?.out_of_stock_action).toBe("refund");
    expect(dbOrder?.order_snapshot).toBeDefined();
    expect((dbOrder?.order_snapshot as any)?.items).toHaveLength(1);
    expect((dbOrder?.order_snapshot as any)?.store?.name_ar).toBe("مطعم البرجر السريع");

    // التحقق من سجل الحالات الابتدائي
    const { data: history } = await adminClient
      .from("order_status_history")
      .select("*")
      .eq("order_id", orderData.order_id);

    expect(history).toHaveLength(1);
    expect(history![0].to_status).toBe("pending_payment");
    expect(history![0].changed_by_role).toBe("customer");
  });

  it("2. Server-side re-quoting rejects order when expected total differs (PRICE_MISMATCH)", async () => {
    const items = [
      {
        item_id: testItemId,
        quantity: 1,
      },
    ];

    // إرسال سعر متوقع غير صحيح (مثلاً العميل توقع 10 ر.س بدلاً من الحسبة الحقيقية)
    const { data: res, error } = await customer1Client.rpc("create_customer_order", {
      p_branch_id: testBranchId,
      p_delivery_type: "delivery",
      p_address_id: customer1AddressId,
      p_items: items as any,
      p_expected_total_halalas: 1000, // 10 ر.س (خاطئ)
    });

    expect(error).toBeNull();
    const orderData = res as any;
    expect(orderData.success).toBe(false);
    expect(orderData.error_code).toBe("PRICE_MISMATCH");
    expect(orderData.expected_total_halalas).toBe(1000);
    expect(orderData.new_total_halalas).toBeGreaterThan(1000);
    expect(orderData.quote).toBeDefined();
  });

  it("3. Idempotency protection returns existing order and prevents duplicate creation", async () => {
    const items = [
      {
        item_id: testItemId,
        quantity: 1,
      },
    ];
    const idempotencyKey = "idem_test_" + Date.now();

    // الطلب الأول
    const { data: res1 } = await customer1Client.rpc("create_customer_order", {
      p_branch_id: testBranchId,
      p_delivery_type: "delivery",
      p_address_id: customer1AddressId,
      p_items: items as any,
      p_idempotency_key: idempotencyKey,
    });
    const order1 = res1 as any;
    expect(order1.success).toBe(true);

    // الطلب الثاني بنفس المفتاح بالضبط (محاكاة انقطاع شبكة أو ضغط زر مرتين)
    const { data: res2 } = await customer1Client.rpc("create_customer_order", {
      p_branch_id: testBranchId,
      p_delivery_type: "delivery",
      p_address_id: customer1AddressId,
      p_items: items as any,
      p_idempotency_key: idempotencyKey,
    });
    const order2 = res2 as any;
    expect(order2.success).toBe(true);
    expect(order2.order_id).toBe(order1.order_id);
    expect(order2.is_replay).toBe(true);

    // التحقق من وجود سطر واحد فقط في جدول orders
    const { count } = await adminClient
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("idempotency_key", idempotencyKey);

    expect(count).toBe(1);
  });

  it("4. Strict state machine allows valid progression and blocks invalid jumps (ORD-001)", async () => {
    // إنشاء طلب جديد للاختبار
    const { data: res } = await customer1Client.rpc("create_customer_order", {
      p_branch_id: testBranchId,
      p_delivery_type: "delivery",
      p_address_id: customer1AddressId,
      p_items: [{ item_id: testItemId, quantity: 1 }] as any,
    });
    const orderId = (res as any).order_id;

    // محاولة غير قانونية: التسليم المباشر من pending_payment (مخالف لمعيار ORD-001)
    const { error: errInvalidDelivery } = await adminClient.rpc("transition_order_status", {
      p_order_id: orderId,
      p_new_status: "delivered",
      p_reason: "محاولة تسليم غير قانونية",
    });
    expect(errInvalidDelivery).not.toBeNull();
    expect(errInvalidDelivery?.message).toContain("ORD-001");

    // تتبع المسار الصحيح خطوة بخطوة:
    // pending_payment -> cooling_off
    await adminClient.rpc("transition_order_status", {
      p_order_id: orderId,
      p_new_status: "cooling_off",
      p_reason: "نجاح حجز المبلغ",
      p_changed_by_role: "system",
    });

    // cooling_off -> pending_driver
    await adminClient.rpc("transition_order_status", {
      p_order_id: orderId,
      p_new_status: "pending_driver",
      p_reason: "انتهاء مهلة الـ60 ثانية",
      p_changed_by_role: "system",
    });

    // pending_driver -> preparing
    await adminClient.rpc("transition_order_status", {
      p_order_id: orderId,
      p_new_status: "preparing",
      p_reason: "قبول المندوب للطلب",
      p_changed_by_role: "driver",
    });

    // preparing -> ready_for_pickup
    await adminClient.rpc("transition_order_status", {
      p_order_id: orderId,
      p_new_status: "ready_for_pickup",
      p_reason: "التاجر أتم التحضير",
      p_changed_by_role: "merchant",
    });

    // ready_for_pickup -> picked_up
    await adminClient.rpc("transition_order_status", {
      p_order_id: orderId,
      p_new_status: "picked_up",
      p_reason: "المندوب استلم الطلب وأدخل الكود",
      p_changed_by_role: "driver",
    });

    // picked_up -> in_transit
    await adminClient.rpc("transition_order_status", {
      p_order_id: orderId,
      p_new_status: "in_transit",
      p_reason: "المندوب في الطريق إلى العميل",
      p_changed_by_role: "driver",
    });

    // in_transit -> arrived
    await adminClient.rpc("transition_order_status", {
      p_order_id: orderId,
      p_new_status: "arrived",
      p_reason: "وصل المندوب لموقع العميل",
      p_changed_by_role: "driver",
    });

    // arrived -> delivered
    await adminClient.rpc("transition_order_status", {
      p_order_id: orderId,
      p_new_status: "delivered",
      p_reason: "تم إدخال كود التسليم",
      p_changed_by_role: "driver",
    });

    // delivered -> completed
    const { data: finalOrder } = await adminClient.rpc("transition_order_status", {
      p_order_id: orderId,
      p_new_status: "completed",
      p_reason: "اكتمال تحصيل المبالغ وإغلاق الطلب",
      p_changed_by_role: "system",
    });
    expect((finalOrder as any).status).toBe("completed");

    // التحقق من قفل الحالة النهائية: محاولة تحويل completed إلى أي شيء تفشل
    const { error: errReopen } = await adminClient.rpc("transition_order_status", {
      p_order_id: orderId,
      p_new_status: "preparing",
      p_reason: "محاولة إعادة فتح طلب مكتمل",
    });
    expect(errReopen).not.toBeNull();
    expect(errReopen?.message).toContain("ORD-001");
  });

  it("5. Order status history is strictly immutable (trigger blocks UPDATE & DELETE)", async () => {
    const { data: res } = await customer1Client.rpc("create_customer_order", {
      p_branch_id: testBranchId,
      p_delivery_type: "delivery",
      p_address_id: customer1AddressId,
      p_items: [{ item_id: testItemId, quantity: 1 }] as any,
    });
    const orderId = (res as any).order_id;

    const { data: historyRow } = await adminClient
      .from("order_status_history")
      .select("id")
      .eq("order_id", orderId)
      .single();

    expect(historyRow).not.toBeNull();

    // محاولة تعديل السجل -> يجب أن يفشل بالزناد
    const { error: errUpdate } = await adminClient
      .from("order_status_history")
      .update({ reason: "تعديل غير مصرح به" })
      .eq("id", historyRow!.id);

    expect(errUpdate).not.toBeNull();
    expect(errUpdate?.message).toContain("ORD-001");

    // محاولة حذف السجل -> يجب أن يفشل بالزناد
    const { error: errDelete } = await adminClient
      .from("order_status_history")
      .delete()
      .eq("id", historyRow!.id);

    expect(errDelete).not.toBeNull();
    expect(errDelete?.message).toContain("ORD-001");
  });

  it("6. Customer can cancel before preparing with mandatory reason; blocked after preparing (ORD-004)", async () => {
    // أ) إنشاء طلب بحالة pending_payment
    const { data: res1 } = await customer1Client.rpc("create_customer_order", {
      p_branch_id: testBranchId,
      p_delivery_type: "delivery",
      p_address_id: customer1AddressId,
      p_items: [{ item_id: testItemId, quantity: 1 }] as any,
    });
    const order1Id = (res1 as any).order_id;

    // محاولة إلغاء بدون ذكر سبب -> مرفوض
    const { error: errNoReason } = await customer1Client.rpc("cancel_customer_order", {
      p_order_id: order1Id,
      p_reason: "   ",
    });
    expect(errNoReason).not.toBeNull();
    expect(errNoReason?.message).toContain("ORD-004");

    // إلغاء نظامي من العميل بسبب واضح -> مقبول
    const { data: cancelRes } = await customer1Client.rpc("cancel_customer_order", {
      p_order_id: order1Id,
      p_reason: "تغيير رأيي قبل التحضير",
    });
    expect((cancelRes as any).success).toBe(true);

    const { data: cancelledOrder } = await adminClient
      .from("orders")
      .select("status, cancellation_reason, cancelled_by_role")
      .eq("id", order1Id)
      .single();
    expect(cancelledOrder?.status).toBe("cancelled");
    expect(cancelledOrder?.cancellation_reason).toBe("تغيير رأيي قبل التحضير");
    expect(cancelledOrder?.cancelled_by_role).toBe("customer");

    // ب) إنشاء طلب ونقله إلى preparing
    const { data: res2 } = await customer1Client.rpc("create_customer_order", {
      p_branch_id: testBranchId,
      p_delivery_type: "delivery",
      p_address_id: customer1AddressId,
      p_items: [{ item_id: testItemId, quantity: 1 }] as any,
    });
    const order2Id = (res2 as any).order_id;

    await adminClient.rpc("transition_order_status", {
      p_order_id: order2Id,
      p_new_status: "preparing",
      p_reason: "بدأ التجهيز",
    });

    // العميل يحاول الإلغاء بعد بدء التجهيز -> مرفوض بنص صريح (ORD-004)
    const { error: errCancelAfterPrep } = await customer1Client.rpc("cancel_customer_order", {
      p_order_id: order2Id,
      p_reason: "تأخرت في التجهيز",
    });
    expect(errCancelAfterPrep).not.toBeNull();
    expect(errCancelAfterPrep?.message).toContain("ORD-004");
  });

  it("7. RLS isolation: customer cannot view or cancel other customers' orders", async () => {
    // إنشاء طلب بواسطة العميل 1
    const { data: res } = await customer1Client.rpc("create_customer_order", {
      p_branch_id: testBranchId,
      p_delivery_type: "delivery",
      p_address_id: customer1AddressId,
      p_items: [{ item_id: testItemId, quantity: 1 }] as any,
    });
    const order1Id = (res as any).order_id;

    // العميل 2 يستعلم عن طلب العميل 1
    const { data: queryData } = await customer2Client
      .from("orders")
      .select("*")
      .eq("id", order1Id)
      .maybeSingle();

    // RLS تمنعه وتُرجع null
    expect(queryData).toBeNull();

    // العميل 2 يحاول إلغاء طلب العميل 1
    const { error: errUnauthorizedCancel } = await customer2Client.rpc("cancel_customer_order", {
      p_order_id: order1Id,
      p_reason: "محاولة اختراق",
    });

    expect(errUnauthorizedCancel).not.toBeNull();
    expect(errUnauthorizedCancel?.message).toContain("غير مصرح لك بإلغاء هذا الطلب");
  });
});
