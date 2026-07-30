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

export interface ManufacturingAlertsResponse {
  alerts: {
    overdueLabDips: AlertCount;
    overdueProcessPOs: AlertCount;
    overdueExternalWork: AlertCount;
    stuckCutting: AlertCount;
    qualityFailures: AlertCount;
    pendingApprovals: AlertCount;
    overdueChallans: AlertCount;
  };
  vendorSummary: VendorSummary[];
  quickStats: {
    totalAlerts: number;
    itemsWithVendors: number;
    dueThisWeek: number;
    overdue: number;
  };
}

export const manufacturingAlertsService = {
  async getAlerts(): Promise<ManufacturingAlertsResponse> {
    const response = await api.get<{ success: boolean; data: ManufacturingAlertsResponse }>('/manufacturing/alerts');
    return response.data.data;
  },
};
