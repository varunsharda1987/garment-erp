/**
 * Agent Service - API calls for agent master operations
 */
import api from '../lib/api';
import type {
  Agent,
  AgentSearchResult,
  AgentListParams,
  AgentListResponse,
  AgentSearchParams,
  CreateAgentRequest,
  UpdateAgentRequest,
} from '../types/agent.types';

const BASE_URL = '/agents';

interface AgentResponse {
  data: Agent;
  message?: string;
}

interface AgentSearchResponse {
  data: AgentSearchResult[];
}

/**
 * Get all agents with pagination and filters
 */
export const getAllAgents = async (params?: AgentListParams): Promise<AgentListResponse> => {
  const { data } = await api.get<AgentListResponse>(BASE_URL, { params });
  return data;
};

/**
 * Get agent by ID
 */
export const getAgentById = async (id: string): Promise<Agent> => {
  const { data } = await api.get<AgentResponse>(`${BASE_URL}/${id}`);
  return data.data;
};

/**
 * Search agents (for dropdowns - minimal data)
 */
export const searchAgents = async (params?: AgentSearchParams): Promise<AgentSearchResult[]> => {
  const { data } = await api.get<AgentSearchResponse>(`${BASE_URL}/search`, { params });
  return data.data;
};

/**
 * Create a new agent
 */
export const createAgent = async (request: CreateAgentRequest): Promise<Agent> => {
  const { data } = await api.post<AgentResponse>(BASE_URL, request);
  return data.data;
};

/**
 * Update an agent
 */
export const updateAgent = async (id: string, request: UpdateAgentRequest): Promise<Agent> => {
  const { data } = await api.put<AgentResponse>(`${BASE_URL}/${id}`, request);
  return data.data;
};

/**
 * Delete an agent (soft delete)
 */
export const deleteAgent = async (id: string): Promise<void> => {
  await api.delete(`${BASE_URL}/${id}`);
};
