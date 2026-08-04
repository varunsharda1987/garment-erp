/**
 * Style code + buyer style ref display formatting.
 *
 * Appends the buyer's style reference to a style code for display:
 *   formatStyleCodeWithRef('ST-001', 'ZR 4087 - 042') → 'ST-001 (ZR 4087-042)'
 *
 * The sanitizer collapses " - " (space-hyphen-space) inside the ref to "-"
 * so generated names that are later split on ' - ' by positional parsers
 * are not corrupted by hyphens inside the ref itself.
 */
export function formatStyleCodeWithRef(styleCode: string, buyerStyleRef?: string | null): string {
  const trimmed = buyerStyleRef?.trim();
  if (!trimmed) return styleCode;
  const sanitized = trimmed.replace(/\s+-\s+/g, '-');
  return `${styleCode} (${sanitized})`;
}
