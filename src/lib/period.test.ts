import { describe, it, expect } from 'vitest';
import { formatPeriodRange, formatDateShort } from './period';

describe('formatPeriodRange', () => {
  it('renders an open-ended range as "start – heute"', () => {
    const start = new Date(2026, 5, 1); // 01.06.2026
    expect(formatPeriodRange(start, null)).toBe('01.06. – heute');
  });

  it('renders a closed range as "start – end.year"', () => {
    const start = new Date(2026, 5, 1); // 01.06.2026
    const end = new Date(2026, 6, 1); // 01.07.2026
    expect(formatPeriodRange(start, end)).toBe('01.06. – 01.07.2026');
  });

  it('pads single-digit day and month', () => {
    const start = new Date(2026, 0, 5); // 05.01.2026
    expect(formatPeriodRange(start, null)).toBe('05.01. – heute');
  });
});

describe('formatDateShort', () => {
  it('formats as DD.MM.', () => {
    expect(formatDateShort(new Date(2026, 11, 25))).toBe('25.12.');
  });

  it('pads single digits', () => {
    expect(formatDateShort(new Date(2026, 0, 3))).toBe('03.01.');
  });
});
