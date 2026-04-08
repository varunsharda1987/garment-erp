export type TCSStatus = 'PENDING' | 'DEPOSITED';

export const TCS_STATUS_LABELS: Record<TCSStatus, string> = {
  PENDING: 'Pending',
  DEPOSITED: 'Deposited',
};

export const TCS_STATUS_COLORS: Record<TCSStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  DEPOSITED: 'bg-success-muted text-success',
};

export const TCS_SECTIONS = [
  { code: '206C(1H)', description: 'Sale of goods (>50L)', rate: 0.1 },
  { code: '206C(1)', description: 'Sale of specified goods', rate: 1 },
];

export interface TCSEntry {
  id: string;
  invoiceId?: string;
  customerName: string;
  tcsSection: string;
  tcsRate: number;
  saleAmount: number;
  tcsAmount: number;
  collectionDate: string;
  financialYear: string;
  quarter: number;
  status: TCSStatus;
  remarks?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTCSRequest {
  invoiceId?: string;
  customerName: string;
  tcsSection: string;
  tcsRate: number;
  saleAmount: number;
  tcsAmount: number;
  collectionDate: string;
  financialYear: string;
  quarter: number;
  remarks?: string;
}

export interface TCSQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  financialYear?: string;
  quarter?: number;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TCSListResponse {
  data: TCSEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface TCSSummary {
  financialYear: string;
  quarterSummary: {
    quarter: number;
    count: number;
    totalSaleAmount: number;
    totalTCS: number;
    pending: number;
    deposited: number;
  }[];
  totalEntries: number;
  totalSaleAmount: number;
  totalTCS: number;
}
