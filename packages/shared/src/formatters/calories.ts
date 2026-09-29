/**
 * دالة تنسيق عرض السعرات الحرارية وفق اشتراطات هيئة الغذاء والدواء (SFDA / CUS-019)
 * - الصنف المعفى: لا تُعرض له سعرات حرارية (ترجع null).
 * - صنف بقيمة واحدة: "450 سعرة حرارية" (أو "450 cal").
 * - صنف بخيارين/حجمين: "400 / 600 سعرة" (قيمتان مفصولتان بشرطة مائلة).
 * - صنف بثلاثة خيارات أو أكثر: "400–820 سعرة" (نطاق من الأدنى للأعلى).
 */

export interface CaloriesFormatOptions {
  caloriesValue?: number | null;
  variantsCalories?: (number | null | undefined)[];
  isSfdaExempt?: boolean;
  lang?: "ar" | "en";
}

export function formatCaloriesDisplay(options: CaloriesFormatOptions): string | null {
  const { caloriesValue, variantsCalories, isSfdaExempt, lang = "ar" } = options;

  // 1. إذا كان الصنف معفى نظامياً من إعلان السعرات (SFDA Exemption)
  if (isSfdaExempt) {
    return null;
  }

  const isAr = lang === "ar";
  const unitText = isAr ? "سعرة حرارية" : "cal";
  const shortUnitText = isAr ? "سعرة" : "cal";

  // تصفية واستخراج الأرقام الإيجابية للأحجام أو الخيارات
  const validVariants = (variantsCalories || [])
    .filter((c): c is number => typeof c === "number" && !isNaN(c) && c > 0);

  // إزالة التكرار والترتيب تصاعدياً
  const uniqueVariants = Array.from(new Set(validVariants)).sort((a, b) => a - b);

  if (uniqueVariants.length >= 3) {
    // 3 خيارات أو أكثر -> نطاق (min–max)
    const min = uniqueVariants[0];
    const max = uniqueVariants[uniqueVariants.length - 1];
    return `${min}–${max} ${unitText}`;
  }

  if (uniqueVariants.length === 2) {
    // خياران بالضبط -> قيمتان مفصولتان بـ /
    return `${uniqueVariants[0]} / ${uniqueVariants[1]} ${shortUnitText}`;
  }

  if (uniqueVariants.length === 1) {
    return `${uniqueVariants[0]} ${unitText}`;
  }

  // إذا لم تكن هناك خيارات لكن توجد قيمة أساسية للصنف
  if (typeof caloriesValue === "number" && !isNaN(caloriesValue) && caloriesValue > 0) {
    return `${caloriesValue} ${unitText}`;
  }

  return null;
}
