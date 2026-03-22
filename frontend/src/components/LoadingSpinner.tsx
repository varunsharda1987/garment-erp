import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  text?: string;
}

/**
 * Page-level loading spinner
 * Use for full page or large section loading states
 */
export function LoadingSpinner({ size = 'md', className, text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  return (
    <div className={cn('flex flex-col justify-center items-center min-h-[200px] gap-3', className)}>
      <Loader2 className={cn(sizeClasses[size], 'animate-spin text-primary')} />
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}

/**
 * Button spinner - for loading buttons
 * Use inside buttons during async operations
 */
export function ButtonSpinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} />;
}

/**
 * Table loading skeleton
 * Use for table loading states with proper row structure
 */
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              className="h-10 bg-muted animate-pulse rounded"
              style={{ flex: colIndex === 0 ? '0 0 10%' : '1 1 0%' }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Card loading skeleton
 * Use for card/panel loading states
 */
export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="space-y-2">
          <div className="h-4 bg-muted animate-pulse rounded w-1/4" />
          <div className="h-8 bg-muted animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}

/**
 * Inline spinner - for small inline loading states
 * Use for inline text or small UI elements
 */
export function InlineSpinner({ className, text }: { className?: string; text?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      {text && <span className="text-sm text-muted-foreground">{text}</span>}
    </div>
  );
}

/**
 * Overlay spinner - for overlay loading states
 * Use when you want to show loading over existing content
 */
export function OverlaySpinner({ text }: { text?: string }) {
  return (
    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      {text && <p className="mt-3 text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}
