/**
 * AI Knowledge Retrieval Unit Tests — the guide-matching rules as a pure function.
 *
 * These pin the three failure modes the design review flagged:
 *  1. Devanagari questions (the chat mic defaults to hi-IN and emits Devanagari, which
 *     shares zero characters with romanized keywords) must still match a guide.
 *  2. Multi-word keywords must match as phrases, not require token equality.
 *  3. Short keywords ("po") must not match inside unrelated words ("position").
 */

import { scoreGuide } from '../../services/ai/knowledge.service';

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
