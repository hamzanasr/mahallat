import { describe, it, expect } from "vitest";
import { getDirection, isRTL, getTranslations } from "../i18n";

describe("i18n helper functions", () => {
  it("should return 'rtl' for Arabic and 'ltr' for English", () => {
    expect(getDirection("ar")).toBe("rtl");
    expect(getDirection("en")).toBe("ltr");
  });

  it("should verify isRTL correctly", () => {
    expect(isRTL("ar")).toBe(true);
    expect(isRTL("en")).toBe(false);
  });

  it("should load correct translation dictionary", () => {
    const arTrans = getTranslations("ar");
    expect(arTrans.common.appName).toBe("محلات");
    expect(arTrans.common.direction).toBe("rtl");

    const enTrans = getTranslations("en");
    expect(enTrans.common.appName).toBe("Mahallat");
    expect(enTrans.common.direction).toBe("ltr");
  });
});
