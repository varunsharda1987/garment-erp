/**
 * Agent Master Controller
 * Handles HTTP requests for agent master operations
 */

import { Request, Response } from 'express';
import { AgentService } from '../services/agent.service';
import { logError } from '../utils/logger';
import { NotFoundError, ConflictError } from '../errors';

/**
 * Query input types
 */
interface AgentQueryInput {
  page?: string;
  limit?: string;
  search?: string;
  isActive?: string;
  agencyId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface CreateAgentInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  agencyId?: string;
  isActive?: boolean;
}

interface UpdateAgentInput {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  agencyId?: string | null;
  isActive?: boolean;
}

/**
 * Create new agent
 * POST /api/agents
 */
export const createAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    const data: CreateAgentInput = req.body;

    if (!data.name || !data.name.trim()) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Agent name is required',
      });
      return;
    }

    const agent = await AgentService.createAgent(data);

    res.status(201).json({
      data: agent,
      message: 'Agent created successfully',
    });
  } catch (error) {
    if (error instanceof ConflictError) {
      res.status(409).json({
        error: 'Conflict',
        message: error.message,
      });
      return;
    }
    logError('Create agent error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create agent',
    });
  }
};

/**
 * Get all agents with pagination and filters
 * GET /api/agents
 */
export const getAllAgents = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query as unknown as AgentQueryInput;

    const result = await AgentService.getAllAgents({
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 50,
      search: query.search,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      isActive: query.isActive !== undefined ? String(query.isActive) === 'true' : undefined,
      agencyId: query.agencyId,
    });

    res.json({
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logError('Get all agents error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch agents',
    });
  }
};

/**
 * Get agent by ID
 * GET /api/agents/:id
 */
export const getAgentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const agent = await AgentService.getById(id);

    res.json({
      data: agent,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
      return;
    }
    logError('Get agent by ID error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch agent',
    });
  }
};

/**
 * Update agent
 * PUT /api/agents/:id
 */
export const updateAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data: UpdateAgentInput = req.body;
    const agent = await AgentService.updateAgent(id, data);

    res.json({
      data: agent,
      message: 'Agent updated successfully',
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
      return;
    }
    if (error instanceof ConflictError) {
      res.status(409).json({
        error: 'Conflict',
        message: error.message,
      });
      return;
    }
    logError('Update agent error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update agent',
    });
  }
};

/**
 * Delete agent (soft delete)
 * DELETE /api/agents/:id
 */
export const deleteAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await AgentService.deleteAgent(id);

    res.json({
      message: 'Agent deleted successfully',
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      res.status(404).json({
        error: 'Not Found',
        message: error.message,
      });
      return;
    }
    logError('Delete agent error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete agent',
    });
  }
};

/**
 * Search agents (for dropdowns)
 * GET /api/agents/search
 */
export const searchAgents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, limit, agencyId } = req.query;
    const agents = await AgentService.searchAgents({
      search: search as string,
      limit: limit ? Number(limit) : 50,
      agencyId: agencyId as string | undefined,
    });

    res.json({
      data: agents,
    });
  } catch (error) {
    logError('Search agents error', error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to search agents',
    });
  }
};
