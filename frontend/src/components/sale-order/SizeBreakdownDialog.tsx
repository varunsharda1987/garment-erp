/**
 * SizeBreakdownDialog - Size quantity breakdown for Sale Order items.
 * Supports absolute, percentage, and ratio input modes.
 * Called when adding/editing an SO item to specify size-wise quantities.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
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
import { getStyleById } from '@/services/style.service';

interface SizeOption {
  id: string;
  sizeName: string;
  sizeCode?: string | null;
  sortOrder?: number;
}

interface ColorOption {
  id: string;
  colorName: string;
  colorCode?: string | null;
}

export interface SizeBreakdownEntry {
  colorId: string | null;
  sizeId: string;
  sizeName?: string;
  colorName?: string;
  quantity: number;
}

interface SizeBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  styleId: string;
  colorId?: string | null;
  totalQuantity: number;
  unitPrice: number;
  onSave: (entries: SizeBreakdownEntry[]) => void;
  existingBreakdown?: SizeBreakdownEntry[];
}

type QuantityMode = 'absolute' | 'percentage' | 'ratio';

export function SizeBreakdownDialog({
  open,
  onOpenChange,
  styleId,
  colorId,
  totalQuantity,
  unitPrice,
  onSave,
  existingBreakdown,
}: SizeBreakdownDialogProps) {
  const [quantityMode, setQuantityMode] = useState<QuantityMode>('absolute');
  const [distributionValues, setDistributionValues] = useState<Record<string, number>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Fetch style data for sizes
  const { data: styleData, isLoading } = useQuery({
    queryKey: ['style-detail', styleId],
    queryFn: () => getStyleById(styleId),
    enabled: !!styleId && open,
  });

  const sizes = useMemo(() => {
    if (!styleData) return [];
    const opts = (styleData as { sizeOptions?: SizeOption[] }).sizeOptions || [];
    return opts.filter((s) => s.id).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [styleData]);

  const colors = useMemo(() => {
    if (!styleData) return [];
    return ((styleData as { colorOptions?: ColorOption[] }).colorOptions || []).filter((c) => c.id);
  }, [styleData]);

  // Get the selected color name
  const selectedColor = useMemo(() => {
    if (!colorId) return null;
    return colors.find((c) => c.id === colorId) || null;
  }, [colorId, colors]);

  // Initialize quantities from existing breakdown or zeros
  useEffect(() => {
    if (!open || sizes.length === 0) return;

    const newQuantities: Record<string, number> = {};
    sizes.forEach((size) => {
      const key = size.id;
      const existing = existingBreakdown?.find((e) => e.sizeId === size.id);
      newQuantities[key] = existing?.quantity || 0;
    });
    setQuantities(newQuantities);
    setDistributionValues({});
    setQuantityMode('absolute');
  }, [open, sizes, existingBreakdown]);

  const currentTotal = useMemo(() => {
    return Object.values(quantities).reduce((sum, q) => sum + (q || 0), 0);
  }, [quantities]);

  const handleQuantityChange = (sizeId: string, value: string) => {
    const num = parseInt(value, 10) || 0;
    setQuantities((prev) => ({ ...prev, [sizeId]: Math.max(0, num) }));
  };

  const handleDistributionChange = (sizeId: string, value: string) => {
    const num = parseFloat(value) || 0;
    setDistributionValues((prev) => ({ ...prev, [sizeId]: Math.max(0, num) }));
  };

  // Apply distribution using largest remainder method
  const applyDistribution = useCallback(() => {
    if (totalQuantity <= 0 || sizes.length === 0) return;

    const total =
      quantityMode === 'percentage'
        ? Object.values(distributionValues).reduce((s, v) => s + v, 0) || 100
        : Object.values(distributionValues).reduce((s, v) => s + v, 0) || sizes.length;

    if (total === 0) return;

    // Calculate proportional quantities
    const proportions = sizes.map((size) => {
      const value = distributionValues[size.id] || 0;
      return {
        sizeId: size.id,
        proportion: value / total,
        exact: (value / total) * totalQuantity,
      };
    });

    // Integer part
    const integerParts = proportions.map((p) => ({
      ...p,
      integer: Math.floor(p.exact),
      remainder: p.exact - Math.floor(p.exact),
    }));

    // Distribute remainder using largest remainder method
    let remaining = totalQuantity - integerParts.reduce((s, p) => s + p.integer, 0);
    const sorted = [...integerParts].sort((a, b) => b.remainder - a.remainder);

    const newQuantities: Record<string, number> = {};
    integerParts.forEach((p) => {
      newQuantities[p.sizeId] = p.integer;
    });

    for (let i = 0; remaining > 0 && i < sorted.length; i++) {
      newQuantities[sorted[i].sizeId]++;
      remaining--;
    }

    setQuantities(newQuantities);
  }, [quantityMode, distributionValues, totalQuantity, sizes]);

  // Smart distribute: equal distribution
  const handleSmartDistribute = () => {
    if (sizes.length === 0 || totalQuantity <= 0) return;

    const perSize = Math.floor(totalQuantity / sizes.length);
    const remainder = totalQuantity % sizes.length;

    const newQuantities: Record<string, number> = {};
    sizes.forEach((size, index) => {
      newQuantities[size.id] = perSize + (index < remainder ? 1 : 0);
    });
    setQuantities(newQuantities);
  };

  const handleModeChange = (mode: QuantityMode) => {
    if (mode === 'absolute') {
      setDistributionValues({});
    } else if (quantityMode === 'absolute') {
      // Initialize with equal distribution
      const defaultValues: Record<string, number> = {};
      if (mode === 'percentage') {
        const perSize = sizes.length > 0 ? Math.floor(100 / sizes.length) : 0;
        sizes.forEach((size) => {
          defaultValues[size.id] = perSize;
        });
      } else {
        sizes.forEach((size) => {
          defaultValues[size.id] = 1;
        });
      }
      setDistributionValues(defaultValues);
    }
    setQuantityMode(mode);
  };

  const handleSave = () => {
    const entries: SizeBreakdownEntry[] = sizes
      .map((size) => ({
        colorId: colorId || null,
        sizeId: size.id,
        sizeName: size.sizeName,
        colorName: selectedColor?.colorName,
        quantity: quantities[size.id] || 0,
      }))
      .filter((e) => e.quantity > 0);

    onSave(entries);
    onOpenChange(false);
  };

  const isValid = currentTotal === totalQuantity && currentTotal > 0;
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Size Breakdown</DialogTitle>
          <DialogDescription>
            Distribute {totalQuantity} pcs across sizes
            {selectedColor && ` for ${selectedColor.colorName}`}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading sizes...</div>
        ) : sizes.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No sizes defined for this style. Add sizes in Style Master first.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Mode Toggle */}
            <div className="flex items-center gap-2">
              <Label className="text-sm">Input Mode:</Label>
              <div className="flex bg-muted rounded-lg p-1">
                {(['absolute', 'percentage', 'ratio'] as QuantityMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleModeChange(mode)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                      quantityMode === mode
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted-foreground/10'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              {quantityMode === 'absolute' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSmartDistribute}
                  className="ml-auto gap-1"
                >
                  <Sparkles className="h-4 w-4" />
                  Equal
                </Button>
              )}

              {quantityMode !== 'absolute' && (
                <Button type="button" size="sm" onClick={applyDistribution} className="ml-auto gap-1">
                  <Sparkles className="h-4 w-4" />
                  Calculate
                </Button>
              )}
            </div>

            {quantityMode !== 'absolute' && (
              <p className="text-xs text-muted-foreground">
                {quantityMode === 'percentage'
                  ? 'Enter percentage for each size. Click Calculate to distribute.'
                  : 'Enter ratio values (e.g., 1, 2, 3). Click Calculate to distribute.'}
              </p>
            )}

            {/* Size Grid */}
            <div className="border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 font-medium">Size</th>
                    {quantityMode !== 'absolute' && (
                      <th className="text-right p-2 font-medium w-24">
                        {quantityMode === 'percentage' ? '%' : 'Ratio'}
                      </th>
                    )}
                    <th className="text-right p-2 font-medium w-24">Qty</th>
                    <th className="text-right p-2 font-medium w-28">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {sizes.map((size) => (
                    <tr key={size.id} className="border-t">
                      <td className="p-2 font-medium">{size.sizeName}</td>
                      {quantityMode !== 'absolute' && (
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            step={quantityMode === 'percentage' ? '1' : '0.1'}
                            value={distributionValues[size.id] || ''}
                            onChange={(e) => handleDistributionChange(size.id, e.target.value)}
                            className="w-full text-right h-8"
                            placeholder="0"
                          />
                        </td>
                      )}
                      <td className="p-2">
                        <Input
                          type="number"
                          min="0"
                          value={quantities[size.id] || ''}
                          onChange={(e) => handleQuantityChange(size.id, e.target.value)}
                          className="w-full text-right h-8"
                          placeholder="0"
                          disabled={quantityMode !== 'absolute'}
                        />
                      </td>
                      <td className="p-2 text-right text-muted-foreground">
                        {formatCurrency((quantities[size.id] || 0) * unitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/30 font-medium">
                  <tr className="border-t">
                    <td className="p-2">Total</td>
                    {quantityMode !== 'absolute' && <td></td>}
                    <td className="p-2 text-right">{currentTotal}</td>
                    <td className="p-2 text-right">{formatCurrency(currentTotal * unitPrice)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Validation */}
            {currentTotal !== totalQuantity && (
              <p className={`text-sm ${currentTotal > totalQuantity ? 'text-destructive' : 'text-warning'}`}>
                {currentTotal > totalQuantity
                  ? `Over by ${currentTotal - totalQuantity} pcs`
                  : `${totalQuantity - currentTotal} pcs remaining to distribute`}
              </p>
            )}
            {currentTotal === totalQuantity && currentTotal > 0 && (
              <p className="text-sm text-success">All {totalQuantity} pcs distributed</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid}>
            Save Breakdown
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SizeBreakdownDialog;
