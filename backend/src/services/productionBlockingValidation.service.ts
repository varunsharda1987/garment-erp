import { Prisma, ProductionStage, SampleType, SampleStatus, TestResult } from '@prisma/client';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { getDerivedOnHand } from './helpers/derived-stock.helper';

// Shortfall tolerance: ignore shortfalls below 0.5% of required quantity
// (handles BOM wastage rounding — e.g. need 1670.29m, have 1670.00m → 0.017% short → pass)
const SHORTFALL_TOLERANCE_PERCENT = 0.005;

// Material type groupings for stage-aware stock validation
const FABRIC_MATERIAL_TYPES = ['FABRIC', 'GREIGE'];
const TRIM_MATERIAL_TYPES = [
  'BUTTON',
  'THREAD',
  'ZIPPER',
  'LACE',
  'ELASTIC',
  'LABEL',
  'INTERLINING',
  'PADDING',
  'TRIMS',
  'ACCESSORIES',
  'HOOK_EYE',
  'SNAP_BUTTON',
  'BUCKLE',
  'BELT',
  'VELCRO',
  'DRAWSTRING',
  'RIBBON',
  'SEQUIN',
  'BEAD',
  'MOTIF',
];
const FINISHING_MATERIAL_TYPES = ['PACKAGING', 'LABEL'];

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
   * @param customerFitBlocks - If false, skip validation (customer doesn't require FIT approval)
   */
  async validateFitSampleForStage(
    styleId: string,
    targetStage: ProductionStage,
    customerFitBlocks = true
  ): Promise<ValidationResult> {
    // If customer doesn't require FIT blocking, skip validation
    if (!customerFitBlocks) {
      return { isBlocked: false, blockers: [] };
    }

    const blockedStages: ProductionStage[] = ['IN_PRINTING', 'IN_DYING'];

    if (!blockedStages.includes(targetStage)) {
      return { isBlocked: false, blockers: [] };
    }

    // Find latest FIT sample for this style
    const fitSample = await prisma.samples.findFirst({
      where: {
        styleId,
        sampleType: 'FIT_SAMPLE',
      },
      orderBy: { createdAt: 'desc' },
    });

    // No FIT sample exists — BLOCK. Previously this returned not-blocked, letting a style
    // bypass the FIT gate entirely by never creating the sample, contradicting
    // checkApprovalGate/validatePPSampleCreation which require an APPROVED sample
    // (bug-hunt samples-embroidery-14). Admin override remains available.
    if (!fitSample) {
      return {
        isBlocked: true,
        blockers: [
          {
            type: 'FIT_SAMPLE_NOT_APPROVED',
            message: `No FIT Sample exists for this style. An approved FIT Sample is required before ${targetStage}.`,
            severity: 'CRITICAL',
          },
        ],
      };
    }

    // Check if approved
    const approvedStatuses: SampleStatus[] = ['APPROVED', 'APPROVED_WITH_COMMENTS'];
    const isApproved = approvedStatuses.includes(fitSample.status);

    if (!isApproved) {
      return {
        isBlocked: true,
        blockers: [
          {
            type: 'FIT_SAMPLE_NOT_APPROVED',
            message: `FIT Sample (${fitSample.sampleNumber}) must be approved before ${targetStage}. Current status: ${fitSample.status}`,
            severity: 'CRITICAL',
          },
        ],
      };
    }

    return { isBlocked: false, blockers: [] };
  }

  /**
   * RULE 2: Size Set Sample blocks cutting and all subsequent stages
   * @param customerSizeSetBlocks - If false, skip validation (customer doesn't require SIZE_SET approval)
   */
  async validateSizeSetSampleForStage(
    styleId: string,
    targetStage: ProductionStage,
    customerSizeSetBlocks = true
  ): Promise<ValidationResult> {
    // If customer doesn't require SIZE_SET blocking, skip validation
    if (!customerSizeSetBlocks) {
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

    // Find latest SIZE_SET sample
    const sizeSetSample = await prisma.samples.findFirst({
      where: {
        styleId,
        sampleType: 'SIZE_SET_SAMPLE',
      },
      orderBy: { createdAt: 'desc' },
    });

    // No SIZE_SET sample exists — BLOCK. Same invariant as checkApprovalGate
    // (canCreateWorkOrder requires an approved Size Set sample); returning not-blocked here
    // let cutting proceed for styles that simply never created the sample
    // (bug-hunt samples-embroidery-14). Admin override remains available.
    if (!sizeSetSample) {
      return {
        isBlocked: true,
        blockers: [
          {
            type: 'SIZE_SET_SAMPLE_NOT_APPROVED',
            message: `No Size Set Sample exists for this style. An approved Size Set Sample is required before ${targetStage}.`,
            severity: 'CRITICAL',
          },
        ],
      };
    }

    // Check if approved
    const approvedStatuses: SampleStatus[] = ['APPROVED', 'APPROVED_WITH_COMMENTS'];
    const isApproved = approvedStatuses.includes(sizeSetSample.status);

    if (!isApproved) {
      return {
        isBlocked: true,
        blockers: [
          {
            type: 'SIZE_SET_SAMPLE_NOT_APPROVED',
            message: `Size Set Sample (${sizeSetSample.sampleNumber}) must be approved before ${targetStage}. Current status: ${sizeSetSample.status}`,
            severity: 'CRITICAL',
          },
        ],
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
        blockers: [
          {
            type: 'FPT_NOT_PASSED',
            message: `Fabric Physical Test (${fpt.testNumber}) must pass before ${targetStage}. Current result: ${fpt.overallTestResult}`,
            severity: 'CRITICAL',
          },
        ],
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
        blockers: [
          {
            type: 'GPT_NOT_PASSED',
            message: `Garment Physical Test (${gpt.testNumber}) must pass before ${targetStage}. Current result: ${gpt.overallTestResult}`,
            severity: 'CRITICAL',
          },
        ],
      };
    }

    return { isBlocked: false, blockers: [] };
  }

  /**
   * RULE 5: Critical materials (fabrics) must be in stock before cutting
   * Checks if all fabrics required for the style are available in sufficient quantity
   */
  async validateMaterialAvailabilityForStage(
    workOrderId: string,
    targetStage: ProductionStage
  ): Promise<ValidationResult> {
    // Determine which material types to validate at this stage
    let materialTypesToCheck: string[];
    if (targetStage === 'IN_CUTTING') {
      materialTypesToCheck = FABRIC_MATERIAL_TYPES;
    } else if (['IN_STITCHING', 'IN_EMBROIDERY', 'IN_HANDWORK'].includes(targetStage as string)) {
      materialTypesToCheck = TRIM_MATERIAL_TYPES;
    } else if (targetStage === 'IN_FINISHING') {
      materialTypesToCheck = FINISHING_MATERIAL_TYPES;
    } else {
      return { isBlocked: false, blockers: [] };
    }

    // Get work order's orderId and styleId to find Order BOM
    const workOrder = await prisma.work_orders.findUnique({
      where: { id: workOrderId },
      select: {
        id: true,
        orderId: true,
        styleId: true,
        totalQuantity: true,
      },
    });

    if (!workOrder || !workOrder.styleId) {
      return { isBlocked: false, blockers: [] };
    }

    // Skip BOM validation for stock production (MTS) work orders without an order
    if (!workOrder.orderId) {
      return { isBlocked: false, blockers: [] };
    }

    // Find the active approved/locked Order BOM
    const orderBom = await prisma.order_bom.findFirst({
      where: {
        orderId: workOrder.orderId!,
        styleId: workOrder.styleId,
        isActive: true,
        status: { in: ['APPROVED', 'LOCKED'] },
      },
      include: {
        items: {
          where: {
            materialType: { in: materialTypesToCheck },
          },
          include: {
            fabric_master: {
              select: { id: true, fabricCode: true, fabricName: true },
            },
            greige: {
              select: { id: true, greigeCode: true, greigeName: true },
            },
            material: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    });

    const blockers: BlockerInfo[] = [];

    // P6.1: Close the gate escape — require APPROVED/LOCKED BOM for orders
    // Previously this returned isBlocked: false, allowing cutting without a BOM
    if (!orderBom) {
      return {
        isBlocked: true,
        blockers: [
          {
            type: 'MISSING_BOM',
            message: 'No approved Order BOM found. Please create and approve the BOM before cutting.',
            severity: 'HIGH',
          },
        ],
      };
    }

    for (const bom of orderBom.items || []) {
      const totalRequired = Number(bom.totalWithWastage || bom.totalQuantity || 0);
      const isFabricType = FABRIC_MATERIAL_TYPES.includes(bom.materialType);

      let availableStock = 0;
      if (isFabricType) {
        const fabricStock = await prisma.fabric_stock.aggregate({
          where: { fabricId: bom.fabricId || '', status: 'AVAILABLE' },
          _sum: { quantityAvailable: true },
        });
        availableStock = Number(fabricStock._sum.quantityAvailable || 0);
      } else {
        if (!bom.materialId) continue;
        // T2-1 Stage B3: derived on-hand (per-lot truth) instead of hand-maintained stock_levels.quantity.
        availableStock = await getDerivedOnHand(bom.materialId);
      }

      const shortfall = totalRequired - availableStock;
      const toleranceQty = totalRequired * SHORTFALL_TOLERANCE_PERCENT;

      if (shortfall > toleranceQty) {
        const materialName = isFabricType
          ? bom.fabric_master?.fabricName || bom.greige?.greigeName || bom.componentName || 'Unknown Material'
          : bom.material?.name || bom.componentName || 'Unknown Material';
        const materialCode = isFabricType
          ? bom.fabric_master?.fabricCode || bom.greige?.greigeCode || ''
          : bom.material?.code || '';

        blockers.push({
          type: 'MATERIAL_SHORTAGE',
          message: `Insufficient stock for ${materialName} (${materialCode}). Required: ${totalRequired.toFixed(2)} ${bom.unit}, Available: ${availableStock.toFixed(2)} ${bom.unit}, Short: ${shortfall.toFixed(2)} ${bom.unit}`,
          severity: 'CRITICAL',
        });
      }
    }

    return {
      isBlocked: blockers.length > 0,
      blockers,
    };
  }

  /**
   * RULE 6: PRODUCTION CAD planning must exist with cadAverage before cutting
   * Ensures at least one fabric_width_cad row with purposeEnum=PRODUCTION
   * and non-null cadAverage exists for the style
   */
  async validateProductionCADForStage(styleId: string, targetStage: ProductionStage): Promise<ValidationResult> {
    if (targetStage !== 'IN_CUTTING') {
      return { isBlocked: false, blockers: [] };
    }

    // Check if any PRODUCTION CAD with valid cadAverage exists
    // Same 3-path query as buildCuttingChartData() in cutting.controller.ts
    const productionCadCount = await prisma.fabric_width_cad.count({
      where: {
        purposeEnum: 'PRODUCTION',
        cadAverage: { not: null },
        OR: [
          { costingStyleId: styleId },
          { styleFabric: { style_components: { styleId } } },
          { styleCosting: { styleId } },
        ],
      },
    });

    if (productionCadCount === 0) {
      const style = await prisma.styles.findUnique({
        where: { id: styleId },
        select: { styleCode: true, styleName: true },
      });

      const styleLabel = style ? `${style.styleCode} (${style.styleName})` : styleId;

      return {
        isBlocked: true,
        blockers: [
          {
            type: 'PRODUCTION_CAD_MISSING',
            message: `No PRODUCTION CAD planning found for style ${styleLabel}. Complete CAD planning with production averages before cutting.`,
            severity: 'CRITICAL',
          },
        ],
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

    // Get work order with style and customer info (including sample requirements)
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
                    customer_sample_requirements: {
                      select: { sampleType: true, isRequired: true, blocksProduction: true },
                    },
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

    // Extract sample requirements from customer (default to blocking if no requirements defined)
    type SampleReq = { sampleType: string; isRequired: boolean; blocksProduction: boolean };
    const sampleRequirements: SampleReq[] = customer?.customer_sample_requirements || [];
    const fitReq = sampleRequirements.find((r: SampleReq) => r.sampleType === 'FIT_SAMPLE');
    const sizeSetReq = sampleRequirements.find((r: SampleReq) => r.sampleType === 'SIZE_SET_SAMPLE');
    // Default: if no requirement defined, assume blocking is enabled (backward compatible)
    const fitBlocks = fitReq?.blocksProduction ?? true;
    const sizeSetBlocks = sizeSetReq?.blocksProduction ?? true;

    // Run all validations in parallel
    const [fitResult, sizeSetResult, fptResult, gptResult, materialResult, cadResult] = await Promise.all([
      this.validateFitSampleForStage(workOrder.styleId, targetStage, fitBlocks),
      this.validateSizeSetSampleForStage(workOrder.styleId, targetStage, sizeSetBlocks),
      this.validateFPTForStage(workOrder.styleId, targetStage, fptBlocksProduction),
      this.validateGPTForStage(workOrderId, targetStage, gptBlocksShipment),
      this.validateMaterialAvailabilityForStage(workOrderId, targetStage),
      this.validateProductionCADForStage(workOrder.styleId, targetStage),
    ]);

    // Aggregate all blockers
    const allBlockers: BlockerInfo[] = [
      ...fitResult.blockers,
      ...sizeSetResult.blockers,
      ...fptResult.blockers,
      ...gptResult.blockers,
      ...materialResult.blockers,
      ...cadResult.blockers,
    ];

    return {
      isBlocked: allBlockers.length > 0,
      blockers: allBlockers,
    };
  }

  /**
   * Check material readiness status for a work order
   * Returns detailed material availability information for UI display
   */
  async checkMaterialReadiness(workOrderId: string): Promise<{
    isReady: boolean;
    totalMaterials: number;
    availableMaterials: number;
    hasApprovedBom: boolean;
    missingMaterials: Array<{
      materialName: string;
      materialCode: string;
      required: number;
      available: number;
      shortfall: number;
      unit: string;
    }>;
  }> {
    // Get work order's orderId and styleId to find the Order BOM
    const workOrder = await prisma.work_orders.findUnique({
      where: { id: workOrderId },
      select: {
        orderId: true,
        styleId: true,
        totalQuantity: true,
      },
    });

    if (!workOrder) {
      return {
        isReady: false,
        totalMaterials: 0,
        availableMaterials: 0,
        hasApprovedBom: false,
        missingMaterials: [],
      };
    }

    // Skip BOM readiness check for stock production (MTS) work orders without an order
    if (!workOrder.orderId) {
      return {
        isReady: true,
        totalMaterials: 0,
        availableMaterials: 0,
        hasApprovedBom: false,
        missingMaterials: [],
      };
    }

    // Find the active approved/locked Order BOM for this order + style
    // Fetch ALL material types to give a complete readiness picture
    const orderBom = await prisma.order_bom.findFirst({
      where: {
        orderId: workOrder.orderId!,
        styleId: workOrder.styleId,
        isActive: true,
        status: { in: ['APPROVED', 'LOCKED'] },
      },
      include: {
        items: {
          include: {
            fabric_master: {
              select: { id: true, fabricCode: true, fabricName: true },
            },
            greige: {
              select: { id: true, greigeCode: true, greigeName: true },
            },
            material: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    });

    if (!orderBom) {
      return {
        isReady: false,
        totalMaterials: 0,
        availableMaterials: 0,
        hasApprovedBom: false,
        missingMaterials: [],
      };
    }

    const allBOMs = orderBom.items || [];
    const missingMaterials: Array<{
      materialName: string;
      materialCode: string;
      required: number;
      available: number;
      shortfall: number;
      unit: string;
    }> = [];

    let availableCount = 0;

    for (const bom of allBOMs) {
      const totalRequired = Number(bom.totalWithWastage || bom.totalQuantity || 0);
      const isFabricType = FABRIC_MATERIAL_TYPES.includes(bom.materialType);

      let availableStock = 0;
      if (isFabricType) {
        const fabricStock = await prisma.fabric_stock.aggregate({
          where: { fabricId: bom.fabricId || '', status: 'AVAILABLE' },
          _sum: { quantityAvailable: true },
        });
        availableStock = Number(fabricStock._sum.quantityAvailable || 0);
      } else {
        if (!bom.materialId) {
          availableCount++; // No materialId means no stock check possible — skip
          continue;
        }
        // T2-1 Stage B3: derived on-hand (per-lot truth) instead of hand-maintained stock_levels.quantity.
        availableStock = await getDerivedOnHand(bom.materialId);
      }

      const shortfall = totalRequired - availableStock;
      const toleranceQty = totalRequired * SHORTFALL_TOLERANCE_PERCENT;

      if (shortfall > toleranceQty) {
        const materialName = isFabricType
          ? bom.fabric_master?.fabricName || bom.greige?.greigeName || bom.componentName || 'Unknown'
          : bom.material?.name || bom.componentName || 'Unknown';
        const materialCode = isFabricType
          ? bom.fabric_master?.fabricCode || bom.greige?.greigeCode || ''
          : bom.material?.code || '';
        missingMaterials.push({
          materialName,
          materialCode,
          required: totalRequired,
          available: availableStock,
          shortfall,
          unit: bom.unit,
        });
      } else {
        availableCount++;
      }
    }

    return {
      isReady: missingMaterials.length === 0,
      totalMaterials: allBOMs.length,
      availableMaterials: availableCount,
      hasApprovedBom: true,
      missingMaterials,
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
   * Accepts an optional tx so callers can make the override log atomic with the
   * action it audits (bug-hunt samples-embroidery-11).
   */
  async logOverride(data: OverrideLogData, tx?: Prisma.TransactionClient): Promise<void> {
    const db = tx ?? prisma;
    // toStage is a required column; SAMPLE_CREATION overrides have no real stage transition,
    // so use ORDER_RECEIVED as a documented sentinel instead of throwing on undefined
    // (bug-hunt samples-embroidery-11 — proper fix is a nullable-toStage migration).
    const toStage: ProductionStage = data.toStage ?? 'ORDER_RECEIVED';
    await db.stage_transition_overrides.create({
      data: {
        id: randomUUID(),
        blockType: data.blockType,
        workOrderId: data.workOrderId,
        orderItemId: data.orderItemId,
        sampleId: data.sampleId,
        fromStage: data.fromStage,
        toStage,
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
