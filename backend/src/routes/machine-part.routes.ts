import { Router } from 'express';
import {
  createMachinePart,
  getAllMachineParts,
  getMachinePartById,
  updateMachinePart,
  deleteMachinePart,
  bulkImportMachineParts,
  downloadTemplate,
} from '../controllers/machine-part.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createMachinePartSchema,
  updateMachinePartSchema,
  bulkImportMachinePartsSchema,
  machinePartQuerySchema,
} from '../schemas/machinePart.schema';
import { idParamSchema } from '../schemas/common.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// CRUD routes
router.post('/', validateBody(createMachinePartSchema), asyncHandler(createMachinePart));
router.get('/', validateQuery(machinePartQuerySchema), asyncHandler(getAllMachineParts));
router.get('/template', asyncHandler(downloadTemplate));
router.get('/:id', validateParams(idParamSchema), asyncHandler(getMachinePartById));
router.put(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateMachinePartSchema),
  asyncHandler(updateMachinePart)
);
router.delete('/:id', validateParams(idParamSchema), asyncHandler(deleteMachinePart));

// Bulk operations
router.post('/bulk-import', validateBody(bulkImportMachinePartsSchema), asyncHandler(bulkImportMachineParts));

export default router;
