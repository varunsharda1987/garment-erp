// Expense Types Routes
import express from 'express';
import {
  createExpenseType,
  getAllExpenseTypes,
  getExpenseTypeById,
  updateExpenseType,
  deleteExpenseType,
} from '../controllers/expenseTypes.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
  createExpenseTypeSchema,
  updateExpenseTypeSchema,
  expenseTypeQuerySchema,
} from '../schemas/expenseTypes.schema';
import { idParamSchema } from '../schemas/common.schema';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new expense type
router.post('/', validateBody(createExpenseTypeSchema), asyncHandler(createExpenseType));

// Get all expense types with pagination and filters
router.get('/', validateQuery(expenseTypeQuerySchema), asyncHandler(getAllExpenseTypes));

// Get expense type by ID
router.get('/:id', validateParams(idParamSchema), asyncHandler(getExpenseTypeById));

// Update expense type
router.put(
  '/:id',
  validateParams(idParamSchema),
  validateBody(updateExpenseTypeSchema),
  asyncHandler(updateExpenseType)
);

// Delete expense type (soft delete)
router.delete('/:id', validateParams(idParamSchema), asyncHandler(deleteExpenseType));

export default router;
