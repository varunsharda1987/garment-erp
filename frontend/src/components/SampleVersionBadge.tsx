import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SampleVersionBadgeProps {
  version: number | null | undefined;
  sampleType?: string;
  className?: string;
}

/**
 * Displays a version badge for FIT, PP, and SIZE_SET samples.
 * Only shows for versioned sample types when version > 1.
 */
export function SampleVersionBadge({ version, sampleType, className }: SampleVersionBadgeProps) {
  const VERSIONED_TYPES = ['FIT_SAMPLE', 'PP_SAMPLE', 'SIZE_SET_SAMPLE'];

  // Only show badge for versioned sample types
  if (sampleType && !VERSIONED_TYPES.includes(sampleType)) {
    return null;
  }

  // Only show badge if version exists and is greater than 1
  if (!version || version <= 1) {
    return null;
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'ml-1 px-1.5 py-0 text-[10px] font-medium bg-blue-50 text-blue-700 border-blue-200',
        className
      )}
    >
      v{version}
    </Badge>
  );
}
