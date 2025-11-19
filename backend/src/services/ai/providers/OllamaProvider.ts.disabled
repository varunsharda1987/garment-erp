/**
 * Ollama Provider Implementation
 *
 * Adapter for locally-hosted Ollama models (Llama 3, Mistral, Phi, etc.)
 * Implements the IAIProvider interface
 *
 * Benefits:
 * - Free to use (no API costs)
 * - Privacy (data stays local)
 * - No rate limits
 * - Great for development/testing
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

export class OllamaProvider implements IAIProvider {
  private baseUrl: string;
  private defaultModel: string;

  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'llama3') {
    this.baseUrl = baseUrl;
    this.defaultModel = model;
  }

  async generateText(request: AITextRequest): Promise<AITextResponse> {
    try {
      const fullPrompt = request.systemPrompt
        ? `${request.systemPrompt}\n\n${request.prompt}`
        : request.prompt;

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.defaultModel,
          prompt: fullPrompt,
          stream: false,
          options: {
            temperature: request.temperature || 0.7,
            num_predict: request.maxTokens || 1000,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        text: data.response,
        provider: 'ollama',
        model: this.defaultModel,
        metadata: {
          evalCount: data.eval_count,
          evalDuration: data.eval_duration,
          totalDuration: data.total_duration,
        },
      };
    } catch (error: any) {
      throw new Error(`Ollama generateText failed: ${error.message}`);
    }
  }

  async generateEmbedding(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse> {
    try {
      const embeddingModel = request.model || 'nomic-embed-text';

      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: embeddingModel,
          prompt: request.text,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        embedding: data.embedding,
        provider: 'ollama',
        dimensions: data.embedding.length,
      };
    } catch (error: any) {
      throw new Error(`Ollama generateEmbedding failed: ${error.message}`);
    }
  }

  async analyzeImage(request: AIImageAnalysisRequest): Promise<AIImageAnalysisResponse> {
    try {
      // Ollama supports vision models like llava
      let imageBase64: string;

      if (request.imageUrl.startsWith('data:image')) {
        // Already base64, extract the data part
        imageBase64 = request.imageUrl.split(',')[1];
      } else {
        // Fetch from URL and convert to base64
        const response = await fetch(request.imageUrl);
        const buffer = await response.arrayBuffer();
        imageBase64 = Buffer.from(buffer).toString('base64');
      }

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llava', // Vision model
          prompt: request.prompt,
          images: [imageBase64],
          stream: false,
          options: {
            num_predict: request.maxTokens || 1000,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        text: data.response,
        provider: 'ollama',
        metadata: {
          model: 'llava',
        },
      };
    } catch (error: any) {
      throw new Error(`Ollama analyzeImage failed: ${error.message}`);
    }
  }

  async extractStructuredData(
    request: AIStructuredExtractionRequest
  ): Promise<AIStructuredExtractionResponse> {
    try {
      const prompt =
        request.prompt ||
        `Extract structured data according to this schema: ${JSON.stringify(request.schema)}`;
      const fullPrompt = `${prompt}\n\nText to extract from:\n${request.text}\n\nRespond with ONLY valid JSON matching the schema, no additional text.`;

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.defaultModel,
          prompt: fullPrompt,
          stream: false,
          options: {
            temperature: 0.2, // Lower temperature for structured extraction
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const responseText = data.response;

      // Clean up response (remove markdown code blocks if present)
      const cleanedText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const extractedData = JSON.parse(cleanedText);

      return {
        data: extractedData,
        provider: 'ollama',
        confidence: 0.85, // Slightly lower confidence for local models
      };
    } catch (error: any) {
      throw new Error(`Ollama extractStructuredData failed: ${error.message}`);
    }
  }

  async *generateTextStream(request: AITextRequest): AsyncGenerator<string> {
    try {
      const fullPrompt = request.systemPrompt
        ? `${request.systemPrompt}\n\n${request.prompt}`
        : request.prompt;

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.defaultModel,
          prompt: fullPrompt,
          stream: true,
          options: {
            temperature: request.temperature || 0.7,
            num_predict: request.maxTokens || 1000,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.response) {
              yield data.response;
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    } catch (error: any) {
      throw new Error(`Ollama generateTextStream failed: ${error.message}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });
      return response.ok;
    } catch (error) {
      console.error('Ollama provider not available:', error);
      return false;
    }
  }

  getProviderName(): string {
    return 'Ollama (Local)';
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }
}
