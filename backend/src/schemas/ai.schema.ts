/**
 * AI Validation Schemas
 *
 * Zod schemas for AI-powered features.
 * These are the SINGLE SOURCE OF TRUTH for field definitions.
 */

import { z } from 'zod';

// ============================================================================
// AI CHAT SCHEMAS
// ============================================================================

const ConversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
});

/**
 * Chat
 * POST /api/ai/chat
 */
export const chatSchema = z.object({
  message: z.string().min(1, 'Message is required').max(5000),
  conversationHistory: z.array(ConversationMessageSchema).optional().default([]),
});

// ============================================================================
// SESSION TRAIL
// ============================================================================

/**
 * What the browser remembers about the user's last few minutes: the page they came from,
 * the API errors they hit, and the pages they visited. Attached to chat messages (so the
 * assistant can cite the exact error the user just got) and to issue reports.
 * Paths and server messages only — never request bodies or headers.
 */
export const trailErrorSchema = z.object({
  at: z.string().max(40),
  method: z.string().max(10),
  url: z.string().max(200),
  status: z.number().int().min(400).max(599),
  message: z.string().max(200),
  pageRoute: z.string().max(200).optional(),
});

export const trailPageSchema = z.object({
  at: z.string().max(40),
  path: z.string().max(200),
});

export const sessionTrailSchema = z.object({
  pageRoute: z.string().max(200).optional(),
  recentErrors: z.array(trailErrorSchema).max(10).optional(),
  recentPages: z.array(trailPageSchema).max(10).optional(),
});

/**
 * Chat Persistent
 * POST /api/ai/chat/persistent
 */
export const chatPersistentSchema = z.object({
  message: z.string().min(1, 'Message is required').max(5000),
  conversationId: z.string().uuid('Invalid conversation ID').optional(),
  context: sessionTrailSchema.optional(),
});

/**
 * Suggestions
 * GET /api/ai/suggestions?pageRoute=/styles/new
 */
export const suggestionsQuerySchema = z.object({
  pageRoute: z.string().max(200).optional(),
});

/**
 * AI Feedback
 * POST /api/ai/feedback
 */
export const feedbackSchema = z.object({
  messageId: z.string().uuid('Invalid message ID'),
  rating: z.enum(['HELPFUL', 'NOT_HELPFUL']),
  issueType: z.string().max(50).optional(),
  comment: z.string().max(1000).optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type ChatInput = z.infer<typeof chatSchema>;
export type ChatPersistentInput = z.infer<typeof chatPersistentSchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type TrailError = z.infer<typeof trailErrorSchema>;
export type TrailPage = z.infer<typeof trailPageSchema>;
export type SessionTrail = z.infer<typeof sessionTrailSchema>;
export type SuggestionsQueryInput = z.infer<typeof suggestionsQuerySchema>;
