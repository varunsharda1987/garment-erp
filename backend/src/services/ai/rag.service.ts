/**
 * RAG (Retrieval-Augmented Generation) Service
 *
 * Enhances AI responses by retrieving relevant context from
 * indexed documents before generating responses.
 */

import { logInfo, logError, logWarn } from '../../utils/logger';
import { embeddingService, SearchResult } from './embedding.service';

// Types
export interface RAGContext {
  documents: SearchResult[];
  formattedContext: string;
  retrievalTime: number;
}

export interface RAGConfig {
  maxDocuments: number;
  minSimilarity: number;
  documentTypes?: string[];
}

const DEFAULT_CONFIG: RAGConfig = {
  maxDocuments: 5,
  minSimilarity: 0.3,
  documentTypes: undefined, // Search all types
};

class RAGService {
  private config: RAGConfig;

  constructor(config: Partial<RAGConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if RAG is available (embedding service initialized)
   */
  isAvailable(): boolean {
    return embeddingService.isInitialized();
  }

  /**
   * Retrieve relevant context for a query
   */
  async retrieveContext(query: string, config?: Partial<RAGConfig>): Promise<RAGContext> {
    const mergedConfig = { ...this.config, ...config };
    const startTime = Date.now();

    if (!this.isAvailable()) {
      logWarn('[RAGService] Embedding service not available');
      return {
        documents: [],
        formattedContext: '',
        retrievalTime: 0,
      };
    }

    try {
      let allDocuments: SearchResult[] = [];

      // Search each document type if specified, otherwise search all
      if (mergedConfig.documentTypes && mergedConfig.documentTypes.length > 0) {
        for (const docType of mergedConfig.documentTypes) {
          const results = await embeddingService.searchSimilar(query, mergedConfig.maxDocuments, docType);
          allDocuments.push(...results);
        }
        // Sort by similarity and take top results
        allDocuments.sort((a, b) => b.similarity - a.similarity);
        allDocuments = allDocuments.slice(0, mergedConfig.maxDocuments);
      } else {
        allDocuments = await embeddingService.searchSimilar(query, mergedConfig.maxDocuments);
      }

      // Filter by minimum similarity
      const filteredDocuments = allDocuments.filter((doc) => doc.similarity >= mergedConfig.minSimilarity);

      const retrievalTime = Date.now() - startTime;

      logInfo(`[RAGService] Retrieved ${filteredDocuments.length} documents in ${retrievalTime}ms`);

      return {
        documents: filteredDocuments,
        formattedContext: this.formatContextForPrompt(filteredDocuments),
        retrievalTime,
      };
    } catch (error) {
      logError('[RAGService] Failed to retrieve context:', error);
      return {
        documents: [],
        formattedContext: '',
        retrievalTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Format retrieved documents into a context string for the AI prompt
   */
  formatContextForPrompt(documents: SearchResult[]): string {
    if (documents.length === 0) {
      return '';
    }

    const contextParts: string[] = ['\n\n=== RELEVANT KNOWLEDGE BASE ==='];

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const relevance = Math.round(doc.similarity * 100);

      contextParts.push(`\n[Source ${i + 1}] ${doc.title || 'Untitled'} (${relevance}% relevant)`);
      contextParts.push(`Type: ${doc.documentType}`);
      contextParts.push(`Content: ${doc.content}`);
    }

    contextParts.push('\n=== END KNOWLEDGE BASE ===\n');

    return contextParts.join('\n');
  }

  /**
   * Analyze query to determine what types of documents might be relevant
   */
  analyzeQueryIntent(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    const relevantTypes: string[] = [];

    // Process/Workflow related
    if (
      lowerQuery.includes('how to') ||
      lowerQuery.includes('how do') ||
      lowerQuery.includes('step') ||
      lowerQuery.includes('process') ||
      lowerQuery.includes('workflow') ||
      lowerQuery.includes('create') ||
      lowerQuery.includes('add')
    ) {
      relevantTypes.push('process_guide');
    }

    // Style related
    if (
      lowerQuery.includes('style') ||
      lowerQuery.includes('bom') ||
      lowerQuery.includes('bill of material') ||
      lowerQuery.includes('cost sheet') ||
      lowerQuery.includes('costing')
    ) {
      relevantTypes.push('style');
      relevantTypes.push('process_guide');
    }

    // Order related
    if (lowerQuery.includes('order') || lowerQuery.includes('delivery') || lowerQuery.includes('customer')) {
      relevantTypes.push('order');
      relevantTypes.push('process_guide');
    }

    // Material/Inventory related
    if (
      lowerQuery.includes('material') ||
      lowerQuery.includes('fabric') ||
      lowerQuery.includes('inventory') ||
      lowerQuery.includes('stock') ||
      lowerQuery.includes('trim')
    ) {
      relevantTypes.push('material');
      relevantTypes.push('process_guide');
    }

    // Production related
    if (
      lowerQuery.includes('production') ||
      lowerQuery.includes('work order') ||
      lowerQuery.includes('cutting') ||
      lowerQuery.includes('stitching')
    ) {
      relevantTypes.push('production');
      relevantTypes.push('process_guide');
    }

    // Help/FAQ
    if (
      lowerQuery.includes('help') ||
      lowerQuery.includes('faq') ||
      lowerQuery.includes('what is') ||
      lowerQuery.includes('explain')
    ) {
      relevantTypes.push('help');
      relevantTypes.push('faq');
    }

    // Default to searching all if no specific intent detected
    if (relevantTypes.length === 0) {
      return ['process_guide', 'help', 'faq'];
    }

    return [...new Set(relevantTypes)]; // Remove duplicates
  }

  /**
   * Get enhanced context for a query (combines intent analysis + retrieval)
   */
  async getEnhancedContext(query: string): Promise<RAGContext> {
    const relevantTypes = this.analyzeQueryIntent(query);

    return this.retrieveContext(query, {
      documentTypes: relevantTypes.length > 0 ? relevantTypes : undefined,
      maxDocuments: 5,
      minSimilarity: 0.25,
    });
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<RAGConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): RAGConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const ragService = new RAGService();
