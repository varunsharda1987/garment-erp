/**
 * OpenAI Provider Implementation
 *
 * Adapter for OpenAI's GPT models (GPT-4, GPT-3.5, etc.)
 * Implements the IAIProvider interface
 */

import OpenAI from 'openai';
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

export class OpenAIProvider implements IAIProvider {
  private client: OpenAI;
  private defaultModel: string;

  constructor(apiKey: string, model: string = 'gpt-4-turbo') {
    this.client = new OpenAI({ apiKey });
    this.defaultModel = model;
  }

  async generateText(request: AITextRequest): Promise<AITextResponse> {
    try {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }

      messages.push({ role: 'user', content: request.prompt });

      const completion = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages,
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature || 0.7,
      });

      return {
        text: completion.choices[0].message.content || '',
        provider: 'openai',
        model: this.defaultModel,
        tokensUsed: completion.usage?.total_tokens,
        metadata: {
          finishReason: completion.choices[0].finish_reason,
          created: completion.created,
        },
      };
    } catch (error: any) {
      throw new Error(`OpenAI generateText failed: ${error.message}`);
    }
  }

  async generateEmbedding(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
    try {
      const embeddingModel = request.model || 'text-embedding-3-small';

      const embedding = await this.client.embeddings.create({
        model: embeddingModel,
        input: request.text,
      });

      return {
        embedding: embedding.data[0].embedding,
        provider: 'openai',
        dimensions: embedding.data[0].embedding.length,
      };
    } catch (error: any) {
      throw new Error(`OpenAI generateEmbedding failed: ${error.message}`);
    }
  }

  async analyzeImage(request: AIImageAnalysisRequest): Promise<AIImageAnalysisResponse> {
    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: request.prompt },
              {
                type: 'image_url',
                image_url: { url: request.imageUrl },
              },
            ],
          },
        ],
        max_tokens: request.maxTokens || 1000,
      });

      return {
        text: completion.choices[0].message.content || '',
        provider: 'openai',
        metadata: {
          finishReason: completion.choices[0].finish_reason,
        },
      };
    } catch (error: any) {
      throw new Error(`OpenAI analyzeImage failed: ${error.message}`);
    }
  }

  async extractStructuredData(
    request: AIStructuredExtractionRequest
  ): Promise<AIStructuredExtractionResponse> {
    try {
      const prompt = request.prompt || 'Extract structured data according to the schema:';
      const systemPrompt = `You are a data extraction assistant. Extract information in valid JSON format matching this schema: ${JSON.stringify(request.schema)}`;

      const completion = await this.client.chat.completions.create({
        model: this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${prompt}\n\n${request.text}` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2, // Lower temperature for structured extraction
      });

      const extractedData = JSON.parse(completion.choices[0].message.content || '{}');

      return {
        data: extractedData,
        provider: 'openai',
        confidence: 0.9, // Could be calculated based on model confidence
      };
    } catch (error: any) {
      throw new Error(`OpenAI extractStructuredData failed: ${error.message}`);
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
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature || 0.7,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error: any) {
      throw new Error(`OpenAI generateTextStream failed: ${error.message}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Test with a minimal API call
      await this.client.models.list();
      return true;
    } catch (error) {
      console.error('OpenAI provider not available:', error);
      return false;
    }
  }

  getProviderName(): string {
    return 'OpenAI';
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }
}
