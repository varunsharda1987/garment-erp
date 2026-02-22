/**
 * Agency Types
 */

export interface Agency {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  agents?: AgentSummary[];
  _count?: {
    agents: number;
  };
}

export interface AgentSummary {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

export interface CreateAgencyRequest {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive?: boolean;
}

export interface UpdateAgencyRequest {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive?: boolean;
}

export interface AgencyQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AgencySearchResult {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
}

export interface PaginatedAgencies {
  data: Agency[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
