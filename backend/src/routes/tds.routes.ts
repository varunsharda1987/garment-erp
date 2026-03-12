import { Router } from 'express';
import { tdsController } from '../controllers/tds.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

router.get('/summary', tdsController.getSummary.bind(tdsController));
router.get('/', tdsController.getAll.bind(tdsController));
router.get('/:id', tdsController.getById.bind(tdsController));
router.post('/', tdsController.create.bind(tdsController));
router.put('/:id', tdsController.update.bind(tdsController));
router.put('/:id/status', tdsController.updateStatus.bind(tdsController));
router.delete('/:id', tdsController.delete.bind(tdsController));

export default router;
