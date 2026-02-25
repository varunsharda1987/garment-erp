/**
 * Permission Controller
 * Handles permission matrix and management endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { PermissionService } from '../services/permission.service';
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
  res: Response,
  next: NextFunction
) => {
  try {
    const matrix = await PermissionService.getPermissionMatrix();
    res.json({
      success: true,
      data: matrix,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all available roles with their descriptions
 */
export const getRoles = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
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
  } catch (error) {
    next(error);
  }
};

/**
 * Get permissions for a specific role
 */
export const getRolePermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { role } = req.params;

    if (!Object.values(UserRole).includes(role as UserRole)) {
      res.status(400).json({
        success: false,
        error: 'Invalid role',
      });
      return;
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
  } catch (error) {
    next(error);
  }
};

/**
 * Get all modules and their associated permissions
 */
export const getModules = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const modules = Object.entries(MODULES).map(([key, value]) => ({
      key,
      ...value,
      permissions: PERMISSION_GROUPS[key as keyof typeof MODULES] || [],
    }));

    res.json({
      success: true,
      data: modules,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if a role has specific permission
 */
export const checkPermission = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { role, permission } = req.params;

    if (!Object.values(UserRole).includes(role as UserRole)) {
      res.status(400).json({
        success: false,
        error: 'Invalid role',
      });
      return;
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
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle single permission
 */
export const togglePermission = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { role, permissionKey, allowed } = req.body;

    if (!Object.values(UserRole).includes(role as UserRole)) {
      res.status(400).json({
        success: false,
        error: 'Invalid role',
      });
      return;
    }

    const result = await PermissionService.togglePermission(
      { role, permissionKey, allowed },
      req
    );

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.message,
      });
      return;
    }

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk update permissions
 */
export const bulkUpdatePermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Updates array is required',
      });
      return;
    }

    const result = await PermissionService.bulkUpdatePermissions({ updates }, req);

    res.json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset permissions to config defaults
 */
export const resetToDefaults = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await PermissionService.resetToDefaults(req);

    res.json({
      success: true,
      message: `Reset ${result.reset} permissions to defaults`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get permission definitions
 */
export const getPermissionDefinitions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
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
  } catch (error) {
    next(error);
  }
};

/**
 * Get audit log for permission changes
 */
export const getAuditLog = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
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
  } catch (error) {
    next(error);
  }
};

/**
 * Seed permissions from config (one-time setup)
 */
export const seedPermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
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
  } catch (error) {
    next(error);
  }
};
