/**
 * Permission Controller
 * Handles permission matrix and management endpoints
 */

import { Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { PermissionService } from '../services/permission.service';
import { ValidationError } from '../errors';
import {
  PERMISSIONS,
  MODULES,
  PERMISSION_GROUPS,
  ROLE_CONFIG,
  getPermissionsForRole as getConfigPermissions,
} from '../config/permissions.config';

/**
 * Get the complete permission matrix (DB-backed)
 */
export const getPermissionMatrix = async (
  req: Request,
  res: Response
) => {
  const matrix = await PermissionService.getPermissionMatrix();
  res.json({
    success: true,
    data: matrix,
  });
};

/**
 * Get all available roles with their descriptions
 */
export const getRoles = async (
  req: Request,
  res: Response
) => {
  const roles = Object.values(UserRole).map((role) => ({
    role,
    ...ROLE_CONFIG[role],
    permissionCount: getConfigPermissions(role).length,
    totalPermissions: Object.keys(PERMISSIONS).length,
  }));

  res.json({
    success: true,
    data: roles,
  });
};

/**
 * Get permissions for a specific role
 */
export const getRolePermissions = async (
  req: Request,
  res: Response
) => {
  const { role } = req.params;

  if (!Object.values(UserRole).includes(role as UserRole)) {
    throw new ValidationError('Invalid role');
  }

  const permissions = await PermissionService.getPermissionsForRole(role as UserRole);
  const roleConfig = ROLE_CONFIG[role as UserRole];

  res.json({
    success: true,
    data: {
      role,
      ...roleConfig,
      permissions,
      permissionCount: permissions.length,
      totalPermissions: Object.keys(PERMISSIONS).length,
    },
  });
};

/**
 * Get all modules and their associated permissions
 */
export const getModules = async (
  req: Request,
  res: Response
) => {
  const modules = Object.entries(MODULES).map(([key, value]) => ({
    key,
    ...value,
    permissions: PERMISSION_GROUPS[key as keyof typeof MODULES] || [],
  }));

  res.json({
    success: true,
    data: modules,
  });
};

/**
 * Check if a role has specific permission
 */
export const checkPermission = async (
  req: Request,
  res: Response
) => {
  const { role, permission } = req.params;

  if (!Object.values(UserRole).includes(role as UserRole)) {
    throw new ValidationError('Invalid role');
  }

  const hasAccess = await PermissionService.hasPermission(
    role as UserRole,
    permission
  );

  res.json({
    success: true,
    data: {
      role,
      permission,
      hasAccess,
    },
  });
};

/**
 * Toggle single permission
 */
export const togglePermission = async (
  req: Request,
  res: Response
) => {
  const { role, permissionKey, allowed } = req.body;

  if (!Object.values(UserRole).includes(role as UserRole)) {
    throw new ValidationError('Invalid role');
  }

  const result = await PermissionService.togglePermission(
    { role, permissionKey, allowed },
    req
  );

  if (!result.success) {
    throw new ValidationError(result.message || 'Failed to toggle permission');
  }

  res.json({
    success: true,
    message: result.message,
  });
};

/**
 * Bulk update permissions
 */
export const bulkUpdatePermissions = async (
  req: Request,
  res: Response
) => {
  const { updates } = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    throw new ValidationError('Updates array is required');
  }

  const result = await PermissionService.bulkUpdatePermissions({ updates }, req);

  res.json({
    success: result.success,
    data: result,
  });
};

/**
 * Reset permissions to config defaults
 */
export const resetToDefaults = async (
  req: Request,
  res: Response
) => {
  const result = await PermissionService.resetToDefaults(req);

  res.json({
    success: true,
    message: `Reset ${result.reset} permissions to defaults`,
    data: result,
  });
};

/**
 * Get permission definitions
 */
export const getPermissionDefinitions = async (
  req: Request,
  res: Response
) => {
  const matrix = await PermissionService.getPermissionMatrix();

  res.json({
    success: true,
    data: {
      permissions: matrix.permissions.map((p) => ({
        permissionKey: p.permissionKey,
        displayName: p.displayName,
        description: p.description,
        moduleGroup: p.moduleGroup,
      })),
      modules: matrix.modules,
    },
  });
};

/**
 * Get audit log for permission changes
 */
export const getAuditLog = async (
  req: Request,
  res: Response
) => {
  const { limit, offset, role, permissionKey } = req.query;

  const result = await PermissionService.getAuditLog({
    limit: limit ? parseInt(limit as string) : 50,
    offset: offset ? parseInt(offset as string) : 0,
    role: role as UserRole | undefined,
    permissionKey: permissionKey as string | undefined,
  });

  res.json({
    success: true,
    data: result,
  });
};

/**
 * Seed permissions from config (one-time setup)
 */
export const seedPermissions = async (
  req: Request,
  res: Response
) => {
  const isSeeded = await PermissionService.isDatabaseSeeded();

  if (isSeeded) {
    res.json({
      success: true,
      message: 'Permissions already seeded',
      data: { created: 0, skipped: 0 },
    });
    return;
  }

  const result = await PermissionService.seedFromConfig();

  res.json({
    success: true,
    message: `Seeded ${result.created} permissions`,
    data: result,
  });
};
