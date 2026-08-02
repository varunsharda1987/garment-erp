/**
 * Agent Master Validation Schemas
 *
 * Zod schemas for agent master CRUD operations.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 *
 * ALIGNED with Prisma schema (agents model) and controller fields:
 * - name, phone, email, address, agencyId, isActive
 * - code is auto-generated (AGT-XXX), not user input
 */

import { z } from 'zod';

// ============================================================================
// AGENT SCHEMAS
// ============================================================================

/**
 * Create Agent
 * POST /api/agents
 * Fields match Prisma schema and controller destructuring
 */
export const createAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  phone: z.string().max(20).optional(),
  email: z.string().email('Invalid email').max(100).optional(),
  address: z.string().max(500).optional(),
  agencyId: z.string().uuid('Invalid agency ID').optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

/**
 * Update Agent
 * PUT /api/agents/:id
 * Fields match Prisma schema and controller destructuring
 */
export const updateAgentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email('Invalid email').max(100).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  agencyId: z.string().uuid('Invalid agency ID').optional().nullable(),
  isActive: z.boolean().optional(),
});

/**
 * Query Agents
 * GET /api/agents
 */
export const agentQuerySchema = z.object({
  page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  search: z.string().max(100).optional(),
  isActive: z
    .string()
    .transform((val) => val.toLowerCase() === 'true')
    .optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type AgentQueryInput = z.infer<typeof agentQuerySchema>;
