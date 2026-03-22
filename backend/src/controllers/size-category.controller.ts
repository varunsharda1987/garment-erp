import { Request, Response } from 'express';
import prisma from '../config/database';
import { NotFoundError, ValidationError, ConflictError, BusinessError } from '../errors';

// Get all size categories
export const getAllSizeCategories = async (req: Request, res: Response) => {
  const { page = 1, limit = 50, search = '', isActive } = req.query;

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const whereConditions: any[] = [];

  if (search) {
    whereConditions.push({
      OR: [
        { name: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } },
      ],
    });
  }

  if (isActive !== undefined) {
    whereConditions.push({ isActive: isActive === 'true' });
  }

  const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

  const [sizeCategories, total] = await Promise.all([
    prisma.size_categories.findMany({
      where,
      skip,
      take,
      orderBy: { name: 'asc' },
    }),
    prisma.size_categories.count({ where }),
  ]);

  res.json({
    data: sizeCategories,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
};

// Get size category by ID
export const getSizeCategoryById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const sizeCategory = await prisma.size_categories.findUnique({
    where: { id },
    include: {
      labelSizeVariants: {
        include: {
          label: {
            select: {
              id: true,
              labelCode: true,
              labelName: true,
            },
          },
        },
      },
    },
  });

  if (!sizeCategory) {
    throw new NotFoundError('Size category', id);
  }

  res.json(sizeCategory);
};

// Create size category
export const createSizeCategory = async (req: Request, res: Response) => {
  const { name, description, sizes } = req.body;

  // Validate required fields
  if (!name || !sizes || !Array.isArray(sizes) || sizes.length === 0) {
    throw new ValidationError('Name and sizes array (with at least one size) are required');
  }

  // Check for duplicate name
  const existing = await prisma.size_categories.findUnique({
    where: { name },
  });

  if (existing) {
    throw new ConflictError(`Size category with name "${name}" already exists`);
  }

  const sizeCategory = await prisma.size_categories.create({
    data: {
      name,
      description,
      sizes,
    },
  });

  res.status(201).json(sizeCategory);
};

// Update size category
export const updateSizeCategory = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, sizes, isActive } = req.body;

  // Check if size category exists
  const existing = await prisma.size_categories.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Size category', id);
  }

  // Check for duplicate name (if changing name)
  if (name && name !== existing.name) {
    const duplicate = await prisma.size_categories.findUnique({
      where: { name },
    });

    if (duplicate) {
      throw new ConflictError(`Size category with name "${name}" already exists`);
    }
  }

  // Validate sizes if provided
  if (sizes !== undefined && (!Array.isArray(sizes) || sizes.length === 0)) {
    throw new ValidationError('Sizes must be an array with at least one size');
  }

  const sizeCategory = await prisma.size_categories.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(sizes && { sizes }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  res.json(sizeCategory);
};

// Delete size category
export const deleteSizeCategory = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if size category exists
  const existing = await prisma.size_categories.findUnique({
    where: { id },
    include: {
      labelSizeVariants: true,
    },
  });

  if (!existing) {
    throw new NotFoundError('Size category', id);
  }

  // Check if it's being used by any label variants
  if (existing.labelSizeVariants && existing.labelSizeVariants.length > 0) {
    throw new BusinessError(
      `Cannot delete size category "${existing.name}" as it is being used by ${existing.labelSizeVariants.length} label variant(s)`
    );
  }

  await prisma.size_categories.delete({
    where: { id },
  });

  res.json({ message: 'Size category deleted successfully' });
};
