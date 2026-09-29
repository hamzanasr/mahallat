import { describe, it, expect } from "vitest";
import { formatCaloriesDisplay } from "../formatters/calories";

describe("تنسيق السعرات الحرارية وفق اشتراطات SFDA (CUS-019)", () => {
  it("صنف معفى نظامياً من السعرات يرجع null (لا تُعرض سعراته)", () => {
    const res = formatCaloriesDisplay({
      caloriesValue: 500,
      isSfdaExempt: true,
    });
    expect(res).toBeNull();
  });

  it("صنف بقيمة واحدة فقط يرجع القيمة مع الوحدة", () => {
    const resAr = formatCaloriesDisplay({
      caloriesValue: 450,
      lang: "ar",
    });
    expect(resAr).toBe("450 سعرة حرارية");

    const resEn = formatCaloriesDisplay({
      caloriesValue: 450,
      lang: "en",
    });
    expect(resEn).toBe("450 cal");
  });

  it("صنف بخيارين/حجمين يرجع القيمتين مفصولتين بشرطة مائلة", () => {
    const resAr = formatCaloriesDisplay({
      variantsCalories: [400, 600],
      lang: "ar",
    });
    expect(resAr).toBe("400 / 600 سعرة");

    const resEn = formatCaloriesDisplay({
      variantsCalories: [600, 400], // غير مرتبة
      lang: "en",
    });
    expect(resEn).toBe("400 / 600 cal");
  });

  it("صنف بثلاثة خيارات أو أكثر يرجع نطاقاً من الأدنى للأعلى", () => {
    const resAr = formatCaloriesDisplay({
      variantsCalories: [450, 650, 820],
      lang: "ar",
    });
    expect(resAr).toBe("450–820 سعرة حرارية");

    const resEn = formatCaloriesDisplay({
      variantsCalories: [820, 450, 700, 550],
      lang: "en",
    });
    expect(resEn).toBe("450–820 cal");
  });

  it("صنف بلا بيانات سعرات صالحة يرجع null", () => {
    expect(formatCaloriesDisplay({})).toBeNull();
    expect(formatCaloriesDisplay({ caloriesValue: 0 })).toBeNull();
    expect(formatCaloriesDisplay({ caloriesValue: -10 })).toBeNull();
    expect(formatCaloriesDisplay({ variantsCalories: [] })).toBeNull();
  });
});
