"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentUser = exports.login = exports.register = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const database_1 = __importDefault(require("../config/database"));
const jwt_utils_1 = require("../utils/jwt.utils");
const logger_1 = require("../utils/logger");
/**
 * Register a new user
 */
const register = async (req, res) => {
    try {
        const { email, password, name, role } = req.body;
        // Validation
        if (!email || !password || !name) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'Email, password, and name are required',
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
        // Hash password
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        // Split name into firstName and lastName
        const nameParts = name.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || firstName;
        // Create user
        const user = await database_1.default.users.create({
            data: {
                email,
                password: hashedPassword,
                firstName,
                lastName,
                role: role || 'ADMIN', // Default to ADMIN for now
                isActive: true,
            },
        });
        // Generate JWT token
        const token = (0, jwt_utils_1.generateToken)({
            userId: user.id,
            email: user.email,
            role: user.role,
        });
        // Prepare response
        const response = {
            user: {
                id: user.id,
                email: user.email,
                name: `${user.firstName} ${user.lastName}`,
                role: user.role,
            },
            token,
        };
        res.status(201).json(response);
    }
    catch (error) {
        (0, logger_1.logError)('Registration error', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to register user',
        });
    }
};
exports.register = register;
/**
 * Login user
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        // Validation
        if (!email || !password) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'Email and password are required',
            });
            return;
        }
        // Find user
        const user = await database_1.default.users.findUnique({
            where: { email },
        });
        if (!user) {
            res.status(401).json({
                error: 'Authentication Failed',
                message: 'Invalid email or password',
            });
            return;
        }
        // Check if user is active
        if (!user.isActive) {
            res.status(403).json({
                error: 'Access Denied',
                message: 'Your account has been deactivated',
            });
            return;
        }
        // Verify password
        const isPasswordValid = await bcrypt_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            res.status(401).json({
                error: 'Authentication Failed',
                message: 'Invalid email or password',
            });
            return;
        }
        // Generate JWT token
        const token = (0, jwt_utils_1.generateToken)({
            userId: user.id,
            email: user.email,
            role: user.role,
        });
        // Prepare response
        const response = {
            user: {
                id: user.id,
                email: user.email,
                name: `${user.firstName} ${user.lastName}`,
                role: user.role,
            },
            token,
        };
        res.status(200).json(response);
    }
    catch (error) {
        (0, logger_1.logError)('Login error', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to login',
        });
    }
};
exports.login = login;
/**
 * Get current user (requires authentication)
 */
const getCurrentUser = async (req, res) => {
    try {
        // User is set by auth middleware
        if (!req.user) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required',
            });
            return;
        }
        // Fetch full user details
        const user = await database_1.default.users.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                department: true,
                phone: true,
                isActive: true,
                createdAt: true,
            },
        });
        if (!user) {
            res.status(404).json({
                error: 'Not Found',
                message: 'User not found',
            });
            return;
        }
        res.status(200).json(user);
    }
    catch (error) {
        (0, logger_1.logError)('Get current user error', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch user',
        });
    }
};
exports.getCurrentUser = getCurrentUser;
