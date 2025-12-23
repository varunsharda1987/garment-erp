/**
 * Permission Controller
 * Handles permission matrix and role information endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import {
  PERMISSIONS,
  MODULES,
  PERMISSION_GROUPS,
  ROLE_CONFIG,
  getPermissionsForRole,
  type PermissionKey,
} from '../config/permissions.config';

/**
 * Get the complete permission matrix
 * Returns all permissions and which roles have access
 */
export const getPermissionMatrix = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const roles = Object.values(UserRole);

    // Build the matrix
    const matrix = Object.entries(PERMISSIONS).map(([key, allowedRoles]) => ({
      permission: key,
      roles: roles.reduce((acc, role) => {
        acc[role] = (allowedRoles as readonly UserRole[]).includes(role);
        return acc;
      }, {} as Record<UserRole, boolean>),
    }));

    res.json({
      success: true,
      data: {
        permissions: matrix,
        roles: roles.map(role => ({
          role,
          ...ROLE_CONFIG[role],
        })),
        modules: MODULES,
        permissionGroups: PERMISSION_GROUPS,
      },
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
    const roles = Object.values(UserRole).map(role => ({
      role,
      ...ROLE_CONFIG[role],
      permissionCount: getPermissionsForRole(role).length,
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
      return res.status(400).json({
        success: false,
        error: 'Invalid role',
      });
    }

    const permissions = getPermissionsForRole(role as UserRole);
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
      return res.status(400).json({
        success: false,
        error: 'Invalid role',
      });
    }

    if (!Object.keys(PERMISSIONS).includes(permission)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid permission key',
      });
    }

    const allowedRoles = PERMISSIONS[permission as PermissionKey];
    const hasAccess = (allowedRoles as readonly UserRole[]).includes(role as UserRole);

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
