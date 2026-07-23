import { Request, Response } from 'express';
import prisma from '../config/database';
import { logInfo, logDebug } from '../utils/logger';
import { randomUUID } from 'crypto';
import { NotFoundError, ValidationError, UnauthorizedError } from '../errors';

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
async function generateSampleNumber(sampleType: string, styleCode?: string, version: number = 1): Promise<string> {
  const typePrefix = sampleType.replace('_SAMPLE', '').replace('_', '-');
  const styleRef = styleCode || 'GEN';
  const date = new Date();
  const yearMonth = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;

  if (sampleType === 'FIT_SAMPLE') {
    return `${typePrefix}-${styleRef}-v${version}`;
  }

  // Derive the sequence from the MAX existing number for this month, not a row count:
  // count+1 re-minted already-used numbers after a hard delete or under concurrency
  // (bug-hunt samples-embroidery-10). Full fix also needs @@unique on samples.sampleNumber
  // (schema migration — flagged separately, not done here).
  const monthPrefix = `${typePrefix}-${yearMonth}-`;
  const latest = await prisma.samples.findFirst({
    where: {
      sampleType: sampleType as any,
      sampleNumber: { startsWith: monthPrefix },
    },
    orderBy: { sampleNumber: 'desc' },
    select: { sampleNumber: true },
  });

  let nextSeq = 1;
  const match = latest?.sampleNumber.match(/-(\d{4})$/);
  if (match && match[1]) {
    nextSeq = parseInt(match[1], 10) + 1;
  }

  return `${monthPrefix}${String(nextSeq).padStart(4, '0')}`;
}

/**
 * Create a new sample
 */
export const createSample = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
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
    throw new ValidationError('Customer is required');
  }
  if (!sampleType) {
    throw new ValidationError('Sample type is required');
  }
  if (!requiredDate) {
    throw new ValidationError('Required date is required');
  }

  // SEQUENTIAL SAMPLE VALIDATION
  if (styleId && !adminOverride) {
    const { productionBlockingValidationService } = await import('../services/productionBlockingValidation.service');

    if (sampleType === 'PP_SAMPLE') {
      const validation = await productionBlockingValidationService.validatePPSampleCreation(styleId);
      if (!validation.canCreate) {
        throw new ValidationError(validation.blocker?.message || 'Sample Creation Blocked');
      }
    } else if (sampleType === 'SIZE_SET_SAMPLE') {
      const validation = await productionBlockingValidationService.validateSizeSetSampleCreation(styleId);
      if (!validation.canCreate) {
        throw new ValidationError(validation.blocker?.message || 'Sample Creation Blocked');
      }
    }
  }

  // Admin override validation
  if (adminOverride) {
    const userRole = req.user?.role;
    if (userRole !== 'ADMIN') {
      throw new ValidationError('Only admins can override blocking rules');
    }
    if (!overrideReason) {
      throw new ValidationError('Override reason is required when using admin override');
    }
  }

  // Validate customer exists
  const customer = await prisma.customers.findUnique({
    where: { id: customerId },
  });
  if (!customer) {
    throw new NotFoundError('Customer', customerId);
  }

  // Validate style if provided
  let style = null;
  if (styleId) {
    style = await prisma.styles.findUnique({
      where: { id: styleId },
      select: { id: true, styleCode: true, styleName: true },
    });
    if (!style) {
      throw new NotFoundError('Style', styleId);
    }
  }

  // Determine version for FIT samples — max(version)+1, not count+1, so a deleted
  // intermediate version can never be re-minted (bug-hunt samples-embroidery-10)
  let version = 1;
  if (sampleType === 'FIT_SAMPLE' && styleId) {
    const maxVersion = await prisma.samples.aggregate({
      where: {
        styleId,
        sampleType: 'FIT_SAMPLE',
      },
      _max: { version: true },
    });
    version = (maxVersion._max.version || 0) + 1;
  }

  // Generate sample number
  const sampleNumber = await generateSampleNumber(sampleType, style?.styleCode, version);

  // Create sample + override audit log atomically: previously logOverride ran after the
  // create, outside any transaction, and threw — committing the sample while losing the
  // mandatory audit record (bug-hunt samples-embroidery-11)
  const sample = await prisma.$transaction(async (txClient) => {
    const created = await txClient.samples.create({
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

    // Log admin override if used — on the same tx, so the sample is not committed
    // without its audit record (bug-hunt samples-embroidery-11)
    if (adminOverride && styleId) {
      const { productionBlockingValidationService } = await import('../services/productionBlockingValidation.service');
      await productionBlockingValidationService.logOverride(
        {
          blockType: 'SAMPLE_CREATION',
          sampleId: created.id,
          blockedSampleType: sampleType,
          prerequisiteSampleType: sampleType === 'PP_SAMPLE' ? 'FIT_SAMPLE' : 'PP_SAMPLE',
          overrideReason: overrideReason || 'No reason provided',
          overriddenById: userId,
        },
        txClient
      );
    }

    return created;
  });

  logInfo('Sample created', { sampleNumber, sampleType });

  // Transform response
  const sampleData = sample as any;
  const response = {
    ...serializeSample(sampleData),
    customer: sampleData.customers,
    style: sampleData.styles,
    createdBy: sampleData.users
      ? {
          id: sampleData.users.id,
          name: `${sampleData.users.firstName} ${sampleData.users.lastName}`,
          email: sampleData.users.email,
        }
      : null,
    customers: undefined,
    styles: undefined,
    users: undefined,
  };

  res.status(201).json({
    data: response,
    message: 'Sample created successfully',
  });
};

/**
 * Get all samples with pagination and filtering
 */
export const getAllSamples = async (req: Request, res: Response) => {
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

  // Pending approval filter — validateQuery transforms 'true' to boolean true, so compare
  // against the boolean (string compare silently disabled the filter; bug-hunt samples-embroidery-8)
  if ((pendingApproval as unknown) === true || pendingApproval === 'true') {
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
      createdBy: s.users
        ? {
            id: s.users.id,
            name: `${s.users.firstName} ${s.users.lastName}`,
          }
        : null,
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
};

/**
 * Get single sample by ID with all related data
 */
export const getSampleById = async (req: Request, res: Response) => {
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
    throw new NotFoundError('Sample', id);
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
    createdBy: s.users
      ? {
          id: s.users.id,
          name: `${s.users.firstName} ${s.users.lastName}`,
          email: s.users.email,
        }
      : null,
    relatedSamples,
    customers: undefined,
    styles: undefined,
    users: undefined,
  };

  res.json({ data: response });
};

/**
 * Update sample
 */
export const updateSample = async (req: Request, res: Response) => {
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
    throw new NotFoundError('Sample', id);
  }

  // Build update data
  const updateData: any = {};

  if (requiredDate !== undefined) updateData.requiredDate = new Date(requiredDate);
  if (completionDate !== undefined) updateData.completionDate = completionDate ? new Date(completionDate) : null;
  if (status !== undefined) updateData.status = status;
  if (customerFeedback !== undefined) updateData.customerFeedback = customerFeedback || null;
  if (remarks !== undefined) updateData.remarks = remarks || null;
  if (sentDate !== undefined) updateData.sentDate = sentDate ? new Date(sentDate) : null;
  if (courierMode !== undefined) updateData.courierMode = courierMode || null;
  if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber || null;
  if (receivedDate !== undefined) updateData.receivedDate = receivedDate ? new Date(receivedDate) : null;
  if (feedbackDate !== undefined) updateData.feedbackDate = feedbackDate ? new Date(feedbackDate) : null;
  if (measurementComments !== undefined) updateData.measurementComments = measurementComments || null;
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
    createdBy: u.users
      ? {
          id: u.users.id,
          name: `${u.users.firstName} ${u.users.lastName}`,
        }
      : null,
    customers: undefined,
    styles: undefined,
    users: undefined,
  };

  res.json({
    data: response,
    message: 'Sample updated successfully',
  });
};

/**
 * Update sample status (with feedback)
 */
export const updateSampleStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, feedback, comments } = req.body;

  if (!status) {
    throw new ValidationError('Status is required');
  }

  const existing = await prisma.samples.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Sample', id);
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
      createdBy: u.users
        ? {
            id: u.users.id,
            name: `${u.users.firstName} ${u.users.lastName}`,
          }
        : null,
      customers: undefined,
      styles: undefined,
      users: undefined,
    },
    message: 'Sample status updated successfully',
  });
};

/**
 * Delete sample
 */
export const deleteSample = async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.samples.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Sample', id);
  }

  // Check if sample can be deleted (not approved or in use)
  if (existing.status === 'APPROVED' || existing.status === 'APPROVED_WITH_COMMENTS') {
    throw new ValidationError(
      'Cannot delete approved sample. Approved samples cannot be deleted. Please reject first if needed.'
    );
  }

  // Delete sample (cascade will delete measurements, colorways, size sets)
  await prisma.samples.delete({
    where: { id },
  });

  logInfo('Sample deleted', { id, sampleNumber: existing.sampleNumber });

  res.json({ message: 'Sample deleted successfully' });
};

/**
 * Update measurements for a sample
 */
export const updateMeasurements = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { measurements } = req.body;

  const existing = await prisma.samples.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Sample', id);
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
};

/**
 * Record actual measurements (for QC)
 */
export const recordActualMeasurements = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { measurements } = req.body;

  const existing = await prisma.samples.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Sample', id);
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
};

/**
 * Mark sample as sent
 */
export const markAsSent = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { sentDate, courierMode, trackingNumber } = req.body;

  const existing = await prisma.samples.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Sample', id);
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
};

/**
 * Record buyer receipt
 */
export const recordReceipt = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { receivedDate, remarks } = req.body;

  const existing = await prisma.samples.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Sample', id);
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
};

/**
 * Record buyer feedback
 */
export const recordFeedback = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, feedback, feedbackDate, measurementComments } = req.body;

  if (!status) {
    throw new ValidationError('Status is required');
  }

  const existing = await prisma.samples.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Sample', id);
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
};

/**
 * Create a revision of rejected FIT sample
 */
export const createRevision = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new UnauthorizedError('User not authenticated');
  }
  const { id } = req.params;
  // Persist the schema-advertised revision fields instead of silently dropping them
  // (bug-hunt samples-embroidery-19)
  const { remarks, changesToMake } = req.body;

  // Get original sample
  const original = await prisma.samples.findUnique({
    where: { id },
    include: {
      measurements: true,
      styles: { select: { styleCode: true } },
    },
  });

  if (!original) {
    throw new NotFoundError('Sample', id);
  }

  if (original.sampleType !== 'FIT_SAMPLE') {
    throw new ValidationError('Revisions are only for FIT samples');
  }

  // Get next version number — max(version)+1, not count+1 (bug-hunt samples-embroidery-10)
  const maxVersion = await prisma.samples.aggregate({
    where: {
      styleId: original.styleId,
      sampleType: 'FIT_SAMPLE',
    },
    _max: { version: true },
  });

  const newVersion = (maxVersion._max.version || 0) + 1;
  const sampleNumber = await generateSampleNumber('FIT_SAMPLE', original.styles?.styleCode, newVersion);

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
      remarks: remarks || `Revision of ${original.sampleNumber}`,
      nextAction: changesToMake || null,
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
};

/**
 * Get samples summary/stats
 */
export const getSummary = async (req: Request, res: Response) => {
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
};

/**
 * Check sample approval gate for a style
 */
export const checkApprovalGate = async (req: Request, res: Response) => {
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
};

/**
 * Search samples (for picker/dropdown)
 */
export const searchSamples = async (req: Request, res: Response) => {
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
};
