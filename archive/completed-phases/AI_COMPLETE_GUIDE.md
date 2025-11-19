# AI Complete Guide for Garment ERP

> **Complete guide for AI features in Kashaya Fabs Garment ERP System**
>
> From quick setup to advanced RAG implementation

---

## Table of Contents

### Getting Started
1. [Quick Start (5 Minutes)](#1-quick-start-5-minutes)
2. [User Guide (How to Use AI Assistant)](#2-user-guide-how-to-use-ai-assistant)

### Technical Documentation
3. [Architecture (How It Works)](#3-architecture-how-it-works)
4. [Implementation Details](#4-implementation-details)
5. [Switching Providers](#5-switching-providers)
6. [Advanced Features](#6-advanced-features)
7. [Troubleshooting](#7-troubleshooting)

### Future Enhancements
8. [RAG Implementation Plan (Vector Database)](#8-rag-implementation-plan-vector-database)

---

# 1. Quick Start (5 Minutes)

## Current Setup Status

✅ **AI Provider Abstraction Layer**: COMPLETE
✅ **AI Chat Interface**: COMPLETE
✅ **Conversation Memory**: COMPLETE
⏳ **Vector Database (RAG)**: PLANNED (See Section 8)

## Choose Your AI Provider

| Provider | Setup Time | Cost | Speed | Quality | Best For |
|----------|-----------|------|-------|---------|----------|
| **Ollama** | 2 min | FREE | ⭐⭐ | ⭐⭐⭐ | Development, Testing, Privacy |
| **OpenAI GPT-4** | 1 min | $$$ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Production, Complex Tasks |
| **OpenAI GPT-3.5** | 1 min | $ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Production, Simple Tasks |
| **Anthropic Claude** | 1 min | $$ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Long Documents, Analysis |
| **Google Gemini** | 1 min | $$ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Cost-Effective Production |

## Setup Instructions

### Option A: Ollama (FREE - Recommended for Development)

**Step 1: Install Ollama**
```bash
# Download from: https://ollama.ai/download
# Install the application
```

**Step 2: Pull a model**
```bash
ollama pull llama3
```

**Step 3: Configure backend/.env**
```bash
AI_ENABLED="true"
AI_PROVIDER="ollama"
AI_BASE_URL="http://localhost:11434"
AI_MODEL="llama3"
AI_API_KEY=""  # Not needed for Ollama
```

**Step 4: Restart server**
```bash
cd backend
npm run dev
```

**Verify**: Look for this message:
```
✅ AI Provider initialized: Ollama (Local) (llama3)
```

**Done!** ✅ You now have FREE local AI.

---

### Option B: OpenAI (Paid - Best Quality)

**Step 1: Get API Key**
- Visit: https://platform.openai.com/api-keys
- Create new secret key

**Step 2: Configure backend/.env**
```bash
AI_ENABLED="true"
AI_PROVIDER="openai"
AI_API_KEY="sk-proj-..."
AI_MODEL="gpt-4-turbo"  # or "gpt-3.5-turbo" for cheaper option
```

**Step 3: Restart server**
```bash
cd backend
npm run dev
```

**Verify**: Look for:
```
✅ AI Provider initialized: OpenAI (gpt-4-turbo)
```

**Done!** ✅ Using GPT-4.

---

### Option C: Anthropic Claude (Paid - Excellent for Analysis)

**Step 1: Get API Key**
- Visit: https://console.anthropic.com/
- Create API key

**Step 2: Configure backend/.env**
```bash
AI_ENABLED="true"
AI_PROVIDER="anthropic"
AI_API_KEY="sk-ant-..."
AI_MODEL="claude-3-5-sonnet-20241022"
```

**Step 3: Restart server**

**Verify**: Look for:
```
✅ AI Provider initialized: Anthropic (claude-3-5-sonnet-20241022)
```

**Done!** ✅ Using Claude 3.5 Sonnet.

---

### Option D: Google Gemini (Paid - Cost-Effective)

**Step 1: Get API Key**
- Visit: https://makersuite.google.com/app/apikey
- Create API key

**Step 2: Configure backend/.env**
```bash
AI_ENABLED="true"
AI_PROVIDER="google"
AI_API_KEY="AIza..."
AI_MODEL="gemini-1.5-pro"
```

**Step 3: Restart server**

**Verify**: Look for:
```
✅ AI Provider initialized: Google (gemini-1.5-pro)
```

**Done!** ✅ Using Gemini.

---

## Cost Comparison

Assuming 1,000 AI requests/day in production:

| Provider | Model | Monthly Cost | Best For |
|----------|-------|--------------|----------|
| **Ollama** | llama3 | **$0** | Development, testing, privacy-sensitive |
| **OpenAI** | gpt-3.5-turbo | ~$15 | Simple tasks, high volume |
| **OpenAI** | gpt-4-turbo | ~$100 | Complex analysis, critical decisions |
| **Anthropic** | claude-3-5-sonnet | ~$30 | Long documents, code analysis |
| **Google** | gemini-1.5-pro | ~$70 | Balanced cost/quality |

**Recommendation**:
- **Development**: Ollama (FREE)
- **Production Start**: GPT-3.5 or Gemini
- **Production Premium**: GPT-4 or Claude 3.5

---

# 2. User Guide (How to Use AI Assistant)

## Accessing the AI Assistant

### Step 1: Make Sure Services Are Running

**Backend** (port 5000):
```bash
cd backend
npm run dev
```

Expected output:
```
✅ AI Provider initialized: Ollama (Local)
🚀 Server running on: http://localhost:5000
```

**Frontend** (port 5173):
```bash
cd frontend
npm run dev
```

Opens at: `http://localhost:5173`

---

### Step 2: Login to ERP

1. Navigate to `http://localhost:5173`
2. Enter your credentials
3. Click "Login"

---

### Step 3: Open AI Assistant

Look for the **sparkle icon** (✨) in the left sidebar:

```
📊 Main Dashboard
✨ AI Assistant  [NEW]  ← Click here!
─────────────
📁 Masters
  ├─ 👥 Customers
  ├─ 🏭 Suppliers
  ├─ 📦 Materials
  └─ ...
```

---

## Using the Chat Interface

### Interface Elements

**1. Welcome Screen**
- Suggested questions for quick start
- Bot icon and welcome message

**2. Chat Area**
- Your messages: Blue bubbles on right
- AI responses: Gray bubbles on left with bot icon
- Timestamps for each message

**3. Input Area**
- Text input field
- Send button
- Keyboard shortcuts display

**4. Clear Chat Button**
- Appears when conversation started
- Resets the conversation

---

### Example Questions

**About ERP System:**
```
"What is an ERP system?"
"What are the key features of this ERP?"
"How does this system help garment manufacturing?"
"Explain the workflow from order to delivery"
```

**About Features:**
```
"How do I manage materials?"
"Explain the order workflow"
"How do I create a new style?"
"What is a BOM?"
"How do I track production?"
"What is the difference between cost sheet and BOM?"
```

**About Operations:**
```
"How do I add a new customer?"
"How does cost calculation work?"
"Explain inventory management"
"What is the production dashboard?"
"How do I create a work order?"
```

**Getting Help:**
```
"I'm new to this system, where should I start?"
"What's the difference between styles and orders?"
"How do I manage suppliers?"
"What permissions do I need to create an order?"
```

---

### Conversation Features

**Conversation Memory**
- AI remembers your entire conversation
- Can refer back to previous questions
- Maintains context across messages

**Example**:
```
You: "What is a BOM?"
AI: [Explains Bill of Materials]

You: "How do I create one?"
AI: [Remembers you're asking about BOM, gives specific steps]

You: "What information do I need?"
AI: [Continues BOM context with required fields]
```

**Clear Chat**
- Click "Clear Chat" button to start fresh
- Useful when changing topics
- Conversation memory resets

---

### Interface Tips

**Keyboard Shortcuts:**
- **Enter**: Send message
- **Shift + Enter**: New line in message

**Suggested Questions:**
- Click any suggested question to ask it instantly
- Great for exploring features

**Typing Indicator:**
- Animated dots show when AI is thinking
- Response time: 2-10 seconds depending on provider

---

## Current Capabilities

### What AI CAN Do:

✅ **Answer ERP Questions**
- Explain features and modules
- Describe workflows
- Provide guidance on operations

✅ **Remember Conversations**
- Context from previous messages (last 10)
- Follow-up questions work naturally
- Maintains topic continuity

✅ **Provide System Knowledge**
- Kashaya Fabs ERP-specific information
- Garment manufacturing processes
- Best practices and recommendations

✅ **Step-by-Step Guidance**
- How to perform tasks
- Field explanations
- Navigation help

---

### What AI CANNOT Do (Currently):

❌ **Access Real Data**
- Cannot see your actual orders, styles, customers
- Cannot query database records
- Cannot show specific order numbers or amounts

❌ **Perform Actions**
- Cannot create orders or styles
- Cannot modify database
- Cannot execute system operations

❌ **Real-Time Information**
- Cannot check current stock levels
- Cannot show pending orders
- Cannot access live production data

**Note**: These limitations will be removed when RAG (Retrieval Augmented Generation) is implemented. See [Section 8](#8-rag-implementation-plan-vector-database) for the plan to add real data access.

---

## Tips for Best Results

### Ask Clear Questions

❌ **Bad**: "help"
✅ **Good**: "How do I create a new customer in this system?"

❌ **Bad**: "orders"
✅ **Good**: "What's the workflow for processing a new order?"

### Be Specific

❌ **Bad**: "materials"
✅ **Good**: "How do I add a new fabric material?"

❌ **Bad**: "production"
✅ **Good**: "Explain how to track production stages"

### Provide Context

❌ **Bad**: "what's that?"
✅ **Good**: "What is a Bill of Materials (BOM)?"

❌ **Bad**: "how?"
✅ **Good**: "How do I calculate cost for a style?"

### Use Follow-ups

✅ **Good**: Build on previous questions
```
You: "What is a style?"
AI: [Explains]

You: "How do I create one?"  ← References previous context
AI: [Gives steps]
```

---

## Privacy & Security

### Using Ollama (Local):

✅ **Complete Privacy**
- All data stays on your computer
- No internet connection needed for AI
- Queries never leave your network

✅ **FREE Forever**
- No usage limits
- No API costs
- No subscriptions

✅ **Data Control**
- You control the model
- Can run offline
- Full audit trail

### Using Cloud AI (OpenAI/Anthropic/Google):

⚠️ **Privacy Considerations**
- Questions sent to provider's servers
- Subject to provider's privacy policy
- Conversation data may be stored

✅ **Benefits**
- Better quality responses
- Faster response times
- More advanced capabilities

⚠️ **Costs**
- Pay per API request
- Charges based on tokens used
- Can add up with heavy usage

**Recommendation**:
- Use Ollama for sensitive information
- Use cloud AI for general questions
- Review your organization's data policies

---

# 3. Architecture (How It Works)

## Provider Abstraction Layer

### Core Concept

The ERP uses a **provider-agnostic architecture** that allows switching between AI providers without changing any business logic code.

```
┌─────────────────────────────────┐
│  Business Logic                 │
│  (AI Chat, Features)            │
│  Uses: IAIProvider interface    │
└────────────┬────────────────────┘
             │
             ↓
┌─────────────────────────────────┐
│  AIProviderFactory              │
│  Returns: Configured provider   │
└────────────┬────────────────────┘
             │
      ┌──────┴──────┬──────┬──────┐
      ↓             ↓      ↓      ↓
┌──────────┐  ┌─────────┐ ┌─────┐ ┌────────┐
│ OpenAI   │  │Anthropic│ │Google│ │Ollama  │
│ Adapter  │  │ Adapter │ │Gemini│ │Adapter │
└──────────┘  └─────────┘ └─────┘ └────────┘
```

### Key Benefits

✅ **Zero Code Changes**: Switch by editing `.env`
✅ **Future-Proof**: Easy to add new providers
✅ **Cost Optimization**: Route tasks to cheapest provider
✅ **Fallback Support**: Auto-failover if provider fails
✅ **Testing**: Use free Ollama for development

---

## File Structure

```
backend/
├── src/
│   ├── services/
│   │   └── ai/
│   │       └── providers/
│   │           ├── IAIProvider.ts              # Interface
│   │           ├── OpenAIProvider.ts           # OpenAI adapter
│   │           ├── AnthropicProvider.ts        # Anthropic adapter
│   │           ├── GeminiProvider.ts           # Google adapter
│   │           ├── OllamaProvider.ts           # Ollama adapter
│   │           ├── AIProviderFactory.ts        # Factory
│   │           └── MultiProviderFallback.ts    # Multi-provider
│   │
│   ├── routes/
│   │   └── ai.routes.ts                        # AI endpoints
│   │
│   └── app.ts                                  # AI initialization
│
├── .env                                         # AI configuration
└── package.json                                 # Dependencies

frontend/
├── src/
│   ├── pages/
│   │   └── AIAssistant.tsx                     # Chat interface
│   │
│   ├── components/
│   │   └── Sidebar.tsx                         # AI menu item
│   │
│   └── App.tsx                                  # AI route
│
└── package.json
```

---

## How It Works

### 1. Initialization (Backend Startup)

```typescript
// backend/src/app.ts

import { AIProviderFactory } from './services/ai/providers/AIProviderFactory';

// Initialize AI Provider at startup
AIProviderFactory.initialize({
  type: process.env.AI_PROVIDER as 'openai' | 'anthropic' | 'google' | 'ollama',
  apiKey: process.env.AI_API_KEY,
  model: process.env.AI_MODEL,
  baseUrl: process.env.AI_BASE_URL,
});

console.log('✅ AI Provider initialized:', AIProviderFactory.getProviderInfo());
```

### 2. User Sends Message (Frontend)

```typescript
// frontend/src/pages/AIAssistant.tsx

const sendMessage = async () => {
  const response = await fetch('http://localhost:5000/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: userInput,
      conversationHistory: messages  // Last 10 messages
    })
  });

  const data = await response.json();
  displayResponse(data.response);
};
```

### 3. Backend Processes Request

```typescript
// backend/src/routes/ai.routes.ts

router.post('/chat', async (req, res) => {
  const { message, conversationHistory = [] } = req.body;

  // Get configured provider (any provider!)
  const aiProvider = AIProviderFactory.getProvider();

  // Build context from history
  const context = buildContext(conversationHistory);

  // Generate response
  const response = await aiProvider.generateText({
    systemPrompt: KASHAYA_FABS_ERP_CONTEXT,
    prompt: context + message,
    maxTokens: 1000,
    temperature: 0.7
  });

  res.json({ response: response.text });
});
```

### 4. Provider Adapter Calls AI Service

```typescript
// Example: OpenAI Provider
export class OpenAIProvider implements IAIProvider {
  async generateText(request: AITextRequest): Promise<AITextResponse> {
    const completion = await this.openai.chat.completions.create({
      model: this.defaultModel,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.prompt }
      ],
      max_tokens: request.maxTokens,
      temperature: request.temperature
    });

    return {
      text: completion.choices[0].message.content,
      provider: 'openai',
      model: this.defaultModel
    };
  }
}
```

### 5. Response Flow

```
User → Frontend → Backend API → Provider Adapter → AI Service
                                                        ↓
User ← Frontend ← Backend API ← Provider Adapter ← AI Response
```

---

## Provider Interface

All providers implement the same interface:

```typescript
export interface IAIProvider {
  // Text generation
  generateText(request: AITextRequest): Promise<AITextResponse>;

  // Embeddings (for vector search)
  generateEmbedding(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse>;

  // Image analysis (OCR, vision)
  analyzeImage(request: AIImageAnalysisRequest): Promise<AIImageAnalysisResponse>;

  // Structured data extraction
  extractStructuredData?(request: AIStructuredExtractionRequest): Promise<AIStructuredExtractionResponse>;

  // Streaming (real-time responses)
  generateTextStream?(request: AITextRequest): AsyncGenerator<string>;

  // Health check
  isAvailable(): Promise<boolean>;

  // Provider info
  getProviderName(): string;
  getDefaultModel(): string;
}
```

---

## Conversation Memory

### How Memory Works

1. **Frontend stores messages** in React state
2. **Sends last 10 messages** with each request
3. **Backend builds context** from history
4. **AI sees full conversation** in prompt

### Example Context Building

```typescript
// Build conversation context from history
let conversationContext = '';
if (conversationHistory.length > 0) {
  conversationContext = '\n\nPrevious conversation:\n' +
    conversationHistory
      .slice(-10)  // Only last 10 to avoid token limits
      .map((msg: any) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n') +
    '\n\nCurrent question:\n';
}

// Send to AI
const prompt = conversationContext + currentMessage;
```

### Token Limits

| Provider | Max Context | We Use |
|----------|------------|--------|
| GPT-4 Turbo | 128K tokens | ~10 messages |
| GPT-3.5 Turbo | 16K tokens | ~10 messages |
| Claude 3.5 | 200K tokens | ~10 messages |
| Gemini 1.5 | 1M tokens | ~10 messages |
| Llama 3 | 8K tokens | ~10 messages |

**Why limit to 10?**
- Faster responses
- Lower costs
- Ollama compatibility

---

## API Endpoints

### POST /api/ai/chat

Send message, get AI response with conversation history.

**Request:**
```json
{
  "message": "What is a BOM?",
  "conversationHistory": [
    {
      "role": "user",
      "content": "What is an ERP?"
    },
    {
      "role": "assistant",
      "content": "ERP stands for..."
    }
  ]
}
```

**Response:**
```json
{
  "response": "A BOM (Bill of Materials) is...",
  "provider": "openai",
  "model": "gpt-4-turbo"
}
```

### GET /api/ai/status

Check if AI is available.

**Response:**
```json
{
  "enabled": true,
  "available": true,
  "provider": "Ollama (Local)",
  "model": "llama3"
}
```

### POST /api/ai/insights

Get AI-generated insights (future feature).

**Response:**
```json
{
  "insights": [
    "Tip 1: ...",
    "Tip 2: ...",
    "Tip 3: ..."
  ],
  "provider": "openai",
  "model": "gpt-4-turbo"
}
```

---

# 4. Implementation Details

## Files Created

### Core Provider Layer (7 files)

1. **IAIProvider.ts** (110 lines)
   - Unified interface for all providers
   - Defines text generation, embeddings, vision, structured extraction

2. **OpenAIProvider.ts** (190 lines)
   - GPT-4, GPT-3.5 adapter
   - Supports text, embeddings, vision, streaming

3. **AnthropicProvider.ts** (220 lines)
   - Claude 3.5 adapter
   - Supports text, vision, streaming

4. **GeminiProvider.ts** (210 lines)
   - Google Gemini adapter
   - Supports text, embeddings, vision

5. **OllamaProvider.ts** (230 lines)
   - Local Llama 3, Mistral, Phi adapter
   - FREE, privacy-focused

6. **AIProviderFactory.ts** (160 lines)
   - Central factory for provider management
   - Runtime switching support

7. **MultiProviderFallback.ts** (220 lines)
   - Multi-provider with automatic fallback
   - High-availability support

### Frontend (2 files)

8. **AIAssistant.tsx** (265 lines)
   - Chat interface component
   - Message display, input, suggested questions

9. **Sidebar.tsx** (Modified)
   - Added AI Assistant menu item with sparkle icon

### Backend Routes (1 file)

10. **ai.routes.ts** (145 lines)
    - POST /api/ai/chat
    - GET /api/ai/status
    - POST /api/ai/insights

### Configuration (2 files)

11. **app.ts** (Modified - added 18 lines)
    - AI provider initialization
    - Route registration

12. **.env** (Modified - added 58 lines)
    - AI configuration variables

---

## Dependencies Added

```json
{
  "dependencies": {
    "openai": "^4.x.x",                    // OpenAI SDK (~200KB)
    "@anthropic-ai/sdk": "^0.x.x",         // Anthropic SDK (~150KB)
    "@google/generative-ai": "^0.x.x"      // Google SDK (~100KB)
  }
}
```

**Total additional size**: ~500KB

---

## Usage Examples

### Example 1: Using AI in Your Code

```typescript
import { AIProviderFactory } from './services/ai/providers/AIProviderFactory';

export class MyService {
  async analyzeData() {
    // Get current provider (works with any!)
    const ai = AIProviderFactory.getProvider();

    // Generate text
    const response = await ai.generateText({
      systemPrompt: 'You are a helpful ERP assistant.',
      prompt: 'Analyze this order data...',
      maxTokens: 500,
      temperature: 0.7
    });

    return response.text;
  }
}
```

### Example 2: Check if AI is Available

```typescript
import { AIProviderFactory } from './services/ai/providers/AIProviderFactory';

export class MyController {
  async getInsights(req, res) {
    // Check if AI is enabled
    if (!AIProviderFactory.isInitialized()) {
      return res.json({
        message: 'AI features not available. Configure AI in settings.'
      });
    }

    const ai = AIProviderFactory.getProvider();
    // Use AI...
  }
}
```

### Example 3: Get Provider Info

```typescript
const info = AIProviderFactory.getProviderInfo();
console.log(`Using: ${info.name} (${info.model})`);
// Output: Using: OpenAI (gpt-4-turbo)
```

---

## Impact Analysis

### Existing Code: ZERO Changes ✅

| Component | Impact |
|-----------|--------|
| Existing routes | No changes |
| Existing controllers | No changes |
| Existing services | No changes |
| Database schema | No changes |
| Business logic | No changes |
| API endpoints | No changes |
| Frontend (except AI page) | No changes |

### New Code Added

| Category | Lines |
|----------|-------|
| Backend providers | ~1,500 |
| Backend routes | ~145 |
| Frontend AI page | ~265 |
| Configuration | ~76 |
| **Total** | **~1,986** |

### Rollback

If needed, rollback in **30 seconds**:

1. Set `AI_ENABLED="false"` in `.env`
2. Restart server
3. System returns to pre-AI state

---

## Performance

### Response Times

| Provider | Simple Query | Complex Query |
|----------|-------------|---------------|
| GPT-4 Turbo | 1-2s | 3-5s |
| GPT-3.5 Turbo | 0.5-1s | 1-2s |
| Claude 3.5 | 1-2s | 3-5s |
| Gemini 1.5 | 1-2s | 2-4s |
| Llama 3 (Ollama) | 2-5s | 5-10s |

**Note**: Ollama times depend on your hardware (CPU/GPU).

---

# 5. Switching Providers

## Method 1: Environment Variables (Recommended)

**Fastest way**: Edit `.env` and restart.

### From Ollama to OpenAI

```bash
# Before (FREE local AI)
AI_PROVIDER="ollama"
AI_BASE_URL="http://localhost:11434"
AI_MODEL="llama3"
AI_API_KEY=""

# After (Paid cloud AI)
AI_PROVIDER="openai"
AI_API_KEY="sk-proj-..."
AI_MODEL="gpt-4-turbo"
AI_BASE_URL=""  # Not needed for OpenAI
```

Restart:
```bash
cd backend
npm run dev
```

**Code changes required**: **ZERO** ✅

---

### From OpenAI to Anthropic

```bash
# Before
AI_PROVIDER="openai"
AI_API_KEY="sk-..."
AI_MODEL="gpt-4-turbo"

# After
AI_PROVIDER="anthropic"
AI_API_KEY="sk-ant-..."
AI_MODEL="claude-3-5-sonnet-20241022"
```

**Time to switch**: <30 seconds

---

### From Any to Gemini

```bash
AI_PROVIDER="google"
AI_API_KEY="AIza..."
AI_MODEL="gemini-1.5-pro"
```

---

## Method 2: Runtime Switching (Advanced)

Switch providers without restarting:

```typescript
import { AIProviderFactory } from './services/ai/providers/AIProviderFactory';

// Switch to Gemini
AIProviderFactory.switchProvider({
  type: 'google',
  apiKey: 'AIza...',
  model: 'gemini-1.5-pro'
});

// All subsequent AI calls now use Gemini!
```

**Use case**: A/B testing, dynamic provider selection

---

## Method 3: Multi-Provider Fallback

Use multiple providers with automatic failover:

```typescript
import { MultiProviderFallback } from './services/ai/providers/MultiProviderFallback';
import { OpenAIProvider } from './services/ai/providers/OpenAIProvider';
import { OllamaProvider } from './services/ai/providers/OllamaProvider';

// Primary: OpenAI, Fallback: Ollama
const multiProvider = new MultiProviderFallback(
  new OpenAIProvider('sk-...', 'gpt-4-turbo'),
  [new OllamaProvider('http://localhost:11434', 'llama3')]
);

// If OpenAI fails (network, rate limit, etc.), automatically uses Ollama
const response = await multiProvider.generateText({
  prompt: 'Analyze data...'
});
```

**Use case**: High availability, cost optimization

---

## Method 4: Task-Based Routing

Route different tasks to different providers based on complexity:

```typescript
export class SmartAIRouter {
  async processTask(task: string, complexity: 'simple' | 'medium' | 'complex') {
    const aiFactory = AIProviderFactory;

    if (complexity === 'simple') {
      // Use free local Ollama
      aiFactory.switchProvider({
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'llama3'
      });
    } else if (complexity === 'medium') {
      // Use cheaper GPT-3.5
      aiFactory.switchProvider({
        type: 'openai',
        apiKey: process.env.AI_API_KEY!,
        model: 'gpt-3.5-turbo'
      });
    } else {
      // Use best quality GPT-4
      aiFactory.switchProvider({
        type: 'openai',
        apiKey: process.env.AI_API_KEY!,
        model: 'gpt-4-turbo'
      });
    }

    const ai = aiFactory.getProvider();
    return await ai.generateText({ prompt: task });
  }
}
```

**Use case**: Cost optimization (save money on simple tasks)

---

## Provider Comparison

### Text Generation

| Provider | Speed | Quality | Cost/1M Tokens | Best For |
|----------|-------|---------|----------------|----------|
| **GPT-4 Turbo** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | $10 | Complex reasoning, critical decisions |
| **GPT-3.5 Turbo** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | $0.50 | Simple tasks, high volume |
| **Claude 3.5** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | $3 | Long documents, code analysis |
| **Gemini 1.5 Pro** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | $7 | Balanced cost/quality |
| **Llama 3** | ⭐⭐ | ⭐⭐⭐ | FREE | Development, testing, privacy |

### Embeddings (for RAG/Vector Search)

| Provider | Dimensions | Cost/1M Tokens | Quality |
|----------|-----------|----------------|---------|
| **OpenAI text-embedding-3-small** | 1536 | $0.02 | ⭐⭐⭐⭐ |
| **OpenAI text-embedding-3-large** | 3072 | $0.13 | ⭐⭐⭐⭐⭐ |
| **Google text-embedding-004** | 768 | $0.025 | ⭐⭐⭐⭐ |
| **Ollama nomic-embed-text** | 768 | FREE | ⭐⭐⭐ |

### Vision/OCR

| Provider | Models | Cost/Image | Best For |
|----------|--------|-----------|----------|
| **GPT-4 Vision** | gpt-4-vision-preview | $0.01-$0.03 | General OCR, image analysis |
| **Claude 3.5** | claude-3-5-sonnet | $0.008 | Document analysis, charts |
| **Gemini 1.5** | gemini-1.5-flash | $0.0005 | High volume image processing |
| **Llava** | llava (Ollama) | FREE | Development, testing |

---

# 6. Advanced Features

## Creating Custom AI Features

### Step 1: Create a Service

```typescript
// backend/src/services/myai.service.ts

import { AIProviderFactory } from './ai/providers/AIProviderFactory';

export class MyAIService {
  async analyzeBusiness() {
    // Check if AI is available
    if (!AIProviderFactory.isInitialized()) {
      return { error: 'AI not available' };
    }

    // Get provider
    const ai = AIProviderFactory.getProvider();

    // Use AI
    const response = await ai.generateText({
      systemPrompt: 'You are a business analyst for garment manufacturing.',
      prompt: 'Analyze current trends in garment ERP systems.',
      maxTokens: 500,
      temperature: 0.7
    });

    return {
      analysis: response.text,
      provider: response.provider,
      model: response.model
    };
  }
}
```

### Step 2: Create a Route

```typescript
// backend/src/routes/myai.routes.ts

import { Router } from 'express';
import { MyAIService } from '../services/myai.service';

const router = Router();
const service = new MyAIService();

router.get('/analyze', async (req, res) => {
  const result = await service.analyzeBusiness();
  res.json(result);
});

export default router;
```

### Step 3: Register Route

```typescript
// backend/src/app.ts

import myaiRoutes from './routes/myai.routes';

app.use('/api/myai', myaiRoutes);
```

### Step 4: Use It

```bash
curl http://localhost:5000/api/myai/analyze
```

---

## Streaming Responses

For real-time user feedback (like ChatGPT):

### Backend

```typescript
router.post('/chat-stream', async (req, res) => {
  const ai = AIProviderFactory.getProvider();

  // Set headers for streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Check if provider supports streaming
  if (!ai.generateTextStream) {
    return res.status(400).json({ error: 'Provider does not support streaming' });
  }

  // Stream response
  for await (const chunk of ai.generateTextStream({ prompt: req.body.message })) {
    res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
  }

  res.end();
});
```

### Frontend

```typescript
const streamMessage = async (message: string) => {
  const response = await fetch('http://localhost:5000/api/ai/chat-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        // Display chunk immediately
        appendToMessage(data.chunk);
      }
    }
  }
};
```

---

## Caching Strategies

Reduce costs and improve speed by caching responses.

### Simple In-Memory Cache

```typescript
const cache = new Map<string, any>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class CachedAIService {
  async getCachedResponse(prompt: string) {
    // Check cache
    const cached = cache.get(prompt);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return { ...cached.data, fromCache: true };
    }

    // Not in cache, call AI
    const ai = AIProviderFactory.getProvider();
    const response = await ai.generateText({ prompt });

    // Store in cache
    cache.set(prompt, {
      data: response,
      timestamp: Date.now()
    });

    return { ...response, fromCache: false };
  }
}
```

### Redis Cache (Production)

```typescript
import Redis from 'ioredis';

const redis = new Redis();

export class RedisCachedAI {
  async getCachedResponse(prompt: string) {
    // Check Redis
    const cached = await redis.get(`ai:${prompt}`);
    if (cached) {
      return { ...JSON.parse(cached), fromCache: true };
    }

    // Call AI
    const ai = AIProviderFactory.getProvider();
    const response = await ai.generateText({ prompt });

    // Store in Redis (5 min TTL)
    await redis.setex(`ai:${prompt}`, 300, JSON.stringify(response));

    return { ...response, fromCache: false };
  }
}
```

---

## Cost Tracking

Track AI usage and costs:

```typescript
export class AIUsageTracker {
  async trackUsage(provider: string, model: string, tokensUsed: number) {
    const costPer1M = this.getCostPer1M(provider, model);
    const cost = (tokensUsed / 1_000_000) * costPer1M;

    // Log to database
    await prisma.aiUsage.create({
      data: {
        provider,
        model,
        tokensUsed,
        estimatedCost: cost,
        timestamp: new Date()
      }
    });

    return cost;
  }

  getCostPer1M(provider: string, model: string): number {
    const costs = {
      'openai:gpt-4-turbo': 10,
      'openai:gpt-3.5-turbo': 0.50,
      'anthropic:claude-3-5-sonnet': 3,
      'google:gemini-1.5-pro': 7,
      'ollama:llama3': 0
    };

    return costs[`${provider}:${model}`] || 0;
  }
}
```

---

# 7. Troubleshooting

## Common Issues

### Issue: "AI Provider not initialized"

**Cause**: `AI_ENABLED` is not set to `"true"` or `AI_PROVIDER` is not configured.

**Solution**:
```bash
# Check backend/.env
AI_ENABLED="true"
AI_PROVIDER="ollama"  # or "openai", "anthropic", "google"
```

Restart backend:
```bash
cd backend
npm run dev
```

---

### Issue: "OpenAI API key required"

**Cause**: Using OpenAI but `AI_API_KEY` is missing or invalid.

**Solution**:
```bash
# Get API key from: https://platform.openai.com/api-keys
# Add to backend/.env
AI_API_KEY="sk-proj-..."
```

Restart backend.

---

### Issue: "Ollama provider not available"

**Cause**: Ollama service is not running.

**Solution**:
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not running, start it
ollama serve

# If model not installed
ollama pull llama3
```

---

### Issue: "All AI providers failed"

**Possible causes**:
1. Invalid API key
2. Network connectivity issues
3. Provider service is down
4. Rate limits exceeded

**Solutions**:

1. **Check API key validity**:
   - OpenAI: https://platform.openai.com/api-keys
   - Anthropic: https://console.anthropic.com/
   - Google: https://makersuite.google.com/app/apikey

2. **Check network**:
   ```bash
   # Test OpenAI
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $AI_API_KEY"

   # Test Ollama
   curl http://localhost:11434/api/tags
   ```

3. **Check provider status**:
   - OpenAI: https://status.openai.com/
   - Anthropic: https://status.anthropic.com/
   - Google: https://status.cloud.google.com/

4. **Check rate limits**: Wait a few minutes and try again

---

### Issue: AI responses are slow

**Cause**: Depends on provider and hardware.

**Expected times**:
- Ollama (local): 2-10 seconds (depends on CPU/GPU)
- Cloud AI: 1-5 seconds (depends on network)

**Solutions**:

1. **For Ollama** (slow hardware):
   ```bash
   # Use smaller, faster model
   ollama pull phi
   # or
   ollama pull mistral

   # Update .env
   AI_MODEL="phi"
   ```

2. **For Cloud AI** (slow network):
   - Check internet speed
   - Try different provider
   - Reduce `maxTokens` in requests

3. **General optimization**:
   - Implement caching (see Advanced Features)
   - Use streaming for better UX
   - Optimize prompts (shorter = faster)

---

### Issue: Frontend can't connect to backend

**Symptoms**: Chat interface shows error or doesn't respond.

**Check**:
1. Backend is running on port 5000
2. Frontend is running on port 5173
3. CORS is enabled (already configured)

**Solution**:
```bash
# Terminal 1: Start backend
cd backend
npm run dev
# Should show: Server running on: http://localhost:5000

# Terminal 2: Start frontend
cd frontend
npm run dev
# Should show: Local: http://localhost:5173
```

**Check browser console** for errors:
- Right-click → Inspect → Console tab
- Look for network errors

---

### Issue: Chat doesn't remember conversation

**Cause**: Frontend not sending conversation history.

**Check**: In [AIAssistant.tsx:71-80](frontend/src/pages/AIAssistant.tsx#L71-L80):
```typescript
body: JSON.stringify({
  message: currentInput,
  conversationHistory: messages.map(msg => ({  // ← Check this
    role: msg.role,
    content: msg.content
  }))
})
```

If this is present, conversation memory should work. If not working:
- Clear chat and try again
- Check backend logs for errors
- Verify backend is using updated ai.routes.ts

---

## Health Check Commands

### Check Backend AI Status

```bash
curl http://localhost:5000/api/ai/status
```

**Expected response**:
```json
{
  "enabled": true,
  "available": true,
  "provider": "Ollama (Local)",
  "model": "llama3"
}
```

### Test AI Chat

```bash
curl -X POST http://localhost:5000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is ERP?",
    "conversationHistory": []
  }'
```

**Expected response**:
```json
{
  "response": "ERP stands for Enterprise Resource Planning...",
  "provider": "ollama",
  "model": "llama3"
}
```

### Check Ollama

```bash
# Check if running
curl http://localhost:11434/api/tags

# Test generation
curl http://localhost:11434/api/generate -d '{
  "model": "llama3",
  "prompt": "Hello"
}'
```

---

## Performance Tuning

### Reduce Response Time

1. **Use faster model**:
   ```bash
   # Instead of llama3
   AI_MODEL="phi"  # Much faster
   ```

2. **Reduce max tokens**:
   ```typescript
   // In ai.routes.ts
   maxTokens: 500  // Instead of 1000
   ```

3. **Implement caching** (see Advanced Features)

4. **Use streaming** for better perceived performance

---

### Reduce Costs

1. **Use cheaper models**:
   ```bash
   # Instead of gpt-4-turbo ($10/1M)
   AI_MODEL="gpt-3.5-turbo"  # $0.50/1M
   ```

2. **Implement caching** (avoid duplicate API calls)

3. **Use Ollama for development** (FREE)

4. **Optimize prompts** (shorter prompts = less tokens = lower cost)

5. **Task-based routing** (simple tasks → cheap model)

---

## Debug Mode

Enable detailed logging:

```typescript
// backend/src/services/ai/providers/AIProviderFactory.ts

// Add debug logging
export class AIProviderFactory {
  static initialize(config: AIProviderConfig) {
    console.log('[AIProviderFactory] Initializing with config:', {
      type: config.type,
      model: config.model,
      baseUrl: config.baseUrl,
      hasApiKey: !!config.apiKey
    });

    // ... rest of code
  }
}
```

Check logs:
```bash
cd backend
npm run dev

# Look for:
# [AIProviderFactory] Initializing with config: { type: 'ollama', ... }
# ✅ AI Provider initialized: Ollama (Local) (llama3)
```

---

# 8. RAG Implementation Plan (Vector Database)

> **Status**: PLANNED - To be implemented after core ERP is stable
>
> **Purpose**: Give AI access to actual ERP data (orders, styles, customers, materials)
>
> **Impact**: Transform AI from generic chatbot to intelligent data assistant

---

## What is RAG?

**RAG** = **R**etrieval **A**ugmented **G**eneration

Instead of AI answering from general knowledge, it:
1. **Retrieves** relevant data from your database
2. **Augments** the prompt with this data
3. **Generates** answers based on YOUR data

### Current State (Basic AI)

```
User: "What orders are pending for Nike?"
AI: "I don't have access to your actual orders.
     Generally, you can check pending orders in the
     Orders section..."
```

### Future State (RAG-Powered AI)

```
User: "What orders are pending for Nike?"
AI: "I found 3 pending orders for Nike totaling ₹9,25,000:

     1. Order #ORD-001 - ₹2,50,000
        - 500 units of Black Polo Shirts (Style ABC-001)
        - Delivery: Dec 15, 2025 (14 days from now)
        - Priority: HIGH

     2. Order #ORD-045 - ₹5,00,000
        - 1000 units of Blue Hoodies (Style XYZ-005)
        - Delivery: Dec 20, 2025 (19 days from now)
        - Priority: MEDIUM

     3. Order #ORD-078 - ₹1,75,000
        - 350 units of White T-Shirts (Style DEF-009)
        - Delivery: Dec 28, 2025 (27 days from now)
        - Priority: LOW

     Recommendation: Order #ORD-001 is HIGH priority and
     due in 14 days. Ensure production is on track."
```

---

## RAG Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER QUESTION                             │
│  "What orders are pending for Nike?"                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RAG ORCHESTRATOR                            │
│                                                                  │
│  1. Classify Intent → ORDER_STATUS                              │
│  2. Generate Query Embedding → [0.123, -0.456, ...]            │
│  3. Vector Search → Find similar orders                         │
│  4. Filter by customer="Nike" AND status="PENDING"             │
│  5. Fetch Full Data → Get order details                        │
│  6. Build Context → Format for AI                              │
│  7. Send to LLM → Generate answer                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   POSTGRESQL + pgvector                         │
│                                                                  │
│  Business Tables:                                               │
│  - orders, styles, customers, materials                         │
│                                                                  │
│  Vector Embeddings Tables:                                      │
│  - order_embeddings (order_id, content, embedding, metadata)    │
│  - style_embeddings, customer_embeddings, etc.                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Recommended Solution: pgvector + Ollama

| Component | Technology | Why |
|-----------|-----------|-----|
| **Vector Database** | pgvector (PostgreSQL extension) | Native integration, no new infrastructure |
| **Embeddings** | Ollama nomic-embed-text | FREE, local, 768-dimensional |
| **Text Generation** | Ollama Llama3 | Already configured |
| **Total Cost** | $0 | Completely free |
| **Privacy** | 100% Private | All data stays on-premises |

### Why pgvector?

| Feature | pgvector | Pinecone | Weaviate | Chroma |
|---------|----------|----------|----------|--------|
| **Setup** | ⭐⭐⭐⭐⭐ 1 SQL command | ⭐⭐⭐ Cloud signup | ⭐⭐ Docker | ⭐⭐⭐⭐ Easy |
| **PostgreSQL** | ⭐⭐⭐⭐⭐ Native | ⭐ None | ⭐⭐ API | ⭐⭐ API |
| **Prisma** | ⭐⭐⭐⭐⭐ Perfect | ⭐⭐ External | ⭐⭐ External | ⭐⭐ External |
| **Cost** | FREE | Paid | FREE | FREE |
| **Infrastructure** | PostgreSQL only | Cloud service | Docker | In-process |
| **Best For** | ERP systems ✓ | Large scale | ML pipelines | Prototypes |

**Winner**: pgvector - Perfect for ERP use case

---

## Implementation Timeline

### 6-Week Plan

| Phase | Tasks | Hours | Calendar |
|-------|-------|-------|----------|
| **Phase 1: Foundation** | pgvector setup, embedding tables | 12 | Week 1 |
| **Phase 2: Data Sync** | Content builders, sync service | 16 | Week 2 |
| **Phase 3: RAG Query** | Search, context, orchestrator | 20 | Week 3 |
| **Phase 4: Security** | Access control, audit logging | 8 | Week 4 |
| **Phase 5: Optimization** | Caching, indexing, batching | 12 | Week 5 |
| **Phase 6: Testing** | Tests, refinement, docs | 16 | Week 6 |
| **TOTAL** | | **84 hours** | **6 weeks** |

**Assumptions**:
- 1 developer, part-time (15-20 hours/week)
- PostgreSQL admin access available
- Ollama already running
- No architecture changes needed

---

## Phase 1: Foundation (Week 1)

### Goal: Install pgvector, create vector tables

### Tasks:

**1. Install pgvector extension**
```sql
-- Connect to PostgreSQL
psql -U postgres -d garment_erp

-- Install pgvector
CREATE EXTENSION vector;
```

**2. Create embedding tables**
```sql
-- Order embeddings
CREATE TABLE order_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(768) NOT NULL,  -- nomic-embed-text dimensions
  metadata JSONB,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(order_id)
);

-- Vector index for similarity search
CREATE INDEX order_embeddings_vector_idx ON order_embeddings
USING ivfflat (embedding vector_cosine_ops);

-- Metadata index for filtering
CREATE INDEX order_embeddings_metadata_idx ON order_embeddings
USING gin (metadata);

-- Repeat for: style_embeddings, customer_embeddings,
--             material_embeddings, supplier_embeddings
```

**3. Add to Prisma schema**
```prisma
// backend/prisma/schema.prisma

model order_embeddings {
  id         String   @id @default(uuid())
  orderId    String   @unique
  content    String
  embedding  Unsupported("vector(768)")
  metadata   Json?
  updatedAt  DateTime @default(now())

  orders     orders   @relation(fields: [orderId], references: [id], onDelete: Cascade)
}
```

**4. Create embedding service**
```typescript
// backend/src/services/rag/embedding.service.ts

import { OllamaProvider } from '../ai/providers/OllamaProvider';

export class EmbeddingService {
  private ollama: OllamaProvider;

  constructor() {
    this.ollama = new OllamaProvider('http://localhost:11434', 'llama3');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.ollama.generateEmbedding({
      text,
      model: 'nomic-embed-text'
    });
    return response.embedding;  // 768 dimensions
  }
}
```

**5. Test embedding generation**
```bash
# Pull embedding model
ollama pull nomic-embed-text

# Test
npm run test:embeddings
```

**Deliverables**:
- ✅ pgvector installed
- ✅ 5 embedding tables created
- ✅ Embedding service functional
- ✅ 10 test embeddings generated

---

## Phase 2: Data Synchronization (Week 2)

### Goal: Sync all existing data to vector tables

### Tasks:

**1. Create content builders**
```typescript
// backend/src/services/rag/content-builder.service.ts

export class ContentBuilderService {
  buildOrderContent(order: OrderWithIncludes): string {
    return `
      Order #${order.orderNumber} for ${order.customers.name}.
      ${order.order_items.length} items totaling ₹${order.totalAmount}.
      ${order.order_items.map(item =>
        `${item.totalQuantity} units of ${item.styles.styleName}`
      ).join('. ')}.
      Expected delivery: ${formatDate(order.expectedDeliveryDate)}.
      Status: ${order.status}.
      Priority: ${order.priority}.
    `.trim().replace(/\s+/g, ' ');
  }

  buildStyleContent(style: Style): string { /* ... */ }
  buildCustomerContent(customer: Customer): string { /* ... */ }
  buildMaterialContent(material: Material): string { /* ... */ }
}
```

**2. Create sync service**
```typescript
// backend/src/services/rag/sync.service.ts

export class EmbeddingSyncService {
  async syncOrder(orderId: string): Promise<void> {
    const order = await this.fetchOrderWithIncludes(orderId);
    const content = this.contentBuilder.buildOrderContent(order);
    const embedding = await this.embeddingService.generateEmbedding(content);
    const metadata = this.buildOrderMetadata(order);

    await prisma.$executeRaw`
      INSERT INTO order_embeddings (order_id, content, embedding, metadata)
      VALUES (${orderId}, ${content}, ${embedding}::vector, ${metadata}::jsonb)
      ON CONFLICT (order_id)
      DO UPDATE SET
        content = EXCLUDED.content,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `;
  }

  async syncAllOrders(): Promise<void> {
    const orders = await prisma.orders.findMany({ select: { id: true } });
    for (const order of orders) {
      await this.syncOrder(order.id);
    }
  }
}
```

**3. Create CLI tool**
```typescript
// backend/src/scripts/rag-sync.ts

import { program } from 'commander';

program
  .command('sync-all')
  .action(async () => {
    await syncService.syncAllOrders();
    await syncService.syncAllStyles();
    await syncService.syncAllCustomers();
    await syncService.syncAllMaterials();
  });

program.parse();
```

**4. Add auto-sync hooks**
```typescript
// backend/src/controllers/order.controller.ts

export const createOrder = async (req: Request, res: Response) => {
  const order = await prisma.orders.create({ data: orderData });

  // Auto-sync (non-blocking)
  embeddingSyncService.syncOrder(order.id).catch(err =>
    console.error('Embedding sync failed:', err)
  );

  res.json(order);
};
```

**5. Run initial sync**
```bash
npm run rag:sync-all
```

**Deliverables**:
- ✅ Content builders for 5 entities
- ✅ Sync service functional
- ✅ CLI tool working
- ✅ Auto-sync hooks in controllers
- ✅ All existing data synced

---

## Phase 3: RAG Query Engine (Week 3)

### Goal: Implement semantic search and context retrieval

### Components:

**1. Query Classifier**
```typescript
classifyIntent(query: string): QueryIntent {
  if (/order.*pending/.test(query)) {
    return {
      type: 'ORDER_STATUS',
      entities: { status: 'PENDING', customer: extractCustomer(query) }
    };
  }
  // ... more patterns
}
```

**2. Vector Search**
```sql
SELECT
  order_id,
  content,
  metadata,
  1 - (embedding <=> $queryEmbedding::vector) as similarity
FROM order_embeddings
WHERE metadata->>'customer_name' ILIKE '%Nike%'
  AND metadata->>'status' = 'PENDING'
ORDER BY embedding <=> $queryEmbedding::vector
LIMIT 10;
```

**3. Context Builder**
```typescript
buildContext(searchResults: SearchResult[]): string {
  return searchResults.map(result => `
    Order #${result.metadata.order_number}:
    - Customer: ${result.metadata.customer_name}
    - Total: ₹${result.metadata.total_amount}
    - Status: ${result.metadata.status}
  `).join('\n\n');
}
```

**4. RAG Orchestrator**
```typescript
async query(userQuery: string, userId: string): Promise<RAGResponse> {
  // 1. Classify intent
  const intent = await this.queryClassifier.classifyIntent(userQuery);

  // 2. Generate embedding
  const queryEmbedding = await this.embeddingService.generateEmbedding(userQuery);

  // 3. Vector search
  const searchResults = await this.vectorSearch.searchOrders(
    queryEmbedding,
    intent.entities,
    userId
  );

  // 4. Build context
  const context = await this.contextBuilder.buildContext(intent.type, searchResults);

  // 5. Generate LLM response
  const response = await this.ollama.generateText({
    systemPrompt: KASHAYA_FABS_ERP_CONTEXT,
    prompt: `User Question: ${userQuery}\n\nData:\n${context}\n\nAnswer:`,
    maxTokens: 1500
  });

  return {
    answer: response.text,
    sources: searchResults,
    intent: intent.type
  };
}
```

**5. Update AI routes**
```typescript
router.post('/chat', async (req, res) => {
  const { message } = req.body;
  const userId = req.user?.userId;

  // Use RAG instead of direct LLM
  const response = await ragOrchestrator.query(message, userId);

  res.json({
    response: response.answer,
    sources: response.sources,  // Show data sources!
    intent: response.intent
  });
});
```

**Deliverables**:
- ✅ Query classifier (10+ intent types)
- ✅ Vector search service
- ✅ Context builder
- ✅ RAG orchestrator
- ✅ Updated AI routes

---

## Phase 4: Security & Access Control (Week 4)

### Goal: Ensure users only see data they have permission to access

### Features:

**1. User-based filtering**
```typescript
async searchOrders(queryEmbedding, filters, userId) {
  const user = await prisma.users.findUnique({ where: { id: userId } });

  let accessFilter = '';
  if (user.role !== 'ADMIN') {
    // Non-admins see only their data
    accessFilter = `AND metadata->>'created_by_id' = '${userId}'`;
  }

  const results = await prisma.$queryRaw`
    SELECT * FROM order_embeddings
    WHERE 1=1 ${accessFilter}
    ORDER BY embedding <=> ${queryEmbedding}::vector
  `;

  return results;
}
```

**2. Audit logging**
```typescript
await prisma.audit_logs.create({
  data: {
    userId,
    action: 'RAG_QUERY',
    entityType: 'ai_assistant',
    newValues: { query: userQuery }
  }
});
```

**Deliverables**:
- ✅ User-based access control
- ✅ Audit logging
- ✅ Security tests

---

## Phase 5: Performance Optimization (Week 5)

### Goal: Fast responses (<2 seconds)

### Optimizations:

**1. Caching**
```typescript
const embeddingCache = new NodeCache({ stdTTL: 3600 });  // 1 hour
const responseCache = new NodeCache({ stdTTL: 300 });     // 5 min
```

**2. Database indexes**
```sql
-- Composite indexes for common filters
CREATE INDEX order_embeddings_customer_status_idx
ON order_embeddings (
  (metadata->>'customer_name'),
  (metadata->>'status')
);
```

**3. Batch processing**
```typescript
async generateEmbeddings(texts: string[]): Promise<number[][]> {
  const batches = chunk(texts, 10);
  const results = [];

  for (const batch of batches) {
    const batchResults = await Promise.all(
      batch.map(text => this.generateEmbedding(text))
    );
    results.push(...batchResults);
  }

  return results;
}
```

**Deliverables**:
- ✅ Embedding cache
- ✅ Response cache
- ✅ Optimized indexes
- ✅ Batch processing
- ✅ Query timeouts

---

## Phase 6: Testing & Refinement (Week 6)

### Goal: Production-ready quality

### Tests:

**1. Unit tests** (30+ tests)
```typescript
describe('VectorSearchService', () => {
  it('should find similar orders', async () => {
    const results = await vectorSearch.searchOrders(embedding, {}, userId);
    expect(results.length).toBeGreaterThan(0);
  });
});
```

**2. Integration tests** (20+ tests)
```typescript
describe('RAG End-to-End', () => {
  it('should answer order query with real data', async () => {
    const response = await ragOrchestrator.query(
      'What orders are pending for Nike?',
      testUserId
    );

    expect(response.answer).toContain('pending');
    expect(response.sources.length).toBeGreaterThan(0);
  });
});
```

**3. Performance benchmarks**
```typescript
it('should respond within 2 seconds', async () => {
  const start = Date.now();
  await ragOrchestrator.query('Show orders', userId);
  const duration = Date.now() - start;

  expect(duration).toBeLessThan(2000);
});
```

**Deliverables**:
- ✅ 30+ unit tests
- ✅ 20+ integration tests
- ✅ Performance benchmarks
- ✅ Refined prompts
- ✅ Complete documentation

---

## Example Queries After RAG

Once implemented, AI can answer:

**Orders:**
```
"What orders are pending for Nike?"
"Show me high-priority orders due this month"
"What's the total revenue from confirmed orders?"
"Which orders are delayed?"
```

**Styles:**
```
"Show me all polo shirt styles"
"What styles are available for Adidas?"
"List styles with cost above ₹500"
```

**Customers:**
```
"Show all export customers"
"Which customers exceeded their credit limit?"
"List top 5 customers by order value"
```

**Materials:**
```
"What fabrics are in stock?"
"Show materials with low stock"
"List all trims from ABC Suppliers"
```

**Analytics:**
```
"What's our total pending order value?"
"Show production trends this month"
"Which styles are most profitable?"
"Compare order volumes: this month vs last month"
```

---

## Infrastructure Requirements

**PostgreSQL:**
- Add pgvector extension (1 SQL command)
- Disk: +5GB for vector storage
- No version upgrade needed

**Ollama:**
- Pull `nomic-embed-text` model: `ollama pull nomic-embed-text`
- Disk: +274MB for embedding model

**System Resources:**
- RAM: +2GB for caching
- CPU: No change
- Total Cost: $0

---

## Next Steps (When Ready)

1. **Review this plan** with team
2. **Assign developer** (15-20 hours/week)
3. **Set timeline** (6 weeks)
4. **Prepare infrastructure**:
   - PostgreSQL admin access
   - Ollama running
   - Pull embedding model
5. **Start Phase 1** (Foundation)
6. **Test incrementally**
7. **Gather feedback**

---

## Summary

### Current AI Capabilities:

✅ Chat interface with conversation memory
✅ Provider-agnostic architecture
✅ 4 AI providers supported
✅ Generic ERP knowledge
✅ Free local option (Ollama)

### After RAG Implementation:

✅ All current capabilities
✅ **Access to actual ERP data**
✅ **Data-driven answers**
✅ **Specific insights and analytics**
✅ **Recommendations based on your data**
✅ User-based access control
✅ Audit logging
✅ Fast performance (<2 sec)

---

## Document Information

**Version**: 1.0
**Last Updated**: November 18, 2025
**Status**: CURRENT

**Sections**:
1. Quick Start - Setup in 5 minutes
2. User Guide - How to use AI Assistant
3. Architecture - How it works
4. Implementation - Technical details
5. Switching Providers - Operations guide
6. Advanced Features - Custom development
7. Troubleshooting - Problem solving
8. RAG Implementation - Future enhancement (6-week plan)

---

**For questions or issues**, refer to specific sections above or check backend logs.

**To implement RAG**, see Section 8 for complete 6-week implementation plan.

**End of AI Complete Guide**
