"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Payment Terms Routes
const express_1 = __importDefault(require("express"));
const paymentTerms_controller_1 = require("../controllers/paymentTerms.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_middleware_1.authenticateToken);
// Create new payment term
router.post('/', paymentTerms_controller_1.createPaymentTerm);
// Get all payment terms with pagination and filters
router.get('/', paymentTerms_controller_1.getAllPaymentTerms);
// Get payment term by ID
router.get('/:id', paymentTerms_controller_1.getPaymentTermById);
// Update payment term
router.put('/:id', paymentTerms_controller_1.updatePaymentTerm);
// Delete payment term (soft delete)
router.delete('/:id', paymentTerms_controller_1.deletePaymentTerm);
exports.default = router;
