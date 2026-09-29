/**
 * Allocate a sent PO to the running orders that need it (docs/plans/po-allocation-design.md §7).
 *
 * Every order that needs a line's material and is not linked yet is listed, earliest delivery first. It opens on
 * the default split — each order its full need, in that order, until the line runs out — and the user can tick,
 * untick or type a quantity; the untyped rows then share what is left the same way (lib/po-allocation-split).
 * A requirement goes on one line only. What arrived and is free goes to the first orders linked and is held for
 * them at once — those links can't be undone, and the row says so before saving.
 *
 * Opened from the PO page (every line) and from the Requirements page's Link (`itemIds` + `focusRequirementIds`:
 * only those requirements start ticked).
 */
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { queryKeys } from '@/lib/query-client';
import { formatDate } from '@/lib/date';
import { styleCodeLabel } from '@/lib/style-code';
import { isQtyZero, minQty, qtyExceeds } from '@/lib/quantity';
import { handleApiError } from '@/lib/api-error-handler';
import { notify } from '@/lib/notify';
import {
  editSplitRow,
  initialSplit,
  parseSplitQty,
  splitAllocations,
  splitIsSavable,
  splitKey,
  splitLineOf,
  splitLineSummary,
  splitRowProblem,
  tickedOn,
  toggleSplitRow,
  type SplitState,
} from '@/lib/po-allocation-split';
import { allocationLineName, allocationQty, allocationUnit } from '@/lib/po-allocation-view';
import { allocatePoToOrders, getPoAllocation, poAllocationErrorOf } from '@/services/poAllocation.service';
import type {
  AllocatePoResponse,
  PoAllocationLine,
  PoAllocationRefusalRow,
  PoAllocationView,
} from '@/types/po-allocation.types';

export interface AllocateToOrdersDialogProps {
  poId: string;
  /** Only these PO lines (the Requirements page's Link); none = every line */
  itemIds?: string[];
  /** Only these requirements start ticked */
  focusRequirementIds?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: (result: AllocatePoResponse) => void;
}

/** Codes whose refusal means the PO moved on under us: say so, and load it again */
const RELOAD_CODES = new Set(['PO_LINE_OVER_ALLOCATED', 'PO_ALLOCATION_CHANGED', 'PO_ARRIVED_NOT_FREE']);

export function AllocateToOrdersDialog({
  poId,
  itemIds,
  focusRequirementIds,
  open,
  onOpenChange,
  onDone,
}: AllocateToOrdersDialogProps) {
  const [saving, setSaving] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Not mid-save: the outcome must be seen
        if (!saving) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col">
        {/* Mounted only while open, so every opening starts from fresh figures */}
        <AllocateLoader
          poId={poId}
          itemIds={itemIds}
          focusRequirementIds={focusRequirementIds}
          saving={saving}
          setSaving={setSaving}
          onCancel={() => onOpenChange(false)}
          onSaved={(result) => {
            onOpenChange(false);
            onDone?.(result);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

interface AllocateLoaderProps {
  poId: string;
  itemIds?: string[];
  focusRequirementIds?: string[];
  saving: boolean;
  setSaving: (saving: boolean) => void;
  onCancel: () => void;
  onSaved: (result: AllocatePoResponse) => void;
}

function AllocateLoader({
  poId,
  itemIds,
  focusRequirementIds,
  saving,
  setSaving,
  onCancel,
  onSaved,
}: AllocateLoaderProps) {
  // The split starts from the default the server works out now — never from a copy cached before this opening
  const query = useQuery({
    queryKey: queryKeys.poAllocation.detail(poId, itemIds),
    queryFn: () => getPoAllocation(poId, itemIds),
    refetchOnMount: 'always',
  });
  // Bumped after the PO moved on under us: the rows start again from the fresh figures
  const [seed, setSeed] = useState(0);

  const reload = async () => {
    await query.refetch();
    setSeed((s) => s + 1);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Allocate {query.data?.po.poNumber ?? 'this PO'} to orders</DialogTitle>
        <DialogDescription>
          Running orders that need these and are not linked yet, earliest delivery first. Tick who gets what — the rows
          you don&apos;t type in share what is free in that order.
        </DialogDescription>
      </DialogHeader>
      {!query.isFetchedAfterMount ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading the orders that need this PO…</div>
      ) : query.isError || !query.data ? (
        <div className="py-10 text-center text-sm text-destructive">
          {poAllocationErrorOf(query.error)?.message ?? 'Could not load this PO’s allocation.'}
        </div>
      ) : (
        <AllocateBody
          key={seed}
          view={query.data}
          poId={poId}
          focusRequirementIds={focusRequirementIds}
          saving={saving}
          setSaving={setSaving}
          onReload={reload}
          onCancel={onCancel}
          onSaved={onSaved}
        />
      )}
    </>
  );
}

interface AllocateBodyProps {
  view: PoAllocationView;
  poId: string;
  focusRequirementIds?: string[];
  saving: boolean;
  setSaving: (saving: boolean) => void;
  onReload: () => Promise<void>;
  onCancel: () => void;
  onSaved: (result: AllocatePoResponse) => void;
}

function AllocateBody({
  view,
  poId,
  focusRequirementIds,
  saving,
  setSaving,
  onReload,
  onCancel,
  onSaved,
}: AllocateBodyProps) {
  const queryClient = useQueryClient();
  const lines = useMemo(() => view.lines.filter((l) => l.linkable && l.candidates.length > 0), [view]);
  const blockedLines = useMemo(() => view.lines.filter((l) => !l.linkable && l.candidates.length > 0), [view]);
  const splitLines = useMemo(() => lines.map(splitLineOf), [lines]);
  const [split, setSplit] = useState<SplitState>(() => initialSplit(splitLines, focusRequirementIds));
  const [refusals, setRefusals] = useState<PoAllocationRefusalRow[]>([]);

  const allocations = splitAllocations(splitLines, split);
  const savable = splitIsSavable(splitLines, split) && !saving;
  const orderCount = new Set(allocations.map((a) => a.requirementId)).size;
  const nameOf = new Map(lines.map((l) => [l.itemId, allocationLineName(l)]));

  // Left free after this, per unit — a PO can mix metres and pieces
  const leftByUnit = new Map<string, number>();
  lines.forEach((line, i) => {
    const unit = allocationUnit(line) ?? '';
    leftByUnit.set(unit, (leftByUnit.get(unit) ?? 0) + splitLineSummary(splitLines[i], split).leftFree);
  });
  const leftText = [...leftByUnit].map(([unit, qty]) => allocationQty(qty, unit)).join(' · ');

  const refusalFor = (itemId: string, requirementId: string) =>
    refusals.find(
      (r) => r.requirementId === requirementId && (r.purchaseOrderItemId == null || r.purchaseOrderItemId === itemId)
    );
  const lineRefusals = refusals.filter((r) => r.requirementId == null);

  const save = async () => {
    if (!savable) return;
    setSaving(true);
    setRefusals([]);
    try {
      const result = await allocatePoToOrders(poId, { allocations });
      queryClient.setQueryData(queryKeys.poAllocation.detail(poId), result.allocation);
      void queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.mrp.all });

      const heldNow = result.linked.filter((l) => qtyExceeds(l.heldAtOnce, 0)).length;
      const notes = [
        heldNow > 0 ? `${heldNow} got goods already here, held for them at once` : null,
        result.splits.length > 0
          ? `${result.splits.length} only part-covered — the rest stays to be bought (${result.splits.map((s) => s.childNumber).join(', ')})`
          : null,
      ].filter(Boolean);
      notify.success(
        `${result.poNumber} linked to ${result.linked.length} ${result.linked.length === 1 ? 'order' : 'orders'}`,
        notes.length > 0 ? { description: notes.join('. ') + '.' } : undefined
      );
      onSaved(result);
    } catch (err) {
      const refusal = poAllocationErrorOf(err);
      if (refusal?.code === 'PO_ALLOCATION_REFUSED') {
        setRefusals(refusal.rows);
        notify.error(refusal.message);
      } else if (refusal?.code && RELOAD_CODES.has(refusal.code)) {
        notify.error(refusal.message, { description: 'The figures were loaded again — check the split and save.' });
        await onReload();
      } else {
        handleApiError(err, 'Could not allocate the PO');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!view.po.linkable) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        {view.po.blockedReason ?? `${view.po.poNumber} can't take orders now.`}
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto space-y-5 pr-1">
        {lines.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No running order needs what this PO brings, or every one is already linked.
          </div>
        )}

        {blockedLines.length > 0 && (
          <div className="rounded-md border border-warning bg-warning/10 p-3 text-sm space-y-1">
            {blockedLines.map((l) => (
              <div key={l.itemId} className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <span>
                  <span className="font-medium">{allocationLineName(l)}</span>: {l.blockedReason}
                </span>
              </div>
            ))}
          </div>
        )}

        {lineRefusals.length > 0 && (
          <div className="rounded-md border border-destructive/50 p-3 text-sm text-destructive space-y-1">
            {lineRefusals.map((r, i) => (
              <div key={i}>{r.reason}</div>
            ))}
          </div>
        )}

        {lines.map((line, i) => (
          <LineSection
            key={line.itemId}
            line={line}
            summary={splitLineSummary(splitLines[i], split)}
            split={split}
            ticked={(requirementId) => tickedOn(splitLines, split, requirementId)}
            nameOf={nameOf}
            refusalFor={refusalFor}
            disabled={saving}
            onToggle={(requirementId, on) =>
              setSplit((s) => toggleSplitRow(splitLines, s, line.itemId, requirementId, on))
            }
            onEdit={(requirementId, text) =>
              setSplit((s) => editSplitRow(splitLines, s, line.itemId, requirementId, text))
            }
          />
        ))}
      </div>

      <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t pt-3">
        <div className="text-sm text-muted-foreground">
          {lines.length > 0 && (
            <>
              Left free after this: <span className="font-medium text-foreground tabular-nums">{leftText}</span>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button
            variant="ghost"
            disabled={saving || lines.length === 0}
            onClick={() => {
              setRefusals([]);
              setSplit(initialSplit(splitLines, focusRequirementIds));
            }}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to suggested
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!savable}>
            {saving
              ? 'Allocating…'
              : orderCount > 0
                ? `Allocate to ${orderCount} ${orderCount === 1 ? 'order' : 'orders'}`
                : 'Allocate'}
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}

interface LineSectionProps {
  line: PoAllocationLine;
  summary: ReturnType<typeof splitLineSummary>;
  split: SplitState;
  ticked: (requirementId: string) => string | null;
  nameOf: Map<string, string>;
  refusalFor: (itemId: string, requirementId: string) => PoAllocationRefusalRow | undefined;
  disabled: boolean;
  onToggle: (requirementId: string, ticked: boolean) => void;
  onEdit: (requirementId: string, text: string) => void;
}

function LineSection({
  line,
  summary,
  split,
  ticked,
  nameOf,
  refusalFor,
  disabled,
  onToggle,
  onEdit,
}: LineSectionProps) {
  const unit = allocationUnit(line);
  const dyerName = (id: string) =>
    line.candidates.find((c) => c.dyer?.id === id)?.dyer?.name ??
    line.plainByPlace.find((p) => p.pool === id)?.name ??
    id;

  return (
    <section className="space-y-2" aria-label={allocationLineName(line)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <div className="font-medium">{allocationLineName(line)}</div>
          {line.located && (
            <div className="text-xs text-muted-foreground">
              {line.deliversTo && line.deliversTo.length > 0
                ? `Delivers to ${line.deliversTo.map((p) => p.name).join(', ')}`
                : 'Delivery place to be advised'}
            </div>
          )}
        </div>
        <div className="text-sm tabular-nums">
          <span className="text-muted-foreground">Free to link </span>
          {allocationQty(line.freeToLink, unit)}
          <span className="mx-2 text-muted-foreground">·</span>
          {summary.over ? (
            <span className="font-medium text-destructive">Over by {allocationQty(-summary.leftFree, unit)}</span>
          ) : (
            <>
              <span className="text-muted-foreground">Left free </span>
              <span className="font-medium">{allocationQty(summary.leftFree, unit)}</span>
            </>
          )}
        </div>
      </div>

      {qtyExceeds(line.arrivedFree, 0) && (
        <div className="flex items-start gap-2 rounded-md border border-warning bg-warning/10 p-2 text-xs">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <span>
            {allocationQty(line.arrivedFree, unit)} of this line already arrived and is free. The first orders linked
            take it and it is held for them at once — those links can&apos;t be undone.
          </span>
        </div>
      )}
      {summary.overForDyer.map((d) => (
        <div key={d.dyerId} className="text-xs text-destructive">
          Orders dyed at {dyerName(d.dyerId)} ask for {allocationQty(d.requested, unit)}; only{' '}
          {allocationQty(d.free, unit)} can reach them.
        </div>
      ))}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Order</TableHead>
              <TableHead>Style</TableHead>
              <TableHead>Delivery</TableHead>
              {line.located && <TableHead>Dyed at</TableHead>}
              <TableHead className="text-right">Needs</TableHead>
              <TableHead className="w-36 text-right">Allocate</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {line.candidates.map((c) => {
              const key = splitKey(line.itemId, c.requirementId);
              const row = split[key];
              const isTicked = !!row?.ticked;
              const elsewhere = ticked(c.requirementId);
              const onOtherLine = !!elsewhere && elsewhere !== line.itemId;
              const problem = splitRowProblem(c, row);
              const refusal = refusalFor(line.itemId, c.requirementId);
              const typed = parseSplitQty(row?.qty ?? '');
              const here =
                isTicked && qtyExceeds(c.alreadyHereQty, 0) && Number.isFinite(typed)
                  ? minQty(c.alreadyHereQty, typed)
                  : 0;
              const checkboxId = `alloc-${key}`;
              return (
                <TableRow key={key} className={!c.linkable || onOtherLine ? 'opacity-60' : undefined}>
                  <TableCell>
                    <Checkbox
                      id={checkboxId}
                      aria-label={`Allocate to ${c.orderNumber ?? c.requirementNumber}`}
                      checked={isTicked}
                      disabled={disabled || !c.linkable || onOtherLine}
                      onCheckedChange={(v) => onToggle(c.requirementId, v === true)}
                    />
                  </TableCell>
                  <TableCell>
                    <label htmlFor={checkboxId} className="block cursor-pointer">
                      <div className="font-medium">{c.orderNumber ?? 'No order'}</div>
                      <div className="text-xs text-muted-foreground">
                        {[c.customerName, c.requirementNumber].filter(Boolean).join(' · ')}
                      </div>
                    </label>
                  </TableCell>
                  <TableCell className="text-sm">{styleCodeLabel(c)}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {formatDate(c.deliveryDate ?? c.requiredDate)}
                    {c.arrivesLate && (
                      <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0">
                        Late
                      </Badge>
                    )}
                  </TableCell>
                  {line.located && <TableCell className="text-sm">{c.dyer?.name ?? 'Not decided'}</TableCell>}
                  <TableCell className="text-right text-sm tabular-nums whitespace-nowrap">
                    {allocationQty(c.needQty, c.unit)}
                  </TableCell>
                  <TableCell className="text-right">
                    {isTicked && (
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min={0}
                        aria-label={`Quantity for ${c.orderNumber ?? c.requirementNumber}`}
                        className="h-8 text-right tabular-nums"
                        value={row?.qty ?? ''}
                        disabled={disabled}
                        onChange={(e) => onEdit(c.requirementId, e.target.value)}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-xs max-w-[16rem]">
                    {!c.linkable ? (
                      <span className="text-muted-foreground">{c.blockedReason}</span>
                    ) : onOtherLine ? (
                      <span className="text-muted-foreground">
                        Ticked on {(elsewhere && nameOf.get(elsewhere)) ?? 'another line'}
                      </span>
                    ) : problem === 'OVER_NEED' ? (
                      <span className="text-destructive">More than it needs</span>
                    ) : problem === 'NOT_A_NUMBER' ? (
                      <span className="text-destructive">Enter a quantity</span>
                    ) : isTicked && !row?.edited && isQtyZero(typed) ? (
                      <span className="text-muted-foreground">Nothing left on this line</span>
                    ) : null}
                    {qtyExceeds(here, 0) && (
                      <Badge variant="outline" className="mt-1 border-warning text-[10px] font-normal">
                        {allocationQty(here, c.unit)} already here — held at once, can&apos;t be undone
                      </Badge>
                    )}
                    {refusal && <div className="mt-1 text-destructive">{refusal.reason}</div>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
