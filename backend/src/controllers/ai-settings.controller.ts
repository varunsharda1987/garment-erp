/**
 * AI Settings Controller
 *
 * Admin-only endpoints for managing AI provider configuration.
 */

import { Request, Response } from 'express';
import { aiSettingsService } from '../services/ai/ai-settings.service';
import { logInfo, logError } from '../utils/logger';

class AISettingsController {
  /**
   * GET /api/ai-settings
   * Get current AI settings (API key is masked)
   */
  async getSettings(req: Request, res: Response) {
    try {
      const settings = await aiSettingsService.getSettings();
      res.json(settings);
    } catch (error) {
      logError('[AISettingsController] getSettings error:', error);
      res.status(500).json({ error: 'Failed to get AI settings' });
    }
  }

  /**
   * PUT /api/ai-settings
   * Update AI settings
   */
  async updateSettings(req: Request, res: Response) {
    try {
      const { enabled, provider, apiKey, model, baseUrl } = req.body;

      const settings = await aiSettingsService.updateSettings({
        enabled,
        provider,
        apiKey,
        model,
        baseUrl,
      });

      logInfo(`[AISettingsController] AI settings updated by user ${req.user?.userId}`);
      res.json(settings);
    } catch (error) {
      logError('[AISettingsController] updateSettings error:', error);
      res.status(500).json({ error: 'Failed to update AI settings' });
    }
  }

  /**
   * POST /api/ai-settings/test
   * Test AI connection with current or provided settings
   */
  async testConnection(req: Request, res: Response) {
    try {
      const { provider, apiKey, model, baseUrl } = req.body;

      const result = await aiSettingsService.testConnection({
        provider,
        apiKey,
        model,
        baseUrl,
      });

      res.json(result);
    } catch (error) {
      logError('[AISettingsController] testConnection error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to test connection',
      });
    }
  }

  /**
   * DELETE /api/ai-settings/api-key
   * Clear the stored API key
   */
  async clearApiKey(req: Request, res: Response) {
    try {
      await aiSettingsService.clearApiKey();
      logInfo(`[AISettingsController] API key cleared by user ${req.user?.userId}`);
      res.json({ success: true, message: 'API key cleared' });
    } catch (error) {
      logError('[AISettingsController] clearApiKey error:', error);
      res.status(500).json({ error: 'Failed to clear API key' });
    }
  }

  /**
   * GET /api/ai-settings/providers
   * Get list of available AI providers
   */
  async getProviders(req: Request, res: Response) {
    try {
      const providers = aiSettingsService.getAvailableProviders();
      res.json(providers);
    } catch (error) {
      logError('[AISettingsController] getProviders error:', error);
      res.status(500).json({ error: 'Failed to get providers' });
    }
  }

  /**
   * GET /api/ai-settings/models/:provider
   * Get available models for a specific provider
   */
  async getModels(req: Request, res: Response) {
    try {
      const { provider } = req.params;
      const models = aiSettingsService.getModelsForProvider(provider);
      res.json(models);
    } catch (error) {
      logError('[AISettingsController] getModels error:', error);
      res.status(500).json({ error: 'Failed to get models' });
    }
  }
}

export const aiSettingsController = new AISettingsController();
