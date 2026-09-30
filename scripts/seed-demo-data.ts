import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ متغيرات البيئة SUPABASE_URL أو SUPABASE_SERVICE_ROLE_KEY غير موجودة في .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ==============================================================================
// 1. حسابات الديمو
// ==============================================================================
const DEMO_USERS = [
  {
    email: "admin@mahallat.local",
    password: "DemoAdmin123!",
    fullName: "المدير العام (ديمو)",
    role: "super_admin",
  },
  {
    email: "ops@mahallat.local",
    password: "DemoAdmin123!",
    fullName: "مدير العمليات (ديمو)",
    role: "operations",
  },
  {
    email: "finance@mahallat.local",
    password: "DemoAdmin123!",
    fullName: "المدير المالي (ديمو)",
    role: "finance",
  },
  {
    email: "support@mahallat.local",
    password: "DemoAdmin123!",
    fullName: "خدمة العملاء والدعم (ديمو)",
    role: "support",
  },
];

// ==============================================================================
// 2. المدن التجريبية ومضلعاتها الجيومكانية (جدة مدينة الاختبار الأساسية)
// ==============================================================================
const DEMO_CITIES = [
  {
    name_ar: "جدة",
    name_en: "Jeddah",
    is_active: true,
    geojson: JSON.stringify({
      type: "Polygon",
      coordinates: [
        [
          [39.05, 21.25],
          [39.40, 21.25],
          [39.40, 21.90],
          [39.05, 21.90],
          [39.05, 21.25],
        ],
      ],
    }),
  },
  {
    name_ar: "الرياض",
    name_en: "Riyadh",
    is_active: true,
    geojson: JSON.stringify({
      type: "Polygon",
      coordinates: [
        [
          [46.50, 24.55],
          [46.90, 24.55],
          [46.90, 24.95],
          [46.50, 24.95],
          [46.50, 24.55],
        ],
      ],
    }),
  },
  {
    name_ar: "الدمام",
    name_en: "Dammam",
    is_active: true,
    geojson: JSON.stringify({
      type: "Polygon",
      coordinates: [
        [
          [49.95, 26.25],
          [50.25, 26.25],
          [50.25, 26.55],
          [49.95, 26.55],
          [49.95, 26.25],
        ],
      ],
    }),
  },
];

// ==============================================================================
// 3. تصنيفات المتاجر التأسيسية
// ==============================================================================
const DEMO_CATEGORIES = [
  { code: "fast_food", section_key: "restaurants", name_ar: "وجبات سريعة وشاورما", name_en: "Fast Food & Shawarma", sort_order: 1 },
  { code: "burgers", section_key: "restaurants", name_ar: "برجر ومشويات", name_en: "Burgers & Grills", sort_order: 2 },
  { code: "pizza", section_key: "restaurants", name_ar: "بيتزا وفطائر", name_en: "Pizza & Pastries", sort_order: 3 },
  { code: "cafe", section_key: "restaurants", name_ar: "كافيه ومشروبات", name_en: "Cafe & Beverages", sort_order: 4 },
  { code: "mart", section_key: "mart", name_ar: "سوبرماركت وتموينات", name_en: "Supermarket & Groceries", sort_order: 5 },
  { code: "pharmacy", section_key: "pharmacies", name_ar: "صيدليات وعناية", name_en: "Pharmacies & Care", sort_order: 6 },
  { code: "retail", section_key: "retail", name_ar: "مخابز ومتاجر متنوعة", name_en: "Bakeries & Retail", sort_order: 7 },
];

async function main() {
  console.log("=================================================");
  console.log("🚀 بدء تهيئة البيانات التجريبية الشاملة (الخطوة 1.6)");
  console.log("=================================================");

  // 1. حسابات الديمو الإدارية
  for (const demoUser of DEMO_USERS) {
    console.log(`\n👤 تجهيز الحساب: ${demoUser.email} (${demoUser.role})`);

    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error(`خطأ في جلب المستخدمين:`, listError.message);
      continue;
    }

    const existingUser = usersData.users.find((u) => u.email === demoUser.email);
    let userId: string;

    if (existingUser) {
      console.log(`  ✓ المستخدم موجود مسبقاً، تحديث كلمة المرور`);
      const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        {
          password: demoUser.password,
          email_confirm: true,
          user_metadata: { full_name: demoUser.fullName },
        }
      );
      if (updateError) {
        console.error(`  ❌ خطأ في التحديث:`, updateError.message);
        continue;
      }
      userId = updated.user.id;
    } else {
      console.log(`  + إنشاء حساب جديد`);
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email: demoUser.email,
        password: demoUser.password,
        email_confirm: true,
        user_metadata: { full_name: demoUser.fullName },
      });
      if (createError) {
        console.error(`  ❌ خطأ في الإنشاء:`, createError.message);
        continue;
      }
      userId = created.user.id;
    }

    // تحديث / إدخال الملف الشخصي
    await supabase.from("profiles").upsert({
      id: userId,
      full_name: demoUser.fullName,
      preferred_language: "ar",
      updated_at: new Date().toISOString(),
    });

    // إدخال الدور الإداري
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("user_roles").insert({
      user_id: userId,
      role: demoUser.role as any,
    });
    console.log(`  ✓ تم تعيين الدور: ${demoUser.role}`);
  }

  // 2. المدن التجريبية
  console.log("\n🏙️ تهيئة المدن التجريبية...");
  let jeddahCityId: string = "";
  for (const city of DEMO_CITIES) {
    const { data: existingCity } = await supabase
      .from("cities")
      .select("id")
      .eq("name_ar", city.name_ar)
      .maybeSingle();

    const { data: savedId, error: saveError } = await supabase.rpc("admin_save_city", {
      p_id: existingCity?.id || null,
      p_name_ar: city.name_ar,
      p_name_en: city.name_en,
      p_is_active: city.is_active,
      p_geojson: city.geojson,
    });

    if (saveError) {
      console.error(`  ❌ خطأ في حفظ مدينة ${city.name_ar}:`, saveError.message);
    } else {
      const cityId = (savedId as string) || existingCity?.id;
      if (city.name_ar === "جدة") {
        jeddahCityId = cityId;
      }
      console.log(`  ✓ تم حفظ مدينة ${city.name_ar} (معرف: ${cityId})`);
    }
  }

  if (!jeddahCityId) {
    const { data: jData } = await supabase.from("cities").select("id").eq("name_ar", "جدة").single();
    jeddahCityId = jData?.id;
  }

  // 2.1 تهيئة حسابات المناديب التجريبية (المرحلة 4: DRV-001, DRV-007, DRV-010, DRV-011, DRV-015, DRV-017)
  console.log("\n🛵 تهيئة حسابات المناديب التجريبية...");
  const DEMO_DRIVERS = [
    {
      email: "driver.ahmed@mahallat.local",
      password: "DemoDriver123!",
      phone: "+966551111111",
      fullName: "أحمد الغامدي (ديمو)",
      driverType: "saudi_freelance",
      vehicleType: "car",
      vehiclePlate: "أ ح م 1111",
      vehicleModel: "تويوتا كامري 2023",
      isVerifiedFreelance: true,
      status: "approved",
      level: "gold",
      score: 95.0,
      rating: 4.9,
      lat: 21.578,
      lng: 39.141,
    },
    {
      email: "driver.faisal@mahallat.local",
      password: "DemoDriver123!",
      phone: "+966552222222",
      fullName: "فيصل الحربي (ديمو)",
      driverType: "saudi_freelance",
      vehicleType: "motorcycle",
      vehiclePlate: "ف ص ل 2222",
      vehicleModel: "ياماها 2022",
      isVerifiedFreelance: false,
      status: "approved",
      level: "silver",
      score: 78.0,
      rating: 4.7,
      lat: 21.585,
      lng: 39.135,
    },
  ];

  for (const drv of DEMO_DRIVERS) {
    let drvUserId: string = "";
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id")
      .eq("phone", drv.phone)
      .maybeSingle();

    if (existingUser) {
      drvUserId = existingUser.id;
    } else {
      const { data: created, error: crErr } = await supabase.auth.admin.createUser({
        email: drv.email,
        phone: drv.phone,
        password: drv.password,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: { full_name: drv.fullName },
      });
      if (crErr || !created?.user) {
        const { data: usersList } = await supabase.auth.admin.listUsers();
        const found = usersList?.users?.find((u) => u.email === drv.email || u.phone === drv.phone);
        if (found) drvUserId = found.id;
        else continue;
      } else {
        drvUserId = created.user.id;
      }
    }

    await supabase.from("profiles").upsert({
      id: drvUserId,
      full_name: drv.fullName,
      phone: drv.phone,
      preferred_language: "ar",
      updated_at: new Date().toISOString(),
    });

    await supabase.from("user_roles").delete().eq("user_id", drvUserId);
    await supabase.from("user_roles").insert({
      user_id: drvUserId,
      role: "driver",
    });

    await supabase.from("drivers").upsert({
      id: drvUserId,
      driver_type: drv.driverType as any,
      vehicle_type: drv.vehicleType as any,
      vehicle_plate: drv.vehiclePlate,
      vehicle_model: drv.vehicleModel,
      is_verified_freelance: drv.isVerifiedFreelance,
      status: drv.status as any,
      is_active: true,
      uniform_acknowledged_at: new Date().toISOString(),
      current_location: `POINT(${drv.lng} ${drv.lat})` as any,
      location_updated_at: new Date().toISOString(),
      level: drv.level as any,
      performance_score: drv.score,
      rating: drv.rating,
      city_id: jeddahCityId,
      updated_at: new Date().toISOString(),
    });

    console.log(`  ✓ تم تهيئة المندوب: ${drv.fullName} (${drv.vehicleType})`);
  }

  // 3. تصنيفات المتاجر
  console.log("\n🏷️ تهيئة تصنيفات المتاجر...");
  const categoryMap = new Map<string, string>();
  for (const cat of DEMO_CATEGORIES) {
    const { data: existingCat } = await supabase
      .from("store_categories")
      .select("id")
      .eq("name_ar", cat.name_ar)
      .maybeSingle();

    if (existingCat) {
      await supabase
        .from("store_categories")
        .update({
          section_key: cat.section_key,
          name_en: cat.name_en,
          sort_order: cat.sort_order,
          is_active: true,
        })
        .eq("id", existingCat.id);
      categoryMap.set(cat.code, existingCat.id);
    } else {
      const { data: inserted, error: catError } = await supabase
        .from("store_categories")
        .insert({
          name_ar: cat.name_ar,
          name_en: cat.name_en,
          section_key: cat.section_key,
          sort_order: cat.sort_order,
          is_active: true,
        })
        .select("id")
        .single();

      if (!catError && inserted) {
        categoryMap.set(cat.code, inserted.id);
      }
    }
  }
  console.log(`  ✓ تم تهيئة ${categoryMap.size} تصنيفاً.`);

  // 4. زون شمال جدة الجغرافي (Zone)
  console.log("\n🗺️ تهيئة زون شمال جدة الجغرافي...");
  let northJeddahZoneId: string = "";
  const { data: existingZone } = await supabase
    .from("zones")
    .select("id")
    .eq("name_ar", "زون شمال جدة (الروضة والزهراء والشاطئ)")
    .maybeSingle();

  if (existingZone) {
    northJeddahZoneId = existingZone.id;
    console.log(`  ✓ الزون موجود مسبقاً (معرف: ${northJeddahZoneId})`);
  } else {
    const { data: newZone, error: zoneErr } = await supabase
      .from("zones")
      .insert({
        city_id: jeddahCityId,
        name_ar: "زون شمال جدة (الروضة والزهراء والشاطئ)",
        name_en: "North Jeddah Zone",
        zone_type: "store_zone",
        boundary: "SRID=4326;MULTIPOLYGON(((39.10 21.52, 39.20 21.52, 39.20 21.65, 39.10 21.65, 39.10 21.52)))",
      })
      .select("id")
      .single();

    if (!zoneErr && newZone) {
      northJeddahZoneId = newZone.id;
      console.log(`  ✓ تم إنشاء زون شمال جدة (معرف: ${northJeddahZoneId})`);
    } else {
      console.error(`  ❌ خطأ في إنشاء الزون:`, zoneErr?.message);
    }
  }

  // 5. قيم التوصيل والخدمة المرنة لمدينة جدة (الخطوة 2.4 و 2.7)
  console.log("\n⚙️ ضبط وتأكيد الإعدادات المرنة لمدينة جدة...");
  const JEDDAH_SETTINGS = [
    { key: "delivery_base_fee_restaurant", value: 1500 },
    { key: "delivery_base_fee_mart", value: 1200 },
    { key: "delivery_base_distance_km", value: 3.0 },
    { key: "delivery_per_km_fee", value: 100 },
    { key: "delivery_min_fee", value: 500 },
    { key: "delivery_max_fee", value: 3000 },
    { key: "customer_service_fee_enabled", value: true },
    { key: "customer_service_fee_type", value: "percentage" },
    { key: "customer_service_fee_percentage", value: 2.5 },
    { key: "prep_time_buffer_minutes", value: 5 },
    { key: "delivery_time_buffer_minutes", value: 5 },
    { key: "customer_travel_speed_kmh", value: 25.0 },
    { key: "address_divergence_alert_threshold_meters", value: 250.0 },
  ];

  for (const s of JEDDAH_SETTINGS) {
    await supabase.from("setting_values").upsert(
      {
        key: s.key,
        level: "city",
        entity_id: jeddahCityId,
        value: s.value as any,
      },
      { onConflict: "key,level,entity_id" }
    );
  }
  console.log(`  ✓ تم تأكيد ${JEDDAH_SETTINGS.length} إعداداً مرناً لمدينة جدة.`);

  // 4. استرجاع نوع مستند رخصة البلدية وأسباب إعفاء الغذاء والدواء
  const { data: baladiyaDocType } = await supabase
    .from("document_types")
    .select("id")
    .eq("code", "baladiya_license")
    .maybeSingle();

  const { data: sfdaReasons } = await supabase
    .from("sfda_exemption_reasons")
    .select("id, code");
  const sfdaMap = new Map<string, string>();
  sfdaReasons?.forEach((r) => sfdaMap.set(r.code, r.id));

  // ==============================================================================
  // 5. التاجر التجريبي الأساسي (شركة أطعمة وتجارة الساحل الغربي - ديمو)
  // ==============================================================================
  console.log("\n🏢 تهيئة التاجر التجريبي...");
  let merchantId: string;
  const { data: existingMerchant } = await supabase
    .from("merchants")
    .select("id")
    .eq("commercial_name", "مجموعة مطاعم الساحل الغربي (ديمو)")
    .maybeSingle();

  if (existingMerchant) {
    merchantId = existingMerchant.id;
    console.log(`  ✓ التاجر موجود مسبقاً (معرف: ${merchantId})`);
  } else {
    const { data: newMerchant, error: merchantErr } = await supabase
      .from("merchants")
      .insert({
        commercial_name: "مجموعة مطاعم الساحل الغربي (ديمو)",
        cr_number: "4030123456",
        vat_number: "300012345600003",
        contact_name: "خالد الغامدي",
        contact_phone: "+966500123456",
        contact_email: "merchant.demo@mahallat.local",
      })
      .select("id")
      .single();

    if (merchantErr || !newMerchant) {
      throw new Error(`فشل إنشاء التاجر: ${merchantErr?.message}`);
    }
    merchantId = newMerchant.id;
    console.log(`  ✓ تم إنشاء التاجر بنجاح (معرف: ${merchantId})`);
  }

  // الحساب البنكي للتاجر
  await supabase.from("merchant_bank_accounts").upsert(
    {
      merchant_id: merchantId,
      bank_name: "البنك الأهلي السعودي (SNB)",
      iban: "SA4400000000123456789012",
      beneficiary_name: "مجموعة مطاعم الساحل الغربي",
      is_verified: true,
    },
    { onConflict: "merchant_id" }
  );

  // ==============================================================================
  // 6. المتاجر الستة التجريبية في جدة
  // ==============================================================================

  // --- متجر 1: شاورما وفلافل الساحل (ديمو) --- عقد نسبة مئوية (10%)
  console.log("\n🌯 تهيئة متجر 1: شاورما وفلافل الساحل (ديمو) - عقد نسبة 10%...");
  const store1 = await upsertStore({
    merchantId,
    nameAr: "شاورما وفلافل الساحل (ديمو)",
    nameEn: "Coast Shawarma & Falafel (Demo)",
    storeType: "contracted_menu",
    operationType: "restaurant",
    categoryId: categoryMap.get("fast_food") || null,
    cityId: jeddahCityId,
    minOrderSar: 15,
    defaultPrepTime: 18,
    menuPermission: "review_required",
    tolerancePct: 5.0,
    selfPickup: true,
    selfPickupDiscountPercentage: 10.0,
    menuSlug: "coast-shawarma-demo",
    logoUrl: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=120&h=120&fit=crop",
    bannerUrl: "https://images.unsplash.com/photo-1561651823-34feb02250e4?w=800&h=400&fit=crop",
  });

  // العقد المالي: نسبة
  await supabase.rpc("admin_create_store_contract", {
    p_store_id: store1.id,
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

  // الفرع 1A في حي الروضة بجدة
  await upsertBranch({
    storeId: store1.id,
    nameAr: "فرع حي الروضة - شارع الكيال",
    nameEn: "Al Rawdah Branch - Al Kayyal St",
    cityId: jeddahCityId,
    lat: 21.5562,
    lng: 39.1624,
    address: "جدة، حي الروضة، تقاطع شارع الكيال مع سعود الفيصل",
    baladiyaDocTypeId: baladiyaDocType?.id,
  });

  // الفرع 1B في حي الزهراء بجدة (متجر متعدد الفروع)
  await upsertBranch({
    storeId: store1.id,
    nameAr: "فرع حي الزهراء - شارع البترجي",
    nameEn: "Al Zahra Branch - Al Batterjee St",
    cityId: jeddahCityId,
    lat: 21.5950,
    lng: 39.1350,
    address: "جدة، حي الزهراء، شارع البترجي بالقرب من المستشفى السعودي الألماني",
    baladiyaDocTypeId: baladiyaDocType?.id,
  });

  // منيو شاورما وفلافل الساحل (10 أصناف)
  await seedShawarmaMenu(store1.id, sfdaMap.get("SFDA-01") || null);

  // --- متجر 2: برجر ومشويات الأندلس (ديمو) --- عقد رسوم لكل عميل
  console.log("\n🍔 تهيئة متجر 2: برجر ومشويات الأندلس (ديمو) - عقد رسوم لكل عميل...");
  const store2 = await upsertStore({
    merchantId,
    nameAr: "برجر ومشويات الأندلس (ديمو)",
    nameEn: "Alandalus Burger & Grills (Demo)",
    storeType: "contracted_menu",
    operationType: "restaurant",
    categoryId: categoryMap.get("burgers") || null,
    cityId: jeddahCityId,
    minOrderSar: 20,
    defaultPrepTime: 22,
    menuPermission: "price_tolerance",
    tolerancePct: 7.0,
    selfPickup: true,
    selfPickupDiscountPercentage: 10.0,
    menuSlug: "alandalus-burger-demo",
    logoUrl: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=120&h=120&fit=crop",
    bannerUrl: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=800&h=400&fit=crop",
  });

  await supabase.rpc("admin_create_store_contract", {
    p_store_id: store2.id,
    p_pricing_model: "per_customer",
    p_tier1_fee_halalas: 200,
    p_tier1_order_threshold_halalas: 2500,
    p_tier2_fee_halalas: 500,
    p_contract_per_customer_cap_halalas: 3000,
    p_contract_percentage: 0.0,
    p_menu_markup_percentage: 0.0,
    p_payment_gateway_fee_percentage: 2.5,
    p_payment_gateway_fee_fixed_halalas: 100,
  });

  // ساعات العمل المسائية والمتأخرة (من 16:00 إلى 04:00 فجراً)
  const lateNightHours = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day_of_week: day,
    open_time: "16:00",
    close_time: "04:00",
    is_closed: false,
  }));

  await upsertBranch({
    storeId: store2.id,
    nameAr: "فرع حي الزهراء - شارع حلمي كتبي (دوام ليلي)",
    nameEn: "Al Zahra Branch - Helmi Koutbi St (Late Night)",
    cityId: jeddahCityId,
    lat: 21.5835,
    lng: 39.1418,
    address: "جدة، حي الزهراء، شارع حلمي كتبي",
    baladiyaDocTypeId: baladiyaDocType?.id,
    workingHours: lateNightHours,
  });

  await seedBurgerMenu(store2.id);

  // --- متجر 3: بيتزا وفطائر نابولي (ديمو) --- بدون عمولة مع زيادة منيو 10%
  console.log("\n🍕 تهيئة متجر 3: بيتزا وفطائر نابولي (ديمو) - بدون خصم وزيادة منيو 10%...");
  const store3 = await upsertStore({
    merchantId,
    nameAr: "بيتزا وفطائر نابولي (ديمو)",
    nameEn: "Napoli Pizza & Pastries (Demo)",
    storeType: "contracted_menu",
    operationType: "restaurant",
    categoryId: categoryMap.get("pizza") || null,
    cityId: jeddahCityId,
    minOrderSar: 25,
    defaultPrepTime: 25,
    menuPermission: "full",
    tolerancePct: 10.0,
    selfPickup: true,
    selfPickupDiscountPercentage: 10.0,
    menuSlug: "napoli-pizza-demo",
    logoUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=120&h=120&fit=crop",
    bannerUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&h=400&fit=crop",
  });

  await supabase.rpc("admin_create_store_contract", {
    p_store_id: store3.id,
    p_pricing_model: "no_commission",
    p_contract_percentage: 0.0,
    p_tier1_fee_halalas: 0,
    p_tier1_order_threshold_halalas: 2500,
    p_tier2_fee_halalas: 0,
    p_contract_per_customer_cap_halalas: 0,
    p_menu_markup_percentage: 10.0,
    p_payment_gateway_fee_percentage: 2.5,
    p_payment_gateway_fee_fixed_halalas: 100,
  });

  // الفرع 3A: الحمراء مفتوح
  await upsertBranch({
    storeId: store3.id,
    nameAr: "فرع حي الحمراء - شارع فلسطين",
    nameEn: "Al Hamra Branch - Palestine St",
    cityId: jeddahCityId,
    lat: 21.5184,
    lng: 39.1552,
    address: "جدة، حي الحمراء، تقاطع شارع فلسطين مع طريق الأندلس",
    baladiyaDocTypeId: baladiyaDocType?.id,
  });

  // الفرع 3B: حي السلامة موقف مؤقتاً (paused_until لمدة 6 ساعات)
  await upsertBranch({
    storeId: store3.id,
    nameAr: "فرع حي السلامة - شارع اليمامة (مغلق مؤقتاً)",
    nameEn: "Al Salamah Branch (Temporarily Paused)",
    cityId: jeddahCityId,
    lat: 21.5910,
    lng: 39.1680,
    address: "جدة، حي السلامة، شارع اليمامة",
    baladiyaDocTypeId: baladiyaDocType?.id,
    pausedUntil: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
  });

  await seedPizzaMenu(store3.id);

  // --- متجر 4: تموينات وسوبرماركت المروة (ديمو) --- محل متنوع Mart
  console.log("\n🛒 تهيئة متجر 4: تموينات وسوبرماركت المروة (ديمو) - نشاط مارت...");
  const store4 = await upsertStore({
    merchantId,
    nameAr: "تموينات وسوبرماركت المروة (ديمو)",
    nameEn: "Al Marwah Supermarket (Demo)",
    storeType: "contracted_menu",
    operationType: "mart",
    categoryId: categoryMap.get("mart") || null,
    cityId: jeddahCityId,
    minOrderSar: 10,
    defaultPrepTime: 15,
    menuPermission: "review_required",
    tolerancePct: 5.0,
    selfPickup: true,
    selfPickupDiscountPercentage: 5.0,
    menuSlug: "almarwah-market-demo",
    logoUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=120&h=120&fit=crop",
    bannerUrl: "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&h=400&fit=crop",
  });

  await supabase.rpc("admin_create_store_contract", {
    p_store_id: store4.id,
    p_pricing_model: "percentage",
    p_contract_percentage: 5.0,
    p_tier1_fee_halalas: 200,
    p_tier1_order_threshold_halalas: 2500,
    p_tier2_fee_halalas: 500,
    p_contract_per_customer_cap_halalas: 3000,
    p_menu_markup_percentage: 5.0,
    p_payment_gateway_fee_percentage: 2.5,
    p_payment_gateway_fee_fixed_halalas: 100,
  });

  await upsertBranch({
    storeId: store4.id,
    nameAr: "فرع حي المروة - شارع حراء",
    nameEn: "Al Marwah Branch - Hiraa St",
    cityId: jeddahCityId,
    lat: 21.6115,
    lng: 39.1982,
    address: "جدة، حي المروة، طريق حراء العام",
    baladiyaDocTypeId: baladiyaDocType?.id,
  });

  await seedMartMenu(store4.id);

  // --- متجر 5: صيدلية النور والمستلزمات (ديمو) --- متعاقد كتابة فقط (بلا منيو)
  console.log("\n💊 تهيئة متجر 5: صيدلية النور (ديمو) - متعاقد كتابة فقط بلا منيو...");
  const store5 = await upsertStore({
    merchantId,
    nameAr: "صيدلية النور والمستلزمات الطبية (ديمو)",
    nameEn: "Al Noor Pharmacy (Demo)",
    storeType: "contracted_text_only",
    operationType: "pharmacy",
    categoryId: categoryMap.get("pharmacy") || null,
    cityId: jeddahCityId,
    minOrderSar: 15,
    defaultPrepTime: 15,
    menuPermission: "review_required",
    tolerancePct: 5.0,
    selfPickup: true,
    menuSlug: "alnoor-pharmacy-demo",
    logoUrl: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=120&h=120&fit=crop",
    bannerUrl: "https://images.unsplash.com/photo-1576602976047-174e57a47881?w=800&h=400&fit=crop",
  });

  await supabase.rpc("admin_create_store_contract", {
    p_store_id: store5.id,
    p_pricing_model: "percentage",
    p_contract_percentage: 5.0,
    p_tier1_fee_halalas: 200,
    p_tier1_order_threshold_halalas: 2500,
    p_tier2_fee_halalas: 500,
    p_contract_per_customer_cap_halalas: 3000,
    p_menu_markup_percentage: 0.0,
    p_payment_gateway_fee_percentage: 2.5,
    p_payment_gateway_fee_fixed_halalas: 100,
  });

  await upsertBranch({
    storeId: store5.id,
    nameAr: "فرع حي الصفا - شارع الأربعين",
    nameEn: "Al Safa Branch - 40th St",
    cityId: jeddahCityId,
    lat: 21.5881,
    lng: 39.2014,
    address: "جدة، حي الصفا، شارع الأمير متعب بن عبدالعزيز",
    baladiyaDocTypeId: baladiyaDocType?.id,
  });

  // --- متجر 6: مخبز وتموينات البلد (ديمو) --- متعاقد بمنيو (مخبوزات وتموينات)
  console.log("\n🥖 تهيئة متجر 6: مخبز وتموينات البلد (ديمو) - متعاقد بمنيو...");
  const store6 = await upsertStore({
    merchantId,
    nameAr: "مخبز وتموينات البلد التاريخية (ديمو)",
    nameEn: "Al Balad Bakery & Retail (Demo)",
    storeType: "contracted_menu",
    operationType: "retail",
    categoryId: categoryMap.get("retail") || null,
    cityId: jeddahCityId,
    minOrderSar: 15,
    defaultPrepTime: 15,
    menuPermission: "review_required",
    tolerancePct: 5.0,
    selfPickup: true,
    selfPickupDiscountPercentage: 10.0,
    menuSlug: "albalad-bakery-demo",
    logoUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=120&h=120&fit=crop",
    bannerUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&h=400&fit=crop",
  });

  await supabase.rpc("admin_create_store_contract", {
    p_store_id: store6.id,
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

  await upsertBranch({
    storeId: store6.id,
    nameAr: "فرع حي البلد - سوق العلوي",
    nameEn: "Al Balad Branch - Al Alawi Market",
    cityId: jeddahCityId,
    lat: 21.4882,
    lng: 39.1865,
    address: "جدة، المنطقة التاريخية (البلد)، شارع قابل",
    baladiyaDocTypeId: baladiyaDocType?.id,
  });

  await seedBakeryMenu(store6.id);

  // --- متجر 7: كافيه ومحمص الساحل المختص (ديمو) --- مقهى ومحمص مختص بزون شمال جدة
  console.log("\n☕ تهيئة متجر 7: كافيه ومحمص الساحل المختص (ديمو) - زون شمال جدة...");
  const store7 = await upsertStore({
    merchantId,
    nameAr: "كافيه ومحمص الساحل المختص (ديمو)",
    nameEn: "Coast Specialty Coffee & Roastery (Demo)",
    storeType: "contracted_menu",
    operationType: "restaurant",
    categoryId: categoryMap.get("cafe") || null,
    cityId: jeddahCityId,
    minOrderSar: 20,
    defaultPrepTime: 12,
    menuPermission: "review_required",
    tolerancePct: 5.0,
    selfPickup: true,
    selfPickupDiscountPercentage: 10.0,
    menuSlug: "coast-cafe-demo",
    deliveryZoneId: northJeddahZoneId,
    logoUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=120&h=120&fit=crop",
    bannerUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&h=400&fit=crop",
  });

  await supabase.rpc("admin_create_store_contract", {
    p_store_id: store7.id,
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

  await upsertBranch({
    storeId: store7.id,
    nameAr: "فرع حي الشاطئ - طريق الكورنيش",
    nameEn: "Al Shati Branch - Corniche Rd",
    cityId: jeddahCityId,
    lat: 21.5900,
    lng: 39.1120,
    address: "جدة، حي الشاطئ، طريق الكورنيش الشمالي",
    baladiyaDocTypeId: baladiyaDocType?.id,
  });

  await seedCafeMenu(store7.id);

  console.log("\n=================================================");
  console.log("✅ اكتملت إضافة كافة البيانات التجريبية بنجاح تام!");
  console.log("=================================================");
  console.log("المدينة الأساسية: جدة (مغطاة بمضلع جغرافي PostGIS)");
  console.log("المتاجر التجريبية:");
  console.log(" 1. شاورما وفلافل الساحل (ديمو) - فرعين (الروضة، الزهراء)، عقد نسبة 10%");
  console.log(" 2. برجر ومشويات الأندلس (ديمو) - فرع دوام ليلي (16:00 إلى 04:00)، رسوم عميل");
  console.log(" 3. بيتزا وفطائر نابولي (ديمو) - فرعين أحدهما مغلق مؤقتاً (السلامة)، زيادة 10%");
  console.log(" 4. تموينات وسوبرماركت المروة (ديمو) - نشاط مارت، أصناف مقترحة بالسلة");
  console.log(" 5. صيدلية النور (ديمو) - متعاقد كتابة فقط (بلا منيو)");
  console.log(" 6. مخبز وتموينات البلد (ديمو) - مخبز وتموينات متعاقد بمنيو");
  console.log(" 7. كافيه ومحمص الساحل المختص (ديمو) - زون شمال جدة، نطاق سعرات، كافيين، صوديوم عالي، خيارات إجبارية");
  console.log("\nحسابات الدخول التجريبية:");
  for (const u of DEMO_USERS) {
    console.log(` • ${u.fullName} (${u.role}): ${u.email} | كلمة المرور: ${u.password}`);
  }
  console.log("=================================================");
}

// -----------------------------------------------------------------------------
// دوال مساعدة لإنشاء المتاجر والفروع وقوائم الطعام
// -----------------------------------------------------------------------------

interface StoreParams {
  merchantId: string;
  nameAr: string;
  nameEn: string;
  storeType: "contracted_menu" | "contracted_text_only";
  operationType: "restaurant" | "retail" | "mart" | "pharmacy";
  categoryId: string | null;
  cityId: string;
  minOrderSar: number;
  defaultPrepTime: number;
  menuPermission: "full" | "price_tolerance" | "review_required";
  tolerancePct: number;
  selfPickup: boolean;
  selfPickupDiscountPercentage?: number;
  menuSlug: string;
  deliveryZoneId?: string | null;
  logoUrl?: string;
  bannerUrl?: string;
}

async function upsertStore(p: StoreParams) {
  const { data: existing } = await supabase
    .from("stores")
    .select("id")
    .eq("menu_slug", p.menuSlug)
    .maybeSingle();

  if (existing) {
    const { data: updated } = await supabase
      .from("stores")
      .update({
        name_ar: p.nameAr,
        name_en: p.nameEn,
        store_type: p.storeType,
        operation_type: p.operationType,
        category_id: p.categoryId,
        city_id: p.cityId,
        min_order_halalas: Math.round(p.minOrderSar * 100),
        default_prep_time_minutes: p.defaultPrepTime,
        menu_permission: p.menuPermission,
        menu_price_tolerance_percentage: p.tolerancePct,
        self_pickup_enabled: p.selfPickup,
        self_pickup_discount_percentage: p.selfPickupDiscountPercentage ?? 0,
        delivery_zone_id: p.deliveryZoneId ?? null,
        logo_url: p.logoUrl ?? null,
        banner_url: p.bannerUrl ?? null,
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    return updated!;
  }

  const { data: inserted, error } = await supabase
    .from("stores")
    .insert({
      merchant_id: p.merchantId,
      name_ar: p.nameAr,
      name_en: p.nameEn,
      store_type: p.storeType,
      operation_type: p.operationType,
      category_id: p.categoryId,
      city_id: p.cityId,
      min_order_halalas: Math.round(p.minOrderSar * 100),
      default_prep_time_minutes: p.defaultPrepTime,
      can_exceed_max_prep_time: false,
      menu_permission: p.menuPermission,
      menu_price_tolerance_percentage: p.tolerancePct,
      self_pickup_enabled: p.selfPickup,
      self_pickup_discount_percentage: p.selfPickupDiscountPercentage ?? 0,
      menu_slug: p.menuSlug,
      delivery_zone_id: p.deliveryZoneId ?? null,
      logo_url: p.logoUrl ?? null,
      banner_url: p.bannerUrl ?? null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    throw new Error(`فشل إضافة المتجر ${p.nameAr}: ${error?.message}`);
  }
  return inserted;
}

interface BranchParams {
  storeId: string;
  nameAr: string;
  nameEn: string;
  cityId: string;
  lat: number;
  lng: number;
  address: string;
  baladiyaDocTypeId?: string;
  workingHours?: Array<{ day_of_week: number; open_time: string; close_time: string; is_closed: boolean }>;
  pausedUntil?: string | null;
}

async function upsertBranch(p: BranchParams) {
  const { data: existing } = await supabase
    .from("store_branches")
    .select("id")
    .eq("store_id", p.storeId)
    .eq("name_ar", p.nameAr)
    .maybeSingle();

  // ساعات العمل النموذجية (يومياً من 10:00 صباحاً إلى 02:00 ليلاً ما لم تُحدد خلاف ذلك)
  const workingHours = p.workingHours || [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day_of_week: day,
    open_time: "10:00",
    close_time: "02:00",
    is_closed: false,
  }));

  // حفظ الفرع بدون تفعيل أولي حتى نرفع رخصة البلدية لتفادي فشل التريجر
  const { data: branchId, error } = await supabase.rpc("admin_save_branch", {
    p_id: existing?.id || null,
    p_store_id: p.storeId,
    p_name_ar: p.nameAr,
    p_name_en: p.nameEn,
    p_city_id: p.cityId,
    p_latitude: p.lat,
    p_longitude: p.lng,
    p_address_text: p.address,
    p_working_hours: workingHours,
    p_default_prep_time_minutes: 20,
    p_min_order_halalas: 0,
    p_is_active: false,
  });

  if (error || !branchId) {
    throw new Error(`فشل حفظ الفرع ${p.nameAr}: ${error?.message}`);
  }

  const id = branchId as string;

  // رفع وتوثيق رخصة البلدية السارية (MER-001)
  if (p.baladiyaDocTypeId) {
    const { data: existingDoc } = await supabase
      .from("uploaded_documents")
      .select("id")
      .eq("entity_id", id)
      .eq("document_type_id", p.baladiyaDocTypeId)
      .maybeSingle();

    if (!existingDoc) {
      await supabase.from("uploaded_documents").insert({
        document_type_id: p.baladiyaDocTypeId,
        entity_type: "store_branch",
        entity_id: id,
        file_url: "https://demo.mahallat.local/docs/baladiya_license_demo.pdf",
        expiry_date: "2028-12-31",
        is_verified: true,
        status: "approved",
      });
    }
  }

  // الآن بعد توفر الرخصة، نفعّل الفرع ونحدث مهلة الإيقاف إن وُجدت
  const updateBranchData: any = { is_active: true };
  if (p.pausedUntil !== undefined) {
    updateBranchData.paused_until = p.pausedUntil;
  }
  await supabase
    .from("store_branches")
    .update(updateBranchData)
    .eq("id", id);

  console.log(`  ✓ تم حفظ وتفعيل الفرع: ${p.nameAr}${p.pausedUntil ? " (موقف مؤقتاً)" : ""}`);
  return id;
}

// -----------------------------------------------------------------------------
// قوائم الطعام (Menu)
// -----------------------------------------------------------------------------

async function seedShawarmaMenu(storeId: string, sfdaExemptReasonId: string | null) {
  // 1. الأقسام
  const secSandwiches = await upsertMenuSection(storeId, "الشاورما والساندوتشات", "Shawarma & Sandwiches", 1);
  const secMeals = await upsertMenuSection(storeId, "الوجبات والبوكسات", "Meals & Boxes", 2);
  const secSides = await upsertMenuSection(storeId, "المقبلات والمشروبات", "Sides & Drinks", 3);

  // أصناف الشاورما
  const item1 = await upsertMenuItem({
    sectionId: secSandwiches,
    nameAr: "شاورما دجاج كلاسيك",
    nameEn: "Classic Chicken Shawarma",
    descAr: "شاورما دجاج متبلة بالخلطة الشامية الخاصة مع الثوم والمخلل في خبز الصاج الطازج",
    priceSar: 12.0,
    prepTime: 10,
    calories: 420,
    allergens: ["غلوتين", "ثوم"],
  });
  await addSizes(item1, [
    { nameAr: "صغير (عادي)", nameEn: "Regular", deltaSar: 0, cal: 420, isDefault: true },
    { nameAr: "جامبو صاروخ", nameEn: "Jumbo", deltaSar: 6, cal: 650 },
    { nameAr: "عربي مقطع مع بطاطس", nameEn: "Arabic Meal", deltaSar: 10, cal: 780 },
  ]);
  await addOptionGroup(item1, {
    nameAr: "نوع الخبز",
    nameEn: "Bread Type",
    isRequired: true,
    min: 1,
    max: 1,
    options: [
      { nameAr: "خبز صاج رقيق", nameEn: "Saj Bread", deltaSar: 0, cal: 0 },
      { nameAr: "خبز شامي تقليدي", nameEn: "Shami Bread", deltaSar: 0, cal: 20 },
    ],
  });
  await addOptionGroup(item1, {
    nameAr: "إضافات حسب الرغبة",
    nameEn: "Extras",
    isRequired: false,
    min: 0,
    max: 3,
    options: [
      { nameAr: "ثوم إضافي", nameEn: "Extra Garlic", deltaSar: 2, cal: 45 },
      { nameAr: "جبنة موزاريلا ذائبة", nameEn: "Melted Mozzarella", deltaSar: 3, cal: 90 },
      { nameAr: "مخلل خيار زيادة", nameEn: "Extra Pickles", deltaSar: 1, cal: 10 },
    ],
  });

  const item2 = await upsertMenuItem({
    sectionId: secSandwiches,
    nameAr: "شاورما لحم نعيمي بلدي",
    nameEn: "Local Lamb Shawarma",
    descAr: "شرائح لحم بلدي متبلة بالبهارات الخاصة مع الطحينة والبقدونس والبصل والسماق",
    priceSar: 18.0,
    prepTime: 12,
    calories: 520,
    allergens: ["سمسم (طحينة)", "غلوتين"],
  });
  await addSizes(item2, [
    { nameAr: "عادي", nameEn: "Regular", deltaSar: 0, cal: 520, isDefault: true },
    { nameAr: "جامبو دبل لحم", nameEn: "Jumbo Double Meat", deltaSar: 9, cal: 780 },
  ]);

  await upsertMenuItem({
    sectionId: secSandwiches,
    nameAr: "ساندوتش فلافل مشكل إكسترا",
    nameEn: "Mixed Falafel Sandwich Extra",
    descAr: "حبات فلافل مقرمشة مع شرائح باذنجان وبطاطس وطماطم وصوص الطحينة اللذيذ",
    priceSar: 8.0,
    prepTime: 8,
    calories: 360,
    allergens: ["سمسم", "غلوتين"],
  });

  // وجبات
  await upsertMenuItem({
    sectionId: secMeals,
    nameAr: "صحن عربي شاورما دجاج مكس",
    nameEn: "Chicken Shawarma Arabic Plate",
    descAr: "ساندوتش شاورما كبير مقطع مع بطاطس مقلية ذهبية وصلصة ثوم ومخلل خيار مشكل",
    priceSar: 24.0,
    prepTime: 15,
    calories: 780,
    allergens: ["غلوتين", "ثوم"],
  });

  await upsertMenuItem({
    sectionId: secMeals,
    nameAr: "بوكس لمة الأصحاب (4 شاورما + بطاطس عائلي)",
    nameEn: "Friends Gathering Box (4 Shawarma + Large Fries)",
    descAr: "4 ساندوتشات شاورما متنوعة دجاج ولحم مع بطاطس عائلي و4 صوصات منوعة",
    priceSar: 65.0,
    prepTime: 20,
    calories: 1850,
    allergens: ["غلوتين", "ثوم", "سمسم"],
  });

  await upsertMenuItem({
    sectionId: secMeals,
    nameAr: "صحن فلافل مقرمشة مشكل (12 حبة)",
    nameEn: "Falafel Plate (12 Pcs)",
    descAr: "فلافل مقلية طازجة مع حمص ناعم وخضار مشكلة ومخلل وخبز صاج ساخن",
    priceSar: 16.0,
    prepTime: 10,
    calories: 490,
    allergens: ["سمسم", "غلوتين"],
  });

  // مقبلات ومشروبات
  await upsertMenuItem({
    sectionId: secSides,
    nameAr: "بطاطس مقلية ذهبية مبهرة",
    nameEn: "Spiced French Fries",
    descAr: "أصابع بطاطس مقرمشة متبلة ببهارات البطاطس الخاصة والبابريكا",
    priceSar: 8.0,
    prepTime: 8,
    calories: 310,
    isSuggestedInCart: true,
  });

  await upsertMenuItem({
    sectionId: secSides,
    nameAr: "حمص ناعم بزيت الزيتون البكر",
    nameEn: "Hummus with Extra Virgin Olive Oil",
    descAr: "حمص حب مطحون مع الطحينة الفاخرة وعصير الليمون وزيت الزيتون الطبيعي",
    priceSar: 10.0,
    prepTime: 5,
    calories: 270,
    allergens: ["سمسم"],
    isSuggestedInCart: true,
  });

  const drinkItem = await upsertMenuItem({
    sectionId: secSides,
    nameAr: "مشروب غازي بارد 330 مل",
    nameEn: "Soft Drink 330ml",
    descAr: "علبة مشروب بارد ومنعش لاكتمال وجبتك",
    priceSar: 4.0,
    prepTime: 2,
    calories: 140,
    isSuggestedInCart: true,
  });
  await addOptionGroup(drinkItem, {
    nameAr: "اختر نوع المشروب",
    nameEn: "Select Drink",
    isRequired: true,
    min: 1,
    max: 1,
    options: [
      { nameAr: "بيبسي كولا كلاسيك", nameEn: "Pepsi Cola", deltaSar: 0, cal: 140 },
      { nameAr: "سفن آب ليمون", nameEn: "7Up", deltaSar: 0, cal: 135 },
      { nameAr: "بيبسي دايت خالي السكر", nameEn: "Diet Pepsi", deltaSar: 0, cal: 0 },
    ],
  });

  // صنف معفى نظامياً من الغذاء والدواء (SFDA-01)
  await upsertMenuItem({
    sectionId: secSides,
    nameAr: "سلطة خضراء موسمية طازجة (معفى من السعرات)",
    nameEn: "Fresh Seasonal Garden Salad (SFDA Exempt)",
    descAr: "خضار طازجة ومورقة تُحضر كطلب خاص ومحدد من العميل مباشرة (معفاة بموجب اشتراطات SFDA)",
    priceSar: 9.0,
    prepTime: 6,
    isSfdaExempt: true,
    sfdaReasonId: sfdaExemptReasonId,
  });
}

async function seedBurgerMenu(storeId: string) {
  const secBurgers = await upsertMenuSection(storeId, "البرجر المشوي الفاخر", "Gourmet Burgers", 1);
  const secSides = await upsertMenuSection(storeId, "المقبلات والوجبات الجانبية", "Sides", 2);
  const secDrinks = await upsertMenuSection(storeId, "المشروبات والمخفوقات", "Drinks & Shakes", 3);

  const b1 = await upsertMenuItem({
    sectionId: secBurgers,
    nameAr: "برجر لحم بلاك أنجوس كلاسيك",
    nameEn: "Black Angus Classic Burger",
    descAr: "شريحة لحم بلاك أنجوس مشوية على اللهب مع جبن الشيدر والخس وصوص البرجر الخاص في خبز البريوش",
    priceSar: 26.0,
    prepTime: 15,
    calories: 640,
    allergens: ["ألبان", "غلوتين", "بيض"],
  });
  await addSizes(b1, [
    { nameAr: "شريحة واحدة (سنجل)", nameEn: "Single Patty", deltaSar: 0, cal: 640, isDefault: true },
    { nameAr: "شريحتين لحم (دبل)", nameEn: "Double Patty", deltaSar: 10, cal: 920 },
  ]);
  await addOptionGroup(b1, {
    nameAr: "نوع الجبن",
    nameEn: "Cheese Type",
    isRequired: true,
    min: 1,
    max: 1,
    options: [
      { nameAr: "شيدر أمريكي كلاسيك", nameEn: "American Cheddar", deltaSar: 0, cal: 80 },
      { nameAr: "جبنة سويسرية بيضاء", nameEn: "Swiss Cheese", deltaSar: 2, cal: 90 },
    ],
  });

  await upsertMenuItem({
    sectionId: secBurgers,
    nameAr: "برجر دجاج كرسبي مقرمش",
    nameEn: "Crispy Chicken Burger",
    descAr: "صدر دجاج طازج مقلي ومقرمش مع سلطة الكولسلو والمخلل وصوص المايونيز الحار",
    priceSar: 22.0,
    prepTime: 12,
    calories: 590,
    allergens: ["ألبان", "غلوتين", "بيض"],
  });

  await upsertMenuItem({
    sectionId: secBurgers,
    nameAr: "برجر مشروم سويس الفاخر",
    nameEn: "Mushroom Swiss Gourmet Burger",
    descAr: "شريحة لحم بقرية مع الفطر الطازج المكرمل وصلصة الجبنة السويسرية الغنية",
    priceSar: 29.0,
    prepTime: 16,
    calories: 710,
    allergens: ["ألبان", "غلوتين"],
  });

  await upsertMenuItem({
    sectionId: secBurgers,
    nameAr: "ميني سلايدرز ثلاثي (لحم ودجاج ومشروم)",
    nameEn: "Trio Mini Sliders",
    descAr: "3 قطع سلايدر متنوعة في خبز البطاطس الطري لتذوق مختلف النكهات",
    priceSar: 34.0,
    prepTime: 18,
    calories: 820,
    allergens: ["ألبان", "غلوتين", "بيض"],
  });

  // مقبلات
  await upsertMenuItem({
    sectionId: secSides,
    nameAr: "أصابع جبنة الموزاريلا المقرمشة (5 قطع)",
    nameEn: "Mozzarella Cheese Sticks (5 Pcs)",
    descAr: "أصابع جبن موزاريلا مقلية مع صلصة المارينارا الإيطالية الغنية",
    priceSar: 16.0,
    prepTime: 8,
    calories: 380,
    allergens: ["ألبان", "غلوتين"],
    isSuggestedInCart: true,
  });

  await upsertMenuItem({
    sectionId: secSides,
    nameAr: "كرات الهالبينو والشيدر المدخنة",
    nameEn: "Smoked Jalapeno Cheddar Bites",
    descAr: "كرات جبن مقرمشة محشوة بقطع الهالبينو اللذيذة",
    priceSar: 15.0,
    prepTime: 8,
    calories: 340,
    allergens: ["ألبان", "غلوتين"],
  });

  await upsertMenuItem({
    sectionId: secSides,
    nameAr: "حلقات بصل ذهبية مقرمشة",
    nameEn: "Golden Crispy Onion Rings",
    descAr: "حلقات بصل طازجة مغلفة بخلطة مقرمشة خفيفة مع صوص الرانش",
    priceSar: 12.0,
    prepTime: 7,
    calories: 290,
    allergens: ["غلوتين", "ألبان"],
    isSuggestedInCart: true,
  });

  // مشروبات
  await upsertMenuItem({
    sectionId: secDrinks,
    nameAr: "ميلك شيك كلاسيك بالشوكولاتة البلجيكية",
    nameEn: "Belgian Chocolate Milkshake",
    descAr: "مخفوق الحليب والآيس كريم بالشوكولاتة الفاخرة مع الكريمة المخفوقة",
    priceSar: 17.0,
    prepTime: 6,
    calories: 460,
    allergens: ["ألبان"],
    isSuggestedInCart: true,
  });

  await upsertMenuItem({
    sectionId: secDrinks,
    nameAr: "مياه معدنية نقية 500 مل",
    nameEn: "Mineral Water 500ml",
    descAr: "مياه شرب نقية ومعبأة طبيعية",
    priceSar: 2.0,
    prepTime: 1,
    calories: 0,
  });
}

async function seedPizzaMenu(storeId: string) {
  const secPizza = await upsertMenuSection(storeId, "البيتزا الإيطالية الحجرية", "Stone Baked Pizza", 1);
  const secPies = await upsertMenuSection(storeId, "الفطائر والمعجنات الطازجة", "Fresh Pies & Pastries", 2);
  const secDrinks = await upsertMenuSection(storeId, "المقبلات والمشروبات", "Appetizers & Drinks", 3);

  const p1 = await upsertMenuItem({
    sectionId: secPizza,
    nameAr: "بيتزا مارجريتا نابولي الأصلية",
    nameEn: "Original Napoli Margherita Pizza",
    descAr: "عجينة مخمرة طبيعياً مع صلصة الطماطم الإيطالية وجبن الموزاريلا الطازج وريحان",
    priceSar: 28.0,
    prepTime: 16,
    calories: 720,
    allergens: ["غلوتين", "ألبان"],
  });
  await addSizes(p1, [
    { nameAr: "حجم وسط (10 إنش)", nameEn: "Medium (10 inch)", deltaSar: 0, cal: 720, isDefault: true },
    { nameAr: "حجم كبير (14 إنش)", nameEn: "Large (14 inch)", deltaSar: 12, cal: 1050 },
  ]);

  await upsertMenuItem({
    sectionId: secPizza,
    nameAr: "بيتزا بيبروني اللحم البقري الفاخر",
    nameEn: "Beef Pepperoni Pizza",
    descAr: "شرائح بيبروني بقري متبلة مع جبنة موزاريلا وصلصة بيتزا خاصة",
    priceSar: 35.0,
    prepTime: 18,
    calories: 890,
    allergens: ["غلوتين", "ألبان"],
  });

  await upsertMenuItem({
    sectionId: secPizza,
    nameAr: "بيتزا دجاج الباربكيو المدخن",
    nameEn: "BBQ Chicken Pizza",
    descAr: "قطع صدور دجاج مشوية مع صوص الباربكيو والبصل الأحمر والجبنة الذائبة",
    priceSar: 34.0,
    prepTime: 18,
    calories: 840,
    allergens: ["غلوتين", "ألبان"],
  });

  await upsertMenuItem({
    sectionId: secPizza,
    nameAr: "بيتزا خضار مشكلة البحر الأبيض المتوسط",
    nameEn: "Mediterranean Veggie Pizza",
    descAr: "فلفل رومي ألوان، زيتون أسود، مشروم، طماطم، ذرة، وجبن موزاريلا",
    priceSar: 31.0,
    prepTime: 17,
    calories: 680,
    allergens: ["غلوتين", "ألبان"],
  });

  // فطائر
  await upsertMenuItem({
    sectionId: secPies,
    nameAr: "فطيرة جبن قشقوان بلدي تركي",
    nameEn: "Turkish Kashkaval Cheese Pie",
    descAr: "فطيرة محشوة بجبن القشقوان البلدي الذائب المخبوز في الفرن الحجري",
    priceSar: 14.0,
    prepTime: 12,
    calories: 410,
    allergens: ["غلوتين", "ألبان"],
    isSuggestedInCart: true,
  });

  await upsertMenuItem({
    sectionId: secPies,
    nameAr: "فطيرة زعتر بلدي فاخر بزيت الزيتون",
    nameEn: "Thyme & Olive Oil Pie (Zaatar)",
    descAr: "زعتر فلسطيني بلدي مع السمسم وزيت الزيتون البكر الممتاز",
    priceSar: 9.0,
    prepTime: 10,
    calories: 340,
    allergens: ["غلوتين", "سمسم"],
  });

  await upsertMenuItem({
    sectionId: secPies,
    nameAr: "صفيحة لحم بعجين بدبس الرمان",
    nameEn: "Meat Lahmacun with Pomegranate Molasses",
    descAr: "لحم مفروم طازج متبل بالبصل والبقدونس ودبس الرمان على عجينة رقيقة مقرمشة",
    priceSar: 12.0,
    prepTime: 12,
    calories: 380,
    allergens: ["غلوتين"],
  });

  // مقبلات
  await upsertMenuItem({
    sectionId: secDrinks,
    nameAr: "خبز الثوم بالجبنة والأعشاب الإيطالية",
    nameEn: "Garlic Bread with Melted Cheese",
    descAr: "شرائح خبز فرنسي مقرمشة مدهونة بزبدة الثوم والأوريجانو مع جبن الموزاريلا",
    priceSar: 13.0,
    prepTime: 10,
    calories: 360,
    allergens: ["غلوتين", "ألبان"],
    isSuggestedInCart: true,
  });

  await upsertMenuItem({
    sectionId: secDrinks,
    nameAr: "شاي مثلج بالليمون والخوخ 330 مل",
    nameEn: "Iced Peach Lemon Tea 330ml",
    descAr: "شاي مثلج منعش مع نكهة الخوخ والليمون الطبيعية",
    priceSar: 6.0,
    prepTime: 2,
    calories: 95,
    isSuggestedInCart: true,
  });
}

async function seedMartMenu(storeId: string) {
  const secDairy = await upsertMenuSection(storeId, "الألبان والأجبان والبيض", "Dairy, Cheese & Eggs", 1);
  const secBakery = await upsertMenuSection(storeId, "المخبوزات والمعلبات", "Bakery & Canned Food", 2);
  const secSnacks = await upsertMenuSection(storeId, "المشروبات والمسليات", "Beverages & Snacks", 3);

  await upsertMenuItem({
    sectionId: secDairy,
    nameAr: "حليب طازج نادك كامل الدسم 1 لتر",
    nameEn: "Nadec Fresh Full Cream Milk 1L",
    descAr: "حليب أبقار طازج 100% مبستر ومعبأ يومياً",
    priceSar: 6.5,
    prepTime: 5,
    calories: 140,
    allergens: ["ألبان"],
  });

  await upsertMenuItem({
    sectionId: secDairy,
    nameAr: "لبن عيران المراعي طازج 360 مل",
    nameEn: "Almarai Fresh Ayran 360ml",
    descAr: "لبن رائب منعش ومملح خفيف",
    priceSar: 3.0,
    prepTime: 5,
    calories: 90,
    allergens: ["ألبان"],
  });

  await upsertMenuItem({
    sectionId: secDairy,
    nameAr: "بيض مائدة طازج طبق كرتون (30 بيضة)",
    nameEn: "Fresh Table Eggs Tray (30 Eggs)",
    descAr: "بيض مائدة طازج حجم كبير إنتاج محلي معتمد",
    priceSar: 19.5,
    prepTime: 5,
    calories: 70,
    allergens: ["بيض"],
  });

  await upsertMenuItem({
    sectionId: secBakery,
    nameAr: "خبز تورتيلا أبيض فاخر (6 حبات)",
    nameEn: "White Tortilla Bread (6 Pcs)",
    descAr: "خبز تورتيلا طري ومثالي لتحضير الساندوتشات واللفائف",
    priceSar: 5.0,
    prepTime: 5,
    calories: 150,
    allergens: ["غلوتين"],
  });

  await upsertMenuItem({
    sectionId: secBakery,
    nameAr: "أرز بسمتي أبيض هندي كلاسيك 5 كجم",
    nameEn: "Indian Basmati Rice 5kg",
    descAr: "أرز بسمتي طويل الحبة درجة أولى معتق ومناسب للكبسة والمندي",
    priceSar: 42.0,
    prepTime: 5,
    calories: 130,
  });

  await upsertMenuItem({
    sectionId: secSnacks,
    nameAr: "مياه شرب معبأة كرتون اقتصادي (24 × 200 مل)",
    nameEn: "Bottled Drinking Water Carton (24x200ml)",
    descAr: "كرتون مياه شرب نقية متوازنة الأملاح",
    priceSar: 14.0,
    prepTime: 5,
    calories: 0,
    isSuggestedInCart: true,
  });

  await upsertMenuItem({
    sectionId: secSnacks,
    nameAr: "بطاطس شيبس تسالي بنكهة الكاتشب 160 جم",
    nameEn: "Tasali Ketchup Potato Chips 160g",
    descAr: "شرائح بطاطس مقرمشة بنكهة الطماطم والكاتشب اللذيذة",
    priceSar: 6.0,
    prepTime: 5,
    calories: 240,
    isSuggestedInCart: true,
  });

  await upsertMenuItem({
    sectionId: secSnacks,
    nameAr: "مناديل ورقية ناعمة عبوة التوفير (5 علب)",
    nameEn: "Soft Facial Tissues Pack (5 Boxes)",
    descAr: "مناديل وجه ثلاثية الطبقات فائقة النعومة والامتصاص",
    priceSar: 16.5,
    prepTime: 5,
    calories: 0,
    isSuggestedInCart: true,
  });
}

async function seedCafeMenu(storeId: string) {
  const secCoffee = await upsertMenuSection(storeId, "القهوة المختصة والمشروبات", "Specialty Coffee & Beverages", 1);
  const secBakery = await upsertMenuSection(storeId, "المخبوزات والساندوتشات", "Bakery & Sandwiches", 2);
  const secSweets = await upsertMenuSection(storeId, "الحلويات والمقرمشات", "Desserts & Pastries", 3);

  // 1. صنف بمجال سعرات حرارية (SFDA Calorie Range) مع 3 أحجام ومحتوى كافيين
  const item1 = await upsertMenuItem({
    sectionId: secCoffee,
    nameAr: "فلات وايت بالكراميل المملح",
    nameEn: "Salted Caramel Flat White",
    descAr: "إسبريسو دبل شوت مع حليب مبخر غني بالرغوة المخملية وصلصة الكراميل المملح الخاصة",
    priceSar: 16.0,
    prepTime: 5,
    caloriesMin: 120,
    caloriesMax: 310,
    caffeineMg: 135,
    allergens: ["ألبان"],
  });
  await addSizes(item1, [
    { nameAr: "صغير (Small - 6oz)", nameEn: "Small", deltaSar: 0, cal: 120, isDefault: true },
    { nameAr: "وسط (Medium - 8oz)", nameEn: "Medium", deltaSar: 4, cal: 210 },
    { nameAr: "كبير (Large - 12oz)", nameEn: "Large", deltaSar: 7, cal: 310 },
  ]);

  // 2. صنف مع خيارات إجبارية وعلامة صوديوم عالي (High Salt)
  const item2 = await upsertMenuItem({
    sectionId: secBakery,
    nameAr: "ساندوتش حلوم مشوي مع الزعتر والزيتون",
    nameEn: "Grilled Halloumi Sandwich with Thyme & Olives",
    descAr: "جبن حلوم مشوي مع شرائح الطماطم والخيار ومعجون الزيتون وزيت الزيتون البكر الممتاز",
    priceSar: 22.0,
    prepTime: 8,
    calories: 480,
    isHighSalt: true,
    allergens: ["ألبان", "غلوتين"],
  });
  await addOptionGroup(item2, {
    nameAr: "نوع الخبز (إجباري)",
    nameEn: "Bread Type (Mandatory)",
    isRequired: true,
    min: 1,
    max: 1,
    options: [
      { nameAr: "خبز الساوردو الريفي", nameEn: "Country Sourdough", deltaSar: 0, cal: 40 },
      { nameAr: "كرواسان زبدة فرنسي فاخر", nameEn: "French Butter Croissant", deltaSar: 3, cal: 90 },
    ],
  });
  await addOptionGroup(item2, {
    nameAr: "إضافات اختيارية",
    nameEn: "Optional Extras",
    isRequired: false,
    min: 0,
    max: 2,
    options: [
      { nameAr: "بيستو ريحان إضافي", nameEn: "Extra Basil Pesto", deltaSar: 3, cal: 60 },
      { nameAr: "جرجير بري طازج", nameEn: "Fresh Wild Arugula", deltaSar: 2, cal: 10 },
    ],
  });

  // 3. كوكيز مقترح في السلة
  await upsertMenuItem({
    sectionId: secSweets,
    nameAr: "كوكيز شوكولاتة بلجيكية ثلاثية",
    nameEn: "Triple Belgian Chocolate Cookie",
    descAr: "كوكيز طازج مخبوز يومياً غني بقطع الشوكولاتة الداكنة والحليبية والبيضاء",
    priceSar: 12.0,
    prepTime: 3,
    calories: 320,
    isSuggestedInCart: true,
    allergens: ["غلوتين", "ألبان", "بيض"],
  });

  // 4. مياه فوارة مقترحة في السلة
  await upsertMenuItem({
    sectionId: secCoffee,
    nameAr: "مياه فوارة ناتشرال 250 مل",
    nameEn: "Natural Sparkling Water 250ml",
    descAr: "مياه معدنية غازية فوارة منعشة ومبردة",
    priceSar: 7.0,
    prepTime: 1,
    calories: 0,
    isSuggestedInCart: true,
  });

  // 5. كيكة عسل مقترحة في السلة
  await upsertMenuItem({
    sectionId: secSweets,
    nameAr: "كيكة العسل الروسية الكلاسيكية",
    nameEn: "Classic Russian Honey Cake",
    descAr: "طبقات رقيقة من البسكويت المخبوز بالعسل الطبيعي مع كريمة خفيفة متوازنة",
    priceSar: 24.0,
    prepTime: 4,
    calories: 380,
    isSuggestedInCart: true,
    allergens: ["غلوتين", "ألبان", "بيض"],
  });

  // 6. قهوة مقطرة مختصة
  await upsertMenuItem({
    sectionId: secCoffee,
    nameAr: "قهوة مقطرة V60 إثيوبيا قوجي",
    nameEn: "Ethiopia Guji V60 Drip Coffee",
    descAr: "قهوة مختصة مقطرة بطريقة V60 تتميز بإيحاءات الخوخ والياسمين وقوام سلس ومتوازن",
    priceSar: 19.0,
    prepTime: 6,
    calories: 5,
    caffeineMg: 165,
  });
}

async function seedBakeryMenu(storeId: string) {
  const secBreads = await upsertMenuSection(storeId, "المخبوزات الطازجة والخبز البلدي", "Fresh Breads & Bakery", 1);
  const secPastries = await upsertMenuSection(storeId, "الحلويات الشعبية والمعمول", "Traditional Pastries & Mamoul", 2);
  const secDrinks = await upsertMenuSection(storeId, "المشروبات والتموينات", "Drinks & Groceries", 3);

  // 1. صامولي طازج بالسمسم (كيس 6 حبات)
  const item1 = await upsertMenuItem({
    sectionId: secBreads,
    nameAr: "صامولي طازج بالسمسم (كيس 6 حبات)",
    nameEn: "Fresh Sesame Samoli Bread (6 pcs)",
    descAr: "خبز صامولي هش وطري مخبوز يومياً في أفران الحجر مع رشة سمسم ذهبي محمص",
    priceSar: 4.0,
    prepTime: 3,
    calories: 180,
    allergens: ["غلوتين", "سمسم"],
  });

  // 2. شريك حجازي بلدي بالسمسم وحبة البركة
  const item2 = await upsertMenuItem({
    sectionId: secBreads,
    nameAr: "شريك حجازي بلدي بالسمسم وحبة البركة",
    nameEn: "Hijazi Shuraik Bread with Sesame & Nigella",
    descAr: "شريك حجازي أصيل محضر بالطريقة التقليدية مع السمن والسمسم وحبة البركة العطرة",
    priceSar: 5.5,
    prepTime: 5,
    calories: 260,
    allergens: ["غلوتين", "سمسم", "ألبان"],
  });

  // 3. تميس بلدي بالجبنة
  const item3 = await upsertMenuItem({
    sectionId: secBreads,
    nameAr: "تميس بلدي بالجبنة السائلة والشيدر",
    nameEn: "Traditional Tamees with Cream & Cheddar Cheese",
    descAr: "تميس ساخن من الفرن محشو بمزيج غني من الجبنة الكريمية والشيدر الذائب",
    priceSar: 8.0,
    prepTime: 8,
    calories: 420,
    allergens: ["غلوتين", "ألبان"],
  });

  // 4. معمول تمر فاخر بالسمن البري
  const item4 = await upsertMenuItem({
    sectionId: secPastries,
    nameAr: "معمول تمر فاخر بالسمن البري (علبة 500 جم)",
    nameEn: "Luxury Date Maamoul with Pure Ghee (500g)",
    descAr: "معمول هش يذوب في الفم محشو بعجوة المدينة الفاخرة ومحضر بالسمن البري النقي",
    priceSar: 28.0,
    prepTime: 3,
    calories: 380,
    isSuggestedInCart: true,
    allergens: ["غلوتين", "ألبان"],
  });

  // 5. شابورة باليانسون والسمسم
  const item5 = await upsertMenuItem({
    sectionId: secPastries,
    nameAr: "شابورة حجازية باليانسون والسمسم (كيس 400 جم)",
    nameEn: "Hijazi Rusk with Anise & Sesame (400g)",
    descAr: "شابورة مقرمشة لذيذة مع نكهة اليانسون والسمسم الطبيعي، مثالية مع الشاي العدني أو الكرك",
    priceSar: 12.0,
    prepTime: 3,
    calories: 210,
    allergens: ["غلوتين", "سمسم", "بيض"],
  });

  // 6. مياه شرب معبأة 330 مل مقترحة في السلة
  await upsertMenuItem({
    sectionId: secDrinks,
    nameAr: "مياه شرب معبأة نقية (330 مل)",
    nameEn: "Pure Bottled Water (330ml)",
    descAr: "مياه شرب نقية مبردة متوازنة الأملاح",
    priceSar: 1.5,
    prepTime: 1,
    calories: 0,
    isSuggestedInCart: true,
  });
}

// دالة إضافة قسم المنيو
async function upsertMenuSection(storeId: string, nameAr: string, nameEn: string, sortOrder: number) {
  const { data: existing } = await supabase
    .from("menu_sections")
    .select("id")
    .eq("store_id", storeId)
    .eq("name_ar", nameAr)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: inserted, error } = await supabase
    .from("menu_sections")
    .insert({
      store_id: storeId,
      name_ar: nameAr,
      name_en: nameEn,
      sort_order: sortOrder,
      is_active: true,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    throw new Error(`فشل إضافة قسم ${nameAr}: ${error?.message}`);
  }
  return inserted.id;
}

interface ItemParams {
  sectionId: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  priceSar: number;
  prepTime: number;
  calories?: number;
  caloriesMin?: number;
  caloriesMax?: number;
  allergens?: string[];
  isSfdaExempt?: boolean;
  sfdaReasonId?: string | null;
  isSuggestedInCart?: boolean;
  caffeineMg?: number | null;
  isHighSalt?: boolean;
  imageUrl?: string;
}

async function upsertMenuItem(p: ItemParams) {
  const { data: existing } = await supabase
    .from("menu_items")
    .select("id")
    .eq("section_id", p.sectionId)
    .eq("name_ar", p.nameAr)
    .maybeSingle();

  const payload: any = {
    section_id: p.sectionId,
    name_ar: p.nameAr,
    name_en: p.nameEn,
    description_ar: p.descAr,
    base_price_halalas: Math.round(p.priceSar * 100),
    prep_time_minutes: p.prepTime,
    is_available: true,
    is_published: true, // نشر فوري لاكتمال الشروط
    allergens: p.allergens || [],
    is_suggested_in_cart: !!p.isSuggestedInCart,
    has_caffeine: p.caffeineMg != null && p.caffeineMg > 0,
    caffeine_mg: p.caffeineMg ?? null,
    is_high_salt: !!p.isHighSalt,
    image_url: p.imageUrl || null,
  };

  if (p.isSfdaExempt && p.sfdaReasonId) {
    payload.is_sfda_exempt = true;
    payload.sfda_exemption_reason_id = p.sfdaReasonId;
    payload.calories_value = null;
    payload.calories_min = null;
    payload.calories_max = null;
  } else if (p.caloriesMin != null && p.caloriesMax != null) {
    payload.calories_min = p.caloriesMin;
    payload.calories_max = p.caloriesMax;
    payload.calories_value = null;
    payload.is_sfda_exempt = false;
    payload.sfda_exemption_reason_id = null;
  } else {
    payload.calories_value = p.calories ?? 250;
    payload.calories_min = null;
    payload.calories_max = null;
    payload.is_sfda_exempt = false;
    payload.sfda_exemption_reason_id = null;
  }

  if (existing) {
    const { data: updated } = await supabase
      .from("menu_items")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single();
    return updated!.id;
  }

  const { data: inserted, error } = await supabase
    .from("menu_items")
    .insert(payload)
    .select("id")
    .single();

  if (error || !inserted) {
    throw new Error(`فشل إضافة صنف ${p.nameAr}: ${error?.message}`);
  }
  return inserted.id;
}

async function addSizes(itemId: string, sizes: Array<{ nameAr: string; nameEn: string; deltaSar: number; cal?: number; isDefault?: boolean }>) {
  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i];
    const { data: existing } = await supabase
      .from("menu_item_sizes")
      .select("id")
      .eq("item_id", itemId)
      .eq("name_ar", s.nameAr)
      .maybeSingle();

    if (!existing) {
      await supabase.from("menu_item_sizes").insert({
        item_id: itemId,
        name_ar: s.nameAr,
        name_en: s.nameEn,
        price_delta_halalas: Math.round(s.deltaSar * 100),
        calories_value: s.cal || null,
        is_default: !!s.isDefault,
        sort_order: i + 1,
      });
    }
  }
}

async function addOptionGroup(itemId: string, grp: {
  nameAr: string;
  nameEn: string;
  isRequired: boolean;
  min: number;
  max: number;
  options: Array<{ nameAr: string; nameEn: string; deltaSar: number; cal?: number }>;
}) {
  const { data: existing } = await supabase
    .from("menu_item_option_groups")
    .select("id")
    .eq("item_id", itemId)
    .eq("name_ar", grp.nameAr)
    .maybeSingle();

  let groupId = existing?.id;

  if (!groupId) {
    const { data: inserted } = await supabase
      .from("menu_item_option_groups")
      .insert({
        item_id: itemId,
        name_ar: grp.nameAr,
        name_en: grp.nameEn,
        is_required: grp.isRequired,
        min_selectable: grp.min,
        max_selectable: grp.max,
        sort_order: 1,
      })
      .select("id")
      .single();
    groupId = inserted?.id;
  }

  if (groupId) {
    for (let i = 0; i < grp.options.length; i++) {
      const opt = grp.options[i];
      const { data: existingOpt } = await supabase
        .from("menu_item_options")
        .select("id")
        .eq("group_id", groupId)
        .eq("name_ar", opt.nameAr)
        .maybeSingle();

      if (!existingOpt) {
        await supabase.from("menu_item_options").insert({
          group_id: groupId,
          name_ar: opt.nameAr,
          name_en: opt.nameEn,
          price_delta_halalas: Math.round(opt.deltaSar * 100),
          calories_delta: opt.cal || 0,
          sort_order: i + 1,
        });
      }
    }
  }
}

main().catch((err) => {
  console.error("فشل تنفيذ السكربت:", err);
  process.exit(1);
});
