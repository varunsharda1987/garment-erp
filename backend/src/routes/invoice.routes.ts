// Invoice Management routes
import { Router } from 'express';
import {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  recordPayment,
  getInvoiceSummary,
  updateOverdueInvoices,
} from '../controllers/invoice.controller';
import { authenticateToken, authorize } from '../middleware/auth.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  recordPaymentSchema,
  invoiceQuerySchema,
  invoiceIdParamSchema,
} from '../schemas/invoice.schema';
import { UserRole } from '@prisma/client';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/invoices/summary
 * @desc    Get invoice summary statistics
 * @access  Protected - All authenticated users
 */
router.get('/summary', asyncHandler(getInvoiceSummary));

/**
 * @route   POST /api/invoices/update-overdue
 * @desc    Update overdue invoices status
 * @access  Protected - Admin only
 */
router.post('/update-overdue', authorize(UserRole.ADMIN), asyncHandler(updateOverdueInvoices));

/**
 * @route   POST /api/invoices
 * @desc    Create new invoice
 * @access  Protected - Admin, Accountant
 */
router.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTS),
  validateBody(createInvoiceSchema),
  asyncHandler(createInvoice)
);

/**
 * @route   GET /api/invoices
 * @desc    Get all invoices (paginated, searchable, filterable)
 * @access  Protected - All authenticated users
 */
router.get('/', validateQuery(invoiceQuerySchema), asyncHandler(getAllInvoices));

/**
 * @route   GET /api/invoices/:id
 * @desc    Get invoice by ID
 * @access  Protected - All authenticated users
 */
router.get('/:id', validateParams(invoiceIdParamSchema), asyncHandler(getInvoiceById));

/**
 * @route   PUT /api/invoices/:id
 * @desc    Update invoice
 * @access  Protected - Admin, Accountant
 */
router.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTS),
  validateParams(invoiceIdParamSchema),
  validateBody(updateInvoiceSchema),
  asyncHandler(updateInvoice)
);

/**
 * @route   DELETE /api/invoices/:id
 * @desc    Delete invoice
 * @access  Protected - Admin only
 */
router.delete('/:id', authorize(UserRole.ADMIN), validateParams(invoiceIdParamSchema), asyncHandler(deleteInvoice));

/**
 * @route   POST /api/invoices/:id/payments
 * @desc    Record payment for invoice
 * @access  Protected - Admin, Accountant
 */
router.post(
  '/:id/payments',
  authorize(UserRole.ADMIN, UserRole.ACCOUNTS),
  validateParams(invoiceIdParamSchema),
  validateBody(recordPaymentSchema),
  asyncHandler(recordPayment)
);

export default router;
