"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Material Management Routes
const express_1 = require("express");
const material_controller_1 = require("../controllers/material.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.authenticateToken);
/**
 * @route   GET /api/materials/categories/hierarchy
 * @desc    Get category hierarchy (parents with children)
 * @access  Private (Authenticated users)
 */
router.get('/categories/hierarchy', material_controller_1.getCategoryHierarchy);
/**
 * @route   GET /api/materials/categories
 * @desc    Get all material categories (optionally filter by parentId)
 * @access  Private (Authenticated users)
 */
router.get('/categories', material_controller_1.getAllCategories);
/**
 * @route   POST /api/materials/categories
 * @desc    Create material category
 * @access  Private (Authenticated users)
 */
router.post('/categories', material_controller_1.createCategory);
/**
 * @route   POST /api/materials
 * @desc    Create new material
 * @access  Private (Authenticated users)
 */
router.post('/', material_controller_1.createMaterial);
/**
 * @route   GET /api/materials
 * @desc    Get all materials with pagination, search, and filters
 * @access  Private (Authenticated users)
 */
router.get('/', material_controller_1.getAllMaterials);
/**
 * @route   GET /api/materials/:id
 * @desc    Get material by ID
 * @access  Private (Authenticated users)
 */
router.get('/:id', material_controller_1.getMaterialById);
/**
 * @route   PUT /api/materials/:id
 * @desc    Update material
 * @access  Private (Authenticated users)
 */
router.put('/:id', material_controller_1.updateMaterial);
/**
 * @route   DELETE /api/materials/:id
 * @desc    Delete material (soft delete)
 * @access  Private (Authenticated users)
 */
router.delete('/:id', material_controller_1.deleteMaterial);
exports.default = router;
