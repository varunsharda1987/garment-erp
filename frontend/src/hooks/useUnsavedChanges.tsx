/**
 * useUnsavedChanges Hook
 *
 * Provides unsaved changes warning functionality for forms.
 * Handles both browser beforeunload events and in-app navigation.
 *
 * @example
 * const { isDirty, setIsDirty, UnsavedDialog } = useUnsavedChanges({
 *   enabled: form.formState.isDirty,
 *   onSave: handleSave,
 *   onDiscard: () => navigate('/list'),
 * });
 *
 * // In your JSX:
 * <UnsavedDialog />
 *
 * // When navigating away:
 * const handleNavigate = () => {
 *   if (isDirty) {
 *     // The dialog will show automatically via the hook
 *   } else {
 *     navigate('/list');
 *   }
 * };
 */

import { useState, useEffect, useCallback } from 'react';
import { UnsavedChangesDialog } from '../components/dialogs';

export interface UseUnsavedChangesOptions {
  /** Whether there are unsaved changes */
  enabled?: boolean;
  /** Callback when user chooses to save */
  onSave?: () => void | Promise<void>;
  /** Callback when user chooses to discard */
  onDiscard?: () => void;
  /** Custom dialog title */
  title?: string;
  /** Custom dialog description */
  description?: string;
}

export function useUnsavedChanges(options: UseUnsavedChangesOptions = {}) {
  const {
    enabled = false,
    onSave,
    onDiscard,
    title = 'Unsaved Changes',
    description = 'You have unsaved changes. Do you want to save them before leaving?',
  } = options;

  const [isDirty, setIsDirty] = useState(enabled);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // Sync with enabled prop
  useEffect(() => {
    setIsDirty(enabled);
  }, [enabled]);

  // Handle browser beforeunload event
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    if (isDirty) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  const handleDiscard = useCallback(() => {
    setIsDirty(false);
    setShowDialog(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    } else if (onDiscard) {
      onDiscard();
    }
  }, [pendingNavigation, onDiscard]);

  const handleSave = useCallback(async () => {
    if (onSave) {
      setSaving(true);
      try {
        await onSave();
        setIsDirty(false);
        setShowDialog(false);
        if (pendingNavigation) {
          pendingNavigation();
          setPendingNavigation(null);
        }
      } finally {
        setSaving(false);
      }
    }
  }, [onSave, pendingNavigation]);

  const handleCancel = useCallback(() => {
    setShowDialog(false);
    setPendingNavigation(null);
  }, []);

  const UnsavedDialog = useCallback(() => {
    return (
      <UnsavedChangesDialog
        open={showDialog}
        onOpenChange={(open) => {
          if (!open) handleCancel();
        }}
        title={title}
        description={description}
        onDiscard={handleDiscard}
        onSave={onSave ? handleSave : undefined}
        saving={saving}
      />
    );
  }, [showDialog, title, description, handleDiscard, handleSave, handleCancel, onSave, saving]);

  return {
    /** Whether there are unsaved changes */
    isDirty,
    /** Set the dirty state manually */
    setIsDirty,
    /** Whether the unsaved dialog is showing */
    showDialog,
    /** Set the dialog visibility */
    setShowDialog,
    /** The unsaved changes dialog component */
    UnsavedDialog,
    /** Trigger the dialog to show */
    promptUnsaved: () => setShowDialog(true),
  };
}

export default useUnsavedChanges;
