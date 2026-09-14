/**
 * Search-miss recorder
 *
 * A search that returns nothing is a 200, so nothing else records it — yet it is the most
 * common way a user gets stuck ("I can't find the style"). transform.middleware.ts calls
 * `record()` for every GET with a `search` param whose body came back empty; AI Insights and
 * backend/scripts/ai-gaps.ts read it back grouped by endpoint + term.
 */

import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { logDebug } from '../utils/logger';

export const MIN_TERM_LENGTH = 3;
const MAX_TERM_LENGTH = 200;
/** A term that extends/shortens the previous one within this window is the same search being typed */
const EXTEND_WINDOW_MS = 60 * 1000;
/** The same term again within this window bumps `hits` instead of adding a row */
const REPEAT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ROWS = 5000;
const DEFAULT_LIMIT = 100;
const PAGING_KEYS = new Set(['search', 'page', 'limit', 'offset', 'sortBy', 'sortOrder', 'sort', 'order']);

export function normalizeTerm(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, MAX_TERM_LENGTH);
}

/** `[]`, `{ data: [] }` and `{ data: [], pagination: { total: 0 } }` all mean "found nothing". */
export function isEmptySearchResult(body: unknown): boolean {
  if (Array.isArray(body)) return body.length === 0;
  if (!body || typeof body !== 'object') return false;
  const data = (body as { data?: unknown }).data;
  return Array.isArray(data) && data.length === 0;
}

/** The other filters active during the search (status, customer…) — paging and sort keys dropped. */
export function extractFilters(query: Record<string, unknown>): Record<string, string> | null {
  const filters: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (PAGING_KEYS.has(key) || typeof value !== 'string' || !value) continue;
    filters[key] = value.slice(0, 100);
    if (Object.keys(filters).length >= 20) break;
  }
  return Object.keys(filters).length > 0 ? filters : null;
}

export type CollapseDecision = 'replace' | 'bump' | 'create';

/**
 * Typing "kas" → "kasya" fires one request per debounce tick; keep one row per search attempt.
 * `previous` is the user's latest miss on this endpoint (any age).
 */
export function collapseDecision(
  previous: { term: string; lastAt: Date } | null,
  term: string,
  now: Date
): CollapseDecision {
  if (!previous) return 'create';
  const age = now.getTime() - previous.lastAt.getTime();
  if (previous.term === term) return age <= REPEAT_WINDOW_MS ? 'bump' : 'create';
  const related = previous.term.startsWith(term) || term.startsWith(previous.term);
  return related && age <= EXTEND_WINDOW_MS ? 'replace' : 'create';
}

export interface SearchMissInput {
  userId: string;
  userRole?: string | null;
  endpoint: string;
  term: string;
  filters?: Record<string, string> | null;
  pageRoute?: string | null;
}

export interface SearchMissGroup {
  term: string;
  endpoint: string;
  samplePageRoute: string | null;
  sampleFilters: Record<string, string> | null;
  /** Sum of hits — how many times anyone typed this and got nothing */
  count: number;
  users: number;
  roles: string[];
  lastAt: string;
}

interface DateRange {
  from: Date;
  to: Date;
}

class SearchMissService {
  async record(input: SearchMissInput): Promise<void> {
    const term = normalizeTerm(input.term);
    if (term.length < MIN_TERM_LENGTH) return;

    const now = new Date();
    const context = {
      pageRoute: input.pageRoute ?? null,
      ...(input.filters ? { filters: input.filters as Prisma.InputJsonValue } : {}),
    };

    const latest = await prisma.search_misses.findFirst({
      where: {
        userId: input.userId,
        endpoint: input.endpoint,
        lastAt: { gte: new Date(now.getTime() - REPEAT_WINDOW_MS) },
      },
      orderBy: { lastAt: 'desc' },
    });
    const decision = collapseDecision(latest, term, now);

    if (decision === 'replace' && latest) {
      await prisma.search_misses.update({ where: { id: latest.id }, data: { term, lastAt: now, ...context } });
    } else if (decision === 'bump' && latest) {
      await prisma.search_misses.update({ where: { id: latest.id }, data: { hits: { increment: 1 }, lastAt: now } });
    } else {
      const repeat = await prisma.search_misses.findFirst({
        where: {
          userId: input.userId,
          endpoint: input.endpoint,
          term,
          lastAt: { gte: new Date(now.getTime() - REPEAT_WINDOW_MS) },
        },
      });
      if (repeat) {
        await prisma.search_misses.update({ where: { id: repeat.id }, data: { hits: { increment: 1 }, lastAt: now } });
      } else {
        await prisma.search_misses.create({
          data: {
            userId: input.userId,
            userRole: input.userRole ?? null,
            endpoint: input.endpoint,
            term,
            firstAt: now,
            lastAt: now,
            ...context,
          },
        });
      }
    }

    logDebug(`[SearchMiss] ${decision} ${input.endpoint} "${term}" page=${input.pageRoute ?? '-'}`);
  }

  /** Rows (distinct search attempts) in the range — the AI Insights summary card. */
  async count(range: DateRange): Promise<number> {
    return prisma.search_misses.count({ where: { lastAt: { gte: range.from, lte: range.to } } });
  }

  /** Grouped by endpoint + term, most frequent first. */
  async listGrouped(range: DateRange, opts: { limit?: number } = {}): Promise<SearchMissGroup[]> {
    const rows = await prisma.search_misses.findMany({
      where: { lastAt: { gte: range.from, lte: range.to } },
      orderBy: { lastAt: 'desc' },
      take: MAX_ROWS,
    });

    const groups = new Map<string, SearchMissGroup & { userSet: Set<string>; roleSet: Set<string> }>();
    for (const row of rows) {
      const key = `${row.endpoint}::${row.term}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          term: row.term,
          endpoint: row.endpoint,
          samplePageRoute: row.pageRoute,
          sampleFilters: (row.filters as Record<string, string> | null) ?? null,
          count: 0,
          users: 0,
          roles: [],
          lastAt: row.lastAt.toISOString(),
          userSet: new Set<string>(),
          roleSet: new Set<string>(),
        };
        groups.set(key, group);
      }
      group.count += row.hits;
      group.userSet.add(row.userId);
      if (row.userRole) group.roleSet.add(row.userRole);
      if (!group.samplePageRoute && row.pageRoute) group.samplePageRoute = row.pageRoute;
      if (!group.sampleFilters && row.filters) group.sampleFilters = row.filters as Record<string, string>;
    }

    return [...groups.values()]
      .map(({ userSet, roleSet, ...group }) => ({ ...group, users: userSet.size, roles: [...roleSet] }))
      .sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt))
      .slice(0, opts.limit ?? DEFAULT_LIMIT);
  }
}

export const searchMissService = new SearchMissService();
