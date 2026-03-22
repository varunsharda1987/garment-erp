/**
 * AI Routes
 * Endpoints for AI-powered features
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { AIProviderFactory } from '../services/ai/providers/AIProviderFactory';
import { conversationService } from '../services/ai/conversation.service';
import { aiPermissionService } from '../services/ai/ai-permission.service';
import { erpContextService } from '../services/ai/erp-context.service';
import { ragService } from '../services/ai/rag.service';
import { logError, logInfo } from '../utils/logger';
import { UserRole } from '@prisma/client';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

const router = Router();

/**
 * GET /api/ai/status
 * Get AI provider status (PUBLIC - no auth required)
 */
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
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
}));

// Protect all other AI routes
router.use(authenticateToken);

/**
 * POST /api/ai/chat
 * Chat with AI about ERP data with conversation history
 */
router.post('/chat', asyncHandler(async (req: Request, res: Response) => {
  if (!AIProviderFactory.isInitialized()) {
    return res.status(503).json({
      error: 'AI not available',
      message: 'AI features are not enabled. Please configure AI in the backend settings.',
    });
  }

  const { message, conversationHistory = [] } = req.body;

  if (!message) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Message is required',
    });
  }

  const aiProvider = AIProviderFactory.getProvider();

  // Build conversation context from history
  let conversationContext = '';
  if (conversationHistory.length > 0) {
    conversationContext = '\n\nPrevious conversation:\n' +
      conversationHistory
        .slice(-10) // Only last 10 messages to avoid token limits
        .map((msg: ConversationMessage) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n') +
      '\n\nCurrent question:\n';
  }

  // Enhanced system prompt with ERP context
  const systemPrompt = `You are an AI assistant for Kashaya Fabs Garment ERP System.

ABOUT THIS ERP SYSTEM:
- Name: Kashaya Fabs Garment ERP
- Type: Manufacturing ERP for Garment Industry
- Key Modules: Styles, Orders, Materials, BOM, Cost Sheets, Inventory, Production, Customers, Suppliers

MAIN FEATURES:
1. Style Management: Create and manage garment styles with specifications
2. Order Management: Process customer orders linked to styles
3. Material Management: Track fabrics, trims, and accessories
4. BOM (Bill of Materials): Define material requirements for each style
5. Cost Sheet: Calculate production costs (materials, labor, overhead)
6. Inventory Management: Track stock levels, movements, warehouses
7. Production Planning: Work orders, production tracking
8. Financial Management: Chart of accounts, cost centers

WORKFLOW:
Style → BOM → Cost Sheet → Order → Production → Delivery

YOUR ROLE:
- Answer questions about ERP features and how to use them
- Explain garment manufacturing processes
- Help users understand the system workflow
- Provide step-by-step guidance for common tasks
- Remember the conversation context and refer back to previous questions

IMPORTANT:
- You can see and remember this entire conversation
- Be specific about Kashaya Fabs ERP features
- Give practical, actionable advice
- If you don't know something specific about the system, say so
- Be helpful, clear, and professional`;

  // Generate response with conversation context
  const response = await aiProvider.generateText({
    systemPrompt,
    prompt: conversationContext + message,
    maxTokens: 1000, // Increased for more detailed responses
    temperature: 0.7,
  });

  res.json({
    response: response.text,
    provider: response.provider,
    model: response.model,
  });
}));

/**
 * POST /api/ai/insights
 * Get AI insights about current ERP state
 */
router.post('/insights', asyncHandler(async (req: Request, res: Response) => {
  if (!AIProviderFactory.isInitialized()) {
    return res.status(503).json({
      error: 'AI not available',
      message: 'AI features are not enabled',
    });
  }

  const aiProvider = AIProviderFactory.getProvider();

  // Simple prompt for general insights
  const response = await aiProvider.generateText({
    systemPrompt: 'You are an ERP analytics expert for garment manufacturing.',
    prompt: `Provide 3 key tips for managing a garment manufacturing ERP system efficiently.
Keep each tip to one sentence.`,
    maxTokens: 300,
    temperature: 0.7,
  });

  // Parse insights
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
}));

// ============================================
// NEW ENDPOINTS: Persistent Conversations
// ============================================

/**
 * POST /api/ai/chat/persistent
 * Chat with AI using persistent conversation storage
 * This is the enhanced version that saves messages to database
 */
router.post('/chat/persistent', asyncHandler(async (req: Request, res: Response) => {
  if (!AIProviderFactory.isInitialized()) {
    return res.status(503).json({
      error: 'AI not available',
      message: 'AI features are not enabled. Please configure AI in the backend settings.',
    });
  }

  const userId = req.user?.userId;
  const userRole = req.user?.role as UserRole;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { message, conversationId } = req.body;

  if (!message) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Message is required',
    });
  }

  // Check if query is restricted for this role
  const restrictedCheck = aiPermissionService.isRestrictedQuery(message, userRole);
  if (restrictedCheck.restricted) {
    return res.json({
      response: restrictedCheck.reason,
      restricted: true,
      provider: 'system',
      model: 'permission-filter',
    });
  }

  const startTime = Date.now();
  let activeConversationId = conversationId;

  // Create new conversation if not provided
  if (!activeConversationId) {
    const newConversation = await conversationService.createConversation({
      userId,
      title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
    });
    activeConversationId = newConversation.id;
  }

  // Save user message
  await conversationService.addMessage({
    conversationId: activeConversationId,
    role: 'USER',
    content: message,
  });

  // Get conversation context
  const contextMessages = await conversationService.getConversationContext(activeConversationId, 10);

  // Build conversation history string
  let conversationContext = '';
  if (contextMessages.length > 1) {
    conversationContext =
      '\n\nPrevious conversation:\n' +
      contextMessages
        .slice(0, -1) // Exclude the current message we just saved
        .map((msg) => `${msg.role === 'USER' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n') +
      '\n\nCurrent question:\n';
  }

  // Get role-based permission context
  const permissionContext = aiPermissionService.getPermissionContext(userRole);

  // Get real-time ERP data context based on the question
  const erpContexts = await erpContextService.getContext(message, userRole);
  const erpDataContext = erpContextService.formatContextForPrompt(erpContexts);

  // Get RAG context from knowledge base (if available)
  let ragContext = '';
  if (ragService.isAvailable()) {
    const ragResult = await ragService.getEnhancedContext(message);
    ragContext = ragResult.formattedContext;
    if (ragResult.documents.length > 0) {
      logInfo(`[AI Chat] RAG retrieved ${ragResult.documents.length} documents in ${ragResult.retrievalTime}ms`);
    }
  }

  // Enhanced system prompt with ERP context and permissions
  const systemPrompt = `You are an AI assistant for Kashaya Fabs Garment ERP System.

ABOUT THIS ERP SYSTEM:
- Name: Kashaya Fabs Garment ERP
- Type: Manufacturing ERP for Garment Industry
- Key Modules: Styles, Orders, Materials, BOM, Cost Sheets, Inventory, Production, Customers, Suppliers

MAIN FEATURES:
1. Style Management: Create and manage garment styles with specifications
2. Order Management: Process customer orders linked to styles
3. Material Management: Track fabrics, trims, and accessories
4. BOM (Bill of Materials): Define material requirements for each style
5. Cost Sheet: Calculate production costs (materials, labor, overhead)
6. Inventory Management: Track stock levels, movements, warehouses
7. Production Planning: Work orders, production tracking
8. Financial Management: Chart of accounts, cost centers

WORKFLOW:
Style → BOM → Cost Sheet → Order → Production → Delivery

${permissionContext}
${erpDataContext}
${ragContext}

YOUR ROLE:
- Answer questions about ERP features and how to use them
- Explain garment manufacturing processes
- Help users understand the system workflow
- Provide step-by-step guidance for common tasks
- Remember the conversation context and refer back to previous questions
- RESPECT data access permissions - never reveal data the user cannot access

IMPORTANT:
- You can see and remember this entire conversation
- You have access to REAL ERP data shown above - use it to answer specific questions
- Be specific about Kashaya Fabs ERP features
- Give practical, actionable advice using the actual data provided
- If you don't know something specific about the system, say so
- Be helpful, clear, and professional
- If asked for restricted data, politely decline and explain why`;

  const aiProvider = AIProviderFactory.getProvider();

  // Generate response
  const response = await aiProvider.generateText({
    systemPrompt,
    prompt: conversationContext + message,
    maxTokens: 1000,
    temperature: 0.7,
  });

  const latencyMs = Date.now() - startTime;

  // Save assistant response
  await conversationService.addMessage({
    conversationId: activeConversationId,
    role: 'ASSISTANT',
    content: response.text,
    provider: response.provider,
    model: response.model,
    latencyMs,
  });

  logInfo(`[AI Chat] Conversation ${activeConversationId} - Response in ${latencyMs}ms`);

  res.json({
    response: response.text,
    conversationId: activeConversationId,
    provider: response.provider,
    model: response.model,
    latencyMs,
  });
}));

/**
 * POST /api/ai/feedback
 * Submit feedback for an AI message
 */
router.post('/feedback', asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { messageId, rating, issueType, comment } = req.body;

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

  const feedback = await conversationService.addFeedback({
    messageId,
    userId,
    rating,
    issueType,
    comment,
  });

  logInfo(`[AI Feedback] User ${userId} rated message ${messageId} as ${rating}`);

  res.json(feedback);
}));

/**
 * GET /api/ai/suggestions
 * Get role-based suggested questions
 */
router.get('/suggestions', asyncHandler(async (req: Request, res: Response) => {
  const userRole = req.user?.role as UserRole;

  if (!userRole) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const suggestions = aiPermissionService.getSuggestedQuestions(userRole);

  res.json({ suggestions, role: userRole });
}));

export default router;
