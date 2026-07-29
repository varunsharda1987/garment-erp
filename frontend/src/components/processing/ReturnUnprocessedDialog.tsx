// Return Unprocessed Dialog - Return fabric that couldn't be processed
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Undo } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { dyeProcessPOService } from '@/services/dyeing.service';
import { processPOService as printProcessPOService } from '@/services/printing.service';
import type { ProcessPO } from '@/types/printing.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

export type ProcessType = 'DYEING' | 'PRINTING';

interface ReturnUnprocessedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processPO: ProcessPO | null;
  processType: ProcessType;
  onSuccess?: () => void;
}

export default function ReturnUnprocessedDialog({
  open,
  onOpenChange,
  processPO,
  processType,
  onSuccess,
}: ReturnUnprocessedDialogProps) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  // Form state
  const [returnedQtyMeters, setReturnedQtyMeters] = useState<number>(0);
  const [returnDate, setReturnDate] = useState(today);
  const [remarks, setRemarks] = useState('');

  // Reset form when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && processPO) {
      // Default to full sent quantity
      setReturnedQtyMeters(Number(processPO.qtySentMeters));
      setReturnDate(today);
      setRemarks('');
    }
    onOpenChange(newOpen);
  };

  // Return mutation
  const returnMutation = useMutation({
    mutationFn: async () => {
      if (!processPO) throw new Error('No Process PO');
      const data = {
        returnedQtyMeters,
        returnDate,
        remarks: remarks || undefined,
      };
      if (processType === 'DYEING') {
        return dyeProcessPOService.returnUnprocessed(processPO.id, data);
      } else {
        return printProcessPOService.returnUnprocessed(processPO.id, data);
      }
    },
    onSuccess: () => {
      handleApiSuccess('Return recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['process-pos'] });
      queryClient.invalidateQueries({ queryKey: ['dyeing-summary'] });
      queryClient.invalidateQueries({ queryKey: ['printing-summary'] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => handleApiError(err, 'Failed to record return'),
  });

  const handleSubmit = () => {
    if (returnedQtyMeters <= 0) {
      handleApiError(new Error('Invalid quantity'), 'Please enter a valid return quantity');
      return;
    }
    if (!returnDate) {
      handleApiError(new Error('Date required'), 'Please select a return date');
      return;
    }
    if (!remarks.trim()) {
      handleApiError(new Error('Reason required'), 'Please provide a reason for return');
      return;
    }

    returnMutation.mutate();
  };

  if (!processPO) return null;

  const sentQty = Number(processPO.qtySentMeters);
  const receivedQty = Number(processPO.qtyReceivedMeters || 0);
  const remainingAtMill = sentQty - receivedQty;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo className="h-5 w-5 text-warning" />
            Return Unprocessed
          </DialogTitle>
          <DialogDescription>Return unprocessed fabric for {processPO.jobWorkNumber}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary Info */}
          <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sent Qty:</span>
              <span className="font-medium">{sentQty.toFixed(2)}m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Received Qty:</span>
              <span className="font-medium">{receivedQty.toFixed(2)}m</span>
            </div>
            {remainingAtMill > 0 && (
              <div className="flex justify-between text-warning">
                <span>Remaining at Mill:</span>
                <span className="font-medium">{remainingAtMill.toFixed(2)}m</span>
              </div>
            )}
          </div>

          {/* Return Quantity */}
          <div className="space-y-2">
            <Label htmlFor="returnedQtyMeters">Return Quantity (meters) *</Label>
            <Input
              id="returnedQtyMeters"
              type="number"
              min={0.01}
              max={remainingAtMill > 0 ? remainingAtMill : sentQty}
              step={0.01}
              value={returnedQtyMeters || ''}
              onChange={(e) => setReturnedQtyMeters(parseFloat(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">
              Max: {(remainingAtMill > 0 ? remainingAtMill : sentQty).toFixed(2)}m
            </p>
          </div>

          {/* Return Date */}
          <div className="space-y-2">
            <Label htmlFor="returnDate">Return Date *</Label>
            <Input id="returnDate" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
          </div>

          {/* Reason / Remarks */}
          <div className="space-y-2">
            <Label htmlFor="remarks">Reason for Return *</Label>
            <Textarea
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g., Machine breakdown, color not matching, fabric damaged..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={returnMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={returnMutation.isPending || returnedQtyMeters <= 0 || !remarks.trim()}
            className="bg-warning text-warning-foreground hover:bg-warning/90"
          >
            {returnMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Record Return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
