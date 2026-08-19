/**
 * Job Work Order Routes
 * Unified routes for consolidated job work order operations
 *
 * These routes provide the new unified API surface for job work orders.
 * Legacy dyeing/printing routes remain for backward compatibility.
 */

import { Router } from 'express';
import { jobWorkOrderController } from '../controllers/job-work-order.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import {
  createJobWorkOrderSchema,
  addJwoComponentSchema,
  closeJwoSchema,
  issueJwoSchema,
  receiveJwoSchema,
  cancelJwoSchema,
  dispatchJwoSchema,
} from '../schemas/jobWorkOrder.schema';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Dashboard and reports (before /:id to avoid conflict)
router.get('/dashboard', jobWorkOrderController.getDashboard.bind(jobWorkOrderController));
router.get('/over-tolerance', jobWorkOrderController.getOverTolerance.bind(jobWorkOrderController));
router.get('/receivable', jobWorkOrderController.getReceivable.bind(jobWorkOrderController));
// Consolidated dispatch — one challan, many orders, one processor. BOTH must stay above
// '/:id', or Express reads "dispatch"/"dispatchable" as an order id.
router.get('/dispatchable', jobWorkOrderController.dispatchable.bind(jobWorkOrderController));
router.post('/dispatch', validateBody(dispatchJwoSchema), jobWorkOrderController.dispatch.bind(jobWorkOrderController));

// List, get, create (Consolidation Phase 3: generic create surface)
router.get('/', jobWorkOrderController.getAll.bind(jobWorkOrderController));
router.get('/:id', jobWorkOrderController.getById.bind(jobWorkOrderController));
router.post('/', validateBody(createJobWorkOrderSchema), jobWorkOrderController.create.bind(jobWorkOrderController));

// Components + reconciliation + close (Consolidation Phase 3b, service-rules.md §5)
router.post(
  '/:id/components',
  validateBody(addJwoComponentSchema),
  jobWorkOrderController.addComponent.bind(jobWorkOrderController)
);
router.delete('/:id/components/:componentId', jobWorkOrderController.removeComponent.bind(jobWorkOrderController));
router.get('/:id/reconciliation', jobWorkOrderController.getReconciliation.bind(jobWorkOrderController));
router.post('/:id/close', validateBody(closeJwoSchema), jobWorkOrderController.close.bind(jobWorkOrderController));

// Actions
// no-body — recompute is triggered by the POST alone; all inputs live on the order
router.post('/:id/compute-totals', jobWorkOrderController.computeTotals.bind(jobWorkOrderController));
// Read-only dry run of the issuance validation (blockers, expected greige, candidate lots)
router.get('/:id/issue-preview', jobWorkOrderController.issuePreview.bind(jobWorkOrderController));
router.post('/:id/issue', validateBody(issueJwoSchema), jobWorkOrderController.issue.bind(jobWorkOrderController));
router.post(
  '/:id/receive',
  validateBody(receiveJwoSchema),
  jobWorkOrderController.receive.bind(jobWorkOrderController)
);
// no-body — approver comes from the auth token, nothing read from the body
router.post('/:id/approve', jobWorkOrderController.approve.bind(jobWorkOrderController));
// Phase 5b: pre-receive cancellation (credits issued material back)
router.post('/:id/cancel', validateBody(cancelJwoSchema), jobWorkOrderController.cancel.bind(jobWorkOrderController));

export default router;
