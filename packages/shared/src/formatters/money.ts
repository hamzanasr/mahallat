/**
 * دوال تنسيق المبالغ المالية للعرض فقط (Display Formatters)
 * القاعدة الذهبية: هذا الملف لتنسيق العرض فقط، ولا يدخل فيه أي حساب مالي أو ضرب أو خصم.
 * الحساب المالي محصور في الخادم فقط (PAY-004).
 */

export function formatMoney(halalas: number, locale: "ar" | "en" = "ar"): string {
  if (isNaN(halalas) || halalas === null || halalas === undefined) {
    return locale === "ar" ? "0.00 ر.س" : "SAR 0.00";
  }

  const isNegative = halalas < 0;
  const absHalalas = Math.abs(halalas);
  const riyalsStr = (absHalalas / 100).toFixed(2);

  if (locale === "ar") {
    return isNegative ? `-${riyalsStr} ر.س` : `${riyalsStr} ر.س`;
  } else {
    return isNegative ? `-SAR ${riyalsStr}` : `SAR ${riyalsStr}`;
  }
}
