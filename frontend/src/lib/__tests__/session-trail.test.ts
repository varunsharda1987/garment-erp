import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordError,
  recordPage,
  recordSearchMiss,
  getTrail,
  lastPageBefore,
  stripUrl,
  searchTermOf,
  isEmptyResult,
  shouldNudge,
  nudgeQuestion,
  subscribe,
  resetTrail,
} from '../session-trail';

const error = (url: string, status = 400, pageRoute = '/grn/new', at = new Date().toISOString()) => ({
  at,
  method: 'POST',
  url,
  status,
  message: 'Invalid request data',
  pageRoute,
});

const miss = (term: string, pageRoute = '/sale-orders/new', at = new Date().toISOString()) => ({
  at,
  endpoint: '/styles',
  term,
  pageRoute,
});

describe('session-trail', () => {
  beforeEach(() => resetTrail());

  it('keeps the newest 10 errors, newest first', () => {
    for (let i = 0; i < 12; i++) recordError(error(`/x/${i}`));
    const { recentErrors } = getTrail();
    expect(recentErrors).toHaveLength(10);
    expect(recentErrors[0].url).toBe('/x/11');
    expect(recentErrors[9].url).toBe('/x/2');
  });

  it('caps the error message at 200 characters', () => {
    recordError({ ...error('/grn'), message: 'x'.repeat(500) });
    expect(getTrail().recentErrors[0].message).toHaveLength(200);
  });

  it('records pages newest first and skips consecutive repeats', () => {
    recordPage('/grn/new');
    recordPage('/grn/new');
    recordPage('/styles');
    expect(getTrail().recentPages.map((p) => p.path)).toEqual(['/styles', '/grn/new']);
  });

  it('finds the page the user was on before the assistant', () => {
    recordPage('/grn/new');
    recordPage('/ai-assistant');
    expect(lastPageBefore('/ai-assistant')).toBe('/grn/new');
    resetTrail();
    recordPage('/ai-assistant');
    expect(lastPageBefore('/ai-assistant')).toBeUndefined();
  });

  it('returns copies so callers cannot mutate the buffers', () => {
    recordPage('/grn/new');
    getTrail().recentPages.length = 0;
    expect(getTrail().recentPages).toHaveLength(1);
  });

  it('strips query strings and hashes from urls', () => {
    expect(stripUrl('/styles?tab=2#top')).toBe('/styles');
    expect(stripUrl('/grn')).toBe('/grn');
  });
});

describe('empty-search detection', () => {
  it('reads the search term from axios params or the URL', () => {
    expect(searchTermOf({ url: '/styles', params: { search: '  Kasya  LNG ' } })).toBe('Kasya LNG');
    expect(searchTermOf({ url: '/styles?page=1&search=kasya%20lng&limit=200' })).toBe('kasya lng');
    expect(searchTermOf({ url: '/styles?page=1' })).toBe('');
    expect(searchTermOf({ url: '/styles' })).toBe('');
  });

  it('recognises every empty list shape and nothing else', () => {
    expect(isEmptyResult([])).toBe(true);
    expect(isEmptyResult({ data: [] })).toBe(true);
    expect(isEmptyResult({ data: [], pagination: { total: 0 } })).toBe(true);
    expect(isEmptyResult([{ id: 1 }])).toBe(false);
    expect(isEmptyResult({ data: { id: 1 } })).toBe(false);
    expect(isEmptyResult(null)).toBe(false);
  });
});

describe('recordSearchMiss', () => {
  beforeEach(() => resetTrail());

  it('ignores terms shorter than three characters and caps at ten', () => {
    recordSearchMiss(miss('ka'));
    expect(getTrail().recentSearchMisses).toHaveLength(0);
    for (let i = 0; i < 12; i++) recordSearchMiss(miss(`term${i}`));
    expect(getTrail().recentSearchMisses).toHaveLength(10);
    expect(getTrail().recentSearchMisses[0].term).toBe('term11');
  });

  it('collapses the same term repeated on the same endpoint', () => {
    recordSearchMiss(miss('kasya'));
    recordSearchMiss(miss('kasya'));
    expect(getTrail().recentSearchMisses).toHaveLength(1);
  });

  it('notifies subscribers on errors and misses, and unsubscribes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    recordSearchMiss(miss('kasya'));
    recordError(error('/grn'));
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    recordSearchMiss(miss('lng182'));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('shouldNudge', () => {
  beforeEach(() => resetTrail());
  const now = Date.now();
  const page = '/sale-orders/new';

  it('stays quiet after one empty search', () => {
    recordSearchMiss(miss('kasya'));
    expect(shouldNudge(getTrail(), page, now)).toBeNull();
  });

  it('nudges after two distinct empty searches on the page', () => {
    recordSearchMiss(miss('kasya'));
    recordSearchMiss(miss('lng182'));
    expect(shouldNudge(getTrail(), page, now)).toEqual({ kind: 'search', term: 'lng182' });
  });

  it('treats a prefix as the same search still being typed', () => {
    recordSearchMiss(miss('kas'));
    recordSearchMiss(miss('kasya'));
    expect(shouldNudge(getTrail(), page, now)).toBeNull();
  });

  it('only counts the current page and the last two minutes', () => {
    recordSearchMiss(miss('kasya', '/styles'));
    recordSearchMiss(miss('lng182', page, new Date(now - 3 * 60 * 1000).toISOString()));
    recordSearchMiss(miss('abc123', page));
    expect(shouldNudge(getTrail(), page, now)).toBeNull();
  });

  it('nudges after two errors on the page', () => {
    recordError(error('/grn', 400, page));
    recordError(error('/grn', 400, page));
    expect(shouldNudge(getTrail(), page, now)).toEqual({ kind: 'error', message: 'Invalid request data' });
  });

  it('phrases the question for the assistant', () => {
    expect(nudgeQuestion({ kind: 'search', term: 'kasya' }, page)).toContain('searched "kasya" on /sale-orders/new');
    expect(nudgeQuestion({ kind: 'error', message: 'Invalid' }, page)).toContain('got "Invalid" on /sale-orders/new');
  });
});
