/**
 * SaveButton Component
 *
 * A standardized save button with loading state.
 * Used for form submissions and save operations.
 *
 * @example
 * <SaveButton loading={isSaving} onClick={handleSave}>Save</SaveButton>
 * <SaveButton loading={isSaving} loadingText="Saving...">Save Changes</SaveButton>
 */
import React from 'react';
import { Save, Loader2 } from 'lucide-react';
import { Button, ButtonProps } from '../ui/button';

export interface SaveButtonProps extends Omit<ButtonProps, 'variant'> {
  /** Whether the button is in loading state */
  loading?: boolean;
  /** Text to show when loading (default: "Saving...") */
  loadingText?: string;
  /** Whether to show the save icon (default: true) */
  showIcon?: boolean;
  /** Button variant - defaults to "default" (primary) */
  variant?: 'default' | 'outline';
}

export function SaveButton({
  children = 'Save',
  loading = false,
  loadingText = 'Saving...',
  showIcon = true,
  disabled,
  variant = 'default',
  ...props
}: SaveButtonProps) {
  return (
    <Button
      variant={variant}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          {loadingText}
        </>
      ) : (
        <>
          {showIcon && <Save className="h-4 w-4 mr-2" />}
          {children}
        </>
      )}
    </Button>
  );
}

export default SaveButton;
