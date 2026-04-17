/**
 * Agent Master Controller
 * Handles HTTP requests for agent master operations
 *
 * Uses asyncHandler in routes - errors propagate to global error middleware
 */

import { Request, Response } from 'express';
import { AgentService } from '../services/agent.service';
import { ValidationError } from '../errors';

/**
 * Create new agent
 * POST /api/agents
 */
export const createAgent = async (req: Request, res: Response): Promise<void> => {
  const { name, phone, email, address, agencyId, isActive } = req.body;

  if (!name || !name.trim()) {
    throw new ValidationError('Agent name is required');
  }

  const agent = await AgentService.createAgent({ name, phone, email, address, agencyId, isActive });

  res.status(201).json({
    data: agent,
    message: 'Agent created successfully',
  });
};

/**
 * Get all agents with pagination and filters
 * GET /api/agents
 */
export const getAllAgents = async (req: Request, res: Response): Promise<void> => {
  const { page, limit, search, sortBy, sortOrder, isActive, agencyId } = req.query;

  const result = await AgentService.getAllAgents({
    page: Number(page) || 1,
    limit: Number(limit) || 50,
    search: search as string | undefined,
    sortBy: sortBy as string | undefined,
    sortOrder: sortOrder as 'asc' | 'desc' | undefined,
    isActive: isActive !== undefined ? String(isActive) === 'true' : undefined,
    agencyId: agencyId as string | undefined,
  });

  res.json({
    data: result.data,
    pagination: result.pagination,
  });
};

/**
 * Get agent by ID
 * GET /api/agents/:id
 */
export const getAgentById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const agent = await AgentService.getById(id);

  res.json({ data: agent });
};

/**
 * Update agent
 * PUT /api/agents/:id
 */
export const updateAgent = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, phone, email, address, agencyId, isActive } = req.body;

  const agent = await AgentService.updateAgent(id, { name, phone, email, address, agencyId, isActive });

  res.json({
    data: agent,
    message: 'Agent updated successfully',
  });
};

/**
 * Delete agent (soft delete)
 * DELETE /api/agents/:id
 */
export const deleteAgent = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  await AgentService.deleteAgent(id);

  res.json({ message: 'Agent deleted successfully' });
};

/**
 * Search agents (for dropdowns)
 * GET /api/agents/search
 */
export const searchAgents = async (req: Request, res: Response): Promise<void> => {
  const { search, limit, agencyId } = req.query;

  const agents = await AgentService.searchAgents({
    search: search as string | undefined,
    limit: limit ? Number(limit) : 50,
    agencyId: agencyId as string | undefined,
  });

  res.json({ data: agents });
};
