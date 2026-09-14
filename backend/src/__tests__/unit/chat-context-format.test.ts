/**
 * Prompt section formatters for the session trail.
 */

import { formatPageContext, formatRecentErrors, formatRecentSearchMisses } from '../../services/ai/chat-context.format';

describe('formatPageContext', () => {
  it('is empty without a page', () => {
    expect(formatPageContext(undefined)).toBe('');
  });

  it('names the page and its guide', () => {
    const text = formatPageContext('/styles/new', { slug: 'style-create', title: 'Create a Style' });
    expect(text).toContain('/styles/new');
    expect(text).toContain('"Create a Style"');
  });

  it('works without a guide', () => {
    expect(formatPageContext('/dashboard')).toContain('/dashboard');
  });
});

describe('formatRecentErrors', () => {
  it('is empty without errors', () => {
    expect(formatRecentErrors(undefined)).toBe('');
    expect(formatRecentErrors([])).toBe('');
  });

  it('lists method, url, status, message and page', () => {
    const text = formatRecentErrors([
      {
        at: '2026-09-12T08:32:00.000Z',
        method: 'POST',
        url: '/grn',
        status: 400,
        message: 'Invalid request data (quantity: Required)',
        pageRoute: '/grn/new',
      },
    ]);
    expect(text).toContain('POST /grn → 400');
    expect(text).toContain('quantity: Required');
    expect(text).toContain('(on /grn/new)');
    expect(text).toContain('cite the exact error');
  });

  it('caps at ten lines', () => {
    const errors = Array.from({ length: 15 }, (_, i) => ({
      at: '2026-09-12T08:32:00.000Z',
      method: 'GET',
      url: `/x/${i}`,
      status: 404,
      message: 'Not found',
    }));
    const lines = formatRecentErrors(errors)
      .split('\n')
      .filter((line) => line.startsWith('- '));
    expect(lines).toHaveLength(10);
  });
});

describe('formatRecentSearchMisses', () => {
  it('is empty without misses', () => {
    expect(formatRecentSearchMisses(undefined)).toBe('');
    expect(formatRecentSearchMisses([])).toBe('');
  });

  it('names the screen, the term and the endpoint, and tells the model not to guess', () => {
    const text = formatRecentSearchMisses([
      { at: '2026-09-14T08:32:00.000Z', endpoint: '/styles', term: 'kasya lng182', pageRoute: '/sale-orders/new' },
    ]);
    expect(text).toContain('on /sale-orders/new');
    expect(text).toContain('"kasya lng182"');
    expect(text).toContain('/styles → 0 results');
    expect(text).toContain('never claim the record exists');
  });
});
