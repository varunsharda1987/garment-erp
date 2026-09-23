import { Prisma, ProductionStage, SampleType, SampleStatus, TestResult } from '@prisma/client';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import { getDerivedOnHand } from './helpers/derived-stock.helper';
import { latestSampleRoundForStyle } from './helpers/lab-round.helper';

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

type BomFabricLine = { fabricId: string | null; greigeId: string | null };
type RunIdentity = { styleId: string; orderId: string | null };

type SampleReq = { sampleType: string; isRequired: boolean; blocksProduction: boolean };
type CustomerGates = {
  fitBlocks: boolean;
  sizeSetBlocks: boolean;
  shipmentSampleBlocks: boolean;
  fptBlocksProduction: boolean;
  gptBlocksShipment: boolean;
};

/**
 * Which gates this customer actually enforces.
 *
 * Shared by the work-order orchestrator and the order-level one so the rule is written once. The
 * `isRequired && blocksProduction` part is the subtle half: the customer screen keeps a hidden
 * `blocksProduction` on un-ticked sample types, so honouring `blocksProduction` alone would block
 * production for a customer who had explicitly opted out of FIT / size-set samples. No row at all
 * keeps the backward-compatible default of blocking.
 */
function resolveCustomerGates(
  customer:
    | {
        fptBlocksProduction?: boolean | null;
        gptBlocksShipment?: boolean | null;
        customer_sample_requirements?: SampleReq[] | null;
      }
    | null
    | undefined
): CustomerGates {
  const sampleRequirements: SampleReq[] = customer?.customer_sample_requirements || [];
  const blocks = (req: SampleReq | undefined) => (req ? req.isRequired && req.blocksProduction : true);

  // The Shipment Sample gate is OPT-IN: only an explicit row blocks. It is a newer gate (2026-09-23)
  // than FIT / Size Set, and "no row blocks" here would stop every dispatch of every customer who
  // never configured sample requirements — House of Kasya, the live B2B buyer, has none.
  const shipmentReq = sampleRequirements.find((r) => r.sampleType === 'SHIPMENT_SAMPLE');

  return {
    fitBlocks: blocks(sampleRequirements.find((r) => r.sampleType === 'FIT_SAMPLE')),
    sizeSetBlocks: blocks(sampleRequirements.find((r) => r.sampleType === 'SIZE_SET_SAMPLE')),
    shipmentSampleBlocks: shipmentReq ? shipmentReq.isRequired && shipmentReq.blocksProduction : false,
    fptBlocksProduction: customer?.fptBlocksProduction ?? false,
    // Default to true for safety
    gptBlocksShipment: customer?.gptBlocksShipment ?? true,
  };
}

/**
 * How much AVAILABLE finished fabric answers one Order BOM fabric/greige line.
 *
 * `order_bom_items.fabricId` is null BY DESIGN at BOM time — the finished fabric does not exist yet
 * (see schema.prisma) — and it is stamped later only when the CAD row's style slot already carries a
 * fabricId (`syncBomFabricId`). The first real order-backed run (ORD2026080025, 2026-09-21) had
 * 1,704 m of dyed fabric in stock and this check read "Available: 0.00" because it keyed on that
 * null column. So a line with no fabricId is answered by LINEAGE instead: lots of a fabric master
 * processed FROM the line's greige (`fabric_master.greigeId`) that belong to this style — received
 * for it (`fabric_stock.originStyleId`, stamped by the job-work return) or for this order
 * (`originOrderId`), or whose master has been allocated to the style (`style_fabrics.fabricId`,
 * the Fabric Master → Allocate to Style action). Another style's fabric from the same greige never
 * counts. A stamped fabricId keeps the old rule: that master's lots, exactly what the cutting chart
 * will plan against.
 */
async function availableFabricForBomLine(bom: BomFabricLine, run: RunIdentity): Promise<number> {
  let where: Prisma.fabric_stockWhereInput;
  if (bom.fabricId) {
    where = { fabricId: bom.fabricId, status: 'AVAILABLE' };
  } else if (bom.greigeId) {
    where = {
      status: 'AVAILABLE',
      fabricMaster: { greigeId: bom.greigeId },
      OR: [
        { originStyleId: run.styleId },
        ...(run.orderId ? [{ originOrderId: run.orderId }] : []),
        { fabricMaster: { styleFabrics: { some: { style_components: { styleId: run.styleId } } } } },
      ],
    };
  } else {
    return 0;
  }
  const agg = await prisma.fabric_stock.aggregate({ where, _sum: { quantityAvailable: true } });
  return Number(agg._sum.quantityAvailable || 0);
}

/** The one-line "what to do" appended to a shortage on a line the lineage lookup could not answer. */
function fabricLineageHint(bom: BomFabricLine, available: number): string {
  if (bom.fabricId || available > 0) return '';
  return bom.greigeId
    ? ' — no finished fabric made from this greige has been received for this style yet (receive the job-work return, or allocate the fabric to the style in Fabric Master)'
    : ' — this BOM line names neither a fabric nor a greige, so no stock can be matched to it';
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
 * 4b. Shipment Sample (approved + latest lab round passed) → Blocks Ready-to-ship, Shipped, Dispatch (opt-in)
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
   * RULE 4b: Shipment Sample — bulk goods ship on the Shipment Sample (owner, 2026-09-23).
   *
   * Blocks READY_TO_SHIP / SHIPPED — and dispatch, via validateShipmentSampleForDispatch — unless the
   * style's latest Shipment Sample for this buyer is APPROVED (or approved with comments) AND the latest
   * lab round on any of the style's samples for this buyer PASSED (lab-round.helper.ts is the one
   * definition of "passed"). Any sample, not the Shipment Sample's own: the garment is lab-tested on the
   * PP sample before it is sent (owner, 2026-09-23), so requiring a round on the Shipment Sample itself
   * would block dispatch forever. Both conditions, because approving a sample only WARNS about a failed
   * round; it does not refuse.
   *
   * Opt-in per customer (see resolveCustomerGates): only an explicit SHIPMENT_SAMPLE requirement that is
   * required AND blocking turns this on.
   */
  async validateShipmentSampleForStage(
    styleId: string,
    targetStage: ProductionStage,
    customerShipmentBlocks: boolean,
    customerId?: string | null
  ): Promise<ValidationResult> {
    if (!customerShipmentBlocks) {
      return { isBlocked: false, blockers: [] };
    }

    const blockedStages: ProductionStage[] = ['READY_TO_SHIP', 'SHIPPED'];
    if (!blockedStages.includes(targetStage)) {
      return { isBlocked: false, blockers: [] };
    }

    const shipmentSample = await prisma.samples.findFirst({
      where: {
        styleId,
        sampleType: 'SHIPMENT_SAMPLE',
        isActive: true,
        ...(customerId ? { customerId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, sampleNumber: true, status: true, styles: { select: { styleCode: true } } },
    });
    const styleLabel = shipmentSample?.styles?.styleCode ?? 'this style';

    if (!shipmentSample) {
      return {
        isBlocked: true,
        blockers: [
          {
            type: 'SHIPMENT_SAMPLE_NOT_APPROVED',
            message: `No Shipment Sample exists for this style. An approved Shipment Sample with a passed lab test is required before ${targetStage}.`,
            severity: 'CRITICAL',
          },
        ],
      };
    }

    const blockers: BlockerInfo[] = [];
    const approvedStatuses: SampleStatus[] = ['APPROVED', 'APPROVED_WITH_COMMENTS'];
    if (!approvedStatuses.includes(shipmentSample.status)) {
      blockers.push({
        type: 'SHIPMENT_SAMPLE_NOT_APPROVED',
        message: `Shipment Sample ${shipmentSample.sampleNumber} (${styleLabel}) must be approved before ${targetStage}. Current status: ${shipmentSample.status}`,
        severity: 'CRITICAL',
      });
    }

    const round = await latestSampleRoundForStyle(styleId, customerId);
    if (!round) {
      blockers.push({
        type: 'SAMPLE_LAB_NOT_PASSED',
        message: `No sample of ${styleLabel} has been sent for lab testing. A passed garment test (lab round) is required before ${targetStage}.`,
        severity: 'CRITICAL',
      });
    } else if (round.result !== 'PASS') {
      blockers.push({
        type: 'SAMPLE_LAB_NOT_PASSED',
        message:
          round.result === 'FAIL'
            ? `The latest lab round for ${styleLabel}, ${round.trfNumber} on sample ${round.sampleNumber}, failed${round.reportNumber ? ` (report ${round.reportNumber})` : ''}. A passing retest round is required before ${targetStage}.`
            : `The latest lab round for ${styleLabel}, ${round.trfNumber} on sample ${round.sampleNumber}, has no result recorded yet. A passed lab round is required before ${targetStage}.`,
        severity: 'CRITICAL',
      });
    }

    return { isBlocked: blockers.length > 0, blockers };
  }

  /**
   * The Shipment Sample rule for a dispatch, per style — so dispatch.controller.ts asks this service
   * instead of re-deriving the rule. The customer comes from whichever order the delivery note hangs
   * off (production `orders` OR `sale_orders`); a null customer means no gate can apply.
   */
  async validateShipmentSampleForDispatch(
    styleIds: string[],
    customerId: string | null | undefined
  ): Promise<ValidationResult> {
    if (!customerId || styleIds.length === 0) {
      return { isBlocked: false, blockers: [] };
    }
    const customer = await prisma.customers.findUnique({
      where: { id: customerId },
      select: {
        fptBlocksProduction: true,
        gptBlocksShipment: true,
        customer_sample_requirements: {
          select: { sampleType: true, isRequired: true, blocksProduction: true },
        },
      },
    });
    const { shipmentSampleBlocks } = resolveCustomerGates(customer);
    if (!shipmentSampleBlocks) {
      return { isBlocked: false, blockers: [] };
    }

    const results = await Promise.all(
      [...new Set(styleIds)].map((styleId) => this.validateShipmentSampleForStage(styleId, 'SHIPPED', true, customerId))
    );
    const blockers = results.flatMap((r) => r.blockers);
    return { isBlocked: blockers.length > 0, blockers };
  }

  /**
   * RULE 5: Critical materials (fabrics) must be in stock before cutting
   * Checks if all fabrics required for the style are available in sufficient quantity
   */
  async validateMaterialAvailabilityForStage(
    workOrderId: string,
    targetStage: ProductionStage
  ): Promise<ValidationResult> {
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

    // Skip BOM validation for stock production (MTS) work orders without an order.
    // "MTS run" is a work-order concept, so the guard stays in this wrapper.
    if (!workOrder.orderId) {
      return { isBlocked: false, blockers: [] };
    }

    return this.validateMaterialAvailabilityForRun(
      { styleId: workOrder.styleId, orderId: workOrder.orderId },
      targetStage
    );
  }

  /**
   * The body of the materials check, keyed on the RUN (style + order) rather than a work order.
   *
   * Split out on 2026-09-21 so the Manufacturing Control Center can answer "why can't this order
   * start?" before any work order exists — which is the state every open order is in today.
   *
   * This must never be reimplemented order-side. `availableFabricForBomLine` is the CUT-5 fix: a BOM
   * line's `fabricId` is NULL by design at BOM time, so availability is answered by greige LINEAGE.
   * A re-derivation that keyed on the column would report "Available: 0.00" against 1,704 m of dyed
   * fabric physically in stock, which is exactly the bug that fix removed.
   */
  private async validateMaterialAvailabilityForRun(
    run: RunIdentity,
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

    if (!run.orderId) {
      return { isBlocked: false, blockers: [] };
    }

    // Find the active approved/locked Order BOM
    const orderBom = await prisma.order_bom.findFirst({
      where: {
        orderId: run.orderId,
        styleId: run.styleId,
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
        availableStock = await availableFabricForBomLine(bom, run);
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
        const hint = isFabricType ? fabricLineageHint(bom, availableStock) : '';

        blockers.push({
          type: 'MATERIAL_SHORTAGE',
          message: `Insufficient stock for ${materialName} (${materialCode}). Required: ${totalRequired.toFixed(2)} ${bom.unit}, Available: ${availableStock.toFixed(2)} ${bom.unit}, Short: ${shortfall.toFixed(2)} ${bom.unit}${hint}`,
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
   * RULE 6: an APPROVED PRODUCTION CAD with an average must exist before cutting.
   *
   * Until 2026-09-23 any PRODUCTION row with a cadAverage counted — pending or REJECTED. ESSKY085LS
   * read "ready to cut" on a Production CAD its author had rejected 40 s after making it. Owner
   * decision: cutting needs an approved one (the runbook already told the team to approve it).
   * The refusal names what is missing, so the team knows the next click.
   */
  async validateProductionCADForStage(styleId: string, targetStage: ProductionStage): Promise<ValidationResult> {
    if (targetStage !== 'IN_CUTTING') {
      return { isBlocked: false, blockers: [] };
    }

    // Same 3-path query as buildCuttingChartData() in cutting.controller.ts
    const productionCads = await prisma.fabric_width_cad.findMany({
      where: {
        purposeEnum: 'PRODUCTION',
        OR: [
          { costingStyleId: styleId },
          { styleFabric: { style_components: { styleId } } },
          { styleCosting: { styleId } },
        ],
      },
      // allow-cad-approval — cutting consumes the CAD GEOMETRY, whose approval this is
      select: { approvalStatus: true, cadAverage: true },
    });

    const hasAverage = (c: { cadAverage: unknown }) => c.cadAverage !== null && Number(c.cadAverage) > 0;
    const approved = productionCads.filter((c) => c.approvalStatus === 'APPROVED'); // allow-cad-approval
    if (approved.some(hasAverage)) {
      return { isBlocked: false, blockers: [] };
    }

    const style = await prisma.styles.findUnique({
      where: { id: styleId },
      select: { styleCode: true, styleName: true },
    });
    const styleLabel = style ? `${style.styleCode} (${style.styleName})` : styleId;
    const pending = productionCads.filter((c) => c.approvalStatus !== 'APPROVED' && c.approvalStatus !== 'REJECTED'); // allow-cad-approval

    let message: string;
    if (approved.length > 0) {
      message =
        `The approved Production CAD for style ${styleLabel} has no average. ` +
        `Reject it, enter the layer length and size breakdown, and approve it again.`;
    } else if (pending.length > 0) {
      message =
        `The Production CAD for style ${styleLabel} is waiting for approval. Open CAD Planning and ` +
        `approve it (row menu → Approve) — cutting needs an approved Production CAD.`;
    } else if (productionCads.length > 0) {
      message =
        `The Production CAD for style ${styleLabel} was rejected. In CAD Planning, press Create CAD ` +
        `on the fabric lot to make a new one, then approve it.`;
    } else {
      message =
        `No Production CAD for style ${styleLabel}. In CAD Planning, press Create CAD on the fabric lot, ` +
        `check the marker, then approve it.`;
    }

    return {
      isBlocked: true,
      blockers: [{ type: 'PRODUCTION_CAD_MISSING', message, severity: 'CRITICAL' }],
    };
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
                customerId: true,
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

    const { fitBlocks, sizeSetBlocks, shipmentSampleBlocks, fptBlocksProduction, gptBlocksShipment } =
      resolveCustomerGates(workOrder.order_items?.orders?.customers);
    const customerId = workOrder.order_items?.orders?.customerId ?? null;

    // Run all validations in parallel
    const [fitResult, sizeSetResult, fptResult, gptResult, shipmentResult, materialResult, cadResult] =
      await Promise.all([
        this.validateFitSampleForStage(workOrder.styleId, targetStage, fitBlocks),
        this.validateSizeSetSampleForStage(workOrder.styleId, targetStage, sizeSetBlocks),
        this.validateFPTForStage(workOrder.styleId, targetStage, fptBlocksProduction),
        this.validateGPTForStage(workOrderId, targetStage, gptBlocksShipment),
        this.validateShipmentSampleForStage(workOrder.styleId, targetStage, shipmentSampleBlocks, customerId),
        this.validateMaterialAvailabilityForStage(workOrderId, targetStage),
        this.validateProductionCADForStage(workOrder.styleId, targetStage),
      ]);

    // Aggregate all blockers
    const allBlockers: BlockerInfo[] = [
      ...fitResult.blockers,
      ...sizeSetResult.blockers,
      ...fptResult.blockers,
      ...gptResult.blockers,
      ...shipmentResult.blockers,
      ...materialResult.blockers,
      ...cadResult.blockers,
    ];

    return {
      isBlocked: allBlockers.length > 0,
      blockers: allBlockers,
    };
  }

  /**
   * What stands between an ORDER ITEM and a stage, before any work order exists.
   *
   * `validateStageTransition` keys on a work order, so it cannot answer for an order that has not
   * reached one — which on 2026-09-21 was every open order in the system (8 of them, all blocked
   * for cutting). The Manufacturing Control Center needs exactly that answer, so this composes the
   * same validators at order grain rather than letting the dashboard re-derive prerequisites.
   * CLAUDE.md: stage prerequisites live in ONE place, and this is it.
   *
   * GPT is the one gate that cannot be evaluated here: a garment test is per production run, so
   * `validateGPTForStage` keys on a work order and there is nothing to test before cutting starts.
   * That is returned as `gptEvaluated: false` rather than silently omitted, so a caller can say
   * "garment test is checked once cutting starts" instead of implying a pass.
   */
  async validateOrderItemForStage(
    orderItemId: string,
    targetStage: ProductionStage
  ): Promise<ValidationResult & { gptEvaluated: boolean }> {
    const orderItem = await prisma.order_items.findUnique({
      where: { id: orderItemId },
      select: {
        id: true,
        styleId: true,
        orderId: true,
        orders: {
          select: {
            customerId: true,
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
    });

    // No style — nothing to validate against, same stance as validateStageTransition.
    if (!orderItem?.styleId) {
      return { isBlocked: false, blockers: [], gptEvaluated: false };
    }

    const { fitBlocks, sizeSetBlocks, shipmentSampleBlocks, fptBlocksProduction } = resolveCustomerGates(
      orderItem.orders?.customers
    );
    const run: RunIdentity = { styleId: orderItem.styleId, orderId: orderItem.orderId };

    const [fitResult, sizeSetResult, fptResult, shipmentResult, materialResult, cadResult] = await Promise.all([
      this.validateFitSampleForStage(orderItem.styleId, targetStage, fitBlocks),
      this.validateSizeSetSampleForStage(orderItem.styleId, targetStage, sizeSetBlocks),
      this.validateFPTForStage(orderItem.styleId, targetStage, fptBlocksProduction),
      this.validateShipmentSampleForStage(
        orderItem.styleId,
        targetStage,
        shipmentSampleBlocks,
        orderItem.orders?.customerId ?? null
      ),
      this.validateMaterialAvailabilityForRun(run, targetStage),
      this.validateProductionCADForStage(orderItem.styleId, targetStage),
    ]);

    const allBlockers: BlockerInfo[] = [
      ...fitResult.blockers,
      ...sizeSetResult.blockers,
      ...fptResult.blockers,
      ...shipmentResult.blockers,
      ...materialResult.blockers,
      ...cadResult.blockers,
    ];

    return {
      isBlocked: allBlockers.length > 0,
      blockers: allBlockers,
      gptEvaluated: false,
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
        availableStock = await availableFabricForBomLine(bom, workOrder);
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
