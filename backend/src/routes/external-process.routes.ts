/**
 * External Process Routes
 * Routes for Smocking, Handwork, and Piece-Level Embroidery tracking
 */

import { Router } from 'express';
import { externalProcessController } from '../controllers/external-process.controller';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import { idParamSchema, workOrderIdParamSchema } from '../schemas/common.schema';
import {
  sendOutSchema,
  receiveSchema,
  cancelSendOutSchema,
  externalProcessQuerySchema,
} from '../schemas/externalProcess.schema';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication to all external process routes
router.use(authenticateToken);

// Dashboard and WIP (before parameterized routes)
router.get('/dashboard', externalProcessController.getDashboard.bind(externalProcessController));
router.get(
  '/wip/:workOrderId',
  validateParams(workOrderIdParamSchema),
  externalProcessController.getWipByWorkOrder.bind(externalProcessController)
);

// Send-out CRUD
router.get(
  '/send-outs',
  validateQuery(externalProcessQuerySchema),
  externalProcessController.getSendOuts.bind(externalProcessController)
);
router.get(
  '/send-outs/:id',
  validateParams(idParamSchema),
  externalProcessController.getSendOutById.bind(externalProcessController)
);
router.post(
  '/send-out',
  validateBody(sendOutSchema),
  externalProcessController.sendOut.bind(externalProcessController)
);
router.post('/receive', validateBody(receiveSchema), externalProcessController.receive.bind(externalProcessController));
router.post(
  '/send-outs/:id/cancel',
  validateParams(idParamSchema),
  validateBody(cancelSendOutSchema),
  externalProcessController.cancelSendOut.bind(externalProcessController)
);

export default router;
