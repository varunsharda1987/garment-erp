/**
 * Permission Service
 * Business logic for DB-based permission management with caching and audit trail
 */

import { Prisma, UserRole } from '@prisma/client';
import prisma from '../config/database';
import { logError, logInfo, logDebug } from '../utils/logger';
import { cachedQuery, deleteFromCache, invalidateByPattern } from '../lib/cache';
import { createAuditLog, getAuditContext } from './audit.service';
import { Request } from 'express';
import { PERMISSIONS, MODULES, PERMISSION_GROUPS, ROLE_CONFIG, type PermissionKey } from '../config/permissions.config';
import type {
  PermissionToggleInput,
  BulkPermissionUpdateInput,
  BulkUpdateResult,
  PermissionMatrixRow,
  PermissionMatrixResponse,
} from '../types/permission.types';

// Cache configuration
const CACHE_TTL = 600; // 10 minutes
const CACHE_KEYS = {
  matrix: 'permissions:matrix',
  byRole: (role: UserRole) => `permissions:role:${role}`,
  definitions: 'permissions:definitions',
};

// Flag to use DB or fallback to config
let useDatabase = true;

class PermissionServiceClass {
  /**
   * Check if database has been seeded with permissions
   */
  async isDatabaseSeeded(): Promise<boolean> {
    try {
      const count = await prisma.role_permissions.count();
      return count > 0;
    } catch {
      return false;
    }
  }

  /**
   * Ensure permissions are seeded on server startup
   * Only seeds if the database is empty - doesn't overwrite existing customizations
   */
  async ensureSeeded(): Promise<void> {
    try {
      const isSeeded = await this.isDatabaseSeeded();
      if (!isSeeded) {
        logInfo('🔐 Permissions not seeded - seeding from config...');
        const result = await this.seedFromConfig();
        logInfo(`✅ Permissions seeded: ${result.created} created, ${result.skipped} skipped`);
      }
    } catch (error) {
      logError('Failed to auto-seed permissions:', error instanceof Error ? error : new Error(String(error)));
      // Don't throw - allow server to continue starting even if seeding fails
    }
  }

  /**
   * Seed permissions from config to database
   */
  async seedFromConfig(): Promise<{ created: number; skipped: number }> {
    logInfo('Seeding permissions from config to database');
    let created = 0;
    let skipped = 0;

    const roles = Object.values(UserRole);
    const permissionKeys = Object.keys(PERMISSIONS) as PermissionKey[];

    // First, seed permission definitions
    await this.seedPermissionDefinitions();

    // Then seed role_permissions
    for (const role of roles) {
      for (const permKey of permissionKeys) {
        const allowedRoles = PERMISSIONS[permKey] as readonly UserRole[];
        const allowed = allowedRoles.includes(role);

        try {
          const existing = await prisma.role_permissions.findUnique({
            where: {
              role_permissionKey: { role, permissionKey: permKey },
            },
          });

          if (!existing) {
            await prisma.role_permissions.create({
              data: {
                role,
                permissionKey: permKey,
                allowed,
              },
            });
            created++;
          } else {
            skipped++;
          }
        } catch (err) {
          if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
            throw err;
          }
          // P2002: permission already exists (concurrent seed) — count as skipped
          skipped++;
        }
      }
    }

    // Invalidate cache after seeding
    await this.invalidateAllCache();

    logInfo(`Permission seeding complete: ${created} created, ${skipped} skipped`);
    return { created, skipped };
  }

  /**
   * Upsert the permission CATALOGUE (permission_definitions) from config.
   *
   * Purely additive: it never removes a definition and never touches role_permissions, so it is
   * safe to run on its own. Extracted from seedFromConfig so resetToDefaults can refresh the
   * catalogue without going near the grants.
   */
  private async seedPermissionDefinitions(): Promise<void> {
    for (const [groupKey, groupPermissions] of Object.entries(PERMISSION_GROUPS)) {
      let sortOrder = 0;

      for (const permKey of groupPermissions) {
        try {
          await prisma.permission_definitions.upsert({
            where: { permissionKey: permKey },
            create: {
              permissionKey: permKey,
              displayName: this.formatDisplayName(permKey),
              description: `Access to ${permKey} module`,
              moduleGroup: groupKey,
              sortOrder: sortOrder++,
              isActive: true,
            },
            update: {
              moduleGroup: groupKey,
              sortOrder: sortOrder,
            },
          });
        } catch (err) {
          if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
            throw err;
          }
          // P2002: definition already exists (concurrent seed) — safe to ignore
        }
      }
    }
  }

  /**
   * Format permission key to display name
   */
  private formatDisplayName(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  }

  /**
   * Get all permissions for a role (with caching)
   */
  async getPermissionsForRole(role: UserRole): Promise<string[]> {
    // Try database first
    if (useDatabase) {
      try {
        return await cachedQuery(
          CACHE_KEYS.byRole(role),
          async () => {
            const permissions = await prisma.role_permissions.findMany({
              where: { role, allowed: true },
              select: { permissionKey: true },
            });
            return permissions.map((p) => p.permissionKey);
          },
          CACHE_TTL
        );
      } catch (err) {
        logError(
          'DB permission lookup failed, using config fallback',
          err instanceof Error ? err : new Error(String(err))
        );
      }
    }

    // Fallback to config
    const allowedPerms: string[] = [];
    for (const [key, roles] of Object.entries(PERMISSIONS)) {
      if ((roles as readonly UserRole[]).includes(role)) {
        allowedPerms.push(key);
      }
    }
    return allowedPerms;
  }

  /**
   * Check if role has specific permission
   */
  async hasPermission(role: UserRole, permissionKey: string): Promise<boolean> {
    const permissions = await this.getPermissionsForRole(role);
    return permissions.includes(permissionKey);
  }

  /**
   * Get complete permission matrix for UI
   */
  async getPermissionMatrix(): Promise<PermissionMatrixResponse> {
    const roles = Object.values(UserRole);

    // Check if DB is seeded, if not use config
    const isSeeded = await this.isDatabaseSeeded();

    if (!isSeeded) {
      // Return config-based matrix
      return this.getConfigBasedMatrix();
    }

    // Get all permission definitions
    const definitions = await prisma.permission_definitions.findMany({
      where: { isActive: true },
      orderBy: [{ moduleGroup: 'asc' }, { sortOrder: 'asc' }],
    });

    // Get all role permissions
    const rolePermissions = await prisma.role_permissions.findMany();

    // Build lookup map
    const permLookup = new Map<string, boolean>();
    for (const rp of rolePermissions) {
      permLookup.set(`${rp.role}:${rp.permissionKey}`, rp.allowed);
    }

    // Build matrix rows
    const permissions: PermissionMatrixRow[] = definitions.map((def) => ({
      permissionKey: def.permissionKey,
      displayName: def.displayName,
      description: def.description,
      moduleGroup: def.moduleGroup,
      roles: roles.reduce(
        (acc, role) => {
          const key = `${role}:${def.permissionKey}`;
          acc[role] = permLookup.get(key) ?? false;
          return acc;
        },
        {} as Record<UserRole, boolean>
      ),
    }));

    // Build role info
    const roleInfo = roles.map((role) => {
      const permCount = Array.from(permLookup.entries()).filter(
        ([key, allowed]) => key.startsWith(`${role}:`) && allowed
      ).length;
      const config = ROLE_CONFIG[role];
      return {
        role,
        name: config?.name || role,
        description: config?.description || '',
        permissionCount: permCount,
      };
    });

    // Build module info
    const modules = Object.entries(MODULES).map(([key, value]) => ({
      key,
      name: value.name,
      description: value.description,
    }));

    // Get last update time
    const lastUpdate = await prisma.role_permissions.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });

    return {
      permissions,
      roles: roleInfo,
      modules,
      lastUpdated: lastUpdate?.updatedAt?.toISOString() || new Date().toISOString(),
    };
  }

  /**
   * Get config-based matrix (fallback when DB not seeded)
   */
  private getConfigBasedMatrix(): PermissionMatrixResponse {
    const roles = Object.values(UserRole);

    const permissions: PermissionMatrixRow[] = [];

    for (const [groupKey, groupPerms] of Object.entries(PERMISSION_GROUPS)) {
      for (const permKey of groupPerms) {
        const allowedRoles = PERMISSIONS[permKey as PermissionKey] as readonly UserRole[];
        permissions.push({
          permissionKey: permKey,
          displayName: this.formatDisplayName(permKey),
          description: `Access to ${permKey} module`,
          moduleGroup: groupKey,
          roles: roles.reduce(
            (acc, role) => {
              acc[role] = allowedRoles.includes(role);
              return acc;
            },
            {} as Record<UserRole, boolean>
          ),
        });
      }
    }

    const roleInfo = roles.map((role) => {
      const permCount = Object.values(PERMISSIONS).filter((allowedRoles) =>
        (allowedRoles as readonly UserRole[]).includes(role)
      ).length;
      const config = ROLE_CONFIG[role];
      return {
        role,
        name: config?.name || role,
        description: config?.description || '',
        permissionCount: permCount,
      };
    });

    const modules = Object.entries(MODULES).map(([key, value]) => ({
      key,
      name: value.name,
      description: value.description,
    }));

    return {
      permissions,
      roles: roleInfo,
      modules,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Toggle single permission
   */
  async togglePermission(input: PermissionToggleInput, req: Request): Promise<{ success: boolean; message: string }> {
    const { role, permissionKey, allowed } = input;

    logDebug('Toggling permission', { role, permissionKey, allowed });

    // Safety check: prevent ADMIN from removing their own admin access
    if (role === UserRole.ADMIN && permissionKey === 'admin' && !allowed) {
      return {
        success: false,
        message: 'Cannot remove admin permission from ADMIN role',
      };
    }

    // Get old value for audit
    const existing = await prisma.role_permissions.findUnique({
      where: {
        role_permissionKey: { role, permissionKey },
      },
    });

    const oldAllowed = existing?.allowed ?? false;

    // Upsert the permission
    await prisma.role_permissions.upsert({
      where: {
        role_permissionKey: { role, permissionKey },
      },
      create: {
        role,
        permissionKey,
        allowed,
        updatedById: req.user?.userId,
      },
      update: {
        allowed,
        updatedById: req.user?.userId,
      },
    });

    // Audit log
    const { userId, ipAddress } = getAuditContext(req);
    await createAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'ROLE_PERMISSION',
      entityId: `${role}:${permissionKey}`,
      oldValues: { role, permissionKey, allowed: oldAllowed },
      newValues: { role, permissionKey, allowed },
      ipAddress,
    });

    // Invalidate cache for this role
    await deleteFromCache(CACHE_KEYS.byRole(role));
    await deleteFromCache(CACHE_KEYS.matrix);

    logInfo('Permission toggled', { role, permissionKey, allowed });

    return {
      success: true,
      message: `${allowed ? 'Enabled' : 'Disabled'} ${permissionKey} for ${role}`,
    };
  }

  /**
   * Bulk update permissions
   */
  async bulkUpdatePermissions(input: BulkPermissionUpdateInput, req: Request): Promise<BulkUpdateResult> {
    const result: BulkUpdateResult = {
      success: true,
      updated: 0,
      failed: 0,
      errors: [],
    };

    for (const update of input.updates) {
      try {
        const res = await this.togglePermission(update, req);
        if (res.success) {
          result.updated++;
        } else {
          result.failed++;
          result.errors.push({
            role: update.role,
            permissionKey: update.permissionKey,
            error: res.message,
          });
        }
      } catch (err) {
        result.failed++;
        result.errors.push({
          role: update.role,
          permissionKey: update.permissionKey,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    result.success = result.failed === 0;

    // Invalidate all permission caches after bulk update
    await this.invalidateAllCache();

    return result;
  }

  /**
   * Reset all permissions to config defaults
   */
  async resetToDefaults(req: Request): Promise<{ success: boolean; reset: number }> {
    logInfo('Resetting permissions to defaults');

    const { userId, ipAddress } = getAuditContext(req);
    // getAuditContext falls back to the string 'SYSTEM', which is fine for an audit row but is
    // NOT a users.id — writing it to role_permissions.updatedById (a real FK) fails the
    // constraint. Stamp the actual authenticated user, or nobody.
    const actorId = req.user?.userId ?? null;

    // CONVERGE to the config, never wipe-and-rebuild.
    //
    // This used to be `role_permissions.deleteMany()` (every row, no filter) followed by
    // seedFromConfig(), with NO transaction around the pair. A re-seed that threw — or a process
    // that died between the two — left the table EMPTY: every role with no permissions at all,
    // from one admin button, with nothing to say it had happened. Same shape as the 2026-08-31
    // cost-sheet wipe: a destructive delete followed by a non-atomic rebuild.
    //
    // Converging removes the failure window entirely rather than narrowing it: the table is
    // never empty at any instant, and only the rows that actually deviate are written. If
    // anything throws, the transaction rolls back to the permissions that were already in force.
    const roles = Object.values(UserRole);
    const permissionKeys = Object.keys(PERMISSIONS) as PermissionKey[];

    const desired = new Map<string, { role: UserRole; permissionKey: string; allowed: boolean }>();
    for (const role of roles) {
      for (const permissionKey of permissionKeys) {
        const allowedRoles = PERMISSIONS[permissionKey] as readonly UserRole[];
        desired.set(`${role}|${permissionKey}`, { role, permissionKey, allowed: allowedRoles.includes(role) });
      }
    }

    const outcome = await prisma.$transaction(async (tx) => {
      const existing = await tx.role_permissions.findMany({
        select: { id: true, role: true, permissionKey: true, allowed: true },
      });
      const existingByKey = new Map(existing.map((row) => [`${row.role}|${row.permissionKey}`, row]));

      const toCreate: Array<{ role: UserRole; permissionKey: string; allowed: boolean }> = [];
      const flipTo: Record<'true' | 'false', string[]> = { true: [], false: [] };

      for (const [key, want] of desired) {
        const row = existingByKey.get(key);
        if (!row) {
          toCreate.push(want);
        } else if (row.allowed !== want.allowed) {
          flipTo[want.allowed ? 'true' : 'false'].push(row.id);
        }
      }

      // Rows for permission keys the config no longer defines (a key was renamed or removed).
      const staleIds = existing.filter((row) => !desired.has(`${row.role}|${row.permissionKey}`)).map((row) => row.id);

      if (toCreate.length > 0) {
        await tx.role_permissions.createMany({ data: toCreate });
      }
      for (const value of [true, false] as const) {
        const ids = flipTo[value ? 'true' : 'false'];
        if (ids.length > 0) {
          await tx.role_permissions.updateMany({
            where: { id: { in: ids } },
            data: { allowed: value, updatedById: actorId },
          });
        }
      }
      if (staleIds.length > 0) {
        await tx.role_permissions.deleteMany({ where: { id: { in: staleIds } } });
      }

      return {
        created: toCreate.length,
        updated: flipTo.true.length + flipTo.false.length,
        removed: staleIds.length,
        total: desired.size,
      };
    });

    // Definitions are the permission CATALOGUE, not the grants — seeding them is additive and
    // idempotent, so it stays outside the transaction above and cannot take grants down with it.
    await this.seedPermissionDefinitions();

    await this.invalidateAllCache();

    await createAuditLog({
      userId,
      action: 'UPDATE',
      entityType: 'ROLE_PERMISSION',
      entityId: 'ALL',
      oldValues: { action: 'reset' },
      newValues: outcome,
      ipAddress,
    });

    logInfo(
      `Permissions reset to defaults: ${outcome.created} created, ${outcome.updated} corrected, ` +
        `${outcome.removed} stale removed (${outcome.total} total)`
    );

    return { success: true, reset: outcome.total };
  }

  /**
   * Get audit log for permissions
   */
  async getAuditLog(options: {
    limit?: number;
    offset?: number;
    role?: UserRole;
    permissionKey?: string;
  }): Promise<{ logs: unknown[]; total: number }> {
    const { limit = 50, offset = 0, role, permissionKey } = options;

    const where: Record<string, unknown> = {
      entityType: 'ROLE_PERMISSION',
    };

    if (role || permissionKey) {
      where.entityId = {
        contains: role ? `${role}:` : permissionKey,
      };
    }

    const [logs, total] = await Promise.all([
      prisma.audit_logs.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
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
      prisma.audit_logs.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Invalidate all permission caches
   */
  private async invalidateAllCache(): Promise<void> {
    await invalidateByPattern('permissions:*');
  }
}

export const PermissionService = new PermissionServiceClass();
