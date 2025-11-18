# AI Provider Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Choose Your Provider

| Provider | Setup Time | Cost | Best For |
|----------|-----------|------|----------|
| **Ollama** | 2 min | FREE | Development, Testing |
| **OpenAI** | 1 min | Paid | Production, High Quality |
| **Anthropic** | 1 min | Paid | Long Documents, Analysis |
| **Google** | 1 min | Paid | Cost-Effective Production |

---

### Step 2A: Ollama Setup (FREE - Recommended for Dev)

```bash
# 1. Install Ollama
# Download from: https://ollama.ai/download

# 2. Pull a model
ollama pull llama3

# 3. Update backend/.env
AI_ENABLED="true"
AI_PROVIDER="ollama"
AI_BASE_URL="http://localhost:11434"
AI_MODEL="llama3"

# 4. Restart server
cd backend
npm run dev
```

**Done!** ✅ You now have FREE AI features.

---

### Step 2B: OpenAI Setup (Paid - Best Quality)

```bash
# 1. Get API key from: https://platform.openai.com/api-keys

# 2. Update backend/.env
AI_ENABLED="true"
AI_PROVIDER="openai"
AI_API_KEY="sk-proj-..."
AI_MODEL="gpt-4-turbo"

# 3. Restart server
cd backend
npm run dev
```

**Done!** ✅ Using GPT-4.

---

### Step 2C: Anthropic Setup (Paid - Claude)

```bash
# 1. Get API key from: https://console.anthropic.com/

# 2. Update backend/.env
AI_ENABLED="true"
AI_PROVIDER="anthropic"
AI_API_KEY="sk-ant-..."
AI_MODEL="claude-3-5-sonnet-20241022"

# 3. Restart server
cd backend
npm run dev
```

**Done!** ✅ Using Claude 3.5 Sonnet.

---

### Step 2D: Google Gemini Setup (Paid - Cost-Effective)

```bash
# 1. Get API key from: https://makersuite.google.com/app/apikey

# 2. Update backend/.env
AI_ENABLED="true"
AI_PROVIDER="google"
AI_API_KEY="AIza..."
AI_MODEL="gemini-1.5-pro"

# 3. Restart server
cd backend
npm run dev
```

**Done!** ✅ Using Gemini.

---

## 🔄 Switching Providers

**Want to change providers? Just update `.env` and restart!**

```bash
# Switch from OpenAI to Ollama (FREE)
AI_PROVIDER="ollama"
AI_API_KEY=""  # Not needed for Ollama
AI_MODEL="llama3"
AI_BASE_URL="http://localhost:11434"
```

**No code changes needed!** 🎉

---

## ✅ Verify It's Working

When you restart the server, you should see:

```
✅ AI Provider initialized: OpenAI (gpt-4-turbo)
```

Or:

```
✅ AI Provider initialized: Ollama (Local) (llama3)
```

If AI is disabled:

```
ℹ️  AI features disabled (AI_ENABLED=false or AI_PROVIDER not set)
```

If there's an error:

```
⚠️  AI Provider initialization failed: OpenAI API key required
   AI features will be disabled. Check your AI configuration.
```

---

## 💻 Test It Out

Create a test file: `backend/test-ai.js`

```javascript
import { AIProviderFactory } from './src/services/ai/providers/AIProviderFactory.js';

async function test() {
  const ai = AIProviderFactory.getProvider();

  console.log('Provider:', ai.getProviderName());
  console.log('Model:', ai.getDefaultModel());

  const response = await ai.generateText({
    prompt: 'Explain ERP in one sentence.',
    maxTokens: 50,
  });

  console.log('Response:', response.text);
  console.log('Tokens used:', response.tokensUsed);
}

test();
```

Run it:

```bash
node backend/test-ai.js
```

---

## 🎯 Next Steps

1. **Read full guide**: See [AI_PROVIDER_GUIDE.md](AI_PROVIDER_GUIDE.md)
2. **Explore examples**: Check `backend/src/services/ai/insights.service.ts`
3. **Build features**: Use AI in your ERP system!

---

## 🆘 Troubleshooting

### Problem: "AI Provider not initialized"

**Solution**: Set `AI_ENABLED="true"` in `.env`

### Problem: "OpenAI API key required"

**Solution**: Add your API key to `.env`:
```bash
AI_API_KEY="sk-..."
```

### Problem: "Ollama provider not available"

**Solution**: Start Ollama:
```bash
ollama serve
```

### Problem: "All AI providers failed"

**Check**:
1. ✅ API key is valid
2. ✅ Internet connection is working
3. ✅ Provider service is up
4. ✅ Restart server after `.env` changes

---

## 💰 Cost Estimates (Production)

Assuming 1,000 AI requests/day:

| Provider | Model | Monthly Cost |
|----------|-------|--------------|
| Ollama | llama3 | **$0** (FREE) |
| OpenAI | gpt-3.5-turbo | ~$15 |
| OpenAI | gpt-4-turbo | ~$100 |
| Anthropic | claude-3-5-sonnet | ~$30 |
| Google | gemini-1.5-pro | ~$70 |

**Recommendation**: Start with Ollama (free) for dev, switch to GPT-3.5 for production, upgrade to GPT-4 when needed.

---

## 📊 Quick Comparison

| Feature | Ollama | OpenAI | Anthropic | Google |
|---------|--------|--------|-----------|--------|
| Setup | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Quality | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Speed | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Cost | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Privacy | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |

---

## 🎉 You're Ready!

Your garment ERP now has AI superpowers! 🚀

Choose your provider, update `.env`, and start building intelligent features.

For detailed documentation, see [AI_PROVIDER_GUIDE.md](AI_PROVIDER_GUIDE.md)
