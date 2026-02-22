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

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/agents/search
 * @desc    Search agents for dropdown (minimal data)
 * @access  Private (Authenticated users)
 */
router.get('/search', searchAgents);

/**
 * @route   POST /api/agents
 * @desc    Create new agent
 * @access  Private (Authenticated users)
 */
router.post('/', createAgent);

/**
 * @route   GET /api/agents
 * @desc    Get all agents with pagination and filters
 * @access  Private (Authenticated users)
 */
router.get('/', getAllAgents);

/**
 * @route   GET /api/agents/:id
 * @desc    Get agent by ID
 * @access  Private (Authenticated users)
 */
router.get('/:id', getAgentById);

/**
 * @route   PUT /api/agents/:id
 * @desc    Update agent
 * @access  Private (Authenticated users)
 */
router.put('/:id', updateAgent);

/**
 * @route   DELETE /api/agents/:id
 * @desc    Delete agent (soft delete)
 * @access  Private (Authenticated users)
 */
router.delete('/:id', deleteAgent);

export default router;
