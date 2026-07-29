/**
 * AI Admin Routes
 *
 * Admin endpoints for managing AI features:
 * - Document indexing for RAG
 * - Embedding statistics
 * - RAG configuration
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { embeddingService } from '../services/ai/embedding.service';
import { indexingService } from '../services/ai/indexing.service';
import { ragService } from '../services/ai/rag.service';
import { logInfo } from '../utils/logger';
import { ValidationError } from '../errors';
import {
  searchDocumentsSchema,
  updateRagConfigSchema,
  type SearchDocumentsInput,
  type UpdateRagConfigInput,
} from '../schemas/aiAdmin.schema';

const router = Router();

// Protect all routes and require ADMIN role
router.use(authenticateToken);
router.use((req: Request, res: Response, next) => {
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
router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
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
  })
);

/**
 * POST /api/ai-admin/initialize
 * Initialize embedding service
 */
// no-body: boots embedding service from env config; no req.body read
router.post(
  '/initialize',
  asyncHandler(async (req: Request, res: Response) => {
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
  })
);

/**
 * GET /api/ai-admin/stats
 * Get indexing statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
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
  })
);

/**
 * POST /api/ai-admin/index/guides
 * Index process guides and help documents
 */
// no-body: reindex trigger for all process guides; no req.body read
router.post(
  '/index/guides',
  asyncHandler(async (req: Request, res: Response) => {
    if (!embeddingService.isInitialized()) {
      throw new ValidationError('Embedding service not initialized. Call /initialize first.');
    }

    logInfo('[AI Admin] Starting process guides indexing');
    const result = await indexingService.indexProcessGuides();

    res.json({
      success: true,
      message: `Indexed ${result.indexed} process guides`,
      result,
    });
  })
);

/**
 * POST /api/ai-admin/index/styles
 * Index styles from database
 */
// no-body: reindex trigger for all DB styles; no req.body read
router.post(
  '/index/styles',
  asyncHandler(async (req: Request, res: Response) => {
    if (!embeddingService.isInitialized()) {
      throw new ValidationError('Embedding service not initialized. Call /initialize first.');
    }

    logInfo('[AI Admin] Starting styles indexing');
    const result = await indexingService.indexStyles();

    res.json({
      success: true,
      message: `Indexed ${result.indexed} styles`,
      result,
    });
  })
);

/**
 * POST /api/ai-admin/index/all
 * Full reindex of all content
 */
// no-body: full-reindex trigger, every source; no req.body read
router.post(
  '/index/all',
  asyncHandler(async (req: Request, res: Response) => {
    if (!embeddingService.isInitialized()) {
      throw new ValidationError('Embedding service not initialized. Call /initialize first.');
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
  })
);

/**
 * POST /api/ai-admin/search
 * Test RAG search functionality
 */
router.post(
  '/search',
  validateBody(searchDocumentsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (!embeddingService.isInitialized()) {
      throw new ValidationError('Embedding service not initialized');
    }

    const { query, limit = 5, documentType } = req.body as SearchDocumentsInput;

    const results = await embeddingService.searchSimilar(query, limit, documentType);

    res.json({
      query,
      results,
      count: results.length,
    });
  })
);

/**
 * DELETE /api/ai-admin/documents/:type
 * Delete all documents of a specific type
 */
// no-body: keyed entirely off the :type URL param; no req.body read
router.delete(
  '/documents/:type',
  asyncHandler(async (req: Request, res: Response) => {
    if (!embeddingService.isInitialized()) {
      throw new ValidationError('Embedding service not initialized');
    }

    const { type } = req.params;

    const deleted = await embeddingService.deleteDocumentsByType(type);

    logInfo(`[AI Admin] Deleted ${deleted} documents of type: ${type}`);

    res.json({
      success: true,
      message: `Deleted ${deleted} documents of type: ${type}`,
      deleted,
    });
  })
);

/**
 * PUT /api/ai-admin/rag/config
 * Update RAG configuration
 */
router.put(
  '/rag/config',
  validateBody(updateRagConfigSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { maxDocuments, minSimilarity } = req.body as UpdateRagConfigInput;

    const config: Record<string, unknown> = {};
    if (typeof maxDocuments === 'number') config.maxDocuments = maxDocuments;
    if (typeof minSimilarity === 'number') config.minSimilarity = minSimilarity;

    ragService.setConfig(config);

    res.json({
      success: true,
      message: 'RAG configuration updated',
      config: ragService.getConfig(),
    });
  })
);

export default router;
