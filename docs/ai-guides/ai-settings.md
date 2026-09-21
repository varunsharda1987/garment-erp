---
slug: ai-settings
title: Configure AI Assistant
keywords:
  # English
  - AI settings
  - assistant settings
  - AI configuration
  - configure AI
  - AI provider
  - API key
  - DeepSeek
  - Kimi
  - Ollama
  - OpenAI
  - Anthropic
  - Google Gemini
  - test connection
  - enable AI
  - disable AI
  # Hinglish
  - AI settings karna
  - assistant configure karna
  - AI enable karna
  - AI band karna
  - API key dalna
  - provider select karna
  - connection test karna
  # Devanagari
  - एआई सेटिंग्स
  - असिस्टेंट सेटिंग्स
  - एआई कॉन्फ़िगर करना
  - एपीआई की
  - प्रोवाइडर चुनना
  - कनेक्शन टेस्ट
sources:
  - frontend/src/config/navigation.ts
  - frontend/src/pages/AISettings.tsx
  - frontend/src/services/ai-settings.service.ts
  - frontend/src/components/Sidebar.tsx
  - backend/src/services/ai/ai-settings.service.ts
route: /ai-settings
---

## Steps

### Open AI Settings
1. In the sidebar, find **AI Assistant** section (has a sparkle icon)
2. Click **AI Settings** (gear icon) below the AI Assistant link
3. This page is admin-only (requires `aiSettings` permission)

### Enable or Disable AI
1. In the **AI Assistant Status** card, toggle the switch
2. **Enabled**: Team members can use the AI Assistant at `/ai-assistant`
3. **Disabled**: AI Assistant is turned off for everyone

### Select a Provider
1. In the **Provider Configuration** section, open the **AI Provider** dropdown
2. Choose one:
   - **DeepSeek (Recommended)** - Cheapest, fast, good quality
   - **Kimi (Moonshot)** - 1M context window, good for documents
   - **Ollama (Local)** - Free, requires local Ollama server
   - **OpenAI** - GPT-4, high quality, expensive
   - **Anthropic** - Claude, best quality, expensive
   - **Google** - Gemini, good quality

### Enter API Key (Cloud Providers)
1. For cloud providers (all except Ollama), you need an API key
2. Click the **Get API Key** link to open the provider's key management page
3. Copy your API key and paste it in the **API Key** field
4. Click the eye icon to show/hide the key
5. API keys are **encrypted** before storage (AES-256-GCM)

### Configure Ollama (Local)
1. If using Ollama, enter the **Ollama Server URL**
2. Default is `http://localhost:11434`
3. Change this if Ollama runs on a different machine

### Select a Model
1. After choosing a provider, the **Model** dropdown appears
2. Select the model you want to use:
   - **DeepSeek**: V4 Flash (fast/cheap) or V4 Pro (smarter)
   - **Kimi**: K3 (flagship), K2.7 Code (coding), K2.6 (vision)
   - **Ollama**: Llama 3.1, Mistral, Qwen 2
   - **OpenAI**: GPT-4 Turbo, GPT-4o, GPT-3.5 Turbo
   - **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus
   - **Google**: Gemini 1.5 Pro, Gemini 1.5 Flash

### Test Connection
1. Click **Test Connection** to verify your settings work
2. Success shows a green checkmark with provider and model info
3. Failure shows a red X with an error message
4. Always test before saving

### Save Settings
1. After making changes, click **Save Settings**
2. The button only activates when you have unsaved changes
3. After saving, the API key field clears (it is stored encrypted)
4. Click **Cancel** to discard changes and revert to saved settings

### Clear API Key
1. If an API key is already set, you see "Current key: ********xxxx"
2. Click **Clear Key** (trash icon) to remove the stored key
3. This is useful when rotating keys or switching providers

## Settings

| Setting | Description |
|---------|-------------|
| **AI Assistant Status** | Toggle to enable/disable AI for all team members |
| **AI Provider** | Which AI service to use (DeepSeek recommended) |
| **API Key** | Your provider's API key (encrypted at rest) |
| **Model** | Which model to use from the selected provider |
| **Base URL** | Only for Ollama - URL of your local Ollama server |

## Traps

- **No API key for cloud providers**: Cloud providers (everything except Ollama) require an API key. The connection test will fail without one.
- **Ollama not running**: If using Ollama, make sure the server is running locally before testing the connection.
- **Wrong base URL**: For Ollama on a different machine, use that machine's IP address, not `localhost`.
- **API key balance**: If the connection test fails, check your provider's dashboard for account balance or rate limits.
- **Model not available**: Some models may not be available on your plan. Check the provider's documentation.
- **Encryption key change**: If `AI_SETTINGS_ENCRYPTION_KEY` or `JWT_SECRET` environment variables change, stored API keys become unreadable. You will need to re-enter the API key.
- **AI still off after enabling**: The AI must have both a valid provider configuration AND be enabled. Check that "Test Connection" succeeds.
