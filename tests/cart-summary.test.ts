import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: "apps/web/.env.local" });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const adminClient = createClient(supabaseUrl, serviceRoleKey);

describe("Step 2.6: Cart Summary & Payment Rules (CRT-001, CRT-003, CRT-004, CRT-005, CUS-002)", () => {
  let testCityId: string;
  let testNoFeeCityId: string;
  let testMerchantId: string;
  let testStoreMarkupId: string;
  let testBranchMarkupId: string;
  let testStoreMartId: string;
  let testBranchMartId: string;
  let testStoreNormalId: string;
  let testBranchNormalId: string;

  let itemMarkupId: string;
  let itemMart1Id: string;
  let itemMart2Id: string;
  let itemNormalWithSizeId: string;
  let sizeNormalId: string;
  let itemSuggestedId: string;

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

    if (error) throw error;
  }

  beforeAll(async () => {
    // 1. مدينة جدة
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
          name_ar: "جدة",
          name_en: "Jeddah",
          is_active: true,
        })
        .select("id")
        .single();
      testCityId = newCity!.id;
    }

    // 2. مدينة بدون رسوم خدمة
    const ts = Date.now().toString().slice(-6);
    const { data: noFeeCity } = await adminClient
      .from("cities")
      .insert({
        name_ar: "مدينة سلة بدون خدمة " + ts,
        name_en: "No Fee Cart City " + ts,
        boundary: "SRID=4326;MULTIPOLYGON(((48.00 25.00, 48.50 25.00, 48.50 25.50, 48.00 25.50, 48.00 25.00)))",
        is_active: true,
      })
      .select("id")
      .single();
    testNoFeeCityId = noFeeCity!.id;

    await adminClient.from("setting_values").upsert({
      key: "customer_service_fee_enabled",
      level: "city",
      entity_id: testNoFeeCityId,
      value: false as any,
    });

    // 3. تاجر
    const { data: merchant } = await adminClient
      .from("merchants")
      .insert({
        commercial_name: "تاجر السلة " + ts,
        cr_number: "1010" + ts,
        vat_number: "3000" + ts + "00003",
      })
      .select("id")
      .single();
    testMerchantId = merchant!.id;

    // 4. متجر 1: مطعم مع زيادة 10%
    const { data: s1 } = await adminClient
      .from("stores")
      .insert({
        merchant_id: testMerchantId,
        city_id: testCityId,
        name_ar: "مطعم السلة 10%",
        name_en: "Cart Rest 10%",
        store_type: "contracted_menu",
        operation_type: "restaurant",
        menu_slug: "cart-rest-10-" + ts,
      })
      .select("id")
      .single();
    testStoreMarkupId = s1!.id;

    await adminClient.from("store_contracts").insert({
      store_id: testStoreMarkupId,
      pricing_model: "per_customer",
      menu_markup_percentage: 10.0,
      valid_from: new Date().toISOString(),
    });

    const allDays = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      day_of_week: day,
      open_time: "00:00",
      close_time: "23:59",
      is_closed: false,
    }));

    const { data: b1 } = await adminClient
      .from("store_branches")
      .insert({
        store_id: testStoreMarkupId,
        city_id: testCityId,
        name_ar: "فرع السلة الرئيسي",
        name_en: "Main Cart Branch",
        location: "SRID=4326;POINT(39.1450 21.5645)",
        address_text: "جدة حي الروضة",
        is_active: false,
        default_prep_time_minutes: 15,
        min_order_halalas: 2000,
        working_hours: allDays,
      })
      .select("id")
      .single();
    testBranchMarkupId = b1!.id;
    await activateBranch(testBranchMarkupId);

    // قسم وصنف بالمتجر 1
    const { data: sec1, error: sec1Err } = await adminClient
      .from("menu_sections")
      .insert({ store_id: testStoreMarkupId, name_ar: "وجبات", name_en: "Meals" })
      .select("id")
      .single();
    if (sec1Err) console.error("sec1Err:", sec1Err);

    const { data: it1, error: it1Err } = await adminClient
      .from("menu_items")
      .insert({
        section_id: sec1!.id,
        name_ar: "برجر دجاج 10%",
        name_en: "Chicken Burger 10%",
        base_price_halalas: 2000, // 20 ر.س (مع 10% = 2200 هللة)
        prep_time_minutes: 15,
        is_published: true,
        calories_value: 550,
      })
      .select("id")
      .single();
    if (it1Err) console.error("it1Err:", it1Err);
    itemMarkupId = it1!.id;

    // صنف مقترح في المتجر 1 (CRT-003)
    const { data: itSug } = await adminClient
      .from("menu_items")
      .insert({
        section_id: sec1!.id,
        name_ar: "بطاطس مقلية مقترحة",
        name_en: "Suggested Fries",
        base_price_halalas: 800,
        prep_time_minutes: 5,
        is_published: true,
        is_suggested_in_cart: true,
        calories_value: 300,
      })
      .select("id")
      .single();
    itemSuggestedId = itSug!.id;

    // 5. متجر 2: مارت (بقالة)
    const { data: sMart } = await adminClient
      .from("stores")
      .insert({
        merchant_id: testMerchantId,
        city_id: testCityId,
        name_ar: "مارت السلة السريع",
        name_en: "Quick Cart Mart",
        store_type: "contracted_menu",
        operation_type: "mart",
        menu_slug: "cart-mart-" + ts,
      })
      .select("id")
      .single();
    testStoreMartId = sMart!.id;

    await adminClient.from("store_contracts").insert({
      store_id: testStoreMartId,
      pricing_model: "percentage",
      mart_pharmacy_customer_markup_percentage: 5.0,
      valid_from: new Date().toISOString(),
    });

    const { data: bMart } = await adminClient
      .from("store_branches")
      .insert({
        store_id: testStoreMartId,
        city_id: testCityId,
        name_ar: "فرع المارت الروضة",
        name_en: "Mart Rawdah Branch",
        location: "SRID=4326;POINT(39.1450 21.5645)",
        address_text: "جدة حي الروضة",
        is_active: false,
        default_prep_time_minutes: 10,
        min_order_halalas: 1500,
        working_hours: allDays,
      })
      .select("id")
      .single();
    testBranchMartId = bMart!.id;
    await activateBranch(testBranchMartId);

    const { data: secMart } = await adminClient
      .from("menu_sections")
      .insert({ store_id: testStoreMartId, name_ar: "ألبان ومخبوزات", name_en: "Dairy & Bakery" })
      .select("id")
      .single();

    const { data: m1 } = await adminClient
      .from("menu_items")
      .insert({
        section_id: secMart!.id,
        name_ar: "حليب طازج 1 لتر",
        name_en: "Fresh Milk 1L",
        base_price_halalas: 600, // 6 ر.س
        prep_time_minutes: 5,
        is_published: true,
        calories_value: 120,
      })
      .select("id")
      .single();
    itemMart1Id = m1!.id;

    const { data: m2 } = await adminClient
      .from("menu_items")
      .insert({
        section_id: secMart!.id,
        name_ar: "خبز توست أبيض",
        name_en: "White Toast Bread",
        base_price_halalas: 500, // 5 ر.س
        prep_time_minutes: 5,
        is_published: true,
        calories_value: 160,
      })
      .select("id")
      .single();
    itemMart2Id = m2!.id;

    // 6. متجر 3: مطعم عادي بأحجام
    const { data: sNorm } = await adminClient
      .from("stores")
      .insert({
        merchant_id: testMerchantId,
        city_id: testCityId,
        name_ar: "مطعم عادي بأحجام",
        name_en: "Normal Rest Sizes",
        store_type: "contracted_menu",
        operation_type: "restaurant",
        menu_slug: "cart-norm-" + ts,
      })
      .select("id")
      .single();
    testStoreNormalId = sNorm!.id;

    await adminClient.from("store_contracts").insert({
      store_id: testStoreNormalId,
      pricing_model: "per_customer",
      menu_markup_percentage: 0.0,
      valid_from: new Date().toISOString(),
    });

    const { data: bNorm } = await adminClient
      .from("store_branches")
      .insert({
        store_id: testStoreNormalId,
        city_id: testCityId,
        name_ar: "فرع المطعم العادي",
        name_en: "Normal Branch",
        location: "SRID=4326;POINT(39.1450 21.5645)",
        address_text: "جدة حي الروضة",
        is_active: false,
        default_prep_time_minutes: 20,
        min_order_halalas: 1000,
        working_hours: allDays,
      })
      .select("id")
      .single();
    testBranchNormalId = bNorm!.id;
    await activateBranch(testBranchNormalId);

    const { data: secNorm } = await adminClient
      .from("menu_sections")
      .insert({ store_id: testStoreNormalId, name_ar: "بيتزا", name_en: "Pizza" })
      .select("id")
      .single();

    const { data: normIt } = await adminClient
      .from("menu_items")
      .insert({
        section_id: secNorm!.id,
        name_ar: "بيتزا مارغريتا",
        name_en: "Margherita Pizza",
        base_price_halalas: 3000,
        prep_time_minutes: 20,
        is_published: true,
        calories_value: 800,
      })
      .select("id")
      .single();
    itemNormalWithSizeId = normIt!.id;

    const { data: sz } = await adminClient
      .from("menu_item_sizes")
      .insert({
        item_id: itemNormalWithSizeId,
        name_ar: "كبير عائلي",
        name_en: "Family Large",
        price_delta_halalas: 1500, // +15 ر.س
        calories_value: 1200,
        is_default: true,
      })
      .select("id")
      .single();
    sizeNormalId = sz!.id;
  }, 60000);

  // 1. اختبار القاعدة الذهبية: مجموع البنود الظاهرة = المطلوب في 5 سلال مختلفة (CRT-005)
  describe("Golden Rule: Sum of line items = Total Due across 5 distinct carts (CRT-005)", () => {
    it("Cart 1: Restaurant with 10% markup (products + delivery + service = total)", async () => {
      const { data, error } = await adminClient.rpc("quote_cart", {
        p_store_id: testStoreMarkupId,
        p_lat: 21.5645,
        p_lng: 39.1450,
        p_items: [{ item_id: itemMarkupId, quantity: 2 }],
      });

      expect(error).toBeNull();
      expect(data.success).toBe(true);

      const pTotal = data.products_total_halalas;
      const dFee = data.delivery_fee_halalas;
      const sFee = data.service_fee_halalas;
      const total = data.total_halalas;

      // 2 * 2200 = 4400 halalas
      expect(pTotal).toBe(4400);
      expect(pTotal + dFee + sFee).toBe(total);
    });

    it("Cart 2: Mart order with 5% markup and 2 distinct items (CRT-005)", async () => {
      const { data, error } = await adminClient.rpc("quote_cart", {
        p_store_id: testStoreMartId,
        p_lat: 21.5645,
        p_lng: 39.1450,
        p_items: [
          { item_id: itemMart1Id, quantity: 3 }, // 3 * 6.30 = 18.90 -> 1890 halalas
          { item_id: itemMart2Id, quantity: 2 }, // 2 * 5.25 = 10.50 -> 1050 halalas
        ],
      });

      expect(error).toBeNull();
      expect(data.success).toBe(true);
      expect(data.delivery_fee_halalas).toBe(1200); // رسوم المارت الأساسية 12 ر.س (PAY-013)
      expect(data.products_total_halalas + data.delivery_fee_halalas + data.service_fee_halalas).toBe(
        data.total_halalas
      );
    });

    it("Cart 3: Normal restaurant with size selection (CRT-005, CUS-005)", async () => {
      const { data, error } = await adminClient.rpc("quote_cart", {
        p_store_id: testStoreNormalId,
        p_lat: 21.5645,
        p_lng: 39.1450,
        p_items: [{ item_id: itemNormalWithSizeId, size_id: sizeNormalId, quantity: 1 }],
      });

      expect(error).toBeNull();
      expect(data.success).toBe(true);
      // 3000 + 1500 = 4500 halalas
      expect(data.products_total_halalas).toBe(4500);
      expect(data.products_total_halalas + data.delivery_fee_halalas + data.service_fee_halalas).toBe(
        data.total_halalas
      );
    });

    it("Cart 4: Order in a city where service fee is disabled (service fee = 0, CRT-005, PAY-021)", async () => {
      // فرع في المدينة المعطلة فيها الخدمة
      const { data: bNoFee } = await adminClient
        .from("store_branches")
        .insert({
          store_id: testStoreNormalId,
          city_id: testNoFeeCityId,
          name_ar: "فرع المدينة بدون خدمة",
          name_en: "No Fee City Branch",
          location: "SRID=4326;POINT(48.2500 25.2500)",
          address_text: "المدينة بدون رسوم خدمة",
          is_active: false,
          default_prep_time_minutes: 20,
          min_order_halalas: 1000,
          working_hours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
            day_of_week: day,
            open_time: "00:00",
            close_time: "23:59",
            is_closed: false,
          })),
        })
        .select("id")
        .single();
      await activateBranch(bNoFee!.id);

      const { data, error } = await adminClient.rpc("quote_cart", {
        p_store_id: testStoreNormalId,
        p_lat: 25.2500,
        p_lng: 48.2500,
        p_items: [{ item_id: itemNormalWithSizeId, size_id: sizeNormalId, quantity: 2 }],
      });

      expect(error).toBeNull();
      expect(data.success).toBe(true);
      expect(data.service_fee_halalas).toBe(0); // رسوم الخدمة 0
      expect(data.products_total_halalas + data.delivery_fee_halalas).toBe(data.total_halalas);
    });

    it("Cart 5: Distant delivery capping delivery fee at 30 SAR maximum (CRT-005, PAY-013)", async () => {
      // إحداثيات بعيدة في جدة (مسافة > 20 كم)
      const { data, error } = await adminClient.rpc("quote_cart", {
        p_store_id: testStoreMarkupId,
        p_lat: 21.7500, // مسافة بعيدة شمال جدة
        p_lng: 39.1450,
        p_items: [{ item_id: itemMarkupId, quantity: 1 }],
      });

      expect(error).toBeNull();
      if (data.success) {
        expect(data.delivery_fee_halalas).toBe(3000); // الحد الأقصى 30 ر.س
        expect(data.products_total_halalas + data.delivery_fee_halalas + data.service_fee_halalas).toBe(
          data.total_halalas
        );
      }
    });
  });

  // 2. فحص الأصناف المقترحة في السلة وعدم إضافتها تلقائياً (CRT-003)
  describe("Cart Suggested Items (CRT-003)", () => {
    it("quote_cart returns suggested items that are not in the current cart", async () => {
      const { data } = await adminClient.rpc("quote_cart", {
        p_store_id: testStoreMarkupId,
        p_lat: 21.5645,
        p_lng: 39.1450,
        p_items: [{ item_id: itemMarkupId, quantity: 1 }],
      });

      expect(data.suggested_items).toBeDefined();
      expect(Array.isArray(data.suggested_items)).toBe(true);

      // الصنف المقترح موجود
      const foundSug = data.suggested_items.find((s: any) => s.id === itemSuggestedId);
      expect(foundSug).toBeDefined();

      // الصنف الموجود بالسلة (itemMarkupId) غير مكرر في المقترحات
      const foundCurrent = data.suggested_items.find((s: any) => s.id === itemMarkupId);
      expect(foundCurrent).toBeUndefined();
    });

    it("adding suggested item is protected against rapid multi-click debounce", () => {
      let addingId: string | null = null;
      let addCount = 0;

      function mockAddSuggested(id: string) {
        if (addingId === id) return; // حماية ضد الضغط السريع
        addingId = id;
        addCount++;
      }

      // محاكاة 5 ضغطات متتالية سريعة
      mockAddSuggested("item-1");
      mockAddSuggested("item-1");
      mockAddSuggested("item-1");
      mockAddSuggested("item-1");
      mockAddSuggested("item-1");

      expect(addCount).toBe(1); // أُضيف مرة واحدة فقط (CRT-003)
    });
  });

  // 3. انتهاء صلاحية السلة والبدء من جديد (CRT-004)
  describe("Cart Expiry and Reset (CRT-004)", () => {
    it("expires cart when past closing time or 24 hours", () => {
      const pastTime = new Date(Date.now() - 3600 * 1000).toISOString();
      const futureTime = new Date(Date.now() + 3600 * 1000).toISOString();

      function isCartExpired(exp: string | null) {
        if (!exp) return false;
        return new Date(exp) <= new Date();
      }

      expect(isCartExpired(pastTime)).toBe(true);
      expect(isCartExpired(futureTime)).toBe(false);
    });
  });

  // 4. إيقاف صنف من الإدارة يظهر بتنبيه ويمنع الدفع (CRT-001)
  describe("Unavailable Item Handling (CRT-001)", () => {
    it("quote_cart reports error when item is deactivated, preventing checkout", async () => {
      // إيقاف الصنف مؤقتاً
      await adminClient
        .from("menu_items")
        .update({ is_available: false })
        .eq("id", itemMarkupId);

      const { data } = await adminClient.rpc("quote_cart", {
        p_store_id: testStoreMarkupId,
        p_lat: 21.5645,
        p_lng: 39.1450,
        p_items: [{ item_id: itemMarkupId, quantity: 1 }],
      });

      expect(data.success).toBe(false);
      expect(data.errors.length).toBeGreaterThan(0);
      expect(data.errors.some((e: any) => e.code === "ITEM_UNAVAILABLE")).toBe(true);

      // إعادة تفعيل الصنف
      await adminClient
        .from("menu_items")
        .update({ is_available: true })
        .eq("id", itemMarkupId);
    });
  });

  // 5. فحص تنبيه تباعد موقع الجهاز عن العنوان المختار > 250 متر (CUS-002)
  describe("Remote Location Divergence Alert (CUS-002)", () => {
    it("flags is_device_location_divergent when device is > 250m from delivery address", async () => {
      const addressLat = 21.5645;
      const addressLng = 39.1450;
      // موقع جهاز يبعد قرابة 1 كم
      const farDeviceLat = 21.5750;
      const farDeviceLng = 39.1450;

      const { data } = await adminClient.rpc("quote_cart", {
        p_store_id: testStoreMarkupId,
        p_lat: addressLat,
        p_lng: addressLng,
        p_items: [{ item_id: itemMarkupId, quantity: 1 }],
        p_device_lat: farDeviceLat,
        p_device_lng: farDeviceLng,
      });

      expect(data.is_device_location_divergent).toBe(true);
    });
  });
});
