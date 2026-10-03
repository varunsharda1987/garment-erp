import { useState } from 'react';
import { AdminOverrideModal } from '@/components/AdminOverrideModal';
import { usePermissions } from '@/hooks/usePermissions';

interface StageBlocker {
  type: string;
  message: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

interface StageBlockedDetails {
  reason?: string;
  blockers?: StageBlocker[];
  shortageOverridable?: boolean;
}

/**
 * Create Cutting Batch refused ONLY for a fabric shortage: an admin may cut past it with a reason
 * (owner, 03-Oct-2026). The server checks the role again and logs the override; anyone else just
 * sees the refusal, which already says an administrator can override it.
 */
export function useShortageOverride() {
  const { isAdmin } = usePermissions();
  const [pending, setPending] = useState<{ blockers: StageBlocker[]; retry: (reason: string) => void } | null>(null);

  /** True when the error was taken over by the override dialog (the caller then shows nothing) */
  const offerOverride = (err: unknown, retry: (reason: string) => void): boolean => {
    const details = (err as { response?: { data?: { details?: StageBlockedDetails } } })?.response?.data?.details;
    if (!isAdmin || details?.reason !== 'CUTTING_STAGE_BLOCKED' || !details.shortageOverridable) return false;
    setPending({ blockers: details.blockers ?? [], retry });
    return true;
  };

  const overrideDialog = (
    <AdminOverrideModal
      isOpen={!!pending}
      onClose={() => setPending(null)}
      action="create this cutting batch with less fabric than the Order BOM asks for"
      blockers={pending?.blockers ?? []}
      onConfirm={(reason) => {
        const retry = pending?.retry;
        setPending(null);
        retry?.(reason.trim());
      }}
    />
  );

  return { offerOverride, overrideDialog };
}
