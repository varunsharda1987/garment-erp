/**
 * SaleOrderItemDialog - Dialog for adding/editing sale order line items.
 * Supports single item (optional size) or size breakdown with absolute/percentage/ratio modes.
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Grid3X3, Loader2 } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StyleCombobox } from '@/components/StyleCombobox';
import { ColorCombobox } from '@/components/ColorCombobox';
import { SizeBreakdownDialog, type SizeBreakdownEntry } from './SizeBreakdownDialog';
import { getStyleById, updateStyle } from '@/services/style.service';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/api-error-handler';
import type { SOItemInput } from '@/types/saleOrder.types';
import type { Style } from '@/types/style.types';
import { compareSizes } from '@/utils/sku-generator';
import { styleSeasonLabel } from './sale-order-lines';

interface ColorOption {
  id: string;
  colorName: string;
  colorCode?: string | null;
  isActive?: boolean;
  /** The catalogue colour this colourway mirrors — matches the style's own `colorId`. */
  colorMasterId?: string | null;
}

interface SizeOption {
  id: string;
  sizeName: string;
  sizeCode?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

interface StyleWithOptions extends Style {
  colorOptions?: ColorOption[];
  sizeOptions?: SizeOption[];
}

/**
 * A line plus the labels to show for it. The payload the API needs is only ids, but the table
 * renders names — when the dialog emitted ids alone, a freshly added row showed a truncated UUID
 * for the style and an edited row kept the labels of whatever it used to be until the page
 * reloaded. The label keys are always present (possibly undefined) so a spread overwrites stale
 * values rather than leaving them behind.
 */
export interface SOItemDraft extends SOItemInput {
  styleCode?: string;
  styleName?: string;
  colorName?: string;
  sizeName?: string;
  /** The style's season (WT26) for the items table's Season column — a sale order has none of its own. */
  seasonLabel?: string | null;
}

export interface SaleOrderItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: SOItemDraft) => void;
  onSaveMultiple?: (items: SOItemDraft[]) => void;
  editItem?: SOItemDraft;
  mode?: 'create' | 'edit';
}

export function SaleOrderItemDialog({
  open,
  onOpenChange,
  onSave,
  onSaveMultiple,
  editItem,
  mode = 'create',
}: SaleOrderItemDialogProps) {
  const [styleId, setStyleId] = useState('');
  const [colorId, setColorId] = useState<string | null>(null);
  const [sizeId, setSizeId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [buyerStyleRef, setBuyerStyleRef] = useState('');
  const [breakdownDialogOpen, setBreakdownDialogOpen] = useState(false);

  const [colorOptions, setColorOptions] = useState<ColorOption[]>([]);
  const [sizeOptions, setSizeOptions] = useState<SizeOption[]>([]);

  // Colour the user has picked from the catalogue for a style that has none yet, held until they
  // press "Set as style colour". Deliberately NOT written on selection: syncStyleColourway never
  // deletes a colourway, so firing on every keystroke of browsing would leave a permanent trail of
  // colourways behind on the style.
  const [pendingColorMasterId, setPendingColorMasterId] = useState('');
  const [isSettingStyleColour, setIsSettingStyleColour] = useState(false);

  const queryClient = useQueryClient();
  const { can } = usePermissions();

  // Fetch style details when styleId changes
  const {
    data: styleData,
    isLoading: isLoadingStyle,
    refetch: refetchStyle,
  } = useQuery({
    queryKey: ['style-detail', styleId],
    queryFn: () => getStyleById(styleId),
    enabled: !!styleId && open,
  });

  /** A style is picked, it has loaded, and it has no colourway to offer. */
  const needsStyleColour = Boolean(styleId) && colorOptions.length === 0 && !isLoadingStyle;

  // Update options when style data loads.
  // Deliberately NOT keyed on `unitPrice`: it used to be, so clearing the price field re-ran this
  // effect and immediately refilled the style's selling price — the field snapped back and typing
  // appended to the restored value instead of replacing it.
  useEffect(() => {
    if (!styleData) return;
    const style = styleData as StyleWithOptions;
    const colors = style.colorOptions?.filter((c) => c.isActive !== false) || [];
    setColorOptions(colors);
    // The style's sizes are the ones its Style Form defines — a size unchecked there is inactive.
    // Editing a line whose size the style has since dropped still offers that size, or the Select
    // would show blank for a line that plainly has one.
    const keepSizeId = mode === 'edit' ? editItem?.sizeId : undefined;
    setSizeOptions(
      (style.sizeOptions?.filter((s) => s.isActive !== false || s.id === keepSizeId) || []).sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || compareSizes(a.sizeName, b.sizeName)
      )
    );

    // A style IS one colourway here (the code carries it — LNG182P is the pink one), so the line's
    // colour is the style's Primary Color. Preselect it rather than making the user restate what
    // picking the style already said; a style whose colour was changed keeps its older colourways,
    // and the primary one is whichever mirrors `styles.colorId`.
    //
    // The `colorMasterId` match only finds colourways written by style-colour.helper.ts. Rows that
    // predate it carry a NULL colorMasterId and could never preselect, leaving the field blank on a
    // style that plainly has one colour — so fall back to the sole colourway, which is exactly what
    // "one colour per style" means.
    if (mode === 'create') {
      const primary =
        (style.colorId ? colors.find((c) => c.colorMasterId === style.colorId) : undefined) ??
        (colors.length === 1 ? colors[0] : undefined);
      if (primary) setColorId((prev) => prev ?? primary.id);
    }

    // Auto-fill unit price from style's selling price if available and not editing
    if (mode === 'create' && style.sellingPrice) {
      setUnitPrice((prev) => prev || String(style.sellingPrice));
    }

    // Show the style's current buyer code so the user can see — and correct — what will be
    // recorded against this line.
    if (mode === 'create' && style.buyerStyleRef) {
      setBuyerStyleRef((prev) => prev || style.buyerStyleRef || '');
    }
  }, [styleData, mode, editItem?.sizeId]);

  // Populate form when editing
  useEffect(() => {
    if (open && editItem && mode === 'edit') {
      setStyleId(editItem.styleId);
      setColorId(editItem.colorId || null);
      setSizeId(editItem.sizeId || '');
      setQuantity(String(editItem.quantity));
      setUnitPrice(String(editItem.unitPrice));
      setBuyerStyleRef(editItem.buyerStyleRef || '');
    } else if (open && mode === 'create') {
      // Reset form for new item
      setStyleId('');
      setColorId(null);
      setSizeId('');
      setQuantity('1');
      setUnitPrice('');
      setBuyerStyleRef('');
      setColorOptions([]);
      setSizeOptions([]);
      setPendingColorMasterId('');
    }
  }, [open, editItem, mode]);

  const handleStyleChange = useCallback((id: string, style?: Style) => {
    setStyleId(id);
    // Reset dependent fields
    setColorId(null);
    setSizeId('');
    // A colour half-picked for the previous style must not carry over to this one.
    setPendingColorMasterId('');

    // Set selling price if available
    if (style?.sellingPrice) {
      setUnitPrice(String(style.sellingPrice));
    }
    // Picking a different style replaces the buyer code outright — the old one belonged to the
    // style that was just swapped out.
    setBuyerStyleRef(style?.buyerStyleRef || '');
  }, []);

  /**
   * Give a colourless style its colour, without leaving the order.
   *
   * 1,101 of 1,130 styles arrived through the bulk importer, which writes `styles` straight through
   * Prisma and never sets `colorId` — so `syncStyleColourway` never ran for them and they have no
   * colourway at all. The dialog used to state that as a dead end ("No colors defined for this
   * style") and the line saved with `colorId: null`, which is why the Sale Order's Color column
   * read "N/A".
   *
   * This writes the STYLE's Primary Color, not something order-local: `PUT /styles/:id` mirrors it
   * into `color_options` through the single-writer helper in one transaction, so cutting, stock,
   * dispatch and samples all see the same colour afterwards. A partial body is safe — every
   * relation block in `updateWithRelations` is `!== undefined`-guarded.
   */
  const handleSetStyleColour = async () => {
    if (!styleId || !pendingColorMasterId) return;
    setIsSettingStyleColour(true);
    try {
      await updateStyle(styleId, { colorId: pendingColorMasterId });

      // The style update response carries `color` but NOT `color_options`, so the new colourway's
      // id can only come from a re-read. It must be awaited: the line needs `color_options.id`
      // (a uuid), never the `color_master.id` (a cuid) the user just picked — the sale-order item
      // schema validates colorId as a uuid and would 400 on the master id.
      queryClient.removeQueries({ queryKey: ['style-detail', styleId] });
      const { data: fresh } = await refetchStyle();
      const colourways = (fresh as StyleWithOptions | undefined)?.colorOptions ?? [];
      const created = colourways.find((c) => c.colorMasterId === pendingColorMasterId);

      if (!created) {
        toast.error('Colour saved on the style, but its colourway could not be read back — reopen this dialog.');
        return;
      }

      setColorId(created.id);
      setPendingColorMasterId('');
      // The style master changed, so any style list showing colour is now stale.
      queryClient.invalidateQueries({ queryKey: ['styles'] });
      toast.success(`${created.colorName} is now this style's colour`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSettingStyleColour(false);
    }
  };

  const handleSave = () => {
    if (!styleId) {
      toast.error('Please select a style');
      return;
    }
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }
    const price = parseFloat(unitPrice);
    if (isNaN(price) || price < 0) {
      toast.error('Please enter a valid unit price');
      return;
    }

    const style = styleData as StyleWithOptions | undefined;

    const item: SOItemDraft = {
      styleId,
      colorId: colorId || null,
      sizeId: sizeId || null,
      quantity: qty,
      unitPrice: price,
      buyerStyleRef: buyerStyleRef.trim() || null,
      styleCode: style?.styleCode,
      styleName: style?.styleName,
      colorName: colorOptions.find((c) => c.id === colorId)?.colorName,
      sizeName: sizeOptions.find((s) => s.id === sizeId)?.sizeName,
      seasonLabel: styleSeasonLabel(style),
    };

    onSave(item);
    onOpenChange(false);
  };

  const handleSizeBreakdownSave = (entries: SizeBreakdownEntry[]) => {
    const price = parseFloat(unitPrice);
    if (isNaN(price) || price < 0) {
      toast.error('Please enter a valid unit price first');
      return;
    }

    const style = styleData as StyleWithOptions | undefined;

    const items: SOItemDraft[] = entries.map((entry) => ({
      styleId,
      colorId: entry.colorId,
      sizeId: entry.sizeId,
      quantity: entry.quantity,
      unitPrice: price,
      buyerStyleRef: buyerStyleRef.trim() || null,
      styleCode: style?.styleCode,
      styleName: style?.styleName,
      colorName: entry.colorName,
      sizeName: entry.sizeName,
      seasonLabel: styleSeasonLabel(style),
    }));

    if (onSaveMultiple) {
      onSaveMultiple(items);
    } else {
      // Fallback: save items one by one
      items.forEach((item) => onSave(item));
    }
    onOpenChange(false);
  };

  const canOpenBreakdown = styleId && sizeOptions.length > 0 && parseInt(quantity, 10) > 0 && unitPrice;

  const totalPrice = (() => {
    const qty = parseInt(quantity, 10) || 0;
    const price = parseFloat(unitPrice) || 0;
    return qty * price;
  })();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{mode === 'edit' ? 'Edit Item' : 'Add Item'}</DialogTitle>
            <DialogDescription>
              {mode === 'edit'
                ? 'Update the item details for this sale order.'
                : 'Add item(s) to the sale order. Use "Size Breakdown" for multiple sizes.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Style Selection */}
            <div className="space-y-2">
              <Label>
                Style <span className="text-destructive">*</span>
              </Label>
              {/* Published styles only — a draft has to be published in Styles before it can be sold */}
              <StyleCombobox value={styleId} onChange={handleStyleChange} placeholder="Search by style code..." />
              {isLoadingStyle && <p className="text-xs text-muted-foreground">Loading style options...</p>}
            </div>

            {/* Buyer's own style code, recorded against this line */}
            <div className="space-y-2">
              <Label>Buyer Style Ref</Label>
              <Input
                value={buyerStyleRef}
                onChange={(e) => setBuyerStyleRef(e.target.value)}
                placeholder="The buyer's code for this style"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                Saved with this line, so the order and its invoices keep showing this code even if the style is re-coded
                later.
              </p>
            </div>

            {/* Color Selection (optional) */}
            <div className="space-y-2">
              <Label>Color</Label>
              {needsStyleColour ? (
                /*
                 * The style has no colourway yet, so there is nothing to choose from. Rather than
                 * saying so and stopping — which left the line colourless and the order's Color
                 * column reading "N/A" — offer the colour catalogue and set it ON THE STYLE.
                 * Mounted only in this branch so the 200-row colour fetch never fires for a style
                 * that already has its colour.
                 */
                <div className="space-y-2 rounded-md border border-dashed p-3">
                  <p className="text-sm">This style has no colour yet.</p>
                  {can('styles') ? (
                    <>
                      <ColorCombobox
                        value={pendingColorMasterId}
                        onValueChange={(v) => setPendingColorMasterId(v)}
                        placeholder="Pick this style's colour..."
                        disabled={isSettingStyleColour}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSetStyleColour}
                        disabled={!pendingColorMasterId || isSettingStyleColour}
                      >
                        {isSettingStyleColour && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                        Set as style colour
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Saved as the style's Primary Color, so cutting, stock and dispatch all see it — not just this
                        order. A style has one colour, and an existing one is never replaced.
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Ask an administrator to set this style's Primary Color.
                    </p>
                  )}
                </div>
              ) : (
                <Select value={colorId || 'none'} onValueChange={(v) => setColorId(v === 'none' ? null : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select color (optional)" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    <SelectItem value="none">No color / Any</SelectItem>
                    {colorOptions.map((color) => (
                      <SelectItem key={color.id} value={color.id}>
                        {color.colorName}
                        {color.colorCode && ` (${color.colorCode})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Size Selection (optional - or use breakdown) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Size</Label>
                {mode === 'create' && sizeOptions.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setBreakdownDialogOpen(true)}
                    disabled={!canOpenBreakdown}
                    className="gap-1 h-7 text-xs"
                  >
                    <Grid3X3 className="h-3 w-3" />
                    Size Breakdown
                  </Button>
                )}
              </div>
              <Select value={sizeId || 'none'} onValueChange={(v) => setSizeId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select size (optional)" />
                </SelectTrigger>
                <SelectContent className="z-[9999]">
                  <SelectItem value="none">Size to be decided</SelectItem>
                  {sizeOptions.map((size) => (
                    <SelectItem key={size.id} value={size.id}>
                      {size.sizeName}
                      {size.sizeCode && size.sizeCode !== size.sizeName && ` (${size.sizeCode})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {styleId && sizeOptions.length === 0 && !isLoadingStyle
                  ? 'No sizes defined for this style'
                  : mode === 'create' && sizeOptions.length > 1
                    ? 'Select a single size, or use "Size Breakdown" for multiple sizes'
                    : 'Size breakdown can be specified when creating the Production Order'}
              </p>
            </div>

            {/* Quantity and Unit Price */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  Quantity <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="1"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Unit Price <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Total Preview */}
            {totalPrice > 0 && (
              <div className="p-3 bg-muted rounded-md text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Line Total:</span>
                  <span className="font-medium">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalPrice)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!styleId || !quantity || !unitPrice}>
              {mode === 'edit' ? 'Update Item' : 'Add Single Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Size Breakdown Dialog */}
      <SizeBreakdownDialog
        open={breakdownDialogOpen}
        onOpenChange={setBreakdownDialogOpen}
        styleId={styleId}
        colorId={colorId}
        totalQuantity={parseInt(quantity, 10) || 0}
        unitPrice={parseFloat(unitPrice) || 0}
        onSave={handleSizeBreakdownSave}
      />
    </>
  );
}

export default SaleOrderItemDialog;
