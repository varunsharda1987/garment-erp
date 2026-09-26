import { useQuery } from '@tanstack/react-query';
import { History, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/lib/date';
import { cadPlanningService, type CadHistoryEntry } from '@/services/cad-planning.service';

const ACTION_LABEL: Record<string, { label: string; className: string }> = {
  CREATE: { label: 'Created', className: 'bg-muted text-foreground' },
  UPDATE: { label: 'Edited', className: 'bg-info/10 text-info border-info/30' },
  APPROVE: { label: 'Approved', className: 'bg-success/10 text-success border-success/30' },
  REJECT: { label: 'Rejected', className: 'bg-destructive/10 text-destructive border-destructive/30' },
  CORRECT: { label: 'Corrected', className: 'bg-warning/10 text-warning border-warning/30' },
  RELINK_GREIGE: { label: 'Greige relinked', className: 'bg-warning/10 text-warning border-warning/30' },
};

const FIELD_LABEL: Record<string, string> = {
  cadAverage: 'CAD average (m/pc)',
  cadMeters: 'Layer length (m)',
  layerMarginMeters: 'Layer margin (m)',
  piecesPerMarker: 'Pieces per marker',
  cutableWidth: 'Width (in)',
  greigeId: 'Greige',
  fabricId: 'Fabric',
  purpose: 'Purpose',
  sizes: 'Sizes',
  approvalNotes: 'Notes',
};

function personLabel(by: CadHistoryEntry['by']): string {
  if (!by) return 'System';
  return by.name && by.email ? `${by.name} (${by.email})` : by.name || by.email || 'Unknown user';
}

function HistoryEntry({ entry }: { entry: CadHistoryEntry }) {
  const action = ACTION_LABEL[entry.action] ?? { label: entry.action, className: 'bg-muted text-foreground' };
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline" className={action.className}>
          {action.label}
        </Badge>
        <span className="font-medium">{personLabel(entry.by)}</span>
        <span className="text-muted-foreground">{formatDateTime(entry.at)}</span>
      </div>
      {entry.reason && <p className="text-sm text-muted-foreground">Reason: {entry.reason}</p>}
      {entry.outcome && <p className="text-sm">{entry.outcome}</p>}
      {entry.inUse && (
        <p className="text-sm text-warning">Rejected while in use by {entry.inUse} (confirmed by the user).</p>
      )}
      {entry.changes.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-8">Field</TableHead>
              <TableHead className="h-8">From</TableHead>
              <TableHead className="h-8">To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entry.changes.map((change) => (
              <TableRow key={change.field}>
                <TableCell className="py-1.5">{FIELD_LABEL[change.field] ?? change.field}</TableCell>
                <TableCell className="py-1.5 text-muted-foreground">{change.from ?? '—'}</TableCell>
                <TableCell className="py-1.5 font-medium">{change.to ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

interface CadHistoryDialogProps {
  styleId: string;
  /** The CAD row whose history to show; null closes the dialog */
  rowId: string | null;
  onClose: () => void;
}

/** Who created / edited / approved / rejected a CAD row, what changed and why (row menu → History). */
export function CadHistoryDialog({ styleId, rowId, onClose }: CadHistoryDialogProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['cad-row-history', styleId, rowId],
    queryFn: () => cadPlanningService.getCADRowHistory(styleId, rowId!),
    enabled: !!rowId,
  });

  return (
    <Dialog open={!!rowId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            CAD history
          </DialogTitle>
          <DialogDescription>
            {data?.createdAt
              ? `Created ${formatDateTime(data.createdAt)}${data.createdBy ? ` by ${personLabel(data.createdBy)}` : ''}. `
              : ''}
            Changes are recorded from 26-Sep-2026.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading history…
          </div>
        ) : error ? (
          <p className="py-4 text-sm text-destructive">Could not load the history.</p>
        ) : !data || data.entries.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No changes recorded for this CAD yet.</p>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-3">
            <div className="space-y-3">
              {data.entries.map((entry) => (
                <HistoryEntry key={entry.id} entry={entry} />
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
