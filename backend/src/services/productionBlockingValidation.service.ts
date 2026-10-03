import { Prisma, ProductionStage, SampleType, SampleStatus, TestResult } from '@prisma/client';
import { getRunFabricPosition, runIdsForOrderStyle } from './helpers/run-fabric.helper';
import { randomUUID } from 'crypto';
import prisma from '../config/database';
import {
  describeShortSizes,
  lineIsShort,
  runLineAvailability,
  type SizeAvailability,
} from './helpers/run-line-availability.helper';
import { qtyExceeds } from '../utils/quantity';
import { latestSampleRoundForStyle } from './helpers/lab-round.helper';
import { notInProcessorUnitWhere } from './helpers/lot-location.helper';
import { styleCodeLabel } from '../utils/style-code';

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
  /** Shown, never blocking — e.g. labels or trims still to come when a run goes to cutting */
  warnings?: BlockerInfo[];
}

/** One Order BOM line the order cannot fully cover (see `orderBomMaterialPosition`). */
interface MaterialShortLine {
  materialType: string;
  materialName: string;
  materialCode: string;
  required: number;
  available: number;
  shortfall: number;
  unit: string;
  /** Fabric: cutting cannot go ahead without it. Everything else only warns at cutting. */
  blocksCutting: boolean;
  /** A label that comes in sizes — each size is enforced when its pieces go to stitching */
  sizedLabel?: boolean;
  unlinked?: boolean;
  /** The short sizes of a sized label */
  sizes?: SizeAvailability[];
  message: string;
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
  ppBlocks: boolean;
  sizeSetBlocks: boolean;
  shipmentSampleBlocks: boolean;
  fptBlocksProduction: boolean;
  gptBlocksShipment: boolean;
};
type GateCustomer = {
  fptBlocksProduction?: boolean | null;
  gptBlocksShipment?: boolean | null;
  customer_sample_requirements?: SampleReq[] | null;
};

/** The customer fields `resolveCustomerGates` reads — select these wherever a customer is loaded for it. */
export const GATE_CUSTOMER_SELECT = {
  fptBlocksProduction: true,
  gptBlocksShipment: true,
  customer_sample_requirements: {
    select: { sampleType: true, isRequired: true, blocksProduction: true },
  },
} as const;

/** The sample-approval order. A sample may be raised once every EARLIER type its customer requires is approved. */
const SAMPLE_CHAIN: SampleType[] = ['FIT_SAMPLE', 'PP_SAMPLE', 'SIZE_SET_SAMPLE'];

const SAMPLE_LABEL: Partial<Record<SampleType, string>> = {
  FIT_SAMPLE: 'FIT Sample',
  PP_SAMPLE: 'PP Sample',
  SIZE_SET_SAMPLE: 'Size Set Sample',
};

const APPROVED_SAMPLE_STATUSES: SampleStatus[] = ['APPROVED', 'APPROVED_WITH_COMMENTS'];

/** Cutting and everything after it. */
const CUTTING_ONWARD: ProductionStage[] = [
  'IN_CUTTING',
  'IN_STITCHING',
  'IN_EMBROIDERY',
  'IN_HANDWORK',
  'IN_FINISHING',
  'READY_TO_SHIP',
  'SHIPPED',
];

/**
 * Which gates this customer actually enforces — THE sample rule (owner, 2026-10-02).
 *
 * A sample type holds production up only when the customer's sample requirements mark it Required AND
 * Blocks Production. No row = not required: that is what the customer screen has always shown ("Samples
 * won't be auto-created for this customer"), while this function used to read the same state as FIT +
 * Size Set required — Kashaya Fabs, which needs no samples, was refused cutting for one. The
 * `isRequired &&` half matters too: the screen keeps a hidden `blocksProduction` on un-ticked types.
 *
 * Shared by both orchestrators and the production-status dashboards so the rule is written once.
 */
export function resolveCustomerGates(customer: GateCustomer | null | undefined): CustomerGates {
  const sampleRequirements: SampleReq[] = customer?.customer_sample_requirements || [];
  const blocks = (sampleType: SampleType) => {
    const req = sampleRequirements.find((r) => r.sampleType === sampleType);
    return req ? req.isRequired && req.blocksProduction : false;
  };

  return {
    fitBlocks: blocks('FIT_SAMPLE'),
    ppBlocks: blocks('PP_SAMPLE'),
    sizeSetBlocks: blocks('SIZE_SET_SAMPLE'),
    shipmentSampleBlocks: blocks('SHIPMENT_SAMPLE'),
    fptBlocksProduction: customer?.fptBlocksProduction ?? false,
    // Default to true for safety
    gptBlocksShipment: customer?.gptBlocksShipment ?? true,
  };
}

/**
 * Whose sample rules a production run follows: the order line's customer, else the run's order's
 * customer, else the style's buyer. Stock runs have no order, so they follow the style's buyer (owner,
 * 2026-10-02) — before, a run with no order line got the old "FIT + Size Set required" default.
 */
async function resolveRunCustomer(
  workOrderId: string
): Promise<{ styleId: string | null; customerId: string | null; customer: GateCustomer | null } | null> {
  const workOrder = await prisma.work_orders.findUnique({
    where: { id: workOrderId },
    select: {
      styleId: true,
      order_items: {
        select: { orders: { select: { customerId: true, customers: { select: GATE_CUSTOMER_SELECT } } } },
      },
      orders: { select: { customerId: true, customers: { select: GATE_CUSTOMER_SELECT } } },
      styles: { select: { customerId: true, customer: { select: GATE_CUSTOMER_SELECT } } },
    },
  });
  if (!workOrder) return null;

  const fromLine = workOrder.order_items?.orders;
  if (fromLine?.customers)
    return { styleId: workOrder.styleId, customerId: fromLine.customerId, customer: fromLine.customers };
  if (workOrder.orders?.customers) {
    return {
      styleId: workOrder.styleId,
      customerId: workOrder.orders.customerId,
      customer: workOrder.orders.customers,
    };
  }
  return {
    styleId: workOrder.styleId,
    customerId: workOrder.styles?.customerId ?? null,
    customer: workOrder.styles?.customer ?? null,
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
  // Which lots may serve this line (lineage); availability is then the store PLUS what is already
  // with Cutting for this order's runs of the style — issuing fabric must not read as a shortage
  // (ESSKY085LS was BLOCKED with its 1,704 m on the cutting floor, 2026-09-24). run-fabric.helper.ts
  let lineage: Prisma.fabric_stockWhereInput;
  if (bom.fabricId) {
    lineage = { fabricId: bom.fabricId };
  } else if (bom.greigeId) {
    lineage = {
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
  // Fabric lying at a processor's unit (delivered straight there, Phase 4a) is not ours to cut here —
  // only that processor's job draws it where it lies
  const agg = await prisma.fabric_stock.aggregate({
    where: { AND: [lineage, { status: 'AVAILABLE' }, notInProcessorUnitWhere()] },
    _sum: { quantityAvailable: true },
  });
  const inStore = Number(agg._sum.quantityAvailable || 0);

  if (!run.orderId) return inStore;
  const position = await getRunFabricPosition(await runIdsForOrderStyle(run.orderId, run.styleId));
  const withCutting = [...position.lots.values()].filter((l) => l.atCutting > 0);
  if (withCutting.length === 0) return inStore;
  const matching = await prisma.fabric_stock.findMany({
    where: { AND: [lineage, { id: { in: withCutting.map((l) => l.fabricStockId) } }] },
    select: { id: true },
  });
  const ids = new Set(matching.map((m) => m.id));
  return inStore + withCutting.filter((l) => ids.has(l.fabricStockId)).reduce((sum, l) => sum + l.atCutting, 0);
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
 * 1. FIT Sample → Blocks Printing, Dyeing, Cutting & Beyond   } only when the customer marks the
 * 1b. PP Sample → Blocks Cutting & Beyond                      } type Required + Blocks Production
 * 2. Size Set Sample → Blocks Cutting & Beyond                 } (resolveCustomerGates)
 * 3. FPT (Fabric Physical Test) → Blocks Cutting & Beyond
 * 4. GPT (Garment Physical Test) → Blocks Cutting & Beyond
 * 4b. Shipment Sample (approved + latest lab round passed) → Blocks Ready-to-ship, Shipped, Dispatch (opt-in)
 * 6. Sample creation order (FIT → PP → SIZE_SET, skipping types the customer does not require)
 */
class ProductionBlockingValidationService {
  /**
   * RULE 1: FIT Sample blocks printing, dyeing, cutting and everything after
   * @param customerFitBlocks - false = the customer does not require FIT approval (resolveCustomerGates)
   */
  async validateFitSampleForStage(
    styleId: string,
    targetStage: ProductionStage,
    customerFitBlocks: boolean
  ): Promise<ValidationResult> {
    return this.validateApprovedSampleForStage(styleId, targetStage, 'FIT_SAMPLE', customerFitBlocks, [
      'IN_PRINTING',
      'IN_DYING',
      ...CUTTING_ONWARD,
    ]);
  }

  /**
   * RULE 1b: PP Sample blocks cutting and everything after
   * @param customerPPBlocks - false = the customer does not require PP approval (resolveCustomerGates)
   */
  async validatePPSampleForStage(
    styleId: string,
    targetStage: ProductionStage,
    customerPPBlocks: boolean
  ): Promise<ValidationResult> {
    return this.validateApprovedSampleForStage(styleId, targetStage, 'PP_SAMPLE', customerPPBlocks, CUTTING_ONWARD);
  }

  /**
   * RULE 2: Size Set Sample blocks cutting and everything after
   * @param customerSizeSetBlocks - false = the customer does not require Size Set approval (resolveCustomerGates)
   */
  async validateSizeSetSampleForStage(
    styleId: string,
    targetStage: ProductionStage,
    customerSizeSetBlocks: boolean
  ): Promise<ValidationResult> {
    return this.validateApprovedSampleForStage(
      styleId,
      targetStage,
      'SIZE_SET_SAMPLE',
      customerSizeSetBlocks,
      CUTTING_ONWARD
    );
  }

  /**
   * The style's LATEST sample of this type must be approved before any of `blockedStages`.
   * No sample at all blocks too — returning not-blocked let a style skip the gate by never creating the
   * sample (bug-hunt samples-embroidery-14). Admin override remains available.
   */
  private async validateApprovedSampleForStage(
    styleId: string,
    targetStage: ProductionStage,
    sampleType: 'FIT_SAMPLE' | 'PP_SAMPLE' | 'SIZE_SET_SAMPLE',
    customerBlocks: boolean,
    blockedStages: ProductionStage[]
  ): Promise<ValidationResult> {
    if (!customerBlocks || !blockedStages.includes(targetStage)) {
      return { isBlocked: false, blockers: [] };
    }

    const label = SAMPLE_LABEL[sampleType];
    const type = `${sampleType}_NOT_APPROVED`;
    const sample = await prisma.samples.findFirst({
      where: { styleId, sampleType },
      orderBy: { createdAt: 'desc' },
      select: { sampleNumber: true, status: true },
    });

    if (!sample) {
      return {
        isBlocked: true,
        blockers: [
          {
            type,
            message: `No ${label} exists for this style. The customer requires an approved ${label} before ${targetStage}.`,
            severity: 'CRITICAL',
          },
        ],
      };
    }

    if (!APPROVED_SAMPLE_STATUSES.includes(sample.status)) {
      return {
        isBlocked: true,
        blockers: [
          {
            type,
            message: `${label} (${sample.sampleNumber}) must be approved before ${targetStage}. Current status: ${sample.status}`,
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
      select: {
        id: true,
        sampleNumber: true,
        status: true,
        styles: { select: { styleCode: true, buyerStyleRef: true } },
      },
    });
    const styleLabel = styleCodeLabel(shipmentSample?.styles, null, 'this style');

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
    // Which materials hold up this stage. Cutting needs its fabric; the trims and labels a run will need later
    // are only a WARNING at cutting (owner, 2026-10-03). A label that comes in sizes never holds up a whole
    // stage: each size is enforced when its pieces go to stitching (`labelCoverForStitching`).
    let blockingTypes: string[];
    if (targetStage === 'IN_CUTTING') {
      blockingTypes = FABRIC_MATERIAL_TYPES;
    } else if (['IN_STITCHING', 'IN_EMBROIDERY', 'IN_HANDWORK'].includes(targetStage as string)) {
      blockingTypes = TRIM_MATERIAL_TYPES;
    } else if (targetStage === 'IN_FINISHING') {
      blockingTypes = FINISHING_MATERIAL_TYPES;
    } else {
      return { isBlocked: false, blockers: [] };
    }

    if (!run.orderId) {
      return { isBlocked: false, blockers: [] };
    }

    const position = await this.orderBomMaterialPosition({ styleId: run.styleId, orderId: run.orderId });

    // P6.1: Close the gate escape — require APPROVED/LOCKED BOM for orders
    // Previously this returned isBlocked: false, allowing cutting without a BOM
    if (!position.hasApprovedBom) {
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

    const blockers: BlockerInfo[] = [];
    const warnings: BlockerInfo[] = [];
    for (const line of position.shortLines) {
      const entry: BlockerInfo = { type: 'MATERIAL_SHORTAGE', message: line.message, severity: 'CRITICAL' };
      // A line with no material cannot be checked — it warns (fix the BOM line); it never stops a stage move
      const blocks = blockingTypes.includes(line.materialType) && !line.sizedLabel && !line.unlinked;
      if (blocks) blockers.push(entry);
      else if (targetStage === 'IN_CUTTING' || line.sizedLabel || line.unlinked)
        warnings.push({ ...entry, severity: 'MEDIUM' });
    }

    return { isBlocked: blockers.length > 0, blockers, warnings };
  }

  /**
   * Every Order BOM line of an order + style with what the order can use of it, and the lines that are short.
   * THE material position the stage gate and the run page's Material Readiness both read — they were two
   * copies of one loop until 2026-10-03. Fabric is answered by greige lineage (`availableFabricForBomLine`),
   * everything else by `runLineAvailability` (size-aware labels, other orders' holds, goods already issued).
   */
  private async orderBomMaterialPosition(run: { styleId: string; orderId: string }): Promise<{
    hasApprovedBom: boolean;
    totalLines: number;
    shortLines: MaterialShortLine[];
  }> {
    const orderBom = await prisma.order_bom.findFirst({
      where: {
        orderId: run.orderId,
        styleId: run.styleId,
        isActive: true,
        status: { in: ['APPROVED', 'LOCKED'] },
      },
      include: {
        items: {
          include: {
            fabric_master: { select: { id: true, fabricCode: true, fabricName: true } },
            greige: { select: { id: true, greigeCode: true, greigeName: true } },
          },
        },
      },
    });
    if (!orderBom) return { hasApprovedBom: false, totalLines: 0, shortLines: [] };

    const items = orderBom.items || [];
    const shortLines: MaterialShortLine[] = [];

    for (const bom of items.filter((b) => FABRIC_MATERIAL_TYPES.includes(b.materialType))) {
      const required = Number(bom.totalWithWastage || bom.totalQuantity || 0);
      const available = await availableFabricForBomLine(bom, run);
      const shortfall = required - available;
      if (shortfall <= required * SHORTFALL_TOLERANCE_PERCENT) continue;
      const materialName =
        bom.fabric_master?.fabricName || bom.greige?.greigeName || bom.componentName || 'Unknown Material';
      const materialCode = bom.fabric_master?.fabricCode || bom.greige?.greigeCode || '';
      shortLines.push({
        materialType: bom.materialType,
        materialName,
        materialCode,
        required,
        available,
        shortfall,
        unit: bom.unit,
        blocksCutting: true,
        message: `Insufficient stock for ${materialName} (${materialCode}). Required: ${required.toFixed(2)} ${bom.unit}, Available: ${available.toFixed(2)} ${bom.unit}, Short: ${shortfall.toFixed(2)} ${bom.unit}${fabricLineageHint(bom, available)}`,
      });
    }

    const others = items.filter((b) => !FABRIC_MATERIAL_TYPES.includes(b.materialType));
    const availability = await runLineAvailability({ orderId: run.orderId, styleId: run.styleId }, others);
    for (const line of availability) {
      if (!lineIsShort(line, SHORTFALL_TOLERANCE_PERCENT)) continue;
      const unit = line.unit;
      const sizes = describeShortSizes(line);
      const message = line.unlinked
        ? `${line.materialName} on the Order BOM is not linked to a material, so its stock cannot be checked — fix the BOM line`
        : `Insufficient stock for ${line.materialName} (${line.materialCode}). Required: ${line.need.toFixed(2)} ${unit}, Available: ${line.have.toFixed(2)} ${unit}, Short: ${line.short.toFixed(2)} ${unit}${sizes ? ` — ${sizes}` : ''}`;
      shortLines.push({
        materialType: line.materialType,
        materialName: line.materialName,
        materialCode: line.materialCode,
        required: line.need,
        available: line.have,
        shortfall: line.short,
        unit,
        blocksCutting: false,
        sizedLabel: line.sizedLabel,
        unlinked: line.unlinked,
        sizes: line.sizes?.filter((s) => qtyExceeds(s.short, 0)),
        message,
      });
    }

    return { hasApprovedBom: true, totalLines: items.length, shortLines };
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
      select: { styleCode: true, buyerStyleRef: true, styleName: true },
    });
    const styleLabel = style ? `${styleCodeLabel(style)} - ${style.styleName}` : styleId;
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

    // The run's style and whose sample rules it follows (order line → order → style's buyer)
    const run = await resolveRunCustomer(workOrderId);

    if (!run || !run.styleId) {
      // No style - cannot validate, allow transition
      return { isBlocked: false, blockers: [] };
    }
    const styleId = run.styleId;

    const { fitBlocks, ppBlocks, sizeSetBlocks, shipmentSampleBlocks, fptBlocksProduction, gptBlocksShipment } =
      resolveCustomerGates(run.customer);

    // Run all validations in parallel
    const [fitResult, ppResult, sizeSetResult, fptResult, gptResult, shipmentResult, materialResult, cadResult] =
      await Promise.all([
        this.validateFitSampleForStage(styleId, targetStage, fitBlocks),
        this.validatePPSampleForStage(styleId, targetStage, ppBlocks),
        this.validateSizeSetSampleForStage(styleId, targetStage, sizeSetBlocks),
        this.validateFPTForStage(styleId, targetStage, fptBlocksProduction),
        this.validateGPTForStage(workOrderId, targetStage, gptBlocksShipment),
        this.validateShipmentSampleForStage(styleId, targetStage, shipmentSampleBlocks, run.customerId),
        this.validateMaterialAvailabilityForStage(workOrderId, targetStage),
        this.validateProductionCADForStage(styleId, targetStage),
      ]);

    // Aggregate all blockers
    const allBlockers: BlockerInfo[] = [
      ...fitResult.blockers,
      ...ppResult.blockers,
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
      warnings: materialResult.warnings ?? [],
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
        orders: { select: { customerId: true, customers: { select: GATE_CUSTOMER_SELECT } } },
        styles: { select: { customerId: true, customer: { select: GATE_CUSTOMER_SELECT } } },
      },
    });

    // No style — nothing to validate against, same stance as validateStageTransition.
    if (!orderItem?.styleId) {
      return { isBlocked: false, blockers: [], gptEvaluated: false };
    }

    // Same order as resolveRunCustomer: the order's customer, else the style's buyer.
    const customer = orderItem.orders?.customers ?? orderItem.styles?.customer ?? null;
    const customerId = orderItem.orders?.customers
      ? orderItem.orders.customerId
      : (orderItem.styles?.customerId ?? null);
    const { fitBlocks, ppBlocks, sizeSetBlocks, shipmentSampleBlocks, fptBlocksProduction } =
      resolveCustomerGates(customer);
    const run: RunIdentity = { styleId: orderItem.styleId, orderId: orderItem.orderId };

    const [fitResult, ppResult, sizeSetResult, fptResult, shipmentResult, materialResult, cadResult] =
      await Promise.all([
        this.validateFitSampleForStage(orderItem.styleId, targetStage, fitBlocks),
        this.validatePPSampleForStage(orderItem.styleId, targetStage, ppBlocks),
        this.validateSizeSetSampleForStage(orderItem.styleId, targetStage, sizeSetBlocks),
        this.validateFPTForStage(orderItem.styleId, targetStage, fptBlocksProduction),
        this.validateShipmentSampleForStage(orderItem.styleId, targetStage, shipmentSampleBlocks, customerId),
        this.validateMaterialAvailabilityForRun(run, targetStage),
        this.validateProductionCADForStage(orderItem.styleId, targetStage),
      ]);

    const allBlockers: BlockerInfo[] = [
      ...fitResult.blockers,
      ...ppResult.blockers,
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
   * The run page's Material Readiness: every Order BOM line the order cannot fully cover.
   *
   * `isReady` answers "can this run go to cutting" — fabric only. Labels, trims and packaging still to come
   * are listed (`blocksCutting: false`) and only warn at cutting (owner, 2026-10-03); a sized label lists its
   * short sizes, and a size with no labels cannot be issued to stitching (`labelCoverForStitching`).
   * `allAvailable` = nothing at all is short.
   */
  async checkMaterialReadiness(workOrderId: string): Promise<{
    isReady: boolean;
    allAvailable: boolean;
    totalMaterials: number;
    availableMaterials: number;
    hasApprovedBom: boolean;
    missingMaterials: Array<Omit<MaterialShortLine, 'message'>>;
  }> {
    const workOrder = await prisma.work_orders.findUnique({
      where: { id: workOrderId },
      select: { orderId: true, styleId: true },
    });

    if (!workOrder) {
      return {
        isReady: false,
        allAvailable: false,
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
        allAvailable: true,
        totalMaterials: 0,
        availableMaterials: 0,
        hasApprovedBom: false,
        missingMaterials: [],
      };
    }

    const position = await this.orderBomMaterialPosition({ styleId: workOrder.styleId, orderId: workOrder.orderId });
    if (!position.hasApprovedBom) {
      return {
        isReady: false,
        allAvailable: false,
        totalMaterials: 0,
        availableMaterials: 0,
        hasApprovedBom: false,
        missingMaterials: [],
      };
    }

    const missingMaterials = position.shortLines.map(({ message: _message, ...line }) => line);
    return {
      isReady: !missingMaterials.some((m) => m.blocksCutting),
      allAvailable: missingMaterials.length === 0,
      totalMaterials: position.totalLines,
      availableMaterials: position.totalLines - missingMaterials.length,
      hasApprovedBom: true,
      missingMaterials,
    };
  }

  /**
   * SAMPLE CREATION ORDER: a FIT → PP → Size Set sample may be raised once every EARLIER type in that
   * chain that the sample's customer marks Required is approved (for this style). A type the customer
   * does not require is skipped — Kashaya Fabs requires only a Size Set, and the old fixed chain made it
   * raise and approve a FIT and a PP first (2026-10-02). No customer = nothing required.
   */
  async validateSampleCreation(
    styleId: string,
    sampleType: SampleType,
    customerId: string | null | undefined
  ): Promise<CreationValidationResult> {
    const position = SAMPLE_CHAIN.indexOf(sampleType);
    if (position <= 0 || !customerId) return { canCreate: true, blocker: null };

    const required = await prisma.customer_sample_requirements.findMany({
      where: { customerId, isRequired: true, sampleType: { in: SAMPLE_CHAIN.slice(0, position) } },
      select: { sampleType: true },
    });
    // Nearest earlier type first, so the message names the step just before this one.
    const earlier = SAMPLE_CHAIN.slice(0, position)
      .reverse()
      .filter((t) => required.some((r) => r.sampleType === t));

    for (const prerequisite of earlier) {
      const approved = await prisma.samples.count({
        where: { styleId, sampleType: prerequisite, status: { in: APPROVED_SAMPLE_STATUSES } },
      });
      if (approved === 0) {
        return {
          canCreate: false,
          blocker: {
            message: `${SAMPLE_LABEL[prerequisite]} must be approved before creating ${SAMPLE_LABEL[sampleType]} — this customer requires it`,
            prerequisiteType: prerequisite,
          },
        };
      }
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
