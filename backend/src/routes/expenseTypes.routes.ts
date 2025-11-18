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

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Create new expense type
router.post('/', createExpenseType);

// Get all expense types with pagination and filters
router.get('/', getAllExpenseTypes);

// Get expense type by ID
router.get('/:id', getExpenseTypeById);

// Update expense type
router.put('/:id', updateExpenseType);

// Delete expense type (soft delete)
router.delete('/:id', deleteExpenseType);

export default router;
