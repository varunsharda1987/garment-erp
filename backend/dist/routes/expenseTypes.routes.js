"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Expense Types Routes
const express_1 = __importDefault(require("express"));
const expenseTypes_controller_1 = require("../controllers/expenseTypes.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_middleware_1.authenticateToken);
// Create new expense type
router.post('/', expenseTypes_controller_1.createExpenseType);
// Get all expense types with pagination and filters
router.get('/', expenseTypes_controller_1.getAllExpenseTypes);
// Get expense type by ID
router.get('/:id', expenseTypes_controller_1.getExpenseTypeById);
// Update expense type
router.put('/:id', expenseTypes_controller_1.updateExpenseType);
// Delete expense type (soft delete)
router.delete('/:id', expenseTypes_controller_1.deleteExpenseType);
exports.default = router;
