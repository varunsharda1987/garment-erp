/**
 * Conversation Routes
 *
 * API endpoints for managing AI conversations.
 * All routes require authentication.
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { conversationService } from '../services/ai/conversation.service';
import { logError } from '../utils/logger';

const router = Router();

// Protect all conversation routes
router.use(authenticateToken);

/**
 * GET /api/conversations
 * List user's conversations
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
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
  } catch (error) {
    logError('[ConversationRoutes] Failed to list conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * POST /api/conversations
 * Create a new conversation
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { title } = req.body;

    const conversation = await conversationService.createConversation({
      userId,
      title,
    });

    res.status(201).json(conversation);
  } catch (error) {
    logError('[ConversationRoutes] Failed to create conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

/**
 * GET /api/conversations/:id
 * Get a single conversation with messages
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const conversation = await conversationService.getConversation(id, userId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(conversation);
  } catch (error) {
    logError('[ConversationRoutes] Failed to get conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

/**
 * PATCH /api/conversations/:id
 * Update conversation (title, status)
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { title, status } = req.body;

    const conversation = await conversationService.updateConversation(id, userId, { title, status });

    res.json(conversation);
  } catch (error: unknown) {
    logError('[ConversationRoutes] Failed to update conversation:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

/**
 * DELETE /api/conversations/:id
 * Soft delete a conversation
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    await conversationService.deleteConversation(id, userId);

    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error: unknown) {
    logError('[ConversationRoutes] Failed to delete conversation:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

/**
 * GET /api/conversations/:id/messages
 * Get messages for a conversation (with pagination)
 */
router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
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
  } catch (error: unknown) {
    logError('[ConversationRoutes] Failed to get messages:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * GET /api/conversations/stats/summary
 * Get user's AI usage statistics
 */
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const stats = await conversationService.getUserStats(userId);

    res.json(stats);
  } catch (error) {
    logError('[ConversationRoutes] Failed to get stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
