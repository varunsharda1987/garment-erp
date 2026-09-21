/**
 * Where to go to CLEAR a production blocker.
 *
 * This map lives in the frontend on purpose. The backend already tried owning routes once —
 * `orderProductionStatus.service.ts` emits `suggestedActions` pointing at `/styles/:id/costing` and
 * `/work-orders?orderId=…`, neither of which is a registered route any more. A server has no way to
 * know when `App.tsx` changes; this file sits next to it and is covered by the route test.
 *
 * Returning `null` for an unrecognised blocker is deliberate: no button is better than a button
 * that lands on `/`, which is what the old alert rows did with their `|| '/'` fallback.
 */

import type { PipelineBlocker, PipelineOrder } from '@/services/manufacturingAlerts.service';

export interface BlockerRoute {
  label: string;
  to: string;
}

export function resolveBlockerRoute(blocker: PipelineBlocker, order: PipelineOrder): BlockerRoute | null {
  switch (blocker.type) {
    case 'PRODUCTION_CAD_MISSING':
      // CADPlanningPage takes the style id (App.tsx: /cad-planning/:id).
      return order.styleId ? { label: 'CAD Planning', to: `/cad-planning/${order.styleId}` } : null;

    case 'FIT_SAMPLE_NOT_APPROVED':
    case 'PP_SAMPLE_NOT_APPROVED':
    case 'SIZE_SET_SAMPLE_NOT_APPROVED':
      // SampleList does not read a styleId param, so link it bare rather than ship a dead filter.
      return { label: 'Samples', to: '/samples' };

    case 'MISSING_BOM':
      return { label: 'Order BOM', to: '/order-bom' };

    case 'MATERIAL_SHORTAGE':
      return { label: 'Requirements', to: '/procurement/requirements' };

    case 'FPT_NOT_PASSED':
      return { label: 'Fabric tests', to: '/fabric-physical-tests?status=FAIL' };

    case 'GPT_NOT_PASSED':
      return { label: 'Garment tests', to: '/garment-physical-tests?status=FAIL' };

    default:
      return null;
  }
}

/** Every route this module can produce, for the route-integrity test. */
export const BLOCKER_ROUTE_PATHS = [
  '/cad-planning/:id',
  '/samples',
  '/order-bom',
  '/procurement/requirements',
  '/fabric-physical-tests',
  '/garment-physical-tests',
] as const;
