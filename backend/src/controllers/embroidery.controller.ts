import { Request, Response } from 'express';
import prisma from '../config/database';
import { logInfo } from '../utils/logger';
import { NotFoundError, ValidationError, BusinessError } from '../errors';

/**
 * Embroidery Master Controller
 * Manages embroidery designs that can be applied to fabrics.
 * Each design defines stitch pattern, cost, and width impact.
 */

// Helper function to convert Decimal fields to numbers for JSON serialization
const serializeEmbroidery = (embroidery: any) => {
  return {
    ...embroidery,
    repeatWidth: embroidery.repeatWidth ? Number(embroidery.repeatWidth) : null,
    repeatHeight: embroidery.repeatHeight ? Number(embroidery.repeatHeight) : null,
    minFabricWidth: embroidery.minFabricWidth ? Number(embroidery.minFabricWidth) : null,
    cutableWidth: embroidery.cutableWidth ? Number(embroidery.cutableWidth) : null,
    costPerMeter: embroidery.costPerMeter ? Number(embroidery.costPerMeter) : null,
  };
};

/**
 * Generate embroidery code in format EMB-YYYYMM-XXXX
 */
async function generateEmbroideryCode(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `EMB-${yearMonth}`;

  // Get the last code for this month
  const lastEmbroidery = await prisma.embroidery_master.findFirst({
    where: {
      embroideryCode: {
        startsWith: prefix,
      },
    },
    orderBy: {
      embroideryCode: 'desc',
    },
    select: {
      embroideryCode: true,
    },
  });

  let nextNumber = 1;

  if (lastEmbroidery?.embroideryCode) {
    // Extract the number part: EMB-202512-0001 -> 0001 -> 1
    const match = lastEmbroidery.embroideryCode.match(/-(\d{4})$/);
    if (match && match[1]) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
}

/**
 * Create a new embroidery design
 */
export const createEmbroidery = async (req: Request, res: Response) => {
  const {
    designName,
    description,
    designFile,
    designImage,
    stitchCount,
    threadColors,
    repeatWidth,
    repeatHeight,
    minFabricWidth,
    cutableWidth,
    usableWidthAfter, // Frontend sends this
    costPerMeter,
    supplierId,
    leadTimeDays,
    originalStyleId,
  } = req.body;

  // Support both field names (frontend uses usableWidthAfter, backend uses cutableWidth)
  const effectiveCutableWidth = cutableWidth || usableWidthAfter;

  // Validate required fields
  if (!designName) {
    throw new ValidationError('Design name is required');
  }

  if (!effectiveCutableWidth) {
    throw new ValidationError('Usable width after embroidery is required');
  }

  // costPerMeter is now optional - can be set later

  // Validate supplier if provided
  if (supplierId) {
    const supplier = await prisma.suppliers.findUnique({
      where: { id: supplierId },
    });
    if (!supplier) {
      throw new ValidationError('Supplier not found');
    }
  }

  // Generate embroidery code
  const embroideryCode = await generateEmbroideryCode();

  // Create embroidery record
  const embroidery = await prisma.embroidery_master.create({
    data: {
      embroideryCode,
      designName,
      description: description || null,
      designFile: designFile || null,
      designImage: designImage || null,
      stitchCount: stitchCount ? parseInt(stitchCount, 10) : null,
      threadColors: threadColors ? parseInt(threadColors, 10) : null,
      repeatWidth: repeatWidth ? parseFloat(repeatWidth) : null,
      repeatHeight: repeatHeight ? parseFloat(repeatHeight) : null,
      cutableWidth: parseFloat(effectiveCutableWidth),
      costPerMeter: costPerMeter ? parseFloat(costPerMeter) : null,
      supplierId: supplierId || null,
      leadTimeDays: leadTimeDays ? parseInt(leadTimeDays, 10) : null,
      originalStyleId: originalStyleId || null,
      isActive: true,
    },
    include: {
      supplier: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  });

  logInfo('Embroidery design created', { embroideryCode, designName });

  res.status(201).json({
    data: serializeEmbroidery(embroidery),
    message: 'Embroidery design created successfully',
  });
};

/**
 * Get all embroidery designs with pagination and search
 */
export const getAllEmbroidery = async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 20,
    search = '',
    supplierId = '',
    isActive = 'true',
  } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  // Build where clause
  const where: any = {};

  // Active filter
  if (isActive !== 'all') {
    where.isActive = isActive === 'true';
  }

  // Search filter
  if (search) {
    where.OR = [
      { embroideryCode: { contains: search as string, mode: 'insensitive' } },
      { designName: { contains: search as string, mode: 'insensitive' } },
      { description: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  // Supplier filter
  if (supplierId) {
    where.supplierId = supplierId as string;
  }

  // Get total count
  const total = await prisma.embroidery_master.count({ where });

  // Get paginated results
  const embroideryItems = await prisma.embroidery_master.findMany({
    where,
    skip,
    take: limitNum,
    include: {
      supplier: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      _count: {
        select: {
          style_fabrics: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Serialize Decimal fields to numbers
  const serializedData = embroideryItems.map((item) => ({
    ...serializeEmbroidery(item),
    usageCount: item._count.style_fabrics,
    _count: undefined,
  }));

  res.json({
    data: serializedData,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  });
};

/**
 * Get single embroidery design by ID
 */
export const getEmbroideryById = async (req: Request, res: Response) => {
  const { id } = req.params;

  const embroidery = await prisma.embroidery_master.findUnique({
    where: { id },
    include: {
      supplier: {
        select: {
          id: true,
          code: true,
          name: true,
          contactPerson: true,
          email: true,
          phone: true,
        },
      },
      style_fabrics: {
        include: {
          style_components: {
            include: {
              styles: {
                select: {
                  id: true,
                  styleCode: true,
                  styleName: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!embroidery) {
    throw new NotFoundError('Embroidery design', id);
  }

  // Extract styles using this embroidery
  const usedInStyles = embroidery.style_fabrics.map((sf) => ({
    styleId: sf.style_components.styles.id,
    styleCode: sf.style_components.styles.styleCode,
    styleName: sf.style_components.styles.styleName,
    componentName: sf.style_components.componentName,
  }));

  const response = {
    ...serializeEmbroidery(embroidery),
    usedInStyles,
    usageCount: embroidery.style_fabrics.length,
    style_fabrics: undefined,
  };

  res.json(response);
};

/**
 * Update embroidery design
 */
export const updateEmbroidery = async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    designName,
    description,
    designFile,
    designImage,
    stitchCount,
    threadColors,
    repeatWidth,
    repeatHeight,
    minFabricWidth,
    cutableWidth,
    costPerMeter,
    supplierId,
    leadTimeDays,
    isActive,
  } = req.body;

  // Check if embroidery exists
  const existing = await prisma.embroidery_master.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Embroidery design', id);
  }

  // Validate supplier if provided
  if (supplierId) {
    const supplier = await prisma.suppliers.findUnique({
      where: { id: supplierId },
    });
    if (!supplier) {
      throw new ValidationError('Supplier not found');
    }
  }

  // Build update data
  const updateData: any = {};

  if (designName !== undefined) updateData.designName = designName;
  if (description !== undefined) updateData.description = description || null;
  if (designFile !== undefined) updateData.designFile = designFile || null;
  if (designImage !== undefined) updateData.designImage = designImage || null;
  if (stitchCount !== undefined) updateData.stitchCount = stitchCount ? parseInt(stitchCount, 10) : null;
  if (threadColors !== undefined) updateData.threadColors = threadColors ? parseInt(threadColors, 10) : null;
  if (repeatWidth !== undefined) updateData.repeatWidth = repeatWidth ? parseFloat(repeatWidth) : null;
  if (repeatHeight !== undefined) updateData.repeatHeight = repeatHeight ? parseFloat(repeatHeight) : null;
  if (minFabricWidth !== undefined) updateData.minFabricWidth = minFabricWidth ? parseFloat(minFabricWidth) : null;
  if (cutableWidth !== undefined) updateData.cutableWidth = parseFloat(cutableWidth);
  if (costPerMeter !== undefined) updateData.costPerMeter = parseFloat(costPerMeter);
  if (supplierId !== undefined) updateData.supplierId = supplierId || null;
  if (leadTimeDays !== undefined) updateData.leadTimeDays = leadTimeDays ? parseInt(leadTimeDays, 10) : null;
  if (isActive !== undefined) updateData.isActive = isActive;

  const updated = await prisma.embroidery_master.update({
    where: { id },
    data: updateData,
    include: {
      supplier: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  });

  logInfo('Embroidery design updated', { id, embroideryCode: updated.embroideryCode });

  res.json({
    data: serializeEmbroidery(updated),
    message: 'Embroidery design updated successfully',
  });
};

/**
 * Delete embroidery design
 * Only allows deletion if not used in any style
 */
export const deleteEmbroidery = async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check if embroidery exists
  const existing = await prisma.embroidery_master.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          style_fabrics: true,
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError('Embroidery design', id);
  }

  // Check if used in any style
  if (existing._count.style_fabrics > 0) {
    throw new BusinessError(
      `This design is used in ${existing._count.style_fabrics} style fabric(s). Please remove from styles first or deactivate instead.`
    );
  }

  // Delete embroidery
  await prisma.embroidery_master.delete({
    where: { id },
  });

  logInfo('Embroidery design deleted', { id, embroideryCode: existing.embroideryCode });

  res.json({ message: 'Embroidery design deleted successfully' });
};

/**
 * Search embroidery designs for picker/dropdown
 * Returns minimal data for selection UI
 */
export const searchEmbroidery = async (req: Request, res: Response) => {
  const { search = '', limit = 20 } = req.query;
  const limitNum = parseInt(limit as string, 10);

  const where: any = {
    isActive: true,
  };

  if (search) {
    where.OR = [
      { embroideryCode: { contains: search as string, mode: 'insensitive' } },
      { designName: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const embroideryItems = await prisma.embroidery_master.findMany({
    where,
    take: limitNum,
    select: {
      id: true,
      embroideryCode: true,
      designName: true,
      designImage: true,
      stitchCount: true,
      threadColors: true,
      cutableWidth: true,
      costPerMeter: true,
      supplier: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [
      { designName: 'asc' },
    ],
  });

  // Serialize for response
  const serializedData = embroideryItems.map((item) => ({
    id: item.id,
    embroideryCode: item.embroideryCode,
    designName: item.designName,
    designImage: item.designImage,
    stitchCount: item.stitchCount,
    threadColors: item.threadColors,
    cutableWidth: item.cutableWidth ? Number(item.cutableWidth) : null,
    costPerMeter: item.costPerMeter ? Number(item.costPerMeter) : null,
    supplierName: item.supplier?.name || null,
  }));

  res.json({ data: serializedData });
};
