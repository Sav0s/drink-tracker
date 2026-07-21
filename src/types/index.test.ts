import { describe, it, expect } from 'vitest';
import { formatCents } from './index';

describe('formatCents', () => {
  it('formats whole euros', () => {
    expect(formatCents(150)).toBe('1,50 €');
  });

  it('formats zero', () => {
    expect(formatCents(0)).toBe('0,00 €');
  });

  it('pads a single trailing cent digit', () => {
    expect(formatCents(105)).toBe('1,05 €');
  });

  it('formats larger amounts with the correct comma placement', () => {
    expect(formatCents(123456)).toBe('1234,56 €');
  });
});
