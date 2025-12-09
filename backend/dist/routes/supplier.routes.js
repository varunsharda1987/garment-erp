"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Supplier Management Routes
const express_1 = require("express");
const supplier_controller_1 = require("../controllers/supplier.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const supplier_schema_1 = require("../schemas/supplier.schema");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.authenticateToken);
/**
 * @route   POST /api/suppliers
 * @desc    Create new supplier
 * @access  Private (Authenticated users)
 */
router.post('/', (0, validation_middleware_1.validateBody)(supplier_schema_1.createSupplierSchema), supplier_controller_1.createSupplier);
/**
 * @route   GET /api/suppliers
 * @desc    Get all suppliers with pagination, search, and filters
 * @access  Private (Authenticated users)
 */
router.get('/', (0, validation_middleware_1.validateQuery)(supplier_schema_1.supplierQuerySchema), supplier_controller_1.getAllSuppliers);
/**
 * @route   GET /api/suppliers/:id
 * @desc    Get supplier by ID
 * @access  Private (Authenticated users)
 */
router.get('/:id', (0, validation_middleware_1.validateParams)(supplier_schema_1.supplierIdParamSchema), supplier_controller_1.getSupplierById);
/**
 * @route   PUT /api/suppliers/:id
 * @desc    Update supplier
 * @access  Private (Authenticated users)
 */
router.put('/:id', (0, validation_middleware_1.validateParams)(supplier_schema_1.supplierIdParamSchema), (0, validation_middleware_1.validateBody)(supplier_schema_1.updateSupplierSchema), supplier_controller_1.updateSupplier);
/**
 * @route   DELETE /api/suppliers/:id
 * @desc    Delete supplier (soft delete)
 * @access  Private (Authenticated users)
 */
router.delete('/:id', (0, validation_middleware_1.validateParams)(supplier_schema_1.supplierIdParamSchema), supplier_controller_1.deleteSupplier);
exports.default = router;
