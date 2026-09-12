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
 *
 * The page the user came from adds a route boost, so "how do I save this?" asked from
 * /styles/new finds the style guide. Every retrieval outcome (matches, zero-match, top
 * score) is returned as data so the chat route can persist it for AI Insights.
 */

import prisma from '../../config/database';
import { logInfo, logError } from '../../utils/logger';
import { systemSettingsService } from '../system-settings.service';

export interface CachedGuide {
  slug: string;
  title: string;
  route: string | null;
  keywords: string[];
  content: string;
}

export interface RankedGuide {
  guide: CachedGuide;
  keywordScore: number;
  boost: number;
  score: number;
}

export interface RankingResult {
  ranked: RankedGuide[];
  /** Best keyword-only score across all guides — route boost excluded on purpose */
  topKeywordScore: number;
  /** No guide matched by keywords (the page guide may still have been added) */
  zeroMatch: boolean;
  /** The guide that documents the page the user is on, if any */
  pageGuide?: CachedGuide;
}

export interface KnowledgeMatch {
  slug: string;
  title: string;
  route: string | null;
  score: number;
  keywordScore: number;
}

export interface KnowledgeResult {
  context: string;
  matches: KnowledgeMatch[];
  zeroMatch: boolean;
  topScore: number;
  pageGuide?: { slug: string; title: string };
  enabled: boolean;
}

const EMPTY_RESULT: KnowledgeResult = { context: '', matches: [], zeroMatch: false, topScore: 0, enabled: false };

/** Max characters of guide text injected into one prompt. */
const MAX_CONTEXT_CHARS = 3000;
/** How many guides to inject at most. */
const MAX_GUIDES = 3;
/** A guide must score at least this to be considered relevant. */
const MIN_SCORE = 1;

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

// ─── Route awareness ────────────────────────────────────────────────────────

const ID_SEGMENT = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|c[a-z0-9]{20,}|\d+)$/i;

/** `/styles/ckx…/edit?tab=2` → `/styles/:id/edit` so guide routes compare to live URLs. */
export function normalizeRoute(path: string): string {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, '');
  if (!clean) return '/';
  return clean
    .split('/')
    .map((segment) => (ID_SEGMENT.test(segment) ? ':id' : segment))
    .join('/');
}

/** 3 = the guide documents exactly this page, 2 = a parent page of it, 0 = unrelated. */
export function routeBoost(guideRoute: string | null | undefined, pageRoute: string | undefined): number {
  if (!guideRoute || !pageRoute) return 0;
  const guide = normalizeRoute(guideRoute);
  if (guide === '/') return 0;
  const page = normalizeRoute(pageRoute);
  if (page === guide) return 3;
  if (page.startsWith(`${guide}/`)) return 2;
  return 0;
}

const GENERIC_WORDS =
  /(^|[^\p{L}\p{N}])(this|here|page|screen|save|form|yeh|ye|yah|yahan|yaha|isko|isme|यह|इस|यहाँ|यहां|इसको|इसमें)([^\p{L}\p{N}]|$)/iu;

/** "what is this page", "yeh kya hai", "how do I save this form" — the page guide is the answer. */
export function isGenericQuestion(question: string): boolean {
  const words = question.trim().split(/\s+/).filter(Boolean);
  return words.length <= 4 || GENERIC_WORDS.test(question);
}

/**
 * Several guides can document one page (/grn/new has GRN, job-work receipt and greige-without-PO).
 * Among them the shortest slug is the general one (`grn-create` before `job-work-receive`).
 */
export function comparePageGuides(
  a: { guide: CachedGuide; boost: number },
  b: { guide: CachedGuide; boost: number }
): number {
  return (
    b.boost - a.boost ||
    (b.guide.route?.length ?? 0) - (a.guide.route?.length ?? 0) ||
    a.guide.slug.length - b.guide.slug.length ||
    a.guide.slug.localeCompare(b.guide.slug)
  );
}

/** Longest-prefix match wins: `/styles/new` beats `/styles` when the user is on `/styles/new`. */
export function findPageGuide(
  guides: CachedGuide[],
  pageRoute?: string
): { guide: CachedGuide; boost: number } | undefined {
  if (!pageRoute) return undefined;
  return guides
    .map((guide) => ({ guide, boost: routeBoost(guide.route, pageRoute) }))
    .filter((entry) => entry.boost > 0)
    .sort(comparePageGuides)[0];
}

/**
 * Rank guides for a lowercased question. Keyword matches are the primary signal; the page
 * the user is on adds a boost. The page guide is included even with zero keyword hits when
 * nothing else matched or the question is generic ("what is this page").
 */
export function rankGuides(guides: CachedGuide[], questionLower: string, pageRoute?: string): RankingResult {
  const scored: RankedGuide[] = guides.map((guide) => {
    const keywordScore = scoreGuide(guide, questionLower);
    const boost = routeBoost(guide.route, pageRoute);
    return { guide, keywordScore, boost, score: keywordScore + boost };
  });

  const candidates = scored.filter((entry) => entry.keywordScore >= MIN_SCORE);
  const zeroMatch = candidates.length === 0;
  const topKeywordScore = scored.reduce((max, entry) => Math.max(max, entry.keywordScore), 0);

  // When nothing matched by keyword or the question is generic, inject every guide that documents
  // the page so the model can pick the right one — the general guide (shortest slug) first.
  const page = findPageGuide(guides, pageRoute);
  if (page && (zeroMatch || isGenericQuestion(questionLower))) {
    for (const entry of scored) {
      if (entry.boost === page.boost && !candidates.includes(entry)) candidates.push(entry);
    }
  }

  // At equal total score a keyword hit outranks a pure page boost
  const ranked = candidates
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.keywordScore - a.keywordScore ||
        b.boost - a.boost ||
        a.guide.slug.length - b.guide.slug.length ||
        a.guide.slug.localeCompare(b.guide.slug)
    )
    .slice(0, MAX_GUIDES);

  return { ranked, topKeywordScore, zeroMatch, pageGuide: page?.guide };
}

class KnowledgeService {
  private cache: CachedGuide[] = [];
  private cacheStamp: string | null = null; // max(updatedAt) of the loaded set
  private cacheLoaded = false;

  /**
   * Reload guides when the DB set has changed (or nothing is loaded yet).
   * The stamp query is a tiny aggregate over ~100 rows — cheap next to an AI call —
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
      select: { slug: true, title: true, route: true, keywords: true, content: true },
    });

    this.cache = guides;
    this.cacheStamp = stamp;
    this.cacheLoaded = true;
    logInfo(`[KnowledgeService] Loaded ${guides.length} guides`);
  }

  /**
   * Build the guide block for a question plus the retrieval outcome. `context` is empty when
   * the feature is off, nothing is ingested, or no guide is relevant (the prompt then
   * instructs the model to say the steps are not documented rather than invent menu names).
   */
  async getContext(question: string, opts: { pageRoute?: string } = {}): Promise<KnowledgeResult> {
    try {
      const enabled = await systemSettingsService.getBooleanDefault('AI_KNOWLEDGE_ENABLED');
      if (!enabled) return EMPTY_RESULT;

      await this.ensureFresh();
      if (this.cache.length === 0) return { ...EMPTY_RESULT, enabled: true };

      const normalized = question.toLowerCase();
      const ranking = rankGuides(this.cache, normalized, opts.pageRoute);

      const sections: string[] = [];
      let budget = MAX_CONTEXT_CHARS;

      for (const { guide } of ranking.ranked) {
        const body = guide.content.length > budget ? `${guide.content.slice(0, budget)}\n…(truncated)` : guide.content;
        const navLink = guide.route ? `\n\n**[Open this page](${guide.route})** →` : '';
        sections.push(`### ${guide.title}\n${body}${navLink}`);
        budget -= body.length;
        if (budget <= 200) break;
      }

      if (ranking.ranked.length > 0) {
        logInfo(
          `[KnowledgeService] Matched guides: ${ranking.ranked.map((r) => `${r.guide.slug}(${r.score})`).join(', ')}`
        );
      } else {
        logInfo(`[KnowledgeService] No guide matched: "${question.slice(0, 80)}"`);
      }

      return {
        context:
          sections.length > 0
            ? `\nHOW-TO GUIDES (authoritative — these describe THIS system's real screens):\n${sections.join('\n\n')}\n`
            : '',
        matches: ranking.ranked.map((r) => ({
          slug: r.guide.slug,
          title: r.guide.title,
          route: r.guide.route,
          score: r.score,
          keywordScore: r.keywordScore,
        })),
        zeroMatch: ranking.zeroMatch,
        topScore: ranking.topKeywordScore,
        pageGuide: ranking.pageGuide ? { slug: ranking.pageGuide.slug, title: ranking.pageGuide.title } : undefined,
        enabled: true,
      };
    } catch (error) {
      // Never break the chat because retrieval failed
      logError('[KnowledgeService] Failed to build context:', error);
      return EMPTY_RESULT;
    }
  }

  /** Guides that document a page (exact route first, then parent routes) — for "On this page" suggestions. */
  async getGuidesForRoute(pageRoute: string): Promise<Array<{ slug: string; title: string; route: string | null }>> {
    try {
      await this.ensureFresh();
      return this.cache
        .map((guide) => ({ guide, boost: routeBoost(guide.route, pageRoute) }))
        .filter((entry) => entry.boost > 0)
        .sort(comparePageGuides)
        .slice(0, 3)
        .map(({ guide }) => ({ slug: guide.slug, title: guide.title, route: guide.route }));
    } catch (error) {
      logError('[KnowledgeService] Failed to list guides for route:', error);
      return [];
    }
  }

  /** All active guides (used by the ai-gaps report to test a question against the live set). */
  async getActiveGuides(): Promise<CachedGuide[]> {
    await this.ensureFresh();
    return [...this.cache];
  }

  /** Drop the cache (used by tests). */
  invalidate(): void {
    this.cacheLoaded = false;
    this.cacheStamp = null;
    this.cache = [];
  }
}

export const knowledgeService = new KnowledgeService();
