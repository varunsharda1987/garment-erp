/**
 * Anthropic Provider Implementation
 *
 * Adapter for Anthropic's Claude models (Claude 3.5 Sonnet, Claude 3 Opus, etc.)
 * Implements the IAIProvider interface
 */

import Anthropic from '@anthropic-ai/sdk';
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

export class AnthropicProvider implements IAIProvider {
  private client: Anthropic;
  private defaultModel: string;

  constructor(apiKey: string, model: string = 'claude-3-5-sonnet-20241022') {
    this.client = new Anthropic({ apiKey });
    this.defaultModel = model;
  }

  async generateText(request: AITextRequest): Promise<AITextResponse> {
    try {
      const message = await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature || 0.7,
        system: request.systemPrompt,
        messages: [
          {
            role: 'user',
            content: request.prompt,
          },
        ],
      });

      const textContent = message.content.find((c) => c.type === 'text');

      return {
        text: textContent?.type === 'text' ? textContent.text : '',
        provider: 'anthropic',
        model: this.defaultModel,
        tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
        metadata: {
          stopReason: message.stop_reason,
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        },
      };
    } catch (error: unknown) {
      throw new Error(`Anthropic generateText failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateEmbedding(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
    // Anthropic doesn't have a native embeddings API
    // Options:
    // 1. Fallback to OpenAI or Voyage AI
    // 2. Use a different provider for embeddings
    // 3. Throw error and document limitation

    throw new Error(
      'Anthropic does not support embeddings. Please use OpenAI, Google, or Voyage AI provider for embeddings.'
    );
  }

  async analyzeImage(request: AIImageAnalysisRequest): Promise<AIImageAnalysisResponse> {
    try {
      // Determine if the image is a URL or base64
      let imageSource: {
        type: 'base64';
        media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
        data: string;
      };

      if (request.imageUrl.startsWith('data:image')) {
        // Base64 encoded image
        const base64Data = request.imageUrl.split(',')[1];
        const mediaType = request.imageUrl.match(/data:([^;]+);/)?.[1] || 'image/jpeg';

        imageSource = {
          type: 'base64' as const,
          media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: base64Data,
        };
      } else {
        // URL - need to fetch and convert to base64
        const response = await fetch(request.imageUrl);
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        imageSource = {
          type: 'base64' as const,
          media_type: contentType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
          data: base64,
        };
      }

      const message = await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: request.maxTokens || 1000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: imageSource,
              },
              {
                type: 'text',
                text: request.prompt,
              },
            ],
          },
        ],
      });

      const textContent = message.content.find((c) => c.type === 'text');

      return {
        text: textContent?.type === 'text' ? textContent.text : '',
        provider: 'anthropic',
        metadata: {
          stopReason: message.stop_reason,
        },
      };
    } catch (error: unknown) {
      throw new Error(`Anthropic analyzeImage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async extractStructuredData(request: AIStructuredExtractionRequest): Promise<AIStructuredExtractionResponse> {
    try {
      const prompt = request.prompt || 'Extract structured data according to the schema:';
      const systemPrompt = `You are a data extraction assistant. Extract information in valid JSON format matching this schema: ${JSON.stringify(request.schema)}. Respond with ONLY the JSON object, no additional text.`;

      const message = await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: 2000,
        temperature: 0.2, // Lower temperature for structured extraction
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\n${request.text}`,
          },
        ],
      });

      const textContent = message.content.find((c) => c.type === 'text');
      const responseText = textContent?.type === 'text' ? textContent.text : '{}';

      // Parse JSON response
      const extractedData = JSON.parse(responseText);

      return {
        data: extractedData,
        provider: 'anthropic',
        confidence: 0.9,
      };
    } catch (error: unknown) {
      throw new Error(
        `Anthropic extractStructuredData failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async *generateTextStream(request: AITextRequest): AsyncGenerator<string> {
    try {
      const stream = await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature || 0.7,
        system: request.systemPrompt,
        messages: [
          {
            role: 'user',
            content: request.prompt,
          },
        ],
        stream: true,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text;
        }
      }
    } catch (error: unknown) {
      throw new Error(
        `Anthropic generateTextStream failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Test with a minimal API call
      await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      });
      return true;
    } catch (error) {
      logError('Anthropic provider not available:', error);
      return false;
    }
  }

  getProviderName(): string {
    return 'Anthropic';
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }
}
