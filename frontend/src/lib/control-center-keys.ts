/**
 * React Query keys for the Manufacturing Control Center.
 *
 * These existed only as an inline literal (`queryKey: ['manufacturing-alerts']`) inside the page,
 * which meant nothing in the app ever invalidated them — receiving a job work order, completing a
 * cutting batch or closing a challan all left the page showing yesterday's numbers until its 60 s
 * timer came round. An un-greppable key cannot be invalidated by someone who does not know it
 * exists, so it lives here where a mutation author will find it.
 */

import type { QueryClient } from '@tanstack/react-query';

export const CONTROL_CENTER_KEYS = {
  alerts: ['manufacturing-alerts'] as const,
  pipeline: ['manufacturing-pipeline'] as const,
};

/**
 * Mark the Control Center stale. Call from any mutation that changes what it reports: a job-work
 * receive, a cutting completion, a challan close, a sample approval, a CAD approval.
 */
export function invalidateControlCenter(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: CONTROL_CENTER_KEYS.alerts });
  queryClient.invalidateQueries({ queryKey: CONTROL_CENTER_KEYS.pipeline });
}
