/**
 * Tax Master Types
 */

export type TaxType = 'GST' | 'IGST' | 'CGST' | 'SGST' | 'CESS' | 'CUSTOM' | 'TDS' | 'TCS';

export interface TaxMaster {
  id: string;
  taxCode: string;
  taxName: string;
  taxType: TaxType;
  taxRate: number;
  hsnSacCode: string | null;
  description: string | null;
  applicableFrom: string;
  applicableTo: string | null;
  isActive: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  users?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface CreateTaxMasterRequest {
  taxCode: string;
  taxName: string;
  taxType: TaxType;
  taxRate: number;
  hsnSacCode?: string;
  description?: string;
  applicableFrom: string;
  applicableTo?: string;
}

export interface UpdateTaxMasterRequest {
  taxCode?: string;
  taxName?: string;
  taxType?: TaxType;
  taxRate?: number;
  hsnSacCode?: string;
  description?: string;
  applicableFrom?: string;
  applicableTo?: string;
}

export interface TaxMasterQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  taxType?: TaxType;
  activeOnly?: boolean;
}

export interface PaginatedTaxMasters {
  data: TaxMaster[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number; // backend returns totalPages, not pages (bug-hunt orders-13)
  };
}
