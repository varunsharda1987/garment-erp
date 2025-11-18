"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCostCenter = exports.updateCostCenter = exports.getCostCenterById = exports.getAllCostCenters = exports.createCostCenter = void 0;
const database_1 = __importDefault(require("../config/database"));
const createCostCenter = async (req, res) => {
    try {
        const { costCenterCode, costCenterName, costCenterType, departmentId, locationId, budgetAmount, description } = req.body;
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
            return;
        }
        const existing = await database_1.default.cost_centers.findUnique({ where: { costCenterCode } });
        if (existing) {
            res.status(400).json({ error: 'Validation Error', message: 'Cost center code already exists' });
            return;
        }
        const costCenter = await database_1.default.cost_centers.create({
            data: {
                costCenterCode,
                costCenterName,
                costCenterType,
                departmentId: departmentId || null,
                locationId: locationId || null,
                budgetAmount: budgetAmount ? parseFloat(budgetAmount) : null,
                description: description || null,
                isActive: true,
                createdById: userId,
            },
            include: {
                locations: { select: { id: true, locationCode: true, locationName: true } },
                users: { select: { id: true, firstName: true, lastName: true } },
            },
        });
        res.status(201).json({ data: costCenter, message: 'Cost center created successfully' });
    }
    catch (error) {
        console.error('Create cost center error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create cost center' });
    }
};
exports.createCostCenter = createCostCenter;
const getAllCostCenters = async (req, res) => {
    try {
        const { page = '1', limit = '20', search = '', costCenterType, locationId } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        const where = { isActive: true };
        if (search) {
            where.OR = [
                { costCenterCode: { contains: search, mode: 'insensitive' } },
                { costCenterName: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (costCenterType)
            where.costCenterType = costCenterType;
        if (locationId)
            where.locationId = locationId;
        const [costCenters, total] = await Promise.all([
            database_1.default.cost_centers.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { costCenterCode: 'asc' },
                include: {
                    locations: { select: { id: true, locationCode: true, locationName: true } },
                },
            }),
            database_1.default.cost_centers.count({ where }),
        ]);
        res.json({ data: costCenters, pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) } });
    }
    catch (error) {
        console.error('Get cost centers error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch cost centers' });
    }
};
exports.getAllCostCenters = getAllCostCenters;
const getCostCenterById = async (req, res) => {
    try {
        const { id } = req.params;
        const costCenter = await database_1.default.cost_centers.findUnique({
            where: { id },
            include: {
                locations: true,
                users: { select: { id: true, firstName: true, lastName: true, email: true } },
            },
        });
        if (!costCenter) {
            res.status(404).json({ error: 'Not Found', message: 'Cost center not found' });
            return;
        }
        res.json({ data: costCenter });
    }
    catch (error) {
        console.error('Get cost center error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch cost center' });
    }
};
exports.getCostCenterById = getCostCenterById;
const updateCostCenter = async (req, res) => {
    try {
        const { id } = req.params;
        const { costCenterCode, costCenterName, costCenterType, departmentId, locationId, budgetAmount, description } = req.body;
        const existing = await database_1.default.cost_centers.findUnique({ where: { id } });
        if (!existing) {
            res.status(404).json({ error: 'Not Found', message: 'Cost center not found' });
            return;
        }
        if (costCenterCode !== existing.costCenterCode) {
            const codeExists = await database_1.default.cost_centers.findUnique({ where: { costCenterCode } });
            if (codeExists) {
                res.status(400).json({ error: 'Validation Error', message: 'Cost center code already exists' });
                return;
            }
        }
        const costCenter = await database_1.default.cost_centers.update({
            where: { id },
            data: {
                costCenterCode,
                costCenterName,
                costCenterType,
                departmentId: departmentId || null,
                locationId: locationId || null,
                budgetAmount: budgetAmount ? parseFloat(budgetAmount) : null,
                description: description || null,
            },
            include: { locations: true },
        });
        res.json({ data: costCenter, message: 'Cost center updated successfully' });
    }
    catch (error) {
        console.error('Update cost center error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update cost center' });
    }
};
exports.updateCostCenter = updateCostCenter;
const deleteCostCenter = async (req, res) => {
    try {
        const { id } = req.params;
        const costCenter = await database_1.default.cost_centers.findUnique({ where: { id } });
        if (!costCenter) {
            res.status(404).json({ error: 'Not Found', message: 'Cost center not found' });
            return;
        }
        await database_1.default.cost_centers.update({ where: { id }, data: { isActive: false } });
        res.json({ message: 'Cost center deleted successfully' });
    }
    catch (error) {
        console.error('Delete cost center error:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete cost center' });
    }
};
exports.deleteCostCenter = deleteCostCenter;
