import { Request, Response } from 'express';
import prisma from '../config/database';
import { logInfo, logError, logDebug } from '../utils/logger';
import { randomUUID } from 'crypto';

/**
 * Sample Controller
 * Handles sample tracking for all types: FIT, PP, Size Set, Shipment, Photoshoot
 */

// Helper to serialize Decimal fields
const serializeSample = (sample: any) => {
  return {
    ...sample,
    measurements: sample.measurements?.map((m: any) => ({
      ...m,
      specValue: m.specValue ? Number(m.specValue) : null,
      actualValue: m.actualValue ? Number(m.actualValue) : null,
      tolerance: m.tolerance ? Number(m.tolerance) : null,
    })),
  };
};

/**
 * Generate sample number in format {TYPE}-{StyleCode}-{Version/Seq}
 * e.g., FIT-STY2024-0001-v1, PP-STY2024-0001-001
 */
async function generateSampleNumber(
  sampleType: string,
  styleCode?: string,
  version: number = 1
): Promise<string> {
  const typePrefix = sampleType.replace('_SAMPLE', '').replace('_', '-');
  const styleRef = styleCode || 'GEN';
  const date = new Date();
  const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;

  // Find existing samples of this type for this style (count only active samples to prevent conflicts)
  // Note: For sample numbering, we count only active samples to avoid code conflicts when deleted samples exist.
  // This is safer for sample codes which are more complex (type-based) vs simple sequential numbers.
  const existingCount = await prisma.samples.count({
    where: {
      sampleType: sampleType as any,
      sampleNumber: {
        startsWith: `${typePrefix}-`,
      },
      isActive: true,
    },
  });

  const seq = String(existingCount + 1).padStart(4, '0');

  if (sampleType === 'FIT_SAMPLE') {
    return `${typePrefix}-${styleRef}-v${version}`;
  }

  return `${typePrefix}-${yearMonth}-${seq}`;
}

/**
 * Create a new sample
 */
export const createSample = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const {
      customerId,
      styleId,
      sampleType,
      requestDate,
      requiredDate,
      remarks,
      // Type-specific fields
      sampleSizeId,
      fitSampleReference,
      ppSampleReference,
      linkedDispatchId,
      productionLot,
      sentTo,
      purpose,
      // Nested data
      measurements,
      colorways,
      sizeSets,
      // Admin override
      adminOverride,
      overrideReason,
    } = req.body;

    // Validate required fields
    if (!customerId) {
      return res.status(400).json({ error: 'Customer is required' });
    }
    if (!sampleType) {
      return res.status(400).json({ error: 'Sample type is required' });
    }
    if (!requiredDate) {
      return res.status(400).json({ error: 'Required date is required' });
    }

    // SEQUENTIAL SAMPLE VALIDATION
    if (styleId && !adminOverride) {
      const { productionBlockingValidationService } = await import('../services/productionBlockingValidation.service');

      if (sampleType === 'PP_SAMPLE') {
        const validation = await productionBlockingValidationService.validatePPSampleCreation(styleId);
        if (!validation.canCreate) {
          return res.status(400).json({
            error: 'Sample Creation Blocked',
            message: validation.blocker?.message,
            prerequisiteType: validation.blocker?.prerequisiteType,
          });
        }
      } else if (sampleType === 'SIZE_SET_SAMPLE') {
        const validation = await productionBlockingValidationService.validateSizeSetSampleCreation(styleId);
        if (!validation.canCreate) {
          return res.status(400).json({
            error: 'Sample Creation Blocked',
            message: validation.blocker?.message,
            prerequisiteType: validation.blocker?.prerequisiteType,
          });
        }
      }
    }

    // Admin override validation
    if (adminOverride) {
      const userRole = (req as any).user?.role;
      if (userRole !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can override blocking rules' });
      }
      if (!overrideReason) {
        return res.status(400).json({ error: 'Override reason is required when using admin override' });
      }
    }

    // Validate customer exists
    const customer = await prisma.customers.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      return res.status(400).json({ error: 'Customer not found' });
    }

    // Validate style if provided
    let style = null;
    if (styleId) {
      style = await prisma.styles.findUnique({
        where: { id: styleId },
        select: { id: true, styleCode: true, styleName: true },
      });
      if (!style) {
        return res.status(400).json({ error: 'Style not found' });
      }
    }

    // Determine version for FIT samples
    let version = 1;
    if (sampleType === 'FIT_SAMPLE' && styleId) {
      const existingFitSamples = await prisma.samples.count({
        where: {
          styleId,
          sampleType: 'FIT_SAMPLE',
        },
      });
      version = existingFitSamples + 1;
    }

    // Generate sample number
    const sampleNumber = await generateSampleNumber(sampleType, style?.styleCode, version);

    // Create sample with nested data
    const sample = await prisma.samples.create({
      data: {
        id: randomUUID(),
        sampleNumber,
        customerId,
        styleId: styleId || null,
        sampleType,
        requestDate: requestDate ? new Date(requestDate) : new Date(),
        requiredDate: new Date(requiredDate),
        status: 'REQUESTED',
        remarks: remarks || null,
        createdById: userId,
        version,
        linkedDispatchId: linkedDispatchId || null,
        productionLot: productionLot || null,
        sentTo: sentTo || null,
        purpose: purpose || null,
        // Create nested measurements if provided
        measurements: measurements?.length
          ? {
              createMany: {
                data: measurements.map((m: any) => ({
                  id: randomUUID(),
                  sizeId: m.sizeId || null,
                  measurementPoint: m.measurementPoint,
                  specValue: m.specValue,
                  actualValue: m.actualValue || null,
                  tolerance: m.tolerance || 0.5,
                })),
              },
            }
          : undefined,
        // Create nested colorways if provided (PP samples)
        colorways: colorways?.length
          ? {
              createMany: {
                data: colorways.map((c: any) => ({
                  id: randomUUID(),
                  colorId: c.colorId,
                  sizeId: c.sizeId || null,
                  fabricLot: c.fabricLot || null,
                  qtySent: c.qtySent || 1,
                  status: 'PENDING',
                })),
              },
            }
          : undefined,
        // Create nested size sets if provided (Size Set samples)
        sizeSets: sizeSets?.length
          ? {
              createMany: {
                data: sizeSets.map((s: any) => ({
                  id: randomUUID(),
                  sizeId: s.sizeId,
                  colorId: s.colorId,
                  qty: s.qty || 1,
                  status: 'PENDING',
                })),
              },
            }
          : undefined,
      },
      include: {
        customers: { select: { id: true, code: true, name: true } },
        styles: { select: { id: true, styleCode: true, styleName: true } },
        users: { select: { id: true, firstName: true, lastName: true, email: true } },
        measurements: {
          include: {
            size: { select: { id: true, sizeName: true, sizeCode: true } },
          },
        },
        colorways: {
          include: {
            color: { select: { id: true, colorName: true, colorCode: true } },
            size: { select: { id: true, sizeName: true, sizeCode: true } },
          },
        },
        sizeSets: {
          include: {
            size: { select: { id: true, sizeName: true, sizeCode: true } },
            color: { select: { id: true, colorName: true, colorCode: true } },
          },
        },
      },
    });

    // Log admin override if used
    if (adminOverride && styleId) {
      const { productionBlockingValidationService } = await import('../services/productionBlockingValidation.service');
      await productionBlockingValidationService.logOverride({
        blockType: 'SAMPLE_CREATION',
        sampleId: sample.id,
        blockedSampleType: sampleType,
        prerequisiteSampleType: sampleType === 'PP_SAMPLE' ? 'FIT_SAMPLE' : 'PP_SAMPLE',
        overrideReason: overrideReason || 'No reason provided',
        overriddenById: userId,
      });
    }

    logInfo('Sample created', { sampleNumber, sampleType });

    // Transform response
    const sampleData = sample as any;
    const response = {
      ...serializeSample(sampleData),
      customer: sampleData.customers,
      style: sampleData.styles,
      createdBy: sampleData.users ? {
        id: sampleData.users.id,
        name: `${sampleData.users.firstName} ${sampleData.users.lastName}`,
        email: sampleData.users.email,
      } : null,
      customers: undefined,
      styles: undefined,
      users: undefined,
    };

    res.status(201).json({
      data: response,
      message: 'Sample created successfully',
    });
  } catch (error: any) {
    logError('Error creating sample:', error);
    res.status(500).json({ error: 'Failed to create sample', details: error.message });
  }
};

/**
 * Get all samples with pagination and filtering
 */
export const getAllSamples = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      sampleType,
      status,
      customerId,
      styleId,
      fromDate,
      toDate,
      pendingApproval,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    // Search filter
    if (search) {
      where.OR = [
        { sampleNumber: { contains: search as string, mode: 'insensitive' } },
        { customers: { name: { contains: search as string, mode: 'insensitive' } } },
        { styles: { styleCode: { contains: search as string, mode: 'insensitive' } } },
        { styles: { styleName: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    // Sample type filter (can be array)
    if (sampleType) {
      const types = Array.isArray(sampleType) ? sampleType : [sampleType];
      where.sampleType = { in: types };
    }

    // Status filter (can be array)
    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      where.status = { in: statuses };
    }

    // Customer filter
    if (customerId) {
      where.customerId = customerId as string;
    }

    // Style filter
    if (styleId) {
      where.styleId = styleId as string;
    }

    // Date range filter
    if (fromDate || toDate) {
      where.requestDate = {};
      if (fromDate) {
        where.requestDate.gte = new Date(fromDate as string);
      }
      if (toDate) {
        where.requestDate.lte = new Date(toDate as string);
      }
    }

    // Pending approval filter
    if (pendingApproval === 'true') {
      where.status = { in: ['SUBMITTED', 'SENT', 'FEEDBACK_PENDING'] };
    }

    // Get total count
    const total = await prisma.samples.count({ where });

    // Get paginated results
    const samples = await prisma.samples.findMany({
      where,
      skip,
      take: limitNum,
      include: {
        customers: { select: { id: true, code: true, name: true } },
        styles: { select: { id: true, styleCode: true, styleName: true, customerName: true } },
        users: { select: { id: true, firstName: true, lastName: true } },
        _count: {
          select: {
            measurements: true,
            colorways: true,
            sizeSets: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    // Transform response
    const data = samples.map((sample) => {
      const s = sample as any;
      return {
        ...s,
        customer: s.customers,
        style: s.styles,
        createdBy: s.users ? {
          id: s.users.id,
          name: `${s.users.firstName} ${s.users.lastName}`,
        } : null,
        measurementCount: s._count?.measurements || 0,
        colorwayCount: s._count?.colorways || 0,
        sizeSetCount: s._count?.sizeSets || 0,
        customers: undefined,
        styles: undefined,
        users: undefined,
        _count: undefined,
      };
    });

    res.json({
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    logError('Error fetching samples:', error);
    res.status(500).json({ error: 'Failed to fetch samples', details: error.message });
  }
};

/**
 * Get single sample by ID with all related data
 */
export const getSampleById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const sample = await prisma.samples.findUnique({
      where: { id },
      include: {
        customers: { select: { id: true, code: true, name: true, contactPerson: true, email: true } },
        styles: {
          select: {
            id: true,
            styleCode: true,
            styleName: true,
            customerName: true,
            brandName: true,
            size_options: { select: { id: true, sizeName: true, sizeCode: true, sortOrder: true } },
            color_options: { select: { id: true, colorName: true, colorCode: true, sortOrder: true } },
          },
        },
        users: { select: { id: true, firstName: true, lastName: true, email: true } },
        measurements: {
          include: {
            size: { select: { id: true, sizeName: true, sizeCode: true } },
          },
          orderBy: { measurementPoint: 'asc' },
        },
        colorways: {
          include: {
            color: { select: { id: true, colorName: true, colorCode: true } },
            size: { select: { id: true, sizeName: true, sizeCode: true } },
          },
        },
        sizeSets: {
          include: {
            size: { select: { id: true, sizeName: true, sizeCode: true } },
            color: { select: { id: true, colorName: true, colorCode: true } },
          },
        },
      },
    });

    if (!sample) {
      return res.status(404).json({ error: 'Sample not found' });
    }

    // Get related samples (same style, different types)
    let relatedSamples: any[] = [];
    if (sample.styleId) {
      relatedSamples = await prisma.samples.findMany({
        where: {
          styleId: sample.styleId,
          id: { not: sample.id },
        },
        select: {
          id: true,
          sampleNumber: true,
          sampleType: true,
          status: true,
          version: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    }

    // Transform response
    const s = sample as any;
    const response = {
      ...serializeSample(s),
      customer: s.customers,
      style: s.styles,
      createdBy: s.users ? {
        id: s.users.id,
        name: `${s.users.firstName} ${s.users.lastName}`,
        email: s.users.email,
      } : null,
      relatedSamples,
      customers: undefined,
      styles: undefined,
      users: undefined,
    };

    res.json({ data: response });
  } catch (error: any) {
    logError('Error fetching sample:', error);
    res.status(500).json({ error: 'Failed to fetch sample', details: error.message });
  }
};

/**
 * Update sample
 */
export const updateSample = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      requiredDate,
      completionDate,
      status,
      customerFeedback,
      remarks,
      sentDate,
      courierMode,
      trackingNumber,
      receivedDate,
      feedbackDate,
      measurementComments,
      revisionRequired,
      nextAction,
    } = req.body;

    // Check if sample exists
    const existing = await prisma.samples.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Sample not found' });
    }

    // Build update data
    const updateData: any = {};

    if (requiredDate !== undefined) updateData.requiredDate = new Date(requiredDate);
    if (completionDate !== undefined)
      updateData.completionDate = completionDate ? new Date(completionDate) : null;
    if (status !== undefined) updateData.status = status;
    if (customerFeedback !== undefined) updateData.customerFeedback = customerFeedback || null;
    if (remarks !== undefined) updateData.remarks = remarks || null;
    if (sentDate !== undefined) updateData.sentDate = sentDate ? new Date(sentDate) : null;
    if (courierMode !== undefined) updateData.courierMode = courierMode || null;
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber || null;
    if (receivedDate !== undefined)
      updateData.receivedDate = receivedDate ? new Date(receivedDate) : null;
    if (feedbackDate !== undefined)
      updateData.feedbackDate = feedbackDate ? new Date(feedbackDate) : null;
    if (measurementComments !== undefined)
      updateData.measurementComments = measurementComments || null;
    if (revisionRequired !== undefined) updateData.revisionRequired = revisionRequired;
    if (nextAction !== undefined) updateData.nextAction = nextAction || null;

    const updated = await prisma.samples.update({
      where: { id },
      data: updateData,
      include: {
        customers: { select: { id: true, code: true, name: true } },
        styles: { select: { id: true, styleCode: true, styleName: true } },
        users: { select: { id: true, firstName: true, lastName: true } },
        measurements: {
          include: {
            size: { select: { id: true, sizeName: true, sizeCode: true } },
          },
        },
        colorways: {
          include: {
            color: { select: { id: true, colorName: true, colorCode: true } },
            size: { select: { id: true, sizeName: true, sizeCode: true } },
          },
        },
        sizeSets: {
          include: {
            size: { select: { id: true, sizeName: true, sizeCode: true } },
            color: { select: { id: true, colorName: true, colorCode: true } },
          },
        },
      },
    });

    logInfo('Sample updated', { id, sampleNumber: updated.sampleNumber });

    // Transform response
    const u = updated as any;
    const response = {
      ...serializeSample(u),
      customer: u.customers,
      style: u.styles,
      createdBy: u.users ? {
        id: u.users.id,
        name: `${u.users.firstName} ${u.users.lastName}`,
      } : null,
      customers: undefined,
      styles: undefined,
      users: undefined,
    };

    res.json({
      data: response,
      message: 'Sample updated successfully',
    });
  } catch (error: any) {
    logError('Error updating sample:', error);
    res.status(500).json({ error: 'Failed to update sample', details: error.message });
  }
};

/**
 * Update sample status (with feedback)
 */
export const updateSampleStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, feedback, comments } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const existing = await prisma.samples.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Sample not found' });
    }

    const updateData: any = {
      status,
    };

    if (feedback) {
      updateData.customerFeedback = feedback;
    }
    if (comments) {
      updateData.measurementComments = comments;
    }

    // Auto-set dates based on status
    if (status === 'APPROVED' || status === 'REJECTED' || status === 'APPROVED_WITH_COMMENTS') {
      updateData.feedbackDate = new Date();
    }
    if (status === 'IN_PROGRESS') {
      updateData.completionDate = null;
    }
    if (status === 'SUBMITTED' && !existing.completionDate) {
      updateData.completionDate = new Date();
    }

    const updated = await prisma.samples.update({
      where: { id },
      data: updateData,
      include: {
        customers: { select: { id: true, code: true, name: true } },
        styles: { select: { id: true, styleCode: true, styleName: true } },
        users: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    logInfo('Sample status updated', { id, status });

    const u = updated as any;
    res.json({
      data: {
        ...u,
        customer: u.customers,
        style: u.styles,
        createdBy: u.users ? {
          id: u.users.id,
          name: `${u.users.firstName} ${u.users.lastName}`,
        } : null,
        customers: undefined,
        styles: undefined,
        users: undefined,
      },
      message: 'Sample status updated successfully',
    });
  } catch (error: any) {
    logError('Error updating sample status:', error);
    res.status(500).json({ error: 'Failed to update sample status', details: error.message });
  }
};

/**
 * Delete sample
 */
export const deleteSample = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.samples.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Sample not found' });
    }

    // Check if sample can be deleted (not approved or in use)
    if (existing.status === 'APPROVED' || existing.status === 'APPROVED_WITH_COMMENTS') {
      return res.status(400).json({
        error: 'Cannot delete approved sample',
        message: 'Approved samples cannot be deleted. Please reject first if needed.',
      });
    }

    // Delete sample (cascade will delete measurements, colorways, size sets)
    await prisma.samples.delete({
      where: { id },
    });

    logInfo('Sample deleted', { id, sampleNumber: existing.sampleNumber });

    res.json({ message: 'Sample deleted successfully' });
  } catch (error: any) {
    logError('Error deleting sample:', error);
    res.status(500).json({ error: 'Failed to delete sample', details: error.message });
  }
};

/**
 * Update measurements for a sample
 */
export const updateMeasurements = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { measurements } = req.body;

    const existing = await prisma.samples.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Sample not found' });
    }

    // Delete existing measurements and create new ones
    await prisma.$transaction([
      prisma.sample_measurements.deleteMany({
        where: { sampleId: id },
      }),
      prisma.sample_measurements.createMany({
        data: measurements.map((m: any) => ({
          id: randomUUID(),
          sampleId: id,
          sizeId: m.sizeId || null,
          measurementPoint: m.measurementPoint,
          specValue: m.specValue,
          actualValue: m.actualValue || null,
          tolerance: m.tolerance || 0.5,
        })),
      }),
    ]);

    // Fetch updated sample
    const updated = await prisma.samples.findUnique({
      where: { id },
      include: {
        measurements: {
          include: {
            size: { select: { id: true, sizeName: true, sizeCode: true } },
          },
        },
      },
    });

    logInfo('Sample measurements updated', { id });

    res.json({
      data: serializeSample(updated),
      message: 'Measurements updated successfully',
    });
  } catch (error: any) {
    logError('Error updating measurements:', error);
    res.status(500).json({ error: 'Failed to update measurements', details: error.message });
  }
};

/**
 * Record actual measurements (for QC)
 */
export const recordActualMeasurements = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { measurements } = req.body;

    const existing = await prisma.samples.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Sample not found' });
    }

    // Update each measurement's actual value - fetch measurement to check tolerance
    for (const m of measurements as Array<{ id: string; actualValue: number }>) {
      const measurement = await prisma.sample_measurements.findUnique({
        where: { id: m.id },
      });
      if (measurement) {
        const diff = Math.abs(m.actualValue - Number(measurement.specValue));
        const tolerance = Number(measurement.tolerance) || 0.5;
        await prisma.sample_measurements.update({
          where: { id: m.id },
          data: {
            actualValue: m.actualValue,
            status: diff <= tolerance ? 'PASS' : 'FAIL',
          },
        });
      }
    }

    // Fetch updated sample
    const updated = await prisma.samples.findUnique({
      where: { id },
      include: {
        measurements: {
          include: {
            size: { select: { id: true, sizeName: true, sizeCode: true } },
          },
        },
      },
    });

    logInfo('Actual measurements recorded', { id });

    res.json({
      data: serializeSample(updated),
      message: 'Actual measurements recorded successfully',
    });
  } catch (error: any) {
    logError('Error recording actual measurements:', error);
    res.status(500).json({ error: 'Failed to record measurements', details: error.message });
  }
};

/**
 * Mark sample as sent
 */
export const markAsSent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sentDate, courierMode, trackingNumber } = req.body;

    const existing = await prisma.samples.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Sample not found' });
    }

    const updated = await prisma.samples.update({
      where: { id },
      data: {
        status: 'SENT',
        sentDate: sentDate ? new Date(sentDate) : new Date(),
        courierMode: courierMode || null,
        trackingNumber: trackingNumber || null,
      },
      include: {
        customers: { select: { id: true, code: true, name: true } },
        styles: { select: { id: true, styleCode: true, styleName: true } },
      },
    });

    logInfo('Sample marked as sent', { id, trackingNumber });

    const u = updated as any;
    res.json({
      data: {
        ...u,
        customer: u.customers,
        style: u.styles,
        customers: undefined,
        styles: undefined,
      },
      message: 'Sample marked as sent',
    });
  } catch (error: any) {
    logError('Error marking sample as sent:', error);
    res.status(500).json({ error: 'Failed to update sample', details: error.message });
  }
};

/**
 * Record buyer receipt
 */
export const recordReceipt = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { receivedDate, remarks } = req.body;

    const existing = await prisma.samples.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Sample not found' });
    }

    const updated = await prisma.samples.update({
      where: { id },
      data: {
        status: 'FEEDBACK_PENDING',
        receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
        remarks: remarks || existing.remarks,
      },
      include: {
        customers: { select: { id: true, code: true, name: true } },
        styles: { select: { id: true, styleCode: true, styleName: true } },
      },
    });

    logInfo('Sample receipt recorded', { id });

    const u = updated as any;
    res.json({
      data: {
        ...u,
        customer: u.customers,
        style: u.styles,
        customers: undefined,
        styles: undefined,
      },
      message: 'Receipt recorded successfully',
    });
  } catch (error: any) {
    logError('Error recording receipt:', error);
    res.status(500).json({ error: 'Failed to record receipt', details: error.message });
  }
};

/**
 * Record buyer feedback
 */
export const recordFeedback = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, feedback, feedbackDate, measurementComments } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const existing = await prisma.samples.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Sample not found' });
    }

    const updated = await prisma.samples.update({
      where: { id },
      data: {
        status,
        customerFeedback: feedback || null,
        feedbackDate: feedbackDate ? new Date(feedbackDate) : new Date(),
        measurementComments: measurementComments || null,
        revisionRequired: status === 'REVISION_NEEDED' || status === 'REJECTED',
      },
      include: {
        customers: { select: { id: true, code: true, name: true } },
        styles: { select: { id: true, styleCode: true, styleName: true } },
      },
    });

    logInfo('Sample feedback recorded', { id, status });

    const u = updated as any;
    res.json({
      data: {
        ...u,
        customer: u.customers,
        style: u.styles,
        customers: undefined,
        styles: undefined,
      },
      message: 'Feedback recorded successfully',
    });
  } catch (error: any) {
    logError('Error recording feedback:', error);
    res.status(500).json({ error: 'Failed to record feedback', details: error.message });
  }
};

/**
 * Create a revision of rejected FIT sample
 */
export const createRevision = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const { id } = req.params;

    // Get original sample
    const original = await prisma.samples.findUnique({
      where: { id },
      include: {
        measurements: true,
        styles: { select: { styleCode: true } },
      },
    });

    if (!original) {
      return res.status(404).json({ error: 'Sample not found' });
    }

    if (original.sampleType !== 'FIT_SAMPLE') {
      return res.status(400).json({ error: 'Revisions are only for FIT samples' });
    }

    // Get next version number
    const existingVersions = await prisma.samples.count({
      where: {
        styleId: original.styleId,
        sampleType: 'FIT_SAMPLE',
      },
    });

    const newVersion = existingVersions + 1;
    const sampleNumber = await generateSampleNumber(
      'FIT_SAMPLE',
      original.styles?.styleCode,
      newVersion
    );

    // Create new sample with copied measurements
    const revision = await prisma.samples.create({
      data: {
        id: randomUUID(),
        sampleNumber,
        customerId: original.customerId,
        styleId: original.styleId,
        sampleType: 'FIT_SAMPLE',
        requestDate: new Date(),
        requiredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        status: 'REQUESTED',
        remarks: `Revision of ${original.sampleNumber}`,
        createdById: userId,
        version: newVersion,
        // Copy measurements
        measurements: {
          createMany: {
            data: original.measurements.map((m) => ({
              id: randomUUID(),
              sizeId: m.sizeId,
              measurementPoint: m.measurementPoint,
              specValue: m.specValue,
              actualValue: null,
              tolerance: m.tolerance,
            })),
          },
        },
      },
      include: {
        customers: { select: { id: true, code: true, name: true } },
        styles: { select: { id: true, styleCode: true, styleName: true } },
        users: { select: { id: true, firstName: true, lastName: true } },
        measurements: true,
      },
    });

    logInfo('Sample revision created', { originalId: id, revisionId: revision.id, version: newVersion });

    res.status(201).json({
      data: {
        ...serializeSample(revision),
        customer: revision.customers,
        style: revision.styles,
        createdBy: revision.users,
        customers: undefined,
        styles: undefined,
        users: undefined,
      },
      message: `Revision v${newVersion} created successfully`,
    });
  } catch (error: any) {
    logError('Error creating revision:', error);
    res.status(500).json({ error: 'Failed to create revision', details: error.message });
  }
};

/**
 * Get samples summary/stats
 */
export const getSummary = async (req: Request, res: Response) => {
  try {
    const { styleId } = req.query;

    const where: any = {};
    if (styleId) {
      where.styleId = styleId as string;
    }

    // Get counts by type
    const byType = await prisma.samples.groupBy({
      by: ['sampleType'],
      where,
      _count: { id: true },
    });

    // Get counts by status
    const byStatus = await prisma.samples.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    // Get pending approval count
    const pendingApproval = await prisma.samples.count({
      where: {
        ...where,
        status: { in: ['SUBMITTED', 'SENT', 'FEEDBACK_PENDING'] },
      },
    });

    // Get overdue count
    const overdue = await prisma.samples.count({
      where: {
        ...where,
        requiredDate: { lt: new Date() },
        status: { notIn: ['APPROVED', 'APPROVED_WITH_COMMENTS', 'REJECTED'] },
      },
    });

    // Get recent activity
    const recentActivity = await prisma.samples.findMany({
      where,
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        customers: { select: { name: true } },
        styles: { select: { styleCode: true, styleName: true } },
      },
    });

    const total = await prisma.samples.count({ where });

    res.json({
      data: {
        total,
        byType: byType.map((t) => ({ type: t.sampleType, count: t._count.id })),
        byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
        pendingApproval,
        overdue,
        recentActivity: recentActivity.map((s) => ({
          ...s,
          customer: s.customers,
          style: s.styles,
          customers: undefined,
          styles: undefined,
        })),
      },
    });
  } catch (error: any) {
    logError('Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary', details: error.message });
  }
};

/**
 * Check sample approval gate for a style
 */
export const checkApprovalGate = async (req: Request, res: Response) => {
  try {
    const { styleId } = req.params;

    // Check FIT sample approval
    const fitApproved = await prisma.samples.count({
      where: {
        styleId,
        sampleType: 'FIT_SAMPLE',
        status: { in: ['APPROVED', 'APPROVED_WITH_COMMENTS'] },
      },
    });

    // Check PP sample approval
    const ppApproved = await prisma.samples.count({
      where: {
        styleId,
        sampleType: 'PP_SAMPLE',
        status: { in: ['APPROVED', 'APPROVED_WITH_COMMENTS'] },
      },
    });

    // Check Size Set sample approval
    const sizeSetApproved = await prisma.samples.count({
      where: {
        styleId,
        sampleType: 'SIZE_SET_SAMPLE',
        status: { in: ['APPROVED', 'APPROVED_WITH_COMMENTS'] },
      },
    });

    res.json({
      data: {
        fitApproved: fitApproved > 0,
        ppApproved: ppApproved > 0,
        sizeSetApproved: sizeSetApproved > 0,
        canCreateWorkOrder: sizeSetApproved > 0,
      },
    });
  } catch (error: any) {
    logError('Error checking approval gate:', error);
    res.status(500).json({ error: 'Failed to check approval gate', details: error.message });
  }
};

/**
 * Search samples (for picker/dropdown)
 */
export const searchSamples = async (req: Request, res: Response) => {
  try {
    const { search = '', sampleType, limit = 20 } = req.query;
    const limitNum = parseInt(limit as string, 10);

    const where: any = {};

    if (search) {
      where.OR = [
        { sampleNumber: { contains: search as string, mode: 'insensitive' } },
        { styles: { styleCode: { contains: search as string, mode: 'insensitive' } } },
        { styles: { styleName: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    if (sampleType) {
      where.sampleType = sampleType as string;
    }

    const samples = await prisma.samples.findMany({
      where,
      take: limitNum,
      select: {
        id: true,
        sampleNumber: true,
        sampleType: true,
        status: true,
        version: true,
        styles: { select: { styleCode: true, styleName: true } },
        customers: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      data: samples.map((s) => ({
        ...s,
        style: s.styles,
        customer: s.customers,
        styles: undefined,
        customers: undefined,
      })),
    });
  } catch (error: any) {
    logError('Error searching samples:', error);
    res.status(500).json({ error: 'Failed to search samples', details: error.message });
  }
};
