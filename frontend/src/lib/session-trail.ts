/**
 * Session trail
 *
 * A small in-memory record of what the user just did: the last few API failures and the
 * last few pages visited. Attached to AI assistant messages (so it can cite the exact
 * error the user hit) and to issue reports. Paths and server messages only — never
 * request bodies, headers, or query strings. Nothing is persisted; a reload starts fresh.
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

export interface SessionTrail {
  pageRoute?: string;
  recentErrors?: TrailError[];
  recentPages?: TrailPage[];
}

const MAX_ENTRIES = 10;

const errors: TrailError[] = [];
const pages: TrailPage[] = [];

/** Drop the query string and hash — `/styles?tab=2#x` → `/styles`. */
export function stripUrl(url: string): string {
  return url.split(/[?#]/)[0];
}

export function recordError(error: TrailError): void {
  errors.unshift({ ...error, message: error.message.slice(0, 200) });
  if (errors.length > MAX_ENTRIES) errors.length = MAX_ENTRIES;
}

export function recordPage(path: string): void {
  if (pages[0]?.path === path) return;
  pages.unshift({ at: new Date().toISOString(), path });
  if (pages.length > MAX_ENTRIES) pages.length = MAX_ENTRIES;
}

/** Copies, newest first. */
export function getTrail(): Required<Pick<SessionTrail, 'recentErrors' | 'recentPages'>> {
  return { recentErrors: [...errors], recentPages: [...pages] };
}

/** The most recent page that is NOT under `prefix` — e.g. where the user was before opening the assistant. */
export function lastPageBefore(prefix: string): string | undefined {
  return pages.find((page) => !page.path.startsWith(prefix))?.path;
}

/** Test helper. */
export function resetTrail(): void {
  errors.length = 0;
  pages.length = 0;
}
