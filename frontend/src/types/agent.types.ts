/**
 * Agent Types
 * Type definitions for Agent master
 */

export interface Agent {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  agencyId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  agency?: {
    id: string;
    code: string;
    name: string;
  } | null;
  _count?: {
    customers: number;
  };
}

export interface AgentSearchResult {
  id: string;
  code: string;
  name: string;
  phone: string | null;
}

export interface CreateAgentRequest {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  agencyId?: string;
  isActive?: boolean;
}

export interface UpdateAgentRequest {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  agencyId?: string | null;
  isActive?: boolean;
}

export interface AgentListParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  agencyId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AgentListResponse {
  data: Agent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AgentSearchParams {
  search?: string;
  limit?: number;
  agencyId?: string;
}
