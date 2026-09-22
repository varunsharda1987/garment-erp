import api from '@/lib/api';

export interface AlertCount {
  count: number;
  oldestDays: number;
}

export interface VendorSummary {
  vendorId: string;
  vendorName: string;
  type: string;
  itemsOut: number;
  totalQty: number;
  unit: string;
  oldestSendoutDays: number;
  nextExpectedBack: string | null;
  status: 'ON_TRACK' | 'DUE_SOON' | 'OVERDUE';
}

// P5.4: Variance alert types
export interface VarianceAlert {
  id: string;
  type: 'CUTTING' | 'GRN_OVER' | 'GRN_UNDER' | 'COST';
  referenceNumber: string;
  description: string;
  variancePercent: number;
  route: string;
  date: string;
}

/** The four blocks the page can render. */
export type SectionKey = 'pipeline' | 'alerts' | 'vendors' | 'variance';

export type AlertKey =
  | 'overdueLabDips'
  | 'overdueProcessPOs'
  | 'overdueExternalWork'
  | 'stuckCutting'
  | 'qualityFailures'
  | 'pendingApprovals'
  | 'overdueChallans';

/**
 * What this role's page should show, decided by the server (`control-center-panels.ts`).
 *
 * The frontend deliberately keeps NO copy of the role→panel map: one source of truth means the
 * two cannot drift. Both lists are ORDERED — render in the order given.
 */
export interface ControlCenterPanels {
  sections: SectionKey[];
  alerts: AlertKey[];
}

export interface ManufacturingAlertsResponse {
  /**
   * Only the rows in scope for this role. A key that is ABSENT was never computed — which is not
   * the same as a row that came back zero, and must never be rendered as one.
   */
  alerts: Partial<Record<AlertKey, AlertCount>>;
  panels: ControlCenterPanels;
  vendorSummary: VendorSummary[];
  quickStats: {
    totalAlerts: number;
    itemsWithVendors: number;
    dueThisWeek: number;
    overdue: number;
  };
  // P5.4: Variance watchtower
  varianceAlerts: VarianceAlert[];
}

/** A prerequisite standing between an order and a production stage. */
export interface PipelineBlocker {
  type: string;
  message: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

export interface PipelineOrder {
  orderItemId: string;
  orderId: string;
  orderNumber: string;
  styleId: string | null;
  styleCode: string;
  styleName: string;
  buyerStyleRef: string | null;
  customerName: string | null;
  quantity: number;
  nextStage: string;
  workOrderCount: number;
  expectedDeliveryDate: string | null;
  daysToDelivery: number | null;
  isBlocked: boolean;
  blockers: PipelineBlocker[];
  /** False before a work order exists — the garment test cannot be evaluated yet. */
  gptEvaluated: boolean;
}

export interface PipelineResponse {
  orders: PipelineOrder[];
  counts: { total: number; blocked: number; ready: number; running: number };
  truncated: boolean;
  generatedAt: string;
}

/**
 * Thrown when a response arrives but is not the shape we expect.
 *
 * Every field on this page used to be read as `x || 0` / `y || []`, so a renamed or truncated
 * payload rendered as a confident green "All Clear!" — indistinguishable from real good news, and
 * the reason the page could not be trusted. A missing key is now an error, not a zero.
 */
export class ControlCenterShapeError extends Error {
  readonly feeder: string;
  readonly missing: string[];

  constructor(feeder: string, missing: string[]) {
    super(`${feeder} response is missing: ${missing.join(', ')}`);
    this.name = 'ControlCenterShapeError';
    this.feeder = feeder;
    this.missing = missing;
  }
}

function assertAlertsShape(raw: unknown): ManufacturingAlertsResponse {
  const missing: string[] = [];
  const body = raw as Partial<ManufacturingAlertsResponse> | null | undefined;

  if (!body || typeof body !== 'object') throw new ControlCenterShapeError('Alerts', ['(empty response)']);
  if (!body.alerts || typeof body.alerts !== 'object') missing.push('alerts');
  if (!body.panels || !Array.isArray(body.panels.sections) || !Array.isArray(body.panels.alerts)) {
    missing.push('panels');
  } else if (body.alerts) {
    // Validate against what the SERVER said this role should get, not a fixed list of seven.
    // A scoped payload is correct, not malformed — but a row the server promised and then failed
    // to send is still a broken payload, and the page must say so rather than draw a zero.
    for (const key of body.panels.alerts) {
      if (!(key in body.alerts)) missing.push(`alerts.${key}`);
    }
  }
  if (!body.quickStats || typeof body.quickStats !== 'object') missing.push('quickStats');
  if (!Array.isArray(body.vendorSummary)) missing.push('vendorSummary');
  if (!Array.isArray(body.varianceAlerts)) missing.push('varianceAlerts');

  if (missing.length > 0) throw new ControlCenterShapeError('Alerts', missing);
  return body as ManufacturingAlertsResponse;
}

function assertPipelineShape(raw: unknown): PipelineResponse {
  const missing: string[] = [];
  const body = raw as Partial<PipelineResponse> | null | undefined;

  if (!body || typeof body !== 'object') throw new ControlCenterShapeError('Pipeline', ['(empty response)']);
  if (!Array.isArray(body.orders)) missing.push('orders');
  if (!body.counts || typeof body.counts !== 'object') missing.push('counts');

  if (missing.length > 0) throw new ControlCenterShapeError('Pipeline', missing);
  return body as PipelineResponse;
}

export const manufacturingAlertsService = {
  async getAlerts(): Promise<ManufacturingAlertsResponse> {
    const response = await api.get<{ success: boolean; data: ManufacturingAlertsResponse }>('/manufacturing/alerts');
    return assertAlertsShape(response.data?.data);
  },

  async getPipeline(): Promise<PipelineResponse> {
    const response = await api.get<{ success: boolean; data: PipelineResponse }>('/manufacturing/pipeline');
    return assertPipelineShape(response.data?.data);
  },
};
