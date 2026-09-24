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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  /** The split already saved — the dialog opens on it for editing instead of blank boxes. */
  initialBreakup?: Array<{ colorId: string | null; sizeId: string; quantity: number }>;
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
export function SizeBreakupDialog({
  open,
  onOpenChange,
  orderId,
  orderItemId,
  styleId,
  currentTotal,
  initialBreakup,
  onSaved,
}: Props) {
  const isEdit = (initialBreakup?.length ?? 0) > 0;
  const [sizes, setSizes] = useState<SizeOption[]>([]);
  const [colours, setColours] = useState<ColorOption[]>([]);
  const [colorId, setColorId] = useState<string>('');
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
        // Sizes are saved WITH the style's colour: a size line without one reaches cutting but
        // stitching output refuses it, so the goods never become finished stock (2026-09-24).
        const styleColours = (styleAny.colorOptions ?? []).filter((c) => c.id);
        setColours(styleColours);
        const savedColour = initialBreakup?.find((b) => b.colorId)?.colorId;
        setColorId(
          styleColours.length === 1
            ? styleColours[0].id
            : savedColour && styleColours.some((c) => c.id === savedColour)
              ? savedColour
              : ''
        );
        setQuantities(
          Object.fromEntries(
            styleSizes.map((s) => {
              const saved = (initialBreakup ?? [])
                .filter((b) => b.sizeId === s.id)
                .reduce((sum, b) => sum + b.quantity, 0);
              return [s.id, saved > 0 ? String(saved) : ''];
            })
          )
        );
      } catch (err) {
        logError('Failed to load style sizes', err);
        notify.error('Could not load this style’s sizes');
      } finally {
        setLoading(false);
      }
    };
    loadSizes();
  }, [open, styleId, initialBreakup]);

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
      .map((s) => ({ colorId: colorId || null, sizeId: s.id, quantity: parseInt(quantities[s.id] || '0', 10) || 0 }))
      .filter((b) => b.quantity > 0);

    if (breakup.length === 0) {
      notify.error('Enter a quantity for at least one size');
      return;
    }
    if (colours.length > 0 && !colorId) {
      notify.error('Choose the colour for these sizes');
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
          <DialogTitle>{isEdit ? 'Edit Size Breakdown' : 'Add Size Breakdown'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `This order item carries ${currentTotal} pcs. Saving a new split updates the size-wise label requirements and the pending production run.`
              : `This order item carries ${currentTotal} pcs with no size split. Entering the sizes generates per-size label requirements and lets production work orders be created.`}
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

            {colours.length === 0 ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This style has no colour yet. Set the style&apos;s Primary Color first — production needs a colour for
                  every size.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="size-breakup-colour" className="text-xs">
                  Colour *
                </Label>
                <Select value={colorId} onValueChange={setColorId} disabled={saving || colours.length === 1}>
                  <SelectTrigger id="size-breakup-colour">
                    <SelectValue placeholder="Choose the colour" />
                  </SelectTrigger>
                  <SelectContent>
                    {colours.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.colorName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            <Button
              onClick={() => save(false)}
              disabled={saving || sizes.length === 0 || enteredTotal === 0 || colours.length === 0 || !colorId}
            >
              {saving ? 'Saving…' : 'Save Size Breakdown'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
