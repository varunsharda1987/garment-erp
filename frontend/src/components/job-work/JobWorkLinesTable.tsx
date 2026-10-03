/**
 * What a job work order brings back — one row per line (a finished fabric or dyed lace), with the orders it is
 * for. A dyeing job for SP27CK130 Red, -B Black and -T Teal is ONE job with three lines (2026-09-30); the header
 * shows only what the lines share.
 */
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StyleIdentity } from '@/components/StyleIdentity';
import { formatQuantity } from '@/lib/formatters';
import { formatCurrency } from '@/lib/currency';
import { unitPer } from '@/lib/units';
import { formatDate } from '@/lib/date';
import { isQtyZero } from '@/lib/quantity';
import { lineColour, notProcessedWord } from '@/lib/jwo-lines';
import type { ReactNode } from 'react';
import type { JobWorkOrderLine } from '@/types/jobWorkOrder.types';

interface JobWorkLinesTableProps {
  lines: JobWorkOrderLine[];
  uom: string;
  /** Issue dialog: what the greige is for — no received column */
  compact?: boolean;
  /** Per-colour actions (Return undyed, Drop…) — a last column when given */
  actions?: (line: JobWorkOrderLine) => ReactNode;
  /** The job's process — a colour back untouched reads "back undyed" / "back unprinted" */
  processType?: string | null;
  /** Greige going out colour by colour: say under each colour's greige when (and on which challan) it went */
  showSendState?: boolean;
  /** Each colour billed at its own rate (2026-10-03): a Rate column, and — before approval — a way to change it */
  showRate?: boolean;
  onEditRate?: (line: JobWorkOrderLine) => void;
}

/** How a finished line reads under its Received figure */
const closedLabel = (closedHow: string | null | undefined, processType: string | null | undefined) =>
  ({
    FINAL: 'complete',
    SHORT: 'closed short',
    RETURNED: `back ${notProcessedWord(processType)} — order back to needs processing`,
    DROPPED: 'dropped — order back to needs processing',
  })[closedHow ?? 'FINAL'];

const sum = (lines: JobWorkOrderLine[], pick: (l: JobWorkOrderLine) => number | string | null | undefined) =>
  lines.reduce((total, l) => total + Number(pick(l) ?? 0), 0);

export function JobWorkLinesTable({
  lines,
  uom,
  compact = false,
  actions,
  processType,
  showSendState = false,
  showRate = false,
  onEditRate,
}: JobWorkLinesTableProps) {
  const many = lines.length > 1;
  const received = sum(lines, (l) => l.receivedQty);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Buyer Style Code</TableHead>
          <TableHead>Colour</TableHead>
          {!compact && <TableHead>Fabric expected back</TableHead>}
          <TableHead className="text-right">Greige</TableHead>
          <TableHead className="text-right">Expected back</TableHead>
          {showRate && !compact && <TableHead className="text-right">Rate</TableHead>}
          {!compact && <TableHead className="text-right">Received</TableHead>}
          {actions && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line) => {
          const colour = lineColour(line);
          const output = line.finishedLace ?? line.finishedFabric;
          return (
            <TableRow key={line.id}>
              <TableCell>
                {line.requirementLinks.length === 0 ? (
                  <span className="text-muted-foreground">Stock</span>
                ) : (
                  line.requirementLinks.map((link) => (
                    <div key={link.materialRequirements.id} className="whitespace-nowrap">
                      <div className="font-medium">{link.materialRequirements.orders?.orderNumber ?? 'Stock'}</div>
                      <div className="text-xs text-muted-foreground">
                        {link.materialRequirements.requirementNumber}
                        {line.requirementLinks.length > 1 ? ` · ${formatQuantity(link.allocatedQuantity, uom)}` : ''}
                      </div>
                    </div>
                  ))
                )}
              </TableCell>
              <TableCell>
                <StyleIdentity style={line.style} layout="stacked" fallback="-" />
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-2">
                  {line.colorMaster?.hexCode && (
                    <span
                      className="h-3.5 w-3.5 flex-shrink-0 rounded border border-border"
                      style={{ backgroundColor: line.colorMaster.hexCode }}
                    />
                  )}
                  {colour ?? '-'}
                </span>
              </TableCell>
              {!compact && (
                <TableCell>
                  {output ? (
                    <>
                      <div className="text-sm">{'fabricName' in output ? output.fabricName : output.laceName}</div>
                      <div className="text-xs text-muted-foreground">
                        {'fabricCode' in output ? output.fabricCode : output.laceCode}
                        {line.sentWidthInches != null ? ` · ${Number(line.sentWidthInches)}" finish width` : ''}
                      </div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Named when it comes back</span>
                  )}
                </TableCell>
              )}
              <TableCell className="text-right whitespace-nowrap">
                {formatQuantity(line.qtySent, uom)}
                {showSendState && !compact && line.closedHow !== 'DROPPED' && (
                  <div className="text-xs text-muted-foreground">
                    {line.sentDate
                      ? `sent ${formatDate(line.sentDate)}${line.outwardChallan ? ` · ${line.outwardChallan.challanNumber}` : ''}`
                      : 'not sent yet'}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">
                {line.qtyExpected != null ? formatQuantity(line.qtyExpected, uom) : '-'}
                {line.expectedShrinkage != null && Number(line.expectedShrinkage) > 0 && (
                  <div className="text-xs text-muted-foreground">{Number(line.expectedShrinkage)}% shrinkage</div>
                )}
              </TableCell>
              {showRate && !compact && (
                <TableCell className="text-right whitespace-nowrap">
                  {line.ratePerUnit != null ? `${formatCurrency(Number(line.ratePerUnit))} / ${unitPer(uom)}` : '-'}
                  {line.rateSource === 'MANUAL' && (
                    <div className="text-xs text-muted-foreground" title={line.rateVarianceReason ?? undefined}>
                      typed
                    </div>
                  )}
                  {onEditRate && (
                    <div>
                      <button type="button" className="text-xs text-primary underline" onClick={() => onEditRate(line)}>
                        Change
                      </button>
                    </div>
                  )}
                </TableCell>
              )}
              {!compact && (
                <TableCell className="text-right whitespace-nowrap">
                  {!isQtyZero(line.receivedQty) ? formatQuantity(line.receivedQty, uom) : '-'}
                  {(many || line.closedHow === 'RETURNED' || line.closedHow === 'DROPPED') && line.closedAt && (
                    <div className="text-xs text-muted-foreground">
                      {closedLabel(line.closedHow, processType)}
                      {line.closedHow === 'RETURNED' && line.qtyReturned != null
                        ? ` (${formatQuantity(line.qtyReturned, uom)})`
                        : ''}
                    </div>
                  )}
                </TableCell>
              )}
              {actions && <TableCell className="text-right">{actions(line)}</TableCell>}
            </TableRow>
          );
        })}
      </TableBody>
      {many && (
        <TableFooter>
          <TableRow>
            <TableCell colSpan={compact ? 3 : 4} className="font-medium">
              Total — {lines.length} lines
            </TableCell>
            <TableCell className="text-right font-medium whitespace-nowrap">
              {formatQuantity(
                sum(lines, (l) => l.qtySent),
                uom
              )}
            </TableCell>
            <TableCell className="text-right font-medium whitespace-nowrap">
              {formatQuantity(
                sum(lines, (l) => l.qtyExpected),
                uom
              )}
            </TableCell>
            {showRate && !compact && <TableCell />}
            {!compact && (
              <TableCell className="text-right font-medium whitespace-nowrap">
                {isQtyZero(received) ? '-' : formatQuantity(received, uom)}
              </TableCell>
            )}
            {actions && <TableCell />}
          </TableRow>
        </TableFooter>
      )}
    </Table>
  );
}
