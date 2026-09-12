import { describe, it, expect, beforeEach } from 'vitest';
import { recordError, recordPage, getTrail, lastPageBefore, stripUrl, resetTrail } from '../session-trail';

const error = (url: string, status = 400) => ({
  at: '2026-09-12T10:00:00.000Z',
  method: 'POST',
  url,
  status,
  message: 'Invalid request data',
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
