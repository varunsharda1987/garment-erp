# AI Provider Abstraction Layer - Complete Guide

## 🎯 Overview

This garment ERP system now includes a **provider-agnostic AI abstraction layer** that allows you to easily switch between different AI services without changing any business logic code.

### Supported AI Providers

| Provider | Models | Cost | Use Case |
|----------|--------|------|----------|
| **OpenAI** | GPT-4, GPT-3.5 | Paid | High-quality text generation, best reasoning |
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Opus | Paid | Excellent for complex analysis, long context |
| **Google Gemini** | Gemini 1.5 Pro, Flash | Paid | Good balance of cost/performance |
| **Ollama** | Llama 3, Mistral, Phi | **FREE** | Local models, great for development/testing |

### Key Benefits

✅ **Zero Code Changes**: Switch providers by changing environment variables
✅ **Provider Agnostic**: All business logic uses unified interface
✅ **Easy Testing**: Use free local Ollama for development
✅ **Fallback Support**: Auto-failover if primary provider fails
✅ **Future-Proof**: Add new providers by creating adapters
✅ **Cost Optimization**: Route tasks to cheapest suitable provider

---

## 📁 Architecture

### Directory Structure

```
backend/src/services/ai/
├── providers/
│   ├── IAIProvider.ts              # Interface (contract for all providers)
│   ├── OpenAIProvider.ts           # OpenAI adapter
│   ├── AnthropicProvider.ts        # Anthropic Claude adapter
│   ├── GeminiProvider.ts           # Google Gemini adapter
│   ├── OllamaProvider.ts           # Local Ollama adapter
│   ├── AIProviderFactory.ts        # Factory for creating providers
│   └── MultiProviderFallback.ts    # Multi-provider with fallback
└── insights.service.ts              # Example AI service
```

### How It Works

```
┌─────────────────────────────────┐
│  Business Logic                 │
│  (insights.service.ts)          │
│  - Uses IAIProvider interface   │
└────────────┬────────────────────┘
             │
             ↓
┌─────────────────────────────────┐
│  AIProviderFactory              │
│  - Returns configured provider  │
└────────────┬────────────────────┘
             │
      ┌──────┴──────┬──────┬──────┐
      ↓             ↓      ↓      ↓
┌──────────┐  ┌─────────┐ ┌─────┐ ┌────────┐
│ OpenAI   │  │Anthropic│ │Google│ │Ollama  │
│ Adapter  │  │ Adapter │ │Adapt.│ │Adapter │
└──────────┘  └─────────┘ └─────┘ └────────┘
```

---

## 🚀 Quick Start

### Option 1: OpenAI (GPT-4)

1. **Get API Key**: Visit https://platform.openai.com/api-keys
2. **Update `.env`**:
   ```bash
   AI_ENABLED="true"
   AI_PROVIDER="openai"
   AI_API_KEY="sk-proj-..."
   AI_MODEL="gpt-4-turbo"  # Optional, defaults to gpt-4-turbo
   ```
3. **Restart server**: `npm run dev`
4. **Done!** AI features now use OpenAI

### Option 2: Anthropic (Claude)

1. **Get API Key**: Visit https://console.anthropic.com/
2. **Update `.env`**:
   ```bash
   AI_ENABLED="true"
   AI_PROVIDER="anthropic"
   AI_API_KEY="sk-ant-..."
   AI_MODEL="claude-3-5-sonnet-20241022"
   ```
3. **Restart server**
4. **Done!** Now using Claude instead of GPT-4

### Option 3: Google Gemini

1. **Get API Key**: Visit https://makersuite.google.com/app/apikey
2. **Update `.env`**:
   ```bash
   AI_ENABLED="true"
   AI_PROVIDER="google"
   AI_API_KEY="AIza..."
   AI_MODEL="gemini-1.5-pro"
   ```
3. **Restart server**
4. **Done!** Now using Gemini

### Option 4: Ollama (Local - FREE!)

1. **Install Ollama**: https://ollama.ai/download
2. **Pull a model**:
   ```bash
   ollama pull llama3
   ```
3. **Update `.env`**:
   ```bash
   AI_ENABLED="true"
   AI_PROVIDER="ollama"
   AI_BASE_URL="http://localhost:11434"
   AI_MODEL="llama3"
   ```
4. **Restart server**
5. **Done!** Using free local AI

---

## 💻 Usage Examples

### Example 1: Generate Dashboard Insights

```typescript
import { AIInsightsService } from './services/ai/insights.service';

const insightsService = new AIInsightsService();

// This works with ANY provider (OpenAI, Claude, Gemini, Ollama)!
const insights = await insightsService.getDashboardInsights();

console.log(insights.insights);
// [
//   "Production bottleneck detected in stitching stage",
//   "5 pending orders need immediate attention",
//   "Material stock running low for 3 items"
// ]

console.log(`Powered by: ${insights.provider} (${insights.model})`);
// Powered by: openai (gpt-4-turbo)
```

### Example 2: Predict Style Cost

```typescript
const prediction = await insightsService.predictStyleCost({
  category: 'T-Shirt',
  componentCount: 5,
  hasFabric: true,
  hasTrims: true,
});

console.log(`Predicted cost: ₹${prediction.predictedCost}`);
console.log(`Confidence: ${prediction.confidence * 100}%`);
// Predicted cost: ₹350
// Confidence: 85%
```

### Example 3: Find Similar Styles

```typescript
const similar = await insightsService.findSimilarStyles('Floral summer dress');

console.log(`Found ${similar.similarStyles.length} similar styles`);
console.log(`Using provider: ${similar.provider}`);
```

### Example 4: Extract Invoice Data (OCR)

```typescript
const invoiceData = await insightsService.extractInvoiceData(
  'https://example.com/invoice.jpg'
);

console.log(invoiceData.extractedData);
// {
//   supplier: "ABC Fabrics Ltd",
//   invoiceNumber: "INV-2024-001",
//   totalAmount: 45000,
//   lineItems: [...]
// }
```

---

## 🔄 Switching Providers

### Method 1: Environment Variables (Recommended)

Change your `.env` file and restart:

```bash
# Before: Using OpenAI
AI_PROVIDER="openai"
AI_API_KEY="sk-..."

# After: Switch to Anthropic
AI_PROVIDER="anthropic"
AI_API_KEY="sk-ant-..."
```

**Code changes required**: **ZERO** ✅

### Method 2: Runtime Switching (Advanced)

```typescript
import { AIProviderFactory } from './services/ai/providers/AIProviderFactory';

// Switch to different provider without restart
AIProviderFactory.switchProvider({
  type: 'google',
  apiKey: 'AIza...',
  model: 'gemini-1.5-pro',
});

// All subsequent AI calls now use Gemini!
```

### Method 3: Multi-Provider with Fallback

```typescript
import { MultiProviderFallback } from './services/ai/providers/MultiProviderFallback';
import { OpenAIProvider } from './services/ai/providers/OpenAIProvider';
import { OllamaProvider } from './services/ai/providers/OllamaProvider';

// Try OpenAI first, fallback to local Ollama if fails
const multiProvider = new MultiProviderFallback(
  new OpenAIProvider('sk-...', 'gpt-4-turbo'),
  [new OllamaProvider('http://localhost:11434', 'llama3')]
);

// Automatically falls back if OpenAI is down or rate-limited
const response = await multiProvider.generateText({
  prompt: 'Analyze this data...',
});
```

---

## 🎨 Creating Custom AI Features

### Step 1: Use the Factory

```typescript
import { AIProviderFactory } from './services/ai/providers/AIProviderFactory';

export class MyCustomAIService {
  async myAIFeature() {
    // Get current provider (works with any!)
    const ai = AIProviderFactory.getProvider();

    // Use AI
    const response = await ai.generateText({
      systemPrompt: 'You are a helpful assistant.',
      prompt: 'What is ERP?',
      maxTokens: 100,
    });

    return response.text;
  }
}
```

### Step 2: Handle Cases Where AI is Disabled

```typescript
export class MyCustomAIService {
  async myAIFeature() {
    // Check if AI is available
    if (!AIProviderFactory.isInitialized()) {
      return 'AI features not enabled. Configure AI in .env';
    }

    const ai = AIProviderFactory.getProvider();
    // ... use AI
  }
}
```

---

## 📊 Provider Comparison

### Text Generation

| Provider | Speed | Quality | Cost (1M tokens) | Best For |
|----------|-------|---------|------------------|----------|
| GPT-4 Turbo | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | $10 | Complex reasoning |
| GPT-3.5 Turbo | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | $0.50 | Simple tasks |
| Claude 3.5 Sonnet | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | $3 | Long documents |
| Gemini 1.5 Pro | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | $7 | Balanced |
| Llama 3 (Ollama) | ⭐⭐ | ⭐⭐⭐ | **FREE** | Development |

### Embeddings (Similarity Search)

| Provider | Dimensions | Cost (1M tokens) | Quality |
|----------|-----------|------------------|---------|
| OpenAI text-embedding-3-small | 1536 | $0.02 | ⭐⭐⭐⭐ |
| OpenAI text-embedding-3-large | 3072 | $0.13 | ⭐⭐⭐⭐⭐ |
| Google text-embedding-004 | 768 | $0.025 | ⭐⭐⭐⭐ |
| Ollama nomic-embed-text | 768 | **FREE** | ⭐⭐⭐ |

### Image Analysis

| Provider | Models | Cost (per image) | Best For |
|----------|--------|------------------|----------|
| GPT-4 Vision | gpt-4-vision-preview | $0.01-$0.03 | OCR, general |
| Claude 3.5 | claude-3-5-sonnet | $0.008 | Document analysis |
| Gemini 1.5 | gemini-1.5-flash | $0.0005 | High volume |
| Llava (Ollama) | llava | **FREE** | Development |

---

## 🛠️ Advanced Configuration

### Multi-Provider Cost Optimization

Route different tasks to different providers based on complexity:

```typescript
export class CostOptimizedAI {
  async processTask(task: string) {
    const ai = AIProviderFactory.getProvider();

    // Simple classification → Use free local Ollama
    if (task.length < 500) {
      // Switch to Ollama temporarily
      AIProviderFactory.switchProvider({
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'llama3',
      });
    }
    // Complex analysis → Use GPT-4
    else if (task.includes('analyze') || task.includes('complex')) {
      AIProviderFactory.switchProvider({
        type: 'openai',
        apiKey: process.env.AI_API_KEY!,
        model: 'gpt-4-turbo',
      });
    }
    // Medium tasks → Use cheaper GPT-3.5
    else {
      AIProviderFactory.switchProvider({
        type: 'openai',
        apiKey: process.env.AI_API_KEY!,
        model: 'gpt-3.5-turbo',
      });
    }

    return await ai.generateText({ prompt: task });
  }
}
```

### Streaming Responses

For real-time user feedback:

```typescript
const ai = AIProviderFactory.getProvider();

if (ai.generateTextStream) {
  for await (const chunk of ai.generateTextStream({ prompt: 'Explain ERP...' })) {
    process.stdout.write(chunk); // Stream to user in real-time
  }
}
```

---

## 🐛 Troubleshooting

### AI Features Not Working

**Check initialization**:
```typescript
import { AIProviderFactory } from './services/ai/providers/AIProviderFactory';

const status = await new AIInsightsService().getProviderStatus();
console.log(status);
// {
//   initialized: true,
//   available: true,
//   provider: 'OpenAI',
//   model: 'gpt-4-turbo'
// }
```

**Common issues**:

1. **`AI Provider not initialized`**
   - Solution: Set `AI_ENABLED="true"` in `.env`

2. **`OpenAI API key required`**
   - Solution: Set `AI_API_KEY` in `.env`

3. **`Ollama provider not available`**
   - Solution: Make sure Ollama is running (`ollama serve`)

4. **`All AI providers failed`**
   - Check API key validity
   - Check network connectivity
   - Verify provider service is up

### Checking Provider Health

```bash
# In your backend console, you'll see:
✅ AI Provider initialized: OpenAI (gpt-4-turbo)

# Or if disabled:
ℹ️  AI features disabled (AI_ENABLED=false or AI_PROVIDER not set)

# Or if error:
⚠️  AI Provider initialization failed: OpenAI API key required
   AI features will be disabled. Check your AI configuration.
```

---

## 💡 Best Practices

### 1. Use Environment Variables

❌ **Don't hardcode**:
```typescript
const ai = new OpenAIProvider('sk-...', 'gpt-4'); // BAD!
```

✅ **Do use factory**:
```typescript
const ai = AIProviderFactory.getProvider(); // GOOD!
```

### 2. Handle Failures Gracefully

```typescript
try {
  const insights = await aiService.getDashboardInsights();
  return insights;
} catch (error) {
  console.error('AI failed:', error);
  return { insights: ['AI temporarily unavailable'] };
}
```

### 3. Use Appropriate Models for Tasks

- **Simple classification**: GPT-3.5 or Ollama
- **Complex analysis**: GPT-4 or Claude 3.5
- **High volume**: Gemini Flash or Ollama
- **Development/testing**: Always use free Ollama

### 4. Cache AI Responses

```typescript
const cache = new Map();

async function getCachedInsights(key: string) {
  if (cache.has(key)) {
    return cache.get(key);
  }

  const insights = await aiService.getDashboardInsights();
  cache.set(key, insights);
  return insights;
}
```

---

## 🚦 Migration Path

### Phase 1: Development (FREE)

Use Ollama for all development:

```bash
AI_ENABLED="true"
AI_PROVIDER="ollama"
AI_MODEL="llama3"
```

**Benefits**:
- Zero cost
- Fast iteration
- No API limits

### Phase 2: Testing (LOW COST)

Switch to cheaper cloud model:

```bash
AI_PROVIDER="openai"
AI_MODEL="gpt-3.5-turbo"  # $0.50/1M tokens
```

### Phase 3: Production (OPTIMIZED)

Use best model for production:

```bash
AI_PROVIDER="openai"
AI_MODEL="gpt-4-turbo"  # $10/1M tokens
```

Or use multi-provider for cost optimization.

---

## 📈 Adding a New Provider

Want to add a new AI service (e.g., Mistral, Cohere)?

1. **Create adapter**:
   ```typescript
   // backend/src/services/ai/providers/MistralProvider.ts
   export class MistralProvider implements IAIProvider {
     async generateText(request: AITextRequest): Promise<AITextResponse> {
       // Implement using Mistral API
     }
     // ... implement other methods
   }
   ```

2. **Add to factory**:
   ```typescript
   // In AIProviderFactory.ts
   case 'mistral':
     return new MistralProvider(config.apiKey, config.model);
   ```

3. **Update type**:
   ```typescript
   export type AIProviderType = 'openai' | 'anthropic' | 'google' | 'ollama' | 'mistral';
   ```

4. **Use it**:
   ```bash
   AI_PROVIDER="mistral"
   AI_API_KEY="..."
   ```

**That's it!** All existing code works with new provider automatically.

---

## 📝 Summary

### What We Built

✅ Complete AI abstraction layer with 4 providers
✅ Provider-agnostic business logic
✅ Easy switching via environment variables
✅ Fallback support for resilience
✅ Example AI service with 5 features
✅ Comprehensive documentation

### Files Created

- `IAIProvider.ts` - Interface
- `OpenAIProvider.ts` - OpenAI adapter
- `AnthropicProvider.ts` - Anthropic adapter
- `GeminiProvider.ts` - Google adapter
- `OllamaProvider.ts` - Local adapter
- `AIProviderFactory.ts` - Factory
- `MultiProviderFallback.ts` - Fallback
- `insights.service.ts` - Example service

### Files Modified

- `app.ts` - Added initialization (15 lines)
- `.env` - Added configuration (60 lines)

### Dependencies Added

- `openai` - OpenAI SDK
- `@anthropic-ai/sdk` - Anthropic SDK
- `@google/generative-ai` - Google SDK

---

## 🎯 Next Steps

1. **Try it out**: Enable AI with Ollama (free!)
2. **Build features**: Use `AIInsightsService` as template
3. **Add to UI**: Display AI insights in dashboard
4. **Optimize costs**: Use multi-provider routing
5. **Scale up**: Switch to production provider when ready

**Questions?** Check the code examples in `insights.service.ts` for reference!
