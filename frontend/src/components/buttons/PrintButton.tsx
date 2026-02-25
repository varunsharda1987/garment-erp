/**
 * PrintButton Component
 *
 * A standardized print button with loading state.
 *
 * @example
 * // Basic usage
 * <PrintButton onClick={handlePrint} />
 *
 * // With loading state
 * <PrintButton onClick={handlePrint} loading={isPrinting} />
 *
 * // Icon only mode
 * <PrintButton onClick={handlePrint} iconOnly />
 *
 * // With custom text
 * <PrintButton onClick={handlePrint}>Print Invoice</PrintButton>
 */
import type { ReactNode } from 'react';
import { Printer, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import type { ButtonProps } from '../ui/button';

export interface PrintButtonProps extends Omit<ButtonProps, 'onClick'> {
  /** Click handler */
  onClick: () => void;
  /** Whether print is in progress */
  loading?: boolean;
  /** Text to show while loading */
  loadingText?: string;
  /** Show only the icon */
  iconOnly?: boolean;
  /** Show icon alongside text */
  showIcon?: boolean;
  /** Button content (default: "Print") */
  children?: ReactNode;
}

export function PrintButton({
  onClick,
  loading = false,
  loadingText = 'Printing...',
  iconOnly = false,
  showIcon = true,
  children,
  disabled,
  variant = 'outline',
  size,
  className,
  ...props
}: PrintButtonProps) {
  const buttonSize = iconOnly ? 'icon' : size;
  const buttonText = children || 'Print';

  if (iconOnly) {
    return (
      <Button
        variant={variant}
        size={buttonSize}
        onClick={onClick}
        disabled={disabled || loading}
        className={className}
        title="Print"
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Printer className="h-4 w-4" />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={buttonSize}
      onClick={onClick}
      disabled={disabled || loading}
      className={className}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        <>
          {showIcon && <Printer className="mr-2 h-4 w-4" />}
          {buttonText}
        </>
      )}
    </Button>
  );
}

export default PrintButton;
