import { describe, it, expect } from "vitest";
import {
  normalizeSaudiPhone,
  isValidSaudiPhone,
  formatLocalSaudiPhone,
  maskSaudiPhone,
  normalizeDigits,
} from "../formatters/phone";

describe("Saudi Phone Formatting and Normalization (CUS-001)", () => {
  it("normalizes standard 05xxxxxxxx format to +9665xxxxxxxx", () => {
    expect(normalizeSaudiPhone("0501234567")).toBe("+966501234567");
    expect(normalizeSaudiPhone("0559876543")).toBe("+966559876543");
  });

  it("normalizes short 5xxxxxxxx format without leading zero", () => {
    expect(normalizeSaudiPhone("501234567")).toBe("+966501234567");
  });

  it("normalizes +9665xxxxxxxx and 9665xxxxxxxx formats", () => {
    expect(normalizeSaudiPhone("+966501234567")).toBe("+966501234567");
    expect(normalizeSaudiPhone("966501234567")).toBe("+966501234567");
    expect(normalizeSaudiPhone("00966501234567")).toBe("+966501234567");
  });

  it("normalizes Arabic numerals ٠٥...", () => {
    expect(normalizeDigits("٠٥٠١٢٣٤٥٦٧")).toBe("0501234567");
    expect(normalizeSaudiPhone("٠٥٠١٢٣٤٥٦٧")).toBe("+966501234567");
  });

  it("handles spaces, dashes, and parentheses gracefully", () => {
    expect(normalizeSaudiPhone("050 123 4567")).toBe("+966501234567");
    expect(normalizeSaudiPhone("050-123-4567")).toBe("+966501234567");
    expect(normalizeSaudiPhone("+966 (50) 123-4567")).toBe("+966501234567");
  });

  it("rejects non-Saudi numbers and invalid lengths", () => {
    expect(normalizeSaudiPhone("0112345678")).toBeNull(); // landline
    expect(normalizeSaudiPhone("+201012345678")).toBeNull(); // Egyptian
    expect(normalizeSaudiPhone("+971501234567")).toBeNull(); // UAE
    expect(normalizeSaudiPhone("050123456")).toBeNull(); // 8 digits (too short)
    expect(normalizeSaudiPhone("05012345678")).toBeNull(); // 10 digits (too long)
    expect(normalizeSaudiPhone("abc")).toBeNull();
    expect(isValidSaudiPhone("0501234567")).toBe(true);
    expect(isValidSaudiPhone("123")).toBe(false);
  });

  it("formats local display phone (05xxxxxxxx)", () => {
    expect(formatLocalSaudiPhone("+966501234567")).toBe("0501234567");
    expect(formatLocalSaudiPhone("501234567")).toBe("0501234567");
  });

  it("masks phone number as required in specs (05•• ••• 421)", () => {
    expect(maskSaudiPhone("0501234421")).toBe("05•• ••• 421");
    expect(maskSaudiPhone("+966559876421")).toBe("05•• ••• 421");
  });
});
