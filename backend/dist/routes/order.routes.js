"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Order Management Routes
const express_1 = require("express");
const order_controller_1 = require("../controllers/order.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.authenticateToken);
// Statistics routes (must be before /:id to avoid conflict)
router.get('/statistics/by-customer', order_controller_1.getOrderStatisticsByCustomer);
// Order CRUD routes
router.post('/', order_controller_1.createOrder);
router.get('/', order_controller_1.getAllOrders);
router.get('/:id', order_controller_1.getOrderById);
router.put('/:id', order_controller_1.updateOrder);
router.patch('/:id/status', order_controller_1.updateOrderStatus);
router.delete('/:id', order_controller_1.deleteOrder);
exports.default = router;
