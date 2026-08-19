/**
 * AI Settings Routes
 *
 * Admin-only routes for managing AI provider configuration.
 */

import { Router } from 'express';
import { aiSettingsController } from '../controllers/ai-settings.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { updateAISettingsSchema, testAIConnectionSchema } from '../schemas/aiSettings.schema';

const router = Router();

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(authorize('ADMIN'));

// GET /api/ai-settings — Get current AI settings
router.get('/', asyncHandler(aiSettingsController.getSettings.bind(aiSettingsController)));

// PUT /api/ai-settings — Update AI settings
router.put(
  '/',
  validateBody(updateAISettingsSchema),
  asyncHandler(aiSettingsController.updateSettings.bind(aiSettingsController))
);

// POST /api/ai-settings/test — Test AI connection
router.post(
  '/test',
  validateBody(testAIConnectionSchema),
  asyncHandler(aiSettingsController.testConnection.bind(aiSettingsController))
);

// DELETE /api/ai-settings/api-key — Clear API key
router.delete('/api-key', asyncHandler(aiSettingsController.clearApiKey.bind(aiSettingsController)));

// GET /api/ai-settings/providers — Get available providers
router.get('/providers', asyncHandler(aiSettingsController.getProviders.bind(aiSettingsController)));

// GET /api/ai-settings/models/:provider — Get models for a provider
router.get('/models/:provider', asyncHandler(aiSettingsController.getModels.bind(aiSettingsController)));

export default router;
