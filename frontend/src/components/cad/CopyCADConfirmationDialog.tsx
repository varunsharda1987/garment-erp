/**
 * Copy CAD Confirmation Dialog
 *
 * Displays confirmation dialog for "Copy as Draft" workflow
 * Shows source record details and explains draft creation process
 */

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Copy, AlertCircle } from 'lucide-react';
import type { CADPurpose, CADSpreadsheetRow } from '../../types/cad-planning.types';

interface CopyCADConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sourceRow: CADSpreadsheetRow | null;
  targetPurpose: CADPurpose;
  isLoading?: boolean;
}

// Purpose display labels
const PURPOSE_LABELS: Record<CADPurpose, string> = {
  COSTING: 'Costing',
  RAW_MATERIAL_CALCULATION: 'Raw Material Calculation',
  PRODUCTION: 'Production',
};

// Purpose colors
const PURPOSE_COLORS: Record<CADPurpose, string> = {
  COSTING: 'bg-info-muted text-info',
  RAW_MATERIAL_CALCULATION: 'bg-warning/10 text-warning',
  PRODUCTION: 'bg-success-muted text-success',
};

export const CopyCADConfirmationDialog: React.FC<CopyCADConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  sourceRow,
  targetPurpose,
  isLoading = false,
}) => {
  if (!sourceRow) return null;

  const sourcePurpose = sourceRow.purpose || 'COSTING';
  const sourcePurposeLabel = PURPOSE_LABELS[sourcePurpose];
  const targetPurposeLabel = PURPOSE_LABELS[targetPurpose];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Copy to {targetPurposeLabel} Mode
          </DialogTitle>
          <DialogDescription>This will create a new draft record for review and approval</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source Record Info */}
          <div className="rounded-lg border bg-muted p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">Source Record:</span>
              <Badge className={PURPOSE_COLORS[sourcePurpose]}>{sourcePurposeLabel} (Approved)</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Component:</span>
                <span className="ml-2 font-medium">{sourceRow.componentName}</span>
              </div>
              {sourceRow.partName && (
                <div>
                  <span className="text-muted-foreground">Part:</span>
                  <span className="ml-2 font-medium">{sourceRow.partName}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Greige:</span>
                <span className="ml-2 font-medium">
                  {sourceRow.greigeName || sourceRow.genericGreigeName || 'Not specified'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Width:</span>
                <span className="ml-2 font-medium">
                  {sourceRow.cutableWidth ? `${sourceRow.cutableWidth}"` : 'Not specified'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">CAD:</span>
                <span className="ml-2 font-medium">
                  {sourceRow.cadAverage ? `${sourceRow.cadAverage.toFixed(3)}m/pc` : 'Not specified'}
                </span>
              </div>
              {sourceRow.piecesPerMarker && (
                <div>
                  <span className="text-muted-foreground">Pieces/Marker:</span>
                  <span className="ml-2 font-medium">{sourceRow.piecesPerMarker}</span>
                </div>
              )}
            </div>
          </div>

          {/* Target Draft Info */}
          <div className="rounded-lg border border-warning/20 bg-warning-muted p-4">
            <div className="mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning" />
              <span className="text-sm font-medium text-warning">New Draft Will Be Created:</span>
            </div>

            <ul className="space-y-1.5 text-sm text-warning">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-warning">•</span>
                <span>
                  <strong>Purpose:</strong> {targetPurposeLabel}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-warning">•</span>
                <span>
                  <strong>Status:</strong> PENDING (not approved)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-warning">•</span>
                <span>
                  <strong>Editable:</strong> Yes, you can adjust values before approving
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-warning">•</span>
                <span>
                  <strong>Linked:</strong> Tracked back to source record for audit trail
                </span>
              </li>
            </ul>
          </div>

          {/* Next Steps */}
          <div className="rounded-lg border bg-info-muted p-4">
            <div className="mb-2 text-sm font-medium text-info">After Copying:</div>
            <ol className="space-y-1.5 text-sm text-info">
              <li className="flex items-start gap-2">
                <span className="font-medium">1.</span>
                <span>Review the copied CAD data</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium">2.</span>
                <span>
                  Adjust values based on{' '}
                  {targetPurpose === 'RAW_MATERIAL_CALCULATION' ? 'confirmed order details' : 'actual fabric stock'}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium">3.</span>
                <span>Update cost estimates if needed (in Fabric Costing)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-medium">4.</span>
                <span>Approve the draft when ready</span>
              </li>
            </ol>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Creating Draft...
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Copy & Edit
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
