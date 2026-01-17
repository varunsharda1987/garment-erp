# AI System Setup Guide

## Overview

The Kashaya Fabs ERP now includes an enhanced AI Assistant with three powerful capabilities:

1. **Persistent Conversation Memory** - Conversations are saved and can be resumed
2. **ERP Database Context Injection** - AI can query real orders, inventory, styles, etc.
3. **RAG (Retrieval-Augmented Generation)** - AI understands system documentation via vector search

## Architecture

### Components

- **AI Providers**: Claude (primary) + Ollama (fallback) + OpenAI (embeddings)
- **Embedding Service**: Vector embeddings via OpenAI or Ollama
- **RAG Service**: Document retrieval using pgvector similarity search
- **ERP Context Service**: Real-time database context injection
- **Indexing Service**: Indexes process guides and styles for RAG

### Security Features

- **Role-based data access**: AI respects user permissions
- **Sensitive data filtering**: Passwords, API keys, bank details never exposed
- **Read-only by default**: Write operations require explicit confirmation
- **DELETE operations prohibited**: AI cannot delete any data

## Setup Instructions

### 1. Database Setup (Enable pgvector)

Run the SQL script to enable pgvector extension and create the embeddings table:

```bash
# Connect to your PostgreSQL database
psql -U postgres -d kashaya_erp

# Run the setup script
\i backend/prisma/migrations/manual_pgvector_setup.sql
```

Or manually execute:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create document embeddings table
CREATE TABLE IF NOT EXISTS document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type VARCHAR(50) NOT NULL,
  source_id VARCHAR(255),
  title TEXT,
  content TEXT NOT NULL,
  content_hash VARCHAR(64) UNIQUE,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_document_type ON document_embeddings(document_type);
CREATE INDEX IF NOT EXISTS idx_embedding_vector ON document_embeddings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_content_hash ON document_embeddings(content_hash);
```

### 2. Environment Configuration

Add these variables to your `.env` file:

```env
# AI Provider Configuration
AI_PROVIDER=claude              # Options: claude, ollama, openai
CLAUDE_API_KEY=your_key_here    # Required for Claude
OPENAI_API_KEY=your_key_here    # Optional, for OpenAI as fallback

# Ollama Configuration (Local AI)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# Embedding Provider (for RAG)
EMBEDDING_PROVIDER=ollama       # Options: openai, ollama
EMBEDDING_API_KEY=your_key_here # Required if using OpenAI embeddings
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_BASE_URL=https://api.openai.com/v1

# RAG Configuration
RAG_TOP_K=5                     # Number of similar documents to retrieve
RAG_SIMILARITY_THRESHOLD=0.3    # Minimum similarity score (0-1)
```

### 3. Install Ollama (Optional - for local AI)

If you want to use local AI without API costs:

**Windows:**
```bash
# Download and install from https://ollama.ai
# Pull required models
ollama pull llama3
ollama pull nomic-embed-text
```

**Linux/Mac:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3
ollama pull nomic-embed-text
```

### 4. Index Documents for RAG

After setup, index the documentation and styles:

**Using curl:**
```bash
# Get your auth token first
TOKEN="your_jwt_token_here"

# Initialize RAG (indexes all documents)
curl -X POST http://localhost:5000/api/ai-admin/index/all \
  -H "Authorization: Bearer $TOKEN"

# Check indexing stats
curl http://localhost:5000/api/ai-admin/stats \
  -H "Authorization: Bearer $TOKEN"
```

**Using the frontend:**
Navigate to AI Assistant settings and click "Initialize RAG Index"

## API Endpoints

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

## Role-Based Data Access

The AI respects user roles and only reveals authorized data:

| Role | Access |
|------|--------|
| ADMIN | Full access to all data |
| PRODUCTION_MANAGER | Orders, styles, work orders, production data |
| SALES | Orders, quotations, customers, styles |
| INVENTORY | Stock levels, materials, suppliers |
| ACCOUNTS | Invoices, payments, financial data |
| QUALITY | Quality inspections, test results |
| PURCHASE | Purchase orders, suppliers, GRN |
| FACTORY_SUPERVISOR | Production, work orders, materials |
| MERCHANDISER | Styles, orders, customers (read-only) |

## Data Privacy

The AI system includes safeguards:

1. **Sensitive fields filtered**:
   - Passwords
   - API keys
   - Bank account details
   - Credit card information

2. **Role-based filtering**:
   - Supplier pricing visible only to PURCHASE, INVENTORY, ACCOUNTS
   - Customer contacts visible only to SALES, ADMIN
   - Financial data visible only to ACCOUNTS, ADMIN

3. **Audit logging**:
   - All AI interactions are logged
   - User feedback is collected for improvement

## How It Works

### 1. Persistent Conversations

```typescript
// Frontend usage
const response = await fetch('/api/ai/chat/persistent', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: 'What orders are pending?',
    conversationId: existingConversationId // Optional
  })
});
```

### 2. ERP Context Injection

When you ask questions like:
- "What orders are pending?" → AI fetches real orders from database
- "How many styles do we have?" → AI queries styles table
- "What's the stock level of fabric X?" → AI checks inventory

The system:
1. Detects context needs from your question
2. Fetches relevant data based on your role
3. Injects data into AI prompt
4. AI responds with actual ERP data

### 3. RAG (Vector Search)

When you ask questions like:
- "How do I create a BOM?" → Searches process guides
- "What is the production workflow?" → Retrieves workflow documentation
- "Tell me about style ABC-123" → Searches indexed styles

The system:
1. Generates embedding for your question
2. Searches similar documents using pgvector
3. Retrieves top matching documents
4. AI uses retrieved context to answer

## Indexed Content

The system automatically indexes:

### Process Guides
- How to create a new style
- How to create a Bill of Materials (BOM)
- How to create a cost sheet
- How to create a customer order
- Production workflow overview
- Inventory management guide

### FAQs
- Password reset
- User management
- Data export/import
- System navigation

### Database Content
- Active styles (styleCode, styleName, customer, description, season)
- Limited to 500 most recent active styles

## Testing the System

### 1. Test Basic Chat

```bash
curl -X POST http://localhost:5000/api/ai/chat/persistent \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, how can you help me?"}'
```

### 2. Test ERP Context

```bash
curl -X POST http://localhost:5000/api/ai/chat/persistent \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "What orders are pending?"}'
```

### 3. Test RAG

```bash
# First, index documents
curl -X POST http://localhost:5000/api/ai-admin/index/all \
  -H "Authorization: Bearer $TOKEN"

# Then ask a question
curl -X POST http://localhost:5000/api/ai/chat/persistent \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I create a BOM?"}'
```

## Troubleshooting

### Issue: "Embedding service not initialized"

**Solution**: Check your embedding provider configuration:
```env
EMBEDDING_PROVIDER=ollama  # or openai
OLLAMA_BASE_URL=http://localhost:11434  # Make sure Ollama is running
```

If using Ollama, verify it's running:
```bash
curl http://localhost:11434/api/tags
```

### Issue: "pgvector extension not found"

**Solution**: Run the SQL setup script:
```bash
psql -U postgres -d kashaya_erp -f backend/prisma/migrations/manual_pgvector_setup.sql
```

### Issue: "No documents indexed"

**Solution**: Call the indexing endpoint:
```bash
curl -X POST http://localhost:5000/api/ai-admin/index/all \
  -H "Authorization: Bearer $TOKEN"
```

### Issue: AI responses are slow

**Possible causes**:
1. Using Claude API - responses take 2-5 seconds (normal)
2. Using Ollama on CPU - consider GPU acceleration
3. Large RAG context - reduce `RAG_TOP_K` value

### Issue: "Unauthorized" errors

**Solution**: Make sure you're passing a valid JWT token:
```bash
# Login first to get token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@kashayafabs.com", "password": "your_password"}'

# Use the token from response
TOKEN="eyJhbGc..."
```

## Performance Tuning

### Vector Search Performance

```sql
-- Check index usage
EXPLAIN ANALYZE SELECT * FROM document_embeddings
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;

-- Rebuild index if needed
REINDEX INDEX idx_embedding_vector;

-- Adjust ivfflat lists (default is good for <100k documents)
CREATE INDEX idx_embedding_vector ON document_embeddings
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### Indexing Performance

- Styles are limited to 500 most recent active styles
- Process guides are ~8 documents (minimal overhead)
- Batch indexing: Use `/index/all` endpoint

### Query Optimization

- Adjust `RAG_TOP_K` (default: 5) for fewer/more results
- Increase `RAG_SIMILARITY_THRESHOLD` (default: 0.3) for stricter matches
- Use specific questions for better retrieval

## Cost Considerations

### Using Claude API
- ~$0.003 per 1K input tokens
- ~$0.015 per 1K output tokens
- Typical conversation: ~$0.01-0.05 per message

### Using OpenAI Embeddings
- text-embedding-3-small: $0.0001 per 1K tokens
- One-time indexing cost: ~$0.01-0.10
- Re-indexing needed only when content changes

### Using Ollama (Local)
- **FREE** - runs locally
- Requires: 8GB RAM for llama3, 1GB for embeddings
- Slower on CPU, fast on GPU

## Recommended Setup

### For Production (Best quality)
```env
AI_PROVIDER=claude
CLAUDE_API_KEY=your_key
EMBEDDING_PROVIDER=openai
EMBEDDING_API_KEY=your_key
```

### For Development (Cost-free)
```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
EMBEDDING_PROVIDER=ollama
```

### Hybrid (Best of both)
```env
AI_PROVIDER=claude
CLAUDE_API_KEY=your_key
EMBEDDING_PROVIDER=ollama  # Free embeddings
OLLAMA_BASE_URL=http://localhost:11434
```

## Future Enhancements

Potential improvements:
1. Support for image understanding (style images)
2. Voice input/output
3. Multi-language support
4. Custom training on company data
5. Integration with WhatsApp/Telegram
6. Automated report generation
7. Predictive analytics

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review logs: `backend/logs/`
3. Contact support: support@kashayafabs.com
