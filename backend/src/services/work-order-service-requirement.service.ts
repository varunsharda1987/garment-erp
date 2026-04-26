/**
 * Work Order Service Requirement Service
 * Manages service requirements for work orders (embroidery, printing, dyeing, etc.)
 * Mirrors the Material MRP workflow for service procurement
 *
 * Priority Algorithm for Processor Suggestion:
 * 1. Preferred Processor (HIGH confidence) - From processor_rate_cards
 * 2. Recent Usage (MEDIUM confidence) - From recent service POs
 * 3. No Suggestion (LOW confidence) - Requires manual assignment
 */

import prisma from '../config/database';
import { ServiceRequirementStatus, RequirementSource, ServiceType, POCategory, POSource, Unit } from '@prisma/client';
import { generateCode } from '../utils/code-generator';
import { logDebug, logInfo, logError } from '../utils/logger';
import { NotFoundError, BusinessError } from '../errors';
import { Decimal } from '@prisma/client/runtime/library';
import { gstService } from './gst.service';

// ============================================
// TYPES
// ============================================

export interface ProcessorSuggestion {
  serviceType: ServiceType;
  suggestedProcessorId: string | null;
  suggestedProcessorName?: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  alternatives: ProcessorAlternative[];
}

export interface ProcessorAlternative {
  processorId: string;
  processorName: string;
  lastServiceDate?: Date;
  serviceCount?: number;
  ratePerUnit?: number;
}

export interface ProcessorSuggestionForRequirement {
  requirementId: string;
  serviceType: ServiceType;
  currentProcessorId: string | null;
  suggestedProcessorId: string | null;
  suggestedProcessorName?: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  alternatives: ProcessorAlternative[];
}

export interface BulkProcessorAssignment {
  requirementId: string;
  processorId: string;
}

export interface ServiceRequirementsSummary {
  totalServices: number;
  totalEstimatedCost: number;
  servicesWithProcessor: number;
  servicesWithoutProcessor: number;
  pendingCount: number;
  poGeneratedCount: number;
  inProgressCount: number;
  completedCount: number;
  byServiceType: Record<ServiceType, number>;
}

export interface OrderServiceRequirementsSummary {
  orderId: string;
  workOrderCount: number;
  totalServices: number;
  pendingServices: number;
  processorAssigned: number;
  poGenerated: number;
  completed: number;
  estimatedTotalCost: number;
  byServiceType: Record<string, { count: number; pending: number; poGenerated: number }>;
}

export interface CalculateServicesInput {
  workOrderId: string;
  userId: string;
}

export interface ServiceRequirementResponse {
  id: string;
  workOrderId: string;
  serviceType: ServiceType;
  processId?: string;
  quantityRequired: number;
  unit: string;
  preferredProcessorId?: string;
  preferredProcessor?: any;
  assignedProcessorId?: string;
  assignedProcessor?: any;
  estimatedRate?: number;
  estimatedTotal?: number;
  status: ServiceRequirementStatus;
  purchaseOrderId?: string;
  purchaseOrder?: any;
  workOrder?: any;
  styleProcess?: any;
  source: RequirementSource;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Map service type to PO category
 */
function mapServiceTypeToPOCategory(serviceType: ServiceType): POCategory {
  const mapping: Record<ServiceType, POCategory> = {
    [ServiceType.EMBROIDERY]: POCategory.EMBROIDERY_SERVICE,
    [ServiceType.PRINTING]: POCategory.PROCESSING, // Printing handled at Order level as PROCESSING
    [ServiceType.DYEING]: POCategory.PROCESSING, // Dyeing handled at Order level as PROCESSING
    [ServiceType.WASHING]: POCategory.WASHING_SERVICE,
    [ServiceType.FINISHING]: POCategory.FINISHING_SERVICE,
    [ServiceType.CUTTING]: POCategory.CUTTING_SERVICE,
    [ServiceType.STITCHING]: POCategory.STITCHING_SERVICE,
    [ServiceType.HANDWORK]: POCategory.HANDWORK_SERVICE,
    [ServiceType.SMOCKING]: POCategory.SMOCKING_SERVICE,
    [ServiceType.TRANSPORTATION]: POCategory.TRANSPORTATION_SERVICE,
    [ServiceType.OTHER]: POCategory.GENERAL, // Default for OTHER
  };

  return mapping[serviceType] || POCategory.GENERAL;
}

/**
 * Map process type string to ServiceType enum
 */
function mapProcessTypeToServiceType(processType: string): ServiceType | null {
  const upperType = processType.toUpperCase();

  // Direct matches
  if (upperType.includes('EMBROIDERY')) return ServiceType.EMBROIDERY;
  if (upperType.includes('PRINT')) return ServiceType.PRINTING;
  if (upperType.includes('DYE') || upperType.includes('DYEING')) return ServiceType.DYEING;
  if (upperType.includes('WASH')) return ServiceType.WASHING;
  if (upperType.includes('FINISH')) return ServiceType.FINISHING;
  if (upperType.includes('CUT')) return ServiceType.CUTTING;
  if (upperType.includes('STITCH') || upperType.includes('SEW')) return ServiceType.STITCHING;
  if (upperType.includes('HAND') || upperType.includes('HANDWORK')) return ServiceType.HANDWORK;
  if (upperType.includes('SMOCK')) return ServiceType.SMOCKING;
  if (upperType.includes('TRANSPORT') || upperType.includes('FREIGHT')) return ServiceType.TRANSPORTATION;

  return ServiceType.OTHER;
}

/**
 * Get standard Prisma includes for service requirements
 */
function getRequirementIncludes() {
  return {
    workOrder: {
      select: {
        id: true,
        workOrderNumber: true,
        totalQuantity: true,
        orderId: true,
        styles: {
          select: {
            id: true,
            styleCode: true,
            styleName: true,
          },
        },
      },
    },
    styleProcess: {
      select: {
        id: true,
        processType: true,
        processName: true,
      },
    },
    preferredProcessor: {
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
      },
    },
    assignedProcessor: {
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
      },
    },
    purchaseOrder: {
      select: {
        id: true,
        poNumber: true,
        status: true,
      },
    },
  };
}

/**
 * Map Prisma result to response format
 */
function mapToResponse(requirement: any): ServiceRequirementResponse {
  return {
    id: requirement.id,
    workOrderId: requirement.workOrderId,
    serviceType: requirement.serviceType,
    processId: requirement.processId || undefined,
    quantityRequired: Number(requirement.quantityRequired),
    unit: requirement.unit,
    preferredProcessorId: requirement.preferredProcessorId || undefined,
    preferredProcessor: requirement.preferredProcessor || undefined,
    assignedProcessorId: requirement.assignedProcessorId || undefined,
    assignedProcessor: requirement.assignedProcessor || undefined,
    estimatedRate: requirement.estimatedRate ? Number(requirement.estimatedRate) : undefined,
    estimatedTotal: requirement.estimatedTotal ? Number(requirement.estimatedTotal) : undefined,
    status: requirement.status,
    purchaseOrderId: requirement.purchaseOrderId || undefined,
    purchaseOrder: requirement.purchaseOrder || undefined,
    workOrder: requirement.workOrder || undefined,
    styleProcess: requirement.styleProcess || undefined,
    source: requirement.source,
    notes: requirement.notes || undefined,
    createdAt: requirement.createdAt,
    updatedAt: requirement.updatedAt,
  };
}

// ============================================
// CORE SERVICE REQUIREMENT CALCULATION
// ============================================

/**
 * Calculate service requirements from work order's style processes
 * Analyzes style_processes and creates service requirement records
 */
export async function calculateRequirementsFromWorkOrder(input: CalculateServicesInput): Promise<{
  requirements: ServiceRequirementResponse[];
  summary: {
    totalServices: number;
    totalEstimatedCost: number;
    servicesWithPreferredProcessor: number;
    servicesWithoutProcessor: number;
  };
}> {
  const { workOrderId, userId } = input;

  logInfo('Calculating service requirements for work order', { workOrderId });

  // Get work order with style and style_processes
  // Note: work_orders has direct relation to styles (not through orders)
  const workOrder = await prisma.work_orders.findUnique({
    where: { id: workOrderId },
    include: {
      styles: {
        include: {
          style_processes: {
            where: { isRequired: true }, // Note: style_processes uses isRequired, not isActive
          },
        },
      },
    },
  });

  if (!workOrder) {
    throw new NotFoundError('Work Order', workOrderId);
  }

  const style = workOrder.styles;
  if (!style) {
    throw new BusinessError('Work order has no associated style');
  }

  if (!style.style_processes || style.style_processes.length === 0) {
    logInfo('No required style processes found for work order', { workOrderId });
    return {
      requirements: [],
      summary: {
        totalServices: 0,
        totalEstimatedCost: 0,
        servicesWithPreferredProcessor: 0,
        servicesWithoutProcessor: 0,
      },
    };
  }

  // Idempotency guard: if service requirements already exist, return them
  const existingRequirements = await prisma.work_order_service_requirements.findMany({
    where: { workOrderId },
    include: getRequirementIncludes(),
  });

  if (existingRequirements.length > 0) {
    logInfo('Service requirements already exist for work order, returning existing', {
      workOrderId,
      existingCount: existingRequirements.length,
    });

    let existingCost = 0;
    let existingWithProcessor = 0;
    let existingWithoutProcessor = 0;

    for (const req of existingRequirements) {
      if (req.estimatedTotal) existingCost += Number(req.estimatedTotal);
      if (req.preferredProcessorId) existingWithProcessor++;
      else existingWithoutProcessor++;
    }

    return {
      requirements: existingRequirements.map(mapToResponse),
      summary: {
        totalServices: existingRequirements.length,
        totalEstimatedCost: existingCost,
        servicesWithPreferredProcessor: existingWithProcessor,
        servicesWithoutProcessor: existingWithoutProcessor,
      },
    };
  }

  const workOrderQuantity = Number(workOrder.totalQuantity);
  const requirements: ServiceRequirementResponse[] = [];
  let totalEstimatedCost = 0;
  let servicesWithProcessor = 0;
  let servicesWithoutProcessor = 0;

  // Process each style process
  for (const process of style.style_processes) {
    // Determine service type
    const serviceType = mapProcessTypeToServiceType(process.processType);
    if (!serviceType) {
      logDebug('Skipping process with unmappable type', {
        processId: process.id,
        processType: process.processType,
      });
      continue;
    }

    // Calculate quantity (typically PIECE for most services)
    const quantityRequired = workOrderQuantity;
    const unit = Unit.PIECE; // Can be customized based on service type

    // Find preferred processor from rate cards
    // Note: processor_rate_card doesn't have styleId, so we match by processingType only
    const rateCard = await prisma.processor_rate_card.findFirst({
      where: {
        processingType: process.processType,
        isActive: true,
      },
      include: {
        processor: {
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const preferredProcessorId = rateCard?.processorId || null;
    const estimatedRate = rateCard?.ratePerMeter ? Number(rateCard.ratePerMeter) : null;
    const estimatedTotal = estimatedRate ? estimatedRate * quantityRequired : null;

    if (estimatedTotal) {
      totalEstimatedCost += estimatedTotal;
    }

    if (preferredProcessorId) {
      servicesWithProcessor++;
    } else {
      servicesWithoutProcessor++;
    }

    // Create service requirement
    const requirement = await prisma.work_order_service_requirements.create({
      data: {
        workOrderId,
        serviceType,
        processId: process.id,
        quantityRequired,
        unit,
        preferredProcessorId,
        assignedProcessorId: preferredProcessorId, // Auto-assign if preferred exists
        estimatedRate: estimatedRate ? new Decimal(estimatedRate) : null,
        estimatedTotal: estimatedTotal ? new Decimal(estimatedTotal) : null,
        status: ServiceRequirementStatus.PENDING,
        source: RequirementSource.WORK_ORDER,
        notes: `Auto-generated from ${process.processType} process`,
        createdById: userId,
      },
      include: getRequirementIncludes(),
    });

    requirements.push(mapToResponse(requirement));
  }

  logInfo('Service requirements calculated', {
    workOrderId,
    totalServices: requirements.length,
    withProcessor: servicesWithProcessor,
    withoutProcessor: servicesWithoutProcessor,
    estimatedCost: totalEstimatedCost,
  });

  return {
    requirements,
    summary: {
      totalServices: requirements.length,
      totalEstimatedCost,
      servicesWithPreferredProcessor: servicesWithProcessor,
      servicesWithoutProcessor,
    },
  };
}

/**
 * Calculate service requirements for ALL work orders of an order.
 * Used during BOM approval to auto-calculate services in one click.
 */
export async function calculateServicesForOrder(
  orderId: string,
  userId: string
): Promise<{
  workOrdersProcessed: number;
  workOrdersSkipped: number;
  totalServicesCreated: number;
  totalEstimatedCost: number;
  errors: Array<{ workOrderId: string; error: string }>;
  results: Array<{ workOrderId: string; workOrderNumber: string; servicesCreated: number }>;
}> {
  logInfo('Calculating service requirements for all work orders of order', { orderId });

  const workOrders = await prisma.work_orders.findMany({
    where: { orderId },
    select: { id: true, workOrderNumber: true, status: true },
  });

  if (workOrders.length === 0) {
    logInfo('No work orders found for order', { orderId });
    return {
      workOrdersProcessed: 0,
      workOrdersSkipped: 0,
      totalServicesCreated: 0,
      totalEstimatedCost: 0,
      errors: [],
      results: [],
    };
  }

  let totalServicesCreated = 0;
  let totalEstimatedCost = 0;
  let workOrdersProcessed = 0;
  let workOrdersSkipped = 0;
  const errors: Array<{ workOrderId: string; error: string }> = [];
  const results: Array<{ workOrderId: string; workOrderNumber: string; servicesCreated: number }> = [];

  for (const wo of workOrders) {
    // Skip cancelled work orders
    if (wo.status === 'CANCELLED') {
      workOrdersSkipped++;
      continue;
    }

    try {
      const result = await calculateRequirementsFromWorkOrder({
        workOrderId: wo.id,
        userId,
      });

      totalServicesCreated += result.summary.totalServices;
      totalEstimatedCost += result.summary.totalEstimatedCost;
      workOrdersProcessed++;

      results.push({
        workOrderId: wo.id,
        workOrderNumber: wo.workOrderNumber,
        servicesCreated: result.summary.totalServices,
      });
    } catch (error) {
      logError('Failed to calculate services for work order', {
        workOrderId: wo.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      errors.push({
        workOrderId: wo.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  logInfo('Service requirements calculation complete for order', {
    orderId,
    workOrdersProcessed,
    workOrdersSkipped,
    totalServicesCreated,
    totalEstimatedCost,
    errorCount: errors.length,
  });

  return {
    workOrdersProcessed,
    workOrdersSkipped,
    totalServicesCreated,
    totalEstimatedCost,
    errors,
    results,
  };
}

// ============================================
// PROCESSOR SUGGESTION LOGIC
// ============================================

/**
 * Map ServiceType to processingType for rate card lookup.
 * Only DYEING and PRINTING have rate card support.
 * Returns null for other service types (they use PO history instead).
 */
function mapServiceTypeToRateCardProcessingType(serviceType: ServiceType): string | null {
  switch (serviceType) {
    case ServiceType.DYEING:
      return 'DYEING';
    case ServiceType.PRINTING:
      return 'PRINTING';
    default:
      return null;
  }
}

/**
 * Suggest processor for a service type
 * Uses priority algorithm: Rate Card → Recent POs → None
 */
export async function suggestProcessorForService(
  serviceType: ServiceType,
  styleId?: string
): Promise<ProcessorSuggestion> {
  logDebug('Suggesting processor for service', { serviceType, styleId });

  // Priority 1: Check for processor from rate card (HIGH confidence)
  // Only DYEING and PRINTING have rate card support
  const processingTypeForRateCard = mapServiceTypeToRateCardProcessingType(serviceType);

  if (processingTypeForRateCard) {
    const rateCard = await prisma.processor_rate_card.findFirst({
      where: {
        processingType: processingTypeForRateCard,
        isActive: true,
        processor: {
          isActive: true,
        },
      },
      include: {
        processor: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (rateCard && rateCard.processor) {
      logInfo('Found processor from rate card', {
        serviceType,
        processorId: rateCard.processorId,
      });

      return {
        serviceType,
        suggestedProcessorId: rateCard.processorId,
        suggestedProcessorName: rateCard.processor.name,
        confidence: 'high',
        reason: 'Processor from rate card',
        alternatives: [],
      };
    }
  }

  // Priority 2: Check recent service PO history (MEDIUM confidence)
  const poCategory = mapServiceTypeToPOCategory(serviceType);

  const recentPOs = await prisma.purchase_orders.findMany({
    where: {
      poCategory: poCategory,
      status: {
        in: ['DRAFT', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED'],
      },
    },
    include: {
      suppliers: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10, // Look at last 10 POs
  });

  if (recentPOs.length > 0) {
    // Count processor frequency
    const processorCounts = new Map<string, { count: number; lastDate: Date; processor: any }>();

    recentPOs.forEach((po) => {
      const processor = po.suppliers;
      if (processor && processor.isActive) {
        const existing = processorCounts.get(processor.id);
        if (existing) {
          existing.count += 1;
          if (po.createdAt > existing.lastDate) {
            existing.lastDate = po.createdAt;
          }
        } else {
          processorCounts.set(processor.id, {
            count: 1,
            lastDate: po.createdAt,
            processor,
          });
        }
      }
    });

    if (processorCounts.size > 0) {
      // Sort by frequency and recency
      const sorted = Array.from(processorCounts.entries())
        .map(([processorId, data]) => ({
          processorId,
          processorName: data.processor.name,
          serviceCount: data.count,
          lastServiceDate: data.lastDate,
        }))
        .sort((a, b) => b.serviceCount - a.serviceCount || b.lastServiceDate!.getTime() - a.lastServiceDate!.getTime());

      const mostUsed = sorted[0];

      logInfo('Found processor from recent POs', {
        serviceType,
        processorId: mostUsed.processorId,
        serviceCount: mostUsed.serviceCount,
      });

      return {
        serviceType,
        suggestedProcessorId: mostUsed.processorId,
        suggestedProcessorName: mostUsed.processorName,
        confidence: 'medium',
        reason: `Used for ${mostUsed.serviceCount} recent ${serviceType.toLowerCase()} service${
          mostUsed.serviceCount > 1 ? 's' : ''
        }`,
        alternatives: sorted.slice(1, 4).map((s) => ({
          processorId: s.processorId,
          processorName: s.processorName,
          serviceCount: s.serviceCount,
          lastServiceDate: s.lastServiceDate,
        })),
      };
    }
  }

  // Priority 3: No suggestion available (LOW confidence)
  logDebug('No processor suggestion available', { serviceType });

  return {
    serviceType,
    suggestedProcessorId: null,
    confidence: 'low',
    reason: 'No historical data - manual assignment required',
    alternatives: [],
  };
}

/**
 * Suggest processors for multiple service requirements
 * Optimized batch processing
 */
export async function suggestProcessorsForRequirements(
  requirementIds: string[]
): Promise<ProcessorSuggestionForRequirement[]> {
  logInfo('Suggesting processors for requirements', { count: requirementIds.length });

  // Get all requirements
  // Note: work_orders has styleId directly, no need to go through orders
  const requirements = await prisma.work_order_service_requirements.findMany({
    where: { id: { in: requirementIds } },
    include: {
      workOrder: true,
    },
  });

  if (requirements.length === 0) {
    return [];
  }

  // Get suggestions for each unique service type
  const uniqueServiceTypes = [...new Set(requirements.map((r) => r.serviceType))];
  const serviceSuggestions = new Map<ServiceType, ProcessorSuggestion>();

  for (const serviceType of uniqueServiceTypes) {
    try {
      // Try to get style ID from first requirement of this type
      const req = requirements.find((r) => r.serviceType === serviceType);
      const styleId = req?.workOrder?.styleId;

      const suggestion = await suggestProcessorForService(serviceType, styleId);
      serviceSuggestions.set(serviceType, suggestion);
    } catch (error) {
      logError('Failed to suggest processor for service type', { serviceType, error });
      // Continue with other service types
    }
  }

  // Map suggestions to requirements
  const results: ProcessorSuggestionForRequirement[] = requirements.map((req) => {
    const suggestion = serviceSuggestions.get(req.serviceType);

    if (!suggestion) {
      return {
        requirementId: req.id,
        serviceType: req.serviceType,
        currentProcessorId: req.preferredProcessorId,
        suggestedProcessorId: null,
        confidence: 'low' as const,
        reason: 'Failed to generate suggestion',
        alternatives: [],
      };
    }

    return {
      requirementId: req.id,
      serviceType: req.serviceType,
      currentProcessorId: req.preferredProcessorId,
      suggestedProcessorId: suggestion.suggestedProcessorId,
      suggestedProcessorName: suggestion.suggestedProcessorName,
      confidence: suggestion.confidence,
      reason: suggestion.reason,
      alternatives: suggestion.alternatives,
    };
  });

  logInfo('Generated processor suggestions', {
    total: results.length,
    high: results.filter((r) => r.confidence === 'high').length,
    medium: results.filter((r) => r.confidence === 'medium').length,
    low: results.filter((r) => r.confidence === 'low').length,
  });

  return results;
}

// ============================================
// BULK PROCESSOR ASSIGNMENT
// ============================================

/**
 * Bulk assign processors to service requirements
 * Updates assignedProcessorId for multiple requirements in a transaction
 */
export async function bulkAssignProcessors(assignments: BulkProcessorAssignment[]): Promise<number> {
  logInfo('Bulk assigning processors', { count: assignments.length });

  if (assignments.length === 0) {
    return 0;
  }

  // Validate all processors exist and are active
  const processorIds = [...new Set(assignments.map((a) => a.processorId))];
  const processors = await prisma.suppliers.findMany({
    where: { id: { in: processorIds } },
    select: { id: true, isActive: true },
  });

  const activeProcessorIds = new Set(processors.filter((p) => p.isActive).map((p) => p.id));

  // Filter out assignments with inactive processors
  const validAssignments = assignments.filter((a) => activeProcessorIds.has(a.processorId));

  if (validAssignments.length === 0) {
    throw new BusinessError('No active processors found in assignments');
  }

  // Perform bulk update in transaction
  let updatedCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const assignment of validAssignments) {
      const result = await tx.work_order_service_requirements.updateMany({
        where: { id: assignment.requirementId },
        data: {
          assignedProcessorId: assignment.processorId,
          preferredProcessorId: assignment.processorId, // Also update preferred
        },
      });
      updatedCount += result.count;
    }
  });

  logInfo('Bulk processor assignment complete', {
    requested: assignments.length,
    valid: validAssignments.length,
    updated: updatedCount,
  });

  return updatedCount;
}

/**
 * Auto-assign processors using suggestions
 * Applies high and medium confidence suggestions automatically
 */
export async function autoAssignProcessors(
  requirementIds: string[],
  minConfidence: 'high' | 'medium' = 'medium'
): Promise<{ assigned: number; skipped: number }> {
  logInfo('Auto-assigning processors', { requirementIds: requirementIds.length, minConfidence });

  const suggestions = await suggestProcessorsForRequirements(requirementIds);

  // Filter by confidence level
  const confidenceLevels = minConfidence === 'high' ? ['high'] : ['high', 'medium'];
  const autoAssignable = suggestions.filter((s) => s.suggestedProcessorId && confidenceLevels.includes(s.confidence));

  if (autoAssignable.length === 0) {
    return { assigned: 0, skipped: suggestions.length };
  }

  const assignments: BulkProcessorAssignment[] = autoAssignable.map((s) => ({
    requirementId: s.requirementId,
    processorId: s.suggestedProcessorId!,
  }));

  const assigned = await bulkAssignProcessors(assignments);

  return {
    assigned,
    skipped: suggestions.length - autoAssignable.length,
  };
}

// ============================================
// GROUPING AND BULK PO GENERATION
// ============================================

/**
 * Group requirements by processor for bulk PO generation
 * Returns requirements organized by their assigned processor
 */
export async function groupRequirementsByProcessor(requirementIds: string[]): Promise<{
  groups: Map<string, ServiceRequirementResponse[]>;
  unassigned: ServiceRequirementResponse[];
  summary: {
    totalRequirements: number;
    totalProcessors: number;
    unassignedCount: number;
    totalEstimatedCost: number;
  };
}> {
  logInfo('Grouping requirements by processor', { count: requirementIds.length });

  // Get all requirements with processor info
  const requirements = await prisma.work_order_service_requirements.findMany({
    where: {
      id: { in: requirementIds },
      status: { in: [ServiceRequirementStatus.PENDING, ServiceRequirementStatus.IN_PROGRESS] },
    },
    include: getRequirementIncludes(),
  });

  if (requirements.length === 0) {
    return {
      groups: new Map(),
      unassigned: [],
      summary: {
        totalRequirements: 0,
        totalProcessors: 0,
        unassignedCount: 0,
        totalEstimatedCost: 0,
      },
    };
  }

  // Group by assigned processor
  const groups = new Map<string, ServiceRequirementResponse[]>();
  const unassigned: ServiceRequirementResponse[] = [];
  let totalEstimatedCost = 0;

  for (const req of requirements) {
    const mapped = mapToResponse(req);

    if (mapped.estimatedTotal) {
      totalEstimatedCost += mapped.estimatedTotal;
    }

    if (req.assignedProcessorId) {
      const existing = groups.get(req.assignedProcessorId);
      if (existing) {
        existing.push(mapped);
      } else {
        groups.set(req.assignedProcessorId, [mapped]);
      }
    } else {
      unassigned.push(mapped);
    }
  }

  logInfo('Requirements grouped', {
    totalRequirements: requirements.length,
    totalProcessors: groups.size,
    unassignedCount: unassigned.length,
    totalEstimatedCost,
  });

  return {
    groups,
    unassigned,
    summary: {
      totalRequirements: requirements.length,
      totalProcessors: groups.size,
      unassignedCount: unassigned.length,
      totalEstimatedCost,
    },
  };
}

/**
 * Generate a Service PO from requirements
 */
export async function generateServicePO(data: {
  processorId: string;
  requirementIds: string[];
  expectedDeliveryDate: Date;
  remarks?: string;
  userId: string;
}): Promise<{
  purchaseOrder: any;
  linkedRequirements: number;
}> {
  const { processorId, requirementIds, expectedDeliveryDate, remarks, userId } = data;

  logInfo('Generating service PO', { processorId, requirementCount: requirementIds.length });

  // Get all requirements
  const requirements = await prisma.work_order_service_requirements.findMany({
    where: {
      id: { in: requirementIds },
      status: { in: [ServiceRequirementStatus.PENDING, ServiceRequirementStatus.IN_PROGRESS] },
    },
  });

  if (requirements.length === 0) {
    throw new BusinessError('No valid requirements found for PO generation');
  }

  // Validate processor
  const processor = await prisma.suppliers.findUnique({
    where: { id: processorId },
  });

  if (!processor || !processor.isActive) {
    throw new BusinessError('Processor not found or inactive');
  }

  // Group requirements by service type for consolidation
  const serviceGroups = new Map<ServiceType, typeof requirements>();

  for (const req of requirements) {
    const existing = serviceGroups.get(req.serviceType);
    if (existing) {
      existing.push(req);
    } else {
      serviceGroups.set(req.serviceType, [req]);
    }
  }

  // Determine interstate status for the processor
  const { isInterstate } = await gstService.isInterstatePO(processorId);

  // Create PO with items in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Generate PO number
    const poNumber = await generateCode('PO', 'purchase_orders', 'poNumber');

    // Determine PO category from first service type
    const firstServiceType = requirements[0].serviceType;
    const poCategory = mapServiceTypeToPOCategory(firstServiceType);

    // Calculate subtotal
    let subtotal = 0;
    for (const req of requirements) {
      subtotal += Number(req.estimatedTotal || 0);
    }

    // Get workOrderId from requirements (all requirements should be from same work order ideally)
    // Use the first requirement's workOrderId for the PO link
    const serviceWorkOrderId = requirements[0].workOrderId;

    // Create Purchase Order (GST header totals updated after items)
    const po = await tx.purchase_orders.create({
      data: {
        id: crypto.randomUUID(),
        poNumber,
        supplierId: processorId,
        poCategory: poCategory,
        poSource: POSource.SERVICE_REQUIREMENT,
        serviceWorkOrderId, // Link PO back to work order for traceability
        expectedDeliveryDate: new Date(expectedDeliveryDate),
        status: 'DRAFT',
        totalAmount: subtotal,
        remarks,
        createdById: userId,
      },
    });

    // Create PO items (one per service type) with GST
    let linkedCount = 0;
    let poTotalCgst = 0;
    let poTotalSgst = 0;
    let poTotalIgst = 0;

    for (const [serviceType, reqs] of serviceGroups.entries()) {
      const totalQuantity = reqs.reduce((sum, req) => sum + Number(req.quantityRequired), 0);
      const totalPrice = reqs.reduce((sum, req) => sum + Number(req.estimatedTotal || 0), 0);
      const avgUnitPrice = totalQuantity > 0 ? totalPrice / totalQuantity : 0;

      // Get SAC code and GST rate for the service type
      const { sacCode, gstRate } = await gstService.getSACCodeForService(serviceType);
      const gst = await gstService.calculateLineItemGST({
        lineTotal: totalPrice,
        hsnSacCode: sacCode,
        gstRateOverride: gstRate,
        isInterstate,
      });

      poTotalCgst += gst.cgstAmount;
      poTotalSgst += gst.sgstAmount;
      poTotalIgst += gst.igstAmount;

      // Service POs don't have materials - materialId is now optional in schema
      const poItem = await tx.purchase_order_items.create({
        data: {
          id: crypto.randomUUID(),
          poId: po.id,
          materialId: null, // Service POs don't link to materials
          serviceType: serviceType, // Track service type on PO item
          serviceDescription: `${serviceType} Service`,
          orderedQuantity: totalQuantity,
          unit: Object.values(Unit).includes(reqs[0].unit as Unit) ? (reqs[0].unit as Unit) : Unit.PIECE,
          unitPrice: avgUnitPrice,
          totalPrice,
          hsnCode: sacCode,
          gstRate: gst.gstRate,
          cgstRate: gst.cgstRate,
          cgstAmount: gst.cgstAmount,
          sgstRate: gst.sgstRate,
          sgstAmount: gst.sgstAmount,
          igstRate: gst.igstRate,
          igstAmount: gst.igstAmount,
          taxAmount: gst.taxAmount,
          remarks: `${serviceType} Service`,
        },
      });

      // Create links to requirements
      for (const req of reqs) {
        await tx.service_requirement_po_links.create({
          data: {
            serviceRequirementId: req.id,
            purchaseOrderItemId: poItem.id,
            quantityLinked: Number(req.quantityRequired),
          },
        });

        // Update requirement status
        await tx.work_order_service_requirements.update({
          where: { id: req.id },
          data: {
            status: ServiceRequirementStatus.PO_GENERATED,
            purchaseOrderId: po.id,
          },
        });

        linkedCount++;
      }
    }

    // Update PO header with GST totals
    const totalTax = poTotalCgst + poTotalSgst + poTotalIgst;
    await tx.purchase_orders.update({
      where: { id: po.id },
      data: {
        subtotal,
        totalCgst: poTotalCgst,
        totalSgst: poTotalSgst,
        totalIgst: poTotalIgst,
        totalTax,
        totalAmount: subtotal + totalTax,
        isInterstate,
      },
    });

    const updatedPo = await tx.purchase_orders.findUnique({ where: { id: po.id } });

    return { po: updatedPo || po, linkedCount };
  });

  logInfo('Service PO generated', {
    poNumber: result.po.poNumber,
    linkedRequirements: result.linkedCount,
  });

  return {
    purchaseOrder: result.po,
    linkedRequirements: result.linkedCount,
  };
}

/**
 * Generate multiple Service POs from grouped requirements
 * Creates one PO per processor in a single transaction
 */
export async function bulkGenerateServicePOs(
  groups: Array<{
    processorId: string;
    requirementIds: string[];
    expectedDeliveryDate: string;
    remarks?: string;
  }>,
  userId: string
): Promise<{
  purchaseOrders: Array<{ id: string; poNumber: string; processorId: string; totalAmount: number }>;
  totalPOs: number;
  totalAmount: number;
  errors: Array<{ processorId: string; error: string }>;
}> {
  logInfo('Generating multiple service POs', { groupCount: groups.length });

  const purchaseOrders: Array<{ id: string; poNumber: string; processorId: string; totalAmount: number }> = [];
  const errors: Array<{ processorId: string; error: string }> = [];
  let totalAmount = 0;

  // Process each processor group
  for (const group of groups) {
    try {
      const result = await generateServicePO({
        processorId: group.processorId,
        requirementIds: group.requirementIds,
        expectedDeliveryDate: new Date(group.expectedDeliveryDate),
        remarks: group.remarks,
        userId,
      });

      purchaseOrders.push({
        id: result.purchaseOrder.id,
        poNumber: result.purchaseOrder.poNumber,
        processorId: group.processorId,
        totalAmount: result.purchaseOrder.totalAmount,
      });

      totalAmount += result.purchaseOrder.totalAmount;

      logInfo('Service PO generated for processor', {
        processorId: group.processorId,
        poNumber: result.purchaseOrder.poNumber,
        requirements: result.linkedRequirements,
      });
    } catch (error) {
      logError('Failed to generate service PO for processor', { processorId: group.processorId, error });
      errors.push({
        processorId: group.processorId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  logInfo('Bulk service PO generation complete', {
    totalPOs: purchaseOrders.length,
    totalAmount,
    errors: errors.length,
  });

  return {
    purchaseOrders,
    totalPOs: purchaseOrders.length,
    totalAmount,
    errors,
  };
}

// ============================================
// QUERY AND SUMMARY METHODS
// ============================================

/**
 * Get service requirements for a work order
 */
export async function getServiceRequirements(
  workOrderId: string,
  filters?: {
    status?: ServiceRequirementStatus;
    serviceType?: ServiceType;
  }
): Promise<{ requirements: ServiceRequirementResponse[]; total: number }> {
  const where: any = { workOrderId };

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.serviceType) {
    where.serviceType = filters.serviceType;
  }

  const [requirements, total] = await Promise.all([
    prisma.work_order_service_requirements.findMany({
      where,
      include: getRequirementIncludes(),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.work_order_service_requirements.count({ where }),
  ]);

  return {
    requirements: requirements.map(mapToResponse),
    total,
  };
}

/**
 * Get service requirements summary for a work order
 */
export async function getServiceRequirementsSummary(workOrderId: string): Promise<ServiceRequirementsSummary> {
  const requirements = await prisma.work_order_service_requirements.findMany({
    where: { workOrderId },
  });

  const summary: ServiceRequirementsSummary = {
    totalServices: requirements.length,
    totalEstimatedCost: 0,
    servicesWithProcessor: 0,
    servicesWithoutProcessor: 0,
    pendingCount: 0,
    poGeneratedCount: 0,
    inProgressCount: 0,
    completedCount: 0,
    byServiceType: {} as Record<ServiceType, number>,
  };

  for (const req of requirements) {
    // Cost
    if (req.estimatedTotal) {
      summary.totalEstimatedCost += Number(req.estimatedTotal);
    }

    // Processor
    if (req.assignedProcessorId) {
      summary.servicesWithProcessor++;
    } else {
      summary.servicesWithoutProcessor++;
    }

    // Status
    switch (req.status) {
      case ServiceRequirementStatus.PENDING:
        summary.pendingCount++;
        break;
      case ServiceRequirementStatus.PO_GENERATED:
        summary.poGeneratedCount++;
        break;
      case ServiceRequirementStatus.IN_PROGRESS:
        summary.inProgressCount++;
        break;
      case ServiceRequirementStatus.COMPLETED:
        summary.completedCount++;
        break;
    }

    // By service type
    if (!summary.byServiceType[req.serviceType]) {
      summary.byServiceType[req.serviceType] = 0;
    }
    summary.byServiceType[req.serviceType]++;
  }

  return summary;
}

/**
 * Get service requirements summary for an entire order (across all work orders)
 */
export async function getOrderServiceRequirementsSummary(orderId: string): Promise<OrderServiceRequirementsSummary> {
  // Find all work orders for this order
  const workOrders = await prisma.work_orders.findMany({
    where: { orderId },
    select: { id: true },
  });

  const workOrderIds = workOrders.map((wo) => wo.id);

  if (workOrderIds.length === 0) {
    return {
      orderId,
      workOrderCount: 0,
      totalServices: 0,
      pendingServices: 0,
      processorAssigned: 0,
      poGenerated: 0,
      completed: 0,
      estimatedTotalCost: 0,
      byServiceType: {},
    };
  }

  // Get all service requirements for these work orders
  const requirements = await prisma.work_order_service_requirements.findMany({
    where: { workOrderId: { in: workOrderIds } },
  });

  const summary: OrderServiceRequirementsSummary = {
    orderId,
    workOrderCount: workOrderIds.length,
    totalServices: requirements.length,
    pendingServices: 0,
    processorAssigned: 0,
    poGenerated: 0,
    completed: 0,
    estimatedTotalCost: 0,
    byServiceType: {},
  };

  for (const req of requirements) {
    // Cost
    if (req.estimatedTotal) {
      summary.estimatedTotalCost += Number(req.estimatedTotal);
    }

    // Processor assigned
    if (req.assignedProcessorId) {
      summary.processorAssigned++;
    }

    // Status counts
    switch (req.status) {
      case ServiceRequirementStatus.PENDING:
        summary.pendingServices++;
        break;
      case ServiceRequirementStatus.PO_GENERATED:
      case ServiceRequirementStatus.IN_PROGRESS:
        summary.poGenerated++;
        break;
      case ServiceRequirementStatus.COMPLETED:
        summary.completed++;
        break;
    }

    // By service type
    const serviceType = req.serviceType;
    if (!summary.byServiceType[serviceType]) {
      summary.byServiceType[serviceType] = {
        count: 0,
        pending: 0,
        poGenerated: 0,
      };
    }
    summary.byServiceType[serviceType].count++;
    if (req.status === ServiceRequirementStatus.PENDING) {
      summary.byServiceType[serviceType].pending++;
    } else if (
      req.status === ServiceRequirementStatus.PO_GENERATED ||
      req.status === ServiceRequirementStatus.IN_PROGRESS
    ) {
      summary.byServiceType[serviceType].poGenerated++;
    }
  }

  return summary;
}

// ============================================
// UPDATE METHODS
// ============================================

/**
 * Update service execution details
 * Links requirement to execution tables (job_work_orders, embroidery_send_out, processing_batch)
 */
export async function updateServiceExecution(
  requirementId: string,
  data: {
    jobWorkOrderId?: string;
    embroiderySendOutId?: string;
    processingBatchId?: string;
    actualQuantity?: number;
    actualCost?: number;
    status: ServiceRequirementStatus;
  }
): Promise<ServiceRequirementResponse> {
  logInfo('Updating service execution', { requirementId, status: data.status });

  const updateData: any = {
    status: data.status,
  };

  if (data.jobWorkOrderId) updateData.jobWorkOrderId = data.jobWorkOrderId;
  if (data.embroiderySendOutId) updateData.embroiderySendOutId = data.embroiderySendOutId;
  if (data.processingBatchId) updateData.processingBatchId = data.processingBatchId;

  const updated = await prisma.work_order_service_requirements.update({
    where: { id: requirementId },
    data: updateData,
    include: getRequirementIncludes(),
  });

  return mapToResponse(updated);
}

// ============================================
// LIST ALL SERVICE REQUIREMENTS (across all work orders)
// ============================================

export interface ServiceRequirementListFilters {
  orderId?: string;
  workOrderId?: string;
  status?: ServiceRequirementStatus | ServiceRequirementStatus[];
  serviceType?: ServiceType | ServiceType[];
  processorId?: string;
  source?: RequirementSource;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Get all service requirements across all work orders with pagination and filters
 */
export async function getAllServiceRequirements(
  filters?: ServiceRequirementListFilters
): Promise<{ data: ServiceRequirementResponse[]; total: number }> {
  const where: any = {};
  const page = filters?.page || 1;
  const limit = filters?.limit || 20;

  // Build workOrder relation filter (orderId + search can coexist)
  const workOrderFilter: any = {};
  if (filters?.orderId) workOrderFilter.orderId = filters.orderId;
  if (filters?.search) workOrderFilter.workOrderNumber = { contains: filters.search, mode: 'insensitive' };
  if (Object.keys(workOrderFilter).length > 0) where.workOrder = workOrderFilter;

  if (filters?.workOrderId) where.workOrderId = filters.workOrderId;
  if (filters?.source) where.source = filters.source;

  // Handle status (single or array)
  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      where.status = { in: filters.status };
    } else {
      where.status = filters.status;
    }
  }

  // Handle serviceType (single or array)
  if (filters?.serviceType) {
    if (Array.isArray(filters.serviceType)) {
      where.serviceType = { in: filters.serviceType };
    } else {
      where.serviceType = filters.serviceType;
    }
  }

  // Processor filter (check both assigned and preferred)
  if (filters?.processorId) {
    where.OR = [{ assignedProcessorId: filters.processorId }, { preferredProcessorId: filters.processorId }];
  }

  const sortBy = filters?.sortBy || 'createdAt';
  const sortOrder = filters?.sortOrder || 'desc';

  const [data, total] = await Promise.all([
    prisma.work_order_service_requirements.findMany({
      where,
      include: getRequirementIncludes(),
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.work_order_service_requirements.count({ where }),
  ]);

  return {
    data: data.map(mapToResponse),
    total,
  };
}

// ============================================
// DASHBOARD STATS
// ============================================

export interface ServiceDashboardStats {
  totalServices: number;
  pendingCount: number;
  processorAssignedCount: number;
  needsProcessorCount: number;
  poGeneratedCount: number;
  inProgressCount: number;
  completedCount: number;
  cancelledCount: number;
  estimatedTotalCost: number;
  byServiceType: Record<string, number>;
}

/**
 * Get dashboard stats for all service requirements
 */
export async function getDashboardStats(): Promise<ServiceDashboardStats> {
  const requirements = await prisma.work_order_service_requirements.findMany({
    where: { status: { not: ServiceRequirementStatus.CANCELLED } },
  });

  const stats: ServiceDashboardStats = {
    totalServices: requirements.length,
    pendingCount: 0,
    processorAssignedCount: 0,
    needsProcessorCount: 0,
    poGeneratedCount: 0,
    inProgressCount: 0,
    completedCount: 0,
    cancelledCount: 0,
    estimatedTotalCost: 0,
    byServiceType: {},
  };

  for (const req of requirements) {
    if (req.estimatedTotal) {
      stats.estimatedTotalCost += Number(req.estimatedTotal);
    }

    if (req.assignedProcessorId) {
      stats.processorAssignedCount++;
    } else {
      stats.needsProcessorCount++;
    }

    switch (req.status) {
      case ServiceRequirementStatus.PENDING:
        stats.pendingCount++;
        break;
      case ServiceRequirementStatus.PO_GENERATED:
        stats.poGeneratedCount++;
        break;
      case ServiceRequirementStatus.IN_PROGRESS:
        stats.inProgressCount++;
        break;
      case ServiceRequirementStatus.COMPLETED:
        stats.completedCount++;
        break;
    }

    if (!stats.byServiceType[req.serviceType]) {
      stats.byServiceType[req.serviceType] = 0;
    }
    stats.byServiceType[req.serviceType]++;
  }

  // Count cancelled separately
  const cancelledCount = await prisma.work_order_service_requirements.count({
    where: { status: ServiceRequirementStatus.CANCELLED },
  });
  stats.cancelledCount = cancelledCount;

  return stats;
}

// ============================================
// EXPORTS
// ============================================

export default {
  calculateRequirementsFromWorkOrder,
  suggestProcessorForService,
  suggestProcessorsForRequirements,
  bulkAssignProcessors,
  autoAssignProcessors,
  groupRequirementsByProcessor,
  generateServicePO,
  bulkGenerateServicePOs,
  getServiceRequirements,
  getAllServiceRequirements,
  getServiceRequirementsSummary,
  getOrderServiceRequirementsSummary,
  getDashboardStats,
  updateServiceExecution,
};
