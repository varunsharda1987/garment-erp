/**
 * Conversation Routes
 *
 * API endpoints for managing AI conversations.
 * All routes require authentication.
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import { idParamSchema } from '../schemas/common.schema';
import { conversationService } from '../services/ai/conversation.service';
import { NotFoundError, UnauthorizedError } from '../errors';
import {
  createConversationSchema,
  updateConversationSchema,
  conversationQuerySchema,
  messageQuerySchema,
  type CreateConversationInput,
  type UpdateConversationInput,
  type ConversationQueryInput,
  type MessageQueryInput,
} from '../schemas/conversation.schema';

const router = Router();

// Protect all conversation routes
router.use(authenticateToken);

/**
 * GET /api/conversations
 * List user's conversations
 */
router.get(
  '/',
  validateQuery(conversationQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    const { status, limit, offset, search } = req.query as unknown as ConversationQueryInput;

    const result = await conversationService.getConversations({
      userId,
      status: status as 'ACTIVE' | 'ARCHIVED' | 'DELETED' | undefined,
      limit: limit ?? 50,
      offset: offset ?? 0,
      search: search as string | undefined,
    });

    res.json(result);
  })
);

/**
 * POST /api/conversations
 * Create a new conversation
 */
router.post(
  '/',
  validateBody(createConversationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    const { title } = req.body as CreateConversationInput;

    const conversation = await conversationService.createConversation({
      userId,
      title,
    });

    res.status(201).json(conversation);
  })
);

/**
 * GET /api/conversations/:id
 * Get a single conversation with messages
 */
router.get(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    const { id } = req.params;

    const conversation = await conversationService.getConversation(id, userId);

    if (!conversation) {
      throw new NotFoundError('Conversation', id);
    }

    res.json(conversation);
  })
);

/**
 * PATCH /api/conversations/:id
 * Update conversation (title, status)
 */
router.patch(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateConversationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    const { id } = req.params;
    const { title, status } = req.body as UpdateConversationInput;

    const conversation = await conversationService.updateConversation(id, userId, { title, status });

    res.json(conversation);
  })
);

/**
 * DELETE /api/conversations/:id
 * Soft delete a conversation
 */
// no-body: soft delete keyed off the :id param; no req.body read
router.delete(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    const { id } = req.params;

    await conversationService.deleteConversation(id, userId);

    res.json({ success: true, message: 'Conversation deleted' });
  })
);

/**
 * GET /api/conversations/:id/messages
 * Get messages for a conversation (with pagination)
 */
router.get(
  '/:id/messages',
  validateParams(idParamSchema),
  validateQuery(messageQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    const { id } = req.params;
    const { limit, offset } = req.query as unknown as MessageQueryInput;

    const messages = await conversationService.getMessages(id, userId, limit ?? 100, offset ?? 0);

    res.json(messages);
  })
);

/**
 * GET /api/conversations/stats/summary
 * Get user's AI usage statistics
 */
router.get(
  '/stats/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    const stats = await conversationService.getUserStats(userId);

    res.json(stats);
  })
);

export default router;
