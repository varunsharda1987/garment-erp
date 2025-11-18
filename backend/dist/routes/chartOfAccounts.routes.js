"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Chart of Accounts Routes
const express_1 = __importDefault(require("express"));
const chartOfAccounts_controller_1 = require("../controllers/chartOfAccounts.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_middleware_1.authenticateToken);
// Create new account
router.post('/', chartOfAccounts_controller_1.createAccount);
// Get all accounts with pagination and filters
router.get('/', chartOfAccounts_controller_1.getAllAccounts);
// Get account hierarchy (tree structure)
router.get('/hierarchy', chartOfAccounts_controller_1.getAccountHierarchy);
// Get account by ID
router.get('/:id', chartOfAccounts_controller_1.getAccountById);
// Update account
router.put('/:id', chartOfAccounts_controller_1.updateAccount);
// Delete account (soft delete)
router.delete('/:id', chartOfAccounts_controller_1.deleteAccount);
exports.default = router;
