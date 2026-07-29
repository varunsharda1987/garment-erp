// Quality Check Dialog - Record quality check results for a Process PO
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { dyeProcessPOService } from '@/services/dyeing.service';
import { processPOService as printProcessPOService } from '@/services/printing.service';
import type { ProcessPO, QualityCheckRequest } from '@/types/printing.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

export type ProcessType = 'DYEING' | 'PRINTING';

interface QualityCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processPO: ProcessPO | null;
  processType: ProcessType;
  onSuccess?: () => void;
}

const QUALITY_GRADES = [
  { value: 'A', label: 'Grade A - Excellent' },
  { value: 'B', label: 'Grade B - Good' },
  { value: 'Reject', label: 'Reject' },
];

const COLOR_MATCH_STATUSES = [
  { value: 'Match', label: 'Match' },
  { value: 'Slight Variation', label: 'Slight Variation' },
  { value: 'Mismatch', label: 'Mismatch' },
];

export default function QualityCheckDialog({
  open,
  onOpenChange,
  processPO,
  processType,
  onSuccess,
}: QualityCheckDialogProps) {
  const queryClient = useQueryClient();

  // Form state
  const [qualityGrade, setQualityGrade] = useState<'A' | 'B' | 'Reject' | ''>('');
  const [colorMatchStatus, setColorMatchStatus] = useState<'Match' | 'Slight Variation' | 'Mismatch' | ''>('');
  const [defectMeters, setDefectMeters] = useState<number>(0);
  const [defectType, setDefectType] = useState('');
  const [actualRate, setActualRate] = useState<number | undefined>();
  const [remarks, setRemarks] = useState('');

  // Reset form when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && processPO) {
      // Pre-fill actual rate with agreed rate
      setActualRate(processPO.jobWorkOrder?.agreedRatePerMeter);
      setQualityGrade('');
      setColorMatchStatus('');
      setDefectMeters(0);
      setDefectType('');
      setRemarks('');
    }
    onOpenChange(newOpen);
  };

  // Quality check mutation
  const qcMutation = useMutation({
    mutationFn: async (data: QualityCheckRequest) => {
      if (!processPO) throw new Error('No Process PO');
      if (processType === 'DYEING') {
        return dyeProcessPOService.qualityCheck(processPO.id, data);
      } else {
        return printProcessPOService.qualityCheck(processPO.id, data);
      }
    },
    onSuccess: () => {
      handleApiSuccess('Quality check recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['process-pos'] });
      queryClient.invalidateQueries({ queryKey: ['dyeing-summary'] });
      queryClient.invalidateQueries({ queryKey: ['printing-summary'] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => handleApiError(err, 'Failed to record quality check'),
  });

  const handleSubmit = () => {
    if (!qualityGrade) {
      handleApiError(new Error('Grade required'), 'Please select a quality grade');
      return;
    }
    if (!colorMatchStatus) {
      handleApiError(new Error('Color match required'), 'Please select color match status');
      return;
    }

    const request: QualityCheckRequest = {
      qualityGrade: qualityGrade as 'A' | 'B' | 'Reject',
      colorMatchStatus: colorMatchStatus as 'Match' | 'Slight Variation' | 'Mismatch',
      defectMeters: defectMeters > 0 ? defectMeters : undefined,
      defectType: defectType || undefined,
      actualRate: actualRate,
      remarks: remarks || undefined,
    };

    qcMutation.mutate(request);
  };

  if (!processPO) return null;

  const jwo = processPO.jobWorkOrder;
  const receivedQty = Number(jwo?.qtyReceivedMeters || 0);
  const agreedRate = Number(jwo?.agreedRatePerMeter || 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Quality Check
          </DialogTitle>
          <DialogDescription>
            Record quality check results for {jwo?.jobWorkNumber || processPO.poNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary Info */}
          <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Received Qty:</span>
              <span className="font-medium">{receivedQty.toFixed(2)}m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Agreed Rate:</span>
              <span className="font-medium">₹{agreedRate.toFixed(2)}/m</span>
            </div>
          </div>

          {/* Quality Grade */}
          <div className="space-y-2">
            <Label>Quality Grade *</Label>
            <Select value={qualityGrade} onValueChange={(v) => setQualityGrade(v as 'A' | 'B' | 'Reject')}>
              <SelectTrigger>
                <SelectValue placeholder="Select grade" />
              </SelectTrigger>
              <SelectContent>
                {QUALITY_GRADES.map((grade) => (
                  <SelectItem key={grade.value} value={grade.value}>
                    {grade.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Color Match Status */}
          <div className="space-y-2">
            <Label>Color Match Status *</Label>
            <Select
              value={colorMatchStatus}
              onValueChange={(v) => setColorMatchStatus(v as 'Match' | 'Slight Variation' | 'Mismatch')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {COLOR_MATCH_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Defect Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="defectMeters">Defect Meters</Label>
              <Input
                id="defectMeters"
                type="number"
                min={0}
                max={receivedQty}
                step={0.01}
                value={defectMeters || ''}
                onChange={(e) => setDefectMeters(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defectType">Defect Type</Label>
              <Input
                id="defectType"
                value={defectType}
                onChange={(e) => setDefectType(e.target.value)}
                placeholder="e.g., Shade variation"
              />
            </div>
          </div>

          {/* Actual Rate */}
          <div className="space-y-2">
            <Label htmlFor="actualRate">Actual Rate (₹/m)</Label>
            <Input
              id="actualRate"
              type="number"
              min={0}
              step={0.01}
              value={actualRate ?? ''}
              onChange={(e) => setActualRate(e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="Same as agreed if unchanged"
            />
            <p className="text-xs text-muted-foreground">Leave blank to use agreed rate (₹{agreedRate.toFixed(2)})</p>
          </div>

          {/* Remarks */}
          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={qcMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={qcMutation.isPending || !qualityGrade || !colorMatchStatus}>
            {qcMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Record QC
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
