/**
 * AI Provider Factory
 *
 * Central factory for creating and managing AI provider instances.
 * Allows easy switching between different AI providers without changing business logic.
 *
 * Usage:
 * 1. Initialize once at app startup: AIProviderFactory.initialize(config)
 * 2. Get provider anywhere: const ai = AIProviderFactory.getProvider()
 * 3. Switch at runtime (optional): AIProviderFactory.switchProvider(newConfig)
 */

import { IAIProvider } from './IAIProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { GeminiProvider } from './GeminiProvider';
import { OllamaProvider } from './OllamaProvider';
import { logInfo, logError, logWarn, logDebug } from '../../../utils/logger';

export type AIProviderType = 'openai' | 'anthropic' | 'google' | 'ollama';

export interface AIProviderConfig {
  type: AIProviderType;
  apiKey?: string; // Required for cloud providers (OpenAI, Anthropic, Google)
  model?: string; // Optional: defaults to provider's default model
  baseUrl?: string; // Required for Ollama (e.g., http://localhost:11434)
}

export class AIProviderFactory {
  private static instance: IAIProvider | null = null;
  private static config: AIProviderConfig | null = null;

  /**
   * Initialize the AI provider (call once at app startup)
   *
   * @param config Provider configuration
   * @throws Error if provider type is unknown or required config is missing
   */
  static initialize(config: AIProviderConfig): void {
    logInfo(`[AIProviderFactory] Initializing provider: ${config.type}`);
    this.config = config;
    this.instance = this.createProvider(config);
    logInfo(
      `[AIProviderFactory] Provider initialized: ${this.instance.getProviderName()} (${this.instance.getDefaultModel()})`
    );
  }

  /**
   * Get the current AI provider instance
   *
   * @returns Current AI provider
   * @throws Error if provider not initialized
   */
  static getProvider(): IAIProvider {
    if (!this.instance) {
      throw new Error(
        'AI Provider not initialized. Call AIProviderFactory.initialize() at app startup.'
      );
    }
    return this.instance;
  }

  /**
   * Switch provider at runtime (optional, for advanced use cases)
   *
   * @param config New provider configuration
   */
  static switchProvider(config: AIProviderConfig): void {
    logInfo(`[AIProviderFactory] Switching provider to: ${config.type}`);
    this.config = config;
    this.instance = this.createProvider(config);
    logInfo(
      `[AIProviderFactory] Provider switched: ${this.instance.getProviderName()} (${this.instance.getDefaultModel()})`
    );
  }

  /**
   * Get current provider configuration
   *
   * @returns Current provider config or null if not initialized
   */
  static getConfig(): AIProviderConfig | null {
    return this.config;
  }

  /**
   * Check if provider is initialized
   *
   * @returns true if initialized, false otherwise
   */
  static isInitialized(): boolean {
    return this.instance !== null;
  }

  /**
   * Create provider instance based on config
   *
   * @param config Provider configuration
   * @returns AI provider instance
   * @throws Error if provider type is unknown or required config is missing
   */
  private static createProvider(config: AIProviderConfig): IAIProvider {
    switch (config.type) {
      case 'openai':
        if (!config.apiKey) {
          throw new Error('OpenAI API key is required. Set AI_API_KEY environment variable.');
        }
        return new OpenAIProvider(config.apiKey, config.model);

      case 'anthropic':
        if (!config.apiKey) {
          throw new Error(
            'Anthropic API key is required. Set AI_API_KEY environment variable.'
          );
        }
        return new AnthropicProvider(config.apiKey, config.model);

      case 'google':
        if (!config.apiKey) {
          throw new Error('Google API key is required. Set AI_API_KEY environment variable.');
        }
        return new GeminiProvider(config.apiKey, config.model);

      case 'ollama':
        // Ollama doesn't require API key, uses local server
        return new OllamaProvider(config.baseUrl, config.model);

      default:
        throw new Error(
          `Unknown AI provider type: ${config.type}. Supported types: openai, anthropic, google, ollama`
        );
    }
  }

  /**
   * Validate provider health (check if accessible)
   *
   * @returns true if provider is available and working, false otherwise
   */
  static async validateProvider(): Promise<boolean> {
    if (!this.instance) {
      logError('[AIProviderFactory] Cannot validate: provider not initialized');
      return false;
    }

    try {
      const isAvailable = await this.instance.isAvailable();
      if (isAvailable) {
        logInfo(`[AIProviderFactory] Provider validation successful`);
      } else {
        logError(`[AIProviderFactory] Provider validation failed`);
      }
      return isAvailable;
    } catch (error: unknown) {
      logError(`[AIProviderFactory] Provider validation error: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
      return false;
    }
  }

  /**
   * Get provider info (for debugging/admin UI)
   *
   * @returns Provider information
   */
  static getProviderInfo(): {
    name: string;
    model: string;
    type: AIProviderType | null;
    initialized: boolean;
  } | null {
    if (!this.instance || !this.config) {
      return null;
    }

    return {
      name: this.instance.getProviderName(),
      model: this.instance.getDefaultModel(),
      type: this.config.type,
      initialized: true,
    };
  }
}
