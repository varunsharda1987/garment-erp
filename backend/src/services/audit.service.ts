/**
 * Audit Logging Service
 *
 * Tracks who changed what and when in the system.
 * Records create, update, and delete operations on entities.
 */

import { Request } from 'express';
import prisma from '../config/database';
import { logError, logDebug } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Audit action types
 */
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'SOFT_DELETE' | 'RESTORE' | 'LOGIN' | 'LOGOUT' | 'VIEW';

/**
 * Entity types that can be audited
 */
export type AuditEntityType =
  | 'USER'
  | 'CUSTOMER'
  | 'SUPPLIER'
  | 'STYLE'
  | 'MATERIAL'
  | 'ORDER'
  | 'BOM'
  | 'WORK_ORDER'
  | 'FABRIC'
  | 'GREIGE'
  | 'INVOICE'
  | 'PAYMENT'
  | 'STOCK'
  | 'WAREHOUSE';

/**
 * Options for creating an audit log entry
 */
export interface AuditLogOptions {
  userId: string;
  action: AuditAction;
  entityType: AuditEntityType | string;
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(options: AuditLogOptions): Promise<void> {
  try {
    // Convert 'SYSTEM' to null since it's not a real user ID
    const userId = options.userId === 'SYSTEM' ? null : options.userId;

    await prisma.audit_logs.create({
      data: {
        id: uuidv4(),
        userId,
        action: options.action,
        entityType: options.entityType,
        entityId: options.entityId,
        oldValues: options.oldValues ? JSON.parse(JSON.stringify(options.oldValues)) : undefined,
        newValues: options.newValues ? JSON.parse(JSON.stringify(options.newValues)) : undefined,
        ipAddress: options.ipAddress || null,
      },
    });
    logDebug(`Audit log created: ${options.action} ${options.entityType} ${options.entityId}`);
  } catch (error) {
    // allow-swallow — audit logging is best-effort; it must never fail the main business operation
    logError('Failed to create audit log:', error);
  }
}

/**
 * Extract user ID and IP from Express request
 */
export function getAuditContext(req: Request): { userId: string; ipAddress: string | null } {
  const userId = (req.user as { id?: string } | undefined)?.id || 'SYSTEM';
  const ipAddress = req.ip || req.headers['x-forwarded-for']?.toString() || null;
  return { userId, ipAddress };
}

/**
 * Log a create operation
 */
export async function logCreate(
  req: Request,
  entityType: AuditEntityType | string,
  entityId: string,
  newValues: Record<string, unknown>
): Promise<void> {
  const { userId, ipAddress } = getAuditContext(req);
  await createAuditLog({
    userId,
    action: 'CREATE',
    entityType,
    entityId,
    newValues: sanitizeValues(newValues),
    ipAddress,
  });
}

/**
 * Log an update operation
 */
export async function logUpdate(
  req: Request,
  entityType: AuditEntityType | string,
  entityId: string,
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>
): Promise<void> {
  const { userId, ipAddress } = getAuditContext(req);

  // Only log if there are actual changes
  const changes = getChangedFields(oldValues, newValues);
  if (Object.keys(changes.old).length === 0) {
    return; // No changes to log
  }

  await createAuditLog({
    userId,
    action: 'UPDATE',
    entityType,
    entityId,
    oldValues: changes.old,
    newValues: changes.new,
    ipAddress,
  });
}

/**
 * Log a delete operation
 */
export async function logDelete(
  req: Request,
  entityType: AuditEntityType | string,
  entityId: string,
  oldValues?: Record<string, unknown>
): Promise<void> {
  const { userId, ipAddress } = getAuditContext(req);
  await createAuditLog({
    userId,
    action: 'DELETE',
    entityType,
    entityId,
    oldValues: oldValues ? sanitizeValues(oldValues) : null,
    ipAddress,
  });
}

/**
 * Log a soft delete operation
 */
export async function logSoftDelete(
  req: Request,
  entityType: AuditEntityType | string,
  entityId: string
): Promise<void> {
  const { userId, ipAddress } = getAuditContext(req);
  await createAuditLog({
    userId,
    action: 'SOFT_DELETE',
    entityType,
    entityId,
    ipAddress,
  });
}

/**
 * Log a restore operation
 */
export async function logRestore(req: Request, entityType: AuditEntityType | string, entityId: string): Promise<void> {
  const { userId, ipAddress } = getAuditContext(req);
  await createAuditLog({
    userId,
    action: 'RESTORE',
    entityType,
    entityId,
    ipAddress,
  });
}

/**
 * Log a login event
 */
export async function logLogin(userId: string, ipAddress: string | null): Promise<void> {
  await createAuditLog({
    userId,
    action: 'LOGIN',
    entityType: 'USER',
    entityId: userId,
    ipAddress,
  });
}

/**
 * Log a logout event
 */
export async function logLogout(userId: string, ipAddress: string | null): Promise<void> {
  await createAuditLog({
    userId,
    action: 'LOGOUT',
    entityType: 'USER',
    entityId: userId,
    ipAddress,
  });
}

/**
 * Get audit logs for an entity
 */
export async function getAuditLogsForEntity(
  entityType: string,
  entityId: string,
  options?: { limit?: number; offset?: number }
): Promise<{ logs: unknown[]; total: number }> {
  const [logs, total] = await Promise.all([
    prisma.audit_logs.findMany({
      where: { entityType, entityId },
      orderBy: { timestamp: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    }),
    prisma.audit_logs.count({
      where: { entityType, entityId },
    }),
  ]);

  return { logs, total };
}

/**
 * Get audit logs by user
 */
export async function getAuditLogsByUser(
  userId: string,
  options?: { limit?: number; offset?: number }
): Promise<{ logs: unknown[]; total: number }> {
  const [logs, total] = await Promise.all([
    prisma.audit_logs.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    }),
    prisma.audit_logs.count({
      where: { userId },
    }),
  ]);

  return { logs, total };
}

/**
 * Get recent audit logs
 */
export async function getRecentAuditLogs(options?: {
  limit?: number;
  entityType?: string;
  action?: string;
}): Promise<unknown[]> {
  return prisma.audit_logs.findMany({
    where: {
      ...(options?.entityType && { entityType: options.entityType }),
      ...(options?.action && { action: options.action }),
    },
    orderBy: { timestamp: 'desc' },
    take: options?.limit || 100,
    include: {
      users: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Sanitize values before storing (remove sensitive fields)
 */
function sanitizeValues(values: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = ['password', 'passwordHash', 'token', 'refreshToken', 'apiKey', 'secret'];
  const sanitized = { ...values };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Get only the fields that changed between old and new values
 */
function getChangedFields(
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>
): { old: Record<string, unknown>; new: Record<string, unknown> } {
  const old: Record<string, unknown> = {};
  const changed: Record<string, unknown> = {};

  for (const key of Object.keys(newValues)) {
    const oldVal = oldValues[key];
    const newVal = newValues[key];

    // Skip if values are the same
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) {
      continue;
    }

    old[key] = oldVal;
    changed[key] = newVal;
  }

  return { old: sanitizeValues(old), new: sanitizeValues(changed) };
}

/**
 * Cleanup old audit logs
 *
 * Deletes audit logs older than the specified number of days.
 * Default retention is 90 days.
 *
 * @param retentionDays - Number of days to retain logs (default: 90)
 * @returns Number of deleted records
 */
export async function cleanupOldAuditLogs(retentionDays: number = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  try {
    const result = await prisma.audit_logs.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    logDebug(`Audit log cleanup: deleted ${result.count} records older than ${retentionDays} days`);
    return result.count;
  } catch (error) {
    logError('Failed to cleanup audit logs:', error);
    throw error;
  }
}

/**
 * Get audit log statistics
 *
 * Returns counts and date ranges for audit logs.
 */
export async function getAuditLogStats(): Promise<{
  totalCount: number;
  oldestLog: Date | null;
  newestLog: Date | null;
  countByAction: Record<string, number>;
}> {
  const [totalCount, oldest, newest, actionCounts] = await Promise.all([
    prisma.audit_logs.count(),
    prisma.audit_logs.findFirst({
      orderBy: { timestamp: 'asc' },
      select: { timestamp: true },
    }),
    prisma.audit_logs.findFirst({
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    }),
    prisma.audit_logs.groupBy({
      by: ['action'],
      _count: { action: true },
    }),
  ]);

  const countByAction: Record<string, number> = {};
  for (const item of actionCounts) {
    countByAction[item.action] = item._count.action;
  }

  return {
    totalCount,
    oldestLog: oldest?.timestamp || null,
    newestLog: newest?.timestamp || null,
    countByAction,
  };
}

export default {
  createAuditLog,
  getAuditContext,
  logCreate,
  logUpdate,
  logDelete,
  logSoftDelete,
  logRestore,
  logLogin,
  logLogout,
  getAuditLogsForEntity,
  getAuditLogsByUser,
  getRecentAuditLogs,
  cleanupOldAuditLogs,
  getAuditLogStats,
};
