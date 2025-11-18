/**
 * Multi-Provider with Automatic Fallback
 *
 * Provides resilience by automatically failing over to backup providers
 * if the primary provider fails or is unavailable.
 *
 * Use cases:
 * - High availability: If OpenAI is down, fall back to Anthropic
 * - Rate limiting: If primary hits rate limits, use fallback
 * - Cost optimization: Try free local Ollama first, fallback to paid cloud
 *
 * Example:
 *   const multiProvider = new MultiProviderFallback(
 *     primaryProvider,
 *     [fallback1, fallback2]
 *   );
 */

import {
  IAIProvider,
  AITextRequest,
  AITextResponse,
  AIEmbeddingRequest,
  AIEmbeddingResponse,
  AIImageAnalysisRequest,
  AIImageAnalysisResponse,
  AIStructuredExtractionRequest,
  AIStructuredExtractionResponse,
} from './IAIProvider';

export class MultiProviderFallback implements IAIProvider {
  private primaryProvider: IAIProvider;
  private fallbackProviders: IAIProvider[];
  private currentProvider: IAIProvider;

  constructor(primary: IAIProvider, fallbacks: IAIProvider[] = []) {
    this.primaryProvider = primary;
    this.fallbackProviders = fallbacks;
    this.currentProvider = primary;
  }

  async generateText(request: AITextRequest): Promise<AITextResponse> {
    // Try primary provider first
    try {
      const response = await this.primaryProvider.generateText(request);
      this.currentProvider = this.primaryProvider;
      return response;
    } catch (primaryError: any) {
      console.warn(
        `[MultiProviderFallback] Primary provider (${this.primaryProvider.getProviderName()}) failed: ${primaryError.message}`
      );

      // Try fallback providers in order
      for (const fallback of this.fallbackProviders) {
        try {
          console.log(
            `[MultiProviderFallback] Trying fallback: ${fallback.getProviderName()}`
          );
          const response = await fallback.generateText(request);
          this.currentProvider = fallback;
          console.log(
            `[MultiProviderFallback] Fallback to ${fallback.getProviderName()} succeeded`
          );
          return response;
        } catch (fallbackError: any) {
          console.warn(
            `[MultiProviderFallback] Fallback ${fallback.getProviderName()} failed: ${fallbackError.message}`
          );
          // Continue to next fallback
        }
      }

      // All providers failed
      throw new Error(
        `All AI providers failed. Primary: ${primaryError.message}. Check provider configurations.`
      );
    }
  }

  async generateEmbedding(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
    // Try primary provider first
    try {
      const response = await this.primaryProvider.generateEmbedding(request);
      this.currentProvider = this.primaryProvider;
      return response;
    } catch (primaryError: any) {
      console.warn(
        `[MultiProviderFallback] Primary provider embedding failed: ${primaryError.message}`
      );

      // Try fallback providers
      for (const fallback of this.fallbackProviders) {
        try {
          const response = await fallback.generateEmbedding(request);
          this.currentProvider = fallback;
          console.log(
            `[MultiProviderFallback] Embedding fallback to ${fallback.getProviderName()} succeeded`
          );
          return response;
        } catch (fallbackError: any) {
          console.warn(
            `[MultiProviderFallback] Fallback ${fallback.getProviderName()} embedding failed`
          );
        }
      }

      throw new Error(
        `All AI providers failed for embeddings. Primary: ${primaryError.message}`
      );
    }
  }

  async analyzeImage(request: AIImageAnalysisRequest): Promise<AIImageAnalysisResponse> {
    // Try primary provider first
    try {
      const response = await this.primaryProvider.analyzeImage(request);
      this.currentProvider = this.primaryProvider;
      return response;
    } catch (primaryError: any) {
      console.warn(
        `[MultiProviderFallback] Primary provider image analysis failed: ${primaryError.message}`
      );

      // Try fallback providers
      for (const fallback of this.fallbackProviders) {
        try {
          const response = await fallback.analyzeImage(request);
          this.currentProvider = fallback;
          console.log(
            `[MultiProviderFallback] Image analysis fallback to ${fallback.getProviderName()} succeeded`
          );
          return response;
        } catch (fallbackError: any) {
          console.warn(
            `[MultiProviderFallback] Fallback ${fallback.getProviderName()} image analysis failed`
          );
        }
      }

      throw new Error(
        `All AI providers failed for image analysis. Primary: ${primaryError.message}`
      );
    }
  }

  async extractStructuredData(
    request: AIStructuredExtractionRequest
  ): Promise<AIStructuredExtractionResponse> {
    // Try primary provider first
    if (this.primaryProvider.extractStructuredData) {
      try {
        const response = await this.primaryProvider.extractStructuredData(request);
        this.currentProvider = this.primaryProvider;
        return response;
      } catch (primaryError: any) {
        console.warn(
          `[MultiProviderFallback] Primary provider structured extraction failed: ${primaryError.message}`
        );
      }
    }

    // Try fallback providers
    for (const fallback of this.fallbackProviders) {
      if (fallback.extractStructuredData) {
        try {
          const response = await fallback.extractStructuredData(request);
          this.currentProvider = fallback;
          console.log(
            `[MultiProviderFallback] Structured extraction fallback to ${fallback.getProviderName()} succeeded`
          );
          return response;
        } catch (fallbackError: any) {
          console.warn(
            `[MultiProviderFallback] Fallback ${fallback.getProviderName()} structured extraction failed`
          );
        }
      }
    }

    throw new Error('All AI providers failed for structured data extraction');
  }

  async *generateTextStream(request: AITextRequest): AsyncGenerator<string> {
    // Try primary provider first
    if (this.primaryProvider.generateTextStream) {
      try {
        yield* this.primaryProvider.generateTextStream(request);
        this.currentProvider = this.primaryProvider;
        return;
      } catch (primaryError: any) {
        console.warn(
          `[MultiProviderFallback] Primary provider streaming failed: ${primaryError.message}`
        );
      }
    }

    // Try fallback providers
    for (const fallback of this.fallbackProviders) {
      if (fallback.generateTextStream) {
        try {
          yield* fallback.generateTextStream(request);
          this.currentProvider = fallback;
          console.log(
            `[MultiProviderFallback] Streaming fallback to ${fallback.getProviderName()} succeeded`
          );
          return;
        } catch (fallbackError: any) {
          console.warn(
            `[MultiProviderFallback] Fallback ${fallback.getProviderName()} streaming failed`
          );
        }
      }
    }

    throw new Error('All AI providers failed for streaming');
  }

  async isAvailable(): Promise<boolean> {
    // Check if at least one provider is available
    const primaryAvailable = await this.primaryProvider.isAvailable();
    if (primaryAvailable) {
      return true;
    }

    for (const fallback of this.fallbackProviders) {
      const fallbackAvailable = await fallback.isAvailable();
      if (fallbackAvailable) {
        return true;
      }
    }

    return false;
  }

  getProviderName(): string {
    return `MultiProvider (Primary: ${this.primaryProvider.getProviderName()}, Fallbacks: ${this.fallbackProviders.map((f) => f.getProviderName()).join(', ')})`;
  }

  getDefaultModel(): string {
    return this.currentProvider.getDefaultModel();
  }

  /**
   * Get the current active provider (after fallbacks)
   */
  getCurrentProvider(): IAIProvider {
    return this.currentProvider;
  }

  /**
   * Get the primary provider
   */
  getPrimaryProvider(): IAIProvider {
    return this.primaryProvider;
  }

  /**
   * Get all fallback providers
   */
  getFallbackProviders(): IAIProvider[] {
    return this.fallbackProviders;
  }
}
