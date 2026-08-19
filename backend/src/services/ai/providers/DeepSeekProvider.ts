/**
 * DeepSeek Provider Implementation
 *
 * Adapter for DeepSeek's V4 models (deepseek-v4-flash, deepseek-v4-pro)
 * Uses OpenAI-compatible API format
 *
 * Key benefits:
 * - 8x cheaper than Kimi K3 (~$0.11 per task vs $0.84)
 * - 3x faster (103 tokens/s vs 38 tokens/s)
 * - 1M token context window
 * - Intelligence score 52-53 (sufficient for ERP help questions)
 *
 * Configuration (in .env):
 *   AI_PROVIDER=deepseek
 *   AI_API_KEY=your-deepseek-api-key  (from https://platform.deepseek.com)
 *   AI_MODEL=deepseek-v4-flash        (optional, defaults to deepseek-v4-flash)
 *
 * Available models:
 *   - deepseek-v4-flash (fastest, cheapest, recommended for ERP chat)
 *   - deepseek-v4-pro   (slower, smarter, for complex reasoning)
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

// DeepSeek API base URL (no /v1 - OpenAI SDK adds the path automatically)
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

// Available DeepSeek models
export type DeepSeekModel = 'deepseek-v4-flash' | 'deepseek-v4-pro' | 'deepseek-chat' | 'deepseek-reasoner';

export class DeepSeekProvider implements IAIProvider {
  private client: OpenAI;
  private defaultModel: string;

  /**
   * Create a new DeepSeek provider instance
   *
   * @param apiKey DeepSeek API key (from https://platform.deepseek.com)
   * @param model Model to use (default: deepseek-v4-flash)
   */
  constructor(apiKey: string, model: string = 'deepseek-v4-flash') {
    // Use OpenAI client with DeepSeek's base URL (OpenAI-compatible API)
    this.client = new OpenAI({
      apiKey,
      baseURL: DEEPSEEK_BASE_URL,
    });
    this.defaultModel = model;
    logInfo(`[DeepSeekProvider] Initialized with model: ${model}`);
  }

  async generateText(request: AITextRequest): Promise<AITextResponse> {
    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }

      messages.push({ role: 'user', content: request.prompt });

      logDebug(`[DeepSeekProvider] Generating text with ${messages.length} messages`);

      const completion = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages,
        max_tokens: request.maxTokens || 2000,
        temperature: request.temperature || 0.7,
      });

      const response: AITextResponse = {
        text: completion.choices[0].message.content || '',
        provider: 'deepseek',
        model: this.defaultModel,
        tokensUsed: completion.usage?.total_tokens,
        metadata: {
          finishReason: completion.choices[0].finish_reason,
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
        },
      };

      logDebug(`[DeepSeekProvider] Generated ${response.tokensUsed} tokens`);
      return response;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError(`[DeepSeekProvider] generateText failed: ${errorMessage}`);
      throw new Error(`DeepSeek generateText failed: ${errorMessage}`);
    }
  }

  async generateEmbedding(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
    // DeepSeek doesn't have a dedicated embedding model in their API
    logWarn('[DeepSeekProvider] DeepSeek does not support embeddings directly. Use Ollama or OpenAI for embeddings.');
    throw new Error(
      'DeepSeek does not support embeddings. Configure EMBEDDING_PROVIDER=ollama or EMBEDDING_PROVIDER=openai'
    );
  }

  async analyzeImage(request: AIImageAnalysisRequest): Promise<AIImageAnalysisResponse> {
    try {
      // DeepSeek V4 supports vision - construct vision message
      let imageContent: OpenAI.Chat.ChatCompletionContentPart;

      if (request.imageUrl.startsWith('data:image')) {
        // Base64 encoded image
        imageContent = {
          type: 'image_url',
          image_url: { url: request.imageUrl },
        };
      } else {
        // URL-based image
        imageContent = {
          type: 'image_url',
          image_url: { url: request.imageUrl },
        };
      }

      const completion = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [
          {
            role: 'user',
            content: [imageContent, { type: 'text', text: request.prompt }],
          },
        ],
        max_tokens: request.maxTokens || 1000,
      });

      return {
        text: completion.choices[0].message.content || '',
        provider: 'deepseek',
        metadata: {
          finishReason: completion.choices[0].finish_reason,
        },
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError(`[DeepSeekProvider] analyzeImage failed: ${errorMessage}`);
      throw new Error(`DeepSeek analyzeImage failed: ${errorMessage}`);
    }
  }

  async extractStructuredData(request: AIStructuredExtractionRequest): Promise<AIStructuredExtractionResponse> {
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
      let extractedData: Record<string, unknown>;
      try {
        // Remove markdown code blocks if present
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
        extractedData = JSON.parse(jsonStr);
      } catch {
        logWarn('[DeepSeekProvider] Failed to parse JSON, attempting raw parse');
        extractedData = JSON.parse(content);
      }

      return {
        data: extractedData,
        provider: 'deepseek',
        confidence: 0.85,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError(`[DeepSeekProvider] extractStructuredData failed: ${errorMessage}`);
      throw new Error(`DeepSeek extractStructuredData failed: ${errorMessage}`);
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
      logError(`[DeepSeekProvider] generateTextStream failed: ${errorMessage}`);
      throw new Error(`DeepSeek generateTextStream failed: ${errorMessage}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      logInfo(`[DeepSeekProvider] Testing connection to model: ${this.defaultModel}`);
      // Test with a minimal API call
      const response = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      });
      logInfo(`[DeepSeekProvider] Connection test successful`);
      // A resolved call with a choice proves availability — reasoning models may
      // return empty content when max_tokens is tiny, and that still counts.
      return response.choices.length > 0;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logError(`[DeepSeekProvider] Provider not available: ${errorMsg}`);
      return false;
    }
  }

  getProviderName(): string {
    return 'DeepSeek';
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }
}
