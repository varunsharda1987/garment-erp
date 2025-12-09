"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformResponse = transformResponse;
exports.transformRequestBody = transformRequestBody;
exports.logTransformation = logTransformation;
const serializer_1 = require("../utils/serializer");
const logger_1 = require("../utils/logger");
/**
 * Response transformation middleware
 * Automatically converts all API responses from snake_case to camelCase
 * This ensures frontend receives consistent camelCase data
 */
function transformResponse(req, res, next) {
    // Store the original json method
    const originalJson = res.json.bind(res);
    // Override the json method to transform data before sending
    res.json = function (data) {
        // Enable debug logging with DEBUG_TRANSFORM=true environment variable
        const debugEnabled = process.env.DEBUG_TRANSFORM === 'true';
        if (debugEnabled) {
            (0, logger_1.logDebug)('\n=== TRANSFORMATION DEBUG START ===');
            (0, logger_1.logDebug)(`Endpoint: ${req.method} ${req.path}`);
            (0, logger_1.logDebug)('Original Data (first 500 chars):', JSON.stringify(data, null, 2).substring(0, 500));
        }
        // Transform the data to camelCase
        const transformedData = (0, serializer_1.serialize)(data);
        if (debugEnabled) {
            (0, logger_1.logDebug)('Transformed Data (first 500 chars):', JSON.stringify(transformedData, null, 2).substring(0, 500));
            (0, logger_1.logDebug)('=== TRANSFORMATION DEBUG END ===\n');
        }
        // Call the original json method with transformed data
        return originalJson(transformedData);
    };
    next();
}
/**
 * Optional: Request body transformation middleware
 * Converts incoming request bodies from camelCase to snake_case if needed
 * Generally not needed since Prisma accepts camelCase for fields
 */
function transformRequestBody(req, res, next) {
    if (req.body && typeof req.body === 'object') {
        // For now, we don't transform request bodies since Prisma handles camelCase
        // This middleware is here for future use if needed
    }
    next();
}
/**
 * Development logging middleware to help debug transformations
 */
function logTransformation(req, res, next) {
    if (process.env.NODE_ENV === 'development') {
        const originalJson = res.json.bind(res);
        res.json = function (data) {
            (0, logger_1.logDebug)(`[Transform] ${req.method} ${req.path}`);
            const dataObj = data;
            (0, logger_1.logDebug)('[Transform] Original response keys:', Object.keys(dataObj || {}).join(', '));
            const transformedData = (0, serializer_1.serialize)(data);
            (0, logger_1.logDebug)('[Transform] Transformed response keys:', Object.keys(transformedData || {}).join(', '));
            return originalJson(transformedData);
        };
    }
    next();
}
