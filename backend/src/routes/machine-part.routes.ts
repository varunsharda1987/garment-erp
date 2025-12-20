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

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// CRUD routes
router.post('/', createMachinePart);
router.get('/', getAllMachineParts);
router.get('/template', downloadTemplate);
router.get('/:id', getMachinePartById);
router.put('/:id', updateMachinePart);
router.delete('/:id', deleteMachinePart);

// Bulk operations
router.post('/bulk-import', bulkImportMachineParts);

export default router;
