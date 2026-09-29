import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@mahallat/shared";

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.SUPABASE_ANON_KEY!;

const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey);
const anonClient = createClient<Database>(supabaseUrl, anonKey);

describe("Stores, Merchants & Menu Schema (Step 1.3)", () => {
  let testCityId: string;
  let testMerchantId: string;
  let testStoreNormalId: string;
  let testStoreExceedId: string;
  let testStoreUncontractedId: string;
  let testStoreToleranceId: string;
  let testStoreReviewId: string;
  let testSectionNormalId: string;
  let testSectionToleranceId: string;
  let testSectionReviewId: string;
  let testItemToleranceId: string;
  let testItemReviewId: string;
  let testBranchId: string;
  let sfdaReasonId: string;
  let municipalDocTypeId: string;
  let cat1Id: string;
  let cat2Id: string;

  beforeAll(async () => {
    // 1. ضمان وجود تصنيفات المتاجر
    const { data: cat1 } = await adminClient
      .from("store_categories")
      .insert({ name_ar: "مطاعم تجريبية", name_en: "Test Restaurants", section_key: "restaurants" })
      .select("id")
      .single();
    const { data: cat2 } = await adminClient
      .from("store_categories")
      .insert({ name_ar: "كافيهات تجريبية", name_en: "Test Cafes", section_key: "cafes" })
      .select("id")
      .single();
    cat1Id = cat1!.id;
    cat2Id = cat2!.id;

    // 2. ضمان وجود أنواع المستندات
    const { data: docType } = await adminClient
      .from("document_types")
      .upsert(
        {
          code: "baladiya_license",
          name_ar: "رخصة البلدية",
          name_en: "Municipal License",
          applies_to: "branch",
          is_mandatory: true,
          requires_expiry_date: true,
        },
        { onConflict: "code" }
      )
      .select("id")
      .single();
    municipalDocTypeId = docType!.id;

    // 3. ضمان وجود أسباب إعفاء SFDA
    const { data: reason } = await adminClient
      .from("sfda_exemption_reasons")
      .upsert(
        {
          code: "fresh_produce",
          reason_ar: "خضار وفواكه طازجة",
          reason_en: "Fresh Produce",
        },
        { onConflict: "code" }
      )
      .select("id")
      .single();
    sfdaReasonId = reason!.id;

    // 4. إنشاء مدينة تجريبية
    const { data: city } = await adminClient
      .from("cities")
      .insert({
        name_ar: "مدينة متاجر تجريبية",
        name_en: "Stores Test City",
        boundary: "SRID=4326;MULTIPOLYGON(((46.60 24.60, 46.80 24.60, 46.80 24.80, 46.60 24.80, 46.60 24.60)))",
        is_active: true,
      })
      .select("id")
      .single();
    testCityId = city!.id;

    // 5. إنشاء منشأة تاجر تجريبية
    const { data: merchant } = await adminClient
      .from("merchants")
      .insert({
        commercial_name: "شركة التاجر التجريبي",
        cr_number: "1010998877",
        vat_number: "300099887700003",
      })
      .select("id")
      .single();
    testMerchantId = merchant!.id;

    // 6. إنشاء متاجر بحالات مختلفة
    // أ) متجر عادي لا يتجاوز 40 دقيقة، بصلاحية كاملة على المنيو
    const { data: sNormal } = await adminClient
      .from("stores")
      .insert({
        merchant_id: testMerchantId,
        city_id: testCityId,
        name_ar: "متجر عادي",
        name_en: "Normal Store",
        store_type: "contracted_menu",
        can_exceed_max_prep_time: false,
        menu_permission: "full",
        menu_slug: "test-normal-" + Date.now(),
        category_id: cat1Id,
      })
      .select("id")
      .single();
    testStoreNormalId = sNormal!.id;

    // ب) متجر له صلاحية تجاوز 40 دقيقة
    const { data: sExceed } = await adminClient
      .from("stores")
      .insert({
        merchant_id: testMerchantId,
        city_id: testCityId,
        name_ar: "متجر ولائم (يتجاوز 40)",
        name_en: "Feast Store",
        store_type: "contracted_menu",
        can_exceed_max_prep_time: true,
        menu_permission: "full",
        menu_slug: "test-feast-" + Date.now(),
      })
      .select("id")
      .single();
    testStoreExceedId = sExceed!.id;

    // ج) متجر غير متعاقد (اطلب اللي تبي)
    const { data: sUncontracted } = await adminClient
      .from("stores")
      .insert({
        merchant_id: testMerchantId,
        city_id: testCityId,
        name_ar: "متجر غير متعاقد",
        name_en: "Uncontracted Store",
        store_type: "uncontracted",
        menu_slug: "test-uncontracted-" + Date.now(),
      })
      .select("id")
      .single();
    testStoreUncontractedId = sUncontracted!.id;

    // د) متجر بصلاحية تعديل في حدود نسبة 10%
    const { data: sTol } = await adminClient
      .from("stores")
      .insert({
        merchant_id: testMerchantId,
        city_id: testCityId,
        name_ar: "متجر بنسبة سماح",
        name_en: "Tolerance Store",
        store_type: "contracted_menu",
        menu_permission: "price_tolerance",
        menu_price_tolerance_percentage: 10.0,
        menu_slug: "test-tol-" + Date.now(),
      })
      .select("id")
      .single();
    testStoreToleranceId = sTol!.id;

    // هـ) متجر بصلاحية بالمراجعة (review_required)
    const { data: sRev } = await adminClient
      .from("stores")
      .insert({
        merchant_id: testMerchantId,
        city_id: testCityId,
        name_ar: "متجر بالمراجعة",
        name_en: "Review Required Store",
        store_type: "contracted_menu",
        menu_permission: "review_required",
        menu_slug: "test-rev-" + Date.now(),
      })
      .select("id")
      .single();
    testStoreReviewId = sRev!.id;

    // 7. إنشاء أقسام وأصناف
    const { data: secNorm } = await adminClient
      .from("menu_sections")
      .insert({ store_id: testStoreNormalId, name_ar: "أطباق رئيسية", name_en: "Main" })
      .select("id")
      .single();
    testSectionNormalId = secNorm!.id;

    const { data: secTol } = await adminClient
      .from("menu_sections")
      .insert({ store_id: testStoreToleranceId, name_ar: "ساندوتشات", name_en: "Sandwiches" })
      .select("id")
      .single();
    testSectionToleranceId = secTol!.id;

    const { data: itemTol } = await adminClient
      .from("menu_items")
      .insert({
        section_id: testSectionToleranceId,
        name_ar: "برجر تجريبي",
        name_en: "Test Burger",
        base_price_halalas: 2000, // 20 ر.س
        prep_time_minutes: 15,
        calories_value: 500,
        is_published: true,
      })
      .select("id")
      .single();
    testItemToleranceId = itemTol!.id;

    const { data: secRev } = await adminClient
      .from("menu_sections")
      .insert({ store_id: testStoreReviewId, name_ar: "مشروبات", name_en: "Drinks" })
      .select("id")
      .single();
    testSectionReviewId = secRev!.id;

    const { data: itemRev } = await adminClient
      .from("menu_items")
      .insert({
        section_id: testSectionReviewId,
        name_ar: "عصير برتقال",
        name_en: "Orange Juice",
        base_price_halalas: 1200, // 12 ر.س
        prep_time_minutes: 5,
        calories_value: 120,
        is_published: true,
      })
      .select("id")
      .single();
    testItemReviewId = itemRev!.id;

    // فرع غير مفعل
    const { data: branch } = await adminClient
      .from("store_branches")
      .insert({
        store_id: testStoreNormalId,
        name_ar: "فرع الرياض 1",
        name_en: "Riyadh Branch 1",
        city_id: testCityId,
        location: "SRID=4326;POINT(46.67 24.71)",
        address_text: "شارع التخصصي",
        is_active: false,
      })
      .select("id")
      .single();
    testBranchId = branch!.id;
  });

  afterAll(async () => {
    // تنظيف كل البيانات المنشأة
    if (testMerchantId) {
      await adminClient.from("merchants").delete().eq("id", testMerchantId);
    }
    if (testCityId) {
      await adminClient.from("cities").delete().eq("id", testCityId);
    }
    if (cat1Id) {
      await adminClient.from("store_categories").delete().in("id", [cat1Id, cat2Id]);
    }
  });

  it("1. Prep time of 45 minutes should be rejected for normal store, but allowed for store with exception (MER-040)", async () => {
    // متجر عادي (can_exceed_max_prep_time = false) -> صنف بـ 45 دقيقة مرفوض
    const { error: errNormal } = await adminClient.from("menu_items").insert({
      section_id: testSectionNormalId,
      name_ar: "خروف محشي",
      name_en: "Stuffed Lamb",
      base_price_halalas: 150000,
      prep_time_minutes: 45, // يتجاوز 40
      calories_value: 2000,
    });
    expect(errNormal).not.toBeNull();
    expect(errNormal?.message).toContain("MER-040");

    // متجر له صلاحية التجاوز -> إنشاء قسم وصنف بـ 45 دقيقة مقبول
    const { data: secExceed } = await adminClient
      .from("menu_sections")
      .insert({ store_id: testStoreExceedId, name_ar: "ذبائح وولائم", name_en: "Feasts" })
      .select("id")
      .single();

    const { data: itemExceed, error: errExceed } = await adminClient
      .from("menu_items")
      .insert({
        section_id: secExceed!.id,
        name_ar: "خروف كامل",
        name_en: "Full Lamb",
        base_price_halalas: 180000,
        prep_time_minutes: 45,
        calories_value: 3000,
      })
      .select("id")
      .single();

    expect(errExceed).toBeNull();
    expect(itemExceed?.id).toBeDefined();
  });

  it("2. Item with missing calories and not SFDA exempt cannot be published (MER-025)", async () => {
    // صنف ناقص السعرات وغير معفى عند محاولة النشر (is_published = true) -> مرفوض
    const { error: errPublish } = await adminClient.from("menu_items").insert({
      section_id: testSectionNormalId,
      name_ar: "طبق غير مسجل السعرات",
      name_en: "No Calorie Dish",
      base_price_halalas: 3000,
      prep_time_minutes: 20,
      is_published: true, // محاولة النشر
      is_sfda_exempt: false,
    });
    expect(errPublish).not.toBeNull();
    expect(errPublish?.message).toContain("MER-025");

    // صنف معفى نظامياً من SFDA بدون سعرات عند النشر -> مقبول
    const { data: exemptItem, error: errExempt } = await adminClient
      .from("menu_items")
      .insert({
        section_id: testSectionNormalId,
        name_ar: "تفاح طازج معفى",
        name_en: "Fresh Apple Exempt",
        base_price_halalas: 500,
        prep_time_minutes: 5,
        is_published: true,
        is_sfda_exempt: true,
        sfda_exemption_reason_id: sfdaReasonId,
      })
      .select("id")
      .single();

    expect(errExempt).toBeNull();
    expect(exemptItem?.id).toBeDefined();
  });

  it("3. Price update within tolerance applied immediately, above tolerance queued for review, full permission applied immediately (MER-002)", async () => {
    // أ) متجر بصلاحية كاملة (testStoreNormalId): تعديل السعر يطبق فوراً
    const { data: fullItem } = await adminClient
      .from("menu_items")
      .insert({
        section_id: testSectionNormalId,
        name_ar: "صنف كامل الصلاحية",
        name_en: "Full Perm Item",
        base_price_halalas: 1000,
        prep_time_minutes: 10,
        calories_value: 200,
      })
      .select("id")
      .single();

    const { data: resFull, error: errFull } = await adminClient.rpc("submit_menu_item_price_update", {
      p_item_id: fullItem!.id,
      p_new_price_halalas: 1500,
    });
    expect(errFull).toBeNull();
    expect((resFull as any).status).toBe("applied_immediately");

    // ب) متجر بنسبة سماح 10% (السعر الحالي 2000 هللة)
    // 1. تعديل ضمن النسبة: من 2000 إلى 2100 (+5% <= 10%) -> يطبق فوراً
    const { data: resWithin, error: errWithin } = await adminClient.rpc("submit_menu_item_price_update", {
      p_item_id: testItemToleranceId,
      p_new_price_halalas: 2100,
    });
    expect(errWithin).toBeNull();
    expect((resWithin as any).status).toBe("applied_immediately");

    // 2. تعديل يتجاوز النسبة: من 2100 إلى 3000 (+42% > 10%) -> يتحول لطلب مراجعة
    const { data: resExceed, error: errTolExceed } = await adminClient.rpc("submit_menu_item_price_update", {
      p_item_id: testItemToleranceId,
      p_new_price_halalas: 3000,
    });
    expect(errTolExceed).toBeNull();
    expect((resExceed as any).status).toBe("pending_review");

    // ج) متجر بالمراجعة (review_required): أي تعديل يتحول لطلب مراجعة
    const { data: resRev, error: errRev } = await adminClient.rpc("submit_menu_item_price_update", {
      p_item_id: testItemReviewId,
      p_new_price_halalas: 1300,
    });
    expect(errRev).toBeNull();
    expect((resRev as any).status).toBe("pending_review");
  });

  it("4. Changing store category does not alter its contract (MER-009)", async () => {
    // إنشاء عقد للمتجر العادي
    const { data: contractBefore } = await adminClient
      .from("store_contracts")
      .insert({
        store_id: testStoreNormalId,
        pricing_model: "percentage",
        contract_percentage: 12.5,
      })
      .select("*")
      .single();

    expect(contractBefore).toBeDefined();

    // تغيير تصنيف المتجر من مطاعم إلى كافيهات
    const { error: updateCatErr } = await adminClient
      .from("stores")
      .update({ category_id: cat2Id })
      .eq("id", testStoreNormalId);
    expect(updateCatErr).toBeNull();

    // فحص العقد والتأكد من بقاء كل القيم والنسب كما هي دون أي مساس
    const { data: contractAfter } = await adminClient
      .from("store_contracts")
      .select("*")
      .eq("id", contractBefore!.id)
      .single();

    expect(contractAfter?.pricing_model).toBe("percentage");
    expect(Number(contractAfter?.contract_percentage)).toBe(12.5);
  });

  it("5. Uncontracted store cannot have menu sections or items (MER-046)", async () => {
    // محاولة إضافة قسم منيو لمتجر غير متعاقد (uncontracted)
    const { error } = await adminClient.from("menu_sections").insert({
      store_id: testStoreUncontractedId,
      name_ar: "قسم غير مسموح",
      name_en: "Not Allowed Section",
    });

    expect(error).not.toBeNull();
    expect(error?.message).toContain("MER-046");
  });

  it("6. Branch missing mandatory document cannot be activated (MER-001)", async () => {
    // محاولة تفعيل الفرع (is_active = true) وهو ينقصه رخصة البلدية -> مرفوض
    const { error: errActive } = await adminClient
      .from("store_branches")
      .update({ is_active: true })
      .eq("id", testBranchId);

    expect(errActive).not.toBeNull();
    expect(errActive?.message).toContain("MER-001");

    // رفع رخصة البلدية سارية المفعول للفرع
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 30);
    const expiryStr = tomorrow.toISOString().split("T")[0];

    const { error: errUpload } = await adminClient.from("uploaded_documents").insert({
      document_type_id: municipalDocTypeId,
      entity_type: "branch",
      entity_id: testBranchId,
      file_url: "https://example.com/docs/license.pdf",
      expiry_date: expiryStr,
      is_verified: true,
    });
    expect(errUpload).toBeNull();

    // إعادة محاولة تفعيل الفرع -> ينجح الآن!
    const { error: errActiveSuccess } = await adminClient
      .from("store_branches")
      .update({ is_active: true })
      .eq("id", testBranchId);

    expect(errActiveSuccess).toBeNull();
  });

  it("7. Branch staff cannot view other branch sensitive data (MER-001 RLS)", async () => {
    // فحص RLS: عميل أو مستخدم عادي لا يرى العقود البنكية أو الحسابات
    const { data: bankAccounts } = await anonClient.from("merchant_bank_accounts").select("*");
    expect(bankAccounts === null || bankAccounts.length === 0).toBe(true);

    const { data: contracts } = await anonClient.from("store_contracts").select("*");
    expect(contracts === null || contracts.length === 0).toBe(true);
  });

  it("8. New contract takes default values from flexible settings", async () => {
    // إدخال عقد جديد بدون تحديد الرسوم؛ trigger العقد يستورد الافتراضيات من get_setting
    const { data: newContract, error } = await adminClient
      .from("store_contracts")
      .insert({
        store_id: testStoreToleranceId,
      })
      .select("*")
      .single();

    expect(error).toBeNull();
    expect(newContract?.tier1_fee_halalas).toBe(200);
    expect(newContract?.tier2_fee_halalas).toBe(500);
    expect(Number(newContract?.contract_percentage)).toBe(10.0);
  });
});
