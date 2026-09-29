import ar from "./ar.json";
import en from "./en.json";

export type SupportedLanguage = "ar" | "en";
export type Direction = "rtl" | "ltr";

export const translations = {
  ar,
  en,
} as const;

export type TranslationSchema = typeof ar;

/**
 * دالة مساعدة لإرجاع اتجاه النص بناءً على رمز اللغة
 * ar -> rtl
 * en -> ltr
 */
export function getDirection(lang: SupportedLanguage): Direction {
  return lang === "ar" ? "rtl" : "ltr";
}

/**
 * دالة للتحقق هل اللغة من اليمين لليسار
 */
export function isRTL(lang: SupportedLanguage): boolean {
  return getDirection(lang) === "rtl";
}

/**
 * دالة لجلب نصوص لغة معينة
 */
export function getTranslations(lang: SupportedLanguage): TranslationSchema {
  return translations[lang] || translations.ar;
}

/**
 * دالة للوصول إلى النصوص عبر المسار المفصول بنقاط (مثل customer.address.title)
 */
export function translate(lang: SupportedLanguage, path: string): string {
  const dict = getTranslations(lang);
  const parts = path.split(".");
  let cur: any = dict;
  for (const p of parts) {
    if (cur == null) return path;
    cur = cur[p];
  }
  return typeof cur === "string" ? cur : path;
}

export { ar, en };
