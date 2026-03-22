import { Router } from 'express';
import { tcsController } from '../controllers/tcs.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/summary', asyncHandler(tcsController.getSummary.bind(tcsController)));
router.get('/', asyncHandler(tcsController.getAll.bind(tcsController)));
router.get('/:id', asyncHandler(tcsController.getById.bind(tcsController)));
router.post('/', asyncHandler(tcsController.create.bind(tcsController)));
router.put('/:id', asyncHandler(tcsController.update.bind(tcsController)));
router.put('/:id/status', asyncHandler(tcsController.updateStatus.bind(tcsController)));
router.delete('/:id', asyncHandler(tcsController.delete.bind(tcsController)));

export default router;
