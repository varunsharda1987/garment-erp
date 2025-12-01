import { Request, Response, NextFunction } from 'express';
import { serialize } from '../utils/serializer';
import { logDebug } from '../utils/logger';

/**
 * Response transformation middleware
 * Automatically converts all API responses from snake_case to camelCase
 * This ensures frontend receives consistent camelCase data
 */
export function transformResponse(req: Request, res: Response, next: NextFunction) {
  // Store the original json method
  const originalJson = res.json.bind(res);

  // Override the json method to transform data before sending
  res.json = function (data: unknown): Response {
    // Enable debug logging with DEBUG_TRANSFORM=true environment variable
    const debugEnabled = process.env.DEBUG_TRANSFORM === 'true';

    if (debugEnabled) {
      logDebug('\n=== TRANSFORMATION DEBUG START ===');
      logDebug(`Endpoint: ${req.method} ${req.path}`);
      logDebug('Original Data (first 500 chars):', JSON.stringify(data, null, 2).substring(0, 500));
    }

    // Transform the data to camelCase
    const transformedData = serialize(data);

    if (debugEnabled) {
      logDebug('Transformed Data (first 500 chars):', JSON.stringify(transformedData, null, 2).substring(0, 500));
      logDebug('=== TRANSFORMATION DEBUG END ===\n');
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
export function transformRequestBody(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    // For now, we don't transform request bodies since Prisma handles camelCase
    // This middleware is here for future use if needed
  }

  next();
}

/**
 * Development logging middleware to help debug transformations
 */
export function logTransformation(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'development') {
    const originalJson = res.json.bind(res);

    res.json = function (data: unknown): Response {
      logDebug(`[Transform] ${req.method} ${req.path}`);
      const dataObj = data as Record<string, unknown> | null;
      logDebug('[Transform] Original response keys:', Object.keys(dataObj || {}).join(', '));

      const transformedData = serialize(data) as Record<string, unknown> | null;
      logDebug('[Transform] Transformed response keys:', Object.keys(transformedData || {}).join(', '));

      return originalJson(transformedData);
    };
  }

  next();
}
