"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStylesByStage = exports.getDashboardSummary = void 0;
const database_1 = __importDefault(require("../config/database"));
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
/**
 * Get dashboard summary with real production counts
 * GET /api/dashboard/summary
 */
const getDashboardSummary = async (req, res) => {
    try {
        // Count styles and pieces by production stage
        const stageCounts = await Promise.all([
            // Pre-Production
            database_1.default.style_production_tracking.aggregate({
                where: { currentStage: client_1.ProductionStage.ORDER_RECEIVED },
                _sum: { piecesInStage: true },
                _count: { id: true },
            }),
            database_1.default.style_production_tracking.aggregate({
                where: { currentStage: client_1.ProductionStage.PENDING_COSTING },
                _sum: { piecesInStage: true },
                _count: { id: true },
            }),
            database_1.default.style_production_tracking.aggregate({
                where: { currentStage: client_1.ProductionStage.PENDING_GREIGE_ORDER },
                _sum: { piecesInStage: true },
                _count: { id: true },
            }),
            database_1.default.style_production_tracking.aggregate({
                where: { currentStage: client_1.ProductionStage.TRIMS_NOT_ORDERED },
                _sum: { piecesInStage: true },
                _count: { id: true },
            }),
            // Processing
            database_1.default.style_production_tracking.aggregate({
                where: { currentStage: client_1.ProductionStage.IN_PRINTING },
                _sum: { piecesInStage: true },
                _count: { id: true },
            }),
            database_1.default.style_production_tracking.aggregate({
                where: { currentStage: client_1.ProductionStage.IN_DYING },
                _sum: { piecesInStage: true },
                _count: { id: true },
            }),
            database_1.default.style_production_tracking.aggregate({
                where: { currentStage: client_1.ProductionStage.IN_EMBROIDERY },
                _sum: { piecesInStage: true },
                _count: { id: true },
            }),
            database_1.default.style_production_tracking.aggregate({
                where: { currentStage: client_1.ProductionStage.IN_HANDWORK },
                _sum: { piecesInStage: true },
                _count: { id: true },
            }),
            // Production
            database_1.default.style_production_tracking.aggregate({
                where: { currentStage: client_1.ProductionStage.IN_CUTTING },
                _sum: { piecesInStage: true },
                _count: { id: true },
            }),
            database_1.default.style_production_tracking.aggregate({
                where: { currentStage: client_1.ProductionStage.IN_STITCHING },
                _sum: { piecesInStage: true },
                _count: { id: true },
            }),
            database_1.default.style_production_tracking.aggregate({
                where: { currentStage: client_1.ProductionStage.IN_FINISHING },
                _sum: { piecesInStage: true },
                _count: { id: true },
            }),
            database_1.default.style_production_tracking.aggregate({
                where: { currentStage: client_1.ProductionStage.READY_TO_SHIP },
                _sum: { piecesInStage: true },
                _count: { id: true },
            }),
        ]);
        const summary = {
            preProduction: {
                ordersReceived: {
                    styles: stageCounts[0]._count.id,
                    pieces: stageCounts[0]._sum.piecesInStage || 0
                },
                pendingCosting: {
                    styles: stageCounts[1]._count.id,
                    pieces: stageCounts[1]._sum.piecesInStage || 0
                },
                pendingGreige: {
                    styles: stageCounts[2]._count.id,
                    pieces: stageCounts[2]._sum.piecesInStage || 0
                },
                trimsNotOrdered: {
                    styles: stageCounts[3]._count.id,
                    pieces: stageCounts[3]._sum.piecesInStage || 0
                },
            },
            processing: {
                inPrinting: {
                    styles: stageCounts[4]._count.id,
                    pieces: stageCounts[4]._sum.piecesInStage || 0
                },
                inDying: {
                    styles: stageCounts[5]._count.id,
                    pieces: stageCounts[5]._sum.piecesInStage || 0
                },
                inEmbroidery: {
                    styles: stageCounts[6]._count.id,
                    pieces: stageCounts[6]._sum.piecesInStage || 0
                },
                inHandwork: {
                    styles: stageCounts[7]._count.id,
                    pieces: stageCounts[7]._sum.piecesInStage || 0
                },
            },
            production: {
                inCutting: {
                    styles: stageCounts[8]._count.id,
                    pieces: stageCounts[8]._sum.piecesInStage || 0
                },
                inStitching: {
                    styles: stageCounts[9]._count.id,
                    pieces: stageCounts[9]._sum.piecesInStage || 0
                },
                inFinishing: {
                    styles: stageCounts[10]._count.id,
                    pieces: stageCounts[10]._sum.piecesInStage || 0
                },
                readyToShip: {
                    styles: stageCounts[11]._count.id,
                    pieces: stageCounts[11]._sum.piecesInStage || 0
                },
            },
        };
        res.status(200).json({ data: summary });
    }
    catch (error) {
        (0, logger_1.logError)('Get dashboard summary error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch dashboard summary',
        });
    }
};
exports.getDashboardSummary = getDashboardSummary;
/**
 * Get styles in a specific production stage (for drill-down)
 * GET /api/dashboard/stage/:stage
 */
const getStylesByStage = async (req, res) => {
    try {
        const { stage } = req.params;
        // Validate stage
        if (!Object.values(client_1.ProductionStage).includes(stage)) {
            res.status(400).json({
                error: 'Validation Error',
                message: 'Invalid production stage',
            });
            return;
        }
        const trackingRecords = await database_1.default.style_production_tracking.findMany({
            where: {
                currentStage: stage,
                piecesInStage: { gt: 0 },
            },
            include: {
                styles: {
                    include: {
                        style_components: true,
                        style_processes: true,
                        style_costing: true,
                    },
                },
            },
        });
        const styles = trackingRecords.map(record => ({
            ...record.styles,
            productionInfo: {
                piecesInStage: record.piecesInStage,
                sizeName: record.sizeName,
                lastUpdated: record.lastUpdatedDate,
            },
        }));
        res.status(200).json({ data: styles });
    }
    catch (error) {
        (0, logger_1.logError)('Get styles by stage error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch styles',
        });
    }
};
exports.getStylesByStage = getStylesByStage;
