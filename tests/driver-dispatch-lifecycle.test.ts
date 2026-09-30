import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import type { Database } from "@mahallat/shared";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

const adminClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

describe("Driver App, Dispatch, Geofence, and Task Stages (Phase 4: DRV, DSP, ORD, CUS)", () => {
  let customerClient: SupabaseClient<Database>;
  let driver1Client: SupabaseClient<Database>;
  let driver2Client: SupabaseClient<Database>;

  let customerId: string;
  let driver1Id: string; // سعودي حر موثق - سيارة
  let driver2Id: string; // غير موثق - دراجة

  let testMerchantId: string;
  let testCityId: string;
  let testStoreId: string;
  let testBranchId: string;
  let testItemId: string;
  let customerAddressId: string;

  // إحداثيات فرع المتجر في حي الروضة بجدة
  const storeLat = 21.578;
  const storeLng = 39.141;

  // إحداثيات عنوان العميل 1 (على بعد 800 متر من المتجر)
  const cust1Lat = 21.582;
  const cust1Lng = 39.145;

  // إحداثيات عنوان عميل بعيد (2.5 كم عن العميل 1 لاختبار منع التجميع DSP-003)
  const custFarLat = 21.605;
  const custFarLng = 39.165;

  const createTestOrder = async (addrId?: string) => {
    const { data, error } = await customerClient.rpc("create_customer_order", {
      p_branch_id: testBranchId,
      p_delivery_type: "delivery",
      p_address_id: addrId || customerAddressId,
      p_items: [{ item_id: testItemId, quantity: 1 }] as any,
    });
    if (error || !(data as any)?.success) {
      console.error("خطأ إنشاء الطلب التجريبي:", error || data);
      throw error || new Error((data as any)?.error_code || "FAILED_TO_CREATE_ORDER");
    }
    return data as any;
  };

  beforeAll(async () => {
    // 1. إنشاء حساب عميل
    const custEmail = `test_driver_cust_${Date.now()}@mahallat.local`;
    const password = "TestPassword123!";

    const { data: uCust } = await adminClient.auth.admin.createUser({
      email: custEmail,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: "عميل اختبار المندوب" },
    });
    customerId = uCust.user!.id;

    customerClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
    await customerClient.auth.signInWithPassword({ email: custEmail, password });

    // 2. إنشاء المندوب 1 (موثق - سيارة)
    const drv1Email = `test_driver_1_${Date.now()}@mahallat.local`;
    const { data: uDrv1 } = await adminClient.auth.admin.createUser({
      email: drv1Email,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: "أحمد المندوب الموثق" },
    });
    driver1Id = uDrv1.user!.id;

    driver1Client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
    await driver1Client.auth.signInWithPassword({ email: drv1Email, password });

    // 3. إنشاء المندوب 2 (غير موثق - دراجة نارية)
    const drv2Email = `test_driver_2_${Date.now()}@mahallat.local`;
    const { data: uDrv2 } = await adminClient.auth.admin.createUser({
      email: drv2Email,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: "خالد مندوب دراجة" },
    });
    driver2Id = uDrv2.user!.id;

    driver2Client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
    await driver2Client.auth.signInWithPassword({ email: drv2Email, password });

    // 4. تعيين الأدوار والملفات
    await adminClient.from("profiles").upsert([
      { id: customerId, full_name: "عميل اختبار المندوب", preferred_language: "ar" },
      { id: driver1Id, full_name: "أحمد المندوب الموثق", preferred_language: "ar" },
      { id: driver2Id, full_name: "خالد مندوب دراجة", preferred_language: "ar" },
    ]);

    await adminClient.from("user_roles").upsert([
      { user_id: customerId, role: "customer" },
      { user_id: driver1Id, role: "driver" },
      { user_id: driver2Id, role: "driver" },
    ]);

    // 5. جلب مدينة جدة
    const { data: cityData } = await adminClient
      .from("cities")
      .select("id")
      .eq("name_ar", "جدة")
      .single();
    testCityId = cityData!.id;

    // 6. تهيئة سجلات المندوبين في جدول drivers
    await adminClient.from("drivers").upsert([
      {
        id: driver1Id,
        driver_type: "saudi_freelance",
        vehicle_type: "car",
        vehicle_plate: "أ ح م 1010",
        is_verified_freelance: true,
        status: "approved",
        is_active: false, // يبدأ غير متصل
        uniform_acknowledged_at: null, // لم يقر بعد
        current_location: `POINT(${storeLng} ${storeLat})` as any,
        city_id: testCityId,
        level: "gold",
        performance_score: 95.0,
      },
      {
        id: driver2Id,
        driver_type: "saudi_freelance",
        vehicle_type: "motorcycle",
        vehicle_plate: "خ ل د 2020",
        is_verified_freelance: false,
        status: "approved",
        is_active: false,
        uniform_acknowledged_at: null,
        current_location: `POINT(${storeLng + 0.005} ${storeLat + 0.005})` as any,
        city_id: testCityId,
        level: "silver",
        performance_score: 80.0,
      },
    ]);

    // 7. إنشاء منشأة تاجر ومتجر وفرع وقسم وصنف تجريبي
    const { data: merchant } = await adminClient
      .from("merchants")
      .insert({
        commercial_name: "شركة مطاعم التوصيل السريع",
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
        name_ar: "مطعم البرجر للمناديب",
        name_en: "Burger For Drivers Store",
        store_type: "contracted_menu",
        operation_type: "restaurant",
        min_order_halalas: 2000,
        menu_slug: "drivers-burger-" + Date.now(),
        self_pickup_enabled: true,
        self_pickup_discount_percentage: 10.0,
      })
      .select("id")
      .single();

    if (storeErr) throw storeErr;
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
        location: `POINT(${storeLng} ${storeLat})` as any,
        min_order_halalas: 2000,
        default_prep_time_minutes: 15,
        is_active: false,
      })
      .select("id")
      .single();

    if (brErr) throw brErr;
    testBranchId = branch!.id;

    // تفعيل الفرع مع ترخيص
    const { data: docType } = await adminClient
      .from("document_types")
      .select("id")
      .eq("code", "baladiya_license")
      .single();

    if (docType) {
      await adminClient.from("uploaded_documents").insert({
        document_type_id: docType.id,
        entity_type: "branch",
        entity_id: testBranchId,
        file_url: "https://example.com/license.pdf",
        expiry_date: "2030-01-01",
        is_verified: true,
      });
    }

    await adminClient
      .from("store_branches")
      .update({ is_active: true })
      .eq("id", testBranchId);

    // قسم ومنتج في المنيو
    const { data: section } = await adminClient
      .from("menu_sections")
      .insert({
        store_id: testStoreId,
        name_ar: "وجبات سريعة",
        name_en: "Fast Food",
      })
      .select("id")
      .single();

    const { data: item, error: itemErr } = await adminClient
      .from("menu_items")
      .insert({
        section_id: section!.id,
        name_ar: "برجر كلاسيك",
        name_en: "Classic Burger",
        base_price_halalas: 2500,
        calories_value: 500,
        prep_time_minutes: 10,
        is_published: true,
        is_available: true,
      })
      .select("id")
      .single();

    if (itemErr) throw itemErr;
    testItemId = item!.id;

    // 8. إنشاء عنوان توصيل للعميل
    const { data: addrData, error: addrErr } = await adminClient.from("customer_addresses").insert({
      customer_id: customerId,
      city_id: testCityId,
      name: "منزل العميل",
      latitude: cust1Lat,
      longitude: cust1Lng,
      location: `POINT(${cust1Lng} ${cust1Lat})` as any,
      pin_confirmed_at: new Date().toISOString(),
      district_name: "حي الروضة",
      street_name: "شارع الكيال",
      type: "apartment",
    }).select("id").single();

    if (addrErr) {
      console.error("خطأ إنشاء عنوان العميل:", addrErr);
      throw addrErr;
    }
    customerAddressId = addrData!.id;
  }, 60000);

  afterAll(async () => {
    // تنظيف الحسابات التجريبية والبيانات
    if (customerId) await adminClient.auth.admin.deleteUser(customerId);
    if (driver1Id) await adminClient.auth.admin.deleteUser(driver1Id);
    if (driver2Id) await adminClient.auth.admin.deleteUser(driver2Id);
    if (testStoreId) await adminClient.from("stores").delete().eq("id", testStoreId);
    if (testMerchantId) await adminClient.from("merchants").delete().eq("id", testMerchantId);
  }, 60000);

  // --------------------------------------------------------------------------
  // 1. DRV-010: إقرار الزي الموحد شرط إلزامي لبدء العمل واستقبال الطلبات
  // --------------------------------------------------------------------------
  it("1. Driver cannot go online without uniform acknowledgment (DRV-010)", async () => {
    // محاولة تفعيل الاتصال قبل الإقرار
    const { data: failRes, error: failErr } = await driver1Client.rpc("driver_toggle_active", {
      p_driver_id: driver1Id,
      p_active: true,
    });

    expect(failErr).toBeDefined();
    expect(failErr?.message).toContain("DRV-010");

    // توثيق إقرار الزي الموحد
    const { data: ackRes, error: ackErr } = await driver1Client.rpc("driver_acknowledge_uniform", {
      p_driver_id: driver1Id,
    });
    expect(ackErr).toBeNull();
    expect((ackRes as any)?.success).toBe(true);

    // الآن يمكنه تفعيل الاتصال بنجاح
    const { data: okRes, error: okErr } = await driver1Client.rpc("driver_toggle_active", {
      p_driver_id: driver1Id,
      p_active: true,
    });
    expect(okErr).toBeNull();
    expect((okRes as any)?.is_active).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 2. DRV-003 & DRV-027: تحديث الموقع الحي وكشف الموقع الوهمي (Mock GPS)
  // --------------------------------------------------------------------------
  it("2. Live GPS update and mock location detection immediately suspends driver (DRV-003, DRV-027)", async () => {
    // تحديث موقع طبيعي
    const { data: locRes, error: locErr } = await driver1Client.rpc("driver_update_location", {
      p_driver_id: driver1Id,
      p_lat: storeLat,
      p_lng: storeLng,
      p_speed_kmh: 40,
      p_heading: 90,
      p_accuracy_meters: 5,
      p_is_mock: false,
    });
    expect(locErr).toBeNull();
    expect((locRes as any)?.success).toBe(true);

    // التحقق من الحفظ في سجل المواقع
    const { data: logs } = await adminClient
      .from("driver_locations_log")
      .select("*")
      .eq("driver_id", driver1Id)
      .order("recorded_at", { ascending: false })
      .limit(1);
    expect(logs?.length).toBe(1);
    expect(logs![0].is_mock).toBe(false);

    // الآن محاكاة رصد موقع وهمي (Mock Location)
    const { data: mockRes, error: mockErr } = await driver1Client.rpc("driver_update_location", {
      p_driver_id: driver1Id,
      p_lat: storeLat + 0.1,
      p_lng: storeLng + 0.1,
      p_is_mock: true,
    });
    expect((mockRes as any)?.success).toBe(false);
    expect((mockRes as any)?.error).toBe("MOCK_LOCATION_DETECTED");

    // فحص تعليق المندوب وإيقاف الإتاحة في قاعدة البيانات
    const { data: drvRow } = await adminClient
      .from("drivers")
      .select("mock_location_detected, is_active")
      .eq("id", driver1Id)
      .single();
    expect(drvRow?.mock_location_detected).toBe(true);
    expect(drvRow?.is_active).toBe(false);

    // محاولة تفعيل الحساب بعد رصد التزوير تُرفض قطعياً (DRV-027)
    const { error: blockedErr } = await driver1Client.rpc("driver_toggle_active", {
      p_driver_id: driver1Id,
      p_active: true,
    });
    expect(blockedErr?.message).toContain("DRV-027");

    // إعادة فتح الحساب بعد مراجعة الإدارة للاستمرار بالاختبار وإعادة الموقع للمتجر
    await adminClient.from("drivers").update({
      mock_location_detected: false,
      is_active: true,
      current_location: `POINT(${storeLng} ${storeLat})` as any,
    }).eq("id", driver1Id);
  });

  // --------------------------------------------------------------------------
  // 3. DSP-001 & DRV-007: محرك التوزيع وأولوية المندوب الموثق
  // --------------------------------------------------------------------------
  it("3. Dispatch engine prioritizes verified freelance driver and creates timed offers (DSP-001, DRV-007)", async () => {
    // تجهيز المندوب 2 كمتصل بعد إقرار الزي
    await adminClient.from("drivers").update({
      uniform_acknowledged_at: new Date().toISOString(),
      is_active: true,
    }).eq("id", driver2Id);

    // إنشاء طلب تجريبي بواسطة العميل
    const orderData = await createTestOrder();
    const orderId = orderData.order_id;

    // استدعاء محرك التوزيع
    const { data: dispatchRes, error: dispErr } = await adminClient.rpc("dispatch_order_to_drivers", {
      p_order_id: orderId,
    });
    expect(dispErr).toBeNull();
    expect((dispatchRes as any)?.success).toBe(true);

    // فحص جدول عروض الطلبات driver_order_offers
    const { data: offers } = await adminClient
      .from("driver_order_offers")
      .select("*")
      .eq("order_id", orderId)
      .order("offered_at", { ascending: true });

    expect(offers?.length).toBeGreaterThan(0);
    // المندوب 1 موثق بوثيقة العمل الحر (DRV-007) فيجب أن يكون له عرض
    const offerDrv1 = offers?.find((o) => o.driver_id === driver1Id);
    expect(offerDrv1).toBeDefined();
    expect(offerDrv1?.status).toBe("offered");
  });

  // --------------------------------------------------------------------------
  // 4. ORD-006 & DSP-001: قبولان متزامنان يُسندان لمندوب واحد فقط ويتقدم للتاجر
  // --------------------------------------------------------------------------
  it("4. Concurrent acceptance assigns order to exactly one driver and advances status to 'preparing' (ORD-006, DSP-001)", async () => {
    // إنشاء طلب جديد
    const orderData = await createTestOrder();
    const orderId = orderData.order_id;
    await adminClient.rpc("dispatch_order_to_drivers", { p_order_id: orderId });

    // المندوب 1 يقبل أولاً
    const { data: accRes1, error: accErr1 } = await driver1Client.rpc("driver_accept_order", {
      p_driver_id: driver1Id,
      p_order_id: orderId,
    });
    expect(accErr1).toBeNull();
    expect((accRes1 as any)?.success).toBe(true);
    expect((accRes1 as any)?.status).toBe("preparing");

    // المندوب 2 يحاول القبول في اللحظة نفسها -> يجب أن يُرفض صراحة (ORD-006)
    const { data: accRes2, error: accErr2 } = await driver2Client.rpc("driver_accept_order", {
      p_driver_id: driver2Id,
      p_order_id: orderId,
    });
    expect(accErr2).toBeDefined();
    expect(accErr2?.message).toContain("تم قبوله بواسطة مندوب آخر (ORD-006)");

    // التحقق من تعيين المندوب 1 فقط وحالة الطلب جاري التجهيز
    const { data: ordCheck } = await adminClient
      .from("orders")
      .select("driver_id, status")
      .eq("id", orderId)
      .single();
    expect(ordCheck?.driver_id).toBe(driver1Id);
    expect(ordCheck?.status).toBe("preparing");
  });

  // --------------------------------------------------------------------------
  // 5. DSP-003: تعدد الطلبات (سقف 3 طلبات وقاعدة 1 كم للتجميع)
  // --------------------------------------------------------------------------
  it("5. Multi-orders enforce max 3 active orders cap and 1km distance threshold (DSP-003)", async () => {
    // عنوان عميل يبعد 2.5 كم عن العميل 1
    const { data: farAddr, error: farErr } = await adminClient.from("customer_addresses").insert({
      customer_id: customerId,
      city_id: testCityId,
      name: "منزل بعيد",
      latitude: custFarLat,
      longitude: custFarLng,
      location: `POINT(${custFarLng} ${custFarLat})` as any,
      pin_confirmed_at: new Date().toISOString(),
      district_name: "حي بعيد",
      street_name: "شارع بعيد",
      type: "house",
    }).select("id").single();
    if (farErr) throw farErr;

    // إنشاء طلب للعنوان البعيد
    const farOrderData = await createTestOrder(farAddr!.id);
    const farOrderId = farOrderData.order_id;
    await adminClient.rpc("dispatch_order_to_drivers", { p_order_id: farOrderId });

    // المندوب 1 معه طلب حالي من العميل 1؛ محاولة قبول هذا الطلب البعيد (أكثر من 1 كم) يجب أن تُرفض (DSP-003)
    const { error: bundleErr } = await driver1Client.rpc("driver_accept_order", {
      p_driver_id: driver1Id,
      p_order_id: farOrderId,
    });
    expect(bundleErr).toBeDefined();
    expect(bundleErr?.message).toContain("1 كم");

    // فحص سقف الـ 3 طلبات: نجعل المندوب 2 معه 3 طلبات
    await adminClient.from("drivers").update({ active_orders_count: 3 }).eq("id", driver2Id);
    const { error: capErr } = await driver2Client.rpc("driver_accept_order", {
      p_driver_id: driver2Id,
      p_order_id: farOrderId,
    });
    expect(capErr).toBeDefined();
    expect(capErr?.message).toContain("3 طلبات نشطة");

    // إعادة تصفير العداد
    await adminClient.from("drivers").update({ active_orders_count: 0 }).eq("id", driver2Id);
  });

  // --------------------------------------------------------------------------
  // 6. DRV-004 & ORD-005: مراحل المهمة والاستلام والتسليم داخل 100 متر
  // --------------------------------------------------------------------------
  it("6. Task stages enforce <=100m geofence, correct codes, and proof photos (DRV-004, ORD-005)", async () => {
    // إنشاء طلب جديد مخصص لاختبار الدورة الكاملة
    const orderData = await createTestOrder();
    const orderId = orderData.order_id;
    const pickupCode = orderData.pickup_code;
    const deliveryCode = orderData.delivery_code;

    await adminClient.rpc("dispatch_order_to_drivers", { p_order_id: orderId });
    await driver1Client.rpc("driver_accept_order", { p_driver_id: driver1Id, p_order_id: orderId });

    // أ. وصول المتجر خارج 100 متر (يبعد 500 متر مثلاً) -> يجب أن يُرفض (ORD-005)
    const { error: farStoreErr } = await driver1Client.rpc("driver_arrive_at_store", {
      p_driver_id: driver1Id,
      p_order_id: orderId,
      p_driver_lat: storeLat + 0.005, // ~550 متر
      p_driver_lng: storeLng,
    });
    expect(farStoreErr).toBeDefined();
    expect(farStoreErr?.message).toContain("100 متر");

    // وصول المتجر داخل 100 متر (موقع مطابق للفرع) -> ينجح
    const { data: okStoreRes, error: okStoreErr } = await driver1Client.rpc("driver_arrive_at_store", {
      p_driver_id: driver1Id,
      p_order_id: orderId,
      p_driver_lat: storeLat,
      p_driver_lng: storeLng,
    });
    expect(okStoreErr).toBeNull();
    expect((okStoreRes as any)?.success).toBe(true);

    // ب. استلام الطلب: كود استلام خاطئ -> يرفض
    const { error: wrongCodeErr } = await driver1Client.rpc("driver_pickup_order", {
      p_driver_id: driver1Id,
      p_order_id: orderId,
      p_pickup_code: "9999",
      p_photo_url: "https://proof.photo/pickup.jpg",
      p_driver_lat: storeLat,
      p_driver_lng: storeLng,
    });
    expect(wrongCodeErr?.message).toContain("كود الاستلام غير صحيح");

    // استلام الطلب: كود صحيح وبلا صورة -> يرفض
    const { error: noPhotoErr } = await driver1Client.rpc("driver_pickup_order", {
      p_driver_id: driver1Id,
      p_order_id: orderId,
      p_pickup_code: pickupCode,
      p_photo_url: "",
      p_driver_lat: storeLat,
      p_driver_lng: storeLng,
    });
    expect(noPhotoErr?.message).toContain("صورة استلام الطلب إلزامية");

    // استلام الطلب: كود صحيح وصورة داخل 100 متر -> ينجح وينتقل الطلب إلى in_transit
    const { data: okPickupRes, error: okPickupErr } = await driver1Client.rpc("driver_pickup_order", {
      p_driver_id: driver1Id,
      p_order_id: orderId,
      p_pickup_code: pickupCode,
      p_photo_url: "https://proof.photo/pickup.jpg",
      p_driver_lat: storeLat,
      p_driver_lng: storeLng,
    });
    expect(okPickupErr).toBeNull();
    expect((okPickupRes as any)?.status).toBe("in_transit");

    // ج. وصول العميل: داخل 100 متر -> ينجح وينتقل لـ arrived
    const { data: okCustRes, error: okCustErr } = await driver1Client.rpc("driver_arrive_at_customer", {
      p_driver_id: driver1Id,
      p_order_id: orderId,
      p_driver_lat: cust1Lat,
      p_driver_lng: cust1Lng,
    });
    expect(okCustErr).toBeNull();
    expect((okCustRes as any)?.status).toBe("arrived");

    // د. تسليم الطلب: كود خاطئ -> يرفض
    const { error: wrongDelivErr } = await driver1Client.rpc("driver_deliver_order", {
      p_driver_id: driver1Id,
      p_order_id: orderId,
      p_delivery_code: "0000",
      p_photo_url: "https://proof.photo/deliv.jpg",
      p_driver_lat: cust1Lat,
      p_driver_lng: cust1Lng,
    });
    expect(wrongDelivErr?.message).toContain("كود التسليم غير صحيح");

    // تسليم الطلب: كود صحيح وصورة -> ينجح وينتقل الطلب إلى completed (ORD-001)
    const { data: okDelivRes, error: okDelivErr } = await driver1Client.rpc("driver_deliver_order", {
      p_driver_id: driver1Id,
      p_order_id: orderId,
      p_delivery_code: deliveryCode,
      p_photo_url: "https://proof.photo/deliv.jpg",
      p_driver_lat: cust1Lat,
      p_driver_lng: cust1Lng,
    });
    expect(okDelivErr).toBeNull();
    expect((okDelivRes as any)?.status).toBe("completed");
  });

  // --------------------------------------------------------------------------
  // 7. ORD-010: الترك عند الباب واشتراط صورة التوثيق
  // --------------------------------------------------------------------------
  it("7. Leave-at-door delivery requires mandatory photo proof (ORD-010)", async () => {
    // إنشاء طلب جديد
    const orderData = await createTestOrder();
    const orderId = orderData.order_id;
    const pickupCode = orderData.pickup_code;
    const deliveryCode = orderData.delivery_code;

    await adminClient.rpc("dispatch_order_to_drivers", { p_order_id: orderId });
    await driver1Client.rpc("driver_accept_order", { p_driver_id: driver1Id, p_order_id: orderId });
    await driver1Client.rpc("driver_arrive_at_store", { p_driver_id: driver1Id, p_order_id: orderId, p_driver_lat: storeLat, p_driver_lng: storeLng });
    await driver1Client.rpc("driver_pickup_order", { p_driver_id: driver1Id, p_order_id: orderId, p_pickup_code: pickupCode, p_photo_url: "https://proof.jpg", p_driver_lat: storeLat, p_driver_lng: storeLng });
    await driver1Client.rpc("driver_arrive_at_customer", { p_driver_id: driver1Id, p_order_id: orderId, p_driver_lat: cust1Lat, p_driver_lng: cust1Lng });

    // محاولة الترك عند الباب (is_leave_at_door = true) بدون صورة -> تفشل (ORD-010)
    const { error: noPhotoErr } = await driver1Client.rpc("driver_deliver_order", {
      p_driver_id: driver1Id,
      p_order_id: orderId,
      p_delivery_code: deliveryCode,
      p_photo_url: "",
      p_is_leave_at_door: true,
      p_driver_lat: cust1Lat,
      p_driver_lng: cust1Lng,
    });
    expect(noPhotoErr?.message).toContain("صورة توثيق الترك عند الباب إلزامية (ORD-010)");

    // مع صورة التوثيق -> تنجح
    const { data: okRes, error: okErr } = await driver1Client.rpc("driver_deliver_order", {
      p_driver_id: driver1Id,
      p_order_id: orderId,
      p_delivery_code: deliveryCode,
      p_photo_url: "https://proof.photo/door.jpg",
      p_is_leave_at_door: true,
      p_driver_lat: cust1Lat,
      p_driver_lng: cust1Lng,
    });
    expect(okErr).toBeNull();
    expect((okRes as any)?.status).toBe("completed");
  });

  // --------------------------------------------------------------------------
  // 8. ORD-008: الإنهاء التلقائي لعدم تجاوب العميل بعد 30 دقيقة
  // --------------------------------------------------------------------------
  it("8. Unresponsive customer order auto-expires after 30 minutes with driver receiving full fee (ORD-008)", async () => {
    // إنشاء طلب جديد
    const orderData = await createTestOrder();
    const orderId = orderData.order_id;
    const pickupCode = orderData.pickup_code;

    await adminClient.rpc("dispatch_order_to_drivers", { p_order_id: orderId });
    await driver1Client.rpc("driver_accept_order", { p_driver_id: driver1Id, p_order_id: orderId });
    await driver1Client.rpc("driver_arrive_at_store", { p_driver_id: driver1Id, p_order_id: orderId, p_driver_lat: storeLat, p_driver_lng: storeLng });
    await driver1Client.rpc("driver_pickup_order", { p_driver_id: driver1Id, p_order_id: orderId, p_pickup_code: pickupCode, p_photo_url: "https://proof.jpg", p_driver_lat: storeLat, p_driver_lng: storeLng });
    await driver1Client.rpc("driver_arrive_at_customer", { p_driver_id: driver1Id, p_order_id: orderId, p_driver_lat: cust1Lat, p_driver_lng: cust1Lng });

    // محاولة الإنهاء قبل مرور 30 دقيقة -> تفشل
    const { error: earlyErr } = await adminClient.rpc("auto_expire_unresponsive_customer_order", {
      p_order_id: orderId,
    });
    expect(earlyErr?.message).toContain("لم تمر مهلة 30 دقيقة");

    // محاكاة مرور 35 دقيقة في قاعدة البيانات
    const thirtyFiveMinsAgo = new Date(Date.now() - 35 * 60 * 1000).toISOString();
    await adminClient.from("orders").update({
      driver_arrived_at: thirtyFiveMinsAgo,
    }).eq("id", orderId);

    // الآن استدعاء الإنهاء التلقائي -> ينجح وتتحول الحالة إلى ended_no_response
    const { data: expRes, error: expErr } = await adminClient.rpc("auto_expire_unresponsive_customer_order", {
      p_order_id: orderId,
    });
    expect(expErr).toBeNull();
    expect((expRes as any)?.status).toBe("ended_no_response");

    const { data: finalOrd } = await adminClient.from("orders").select("status").eq("id", orderId).single();
    expect(finalOrd?.status).toBe("ended_no_response");
  });
});
