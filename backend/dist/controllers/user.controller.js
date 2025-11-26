"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUserRole = exports.updateUser = exports.createUser = exports.getUserById = exports.getAllUsers = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const database_1 = __importDefault(require("../config/database"));
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
/**
 * Get all users (paginated)
 * GET /api/users
 */
const getAllUsers = async (req, res) => {
    try {
        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search;
        // Build search filter
        const whereClause = {};
        if (search) {
            whereClause.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }
        // Get total count
        const totalUsers = await database_1.default.users.count({ where: whereClause });
        // Get users (exclude password)
        const users = await database_1.default.users.findMany({
            where: whereClause,
            skip,
            take: limit,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                department: true,
                isActive: true,
                lastLogin: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        res.status(200).json({
            data: users,
            pagination: {
                page,
                limit,
                total: totalUsers,
                totalPages: Math.ceil(totalUsers / limit),
            },
        });
    }
    catch (error) {
        (0, logger_1.logError)('Get all users error', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch users',
        });
    }
};
exports.getAllUsers = getAllUsers;
/**
 * Get user by ID
 * GET /api/users/:id
 */
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await database_1.default.users.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                department: true,
                isActive: true,
                lastLogin: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        if (!user) {
            res.status(404).json({
                error: 'Not Found',
                message: 'User not found',
            });
            return;
        }
        res.status(200).json({ data: user });
    }
    catch (error) {
        (0, logger_1.logError)('Get user by ID error', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch user',
        });
    }
};
exports.getUserById = getUserById;
/**
 * Create new user (Admin only)
 * POST /api/users
 */
const createUser = async (req, res) => {
    try {
        const { email, password, firstName, lastName, phone, role, department } = req.body;
        // Validation
        if (!email || !password || !firstName || !lastName) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'Email, password, firstName, and lastName are required',
            });
            return;
        }
        // Check if user already exists
        const existingUser = await database_1.default.users.findUnique({
            where: { email },
        });
        if (existingUser) {
            res.status(409).json({
                error: 'Conflict',
                message: 'User with this email already exists',
            });
            return;
        }
        // Validate role if provided
        if (role && !Object.values(client_1.UserRole).includes(role)) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'Invalid role specified',
            });
            return;
        }
        // Hash password
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        // Create user
        const user = await database_1.default.users.create({
            data: {
                email,
                password: hashedPassword,
                firstName,
                lastName,
                phone: phone || null,
                role: role || client_1.UserRole.SALES, // Default role
                department: department || null,
                isActive: true,
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                department: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({
            data: user,
            message: 'User created successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Create user error', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create user',
        });
    }
};
exports.createUser = createUser;
/**
 * Update user
 * PUT /api/users/:id
 */
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { email, firstName, lastName, phone, department, password, isActive } = req.body;
        // Check if user exists
        const existingUser = await database_1.default.users.findUnique({
            where: { id },
        });
        if (!existingUser) {
            res.status(404).json({
                error: 'Not Found',
                message: 'User not found',
            });
            return;
        }
        // Authorization check: Users can only update themselves unless they're ADMIN
        if (req.user?.userId !== id && req.user?.role !== client_1.UserRole.ADMIN) {
            res.status(403).json({
                error: 'Forbidden',
                message: 'You can only update your own profile',
            });
            return;
        }
        // If email is being changed, check if new email is available
        if (email && email !== existingUser.email) {
            const emailTaken = await database_1.default.users.findUnique({
                where: { email },
            });
            if (emailTaken) {
                res.status(409).json({
                    error: 'Conflict',
                    message: 'Email already in use',
                });
                return;
            }
        }
        // Prepare update data
        const updateData = {
            ...(email && { email }),
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(phone !== undefined && { phone: phone || null }),
            ...(department !== undefined && { department: department || null }),
        };
        // Only admins can update isActive status
        if (isActive !== undefined && req.user?.role === client_1.UserRole.ADMIN) {
            updateData.isActive = isActive;
        }
        // Hash new password if provided
        if (password) {
            updateData.password = await bcrypt_1.default.hash(password, 10);
        }
        // Update user
        const updatedUser = await database_1.default.users.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                department: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(200).json({
            data: updatedUser,
            message: 'User updated successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Update user error', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update user',
        });
    }
};
exports.updateUser = updateUser;
/**
 * Update user role (Admin only)
 * PUT /api/users/:id/role
 */
const updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        // Validation
        if (!role || !Object.values(client_1.UserRole).includes(role)) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'Valid role is required',
            });
            return;
        }
        // Check if user exists
        const existingUser = await database_1.default.users.findUnique({
            where: { id },
        });
        if (!existingUser) {
            res.status(404).json({
                error: 'Not Found',
                message: 'User not found',
            });
            return;
        }
        // Update role
        const updatedUser = await database_1.default.users.update({
            where: { id },
            data: { role },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                department: true,
                isActive: true,
                updatedAt: true,
            },
        });
        res.status(200).json({
            data: updatedUser,
            message: 'User role updated successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Update user role error', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update user role',
        });
    }
};
exports.updateUserRole = updateUserRole;
/**
 * Delete user (Admin only)
 * DELETE /api/users/:id
 */
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        // Check if user exists
        const existingUser = await database_1.default.users.findUnique({
            where: { id },
        });
        if (!existingUser) {
            res.status(404).json({
                error: 'Not Found',
                message: 'User not found',
            });
            return;
        }
        // Prevent self-deletion
        if (req.user?.userId === id) {
            res.status(400).json({
                error: 'Bad Request',
                message: 'You cannot delete your own account',
            });
            return;
        }
        // Instead of hard delete, we'll deactivate the user
        // This is better for data integrity and audit trails
        await database_1.default.users.update({
            where: { id },
            data: { isActive: false },
        });
        res.status(200).json({
            message: 'User deactivated successfully',
        });
    }
    catch (error) {
        (0, logger_1.logError)('Delete user error', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete user',
        });
    }
};
exports.deleteUser = deleteUser;
