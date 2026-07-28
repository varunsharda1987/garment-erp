import { Router } from 'express';
import { customerContactController } from '../controllers/customerContact.controller';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateParams } from '../middleware/validation.middleware';
import { createCustomerContactSchema, updateCustomerContactSchema } from '../schemas/customerContact.schema';
import { authenticateToken } from '../middleware/auth.middleware';
import { idParamSchema } from '../schemas/common.schema';
import { z } from 'zod';

const router = Router();

// Apply authentication to all customer contact routes
router.use(authenticateToken);

// Customer ID param schema
const customerIdParamSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
});

// GET /api/customer-contacts/customer/:customerId - Get all contacts for a customer
router.get(
  '/customer/:customerId',
  validateParams(customerIdParamSchema),
  asyncHandler(customerContactController.getByCustomerId.bind(customerContactController))
);

// GET /api/customer-contacts/:id - Get contact by ID
router.get(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(customerContactController.getById.bind(customerContactController))
);

// POST /api/customer-contacts - Create new contact
router.post(
  '/',
  validateBody(createCustomerContactSchema),
  asyncHandler(customerContactController.create.bind(customerContactController))
);

// PUT /api/customer-contacts/:id - Update contact
router.put(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateCustomerContactSchema),
  asyncHandler(customerContactController.update.bind(customerContactController))
);

// PUT /api/customer-contacts/:id/set-primary - Set contact as primary
// no-body: flips isPrimary for the :id contact; takes no request body
router.put(
  '/:id/set-primary',
  validateParams(idParamSchema),
  asyncHandler(customerContactController.setPrimary.bind(customerContactController))
);

// DELETE /api/customer-contacts/:id - Delete contact
router.delete(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(customerContactController.delete.bind(customerContactController))
);

export default router;
