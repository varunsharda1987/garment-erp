import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { compareSizes } from '@/utils/sku-generator';
import { labelPieces, sizeOf, type LabelMaterialRow } from '@/lib/label-materials';
import type { LabelSetLabel, StyleLabelSet } from '@/types/style-material-bom.types';

/** One label's quantities to put on the PO: every row of it this supplier supplies, and the pieces per row. */
export interface LabelSetSelection {
  labelId: string;
  rows: LabelMaterialRow[];
  qtyByMaterialId: Record<string, number>;
}

interface LabelSetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labelSet: StyleLabelSet;
  /** Just these labels (a row's "Sizes…"), or the whole set */
  onlyLabelIds?: string[] | null;
  supplierId: string;
  supplierName?: string | null;
  /** The supplier's material list (GET /materials?supplierId=…) — says which labels / sizes it supplies */
  materials: LabelMaterialRow[];
  materialsLoading?: boolean;
  /** Pieces already on the PO, by material id — the dialog opens with them */
  existingQty: Record<string, number>;
  /** No supplier chosen yet: pick one of the labels' suppliers */
  onChooseSupplier: (supplierId: string) => void;
  onApply: (selections: LabelSetSelection[]) => void;
}

const UNSIZED = '__total__';
const cellKey = (labelId: string, size: string) => `${labelId}|${size}`;

/**
 * Order a style's labels together — every label, every size — on one PO.
 *
 * Rows are the style's BOM labels, columns the sizes. With an order linked, the "Garments per size" row starts
 * from that order's size breakup and every label fills itself: garments × labels per garment + the BOM's extra %,
 * rounded up to whole pieces. With no order, type the garments per size once. Any cell can be typed over (it then
 * stops following the garments row). Unsized labels take the total. A label this supplier does not supply (not
 * linked on its Label page) is shown but cannot be ticked. Each size becomes its own PO line.
 *
 * Mount it only while open — it seeds its boxes on mount.
 */
export function LabelSetDialog({
  open,
  onOpenChange,
  labelSet,
  onlyLabelIds,
  supplierId,
  supplierName,
  materials,
  materialsLoading,
  existingQty,
  onChooseSupplier,
  onApply,
}: LabelSetDialogProps) {
  const labels = labelSet.labels.filter((l) => !onlyLabelIds || onlyLabelIds.includes(l.labelId));

  // The rows this supplier supplies, per label: its size rows (sized label) or its base row (unsized)
  const supplierRows = (l: LabelSetLabel): LabelMaterialRow[] =>
    l.sizes.length > 0
      ? materials.filter((m) => m.labelId === l.labelId && sizeOf(m))
      : materials.filter((m) => m.id === l.baseMaterialId || (m.labelId === l.labelId && !sizeOf(m))).slice(0, 1);
  const rowFor = (l: LabelSetLabel, size: string) =>
    size === UNSIZED
      ? supplierRows(l)[0]
      : supplierRows(l).find((m) => sizeOf(m)?.toLowerCase() === size.toLowerCase());
  const available = (l: LabelSetLabel) => supplierRows(l).length > 0;

  const sizes = [...new Set(labels.flatMap((l) => l.sizes.map((s) => s.size)))].sort(compareSizes);

  const [garments, setGarments] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      sizes.map((size) => {
        const fromOrder = labelSet.order?.sizes.find((s) => s.size.toLowerCase() === size.toLowerCase())?.garments;
        return [size, fromOrder ? String(fromOrder) : ''];
      })
    )
  );
  // Cells typed by hand (and quantities already on the PO) no longer follow the garments row
  const [typed, setTyped] = useState<Record<string, string>>(() => {
    const seeded: Record<string, string> = {};
    for (const l of labels) {
      for (const size of l.sizes.length > 0 ? l.sizes.map((s) => s.size) : [UNSIZED]) {
        const row = rowFor(l, size);
        if (row && existingQty[row.id] > 0) seeded[cellKey(l.labelId, size)] = String(existingQty[row.id]);
      }
    }
    return seeded;
  });
  const [included, setIncluded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(labels.map((l) => [l.labelId, true]))
  );

  const garmentsOf = (size: string) => Math.max(0, Math.round(Number(garments[size]) || 0));
  const totalGarments =
    sizes.length > 0 ? sizes.reduce((sum, s) => sum + garmentsOf(s), 0) : (labelSet.order?.totalGarments ?? 0);
  const [unsizedGarments, setUnsizedGarments] = useState<string>(() =>
    sizes.length === 0 && labelSet.order ? String(labelSet.order.totalGarments) : ''
  );
  const garmentsForUnsized = sizes.length > 0 ? totalGarments : Math.max(0, Math.round(Number(unsizedGarments) || 0));

  const cellValue = (l: LabelSetLabel, size: string): string => {
    const k = cellKey(l.labelId, size);
    if (k in typed) return typed[k];
    const g = size === UNSIZED ? garmentsForUnsized : garmentsOf(size);
    const pieces = labelPieces(g, l.quantityPerGarment, l.extraPercent);
    return pieces > 0 ? String(pieces) : '';
  };
  const pieces = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  };

  const selections: LabelSetSelection[] = labels
    .filter((l) => included[l.labelId] && available(l))
    .map((l) => {
      const rows = supplierRows(l);
      const qtyByMaterialId: Record<string, number> = {};
      for (const size of l.sizes.length > 0 ? l.sizes.map((s) => s.size) : [UNSIZED]) {
        const row = rowFor(l, size);
        if (row) qtyByMaterialId[row.id] = pieces(cellValue(l, size));
      }
      return { labelId: l.labelId, rows, qtyByMaterialId };
    });
  const lineCount = selections.reduce((n, s) => n + Object.values(s.qtyByMaterialId).filter((q) => q > 0).length, 0);
  const pieceCount = selections.reduce((n, s) => n + Object.values(s.qtyByMaterialId).reduce((a, q) => a + q, 0), 0);
  const openRequirements = labels.reduce((n, l) => n + l.openRequirementCount, 0);

  // Suppliers linked to these labels, the preferred first — offered when the PO has none yet
  const supplierChoices = (() => {
    const bySupplier = new Map<string, { name: string; labels: number; preferred: number }>();
    for (const l of labels) {
      for (const s of l.supplierLinks) {
        const e = bySupplier.get(s.supplierId) ?? { name: s.supplierName, labels: 0, preferred: 0 };
        e.labels += 1;
        if (s.isPreferred) e.preferred += 1;
        bySupplier.set(s.supplierId, e);
      }
    }
    return [...bySupplier.entries()].sort((a, b) => b[1].preferred - a[1].preferred || b[1].labels - a[1].labels);
  })();

  const unavailableReason = (l: LabelSetLabel) => {
    const others = l.supplierLinks.map((s) => s.supplierName);
    if (others.length === 0) return 'No supplier on its Label page';
    return `Not supplied by ${supplierName || 'this supplier'} (supplied by ${others.join(', ')})`;
  };

  const requirementsHref = labelSet.order
    ? `/procurement/requirements?view=byOrderStyle&materialType=LABEL&orderId=${labelSet.order.id}&styleId=${labelSet.styleId}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {labels.length === 1 ? `${labels[0].code} - ${labels[0].name}` : `Label set — ${labelSet.styleCode}`}
          </DialogTitle>
          <DialogDescription>
            {labelSet.order
              ? `Garments per size from order ${labelSet.order.orderNumber}${
                  labelSet.orderBom
                    ? ` · labels per garment and extra % from its Order BOM v${labelSet.orderBom.version}`
                    : ''
                }. Change any box; each size becomes its own PO line.`
              : 'Type the garments per size once — every label fills from it. Change any box; each size becomes its own PO line.'}
          </DialogDescription>
        </DialogHeader>

        {!supplierId ? (
          <div className="space-y-3 py-2">
            <p className="text-sm">Choose the supplier for these labels (the PO is for one supplier):</p>
            {supplierChoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                None of these labels has a supplier on its Label page. Add one there, or choose a supplier on the PO
                first.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {supplierChoices.map(([id, s]) => (
                  <Button key={id} variant="outline" onClick={() => onChooseSupplier(id)}>
                    {s.name}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {s.labels} of {labels.length} {labels.length === 1 ? 'label' : 'labels'}
                      {s.preferred > 0 ? ' · preferred' : ''}
                    </span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        ) : materialsLoading ? (
          <p className="py-6 text-sm text-muted-foreground">Loading {supplierName || 'the supplier'}'s labels…</p>
        ) : (
          <div className="space-y-3">
            {openRequirements > 0 && requirementsHref && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Order {labelSet.order?.orderNumber} already has {openRequirements} open label requirement
                  {openRequirements === 1 ? '' : 's'} from MRP. A PO made here does not close them — to order them and
                  keep MRP linked, use{' '}
                  <Link to={requirementsHref} className="underline font-medium">
                    Requirements → By Order &amp; Style
                  </Link>
                  .
                </AlertDescription>
              </Alert>
            )}

            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="min-w-[220px]">Label</TableHead>
                    {sizes.map((size) => (
                      <TableHead key={size} className="text-center min-w-[80px]">
                        {size}
                      </TableHead>
                    ))}
                    <TableHead className="text-center min-w-[90px]">
                      {sizes.length > 0 ? 'Unsized' : 'Pieces'}
                    </TableHead>
                    <TableHead className="text-right min-w-[80px]">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Garments per size — every label below follows it */}
                  <TableRow className="bg-muted/30">
                    <TableCell className="text-sm font-medium">Garments per size</TableCell>
                    {sizes.map((size) => (
                      <TableCell key={size} className="p-1">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          aria-label={`Garments ${size}`}
                          className="h-8 text-center"
                          value={garments[size] ?? ''}
                          onChange={(e) => setGarments((prev) => ({ ...prev, [size]: e.target.value }))}
                        />
                      </TableCell>
                    ))}
                    <TableCell className="p-1">
                      {sizes.length > 0 ? (
                        <div className="text-center text-sm text-muted-foreground">
                          {totalGarments ? totalGarments.toLocaleString() : ''}
                        </div>
                      ) : (
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          aria-label="Garments"
                          className="h-8 text-center"
                          value={unsizedGarments}
                          onChange={(e) => setUnsizedGarments(e.target.value)}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {garmentsForUnsized ? `${garmentsForUnsized.toLocaleString()} garments` : ''}
                    </TableCell>
                  </TableRow>

                  {labels.map((l) => {
                    const ok = available(l);
                    const on = ok && included[l.labelId];
                    const cells = l.sizes.length > 0 ? l.sizes.map((s) => s.size) : [UNSIZED];
                    const rowTotal = cells.reduce(
                      (sum, size) => sum + (rowFor(l, size) ? pieces(cellValue(l, size)) : 0),
                      0
                    );
                    return (
                      <TableRow key={l.labelId} className={ok ? undefined : 'opacity-60'}>
                        <TableCell>
                          <div className="flex items-start gap-2">
                            <Checkbox
                              checked={on}
                              disabled={!ok}
                              aria-label={`Include ${l.code}`}
                              onCheckedChange={(v) => setIncluded((prev) => ({ ...prev, [l.labelId]: v === true }))}
                              className="mt-0.5"
                            />
                            <div>
                              <div className="font-medium text-sm">{l.code}</div>
                              <div className="text-xs text-muted-foreground">
                                {l.name} · {l.quantityPerGarment}/garment{l.extraPercent ? ` +${l.extraPercent}%` : ''}
                              </div>
                              {!ok && <div className="text-xs text-warning">{unavailableReason(l)}</div>}
                              {ok && l.orderSizesMissing.length > 0 && (
                                <div className="text-xs text-warning">
                                  No {l.orderSizesMissing.join(', ')} size for this label — the order has{' '}
                                  {l.orderSizesMissing.length === 1 ? 'it' : 'them'}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        {sizes.map((size) => {
                          const has = l.sizes.some((s) => s.size === size);
                          const row = has ? rowFor(l, size) : undefined;
                          return (
                            <TableCell key={size} className="p-1 text-center">
                              {has && row ? (
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  step={1}
                                  aria-label={`${l.code} ${size}`}
                                  className="h-8 text-center"
                                  disabled={!on}
                                  value={cellValue(l, size)}
                                  onChange={(e) =>
                                    setTyped((prev) => ({ ...prev, [cellKey(l.labelId, size)]: e.target.value }))
                                  }
                                />
                              ) : (
                                <span
                                  className="text-muted-foreground"
                                  title={has ? 'Not supplied by this supplier' : 'No such size'}
                                >
                                  —
                                </span>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell className="p-1 text-center">
                          {l.sizes.length === 0 && rowFor(l, UNSIZED) ? (
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              step={1}
                              aria-label={`${l.code} pieces`}
                              className="h-8 text-center"
                              disabled={!on}
                              value={cellValue(l, UNSIZED)}
                              onChange={(e) =>
                                setTyped((prev) => ({ ...prev, [cellKey(l.labelId, UNSIZED)]: e.target.value }))
                              }
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {on && rowTotal ? `${rowTotal.toLocaleString()} pcs` : ''}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {supplierId && !materialsLoading
              ? `${selections.length} ${selections.length === 1 ? 'label' : 'labels'} · ${lineCount} ${
                  lineCount === 1 ? 'line' : 'lines'
                } · ${pieceCount.toLocaleString()} pcs`
              : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={!supplierId || materialsLoading || selections.length === 0}
              onClick={() => onApply(selections)}
            >
              Put on the PO
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
