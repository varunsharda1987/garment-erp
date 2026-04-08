import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ShieldAlert, AlertCircle, AlertTriangle } from 'lucide-react';

interface BlockerInfo {
  type: string;
  message: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

interface AdminOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  action: string; // e.g., "transition to IN_CUTTING" or "create PP Sample"
  blockers: BlockerInfo[];
}

export const AdminOverrideModal: React.FC<AdminOverrideModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  action,
  blockers,
}) => {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (reason.trim().length >= 10) {
      onConfirm(reason);
      setReason(''); // Clear for next use
    }
  };

  const handleClose = () => {
    setReason(''); // Clear on close
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <ShieldAlert className="h-6 w-6" />
            Admin Override Required
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Blockers List */}
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <h3 className="font-semibold text-destructive mb-2">The following blocks prevent: {action}</h3>
            <ul className="space-y-2">
              {blockers.map((blocker, idx) => (
                <li key={idx} className="text-sm text-destructive flex gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{blocker.message}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Warning */}
          <div className="bg-warning-muted border border-yellow-200 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-900">
                <p className="font-semibold mb-1">Warning</p>
                <p>
                  Overriding these quality gates will be permanently logged with your user ID, timestamp, and reason.
                  This action is auditable and may be reviewed by management.
                </p>
              </div>
            </div>
          </div>

          {/* Reason Input */}
          <div>
            <label htmlFor="override-reason" className="text-sm font-medium block mb-1">
              Override Reason (Required, minimum 10 characters)
            </label>
            <Textarea
              id="override-reason"
              placeholder="Explain why you are overriding (e.g., 'Customer urgency - approved by production head via email on 12/19/2025')"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1"
              rows={4}
            />
            <p className="text-xs text-muted-foreground mt-1">{reason.length}/10 characters minimum</p>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={reason.trim().length < 10}>
            Confirm Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminOverrideModal;
