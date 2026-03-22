/**
 * useConfirmDialog Hook
 *
 * Provides an imperative API for showing confirmation dialogs.
 * Returns a promise that resolves to true if confirmed, false if cancelled.
 *
 * @example
 * const { confirm, ConfirmDialog } = useConfirmDialog();
 *
 * // In your component JSX, include the dialog:
 * return (
 *   <>
 *     <Button onClick={handleDelete}>Delete</Button>
 *     <ConfirmDialog />
 *   </>
 * );
 *
 * // In your handler:
 * const handleDelete = async () => {
 *   const confirmed = await confirm({
 *     title: "Delete Item?",
 *     description: "This action cannot be undone.",
 *     confirmText: "Delete",
 *     destructive: true
 *   });
 *
 *   if (confirmed) {
 *     await deleteItem();
 *   }
 * };
 */

import { useState, useCallback, useRef } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

export interface ConfirmDialogOptions {
  /** Dialog title */
  title: string;
  /** Dialog description/message */
  description: string;
  /** Confirm button text (default: "Confirm") */
  confirmText?: string;
  /** Cancel button text (default: "Cancel") */
  cancelText?: string;
  /** Whether this is a destructive action (default: false) */
  destructive?: boolean;
}

interface DialogState extends ConfirmDialogOptions {
  isOpen: boolean;
}

const defaultState: DialogState = {
  isOpen: false,
  title: '',
  description: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  destructive: false,
};

export function useConfirmDialog() {
  const [state, setState] = useState<DialogState>(defaultState);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({
        isOpen: true,
        title: options.title,
        description: options.description,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        destructive: options.destructive || false,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setState(defaultState);
    resolveRef.current?.(true);
    resolveRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setState(defaultState);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  const ConfirmDialog = useCallback(() => {
    return (
      <AlertDialog open={state.isOpen} onOpenChange={(open) => !open && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{state.title}</AlertDialogTitle>
            <AlertDialogDescription>{state.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>{state.cancelText}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={state.destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {state.confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }, [state, handleConfirm, handleCancel]);

  return {
    /** Function to show the confirmation dialog */
    confirm,
    /** The dialog component to render in your JSX */
    ConfirmDialog,
  };
}

export default useConfirmDialog;
