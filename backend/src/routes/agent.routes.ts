/**
 * Agent Master Routes
 * API routes for agent master operations
 */

import { Router } from 'express';
import {
  createAgent,
  getAllAgents,
  getAgentById,
  updateAgent,
  deleteAgent,
  searchAgents,
} from '../controllers/agent.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import { createAgentSchema, updateAgentSchema, agentQuerySchema } from '../schemas/agent.schema';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/agents/search
 * @desc    Search agents for dropdown (minimal data)
 * @access  Private (Authenticated users)
 */
router.get('/search', asyncHandler(searchAgents));

/**
 * @route   POST /api/agents
 * @desc    Create new agent
 * @access  Private (Authenticated users)
 */
router.post('/', validateBody(createAgentSchema), asyncHandler(createAgent));

/**
 * @route   GET /api/agents
 * @desc    Get all agents with pagination and filters
 * @access  Private (Authenticated users)
 */
router.get('/', validateQuery(agentQuerySchema), asyncHandler(getAllAgents));

/**
 * @route   GET /api/agents/:id
 * @desc    Get agent by ID
 * @access  Private (Authenticated users)
 */
router.get('/:id', validateParams(idParamSchema), asyncHandler(getAgentById));

/**
 * @route   PUT /api/agents/:id
 * @desc    Update agent
 * @access  Private (Authenticated users)
 */
router.put('/:id', validateParams(idParamSchema), validateBody(updateAgentSchema), asyncHandler(updateAgent));

/**
 * @route   DELETE /api/agents/:id
 * @desc    Delete agent (soft delete)
 * @access  Private (Authenticated users)
 */
router.delete('/:id', validateParams(idParamSchema), asyncHandler(deleteAgent));

export default router;
