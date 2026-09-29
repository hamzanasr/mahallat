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

const DEMO_CITIES = [
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
    name_ar: "جدة",
    name_en: "Jeddah",
    is_active: true,
    geojson: JSON.stringify({
      type: "Polygon",
      coordinates: [
        [
          [39.10, 21.30],
          [39.35, 21.30],
          [39.35, 21.85],
          [39.10, 21.85],
          [39.10, 21.30],
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

async function main() {
  console.log("🚀 بدء تهيئة حسابات الديمو والبيانات التجريبية...");

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
      console.log(`  ✓ المستخدم موجود مسبقاً، تحديث كلمة المرور والتأكيد`);
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
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userId,
      full_name: demoUser.fullName,
      preferred_language: "ar",
      updated_at: new Date().toISOString(),
    });
    if (profileError) {
      console.error(`  ❌ خطأ في تحديث الملف الشخصي:`, profileError.message);
    } else {
      console.log(`  ✓ تم تحديث الملف الشخصي`);
    }

    // إدخال الدور الإداري
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: userId,
      role: demoUser.role as any,
    });
    if (roleError) {
      console.error(`  ❌ خطأ في تعيين الدور:`, roleError.message);
    } else {
      console.log(`  ✓ تم تعيين الدور: ${demoUser.role}`);
    }
  }

  // 2. المدن التجريبية وحدودها
  console.log("\n🏙️ تهيئة المدن التجريبية وحدودها الجغرافية...");
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
      console.log(`  ✓ تم حفظ مدينة ${city.name_ar} مع المضلع الجغرافي بنجاح (معرف: ${savedId})`);
    }
  }

  // 3. التحقق من نقطة داخل الرياض للتأكد من PostGIS ST_Covers
  const { data: riyadhPointCheck } = await supabase.rpc("city_for_point", {
    lat: 24.7136, // برج المملكة بالرياض
    lng: 46.6753,
  });
  console.log("\n📍 فحص إحداثية برج المملكة (24.71, 46.67):", riyadhPointCheck?.[0]?.name_ar || "خارج التغطية");

  const { data: outsideCheck } = await supabase.rpc("city_for_point", {
    lat: 28.0000, // نقطة في الصحراء خارج المدن
    lng: 44.0000,
  });
  console.log("📍 فحص نقطة خارج النطاق (28.00, 44.00):", outsideCheck?.length ? outsideCheck[0].name_ar : "خارج التغطية (صحيح ✓)");

  console.log("\n✅ اكتملت تهيئة حسابات الديمو والمدن بنجاح!");
  console.log("=========================================");
  console.log("بيانات حسابات الديمو الجاهزة للاستخدام:");
  for (const u of DEMO_USERS) {
    console.log(`• ${u.fullName} (${u.role}):`);
    console.log(`  الإيميل: ${u.email}`);
    console.log(`  كلمة المرور: ${u.password}\n`);
  }
  console.log("=========================================");
}

main().catch((err) => {
  console.error("فشل تنفيذ السكربت:", err);
  process.exit(1);
});
