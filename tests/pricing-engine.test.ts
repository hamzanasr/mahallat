import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import type { Database } from "@mahallat/shared";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

const adminClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const anonClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

describe("محرك الأسعار والرسوم والأوقات وعرض السعر (Step 2.4 - PAY-004, PAY-013, PAY-021, ORD-011)", () => {
  let testCityId: string;
  let noFeeCityId: string;
  let testMerchantId: string;
  let testRestaurantId: string;
  let testMartId: string;
  let testMarkup10StoreId: string;
  let testMarkup15StoreId: string;
  let testMarkup5StoreId: string;
  let restBranchId: string;
  let martBranchId: string;
  let testItemId: string;
  let testItemWithSizeId: string;
  let testSizeId: string;

  async function activateBranch(branchId: string) {
    const { data: docTypes } = await adminClient
      .from("document_types")
      .select("id")
      .eq("applies_to", "branch")
      .eq("is_mandatory", true);

    if (docTypes && docTypes.length > 0) {
      for (const dt of docTypes) {
        await adminClient.from("uploaded_documents").upsert({
          document_type_id: dt.id,
          entity_type: "branch",
          entity_id: branchId,
          file_url: "https://example.com/test-doc.pdf",
          expiry_date: "2030-01-01",
          is_verified: true,
        });
      }
    }

    const { error } = await adminClient
      .from("store_branches")
      .update({ is_active: true })
      .eq("id", branchId);

    if (error) {
      throw error;
    }
  }

  beforeAll(async () => {
    // 1. مدينة تجريبية رئيسية (جدة)
    const { data: city } = await adminClient
      .from("cities")
      .select("id")
      .eq("name_ar", "جدة")
      .maybeSingle();

    if (city) {
      testCityId = city.id;
    } else {
      const { data: newCity } = await adminClient
        .from("cities")
        .insert({
          name_ar: "مدينة تسعير تجريبية",
          name_en: "Pricing Test City",
          is_active: true,
        })
        .select("id")
        .single();
      testCityId = newCity!.id;
    }

    // 2. مدينة ثانية رسوم الخدمة فيها غير مفعلة
    const { data: c2 } = await adminClient
      .from("cities")
      .insert({
        name_ar: "مدينة بدون رسوم خدمة " + Date.now(),
        name_en: "No Fee City",
        is_active: true,
      })
      .select("id")
      .single();
    noFeeCityId = c2!.id;

    // تعطيل رسوم الخدمة في المدينة الثانية
    await adminClient.from("setting_values").upsert({
      key: "customer_service_fee_enabled",
      level: "city",
      entity_id: noFeeCityId,
      value: false as any,
    });

    // 3. تاجر تجريبي
    const ts = Date.now().toString().slice(-6);
    const { data: merchant, error: mErr } = await adminClient
      .from("merchants")
      .insert({
        commercial_name: "تاجر محرك الأسعار " + ts,
        cr_number: "1010" + ts,
        vat_number: "3000" + ts + "00003",
      })
      .select("id")
      .single();
    if (mErr) throw mErr;
    testMerchantId = merchant!.id;

    // 4. مطعم عادي (بدون زيادة على المنيو)
    const { data: rest, error: restErr } = await adminClient
      .from("stores")
      .insert({
        merchant_id: testMerchantId,
        city_id: testCityId,
        name_ar: "مطعم تجريبي عادي",
        name_en: "Normal Test Restaurant",
        store_type: "contracted_menu",
        operation_type: "restaurant",
        menu_slug: "rest-test-" + Date.now(),
      })
      .select("id")
      .single();
    if (restErr) throw restErr;
    testRestaurantId = rest!.id;

    // عقد المطعم العادي: زيادة 0%
    await adminClient
      .from("store_contracts")
      .insert({
        store_id: testRestaurantId,
        pricing_model: "per_customer",
        menu_markup_percentage: 0.0,
        valid_from: new Date().toISOString(),
      });

    // فرع المطعم
    const { data: rBranch, error: rbErr } = await adminClient
      .from("store_branches")
      .insert({
        store_id: testRestaurantId,
        city_id: testCityId,
        name_ar: "فرع المطعم الرئيسي",
        name_en: "Main Restaurant Branch",
        location: "SRID=4326;POINT(39.1450 21.5645)",
        address_text: "حي الروضة، جدة",
        is_active: false,
        default_prep_time_minutes: 20,
        min_order_halalas: 2500, // 25 ر.س
        working_hours: [
          {
            day_of_week: 0,
            open_time: "16:00",
            close_time: "02:00", // دوام يتجاوز منتصف الليل
            is_closed: false,
          },
          {
            day_of_week: 1,
            open_time: "16:00",
            close_time: "02:00",
            is_closed: false,
          },
          {
            day_of_week: 2,
            open_time: "16:00",
            close_time: "02:00",
            is_closed: false,
          },
          {
            day_of_week: 3,
            open_time: "16:00",
            close_time: "02:00",
            is_closed: false,
          },
          {
            day_of_week: 4,
            open_time: "16:00",
            close_time: "02:00",
            is_closed: false,
          },
          {
            day_of_week: 5,
            open_time: "16:00",
            close_time: "02:00",
            is_closed: false,
          },
          {
            day_of_week: 6,
            open_time: "16:00",
            close_time: "02:00",
            is_closed: false,
          },
        ] as any,
      })
      .select("id")
      .single();
    if (rbErr) throw rbErr;
    restBranchId = rBranch!.id;
    await activateBranch(restBranchId);

    // قسم وصنف عادي في المطعم
    const { data: sec } = await adminClient
      .from("menu_sections")
      .insert({
        store_id: testRestaurantId,
        name_ar: "الأطباق الرئيسية",
        name_en: "Main Dishes",
      })
      .select("id")
      .single();

    const { data: item40 } = await adminClient
      .from("menu_items")
      .insert({
        section_id: sec!.id,
        name_ar: "وجبة شاورما 40",
        name_en: "Shawarma Meal 40",
        base_price_halalas: 4000, // 40 ر.س
        prep_time_minutes: 20,
        calories_value: 650,
        is_published: true,
        is_available: true,
      })
      .select("id")
      .single();
    testItemId = item40!.id;

    // صنف بأحجام إلزامية
    const { data: itemWithSize } = await adminClient
      .from("menu_items")
      .insert({
        section_id: sec!.id,
        name_ar: "بيتزا بأحجام",
        name_en: "Pizza with sizes",
        base_price_halalas: 3000,
        prep_time_minutes: 25,
        calories_value: 800,
        is_published: true,
        is_available: true,
      })
      .select("id")
      .single();
    testItemWithSizeId = itemWithSize!.id;

    const { data: size } = await adminClient
      .from("menu_item_sizes")
      .insert({
        item_id: testItemWithSizeId,
        name_ar: "كبير",
        name_en: "Large",
        price_delta_halalas: 1500, // 15 ر.س زيادة على الأساس 3000 = 4500 هللة
        is_default: true,
      })
      .select("id")
      .single();
    testSizeId = size!.id;

    // 5. متجر مارت (mart)
    const { data: mart } = await adminClient
      .from("stores")
      .insert({
        merchant_id: testMerchantId,
        city_id: testCityId,
        name_ar: "مارت السريع",
        name_en: "Quick Mart",
        store_type: "contracted_menu",
        operation_type: "mart",
        menu_slug: "mart-test-" + Date.now(),
      })
      .select("id")
      .single();
    testMartId = mart!.id;

    // عقد المارت: 5% زيادة افتراضية
    await adminClient
      .from("store_contracts")
      .insert({
        store_id: testMartId,
        pricing_model: "per_customer",
        mart_pharmacy_customer_markup_percentage: 5.0,
        valid_from: new Date().toISOString(),
      });

    const { data: mBranch } = await adminClient
      .from("store_branches")
      .insert({
        store_id: testMartId,
        city_id: testCityId,
        name_ar: "فرع المارت",
        name_en: "Mart Branch",
        location: "SRID=4326;POINT(39.1450 21.5645)",
        address_text: "حي الروضة، جدة",
        is_active: false,
        default_prep_time_minutes: 10,
        min_order_halalas: 1000,
      })
      .select("id")
      .single();
    martBranchId = mBranch!.id;
    await activateBranch(martBranchId);

    // 6. متجر بزيادة 10% للمنصة
    const { data: s10 } = await adminClient
      .from("stores")
      .insert({
        merchant_id: testMerchantId,
        city_id: testCityId,
        name_ar: "متجر زيادة 10%",
        name_en: "Store 10% Markup",
        store_type: "contracted_menu",
        operation_type: "restaurant",
        menu_slug: "s10-test-" + Date.now(),
      })
      .select("id")
      .single();
    testMarkup10StoreId = s10!.id;

    await adminClient
      .from("store_contracts")
      .insert({
        store_id: testMarkup10StoreId,
        pricing_model: "per_customer",
        menu_markup_percentage: 10.0,
        valid_from: new Date().toISOString(),
      });

    // 7. متجر بزيادة 15% (10 منصة + 5 تاجر)
    const { data: s15 } = await adminClient
      .from("stores")
      .insert({
        merchant_id: testMerchantId,
        city_id: testCityId,
        name_ar: "متجر زيادة 15%",
        name_en: "Store 15% Markup",
        store_type: "contracted_menu",
        operation_type: "restaurant",
        menu_slug: "s15-test-" + Date.now(),
      })
      .select("id")
      .single();
    testMarkup15StoreId = s15!.id;

    await adminClient
      .from("store_contracts")
      .insert({
        store_id: testMarkup15StoreId,
        pricing_model: "per_customer",
        menu_markup_percentage: 15.0,
        valid_from: new Date().toISOString(),
      });

    // 8. متجر بزيادة 5% للتاجر
    const { data: s5 } = await adminClient
      .from("stores")
      .insert({
        merchant_id: testMerchantId,
        city_id: testCityId,
        name_ar: "متجر زيادة 5%",
        name_en: "Store 5% Markup",
        store_type: "contracted_menu",
        operation_type: "restaurant",
        menu_slug: "s5-test-" + Date.now(),
      })
      .select("id")
      .single();
    testMarkup5StoreId = s5!.id;

    await adminClient
      .from("store_contracts")
      .insert({
        store_id: testMarkup5StoreId,
        pricing_model: "per_customer",
        menu_markup_percentage: 5.0,
        valid_from: new Date().toISOString(),
      });
  }, 60000);

  afterAll(async () => {
    // تنظيف البيانات
    if (testMerchantId) {
      await adminClient.from("merchants").delete().eq("id", testMerchantId);
    }
    if (noFeeCityId) {
      await adminClient.from("setting_values").delete().eq("entity_id", noFeeCityId);
      await adminClient.from("cities").delete().eq("id", noFeeCityId);
    }
  });

  describe("1. حساب رسوم الخدمة والأسعار من جدول docs/spec/13-money.md حرفياً", () => {
    it("النوع الأول، صنف 40، توصيل 15 -> خدمة 1.38 ر.س، مجموع 56.38 ر.س", async () => {
      const { data: serviceFee } = await adminClient.rpc("calculate_service_fee", {
        p_city_id: testCityId,
        p_products_halalas: 4000,
        p_delivery_halalas: 1500,
      });

      expect(serviceFee).toBe(138); // 1.38 ر.س = 138 هللة (2.5% من 5500 = 137.5 -> 138)
      const total = 4000 + 1500 + serviceFee!;
      expect(total).toBe(5638); // 56.38 ر.س
    });

    it("النوع الأول، صنف 20، توصيل 15 -> خدمة 0.88 ر.س، مجموع 35.88 ر.س", async () => {
      const { data: serviceFee } = await adminClient.rpc("calculate_service_fee", {
        p_city_id: testCityId,
        p_products_halalas: 2000,
        p_delivery_halalas: 1500,
      });

      expect(serviceFee).toBe(88); // 0.88 ر.س = 88 هللة (2.5% من 3500 = 87.5 -> 88)
      const total = 2000 + 1500 + serviceFee!;
      expect(total).toBe(3588); // 35.88 ر.س
    });

    it("بدون خصم، زيادة 10% للمنصة، صنف 40 -> الصنف 44 ر.س، خدمة 1.48 ر.س، المجموع 60.48 ر.س", async () => {
      const { data: custPrice } = await adminClient.rpc("calculate_customer_item_price", {
        p_store_id: testMarkup10StoreId,
        p_base_price_halalas: 4000,
      });

      expect(custPrice).toBe(4400); // 44.00 ر.س

      const { data: serviceFee } = await adminClient.rpc("calculate_service_fee", {
        p_city_id: testCityId,
        p_products_halalas: custPrice!,
        p_delivery_halalas: 1500,
      });

      expect(serviceFee).toBe(148); // 2.5% من 5900 = 147.5 -> 148 هللة
      const total = custPrice! + 1500 + serviceFee!;
      expect(total).toBe(6048); // 60.48 ر.س
    });

    it("زيادة 15% (10 منصة و5 تاجر)، صنف 40 -> الصنف 46 ر.س، المجموع 62.53 ر.س (PAY-004)", async () => {
      const { data: custPrice } = await adminClient.rpc("calculate_customer_item_price", {
        p_store_id: testMarkup15StoreId,
        p_base_price_halalas: 4000,
      });

      expect(custPrice).toBe(4600); // 46.00 ر.س

      const { data: serviceFee } = await adminClient.rpc("calculate_service_fee", {
        p_city_id: testCityId,
        p_products_halalas: custPrice!,
        p_delivery_halalas: 1500,
      });

      expect(serviceFee).toBe(153); // 2.5% من 6100 = 152.5 -> 153 هللة
      const total = custPrice! + 1500 + serviceFee!;
      expect(total).toBe(6253); // 62.53 ر.س
    });

    it("زيادة 5% للتاجر، صنف 40 -> الصنف 42 ر.س، المجموع 58.43 ر.س", async () => {
      const { data: custPrice } = await adminClient.rpc("calculate_customer_item_price", {
        p_store_id: testMarkup5StoreId,
        p_base_price_halalas: 4000,
      });

      expect(custPrice).toBe(4200); // 42.00 ر.س

      const { data: serviceFee } = await adminClient.rpc("calculate_service_fee", {
        p_city_id: testCityId,
        p_products_halalas: custPrice!,
        p_delivery_halalas: 1500,
      });

      expect(serviceFee).toBe(143); // 2.5% من 5700 = 142.5 -> 143 هللة
      const total = custPrice! + 1500 + serviceFee!;
      expect(total).toBe(5843); // 58.43 ر.س
    });

    it("مارت، أصناف بـ 100 ر.س -> المنتجات 105، التوصيل 12، الخدمة 2.93، المجموع 119.93 ر.س", async () => {
      const { data: custPrice } = await adminClient.rpc("calculate_customer_item_price", {
        p_store_id: testMartId,
        p_base_price_halalas: 10000,
      });

      expect(custPrice).toBe(10500); // 105.00 ر.س (5% زيادة)

      const { data: serviceFee } = await adminClient.rpc("calculate_service_fee", {
        p_city_id: testCityId,
        p_products_halalas: custPrice!,
        p_delivery_halalas: 1200, // توصيل المارت 12 ر.س
      });

      expect(serviceFee).toBe(293); // 2.5% من 11700 = 292.5 -> 293 هللة
      const total = custPrice! + 1200 + serviceFee!;
      expect(total).toBe(11993); // 119.93 ر.س
    });

    it("منتجات 100 وتوصيل 15 -> الخدمة 2.88 ر.س (PAY-021)", async () => {
      const { data: serviceFee } = await adminClient.rpc("calculate_service_fee", {
        p_city_id: testCityId,
        p_products_halalas: 10000,
        p_delivery_halalas: 1500,
      });

      expect(serviceFee).toBe(288); // 2.5% من 11500 = 287.5 -> 288 هللة
    });

    it("منتجات 90 وتوصيل 9 -> الخدمة 2.48 ر.س", async () => {
      const { data: serviceFee } = await adminClient.rpc("calculate_service_fee", {
        p_city_id: testCityId,
        p_products_halalas: 9000,
        p_delivery_halalas: 900,
      });

      expect(serviceFee).toBe(248); // 2.5% من 9900 = 247.5 -> 248 هللة
    });
  });

  describe("2. قواعد التوصيل والخدمة والحدود (PAY-013, PAY-021)", () => {
    it("مدينة رسوم الخدمة فيها غير مفعّلة: ترجع 0 دائماً (PAY-021)", async () => {
      const { data: serviceFee } = await adminClient.rpc("calculate_service_fee", {
        p_city_id: noFeeCityId,
        p_products_halalas: 5000,
        p_delivery_halalas: 1500,
      });

      expect(serviceFee).toBe(0);
    });

    it("رسوم التوصيل: الأساسي للمطعم 1500 لمسافة ضمن 3 كم (PAY-013)", async () => {
      const { data: fee } = await adminClient.rpc("calculate_delivery_fee", {
        p_store_id: testRestaurantId,
        p_branch_id: restBranchId,
        p_distance_km: 2.5,
        p_city_id: testCityId,
      });

      expect(fee).toBe(1500); // 15 ر.س
    });

    it("رسوم التوصيل: الأساسي للمارت 1200 لمسافة ضمن 3 كم (PAY-013)", async () => {
      const { data: fee } = await adminClient.rpc("calculate_delivery_fee", {
        p_store_id: testMartId,
        p_branch_id: martBranchId,
        p_distance_km: 2.0,
        p_city_id: testCityId,
      });

      expect(fee).toBe(1200); // 12 ر.س
    });

    it("رسوم التوصيل: مسافة زائدة (5.2 كم = 3 مشمول + 3 إضافي لأعلى = 1500 + 300 = 1800)", async () => {
      const { data: fee } = await adminClient.rpc("calculate_delivery_fee", {
        p_store_id: testRestaurantId,
        p_branch_id: restBranchId,
        p_distance_km: 5.2,
        p_city_id: testCityId,
      });

      expect(fee).toBe(1800); // 18 ر.س
    });

    it("رسوم التوصيل فوق الحد الأقصى (30 ر.س) تُحصر عند الحد الأقصى 3000 هللة (PAY-013)", async () => {
      const { data: fee } = await adminClient.rpc("calculate_delivery_fee", {
        p_store_id: testRestaurantId,
        p_branch_id: restBranchId,
        p_distance_km: 50.0, // 50 كم
        p_city_id: testCityId,
      });

      expect(fee).toBe(3000); // الحد الأقصى 30 ر.س
    });
  });

  describe("3. تقدير الأوقات وساعات العمل (ORD-011, MER-001)", () => {
    it("وقت التحضير للعميل = الحقيقي + 5 دقائق بالضبط (ORD-011)", async () => {
      const { data: timeEst } = await adminClient.rpc("estimate_delivery_time", {
        p_prep_time_minutes: 20,
        p_distance_km: 2.5,
        p_city_id: testCityId,
      });

      const est = timeEst as any;
      expect(est.actual_prep_minutes).toBe(20);
      expect(est.customer_prep_minutes).toBe(25); // 20 + 5 = 25
      expect(est.display_range).toBeDefined();
    });

    it("فحص دوام الفرع المتجاوز لمنتصف الليل (16:00 إلى 02:00)", async () => {
      // فحص الساعة 01:00 فجراً (اليوم التالي للدوام المتجاوز لمنتصف الليل)
      const tsOpen = "2026-09-30T01:00:00+03:00";
      const { data: statusOpen } = await adminClient.rpc("check_branch_open_status", {
        p_branch_id: restBranchId,
        p_check_time: tsOpen,
      });

      expect((statusOpen as any).is_open).toBe(true);

      // فحص الساعة 03:00 فجراً (بعد الإغلاق)
      const tsClosed = "2026-09-30T03:00:00+03:00";
      const { data: statusClosed } = await adminClient.rpc("check_branch_open_status", {
        p_branch_id: restBranchId,
        p_check_time: tsClosed,
      });

      expect((statusClosed as any).is_open).toBe(false);
    });
  });

  describe("4. حماية منيو العميل customer_menu وحساب السلة quote_cart (CUS-005, CRT-005)", () => {
    it("customer_menu لا يكشف سعر المحل الأصلي ولا بنود العقد (PAY-004)", async () => {
      const { data: menuData } = await anonClient.rpc("customer_menu", {
        p_store_id: testRestaurantId,
      });

      const sections = menuData as any[];
      expect(sections.length).toBeGreaterThan(0);
      const items = sections[0].items;
      expect(items.length).toBeGreaterThan(0);

      for (const item of items) {
        expect(item.customer_price_halalas).toBeDefined();
        // التحقق من عدم وجود الحقول الحساسة
        expect(item.base_price_halalas).toBeUndefined();
        expect(item.contract).toBeUndefined();
        expect(item.commission_rate).toBeUndefined();
      }
    });

    it("quote_cart يرفض الصنف الذي ينقصه حجمه الإلزامي (CUS-005)", async () => {
      // إرسال الصنف الذي له حجم بدون size_id
      const { data: quoteRes, error: qErr } = await anonClient.rpc("quote_cart", {
        p_store_id: testRestaurantId,
        p_lat: 21.5645,
        p_lng: 39.1450,
        p_items: [
          {
            item_id: testItemWithSizeId,
            quantity: 1,
            // بدون size_id
          },
        ] as any,
      });

      expect(qErr).toBeNull();
      const res = quoteRes as any;
      expect(res.success).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
      expect(res.errors[0].reason).toContain("حجم");
    });

    it("quote_cart يحسب السلة بنجاح ويطبق القاعدة الذهبية: مجموع البنود = المجموع (CRT-005)", async () => {
      const { data: quoteRes, error: qErr } = await anonClient.rpc("quote_cart", {
        p_store_id: testRestaurantId,
        p_lat: 21.5645,
        p_lng: 39.1450,
        p_items: [
          {
            item_id: testItemId,
            quantity: 1, // 4000 هللة
          },
          {
            item_id: testItemWithSizeId,
            size_id: testSizeId,
            quantity: 1, // 4500 هللة
          },
        ] as any,
        p_device_lat: 21.5645,
        p_device_lng: 39.1450,
      });

      expect(qErr).toBeNull();
      const res = quoteRes as any;
      expect(res.success).toBe(true);
      expect(res.products_total_halalas).toBe(8500); // 4000 + 4500
      expect(res.delivery_fee_halalas).toBeGreaterThan(0);
      expect(res.service_fee_halalas).toBeGreaterThan(0);

      // القاعدة الذهبية (CRT-005)
      const expectedTotal = res.products_total_halalas + res.delivery_fee_halalas + res.service_fee_halalas;
      expect(res.total_halalas).toBe(expectedTotal);
      expect(res.pricing_snapshot).toBeDefined();
      expect(res.is_device_location_divergent).toBe(false);
    });

    it("quote_cart ينبه عند تباعد موقع الجهاز عن العنوان لأكثر من 250 متر (CUS-002)", async () => {
      const { data: quoteRes, error: qErr } = await anonClient.rpc("quote_cart", {
        p_store_id: testRestaurantId,
        p_lat: 21.5645,
        p_lng: 39.1450,
        p_items: [
          {
            item_id: testItemId,
            quantity: 1,
          },
        ] as any,
        // إحداثيات الجهاز تبعد عدة كيلومترات
        p_device_lat: 21.65,
        p_device_lng: 39.25,
      });

      expect(qErr).toBeNull();
      const res = quoteRes as any;
      expect(res.success).toBe(true);
      expect(res.is_device_location_divergent).toBe(true);
    });

    it("quote_cart يرفض إحداثيات خارج نطاق تغطية المدن المفعّلة (DSP-002)", async () => {
      const { data: quoteRes } = await anonClient.rpc("quote_cart", {
        p_store_id: testRestaurantId,
        p_lat: 18.00, // الربع الخالي
        p_lng: 50.00,
        p_items: [
          {
            item_id: testItemId,
            quantity: 1,
          },
        ] as any,
      });

      const res = quoteRes as any;
      expect(res.success).toBe(false);
      expect(res.error).toContain("خارج نطاق تغطية");
    });
  });
});
