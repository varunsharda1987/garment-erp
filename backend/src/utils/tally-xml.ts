/**
 * Tally XML helpers - encoding, parsing, and common XML building blocks.
 * Ported from Kasya B2B Sales app tally.service.ts.
 */

export function xmlEscape(v: unknown): string {
  const raw = String(v ?? '');
  // Drop XML-1.0-ILLEGAL C0 control chars (keep tab/LF/CR) BEFORE entity-escaping
  let s = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if (c === 9 || c === 10 || c === 13 || c >= 32) s += raw[i];
  }
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function xmlUnescape(v: string): string {
  return v
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)));
}

export function firstTag(xml: string, tag: string): string | undefined {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(xml);
  return m ? xmlUnescape(m[1].trim()) : undefined;
}

export function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export function fyStartYyyymmdd(): string {
  const d = new Date();
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}0401`;
}

export const xe = xmlEscape;
export const amt = (n: number): string => (Object.is(n, -0) ? 0 : n).toFixed(2);
