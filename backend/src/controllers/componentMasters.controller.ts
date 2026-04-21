// Component Masters Controller
import { Request, Response } from 'express';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { logInfo, logError } from '../utils/logger';
import { assignPatternPartsToComponent } from '../services/componentPatternParts.service';
import { UnauthorizedError, ValidationError, NotFoundError } from '../errors';

/**
 * Create new component master
 * POST /api/component-masters
 */
export const createComponentMaster = async (req: Request, res: Response): Promise<void> => {
  const { name, description, componentCategory, componentGroupId, sortOrder } = req.body;

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
  let patternAssignment;
  try {
    patternAssignment = await assignPatternPartsToComponent(component.id, componentGroupId);
    logInfo(`Auto-assigned ${patternAssignment.assigned} pattern parts to new component "${component.name}"`);
  } catch (assignError) {
    // Log error but don't fail the component creation
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

  res.status(201).json({
    data: component,
    message: `Component master created successfully with ${patternAssignment.assigned} pattern part${patternAssignment.assigned !== 1 ? 's' : ''}`,
    patternParts: {
      assigned: patternAssignment.assigned,
      patterns: patternAssignment.patterns,
      skipped: patternAssignment.skipped,
    },
  });
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
