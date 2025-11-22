/**
 * Google Gemini Provider Implementation
 *
 * Adapter for Google's Gemini models (Gemini 1.5 Pro, Gemini 1.5 Flash, etc.)
 * Implements the IAIProvider interface
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
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

export class GeminiProvider implements IAIProvider {
  private client: GoogleGenerativeAI;
  private defaultModel: string;

  constructor(apiKey: string, model: string = 'gemini-1.5-pro') {
    this.client = new GoogleGenerativeAI(apiKey);
    this.defaultModel = model;
  }

  async generateText(request: AITextRequest): Promise<AITextResponse> {
    try {
      const model = this.client.getGenerativeModel({ model: this.defaultModel });

      // Combine system prompt and user prompt
      const fullPrompt = request.systemPrompt
        ? `${request.systemPrompt}\n\n${request.prompt}`
        : request.prompt;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
          maxOutputTokens: request.maxTokens || 1000,
          temperature: request.temperature || 0.7,
        },
      });

      const response = result.response;

      return {
        text: response.text(),
        provider: 'google',
        model: this.defaultModel,
        metadata: {
          finishReason: response.candidates?.[0]?.finishReason,
          safetyRatings: response.candidates?.[0]?.safetyRatings,
        },
      };
    } catch (error: any) {
      throw new Error(`Google Gemini generateText failed: ${error.message}`);
    }
  }

  async generateEmbedding(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
    try {
      const embeddingModel = request.model || 'text-embedding-004';
      const model = this.client.getGenerativeModel({ model: embeddingModel });

      const result = await model.embedContent(request.text);

      return {
        embedding: result.embedding.values,
        provider: 'google',
        dimensions: result.embedding.values.length,
      };
    } catch (error: any) {
      throw new Error(`Google Gemini generateEmbedding failed: ${error.message}`);
    }
  }

  async analyzeImage(request: AIImageAnalysisRequest): Promise<AIImageAnalysisResponse> {
    try {
      const model = this.client.getGenerativeModel({ model: 'gemini-1.5-flash' });

      // Fetch image and convert to base64 if it's a URL
      let imagePart: any;

      if (request.imageUrl.startsWith('data:image')) {
        // Already base64
        const base64Data = request.imageUrl.split(',')[1];
        const mimeType = request.imageUrl.match(/data:([^;]+);/)?.[1] || 'image/jpeg';

        imagePart = {
          inlineData: {
            data: base64Data,
            mimeType,
          },
        };
      } else {
        // Fetch from URL
        const response = await fetch(request.imageUrl);
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = response.headers.get('content-type') || 'image/jpeg';

        imagePart = {
          inlineData: {
            data: base64,
            mimeType,
          },
        };
      }

      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: request.prompt }, imagePart],
          },
        ],
        generationConfig: {
          maxOutputTokens: request.maxTokens || 1000,
        },
      });

      const response = result.response;

      return {
        text: response.text(),
        provider: 'google',
        metadata: {
          finishReason: response.candidates?.[0]?.finishReason,
        },
      };
    } catch (error: any) {
      throw new Error(`Google Gemini analyzeImage failed: ${error.message}`);
    }
  }

  async extractStructuredData(
    request: AIStructuredExtractionRequest
  ): Promise<AIStructuredExtractionResponse> {
    try {
      const model = this.client.getGenerativeModel({ model: this.defaultModel });

      const prompt =
        request.prompt ||
        `Extract structured data according to the schema: ${JSON.stringify(request.schema)}`;
      const fullPrompt = `${prompt}\n\nText to extract from:\n${request.text}\n\nRespond with ONLY valid JSON matching the schema, no additional text.`;

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: 0.2, // Lower temperature for structured extraction
        },
      });

      const responseText = result.response.text();

      // Clean up response (remove markdown code blocks if present)
      const cleanedText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const extractedData = JSON.parse(cleanedText);

      return {
        data: extractedData,
        provider: 'google',
        confidence: 0.9,
      };
    } catch (error: any) {
      throw new Error(`Google Gemini extractStructuredData failed: ${error.message}`);
    }
  }

  async *generateTextStream(request: AITextRequest): AsyncGenerator<string> {
    try {
      const model = this.client.getGenerativeModel({ model: this.defaultModel });

      const fullPrompt = request.systemPrompt
        ? `${request.systemPrompt}\n\n${request.prompt}`
        : request.prompt;

      const result = await model.generateContentStream({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
          maxOutputTokens: request.maxTokens || 1000,
          temperature: request.temperature || 0.7,
        },
      });

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield text;
        }
      }
    } catch (error: any) {
      throw new Error(`Google Gemini generateTextStream failed: ${error.message}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: this.defaultModel });
      await model.generateContent('test');
      return true;
    } catch (error) {
      logError('Google Gemini provider not available:', error);
      return false;
    }
  }

  getProviderName(): string {
    return 'Google Gemini';
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }
}
