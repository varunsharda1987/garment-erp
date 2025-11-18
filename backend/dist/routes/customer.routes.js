"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Customer Management routes
const express_1 = require("express");
const customer_controller_1 = require("../controllers/customer.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.authenticateToken);
/**
 * @route   POST /api/customers
 * @desc    Create new customer
 * @access  Protected - Admin, Sales
 */
router.post('/', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.SALES, client_1.UserRole.MERCHANDISER), customer_controller_1.createCustomer);
/**
 * @route   GET /api/customers
 * @desc    Get all customers (paginated, searchable, filterable)
 * @access  Protected - All authenticated users
 */
router.get('/', customer_controller_1.getAllCustomers);
/**
 * @route   GET /api/customers/:id
 * @desc    Get customer by ID
 * @access  Protected - All authenticated users
 */
router.get('/:id', customer_controller_1.getCustomerById);
/**
 * @route   PUT /api/customers/:id
 * @desc    Update customer
 * @access  Protected - Admin, Sales
 */
router.put('/:id', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN, client_1.UserRole.SALES, client_1.UserRole.MERCHANDISER), customer_controller_1.updateCustomer);
/**
 * @route   DELETE /api/customers/:id
 * @desc    Delete (deactivate) customer
 * @access  Protected - Admin only
 */
router.delete('/:id', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN), customer_controller_1.deleteCustomer);
exports.default = router;
