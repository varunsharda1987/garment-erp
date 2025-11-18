"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// User management routes
const express_1 = require("express");
const user_controller_1 = require("../controllers/user.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.authenticateToken);
/**
 * @route   GET /api/users
 * @desc    Get all users (paginated)
 * @access  Protected - All authenticated users
 */
router.get('/', user_controller_1.getAllUsers);
/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Protected - All authenticated users
 */
router.get('/:id', user_controller_1.getUserById);
/**
 * @route   POST /api/users
 * @desc    Create new user
 * @access  Protected - Admin only
 */
router.post('/', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN), user_controller_1.createUser);
/**
 * @route   PUT /api/users/:id
 * @desc    Update user (users can update themselves, admins can update anyone)
 * @access  Protected - Self or Admin
 */
router.put('/:id', user_controller_1.updateUser);
/**
 * @route   PUT /api/users/:id/role
 * @desc    Update user role
 * @access  Protected - Admin only
 */
router.put('/:id/role', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN), user_controller_1.updateUserRole);
/**
 * @route   DELETE /api/users/:id
 * @desc    Delete (deactivate) user
 * @access  Protected - Admin only
 */
router.delete('/:id', (0, auth_middleware_1.authorize)(client_1.UserRole.ADMIN), user_controller_1.deleteUser);
exports.default = router;
