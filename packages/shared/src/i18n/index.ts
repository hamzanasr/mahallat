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

export { ar, en };
