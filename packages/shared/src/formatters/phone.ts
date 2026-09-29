/**
 * دوال معالجة وتنسيق أرقام الجوال السعودية (CUS-001)
 */

const ARABIC_TO_ENGLISH_DIGITS: Record<string, string> = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
};

/**
 * تحويل الأرقام العربية المشرقية إلى أرقام إنجليزية
 */
export function normalizeDigits(input: string): string {
  return input.replace(/[٠-٩]/g, (match) => ARABIC_TO_ENGLISH_DIGITS[match] || match);
}

/**
 * توحيد رقم الجوال السعودي بصيغة دولية موحدة (+9665xxxxxxxx)
 * يقبل:
 * - 05xxxxxxxx
 * - 5xxxxxxxx
 * - +9665xxxxxxxx
 * - 9665xxxxxxxx
 * - 009665xxxxxxxx
 * - الأرقام بالأحرف العربية (٠٥...)
 * يرجع null إذا كان الرقم غير سعودي أو غير صالح.
 */
export function normalizeSaudiPhone(input: string): string | null {
  if (!input || typeof input !== "string") return null;

  // 1. تحويل الأرقام العربية وإزالة المسافات والرموز غير الرقمية (مع الإبقاء على + مؤقتاً)
  let cleaned = normalizeDigits(input.trim());
  const hasPlus = cleaned.startsWith("+");
  cleaned = cleaned.replace(/\D/g, "");

  // 2. إزالة بادئة الصفرين الدوليين 00
  if (cleaned.startsWith("00966")) {
    cleaned = cleaned.slice(5);
  } else if (cleaned.startsWith("966")) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith("05")) {
    cleaned = cleaned.slice(1); // يصبح 5xxxxxxxx
  }

  // 3. التحقق من أن المتبقي 9 أرقام يبدأ بـ 5
  if (/^5\d{8}$/.test(cleaned)) {
    return `+966${cleaned}`;
  }

  return null;
}

/**
 * فحص هل الرقم رقم جوال سعودي صالح
 */
export function isValidSaudiPhone(input: string): boolean {
  return normalizeSaudiPhone(input) !== null;
}

/**
 * عرض الرقم بصيغة محلية مقروءة (05xxxxxxxx)
 */
export function formatLocalSaudiPhone(input: string): string {
  const normalized = normalizeSaudiPhone(input);
  if (!normalized) return input;
  return `0${normalized.slice(4)}`;
}

/**
 * إخفاء منتصف رقم الجوال لحماية الخصوصية كما في المواصفات: (مثل 05•• ••• 421)
 */
export function maskSaudiPhone(input: string): string {
  const local = formatLocalSaudiPhone(input);
  if (local.length !== 10 || !local.startsWith("05")) {
    return input;
  }
  const prefix = local.slice(0, 2); // 05
  const suffix = local.slice(7); // آخر 3 أرقام
  return `${prefix}•• ••• ${suffix}`;
}
