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
 *
 * Pass `imageUrl` (`styles.imageUrl`) with `showImage` to put the garment's photo in front of it
 * (see `StyleThumbnail`) — on the screens where the team handles the garment itself.
 */

import { cn } from '@/lib/utils';
import { buyerStyleCode, styleCodeIfDifferent, type StyleCodes } from '@/lib/style-code';
import { StyleThumbnail, type StyleThumbnailSize } from '@/components/StyleThumbnail';

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
  /** The garment's photo (`styles.imageUrl`), shown only with `showImage`. */
  imageUrl?: string | null;
  /** Put the garment's photo in front of the codes (a placeholder when the style has none). */
  showImage?: boolean;
  /** Photo size (default: sm when stacked, xs inline). */
  imageSize?: StyleThumbnailSize;
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
  imageUrl,
  showImage = false,
  imageSize,
}: StyleIdentityProps) {
  const main = buyerStyleCode(style, lineRef, fallback);
  const ours = showStyleCode ? styleCodeIfDifferent(style, lineRef) : null;
  const styleName = name?.trim() || null;
  const photo = showImage ? (
    <StyleThumbnail
      imageUrl={imageUrl}
      alt={[main, styleName].filter(Boolean).join(' — ')}
      size={imageSize ?? (layout === 'stacked' ? 'sm' : 'xs')}
    />
  ) : null;

  if (layout === 'stacked') {
    const sub = [styleName, ours].filter(Boolean).join(' · ');
    const text = (
      <div className={cn(photo ? 'shrink-0' : 'min-w-0', !photo && className)}>
        <div className={cn('font-medium', codeClassName)}>{main}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
    );
    if (!photo) return text;
    return (
      // min-w-max: a table sizes the column to photo + code (without it Chrome squeezed the cell and
      // the code ran into the next column — Cutting list, 2026-10-01).
      <div className={cn('flex min-w-max items-center gap-2', className)}>
        {photo}
        {text}
      </div>
    );
  }

  const text = (
    <>
      <span className={cn('font-medium', codeClassName)}>{main}</span>
      {ours && <span className="font-normal text-muted-foreground"> ({ours})</span>}
      {styleName && <span className="font-normal text-muted-foreground"> — {styleName}</span>}
    </>
  );
  if (!photo) return <span className={className}>{text}</span>;
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {photo}
      <span>{text}</span>
    </span>
  );
}

export default StyleIdentity;
