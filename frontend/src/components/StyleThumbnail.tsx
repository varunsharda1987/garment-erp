/**
 * StyleThumbnail — the garment's photo (`styles.imageUrl`) beside a style wherever the team handles
 * it: cutting, stitching, finishing, orders, dispatch. One component so every screen shows the same
 * picture the same way.
 *
 *   xs 32px / sm 40px — a table cell (hover shows a larger preview)
 *   md 64px           — a card or Kanban tile
 *   lg 160px          — a detail page header
 *
 * Click opens the full image. A style with no photo shows a muted shirt icon (or nothing, with
 * `hideWhenEmpty`), so rows keep their alignment.
 */

import { useState } from 'react';
import { Shirt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUploadUrl } from '@/config/api.config';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const SIZES = {
  xs: 'h-8 w-8',
  sm: 'h-10 w-10',
  md: 'h-16 w-16',
  lg: 'h-40 w-40',
} as const;

const ICON_SIZES = {
  xs: 'h-4 w-4',
  sm: 'h-5 w-5',
  md: 'h-7 w-7',
  lg: 'h-14 w-14',
} as const;

export type StyleThumbnailSize = keyof typeof SIZES;

interface StyleThumbnailProps {
  /** `styles.imageUrl` — a stored `/uploads/...` path or a full URL. */
  imageUrl?: string | null;
  /** Alt text and the preview dialog's title — usually the style label. */
  alt?: string;
  size?: StyleThumbnailSize;
  /** Render nothing (instead of the placeholder) when there is no photo. */
  hideWhenEmpty?: boolean;
  /** Hover preview for the small sizes (default true). */
  hoverPreview?: boolean;
  className?: string;
}

export function StyleThumbnail({
  imageUrl,
  alt = 'Garment',
  size = 'sm',
  hideWhenEmpty = false,
  hoverPreview = true,
  className,
}: StyleThumbnailProps) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  const src = imageUrl && !broken ? getUploadUrl(imageUrl) : '';

  if (!src) {
    if (hideWhenEmpty) return null;
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground',
          SIZES[size],
          className,
        )}
        title="No garment photo"
        aria-label="No garment photo"
      >
        <Shirt className={ICON_SIZES[size]} />
      </span>
    );
  }

  const small = size === 'xs' || size === 'sm';

  return (
    // Thumbnails sit inside clickable rows and cards; the dialog is portalled but its React events
    // still bubble here — stop them so opening or closing the photo never opens the row.
    <span className="contents" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={cn('group relative shrink-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
        onClick={() => setOpen(true)}
        title="View garment photo"
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setBroken(true)}
          className={cn('rounded-md border bg-muted object-cover', SIZES[size])}
        />
        {small && hoverPreview && (
          <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 group-hover:block">
            <img src={src} alt="" className="h-48 w-48 max-w-none rounded-md border bg-background object-contain shadow-lg" />
          </span>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{alt}</DialogTitle>
          </DialogHeader>
          <img src={src} alt={alt} className="max-h-[75vh] w-full rounded-md object-contain" />
        </DialogContent>
      </Dialog>
    </span>
  );
}

export default StyleThumbnail;
