import { describe, it, expect } from 'vitest';
import {
  isValidShortNationalAddress,
  normalizeShortNationalAddress,
} from '../formatters/national-address';

describe('العنوان الوطني المختصر (CUS-002)', () => {
  it('يقبل الصيغة الصحيحة (4 أحرف و4 أرقام)', () => {
    expect(isValidShortNationalAddress('RRRD2929')).toBe(true);
    expect(isValidShortNationalAddress('rrrd2929')).toBe(true);
    expect(isValidShortNationalAddress('EJAA4120')).toBe(true);
    expect(isValidShortNationalAddress('  ABCD1234  ')).toBe(true);
  });

  it('يرفض الصيغ الخاطئة قبل الاتصال بالخادم', () => {
    expect(isValidShortNationalAddress('')).toBe(false);
    expect(isValidShortNationalAddress(null)).toBe(false);
    expect(isValidShortNationalAddress('RRR2929')).toBe(false); // 3 letters
    expect(isValidShortNationalAddress('RRRRD2929')).toBe(false); // 5 letters
    expect(isValidShortNationalAddress('RRRD292')).toBe(false); // 3 digits
    expect(isValidShortNationalAddress('RRRD29299')).toBe(false); // 5 digits
    expect(isValidShortNationalAddress('1234ABCD')).toBe(false); // digits first
    expect(isValidShortNationalAddress('RR-D2929')).toBe(false); // special chars
    expect(isValidShortNationalAddress('رياض1234')).toBe(false); // non-latin letters
  });

  it('يوحد العنوان بالأحرف الكبيرة', () => {
    expect(normalizeShortNationalAddress('rrrd2929')).toBe('RRRD2929');
    expect(normalizeShortNationalAddress('  ejaa4120  ')).toBe('EJAA4120');
  });
});
