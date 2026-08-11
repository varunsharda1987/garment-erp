/**
 * Mini Marker Badge
 * A small clickable badge showing file count, opens dialog on click
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Paperclip } from 'lucide-react';
import { MiniMarkerDialog } from './MiniMarkerDialog';
import { miniMarkerService } from '@/services/miniMarker.service';
import { cn } from '@/lib/utils';

interface MiniMarkerBadgeProps {
  styleId: string;
  /** Optional pre-fetched count. When omitted the badge fetches its own. */
  count?: number;
  /** When false, the dialog opens view-only (no upload/delete) */
  editable?: boolean;
  className?: string;
}

export function MiniMarkerBadge({ styleId, count, editable = true, className }: MiniMarkerBadgeProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  // Self-fetch when the caller didn't supply a count, so every call site shows a real number.
  // Shares its key with callers that do fetch it, so mutations invalidate both.
  const { data: fetchedCount } = useQuery({
    queryKey: ['miniMarkerCount', styleId],
    queryFn: () => miniMarkerService.getCount(styleId),
    enabled: count === undefined && !!styleId,
    staleTime: 60 * 1000,
  });

  const displayCount = count ?? fetchedCount;

  return (
    <>
      <Badge
        variant="outline"
        className={cn(
          'cursor-pointer hover:bg-accent transition-colors',
          displayCount ? 'border-primary/50' : '',
          className
        )}
        onClick={() => setDialogOpen(true)}
        title="Mini markers"
      >
        <Paperclip className="h-3 w-3 mr-1" />
        {displayCount ?? '-'}
      </Badge>

      {/* Mounted only while open — the list page renders one badge per row */}
      {dialogOpen && <MiniMarkerDialog styleId={styleId} open onOpenChange={setDialogOpen} editable={editable} />}
    </>
  );
}
