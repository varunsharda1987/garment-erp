/**
 * Chat context formatters — pure functions that turn the browser's session trail into
 * system-prompt sections. Kept separate from the route so they can be unit-tested.
 */

import type { TrailError } from '../../schemas/ai.schema';

export function formatPageContext(pageRoute?: string, pageGuide?: { slug: string; title: string }): string {
  if (!pageRoute) return '';
  const guidePart = pageGuide ? ` ("${pageGuide.title}")` : '';
  return (
    `\nCURRENT PAGE: The user is currently on page ${pageRoute}${guidePart}. ` +
    `When they say "this page", "here", or "this form", they mean that page.\n`
  );
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatRecentErrors(errors?: TrailError[]): string {
  if (!errors || errors.length === 0) return '';
  const lines = errors.slice(0, 10).map((error) => {
    const where = error.pageRoute ? ` (on ${error.pageRoute})` : '';
    return `- ${formatTime(error.at)} ${error.method} ${error.url} → ${error.status}: "${error.message}"${where}`;
  });
  return (
    `\nRECENT ERRORS THE USER HIT (newest first):\n${lines.join('\n')}\n` +
    `If the question relates to one of these, cite the exact error and its likely fix; ignore unrelated errors.\n`
  );
}
