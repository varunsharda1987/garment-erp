/**
 * Kimi (Moonshot AI) Provider Implementation
 *
 * Adapter for Moonshot's Kimi models (moonshot-v1-8k, moonshot-v1-32k, moonshot-v1-128k)
 * Uses OpenAI-compatible API format
 *
 * Key benefits:
 * - 25x cheaper than Claude/OpenAI (~$0.12 per 1M tokens)
 * - Up to 128K context window
 * - Good for structured ERP queries
 *
 * Configuration (in .env):
 *   AI_ENABLED=true
 *   AI_PROVIDER=kimi
 *   AI_API_KEY=your-moonshot-api-key  (from https://platform.moonshot.cn)
 *   AI_MODEL=moonshot-v1-32k          (optional, defaults to moonshot-v1-32k)
 *
 * Available models:
 *   - moonshot-v1-8k   (8K context, fastest)
 *   - moonshot-v1-32k  (32K context, balanced)
 *   - moonshot-v1-128k (128K context, for large documents)
 */

import OpenAI from 'openai';
import { logInfo, logError, logWarn, logDebug } from '../../../utils/logger';
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

// Kimi API base URL
const KIMI_BASE_URL = 'https://api.moonshot.cn/v1';

// Available Kimi models
export type KimiModel = 'moonshot-v1-8k' | 'moonshot-v1-32k' | 'moonshot-v1-128k';

export class KimiProvider implements IAIProvider {
  private client: OpenAI;
  private defaultModel: string;

  /**
   * Create a new Kimi provider instance
   *
   * @param apiKey Moonshot API key (from https://platform.moonshot.cn)
   * @param model Model to use (default: moonshot-v1-32k)
   */
  constructor(apiKey: string, model: string = 'moonshot-v1-32k') {
    // Use OpenAI client with Kimi's base URL (OpenAI-compatible API)
    this.client = new OpenAI({
      apiKey,
      baseURL: KIMI_BASE_URL,
    });
    this.defaultModel = model;
    logInfo(`[KimiProvider] Initialized with model: ${model}`);
  }

  async generateText(request: AITextRequest): Promise<AITextResponse> {
    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }

      messages.push({ role: 'user', content: request.prompt });

      logDebug(`[KimiProvider] Generating text with ${messages.length} messages`);

      const completion = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages,
        max_tokens: request.maxTokens || 2000,
        temperature: request.temperature || 0.7,
      });

      const response: AITextResponse = {
        text: completion.choices[0].message.content || '',
        provider: 'kimi',
        model: this.defaultModel,
        tokensUsed: completion.usage?.total_tokens,
        metadata: {
          finishReason: completion.choices[0].finish_reason,
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
        },
      };

      logDebug(`[KimiProvider] Generated ${response.tokensUsed} tokens`);
      return response;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError(`[KimiProvider] generateText failed: ${errorMessage}`);
      throw new Error(`Kimi generateText failed: ${errorMessage}`);
    }
  }

  async generateEmbedding(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
    // Kimi doesn't have a dedicated embedding model
    // Fall back to using text-based similarity or throw an error
    logWarn('[KimiProvider] Kimi does not support embeddings directly. Use Ollama or OpenAI for embeddings.');
    throw new Error(
      'Kimi does not support embeddings. Configure EMBEDDING_PROVIDER=ollama or EMBEDDING_PROVIDER=openai'
    );
  }

  async analyzeImage(request: AIImageAnalysisRequest): Promise<AIImageAnalysisResponse> {
    // Kimi's vision capabilities (if available)
    // For now, indicate this is not supported
    logWarn('[KimiProvider] Image analysis not yet supported with Kimi.');
    throw new Error('Kimi image analysis not supported. Use OpenAI or Anthropic for image analysis.');
  }

  async extractStructuredData(
    request: AIStructuredExtractionRequest
  ): Promise<AIStructuredExtractionResponse> {
    try {
      const prompt = request.prompt || 'Extract structured data according to the schema:';
      const systemPrompt = `You are a data extraction assistant. Extract information in valid JSON format matching this schema: ${JSON.stringify(request.schema)}. Return ONLY valid JSON, no other text.`;

      const completion = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${prompt}\n\n${request.text}` },
        ],
        temperature: 0.2, // Lower temperature for structured extraction
      });

      const content = completion.choices[0].message.content || '{}';

      // Try to parse JSON from response (may have markdown code blocks)
      let extractedData: Record<string, any>;
      try {
        // Remove markdown code blocks if present
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
        extractedData = JSON.parse(jsonStr);
      } catch {
        logWarn('[KimiProvider] Failed to parse JSON, attempting raw parse');
        extractedData = JSON.parse(content);
      }

      return {
        data: extractedData,
        provider: 'kimi',
        confidence: 0.85,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError(`[KimiProvider] extractStructuredData failed: ${errorMessage}`);
      throw new Error(`Kimi extractStructuredData failed: ${errorMessage}`);
    }
  }

  async *generateTextStream(request: AITextRequest): AsyncGenerator<string> {
    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }

      messages.push({ role: 'user', content: request.prompt });

      const stream = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages,
        max_tokens: request.maxTokens || 2000,
        temperature: request.temperature || 0.7,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError(`[KimiProvider] generateTextStream failed: ${errorMessage}`);
      throw new Error(`Kimi generateTextStream failed: ${errorMessage}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Test with a minimal API call
      const response = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      });
      return !!response.choices[0].message.content;
    } catch (error) {
      logError('[KimiProvider] Provider not available:', error);
      return false;
    }
  }

  getProviderName(): string {
    return 'Kimi (Moonshot AI)';
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }
}
