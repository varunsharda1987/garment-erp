/**
 * HSN/SAC Master Types
 * HSN = Harmonized System of Nomenclature (goods)
 * SAC = Service Accounting Code (services)
 */

export type HSNSACType = 'HSN' | 'SAC';

export interface HSNSACMaster {
  id: string;
  code: string;
  type: HSNSACType;
  description: string;
  chapter: string | null;
  section: string | null;
  defaultGstRate: number;
  unit: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHSNSACRequest {
  code: string;
  type: HSNSACType;
  description: string;
  chapter?: string;
  section?: string;
  defaultGstRate: number;
  unit?: string;
  isActive?: boolean;
}

export interface UpdateHSNSACRequest {
  code?: string;
  type?: HSNSACType;
  description?: string;
  chapter?: string;
  section?: string;
  defaultGstRate?: number;
  unit?: string;
  isActive?: boolean;
}

export interface HSNSACQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: HSNSACType;
  chapter?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface HSNSACSearchResult {
  id: string;
  code: string;
  type: HSNSACType;
  description: string;
  defaultGstRate: number;
  unit: string | null;
}

export interface PaginatedHSNSACMasters {
  data: HSNSACMaster[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
