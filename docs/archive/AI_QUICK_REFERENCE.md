# AI System Quick Reference

## Quick Setup (5 minutes)

```bash
# 1. Enable pgvector
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

# 4. Index documents
curl -X POST http://localhost:5000/api/ai-admin/index/all \
  -H "Authorization: Bearer $TOKEN"
```

## Essential Endpoints

### Chat
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
```

### Admin (RAG)
```bash
# Index everything
POST /api/ai-admin/index/all

# Check stats
GET /api/ai-admin/stats

# Test search
POST /api/ai-admin/search
Body: { query: string, limit?: number }
```

## Example Requests

### Chat Request
```typescript
const response = await fetch('/api/ai/chat/persistent', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: 'What orders are pending?',
    conversationId: 'uuid-here' // optional
  })
});

const data = await response.json();
// Returns: { conversationId, message, timestamp, ... }
```

### Index Documents
```typescript
await fetch('/api/ai-admin/index/all', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` }
});
// Returns: { results: [...], total: number }
```

## Environment Variables

```env
# Required
AI_PROVIDER=claude|ollama|openai
EMBEDDING_PROVIDER=openai|ollama

# Claude (if using)
CLAUDE_API_KEY=sk-ant-...

# OpenAI (if using)
OPENAI_API_KEY=sk-...

# Ollama (if using - local & free)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# RAG tuning
RAG_TOP_K=5                    # Documents to retrieve
RAG_SIMILARITY_THRESHOLD=0.3   # Minimum similarity (0-1)
```

## File Structure

```
backend/src/
├── services/ai/
│   ├── ai-permission.service.ts    # Role-based access control
│   ├── conversation.service.ts      # Conversation CRUD
│   ├── embedding.service.ts         # Vector embeddings
│   ├── erp-context.service.ts       # Database context injection
│   ├── indexing.service.ts          # Document indexing
│   └── rag.service.ts               # RAG retrieval
├── routes/
│   ├── ai.routes.ts                 # Chat endpoints
│   ├── ai-admin.routes.ts           # Admin/indexing endpoints
│   └── conversation.routes.ts       # Conversation management
```

## Role Permissions

| Role | Orders | Styles | Inventory | Financial | Suppliers |
|------|--------|--------|-----------|-----------|-----------|
| ADMIN | ✅ | ✅ | ✅ | ✅ | ✅ |
| PRODUCTION_MANAGER | ✅ | ✅ | ✅ | ❌ | ❌ |
| SALES | ✅ | ✅ | ❌ | ❌ | ❌ |
| INVENTORY | ❌ | ❌ | ✅ | ❌ | ✅ |
| ACCOUNTS | ✅ | ❌ | ❌ | ✅ | ❌ |

## Common Questions AI Can Answer

### With ERP Context (Real-time data)
- "What orders are pending?"
- "How many styles do we have?"
- "What's the inventory status?"
- "Show me recent work orders"
- "List active customers"

### With RAG (Documentation)
- "How do I create a BOM?"
- "What is the production workflow?"
- "How do I add a new user?"
- "Explain the cost sheet process"
- "How do I import data?"

## Testing Checklist

- [ ] Database: pgvector extension enabled
- [ ] Env: AI_PROVIDER and EMBEDDING_PROVIDER configured
- [ ] Ollama: Running (if using local AI)
- [ ] Index: Documents indexed (`/index/all`)
- [ ] Chat: Test basic conversation
- [ ] Context: Test ERP data queries
- [ ] RAG: Test documentation queries
- [ ] Permissions: Test different user roles

## Troubleshooting Commands

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

## Performance Tips

1. **Use Ollama for embeddings** (free, fast)
2. **Limit RAG_TOP_K** to 3-5 documents
3. **Index only active styles** (already done)
4. **Use specific questions** for better retrieval
5. **Enable GPU** for Ollama (faster inference)

## Cost Comparison

| Provider | Input | Output | Embeddings |
|----------|-------|--------|------------|
| Claude API | $0.003/1K | $0.015/1K | N/A |
| OpenAI GPT-4 | $0.01/1K | $0.03/1K | $0.0001/1K |
| Ollama | FREE | FREE | FREE |

**Recommendation**: Use Ollama embeddings (free) + Claude chat (best quality)

## Database Schema

```sql
-- Conversations
ai_conversations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  title TEXT,
  status VARCHAR(20),  -- active, archived
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Messages
ai_messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES ai_conversations(id),
  role VARCHAR(20),    -- user, assistant, system
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMP
)

-- Embeddings
document_embeddings (
  id UUID PRIMARY KEY,
  document_type VARCHAR(50),  -- process_guide, faq, help, style
  title TEXT,
  content TEXT,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMP
)
```

## Support

- Documentation: `/docs/AI_SYSTEM_SETUP_GUIDE.md`
- Implementation: `/docs/AI_ASSISTANT_IMPLEMENTATION_GUIDE.md`
- Issues: GitHub Issues
- Email: support@kashayafabs.com
