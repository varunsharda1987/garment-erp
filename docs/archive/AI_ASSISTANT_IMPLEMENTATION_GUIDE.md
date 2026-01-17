# AI Assistant Enhancement - Implementation Guide

> **Document Version:** 1.0
> **Created:** December 2024
> **Purpose:** Complete technical reference for implementing AI enhancements
> **Project:** Kashaya Fabs Garment ERP

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Phase 1: Persistent Conversation Memory](#3-phase-1-persistent-conversation-memory)
4. [Phase 2: ERP Database Context Injection](#4-phase-2-erp-database-context-injection)
5. [Phase 3: RAG with pgvector](#5-phase-3-rag-with-pgvector)
6. [Safeguards & Permissions](#6-safeguards--permissions)
7. [Environment Configuration](#7-environment-configuration)
8. [Testing Checklist](#8-testing-checklist)

---

## 1. Overview

### 1.1 Current State

| Component | Location | Status |
|-----------|----------|--------|
| AI Provider Abstraction | `backend/src/services/ai/providers/` | ✅ Complete |
| AI Routes | `backend/src/routes/ai.routes.ts` | ✅ Basic |
| Frontend Chat UI | `frontend/src/pages/AIAssistant.tsx` | ✅ Basic |
| Conversation Persistence | - | ❌ Not Implemented |
| ERP Data Context | - | ❌ Not Implemented |
| RAG/Vector Search | - | ❌ Not Implemented |

### 1.2 What We're Building

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI ASSISTANT ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  USER → [Frontend UI] → [API Routes] → [Services] → [AI Provider]│
│                              │                                   │
│                              ├── Conversation Service            │
│                              ├── Permission Service (Role-based) │
│                              ├── ERP Context Service             │
│                              └── RAG Service (Vector Search)     │
│                                                                  │
│  STORAGE:                                                        │
│  ├── PostgreSQL: Conversations, Messages, Feedback              │
│  └── pgvector: Document Embeddings (for RAG)                    │
│                                                                  │
│  AI PROVIDERS (Multi-Provider with Fallback):                   │
│  ├── Primary: Claude (Anthropic)                                │
│  ├── Fallback: Ollama (Local)                                   │
│  └── Embeddings: OpenAI (Claude doesn't support embeddings)     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Key Features

| Feature | Description |
|---------|-------------|
| **Persistent Memory** | Conversations saved to database, survive page refresh |
| **Role-Based Access** | AI filters data based on user's role |
| **ERP Context** | AI can query real orders, styles, inventory |
| **RAG** | AI understands system documentation |
| **Feedback Collection** | Users can rate AI responses |
| **Audit Logging** | All AI actions are logged |

---

## 2. Architecture

### 2.1 Existing AI Provider Files

```
backend/src/services/ai/
├── providers/
│   ├── IAIProvider.ts           # Interface definition
│   ├── AIProviderFactory.ts     # Factory pattern
│   ├── AnthropicProvider.ts     # Claude integration
│   ├── OpenAIProvider.ts        # GPT integration
│   ├── GeminiProvider.ts        # Google Gemini
│   ├── OllamaProvider.ts        # Local Ollama
│   └── MultiProviderFallback.ts # Fallback mechanism
└── insights.service.ts          # Dashboard insights
```

### 2.2 New Files to Create

```
backend/src/
├── services/ai/
│   ├── conversation.service.ts      # NEW: Conversation CRUD
│   ├── ai-permission.service.ts     # NEW: Role-based filtering
│   ├── erp-context.service.ts       # NEW: ERP data injection
│   ├── embedding.service.ts         # NEW: Vector embeddings
│   ├── rag.service.ts               # NEW: RAG retrieval
│   └── indexing.service.ts          # NEW: Document indexing
├── routes/
│   ├── conversation.routes.ts       # NEW: Conversation API
│   └── ai-admin.routes.ts           # NEW: Admin indexing API
└── types/
    └── ai.types.ts                  # NEW: AI type definitions

frontend/src/
├── services/
│   └── conversation.service.ts      # NEW: Frontend API
├── components/
│   ├── ConversationSidebar.tsx      # NEW: Chat history
│   └── AIFeedback.tsx               # NEW: Feedback widget
└── pages/
    └── AIAssistant.tsx              # MODIFY: Full redesign
```

### 2.3 Files to Modify

| File | Changes |
|------|---------|
| `backend/prisma/schema.prisma` | Add AI models (conversations, messages, feedback, enums) |
| `backend/src/routes/index.ts` | Register new routes |
| `backend/src/routes/ai.routes.ts` | Add conversationId, feedback, suggestions |
| `backend/src/app.ts` | Configure MultiProvider fallback |
| `backend/src/services/audit.service.ts` | Add AI audit types |
| `backend/.env` | Add new AI configuration variables |

---

## 3. Phase 1: Persistent Conversation Memory

### 3.1 Database Schema

**File:** `backend/prisma/schema.prisma`

Add at the end of the file:

```prisma
// ============================================
// AI CONVERSATION MODELS
// ============================================

model ai_conversations {
  id            String             @id @default(uuid())
  userId        String
  title         String?
  status        ConversationStatus @default(ACTIVE)
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt
  lastMessageAt DateTime           @default(now())

  // Relations
  user          users              @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages      ai_messages[]

  @@index([userId])
  @@index([status])
  @@index([lastMessageAt])
}

model ai_messages {
  id              String        @id @default(uuid())
  conversationId  String
  role            AIMessageRole
  content         String        @db.Text
  provider        String?
  model           String?
  tokensUsed      Int?
  latencyMs       Int?

  // For action messages (when AI proposes changes)
  actionType      String?       // 'create', 'update', 'status_change'
  actionEntity    String?       // 'style', 'order', etc.
  actionPayload   Json?         // The proposed changes
  actionStatus    ActionStatus?

  metadata        Json?
  createdAt       DateTime      @default(now())

  // Relations
  conversation    ai_conversations @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  feedback        ai_feedback[]

  @@index([conversationId])
  @@index([createdAt])
}

model ai_feedback {
  id          String         @id @default(uuid())
  messageId   String
  userId      String
  rating      FeedbackRating
  issueType   String?        // 'wrong_info', 'incomplete', 'slow', 'other'
  comment     String?
  createdAt   DateTime       @default(now())

  // Relations
  message     ai_messages    @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user        users          @relation(fields: [userId], references: [id])

  @@index([messageId])
  @@index([userId])
}

enum ConversationStatus {
  ACTIVE
  ARCHIVED
  DELETED
}

enum AIMessageRole {
  USER
  ASSISTANT
  SYSTEM
}

enum ActionStatus {
  PENDING
  CONFIRMED
  REJECTED
  EXECUTED
  EXPIRED
}

enum FeedbackRating {
  HELPFUL
  NOT_HELPFUL
}
```

**Also add relation to users model:**

```prisma
// In the existing users model, add these lines:
model users {
  // ... existing fields ...

  // AI Relations (add these)
  ai_conversations ai_conversations[]
  ai_feedback      ai_feedback[]
}
```

### 3.2 Conversation Service

**File:** `backend/src/services/ai/conversation.service.ts`

```typescript
/**
 * AI Conversation Service
 * Manages persistent conversation storage and retrieval
 */

import prisma from '../../config/database';
import { ai_conversations, ai_messages, AIMessageRole, ConversationStatus } from '@prisma/client';
import { logInfo, logError, logDebug } from '../../utils/logger';
import { AIProviderFactory } from './providers/AIProviderFactory';

// ============================================
// TYPES
// ============================================

export interface CreateConversationDTO {
  userId: string;
  title?: string;
}

export interface AddMessageDTO {
  conversationId: string;
  role: AIMessageRole;
  content: string;
  provider?: string;
  model?: string;
  tokensUsed?: number;
  latencyMs?: number;
  actionType?: string;
  actionEntity?: string;
  actionPayload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ConversationWithMessages extends ai_conversations {
  messages: ai_messages[];
}

export interface ConversationListItem {
  id: string;
  title: string | null;
  messageCount: number;
  lastMessageAt: Date | null;
  createdAt: Date;
}

// ============================================
// SERVICE
// ============================================

class ConversationServiceClass {

  /**
   * Create a new conversation
   */
  async create(data: CreateConversationDTO): Promise<ai_conversations> {
    logDebug('Creating new AI conversation', { userId: data.userId });

    const conversation = await prisma.ai_conversations.create({
      data: {
        userId: data.userId,
        title: data.title || 'New Conversation',
      },
    });

    logInfo('AI conversation created', { id: conversation.id });
    return conversation;
  }

  /**
   * Get conversation by ID with messages
   */
  async getById(id: string, userId: string): Promise<ConversationWithMessages | null> {
    const conversation = await prisma.ai_conversations.findFirst({
      where: {
        id,
        userId,
        status: { not: 'DELETED' }
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return conversation;
  }

  /**
   * Get all conversations for a user (paginated)
   */
  async getByUser(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: ConversationListItem[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      prisma.ai_conversations.findMany({
        where: { userId, status: { not: 'DELETED' } },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { messages: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true },
          },
        },
      }),
      prisma.ai_conversations.count({
        where: { userId, status: { not: 'DELETED' } },
      }),
    ]);

    const data: ConversationListItem[] = conversations.map((c) => ({
      id: c.id,
      title: c.title,
      messageCount: c._count.messages,
      lastMessageAt: c.messages[0]?.createdAt || null,
      createdAt: c.createdAt,
    }));

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(data: AddMessageDTO): Promise<ai_messages> {
    const message = await prisma.ai_messages.create({
      data: {
        conversationId: data.conversationId,
        role: data.role,
        content: data.content,
        provider: data.provider,
        model: data.model,
        tokensUsed: data.tokensUsed,
        latencyMs: data.latencyMs,
        actionType: data.actionType,
        actionEntity: data.actionEntity,
        actionPayload: data.actionPayload,
        metadata: data.metadata,
      },
    });

    // Update conversation timestamp
    await prisma.ai_conversations.update({
      where: { id: data.conversationId },
      data: {
        lastMessageAt: new Date(),
        updatedAt: new Date()
      },
    });

    return message;
  }

  /**
   * Auto-generate title from first user message
   */
  async generateTitle(conversationId: string): Promise<string> {
    const conversation = await prisma.ai_conversations.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          where: { role: 'USER' },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    if (!conversation || conversation.messages.length === 0) {
      return 'New Conversation';
    }

    const firstMessage = conversation.messages[0].content;

    // Try AI-generated title
    if (AIProviderFactory.isInitialized()) {
      try {
        const ai = AIProviderFactory.getProvider();
        const response = await ai.generateText({
          systemPrompt: 'Generate a short (3-6 words) title for this conversation. Respond with ONLY the title, no quotes.',
          prompt: firstMessage,
          maxTokens: 20,
          temperature: 0.3,
        });

        const title = response.text.trim().slice(0, 100);

        await prisma.ai_conversations.update({
          where: { id: conversationId },
          data: { title },
        });

        return title;
      } catch (error) {
        logError('Failed to generate AI title', error);
      }
    }

    // Fallback: Truncate first message
    const title = firstMessage.length > 50
      ? firstMessage.slice(0, 47) + '...'
      : firstMessage;

    await prisma.ai_conversations.update({
      where: { id: conversationId },
      data: { title },
    });

    return title;
  }

  /**
   * Update conversation title
   */
  async updateTitle(id: string, userId: string, title: string): Promise<ai_conversations | null> {
    const conversation = await this.getById(id, userId);
    if (!conversation) return null;

    return prisma.ai_conversations.update({
      where: { id: conversation.id },
      data: { title },
    });
  }

  /**
   * Soft delete conversation
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const conversation = await this.getById(id, userId);
    if (!conversation) return false;

    await prisma.ai_conversations.update({
      where: { id: conversation.id },
      data: { status: 'DELETED' },
    });

    logInfo('AI conversation deleted', { id });
    return true;
  }

  /**
   * Archive old conversations (for cleanup job)
   */
  async archiveOld(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.ai_conversations.updateMany({
      where: {
        status: 'ACTIVE',
        lastMessageAt: { lt: cutoffDate },
      },
      data: { status: 'ARCHIVED' },
    });

    logInfo(`Archived ${result.count} old conversations`);
    return result.count;
  }

  /**
   * Get recent messages for context (last N messages)
   */
  async getRecentMessages(conversationId: string, limit: number = 10): Promise<ai_messages[]> {
    const messages = await prisma.ai_messages.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return messages.reverse(); // Return in chronological order
  }

  /**
   * Get conversation history formatted for AI context
   */
  async getFormattedHistory(conversationId: string, maxMessages: number = 10): Promise<string> {
    const messages = await this.getRecentMessages(conversationId, maxMessages);

    return messages
      .map((msg) => `${msg.role === 'USER' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');
  }

  /**
   * Search conversations by content
   */
  async search(userId: string, query: string, limit: number = 10): Promise<ConversationListItem[]> {
    const conversations = await prisma.ai_conversations.findMany({
      where: {
        userId,
        status: { not: 'DELETED' },
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { messages: { some: { content: { contains: query, mode: 'insensitive' } } } },
        ],
      },
      orderBy: { lastMessageAt: 'desc' },
      take: limit,
      include: {
        _count: { select: { messages: true } },
      },
    });

    return conversations.map((c) => ({
      id: c.id,
      title: c.title,
      messageCount: c._count.messages,
      lastMessageAt: c.lastMessageAt,
      createdAt: c.createdAt,
    }));
  }
}

export const conversationService = new ConversationServiceClass();
export default conversationService;
```

### 3.3 Conversation Routes

**File:** `backend/src/routes/conversation.routes.ts`

```typescript
/**
 * Conversation Routes
 * API endpoints for managing AI conversations
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import conversationService from '../services/ai/conversation.service';
import { logError } from '../utils/logger';

const router = Router();

// Protect all routes
router.use(authenticateToken);

/**
 * GET /api/conversations
 * List all conversations for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await conversationService.getByUser(userId, page, limit);

    res.json(result);
  } catch (error) {
    logError('[Conversations] List error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch conversations',
    });
  }
});

/**
 * GET /api/conversations/search
 * Search conversations by content
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const query = req.query.q as string;

    if (!query || query.length < 2) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Search query must be at least 2 characters',
      });
    }

    const results = await conversationService.search(userId, query);
    res.json({ data: results });
  } catch (error) {
    logError('[Conversations] Search error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to search conversations',
    });
  }
});

/**
 * GET /api/conversations/:id
 * Get a specific conversation with all messages
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const conversation = await conversationService.getById(id, userId);

    if (!conversation) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Conversation not found',
      });
    }

    res.json({ data: conversation });
  } catch (error) {
    logError('[Conversations] Get error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch conversation',
    });
  }
});

/**
 * POST /api/conversations
 * Create a new conversation
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { title } = req.body;

    const conversation = await conversationService.create({
      userId,
      title,
    });

    res.status(201).json({ data: conversation });
  } catch (error) {
    logError('[Conversations] Create error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create conversation',
    });
  }
});

/**
 * PATCH /api/conversations/:id
 * Update conversation (title)
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Title is required',
      });
    }

    const conversation = await conversationService.updateTitle(id, userId, title);

    if (!conversation) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Conversation not found',
      });
    }

    res.json({ data: conversation });
  } catch (error) {
    logError('[Conversations] Update error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update conversation',
    });
  }
});

/**
 * DELETE /api/conversations/:id
 * Soft delete a conversation
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const deleted = await conversationService.delete(id, userId);

    if (!deleted) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Conversation not found',
      });
    }

    res.status(204).send();
  } catch (error) {
    logError('[Conversations] Delete error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete conversation',
    });
  }
});

export default router;
```

### 3.4 Updated AI Routes

**File:** `backend/src/routes/ai.routes.ts` (Replace entire file)

```typescript
/**
 * AI Routes
 * Endpoints for AI-powered features
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { AIProviderFactory } from '../services/ai/providers/AIProviderFactory';
import conversationService from '../services/ai/conversation.service';
import { logError, logInfo } from '../utils/logger';

const router = Router();

// Protect all AI routes
router.use(authenticateToken);

// ============================================
// ROLE-BASED SUGGESTIONS
// ============================================

const ROLE_SUGGESTIONS: Record<string, string[]> = {
  ADMIN: [
    'Show system statistics',
    'List pending approvals',
    'Generate monthly report',
    'What orders are overdue?',
  ],
  PRODUCTION_MANAGER: [
    'Orders due this week?',
    'Show production bottlenecks',
    'Styles pending BOM?',
    'Work order status summary',
  ],
  SALES: [
    'Pending shipments?',
    'Customer order history',
    'Quote for a new style',
    'Top customers this month',
  ],
  MERCHANDISER: [
    'Style costing summary',
    'Pending sample requests',
    'Material availability check',
  ],
  INVENTORY: [
    'Low stock alerts',
    'Material movement summary',
    'Pending GRNs',
  ],
  DEFAULT: [
    'What is an ERP system?',
    'How do I create a new style?',
    'Explain the order workflow',
    'What are the key features?',
  ],
};

/**
 * GET /api/ai/suggestions
 * Get role-based suggested questions
 */
router.get('/suggestions', async (req: Request, res: Response) => {
  try {
    const userRole = req.user?.role || 'DEFAULT';
    const suggestions = ROLE_SUGGESTIONS[userRole] || ROLE_SUGGESTIONS.DEFAULT;

    res.json({ suggestions });
  } catch (error) {
    logError('[AI Suggestions] Error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

/**
 * POST /api/ai/chat
 * Chat with AI - supports persistent conversations
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    if (!AIProviderFactory.isInitialized()) {
      return res.status(503).json({
        error: 'AI not available',
        message: 'AI features are not enabled. Please configure AI in settings.',
      });
    }

    const { message, conversationId } = req.body;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    if (!message) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Message is required',
      });
    }

    const startTime = Date.now();
    const aiProvider = AIProviderFactory.getProvider();

    // Handle conversation
    let activeConversationId = conversationId;
    let conversationHistory = '';

    if (conversationId) {
      // Load existing conversation
      const conversation = await conversationService.getById(conversationId, userId);
      if (conversation) {
        conversationHistory = await conversationService.getFormattedHistory(conversationId, 10);
      }
    } else {
      // Create new conversation
      const newConversation = await conversationService.create({ userId });
      activeConversationId = newConversation.id;
    }

    // Build context
    const conversationContext = conversationHistory
      ? `\n\nPrevious conversation:\n${conversationHistory}\n\nCurrent question:\n`
      : '';

    // System prompt with role awareness
    const systemPrompt = `You are an AI assistant for Kashaya Fabs Garment ERP System.

USER CONTEXT:
- Role: ${userRole}
- User ID: ${userId}

ABOUT THIS ERP SYSTEM:
- Name: Kashaya Fabs Garment ERP
- Type: Manufacturing ERP for Garment Industry
- Key Modules: Styles, Orders, Materials, BOM, Cost Sheets, Inventory, Production

WORKFLOW: Style → BOM → Cost Sheet → Order → Production → Delivery

YOUR CAPABILITIES:
- Answer questions about ERP features
- Explain garment manufacturing processes
- Help users understand system workflow
- Provide step-by-step guidance

RESTRICTIONS:
- You cannot delete any records
- You cannot access data outside user's role permissions
- Always confirm before suggesting any changes

Be helpful, clear, and professional.`;

    // Generate response
    const response = await aiProvider.generateText({
      systemPrompt,
      prompt: conversationContext + message,
      maxTokens: 1500,
      temperature: 0.7,
    });

    const latencyMs = Date.now() - startTime;

    // Save messages to database
    if (activeConversationId) {
      // Save user message
      await conversationService.addMessage({
        conversationId: activeConversationId,
        role: 'USER',
        content: message,
      });

      // Save assistant response
      await conversationService.addMessage({
        conversationId: activeConversationId,
        role: 'ASSISTANT',
        content: response.text,
        provider: response.provider,
        model: response.model,
        latencyMs,
      });

      // Generate title for new conversations
      const conversation = await conversationService.getById(activeConversationId, userId);
      if (conversation && conversation.messages.length === 2 && conversation.title === 'New Conversation') {
        conversationService.generateTitle(activeConversationId).catch((err) => {
          logError('Failed to generate title:', err);
        });
      }
    }

    res.json({
      response: response.text,
      provider: response.provider,
      model: response.model,
      conversationId: activeConversationId,
      latencyMs,
    });
  } catch (error: unknown) {
    logError('[AI Chat] Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate AI response',
    });
  }
});

/**
 * GET /api/ai/status
 * Get AI provider status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const initialized = AIProviderFactory.isInitialized();

    if (!initialized) {
      return res.json({
        enabled: false,
        available: false,
        provider: null,
        model: null,
      });
    }

    const provider = AIProviderFactory.getProvider();
    const available = await provider.isAvailable();
    const info = AIProviderFactory.getProviderInfo();

    res.json({
      enabled: true,
      available,
      provider: info?.name || null,
      model: info?.model || null,
    });
  } catch (error: unknown) {
    logError('[AI Status] Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to check AI status',
    });
  }
});

/**
 * POST /api/ai/feedback
 * Submit feedback for an AI message
 */
router.post('/feedback', async (req: Request, res: Response) => {
  try {
    const { messageId, rating, issueType, comment } = req.body;
    const userId = req.user!.id;

    if (!messageId || !rating) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'messageId and rating are required',
      });
    }

    if (!['HELPFUL', 'NOT_HELPFUL'].includes(rating)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'rating must be HELPFUL or NOT_HELPFUL',
      });
    }

    // Import prisma here to avoid circular dependency
    const prisma = (await import('../config/database')).default;

    const feedback = await prisma.ai_feedback.create({
      data: {
        messageId,
        userId,
        rating,
        issueType,
        comment,
      },
    });

    logInfo('AI feedback received', { messageId, rating, userId });

    res.status(201).json({ data: feedback });
  } catch (error) {
    logError('[AI Feedback] Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to submit feedback',
    });
  }
});

/**
 * POST /api/ai/insights
 * Get AI insights about current ERP state
 */
router.post('/insights', async (req: Request, res: Response) => {
  try {
    if (!AIProviderFactory.isInitialized()) {
      return res.status(503).json({
        error: 'AI not available',
        message: 'AI features are not enabled',
      });
    }

    const aiProvider = AIProviderFactory.getProvider();

    const response = await aiProvider.generateText({
      systemPrompt: 'You are an ERP analytics expert for garment manufacturing.',
      prompt: `Provide 3 key tips for managing a garment manufacturing ERP system efficiently.
Keep each tip to one sentence.`,
      maxTokens: 300,
      temperature: 0.7,
    });

    const insights = response.text
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('#'))
      .map((line) => line.replace(/^[-•*\d.)\s]+/, '').trim())
      .filter((line) => line.length > 10);

    res.json({
      insights: insights.slice(0, 5),
      provider: response.provider,
      model: response.model,
    });
  } catch (error: unknown) {
    logError('[AI Insights] Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to generate insights',
    });
  }
});

export default router;
```

### 3.5 Register Routes

**File:** `backend/src/routes/index.ts`

Add these imports and registrations:

```typescript
// Add import at the top
import conversationRoutes from './conversation.routes';

// In createApiRouter() function, add:
// AI & Conversations
router.use('/ai', aiRoutes);
router.use('/conversations', conversationRoutes);  // ADD THIS LINE
```

### 3.6 Frontend Conversation Service

**File:** `frontend/src/services/conversation.service.ts`

```typescript
/**
 * Conversation Service
 * API calls for AI conversation management
 */

import api from '../lib/api';

// Types
export interface Conversation {
  id: string;
  title: string | null;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface Message {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  provider?: string;
  model?: string;
  createdAt: string;
}

export interface ConversationDetail {
  id: string;
  title: string | null;
  status: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationListResponse {
  data: Conversation[];
  total: number;
  page: number;
  totalPages: number;
}

export interface ChatResponse {
  response: string;
  provider: string;
  model: string;
  conversationId: string;
  latencyMs: number;
}

// API Functions

export const getConversations = async (
  page: number = 1,
  limit: number = 20
): Promise<ConversationListResponse> => {
  const { data } = await api.get('/conversations', {
    params: { page, limit },
  });
  return data;
};

export const getConversation = async (id: string): Promise<ConversationDetail> => {
  const { data } = await api.get(`/conversations/${id}`);
  return data.data;
};

export const createConversation = async (title?: string): Promise<ConversationDetail> => {
  const { data } = await api.post('/conversations', { title });
  return data.data;
};

export const updateConversationTitle = async (
  id: string,
  title: string
): Promise<ConversationDetail> => {
  const { data } = await api.patch(`/conversations/${id}`, { title });
  return data.data;
};

export const deleteConversation = async (id: string): Promise<void> => {
  await api.delete(`/conversations/${id}`);
};

export const searchConversations = async (query: string): Promise<Conversation[]> => {
  const { data } = await api.get('/conversations/search', {
    params: { q: query },
  });
  return data.data;
};

export const sendChatMessage = async (
  message: string,
  conversationId?: string
): Promise<ChatResponse> => {
  const { data } = await api.post('/ai/chat', {
    message,
    conversationId,
  });
  return data;
};

export const getSuggestions = async (): Promise<string[]> => {
  const { data } = await api.get('/ai/suggestions');
  return data.suggestions;
};

export const submitFeedback = async (
  messageId: string,
  rating: 'HELPFUL' | 'NOT_HELPFUL',
  issueType?: string,
  comment?: string
): Promise<void> => {
  await api.post('/ai/feedback', {
    messageId,
    rating,
    issueType,
    comment,
  });
};
```

---

## 4. Phase 2: ERP Database Context Injection

### 4.1 AI Permission Service

**File:** `backend/src/services/ai/ai-permission.service.ts`

```typescript
/**
 * AI Permission Service
 * Role-based data access filtering for AI responses
 */

import { UserRole } from '@prisma/client';

// Data access matrix
const DATA_ACCESS_MATRIX: Record<string, UserRole[]> = {
  // Financial Data
  'pricing.costPrice': ['ADMIN', 'ACCOUNTS'],
  'pricing.sellingPrice': ['ADMIN', 'ACCOUNTS', 'SALES', 'MERCHANDISER'],
  'pricing.margin': ['ADMIN', 'ACCOUNTS'],

  // Order Data
  'order.all': ['ADMIN', 'SALES', 'MERCHANDISER', 'PRODUCTION_MANAGER'],
  'order.financial': ['ADMIN', 'ACCOUNTS', 'SALES'],

  // Customer Data
  'customer.contactInfo': ['ADMIN', 'SALES', 'MERCHANDISER', 'ACCOUNTS'],
  'customer.creditLimit': ['ADMIN', 'ACCOUNTS', 'SALES'],

  // Supplier Data
  'supplier.contactInfo': ['ADMIN', 'PURCHASE'],
  'supplier.pricing': ['ADMIN', 'PURCHASE', 'ACCOUNTS'],

  // Inventory Data
  'inventory.quantities': ['ADMIN', 'INVENTORY', 'PURCHASE', 'PRODUCTION_MANAGER'],
  'inventory.valuations': ['ADMIN', 'ACCOUNTS'],

  // User Data
  'user.list': ['ADMIN'],
  'user.activity': ['ADMIN'],
};

// Sensitive fields that should be masked
const SENSITIVE_FIELDS = [
  'password', 'passwordHash', 'token', 'apiKey',
  'gstNumber', 'panNumber', 'bankAccount', 'ifscCode',
  'creditLimit', 'profitMargin', 'costPrice',
];

class AIPermissionServiceClass {
  /**
   * Check if user has access to a specific data type
   */
  hasAccess(userRole: UserRole, dataType: string): boolean {
    const allowedRoles = DATA_ACCESS_MATRIX[dataType];
    if (!allowedRoles) return true; // If not defined, allow
    return allowedRoles.includes(userRole);
  }

  /**
   * Get all accessible data types for a role
   */
  getAccessibleDataTypes(userRole: UserRole): string[] {
    return Object.entries(DATA_ACCESS_MATRIX)
      .filter(([_, roles]) => roles.includes(userRole))
      .map(([dataType]) => dataType);
  }

  /**
   * Filter object to remove sensitive fields based on role
   */
  filterSensitiveData<T extends Record<string, any>>(
    data: T,
    userRole: UserRole
  ): T {
    const filtered = { ...data };

    for (const field of SENSITIVE_FIELDS) {
      if (field in filtered && !this.canSeeSensitiveField(userRole, field)) {
        filtered[field] = '[Hidden]';
      }
    }

    return filtered;
  }

  /**
   * Check if role can see a specific sensitive field
   */
  private canSeeSensitiveField(userRole: UserRole, field: string): boolean {
    const adminOnlyFields = ['password', 'passwordHash', 'token', 'apiKey'];
    const accountsFields = ['gstNumber', 'panNumber', 'bankAccount', 'ifscCode', 'creditLimit'];
    const pricingFields = ['profitMargin', 'costPrice'];

    if (adminOnlyFields.includes(field)) return false; // Never show these
    if (accountsFields.includes(field)) return ['ADMIN', 'ACCOUNTS'].includes(userRole);
    if (pricingFields.includes(field)) return ['ADMIN', 'ACCOUNTS'].includes(userRole);

    return true;
  }

  /**
   * Get role description for AI context
   */
  getRoleDescription(userRole: UserRole): string {
    const descriptions: Record<string, string> = {
      ADMIN: 'Full access to all data and features',
      PRODUCTION_MANAGER: 'Access to production, orders, styles, inventory',
      SALES: 'Access to orders, customers, pricing',
      MERCHANDISER: 'Access to styles, samples, costing',
      INVENTORY: 'Access to stock levels, materials, warehouses',
      ACCOUNTS: 'Access to financial data, pricing, payments',
      PURCHASE: 'Access to suppliers, purchase orders, procurement',
      QUALITY: 'Access to quality tests, inspections',
      FACTORY_SUPERVISOR: 'Access to production floor data',
    };

    return descriptions[userRole] || 'Limited access';
  }
}

export const aiPermissionService = new AIPermissionServiceClass();
export default aiPermissionService;
```

### 4.2 ERP Context Service

**File:** `backend/src/services/ai/erp-context.service.ts`

```typescript
/**
 * ERP Context Service
 * Fetches relevant ERP data to inject into AI prompts
 */

import prisma from '../../config/database';
import { UserRole } from '@prisma/client';
import { aiPermissionService } from './ai-permission.service';
import { logDebug, logError } from '../../utils/logger';

// Context types
interface ERPContext {
  summary?: SummaryContext;
  orders?: OrderContext[];
  styles?: StyleContext[];
  inventory?: InventoryContext[];
  production?: ProductionContext[];
}

interface SummaryContext {
  totalOrders: number;
  pendingOrders: number;
  totalStyles: number;
  activeStyles: number;
  lowStockItems: number;
}

interface OrderContext {
  orderNumber: string;
  customerName: string;
  status: string;
  totalQuantity: number;
  expectedDeliveryDate: string;
}

interface StyleContext {
  styleCode: string;
  styleName: string;
  status: string;
  customerName?: string;
}

interface InventoryContext {
  materialName: string;
  materialCode: string;
  totalQuantity: number;
  unit: string;
}

interface ProductionContext {
  workOrderNumber: string;
  styleName: string;
  status: string;
  targetQuantity: number;
  completedQuantity: number;
}

// Keywords for context detection
const CONTEXT_KEYWORDS: Record<string, string[]> = {
  orders: ['order', 'orders', 'delivery', 'pending', 'shipped', 'dispatch', 'overdue'],
  styles: ['style', 'styles', 'design', 'garment', 'product', 'collection'],
  inventory: ['inventory', 'stock', 'material', 'fabric', 'trim', 'quantity', 'low stock'],
  production: ['production', 'work order', 'manufacturing', 'cutting', 'stitching'],
  customers: ['customer', 'buyer', 'client', 'brand'],
};

class ERPContextServiceClass {
  /**
   * Detect what context is needed based on user question
   */
  detectContextNeeds(question: string): string[] {
    const lowerQuestion = question.toLowerCase();
    const neededContext: string[] = [];

    for (const [contextType, keywords] of Object.entries(CONTEXT_KEYWORDS)) {
      if (keywords.some((keyword) => lowerQuestion.includes(keyword))) {
        neededContext.push(contextType);
      }
    }

    // Default to summary for general questions
    if (neededContext.length === 0) {
      neededContext.push('summary');
    }

    return neededContext;
  }

  /**
   * Fetch relevant ERP context based on question and user role
   */
  async getContext(
    question: string,
    userRole: UserRole,
    maxItems: number = 5
  ): Promise<ERPContext> {
    const neededContext = this.detectContextNeeds(question);
    const context: ERPContext = {};

    try {
      const promises: Promise<void>[] = [];

      if (neededContext.includes('orders') && aiPermissionService.hasAccess(userRole, 'order.all')) {
        promises.push(
          this.fetchOrderContext(maxItems).then((data) => {
            context.orders = data;
          })
        );
      }

      if (neededContext.includes('styles')) {
        promises.push(
          this.fetchStyleContext(maxItems).then((data) => {
            context.styles = data;
          })
        );
      }

      if (neededContext.includes('inventory') && aiPermissionService.hasAccess(userRole, 'inventory.quantities')) {
        promises.push(
          this.fetchInventoryContext(maxItems).then((data) => {
            context.inventory = data;
          })
        );
      }

      if (neededContext.includes('production')) {
        promises.push(
          this.fetchProductionContext(maxItems).then((data) => {
            context.production = data;
          })
        );
      }

      if (neededContext.includes('summary')) {
        promises.push(
          this.fetchSummaryContext().then((data) => {
            context.summary = data;
          })
        );
      }

      await Promise.all(promises);

      logDebug('ERP context fetched', { neededContext, userRole });
      return context;
    } catch (error) {
      logError('Failed to fetch ERP context', error);
      return {};
    }
  }

  /**
   * Format context for AI prompt
   */
  formatContextForPrompt(context: ERPContext): string {
    const sections: string[] = [];

    if (context.summary) {
      sections.push(`
=== ERP SUMMARY ===
- Total Orders: ${context.summary.totalOrders}
- Pending Orders: ${context.summary.pendingOrders}
- Total Styles: ${context.summary.totalStyles}
- Active Styles: ${context.summary.activeStyles}
- Low Stock Items: ${context.summary.lowStockItems}
`);
    }

    if (context.orders && context.orders.length > 0) {
      sections.push(`
=== RECENT ORDERS ===
${context.orders
  .map((o) => `- ${o.orderNumber}: ${o.customerName} | ${o.status} | Qty: ${o.totalQuantity} | Due: ${o.expectedDeliveryDate}`)
  .join('\n')}
`);
    }

    if (context.styles && context.styles.length > 0) {
      sections.push(`
=== ACTIVE STYLES ===
${context.styles
  .map((s) => `- ${s.styleCode}: ${s.styleName} | ${s.status}`)
  .join('\n')}
`);
    }

    if (context.inventory && context.inventory.length > 0) {
      sections.push(`
=== INVENTORY STATUS ===
${context.inventory
  .map((i) => `- ${i.materialCode}: ${i.materialName} | Stock: ${i.totalQuantity} ${i.unit}`)
  .join('\n')}
`);
    }

    if (context.production && context.production.length > 0) {
      sections.push(`
=== PRODUCTION STATUS ===
${context.production
  .map((p) => `- ${p.workOrderNumber}: ${p.styleName} | ${p.status} | ${p.completedQuantity}/${p.targetQuantity}`)
  .join('\n')}
`);
    }

    return sections.join('\n');
  }

  // Private fetch methods

  private async fetchOrderContext(limit: number): Promise<OrderContext[]> {
    const orders = await prisma.orders.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        customers: { select: { name: true } },
      },
    });

    return orders.map((o) => ({
      orderNumber: o.orderNumber,
      customerName: o.customers.name,
      status: o.status,
      totalQuantity: o.totalQuantity,
      expectedDeliveryDate: o.expectedDeliveryDate?.toISOString().split('T')[0] || 'N/A',
    }));
  }

  private async fetchStyleContext(limit: number): Promise<StyleContext[]> {
    const styles = await prisma.styles.findMany({
      where: { isActive: true },
      take: limit,
      orderBy: { updatedAt: 'desc' },
      select: {
        styleCode: true,
        styleName: true,
        status: true,
        customerName: true,
      },
    });

    return styles.map((s) => ({
      styleCode: s.styleCode,
      styleName: s.styleName,
      status: s.status,
      customerName: s.customerName || undefined,
    }));
  }

  private async fetchInventoryContext(limit: number): Promise<InventoryContext[]> {
    const materials = await prisma.materials.findMany({
      take: limit,
      where: { isActive: true },
      select: {
        code: true,
        name: true,
        unit: true,
      },
    });

    // Simplified - in production, aggregate stock levels
    return materials.map((m) => ({
      materialCode: m.code,
      materialName: m.name,
      totalQuantity: 0, // Would come from stock aggregation
      unit: m.unit,
    }));
  }

  private async fetchProductionContext(limit: number): Promise<ProductionContext[]> {
    const workOrders = await prisma.work_orders.findMany({
      where: { status: { in: ['IN_PROGRESS', 'PENDING'] } },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        styles: { select: { styleName: true } },
      },
    });

    return workOrders.map((wo) => ({
      workOrderNumber: wo.workOrderNumber,
      styleName: wo.styles.styleName,
      status: wo.status,
      targetQuantity: wo.targetQuantity,
      completedQuantity: wo.completedQuantity,
    }));
  }

  private async fetchSummaryContext(): Promise<SummaryContext> {
    const [
      totalOrders,
      pendingOrders,
      totalStyles,
      activeStyles,
    ] = await Promise.all([
      prisma.orders.count(),
      prisma.orders.count({ where: { status: 'PENDING' } }),
      prisma.styles.count(),
      prisma.styles.count({ where: { isActive: true } }),
    ]);

    return {
      totalOrders,
      pendingOrders,
      totalStyles,
      activeStyles,
      lowStockItems: 0, // Would come from stock level analysis
    };
  }
}

export const erpContextService = new ERPContextServiceClass();
export default erpContextService;
```

---

## 5. Phase 3: RAG with pgvector

### 5.1 Database Migration for pgvector

**File:** `backend/prisma/migrations/[timestamp]_add_pgvector/migration.sql`

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create document embeddings table
CREATE TABLE document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type VARCHAR(50) NOT NULL,
  source_id VARCHAR(255),
  title VARCHAR(500),
  content TEXT NOT NULL,
  content_hash VARCHAR(64),
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create vector similarity index
CREATE INDEX idx_embeddings_vector ON document_embeddings
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create indexes for filtering
CREATE INDEX idx_embeddings_type ON document_embeddings(document_type);
CREATE INDEX idx_embeddings_source ON document_embeddings(source_id);
CREATE INDEX idx_embeddings_hash ON document_embeddings(content_hash);
```

### 5.2 Embedding Service

**File:** `backend/src/services/ai/embedding.service.ts`

```typescript
/**
 * Embedding Service
 * Manages document embeddings for RAG
 */

import prisma from '../../config/database';
import { AIProviderFactory } from './providers/AIProviderFactory';
import { logInfo, logError, logDebug } from '../../utils/logger';
import crypto from 'crypto';

interface DocumentInput {
  documentType: 'style' | 'order' | 'help' | 'guide' | 'process';
  sourceId?: string;
  title?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

interface SimilarDocument {
  id: string;
  documentType: string;
  title: string | null;
  content: string;
  similarity: number;
  metadata: Record<string, unknown> | null;
}

class EmbeddingServiceClass {
  /**
   * Generate content hash for deduplication
   */
  private generateHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Store document with embedding
   */
  async storeDocument(doc: DocumentInput): Promise<string> {
    try {
      if (!AIProviderFactory.isInitialized()) {
        throw new Error('AI provider not initialized');
      }

      const contentHash = this.generateHash(doc.content);

      // Check for duplicate
      const existing = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM document_embeddings WHERE content_hash = ${contentHash}
      `;

      if (existing.length > 0) {
        logDebug('Document already exists', { id: existing[0].id });
        return existing[0].id;
      }

      // Generate embedding
      const ai = AIProviderFactory.getProvider();
      const embeddingResponse = await ai.generateEmbedding({
        text: doc.content,
      });

      // Store with embedding
      const id = crypto.randomUUID();
      const embedding = `[${embeddingResponse.embedding.join(',')}]`;

      await prisma.$executeRaw`
        INSERT INTO document_embeddings (
          id, document_type, source_id, title, content, content_hash,
          embedding, metadata, created_at, updated_at
        ) VALUES (
          ${id}::uuid,
          ${doc.documentType},
          ${doc.sourceId || null},
          ${doc.title || null},
          ${doc.content},
          ${contentHash},
          ${embedding}::vector,
          ${JSON.stringify(doc.metadata || {})}::jsonb,
          NOW(),
          NOW()
        )
      `;

      logInfo('Document stored with embedding', { id, type: doc.documentType });
      return id;
    } catch (error) {
      logError('Failed to store document', error);
      throw error;
    }
  }

  /**
   * Search for similar documents
   */
  async searchSimilar(
    query: string,
    options: { limit?: number; documentType?: string; minSimilarity?: number } = {}
  ): Promise<SimilarDocument[]> {
    try {
      if (!AIProviderFactory.isInitialized()) {
        throw new Error('AI provider not initialized');
      }

      const { limit = 5, documentType, minSimilarity = 0.7 } = options;

      // Generate query embedding
      const ai = AIProviderFactory.getProvider();
      const embeddingResponse = await ai.generateEmbedding({ text: query });
      const queryEmbedding = `[${embeddingResponse.embedding.join(',')}]`;

      // Build type filter
      const typeFilter = documentType ? `AND document_type = '${documentType}'` : '';

      // Search with cosine similarity
      const results = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          document_type: string;
          title: string | null;
          content: string;
          similarity: number;
          metadata: Record<string, unknown> | null;
        }>
      >(`
        SELECT
          id,
          document_type,
          title,
          content,
          1 - (embedding <=> '${queryEmbedding}'::vector) as similarity,
          metadata
        FROM document_embeddings
        WHERE 1 - (embedding <=> '${queryEmbedding}'::vector) >= ${minSimilarity}
        ${typeFilter}
        ORDER BY embedding <=> '${queryEmbedding}'::vector
        LIMIT ${limit}
      `);

      logDebug('Similarity search completed', {
        query: query.slice(0, 50),
        resultsCount: results.length,
      });

      return results.map((r) => ({
        id: r.id,
        documentType: r.document_type,
        title: r.title,
        content: r.content,
        similarity: r.similarity,
        metadata: r.metadata,
      }));
    } catch (error) {
      logError('Failed to search similar documents', error);
      throw error;
    }
  }

  /**
   * Get embedding statistics
   */
  async getStats(): Promise<Record<string, number>> {
    const results = await prisma.$queryRaw<Array<{ document_type: string; count: bigint }>>`
      SELECT document_type, COUNT(*) as count
      FROM document_embeddings
      GROUP BY document_type
    `;

    return results.reduce(
      (acc, r) => {
        acc[r.document_type] = Number(r.count);
        return acc;
      },
      {} as Record<string, number>
    );
  }

  /**
   * Delete documents by type
   */
  async deleteByType(documentType: string): Promise<number> {
    const result = await prisma.$executeRaw`
      DELETE FROM document_embeddings WHERE document_type = ${documentType}
    `;
    logInfo('Documents deleted', { documentType, count: result });
    return result;
  }
}

export const embeddingService = new EmbeddingServiceClass();
export default embeddingService;
```

### 5.3 Indexing Service

**File:** `backend/src/services/ai/indexing.service.ts`

```typescript
/**
 * Indexing Service
 * Indexes ERP data and documentation for RAG
 */

import prisma from '../../config/database';
import { embeddingService } from './embedding.service';
import { logInfo, logError } from '../../utils/logger';

class IndexingServiceClass {
  /**
   * Index all active styles
   */
  async indexStyles(): Promise<number> {
    const styles = await prisma.styles.findMany({
      where: { isActive: true },
      select: {
        id: true,
        styleCode: true,
        styleName: true,
        description: true,
        specifications: true,
        customerName: true,
      },
    });

    let indexed = 0;

    for (const style of styles) {
      if (!style.description && !style.specifications) continue;

      try {
        await embeddingService.storeDocument({
          documentType: 'style',
          sourceId: style.id,
          title: `Style ${style.styleCode}: ${style.styleName}`,
          content: `
Style Code: ${style.styleCode}
Style Name: ${style.styleName}
Customer: ${style.customerName || 'N/A'}

Description:
${style.description || 'No description'}

Specifications:
${style.specifications || 'No specifications'}
          `.trim(),
          metadata: { styleCode: style.styleCode },
        });
        indexed++;
      } catch (error) {
        logError('Failed to index style', { styleCode: style.styleCode, error });
      }
    }

    logInfo('Styles indexed', { total: styles.length, indexed });
    return indexed;
  }

  /**
   * Index process guides (static content)
   */
  async indexProcessGuides(): Promise<number> {
    const guides = [
      {
        title: 'Creating a New Style',
        content: `
How to Create a New Style:
1. Navigate to Styles > New Style
2. Enter Style Code (from buyer) and Style Name
3. Select Customer and Category
4. Add color and size options
5. Upload style images
6. Add description and specifications
7. Save the style

The style will be in DRAFT status. To activate:
- Complete the BOM (Bill of Materials)
- Create cost sheet
- Get approval from manager
        `.trim(),
      },
      {
        title: 'Order Processing Workflow',
        content: `
Order Processing Workflow:

1. CREATE ORDER
   - Select customer
   - Add styles with quantities
   - Set delivery date
   - Status: PENDING

2. PRODUCTION
   - Work orders created
   - Cut fabric
   - Stitching
   - Finishing and QC
   - Status: IN_PRODUCTION

3. DISPATCH
   - Create delivery note
   - Pack goods
   - Generate invoice
   - Status: DISPATCHED

4. COMPLETION
   - Confirm delivery
   - Status: COMPLETED
        `.trim(),
      },
      {
        title: 'Bill of Materials (BOM)',
        content: `
Creating Bill of Materials (BOM):

BOM defines all materials needed for one piece.

Components:
1. FABRIC - Main, lining, interlining
2. TRIMS - Buttons, zippers, threads
3. LABELS - Main, size, care labels
4. PACKAGING - Polybag, hangers, cartons

Steps:
1. Go to Styles > Select Style > BOM tab
2. Add fabric with consumption per piece
3. Add trims with quantity
4. Set wastage percentage (5-10%)
5. Calculate total cost
6. Submit for approval
        `.trim(),
      },
    ];

    let indexed = 0;

    for (const guide of guides) {
      try {
        await embeddingService.storeDocument({
          documentType: 'guide',
          title: guide.title,
          content: guide.content,
        });
        indexed++;
      } catch (error) {
        logError('Failed to index guide', { title: guide.title, error });
      }
    }

    logInfo('Guides indexed', { total: guides.length, indexed });
    return indexed;
  }

  /**
   * Re-index all content
   */
  async reindexAll(): Promise<{ styles: number; guides: number }> {
    logInfo('Starting full re-index');

    // Clear existing
    await embeddingService.deleteByType('style');
    await embeddingService.deleteByType('guide');

    // Re-index
    const [styles, guides] = await Promise.all([
      this.indexStyles(),
      this.indexProcessGuides(),
    ]);

    logInfo('Full re-index completed', { styles, guides });
    return { styles, guides };
  }
}

export const indexingService = new IndexingServiceClass();
export default indexingService;
```

### 5.4 AI Admin Routes

**File:** `backend/src/routes/ai-admin.routes.ts`

```typescript
/**
 * AI Admin Routes
 * Administrative endpoints for AI system management
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { indexingService } from '../services/ai/indexing.service';
import { embeddingService } from '../services/ai/embedding.service';
import { logError } from '../utils/logger';

const router = Router();

// Protect all routes - admin only
router.use(authenticateToken);
router.use(authorize('ADMIN'));

/**
 * POST /api/ai-admin/index/styles
 * Index all styles for RAG
 */
router.post('/index/styles', async (req: Request, res: Response) => {
  try {
    const count = await indexingService.indexStyles();
    res.json({ success: true, message: `Indexed ${count} styles`, count });
  } catch (error) {
    logError('[AI Admin] Index styles error:', error);
    res.status(500).json({ error: 'Failed to index styles' });
  }
});

/**
 * POST /api/ai-admin/index/guides
 * Index process guides for RAG
 */
router.post('/index/guides', async (req: Request, res: Response) => {
  try {
    const count = await indexingService.indexProcessGuides();
    res.json({ success: true, message: `Indexed ${count} guides`, count });
  } catch (error) {
    logError('[AI Admin] Index guides error:', error);
    res.status(500).json({ error: 'Failed to index guides' });
  }
});

/**
 * POST /api/ai-admin/index/all
 * Re-index all content
 */
router.post('/index/all', async (req: Request, res: Response) => {
  try {
    const result = await indexingService.reindexAll();
    res.json({ success: true, message: 'Full re-index completed', result });
  } catch (error) {
    logError('[AI Admin] Re-index error:', error);
    res.status(500).json({ error: 'Failed to re-index' });
  }
});

/**
 * GET /api/ai-admin/stats
 * Get embedding statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await embeddingService.getStats();
    res.json({ data: stats });
  } catch (error) {
    logError('[AI Admin] Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export default router;
```

**Register in routes/index.ts:**

```typescript
import aiAdminRoutes from './ai-admin.routes';

// In createApiRouter():
router.use('/ai-admin', aiAdminRoutes);
```

---

## 6. Safeguards & Permissions

### 6.1 AI Action Tiers

| Tier | Action | Allowed? | How It Works |
|------|--------|----------|--------------|
| 0 | READ data | Yes | Filtered by user role |
| 1 | CREATE drafts | Yes | User must confirm before save |
| 2 | UPDATE records | Yes | Shows before/after, requires confirm |
| 3 | STATUS CHANGE | Yes | Requires approval workflow |
| 4 | DELETE | **NO** | Suggests UI path instead |
| 5 | BULK MODIFY | **NO** | Prohibited |

### 6.2 Role-Based Data Access

| Data Type | ADMIN | MANAGER | SALES | PRODUCTION | INVENTORY |
|-----------|-------|---------|-------|------------|-----------|
| All Orders | Yes | Yes | Yes | Yes | No |
| Order Financials | Yes | No | Yes | No | No |
| Cost Prices | Yes | No | No | No | No |
| Selling Prices | Yes | Yes | Yes | No | No |
| Profit Margins | Yes | No | No | No | No |
| Customer Contacts | Yes | Yes | Yes | No | No |
| Supplier Pricing | Yes | No | No | No | Yes |
| Inventory Qty | Yes | Yes | No | Yes | Yes |

### 6.3 Always Hidden from AI

- Passwords, API keys, tokens
- Bank account details, IFSC codes
- Salary information
- GST/PAN numbers (except ACCOUNTS role)

---

## 7. Environment Configuration

### 7.1 Backend .env

```bash
# ============================================
# AI CONFIGURATION
# ============================================

# Enable AI features
AI_ENABLED="true"

# Primary AI Provider (Claude)
AI_PROVIDER="anthropic"
AI_API_KEY="sk-ant-api03-xxxxx"
AI_MODEL="claude-sonnet-4-20250514"

# Fallback AI Provider (Ollama - local)
AI_FALLBACK_ENABLED="true"
AI_FALLBACK_PROVIDER="ollama"
AI_FALLBACK_BASE_URL="http://localhost:11434"
AI_FALLBACK_MODEL="llama3"

# Embeddings Provider (OpenAI - Claude doesn't support embeddings)
EMBEDDING_PROVIDER="openai"
EMBEDDING_API_KEY="sk-xxxxx"
EMBEDDING_MODEL="text-embedding-3-small"
```

### 7.2 Getting API Keys

| Provider | Where to Get | Pricing |
|----------|--------------|---------|
| Anthropic (Claude) | console.anthropic.com | ~$3/M input, $15/M output |
| OpenAI (Embeddings) | platform.openai.com | ~$0.02/M tokens |
| Ollama | ollama.com/download | Free (local) |

---

## 8. Testing Checklist

### Phase 1: Persistent Memory
- [ ] Create new conversation via API
- [ ] Send messages and verify they're saved
- [ ] Reload page - conversations persist
- [ ] List conversations shows history
- [ ] Delete conversation (soft delete)
- [ ] Search conversations by content

### Phase 2: ERP Context
- [ ] Ask "What orders are pending?" - verify real data shown
- [ ] Ask about inventory - verify stock data
- [ ] Test with different roles - verify filtering
- [ ] Test sensitive data hiding

### Phase 3: RAG
- [ ] Run `/api/ai-admin/index/all` as admin
- [ ] Verify embedding stats show documents
- [ ] Ask "How do I create a style?" - verify RAG retrieval
- [ ] Check response cites relevant documentation

### Safeguards
- [ ] Try "Delete customer X" - verify AI refuses
- [ ] Test role-based data access
- [ ] Verify audit logs for AI actions

---

## Appendix: File Paths Summary

### New Files (12)
```
backend/src/services/ai/conversation.service.ts
backend/src/services/ai/ai-permission.service.ts
backend/src/services/ai/erp-context.service.ts
backend/src/services/ai/embedding.service.ts
backend/src/services/ai/rag.service.ts
backend/src/services/ai/indexing.service.ts
backend/src/routes/conversation.routes.ts
backend/src/routes/ai-admin.routes.ts
frontend/src/services/conversation.service.ts
frontend/src/components/ConversationSidebar.tsx
frontend/src/components/AIFeedback.tsx
backend/prisma/migrations/xxx_add_ai/migration.sql
```

### Modified Files (7)
```
backend/prisma/schema.prisma
backend/src/routes/ai.routes.ts
backend/src/routes/index.ts
backend/src/app.ts
backend/src/services/audit.service.ts
frontend/src/pages/AIAssistant.tsx
backend/.env
```

---

**End of Implementation Guide**
