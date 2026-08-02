// Component Masters Controller
//
// TODO [BUG-CM6]: The `componentCategory` field is DEPRECATED throughout this controller.
// It is kept only for backward compatibility with existing database records.
// Migration path:
//   1. All new components MUST use componentGroupId (already enforced in create)
//   2. Run a migration script to assign componentGroupId to legacy records
//   3. Once all records have componentGroupId, remove componentCategory from:
//      - Prisma schema (component_masters.componentCategory)
//      - This controller (create, getAll filter, update)
//      - Frontend forms and types
//      - Zod schemas if applicable
// Deprecation warnings are logged at runtime when componentCategory is used.

import { Request, Response } from 'express';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { logInfo, logError, logWarn } from '../utils/logger';
import { assignPatternPartsToComponent } from '../services/componentPatternParts.service';
import { UnauthorizedError, ValidationError, NotFoundError } from '../errors';

/**
 * Create new component master
 * POST /api/component-masters
 */
export const createComponentMaster = async (req: Request, res: Response): Promise<void> => {
  const { name, description, componentCategory, componentGroupId, sortOrder } = req.body;

  // BUG-CM6 fix: Log deprecation warning when componentCategory is used
  if (componentCategory) {
    logWarn(
      `DEPRECATION: componentCategory field is deprecated. Use componentGroupId instead. ` +
        `Received componentCategory="${componentCategory}" for component "${name}".`
    );
  }

  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }

  // Check if component name already exists
  const existingComponent = await prisma.component_masters.findUnique({
    where: { name },
  });

  if (existingComponent) {
    throw new ValidationError('Component name already exists');
  }

  // VALIDATE: componentGroupId is REQUIRED
  if (!componentGroupId) {
    throw new ValidationError(
      'Component Group is required. Every component must belong to a component group to define its pattern parts.'
    );
  }

  // Verify componentGroupId exists
  const groupExists = await prisma.component_group_master.findUnique({
    where: { id: componentGroupId },
  });

  if (!groupExists) {
    throw new NotFoundError('Component Group', componentGroupId);
  }

  const component = await prisma.component_masters.create({
    data: {
      name,
      description: description || null,
      componentCategory: componentCategory || null, // DEPRECATED - but keep for backward compatibility
      componentGroupId: componentGroupId, // Now required, no NULL fallback
      sortOrder: sortOrder || 0,
      isActive: true,
      createdById: userId,
    },
    include: {
      users: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      componentGroup: true, // Include component group details
    },
  });

  // AUTO-ASSIGN pattern parts for the component group
  // BUG-CM8 fix: Track whether pattern assignment succeeded or failed
  let patternAssignment;
  let patternAssignmentFailed = false;
  try {
    patternAssignment = await assignPatternPartsToComponent(component.id, componentGroupId);
    logInfo(`Auto-assigned ${patternAssignment.assigned} pattern parts to new component "${component.name}"`);
  } catch (assignError) {
    // Log error but don't fail the component creation
    // BUG-CM8 fix: Set flag to include warning in response
    patternAssignmentFailed = true;
    logError('Failed to auto-assign pattern parts to component:', assignError);
    patternAssignment = {
      assigned: 0,
      patterns: [],
      skipped: 0,
      componentId: component.id,
      componentName: component.name,
      componentGroupName: component.componentGroup?.name || 'Unknown',
    };
  }

  // BUG-CM8 fix: Build response with warning if pattern assignment failed
  const response: {
    data: typeof component;
    message: string;
    patternParts: { assigned: number; patterns: unknown[]; skipped: number };
    warning?: string;
  } = {
    data: component,
    message: `Component master created successfully with ${patternAssignment.assigned} pattern part${patternAssignment.assigned !== 1 ? 's' : ''}`,
    patternParts: {
      assigned: patternAssignment.assigned,
      patterns: patternAssignment.patterns,
      skipped: patternAssignment.skipped,
    },
  };

  // BUG-CM8 fix: Add warning when pattern assignment failed so user knows it was partial success
  if (patternAssignmentFailed) {
    response.warning =
      'Component was created but pattern parts could not be auto-assigned. ' +
      'Please manually assign pattern parts from the component details page.';
  }

  res.status(201).json(response);
};

/**
 * Get all component masters with pagination, search, and filters
 * GET /api/component-masters
 */
export const getAllComponentMasters = async (req: Request, res: Response): Promise<void> => {
  const {
    page = '1',
    limit = '100',
    search = '',
    componentCategory,
    componentGroupId,
    activeOnly = 'true',
  } = req.query;

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  // Build where clause
  const where: Prisma.component_mastersWhereInput = {};

  if (activeOnly === 'true') {
    where.isActive = true;
  }

  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { description: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  // Support both old (componentCategory) and new (componentGroupId) filters
  if (componentGroupId) {
    where.componentGroupId = componentGroupId as string;
  } else if (componentCategory) {
    // BUG-CM6 fix: Log deprecation warning when componentCategory filter is used
    logWarn(
      `DEPRECATION: componentCategory filter is deprecated. Use componentGroupId instead. ` +
        `Received componentCategory="${componentCategory}" in query.`
    );
    where.componentCategory = componentCategory as string;
  }

  const [components, total] = await Promise.all([
    prisma.component_masters.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { sortOrder: 'asc' },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        componentGroup: true, // Include component group details
      },
    }),
    prisma.component_masters.count({ where }),
  ]);

  res.json({
    data: components,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
};

/**
 * Get component master by ID
 * GET /api/component-masters/:id
 */
export const getComponentMasterById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const component = await prisma.component_masters.findUnique({
    where: { id },
    include: {
      users: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      componentGroup: true, // Include component group details
      patternParts: {
        // Include pattern parts
        include: {
          patternPart: true,
        },
      },
    },
  });

  if (!component) {
    throw new NotFoundError('Component master', id);
  }

  res.json({ data: component });
};

/**
 * Update component master
 * PUT /api/component-masters/:id
 */
export const updateComponentMaster = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, description, componentCategory, componentGroupId, sortOrder, isActive } = req.body;

  // BUG-CM6 fix: Log deprecation warning when componentCategory is used
  if (componentCategory) {
    logWarn(
      `DEPRECATION: componentCategory field is deprecated. Use componentGroupId instead. ` +
        `Received componentCategory="${componentCategory}" for component update (id=${id}).`
    );
  }

  // Check if component exists
  const existingComponent = await prisma.component_masters.findUnique({
    where: { id },
  });

  if (!existingComponent) {
    throw new NotFoundError('Component master', id);
  }

  // Check if new name already exists
  if (name !== existingComponent.name) {
    const nameExists = await prisma.component_masters.findUnique({
      where: { name },
    });

    if (nameExists) {
      throw new ValidationError('Component name already exists');
    }
  }

  // If componentGroupId provided, verify it exists
  if (componentGroupId) {
    const groupExists = await prisma.component_group_master.findUnique({
      where: { id: componentGroupId },
    });

    if (!groupExists) {
      throw new ValidationError('Component group not found');
    }
  }

  const component = await prisma.component_masters.update({
    where: { id },
    data: {
      name,
      description: description || null,
      componentCategory: componentCategory || null, // DEPRECATED - but keep for backward compatibility
      componentGroupId: componentGroupId !== undefined ? componentGroupId : existingComponent.componentGroupId,
      sortOrder: sortOrder !== undefined ? sortOrder : existingComponent.sortOrder,
      isActive: isActive !== undefined ? isActive : existingComponent.isActive,
    },
    include: {
      users: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      componentGroup: true, // Include component group details
    },
  });

  res.json({
    data: component,
    message: 'Component master updated successfully',
  });
};

/**
 * Delete component master (soft delete)
 * DELETE /api/component-masters/:id
 */
export const deleteComponentMaster = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const component = await prisma.component_masters.findUnique({
    where: { id },
  });

  if (!component) {
    throw new NotFoundError('Component master', id);
  }

  await prisma.component_masters.update({
    where: { id },
    data: { isActive: false },
  });

  res.json({
    message: 'Component master deleted successfully',
  });
};

/**
 * Get all categories
 * GET /api/component-masters/categories
 */
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  const categories = await prisma.component_masters.findMany({
    where: {
      isActive: true,
      componentCategory: { not: null },
    },
    select: {
      componentCategory: true,
    },
    distinct: ['componentCategory'],
    orderBy: { componentCategory: 'asc' },
  });

  const categoryList = categories.map((c) => c.componentCategory).filter((c): c is string => c !== null);

  res.json({
    data: categoryList,
    message: 'Categories retrieved successfully',
  });
};
