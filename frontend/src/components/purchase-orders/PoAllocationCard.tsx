/**
 * Which running orders a PO's lines are allocated to, and how far each got (docs/plans/po-allocation-design.md §7).
 *
 * Per line: Ordered / Arrived / Linked / Received for orders / Held / Free to link / Arrived free / To come, all
 * in the material's own unit. Under it, its orders in fill order — as goods arrive the first is filled first —
 * with what each was allocated, received, is held and has issued, and Undo while nothing has arrived for it.
 * Greige / lace lines also say where they deliver and where each order is dyed.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronRight, Undo2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { queryKeys } from '@/lib/query-client';
import { formatDate } from '@/lib/date';
import { qtyExceeds } from '@/lib/quantity';
import { groupLabelLines, sumRows } from '@/lib/label-lines';
import { handleApiError } from '@/lib/api-error-handler';
import { notify } from '@/lib/notify';
import {
  allocationLabelKey,
  allocationLineName,
  allocationQty,
  allocationUnit,
  purchaseUnitNote,
} from '@/lib/po-allocation-view';
import { poAllocationErrorOf, undoPoAllocation } from '@/services/poAllocation.service';
import {
  MaterialRequirementStatusColors,
  MaterialRequirementStatusLabels,
  type MaterialRequirementStatus,
} from '@/types/mrp.types';
import type { PoAllocationLine, PoAllocationLink, PoAllocationView } from '@/types/po-allocation.types';

interface PoAllocationCardProps {
  allocation: PoAllocationView;
  /** The user may link and undo (MRP or Purchase Orders permission) */
  canUndo: boolean;
  /** Something changed here — the page reloads the PO */
  onChanged?: () => void;
}

const FIGURES: Array<{ label: string; pick: (l: PoAllocationLine) => number; hint: string }> = [
  { label: 'Ordered', pick: (l) => l.orderedStockQty, hint: 'What the line orders, in the unit it is counted in' },
  { label: 'Arrived', pick: (l) => l.arrivedQty, hint: 'Accepted on approved receipts' },
  { label: 'Linked', pick: (l) => l.linkedQty, hint: 'Allocated to running orders' },
  {
    label: 'Received for orders',
    pick: (l) => l.receivedForOrdersQty,
    hint: 'Of what arrived, what went to the orders',
  },
  { label: 'Held', pick: (l) => l.heldQty, hint: 'Held in stock for those orders and not issued yet' },
  { label: 'Free to link', pick: (l) => l.freeToLink, hint: 'What more can be allocated to an order' },
  {
    label: 'Arrived free',
    pick: (l) => l.arrivedFree,
    hint: 'Arrived, nobody’s, still in stock — a new link takes it first',
  },
  { label: 'To come', pick: (l) => l.toComeQty, hint: 'Ordered and not arrived yet' },
];
const COLS = FIGURES.length + 1;

export function PoAllocationCard({ allocation, canUndo, onChanged }: PoAllocationCardProps) {
  const queryClient = useQueryClient();
  const { po, lines } = allocation;
  const linkCount = lines.reduce((n, l) => n + l.links.length, 0);
  // Few orders: show them; many (a label in six sizes for nine orders): let the user open the sizes they want
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(linkCount <= 12 ? lines.filter((l) => l.links.length > 0).map((l) => l.itemId) : [])
  );
  const [undoing, setUndoing] = useState<{ link: PoAllocationLink; line: PoAllocationLine } | null>(null);
  const [pending, setPending] = useState(false);

  const toggle = (itemId: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });

  const confirmUndo = async () => {
    if (!undoing || pending) return;
    setPending(true);
    try {
      const result = await undoPoAllocation(po.id, undoing.link.linkId);
      queryClient.setQueryData(queryKeys.poAllocation.detail(po.id), result.allocation);
      const status = MaterialRequirementStatusLabels[result.newStatus as MaterialRequirementStatus] ?? result.newStatus;
      notify.success(`Allocation undone — ${result.requirementNumber} is ${status.toLowerCase()} again`, {
        description:
          result.foldedBack.length > 0
            ? `Its balance ${result.foldedBack.length === 1 ? 'row' : 'rows'} ${result.foldedBack.join(', ')} folded back into it.`
            : undefined,
      });
      setUndoing(null);
      onChanged?.();
    } catch (err) {
      const refusal = poAllocationErrorOf(err);
      if (refusal?.code === 'PO_UNDO_REFUSED' || refusal?.code === 'PO_ALLOCATION_CHANGED') {
        notify.error(refusal.message);
        setUndoing(null);
      } else {
        handleApiError(err, 'Could not undo the allocation');
      }
    } finally {
      setPending(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.poAllocation.po(po.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.mrp.all });
    }
  };

  const lineRows = (line: PoAllocationLine, sized: boolean) => {
    const unit = allocationUnit(line);
    const isOpen = open.has(line.itemId);
    const note = purchaseUnitNote(line);
    const plainAway = line.located ? line.plainByPlace : [];
    return [
      <TableRow
        key={line.itemId}
        className={line.links.length > 0 ? 'cursor-pointer hover:bg-muted/40' : undefined}
        onClick={line.links.length > 0 ? () => toggle(line.itemId) : undefined}
      >
        <TableCell className={sized ? 'pl-8' : undefined}>
          <div className="flex items-start gap-2">
            {line.links.length > 0 ? (
              isOpen ? (
                <ChevronDown className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 mt-0.5 shrink-0" />
              )
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <div className="space-y-0.5">
              <div className="font-medium">
                {sized ? (line.material?.size ? `Size ${line.material.size}` : 'All sizes') : allocationLineName(line)}
              </div>
              <div className="text-xs text-muted-foreground">
                {line.links.length === 0
                  ? 'No orders linked'
                  : `${line.links.length} ${line.links.length === 1 ? 'order' : 'orders'}`}
                {note && ` · bought as ${note}`}
              </div>
              {line.located && (
                <div className="text-xs text-muted-foreground">
                  {line.deliversTo && line.deliversTo.length > 0
                    ? `Delivers to ${line.deliversTo.map((p) => p.name).join(', ')}`
                    : 'Delivery place to be advised'}
                </div>
              )}
              {plainAway.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Nobody&apos;s yet: {plainAway.map((p) => `${allocationQty(p.qty, unit)} at ${p.name}`).join(' · ')}
                </div>
              )}
              {line.pendingQcGrnNumber && (
                <div className="text-xs text-warning">
                  GRN {line.pendingQcGrnNumber} awaits QC — linking and Undo wait for it
                </div>
              )}
            </div>
          </div>
        </TableCell>
        {FIGURES.map((f) => (
          <TableCell key={f.label} className="text-right text-sm tabular-nums whitespace-nowrap">
            {allocationQty(f.pick(line), unit)}
          </TableCell>
        ))}
      </TableRow>,
      isOpen && line.links.length > 0 ? (
        <TableRow key={`${line.itemId}-links`} className="hover:bg-transparent">
          <TableCell colSpan={COLS} className="bg-muted/20 p-0">
            <LinkTable line={line} canUndo={canUndo} onUndo={(link) => setUndoing({ link, line })} />
          </TableCell>
        </TableRow>
      ) : null,
    ];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Allocated to orders</CardTitle>
        <CardDescription>
          As goods arrive, the order that needs them first is filled first. Figures are in each material&apos;s own
          unit.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Line</TableHead>
                {FIGURES.map((f) => (
                  <TableHead key={f.label} className="text-right whitespace-nowrap" title={f.hint}>
                    {f.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupLabelLines(lines, allocationLabelKey).map((g) => {
                if (g.kind === 'single') return lineRows(g.line, false);
                const unit = allocationUnit(g.rows[0].line);
                return [
                  <TableRow key={g.key} className="bg-muted/40 hover:bg-muted/40">
                    <TableCell>
                      <div className="font-medium">{g.code}</div>
                      <div className="text-xs text-muted-foreground">
                        {g.name} · {g.rows.length} {g.rows.length === 1 ? 'size' : 'sizes'}
                      </div>
                    </TableCell>
                    {FIGURES.map((f) => (
                      <TableCell
                        key={f.label}
                        className="text-right text-sm font-medium tabular-nums whitespace-nowrap"
                      >
                        {allocationQty(sumRows(g.rows, f.pick), unit)}
                      </TableCell>
                    ))}
                  </TableRow>,
                  ...g.rows.flatMap((r) => lineRows(r.line, true)),
                ];
              })}
            </TableBody>
          </Table>
        </TooltipProvider>
      </CardContent>

      <AlertDialog
        open={undoing !== null}
        onOpenChange={(next) => {
          if (!next && !pending) setUndoing(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo this allocation?</AlertDialogTitle>
            <AlertDialogDescription>
              {undoing && (
                <>
                  {allocationQty(undoing.link.allocatedQty, undoing.link.unit)} of {allocationLineName(undoing.line)} on{' '}
                  {po.poNumber} will no longer be for{' '}
                  <strong>{undoing.link.orderNumber ?? undoing.link.requirementNumber}</strong>
                  {undoing.link.styleCode ? ` (${undoing.link.styleCode})` : ''}. {undoing.link.requirementNumber} goes
                  back to needing a purchase order, and the quantity is free on this line again.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className={buttonVariants({ variant: 'destructive' })}
              onClick={(e) => {
                // Stays open until the server answers
                e.preventDefault();
                void confirmUndo();
              }}
            >
              {pending ? 'Undoing…' : 'Undo allocation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function LinkTable({
  line,
  canUndo,
  onUndo,
}: {
  line: PoAllocationLine;
  canUndo: boolean;
  onUndo: (link: PoAllocationLink) => void;
}) {
  const unitOf = (link: PoAllocationLink) => link.unit || allocationUnit(line);
  // Cloth that arrived and waits at a processor other than the one an order is now dyed at
  const waitingAt = (link: PoAllocationLink) =>
    line.plainByPlace.filter((p) => p.pool !== 'STORE' && p.pool !== 'UNPLACED' && p.pool !== link.dyer?.id);

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-10 text-center" title="Fill order: a receipt fills the first first">
            #
          </TableHead>
          <TableHead>Order</TableHead>
          <TableHead>Style</TableHead>
          <TableHead>Delivery</TableHead>
          {line.located && <TableHead>Dyed at</TableHead>}
          <TableHead className="text-right">Allocated</TableHead>
          <TableHead className="text-right">Received</TableHead>
          <TableHead className="text-right">Held</TableHead>
          <TableHead className="text-right">Issued</TableHead>
          <TableHead>Status</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {line.links.map((link) => {
          const unit = unitOf(link);
          const status = link.requirementStatus as MaterialRequirementStatus;
          const flags: string[] = [];
          if (link.orderStatus === 'CANCELLED') {
            flags.push(
              link.canUndo
                ? `Order cancelled — undo to free ${allocationQty(link.allocatedQty, unit)}`
                : 'Order cancelled'
            );
          }
          if (link.surplusQty != null && qtyExceeds(link.surplusQty, 0)) {
            flags.push(`BOM now needs ${allocationQty(link.surplusQty, unit)} less`);
          }
          if (link.dyerMoved && link.dyer) {
            const away = waitingAt(link).map((p) => p.name);
            flags.push(
              away.length > 0
                ? `Cloth at ${away.join(', ')} — order now dyed at ${link.dyer.name}: transfer it or change the dyer`
                : `Order now dyed at ${link.dyer.name} — the cloth that arrived is elsewhere: transfer it or change the dyer`
            );
          }
          if (link.deliveryMismatch) {
            flags.push(
              link.dyer
                ? `This line no longer delivers to ${link.dyer.name}`
                : 'This line no longer delivers where this order is dyed'
            );
          }
          return (
            <TableRow key={link.linkId}>
              <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                {link.fillOrder ?? '—'}
              </TableCell>
              <TableCell>
                <div className="font-medium">{link.orderNumber ?? 'No order'}</div>
                <div className="text-xs text-muted-foreground">
                  {[link.customerName, link.requirementNumber].filter(Boolean).join(' · ')}
                </div>
                {flags.map((f) => (
                  <div key={f} className="mt-0.5 flex items-start gap-1 text-xs text-warning">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </TableCell>
              <TableCell className="text-sm">{link.styleCode ?? '—'}</TableCell>
              <TableCell className="text-sm whitespace-nowrap">
                {formatDate(link.deliveryDate ?? link.requiredDate)}
              </TableCell>
              {line.located && <TableCell className="text-sm">{link.dyer?.name ?? 'Not decided'}</TableCell>}
              <TableCell className="text-right text-sm tabular-nums whitespace-nowrap">
                {allocationQty(link.allocatedQty, unit)}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums whitespace-nowrap">
                {allocationQty(link.receivedQty, unit)}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums whitespace-nowrap">
                {allocationQty(link.heldQty, unit)}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums whitespace-nowrap">
                {allocationQty(link.issuedQty, unit)}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={`whitespace-nowrap border-transparent ${MaterialRequirementStatusColors[status] ?? ''}`}
                >
                  {MaterialRequirementStatusLabels[status] ?? link.requirementStatus}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {canUndo &&
                  (link.canUndo ? (
                    <Button variant="ghost" size="sm" onClick={() => onUndo(link)}>
                      <Undo2 className="h-4 w-4 mr-1" />
                      Undo
                    </Button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {/* A disabled button gets no pointer events — the span carries the tooltip */}
                        <span tabIndex={0} className="inline-block">
                          <Button variant="ghost" size="sm" disabled aria-label="Undo (not allowed)">
                            <Undo2 className="h-4 w-4 mr-1" />
                            Undo
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        Can&apos;t undo: {link.undoBlockedReason ?? 'not allowed now'}
                      </TooltipContent>
                    </Tooltip>
                  ))}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
