/**
 * Conversation Routes
 *
 * API endpoints for managing AI conversations.
 * All routes require authentication.
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { conversationService } from '../services/ai/conversation.service';
import { NotFoundError, UnauthorizedError } from '../errors';

const router = Router();

// Protect all conversation routes
router.use(authenticateToken);

/**
 * GET /api/conversations
 * List user's conversations
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    const { status, limit, offset, search } = req.query;

    const result = await conversationService.getConversations({
      userId,
      status: status as 'ACTIVE' | 'ARCHIVED' | 'DELETED' | undefined,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
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
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    const { title } = req.body;

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
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    const { id } = req.params;
    const { title, status } = req.body;

    const conversation = await conversationService.updateConversation(id, userId, { title, status });

    res.json(conversation);
  })
);

/**
 * DELETE /api/conversations/:id
 * Soft delete a conversation
 */
router.delete(
  '/:id',
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
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError();
    }

    const { id } = req.params;
    const { limit, offset } = req.query;

    const messages = await conversationService.getMessages(
      id,
      userId,
      limit ? parseInt(limit as string) : 100,
      offset ? parseInt(offset as string) : 0
    );

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
