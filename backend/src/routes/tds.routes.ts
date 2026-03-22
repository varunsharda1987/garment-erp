import { Router } from 'express';
import { tdsController } from '../controllers/tds.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/summary', asyncHandler(tdsController.getSummary.bind(tdsController)));
router.get('/', asyncHandler(tdsController.getAll.bind(tdsController)));
router.get('/:id', asyncHandler(tdsController.getById.bind(tdsController)));
router.post('/', asyncHandler(tdsController.create.bind(tdsController)));
router.put('/:id', asyncHandler(tdsController.update.bind(tdsController)));
router.put('/:id/status', asyncHandler(tdsController.updateStatus.bind(tdsController)));
router.delete('/:id', asyncHandler(tdsController.delete.bind(tdsController)));

export default router;
