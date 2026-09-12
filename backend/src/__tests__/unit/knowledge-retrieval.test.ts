/**
 * AI Knowledge Retrieval Unit Tests — the guide-matching rules as a pure function.
 *
 * These pin the three failure modes the design review flagged:
 *  1. Devanagari questions (the chat mic defaults to hi-IN and emits Devanagari, which
 *     shares zero characters with romanized keywords) must still match a guide.
 *  2. Multi-word keywords must match as phrases, not require token equality.
 *  3. Short keywords ("po") must not match inside unrelated words ("position").
 */

import {
  scoreGuide,
  normalizeRoute,
  routeBoost,
  isGenericQuestion,
  findPageGuide,
  rankGuides,
  type CachedGuide,
} from '../../services/ai/knowledge.service';

const grnGuide = {
  title: 'Create a GRN (Goods Receipt)',
  keywords: ['grn', 'goods receipt', 'maal receive', 'receive material', 'माल', 'रिसीव', 'greige'],
};

const poGuide = {
  title: 'Raise a Purchase Order',
  keywords: ['po', 'purchase order', 'kharid'],
};

/** getContext lowercases before scoring — mirror that here. */
const ask = (question: string) => question.toLowerCase();

describe('scoreGuide — guide retrieval matching', () => {
  it('matches an English question', () => {
    expect(scoreGuide(grnGuide, ask('How do I create a GRN?'))).toBeGreaterThan(0);
  });

  it('matches a romanized Hinglish phrase', () => {
    expect(scoreGuide(grnGuide, ask('maal receive kaise kare'))).toBeGreaterThan(0);
  });

  it('matches a Devanagari question (voice input)', () => {
    // No latin characters at all — only the Devanagari keywords can carry this
    expect(scoreGuide(grnGuide, ask('माल रिसीव कैसे करें'))).toBeGreaterThan(0);
  });

  it('scores a multi-word keyword as a phrase, not as separate tokens', () => {
    const withPhrase = scoreGuide(grnGuide, ask('where is the goods receipt screen'));
    const withoutPhrase = scoreGuide(grnGuide, ask('where is the goods screen'));
    expect(withPhrase).toBeGreaterThan(withoutPhrase);
  });

  it('does not match a short keyword inside an unrelated word', () => {
    // "po" must not fire on "position"
    expect(scoreGuide(poGuide, ask('what is my position in the queue'))).toBe(0);
  });

  it('matches a short keyword when it stands alone', () => {
    expect(scoreGuide(poGuide, ask('how do i raise a po'))).toBeGreaterThan(0);
  });

  it('returns zero for an unrelated question', () => {
    expect(scoreGuide(grnGuide, ask('how do i change my password'))).toBe(0);
  });

  it('ranks the more relevant guide higher', () => {
    const question = ask('how do i create a purchase order');
    expect(scoreGuide(poGuide, question)).toBeGreaterThan(scoreGuide(grnGuide, question));
  });

  it('counts title words as a weaker signal than keywords', () => {
    // "purchase" appears in the title AND in the "purchase order" keyword
    expect(scoreGuide(poGuide, ask('purchase'))).toBeGreaterThan(0);
  });
});

// ─── Page awareness ─────────────────────────────────────────────────────────

const guide = (slug: string, title: string, route: string | null, keywords: string[]): CachedGuide => ({
  slug,
  title,
  route,
  keywords,
  content: `# ${title}`,
});

const styleCreate = guide('style-create', 'Create a Style', '/styles/new', ['style', 'new style', 'स्टाइल']);
const styleEdit = guide('style-edit', 'Edit an Existing Style', '/styles', ['edit style', 'स्टाइल एडिट']);
const grnCreate = guide('grn-create', 'Create a GRN (Goods Receipt)', '/grn/new', [
  'grn',
  'goods receipt',
  'maal receive',
  'माल',
]);
const guides = [styleCreate, styleEdit, grnCreate];

describe('normalizeRoute', () => {
  it('replaces id segments and strips query string / trailing slash', () => {
    expect(normalizeRoute('/styles/ckx1a2b3c4d5e6f7g8h9i0j1k/edit?tab=2')).toBe('/styles/:id/edit');
    expect(normalizeRoute('/orders/123/')).toBe('/orders/:id');
    expect(normalizeRoute('/styles/8f14e45f-ea3b-4c1a-9c2e-1234567890ab')).toBe('/styles/:id');
    expect(normalizeRoute('/customers')).toBe('/customers');
    expect(normalizeRoute('')).toBe('/');
  });
});

describe('routeBoost', () => {
  it('scores exact page 3, parent page 2, unrelated 0', () => {
    expect(routeBoost('/styles/new', '/styles/new')).toBe(3);
    expect(routeBoost('/styles', '/styles/ckx1a2b3c4d5e6f7g8h9i0j1k/edit')).toBe(2);
    expect(routeBoost('/grn/new', '/styles/new')).toBe(0);
    expect(routeBoost(null, '/styles')).toBe(0);
    expect(routeBoost('/styles', undefined)).toBe(0);
  });
});

describe('findPageGuide', () => {
  it('prefers the longest matching route', () => {
    expect(findPageGuide(guides, '/styles/new')?.guide.slug).toBe('style-create');
    expect(findPageGuide(guides, '/styles/ckx1a2b3c4d5e6f7g8h9i0j1k/edit')?.guide.slug).toBe('style-edit');
    expect(findPageGuide(guides, '/dashboard')).toBeUndefined();
    expect(findPageGuide(guides, undefined)).toBeUndefined();
  });
});

describe('isGenericQuestion', () => {
  it('treats short or "this page" style questions as generic', () => {
    expect(isGenericQuestion(ask('what is this page'))).toBe(true);
    expect(isGenericQuestion(ask('yeh kya hai'))).toBe(true);
    expect(isGenericQuestion(ask('how do i save this form properly'))).toBe(true);
    expect(isGenericQuestion(ask('how do i receive material against a purchase order'))).toBe(false);
  });
});

describe('rankGuides — page-aware ranking', () => {
  it('adds the page guide with zero keyword hits when nothing else matched', () => {
    const result = rankGuides(guides, ask('what should i fill in here to finish'), '/styles/new');
    expect(result.zeroMatch).toBe(true);
    expect(result.topKeywordScore).toBe(0);
    expect(result.ranked.map((r) => r.guide.slug)).toEqual(['style-create']);
    expect(result.pageGuide?.slug).toBe('style-create');
  });

  it('does not add the page guide for a specific question another guide answered', () => {
    const result = rankGuides(guides, ask('how do i record a goods receipt for the fabric'), '/styles/new');
    expect(result.zeroMatch).toBe(false);
    expect(result.ranked.map((r) => r.guide.slug)).toEqual(['grn-create']);
    // still reported so the prompt can say where the user is
    expect(result.pageGuide?.slug).toBe('style-create');
  });

  it('lets a keyword hit outrank a pure page boost at equal total score', () => {
    // "goods receipt" phrase = 3 for the GRN guide; the page guide only carries its boost of 3
    const result = rankGuides(guides, ask('goods receipt'), '/styles/new');
    expect(result.ranked.map((r) => r.guide.slug)).toEqual(['grn-create', 'style-create']);
  });

  it('boosts the page guide on top of its keyword score', () => {
    const result = rankGuides(guides, ask('how do i create a new style for this customer'), '/styles/new');
    expect(result.ranked[0].guide.slug).toBe('style-create');
    expect(result.ranked[0].boost).toBe(3);
    expect(result.ranked[0].score).toBe(result.ranked[0].keywordScore + 3);
    expect(result.topKeywordScore).toBe(result.ranked[0].keywordScore);
  });

  it('keeps zeroMatch and topScore keyword-only even when the page guide is injected', () => {
    const result = rankGuides(guides, ask('kya karu'), '/grn/new');
    expect(result.zeroMatch).toBe(true);
    expect(result.topKeywordScore).toBe(0);
    expect(result.ranked[0].guide.slug).toBe('grn-create');
  });

  it('works without a page route', () => {
    const result = rankGuides(guides, ask('maal receive kaise kare'));
    expect(result.ranked[0].guide.slug).toBe('grn-create');
    expect(result.pageGuide).toBeUndefined();
  });

  it('injects every guide documenting the page on a generic question, general one first', () => {
    // /grn/new is shared by GRN creation and job-work receipt; DB order must not decide
    const jobWorkReceive = guide('job-work-receive', 'Receive Job Work via GRN', '/grn/new', ['job work receive']);
    const result = rankGuides([jobWorkReceive, ...guides], ask('yeh kaise bharu'), '/grn/new');
    expect(result.ranked.map((r) => r.guide.slug)).toEqual(['grn-create', 'job-work-receive']);
    expect(result.pageGuide?.slug).toBe('grn-create');
    expect(findPageGuide([jobWorkReceive, ...guides], '/grn/new')?.guide.slug).toBe('grn-create');
  });
});
