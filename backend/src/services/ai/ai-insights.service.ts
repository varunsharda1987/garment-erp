/**
 * AI Insights Service
 *
 * Aggregates what the assistant recorded on every answer (ai_messages.metadata, written by
 * the chat route) plus thumbs up/down (ai_feedback) into the lists an admin needs to decide
 * which guides to write or fix next. Read-only. Volumes are small (a few hundred answers a
 * month), so rows are loaded for the date range and grouped in JS — no JSON-path SQL.
 */

import prisma from '../../config/database';
import type { AssistantMessageMetadata } from './conversation.service';
import { searchMissService } from '../search-miss.service';

export interface InsightsRange {
  from: Date;
  to: Date;
}

export interface QuestionGroup {
  question: string;
  count: number;
  lastAskedAt: string;
  samplePageRoute: string | null;
  sampleRole: string | null;
  messageIds: string[];
  dataLookup: boolean;
}

export interface WeakMatchGroup extends QuestionGroup {
  guideSlugs: string[];
  topScore: number;
}

export interface NegativeFeedbackItem {
  messageId: string;
  createdAt: string;
  question: string;
  answerSnippet: string;
  guideSlugs: string[];
  issueType: string | null;
  comment: string | null;
  userRole: string | null;
  pageRoute: string | null;
}

export interface GuideUsageRow {
  slug: string;
  title: string;
  route: string | null;
  uses: number;
  helpful: number;
  notHelpful: number;
  ratio: number | null;
}

export interface InsightsSummary {
  from: string;
  to: string;
  totalQuestions: number;
  zeroMatch: number;
  weak: number;
  negativeFeedback: number;
  positiveFeedback: number;
  withPageRoute: number;
  knowledgeDisabled: number;
  /** Distinct searches that returned nothing (search_misses rows) */
  searchMisses: number;
}

const MAX_ROWS = 5000;
const DEFAULT_LIMIT = 100;
/** Keyword score at or below this means the guide was found by a single loose word */
const WEAK_MAX_SCORE = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Defaults to the last 30 days. `to` is inclusive — it runs to the end of that day. */
export function resolveRange(from?: string, to?: string): InsightsRange {
  const end = parseDate(to) ?? new Date();
  end.setHours(23, 59, 59, 999);
  const start = parseDate(from) ?? new Date(end.getTime() - 30 * DAY_MS);
  start.setHours(0, 0, 0, 0);
  return { from: start, to: end };
}

/** "How do I create a GRN?" → "how do i create a grn" so repeats group together. */
export function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[?!.।\s]+$/u, '');
}

type FeedbackRow = { rating: string; issueType: string | null; comment: string | null };

interface AssistantRow {
  id: string;
  content: string;
  createdAt: Date;
  metadata: AssistantMessageMetadata | null;
  feedback: FeedbackRow[];
}

type MetaRow = AssistantRow & { metadata: AssistantMessageMetadata };

/** Rows written before insights existed have no question on them — they are skipped. */
function readMetadata(value: unknown): AssistantMessageMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const meta = value as Partial<AssistantMessageMetadata>;
  if (typeof meta.question !== 'string') return null;
  return {
    question: meta.question,
    userRole: meta.userRole,
    guideSlugs: Array.isArray(meta.guideSlugs) ? meta.guideSlugs : [],
    guideScores: meta.guideScores ?? {},
    topScore: typeof meta.topScore === 'number' ? meta.topScore : 0,
    zeroMatch: Boolean(meta.zeroMatch),
    dataLookup: Boolean(meta.dataLookup),
    knowledgeEnabled: meta.knowledgeEnabled !== false,
    pageRoute: meta.pageRoute,
    pageGuideSlug: meta.pageGuideSlug,
    recentErrors: meta.recentErrors,
    recentPages: meta.recentPages,
  };
}

const hasMetadata = (row: AssistantRow): row is MetaRow => row.metadata !== null;
const hasRating = (row: AssistantRow, rating: 'HELPFUL' | 'NOT_HELPFUL') =>
  row.feedback.some((entry) => entry.rating === rating);
const isUnanswered = (meta: AssistantMessageMetadata, includeData: boolean) =>
  meta.zeroMatch && meta.knowledgeEnabled && (includeData || !meta.dataLookup);
const isWeak = (meta: AssistantMessageMetadata) =>
  !meta.zeroMatch && meta.knowledgeEnabled && meta.topScore <= WEAK_MAX_SCORE;

/** Rows arrive newest first, so the first row of a group supplies "last asked". */
function groupRows(rows: MetaRow[]): WeakMatchGroup[] {
  const groups = new Map<string, WeakMatchGroup & { slugSet: Set<string> }>();

  for (const row of rows) {
    const key = normalizeQuestion(row.metadata.question);
    if (!key) continue;

    let group = groups.get(key);
    if (!group) {
      group = {
        question: row.metadata.question.trim(),
        count: 0,
        lastAskedAt: row.createdAt.toISOString(),
        samplePageRoute: row.metadata.pageRoute ?? null,
        sampleRole: row.metadata.userRole ?? null,
        messageIds: [],
        dataLookup: row.metadata.dataLookup,
        guideSlugs: [],
        topScore: 0,
        slugSet: new Set<string>(),
      };
      groups.set(key, group);
    }

    group.count += 1;
    if (group.messageIds.length < 5) group.messageIds.push(row.id);
    if (!group.samplePageRoute && row.metadata.pageRoute) group.samplePageRoute = row.metadata.pageRoute;
    if (!group.sampleRole && row.metadata.userRole) group.sampleRole = row.metadata.userRole;
    for (const slug of row.metadata.guideSlugs) group.slugSet.add(slug);
    group.topScore = Math.max(group.topScore, row.metadata.topScore);
  }

  return [...groups.values()]
    .map(({ slugSet, ...group }) => ({ ...group, guideSlugs: [...slugSet] }))
    .sort((a, b) => b.count - a.count || b.lastAskedAt.localeCompare(a.lastAskedAt));
}

class AiInsightsService {
  private async loadAssistant(range: InsightsRange): Promise<AssistantRow[]> {
    const rows = await prisma.ai_messages.findMany({
      where: { role: 'ASSISTANT', createdAt: { gte: range.from, lte: range.to } },
      select: {
        id: true,
        content: true,
        createdAt: true,
        metadata: true,
        feedback: { select: { rating: true, issueType: true, comment: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_ROWS,
    });
    return rows.map((row) => ({ ...row, metadata: readMetadata(row.metadata) }));
  }

  async getSummary(range: InsightsRange): Promise<InsightsSummary> {
    const rows = await this.loadAssistant(range);
    const withMeta = rows.filter(hasMetadata);
    const searchMisses = await searchMissService.count(range);
    return {
      searchMisses,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      totalQuestions: withMeta.length,
      zeroMatch: withMeta.filter((row) => isUnanswered(row.metadata, false)).length,
      weak: withMeta.filter((row) => isWeak(row.metadata)).length,
      negativeFeedback: rows.filter((row) => hasRating(row, 'NOT_HELPFUL')).length,
      positiveFeedback: rows.filter((row) => hasRating(row, 'HELPFUL')).length,
      withPageRoute: withMeta.filter((row) => Boolean(row.metadata.pageRoute)).length,
      knowledgeDisabled: withMeta.filter((row) => !row.metadata.knowledgeEnabled).length,
    };
  }

  /** Questions no guide matched, grouped by normalised text, most frequent first. */
  async getUnanswered(
    range: InsightsRange,
    opts: { includeData?: boolean; limit?: number } = {}
  ): Promise<QuestionGroup[]> {
    const rows = await this.loadAssistant(range);
    const matching = rows.filter(hasMetadata).filter((row) => isUnanswered(row.metadata, opts.includeData ?? false));
    return groupRows(matching).slice(0, opts.limit ?? DEFAULT_LIMIT);
  }

  /** A guide matched, but only by a loose word — the answer may have used the wrong guide. */
  async getWeakMatches(range: InsightsRange, opts: { limit?: number } = {}): Promise<WeakMatchGroup[]> {
    const rows = await this.loadAssistant(range);
    const matching = rows.filter(hasMetadata).filter((row) => isWeak(row.metadata));
    return groupRows(matching).slice(0, opts.limit ?? DEFAULT_LIMIT);
  }

  /** Thumbs-down answers with the guide(s) that produced them. */
  async getNegativeFeedback(range: InsightsRange, opts: { limit?: number } = {}): Promise<NegativeFeedbackItem[]> {
    const rows = await this.loadAssistant(range);
    return rows
      .filter((row) => hasRating(row, 'NOT_HELPFUL'))
      .slice(0, opts.limit ?? DEFAULT_LIMIT)
      .map((row) => {
        const negative = row.feedback.find((entry) => entry.rating === 'NOT_HELPFUL');
        return {
          messageId: row.id,
          createdAt: row.createdAt.toISOString(),
          question: row.metadata?.question ?? '(asked before insights were recorded)',
          answerSnippet: row.content.slice(0, 300),
          guideSlugs: row.metadata?.guideSlugs ?? [],
          issueType: negative?.issueType ?? null,
          comment: negative?.comment ?? null,
          userRole: row.metadata?.userRole ?? null,
          pageRoute: row.metadata?.pageRoute ?? null,
        };
      });
  }

  /** How often each guide answered, and how those answers were rated. */
  async getGuideUsage(range: InsightsRange): Promise<GuideUsageRow[]> {
    const [rows, guides] = await Promise.all([
      this.loadAssistant(range),
      prisma.ai_knowledge_guides.findMany({ select: { slug: true, title: true, route: true } }),
    ]);
    const titles = new Map(guides.map((guide) => [guide.slug, guide]));
    const usage = new Map<string, GuideUsageRow>();

    for (const row of rows.filter(hasMetadata)) {
      const helpful = hasRating(row, 'HELPFUL') ? 1 : 0;
      const notHelpful = hasRating(row, 'NOT_HELPFUL') ? 1 : 0;
      for (const slug of row.metadata.guideSlugs) {
        const entry = usage.get(slug) ?? {
          slug,
          title: titles.get(slug)?.title ?? slug,
          route: titles.get(slug)?.route ?? null,
          uses: 0,
          helpful: 0,
          notHelpful: 0,
          ratio: null,
        };
        entry.uses += 1;
        entry.helpful += helpful;
        entry.notHelpful += notHelpful;
        usage.set(slug, entry);
      }
    }

    return [...usage.values()]
      .map((entry) => ({
        ...entry,
        ratio: entry.helpful + entry.notHelpful > 0 ? entry.helpful / (entry.helpful + entry.notHelpful) : null,
      }))
      .sort((a, b) => b.uses - a.uses || a.slug.localeCompare(b.slug));
  }
}

export const aiInsightsService = new AiInsightsService();
