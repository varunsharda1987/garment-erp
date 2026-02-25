/**
 * UnsavedChangesDialog Component
 *
 * A preset confirmation dialog for warning about unsaved changes.
 *
 * @example
 * <UnsavedChangesDialog
 *   open={showUnsavedWarning}
 *   onOpenChange={setShowUnsavedWarning}
 *   onDiscard={handleDiscard}
 *   onSave={handleSave}
 * />
 */
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { Button } from '../ui/button';

export interface UnsavedChangesDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Custom title (default: "Unsaved Changes") */
  title?: string;
  /** Custom description */
  description?: string;
  /** Callback when user chooses to discard changes */
  onDiscard: () => void;
  /** Callback when user chooses to save (optional - if not provided, only Cancel/Discard shown) */
  onSave?: () => void | Promise<void>;
  /** Whether the save operation is in progress */
  saving?: boolean;
  /** Discard button text (default: "Discard") */
  discardText?: string;
  /** Save button text (default: "Save") */
  saveText?: string;
  /** Cancel button text (default: "Cancel") */
  cancelText?: string;
}

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  title = 'Unsaved Changes',
  description = 'You have unsaved changes. Do you want to save them before leaving?',
  onDiscard,
  onSave,
  saving = false,
  discardText = 'Discard',
  saveText = 'Save',
  cancelText = 'Cancel',
}: UnsavedChangesDialogProps) {
  const handleDiscard = () => {
    onDiscard();
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (onSave) {
      await onSave();
      if (!saving) {
        onOpenChange(false);
      }
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel disabled={saving}>{cancelText}</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDiscard}
            disabled={saving}
          >
            {discardText}
          </Button>
          {onSave && (
            <AlertDialogAction
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                saveText
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default UnsavedChangesDialog;
