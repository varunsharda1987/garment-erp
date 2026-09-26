import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CADSizeBreakdown, CADSizeOption } from '@/types/cad-planning.types';

/**
 * Enter how many pieces of each size one marker lays. Used by the CAD spreadsheet row and by Correct CAD.
 */
export function SizeBreakdownPopup({
  isOpen,
  onClose,
  sizeOptions = [],
  currentBreakdowns = [],
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  sizeOptions: CADSizeOption[];
  currentBreakdowns: CADSizeBreakdown[];
  onSave: (breakdowns: CADSizeBreakdown[]) => void;
}) {
  const [breakdowns, setBreakdowns] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    (currentBreakdowns || []).forEach((b) => {
      initial[b.sizeName] = b.quantity;
    });
    return initial;
  });

  const handleQuantityChange = (sizeName: string, value: string) => {
    const qty = parseInt(value) || 0;
    setBreakdowns((prev) => ({
      ...prev,
      [sizeName]: qty,
    }));
  };

  const handleIncrement = (sizeName: string, delta: number) => {
    setBreakdowns((prev) => {
      const current = prev[sizeName] || 0;
      const newQty = Math.max(0, current + delta);
      return {
        ...prev,
        [sizeName]: newQty,
      };
    });
  };

  const handleIncrementAll = () => {
    const safeSizeOptions = sizeOptions || [];
    setBreakdowns((prev) => {
      const newBreakdowns: Record<string, number> = { ...prev };
      safeSizeOptions.forEach((size) => {
        newBreakdowns[size.name] = (newBreakdowns[size.name] || 0) + 1;
      });
      return newBreakdowns;
    });
  };

  const handleClearAll = () => {
    const safeSizeOptions = sizeOptions || [];
    const newBreakdowns: Record<string, number> = {};
    safeSizeOptions.forEach((size) => {
      newBreakdowns[size.name] = 0;
    });
    setBreakdowns(newBreakdowns);
  };

  const handleSave = () => {
    const result: CADSizeBreakdown[] = Object.entries(breakdowns)
      .filter(([, qty]) => qty > 0)
      .map(([sizeName, quantity]) => {
        const sizeOpt = (sizeOptions || []).find((s) => s.name === sizeName);
        return {
          sizeName,
          sizeId: sizeOpt?.id || null,
          quantity,
        };
      });
    onSave(result);
    onClose();
  };

  const totalPieces = Object.values(breakdowns).reduce((sum, qty) => sum + qty, 0);

  // Ensure sizeOptions is always an array
  const safeSizeOptions = sizeOptions || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Size Breakdown</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-4">
          {safeSizeOptions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No size options available. Please add sizes to the style first.
            </p>
          ) : (
            <>
              {/* Apply All Section */}
              <div className="flex items-center gap-2 pb-3 border-b">
                <Label className="text-sm font-medium whitespace-nowrap">Apply to all:</Label>
                <Button type="button" size="sm" variant="secondary" onClick={handleIncrementAll} className="px-4">
                  + Add 1 to all
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleClearAll}
                  className="text-muted-foreground"
                >
                  Clear
                </Button>
              </div>

              {/* Size Rows with Increment/Decrement Buttons */}
              {safeSizeOptions.map((size) => (
                <div key={size.id} className="flex items-center gap-2">
                  <Label className="w-16 text-right font-medium">{size.name}</Label>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => handleIncrement(size.name, -1)}
                      disabled={(breakdowns[size.name] || 0) < 1}
                    >
                      -
                    </Button>
                    <Input
                      type="number"
                      min={0}
                      value={breakdowns[size.name] || ''}
                      onChange={(e) => handleQuantityChange(size.name, e.target.value)}
                      className="w-20 h-8 text-center"
                      placeholder="0"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => handleIncrement(size.name, 1)}
                    >
                      +
                    </Button>
                  </div>
                  <span className="text-muted-foreground text-sm">pcs</span>
                </div>
              ))}
            </>
          )}
          <div className="border-t pt-3 flex justify-between items-center">
            <span className="font-medium">Total Pieces:</span>
            <Badge variant="secondary" className="text-lg">
              {totalPieces}
            </Badge>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
