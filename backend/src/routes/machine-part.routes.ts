import { Router } from 'express';
import {
  createMachinePart,
  getAllMachineParts,
  getMachinePartById,
  updateMachinePart,
  deleteMachinePart,
  bulkImportMachineParts,
  downloadTemplate
} from '../controllers/machine-part.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// CRUD routes
router.post('/', asyncHandler(createMachinePart));
router.get('/', asyncHandler(getAllMachineParts));
router.get('/template', asyncHandler(downloadTemplate));
router.get('/:id', asyncHandler(getMachinePartById));
router.put('/:id', asyncHandler(updateMachinePart));
router.delete('/:id', asyncHandler(deleteMachinePart));

// Bulk operations
router.post('/bulk-import', asyncHandler(bulkImportMachineParts));

export default router;
