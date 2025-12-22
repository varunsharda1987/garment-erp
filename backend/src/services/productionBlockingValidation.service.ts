import { PrismaClient, ProductionStage, SampleType, SampleStatus, TestResult } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// Type definitions
interface BlockerInfo {
  type: string;
  message: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

interface ValidationResult {
  isBlocked: boolean;
  blockers: BlockerInfo[];
}

interface CreationValidationResult {
  canCreate: boolean;
  blocker: {
    message: string;
    prerequisiteType: SampleType;
  } | null;
}

interface OverrideLogData {
  blockType: string;
  workOrderId?: string;
  orderItemId?: string;
  sampleId?: string;
  fromStage?: ProductionStage;
  toStage?: ProductionStage;
  blockedSampleType?: SampleType;
  prerequisiteSampleType?: SampleType;
  overrideReason: string;
  overriddenById: string;
}

/**
 * Production Blocking Validation Service
 *
 * Centralizes all blocking logic for:
 * 1. FIT Sample → Blocks Printing & Dyeing
 * 2. Size Set Sample → Blocks Cutting & Beyond
 * 3. FPT (Fabric Physical Test) → Blocks Cutting & Beyond
 * 4. GPT (Garment Physical Test) → Blocks Cutting & Beyond
 * 5. Sequential Sample Dependencies (PP requires FIT, SIZE_SET requires PP)
 */
class ProductionBlockingValidationService {

  /**
   * RULE 1: FIT Sample blocks IN_PRINTING and IN_DYING stages
   */
  async validateFitSampleForStage(styleId: string, targetStage: ProductionStage): Promise<ValidationResult> {
    const blockedStages: ProductionStage[] = ['IN_PRINTING', 'IN_DYING'];

    if (!blockedStages.includes(targetStage)) {
      return { isBlocked: false, blockers: [] };
    }

    // Find latest FIT sample for this style
    const fitSample = await prisma.samples.findFirst({
      where: {
        styleId,
        sampleType: 'FIT_SAMPLE'
      },
      orderBy: { createdAt: 'desc' },
    });

    // No FIT sample exists - no block
    if (!fitSample) {
      return { isBlocked: false, blockers: [] };
    }

    // Check if approved
    const approvedStatuses: SampleStatus[] = ['APPROVED', 'APPROVED_WITH_COMMENTS'];
    const isApproved = approvedStatuses.includes(fitSample.status);

    if (!isApproved) {
      return {
        isBlocked: true,
        blockers: [{
          type: 'FIT_SAMPLE_NOT_APPROVED',
          message: `FIT Sample (${fitSample.sampleNumber}) must be approved before ${targetStage}. Current status: ${fitSample.status}`,
          severity: 'CRITICAL',
        }],
      };
    }

    return { isBlocked: false, blockers: [] };
  }

  /**
   * RULE 2: Size Set Sample blocks cutting and all subsequent stages
   */
  async validateSizeSetSampleForStage(styleId: string, targetStage: ProductionStage): Promise<ValidationResult> {
    const blockedStages: ProductionStage[] = [
      'IN_CUTTING',
      'IN_STITCHING',
      'IN_EMBROIDERY',
      'IN_HANDWORK',
      'IN_FINISHING',
      'READY_TO_SHIP',
      'SHIPPED',
    ];

    if (!blockedStages.includes(targetStage)) {
      return { isBlocked: false, blockers: [] };
    }

    // Find latest SIZE_SET sample
    const sizeSetSample = await prisma.samples.findFirst({
      where: {
        styleId,
        sampleType: 'SIZE_SET_SAMPLE',
      },
      orderBy: { createdAt: 'desc' },
    });

    // No SIZE_SET sample exists - no block
    if (!sizeSetSample) {
      return { isBlocked: false, blockers: [] };
    }

    // Check if approved
    const approvedStatuses: SampleStatus[] = ['APPROVED', 'APPROVED_WITH_COMMENTS'];
    const isApproved = approvedStatuses.includes(sizeSetSample.status);

    if (!isApproved) {
      return {
        isBlocked: true,
        blockers: [{
          type: 'SIZE_SET_SAMPLE_NOT_APPROVED',
          message: `Size Set Sample (${sizeSetSample.sampleNumber}) must be approved before ${targetStage}. Current status: ${sizeSetSample.status}`,
          severity: 'CRITICAL',
        }],
      };
    }

    return { isBlocked: false, blockers: [] };
  }

  /**
   * RULE 3: FPT (Fabric Physical Test) blocks production stages if customer requires it
   * Only applies if customer.fptBlocksProduction is enabled
   * Only non-overridden tests are considered
   */
  async validateFPTForStage(
    styleId: string,
    targetStage: ProductionStage,
    customerFptBlocksProduction: boolean
  ): Promise<ValidationResult> {
    // If customer doesn't require FPT blocking, skip validation
    if (!customerFptBlocksProduction) {
      return { isBlocked: false, blockers: [] };
    }

    const blockedStages: ProductionStage[] = [
      'IN_CUTTING',
      'IN_STITCHING',
      'IN_EMBROIDERY',
      'IN_HANDWORK',
      'IN_FINISHING',
      'READY_TO_SHIP',
      'SHIPPED',
    ];

    if (!blockedStages.includes(targetStage)) {
      return { isBlocked: false, blockers: [] };
    }

    // Find latest FPT for this style (exclude admin overridden tests)
    const fpt = await prisma.fabric_physical_tests.findFirst({
      where: {
        styleId,
        adminOverride: false, // Only consider non-overridden tests
      },
      orderBy: { createdAt: 'desc' },
    });

    // No FPT exists - no block
    if (!fpt) {
      return { isBlocked: false, blockers: [] };
    }

    // Check if test passed
    const passedResults: TestResult[] = ['PASS', 'CONDITIONAL_PASS'];
    const isPassed = passedResults.includes(fpt.overallTestResult);

    if (!isPassed) {
      return {
        isBlocked: true,
        blockers: [{
          type: 'FPT_NOT_PASSED',
          message: `Fabric Physical Test (${fpt.testNumber}) must pass before ${targetStage}. Current result: ${fpt.overallTestResult}`,
          severity: 'CRITICAL',
        }],
      };
    }

    return { isBlocked: false, blockers: [] };
  }

  /**
   * RULE 4: GPT (Garment Physical Test) blocks production stages if customer requires it
   * Only applies if customer.gptBlocksShipment is enabled
   * Blocks cutting and all stages beyond (including shipment)
   */
  async validateGPTForStage(
    workOrderId: string,
    targetStage: ProductionStage,
    customerGptBlocksShipment: boolean
  ): Promise<ValidationResult> {
    // If customer doesn't require GPT blocking, skip validation
    if (!customerGptBlocksShipment) {
      return { isBlocked: false, blockers: [] };
    }

    // GPT blocks cutting and all subsequent stages
    const blockedStages: ProductionStage[] = [
      'IN_CUTTING',
      'IN_STITCHING',
      'IN_EMBROIDERY',
      'IN_HANDWORK',
      'IN_FINISHING',
      'READY_TO_SHIP',
      'SHIPPED',
    ];

    if (!blockedStages.includes(targetStage)) {
      return { isBlocked: false, blockers: [] };
    }

    // Find latest GPT for this work order (exclude admin overridden tests)
    const gpt = await prisma.garment_physical_tests.findFirst({
      where: {
        workOrderId,
        adminOverride: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    // No GPT exists - no block
    if (!gpt) {
      return { isBlocked: false, blockers: [] };
    }

    // Check if test passed
    const passedResults: TestResult[] = ['PASS', 'CONDITIONAL_PASS'];
    const isPassed = passedResults.includes(gpt.overallTestResult);

    if (!isPassed) {
      return {
        isBlocked: true,
        blockers: [{
          type: 'GPT_NOT_PASSED',
          message: `Garment Physical Test (${gpt.testNumber}) must pass before ${targetStage}. Current result: ${gpt.overallTestResult}`,
          severity: 'CRITICAL',
        }],
      };
    }

    return { isBlocked: false, blockers: [] };
  }

  /**
   * Main orchestrator - validates all blocking rules for stage transition
   * Checks all rules in parallel for efficiency
   * Fetches customer settings to determine FPT/GPT blocking behavior
   */
  async validateStageTransition(
    workOrderId: string,
    targetStage: ProductionStage,
    isAdminOverride: boolean
  ): Promise<ValidationResult> {
    // Admin override bypasses all validation
    if (isAdminOverride) {
      return { isBlocked: false, blockers: [] };
    }

    // Get work order with style and customer info
    const workOrder = await prisma.work_orders.findUnique({
      where: { id: workOrderId },
      select: {
        id: true,
        styleId: true,
        order_items: {
          select: {
            orders: {
              select: {
                customers: {
                  select: {
                    fptBlocksProduction: true,
                    gptBlocksShipment: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!workOrder || !workOrder.styleId) {
      // No style - cannot validate, allow transition
      return { isBlocked: false, blockers: [] };
    }

    // Extract customer settings (default to false if not found)
    const customer = workOrder.order_items?.orders?.customers;
    const fptBlocksProduction = customer?.fptBlocksProduction ?? false;
    const gptBlocksShipment = customer?.gptBlocksShipment ?? true; // Default to true for safety

    // Run all validations in parallel
    const [fitResult, sizeSetResult, fptResult, gptResult] = await Promise.all([
      this.validateFitSampleForStage(workOrder.styleId, targetStage),
      this.validateSizeSetSampleForStage(workOrder.styleId, targetStage),
      this.validateFPTForStage(workOrder.styleId, targetStage, fptBlocksProduction),
      this.validateGPTForStage(workOrderId, targetStage, gptBlocksShipment),
    ]);

    // Aggregate all blockers
    const allBlockers: BlockerInfo[] = [
      ...fitResult.blockers,
      ...sizeSetResult.blockers,
      ...fptResult.blockers,
      ...gptResult.blockers,
    ];

    return {
      isBlocked: allBlockers.length > 0,
      blockers: allBlockers,
    };
  }

  /**
   * RULE 5a: PP Sample creation requires FIT Sample approval
   */
  async validatePPSampleCreation(styleId: string): Promise<CreationValidationResult> {
    // Check if FIT sample is approved
    const fitApprovedCount = await prisma.samples.count({
      where: {
        styleId,
        sampleType: 'FIT_SAMPLE',
        status: {
          in: ['APPROVED', 'APPROVED_WITH_COMMENTS'],
        },
      },
    });

    if (fitApprovedCount === 0) {
      return {
        canCreate: false,
        blocker: {
          message: 'FIT Sample must be approved before creating PP Sample',
          prerequisiteType: 'FIT_SAMPLE',
        },
      };
    }

    return { canCreate: true, blocker: null };
  }

  /**
   * RULE 5b: Size Set Sample creation requires PP Sample approval
   */
  async validateSizeSetSampleCreation(styleId: string): Promise<CreationValidationResult> {
    // Check if PP sample is approved
    const ppApprovedCount = await prisma.samples.count({
      where: {
        styleId,
        sampleType: 'PP_SAMPLE',
        status: {
          in: ['APPROVED', 'APPROVED_WITH_COMMENTS'],
        },
      },
    });

    if (ppApprovedCount === 0) {
      return {
        canCreate: false,
        blocker: {
          message: 'PP Sample must be approved before creating Size Set Sample',
          prerequisiteType: 'PP_SAMPLE',
        },
      };
    }

    return { canCreate: true, blocker: null };
  }

  /**
   * Log admin override to audit table
   */
  async logOverride(data: OverrideLogData): Promise<void> {
    await prisma.stage_transition_overrides.create({
      data: {
        id: randomUUID(),
        blockType: data.blockType,
        workOrderId: data.workOrderId,
        orderItemId: data.orderItemId,
        sampleId: data.sampleId,
        fromStage: data.fromStage,
        toStage: data.toStage,
        blockedSampleType: data.blockedSampleType,
        prerequisiteSampleType: data.prerequisiteSampleType,
        overrideReason: data.overrideReason,
        overriddenById: data.overriddenById,
      },
    });
  }
}

export const productionBlockingValidationService = new ProductionBlockingValidationService();
export default ProductionBlockingValidationService;
