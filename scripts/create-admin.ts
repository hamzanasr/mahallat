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

// قراءة الوسائط من سطر الأوامر (مثل --email user@example.com --role super_admin)
const args = process.argv.slice(2);
let email = "";
let role = "super_admin";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--email" && args[i + 1]) {
    email = args[i + 1];
    i++;
  } else if (args[i] === "--role" && args[i + 1]) {
    role = args[i + 1];
    i++;
  }
}

if (!email) {
  console.log("الاستخدام: npm run admin:create -- --email <your-email> [--role <role>]");
  console.log("مثال: npm run admin:create -- --email owner@mahallat.sa");
  process.exit(1);
}

async function main() {
  console.log(`🔍 البحث عن المستخدم بالبريد: ${email}`);
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("❌ خطأ أثناء البحث عن المستخدمين:", listError.message);
    process.exit(1);
  }

  const user = usersData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error(`❌ لم يتم العثور على مستخدم مسجل بالبريد: ${email}`);
    console.log("يرجى التسجيل أولاً في المنصة أو استخدام سكربت الديمو: npm run seed:demo");
    process.exit(1);
  }

  console.log(`✓ وُجد المستخدم (معرف: ${user.id})`);

  // منح الدور
  const { error: roleError } = await supabase.from("user_roles").upsert(
    {
      user_id: user.id,
      role: role as any,
    },
    { onConflict: "user_id,role,store_id,branch_id,fleet_id,city_id" }
  );

  if (roleError) {
    console.error("❌ فشل منح الدور الإداري:", roleError.message);
    process.exit(1);
  }

  console.log(`🎉 تم بنجاح منح الدور (${role}) للمستخدم: ${email}`);
  console.log("يمكنك الآن تسجيل الدخول إلى لوحة الإدارة: http://localhost:3000/admin");
}

main().catch((err) => {
  console.error("فشل تنفيذ السكربت:", err);
  process.exit(1);
});
