/**
 * AI Admin Routes
 *
 * Admin endpoints for managing AI features:
 * - Document indexing for RAG
 * - Embedding statistics
 * - RAG configuration
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { embeddingService } from '../services/ai/embedding.service';
import { indexingService } from '../services/ai/indexing.service';
import { ragService } from '../services/ai/rag.service';
import { logError, logInfo } from '../utils/logger';

const router = Router();

// Protect all routes and require ADMIN role
router.use(authenticateToken);
router.use((req, res, next) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required',
    });
  }
  next();
});

/**
 * GET /api/ai-admin/status
 * Get AI subsystem status
 */
router.get('/status', async (req, res) => {
  try {
    const embeddingInitialized = embeddingService.isInitialized();
    const embeddingInfo = embeddingService.getProviderInfo();
    const ragAvailable = ragService.isAvailable();

    res.json({
      embedding: {
        initialized: embeddingInitialized,
        provider: embeddingInfo?.name || null,
        dimension: embeddingInfo?.dimension || null,
      },
      rag: {
        available: ragAvailable,
        config: ragService.getConfig(),
      },
    });
  } catch (error) {
    logError('[AI Admin] Status error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get AI status',
    });
  }
});

/**
 * POST /api/ai-admin/initialize
 * Initialize embedding service
 */
router.post('/initialize', async (req, res) => {
  try {
    const success = await embeddingService.initialize();

    if (success) {
      const info = embeddingService.getProviderInfo();
      logInfo('[AI Admin] Embedding service initialized');
      res.json({
        success: true,
        message: 'Embedding service initialized',
        provider: info?.name,
        dimension: info?.dimension,
      });
    } else {
      res.json({
        success: false,
        message: 'Failed to initialize embedding service. Check configuration.',
      });
    }
  } catch (error) {
    logError('[AI Admin] Initialize error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to initialize embedding service',
    });
  }
});

/**
 * GET /api/ai-admin/stats
 * Get indexing statistics
 */
router.get('/stats', async (req, res) => {
  try {
    if (!embeddingService.isInitialized()) {
      return res.json({
        initialized: false,
        message: 'Embedding service not initialized',
        stats: null,
      });
    }

    const stats = await indexingService.getStats();

    res.json({
      initialized: true,
      stats,
    });
  } catch (error) {
    logError('[AI Admin] Stats error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get indexing stats',
    });
  }
});

/**
 * POST /api/ai-admin/index/guides
 * Index process guides and help documents
 */
router.post('/index/guides', async (req, res) => {
  try {
    if (!embeddingService.isInitialized()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Embedding service not initialized. Call /initialize first.',
      });
    }

    logInfo('[AI Admin] Starting process guides indexing');
    const result = await indexingService.indexProcessGuides();

    res.json({
      success: true,
      message: `Indexed ${result.indexed} process guides`,
      result,
    });
  } catch (error) {
    logError('[AI Admin] Index guides error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to index process guides',
    });
  }
});

/**
 * POST /api/ai-admin/index/styles
 * Index styles from database
 */
router.post('/index/styles', async (req, res) => {
  try {
    if (!embeddingService.isInitialized()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Embedding service not initialized. Call /initialize first.',
      });
    }

    logInfo('[AI Admin] Starting styles indexing');
    const result = await indexingService.indexStyles();

    res.json({
      success: true,
      message: `Indexed ${result.indexed} styles`,
      result,
    });
  } catch (error) {
    logError('[AI Admin] Index styles error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to index styles',
    });
  }
});

/**
 * POST /api/ai-admin/index/all
 * Full reindex of all content
 */
router.post('/index/all', async (req, res) => {
  try {
    if (!embeddingService.isInitialized()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Embedding service not initialized. Call /initialize first.',
      });
    }

    logInfo('[AI Admin] Starting full reindex');
    const results = await indexingService.indexAll();

    const totalIndexed = results.reduce((sum, r) => sum + r.indexed, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    res.json({
      success: true,
      message: `Indexed ${totalIndexed} documents (${totalFailed} failed) in ${totalDuration}ms`,
      results,
    });
  } catch (error) {
    logError('[AI Admin] Index all error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to run full reindex',
    });
  }
});

/**
 * POST /api/ai-admin/search
 * Test RAG search functionality
 */
router.post('/search', async (req, res) => {
  try {
    if (!embeddingService.isInitialized()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Embedding service not initialized',
      });
    }

    const { query, limit = 5, documentType } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Query is required',
      });
    }

    const results = await embeddingService.searchSimilar(query, limit, documentType);

    res.json({
      query,
      results,
      count: results.length,
    });
  } catch (error) {
    logError('[AI Admin] Search error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to search documents',
    });
  }
});

/**
 * DELETE /api/ai-admin/documents/:type
 * Delete all documents of a specific type
 */
router.delete('/documents/:type', async (req, res) => {
  try {
    if (!embeddingService.isInitialized()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Embedding service not initialized',
      });
    }

    const { type } = req.params;

    const deleted = await embeddingService.deleteDocumentsByType(type);

    logInfo(`[AI Admin] Deleted ${deleted} documents of type: ${type}`);

    res.json({
      success: true,
      message: `Deleted ${deleted} documents of type: ${type}`,
      deleted,
    });
  } catch (error) {
    logError('[AI Admin] Delete documents error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete documents',
    });
  }
});

/**
 * PUT /api/ai-admin/rag/config
 * Update RAG configuration
 */
router.put('/rag/config', async (req, res) => {
  try {
    const { maxDocuments, minSimilarity } = req.body;

    const config: Record<string, unknown> = {};
    if (typeof maxDocuments === 'number') config.maxDocuments = maxDocuments;
    if (typeof minSimilarity === 'number') config.minSimilarity = minSimilarity;

    ragService.setConfig(config);

    res.json({
      success: true,
      message: 'RAG configuration updated',
      config: ragService.getConfig(),
    });
  } catch (error) {
    logError('[AI Admin] RAG config error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update RAG configuration',
    });
  }
});

export default router;
