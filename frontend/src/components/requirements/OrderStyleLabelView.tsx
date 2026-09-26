/**
 * Requirements page — "By Order & Style (label sets)".
 *
 * One card per order + style; inside it every label is one heading row (its sizes' totals) with a row per size
 * beneath, in size order. A whole set, one label, or one size can be ticked — the selection is the page's own
 * requirement ids, so Manual PO / Bulk Generate POs work (and keep their requirement → PO links) exactly as in
 * the other views. Anything that is not a label stays one row, as it is in the other views.
 */
import { useState } from 'react';
import { ChevronRight, Info } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatQuantity } from '@/lib/formatters';
import { formatDate } from '@/lib/date';
import { unitShort } from '@/lib/units';
import { isQtyZero } from '@/lib/quantity';
import { sumRows, type GroupedLine, type LabelGroup } from '@/lib/label-lines';
import {
  MaterialRequirementStatusColors,
  MaterialRequirementStatusLabels,
  type MaterialRequirement,
} from '@/types/mrp.types';
import type { MergedRequirementRow, OrderStyleGroup } from './order-style-groups';
import { RequirementDecisionActions, RequirementQtyNote } from './RequirementDecision';

interface OrderStyleLabelViewProps {
  groups: OrderStyleGroup[];
  selectedIds: string[];
  onSelect: (ids: string[], checked: boolean) => void;
  /** The page's rule for "can this requirement be put on a PO from here" */
  isSelectable: (req: MaterialRequirement) => boolean;
  /** Why a requirement waiting for a PO cannot be ticked here (null when it can, or is not waiting) */
  notSelectableHint?: (req: MaterialRequirement) => string | null;
  onUseStock: (req: MaterialRequirement) => void;
  onCancel: (req: MaterialRequirement) => void;
}

const COLS = 11;

const distinct = <T,>(values: T[]) => [...new Set(values)];

const vendorOf = (reqs: MaterialRequirement[]) => {
  const names = distinct(reqs.map((r) => r.preferredSupplier?.name ?? null));
  if (names.length === 1) return names[0] ?? 'Not Assigned';
  return 'Mixed';
};

const poNumbersOf = (reqs: MaterialRequirement[]) =>
  distinct(reqs.flatMap((r) => (r.poLinks ?? []).map((l) => l.purchaseOrder?.poNumber).filter(Boolean) as string[]));

const earliestDate = (reqs: MaterialRequirement[]) =>
  reqs
    .map((r) => r.requiredDate)
    .filter(Boolean)
    .sort()[0] ?? null;

/** One unit across every row, or null — a total of metres and pieces is not a number */
const sharedUnit = (rows: MergedRequirementRow[]) => {
  const units = distinct(rows.map((r) => unitShort(r.unit)));
  return units.length === 1 ? rows[0].unit : null;
};

function StatusChips({ reqs }: { reqs: MaterialRequirement[] }) {
  const counts = new Map<MaterialRequirement['status'], number>();
  for (const r of reqs) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  return (
    <div className="flex flex-wrap gap-1">
      {[...counts].map(([status, n]) => (
        <span
          key={status}
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${MaterialRequirementStatusColors[status]}`}
        >
          {MaterialRequirementStatusLabels[status]}
          {counts.size > 1 || n > 1 ? ` ×${n}` : ''}
        </span>
      ))}
    </div>
  );
}

export function OrderStyleLabelView({
  groups,
  selectedIds,
  onSelect,
  isSelectable,
  notSelectableHint,
  onUseStock,
  onCancel,
}: OrderStyleLabelViewProps) {
  // A few sets open straight away (a link from the PO form lands on one); a long list starts folded.
  // Only the user's own toggles are stored, so the default follows the data whenever it arrives.
  const [styleToggles, setStyleToggles] = useState<Record<string, boolean>>({});
  const [openLabels, setOpenLabels] = useState<Set<string>>(new Set());
  const selected = new Set(selectedIds);
  const stylesOpenByDefault = groups.length <= 3;
  const isStyleOpen = (key: string) => styleToggles[key] ?? stylesOpenByDefault;
  const toggleStyle = (key: string) =>
    setStyleToggles((prev) => ({ ...prev, [key]: !(prev[key] ?? stylesOpenByDefault) }));
  const toggleLabel = (key: string) =>
    setOpenLabels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const selectableIds = (reqs: MaterialRequirement[]) => reqs.filter(isSelectable).map((r) => r.id);

  /** Checkbox for a set of requirements: ticked when every orderable one is selected; "3 of 6" when some are */
  const renderSelect = (reqs: MaterialRequirement[], label: string) => {
    const ids = selectableIds(reqs);
    if (ids.length === 0) return null;
    const picked = ids.filter((id) => selected.has(id)).length;
    return (
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          aria-label={label}
          checked={picked === ids.length}
          onCheckedChange={(checked) => onSelect(ids, !!checked)}
        />
        {picked > 0 && picked < ids.length && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {picked} of {ids.length}
          </span>
        )}
      </div>
    );
  };

  const renderHint = (reqs: MaterialRequirement[]) => {
    if (!notSelectableHint || selectableIds(reqs).length > 0) return null;
    const hint = reqs.map(notSelectableHint).find(Boolean);
    return hint ? (
      <span title={hint} aria-label={hint}>
        <Info className="h-4 w-4 text-muted-foreground" />
      </span>
    ) : null;
  };

  const renderActions = (reqs: MaterialRequirement[]) => {
    const many = reqs.length > 1;
    return (
      <div className="flex flex-wrap gap-1 justify-end">
        {reqs.map((req) => {
          const suffix = many ? ` ${req.requirementNumber}` : '';
          const canUseStock =
            !isQtyZero(req.currentStock) &&
            !isQtyZero(req.shortfall) &&
            (req.status === 'PO_REQUIRED' || req.status === 'PARTIAL_STOCK');
          const canCancel = req.status === 'PENDING' || req.status === 'PO_REQUIRED';
          return (
            <span key={req.id} className="contents">
              {/* A new BOM version needs more than the PO placed: Order the extra / Don't order more */}
              <RequirementDecisionActions req={req} />
              {canUseStock && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-success hover:text-success text-xs"
                  onClick={() => onUseStock(req)}
                >
                  Use Stock{suffix}
                </Button>
              )}
              {canCancel && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive text-xs"
                  onClick={() => onCancel(req)}
                >
                  Cancel{suffix}
                </Button>
              )}
            </span>
          );
        })}
      </div>
    );
  };

  /** A size row (or a single, non-grouped line): its own figures, every requirement behind it */
  const renderRow = (row: MergedRequirementRow, opts: { size?: string | null; inGroup: boolean }) => {
    const reqs = row.requirements;
    const pending = reqs.every((r) => r.status === 'SIZE_PENDING');
    const pos = poNumbersOf(reqs);
    return (
      <TableRow key={row.key} className={opts.inGroup ? 'bg-muted/20' : undefined}>
        <TableCell>{renderSelect(reqs, `Select ${row.head.material?.code ?? ''}`) ?? renderHint(reqs)}</TableCell>
        <TableCell className={opts.inGroup ? 'pl-10' : undefined}>
          {opts.inGroup ? (
            pending ? (
              <span className="text-sm text-muted-foreground">All sizes — waiting for the size split</span>
            ) : (
              <span className="text-sm font-medium">{opts.size ? `Size ${opts.size}` : 'No size'}</span>
            )
          ) : (
            <div>
              <div className="text-sm font-medium">{row.head.material?.name || 'N/A'}</div>
              <div className="text-xs text-muted-foreground">{row.head.material?.code}</div>
            </div>
          )}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {reqs.map((r) => r.requirementNumber).join(', ')}
          {reqs.length > 1 && <div>{reqs.length} colours</div>}
        </TableCell>
        <TableCell className="text-right text-sm">
          {formatQuantity(row.totalRequired, row.unit)}
          {reqs.map((r) => (
            <RequirementQtyNote key={r.id} req={r} />
          ))}
        </TableCell>
        <TableCell className="text-right">
          <span className={`text-sm font-medium ${!isQtyZero(row.shortfall) ? 'text-primary' : 'text-success'}`}>
            {!isQtyZero(row.shortfall) ? formatQuantity(row.shortfall, row.unit) : 'Fulfilled'}
          </span>
        </TableCell>
        <TableCell className="text-right text-sm">
          {!isQtyZero(row.head.currentStock) ? (
            <span className="text-success">{formatQuantity(row.head.currentStock, row.unit)}</span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell className="text-sm">{formatDate(earliestDate(reqs))}</TableCell>
        <TableCell>
          <StatusChips reqs={reqs} />
        </TableCell>
        <TableCell className="text-sm">{vendorOf(reqs)}</TableCell>
        <TableCell className="text-xs">{pos.length > 0 ? pos.join(', ') : '-'}</TableCell>
        <TableCell className="text-right">{renderActions(reqs)}</TableCell>
      </TableRow>
    );
  };

  /** A label's heading row: totals of its sizes; tick it to take every orderable size */
  const renderLabel = (styleKey: string, group: LabelGroup<MergedRequirementRow>) => {
    const key = `${styleKey}|${group.labelId}`;
    const open = openLabels.has(key);
    const rows = group.rows.map((r) => r.line);
    const reqs = rows.flatMap((r) => r.requirements);
    const unit = sharedUnit(rows);
    const sizes = group.rows.filter((r) => r.size).length;
    const pos = poNumbersOf(reqs);
    return [
      <TableRow key={key} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleLabel(key)}>
        <TableCell>{renderSelect(reqs, `Select all sizes of ${group.code}`) ?? renderHint(reqs)}</TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
            <div>
              <div className="text-sm font-medium">{group.name}</div>
              <div className="text-xs text-muted-foreground">
                {group.code}
                {group.type ? ` · ${group.type}` : ''}
                {sizes > 0 ? ` · ${sizes} ${sizes === 1 ? 'size' : 'sizes'}` : ''}
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">{reqs.length} requirements</TableCell>
        <TableCell className="text-right text-sm font-medium">
          {unit
            ? formatQuantity(
                sumRows(group.rows, (r) => r.totalRequired),
                unit
              )
            : '-'}
        </TableCell>
        <TableCell className="text-right text-sm font-medium">
          {unit
            ? formatQuantity(
                sumRows(group.rows, (r) => r.shortfall),
                unit
              )
            : '-'}
        </TableCell>
        <TableCell className="text-right text-sm">
          {unit && !isQtyZero(sumRows(group.rows, (r) => r.head.currentStock)) ? (
            <span className="text-success">
              {formatQuantity(
                sumRows(group.rows, (r) => r.head.currentStock),
                unit
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell className="text-sm">{formatDate(earliestDate(reqs))}</TableCell>
        <TableCell>
          <StatusChips reqs={reqs} />
        </TableCell>
        <TableCell className="text-sm">{vendorOf(reqs)}</TableCell>
        <TableCell className="text-xs">{pos.length > 0 ? pos.join(', ') : '-'}</TableCell>
        <TableCell />
      </TableRow>,
      ...(open ? group.rows.map((r) => renderRow(r.line, { size: r.size, inGroup: true })) : []),
    ];
  };

  const renderLine = (styleKey: string, line: GroupedLine<MergedRequirementRow>) =>
    line.kind === 'label' ? renderLabel(styleKey, line) : [renderRow(line.line, { inGroup: false })];

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const open = isStyleOpen(group.key);
        // A label with one unsized line (a price tag, a Liva tag) is still a label of the set
        const labels = group.lines.filter((l) => l.kind === 'label' || l.label).length;
        const sizes = group.lines.reduce(
          (n, l) => n + (l.kind === 'label' ? l.rows.filter((r) => r.size).length : 0),
          0
        );
        const others = group.lines.length - labels;
        return (
          <Collapsible key={group.key} open={open} onOpenChange={() => toggleStyle(group.key)}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 py-3 px-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {renderSelect(group.requirements, `Select the whole set for ${group.styleCode ?? 'this style'}`)}
                      <ChevronRight className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} />
                      <div>
                        <div className="font-medium">
                          {group.styleCode ?? 'No style'}
                          {group.buyerStyleRef && group.buyerStyleRef !== group.styleCode
                            ? ` (${group.buyerStyleRef})`
                            : ''}
                          {group.styleName ? ` — ${group.styleName}` : ''}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {group.orderNumber ?? 'No order'}
                          {group.customerName ? ` · ${group.customerName}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {labels > 0 && (
                        <Badge variant="secondary">
                          {labels} {labels === 1 ? 'label' : 'labels'} · {sizes} {sizes === 1 ? 'size' : 'sizes'}
                        </Badge>
                      )}
                      {others > 0 && (
                        <Badge variant="outline">
                          {others} other {others === 1 ? 'line' : 'lines'}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 px-4 pb-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16"></TableHead>
                        <TableHead>Label / Size</TableHead>
                        <TableHead>Requirement #</TableHead>
                        <TableHead className="text-right">Required</TableHead>
                        <TableHead className="text-right">Shortfall</TableHead>
                        <TableHead className="text-right">Current Stock</TableHead>
                        <TableHead>Required Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>PO</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.lines.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={COLS} className="text-center text-muted-foreground">
                            No requirements
                          </TableCell>
                        </TableRow>
                      ) : (
                        group.lines.flatMap((line) => renderLine(group.key, line))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}
