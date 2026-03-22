// Split Production Modal - Split a work order for partial dispatch
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import workOrderService from '../services/workOrder.service';
import type { WorkOrder, SplitWorkOrderDTO } from '../types/production.types';

interface SplitProductionModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: WorkOrder;
  onSplitComplete: () => void;
}

interface BreakupEntry {
  colorId: string | null;
  colorName: string;
  sizeId: string;
  sizeName: string;
  availableQuantity: number;
  splitQuantity: number;
}

export default function SplitProductionModal({
  isOpen,
  onClose,
  workOrder,
  onSplitComplete,
}: SplitProductionModalProps) {
  const [breakupEntries, setBreakupEntries] = useState<BreakupEntry[]>([]);
  const [plannedDispatchDate, setPlannedDispatchDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workOrder?.workOrderBreakup) {
      // Initialize breakup entries from work order
      const entries = workOrder.workOrderBreakup.map((b) => ({
        colorId: b.colorId,
        colorName: b.colorOptions?.colorName || (b.colorId === null ? '-' : 'N/A'),
        sizeId: b.sizeId,
        sizeName: b.sizeOptions?.sizeName || 'N/A',
        availableQuantity: b.plannedQuantity - b.completedQuantity,
        splitQuantity: 0,
      }));
      setBreakupEntries(entries);
    }

    // Set default dispatch date to one week from today
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    setPlannedDispatchDate(defaultDate.toISOString().split('T')[0]);
  }, [workOrder]);

  const handleQuantityChange = (index: number, value: string) => {
    const qty = parseInt(value) || 0;
    setBreakupEntries((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        splitQuantity: Math.min(qty, updated[index].availableQuantity),
      };
      return updated;
    });
  };

  const getTotalSplitQuantity = () => {
    return breakupEntries.reduce((sum, e) => sum + e.splitQuantity, 0);
  };

  const handleSubmit = async () => {
    setError(null);

    // Validation
    const totalSplit = getTotalSplitQuantity();
    if (totalSplit === 0) {
      setError('Please enter quantities to split');
      return;
    }

    if (!plannedDispatchDate) {
      setError('Please select a planned dispatch date');
      return;
    }

    try {
      setIsSubmitting(true);

      const splitData: SplitWorkOrderDTO = {
        plannedDispatchDate: new Date(plannedDispatchDate),
        breakupToSplit: breakupEntries
          .filter((e) => e.splitQuantity > 0)
          .map((e) => ({
            colorId: e.colorId,
            sizeId: e.sizeId,
            quantity: e.splitQuantity,
          })),
        remarks: remarks || undefined,
      };

      await workOrderService.splitWorkOrder(workOrder.id, splitData);
      onSplitComplete();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to split production run');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Split Production Run</DialogTitle>
          <DialogDescription>
            Split {workOrder.workOrderNumber} for partial dispatch. Select the quantities to move to a new production
            run.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {/* Current Work Order Info */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-gray-500">Style:</span>{' '}
                <span className="font-medium">
                  {workOrder.styles?.styleCode} - {workOrder.styles?.styleName}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Total Qty:</span>{' '}
                <span className="font-medium">{workOrder.totalQuantity} pcs</span>
              </div>
            </div>
          </div>

          {/* Dispatch Date */}
          <div>
            <Label htmlFor="dispatchDate">Planned Dispatch Date for New Run *</Label>
            <Input
              id="dispatchDate"
              type="date"
              value={plannedDispatchDate}
              onChange={(e) => setPlannedDispatchDate(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Color/Size Quantity Table */}
          <div>
            <Label>Select Quantities to Split</Label>
            <div className="border rounded-lg mt-2 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Color</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Available</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Split Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {breakupEntries.map((entry, index) => (
                    <tr key={`${entry.colorId}-${entry.sizeId}`} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm">{entry.colorName}</td>
                      <td className="px-4 py-2 text-sm">{entry.sizeName}</td>
                      <td className="px-4 py-2 text-sm text-right font-medium">{entry.availableQuantity}</td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          min={0}
                          max={entry.availableQuantity}
                          value={entry.splitQuantity || ''}
                          onChange={(e) => handleQuantityChange(index, e.target.value)}
                          className="w-20 text-right ml-auto"
                          disabled={entry.availableQuantity === 0}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-right font-medium">
                      Total to Split:
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-blue-600">{getTotalSplitQuantity()} pcs</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Summary */}
          {getTotalSplitQuantity() > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <div className="font-medium text-blue-900 mb-1">Split Summary</div>
              <div className="text-blue-700">
                Moving <strong>{getTotalSplitQuantity()}</strong> pieces to a new production run with dispatch date{' '}
                <strong>{new Date(plannedDispatchDate).toLocaleDateString()}</strong>
              </div>
              <div className="text-blue-600 mt-1">
                Remaining in {workOrder.workOrderNumber}:{' '}
                <strong>{workOrder.totalQuantity - getTotalSplitQuantity()}</strong> pieces
              </div>
            </div>
          )}

          {/* Remarks */}
          <div>
            <Label htmlFor="remarks">Remarks (Optional)</Label>
            <Input
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Reason for split, special instructions..."
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || getTotalSplitQuantity() === 0}>
            {isSubmitting ? 'Splitting...' : 'Split Production Run'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
