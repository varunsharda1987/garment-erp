/**
 * StyleIdentity — a style named the ONE way (see `@/lib/style-code`): the Buyer Style Code first
 * and bold, our Style Code muted beside it only when it differs, the style name muted.
 *
 *   inline  — headers, dialogs, cards:   SP27DR27 (EBWW-021) — GEMINI
 *   stacked — the first cell of a table:  SP27DR27
 *                                         GEMINI
 *
 * In a table that already has a "Style Code" column, pass `showStyleCode={false}` so our code is
 * not printed twice.
 */

import { cn } from '@/lib/utils';
import { buyerStyleCode, styleCodeIfDifferent, type StyleCodes } from '@/lib/style-code';

interface StyleIdentityProps {
  style: StyleCodes | null | undefined;
  /** The sale-order line's own buyer style code (its snapshot) — wins over the style's. */
  lineRef?: string | null;
  /** The style name, shown muted. */
  name?: string | null;
  layout?: 'inline' | 'stacked';
  /** Show our Style Code when it differs (default true). Off where a Style Code column sits beside it. */
  showStyleCode?: boolean;
  /** Shown when the style carries neither code. */
  fallback?: string;
  className?: string;
  /** Classes for the Buyer Style Code itself (default: font-medium). */
  codeClassName?: string;
}

export function StyleIdentity({
  style,
  lineRef,
  name,
  layout = 'inline',
  showStyleCode = true,
  fallback = '—',
  className,
  codeClassName,
}: StyleIdentityProps) {
  const main = buyerStyleCode(style, lineRef, fallback);
  const ours = showStyleCode ? styleCodeIfDifferent(style, lineRef) : null;
  const styleName = name?.trim() || null;

  if (layout === 'stacked') {
    const sub = [styleName, ours].filter(Boolean).join(' · ');
    return (
      <div className={cn('min-w-0', className)}>
        <div className={cn('font-medium', codeClassName)}>{main}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
    );
  }

  return (
    <span className={className}>
      <span className={cn('font-medium', codeClassName)}>{main}</span>
      {ours && <span className="font-normal text-muted-foreground"> ({ours})</span>}
      {styleName && <span className="font-normal text-muted-foreground"> — {styleName}</span>}
    </span>
  );
}

export default StyleIdentity;
