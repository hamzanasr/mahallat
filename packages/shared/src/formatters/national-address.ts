/**
 * دوال التحقق وتنسيق العنوان الوطني المختصر (CUS-002)
 * يتكون العنوان الوطني المختصر في المملكة العربية السعودية من 4 أحرف لاتينية تليها 4 أرقام (مثال: RRRD2929).
 */

const SHORT_NATIONAL_ADDRESS_REGEX = /^[A-Za-z]{4}\d{4}$/;

/**
 * يتحقق من صحة صيغة العنوان الوطني المختصر (4 حروف لاتينية و4 أرقام)
 */
export function isValidShortNationalAddress(code: string | null | undefined): boolean {
  if (!code) return false;
  const clean = code.trim();
  return SHORT_NATIONAL_ADDRESS_REGEX.test(clean);
}

/**
 * توحيد صيغة العنوان الوطني المختصر بتحويل الحروف إلى أحرف كبيرة (Uppercase) وحذف الفراغات
 */
export function normalizeShortNationalAddress(code: string | null | undefined): string {
  if (!code) return '';
  return code.trim().toUpperCase();
}
