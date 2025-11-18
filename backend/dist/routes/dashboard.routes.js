"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Dashboard routes
const express_1 = require("express");
const dashboard_controller_1 = require("../controllers/dashboard.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.authenticateToken);
/**
 * @route   GET /api/dashboard/summary
 * @desc    Get dashboard summary with counts per stage
 * @access  Protected - All authenticated users
 */
router.get('/summary', dashboard_controller_1.getDashboardSummary);
/**
 * @route   GET /api/dashboard/stage/:stage
 * @desc    Get styles in a specific production stage (for drill-down)
 * @access  Protected - All authenticated users
 */
router.get('/stage/:stage', dashboard_controller_1.getStylesByStage);
exports.default = router;
