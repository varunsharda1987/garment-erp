"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProcess = exports.updateProcess = exports.createProcess = exports.deleteAccessory = exports.updateAccessory = exports.createAccessory = exports.deleteFabric = exports.updateFabric = exports.createFabric = exports.deleteComponent = exports.updateComponent = exports.createComponent = void 0;
const database_1 = __importDefault(require("../config/database"));
/**
 * Create component for a style
 * POST /api/styles/:styleId/components
 */
const createComponent = async (req, res) => {
    try {
        const { styleId } = req.params;
        const { componentName, componentType, sortOrder } = req.body;
        if (!componentName || !componentType) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'componentName and componentType are required',
            });
            return;
        }
        const component = await database_1.default.style_components.create({
            data: {
                styleId,
                componentName,
                componentType,
                sortOrder: sortOrder || 0,
            },
            include: {
                style_fabrics: true,
                style_accessories: true,
            },
        });
        res.status(201).json({
            data: component,
            message: 'Component created successfully',
        });
    }
    catch (error) {
        console.error('Create component error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create component',
        });
    }
};
exports.createComponent = createComponent;
/**
 * Update component
 * PUT /api/components/:id
 */
const updateComponent = async (req, res) => {
    try {
        const { id } = req.params;
        const { componentName, componentType, sortOrder } = req.body;
        const component = await database_1.default.style_components.update({
            where: { id },
            data: {
                componentName,
                componentType,
                sortOrder,
            },
            include: {
                style_fabrics: true,
                style_accessories: true,
            },
        });
        res.status(200).json({
            data: component,
            message: 'Component updated successfully',
        });
    }
    catch (error) {
        console.error('Update component error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update component',
        });
    }
};
exports.updateComponent = updateComponent;
/**
 * Delete component
 * DELETE /api/components/:id
 */
const deleteComponent = async (req, res) => {
    try {
        const { id } = req.params;
        await database_1.default.style_components.delete({
            where: { id },
        });
        res.status(200).json({
            message: 'Component deleted successfully',
        });
    }
    catch (error) {
        console.error('Delete component error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete component',
        });
    }
};
exports.deleteComponent = deleteComponent;
/**
 * Create fabric for a component
 * POST /api/components/:componentId/fabrics
 */
const createFabric = async (req, res) => {
    try {
        const { componentId } = req.params;
        const { fabricName, fabricType, fabricColor, fabricGSM, fabricWidth, cadAverageMeters, cadAverageYards, supplierName, unitPrice, } = req.body;
        if (!fabricName || !fabricType) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'fabricName and fabricType are required',
            });
            return;
        }
        const fabric = await database_1.default.style_fabrics.create({
            data: {
                componentId,
                fabricName,
                fabricType,
                fabricColor,
                fabricGSM,
                fabricWidth,
                cadAverageMeters,
                cadAverageYards,
                supplierName,
                unitPrice,
            },
        });
        res.status(201).json({
            data: fabric,
            message: 'Fabric created successfully',
        });
    }
    catch (error) {
        console.error('Create fabric error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create fabric',
        });
    }
};
exports.createFabric = createFabric;
/**
 * Update fabric (including CAD averages)
 * PUT /api/fabrics/:id
 */
const updateFabric = async (req, res) => {
    try {
        const { id } = req.params;
        const { fabricName, fabricType, fabricColor, fabricGSM, fabricWidth, cadAverageMeters, cadAverageYards, supplierName, unitPrice, } = req.body;
        const fabric = await database_1.default.style_fabrics.update({
            where: { id },
            data: {
                fabricName,
                fabricType,
                fabricColor,
                fabricGSM,
                fabricWidth,
                cadAverageMeters,
                cadAverageYards,
                supplierName,
                unitPrice,
            },
        });
        res.status(200).json({
            data: fabric,
            message: 'Fabric updated successfully',
        });
    }
    catch (error) {
        console.error('Update fabric error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update fabric',
        });
    }
};
exports.updateFabric = updateFabric;
/**
 * Delete fabric
 * DELETE /api/fabrics/:id
 */
const deleteFabric = async (req, res) => {
    try {
        const { id } = req.params;
        await database_1.default.style_fabrics.delete({
            where: { id },
        });
        res.status(200).json({
            message: 'Fabric deleted successfully',
        });
    }
    catch (error) {
        console.error('Delete fabric error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete fabric',
        });
    }
};
exports.deleteFabric = deleteFabric;
/**
 * Create accessory for a component
 * POST /api/components/:componentId/accessories
 */
const createAccessory = async (req, res) => {
    try {
        const { componentId } = req.params;
        const { accessoryName, accessoryType, quantityPerPiece, unit, supplierName, unitPrice, } = req.body;
        if (!accessoryName || !accessoryType || !quantityPerPiece || !unit) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'accessoryName, accessoryType, quantityPerPiece, and unit are required',
            });
            return;
        }
        const accessory = await database_1.default.style_accessories.create({
            data: {
                componentId,
                accessoryName,
                accessoryType,
                quantityPerPiece,
                unit,
                supplierName,
                unitPrice,
            },
        });
        res.status(201).json({
            data: accessory,
            message: 'Accessory created successfully',
        });
    }
    catch (error) {
        console.error('Create accessory error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create accessory',
        });
    }
};
exports.createAccessory = createAccessory;
/**
 * Update accessory
 * PUT /api/accessories/:id
 */
const updateAccessory = async (req, res) => {
    try {
        const { id } = req.params;
        const { accessoryName, accessoryType, quantityPerPiece, unit, supplierName, unitPrice, } = req.body;
        const accessory = await database_1.default.style_accessories.update({
            where: { id },
            data: {
                accessoryName,
                accessoryType,
                quantityPerPiece,
                unit,
                supplierName,
                unitPrice,
            },
        });
        res.status(200).json({
            data: accessory,
            message: 'Accessory updated successfully',
        });
    }
    catch (error) {
        console.error('Update accessory error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update accessory',
        });
    }
};
exports.updateAccessory = updateAccessory;
/**
 * Delete accessory
 * DELETE /api/accessories/:id
 */
const deleteAccessory = async (req, res) => {
    try {
        const { id } = req.params;
        await database_1.default.style_accessories.delete({
            where: { id },
        });
        res.status(200).json({
            message: 'Accessory deleted successfully',
        });
    }
    catch (error) {
        console.error('Delete accessory error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete accessory',
        });
    }
};
exports.deleteAccessory = deleteAccessory;
/**
 * Create process for a style
 * POST /api/styles/:styleId/processes
 */
const createProcess = async (req, res) => {
    try {
        const { styleId } = req.params;
        const { processName, processType, isRequired, sortOrder, vendorName, estimatedCost, estimatedDays, notes, } = req.body;
        if (!processName) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'processName is required',
            });
            return;
        }
        const process = await database_1.default.style_processes.create({
            data: {
                styleId,
                processName,
                processType: processType || processName,
                isRequired: isRequired !== false,
                sortOrder: sortOrder || 0,
                vendorName,
                estimatedCost,
                estimatedDays,
                notes,
            },
        });
        res.status(201).json({
            data: process,
            message: 'Process created successfully',
        });
    }
    catch (error) {
        console.error('Create process error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create process',
        });
    }
};
exports.createProcess = createProcess;
/**
 * Update process
 * PUT /api/processes/:id
 */
const updateProcess = async (req, res) => {
    try {
        const { id } = req.params;
        const { processName, processType, isRequired, sortOrder, vendorName, estimatedCost, estimatedDays, notes, } = req.body;
        const process = await database_1.default.style_processes.update({
            where: { id },
            data: {
                processName,
                processType,
                isRequired,
                sortOrder,
                vendorName,
                estimatedCost,
                estimatedDays,
                notes,
            },
        });
        res.status(200).json({
            data: process,
            message: 'Process updated successfully',
        });
    }
    catch (error) {
        console.error('Update process error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update process',
        });
    }
};
exports.updateProcess = updateProcess;
/**
 * Delete process
 * DELETE /api/processes/:id
 */
const deleteProcess = async (req, res) => {
    try {
        const { id } = req.params;
        await database_1.default.style_processes.delete({
            where: { id },
        });
        res.status(200).json({
            message: 'Process deleted successfully',
        });
    }
    catch (error) {
        console.error('Delete process error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete process',
        });
    }
};
exports.deleteProcess = deleteProcess;
