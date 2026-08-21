/**
 * AI Knowledge Service
 *
 * Retrieves the step-by-step how-to guides that make the assistant answer with REAL
 * menu/button names instead of generic guesses. Guides are authored from the actual UI
 * code (docs/ai-guides/*.md) and ingested by backend/scripts/ingest-ai-guides.js.
 *
 * Retrieval is plain keyword scoring — no embeddings, no pgvector, no extra service.
 * Keywords deliberately carry English + Hinglish + Devanagari + common misspellings,
 * because the chat mic defaults to hi-IN and emits Devanagari transcripts that share
 * zero tokens with romanized keywords.
 */

import prisma from '../../config/database';
import { logInfo, logError } from '../../utils/logger';
import { systemSettingsService } from '../system-settings.service';

export interface CachedGuide {
  slug: string;
  title: string;
  keywords: string[];
  content: string;
}

/**
 * Score one guide against an ALREADY-LOWERCASED question. Exported as a pure function so
 * the matching rules (phrases, short-word boundaries, Devanagari) are unit-testable.
 * - multi-word keywords are matched as phrases via includes()
 * - very short keywords need a word boundary so "po" doesn't match "position"
 * - Devanagari substrings match through the same includes() path
 */
export function scoreGuide(guide: Pick<CachedGuide, 'title' | 'keywords'>, question: string): number {
  let score = 0;

  for (const rawKeyword of guide.keywords) {
    const keyword = rawKeyword.toLowerCase().trim();
    if (!keyword) continue;

    if (keyword.includes(' ')) {
      // Phrase keyword: "goods receipt", "maal receive"
      if (question.includes(keyword)) score += 3;
    } else if (keyword.length <= 3) {
      // Short keyword: require a word boundary (avoids "po" matching "position")
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'u').test(question)) {
        score += 2;
      }
    } else if (question.includes(keyword)) {
      score += 2;
    }
  }

  // Title words are a weaker signal than curated keywords
  for (const word of guide.title.toLowerCase().split(/\s+/)) {
    if (word.length > 3 && question.includes(word)) score += 1;
  }

  return score;
}

/** Max characters of guide text injected into one prompt. */
const MAX_CONTEXT_CHARS = 3000;
/** How many guides to inject at most. */
const MAX_GUIDES = 3;
/** A guide must score at least this to be considered relevant. */
const MIN_SCORE = 1;

class KnowledgeService {
  private cache: CachedGuide[] = [];
  private cacheStamp: string | null = null; // max(updatedAt) of the loaded set
  private cacheLoaded = false;

  /**
   * Reload guides when the DB set has changed (or nothing is loaded yet).
   * The stamp query is a tiny aggregate over ~35 rows — cheap next to an AI call —
   * and makes a re-ingest visible immediately instead of after a TTL window.
   */
  private async ensureFresh(): Promise<void> {
    const stampRow = await prisma.ai_knowledge_guides.aggregate({
      where: { isActive: true },
      _max: { updatedAt: true },
      _count: { _all: true },
    });

    const stamp = `${stampRow._max.updatedAt?.toISOString() ?? 'none'}:${stampRow._count._all}`;
    if (this.cacheLoaded && stamp === this.cacheStamp) return;

    const guides = await prisma.ai_knowledge_guides.findMany({
      where: { isActive: true },
      select: { slug: true, title: true, keywords: true, content: true },
    });

    this.cache = guides;
    this.cacheStamp = stamp;
    this.cacheLoaded = true;
    logInfo(`[KnowledgeService] Loaded ${guides.length} guides`);
  }

  /**
   * Get the formatted guide block for a question. Empty string when the feature is
   * off, nothing is ingested, or no guide is relevant (the prompt then instructs the
   * model to say the steps are not documented rather than invent menu names).
   */
  async getContext(question: string): Promise<string> {
    try {
      const enabled = await systemSettingsService.getBooleanDefault('AI_KNOWLEDGE_ENABLED');
      if (!enabled) return '';

      await this.ensureFresh();
      if (this.cache.length === 0) return '';

      const normalized = question.toLowerCase();
      const ranked = this.cache
        .map((guide) => ({ guide, score: scoreGuide(guide, normalized) }))
        .filter((entry) => entry.score >= MIN_SCORE)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_GUIDES);

      if (ranked.length === 0) return '';

      const sections: string[] = [];
      let budget = MAX_CONTEXT_CHARS;

      for (const { guide } of ranked) {
        const body = guide.content.length > budget ? `${guide.content.slice(0, budget)}\n…(truncated)` : guide.content;
        sections.push(`### ${guide.title}\n${body}`);
        budget -= body.length;
        if (budget <= 200) break;
      }

      logInfo(`[KnowledgeService] Matched guides: ${ranked.map((r) => `${r.guide.slug}(${r.score})`).join(', ')}`);

      return `\nHOW-TO GUIDES (authoritative — these describe THIS system's real screens):\n${sections.join('\n\n')}\n`;
    } catch (error) {
      // Never break the chat because retrieval failed
      logError('[KnowledgeService] Failed to build context:', error);
      return '';
    }
  }

  /** Drop the cache (used by tests). */
  invalidate(): void {
    this.cacheLoaded = false;
    this.cacheStamp = null;
    this.cache = [];
  }
}

export const knowledgeService = new KnowledgeService();
