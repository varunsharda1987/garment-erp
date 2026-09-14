import { Request, Response, NextFunction } from 'express';
import { serialize } from '../utils/serializer';
import { logDebug, logError } from '../utils/logger';
import {
  searchMissService,
  normalizeTerm,
  isEmptySearchResult,
  extractFilters,
  MIN_TERM_LENGTH,
} from '../services/search-miss.service';

const SEARCH_MISS_IGNORED_PREFIXES = ['/api/ai', '/api/conversations'];

/**
 * A search that returns nothing is a 200 nobody else sees. Record it (fire-and-forget) so
 * AI Insights can show what users looked for and could not find. Must never throw or delay.
 */
function maybeRecordSearchMiss(req: Request, res: Response, body: unknown): void {
  try {
    if (req.method !== 'GET' || res.statusCode !== 200) return;
    const term = normalizeTerm(req.query.search);
    if (term.length < MIN_TERM_LENGTH) return;
    const userId = req.user?.userId;
    if (!userId) return;
    const endpoint = `${req.baseUrl}${req.path}`;
    if (SEARCH_MISS_IGNORED_PREFIXES.some((prefix) => endpoint.startsWith(prefix))) return;
    if (!isEmptySearchResult(body)) return;

    const header = req.get('x-page-route');
    const pageRoute = typeof header === 'string' && header.startsWith('/') ? header.slice(0, 200) : null;

    void searchMissService
      .record({
        userId,
        userRole: req.user?.role ?? null,
        endpoint,
        term,
        filters: extractFilters(req.query as Record<string, unknown>),
        pageRoute,
      })
      .catch((error: Error) => logDebug('[SearchMiss] record failed', { error: error.message }));
  } catch (error) {
    logDebug('[SearchMiss] skipped', { error: (error as Error).message });
  }
}

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

    try {
      if (debugEnabled) {
        logDebug('\n=== TRANSFORMATION DEBUG START ===');
        logDebug(`Endpoint: ${req.method} ${req.path}`);
        logDebug('Original Data (first 500 chars):', JSON.stringify(data, null, 2).substring(0, 500));
      }

      // Transform the data to camelCase
      const transformedData = serialize(data);

      maybeRecordSearchMiss(req, res, transformedData);

      if (debugEnabled) {
        logDebug('Transformed Data (first 500 chars):', JSON.stringify(transformedData, null, 2).substring(0, 500));
        logDebug('=== TRANSFORMATION DEBUG END ===\n');
      }

      // Call the original json method with transformed data
      return originalJson(transformedData);
    } catch (transformError) {
      // Log serialization/transformation errors using proper logger
      logError('Transform middleware error', {
        endpoint: `${req.method} ${req.path}`,
        error: (transformError as Error).message,
        stack: (transformError as Error).stack,
      });

      // Send error response instead of rethrowing (Express can't catch sync throws in res.json)
      // Set status code if not already set
      if (!res.headersSent) {
        res.status(500);
        return originalJson({
          success: false,
          error: 'Internal server error during response transformation',
          message:
            process.env.NODE_ENV === 'development'
              ? (transformError as Error).message
              : 'An error occurred while processing the response',
        });
      }
      // If headers already sent, we can't send an error response
      // Just log and return the response object
      return res;
    }
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
