/**
 * "Record bales & thans" — list the pieces on hand of a greige lot that has no list (2026-09-28).
 *
 * A lot received as Total Meters, typed in by hand, or split off another lot has no bales / thans / rolls,
 * so no issue screen can offer a choice. The store counts what is on the rack now; from then on every
 * issue lets those pieces be ticked. It never changes the lot's metres — the count must land within
 * ±1% of what the lot holds (the server refuses otherwise and points at Adjust Stock).
 *
 * Opened from the Greige Stock page and from the issue screens' "no list" line.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { greigeStockService } from '@/services/greigeStock.service';
import { jobWorkOrderService } from '@/services/jobWorkOrder.service';
import { foldActual, hasFold } from '@/lib/fold-length';
import { formatQuantity } from '@/lib/formatters';
import { isQtyZero, qtyExceeds } from '@/lib/quantity';
import ReceiptDetailRows, { sumDetailRows, type DetailEntryMode, type ReceiptDetailRow } from './ReceiptDetailRows';
import { THAN_PICK_TOLERANCE_PCT, pieceKindOf, pieceWord } from './lot-rows';

export interface RecordLotPiecesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The greige lot (greige_stock id) */
  stockId: string;
  /** After a successful count — the caller refreshes what it shows */
  onRecorded?: () => void;
}

const MODE_LABELS: Record<DetailEntryMode, string> = {
  THAN_WISE: 'Than-wise',
  BALE_WISE: 'Bale-wise',
  ROLL_WISE: 'Roll-wise',
};

export function RecordLotPiecesDialog({ open, onOpenChange, stockId, onRecorded }: RecordLotPiecesDialogProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<DetailEntryMode>('THAN_WISE');
  const [rows, setRows] = useState<ReceiptDetailRow[]>([]);
  const [remarks, setRemarks] = useState('');

  const { data: lot, isLoading } = useQuery({
    queryKey: ['greige-lot-thans', stockId],
    queryFn: () => jobWorkOrderService.getAvailableDetails(stockId),
    enabled: open && !!stockId,
    staleTime: 0,
  });

  // A fresh count every time the dialog opens; roll-wise when the lot came in rolls
  const rollLot = lot?.receipt?.entryMode === 'ROLL_WISE' || lot?.pieceKind === 'ROLL';
  useEffect(() => {
    if (!open) return;
    setRows([]);
    setRemarks('');
    setMode(rollLot ? 'ROLL_WISE' : 'THAN_WISE');
  }, [open, rollLot]);

  const code = lot?.greigeCode ?? 'this lot';
  const onHand = lot?.totalAvailable ?? 0;
  const fold = lot?.foldLengthCm ?? null;
  const counted = sumDetailRows(rows);
  const actual = foldActual(counted, fold);
  const diff = actual - onHand;
  const allowed = (onHand * THAN_PICK_TOLERANCE_PCT) / 100;
  const beyond = rows.length > 0 && qtyExceeds(Math.abs(diff), allowed);
  const blankRow = rows.some((r) => isQtyZero(r.meters) || r.meters < 0);
  const stillListed = (lot?.details.length ?? 0) > 0;
  const listedKind = pieceKindOf(lot);
  const pieceNoun = mode === 'ROLL_WISE' ? 'roll' : 'than';
  const piecesNoun = (n: number) => `${pieceNoun}${n === 1 ? '' : 's'}`;

  const save = useMutation({
    mutationFn: () =>
      greigeStockService.recordPieces(stockId, {
        entryMode: mode,
        pieces: rows.map((r) => ({
          baleNumber: mode === 'BALE_WISE' ? r.baleNumber : null,
          baleNo: mode === 'BALE_WISE' ? r.baleNo?.trim() || null : null,
          thanNo: r.thanNo?.trim() || null,
          meters: r.meters,
        })),
        remarks: remarks.trim() || undefined,
      }),
    onSuccess: (result) => {
      toast.success(
        `${result.recorded} ${pieceWord(result.detailType, result.recorded)} recorded on ${result.greigeCode ?? 'the lot'}`
      );
      queryClient.invalidateQueries({ queryKey: ['greige-lot-thans', stockId] });
      onRecorded?.();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || 'Could not record the pieces', { duration: 8000 });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record bales &amp; thans — {code}</DialogTitle>
          <DialogDescription>
            Count the pieces of this lot that are on hand now. They are listed for picking when the lot is issued; the
            lot&apos;s metres do not change.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !lot ? (
          <Skeleton className="h-40 w-full" />
        ) : stillListed ? (
          <p className="text-sm text-amber-700">
            {code} already lists {lot.details.length} {pieceWord(listedKind, lot.details.length)} — a lot is counted
            only when its list is empty. Name the pieces that left on their job first (Record thans sent on the
            job&apos;s page).
          </p>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Entry Mode</Label>
                <Select
                  value={mode}
                  onValueChange={(v) => {
                    setMode(v as DetailEntryMode);
                    setRows([]);
                  }}
                  disabled={save.isPending}
                >
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(MODE_LABELS) as DetailEntryMode[]).map((m) => (
                      <SelectItem key={m} value={m}>
                        {MODE_LABELS[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                On hand: <span className="font-medium text-foreground">{formatQuantity(onHand, 'METER')}</span>
                {hasFold(fold) && <> · type the tag metres, counted at fold L={fold} cm</>}
              </p>
            </div>

            <ReceiptDetailRows mode={mode} rows={rows} onChange={setRows} withTags />

            <div className="space-y-1.5">
              <Label className="text-xs">Remarks</Label>
              <Input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                maxLength={500}
                placeholder="Optional — e.g. counted on the rack by …"
                disabled={save.isPending}
              />
            </div>

            {rows.length > 0 && (
              <div className="space-y-1 text-sm">
                <p>
                  Counted {formatQuantity(counted, 'METER')}
                  {hasFold(fold) && (
                    <>
                      {' '}
                      at fold L={fold} cm = {formatQuantity(actual, 'METER')} actual
                    </>
                  )}{' '}
                  · On hand {formatQuantity(onHand, 'METER')}
                </p>
                {beyond ? (
                  <p className="text-red-600">
                    More than {THAN_PICK_TOLERANCE_PCT}% away from the {formatQuantity(onHand, 'METER')} on hand — check
                    the count, or correct the lot first with Adjust Stock on the Greige Stock page.
                  </p>
                ) : isQtyZero(diff) ? (
                  <p className="text-green-600">✓ matches the lot</p>
                ) : (
                  <p className="text-amber-700">
                    {formatQuantity(Math.abs(diff), 'METER')} {diff < 0 ? 'short of' : 'over'} the lot (within{' '}
                    {THAN_PICK_TOLERANCE_PCT}%) — allowed; the lot stays at {formatQuantity(onHand, 'METER')}.
                  </p>
                )}
                {blankRow && (
                  <p className="text-red-600">Every {pieceNoun} needs its metres — fill it in or remove it.</p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !lot || stillListed || rows.length === 0 || blankRow || beyond}
          >
            {save.isPending ? 'Saving…' : `Save ${rows.length} ${piecesNoun(rows.length)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RecordLotPiecesDialog;
