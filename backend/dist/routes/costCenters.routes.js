"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Cost Centers Routes
const express_1 = __importDefault(require("express"));
const costCenters_controller_1 = require("../controllers/costCenters.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_middleware_1.authenticateToken);
// Create new cost center
router.post('/', costCenters_controller_1.createCostCenter);
// Get all cost centers with pagination and filters
router.get('/', costCenters_controller_1.getAllCostCenters);
// Get cost center by ID
router.get('/:id', costCenters_controller_1.getCostCenterById);
// Update cost center
router.put('/:id', costCenters_controller_1.updateCostCenter);
// Delete cost center (soft delete)
router.delete('/:id', costCenters_controller_1.deleteCostCenter);
exports.default = router;
