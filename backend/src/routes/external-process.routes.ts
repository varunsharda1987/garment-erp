/**
 * External Process Routes
 * Routes for Smocking, Handwork, and Piece-Level Embroidery tracking
 */

import { Router } from 'express';
import { externalProcessController } from '../controllers/external-process.controller';

const router = Router();

// Dashboard and WIP (before parameterized routes)
router.get('/dashboard', externalProcessController.getDashboard.bind(externalProcessController));
router.get('/wip/:workOrderId', externalProcessController.getWipByWorkOrder.bind(externalProcessController));

// Send-out CRUD
router.get('/send-outs', externalProcessController.getSendOuts.bind(externalProcessController));
router.get('/send-outs/:id', externalProcessController.getSendOutById.bind(externalProcessController));
router.post('/send-out', externalProcessController.sendOut.bind(externalProcessController));
router.post('/receive', externalProcessController.receive.bind(externalProcessController));
router.post('/send-outs/:id/cancel', externalProcessController.cancelSendOut.bind(externalProcessController));

export default router;
