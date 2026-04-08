export type TDSStatus = 'PENDING' | 'CERTIFICATE_RECEIVED' | 'VERIFIED';

export const TDS_STATUS_LABELS: Record<TDSStatus, string> = {
  PENDING: 'Pending',
  CERTIFICATE_RECEIVED: 'Certificate Received',
  VERIFIED: 'Verified',
};

export const TDS_STATUS_COLORS: Record<TDSStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CERTIFICATE_RECEIVED: 'bg-info-muted text-info',
  VERIFIED: 'bg-success-muted text-success',
};

export const TDS_SECTIONS = [
  { code: '194C', description: 'Payment to contractor', rate: 1 },
  { code: '194C-Company', description: 'Payment to contractor (company)', rate: 2 },
  { code: '194J', description: 'Professional/Technical fees', rate: 10 },
  { code: '194H', description: 'Commission/Brokerage', rate: 5 },
  { code: '194I(a)', description: 'Rent - Plant/Machinery', rate: 2 },
  { code: '194I(b)', description: 'Rent - Land/Building', rate: 10 },
  { code: '194Q', description: 'Purchase of goods (>50L)', rate: 0.1 },
];

export interface TDSEntry {
  id: string;
  invoiceId?: string;
  paymentId?: string;
  deductorName: string;
  deducteeName: string;
  tdsSection: string;
  tdsRate: number;
  grossAmount: number;
  tdsAmount: number;
  netAmount: number;
  certificateNo?: string;
  deductionDate: string;
  financialYear: string;
  quarter: number;
  status: TDSStatus;
  remarks?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTDSRequest {
  invoiceId?: string;
  paymentId?: string;
  deductorName: string;
  deducteeName: string;
  tdsSection: string;
  tdsRate: number;
  grossAmount: number;
  tdsAmount: number;
  netAmount: number;
  certificateNo?: string;
  deductionDate: string;
  financialYear: string;
  quarter: number;
  remarks?: string;
}

export interface TDSQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  financialYear?: string;
  quarter?: number;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TDSListResponse {
  data: TDSEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface TDSSummary {
  financialYear: string;
  quarterSummary: {
    quarter: number;
    count: number;
    totalGross: number;
    totalTDS: number;
    totalNet: number;
    pending: number;
    certificateReceived: number;
    verified: number;
  }[];
  totalEntries: number;
  totalGross: number;
  totalTDS: number;
  totalNet: number;
}
