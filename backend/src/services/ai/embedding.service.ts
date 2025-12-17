/**
 * Embedding Service
 *
 * Handles vector embeddings for RAG (Retrieval-Augmented Generation).
 * Supports multiple embedding providers: OpenAI, Ollama (local).
 */

import { PrismaClient } from '@prisma/client';
import { logInfo, logError, logWarn } from '../../utils/logger';

const prisma = new PrismaClient();

// Types
export interface EmbeddingResult {
  embedding: number[];
  model: string;
  provider: string;
}

export interface DocumentChunk {
  id?: string;
  documentType: string;
  sourceId?: string;
  title?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  documentType: string;
  title: string | null;
  content: string;
  similarity: number;
  metadata: Record<string, unknown> | null;
}

// Embedding provider interface
interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
  getDimension(): number;
  getName(): string;
}

// OpenAI Embedding Provider
class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY || '';
    this.model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    this.baseUrl = process.env.EMBEDDING_BASE_URL || 'https://api.openai.com/v1';
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        input: text,
        model: this.model,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI Embedding API error: ${error}`);
    }

    const data = (await response.json()) as { data: Array<{ embedding: number[] }> };
    return data.data[0].embedding;
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI Embedding API error: ${error}`);
    }

    const data = (await response.json()) as { data: Array<{ embedding: number[] }> };
    return data.data.map((d) => d.embedding);
  }

  getDimension(): number {
    // text-embedding-3-small: 1536 dimensions
    // text-embedding-3-large: 3072 dimensions
    return this.model.includes('large') ? 3072 : 1536;
  }

  getName(): string {
    return `OpenAI (${this.model})`;
  }
}

// Ollama Embedding Provider (Local)
class OllamaEmbeddingProvider implements EmbeddingProvider {
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        prompt: text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama Embedding API error: ${error}`);
    }

    const data = (await response.json()) as { embedding: number[] };
    return data.embedding;
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    // Ollama doesn't support batch embeddings natively, so we do them sequentially
    const embeddings: number[][] = [];
    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);
    }
    return embeddings;
  }

  getDimension(): number {
    // nomic-embed-text: 768 dimensions
    // mxbai-embed-large: 1024 dimensions
    if (this.model.includes('mxbai')) return 1024;
    return 768;
  }

  getName(): string {
    return `Ollama (${this.model})`;
  }
}

// Main Embedding Service
class EmbeddingService {
  private provider: EmbeddingProvider | null = null;
  private initialized = false;

  /**
   * Initialize the embedding provider
   */
  async initialize(): Promise<boolean> {
    const embeddingProvider = process.env.EMBEDDING_PROVIDER || 'ollama';

    try {
      if (embeddingProvider === 'openai') {
        const apiKey = process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY;
        if (!apiKey) {
          logWarn('[EmbeddingService] OpenAI API key not configured, embeddings disabled');
          return false;
        }
        this.provider = new OpenAIEmbeddingProvider();
      } else {
        // Default to Ollama (local)
        this.provider = new OllamaEmbeddingProvider();

        // Test if Ollama is available
        try {
          const response = await fetch(`${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/tags`);
          if (!response.ok) {
            logWarn('[EmbeddingService] Ollama not available, embeddings disabled');
            return false;
          }
        } catch {
          logWarn('[EmbeddingService] Ollama not reachable, embeddings disabled');
          return false;
        }
      }

      this.initialized = true;
      logInfo(`[EmbeddingService] Initialized with provider: ${this.provider.getName()}`);
      return true;
    } catch (error) {
      logError('[EmbeddingService] Failed to initialize:', error);
      return false;
    }
  }

  isInitialized(): boolean {
    return this.initialized && this.provider !== null;
  }

  getProviderInfo(): { name: string; dimension: number } | null {
    if (!this.provider) return null;
    return {
      name: this.provider.getName(),
      dimension: this.provider.getDimension(),
    };
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult | null> {
    if (!this.provider) {
      logWarn('[EmbeddingService] Provider not initialized');
      return null;
    }

    try {
      const embedding = await this.provider.generateEmbedding(text);
      return {
        embedding,
        model: this.provider.getName(),
        provider: this.provider.getName().split(' ')[0],
      };
    } catch (error) {
      logError('[EmbeddingService] Failed to generate embedding:', error);
      return null;
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[] | null> {
    if (!this.provider) {
      logWarn('[EmbeddingService] Provider not initialized');
      return null;
    }

    try {
      const embeddings = await this.provider.generateBatchEmbeddings(texts);
      return embeddings.map((embedding) => ({
        embedding,
        model: this.provider!.getName(),
        provider: this.provider!.getName().split(' ')[0],
      }));
    } catch (error) {
      logError('[EmbeddingService] Failed to generate batch embeddings:', error);
      return null;
    }
  }

  /**
   * Store a document chunk with its embedding in the database
   */
  async storeDocument(chunk: DocumentChunk): Promise<string | null> {
    if (!this.provider) {
      logWarn('[EmbeddingService] Provider not initialized');
      return null;
    }

    try {
      const embeddingResult = await this.generateEmbedding(chunk.content);
      if (!embeddingResult) {
        throw new Error('Failed to generate embedding');
      }

      // Create content hash to avoid duplicates
      const contentHash = await this.hashContent(chunk.content);

      // Check for existing document with same hash
      const existing = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM document_embeddings WHERE content_hash = ${contentHash}
      `;

      if (existing.length > 0) {
        logInfo(`[EmbeddingService] Document already exists: ${existing[0].id}`);
        return existing[0].id;
      }

      // Store in database using raw SQL for pgvector
      const result = await prisma.$queryRaw<{ id: string }[]>`
        INSERT INTO document_embeddings (
          document_type, source_id, title, content, content_hash, embedding, metadata
        ) VALUES (
          ${chunk.documentType},
          ${chunk.sourceId || null},
          ${chunk.title || null},
          ${chunk.content},
          ${contentHash},
          ${embeddingResult.embedding}::vector,
          ${JSON.stringify(chunk.metadata || {})}::jsonb
        )
        RETURNING id
      `;

      logInfo(`[EmbeddingService] Stored document: ${result[0].id}`);
      return result[0].id;
    } catch (error) {
      logError('[EmbeddingService] Failed to store document:', error);
      return null;
    }
  }

  /**
   * Store multiple documents with embeddings
   */
  async storeDocuments(chunks: DocumentChunk[]): Promise<number> {
    let stored = 0;
    for (const chunk of chunks) {
      const id = await this.storeDocument(chunk);
      if (id) stored++;
    }
    return stored;
  }

  /**
   * Search for similar documents using vector similarity
   */
  async searchSimilar(query: string, limit = 5, documentType?: string): Promise<SearchResult[]> {
    if (!this.provider) {
      logWarn('[EmbeddingService] Provider not initialized');
      return [];
    }

    try {
      const embeddingResult = await this.generateEmbedding(query);
      if (!embeddingResult) {
        throw new Error('Failed to generate query embedding');
      }

      // Build the SQL query with optional document type filter
      let results: SearchResult[];

      if (documentType) {
        results = await prisma.$queryRaw<SearchResult[]>`
          SELECT
            id,
            document_type as "documentType",
            title,
            content,
            1 - (embedding <=> ${embeddingResult.embedding}::vector) as similarity,
            metadata
          FROM document_embeddings
          WHERE document_type = ${documentType}
          ORDER BY embedding <=> ${embeddingResult.embedding}::vector
          LIMIT ${limit}
        `;
      } else {
        results = await prisma.$queryRaw<SearchResult[]>`
          SELECT
            id,
            document_type as "documentType",
            title,
            content,
            1 - (embedding <=> ${embeddingResult.embedding}::vector) as similarity,
            metadata
          FROM document_embeddings
          ORDER BY embedding <=> ${embeddingResult.embedding}::vector
          LIMIT ${limit}
        `;
      }

      return results;
    } catch (error) {
      logError('[EmbeddingService] Failed to search similar documents:', error);
      return [];
    }
  }

  /**
   * Delete all documents of a specific type
   */
  async deleteDocumentsByType(documentType: string): Promise<number> {
    try {
      const result = await prisma.$executeRaw`
        DELETE FROM document_embeddings WHERE document_type = ${documentType}
      `;
      logInfo(`[EmbeddingService] Deleted ${result} documents of type: ${documentType}`);
      return result;
    } catch (error) {
      logError('[EmbeddingService] Failed to delete documents:', error);
      return 0;
    }
  }

  /**
   * Get document count by type
   */
  async getDocumentCount(documentType?: string): Promise<number> {
    try {
      if (documentType) {
        const result = await prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) as count FROM document_embeddings WHERE document_type = ${documentType}
        `;
        return Number(result[0].count);
      } else {
        const result = await prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) as count FROM document_embeddings
        `;
        return Number(result[0].count);
      }
    } catch (error) {
      logError('[EmbeddingService] Failed to get document count:', error);
      return 0;
    }
  }

  /**
   * Create a hash of the content for deduplication
   */
  private async hashContent(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();
