/**
 * Conversation Validation Schemas
 *
 * Zod schemas for AI conversation management.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const ConversationStatusEnum = z.enum(['ACTIVE', 'ARCHIVED', 'DELETED']);

// ============================================================================
// CONVERSATION SCHEMAS
// ============================================================================

/**
 * Create Conversation
 * POST /api/conversations
 */
export const createConversationSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200).optional(),
});

/**
 * Update Conversation
 * PATCH /api/conversations/:id
 */
export const updateConversationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: ConversationStatusEnum.optional(),
});

/**
 * Query Conversations
 * GET /api/conversations
 */
export const conversationQuerySchema = z.object({
  status: ConversationStatusEnum.optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  offset: z.string().transform(Number).pipe(z.number().int().nonnegative()).optional(),
  search: z.string().max(100).optional(),
});

/**
 * Query Messages
 * GET /api/conversations/:id/messages
 */
export const messageQuerySchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(500)).optional(),
  offset: z.string().transform(Number).pipe(z.number().int().nonnegative()).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
export type ConversationQueryInput = z.infer<typeof conversationQuerySchema>;
export type MessageQueryInput = z.infer<typeof messageQuerySchema>;
