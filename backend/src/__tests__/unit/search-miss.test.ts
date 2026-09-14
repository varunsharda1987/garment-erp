/**
 * Search-miss recorder — the pure rules that turn per-keystroke empty searches into one row per attempt.
 */

import {
  normalizeTerm,
  isEmptySearchResult,
  extractFilters,
  collapseDecision,
  MIN_TERM_LENGTH,
} from '../../services/search-miss.service';

describe('normalizeTerm', () => {
  it('lowercases, trims and collapses whitespace', () => {
    expect(normalizeTerm('  Kasya   LNG182G ')).toBe('kasya lng182g');
  });

  it('returns empty for non-strings and caps at 200 chars', () => {
    expect(normalizeTerm(undefined)).toBe('');
    expect(normalizeTerm(['x'])).toBe('');
    expect(normalizeTerm('a'.repeat(300))).toHaveLength(200);
  });

  it('MIN_TERM_LENGTH keeps single keystrokes out', () => {
    expect(normalizeTerm('ka').length).toBeLessThan(MIN_TERM_LENGTH);
  });
});

describe('isEmptySearchResult', () => {
  it('recognises every empty list shape', () => {
    expect(isEmptySearchResult([])).toBe(true);
    expect(isEmptySearchResult({ data: [] })).toBe(true);
    expect(isEmptySearchResult({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })).toBe(true);
  });

  it('is false for results, single records and non-list bodies', () => {
    expect(isEmptySearchResult([{ id: 1 }])).toBe(false);
    expect(isEmptySearchResult({ data: [{ id: 1 }], pagination: { total: 1 } })).toBe(false);
    expect(isEmptySearchResult({ data: { id: 1 } })).toBe(false);
    expect(isEmptySearchResult({ ok: true })).toBe(false);
    expect(isEmptySearchResult(null)).toBe(false);
    expect(isEmptySearchResult('')).toBe(false);
  });
});

describe('extractFilters', () => {
  it('keeps the other filters and drops paging, sort and the search itself', () => {
    expect(
      extractFilters({
        search: 'kasya',
        page: '1',
        limit: '200',
        sortBy: 'styleCode',
        sortOrder: 'asc',
        status: 'PUBLISHED',
      })
    ).toEqual({ status: 'PUBLISHED' });
  });

  it('returns null when nothing else was set, ignores non-string values', () => {
    expect(extractFilters({ search: 'kasya', page: '1' })).toBeNull();
    expect(extractFilters({ search: 'kasya', ids: ['a', 'b'] as unknown as string })).toBeNull();
  });
});

describe('collapseDecision', () => {
  const now = new Date('2026-09-14T10:00:00.000Z');
  const secondsAgo = (s: number) => new Date(now.getTime() - s * 1000);

  it('creates when there is no previous miss', () => {
    expect(collapseDecision(null, 'kasya', now)).toBe('create');
  });

  it('replaces a prefix typed within a minute (still typing the same search)', () => {
    expect(collapseDecision({ term: 'kas', lastAt: secondsAgo(5) }, 'kasya', now)).toBe('replace');
    expect(collapseDecision({ term: 'kasya', lastAt: secondsAgo(5) }, 'kas', now)).toBe('replace');
  });

  it('does not merge a prefix typed more than a minute ago', () => {
    expect(collapseDecision({ term: 'kas', lastAt: secondsAgo(61) }, 'kasya', now)).toBe('create');
  });

  it('bumps the same term within ten minutes, creates after', () => {
    expect(collapseDecision({ term: 'kasya', lastAt: secondsAgo(9 * 60) }, 'kasya', now)).toBe('bump');
    expect(collapseDecision({ term: 'kasya', lastAt: secondsAgo(11 * 60) }, 'kasya', now)).toBe('create');
  });

  it('creates for an unrelated term', () => {
    expect(collapseDecision({ term: 'kasya', lastAt: secondsAgo(5) }, 'lng182', now)).toBe('create');
  });
});
