/**
 * EditStockModal Component
 * Modal for editing fabric stock records (prices, quality grade, warehouse info)
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { fabricStockService } from '../../services/fabricStockService';
import { formatCurrency } from '@/lib/currency';
import { AlertTriangle } from 'lucide-react';

// Type definition for stock update data
interface UpdateStockData {
  purchaseCost?: number;
  weightedAvgCost?: number;
  qualityGrade?: 'A' | 'B' | 'DEFECT';
  warehouseLocation?: string;
  rackNumber?: string;
  rollNumbers?: string;
}

export interface EditStockModalProps {
  isOpen: boolean;
  stockId: string;
  currentData: {
    fabricCode: string;
    fabricName: string;
    colorName?: string;
    quantityAvailable: number;
    purchaseCost: number;
    weightedAvgCost: number;
    qualityGrade: 'A' | 'B' | 'DEFECT';
    warehouseLocation?: string;
    rackNumber?: string;
    rollNumbers?: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export const EditStockModal: React.FC<EditStockModalProps> = ({ isOpen, stockId, currentData, onClose, onSuccess }) => {
  const [formData, setFormData] = useState<UpdateStockData>({
    purchaseCost: currentData.purchaseCost,
    weightedAvgCost: currentData.weightedAvgCost,
    qualityGrade: currentData.qualityGrade,
    warehouseLocation: currentData.warehouseLocation || '',
    rackNumber: currentData.rackNumber || '',
    rollNumbers: currentData.rollNumbers || '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset form when modal opens with new data
  useEffect(() => {
    if (isOpen) {
      setFormData({
        purchaseCost: currentData.purchaseCost,
        weightedAvgCost: currentData.weightedAvgCost,
        qualityGrade: currentData.qualityGrade,
        warehouseLocation: currentData.warehouseLocation || '',
        rackNumber: currentData.rackNumber || '',
        rollNumbers: currentData.rollNumbers || '',
      });
      setHasChanges(false);
    }
  }, [isOpen, currentData]);

  // Check if form has changes
  useEffect(() => {
    const changed =
      formData.purchaseCost !== currentData.purchaseCost ||
      formData.weightedAvgCost !== currentData.weightedAvgCost ||
      formData.qualityGrade !== currentData.qualityGrade ||
      (formData.warehouseLocation || '') !== (currentData.warehouseLocation || '') ||
      (formData.rackNumber || '') !== (currentData.rackNumber || '') ||
      (formData.rollNumbers || '') !== (currentData.rollNumbers || '');

    setHasChanges(changed);
  }, [formData, currentData]);

  const handleFieldChange = (field: keyof UpdateStockData, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Calculate total value preview
  const totalValue = currentData.quantityAvailable * (formData.purchaseCost || 0);
  const oldTotalValue = currentData.quantityAvailable * currentData.purchaseCost;

  // Check for large price changes (>100%)
  const priceChangePercent = formData.purchaseCost
    ? ((formData.purchaseCost - currentData.purchaseCost) / currentData.purchaseCost) * 100
    : 0;
  const hasLargePriceChange = Math.abs(priceChangePercent) > 100;

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      // Validate at least one field changed
      if (!hasChanges) {
        toast.error('No changes detected. Please modify at least one field.');
        return;
      }

      // Validate costs are non-negative
      if (formData.purchaseCost !== undefined && formData.purchaseCost < 0) {
        toast.error('Purchase cost cannot be negative');
        return;
      }

      if (formData.weightedAvgCost !== undefined && formData.weightedAvgCost < 0) {
        toast.error('Weighted average cost cannot be negative');
        return;
      }

      // Prepare update data (only send changed fields)
      const updateData: UpdateStockData = {};

      if (formData.purchaseCost !== currentData.purchaseCost) {
        updateData.purchaseCost = formData.purchaseCost;
      }
      if (formData.weightedAvgCost !== currentData.weightedAvgCost) {
        updateData.weightedAvgCost = formData.weightedAvgCost;
      }
      if (formData.qualityGrade !== currentData.qualityGrade) {
        updateData.qualityGrade = formData.qualityGrade;
      }
      if ((formData.warehouseLocation || '') !== (currentData.warehouseLocation || '')) {
        updateData.warehouseLocation = formData.warehouseLocation;
      }
      if ((formData.rackNumber || '') !== (currentData.rackNumber || '')) {
        updateData.rackNumber = formData.rackNumber;
      }
      if ((formData.rollNumbers || '') !== (currentData.rollNumbers || '')) {
        updateData.rollNumbers = formData.rollNumbers;
      }

      // Call API
      const response = await fabricStockService.updateStock(stockId, updateData);

      toast.success(response.message || 'Stock updated successfully');
      onSuccess();
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update stock';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Edit Fabric Stock</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Read-only Fabric Info */}
          <div className="bg-info-muted border border-info/20 rounded-lg p-4">
            <h3 className="font-medium text-foreground mb-2">Fabric Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Code:</span>
                <p className="font-medium">{currentData.fabricCode}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Name:</span>
                <p className="font-medium">{currentData.fabricName}</p>
              </div>
              {currentData.colorName && (
                <div>
                  <span className="text-muted-foreground">Color:</span>
                  <p className="font-medium">{currentData.colorName}</p>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Quantity:</span>
                <p className="font-medium">{currentData.quantityAvailable} meters</p>
              </div>
            </div>
          </div>

          {/* Editable Fields */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="purchaseCost">
                  Purchase Cost (₹ per meter) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="purchaseCost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.purchaseCost}
                  onChange={(e) => handleFieldChange('purchaseCost', parseFloat(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="weightedAvgCost">
                  Weighted Avg Cost (₹ per meter) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="weightedAvgCost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.weightedAvgCost}
                  onChange={(e) => handleFieldChange('weightedAvgCost', parseFloat(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="qualityGrade">Quality Grade</Label>
              <Select
                value={formData.qualityGrade}
                onValueChange={(value: 'A' | 'B' | 'DEFECT') => handleFieldChange('qualityGrade', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Grade A (Premium)</SelectItem>
                  <SelectItem value="B">Grade B (Standard)</SelectItem>
                  <SelectItem value="DEFECT">Defect (Rejected)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="warehouseLocation">Warehouse Location</Label>
                <Input
                  id="warehouseLocation"
                  type="text"
                  value={formData.warehouseLocation}
                  onChange={(e) => handleFieldChange('warehouseLocation', e.target.value)}
                  placeholder="e.g., Warehouse A"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="rackNumber">Rack Number</Label>
                <Input
                  id="rackNumber"
                  type="text"
                  value={formData.rackNumber}
                  onChange={(e) => handleFieldChange('rackNumber', e.target.value)}
                  placeholder="e.g., R-12-B3"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="rollNumbers">Roll Numbers</Label>
              <Input
                id="rollNumbers"
                type="text"
                value={formData.rollNumbers}
                onChange={(e) => handleFieldChange('rollNumbers', e.target.value)}
                placeholder="e.g., R001, R002, R003"
                className="mt-1"
              />
            </div>
          </div>

          {/* Value Preview */}
          {totalValue > 0 && (
            <div className="bg-muted border border-border rounded-lg p-4">
              <h3 className="font-medium text-foreground mb-2">Value Preview</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Current Total Value:</span>
                  <p className="font-medium">{formatCurrency(oldTotalValue)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">New Total Value:</span>
                  <p className="font-medium text-info">{formatCurrency(totalValue)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Large Price Change Warning */}
          {hasLargePriceChange && (
            <div className="bg-warning-muted border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
              <div className="text-sm text-yellow-800">
                <strong>Large Price Change Detected:</strong> Price is changing by {priceChangePercent.toFixed(0)}%.
                Please verify this is correct.
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!hasChanges || isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
