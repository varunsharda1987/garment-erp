/**
 * AI Settings Service
 *
 * Manages AI provider configuration stored in system_settings.
 * API keys are encrypted at rest using AES-256-GCM.
 */

import crypto from 'crypto';
import prisma from '../../config/database';
import { logInfo, logError, logWarn } from '../../utils/logger';
import { AIProviderFactory, AIProviderType } from './providers/AIProviderFactory';

// Encryption key from environment (32 bytes for AES-256)
// Falls back to a derived key from JWT_SECRET if not set
const getEncryptionKey = (): Buffer => {
  const envKey = process.env.AI_SETTINGS_ENCRYPTION_KEY;
  if (envKey && envKey.length >= 32) {
    return Buffer.from(envKey.slice(0, 32));
  }
  // Derive from JWT_SECRET as fallback
  const jwtSecret = process.env.JWT_SECRET || 'default-secret-change-me';
  return crypto.createHash('sha256').update(jwtSecret).digest();
};

// AI settings keys in system_settings table
const AI_SETTINGS_KEYS = {
  PROVIDER: 'AI_PROVIDER',
  API_KEY: 'AI_API_KEY_ENCRYPTED',
  MODEL: 'AI_MODEL',
  BASE_URL: 'AI_BASE_URL',
  ENABLED: 'AI_ENABLED',
} as const;

// Available providers for the UI dropdown
export const AVAILABLE_PROVIDERS = [
  { value: 'deepseek', label: 'DeepSeek (Recommended)', description: 'Cheapest, fast, good quality' },
  { value: 'kimi', label: 'Kimi (Moonshot)', description: '1M context, good for documents' },
  { value: 'ollama', label: 'Ollama (Local)', description: 'Free, requires local setup' },
  { value: 'openai', label: 'OpenAI', description: 'GPT-4, high quality, expensive' },
  { value: 'anthropic', label: 'Anthropic', description: 'Claude, best quality, expensive' },
  { value: 'google', label: 'Google', description: 'Gemini, good quality' },
] as const;

// Model options per provider
export const PROVIDER_MODELS: Record<string, Array<{ value: string; label: string }>> = {
  deepseek: [
    { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash (Fast, Cheap)' },
    { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro (Smarter)' },
  ],
  kimi: [
    { value: 'kimi-k3', label: 'Kimi K3 (Flagship, 1M context)' },
    { value: 'kimi-k2.7-code', label: 'Kimi K2.7 Code (Coding)' },
    { value: 'kimi-k2.6', label: 'Kimi K2.6 (Vision)' },
  ],
  ollama: [
    { value: 'llama3.1', label: 'Llama 3.1' },
    { value: 'mistral', label: 'Mistral' },
    { value: 'qwen2', label: 'Qwen 2' },
  ],
  openai: [
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  anthropic: [
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
  ],
  google: [
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
};

export interface AISettings {
  enabled: boolean;
  provider: AIProviderType | null;
  apiKeySet: boolean; // Don't expose actual key
  apiKeyMasked: string | null; // Last 4 chars for display
  model: string | null;
  baseUrl: string | null;
}

export interface AISettingsInput {
  enabled?: boolean;
  provider?: AIProviderType;
  apiKey?: string; // Plain text, will be encrypted
  model?: string;
  baseUrl?: string;
}

class AISettingsService {
  /**
   * Encrypt a value using AES-256-GCM
   */
  private encrypt(text: string): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt a value using AES-256-GCM
   */
  private decrypt(encryptedText: string): string {
    try {
      const key = getEncryptionKey();
      const [ivHex, authTagHex, encrypted] = encryptedText.split(':');

      if (!ivHex || !authTagHex || !encrypted) {
        throw new Error('Invalid encrypted format');
      }

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logError('[AISettingsService] Decryption failed:', error);
      throw new Error('Failed to decrypt API key');
    }
  }

  /**
   * Get a setting value from the database
   */
  private async getSetting(key: string): Promise<string | null> {
    const setting = await prisma.system_settings.findUnique({ where: { key } });
    return setting?.value || null;
  }

  /**
   * Set a setting value in the database
   */
  private async setSetting(key: string, value: string, category = 'AI'): Promise<void> {
    await prisma.system_settings.upsert({
      where: { key },
      create: {
        key,
        value,
        dataType: 'STRING',
        category,
        isSystem: true,
      },
      update: { value },
    });
  }

  /**
   * Get current AI settings (safe for frontend - no raw API key)
   */
  async getSettings(): Promise<AISettings> {
    const [enabled, provider, encryptedKey, model, baseUrl] = await Promise.all([
      this.getSetting(AI_SETTINGS_KEYS.ENABLED),
      this.getSetting(AI_SETTINGS_KEYS.PROVIDER),
      this.getSetting(AI_SETTINGS_KEYS.API_KEY),
      this.getSetting(AI_SETTINGS_KEYS.MODEL),
      this.getSetting(AI_SETTINGS_KEYS.BASE_URL),
    ]);

    // Check if API key is set and get masked version
    let apiKeySet = false;
    let apiKeyMasked: string | null = null;

    if (encryptedKey) {
      try {
        const decrypted = this.decrypt(encryptedKey);
        if (decrypted && decrypted.length > 0) {
          apiKeySet = true;
          // Show last 4 characters
          apiKeyMasked = decrypted.length > 4 ? '••••••••' + decrypted.slice(-4) : '••••';
        }
      } catch {
        // Key exists but can't be decrypted (encryption key changed?)
        apiKeySet = false;
      }
    }

    return {
      enabled: enabled === 'true',
      provider: (provider as AIProviderType) || null,
      apiKeySet,
      apiKeyMasked,
      model: model || null,
      baseUrl: baseUrl || null,
    };
  }

  /**
   * Get the raw API key (for internal use only - initializing provider)
   */
  async getApiKey(): Promise<string | null> {
    const encryptedKey = await this.getSetting(AI_SETTINGS_KEYS.API_KEY);
    if (!encryptedKey) return null;

    try {
      return this.decrypt(encryptedKey);
    } catch {
      return null;
    }
  }

  /**
   * Update AI settings
   */
  async updateSettings(input: AISettingsInput): Promise<AISettings> {
    const updates: Promise<void>[] = [];

    if (input.enabled !== undefined) {
      updates.push(this.setSetting(AI_SETTINGS_KEYS.ENABLED, String(input.enabled)));
    }

    if (input.provider !== undefined) {
      updates.push(this.setSetting(AI_SETTINGS_KEYS.PROVIDER, input.provider));
    }

    if (input.apiKey !== undefined && input.apiKey.length > 0) {
      const encrypted = this.encrypt(input.apiKey);
      updates.push(this.setSetting(AI_SETTINGS_KEYS.API_KEY, encrypted));
    }

    if (input.model !== undefined) {
      updates.push(this.setSetting(AI_SETTINGS_KEYS.MODEL, input.model));
    }

    if (input.baseUrl !== undefined) {
      updates.push(this.setSetting(AI_SETTINGS_KEYS.BASE_URL, input.baseUrl || ''));
    }

    await Promise.all(updates);

    // Reinitialize the AI provider with new settings
    await this.reinitializeProvider();

    logInfo('[AISettingsService] AI settings updated');
    return this.getSettings();
  }

  /**
   * Clear the API key
   */
  async clearApiKey(): Promise<void> {
    await prisma.system_settings.deleteMany({
      where: { key: AI_SETTINGS_KEYS.API_KEY },
    });
    logInfo('[AISettingsService] API key cleared');
  }

  /**
   * Test connection with current or provided settings
   */
  async testConnection(
    input?: AISettingsInput
  ): Promise<{ success: boolean; message: string; provider?: string; model?: string }> {
    try {
      // Get current settings
      const currentSettings = await this.getSettings();

      // Merge with input if provided
      const provider = input?.provider || currentSettings.provider;
      const model = input?.model || currentSettings.model;
      const baseUrl = input?.baseUrl || currentSettings.baseUrl;

      // Get API key - use new one if provided, otherwise use stored one
      let apiKey: string | null = null;
      if (input?.apiKey && input.apiKey.length > 0) {
        apiKey = input.apiKey;
      } else {
        apiKey = await this.getApiKey();
      }

      if (!provider) {
        return { success: false, message: 'No provider configured' };
      }

      if (provider !== 'ollama' && !apiKey) {
        return { success: false, message: 'API key is required for cloud providers' };
      }

      // Create a temporary provider instance for testing
      let testProvider: any;

      // Import the specific provider
      switch (provider) {
        case 'deepseek': {
          const { DeepSeekProvider } = await import('./providers/DeepSeekProvider');
          testProvider = new DeepSeekProvider(apiKey!, model || undefined);
          break;
        }
        case 'kimi': {
          const { KimiProvider } = await import('./providers/KimiProvider');
          testProvider = new KimiProvider(apiKey!, model || undefined);
          break;
        }
        case 'openai': {
          const { OpenAIProvider } = await import('./providers/OpenAIProvider');
          testProvider = new OpenAIProvider(apiKey!, model || undefined);
          break;
        }
        case 'anthropic': {
          const { AnthropicProvider } = await import('./providers/AnthropicProvider');
          testProvider = new AnthropicProvider(apiKey!, model || undefined);
          break;
        }
        case 'google': {
          const { GeminiProvider } = await import('./providers/GeminiProvider');
          testProvider = new GeminiProvider(apiKey!, model || undefined);
          break;
        }
        case 'ollama': {
          const { OllamaProvider } = await import('./providers/OllamaProvider');
          testProvider = new OllamaProvider(baseUrl || undefined, model || undefined);
          break;
        }
        default:
          return { success: false, message: `Unknown provider: ${provider}` };
      }

      // Test the connection
      const isAvailable = await testProvider.isAvailable();

      if (isAvailable) {
        return {
          success: true,
          message: 'Connection successful',
          provider: testProvider.getProviderName(),
          model: testProvider.getDefaultModel(),
        };
      } else {
        return {
          success: false,
          message:
            'Provider test failed — check backend logs for the exact API error (invalid key, insufficient balance, etc.)',
        };
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logError('[AISettingsService] Connection test failed:', error);
      return { success: false, message: `Connection failed: ${message}` };
    }
  }

  /**
   * Reinitialize the AI provider with current database settings
   * Called after settings are updated or at app startup
   */
  async reinitializeProvider(): Promise<void> {
    try {
      const settings = await this.getSettings();

      if (!settings.enabled || !settings.provider) {
        logInfo('[AISettingsService] AI is disabled or no provider configured');
        return;
      }

      const apiKey = await this.getApiKey();

      // For cloud providers, API key is required
      if (settings.provider !== 'ollama' && !apiKey) {
        logWarn('[AISettingsService] API key not set for cloud provider');
        return;
      }

      AIProviderFactory.initialize({
        type: settings.provider,
        apiKey: apiKey || undefined,
        model: settings.model || undefined,
        baseUrl: settings.baseUrl || undefined,
      });

      logInfo(`[AISettingsService] AI provider reinitialized: ${settings.provider}`);
    } catch (error) {
      logError('[AISettingsService] Failed to reinitialize provider:', error);
    }
  }

  /**
   * Initialize AI from database settings at app startup
   * Falls back to .env settings if database settings are not configured
   */
  async initializeFromDatabase(): Promise<void> {
    try {
      const settings = await this.getSettings();

      // If database has settings, use them
      if (settings.provider) {
        await this.reinitializeProvider();
        return;
      }

      // Otherwise, fall back to .env settings (existing behavior)
      const envProvider = process.env.AI_PROVIDER as AIProviderType | undefined;
      const envApiKey = process.env.AI_API_KEY;
      const envModel = process.env.AI_MODEL;
      const envBaseUrl = process.env.AI_BASE_URL;

      // AI_ENABLED is the documented kill switch (see .env.example) and app.ts:37 has always
      // honoured it. This fallback runs AFTER app.ts has correctly declined to initialize, so
      // without the same guard it silently switches AI back on: the ERP would keep making
      // billable calls to the vendor, and the public GET /api/ai/status would report enabled.
      if (envProvider && process.env.AI_ENABLED === 'true') {
        AIProviderFactory.initialize({
          type: envProvider,
          apiKey: envApiKey || undefined,
          model: envModel || undefined,
          baseUrl: envBaseUrl || undefined,
        });
        logInfo(`[AISettingsService] AI provider initialized from .env: ${envProvider}`);
      } else if (envProvider) {
        logInfo('[AISettingsService] AI provider present in .env but AI_ENABLED is not "true" — leaving AI off');
      }
    } catch (error) {
      logError('[AISettingsService] Failed to initialize AI from database:', error);
      // Don't throw - AI is optional
    }
  }

  /**
   * Get available providers for the UI
   */
  getAvailableProviders() {
    return AVAILABLE_PROVIDERS;
  }

  /**
   * Get models for a specific provider
   */
  getModelsForProvider(provider: string) {
    return PROVIDER_MODELS[provider] || [];
  }
}

export const aiSettingsService = new AISettingsService();
