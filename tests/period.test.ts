import { describe, expect, it } from 'vitest';
import { choiceOf, periodLabel, visitedPeriod, wishPeriod } from '@/features/footprints/period';

describe('wish period', () => {
  it('builds the stored value from the choice', () => {
    expect(wishPeriod('undecided', '', 2026)).toBe('undecided');
    expect(wishPeriod('thisYear', '', 2026)).toBe('2026');
    expect(wishPeriod('nextYear', '', 2026)).toBe('2027');
    expect(wishPeriod('custom', '2027-04', 2026)).toBe('2027-04');
    expect(wishPeriod('custom', '2027-13', 2026)).toBeNull();
    expect(wishPeriod('custom', '', 2026)).toBeNull();
  });
  it('maps stored values back to a choice', () => {
    expect(choiceOf(null, 2026)).toEqual({ choice: 'undecided', custom: '' });
    expect(choiceOf('2026', 2026).choice).toBe('thisYear');
    expect(choiceOf('2027', 2026).choice).toBe('nextYear');
    expect(choiceOf('2028-05', 2026)).toEqual({ choice: 'custom', custom: '2028-05' });
  });
  it('labels periods in Korean', () => {
    expect(periodLabel(null)).toBe('시기 미정');
    expect(periodLabel('undecided')).toBe('시기 미정');
    expect(periodLabel('2027')).toBe('2027년');
    expect(periodLabel('2027-04')).toBe('2027년 4월');
  });
  it('keeps only a valid visited month', () => {
    expect(visitedPeriod('2025-09')).toBe('2025-09');
    expect(visitedPeriod('2025-9')).toBeNull();
    expect(visitedPeriod('')).toBeNull();
  });
});
