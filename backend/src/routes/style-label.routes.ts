// Style Label Configuration Routes
import { Router } from 'express';
import {
  addLabelToStyle,
  getStyleLabels,
  getStyleLabelById,
  updateStyleLabelConfig,
  removeStyleLabel,
  deleteStyleLabelPermanent,
  bulkAddLabelsToStyle,
} from '../controllers/style-label.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ============================================
// Style Label Config Routes
// ============================================

// Get a specific style label config by ID
router.get('/:id', getStyleLabelById);

// Update a style label config
router.put('/:id', updateStyleLabelConfig);

// Remove a label from a style (soft delete)
router.delete('/:id', removeStyleLabel);

// Permanently delete a style label config
router.delete('/:id/permanent', deleteStyleLabelPermanent);

export default router;

// ============================================
// Style-Scoped Routes (to be mounted under /styles/:styleId)
// ============================================

export const styleLabelRouter = Router({ mergeParams: true });

// Apply authentication to style-scoped routes
styleLabelRouter.use(authenticateToken);

// Get all labels assigned to a style
styleLabelRouter.get('/', getStyleLabels);

// Add a label to a style
styleLabelRouter.post('/', addLabelToStyle);

// Bulk add labels to a style
styleLabelRouter.post('/bulk', bulkAddLabelsToStyle);
