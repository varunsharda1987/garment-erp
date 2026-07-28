import { Router } from 'express';
import { customerAddressController } from '../controllers/customerAddress.controller';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateParams } from '../middleware/validation.middleware';
import { createCustomerAddressSchema, updateCustomerAddressSchema } from '../schemas/customerAddress.schema';
import { authenticateToken } from '../middleware/auth.middleware';
import { idParamSchema } from '../schemas/common.schema';
import { z } from 'zod';

const router = Router();

// Apply authentication to all customer address routes
router.use(authenticateToken);

// Customer ID param schema
const customerIdParamSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
});

// Customer ID + Type param schema
const customerIdTypeParamSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  type: z.enum(['SHIP_TO', 'COURIER', 'OFFICE']),
});

// GET /api/customer-addresses/customer/:customerId - Get all addresses for a customer
router.get(
  '/customer/:customerId',
  validateParams(customerIdParamSchema),
  asyncHandler(customerAddressController.getByCustomerId.bind(customerAddressController))
);

// GET /api/customer-addresses/customer/:customerId/:type - Get addresses by type
router.get(
  '/customer/:customerId/:type',
  validateParams(customerIdTypeParamSchema),
  asyncHandler(customerAddressController.getByType.bind(customerAddressController))
);

// GET /api/customer-addresses/:id - Get address by ID
router.get(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(customerAddressController.getById.bind(customerAddressController))
);

// GET /api/customer-addresses/:id/formatted - Get formatted address for copying
router.get(
  '/:id/formatted',
  validateParams(idParamSchema),
  asyncHandler(customerAddressController.getFormatted.bind(customerAddressController))
);

// POST /api/customer-addresses - Create new address
router.post(
  '/',
  validateBody(createCustomerAddressSchema),
  asyncHandler(customerAddressController.create.bind(customerAddressController))
);

// PUT /api/customer-addresses/:id - Update address
router.put(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateCustomerAddressSchema),
  asyncHandler(customerAddressController.update.bind(customerAddressController))
);

// PUT /api/customer-addresses/:id/set-primary - Set address as primary
// no-body: flips isPrimary for the :id address; takes no request body
router.put(
  '/:id/set-primary',
  validateParams(idParamSchema),
  asyncHandler(customerAddressController.setPrimary.bind(customerAddressController))
);

// DELETE /api/customer-addresses/:id - Delete address
router.delete(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(customerAddressController.delete.bind(customerAddressController))
);

export default router;
