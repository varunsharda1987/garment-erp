// Component Masters Controller
import { Request, Response } from 'express';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import { logInfo, logError, logWarn, logDebug } from '../utils/logger';

/**
 * Create new component master
 * POST /api/component-masters
 */
export const createComponentMaster = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      description,
      componentCategory,
      componentGroupId,
      sortOrder,
    } = req.body;

    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
      return;
    }

    // Check if component name already exists
    const existingComponent = await prisma.component_masters.findUnique({
      where: { name },
    });

    if (existingComponent) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Component name already exists',
      });
      return;
    }

    // If componentGroupId provided, verify it exists
    if (componentGroupId) {
      const groupExists = await prisma.component_group_master.findUnique({
        where: { id: componentGroupId },
      });

      if (!groupExists) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Component group not found',
        });
        return;
      }
    }

    const component = await prisma.component_masters.create({
      data: {
        name,
        description: description || null,
        componentCategory: componentCategory || null, // DEPRECATED - but keep for backward compatibility
        componentGroupId: componentGroupId || null,
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

    res.status(201).json({
      data: component,
      message: 'Component master created successfully',
    });
  } catch (error) {
    logError('Create component master error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create component master',
    });
  }
};

/**
 * Get all component masters with pagination, search, and filters
 * GET /api/component-masters
 */
export const getAllComponentMasters = async (req: Request, res: Response): Promise<void> => {
  try {
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
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logError('Get component masters error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch component masters',
    });
  }
};

/**
 * Get component master by ID
 * GET /api/component-masters/:id
 */
export const getComponentMasterById = async (req: Request, res: Response): Promise<void> => {
  try {
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
        patternParts: {       // Include pattern parts
          include: {
            patternPart: true,
          },
        },
      },
    });

    if (!component) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Component master not found',
      });
      return;
    }

    res.json({ data: component });
  } catch (error) {
    logError('Get component master error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch component master',
    });
  }
};

/**
 * Update component master
 * PUT /api/component-masters/:id
 */
export const updateComponentMaster = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      componentCategory,
      componentGroupId,
      sortOrder,
      isActive,
    } = req.body;

    // Check if component exists
    const existingComponent = await prisma.component_masters.findUnique({
      where: { id },
    });

    if (!existingComponent) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Component master not found',
      });
      return;
    }

    // Check if new name already exists
    if (name !== existingComponent.name) {
      const nameExists = await prisma.component_masters.findUnique({
        where: { name },
      });

      if (nameExists) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Component name already exists',
        });
        return;
      }
    }

    // If componentGroupId provided, verify it exists
    if (componentGroupId) {
      const groupExists = await prisma.component_group_master.findUnique({
        where: { id: componentGroupId },
      });

      if (!groupExists) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Component group not found',
        });
        return;
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
  } catch (error) {
    logError('Update component master error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update component master',
    });
  }
};

/**
 * Delete component master (soft delete)
 * DELETE /api/component-masters/:id
 */
export const deleteComponentMaster = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const component = await prisma.component_masters.findUnique({
      where: { id },
    });

    if (!component) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Component master not found',
      });
      return;
    }

    await prisma.component_masters.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({
      message: 'Component master deleted successfully',
    });
  } catch (error) {
    logError('Delete component master error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete component master',
    });
  }
};

/**
 * Get all categories
 * GET /api/component-masters/categories
 */
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
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

    const categoryList = categories
      .map((c) => c.componentCategory)
      .filter((c): c is string => c !== null);

    res.json({
      data: categoryList,
      message: 'Categories retrieved successfully',
    });
  } catch (error) {
    logError('Get categories error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch categories',
    });
  }
};
