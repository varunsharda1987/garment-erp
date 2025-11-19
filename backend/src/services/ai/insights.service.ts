/**
 * AI Insights Service
 *
 * Example service demonstrating how to use the AI provider abstraction.
 * This service generates intelligent insights from ERP data.
 *
 * Key features:
 * - Provider-agnostic: Works with ANY AI provider (OpenAI, Anthropic, Google, Ollama)
 * - Read-only: Only analyzes data, doesn't modify anything
 * - Graceful degradation: Falls back if AI is unavailable
 */

import { AIProviderFactory } from './providers/AIProviderFactory';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AIInsightsService {
  /**
   * Generate dashboard insights from production and order data
   * This method works with ANY AI provider - just change config!
   */
  async getDashboardInsights(): Promise<{
    insights: string[];
    provider: string;
    model: string;
  }> {
    try {
      // Check if AI is available
      if (!AIProviderFactory.isInitialized()) {
        return {
          insights: ['AI insights not available. Enable AI in configuration.'],
          provider: 'none',
          model: 'none',
        };
      }

      // Get the current AI provider (could be OpenAI, Anthropic, Google, or Ollama)
      const aiProvider = AIProviderFactory.getProvider();

      // Gather data from database (read-only)
      const [pendingOrdersCount, totalStyles, recentOrders] = await Promise.all([
        prisma.orders.count({ where: { status: 'PENDING' } }),
        prisma.styles.count(),
        prisma.orders.findMany({
          take: 5,
          orderBy: { orderDate: 'desc' },
          include: { customers: true },
        }),
      ]);

      // Create context for AI
      const context = {
        pendingOrders: pendingOrdersCount,
        totalStyles,
        recentOrdersCount: recentOrders.length,
      };

      // Generate insights using AI (provider-agnostic!)
      const response = await aiProvider.generateText({
        systemPrompt: `You are an ERP analytics assistant for a garment manufacturing company.
Analyze the provided data and generate 3-5 actionable insights.
Keep insights concise (1-2 sentences each).
Focus on production efficiency, order fulfillment, and business trends.`,
        prompt: `Current ERP Status:
- Pending Orders: ${pendingOrdersCount}
- Total Style Designs: ${totalStyles}
- Recent Orders (last 5): ${recentOrders.map((o) => `${o.customers.name} - ${o.totalQuantity} pieces`).join(', ')}

Generate key insights:`,
        maxTokens: 300,
        temperature: 0.7,
      });

      // Parse insights from response
      const insights = response.text
        .split('\n')
        .filter((line) => line.trim() && !line.startsWith('#'))
        .map((line) => line.replace(/^[-•*]\s*/, '').trim())
        .filter((line) => line.length > 10);

      return {
        insights: insights.slice(0, 5),
        provider: response.provider,
        model: response.model,
      };
    } catch (error: any) {
      console.error('[AIInsightsService] Error generating insights:', error);
      return {
        insights: ['Unable to generate AI insights at this time.'],
        provider: 'error',
        model: 'error',
      };
    }
  }

  /**
   * Predict cost for a style based on similar historical styles
   * Demonstrates structured data extraction
   */
  async predictStyleCost(styleData: {
    category: string;
    componentCount: number;
    hasFabric: boolean;
    hasTrims: boolean;
  }): Promise<{
    predictedCost: number;
    confidence: number;
    provider: string;
  }> {
    try {
      if (!AIProviderFactory.isInitialized()) {
        throw new Error('AI not initialized');
      }

      const aiProvider = AIProviderFactory.getProvider();

      // Get historical cost data for similar styles
      const similarStyles = await prisma.style_costing.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { styles: true },
      });

      const historicalData = similarStyles.map((s: any) => ({
        category: s.styles.category,
        totalCost: s.totalProductCost,
        components: s.styles.styleComponents?.length || 0,
      }));

      // Use AI to predict cost
      const response = await aiProvider.generateText({
        systemPrompt: `You are a cost prediction expert for garment manufacturing.
Based on historical data, predict the cost per piece for a new style.
Respond with ONLY a JSON object: {"predictedCost": number, "confidence": number (0-1)}`,
        prompt: `Historical Cost Data:
${JSON.stringify(historicalData, null, 2)}

New Style:
- Category: ${styleData.category}
- Components: ${styleData.componentCount}
- Has Fabric: ${styleData.hasFabric}
- Has Trims: ${styleData.hasTrims}

Predict cost:`,
        maxTokens: 100,
        temperature: 0.3,
      });

      // Parse response
      const prediction = JSON.parse(response.text);

      return {
        predictedCost: prediction.predictedCost || 0,
        confidence: prediction.confidence || 0.5,
        provider: response.provider,
      };
    } catch (error: any) {
      console.error('[AIInsightsService] Error predicting cost:', error);
      throw error;
    }
  }

  /**
   * Find similar styles using embeddings (semantic search)
   * Demonstrates embedding generation
   */
  async findSimilarStyles(styleDescription: string, limit: number = 5): Promise<{
    similarStyles: any[];
    provider: string;
  }> {
    try {
      if (!AIProviderFactory.isInitialized()) {
        throw new Error('AI not initialized');
      }

      const aiProvider = AIProviderFactory.getProvider();

      // Generate embedding for the input style description
      const embeddingResponse = await aiProvider.generateEmbedding({
        text: styleDescription,
      });

      console.log(
        `[AIInsightsService] Generated ${embeddingResponse.dimensions}-dimensional embedding using ${embeddingResponse.provider}`
      );

      // In a real implementation, you would:
      // 1. Store embeddings in database (using pgvector extension)
      // 2. Query for similar embeddings using cosine similarity
      // For now, just return a simple text-based search
      const styles = await prisma.styles.findMany({
        where: {
          OR: [
            { styleName: { contains: styleDescription, mode: 'insensitive' } },
            { description: { contains: styleDescription, mode: 'insensitive' } },
          ],
        },
        take: limit,
      });

      return {
        similarStyles: styles,
        provider: embeddingResponse.provider,
      };
    } catch (error: any) {
      console.error('[AIInsightsService] Error finding similar styles:', error);
      throw error;
    }
  }

  /**
   * Analyze invoice image and extract data (OCR)
   * Demonstrates image analysis
   */
  async extractInvoiceData(imageUrl: string): Promise<{
    extractedData: any;
    provider: string;
  }> {
    try {
      if (!AIProviderFactory.isInitialized()) {
        throw new Error('AI not initialized');
      }

      const aiProvider = AIProviderFactory.getProvider();

      // Analyze invoice image
      const response = await aiProvider.analyzeImage({
        imageUrl,
        prompt: `Extract the following information from this invoice:
- Supplier name
- Invoice number
- Invoice date
- Total amount
- Line items (material, quantity, unit price)

Respond in JSON format.`,
        maxTokens: 500,
      });

      // Parse extracted data
      try {
        const extractedData = JSON.parse(response.text);
        return {
          extractedData,
          provider: response.provider,
        };
      } catch (parseError) {
        // If JSON parsing fails, return raw text
        return {
          extractedData: { rawText: response.text },
          provider: response.provider,
        };
      }
    } catch (error: any) {
      console.error('[AIInsightsService] Error extracting invoice data:', error);
      throw error;
    }
  }

  /**
   * Get AI provider status (for admin/debugging)
   */
  async getProviderStatus(): Promise<{
    initialized: boolean;
    available: boolean;
    provider: string | null;
    model: string | null;
  }> {
    const initialized = AIProviderFactory.isInitialized();

    if (!initialized) {
      return {
        initialized: false,
        available: false,
        provider: null,
        model: null,
      };
    }

    const provider = AIProviderFactory.getProvider();
    const available = await provider.isAvailable();
    const info = AIProviderFactory.getProviderInfo();

    return {
      initialized: true,
      available,
      provider: info?.name || null,
      model: info?.model || null,
    };
  }
}
