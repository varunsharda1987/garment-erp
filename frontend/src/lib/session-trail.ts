/**
 * Session trail
 *
 * A small in-memory record of what the user just did: the last few API failures, the last few
 * searches that returned nothing, and the last few pages visited. Attached to AI assistant
 * messages (so it can cite the exact error or empty search) and to issue reports, and watched
 * by the "Stuck? Ask the assistant" nudge. Paths, terms and server messages only — never request
 * bodies, headers, or query strings. Nothing is persisted; a reload starts fresh.
 */

export interface TrailError {
  at: string;
  method: string;
  url: string;
  status: number;
  message: string;
  pageRoute?: string;
}

export interface TrailPage {
  at: string;
  path: string;
}

/** A search that returned nothing — a 200 the error trail never sees */
export interface TrailSearchMiss {
  at: string;
  endpoint: string;
  term: string;
  pageRoute?: string;
}

export interface SessionTrail {
  pageRoute?: string;
  recentErrors?: TrailError[];
  recentPages?: TrailPage[];
  recentSearchMisses?: TrailSearchMiss[];
}

export type NudgeReason = { kind: 'search'; term: string } | { kind: 'error'; message: string };

const MAX_ENTRIES = 10;
const MIN_TERM_LENGTH = 3;
const NUDGE_WINDOW_MS = 2 * 60 * 1000;

const errors: TrailError[] = [];
const pages: TrailPage[] = [];
const misses: TrailSearchMiss[] = [];
const listeners = new Set<() => void>();

/** Called after every recorded error or empty search (not page changes). */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // allow-silent-catch — a UI listener failing must never break the API interceptor that called it
    }
  }
}

/** Drop the query string and hash — `/styles?tab=2#x` → `/styles`. */
export function stripUrl(url: string): string {
  return url.split(/[?#]/)[0];
}

export function normalizeSearchTerm(raw: unknown): string {
  return typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
}

/** The `search` param of a request, whether axios `params` or the URL carried it. */
export function searchTermOf(config: { url?: string; params?: unknown }): string {
  const params = config.params as Record<string, unknown> | undefined;
  const fromParams = normalizeSearchTerm(params?.search);
  if (fromParams) return fromParams;
  const query = (config.url ?? '').split('?')[1];
  if (!query) return '';
  return normalizeSearchTerm(new URLSearchParams(query).get('search') ?? '');
}

/** `[]`, `{ data: [] }` and `{ data: [], pagination: { total: 0 } }` all mean "found nothing". */
export function isEmptyResult(body: unknown): boolean {
  if (Array.isArray(body)) return body.length === 0;
  if (!body || typeof body !== 'object') return false;
  const data = (body as { data?: unknown }).data;
  return Array.isArray(data) && data.length === 0;
}

export function recordError(error: TrailError): void {
  errors.unshift({ ...error, message: error.message.slice(0, 200) });
  if (errors.length > MAX_ENTRIES) errors.length = MAX_ENTRIES;
  emit();
}

export function recordPage(path: string): void {
  if (pages[0]?.path === path) return;
  pages.unshift({ at: new Date().toISOString(), path });
  if (pages.length > MAX_ENTRIES) pages.length = MAX_ENTRIES;
}

export function recordSearchMiss(miss: TrailSearchMiss): void {
  const term = normalizeSearchTerm(miss.term);
  if (term.length < MIN_TERM_LENGTH) return;
  const latest = misses[0];
  if (latest && latest.endpoint === miss.endpoint && latest.term === term) {
    misses[0] = { ...latest, at: miss.at };
  } else {
    misses.unshift({ ...miss, term });
    if (misses.length > MAX_ENTRIES) misses.length = MAX_ENTRIES;
  }
  emit();
}

/** Copies, newest first. */
export function getTrail(): Required<Pick<SessionTrail, 'recentErrors' | 'recentPages' | 'recentSearchMisses'>> {
  return { recentErrors: [...errors], recentPages: [...pages], recentSearchMisses: [...misses] };
}

/** The most recent page that is NOT under `prefix` — e.g. where the user was before opening the assistant. */
export function lastPageBefore(prefix: string): string | undefined {
  return pages.find((page) => !page.path.startsWith(prefix))?.path;
}

/**
 * Two distinct empty searches, or two API errors, on the same page within two minutes.
 * "Distinct" ignores prefixes: "kas" then "kasya" is one search still being typed.
 */
export function shouldNudge(
  trail: Pick<SessionTrail, 'recentErrors' | 'recentSearchMisses'>,
  pageRoute: string,
  now: number
): NudgeReason | null {
  const fresh = (at: string) => now - Date.parse(at) <= NUDGE_WINDOW_MS;

  const recentMisses = (trail.recentSearchMisses ?? []).filter(
    (miss) => miss.pageRoute === pageRoute && fresh(miss.at)
  );
  const distinct: TrailSearchMiss[] = [];
  for (const miss of recentMisses) {
    const related = distinct.some((seen) => seen.term.startsWith(miss.term) || miss.term.startsWith(seen.term));
    if (!related) distinct.push(miss);
  }
  if (distinct.length >= 2) return { kind: 'search', term: distinct[0].term };

  const recentErrors = (trail.recentErrors ?? []).filter((error) => error.pageRoute === pageRoute && fresh(error.at));
  if (recentErrors.length >= 2) return { kind: 'error', message: recentErrors[0].message };

  return null;
}

/** The question the nudge hands to the assistant. */
export function nudgeQuestion(reason: NudgeReason, pageRoute: string): string {
  return reason.kind === 'search'
    ? `I searched "${reason.term}" on ${pageRoute} and found nothing — how do I find it?`
    : `I got "${reason.message}" on ${pageRoute} — what does it mean and what should I fix?`;
}

/** Test helper. */
export function resetTrail(): void {
  errors.length = 0;
  pages.length = 0;
  misses.length = 0;
}
