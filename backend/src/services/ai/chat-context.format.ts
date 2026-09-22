/**
 * Chat context formatters — pure functions that turn the browser's session trail into
 * system-prompt sections. Kept separate from the route so they can be unit-tested.
 */

import type { TrailError, TrailSearchMiss } from '../../schemas/ai.schema';
import { formatTime24 } from '../../utils/date';

export function formatPageContext(pageRoute?: string, pageGuide?: { slug: string; title: string }): string {
  if (!pageRoute) return '';
  const guidePart = pageGuide ? ` ("${pageGuide.title}")` : '';
  return (
    `\nCURRENT PAGE: The user is currently on page ${pageRoute}${guidePart}. ` +
    `When they say "this page", "here", or "this form", they mean that page.\n`
  );
}

/** `14:05`, or `--:--` when the trail carries an unparseable timestamp. */
function hhmm(iso: string): string {
  return formatTime24(iso, '--:--');
}

export function formatRecentSearchMisses(misses?: TrailSearchMiss[]): string {
  if (!misses || misses.length === 0) return '';
  const lines = misses.slice(0, 10).map((miss) => {
    const where = miss.pageRoute ? ` on ${miss.pageRoute}` : '';
    return `- ${hhmm(miss.at)}${where} typed "${miss.term}" into ${miss.endpoint} → 0 results`;
  });
  return (
    `\nRECENT SEARCHES THAT FOUND NOTHING (newest first):\n${lines.join('\n')}\n` +
    `If the question is about not finding something, explain what that screen's search matches ` +
    `(from the guide) and how to search for it — never claim the record exists or does not exist.\n`
  );
}

export function formatRecentErrors(errors?: TrailError[]): string {
  if (!errors || errors.length === 0) return '';
  const lines = errors.slice(0, 10).map((error) => {
    const where = error.pageRoute ? ` (on ${error.pageRoute})` : '';
    return `- ${hhmm(error.at)} ${error.method} ${error.url} → ${error.status}: "${error.message}"${where}`;
  });
  return (
    `\nRECENT ERRORS THE USER HIT (newest first):\n${lines.join('\n')}\n` +
    `If the question relates to one of these, cite the exact error and its likely fix; ignore unrelated errors.\n`
  );
}
