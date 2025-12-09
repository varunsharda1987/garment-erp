import { Request, Response } from 'express';
import prisma from '../config/database';

// Predefined categories for validation and reference
export const LOOKUP_CATEGORIES = {
  LACE_TYPE: 'LACE_TYPE',
  BUTTON_TYPE: 'BUTTON_TYPE',
  THREAD_TYPE: 'THREAD_TYPE',
  ZIPPER_TYPE: 'ZIPPER_TYPE',
  ELASTIC_TYPE: 'ELASTIC_TYPE',
  WEAVE_TYPE: 'WEAVE_TYPE',
  LABEL_TYPE: 'LABEL_TYPE',
  PACKAGING_TYPE: 'PACKAGING_TYPE',
} as const;

/**
 * Get all lookup values by category
 * GET /api/lookups?category=LACE_TYPE&includeInactive=false
 */
export const getLookupsByCategory = async (req: Request, res: Response) => {
  try {
    const { category, includeInactive = 'false' } = req.query;

    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const where: { category: string; isActive?: boolean } = {
      category: String(category).toUpperCase(),
    };

    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    const lookups = await prisma.lookup_values.findMany({
      where,
      orderBy: [
        { sortOrder: 'asc' },
        { value: 'asc' }
      ],
      select: {
        id: true,
        category: true,
        code: true,
        value: true,
        description: true,
        sortOrder: true,
        isActive: true,
        isSystem: true,
      }
    });

    res.json({ data: lookups });
  } catch (error: unknown) {
    console.error('Error fetching lookups:', error);
    res.status(500).json({
      error: 'Failed to fetch lookup values',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get all categories with their counts
 * GET /api/lookups/categories
 */
export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.lookup_values.groupBy({
      by: ['category'],
      _count: { id: true },
      orderBy: { category: 'asc' }
    });

    const result = categories.map(c => ({
      category: c.category,
      count: c._count.id
    }));

    res.json({
      data: result,
      predefinedCategories: Object.keys(LOOKUP_CATEGORIES)
    });
  } catch (error: unknown) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

/**
 * Create a new lookup value
 * POST /api/lookups
 */
export const createLookup = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { category, value, code, description, sortOrder = 0 } = req.body;

    if (!category || !value) {
      return res.status(400).json({ error: 'Category and value are required' });
    }

    const normalizedCategory = String(category).toUpperCase().replace(/\s+/g, '_');
    const trimmedValue = String(value).trim();

    // Check for duplicate
    const existing = await prisma.lookup_values.findUnique({
      where: {
        category_value: {
          category: normalizedCategory,
          value: trimmedValue
        }
      }
    });

    if (existing) {
      return res.status(409).json({ error: 'This value already exists in this category' });
    }

    const lookup = await prisma.lookup_values.create({
      data: {
        category: normalizedCategory,
        code: code || trimmedValue.toUpperCase().replace(/[\s\/]+/g, '_'),
        value: trimmedValue,
        description: description || null,
        sortOrder: sortOrder || 0,
        isActive: true,
        isSystem: false,
        createdById: userId || null,
      }
    });

    res.status(201).json({ data: lookup, message: 'Lookup value created successfully' });
  } catch (error: unknown) {
    console.error('Error creating lookup:', error);
    res.status(500).json({
      error: 'Failed to create lookup value',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Update a lookup value
 * PUT /api/lookups/:id
 */
export const updateLookup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { value, code, description, sortOrder, isActive } = req.body;

    const existing = await prisma.lookup_values.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Lookup value not found' });
    }

    // Check for duplicate value if value is being changed
    if (value && String(value).trim() !== existing.value) {
      const duplicate = await prisma.lookup_values.findFirst({
        where: {
          category: existing.category,
          value: String(value).trim(),
          id: { not: id }
        }
      });
      if (duplicate) {
        return res.status(409).json({ error: 'This value already exists in this category' });
      }
    }

    const updated = await prisma.lookup_values.update({
      where: { id },
      data: {
        ...(value !== undefined && { value: String(value).trim() }),
        ...(code !== undefined && { code }),
        ...(description !== undefined && { description }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      }
    });

    res.json({ data: updated, message: 'Lookup value updated successfully' });
  } catch (error: unknown) {
    console.error('Error updating lookup:', error);
    res.status(500).json({
      error: 'Failed to update lookup value',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Delete a lookup value
 * DELETE /api/lookups/:id
 */
export const deleteLookup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.lookup_values.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Lookup value not found' });
    }

    if (existing.isSystem) {
      return res.status(403).json({ error: 'System values cannot be deleted' });
    }

    await prisma.lookup_values.delete({ where: { id } });

    res.json({ message: 'Lookup value deleted successfully' });
  } catch (error: unknown) {
    console.error('Error deleting lookup:', error);
    res.status(500).json({
      error: 'Failed to delete lookup value',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Bulk create lookup values (for seeding)
 * POST /api/lookups/bulk
 */
export const bulkCreateLookups = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { category, values } = req.body;

    if (!category || !Array.isArray(values) || values.length === 0) {
      return res.status(400).json({ error: 'Category and values array are required' });
    }

    const normalizedCategory = String(category).toUpperCase().replace(/\s+/g, '_');

    const results: Array<{ success: boolean; value: string; id?: string; error?: string }> = [];

    for (let i = 0; i < values.length; i++) {
      const item = values[i];
      const value = typeof item === 'string' ? item : item.value;
      const code = typeof item === 'string' ? value.toUpperCase().replace(/[\s\/]+/g, '_') : item.code || value.toUpperCase().replace(/[\s\/]+/g, '_');

      try {
        const lookup = await prisma.lookup_values.upsert({
          where: {
            category_value: {
              category: normalizedCategory,
              value: value.trim()
            }
          },
          update: {},
          create: {
            category: normalizedCategory,
            code: code.trim(),
            value: value.trim(),
            sortOrder: i,
            isActive: true,
            isSystem: false,
            createdById: userId || null,
          }
        });
        results.push({ success: true, value: value, id: lookup.id });
      } catch (err: unknown) {
        results.push({ success: false, value: value, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    res.json({
      data: results,
      summary: {
        total: values.length,
        success: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
  } catch (error: unknown) {
    console.error('Error bulk creating lookups:', error);
    res.status(500).json({
      error: 'Failed to bulk create lookup values',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
