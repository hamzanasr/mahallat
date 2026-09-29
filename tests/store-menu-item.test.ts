import { describe, it, expect, beforeAll } from "vitest";
import { formatCaloriesDisplay } from "@mahallat/shared";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: "apps/web/.env.local" });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const adminClient = createClient(supabaseUrl, serviceRoleKey);

describe("Step 2.5: Home, Categories, Store Page & Menu Item (CUS-005, CUS-009, CUS-019)", () => {
  let testCityId: string;
  let testMerchantId: string;
  let testStoreId: string;
  let testBranchId: string;
  let testSectionId: string;
  let testItemIdWithSizes: string;
  let testItemIdExempt: string;

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
    // 1. جلب مدينة جدة
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

    // 2. إنشاء تاجر تجريبي
    const ts = Date.now().toString().slice(-6);
    const { data: merchant, error: mErr } = await adminClient
      .from("merchants")
      .insert({
        commercial_name: "تاجر خطوة 2.5 " + ts,
        cr_number: "1010" + ts,
        vat_number: "3000" + ts + "00003",
      })
      .select("id")
      .single();

    if (mErr) throw mErr;
    testMerchantId = merchant!.id;

    // 3. إنشاء متجر مطعم
    const { data: store, error: sErr } = await adminClient
      .from("stores")
      .insert({
        merchant_id: testMerchantId,
        city_id: testCityId,
        name_ar: "شاورما وبطاطس تجربة 2.5",
        name_en: "Shawarma 2.5",
        store_type: "contracted_menu",
        operation_type: "restaurant",
        menu_slug: "shawarma-25-" + ts,
      })
      .select("id")
      .single();

    if (sErr) throw sErr;
    testStoreId = store!.id;

    // 4. عقد المتجر مع زيادة 10% على المنيو
    await adminClient.from("store_contracts").insert({
      store_id: testStoreId,
      pricing_model: "per_customer",
      menu_markup_percentage: 10.0,
      valid_from: new Date().toISOString(),
    });

    // 5. فرع في حي الروضة بجدة
    const allDaysHours = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      day_of_week: day,
      open_time: "00:00",
      close_time: "23:59",
      is_closed: false,
    }));

    const { data: branch, error: bErr } = await adminClient
      .from("store_branches")
      .insert({
        store_id: testStoreId,
        city_id: testCityId,
        name_ar: "فرع الروضة",
        name_en: "Al Rawdah Branch",
        location: "SRID=4326;POINT(39.1450 21.5645)",
        address_text: "حي الروضة، شارع الكيال، جدة",
        is_active: false,
        default_prep_time_minutes: 15,
        min_order_halalas: 2000, // 20 ر.س
        working_hours: allDaysHours,
      })
      .select("id")
      .single();

    if (bErr) throw bErr;
    testBranchId = branch!.id;

    await activateBranch(testBranchId);

    // 6. قسم منيو
    const { data: sec, error: secErr } = await adminClient
      .from("menu_sections")
      .insert({
        store_id: testStoreId,
        name_ar: "ساندوتشات",
        name_en: "Sandwiches",
        sort_order: 1,
      })
      .select("id")
      .single();

    if (secErr) throw secErr;
    testSectionId = sec!.id;

    // 7. صنف بأحجام ومجموعة خيارات
    const { data: item1, error: iErr } = await adminClient
      .from("menu_items")
      .insert({
        section_id: testSectionId,
        name_ar: "شاورما دجاج صاج",
        name_en: "Chicken Shawarma Saj",
        description_ar: "شاورما دجاج بالثوم والبطاطس",
        base_price_halalas: 1000, // 10 ر.س (مع 10% تصبح 1100 هللة)
        calories_value: 450,
        prep_time_minutes: 15,
        is_published: true,
        is_high_salt: true,
        caffeine_mg: 0,
        allergens: ["حليب", "غلوتين"],
      })
      .select("id")
      .single();

    if (iErr) throw iErr;
    testItemIdWithSizes = item1!.id;

    // إضافة أحجام
    await adminClient.from("menu_item_sizes").insert([
      {
        item_id: testItemIdWithSizes,
        name_ar: "صغير",
        name_en: "Small",
        price_delta_halalas: 0,
        calories_value: 380,
        is_default: false,
        sort_order: 1,
      },
      {
        item_id: testItemIdWithSizes,
        name_ar: "وسط",
        name_en: "Medium",
        price_delta_halalas: 500, // +5 ر.س
        calories_value: 520,
        is_default: true,
        sort_order: 2,
      },
      {
        item_id: testItemIdWithSizes,
        name_ar: "كبير",
        name_en: "Large",
        price_delta_halalas: 1000, // +10 ر.س
        calories_value: 750,
        is_default: false,
        sort_order: 3,
      },
    ]);

    // إضافة مجموعة خيارات إلزامية (نوع الصوص)
    const { data: optGroup } = await adminClient
      .from("menu_item_option_groups")
      .insert({
        item_id: testItemIdWithSizes,
        name_ar: "نوع الصوص",
        name_en: "Sauce Type",
        is_required: true,
        min_selectable: 1,
        max_selectable: 1,
        sort_order: 1,
      })
      .select("id")
      .single();

    await adminClient.from("menu_item_options").insert([
      {
        group_id: optGroup.id,
        name_ar: "ثوم إضافي",
        name_en: "Extra Garlic",
        price_delta_halalas: 100,
        calories_delta: 50,
      },
      {
        group_id: optGroup.id,
        name_ar: "حار",
        name_en: "Spicy",
        price_delta_halalas: 0,
        calories_delta: 20,
      },
    ]);

    // 8. صنف معفى من السعرات
    const { data: item2 } = await adminClient
      .from("menu_items")
      .insert({
        section_id: testSectionId,
        name_ar: "ماء نقي 330 مل",
        name_en: "Pure Water 330ml",
        base_price_halalas: 200,
        calories_value: 0,
        prep_time_minutes: 5,
        is_published: true,
        is_sfda_exempt: true,
      })
      .select("id")
      .single();

    testItemIdExempt = item2!.id;
  });

  // 1. اختبار دالة تنسيق السعرات المعتمدة (CUS-019)
  describe("SFDA Calories Formatter (CUS-019)", () => {
    it("returns null for calorie exempt items", () => {
      const result = formatCaloriesDisplay({
        caloriesValue: 0,
        isSfdaExempt: true,
      });
      expect(result).toBeNull();
    });

    it("formats single calorie value with 'سعرة حرارية'", () => {
      const result = formatCaloriesDisplay({
        caloriesValue: 350,
        lang: "ar",
      });
      expect(result).toBe("350 سعرة حرارية");
    });

    it("formats two calorie values with slash (X / Y)", () => {
      const result = formatCaloriesDisplay({
        variantsCalories: [300, 500],
        lang: "ar",
      });
      expect(result).toBe("300 / 500 سعرة");
    });

    it("formats three or more calorie values with range (X – Y)", () => {
      const result = formatCaloriesDisplay({
        variantsCalories: [380, 520, 750],
        lang: "ar",
      });
      expect(result).toBe("380–750 سعرة حرارية");
    });
  });

  // 2. فحص فلترة الأقسام والتصنيفات (CUS-009)
  describe("Section and Category Filtering (CUS-009)", () => {
    it("pharmacy section setting is disabled by default in settings", async () => {
      const { data } = await adminClient.rpc("get_setting", {
        p_key: "section_pharmacy_enabled",
      });
      expect(Boolean(data)).toBe(false);
    });

    it("stores_for_point returns nearby store in Rawdah Jeddah", async () => {
      const { data, error } = await adminClient.rpc("stores_for_point", {
        p_lat: 21.5645,
        p_lng: 39.1450,
      });

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      const found = data?.find((s: any) => s.store_id === testStoreId);
      expect(found).toBeDefined();
      expect(found.is_open).toBe(true);
      expect(found.min_order_halalas).toBe(2000);
    });

    it("stores_for_point filters correctly by section", async () => {
      const { data } = await adminClient.rpc("stores_for_point", {
        p_lat: 21.5645,
        p_lng: 39.1450,
        p_section: "retail",
      });

      const found = data?.find((s: any) => s.store_id === testStoreId);
      expect(found).toBeUndefined();
    });
  });

  // 3. فحص أسعار المنيو للعميل شاملة الزيادة ونسب العقد (CUS-005, CUS-019)
  describe("Customer Menu and Item Pricing", () => {
    it("returns customer_menu with 10% markup applied to base prices and sizes", async () => {
      const { data, error } = await adminClient.rpc("customer_menu", {
        p_store_id: testStoreId,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.store_id).toBe(testStoreId);
      expect(data.sections.length).toBeGreaterThan(0);

      const section = data.sections[0];
      const itemWithSizes = section.items.find((i: any) => i.id === testItemIdWithSizes);
      expect(itemWithSizes).toBeDefined();

      // base_price 1000 + 10% markup = 1100 halalas
      expect(itemWithSizes.customer_price_halalas).toBe(1100);
      expect(itemWithSizes.is_high_salt).toBe(true);
      expect(itemWithSizes.allergens).toContain("حليب");

      // فحص أسعار الأحجام:
      // صغير: (1000 + 0) * 1.10 = 1100
      // وسط: (1000 + 500) * 1.10 = 1650
      // كبير: (1000 + 1000) * 1.10 = 2200
      const smallSize = itemWithSizes.sizes.find((s: any) => s.name_ar === "صغير");
      const medSize = itemWithSizes.sizes.find((s: any) => s.name_ar === "وسط");
      const largeSize = itemWithSizes.sizes.find((s: any) => s.name_ar === "كبير");

      expect(smallSize.customer_price_halalas).toBe(1100);
      expect(medSize.customer_price_halalas).toBe(1650);
      expect(largeSize.customer_price_halalas).toBe(2200);

      // فحص خيارات الصوص الإلزامية
      expect(itemWithSizes.option_groups.length).toBe(1);
      expect(itemWithSizes.option_groups[0].is_required).toBe(true);
      expect(itemWithSizes.option_groups[0].min_selectable).toBe(1);
    });

    it("identifies calorie exempt items in customer_menu", async () => {
      const { data } = await adminClient.rpc("customer_menu", {
        p_store_id: testStoreId,
      });

      const section = data.sections[0];
      const exemptItem = section.items.find((i: any) => i.id === testItemIdExempt);
      expect(exemptItem).toBeDefined();
      expect(exemptItem.is_sfda_exempt).toBe(true);
    });
  });

  // 4. فحص قواعد تحقق اختيار الحجم والإضافات الإلزامية (CUS-005)
  describe("Item Customization Validation Rules (CUS-005)", () => {
    function validateItemSelection(params: {
      hasSizes: boolean;
      selectedSizeId: string | null;
      optionGroups: Array<{
        name: string;
        is_required: boolean;
        min_selectable: number;
        selectedCount: number;
      }>;
    }): { isValid: boolean; error: string | null } {
      if (params.hasSizes && !params.selectedSizeId) {
        return { isValid: false, error: "يرجى اختيار الحجم المطلوب" };
      }

      for (const grp of params.optionGroups) {
        if (grp.is_required && grp.selectedCount < grp.min_selectable) {
          return {
            isValid: false,
            error: `يرجى اختيار ${grp.name}`,
          };
        }
      }

      return { isValid: true, error: null };
    }

    it("fails validation when item has sizes but none is selected", () => {
      const res = validateItemSelection({
        hasSizes: true,
        selectedSizeId: null,
        optionGroups: [],
      });
      expect(res.isValid).toBe(false);
      expect(res.error).toBe("يرجى اختيار الحجم المطلوب");
    });

    it("fails validation when required option group has not met min_selectable", () => {
      const res = validateItemSelection({
        hasSizes: true,
        selectedSizeId: "size-1",
        optionGroups: [
          {
            name: "نوع الصوص",
            is_required: true,
            min_selectable: 1,
            selectedCount: 0,
          },
        ],
      });
      expect(res.isValid).toBe(false);
      expect(res.error).toContain("نوع الصوص");
    });

    it("passes validation when mandatory size and options are selected", () => {
      const res = validateItemSelection({
        hasSizes: true,
        selectedSizeId: "size-1",
        optionGroups: [
          {
            name: "نوع الصوص",
            is_required: true,
            min_selectable: 1,
            selectedCount: 1,
          },
        ],
      });
      expect(res.isValid).toBe(true);
      expect(res.error).toBeNull();
    });
  });
});
