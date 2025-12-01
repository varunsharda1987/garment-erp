/**
 * DeleteButton Component
 *
 * A standardized delete button with optional built-in confirmation dialog.
 *
 * @example
 * // Without confirmation (you handle confirmation externally)
 * <DeleteButton onClick={handleDelete}>Delete</DeleteButton>
 *
 * // With built-in confirmation
 * <DeleteButton
 *   onConfirm={handleDelete}
 *   confirmTitle="Delete Customer?"
 *   confirmDescription="This action cannot be undone."
 * />
 */
import React, { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { Button, ButtonProps } from '../ui/button';
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

export interface DeleteButtonProps extends Omit<ButtonProps, 'variant' | 'onClick'> {
  /** Click handler when no confirmation needed */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** Callback after confirmation (enables confirmation dialog) */
  onConfirm?: () => void | Promise<void>;
  /** Confirmation dialog title */
  confirmTitle?: string;
  /** Confirmation dialog description */
  confirmDescription?: string;
  /** Confirm button text (default: "Delete") */
  confirmText?: string;
  /** Cancel button text (default: "Cancel") */
  cancelText?: string;
  /** Whether the button is in loading state */
  loading?: boolean;
  /** Text to show when loading (default: "Deleting...") */
  loadingText?: string;
  /** Whether to show the trash icon (default: true) */
  showIcon?: boolean;
  /** Use outline variant instead of destructive (default: false) */
  outline?: boolean;
}

export function DeleteButton({
  children = 'Delete',
  onClick,
  onConfirm,
  confirmTitle = 'Are you sure?',
  confirmDescription = 'This action cannot be undone.',
  confirmText = 'Delete',
  cancelText = 'Cancel',
  loading = false,
  loadingText = 'Deleting...',
  showIcon = true,
  outline = false,
  disabled,
  ...props
}: DeleteButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onConfirm) {
      // Open confirmation dialog
      setIsOpen(true);
    } else if (onClick) {
      onClick(e);
    }
  };

  const handleConfirm = async () => {
    if (!onConfirm) return;

    setIsDeleting(true);
    try {
      await onConfirm();
      setIsOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const isLoading = loading || isDeleting;

  return (
    <>
      <Button
        variant={outline ? 'outline' : 'destructive'}
        onClick={handleClick}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {loadingText}
          </>
        ) : (
          <>
            {showIcon && <Trash2 className="h-4 w-4 mr-2" />}
            {children}
          </>
        )}
      </Button>

      {onConfirm && (
        <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
              <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>{cancelText}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirm}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {loadingText}
                  </>
                ) : (
                  confirmText
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

export default DeleteButton;
