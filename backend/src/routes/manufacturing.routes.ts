import { Router } from 'express';
import { manufacturingController } from '../controllers/manufacturing.controller';

const router = Router();

// GET /manufacturing/alerts - Get manufacturing alerts and vendor summary
router.get('/alerts', manufacturingController.getAlerts.bind(manufacturingController));

export default router;
