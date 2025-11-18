"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticateToken = void 0;
const jwt_utils_1 = require("../utils/jwt.utils");
/**
 * Middleware to verify JWT token
 */
const authenticateToken = (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        if (!token) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication token required',
            });
            return;
        }
        // Verify token
        const decoded = (0, jwt_utils_1.verifyToken)(token);
        // Attach user to request
        req.user = decoded;
        next();
    }
    catch (error) {
        res.status(403).json({
            error: 'Forbidden',
            message: 'Invalid or expired token',
        });
    }
};
exports.authenticateToken = authenticateToken;
/**
 * Middleware to check if user has required role
 */
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required',
            });
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({
                error: 'Forbidden',
                message: 'You do not have permission to access this resource',
            });
            return;
        }
        next();
    };
};
exports.authorize = authorize;
