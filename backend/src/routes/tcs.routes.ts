import { Router } from 'express';
import { tcsController } from '../controllers/tcs.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/summary', tcsController.getSummary.bind(tcsController));
router.get('/', tcsController.getAll.bind(tcsController));
router.get('/:id', tcsController.getById.bind(tcsController));
router.post('/', tcsController.create.bind(tcsController));
router.put('/:id', tcsController.update.bind(tcsController));
router.put('/:id/status', tcsController.updateStatus.bind(tcsController));
router.delete('/:id', tcsController.delete.bind(tcsController));

export default router;
