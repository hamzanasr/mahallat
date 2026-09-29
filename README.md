# منصة محلات · Mahallat Platform

منصة توصيل طلبات سريعة ومرنة مبنية بنظام **Monorepo** يجمع بين تطبيقات الجوال ولوحات التحكم في مكان واحد، وتدعم اللغة العربية كاتجاه افتراضي (RTL) مع الالتزام بالأنظمة السعودية (هيئة الغذاء والدواء SFDA، وزارة الشؤون البلدية، هيئة الزكاة والضريبة والجمارك).

---

## 🛠 المتطلبات الأساسية (Prerequisites)

قبل البدء، تأكد من تثبيت البرامج التالية على جهازك (Windows / macOS / Linux):
1. **Node.js**: الإصدار المستقر الحديث (v20 أو v22+).
2. **Git**: مثبت ومُعرّف.
3. **تطبيق Expo Go**: مثبت على هاتفك الذكي من [App Store](https://apps.apple.com/app/expo-go/id982107779) أو [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent) لتجربة تطبيق الجوال.
4. **حساب Supabase**: قاعدة بيانات Postgres مع ملحقات PostGIS و Auth و Storage.

---

## ⚙️ إعداد متغيرات البيئة (Environment Variables)

انسخ ملف `.env.example` إلى `.env` في المجلد الرئيسي:
```powershell
Copy-Item .env.example .env
```

ثم تأكد من احتواء ملف `.env` على المفاتيح التالية:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
DATABASE_URL=postgresql://postgres:your-db-password@db.your-project.supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

> **تنبيه أمني:** مفتاح `SUPABASE_SERVICE_ROLE_KEY` هو مفتاح سري للخادم فقط ولا يُرفع إلى Git ولا يدخل في كود تطبيقات الجوال أو المتصفح نهائياً.

---

## 🚀 التشغيل السريع من الصفر (Quick Start)

### 1. تثبيت جميع الحزم والتبعيات
```powershell
npm install
```

### 2. رفع ترحيل قاعدة البيانات (Database Migrations)
في حال كنت تستخدم مشروع Supabase سحابياً جديداً، ارفع ملفات الترحيل المتسلسلة:
```powershell
npx supabase db push
```
ثم أعد توليد أنواع TypeScript المتطابقة:
```powershell
npm run db:types
```

### 3. حقن البيانات التجريبية الشاملة (Seed Demo Data)
يقوم هذا الأمر بإنشاء حسابات الإدارة، وتحديد حدود المدن الجغرافية (جدة مدينة الاختبار الأساسية مع الرياض والدمام)، وإنشاء المتاجر التجريبية بمختلف أنواع العقود، وفروعها بمستنداتها النظامية، وقوائم طعام واقعية ومطابقة لاشتراطات هيئة الغذاء والدواء SFDA:
```powershell
npm run db:seed-demo
```
*(ملاحظة: السكربت آمن وقابل للتشغيل المتكرر دون تكرار أو تلف البيانات).*

### 4. تشغيل لوحة الإدارة (Next.js Dashboard)
```powershell
npm run dev:web
```
- افتح المتصفح على: [http://localhost:3000/admin](http://localhost:3000/admin)
- **بيانات تسجيل الدخول لحسابات الإدارة:**
  - **المدير العام:** `admin@mahallat.local` | كلمة المرور: `DemoAdmin123!`
  - **مدير العمليات:** `ops@mahallat.local` | كلمة المرور: `DemoAdmin123!`
  - **المدير المالي:** `finance@mahallat.local` | كلمة المرور: `DemoAdmin123!`
  - **خدمة العملاء والدعم:** `support@mahallat.local` | كلمة المرور: `DemoAdmin123!`
  - **رمز التحقق بخطوتين (MFA/OTP):** `123456`

### 5. تشغيل تطبيق العميل (Expo / React Native)
```powershell
npm run dev:customer
```
- سيظهر رمز الاستجابة السريعة (QR Code) في شاشة الأوامر.
- امسح الرمز بكاميرا الجوال أو تطبيق Expo Go لتشغيل التطبيق مباشرة.
- للتشغيل عبر النفق في حال اختلاف الشبكة:
  ```powershell
  npx --workspace=apps/customer expo start --tunnel
  ```

---

## 🧪 فحص الجودة والاختبارات الآلية

```powershell
npm run typecheck    # فحص توافق الأنواع لجميع أجزاء المشروع
npm run lint         # الفحص الشكلي لجودة ونظافة الكود
npm test             # تشغيل جميع الاختبارات الآلية (29 اختباراً تشمل القواعد المالية والأمان)
```

---

## 📁 هيكل المشروع (Monorepo Workspaces)

```
mahallat/
├── apps/
│   ├── web/            # لوحة تحكم الإدارة والتجار (Next.js App Router + Tailwind)
│   ├── customer/       # تطبيق العميل للهواتف الذكية (Expo + React Native)
│   ├── driver/         # تطبيق المندوب (المرحلة 4)
│   └── merchant/       # تطبيق التاجر (المرحلة 5)
├── packages/
│   └── shared/         # الحزمة المشتركة: الترجمة (i18n)، اتجاه الصفحة (RTL)، وأنواع قاعدة البيانات
├── supabase/
│   ├── migrations/     # ملفات الترحيل المتسلسلة لقاعدة البيانات
│   └── seed/           # ملفات البيانات التجريبية الشاملة
├── scripts/            # سكربتات التهيئة الآلية وحقن البيانات التجريبية
└── docs/               # المواصفات الفنية الكاملة، خارطة الطريق، وسجل التقدم
```

---

## ⚖️ القواعد الأساسية للمشروع (Non-negotiables)

1. **القيم المرنة لا تُكتب في الكود:** جميع القيم والمدد والنسب تُقرأ من قاعدة البيانات عبر دالة `get_setting` بالتدرج الهرمي (متجر ← تاجر ← مدينة ← عام ← افتراضي).
2. **الحساب المالي في الخادم حصراً:** تُحسب جميع المبالغ والضرائب والعمولات في الخادم فقط، وتُخزن بالهللة كأعداد صحيحة (`100 هللة = 1 ريال سعودي`).
3. **سجل التدقيق الرقابي الصارم:** كل تعديل على الإعدادات أو العقود أو أسعار الأصناف موثق في `audit_log` بالقيمة السابقة والجديدة مع منع الحذف أو التعديل نهائياً.
4. **العربية أولاً:** اللغة العربية باتجاه RTL هي الأساس، وجميع النصوص تستورد من `packages/shared/src/i18n`.
5. **نظام PostGIS الجغرافي:** تحديد المدن وتغطية الفروع وقواعد المسافات تُحسب بدقة عبر امتداد PostGIS في قاعدة البيانات.
