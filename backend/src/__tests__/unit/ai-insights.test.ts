/**
 * AI Insights pure helpers — question grouping and date-range defaults.
 */

import { normalizeQuestion, resolveRange } from '../../services/ai/ai-insights.service';

describe('normalizeQuestion', () => {
  it('groups the same question regardless of case, spacing and punctuation', () => {
    expect(normalizeQuestion('  How do I create a GRN?  ')).toBe('how do i create a grn');
    expect(normalizeQuestion('how do i   create a grn')).toBe('how do i create a grn');
    expect(normalizeQuestion('How do I create a GRN!!')).toBe('how do i create a grn');
  });

  it('strips the Devanagari full stop too', () => {
    expect(normalizeQuestion('माल रिसीव कैसे करें।')).toBe('माल रिसीव कैसे करें');
  });
});

describe('resolveRange', () => {
  it('defaults to the last 30 days ending today', () => {
    const range = resolveRange();
    const days = (range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThanOrEqual(30);
    expect(days).toBeLessThan(31.1);
    expect(range.to.getHours()).toBe(23);
  });

  it('runs an explicit range from the start of "from" to the end of "to"', () => {
    const range = resolveRange('2026-09-01', '2026-09-12');
    expect(range.from.getDate()).toBe(1);
    expect(range.from.getHours()).toBe(0);
    expect(range.to.getDate()).toBe(12);
    expect(range.to.getHours()).toBe(23);
  });

  it('ignores an unparseable date', () => {
    const range = resolveRange('not-a-date', 'also-not');
    expect(range.from.getTime()).toBeLessThan(range.to.getTime());
  });
});
