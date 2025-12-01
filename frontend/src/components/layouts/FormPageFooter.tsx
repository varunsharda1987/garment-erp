/**
 * FormPageFooter Component
 *
 * Footer section for form pages with Save/Cancel/Delete buttons.
 *
 * @example
 * <FormPageFooter
 *   onSave={handleSave}
 *   onCancel={() => navigate('/customers')}
 *   saving={isSaving}
 *   saveDisabled={!form.formState.isValid}
 * />
 */
import React from 'react';
import { Save, Loader2, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';

export interface FormPageFooterProps {
  /** Save button click handler */
  onSave?: () => void;
  /** Cancel button click handler */
  onCancel?: () => void;
  /** Delete button click handler */
  onDelete?: () => void;
  /** Whether the form is being saved */
  saving?: boolean;
  /** Whether the form is being deleted */
  deleting?: boolean;
  /** Whether save button is disabled */
  saveDisabled?: boolean;
  /** Save button text (default: "Save") */
  saveText?: string;
  /** Saving text (default: "Saving...") */
  savingText?: string;
  /** Cancel button text (default: "Cancel") */
  cancelText?: string;
  /** Delete button text (default: "Delete") */
  deleteText?: string;
  /** Whether to show the save icon (default: true) */
  showSaveIcon?: boolean;
  /** Whether to show the delete button (default: false) */
  showDelete?: boolean;
  /** Position: 'left' | 'right' | 'between' (default: 'right') */
  position?: 'left' | 'right' | 'between';
  /** Whether to use sticky positioning (default: false) */
  sticky?: boolean;
  /** Additional CSS class */
  className?: string;
}

export function FormPageFooter({
  onSave,
  onCancel,
  onDelete,
  saving = false,
  deleting = false,
  saveDisabled = false,
  saveText = 'Save',
  savingText = 'Saving...',
  cancelText = 'Cancel',
  deleteText = 'Delete',
  showSaveIcon = true,
  showDelete = false,
  position = 'right',
  sticky = false,
  className = '',
}: FormPageFooterProps) {
  const isDisabled = saving || deleting;

  const justifyClass = {
    left: 'justify-start',
    right: 'justify-end',
    between: 'justify-between',
  }[position];

  const stickyClass = sticky
    ? 'sticky bottom-0 bg-background border-t py-4 px-6 -mx-6 -mb-6 mt-6'
    : 'mt-6';

  return (
    <div className={`flex items-center gap-3 ${justifyClass} ${stickyClass} ${className}`}>
      {/* Delete button on the left when position is 'between' */}
      {position === 'between' && showDelete && onDelete && (
        <Button
          type="button"
          variant="destructive"
          onClick={onDelete}
          disabled={isDisabled}
        >
          {deleting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-2" />
              {deleteText}
            </>
          )}
        </Button>
      )}

      {/* Right side buttons */}
      <div className="flex items-center gap-3">
        {/* Delete button (when not 'between') */}
        {position !== 'between' && showDelete && onDelete && (
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
            disabled={isDisabled}
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                {deleteText}
              </>
            )}
          </Button>
        )}

        {/* Cancel button */}
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isDisabled}
          >
            {cancelText}
          </Button>
        )}

        {/* Save button */}
        {onSave && (
          <Button
            type="button"
            onClick={onSave}
            disabled={saveDisabled || isDisabled}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {savingText}
              </>
            ) : (
              <>
                {showSaveIcon && <Save className="h-4 w-4 mr-2" />}
                {saveText}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export default FormPageFooter;
