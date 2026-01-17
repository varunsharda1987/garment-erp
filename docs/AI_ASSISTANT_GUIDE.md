# AI Assistant - Complete Guide

> **Document Version:** 2.0
> **Status:** Complete and Production-Ready
> **Project:** Kashaya Fabs Garment ERP

---

## Table of Contents

1. [Overview](#1-overview)
2. [Quick Setup](#2-quick-setup)
3. [Architecture](#3-architecture)
4. [Phase 1: Persistent Conversation Memory](#4-phase-1-persistent-conversation-memory)
5. [Phase 2: ERP Database Context Injection](#5-phase-2-erp-database-context-injection)
6. [Phase 3: RAG with pgvector](#6-phase-3-rag-with-pgvector)
7. [API Reference](#7-api-reference)
8. [Security & Permissions](#8-security--permissions)
9. [Environment Configuration](#9-environment-configuration)
10. [Testing & Troubleshooting](#10-testing--troubleshooting)
11. [Cost Considerations](#11-cost-considerations)
12. [Quick Reference](#12-quick-reference)

---

## 1. Overview

### Current Status: Production Ready

| Component | Status | Description |
|-----------|--------|-------------|
| AI Provider Abstraction | Complete | Claude, OpenAI, Ollama, Gemini support |
| Persistent Conversations | Complete | Database-backed conversation history |
| ERP Context Injection | Complete | Real-time database queries |
| RAG/Vector Search | Complete | pgvector similarity search |
| Role-Based Access | Complete | Data filtered by user permissions |
| Feedback Collection | Complete | User ratings and comments |

### What the AI Can Do

#### Query Real ERP Data (Real-time)
- "What orders are pending?"
- "How many styles do we have?"
- "What's the inventory status?"
- "Show me recent work orders"
- "List active customers"

#### Answer Documentation Questions (RAG)
- "How do I create a BOM?"
- "What is the production workflow?"
- "How do I add a new user?"
- "Explain the cost sheet process"

#### Remember Conversations
- All conversations saved to database
- Resume any conversation anytime
- Full conversation history
- Feedback collection for improvement

---

## 2. Quick Setup

### 5-Minute Setup

```bash
# 1. Enable pgvector extension
psql -U postgres -d kashaya_erp -f backend/prisma/migrations/manual_pgvector_setup.sql

# 2. Install Ollama (optional - for free local AI)
# Windows: Download from https://ollama.ai
# Linux/Mac:
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3
ollama pull nomic-embed-text

# 3. Configure .env
echo "EMBEDDING_PROVIDER=ollama" >> backend/.env
echo "OLLAMA_BASE_URL=http://localhost:11434" >> backend/.env

# 4. Index documents (requires auth token)
TOKEN="your_jwt_token"
curl -X POST http://localhost:5000/api/ai-admin/index/all \
  -H "Authorization: Bearer $TOKEN"
```

### Verify Setup

```bash
# Check Ollama status
curl http://localhost:11434/api/tags

# Check pgvector
psql -U postgres -d kashaya_erp -c "SELECT * FROM pg_extension WHERE extname = 'vector';"

# Check indexed documents
psql -U postgres -d kashaya_erp -c "SELECT document_type, COUNT(*) FROM document_embeddings GROUP BY document_type;"
```

---

## 3. Architecture

### System Diagram

```
+---------------------------------------------------------------------+
|                     AI ASSISTANT ARCHITECTURE                        |
+---------------------------------------------------------------------+
|                                                                      |
|  USER -> [Frontend UI] -> [API Routes] -> [Services] -> [AI Provider]|
|                               |                                      |
|                               +-- Conversation Service               |
|                               +-- Permission Service (Role-based)    |
|                               +-- ERP Context Service                |
|                               +-- RAG Service (Vector Search)        |
|                                                                      |
|  STORAGE:                                                            |
|  +-- PostgreSQL: Conversations, Messages, Feedback                   |
|  +-- pgvector: Document Embeddings (for RAG)                         |
|                                                                      |
|  AI PROVIDERS (Multi-Provider with Fallback):                        |
|  +-- Primary: Claude (Anthropic)                                     |
|  +-- Fallback: Ollama (Local)                                        |
|  +-- Embeddings: OpenAI or Ollama                                    |
|                                                                      |
+---------------------------------------------------------------------+
```

### File Structure

```
backend/src/
+-- services/ai/
|   +-- providers/
|   |   +-- IAIProvider.ts           # Interface definition
|   |   +-- AIProviderFactory.ts     # Factory pattern
|   |   +-- AnthropicProvider.ts     # Claude integration
|   |   +-- OpenAIProvider.ts        # GPT integration
|   |   +-- GeminiProvider.ts        # Google Gemini
|   |   +-- OllamaProvider.ts        # Local Ollama
|   |   +-- MultiProviderFallback.ts # Fallback mechanism
|   +-- ai-permission.service.ts     # Role-based access control
|   +-- conversation.service.ts      # Conversation CRUD
|   +-- embedding.service.ts         # Vector embeddings
|   +-- erp-context.service.ts       # Database context injection
|   +-- indexing.service.ts          # Document indexing
|   +-- rag.service.ts               # RAG retrieval
+-- routes/
|   +-- ai.routes.ts                 # Chat endpoints
|   +-- ai-admin.routes.ts           # Admin/indexing endpoints
|   +-- conversation.routes.ts       # Conversation management

frontend/src/
+-- pages/
|   +-- AIAssistant.tsx              # AI chat interface
+-- components/
|   +-- ConversationSidebar.tsx      # Conversation list
|   +-- AIFeedback.tsx               # Feedback collection
+-- services/
    +-- conversation.service.ts      # Frontend API service
```

---

## 4. Phase 1: Persistent Conversation Memory

### Database Schema

```prisma
model ai_conversations {
  id            String             @id @default(uuid())
  userId        String
  title         String?
  status        ConversationStatus @default(ACTIVE)
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt
  lastMessageAt DateTime           @default(now())

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
  actionType      String?       // 'create', 'update', 'status_change'
  actionEntity    String?       // 'style', 'order', etc.
  actionPayload   Json?
  actionStatus    ActionStatus?
  metadata        Json?
  createdAt       DateTime      @default(now())

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

  message     ai_messages    @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user        users          @relation(fields: [userId], references: [id])
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

### Features

- **Conversations saved to database** - Survive page refresh
- **Full message history** - All user/assistant messages stored
- **Auto-generated titles** - AI generates conversation titles
- **Soft delete** - Conversations archived, not permanently deleted
- **Feedback collection** - Users can rate responses

---

## 5. Phase 2: ERP Database Context Injection

### How It Works

1. **Context Detection**: System analyzes user question for keywords
2. **Data Fetching**: Queries relevant tables based on user role
3. **Context Injection**: Injects data into AI prompt
4. **Response Generation**: AI responds with real ERP data

### Keyword Detection

| Context Type | Keywords |
|--------------|----------|
| Orders | order, orders, delivery, pending, shipped, dispatch, overdue |
| Styles | style, styles, design, garment, product, collection |
| Inventory | inventory, stock, material, fabric, trim, quantity, low stock |
| Production | production, work order, manufacturing, cutting, stitching |
| Customers | customer, buyer, client, brand |

### Data Access by Role

| Data Type | Allowed Roles |
|-----------|---------------|
| pricing.costPrice | ADMIN, ACCOUNTS |
| pricing.sellingPrice | ADMIN, ACCOUNTS, SALES, MERCHANDISER |
| pricing.margin | ADMIN, ACCOUNTS |
| order.all | ADMIN, SALES, MERCHANDISER, PRODUCTION_MANAGER |
| order.financial | ADMIN, ACCOUNTS, SALES |
| customer.contactInfo | ADMIN, SALES, MERCHANDISER, ACCOUNTS |
| customer.creditLimit | ADMIN, ACCOUNTS, SALES |
| supplier.contactInfo | ADMIN, PURCHASE |
| supplier.pricing | ADMIN, PURCHASE, ACCOUNTS |
| inventory.quantities | ADMIN, INVENTORY, PURCHASE, PRODUCTION_MANAGER |
| inventory.valuations | ADMIN, ACCOUNTS |
| user.list | ADMIN |
| user.activity | ADMIN |

---

## 6. Phase 3: RAG with pgvector

### pgvector Setup

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

### Indexed Content

#### Process Guides
- How to create a new style
- How to create a Bill of Materials (BOM)
- How to create a cost sheet
- How to create a customer order
- Production workflow overview
- Inventory management guide

#### FAQs
- Password reset
- User management
- Data export/import
- System navigation

#### Database Content
- Active styles (styleCode, styleName, customer, description, season)
- Limited to 500 most recent active styles

### How RAG Works

1. **User asks question**: "How do I create a BOM?"
2. **Generate embedding**: Convert question to vector
3. **Similarity search**: Find similar documents in pgvector
4. **Retrieve context**: Get top matching documents
5. **Generate response**: AI uses retrieved context to answer

---

## 7. API Reference

### Chat Endpoints

```
POST /api/ai/chat/persistent
- Create or continue a conversation
- Body: { message: string, conversationId?: string }
- Returns: AI response with conversation ID

GET /api/ai/conversations
- List all user conversations
- Returns: Array of conversations

GET /api/ai/conversations/:id
- Get conversation with messages
- Returns: Full conversation details

DELETE /api/ai/conversations/:id
- Soft delete a conversation
- Returns: Success confirmation

GET /api/ai/suggestions
- Get role-based suggested questions
- Returns: Array of suggestions

POST /api/ai/feedback
- Submit feedback for an AI message
- Body: { messageId, rating, issueType?, comment? }
- Returns: Success confirmation

GET /api/ai/status
- Get AI provider status
- Returns: { enabled, available, provider, model }
```

### Admin Endpoints (RAG)

```
POST /api/ai-admin/index/all
- Index all documents (guides + styles)
- Requires: ADMIN role

POST /api/ai-admin/index/guides
- Index only process guides
- Requires: ADMIN role

POST /api/ai-admin/index/styles
- Index only active styles
- Requires: ADMIN role

GET /api/ai-admin/stats
- Get indexing statistics
- Requires: ADMIN role

POST /api/ai-admin/search
- Test RAG search
- Body: { query: string, limit?: number }
- Requires: ADMIN role
```

### Example Requests

```typescript
// Chat Request
const response = await fetch('/api/ai/chat/persistent', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: 'What orders are pending?',
    conversationId: existingId // optional
  })
});

// Index Documents
await fetch('/api/ai-admin/index/all', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

## 8. Security & Permissions

### AI Action Tiers

| Tier | Action | Allowed? | How It Works |
|------|--------|----------|--------------|
| 0 | READ data | Yes | Filtered by user role |
| 1 | CREATE drafts | Yes | User must confirm before save |
| 2 | UPDATE records | Yes | Shows before/after, requires confirm |
| 3 | STATUS CHANGE | Yes | Requires approval workflow |
| 4 | DELETE | **NO** | Suggests UI path instead |
| 5 | BULK MODIFY | **NO** | Prohibited |

### Role-Based Data Access Matrix

| Role | Orders | Styles | Inventory | Financial | Suppliers |
|------|--------|--------|-----------|-----------|-----------|
| ADMIN | Full | Full | Full | Full | Full |
| PRODUCTION_MANAGER | Full | Full | Full | Hidden | Hidden |
| SALES | Full | Full | Hidden | Hidden | Hidden |
| MERCHANDISER | Read | Full | Hidden | Limited | Hidden |
| INVENTORY | Hidden | Hidden | Full | Hidden | Full |
| ACCOUNTS | Full | Hidden | Hidden | Full | Hidden |
| PURCHASE | Hidden | Hidden | Read | Hidden | Full |
| QUALITY | Read | Read | Hidden | Hidden | Hidden |
| FACTORY_SUPERVISOR | Read | Read | Read | Hidden | Hidden |

### Always Hidden from AI

- Passwords, password hashes, tokens, API keys
- Bank account details, IFSC codes
- Credit card information
- GST/PAN numbers (except ACCOUNTS role)
- Salary information

### Data Privacy Features

1. **Sensitive fields filtered** - Never exposed to AI
2. **Role-based filtering** - Data scoped to user permissions
3. **Audit logging** - All AI interactions logged
4. **Read-only default** - Write operations require confirmation
5. **DELETE prohibited** - AI cannot delete any data

---

## 9. Environment Configuration

### Backend .env

```env
# ============================================
# AI CONFIGURATION
# ============================================

# Enable AI features
AI_ENABLED="true"

# Primary AI Provider
AI_PROVIDER="anthropic"            # Options: anthropic, ollama, openai
AI_API_KEY="sk-ant-api03-xxxxx"    # Required for Claude
AI_MODEL="claude-sonnet-4-20250514"

# Fallback AI Provider (Ollama - local)
AI_FALLBACK_ENABLED="true"
AI_FALLBACK_PROVIDER="ollama"
AI_FALLBACK_BASE_URL="http://localhost:11434"
AI_FALLBACK_MODEL="llama3"

# Embeddings Provider (for RAG)
EMBEDDING_PROVIDER="ollama"        # Options: openai, ollama
EMBEDDING_API_KEY="sk-xxxxx"       # Required if using OpenAI
EMBEDDING_MODEL="text-embedding-3-small"
EMBEDDING_BASE_URL="https://api.openai.com/v1"

# Ollama Configuration
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama3"
OLLAMA_EMBEDDING_MODEL="nomic-embed-text"

# RAG Configuration
RAG_TOP_K=5                        # Number of similar documents to retrieve
RAG_SIMILARITY_THRESHOLD=0.3       # Minimum similarity score (0-1)
```

### Recommended Configurations

#### Development (Free)
```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
EMBEDDING_PROVIDER=ollama
```
- **Cost**: $0/month
- **Requirements**: 8GB RAM
- **Performance**: Good (faster with GPU)

#### Production (Best Quality)
```env
AI_PROVIDER=claude
CLAUDE_API_KEY=sk-ant-...
EMBEDDING_PROVIDER=openai
EMBEDDING_API_KEY=sk-...
```
- **Cost**: ~$0.01-0.05 per conversation
- **Requirements**: API keys
- **Performance**: Excellent

#### Hybrid (Best Value)
```env
AI_PROVIDER=claude
CLAUDE_API_KEY=sk-ant-...
EMBEDDING_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
```
- **Cost**: ~$0.01-0.05 per conversation (no embedding costs)
- **Requirements**: API key + 8GB RAM
- **Performance**: Excellent

### Getting API Keys

| Provider | Where to Get | Pricing |
|----------|--------------|---------|
| Anthropic (Claude) | console.anthropic.com | ~$3/M input, $15/M output |
| OpenAI (Embeddings) | platform.openai.com | ~$0.02/M tokens |
| Ollama | ollama.com/download | Free (local) |

---

## 10. Testing & Troubleshooting

### Testing Checklist

#### Phase 1: Persistent Memory
- [ ] Create new conversation via API
- [ ] Send messages and verify they're saved
- [ ] Reload page - conversations persist
- [ ] List conversations shows history
- [ ] Delete conversation (soft delete)
- [ ] Search conversations by content

#### Phase 2: ERP Context
- [ ] Ask "What orders are pending?" - verify real data shown
- [ ] Ask about inventory - verify stock data
- [ ] Test with different roles - verify filtering
- [ ] Test sensitive data hiding

#### Phase 3: RAG
- [ ] Run `/api/ai-admin/index/all` as admin
- [ ] Verify embedding stats show documents
- [ ] Ask "How do I create a style?" - verify RAG retrieval
- [ ] Check response cites relevant documentation

#### Security
- [ ] Try "Delete customer X" - verify AI refuses
- [ ] Test role-based data access
- [ ] Verify audit logs for AI actions

### Common Issues & Solutions

#### "Embedding service not initialized"
```env
# Check embedding provider configuration
EMBEDDING_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
```
Verify Ollama is running: `curl http://localhost:11434/api/tags`

#### "pgvector extension not found"
```bash
psql -U postgres -d kashaya_erp -f backend/prisma/migrations/manual_pgvector_setup.sql
```

#### "No documents indexed"
```bash
curl -X POST http://localhost:5000/api/ai-admin/index/all \
  -H "Authorization: Bearer $TOKEN"
```

#### AI responses are slow
**Possible causes:**
1. Using Claude API - responses take 2-5 seconds (normal)
2. Using Ollama on CPU - consider GPU acceleration
3. Large RAG context - reduce `RAG_TOP_K` value

#### "Unauthorized" errors
```bash
# Login first to get token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@kashayafabs.com", "password": "your_password"}'

# Use the token from response
TOKEN="eyJhbGc..."
```

### Troubleshooting Commands

```bash
# Check Ollama status
curl http://localhost:11434/api/tags

# Check pgvector
psql -U postgres -d kashaya_erp -c "SELECT * FROM pg_extension WHERE extname = 'vector';"

# Check indexed documents
psql -U postgres -d kashaya_erp -c "SELECT document_type, COUNT(*) FROM document_embeddings GROUP BY document_type;"

# View logs
tail -f backend/logs/combined.log

# Test embedding
curl http://localhost:11434/api/embeddings \
  -d '{"model": "nomic-embed-text", "prompt": "test"}'
```

---

## 11. Cost Considerations

### Cost Comparison

| Provider | Input | Output | Embeddings |
|----------|-------|--------|------------|
| Claude API | $0.003/1K | $0.015/1K | N/A |
| OpenAI GPT-4 | $0.01/1K | $0.03/1K | $0.0001/1K |
| Ollama | FREE | FREE | FREE |

### Typical Costs

- **Chat response**: ~$0.01-0.05 per message (Claude)
- **Embedding generation**: ~$0.01-0.10 one-time (OpenAI)
- **Re-indexing**: Only needed when content changes

### Recommendation

Use **Ollama embeddings (free) + Claude chat (best quality)** for optimal cost/performance balance.

---

## 12. Quick Reference

### Essential Endpoints

```bash
# Start/continue conversation
POST /api/ai/chat/persistent
Body: { message: string, conversationId?: string }

# List conversations
GET /api/ai/conversations

# Get conversation details
GET /api/ai/conversations/:id

# Delete conversation
DELETE /api/ai/conversations/:id

# Index everything (admin)
POST /api/ai-admin/index/all

# Check stats (admin)
GET /api/ai-admin/stats
```

### Role Permissions Quick Reference

| Role | Orders | Styles | Inventory | Financial | Suppliers |
|------|--------|--------|-----------|-----------|-----------|
| ADMIN | Full | Full | Full | Full | Full |
| PRODUCTION_MANAGER | Full | Full | Full | Hidden | Hidden |
| SALES | Full | Full | Hidden | Hidden | Hidden |
| INVENTORY | Hidden | Hidden | Full | Hidden | Full |
| ACCOUNTS | Full | Hidden | Hidden | Full | Hidden |

### Performance Metrics

- **Chat response time**: 2-5 seconds (Claude API)
- **Embedding generation**: <100ms (Ollama local)
- **Vector search**: <50ms (pgvector with proper indexes)
- **ERP context fetch**: <100ms (database queries)
- **Total latency**: ~2-6 seconds per message

### Files Modified/Created

**Backend Services:**
- `backend/src/services/ai/ai-permission.service.ts`
- `backend/src/services/ai/conversation.service.ts`
- `backend/src/services/ai/embedding.service.ts`
- `backend/src/services/ai/erp-context.service.ts`
- `backend/src/services/ai/indexing.service.ts`
- `backend/src/services/ai/rag.service.ts`

**Backend Routes:**
- `backend/src/routes/ai.routes.ts`
- `backend/src/routes/ai-admin.routes.ts`
- `backend/src/routes/conversation.routes.ts`

**Database:**
- `backend/prisma/migrations/manual_pgvector_setup.sql`
- `backend/prisma/schema.prisma` (ai_conversations, ai_messages, ai_feedback)

**Frontend:**
- `frontend/src/pages/AIAssistant.tsx`
- `frontend/src/components/ConversationSidebar.tsx`
- `frontend/src/components/AIFeedback.tsx`
- `frontend/src/services/conversation.service.ts`

---

## Future Enhancements

Potential improvements:
1. Support for image understanding (style images)
2. Voice input/output
3. Multi-language support
4. Custom training on company data
5. Integration with WhatsApp/Telegram
6. Automated report generation
7. Predictive analytics

---

## Support

For issues or questions:
1. Check this guide thoroughly
2. Review backend logs: `backend/logs/`
3. Check troubleshooting section above
4. Contact: support@kashayafabs.com

---

**Document Status:** Complete
**Last Updated:** January 2026
**Ready for Production:** Yes
