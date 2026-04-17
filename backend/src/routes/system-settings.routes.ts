import { Router } from 'express';
import { systemSettingsController } from '../controllers/system-settings.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery } from '../middleware/validation.middleware';
import { upsertSystemSettingSchema, systemSettingsQuerySchema } from '../schemas/systemSettings.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/system-settings/defaults — convenience: all DEFAULTS category as key-value map
router.get('/defaults', asyncHandler(systemSettingsController.getDefaults.bind(systemSettingsController)));

// GET /api/system-settings — list all with optional filters
router.get(
  '/',
  validateQuery(systemSettingsQuerySchema),
  asyncHandler(systemSettingsController.getAll.bind(systemSettingsController))
);

// GET /api/system-settings/:key — get single setting by key
router.get('/:key', asyncHandler(systemSettingsController.getByKey.bind(systemSettingsController)));

// PUT /api/system-settings/:key — create or update a setting
router.put(
  '/:key',
  validateBody(upsertSystemSettingSchema),
  asyncHandler(systemSettingsController.upsert.bind(systemSettingsController))
);

// DELETE /api/system-settings/:key — delete (blocked for isSystem=true)
router.delete('/:key', asyncHandler(systemSettingsController.delete.bind(systemSettingsController)));

export default router;
