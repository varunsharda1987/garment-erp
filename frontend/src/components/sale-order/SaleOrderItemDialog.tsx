/**
 * SaleOrderItemDialog - Dialog for adding/editing sale order line items.
 * Supports single item (optional size) or size breakdown with absolute/percentage/ratio modes.
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Grid3X3 } from 'lucide-react';
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
import { SizeBreakdownDialog, type SizeBreakdownEntry } from './SizeBreakdownDialog';
import { getStyleById } from '@/services/style.service';
import type { SOItemInput } from '@/types/saleOrder.types';
import type { Style } from '@/types/style.types';

interface ColorOption {
  id: string;
  colorName: string;
  colorCode?: string | null;
  isActive?: boolean;
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

export interface SaleOrderItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: SOItemInput) => void;
  onSaveMultiple?: (items: SOItemInput[]) => void;
  editItem?: SOItemInput & {
    styleName?: string;
    colorName?: string;
    sizeName?: string;
  };
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
  const [breakdownDialogOpen, setBreakdownDialogOpen] = useState(false);

  const [colorOptions, setColorOptions] = useState<ColorOption[]>([]);
  const [sizeOptions, setSizeOptions] = useState<SizeOption[]>([]);

  // Fetch style details when styleId changes
  const { data: styleData, isLoading: isLoadingStyle } = useQuery({
    queryKey: ['style-detail', styleId],
    queryFn: () => getStyleById(styleId),
    enabled: !!styleId && open,
  });

  // Update options when style data loads
  useEffect(() => {
    if (styleData) {
      const style = styleData as StyleWithOptions;
      setColorOptions(style.colorOptions?.filter((c) => c.isActive !== false) || []);
      setSizeOptions(
        (style.sizeOptions?.filter((s) => s.isActive !== false) || []).sort(
          (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
        )
      );

      // Auto-fill unit price from style's selling price if available and not editing
      if (mode === 'create' && style.sellingPrice && !unitPrice) {
        setUnitPrice(String(style.sellingPrice));
      }
    }
  }, [styleData, mode, unitPrice]);

  // Populate form when editing
  useEffect(() => {
    if (open && editItem && mode === 'edit') {
      setStyleId(editItem.styleId);
      setColorId(editItem.colorId || null);
      setSizeId(editItem.sizeId || '');
      setQuantity(String(editItem.quantity));
      setUnitPrice(String(editItem.unitPrice));
    } else if (open && mode === 'create') {
      // Reset form for new item
      setStyleId('');
      setColorId(null);
      setSizeId('');
      setQuantity('1');
      setUnitPrice('');
      setColorOptions([]);
      setSizeOptions([]);
    }
  }, [open, editItem, mode]);

  const handleStyleChange = useCallback((id: string, style?: Style) => {
    setStyleId(id);
    // Reset dependent fields
    setColorId(null);
    setSizeId('');

    // Set selling price if available
    if (style?.sellingPrice) {
      setUnitPrice(String(style.sellingPrice));
    }
  }, []);

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

    const item: SOItemInput = {
      styleId,
      colorId: colorId || null,
      sizeId: sizeId || null,
      quantity: qty,
      unitPrice: price,
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

    const items: SOItemInput[] = entries.map((entry) => ({
      styleId,
      colorId: entry.colorId,
      sizeId: entry.sizeId,
      quantity: entry.quantity,
      unitPrice: price,
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
              <StyleCombobox
                value={styleId}
                onChange={handleStyleChange}
                placeholder="Search by style code..."
                status={null}
              />
              {isLoadingStyle && <p className="text-xs text-muted-foreground">Loading style options...</p>}
            </div>

            {/* Color Selection (optional) */}
            <div className="space-y-2">
              <Label>Color</Label>
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
              {styleId && colorOptions.length === 0 && !isLoadingStyle && (
                <p className="text-xs text-muted-foreground">No colors defined for this style</p>
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
