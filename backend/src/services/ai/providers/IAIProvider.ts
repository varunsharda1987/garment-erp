/**
 * AI Provider Abstraction Layer
 *
 * This interface provides a unified API for different AI providers
 * (OpenAI, Anthropic, Google Gemini, Ollama, etc.)
 *
 * Purpose: Make it easy to switch AI providers without changing business logic
 */

// Generic request/response types for text generation
export interface AITextRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  context?: Record<string, any>;
}

export interface AITextResponse {
  text: string;
  provider: string;
  model: string;
  tokensUsed?: number;
  confidence?: number;
  metadata?: Record<string, any>;
}

// Types for embeddings (similarity search)
export interface AIEmbeddingRequest {
  text: string;
  model?: string;
}

export interface AIEmbeddingResponse {
  embedding: number[];
  provider: string;
  dimensions: number;
}

// Types for image analysis (OCR, defect detection, etc.)
export interface AIImageAnalysisRequest {
  imageUrl: string;
  prompt: string;
  maxTokens?: number;
}

export interface AIImageAnalysisResponse {
  text: string;
  provider: string;
  confidence?: number;
  metadata?: Record<string, any>;
}

// Types for structured data extraction
export interface AIStructuredExtractionRequest {
  text: string;
  schema: Record<string, any>; // JSON schema for expected output
  prompt?: string;
}

export interface AIStructuredExtractionResponse {
  data: Record<string, any>;
  provider: string;
  confidence?: number;
}

/**
 * Main AI Provider Interface
 * All provider implementations must implement this interface
 */
export interface IAIProvider {
  /**
   * Generate text based on a prompt
   * Used for: insights, recommendations, summaries, etc.
   */
  generateText(request: AITextRequest): Promise<AITextResponse>;

  /**
   * Generate embeddings for similarity search
   * Used for: style similarity, material classification, etc.
   */
  generateEmbedding(request: AIEmbeddingRequest): Promise<AIEmbeddingResponse>;

  /**
   * Analyze images
   * Used for: invoice OCR, defect detection, image classification
   */
  analyzeImage(request: AIImageAnalysisRequest): Promise<AIImageAnalysisResponse>;

  /**
   * Extract structured data from unstructured text
   * Used for: invoice parsing, document extraction
   */
  extractStructuredData?(request: AIStructuredExtractionRequest): Promise<AIStructuredExtractionResponse>;

  /**
   * Streaming support for real-time responses (optional)
   */
  generateTextStream?(request: AITextRequest): AsyncGenerator<string>;

  /**
   * Check if provider is available and configured correctly
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get provider name (e.g., "OpenAI", "Anthropic", "Google Gemini")
   */
  getProviderName(): string;

  /**
   * Get default model being used
   */
  getDefaultModel(): string;
}
