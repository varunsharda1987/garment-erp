import { Router } from 'express';
import {
  getAll,
  getById,
  create,
  update,
  remove,
  getConfigs,
  getCounts
} from '../controllers/generic-trim.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * Generic Trim Routes
 *
 * Base path: /api/generic-trims
 *
 * Supported trim types:
 * - hook_eye
 * - snap_button
 * - buckle
 * - velcro
 * - drawstring
 * - ribbon
 * - sequin
 * - bead
 * - motif
 * - interlining
 * - padding
 */

// Get all trim type configurations
router.get('/configs', getConfigs);

// Get counts for all trim types (dashboard)
router.get('/counts', getCounts);

// CRUD operations for specific trim type
router.get('/:trimType', getAll);
router.get('/:trimType/:id', getById);
router.post('/:trimType', create);
router.put('/:trimType/:id', update);
router.delete('/:trimType/:id', remove);

export default router;
