import { describe, it, expect } from "vitest";
import { formatMoney } from "../formatters/money";

describe("formatMoney (CUS-001 / Step 2.1)", () => {
  it("formats positive halalas correctly in Arabic", () => {
    expect(formatMoney(4600, "ar")).toBe("46.00 ر.س");
    expect(formatMoney(150, "ar")).toBe("1.50 ر.س");
    expect(formatMoney(25, "ar")).toBe("0.25 ر.س");
  });

  it("formats positive halalas correctly in English", () => {
    expect(formatMoney(4600, "en")).toBe("SAR 46.00");
    expect(formatMoney(150, "en")).toBe("SAR 1.50");
    expect(formatMoney(25, "en")).toBe("SAR 0.25");
  });

  it("formats zero halalas correctly", () => {
    expect(formatMoney(0, "ar")).toBe("0.00 ر.س");
    expect(formatMoney(0, "en")).toBe("SAR 0.00");
  });

  it("handles negative halalas gracefully", () => {
    expect(formatMoney(-500, "ar")).toBe("-5.00 ر.س");
    expect(formatMoney(-500, "en")).toBe("-SAR 5.00");
  });

  it("defaults to Arabic locale when not provided", () => {
    expect(formatMoney(1000)).toBe("10.00 ر.س");
  });
});
