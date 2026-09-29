/**
 * "View rolls & thans" — a finished-fabric lot's list, read-only (2026-09-28): every roll / than it ever listed,
 * what is left of each, and where each went — the challan and the cutting batch or job — and whether it came
 * back. Metres are the COUNTED tag figures; the lot is in actual metres.
 *
 * Opened from the Fabric Stock page. "Check rolls & thans" (the store ticks what is on the rack) is one click
 * away; this dialog itself changes nothing.
 */
import { useQuery } from '@tanstack/react-query';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fabricStockService } from '@/services/fabricStockService';
import type { LotPieceMove } from '@/services/jobWorkOrder.service';
import { formatDate } from '@/lib/date';
import { hasFold } from '@/lib/fold-length';
import { formatQuantity } from '@/lib/formatters';
import { qtyExceeds } from '@/lib/quantity';
import { pieceKindOf, pieceWord, thanLabel } from '@/components/job-work/lot-rows';

export interface FabricLotPiecesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** fabric_stock id */
  stockId: string;
  /** Opens "Check rolls & thans" (omit when the viewer may not change stock) */
  onCheck?: () => void;
}

const SOURCE_LABEL: Record<string, string> = {
  RECEIPT: 'Receipt',
  COUNT: 'Counted',
  END: 'End piece',
  // Back from smocking — the smocked fabric's own lot
  PROCESS: 'Smocking',
};

/** One move in words: "CH2609-0612 → CB-WO2609-0087-002 · 100.00 m · cut" */
function moveText(m: LotPieceMove): string {
  const to = m.batchNumber ?? m.jobWorkNumber;
  const doc = m.challanNumber ?? (to ? null : 'Taken by quantity (adjustment or transfer)');
  const head = [doc, to].filter(Boolean).join(' → ');
  const back = m.returnedAt
    ? `back ${formatDate(m.returnedAt)}${m.returnChallanNumber ? ` on ${m.returnChallanNumber}` : ''}`
    : m.batchStatus === 'COMPLETED'
      ? 'cut'
      : m.batchNumber
        ? 'at cutting'
        : m.jobWorkNumber
          ? 'at the processor'
          : null;
  return [head, formatQuantity(m.metersIssued, 'METER'), back].filter(Boolean).join(' · ');
}

export function FabricLotPiecesDialog({ open, onOpenChange, stockId, onCheck }: FabricLotPiecesDialogProps) {
  const { data: lot, isLoading } = useQuery({
    queryKey: ['fabric-lot-pieces', stockId],
    queryFn: () => fabricStockService.getPieces(stockId),
    enabled: open && !!stockId,
    staleTime: 0,
  });

  const all = lot?.allPieces ?? [];
  const kind = pieceKindOf(lot);
  const left = lot?.details.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Rolls &amp; thans — {lot?.lotLabel ?? 'fabric lot'}</DialogTitle>
          <DialogDescription>
            {lot
              ? `${all.length} ${pieceWord(kind, all.length)} listed · ${left} on the rack · ${formatQuantity(lot.totalAvailable, 'METER')} on hand`
              : 'Loading…'}
            {lot && hasFold(lot.foldLengthCm) ? ` · piece metres counted at fold L=${lot.foldLengthCm} cm` : ''}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !lot ? (
          <Skeleton className="h-48 w-full" />
        ) : all.length === 0 ? (
          <p className="text-sm text-muted-foreground">This lot has no roll or than list.</p>
        ) : (
          <div className="space-y-3">
            {lot.listState === 'OUT_OF_STEP' && (
              <p className="text-sm text-warning">
                List out of step — {formatQuantity(lot.listActual ?? 0, 'METER')} listed,{' '}
                {formatQuantity(lot.totalAvailable, 'METER')} on hand. Check rolls &amp; thans to put it right.
              </p>
            )}
            {lot.listState === 'LIST_EMPTY' && (
              <p className="text-sm text-warning">
                Every piece on the list has gone, but {formatQuantity(lot.totalAvailable, 'METER')} is on hand — record
                the rolls &amp; thans on the rack.
              </p>
            )}
            <div className="max-h-[55vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Piece</TableHead>
                    <TableHead className="text-right">Metres left</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Where it went</TableHead>
                    <TableHead>From</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {all.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap font-medium">{thanLabel(p)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {formatQuantity(p.metersRemaining, 'METER')}
                        {qtyExceeds(p.meters, p.metersRemaining) && (
                          <span className="text-muted-foreground"> of {formatQuantity(p.meters, 'METER')}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'CONSUMED' ? 'secondary' : 'outline'} className="text-xs">
                          {p.status === 'AVAILABLE' ? 'On the rack' : p.status === 'PARTIAL' ? 'Part left' : 'Gone'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {p.moves.length === 0 ? (
                          <span className="text-muted-foreground">
                            {p.status === 'CONSUMED' ? (p.remarks ?? '—') : '—'}
                          </span>
                        ) : (
                          p.moves.map((m, i) => <div key={i}>{moveText(m)}</div>)
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {SOURCE_LABEL[p.source ?? 'RECEIPT'] ?? p.source}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          {onCheck && lot && qtyExceeds(lot.totalAvailable, 0) && (
            <Button variant="outline" onClick={onCheck}>
              {left > 0 ? 'Check rolls & thans' : 'Record rolls & thans'}
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FabricLotPiecesDialog;
