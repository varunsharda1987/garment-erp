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
        // Single query to get counts for all stages using groupBy
        const stageCounts = await database_1.default.style_production_tracking.groupBy({
            by: ['currentStage'],
            _sum: { piecesInStage: true },
            _count: { id: true },
        });
        // Create a map for easy lookup
        const stageMap = new Map();
        for (const stage of stageCounts) {
            stageMap.set(stage.currentStage, {
                styles: stage._count.id,
                pieces: stage._sum.piecesInStage || 0,
            });
        }
        // Helper to get stage data with defaults
        const getStageData = (stage) => stageMap.get(stage) || { styles: 0, pieces: 0 };
        const summary = {
            preProduction: {
                ordersReceived: getStageData(client_1.ProductionStage.ORDER_RECEIVED),
                pendingCosting: getStageData(client_1.ProductionStage.PENDING_COSTING),
                pendingGreige: getStageData(client_1.ProductionStage.PENDING_GREIGE_ORDER),
                trimsNotOrdered: getStageData(client_1.ProductionStage.TRIMS_NOT_ORDERED),
            },
            processing: {
                inPrinting: getStageData(client_1.ProductionStage.IN_PRINTING),
                inDying: getStageData(client_1.ProductionStage.IN_DYING),
                inEmbroidery: getStageData(client_1.ProductionStage.IN_EMBROIDERY),
                inHandwork: getStageData(client_1.ProductionStage.IN_HANDWORK),
            },
            production: {
                inCutting: getStageData(client_1.ProductionStage.IN_CUTTING),
                inStitching: getStageData(client_1.ProductionStage.IN_STITCHING),
                inFinishing: getStageData(client_1.ProductionStage.IN_FINISHING),
                readyToShip: getStageData(client_1.ProductionStage.READY_TO_SHIP),
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
