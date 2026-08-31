import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { notify } from '@/lib/notify';
import { getStyleById } from '@/services/style.service';
import { setOrderItemSizeBreakup, type SizeBreakupLine } from '@/services/order.service';
import { logError } from '@/lib/logger';

interface SizeOption {
  id: string;
  sizeName: string;
}

interface ColorOption {
  id: string;
  colorName: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderItemId: string;
  styleId: string;
  currentTotal: number;
  onSaved: () => void;
}

/**
 * Enter an order item's size breakdown after the order was created without one.
 *
 * Orders are deliberately created sizeless so long-lead greige/dyeing/printing can be procured
 * first. This dialog fills the split in later and lets the backend cascade it: size-wise label
 * requirements switch from "size split pending" to real per-size lines, and production work
 * orders (impossible without sizes) get created.
 */
export function SizeBreakupDialog({ open, onOpenChange, orderId, orderItemId, styleId, currentTotal, onSaved }: Props) {
  const [sizes, setSizes] = useState<SizeOption[]>([]);
  const [colorCount, setColorCount] = useState(0);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setConfirmMessage(null);
    const loadSizes = async () => {
      try {
        setLoading(true);
        const style = await getStyleById(styleId);
        const styleAny = style as unknown as { sizeOptions?: SizeOption[]; colorOptions?: ColorOption[] };
        const styleSizes = (styleAny.sizeOptions ?? []).filter((s) => s.id);
        setSizes(styleSizes);
        // This dialog writes a size-only breakup (colorId null). That is valid and is what a
        // sizeless order needs, but if the style has colours the split is not colour-wise —
        // say so rather than letting the user assume otherwise.
        setColorCount((styleAny.colorOptions ?? []).length);
        setQuantities(Object.fromEntries(styleSizes.map((s) => [s.id, ''])));
      } catch (err) {
        logError('Failed to load style sizes', err);
        notify.error('Could not load this style’s sizes');
      } finally {
        setLoading(false);
      }
    };
    loadSizes();
  }, [open, styleId]);

  const enteredTotal = useMemo(
    () => Object.values(quantities).reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0),
    [quantities]
  );
  const differsFromOrder = enteredTotal > 0 && enteredTotal !== currentTotal;

  // Even split with largest-remainder, so the sizes always add up to the order total exactly
  const distributeEvenly = () => {
    if (sizes.length === 0) return;
    const per = Math.floor(currentTotal / sizes.length);
    const remainder = currentTotal % sizes.length;
    setQuantities(Object.fromEntries(sizes.map((s, i) => [s.id, String(per + (i < remainder ? 1 : 0))])));
    setConfirmMessage(null);
  };

  const save = async (confirmQuantityChange: boolean) => {
    const breakup: SizeBreakupLine[] = sizes
      .map((s) => ({ colorId: null, sizeId: s.id, quantity: parseInt(quantities[s.id] || '0', 10) || 0 }))
      .filter((b) => b.quantity > 0);

    if (breakup.length === 0) {
      notify.error('Enter a quantity for at least one size');
      return;
    }

    try {
      setSaving(true);
      const result = await setOrderItemSizeBreakup(orderId, orderItemId, breakup, confirmQuantityChange);
      const parts = [`Size breakdown saved (${result.newTotal} pcs)`];
      if (result.quantityChanged) parts.push(`order quantity updated to ${result.newTotal}`);
      if (result.requirements) {
        parts.push(`${result.requirements.created + result.requirements.updated} material requirements refreshed`);
      }
      if (result.workOrders && result.workOrders.created.length > 0) {
        parts.push(`${result.workOrders.created.length} work order(s) created`);
      }
      notify.success(parts.join(' • '));
      // The breakup itself is saved; these steps run after it and can fail independently.
      if (result.mrpError) {
        notify.error(
          `Size breakdown saved, but recalculating requirements failed: ${result.mrpError}. Re-run MRP from the order BOM page.`
        );
      }
      if (result.workOrderError) {
        notify.error(`Size breakdown saved, but work order creation failed: ${result.workOrderError}`);
      }
      if (result.workOrders && result.workOrders.failed.length > 0) {
        notify.error(`Some work orders could not be created: ${result.workOrders.failed[0].reason}`);
      }
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string; details?: { code?: string } } } };
      const body = axiosError.response?.data;
      if (body?.details?.code === 'QUANTITY_CHANGE_REQUIRES_CONFIRMATION') {
        // Backend refused because the total would move — show exactly what it warned about
        setConfirmMessage(body.message || 'These sizes change the order quantity.');
      } else {
        notify.error(body?.message || 'Failed to save the size breakdown');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Size Breakdown</DialogTitle>
          <DialogDescription>
            This order item carries {currentTotal} pcs with no size split. Entering the sizes generates per-size label
            requirements and lets production work orders be created.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading sizes…</p>
        ) : sizes.length === 0 ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This style has no sizes defined. Add sizes to the style first, then return here.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" size="sm" onClick={distributeEvenly} disabled={saving}>
                Distribute {currentTotal} evenly
              </Button>
              <div className="text-sm">
                Entered:{' '}
                <span className={differsFromOrder ? 'font-semibold text-warning' : 'font-semibold text-success'}>
                  {enteredTotal}
                </span>{' '}
                / {currentTotal} pcs
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
              {sizes.map((s) => (
                <div key={s.id}>
                  <Label htmlFor={`size-${s.id}`} className="text-xs">
                    {s.sizeName}
                  </Label>
                  <Input
                    id={`size-${s.id}`}
                    type="number"
                    min="0"
                    value={quantities[s.id] ?? ''}
                    onChange={(e) => {
                      setQuantities((q) => ({ ...q, [s.id]: e.target.value }));
                      setConfirmMessage(null);
                    }}
                    disabled={saving}
                  />
                </div>
              ))}
            </div>

            {colorCount > 1 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This style has {colorCount} colours. These quantities are recorded per size only, not split by colour
                  — use the order edit screen if you need a colour-wise split.
                </AlertDescription>
              </Alert>
            )}

            {confirmMessage && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{confirmMessage}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          {confirmMessage ? (
            <Button onClick={() => save(true)} disabled={saving}>
              {saving ? 'Saving…' : `Confirm & change quantity to ${enteredTotal}`}
            </Button>
          ) : (
            <Button onClick={() => save(false)} disabled={saving || sizes.length === 0 || enteredTotal === 0}>
              {saving ? 'Saving…' : 'Save Size Breakdown'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
