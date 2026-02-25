/**
 * RefreshButton Component
 *
 * A standardized refresh button for reloading data.
 *
 * @example
 * <RefreshButton onClick={refetch} loading={isRefreshing} />
 * <RefreshButton onClick={refetch}>Reload Data</RefreshButton>
 */
import { RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import type { ButtonProps } from '../ui/button';
import { cn } from '../../lib/utils';

export interface RefreshButtonProps extends Omit<ButtonProps, 'variant'> {
  /** Whether the button is in loading/refreshing state */
  loading?: boolean;
  /** Whether to show the refresh icon (default: true) */
  showIcon?: boolean;
  /** Use ghost variant instead of outline (default: false) */
  ghost?: boolean;
  /** Icon-only mode (no text) */
  iconOnly?: boolean;
}

export function RefreshButton({
  children = 'Refresh',
  loading = false,
  showIcon = true,
  ghost = false,
  iconOnly = false,
  disabled,
  className,
  ...props
}: RefreshButtonProps) {
  if (iconOnly) {
    return (
      <Button
        variant={ghost ? 'ghost' : 'outline'}
        size="icon"
        disabled={disabled || loading}
        className={className}
        {...props}
      >
        <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
      </Button>
    );
  }

  return (
    <Button
      variant={ghost ? 'ghost' : 'outline'}
      disabled={disabled || loading}
      className={className}
      {...props}
    >
      {showIcon && (
        <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
      )}
      {loading ? 'Refreshing...' : children}
    </Button>
  );
}

export default RefreshButton;
