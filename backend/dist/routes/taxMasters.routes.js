"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Tax Masters Routes
const express_1 = __importDefault(require("express"));
const taxMasters_controller_1 = require("../controllers/taxMasters.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_middleware_1.authenticateToken);
// Create new tax
router.post('/', taxMasters_controller_1.createTax);
// Get all taxes with pagination and filters
router.get('/', taxMasters_controller_1.getAllTaxes);
// Get applicable taxes for a specific date
router.get('/applicable', taxMasters_controller_1.getApplicableTaxes);
// Get tax by ID
router.get('/:id', taxMasters_controller_1.getTaxById);
// Update tax
router.put('/:id', taxMasters_controller_1.updateTax);
// Delete tax (soft delete)
router.delete('/:id', taxMasters_controller_1.deleteTax);
exports.default = router;
