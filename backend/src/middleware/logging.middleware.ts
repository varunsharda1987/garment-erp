import { Request, Response, NextFunction } from 'express';
import { logHttp } from '../utils/logger';

/**
 * HTTP request logging middleware
 * Logs all incoming requests with method, URL, status code, and response time
 */
export const httpLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`;

    logHttp(message, {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
    });
  });

  next();
};
