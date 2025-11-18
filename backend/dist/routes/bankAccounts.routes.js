"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Bank Accounts Routes
const express_1 = __importDefault(require("express"));
const bankAccounts_controller_1 = require("../controllers/bankAccounts.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_middleware_1.authenticateToken);
// Create new bank account
router.post('/', bankAccounts_controller_1.createBankAccount);
// Get all bank accounts with pagination and filters
router.get('/', bankAccounts_controller_1.getAllBankAccounts);
// Get bank account by ID
router.get('/:id', bankAccounts_controller_1.getBankAccountById);
// Update bank account
router.put('/:id', bankAccounts_controller_1.updateBankAccount);
// Delete bank account (soft delete)
router.delete('/:id', bankAccounts_controller_1.deleteBankAccount);
exports.default = router;
