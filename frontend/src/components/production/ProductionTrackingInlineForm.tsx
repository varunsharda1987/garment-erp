import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { stageValidationService } from '@/services/stageValidation.service';
import { workOrderService } from '@/services/workOrder.service';
import { useAuthStore } from '@/stores/auth.store';
import { AdminOverrideModal } from '@/components/AdminOverrideModal';
import { toast } from 'sonner';
import type { ProductionStage } from '@/types/production.types';

interface BlockerInfo {
  type: string;
  message: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

interface ProductionTrackingInlineFormProps {
  workOrderId: string;
  currentStage: string;
  orderItemId: string;
  totalQuantity: number;
  onSuccess: () => void;
  onCancel: () => void;
}

const PRODUCTION_STAGES = [
  { value: 'ORDER_RECEIVED', label: 'Order Received' },
  { value: 'PENDING_COSTING', label: 'Pending Costing' },
  { value: 'PENDING_GREIGE_ORDER', label: 'Pending Greige Order' },
  { value: 'IN_PRINTING', label: 'In Printing' },
  { value: 'IN_DYING', label: 'In Dyeing' },
  { value: 'IN_CUTTING', label: 'In Cutting' },
  { value: 'IN_STITCHING', label: 'In Stitching' },
  { value: 'IN_EMBROIDERY', label: 'In Embroidery' },
  { value: 'IN_HANDWORK', label: 'In Handwork' },
  { value: 'IN_FINISHING', label: 'In Finishing' },
  { value: 'READY_TO_SHIP', label: 'Ready to Ship' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'COMPLETED', label: 'Completed' },
];

const ProductionTrackingInlineForm: React.FC<ProductionTrackingInlineFormProps> = ({
  workOrderId,
  currentStage,
  totalQuantity,
  onSuccess,
  onCancel,
}) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [selectedStage, setSelectedStage] = useState<string>('');
  const [quantityCompleted, setQuantityCompleted] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>('');
  const [validationBlockers, setValidationBlockers] = useState<BlockerInfo[]>([]);
  const [, setCanProceed] = useState<boolean>(true);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);

  // Get stages that come after the current stage
  const currentStageIndex = PRODUCTION_STAGES.findIndex((s) => s.value === currentStage);
  const availableStages = PRODUCTION_STAGES.filter((_, index) => index > currentStageIndex);

  // Validate stage transition when stage changes
  useEffect(() => {
    if (selectedStage && selectedStage !== currentStage) {
      validateStageTransition(selectedStage);
    } else {
      setValidationBlockers([]);
      setCanProceed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStage]);

  const validateStageTransition = async (targetStage: string) => {
    setIsValidating(true);
    try {
      const validation = await stageValidationService.checkStageTransition(workOrderId, targetStage);

      setValidationBlockers(validation.blockers || []);
      setCanProceed(!validation.isBlocked);

      // Show notification if blockers detected
      if (validation.isBlocked && validation.blockers.length > 0) {
        const criticalBlockers = validation.blockers.filter((b) => b.severity === 'CRITICAL');
        const targetStageLabel = PRODUCTION_STAGES.find((s) => s.value === targetStage)?.label;

        toast.error('Production Blockers Detected', {
          description: `Cannot transition to ${targetStageLabel}. ${criticalBlockers.length || validation.blockers.length} issue(s) must be resolved${user?.role === 'ADMIN' ? ' or overridden' : ''}.`,
          duration: 7000,
        });
      }
    } catch (error: unknown) {
      console.error('Validation error:', error);
      toast.error('Validation Failed', {
        description: 'Unable to validate stage transition. Please try again.',
      });
      setValidationBlockers([]);
      setCanProceed(false);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedStage) {
      toast.error('Please select a stage');
      return;
    }

    if (quantityCompleted <= 0) {
      toast.error('Please enter quantity completed');
      return;
    }

    if (quantityCompleted > totalQuantity) {
      toast.error(`Quantity cannot exceed total quantity (${totalQuantity})`);
      return;
    }

    // Check blockers
    if (validationBlockers.length > 0) {
      if (user?.role !== 'ADMIN') {
        toast.error('Cannot proceed: ' + validationBlockers[0].message);
        return;
      }

      // Admin - show override modal
      setShowOverrideModal(true);
      return;
    }

    // No blocks - proceed
    await submitStageUpdate(false, null);
  };

  const submitStageUpdate = async (adminOverride: boolean, overrideReason: string | null) => {
    setIsSaving(true);
    try {
      await workOrderService.addProductionTracking(workOrderId, {
        productionStage: selectedStage as ProductionStage,
        quantityCompleted,
        remarks: remarks || undefined,
        adminOverride,
        overrideReason: overrideReason || undefined,
      });

      const stageLabel = PRODUCTION_STAGES.find((s) => s.value === selectedStage)?.label;

      if (adminOverride) {
        toast.warning('Admin Override Used', {
          description: `Stage updated to ${stageLabel} despite blockers. This action has been logged for audit.`,
          duration: 6000,
          action: {
            label: 'View History',
            onClick: () => navigate('/admin/override-history'),
          },
        });
      } else {
        toast.success('Production Stage Updated', {
          description: `✓ ${quantityCompleted} pieces completed at ${stageLabel}`,
          duration: 5000,
          action: {
            label: 'View Status',
            onClick: () => navigate('/production/status'),
          },
        });
      }

      setShowOverrideModal(false);
      onSuccess(); // Refresh parent data
    } catch (error: unknown) {
      console.error('Failed to update stage:', error);
      const axiosErr = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error('Failed to update stage', {
        description: axiosErr.response?.data?.message || axiosErr.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOverrideConfirm = async (reason: string) => {
    await submitStageUpdate(true, reason);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Stage Selector */}
        <div className="space-y-2">
          <Label htmlFor="stage">New Stage *</Label>
          <Select value={selectedStage} onValueChange={setSelectedStage}>
            <SelectTrigger id="stage">
              <SelectValue placeholder="Select stage" />
            </SelectTrigger>
            <SelectContent>
              {availableStages.map((stage) => (
                <SelectItem key={stage.value} value={stage.value}>
                  {stage.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Quantity Input */}
        <div className="space-y-2">
          <Label htmlFor="quantity">
            Quantity Completed * <span className="text-xs text-gray-500">/ {totalQuantity}</span>
          </Label>
          <Input
            id="quantity"
            type="number"
            min="1"
            max={totalQuantity}
            value={quantityCompleted || ''}
            onChange={(e) => setQuantityCompleted(parseInt(e.target.value) || 0)}
            placeholder="0"
          />
        </div>
      </div>

      {/* Remarks */}
      <div className="space-y-2">
        <Label htmlFor="remarks">Remarks (Optional)</Label>
        <Textarea
          id="remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Add any notes about this stage update..."
          rows={2}
        />
      </div>

      {/* Validation Status */}
      {isValidating && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Validating stage transition...
        </div>
      )}

      {/* Validation Blockers */}
      {!isValidating && validationBlockers.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <h4 className="font-semibold text-red-900 text-sm mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Validation Issues
          </h4>
          <ul className="space-y-1">
            {validationBlockers.map((blocker, idx) => (
              <li key={idx} className="text-sm text-red-800 flex gap-2">
                <span className="text-red-600">•</span>
                <span>{blocker.message}</span>
              </li>
            ))}
          </ul>
          {user?.role === 'ADMIN' && (
            <p className="text-xs text-red-700 mt-2">As an admin, you can override these blocks by proceeding.</p>
          )}
        </div>
      )}

      {/* Success Indicator */}
      {!isValidating && validationBlockers.length === 0 && selectedStage && (
        <div className="flex items-center gap-2 text-sm text-green-700">
          <CheckCircle className="h-4 w-4" />
          Stage transition is valid
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!selectedStage || quantityCompleted <= 0 || isSaving || isValidating}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Updating...
            </>
          ) : (
            'Update Stage'
          )}
        </Button>
      </div>

      {/* Admin Override Modal */}
      <AdminOverrideModal
        isOpen={showOverrideModal}
        onClose={() => setShowOverrideModal(false)}
        onConfirm={handleOverrideConfirm}
        action={`transition to ${PRODUCTION_STAGES.find((s) => s.value === selectedStage)?.label}`}
        blockers={validationBlockers}
      />
    </div>
  );
};

export default ProductionTrackingInlineForm;
