/**
 * MRP (Material Requirement Planning) Service
 * Handles material requirement calculations, stock allocation, and PO generation
 */

import {
  Prisma,
  MaterialRequirementStatus,
  RequirementSource,
  Unit,
  POSource,
  POCategory,
  PurchaseOrderStatus,
} from '@prisma/client';
import { generateAtomicDocNumber, generateAtomicPONumberInTx } from '../utils/atomicCodeGenerator';
import { generateJobWorkNumber } from '../utils/jobWorkNumber';
import { jobWorkOrderService, JobWorkOrderError, JWO_ERROR_CODES } from './job-work-order.service';
import {
  roundToCent,
  toCurrency,
  multiplyCurrency,
  addCurrency,
  subtractCurrency,
  toNumber,
  applyShrinkageLoss,
  divideByShrinkage,
} from '../utils/currency';
import { validateTransition } from '../utils/stateMachine';
import { calculateGreigeQuantity } from '../utils/greige-quantity';
import { systemSettingsService } from './system-settings.service';
import prisma from '../config/database';
import { getDerivedOnHand } from './helpers/derived-stock.helper';
import { splitReceiptAcrossLinks, RECEIPT_COMPLETE_TOLERANCE } from './helpers/receipt-split.helper';
import {
  CalculateRequirementsInput,
  CalculatedRequirement,
  RequirementFilters,
  MaterialRequirementResponse,
  OrderRequirementsSummary,
  MRPDashboardStats,
  GeneratePOFromRequirementsRequest,
  CreateManualRequirementRequest,
  AllocateStockRequest,
  LinkRequirementToPORequest,
  POPreviewRequest,
  POPreviewGroup,
  POPreviewItem,
} from '../types/mrp.types';
import { materialService } from './material.service';
import { COMPANY_CONFIG } from '../config/company.config';
import { gstService } from './gst.service';
import { resolveRate } from './po-rate-resolver.service';
import { findRateCardsForShrinkage } from './processor-rate-v2.service';
import { resolveShrinkagePercent } from './helpers/shrinkage-resolver.helper';
import logger, { logWarn } from '../utils/logger';
import { MASTER_CONFIG } from './helpers/master-config';
import { ensureMaterialRecord } from './helpers/material-sync.helper';
import { getOrCreateFinishedFabricV2, resolveFinishedFabricIdentity } from './helpers/fabric-identity.helper';

/**
 * All master FK fields derived from MASTER_CONFIG (single source of truth).
 * Excludes FABRIC, LACE, GREIGE which have separate dedicated checks in MRP.
 * When a new material type is added to MASTER_CONFIG, it automatically works here.
 */
const DEDICATED_CHECK_FIELDS = ['fabricId', 'laceId', 'greigeId'];
const TRIM_FK_FIELDS = Object.values(MASTER_CONFIG)
  .map((config) => config.fkField)
  .filter((field) => !DEDICATED_CHECK_FIELDS.includes(field));

/** Reverse map: FK field on order_bom_items → master type key in MASTER_CONFIG */
const FK_TO_MASTER_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(MASTER_CONFIG).map(([type, config]) => [config.fkField, type])
);

/**
 * Ensure a materials record exists for a fabric_master entry.
 * Auto-creates one using materialService.createFromMaster if missing.
 * Handles legacy/imported fabrics that were created before the auto-creation logic.
 */
async function ensureMaterialForFabric(fabricId: string): Promise<{ id: string } | null> {
  try {
    const existing = await prisma.materials.findFirst({ where: { fabricId } });
    if (existing) return existing;

    const fabric = await prisma.fabric_master.findUnique({
      where: { id: fabricId },
      select: { id: true, fabricCode: true, fabricName: true, supplierId: true },
    });
    if (!fabric) {
      console.warn(`[MRP] fabric_master not found for fabricId: ${fabricId}`);
      return null;
    }

    const material = await materialService.createFromMaster(
      { id: fabric.id, code: fabric.fabricCode, name: fabric.fabricName },
      'FABRIC'
    );
    console.log(`[MRP] Auto-created materials record for fabric: ${fabric.fabricCode} (${fabric.id})`);

    // Copy default supplier so vendor suggestion works
    if (fabric.supplierId) {
      try {
        await prisma.material_suppliers.create({
          data: {
            materialId: material.id,
            supplierId: fabric.supplierId,
            isPreferred: true,
            isActive: true,
            notes: 'Auto-linked from fabric_master default supplier',
          },
        });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
          throw err;
        }
        // P2002: supplier link already exists — idempotent, safe to ignore
        logWarn(`[MRP] Supplier link already exists (P2002), skipping: ${(err as Error).message}`);
      }
    }

    return material;
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const justCreated = await prisma.materials.findFirst({ where: { fabricId } });
      if (justCreated) return justCreated;
    }
    logger.error(`[MRP] Failed to auto-create materials record for fabricId ${fabricId}:`, err);
    return null;
  }
}

/**
 * Ensure a materials record exists for a lace_master entry.
 * Auto-creates one using materialService.createFromMaster if missing.
 */
async function ensureMaterialForLace(laceId: string): Promise<{ id: string } | null> {
  try {
    const existing = await prisma.materials.findFirst({ where: { laceId } });
    if (existing) return existing;

    const lace = await prisma.lace_master.findUnique({
      where: { id: laceId },
      select: { id: true, laceCode: true, laceName: true, supplierId: true },
    });
    if (!lace) {
      console.warn(`[MRP] lace_master not found for laceId: ${laceId}`);
      return null;
    }

    const material = await materialService.createFromMaster(
      { id: lace.id, code: lace.laceCode, name: lace.laceName },
      'LACE'
    );
    console.log(`[MRP] Auto-created materials record for lace: ${lace.laceCode} (${lace.id})`);

    if (lace.supplierId) {
      try {
        await prisma.material_suppliers.create({
          data: {
            materialId: material.id,
            supplierId: lace.supplierId,
            isPreferred: true,
            isActive: true,
            notes: 'Auto-linked from lace_master default supplier',
          },
        });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
          throw err;
        }
        // P2002: supplier link already exists — idempotent, safe to ignore
        logWarn(`[MRP] Supplier link already exists (P2002), skipping: ${(err as Error).message}`);
      }
    }

    return material;
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const justCreated = await prisma.materials.findFirst({ where: { laceId } });
      if (justCreated) return justCreated;
    }
    logger.error(`[MRP] Failed to auto-create materials record for laceId ${laceId}:`, err);
    return null;
  }
}

/**
 * Ensure a materials record exists for a greige_master entry.
 * Auto-creates one using materialService.createFromMaster if missing.
 */
async function ensureMaterialForGreige(greigeId: string): Promise<{ id: string } | null> {
  try {
    const existing = await prisma.materials.findFirst({ where: { greigeId } });
    if (existing) return existing;

    const greige = await prisma.greige_master.findUnique({
      where: { id: greigeId },
      select: { id: true, greigeCode: true, greigeName: true, supplierId: true },
    });
    if (!greige) {
      console.warn(`[MRP] greige_master not found for greigeId: ${greigeId}`);
      return null;
    }

    const material = await materialService.createFromMaster(
      { id: greige.id, code: greige.greigeCode, name: greige.greigeName },
      'GREIGE'
    );
    console.log(`[MRP] Auto-created materials record for greige: ${greige.greigeCode} (${greige.id})`);

    if (greige.supplierId) {
      try {
        await prisma.material_suppliers.create({
          data: {
            materialId: material.id,
            supplierId: greige.supplierId,
            isPreferred: true,
            isActive: true,
            notes: 'Auto-linked from greige_master default supplier',
          },
        });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
          throw err;
        }
        // P2002: supplier link already exists — idempotent, safe to ignore
        logWarn(`[MRP] Supplier link already exists (P2002), skipping: ${(err as Error).message}`);
      }
    }

    return material;
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const justCreated = await prisma.materials.findFirst({ where: { greigeId } });
      if (justCreated) return justCreated;
    }
    logger.error(`[MRP] Failed to auto-create materials record for greigeId ${greigeId}:`, err);
    return null;
  }
}

/**
 * Ensure a materials record exists for a thread_master entry.
 * Auto-creates one using materialService.createFromMaster if missing.
 */
async function ensureMaterialForThread(threadId: string): Promise<{ id: string } | null> {
  try {
    const existing = await prisma.materials.findFirst({ where: { threadId } });
    if (existing) return existing;

    const thread = await prisma.thread_master.findUnique({
      where: { id: threadId },
      select: { id: true, threadCode: true, threadName: true, supplierId: true },
    });
    if (!thread) {
      console.warn(`[MRP] thread_master not found for threadId: ${threadId}`);
      return null;
    }

    const material = await materialService.createFromMaster(
      { id: thread.id, code: thread.threadCode, name: thread.threadName },
      'THREAD'
    );
    console.log(`[MRP] Auto-created materials record for thread: ${thread.threadCode} (${thread.id})`);

    if (thread.supplierId) {
      try {
        await prisma.material_suppliers.create({
          data: {
            materialId: material.id,
            supplierId: thread.supplierId,
            isPreferred: true,
            isActive: true,
            notes: 'Auto-linked from thread_master default supplier',
          },
        });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
          throw err;
        }
        // P2002: supplier link already exists — idempotent, safe to ignore
        logWarn(`[MRP] Supplier link already exists (P2002), skipping: ${(err as Error).message}`);
      }
    }

    return material;
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const justCreated = await prisma.materials.findFirst({ where: { threadId } });
      if (justCreated) return justCreated;
    }
    logger.error(`[MRP] Failed to auto-create materials record for threadId ${threadId}:`, err);
    return null;
  }
}

/**
 * Ensure a materials record exists for a button_master entry.
 * Auto-creates one using materialService.createFromMaster if missing.
 */
async function ensureMaterialForButton(buttonId: string): Promise<{ id: string } | null> {
  try {
    const existing = await prisma.materials.findFirst({ where: { buttonId } });
    if (existing) return existing;

    const button = await prisma.button_master.findUnique({
      where: { id: buttonId },
      select: { id: true, buttonCode: true, buttonName: true, supplierId: true },
    });
    if (!button) {
      console.warn(`[MRP] button_master not found for buttonId: ${buttonId}`);
      return null;
    }

    const material = await materialService.createFromMaster(
      { id: button.id, code: button.buttonCode, name: button.buttonName },
      'BUTTON'
    );
    console.log(`[MRP] Auto-created materials record for button: ${button.buttonCode} (${button.id})`);

    if (button.supplierId) {
      try {
        await prisma.material_suppliers.create({
          data: {
            materialId: material.id,
            supplierId: button.supplierId,
            isPreferred: true,
            isActive: true,
            notes: 'Auto-linked from button_master default supplier',
          },
        });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
          throw err;
        }
        // P2002: supplier link already exists — idempotent, safe to ignore
        logWarn(`[MRP] Supplier link already exists (P2002), skipping: ${(err as Error).message}`);
      }
    }

    return material;
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const justCreated = await prisma.materials.findFirst({ where: { buttonId } });
      if (justCreated) return justCreated;
    }
    logger.error(`[MRP] Failed to auto-create materials record for buttonId ${buttonId}:`, err);
    return null;
  }
}

/**
 * Ensure a materials record exists for a zipper_master entry.
 * Auto-creates one using materialService.createFromMaster if missing.
 */
async function ensureMaterialForZipper(zipperId: string): Promise<{ id: string } | null> {
  try {
    const existing = await prisma.materials.findFirst({ where: { zipperId } });
    if (existing) return existing;

    const zipper = await prisma.zipper_master.findUnique({
      where: { id: zipperId },
      select: { id: true, zipperCode: true, zipperName: true, supplierId: true },
    });
    if (!zipper) {
      console.warn(`[MRP] zipper_master not found for zipperId: ${zipperId}`);
      return null;
    }

    const material = await materialService.createFromMaster(
      { id: zipper.id, code: zipper.zipperCode, name: zipper.zipperName },
      'ZIPPER'
    );
    console.log(`[MRP] Auto-created materials record for zipper: ${zipper.zipperCode} (${zipper.id})`);

    if (zipper.supplierId) {
      try {
        await prisma.material_suppliers.create({
          data: {
            materialId: material.id,
            supplierId: zipper.supplierId,
            isPreferred: true,
            isActive: true,
            notes: 'Auto-linked from zipper_master default supplier',
          },
        });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
          throw err;
        }
        // P2002: supplier link already exists — idempotent, safe to ignore
        logWarn(`[MRP] Supplier link already exists (P2002), skipping: ${(err as Error).message}`);
      }
    }

    return material;
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const justCreated = await prisma.materials.findFirst({ where: { zipperId } });
      if (justCreated) return justCreated;
    }
    logger.error(`[MRP] Failed to auto-create materials record for zipperId ${zipperId}:`, err);
    return null;
  }
}

/**
 * Ensure a materials record exists for an elastic_master entry.
 * Auto-creates one using materialService.createFromMaster if missing.
 */
async function ensureMaterialForElastic(elasticId: string): Promise<{ id: string } | null> {
  try {
    const existing = await prisma.materials.findFirst({ where: { elasticId } });
    if (existing) return existing;

    const elastic = await prisma.elastic_master.findUnique({
      where: { id: elasticId },
      select: { id: true, elasticCode: true, elasticName: true, supplierId: true },
    });
    if (!elastic) {
      console.warn(`[MRP] elastic_master not found for elasticId: ${elasticId}`);
      return null;
    }

    const material = await materialService.createFromMaster(
      { id: elastic.id, code: elastic.elasticCode, name: elastic.elasticName },
      'ELASTIC'
    );
    console.log(`[MRP] Auto-created materials record for elastic: ${elastic.elasticCode} (${elastic.id})`);

    if (elastic.supplierId) {
      try {
        await prisma.material_suppliers.create({
          data: {
            materialId: material.id,
            supplierId: elastic.supplierId,
            isPreferred: true,
            isActive: true,
            notes: 'Auto-linked from elastic_master default supplier',
          },
        });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
          throw err;
        }
        // P2002: supplier link already exists — idempotent, safe to ignore
        logWarn(`[MRP] Supplier link already exists (P2002), skipping: ${(err as Error).message}`);
      }
    }

    return material;
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const justCreated = await prisma.materials.findFirst({ where: { elasticId } });
      if (justCreated) return justCreated;
    }
    logger.error(`[MRP] Failed to auto-create materials record for elasticId ${elasticId}:`, err);
    return null;
  }
}

/**
 * Ensure a materials record exists for a label_master entry.
 * Auto-creates one using materialService.createFromMaster if missing.
 */
async function ensureMaterialForLabel(labelId: string): Promise<{ id: string } | null> {
  try {
    const existing = await prisma.materials.findFirst({ where: { labelId } });
    if (existing) return existing;

    const label = await prisma.label_master.findUnique({
      where: { id: labelId },
      select: { id: true, labelCode: true, labelName: true, supplierId: true },
    });
    if (!label) {
      console.warn(`[MRP] label_master not found for labelId: ${labelId}`);
      return null;
    }

    const material = await materialService.createFromMaster(
      { id: label.id, code: label.labelCode, name: label.labelName },
      'LABEL'
    );
    console.log(`[MRP] Auto-created materials record for label: ${label.labelCode} (${label.id})`);

    if (label.supplierId) {
      try {
        await prisma.material_suppliers.create({
          data: {
            materialId: material.id,
            supplierId: label.supplierId,
            isPreferred: true,
            isActive: true,
            notes: 'Auto-linked from label_master default supplier',
          },
        });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
          throw err;
        }
        // P2002: supplier link already exists — idempotent, safe to ignore
        logWarn(`[MRP] Supplier link already exists (P2002), skipping: ${(err as Error).message}`);
      }
    }

    return material;
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const justCreated = await prisma.materials.findFirst({ where: { labelId } });
      if (justCreated) return justCreated;
    }
    logger.error(`[MRP] Failed to auto-create materials record for labelId ${labelId}:`, err);
    return null;
  }
}

/**
 * Ensure a materials record exists for a label_size_variants entry.
 * Uses sizeVariantId as the material ID (same-id convention).
 * These are per-size label materials for size-based labels.
 */
async function ensureMaterialForLabelSizeVariant(sizeVariantId: string): Promise<{ id: string } | null> {
  try {
    // Check for existing material by sizeVariantId (unique field)
    const existing = await prisma.materials.findFirst({ where: { sizeVariantId } });
    if (existing) return existing;

    // Get size variant details with parent label
    const variant = await prisma.label_size_variants.findUnique({
      where: { id: sizeVariantId },
      include: {
        label: {
          select: { id: true, labelCode: true, labelName: true, supplierId: true },
        },
      },
    });
    if (!variant || !variant.label) {
      console.warn(`[MRP] label_size_variants not found for sizeVariantId: ${sizeVariantId}`);
      return null;
    }

    // Get or create category for LABEL type
    const categoryId = await materialService.getOrCreateCategory('LABEL');

    // Create material with sizeVariantId as the ID (same-id convention for size variants)
    const material = await prisma.materials.create({
      data: {
        id: sizeVariantId, // Same ID as size variant
        code: `${variant.label.labelCode}-${variant.size}`,
        name: `${variant.label.labelName} (${variant.size})`,
        categoryId,
        materialType: 'LABEL',
        unit: 'PIECE',
        labelId: variant.label.id, // Link to parent label
        sizeVariantId: variant.id, // Link to this size variant
        isActive: true,
      },
    });
    console.log(
      `[MRP] Auto-created materials record for label size variant: ${variant.label.labelCode}-${variant.size}`
    );

    // Link to supplier if parent label has one
    if (variant.label.supplierId) {
      try {
        await prisma.material_suppliers.create({
          data: {
            materialId: material.id,
            supplierId: variant.label.supplierId,
            isPreferred: true,
            isActive: true,
            notes: 'Auto-linked from label_master default supplier (size variant)',
          },
        });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
          throw err;
        }
        // P2002: supplier link already exists — idempotent
      }
    }

    return material;
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const justCreated = await prisma.materials.findFirst({ where: { sizeVariantId } });
      if (justCreated) return justCreated;
    }
    logger.error(`[MRP] Failed to auto-create materials record for sizeVariantId ${sizeVariantId}:`, err);
    return null;
  }
}

/**
 * Ensure a materials record exists for a packaging_master entry.
 * Auto-creates one using materialService.createFromMaster if missing.
 */
async function ensureMaterialForPackaging(packagingId: string): Promise<{ id: string } | null> {
  try {
    const existing = await prisma.materials.findFirst({ where: { packagingId } });
    if (existing) return existing;

    const packaging = await prisma.packaging_master.findUnique({
      where: { id: packagingId },
      select: { id: true, packagingCode: true, packagingName: true, supplierId: true },
    });
    if (!packaging) {
      console.warn(`[MRP] packaging_master not found for packagingId: ${packagingId}`);
      return null;
    }

    const material = await materialService.createFromMaster(
      { id: packaging.id, code: packaging.packagingCode, name: packaging.packagingName },
      'PACKAGING'
    );
    console.log(`[MRP] Auto-created materials record for packaging: ${packaging.packagingCode} (${packaging.id})`);

    if (packaging.supplierId) {
      try {
        await prisma.material_suppliers.create({
          data: {
            materialId: material.id,
            supplierId: packaging.supplierId,
            isPreferred: true,
            isActive: true,
            notes: 'Auto-linked from packaging_master default supplier',
          },
        });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
          throw err;
        }
        // P2002: supplier link already exists — idempotent, safe to ignore
        logWarn(`[MRP] Supplier link already exists (P2002), skipping: ${(err as Error).message}`);
      }
    }

    return material;
  } catch (err: any) {
    if (err?.code === 'P2002') {
      const justCreated = await prisma.materials.findFirst({ where: { packagingId } });
      if (justCreated) return justCreated;
    }
    logger.error(`[MRP] Failed to auto-create materials record for packagingId ${packagingId}:`, err);
    return null;
  }
}

/**
 * Normalize unit strings to valid Prisma Unit enum values
 * Maps common abbreviations and variations to standard enum values
 */
function normalizeUnit(unit: string | null | undefined): Unit {
  if (!unit) {
    logWarn(
      '[MRP] normalizeUnit called with null/undefined unit — defaulting to PIECE. This may cause incorrect quantity calculations if the actual unit is METER, YARD, or KILOGRAM. Fix: ensure all BOM items have a unit value set.'
    );
    return Unit.PIECE;
  }

  const normalized = unit.toUpperCase().trim();

  // Direct matches - check if already a valid Unit enum value
  if (Object.values(Unit).includes(normalized as Unit)) {
    return normalized as Unit;
  }

  // Common mappings for abbreviations and variations
  const unitMap: Record<string, Unit> = {
    PCS: Unit.PIECE,
    PC: Unit.PIECE,
    PIECES: Unit.PIECE,
    METERS: Unit.METER,
    MTR: Unit.METER,
    M: Unit.METER,
    YARDS: Unit.YARD,
    YD: Unit.YARD,
    KG: Unit.KILOGRAM,
    KGS: Unit.KILOGRAM,
    KILOGRAMS: Unit.KILOGRAM,
    DOZ: Unit.DOZEN,
    DOZENS: Unit.DOZEN,
    SETS: Unit.SET,
    TUBES: Unit.TUBE,
    CONES: Unit.CONE,
    SPOOLS: Unit.SPOOL,
    BOXES: Unit.BOX,
  };

  if (unitMap[normalized]) {
    return unitMap[normalized];
  }

  logWarn(
    `[MRP] normalizeUnit: unrecognized unit '${unit}' — defaulting to PIECE. Add a mapping for this unit in normalizeUnit() or fix the BOM data.`
  );
  return Unit.PIECE;
}

/**
 * P1.4 D5 fix: Build a canonical grouping key for consolidating requirements into PO line items.
 * PROCESSING requirements are never merged (each is a distinct processing job).
 * MATERIAL requirements are grouped by materialId + fabricWidth (so different widths don't merge).
 *
 * This helper is used by:
 * - previewPOsFromRequirements (preview must match generation exactly)
 * - generatePOFromRequirements (both consolidate and non-consolidate branches)
 *
 * The frontend keys edited prices/quantities by this value so edits land on the correct group.
 */
function buildGroupKey(req: {
  id: string;
  materialId: string;
  requirementType?: string | null;
  fabricWidth?: any;
}): string {
  // PROCESSING: each requirement is its own group
  if (req.requirementType === 'PROCESSING') {
    return req.id;
  }
  // MATERIAL: group by materialId + width (so 44" and 58" don't merge)
  const widthKey = req.fabricWidth ? `-W${Number(req.fabricWidth)}` : '';
  return `${req.materialId}${widthKey}`;
}

/**
 * Determine POCategory from material types in a PO
 * Uses the majority material type to set category
 */
function determinePOCategoryFromMaterials(materials: Array<{ materialType: string | null }>): POCategory {
  const typeMapping: Record<string, POCategory> = {
    // Fabric types
    FABRIC: POCategory.FABRIC,
    GREIGE: POCategory.GREIGE,
    // Lace types
    LACE: POCategory.LACE,
    GREIGE_LACE: POCategory.GREIGE_LACE,
    // Trim types (all map to TRIMS)
    BUTTON: POCategory.TRIMS,
    THREAD: POCategory.THREAD,
    ELASTIC: POCategory.TRIMS,
    LABEL: POCategory.TRIMS,
    ZIPPER: POCategory.TRIMS,
    PACKAGING: POCategory.TRIMS,
    INTERLINING: POCategory.TRIMS,
    TAPE: POCategory.TRIMS,
    CORD: POCategory.TRIMS,
    HOOK_EYE: POCategory.TRIMS,
    SNAP_BUTTON: POCategory.TRIMS,
    BUCKLE: POCategory.TRIMS,
    BELT: POCategory.TRIMS,
    VELCRO: POCategory.TRIMS,
    DRAWSTRING: POCategory.TRIMS,
    RIBBON: POCategory.TRIMS,
    SEQUIN: POCategory.TRIMS,
    BEAD: POCategory.TRIMS,
    MOTIF: POCategory.TRIMS,
    PADDING: POCategory.TRIMS,
    OTHER_FASTENER: POCategory.TRIMS,
    OTHER_TAPE: POCategory.TRIMS,
    OTHER_DECORATIVE: POCategory.TRIMS,
    OTHER_FUNCTIONAL: POCategory.TRIMS,
    OTHER_MATERIAL: POCategory.TRIMS,
    TRIMS: POCategory.TRIMS,
    ACCESSORIES: POCategory.TRIMS,
    GENERIC: POCategory.TRIMS,
    OTHER: POCategory.TRIMS,
  };

  // Count material types
  const typeCounts = new Map<POCategory, number>();
  for (const mat of materials) {
    const category = typeMapping[mat.materialType || ''] || POCategory.GENERAL;
    typeCounts.set(category, (typeCounts.get(category) || 0) + 1);
  }

  // Return the most common category
  let maxCount = 0;
  let dominantCategory: POCategory = POCategory.GENERAL;
  for (const [category, count] of typeCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantCategory = category;
    }
  }

  return dominantCategory;
}

/**
 * Generate a unique requirement number (MR2607-0001) — atomic monthly series.
 */
async function generateRequirementNumber(tx?: Prisma.TransactionClient): Promise<string> {
  return generateAtomicDocNumber('MR', tx);
}

/**
 * MRP-03: free-to-plan stock from a Prisma `_sum` over a lot table.
 *
 * Every netting path used to sum `quantityAvailable` alone, but allocateStock reserves against a
 * lot by incrementing `quantityReserved` WITHOUT decrementing `quantityAvailable`. Stock already
 * promised to order A therefore counted as free for order B, and MRP systematically under-ordered.
 * Reserved quantity is committed elsewhere, so subtract it.
 */
function netFreeStock(sum: { quantityAvailable?: unknown; quantityReserved?: unknown } | null | undefined): number {
  const available = Number(sum?.quantityAvailable ?? 0);
  const reserved = Number(sum?.quantityReserved ?? 0);
  return Math.max(0, available - reserved);
}

/**
 * Calculate material requirements from an order's BOM
 * Formula: totalRequired = orderQuantity × quantityPerUnit × (1 + wastagePercent/100)
 */
export async function calculateRequirementsFromOrder(
  input: CalculateRequirementsInput,
  userId: string
): Promise<{
  created: number;
  updated: number;
  requirements: MaterialRequirementResponse[];
  skipped: { componentName: string; materialType: string; reason: string }[];
}> {
  const { orderId, orderItemId, requiredDate: requiredDateInput, checkStock = true } = input;

  // Track skipped BOM items with reasons for transparency
  const skippedItems: { componentName: string; materialType: string; reason: string }[] = [];

  // Get order with items and their styles
  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    include: {
      order_items: {
        where: orderItemId ? { id: orderItemId } : undefined,
        include: {
          styles: true,
        },
      },
      // P3: MRP gate - only fetch APPROVED BOMs, ordered by version desc for deterministic pick
      // MRP-07: LOCKED is APPROVED-and-frozen-for-production, not a rejection. Excluding it made
      // every recalc on a locked order throw "no approved BOM" (see order-bom.controller, which
      // has always accepted APPROVED || LOCKED for the same operation).
      orderBoms: {
        where: {
          isActive: true,
          status: { in: ['APPROVED', 'LOCKED'] },
        },
        orderBy: { version: 'desc' }, // P3: Deterministic pick - highest version first
        include: {
          items: {
            include: {
              material: {
                include: {
                  suppliers: {
                    where: { isPreferred: true },
                    include: { supplier: true },
                  },
                },
              },
              fabric_master: true,
              greige: true, // P3: for shrinkage percent in greige qty formula
              lace_master: true,
              button_master: true,
              thread_master: true,
              zipper_master: true,
              elastic_master: true,
              label_master: true,
              packaging_master: true,
              // MRP-48: shrinkage is a property of THIS processor doing THIS process on THIS
              // greige — which is exactly what the rate card is keyed on. Pull it here so the
              // quantity we buy is derived from the same row that prices the job and that the
              // JWO holds the processor to.
              rateCard: {
                select: {
                  printingType: true,
                  processingType: true,
                  shrinkagePercent: true,
                  processorId: true,
                },
              },
              // Include CAD for batch grouping in PROCESSING requirements
              selectedCad: {
                select: {
                  id: true,
                  processingBatchGroupColorId: true,
                  batchGroupColor: { select: { id: true, colorName: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  // MRP-08: the order's own delivery date is the truthful due date for everything it needs.
  // Callers (the Re-calculate button in particular) used to synthesise "today + 30 days" and
  // stamp it onto every requirement the recalc created, silently overwriting real dates.
  const requiredDate = requiredDateInput ?? order.expectedDeliveryDate;

  // MRP-09: a cancelled order must not acquire new live requirements (which are then
  // purchasable). order-bom approve/lock already guard on this; MRP never did.
  if (order.status === 'CANCELLED') {
    throw new Error(
      `Cannot calculate MRP: order ${order.orderNumber} is CANCELLED. ` +
        `Reactivate the order before planning materials for it.`
    );
  }

  // P3: MRP gate - require at least one approved BOM
  if (order.orderBoms.length === 0) {
    // Check if there are any BOMs at all (just not approved)
    const draftBomCount = await prisma.order_bom.count({
      where: { orderId, isActive: true, status: 'DRAFT' },
    });
    if (draftBomCount > 0) {
      throw new Error(
        `Cannot calculate MRP: Order has ${draftBomCount} draft BOM(s) but none are approved. ` +
          `Please approve the BOM before calculating requirements.`
      );
    }
    throw new Error(
      `Cannot calculate MRP: No active Order BOM found for this order. ` +
        `Please create and approve an Order BOM first.`
    );
  }

  // Cancel existing non-final requirements for the affected BOMs only (not entire order)
  // This prevents wiping requirements from other styles when recalculating for one style
  // CRITICAL: Do NOT cancel requirements that have POs generated/sent/partially received
  // - canceling PO_GENERATED/PO_SENT/PARTIALLY_RECEIVED requirements causes duplicate orders
  //
  // MRP-01: this pass used to execute HERE, outside the rebuild transaction at the bottom of
  // this function. A rebuild that timed out (30s, hundreds of serialized queries) or threw left
  // the order with every requirement CANCELLED and nothing recreated — silent data loss. It is
  // now a closure invoked as the first statement INSIDE that transaction, so a failed rebuild
  // rolls the cancel back with it. The revive-CANCELLED lookups further down see these rows
  // because they run in the same transaction.
  const activeBomIds = order.orderBoms.map((b) => b.id);
  const cancelSupersededRequirements = async (tx: Prisma.TransactionClient): Promise<void> => {
    if (activeBomIds.length === 0) return;

    // First, find ALL requirements for this order that have active PO links (PO not cancelled)
    // BUG-ORD3 FIX: Query by orderId alone (not orderBomId) because:
    // 1. Manual requirements have null orderBomId
    // 2. The `in` filter doesn't match null values
    // 3. This caused requirements with PO links to be cancelled -> duplicate POs
    const linkedReqs = await tx.requirement_po_links.findMany({
      where: {
        material_requirements: {
          orderId,
        },
        purchase_orders: {
          status: { notIn: ['CANCELLED'] },
        },
      },
      select: { requirementId: true },
    });
    const poLinkedIds = linkedReqs.map((l) => l.requirementId);

    // MRP-02: protect convert-to-greige chains. The CONVERTED parent carries shortfall 0 and is
    // deliberately not re-plannable; its greige child (linkedRequirementId -> parent) and the
    // processing grandchild (linkedRequirementId -> greige child) inherit the parent's
    // orderBomId, so the OR branch below matched them and a recalc silently cancelled the whole
    // conversion, then recreated the original ready-fabric requirement it had replaced.
    const convertedParents = await tx.material_requirements.findMany({
      where: { orderId, status: 'CONVERTED' },
      select: { id: true },
    });
    const conversionChainIds: string[] = convertedParents.map((r) => r.id);
    let frontier = conversionChainIds;
    // Two generations today (greige, then processing); the loop keeps it correct if the
    // conversion chain ever grows a third.
    while (frontier.length > 0) {
      const children = await tx.material_requirements.findMany({
        where: { orderId, linkedRequirementId: { in: frontier } },
        select: { id: true },
      });
      frontier = children.map((r) => r.id).filter((id) => !conversionChainIds.includes(id));
      conversionChainIds.push(...frontier);
    }

    // MRP-12: a split remainder is a deliberate, still-outstanding balance whose parent is
    // already on a PO/JWO. The parent is protected by its PO-progression status, but the child
    // sits at PO_REQUIRED with the same orderBomId — so the blanket cancel below would have
    // wiped exactly the balance the split was created to preserve.
    const splitRemainderRows = await tx.material_requirements.findMany({
      where: { orderId, splitFromId: { not: null } },
      select: { id: true },
    });
    const splitRemainderIds = splitRemainderRows.map((r) => r.id);

    // Cancel only requirements:
    // 1. Belonging to this order AND one of the active BOMs (or null orderBomId for manual reqs)
    // 2. NOT in terminal/PO-progression statuses
    // 3. NOT linked to active POs, NOT part of a convert-to-greige chain, NOT a split remainder
    await tx.material_requirements.updateMany({
      where: {
        orderId,
        // MRP-01: when the caller scopes the rebuild to a single order item, the cancel must be
        // scoped identically — otherwise it wipes sibling items the rebuild will never recreate.
        ...(orderItemId ? { orderItemId } : {}),
        // Include BOM-linked, manual (null orderBomId), AND stale (inactive/superseded BOM)
        // requirements for this order. Without the isActive:false branch, requirements from
        // deactivated BOMs linger as PO_REQUIRED and recalc creates duplicates next to them.
        OR: [{ orderBomId: { in: activeBomIds } }, { orderBomId: null }, { orderBom: { isActive: false } }],
        // Exclude terminal statuses AND PO-progression statuses
        status: { notIn: ['RECEIVED', 'CANCELLED', 'CONVERTED', 'PO_GENERATED', 'PO_SENT', 'PARTIALLY_RECEIVED'] },
        // Also exclude any with active PO links (belt-and-suspenders), a live conversion chain,
        // or an outstanding split balance
        id: { notIn: [...poLinkedIds, ...conversionChainIds, ...splitRemainderIds] },
      },
      data: { status: 'CANCELLED' },
    });
  };

  const calculatedRequirements: CalculatedRequirement[] = [];

  // Process each order item
  for (const orderItem of order.order_items) {
    const style = orderItem.styles;
    // MRP-16: order_bom carries an optional orderItemId, and every BOM in this database currently
    // uses it. Matching on styleId alone meant two order lines of the SAME style both bound to the
    // first (highest-version) BOM, so the second line's own BOM was never exploded and its
    // requirements silently came out of the wrong bill. Prefer the BOM scoped to this exact order
    // item; fall back to an unscoped BOM for the style (the legacy shape).
    const bom =
      order.orderBoms.find((b: any) => b.styleId === style.id && b.orderItemId === orderItem.id) ??
      order.orderBoms.find((b: any) => b.styleId === style.id && !b.orderItemId);

    if (!bom) {
      logWarn(
        `[MRP] No active BOM found for style ${style.styleCode} on order item ${orderItem.id} — skipping. ` +
          `(An item-scoped BOM for a different order item does not apply here.)`
      );
      continue;
    }

    // Process each BOM item
    for (const bomItem of bom.items) {
      const material = bomItem.material;

      // Allow items with specific master IDs even without materialId
      let hasFabric = !!(bomItem.materialType === 'FABRIC' && bomItem.fabricId);
      let hasLace = !!(bomItem.materialType === 'LACE' && bomItem.laceId);
      // GREIGE_PROCESSED: buy raw greige + send to processor → two requirements (greige PO + processing PO)
      const hasGreigeProcessing = bomItem.sourcingStrategy === 'GREIGE_PROCESSED' && bomItem.greigeId;
      // LANDED GREIGE: buying greige fabric at a landed price (no processing) — single procurement requirement
      const hasLandedGreige = !hasGreigeProcessing && !!bomItem.greigeId && !bomItem.fabricId;
      // Other master types - check all trim FK fields defined in TRIM_FK_FIELDS constant
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hasSpecificMaster = TRIM_FK_FIELDS.some((field) => (bomItem as any)[field]);

      // Early material resolution for specific master types (trim/accessories)
      // so stock check below can use their materialId from the materials table
      let resolvedTrimMaterialId: string | null = null;
      if (!material && hasSpecificMaster) {
        // Build trim lookups from TRIM_FK_FIELDS constant - only include fields with values
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const trimLookups = TRIM_FK_FIELDS.map((field) => ({
          field,
          value: (bomItem as any)[field] as string | null,
        }));
        for (const lookup of trimLookups) {
          if (lookup.value) {
            // For labels, ensure we get the BASE material (not a size variant)
            // Labels can have multiple materials: one base + one per size variant
            const whereClause =
              lookup.field === 'labelId'
                ? { [lookup.field]: lookup.value, sizeVariantId: null }
                : { [lookup.field]: lookup.value };

            const mat = await prisma.materials.findFirst({
              where: whereClause,
            });
            if (mat) {
              resolvedTrimMaterialId = mat.id;
              break;
            }
          }
        }

        // Auto-create materials record if lookup failed (same pattern as fabric/lace/greige)
        if (!resolvedTrimMaterialId) {
          let created: { id: string } | null = null;
          if (bomItem.threadId) created = await ensureMaterialForThread(bomItem.threadId);
          else if (bomItem.buttonId) created = await ensureMaterialForButton(bomItem.buttonId);
          else if (bomItem.zipperId) created = await ensureMaterialForZipper(bomItem.zipperId);
          else if (bomItem.elasticId) created = await ensureMaterialForElastic(bomItem.elasticId);
          else if (bomItem.labelId) created = await ensureMaterialForLabel(bomItem.labelId);
          else if (bomItem.packagingId) created = await ensureMaterialForPackaging(bomItem.packagingId);
          else {
            // Generic fallback for all remaining trim types (hook_eye, buckle, other_fastener, ...)
            // driven by MASTER_CONFIG, so new types work without touching this file
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const setField = TRIM_FK_FIELDS.find((field) => (bomItem as any)[field]);
            if (setField) {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const materialId = await ensureMaterialRecord((bomItem as any)[setField], FK_TO_MASTER_TYPE[setField]);
                created = { id: materialId };
              } catch (err) {
                logWarn(`[MRP] ensureMaterialRecord fallback failed for ${setField}: ${(err as Error).message}`);
              }
            }
          }
          if (created) {
            resolvedTrimMaterialId = created.id;
            console.log(
              `[MRP] Auto-created materials record for ${bomItem.materialType} "${bomItem.componentName}" → ${created.id}`
            );
          }
        }
      }

      // Fallback: resolve fabricId from style's own style_fabrics (set during CAD approval)
      if (
        (bomItem.materialType === 'FABRIC' || (bomItem.materialType === 'GREIGE' && !bomItem.greigeId)) &&
        !bomItem.fabricId &&
        !material
      ) {
        const styleComponents = await prisma.style_components.findMany({
          where: { styleId: style.id },
          select: { id: true },
        });
        if (styleComponents.length > 0) {
          const styleFabric = await prisma.style_fabrics.findFirst({
            where: {
              componentId: { in: styleComponents.map((c) => c.id) },
              fabricId: { not: null },
            },
            select: { fabricId: true },
          });
          if (styleFabric?.fabricId) {
            // Patch BOM item for future calculations
            await prisma.order_bom_items.update({
              where: { id: bomItem.id },
              data: { fabricId: styleFabric.fabricId },
            });
            (bomItem as any).fabricId = styleFabric.fabricId;
            if (bomItem.materialType === 'FABRIC') hasFabric = true;
            console.log(
              `[MRP] Resolved fabricId for "${bomItem.componentName}" via style_fabrics → ${styleFabric.fabricId}`
            );
          }
        }
      }

      // Fallback: resolve laceId from style's material BOM lace references
      if (bomItem.materialType === 'LACE' && !bomItem.laceId && !material) {
        const laceBomItem = await prisma.style_material_bom.findFirst({
          where: {
            styleId: style.id,
            laceId: { not: null },
          },
          select: { laceId: true },
        });
        if (laceBomItem?.laceId) {
          await prisma.order_bom_items.update({
            where: { id: bomItem.id },
            data: { laceId: laceBomItem.laceId },
          });
          (bomItem as any).laceId = laceBomItem.laceId;
          hasLace = true;
          console.log(
            `[MRP] Resolved laceId for "${bomItem.componentName}" via style_material_bom → ${laceBomItem.laceId}`
          );
        }
      }

      // Skip if truly no material info available — but TRACK the skip for user visibility
      if (!material && !hasFabric && !hasLace && !hasGreigeProcessing && !hasLandedGreige && !hasSpecificMaster) {
        let reason = '';
        switch (bomItem.materialType) {
          case 'THREAD':
            reason = `No thread_master linked. Select a Thread Master in the cost sheet trims section.`;
            break;
          case 'BUTTON':
            reason = `No button_master linked. Select a Button Master in the cost sheet trims section.`;
            break;
          case 'ZIPPER':
            reason = `No zipper_master linked. Select a Zipper Master in the cost sheet trims section.`;
            break;
          case 'ELASTIC':
            reason = `No elastic_master linked. Select an Elastic Master in the cost sheet trims section.`;
            break;
          case 'LABEL':
            reason = `No label_master linked. Create a Label Master and add to customer accessory preset, or select in cost sheet.`;
            break;
          case 'PACKAGING':
            reason = `No packaging_master linked. Create a Packaging Master and add to customer accessory preset, or select in cost sheet.`;
            break;
          default:
            reason = `No material linkage (needs materialId, fabricId, laceId, greigeId, or a trim master ID).`;
        }
        skippedItems.push({
          componentName: bomItem.componentName || bomItem.materialType || 'Unknown',
          materialType: bomItem.materialType,
          reason,
        });
        console.warn(`[MRP] Skipped BOM item "${bomItem.componentName}" (${bomItem.materialType}): ${reason}`);
        continue;
      }

      const quantityPerUnit = Number(bomItem.quantityPerGarment);
      const wastagePercent = Number(bomItem.wastagePercent);
      const orderQuantity = orderItem.totalQuantity;

      // Calculate total required with wastage
      // Formula: totalRequired = orderQty × qtyPerUnit × (1 + wastage/100)
      // BUG-MRP5 fix: use decimal.js for precision
      const baseRequiredDecimal = multiplyCurrency(orderQuantity, quantityPerUnit);
      const wastageAmountDecimal = baseRequiredDecimal.times(toCurrency(wastagePercent).dividedBy(100));
      const totalRequiredDecimal = baseRequiredDecimal.plus(wastageAmountDecimal);
      let totalRequired = toNumber(totalRequiredDecimal);

      // P3: For GREIGE items, apply shrinkage adjustment using shared formula
      // Formula: orderQty = need × (1 + wastage%/100) ÷ (1 − shrinkage%/100)
      //
      // MRP-48: the shrinkage source is the PROCESSOR RATE CARD, not the greige master.
      // Every dyer loses a different amount on each process (dyeing vs pigment vs procian vs
      // discharge print), which is precisely what processor_rate_card is keyed on
      // (processor × processingType × printingType × greige). This used to read
      // greige_master.averageShrinkagePercent — a single average per greige that cannot express
      // any of that — so the quantity we bought, the rate we costed at, and the loss the
      // processor was held to were three different numbers for the same job.
      // The greige master is now only a labelled fallback for when no rate card is attached yet.
      // MRP-48f: remember what was used, so the requirement can record it.
      let shrinkagePercentUsed: number | null = null;
      let shrinkageSourceUsed: string | null = null;
      if ((hasGreigeProcessing || hasLandedGreige) && bomItem.greigeId) {
        const { percent: shrinkagePercent, source: shrinkageSource } = await resolveShrinkagePercent(bomItem);
        shrinkagePercentUsed = shrinkagePercent;
        shrinkageSourceUsed = shrinkageSource;
        if (shrinkageSource === 'GREIGE_MASTER_FALLBACK') {
          logWarn(
            `[MRP] ${bomItem.componentName || 'fabric'}: no processor rate card shrinkage available — ` +
              `planning on the greige master average (${shrinkagePercent}%). Attach a rate card so the ` +
              `quantity bought matches the processor's committed loss.`
          );
        } else if (shrinkageSource === 'NONE') {
          logWarn(
            `[MRP] ${bomItem.componentName || 'fabric'}: no shrinkage configured on the rate card OR the ` +
              `greige master — planning with NO shrinkage allowance. Greige purchased will be short if the ` +
              `fabric shrinks.`
          );
        }
        if (shrinkagePercent > 0) {
          const greigeResult = calculateGreigeQuantity({
            need: totalRequired,
            wastagePercent: 0, // Wastage already applied above
            shrinkagePercent,
          });
          totalRequired = greigeResult.quantity;
          // Log any warnings (e.g., invalid shrinkage skipped)
          for (const warn of greigeResult.warnings) {
            logger.warn(`[MRP] ${bomItem.componentName}: ${warn}`);
          }
        }
      }

      // Get preferred supplier (only available if material relation exists)
      const preferredSupplier = material?.suppliers?.find((s: any) => s.isPreferred);

      // Check available stock if requested
      let availableStock = 0;
      let allocatedFromStock = 0;
      let shortfall = totalRequired;
      let status: MaterialRequirementStatus = MaterialRequirementStatus.PO_REQUIRED;

      if (checkStock) {
        // For GREIGE_PROCESSED and LANDED GREIGE items, check greige_stock table
        if ((hasGreigeProcessing || hasLandedGreige) && bomItem.greigeId) {
          const greigeStockResult = await prisma.greige_stock.aggregate({
            where: {
              greigeId: bomItem.greigeId,
              status: 'AVAILABLE',
              quantityAvailable: { gt: 0 },
              // MRP-14: greige physically sitting at a processor is not available to plan against.
              // derived_stock_view (what the trim path reads) already excludes it; this aggregate
              // did not, so the two stock readers disagreed on the same material.
              processorId: null,
            },
            _sum: { quantityAvailable: true, quantityReserved: true },
          });
          const totalGreigeStock = netFreeStock(greigeStockResult._sum);

          if (totalGreigeStock >= totalRequired) {
            availableStock = totalGreigeStock;
            allocatedFromStock = totalRequired;
            shortfall = 0;
            status = MaterialRequirementStatus.FULFILLED_STOCK;
          } else if (totalGreigeStock > 0) {
            availableStock = totalGreigeStock;
            allocatedFromStock = totalGreigeStock;
            shortfall = totalRequired - totalGreigeStock;
            status = MaterialRequirementStatus.PARTIAL_STOCK;
          }
          // else: no greige stock, defaults remain (PO_REQUIRED)

          // For FABRIC items with CAD width info, check fabric_stock with width filtering
        } else if (bomItem.materialType === 'FABRIC' && bomItem.fabricId && bomItem.fabricWidthInches) {
          const bomWidth = Number(bomItem.fabricWidthInches);

          // Check fabric_stock at the BOM-specified width (tolerance ±0.5 inches)
          const fabricStockAtWidth = await prisma.fabric_stock.aggregate({
            where: {
              fabricId: bomItem.fabricId,
              cutableWidth: { gte: bomWidth - 0.5, lte: bomWidth + 0.5 },
              status: 'AVAILABLE',
            },
            _sum: { quantityAvailable: true, quantityReserved: true },
          });
          const stockAtBomWidth = netFreeStock(fabricStockAtWidth._sum);

          // Also check stock at ANY width for this fabric (for split scenarios)
          const fabricStockAnyWidth = await prisma.fabric_stock.aggregate({
            where: {
              fabricId: bomItem.fabricId,
              status: 'AVAILABLE',
            },
            _sum: { quantityAvailable: true, quantityReserved: true },
          });
          const totalFabricStock = netFreeStock(fabricStockAnyWidth._sum);

          if (stockAtBomWidth >= totalRequired) {
            // Fully available at requested width
            availableStock = stockAtBomWidth;
            allocatedFromStock = totalRequired;
            shortfall = 0;
            status = MaterialRequirementStatus.FULFILLED_STOCK;
          } else if (stockAtBomWidth > 0) {
            // Partial stock at requested width
            availableStock = stockAtBomWidth;
            allocatedFromStock = stockAtBomWidth;
            shortfall = totalRequired - stockAtBomWidth;
            status = MaterialRequirementStatus.PARTIAL_STOCK;
          } else if (totalFabricStock > 0) {
            // Stock exists, but only at a different width — net it the same way the partial
            // branch above does.
            // MRP-13: this used to read `totalFabricStock > 0 && totalFabricStock < totalRequired`,
            // so when off-width stock FULLY covered the need no branch matched at all and the row
            // silently fell through to PO_REQUIRED with availableStock 0 — more stock produced
            // less netting.
            availableStock = totalFabricStock;
            allocatedFromStock = Math.min(totalFabricStock, totalRequired);
            shortfall = Math.max(0, totalRequired - totalFabricStock);
            status =
              shortfall === 0 ? MaterialRequirementStatus.FULFILLED_STOCK : MaterialRequirementStatus.PARTIAL_STOCK;
          }
          // else: no stock at all, defaults remain (PO_REQUIRED)
        } else if (bomItem.materialType === 'FABRIC' && bomItem.fabricId && !bomItem.fabricWidthInches) {
          // FABRIC without width info — check fabric_stock at ANY width
          const fabricStockAnyWidth = await prisma.fabric_stock.aggregate({
            where: {
              fabricId: bomItem.fabricId,
              status: 'AVAILABLE',
            },
            _sum: { quantityAvailable: true, quantityReserved: true },
          });
          const totalFabricStock = netFreeStock(fabricStockAnyWidth._sum);

          if (totalFabricStock >= totalRequired) {
            availableStock = totalFabricStock;
            allocatedFromStock = totalRequired;
            shortfall = 0;
            status = MaterialRequirementStatus.FULFILLED_STOCK;
          } else if (totalFabricStock > 0) {
            availableStock = totalFabricStock;
            allocatedFromStock = totalFabricStock;
            shortfall = totalRequired - totalFabricStock;
            status = MaterialRequirementStatus.PARTIAL_STOCK;
          }
          // else: no stock, defaults remain (PO_REQUIRED)
        } else if (bomItem.materialType === 'LACE' && bomItem.laceId) {
          // For LACE items, check lace_stock table
          const laceStockResult = await prisma.lace_stock.aggregate({
            where: {
              laceId: bomItem.laceId,
              status: 'AVAILABLE',
              quantityAvailable: { gt: 0 },
            },
            _sum: { quantityAvailable: true, quantityReserved: true },
          });
          const totalLaceStock = netFreeStock(laceStockResult._sum);

          if (totalLaceStock >= totalRequired) {
            // Fully available from lace stock
            availableStock = totalLaceStock;
            allocatedFromStock = totalRequired;
            shortfall = 0;
            status = MaterialRequirementStatus.FULFILLED_STOCK;
          } else if (totalLaceStock > 0) {
            // Partial stock available
            availableStock = totalLaceStock;
            allocatedFromStock = totalLaceStock;
            shortfall = totalRequired - totalLaceStock;
            status = MaterialRequirementStatus.PARTIAL_STOCK;
          }
          // else: no stock at all, defaults remain (PO_REQUIRED)
        } else if (material?.id || resolvedTrimMaterialId) {
          // Non-fabric/non-lace or without specific IDs: use generic stock_levels
          const stockMaterialId = material?.id || resolvedTrimMaterialId!;
          // T2-1 Stage B3: derived on-hand (per-lot truth) instead of hand-maintained stock_levels.quantity.
          availableStock = await getDerivedOnHand(stockMaterialId);

          if (availableStock >= totalRequired) {
            allocatedFromStock = totalRequired;
            shortfall = 0;
            status = MaterialRequirementStatus.FULFILLED_STOCK;
          } else if (availableStock > 0) {
            allocatedFromStock = availableStock;
            shortfall = totalRequired - availableStock;
            status = MaterialRequirementStatus.PARTIAL_STOCK;
          }
        }
      }

      // Determine materialId - use material.id if available, otherwise look up by fabricId/laceId
      let effectiveMaterialId = material?.id;

      // For FABRIC items without materialId, look up or auto-create materials record by fabricId
      if (!effectiveMaterialId && hasFabric) {
        const fabricMaterial = await prisma.materials.findFirst({
          where: { fabricId: bomItem.fabricId },
        });
        if (fabricMaterial) {
          effectiveMaterialId = fabricMaterial.id;
        } else {
          // Auto-create materials record from fabric_master
          const created = await ensureMaterialForFabric(bomItem.fabricId!);
          if (created) {
            effectiveMaterialId = created.id;
          } else {
            skippedItems.push({
              componentName: bomItem.componentName || 'Unknown Fabric',
              materialType: bomItem.materialType,
              reason: `Failed to auto-create material record for fabricId: ${bomItem.fabricId}. Fabric master may not exist.`,
            });
            console.warn(
              `[MRP] Cannot resolve materials record for fabric: ${bomItem.componentName} (fabricId: ${bomItem.fabricId}). Skipping.`
            );
            continue;
          }
        }
      }

      // For LACE items without materialId, look up or auto-create materials record by laceId
      if (!effectiveMaterialId && hasLace) {
        const laceMaterial = await prisma.materials.findFirst({
          where: { laceId: bomItem.laceId },
        });
        if (laceMaterial) {
          effectiveMaterialId = laceMaterial.id;
        } else {
          const created = await ensureMaterialForLace(bomItem.laceId!);
          if (created) {
            effectiveMaterialId = created.id;
          } else {
            skippedItems.push({
              componentName: bomItem.componentName || 'Unknown Lace',
              materialType: bomItem.materialType,
              reason: `Failed to auto-create material record for laceId: ${bomItem.laceId}. Lace master may not exist.`,
            });
            console.warn(
              `[MRP] Cannot resolve materials record for lace: ${bomItem.componentName} (laceId: ${bomItem.laceId}). Skipping.`
            );
            continue;
          }
        }
      }

      // For GREIGE_PROCESSED and LANDED GREIGE items, look up or auto-create materials record by greigeId
      let greigeMaterialId: string | null = null;
      if (hasGreigeProcessing || hasLandedGreige) {
        const greigeMaterial = await prisma.materials.findFirst({
          where: { greigeId: bomItem.greigeId },
        });
        if (greigeMaterial) {
          greigeMaterialId = greigeMaterial.id;
        } else {
          const created = await ensureMaterialForGreige(bomItem.greigeId!);
          if (created) {
            greigeMaterialId = created.id;
          } else {
            skippedItems.push({
              componentName: bomItem.componentName || 'Unknown Greige',
              materialType: bomItem.materialType,
              reason: `Failed to auto-create material record for greigeId: ${bomItem.greigeId}. Greige master may not exist.`,
            });
            console.warn(
              `[MRP] Cannot resolve materials record for greige: ${bomItem.componentName} (greigeId: ${bomItem.greigeId}). Skipping.`
            );
            continue;
          }
        }
        // For GREIGE_PROCESSED, we also need the fabric material for the finished product reference
        if (!effectiveMaterialId && hasFabric) {
          const fabricMaterial = await prisma.materials.findFirst({
            where: { fabricId: bomItem.fabricId },
          });
          if (fabricMaterial) {
            effectiveMaterialId = fabricMaterial.id;
          } else {
            const created = await ensureMaterialForFabric(bomItem.fabricId!);
            if (created) {
              effectiveMaterialId = created.id;
            }
          }
        }
      }

      // SIZE-BASED LABEL HANDLING: Check if label has size variants
      // If yes, create per-size requirements using order_item_breakup quantities
      if (bomItem.labelId && !effectiveMaterialId) {
        const labelSizeVariants = await prisma.label_size_variants.findMany({
          where: { labelId: bomItem.labelId, isActive: true },
          include: {
            label: { select: { labelCode: true, labelName: true, supplierId: true } },
          },
        });

        if (labelSizeVariants.length > 0) {
          // This label has size variants - check for order size breakup
          const orderBreakup = await prisma.order_item_breakup.findMany({
            where: { orderItemId: orderItem.id },
            include: { size_options: true },
          });

          // Filter for VALID breakup entries (must have size info and quantity > 0)
          const validBreakup = orderBreakup.filter((b) => (b.size_options?.sizeName || b.sizeId) && b.quantity > 0);

          if (validBreakup.length > 0) {
            // Create per-size requirements
            let createdSizeRequirements = false;
            for (const breakup of validBreakup) {
              const sizeName = breakup.size_options?.sizeName || breakup.sizeId;

              // Find matching size variant (case-insensitive)
              const variant = labelSizeVariants.find((v) => v.size.toLowerCase() === sizeName.toLowerCase());

              if (!variant) {
                logWarn(`[MRP] No size variant for label ${bomItem.labelId} size "${sizeName}" - skipping this size`);
                continue;
              }

              // Get/create material for this size variant
              const sizeVariantMaterial = await ensureMaterialForLabelSizeVariant(variant.id);
              if (!sizeVariantMaterial) {
                logWarn(`[MRP] Failed to create material for label size variant ${variant.id}`);
                continue;
              }

              // Calculate per-size quantity with wastage using decimal.js
              const sizeQty = breakup.quantity;
              const baseRequiredDecimalForSize = multiplyCurrency(sizeQty, quantityPerUnit);
              const wastageAmountForSize = baseRequiredDecimalForSize.times(toCurrency(wastagePercent).dividedBy(100));
              const sizeRequired = toNumber(baseRequiredDecimalForSize.plus(wastageAmountForSize));

              // Get supplier from parent label
              const labelSupplierId = variant.label?.supplierId || null;

              calculatedRequirements.push({
                orderId,
                orderItemId: orderItem.id,
                materialId: sizeVariantMaterial.id,
                orderBomId: bom.id,
                orderQuantity: sizeQty,
                quantityPerUnit,
                wastagePercent,
                totalRequired: sizeRequired,
                unit: normalizeUnit(bomItem.unit),
                availableStock: 0, // Label stock not tracked per-size currently
                allocatedFromStock: 0,
                shortfall: sizeRequired,
                preferredSupplierId: labelSupplierId,
                status: MaterialRequirementStatus.PO_REQUIRED,
                requirementType: 'MATERIAL',
                unitPrice: bomItem.unitPrice ? Number(bomItem.unitPrice) : null,
                rateSource: bomItem.unitPrice ? 'ORDER_BOM' : null,
                orderBomItemId: bomItem.id,
                componentName: `${bomItem.componentName || variant.label?.labelName || 'Label'} (${sizeName})`,
              });
              createdSizeRequirements = true;
            }

            if (createdSizeRequirements) {
              // Skip the normal single-requirement path for this BOM item
              console.log(
                `[MRP] Created per-size requirements for label "${bomItem.componentName}" (${labelSizeVariants.length} sizes)`
              );
              continue;
            }
            // If no size requirements were created (all sizes skipped), fall through to single requirement
          } else {
            // SIZE-BASED LABEL BUT NO SIZE BREAKUP:
            // Cannot create meaningful requirements - we don't know how many of each size to order
            // Skip this item and warn the user
            skippedItems.push({
              componentName: bomItem.componentName || labelSizeVariants[0]?.label?.labelName || 'Size-based Label',
              materialType: bomItem.materialType,
              reason: `Size-based label requires size breakup. Add size-wise quantity breakdown to the order to generate label requirements.`,
            });
            console.warn(
              `[MRP] Skipped size-based label "${bomItem.componentName}" - no size breakup available for order item ${orderItem.id}`
            );
            continue;
          }
        }
        // No size variants - fall through to existing single-requirement logic (non-size-based label)
      }

      // For other master types (thread, button, zipper, elastic, label, packaging),
      // reuse early-resolved material ID or look up by specific master ID
      if (!effectiveMaterialId && hasSpecificMaster) {
        if (resolvedTrimMaterialId) {
          effectiveMaterialId = resolvedTrimMaterialId;
        } else {
          const lookups: Array<{ field: string; value: string | null }> = [
            { field: 'buttonId', value: bomItem.buttonId },
            { field: 'threadId', value: bomItem.threadId },
            { field: 'zipperId', value: bomItem.zipperId },
            { field: 'elasticId', value: bomItem.elasticId },
            { field: 'labelId', value: bomItem.labelId },
            { field: 'packagingId', value: bomItem.packagingId },
          ];
          for (const lookup of lookups) {
            if (lookup.value) {
              // For labels, ensure we get the BASE material (not a size variant)
              // Labels can have multiple materials: one base + one per size variant
              const whereClause =
                lookup.field === 'labelId'
                  ? { [lookup.field]: lookup.value, sizeVariantId: null }
                  : { [lookup.field]: lookup.value };

              const mat = await prisma.materials.findFirst({
                where: whereClause,
              });
              if (mat) {
                effectiveMaterialId = mat.id;
                break;
              }
            }
          }
        }
        if (!effectiveMaterialId) {
          skippedItems.push({
            componentName: bomItem.componentName || 'Unknown Trim',
            materialType: bomItem.materialType,
            reason: `No materials record found for trim master (${bomItem.materialType}). Create a materials record linked to this master first.`,
          });
          console.warn(`No materials record for: ${bomItem.componentName} (${bomItem.materialType}). Skipping MRP.`);
          continue;
        }
      }

      // For GREIGE_PROCESSED and LANDED GREIGE items without fabricId, use greigeMaterialId as effectiveMaterialId
      if (!effectiveMaterialId && (hasGreigeProcessing || hasLandedGreige) && greigeMaterialId) {
        effectiveMaterialId = greigeMaterialId;
      }

      // Skip if we still couldn't determine materialId
      if (!effectiveMaterialId) {
        skippedItems.push({
          componentName: bomItem.componentName || 'Unknown',
          materialType: bomItem.materialType,
          reason: `Could not determine materialId after all resolution attempts. Check material master linkages.`,
        });
        console.warn(`Cannot create requirement - no materialId for: ${bomItem.componentName}`);
        continue;
      }

      // For GREIGE_PROCESSED sourcing, create TWO requirements: GREIGE + PROCESSING
      if (hasGreigeProcessing && greigeMaterialId) {
        // Price snapshot: GREIGE uses greigeCost (the landed greige price from cost sheet),
        // falling back to unitPrice (ready-fabric price) if greigeCost wasn't set.
        const greigeSnapshotPrice = bomItem.greigeCost
          ? Number(bomItem.greigeCost)
          : bomItem.unitPrice
            ? Number(bomItem.unitPrice)
            : null;

        // Requirement 1: GREIGE material procurement
        calculatedRequirements.push({
          orderId,
          orderItemId: orderItem.id,
          materialId: greigeMaterialId, // Use greige material ID
          orderBomId: bom.id,
          orderQuantity,
          quantityPerUnit,
          wastagePercent,
          totalRequired,
          unit: normalizeUnit(bomItem.unit),
          availableStock,
          allocatedFromStock,
          shortfall,
          preferredSupplierId: preferredSupplier?.supplierId || null,
          status,
          requirementType: 'MATERIAL', // Standard material procurement
          // Fabric width tracking for split PO scenarios
          fabricWidth: bomItem.fabricWidthInches ? Number(bomItem.fabricWidthInches) : undefined,
          cadId: bomItem.selectedCadId || undefined,
          isGreigeRequirement: true, // Flag for creating linked processing requirement
          shrinkagePercentUsed, // MRP-48f
          shrinkageSourceUsed,
          processorId: bomItem.processorId || null, // Store for processing requirement
          processingCost: bomItem.processingCost ? Number(bomItem.processingCost) : null,
          colorName: (bomItem as any).colorName || null,
          componentName: bomItem.componentName || null,
          // Price snapshot from approved BOM (single source of truth for PO pricing)
          unitPrice: greigeSnapshotPrice,
          rateSource: greigeSnapshotPrice != null ? 'ORDER_BOM' : null,
          orderBomItemId: bomItem.id,
        });

        // Requirement 2: PROCESSING requirement (linked to GREIGE)
        // Price snapshot: processingCost from the BOM item (copied from cost sheet processor rate)
        const processingSnapshotPrice = bomItem.processingCost ? Number(bomItem.processingCost) : null;

        // This will be created AFTER the GREIGE requirement is saved (needs the ID)
        // Include batch group info from CAD for consolidation
        const batchGroupColorId = bomItem.selectedCad?.processingBatchGroupColorId || null;
        const batchGroupColorName = bomItem.selectedCad?.batchGroupColor?.colorName || null;

        calculatedRequirements.push({
          orderId,
          orderItemId: orderItem.id,
          materialId: greigeMaterialId, // Same material reference for tracking
          orderBomId: bom.id,
          orderQuantity,
          quantityPerUnit,
          wastagePercent,
          totalRequired, // Same quantity needs processing
          unit: normalizeUnit(bomItem.unit),
          availableStock: 0, // Processing doesn't have stock
          allocatedFromStock: 0,
          shortfall: totalRequired, // Full amount needs processing
          preferredSupplierId: bomItem.processorId || null, // Processor becomes the "supplier"
          status: MaterialRequirementStatus.PO_REQUIRED, // Processing always needs PO
          requirementType: 'PROCESSING', // Processing service requirement
          processorId: bomItem.processorId || null,
          processingCost: processingSnapshotPrice,
          printingType: bomItem.rateCard?.printingType || null,
          colorName: (bomItem as any).colorName || null,
          componentName: bomItem.componentName || null,
          // Fabric width tracking for split PO scenarios
          fabricWidth: bomItem.fabricWidthInches ? Number(bomItem.fabricWidthInches) : undefined,
          // Billing basis: the % that inflated fabric→greige, so the job-work billable qty
          // (greige × (1 − s)) is derivable from this row alone (DB write at MRP-48f below
          // already persists these — they were simply never set for PROCESSING rows).
          shrinkagePercentUsed,
          shrinkageSourceUsed,
          linkedGreigeMaterialId: greigeMaterialId, // Link to parent GREIGE requirement
          // Price snapshot from approved BOM
          unitPrice: processingSnapshotPrice,
          rateSource: processingSnapshotPrice != null ? 'ORDER_BOM' : null,
          orderBomItemId: bomItem.id,
          // Batch group for consolidation (from CAD)
          processingBatchGroupColorId: batchGroupColorId,
          batchGroupColorName: batchGroupColorName,
        });
      } else {
        // Standard requirement (READY_FABRIC, STOCK_REUSE, or no sourcing strategy)
        // Price snapshot: unitPrice from BOM (which inherited from cost sheet)
        const standardSnapshotPrice = bomItem.unitPrice ? Number(bomItem.unitPrice) : null;

        calculatedRequirements.push({
          orderId,
          orderItemId: orderItem.id,
          materialId: effectiveMaterialId,
          orderBomId: bom.id,
          orderQuantity,
          quantityPerUnit,
          wastagePercent,
          totalRequired,
          unit: normalizeUnit(bomItem.unit),
          availableStock,
          allocatedFromStock,
          shortfall,
          preferredSupplierId: preferredSupplier?.supplierId || null,
          status,
          requirementType: 'MATERIAL', // Standard material procurement
          // Fabric width tracking for split PO scenarios
          fabricWidth: bomItem.fabricWidthInches ? Number(bomItem.fabricWidthInches) : undefined,
          cadId: bomItem.selectedCadId || undefined,
          // Price snapshot from approved BOM (single source of truth for PO pricing)
          unitPrice: standardSnapshotPrice,
          rateSource: standardSnapshotPrice != null ? 'ORDER_BOM' : null,
          orderBomItemId: bomItem.id,
        });
      }
    }
  }

  // Upsert requirements inside a transaction for atomicity
  // Process in two passes: first MATERIAL/GREIGE, then PROCESSING (to get linked IDs)
  const materialReqs = calculatedRequirements.filter((req) => req.requirementType === 'MATERIAL');
  const rawProcessingReqs = calculatedRequirements.filter((req) => req.requirementType === 'PROCESSING');

  // Consolidate PROCESSING requirements by batch group
  // Items with the same processingBatchGroupColorId + processorId + orderId should be combined
  const processingReqs: typeof rawProcessingReqs = [];
  const batchGroups = new Map<string, (typeof rawProcessingReqs)[0]>();

  for (const req of rawProcessingReqs) {
    const batchId = (req as any).processingBatchGroupColorId;
    // Only consolidate if batch group is set AND processor matches
    if (batchId && req.processorId) {
      const batchKey = `${req.orderId}-${req.orderItemId}-${batchId}-${req.processorId}`;
      const existing = batchGroups.get(batchKey);

      if (existing) {
        // Consolidate: sum quantities, combine component names
        existing.totalRequired = Number(existing.totalRequired) + Number(req.totalRequired);
        existing.shortfall = Number(existing.shortfall) + Number(req.shortfall);
        existing.orderQuantity = (existing.orderQuantity || 0) + (req.orderQuantity || 0);
        // Combine component names (e.g., "Kurta, Dupatta")
        if (req.componentName && existing.componentName && !existing.componentName.includes(req.componentName)) {
          existing.componentName = `${existing.componentName}, ${req.componentName}`;
        }
        // Use weighted average for processing cost if both have values
        if (req.processingCost && existing.processingCost) {
          const existingQty = Number(existing.totalRequired) - Number(req.totalRequired);
          const newQty = Number(req.totalRequired);
          const totalQty = existingQty + newQty;
          existing.processingCost =
            (Number(existing.processingCost) * existingQty + Number(req.processingCost) * newQty) / totalQty;
          existing.unitPrice = existing.processingCost;
        }
        // Track batch color name
        if ((req as any).batchGroupColorName) {
          (existing as any).batchGroupColorName = (req as any).batchGroupColorName;
        }
      } else {
        // First item in this batch group
        batchGroups.set(batchKey, { ...req });
      }
    } else {
      // No batch group - keep as separate requirement
      processingReqs.push(req);
    }
  }

  // Add consolidated batch groups to processing requirements
  for (const consolidated of batchGroups.values()) {
    processingReqs.push(consolidated);
  }

  // Requirement numbers come from the atomic sequence generator (code_sequences UPSERT),
  // which safely hands out distinct numbers even when called repeatedly inside the
  // transaction below — each call increments the same counter row on this connection.

  const { created, updated, savedRequirements } = await prisma.$transaction(
    async (tx) => {
      let created = 0;
      let updated = 0;
      const savedRequirements: MaterialRequirementResponse[] = [];

      // MRP-01: supersede-cancel and rebuild are one atomic unit — see the closure definition.
      await cancelSupersededRequirements(tx);

      // Track GREIGE requirements by materialId for linking PROCESSING requirements
      const greigeRequirementIds: Map<string, string> = new Map();

      // First pass: Create/update MATERIAL requirements (including GREIGE)
      for (const req of materialReqs) {
        // CRITICAL: First check if a requirement already exists with an active PO
        // (PO_GENERATED, PO_SENT, PARTIALLY_RECEIVED) — do NOT create duplicates
        // MRP-39: probe with a bare id first. This runs once per requirement inside the
        // transaction and almost always misses, but it used to drag getRequirementIncludes()
        // (13 relations) on every single miss. Hydrate only on the rare hit, where the row is
        // actually returned to the caller.
        const existingWithPOId = await tx.material_requirements.findFirst({
          where: {
            orderId: req.orderId,
            orderItemId: req.orderItemId,
            materialId: req.materialId,
            requirementType: req.requirementType || 'MATERIAL',
            colorName: req.colorName || null,
            // MRP-26: the identity key was (order, item, material, type, colour) — which cannot
            // tell two BOM lines apart when they use the SAME fabric and colour at different
            // widths/CADs (live example: one Kurta component planned at 52" and 50"). Without
            // this, the second line matched the first line's row: if the first had a PO the
            // second was skipped and silently never planned, and on recalculation the two fought
            // over the same revived row. orderBomItemId is the true line identity.
            orderBomItemId: req.orderBomItemId ?? null,
            status: { in: ['PO_GENERATED', 'PO_SENT', 'PARTIALLY_RECEIVED'] },
          },
          select: { id: true },
        });
        const existingWithPO = existingWithPOId
          ? await tx.material_requirements.findUnique({
              where: { id: existingWithPOId.id },
              include: getRequirementIncludes(),
            })
          : null;

        if (existingWithPO) {
          // Skip - already has an active PO, don't duplicate
          // Track for GREIGE linking if needed
          if (req.isGreigeRequirement) {
            // Key includes orderBomItemId: two BOM lines on the same greige+colour are
            // distinct requirements — without it the last write won and PROCESSING rows
            // linked to the OTHER line's greige (wrong shrinkage fallback).
            greigeRequirementIds.set(
              `${req.orderId}-${req.orderItemId}-${req.materialId}-${req.colorName || ''}-${req.orderBomItemId || ''}`,
              existingWithPO.id
            );
          }
          savedRequirements.push(mapToResponse(existingWithPO));
          continue;
        }

        // Check if a CANCELLED requirement exists to reuse (prevents overwriting active ones when same greige used twice)
        const existing = await tx.material_requirements.findFirst({
          where: {
            orderId: req.orderId,
            orderItemId: req.orderItemId,
            materialId: req.materialId,
            requirementType: req.requirementType || 'MATERIAL',
            colorName: req.colorName || null, // Different colors = separate requirements
            orderBomItemId: req.orderBomItemId ?? null, // MRP-26: …and different BOM lines too
            status: 'CANCELLED', // Only reuse CANCELLED — prevents second BOM item overwriting first
          },
          // MRP-26: deterministic pick — this had no ordering, so with several cancelled
          // candidates the revived row (and therefore its requirement number) was arbitrary.
          orderBy: { createdAt: 'desc' },
        });

        let saved;
        if (existing) {
          saved = await tx.material_requirements.update({
            where: { id: existing.id },
            data: {
              orderQuantity: req.orderQuantity,
              quantityPerUnit: req.quantityPerUnit,
              wastagePercent: req.wastagePercent,
              totalRequired: req.totalRequired,
              availableStock: req.availableStock,
              allocatedFromStock: req.allocatedFromStock,
              shortfall: req.shortfall,
              status: req.status,
              fabricWidth: req.fabricWidth,
              cadId: req.cadId,
              calculatedAt: new Date(),
              // Re-link to the CURRENT BOM — a revived CANCELLED requirement may point at an
              // old inactive BOM; leaving it would orphan it on the next regenerate cycle
              orderBomId: req.orderBomId,
              shrinkagePercentUsed: req.shrinkagePercentUsed ?? null, // MRP-48f
              shrinkageSource: req.shrinkageSourceUsed ?? null,
              // Price snapshot update (in case cost sheet / BOM prices changed before recalc)
              unitPrice: req.unitPrice,
              rateSource: req.rateSource,
              orderBomItemId: req.orderBomItemId,
            },
            include: getRequirementIncludes(),
          });
          updated++;
        } else {
          const requirementNumber = await generateRequirementNumber(tx);
          saved = await tx.material_requirements.create({
            data: {
              requirementNumber,
              source: RequirementSource.SALES_ORDER,
              orderId: req.orderId,
              orderItemId: req.orderItemId,
              materialId: req.materialId,
              orderBomId: req.orderBomId,
              orderQuantity: req.orderQuantity,
              quantityPerUnit: req.quantityPerUnit,
              wastagePercent: req.wastagePercent,
              totalRequired: req.totalRequired,
              unit: req.unit as Unit,
              availableStock: req.availableStock,
              allocatedFromStock: req.allocatedFromStock,
              shortfall: req.shortfall,
              preferredSupplierId: req.preferredSupplierId,
              status: req.status,
              fabricWidth: req.fabricWidth,
              cadId: req.cadId,
              requirementType: req.requirementType || 'MATERIAL',
              colorName: req.colorName || null,
              componentName: req.componentName || null,
              requiredDate,
              createdById: userId,
              // MRP-48f: audit which shrinkage was applied and where it came from
              shrinkagePercentUsed: req.shrinkagePercentUsed ?? null,
              shrinkageSource: req.shrinkageSourceUsed ?? null,
              // Price snapshot from approved BOM
              unitPrice: req.unitPrice,
              rateSource: req.rateSource,
              orderBomItemId: req.orderBomItemId,
            },
            include: getRequirementIncludes(),
          });
          created++;
        }

        // Track GREIGE requirements for linking to PROCESSING requirements
        if (req.isGreigeRequirement && saved) {
          greigeRequirementIds.set(
            `${req.orderId}-${req.orderItemId}-${req.materialId}-${req.colorName || ''}-${req.orderBomItemId || ''}`,
            saved.id
          );
        }

        savedRequirements.push(mapToResponse(saved));
      }

      // Second pass: Create/update PROCESSING requirements with linked GREIGE IDs
      for (const req of processingReqs) {
        const linkedGreigeId = greigeRequirementIds.get(
          `${req.orderId}-${req.orderItemId}-${req.linkedGreigeMaterialId || req.materialId}-${req.colorName || ''}-${req.orderBomItemId || ''}`
        );

        // CRITICAL: First check if a requirement already exists with an active PO
        // (PO_GENERATED, PO_SENT, PARTIALLY_RECEIVED) — do NOT create duplicates
        // MRP-39: cheap probe, hydrate only on the rare hit (see the MATERIAL pass above).
        const existingProcWithPOId = await tx.material_requirements.findFirst({
          where: {
            orderId: req.orderId,
            orderItemId: req.orderItemId,
            materialId: req.materialId,
            requirementType: 'PROCESSING',
            colorName: req.colorName || null,
            orderBomItemId: req.orderBomItemId ?? null, // MRP-26: distinguish BOM lines
            status: { in: ['PO_GENERATED', 'PO_SENT', 'PARTIALLY_RECEIVED'] },
          },
          select: { id: true },
        });
        const existingWithPO = existingProcWithPOId
          ? await tx.material_requirements.findUnique({
              where: { id: existingProcWithPOId.id },
              include: getRequirementIncludes(),
            })
          : null;

        if (existingWithPO) {
          // Skip - already has an active PO, don't duplicate
          savedRequirements.push(mapToResponse(existingWithPO));
          continue;
        }

        const existing = await tx.material_requirements.findFirst({
          where: {
            orderId: req.orderId,
            orderItemId: req.orderItemId,
            materialId: req.materialId,
            requirementType: 'PROCESSING',
            colorName: req.colorName || null,
            orderBomItemId: req.orderBomItemId ?? null, // MRP-26: distinguish BOM lines
            status: 'CANCELLED', // Only reuse CANCELLED — prevents second BOM item overwriting first
          },
          orderBy: { createdAt: 'desc' }, // MRP-26: deterministic revive
        });

        let saved;
        if (existing) {
          saved = await tx.material_requirements.update({
            where: { id: existing.id },
            data: {
              orderQuantity: req.orderQuantity,
              quantityPerUnit: req.quantityPerUnit,
              wastagePercent: req.wastagePercent,
              totalRequired: req.totalRequired,
              availableStock: 0,
              allocatedFromStock: 0,
              shortfall: req.shortfall,
              status: req.status,
              processorId: req.processorId,
              processingCost: req.processingCost,
              linkedRequirementId: linkedGreigeId || existing.linkedRequirementId,
              calculatedAt: new Date(),
              // Re-link to the CURRENT BOM (same reason as the MATERIAL revive block above)
              orderBomId: req.orderBomId,
              // Price snapshot update
              unitPrice: req.unitPrice,
              rateSource: req.rateSource,
              orderBomItemId: req.orderBomItemId,
            },
            include: getRequirementIncludes(),
          });
          updated++;
        } else {
          const requirementNumber = await generateRequirementNumber(tx);
          saved = await tx.material_requirements.create({
            data: {
              requirementNumber,
              source: RequirementSource.SALES_ORDER,
              orderId: req.orderId,
              orderItemId: req.orderItemId,
              materialId: req.materialId,
              orderBomId: req.orderBomId,
              orderQuantity: req.orderQuantity,
              quantityPerUnit: req.quantityPerUnit,
              wastagePercent: req.wastagePercent,
              totalRequired: req.totalRequired,
              unit: req.unit as Unit,
              availableStock: 0,
              allocatedFromStock: 0,
              shortfall: req.shortfall,
              preferredSupplierId: req.processorId, // Processor is the "supplier"
              status: req.status,
              requirementType: 'PROCESSING',
              processorId: req.processorId,
              processingCost: req.processingCost,
              printingType: req.printingType || null,
              linkedRequirementId: linkedGreigeId,
              colorName: req.colorName || null,
              componentName: req.componentName || null,
              requiredDate,
              createdById: userId,
              // MRP-48f: audit which shrinkage was applied and where it came from
              shrinkagePercentUsed: req.shrinkagePercentUsed ?? null,
              shrinkageSource: req.shrinkageSourceUsed ?? null,
              // Price snapshot from approved BOM
              unitPrice: req.unitPrice,
              rateSource: req.rateSource,
              orderBomItemId: req.orderBomItemId,
            },
            include: getRequirementIncludes(),
          });
          created++;
        }

        savedRequirements.push(mapToResponse(saved));
      }

      return { created, updated, savedRequirements };
    },
    // The supersede-cancel now shares this transaction (MRP-01), and the persist loop still costs
    // 3-4 serialized round trips per requirement, so a large multi-style order can legitimately
    // run past 30s. A timeout here is no longer destructive (everything rolls back) but it is
    // still a failed recalc for the user.
    { timeout: 60000, maxWait: 10000 }
  );

  // Log summary for debugging
  if (skippedItems.length > 0) {
    console.warn(
      `[MRP] ${skippedItems.length} BOM item(s) skipped during MRP calculation for order ${orderId}:`,
      skippedItems.map((s) => `  - ${s.componentName} (${s.materialType}): ${s.reason}`).join('\n')
    );
  }

  return { created, updated, requirements: savedRequirements, skipped: skippedItems };
}

/**
 * Create a manual material requirement (not from BOM)
 */
export async function createManualRequirement(
  data: CreateManualRequirementRequest,
  userId: string
): Promise<MaterialRequirementResponse> {
  const requirementNumber = await generateRequirementNumber();

  const requirement = await prisma.material_requirements.create({
    data: {
      requirementNumber,
      source: RequirementSource.MANUAL,
      materialId: data.materialId,
      orderQuantity: 1,
      quantityPerUnit: data.quantity,
      wastagePercent: 0,
      totalRequired: data.quantity,
      unit: data.unit as Unit,
      availableStock: 0,
      allocatedFromStock: 0,
      shortfall: data.quantity,
      preferredSupplierId: data.preferredSupplierId,
      status: MaterialRequirementStatus.PO_REQUIRED,
      requiredDate: new Date(data.requiredDate),
      createdById: userId,
      // Manual requirements have no BOM price snapshot — PO generation uses live resolver fallback
      unitPrice: null,
      rateSource: 'MANUAL',
      orderBomItemId: null,
    },
    include: getRequirementIncludes(),
  });

  return mapToResponse(requirement);
}

/**
 * Get requirements with filters and pagination
 */
export async function getRequirements(
  filters: RequirementFilters
): Promise<{ data: MaterialRequirementResponse[]; total: number }> {
  const {
    orderId,
    orderItemId,
    materialId,
    supplierId,
    styleId,
    status,
    source,
    requirementType,
    requiredDateFrom,
    requiredDateTo,
    hasShortfall,
    search,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = filters;

  const where: Prisma.material_requirementsWhereInput = {};

  if (orderId) where.orderId = orderId;
  if (orderItemId) where.orderItemId = orderItemId;
  if (materialId) where.materialId = materialId;
  if (supplierId) where.preferredSupplierId = supplierId;
  if (styleId) where.order_items = { styleId };
  if (source) where.source = source;
  if (requirementType) where.requirementType = requirementType;

  if (status) {
    if (Array.isArray(status)) {
      where.status = { in: status };
    } else {
      where.status = status;
    }
  }

  if (requiredDateFrom || requiredDateTo) {
    where.requiredDate = {};
    if (requiredDateFrom) where.requiredDate.gte = new Date(requiredDateFrom);
    if (requiredDateTo) where.requiredDate.lte = new Date(requiredDateTo);
  }

  if (hasShortfall === true) {
    where.shortfall = { gt: 0 };
  } else if (hasShortfall === false) {
    where.shortfall = { lte: 0 };
  }

  if (search) {
    where.OR = [
      { requirementNumber: { contains: search, mode: 'insensitive' } },
      { materials: { code: { contains: search, mode: 'insensitive' } } },
      { materials: { name: { contains: search, mode: 'insensitive' } } },
      { orders: { orderNumber: { contains: search, mode: 'insensitive' } } },
      { order_items: { styles: { styleCode: { contains: search, mode: 'insensitive' } } } },
      { order_items: { styles: { buyerStyleRef: { contains: search, mode: 'insensitive' } } } },
      { order_items: { styles: { styleName: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.material_requirements.findMany({
      where,
      include: getRequirementIncludes(),
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.material_requirements.count({ where }),
  ]);

  return {
    data: data.map(mapToResponse),
    total,
  };
}

/**
 * Get a single requirement by ID
 */
export async function getRequirementById(id: string): Promise<MaterialRequirementResponse | null> {
  const requirement = await prisma.material_requirements.findUnique({
    where: { id },
    include: getRequirementIncludes(),
  });

  return requirement ? mapToResponse(requirement) : null;
}

/**
 * Get distinct styles that have material requirements (for filter dropdown)
 */
export async function getDistinctRequirementStyles(requirementType?: string) {
  const where: Prisma.material_requirementsWhereInput = {
    orderItemId: { not: null },
    status: { not: 'CANCELLED' },
  };
  if (requirementType) where.requirementType = requirementType;

  // MRP-42: this feeds a filter dropdown but ran as an unbounded `distinct` scan of the whole
  // requirements table on every page load, with no take and no ordering. Newest-first + a hard
  // cap keeps it proportional to a dropdown; the distinct is still per order item, so the style
  // dedup below is unchanged.
  const items = await prisma.material_requirements.findMany({
    where,
    select: {
      order_items: {
        select: {
          styleId: true,
          styles: { select: { styleCode: true, buyerStyleRef: true, styleName: true } },
        },
      },
    },
    distinct: ['orderItemId'],
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  // Deduplicate by styleId (multiple order_items may reference the same style)
  const styleMap = new Map<
    string,
    { id: string; styleCode: string; buyerStyleRef: string | null; styleName: string }
  >();
  for (const item of items) {
    if (item.order_items) {
      const { styleId, styles } = item.order_items;
      if (!styleMap.has(styleId)) {
        styleMap.set(styleId, {
          id: styleId,
          styleCode: styles.styleCode,
          buyerStyleRef: styles.buyerStyleRef ?? null,
          styleName: styles.styleName,
        });
      }
    }
  }

  return Array.from(styleMap.values()).sort((a, b) => a.styleCode.localeCompare(b.styleCode));
}

/**
 * Get requirements summary for an order
 */
export async function getOrderRequirementsSummary(orderId: string): Promise<OrderRequirementsSummary> {
  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    select: { id: true, orderNumber: true },
  });

  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  const requirements = await prisma.material_requirements.findMany({
    where: { orderId },
    select: {
      status: true,
      totalRequired: true,
      shortfall: true,
    },
  });

  // Group by status
  const byStatus = Object.values(MaterialRequirementStatus)
    .map((status) => {
      const matching = requirements.filter((r) => r.status === status);
      return {
        status,
        count: matching.length,
        totalQuantity: matching.reduce((sum, r) => sum + Number(r.totalRequired), 0),
      };
    })
    .filter((s) => s.count > 0);

  const totalShortfall = requirements.reduce((sum, r) => sum + Number(r.shortfall), 0);
  const requirementsNeedingPO = requirements.filter(
    (r) => r.status === MaterialRequirementStatus.PO_REQUIRED || r.status === MaterialRequirementStatus.PARTIAL_STOCK
  ).length;

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalRequirements: requirements.length,
    byStatus,
    totalShortfall,
    requirementsNeedingPO,
  };
}

/**
 * Get MRP dashboard statistics
 */
export async function getDashboardStats(): Promise<MRPDashboardStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter for MATERIAL-only requirements (excludes PROCESSING from material tab counts)
  const materialOnly = { requirementType: { not: 'PROCESSING' } };

  const [
    pendingCount,
    shortfallSum,
    needingPOCount,
    poInProgressCount,
    awaitingReceiptCount,
    overdueCount,
    processingCount,
    processingNeedingAssignmentCount,
    processingPoGeneratedCount,
    openProcessingRows,
    byMaterialType,
    bySupplier,
  ] = await Promise.all([
    // Total pending MATERIAL requirements
    prisma.material_requirements.count({
      where: {
        ...materialOnly,
        status: {
          in: [
            MaterialRequirementStatus.PENDING,
            MaterialRequirementStatus.PO_REQUIRED,
            MaterialRequirementStatus.PARTIAL_STOCK,
          ],
        },
      },
    }),
    // Total shortfall (all types)
    prisma.material_requirements.aggregate({
      where: { shortfall: { gt: 0 } },
      _sum: { shortfall: true },
    }),
    // MATERIAL requirements needing PO
    prisma.material_requirements.count({
      where: {
        ...materialOnly,
        status: {
          in: [MaterialRequirementStatus.PO_REQUIRED, MaterialRequirementStatus.PARTIAL_STOCK],
        },
      },
    }),
    // PO in progress (MATERIAL only)
    prisma.material_requirements.count({
      where: { ...materialOnly, status: MaterialRequirementStatus.PO_GENERATED },
    }),
    // Awaiting receipt (MATERIAL only)
    prisma.material_requirements.count({
      where: { ...materialOnly, status: MaterialRequirementStatus.PO_SENT },
    }),
    // Overdue requirements (all types)
    prisma.material_requirements.count({
      where: {
        requiredDate: { lt: today },
        status: {
          notIn: [MaterialRequirementStatus.RECEIVED, MaterialRequirementStatus.CANCELLED],
        },
      },
    }),
    // PROCESSING requirements count (for Outsourced Work tab)
    prisma.material_requirements.count({
      where: {
        requirementType: 'PROCESSING',
        status: { notIn: [MaterialRequirementStatus.RECEIVED, MaterialRequirementStatus.CANCELLED] },
      },
    }),
    // MRP-27: the total above spans every live PROCESSING row, including ones that already have a
    // processor and a Job Work Order. The summary cards need the two halves separately —
    // otherwise a row the table labels "JWO Created" is counted under "Needs Assignment" AND
    // omitted from "PO Generated".
    prisma.material_requirements.count({
      where: {
        requirementType: 'PROCESSING',
        status: {
          in: [
            MaterialRequirementStatus.PENDING,
            MaterialRequirementStatus.PO_REQUIRED,
            MaterialRequirementStatus.PARTIAL_STOCK,
          ],
        },
      },
    }),
    prisma.material_requirements.count({
      where: {
        requirementType: 'PROCESSING',
        status: { in: [MaterialRequirementStatus.PO_GENERATED, MaterialRequirementStatus.PO_SENT] },
      },
    }),
    // Open PROCESSING rows for the Est. Service Cost tile — the tile previously counted only
    // work-order service requirements, showing ₹0.00 while dyeing/printing work sat pending.
    // Billing basis: estimate on the fabric-out qty the processor will charge for.
    prisma.material_requirements.findMany({
      where: {
        requirementType: 'PROCESSING',
        status: {
          in: [
            MaterialRequirementStatus.PENDING,
            MaterialRequirementStatus.PO_REQUIRED,
            MaterialRequirementStatus.PARTIAL_STOCK,
          ],
        },
      },
      select: {
        shortfall: true,
        processingCost: true,
        shrinkagePercentUsed: true,
        linkedRequirement: { select: { shrinkagePercentUsed: true } },
        orderBomItem: { select: { rateCard: { select: { shrinkagePercent: true } } } },
      },
    }),
    // By material type
    prisma.$queryRaw`
      SELECT m."materialType", COUNT(*)::int as count, SUM(mr.shortfall)::float as shortfall
      FROM material_requirements mr
      JOIN materials m ON mr."materialId" = m.id
      WHERE mr.shortfall > 0
      GROUP BY m."materialType"
    ` as Promise<{ materialType: string; count: number; shortfall: number }[]>,
    // By supplier
    prisma.$queryRaw`
      SELECT
        s.id as "supplierId",
        s.name as "supplierName",
        COUNT(*)::int as "requirementCount",
        0::float as "totalValue"
      FROM material_requirements mr
      JOIN suppliers s ON mr."preferredSupplierId" = s.id
      WHERE mr.status IN ('PO_REQUIRED', 'PARTIAL_STOCK')
      GROUP BY s.id, s.name
      ORDER BY "requirementCount" DESC
      LIMIT 10
    ` as Promise<{ supplierId: string; supplierName: string; requirementCount: number; totalValue: number }[]>,
  ]);

  // Billing basis: estimate = Σ (fabric-out qty × processing rate) over open PROCESSING rows
  const processingEstimatedCost = openProcessingRows.reduce((sum: number, row: any) => {
    if (row.processingCost == null) return sum;
    const billable = processingBillableQty(Number(row.shortfall), resolveProcessingShrinkagePercent(row));
    return toNumber(addCurrency(sum, multiplyCurrency(billable, row.processingCost)));
  }, 0);

  return {
    totalPendingRequirements: pendingCount,
    totalShortfall: Number(shortfallSum._sum.shortfall || 0),
    requirementsNeedingPO: needingPOCount,
    poInProgress: poInProgressCount,
    awaitingReceipt: awaitingReceiptCount,
    overdueRequirements: overdueCount,
    processingRequirementsCount: processingCount,
    processingNeedingAssignment: processingNeedingAssignmentCount,
    processingPoGenerated: processingPoGeneratedCount,
    processingEstimatedCost: toNumber(roundToCent(toCurrency(processingEstimatedCost))),
    byMaterialType: byMaterialType || [],
    bySupplier: bySupplier || [],
  };
}

/**
 * Allocate stock to a requirement
 */
export async function allocateStock(data: AllocateStockRequest, userId: string): Promise<MaterialRequirementResponse> {
  const requirement = await prisma.material_requirements.findUnique({
    where: { id: data.requirementId },
  });

  if (!requirement) {
    throw new Error(`Requirement ${data.requirementId} not found`);
  }

  // BUG-MRP5 fix: use decimal.js for precision in allocation calculations
  const allocatedFromStockNum = Number(requirement.allocatedFromStock);
  const totalRequiredNum = Number(requirement.totalRequired);
  const newAllocatedDecimal = toCurrency(allocatedFromStockNum).plus(toCurrency(data.quantity));
  const newShortfallDecimal = toCurrency(totalRequiredNum).minus(toNumber(newAllocatedDecimal));
  const newAllocated = toNumber(newAllocatedDecimal);
  const newShortfall = Math.max(0, toNumber(newShortfallDecimal));
  let newStatus = requirement.status;

  if (newShortfall === 0) {
    newStatus = MaterialRequirementStatus.FULFILLED_STOCK;
  } else if (newAllocated > 0) {
    newStatus = MaterialRequirementStatus.PARTIAL_STOCK;
  }

  // The requirement status update, the FIFO stock reservations, and the reservation audit MUST be atomic —
  // otherwise a partial failure leaves the requirement reading FULFILLED/PARTIAL while the physical
  // quantityReserved is missing, so the same stock is re-allocated to another order (double-reserve /
  // oversell) (bug-hunt T1/F4).
  const updated = await prisma.$transaction(async (tx) => {
    const upd = await tx.material_requirements.update({
      where: { id: data.requirementId },
      data: {
        allocatedFromStock: newAllocated,
        shortfall: newShortfall,
        status: newStatus,
      },
      include: getRequirementIncludes(),
    });

    // Reserve physical stock on the appropriate stock table (FIFO by receivedDate)
    const reqWithMaterial = await tx.material_requirements.findUnique({
      where: { id: data.requirementId },
      include: {
        materials: {
          select: { id: true, materialType: true, fabricId: true, laceId: true, greigeId: true },
        },
      },
    });

    if (reqWithMaterial?.materials) {
      const matType = reqWithMaterial.materials.materialType;
      const reserveQty = data.quantity;

      if (matType === 'FABRIC' && reqWithMaterial.materials.fabricId) {
        const lots = await tx.fabric_stock.findMany({
          where: { fabricId: reqWithMaterial.materials.fabricId, status: 'AVAILABLE', quantityAvailable: { gt: 0 } },
          orderBy: { receivedDate: 'asc' },
        });
        let remaining = reserveQty;
        for (const lot of lots) {
          if (remaining <= 0) break;
          const toReserve = Math.min(remaining, Number(lot.quantityAvailable));
          await tx.fabric_stock.update({
            where: { id: lot.id },
            data: { quantityReserved: { increment: toReserve } },
          });
          remaining -= toReserve;
        }
      } else if (matType === 'GREIGE' && reqWithMaterial.materials.greigeId) {
        const lots = await tx.greige_stock.findMany({
          where: { greigeId: reqWithMaterial.materials.greigeId, status: 'AVAILABLE', quantityAvailable: { gt: 0 } },
          orderBy: { receivedDate: 'asc' },
        });
        let remaining = reserveQty;
        for (const lot of lots) {
          if (remaining <= 0) break;
          const toReserve = Math.min(remaining, Number(lot.quantityAvailable));
          await tx.greige_stock.update({
            where: { id: lot.id },
            data: { quantityReserved: { increment: toReserve } },
          });
          remaining -= toReserve;
        }
      } else if (matType === 'LACE' && reqWithMaterial.materials.laceId) {
        const lots = await tx.lace_stock.findMany({
          where: { laceId: reqWithMaterial.materials.laceId, status: 'AVAILABLE', quantityAvailable: { gt: 0 } },
          orderBy: { receivedDate: 'asc' },
        });
        let remaining = reserveQty;
        for (const lot of lots) {
          if (remaining <= 0) break;
          const toReserve = Math.min(remaining, Number(lot.quantityAvailable));
          await tx.lace_stock.update({
            where: { id: lot.id },
            data: { quantityReserved: { increment: toReserve } },
          });
          remaining -= toReserve;
        }
      }

      // Create audit entry in stock_reservations
      const warehouseId = data.warehouseId;
      const warehouse = warehouseId
        ? await tx.warehouses.findUnique({ where: { id: warehouseId } })
        : await tx.warehouses.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });

      if (warehouse) {
        await tx.stock_reservations.create({
          data: {
            materialId: reqWithMaterial.materialId,
            warehouseId: warehouse.id,
            reservationType: 'ORDER',
            referenceType: 'MATERIAL_REQUIREMENT',
            referenceId: data.requirementId,
            referenceNumber: reqWithMaterial.requirementNumber,
            reservedQuantity: reserveQty,
            unit: reqWithMaterial.unit as any,
            status: 'ACTIVE',
            reservedById: userId,
          },
        });
      }
    }

    return upd;
  });

  return mapToResponse(updated);
}

/**
 * JWC bridge (BUG-JWC1): shared shape for the Job Work Order that accompanies every
 * MRP-generated PROCESSING PO. Used by generatePOFromRequirements (live bridge) and
 * scripts/backfill-mrp-processing-jwos.ts (historical orphans) so the two cannot drift.
 */
export interface ProcessingJwoSeed {
  poId: string | null; // Phase 4c: MRP-generated processing work is JWO-only (no shadow PO)
  processorId: string;
  processType: 'DYEING' | 'PRINTING';
  styleId: string | null;
  fabricId: string | null;
  qtyMeters: number;
  /**
   * Billing qty = expected finished output (qtyMeters × (1 − shrinkage)). The processor
   * charges for the fabric he returns, not the greige he was issued. Null → billing
   * falls back to qtySentMeters (no shrinkage step, e.g. piece-based work).
   */
  qtyBillable?: number | null;
  /** Greige (loom-state) width of the material issued, e.g. 63". */
  greigeWidthInches?: number | null;
  /**
   * ASKED FINISHED width (stenter target the processor must deliver) = CAD cutable
   * width + selvedge deduction. Stored in job_work_orders.sentWidthInches.
   */
  askedFinishedWidthInches?: number | null;
  ratePerMeter: number;
  expectedShrinkage: number | null;
  expectedReturnDate: Date | null;
  requirementNumbers: string[];
  userId: string;
  /**
   * MRP-15: job_work_orders.uom is free text (MTR / PCS / KG) and was hard-coded to 'MTR'
   * regardless of what the requirement was actually measured in, so a job priced per piece was
   * documented as metres. Optional to keep the historical backfill script working unchanged.
   */
  uom?: string;
  /**
   * Fabric-naming: the finished fabric_master minted at JWO creation (identity from the
   * requirement chain — colour, CAD pattern part, style, greige). Null when the identity
   * could not be resolved; the GRN receipt path then mints it as a fallback.
   */
  finishedFabricId?: string | null;
}

/**
 * Shrinkage % for a PROCESSING requirement, for converting between the greige meters
 * issued to the processor and the finished meters he bills for.
 * Priority: the requirement's own snapshot → the linked GREIGE requirement's snapshot
 * (same MRP run; legacy PROCESSING rows never stored their own) → the rate card → 0.
 */
export function resolveProcessingShrinkagePercent(req: {
  shrinkagePercentUsed?: unknown;
  linkedRequirement?: { shrinkagePercentUsed?: unknown } | null;
  orderBomItem?: { rateCard?: { shrinkagePercent?: unknown } | null } | null;
}): number {
  const candidates = [
    req.shrinkagePercentUsed,
    req.linkedRequirement?.shrinkagePercentUsed,
    req.orderBomItem?.rateCard?.shrinkagePercent,
  ];
  for (const candidate of candidates) {
    if (candidate == null) continue;
    const pct = Number(candidate);
    if (Number.isFinite(pct) && pct >= 0 && pct < 100) return pct;
  }
  return 0;
}

/**
 * Billable (finished-fabric) quantity for a PROCESSING requirement. The requirement's
 * shortfall/totalRequired are greige-basis (what to buy and issue); the processor bills
 * for the fabric he returns = greige × (1 − shrinkage).
 */
export function processingBillableQty(greigeQty: number | Prisma.Decimal, shrinkagePercent: number): number {
  return toNumber(roundToCent(applyShrinkageLoss(greigeQty, shrinkagePercent)));
}

/** MRP-15: Prisma `Unit` → the short codes job_work_orders.uom uses. */
export function unitToJwoUom(unit: string | null | undefined): string {
  switch (unit) {
    case 'METER':
      return 'MTR';
    case 'YARD':
      return 'YDS';
    case 'KILOGRAM':
      return 'KG';
    case 'GRAM':
      return 'GM';
    case 'PIECE':
      return 'PCS';
    default:
      return 'MTR';
  }
}

export function buildJwoDataForProcessingPO(seed: ProcessingJwoSeed, jobWorkNumber: string) {
  return {
    jobWorkNumber,
    processType: seed.processType,
    processorId: seed.processorId,
    purchaseOrderId: seed.poId ?? null,
    styleId: seed.styleId,
    fabricId: seed.fabricId,
    finishedFabricId: seed.finishedFabricId ?? null,
    fabricType: 'GREIGE',
    qtySentMeters: seed.qtyMeters,
    qtyBillable: seed.qtyBillable ?? null,
    greigeWidthInches: seed.greigeWidthInches ?? null,
    sentWidthInches: seed.askedFinishedWidthInches ?? null,
    uom: seed.uom ?? 'MTR', // MRP-15

    agreedRatePerMeter: seed.ratePerMeter,
    isRateTbd: false,
    expectedShrinkage: seed.expectedShrinkage,
    expectedReturnDate: seed.expectedReturnDate,
    status: 'READY_TO_SEND' as const,
    jwoStatus: 'DRAFT' as const,
    remarks: `[MRP] Auto-created from ${seed.requirementNumbers.join(', ')}`,
    createdById: seed.userId,
  };
}

/**
 * JWC5 (Consolidation Phase 2): find MRP PROCESSING requirements matching a manual
 * process PO's identity (greige and/or fabric + processor), so the manual flow can
 * link open requirements instead of double-ordering, and warn when MRP already
 * generated a live PO for the same work.
 */
export interface ProcessingRequirementMatches {
  openRequirements: Array<{
    id: string;
    requirementNumber: string;
    shortfall: number;
    orderNumber: string | null;
  }>;
  activePOs: Array<{
    poId: string;
    poNumber: string;
    poStatus: string;
    jobWorkNumber: string | null;
    requirementNumbers: string[];
  }>;
  // Phase 4c: MRP-generated processing work is JWO-only — surface live JWOs too
  activeJwos: Array<{
    jwoId: string;
    jobWorkNumber: string;
    status: string;
    requirementNumbers: string[];
  }>;
}

export async function findProcessingRequirementMatches(params: {
  greigeId: string | null;
  fabricId: string | null;
  processorId: string;
}): Promise<ProcessingRequirementMatches> {
  const identity: Prisma.material_requirementsWhereInput[] = [];
  if (params.greigeId) identity.push({ materials: { greigeId: params.greigeId } });
  if (params.fabricId) identity.push({ orderBomItem: { fabricId: params.fabricId } });
  if (identity.length === 0) return { openRequirements: [], activePOs: [], activeJwos: [] };

  const reqs = await prisma.material_requirements.findMany({
    where: {
      requirementType: 'PROCESSING',
      AND: [
        { OR: [{ processorId: params.processorId }, { preferredSupplierId: params.processorId }] },
        { OR: identity },
      ],
      status: { in: ['PO_REQUIRED', 'PARTIAL_STOCK', 'PO_GENERATED', 'PO_SENT'] },
    },
    include: {
      orders: { select: { orderNumber: true } },
      requirement_po_links: {
        include: {
          purchase_orders: {
            select: {
              id: true,
              poNumber: true,
              status: true,
              isActive: true,
              poCategory: true,
              jobWorkOrder: { select: { jobWorkNumber: true } },
            },
          },
        },
      },
      // Phase 4c: JWO-only coverage
      requirement_jwo_links: {
        include: {
          job_work_orders: {
            select: { id: true, jobWorkNumber: true, status: true, jwoStatus: true, isActive: true },
          },
        },
      },
    },
  });

  const openRequirements: ProcessingRequirementMatches['openRequirements'] = [];
  const activePOMap = new Map<string, ProcessingRequirementMatches['activePOs'][number]>();
  const activeJwoMap = new Map<string, ProcessingRequirementMatches['activeJwos'][number]>();

  for (const req of reqs) {
    if (req.status === 'PO_REQUIRED' || req.status === 'PARTIAL_STOCK') {
      openRequirements.push({
        id: req.id,
        requirementNumber: req.requirementNumber,
        shortfall: Number(req.shortfall),
        orderNumber: req.orders?.orderNumber ?? null,
      });
      continue;
    }
    for (const link of req.requirement_po_links) {
      const po = link.purchase_orders;
      if (!po?.isActive || po.poCategory !== 'PROCESSING') continue;
      if (po.status === 'CANCELLED' || po.status === 'RECEIVED') continue;
      const existing = activePOMap.get(po.id);
      if (existing) {
        existing.requirementNumbers.push(req.requirementNumber);
      } else {
        activePOMap.set(po.id, {
          poId: po.id,
          poNumber: po.poNumber,
          poStatus: po.status,
          jobWorkNumber: po.jobWorkOrder?.jobWorkNumber ?? null,
          requirementNumbers: [req.requirementNumber],
        });
      }
    }
    for (const link of req.requirement_jwo_links) {
      const jwo = link.job_work_orders;
      if (!jwo?.isActive) continue;
      if (jwo.jwoStatus === 'CLOSED' || jwo.jwoStatus === 'CANCELLED' || jwo.jwoStatus === 'STOCK_UPDATED') continue;
      const existing = activeJwoMap.get(jwo.id);
      if (existing) {
        existing.requirementNumbers.push(req.requirementNumber);
      } else {
        activeJwoMap.set(jwo.id, {
          jwoId: jwo.id,
          jobWorkNumber: jwo.jobWorkNumber,
          status: jwo.jwoStatus!,
          requirementNumbers: [req.requirementNumber],
        });
      }
    }
  }

  return { openRequirements, activePOs: [...activePOMap.values()], activeJwos: [...activeJwoMap.values()] };
}

/**
 * Generate a Purchase Order from requirements
 */
export async function generatePOFromRequirements(
  data: GeneratePOFromRequirementsRequest,
  userId: string
): Promise<{
  // Phase 4c: PROCESSING requirements return a jobWorkOrder and purchaseOrder: null
  purchaseOrder: { id: string; poNumber: string; totalAmount: number } | null;
  jobWorkOrder?: { id: string; jobWorkNumber: string; totalAmount: number };
  linkedRequirements: number;
  totalItems: number;
  jobWorkNumber?: string;
}> {
  const {
    requirementIds,
    supplierId,
    expectedDeliveryDate,
    remarks,
    consolidate = true,
    itemPrices,
    itemQuantities,
  } = data;

  // BUG-ORD3 fix: prevent duplicate PO creation
  // Check if any requirements already have active (non-cancelled) PO links
  // This is a belt-and-suspenders check in case the status filter below fails
  const existingPOLinks = await prisma.requirement_po_links.findMany({
    where: {
      requirementId: { in: requirementIds },
      purchase_orders: {
        status: { notIn: ['CANCELLED'] },
      },
    },
    include: {
      purchase_orders: { select: { poNumber: true, status: true } },
      material_requirements: { select: { requirementNumber: true } },
    },
  });

  // BUG-ORD3 fix: Use filtered requirement IDs (excluding those with active POs)
  const alreadyLinkedReqIds = new Set(existingPOLinks.map((link) => link.requirementId));
  const effectiveReqIds = requirementIds.filter((id) => !alreadyLinkedReqIds.has(id));

  if (existingPOLinks.length > 0) {
    if (effectiveReqIds.length === 0) {
      // All requirements already have POs - return info about existing POs instead of error
      const poNumbers = [...new Set(existingPOLinks.map((l) => l.purchase_orders?.poNumber).filter(Boolean))];
      throw new Error(
        `All selected requirements already have active Purchase Orders: ${poNumbers.join(', ')}. ` +
          `No duplicate PO created.`
      );
    }

    // Log warning about skipped requirements
    const skippedCount = existingPOLinks.length;
    const skippedReqNumbers = existingPOLinks
      .map((l) => l.material_requirements?.requirementNumber)
      .filter(Boolean)
      .join(', ');
    logger.warn(
      `[MRP] BUG-ORD3: Skipping ${skippedCount} requirement(s) that already have active POs: ${skippedReqNumbers}`
    );
  }

  // Get all requirements
  const requirements = await prisma.material_requirements.findMany({
    where: {
      id: { in: effectiveReqIds },
      status: { in: [MaterialRequirementStatus.PO_REQUIRED, MaterialRequirementStatus.PARTIAL_STOCK] },
    },
    include: {
      materials: true,
      orderBom: { select: { sourceCostSheetId: true } },
      orders: { select: { orderNumber: true } },
      order_items: {
        select: {
          styleId: true,
          styles: { select: { styleCode: true, buyerStyleRef: true, styleName: true } },
        },
      },
      // JWC bridge: BOM-line provenance for the Job Work Order (process type from the
      // rate card, greige/fabric refs, shrinkage)
      orderBomItem: {
        select: {
          id: true,
          rateCardId: true,
          greigeId: true,
          fabricId: true,
          fabricWidthInches: true,
          sourcingStrategy: true,
          colorName: true,
          rateCard: { select: { processingType: true, printingType: true, shrinkagePercent: true } },
          // Fabric-naming: BOM → CAD → styleFabric/pattern-part chain for the finished
          // fabric identity minted with the JWO
          selectedCad: {
            select: {
              id: true,
              styleFabricId: true,
              isCombinedCutting: true,
              patternPart: { select: { id: true, name: true } },
              cadPatternParts: {
                select: { patternPart: { select: { id: true, name: true, sortOrder: true } } },
              },
            },
          },
        },
      },
      // Billing basis: legacy PROCESSING rows have NULL shrinkagePercentUsed — the linked
      // GREIGE requirement carries the % that inflated the qty, so it is the fallback.
      linkedRequirement: { select: { shrinkagePercentUsed: true } },
    },
  });

  if (requirements.length === 0) {
    throw new Error('No valid requirements found for PO generation');
  }

  // MRP-04: PROCESSING requirements are Job-Work-Order-only (Job Work Consolidation phases
  // 4c/5a — dyeing and printing never ride on a purchase order). The JWO branch further down is
  // gated on `requirements.every(PROCESSING)`, so a MIXED selection silently failed that test
  // and fell through to the PO path, putting a dyeing job on a material PO as a line item.
  // Reject the mix rather than quietly emitting the wrong document type.
  const selectedTypes = [...new Set(requirements.map((r) => r.requirementType))];
  if (selectedTypes.length > 1) {
    throw new Error(
      `Cannot generate a single document for mixed requirement types (${selectedTypes.join(' + ')}). ` +
        `PROCESSING requirements produce a Job Work Order and MATERIAL requirements produce a ` +
        `Purchase Order — select one type at a time.`
    );
  }

  // Look up supplier prices from material_suppliers (UUID-based)
  const materialIds = [...new Set(requirements.map((r) => r.materialId))];
  const supplierPrices = await prisma.material_suppliers.findMany({
    where: {
      materialId: { in: materialIds },
      supplierId,
      isActive: true,
    },
    select: { materialId: true, supplierPrice: true },
  });
  const autoPriceMap = new Map(
    supplierPrices
      .filter((sp) => sp.supplierPrice && Number(sp.supplierPrice) > 0)
      .map((sp) => [sp.materialId, Number(sp.supplierPrice)])
  );

  // Resolve cost-sheet rates for each material (FABRIC / GREIGE / PROCESSING)
  //
  // MRP-41: each iteration awaits an independent rate lookup, so this ran strictly serially —
  // N round trips for N requirements, then the whole thing again at generation time. The lookups
  // do not depend on each other, so run them concurrently and write the map afterwards.
  const costSheetRateMap = new Map<string, number>();
  const rateResolutions = await Promise.all(
    requirements.map(async (req): Promise<{ key: string; rate: number } | null> => {
      if (itemPrices?.[req.materialId] != null) return null; // manual override takes priority

      if (req.requirementType === 'PROCESSING') {
        const groupKey = req.id;
        if (itemPrices?.[groupKey] != null) return null;
        // MRP-06: price against the processor the document is actually issued to.
        if (req.processorId && req.processorId !== supplierId) {
          logWarn(
            `[MRP] Requirement ${req.requirementNumber} is assigned to processor ${req.processorId} but the job ` +
              `work order is being issued to ${supplierId} — pricing against ${supplierId}'s rate card.`
          );
        }
        try {
          const resolved = await resolveRate({
            poCategory: 'PROCESSING' as any,
            supplierId,
            printingType: req.printingType || undefined,
            materialId: req.materialId,
          });
          if (resolved.rate && resolved.rate > 0) return { key: groupKey, rate: resolved.rate };
        } catch {
          /* fall through to the stored processing cost */
        }
        return req.processingCost ? { key: groupKey, rate: Number(req.processingCost) } : null;
      }

      const costSheetId = (req as any).orderBom?.sourceCostSheetId ?? null;
      const matType = req.materials?.materialType;
      if (!costSheetId) return null;
      if (matType !== 'FABRIC' && matType !== 'GREIGE') return null;
      try {
        const resolved = await resolveRate({
          poCategory: (matType === 'GREIGE' ? 'GREIGE' : 'FABRIC') as any,
          costSheetId,
          fabricId: ((req.materials as any)?.fabricId ?? undefined) || undefined,
          greigeId: ((req.materials as any)?.greigeId ?? undefined) || undefined,
          supplierId,
          materialId: req.materialId,
        });
        if (resolved.rate && resolved.rate > 0) return { key: req.materialId, rate: resolved.rate };
      } catch {
        // silently skip — supplier price will be used as fallback
      }
      return null;
    })
  );
  for (const resolution of rateResolutions) {
    if (resolution) costSheetRateMap.set(resolution.key, resolution.rate);
  }

  // Determine supplier state for GST calculation
  const supplierGst = await prisma.supplier_gst_numbers.findFirst({
    where: { supplierId, isPrimary: true },
    select: { stateCode: true },
  });
  const supplierStateCode =
    supplierGst?.stateCode ||
    (
      await prisma.supplier_gst_numbers.findFirst({
        where: { supplierId },
        select: { stateCode: true },
      })
    )?.stateCode ||
    null;
  const isInterstate = supplierStateCode ? supplierStateCode !== COMPANY_CONFIG.stateCode : false;

  // Group by material if consolidating
  interface POItemData {
    materialId: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    requirementIds: string[];
    printingType?: string | null;
    material: any;
    // Enriched fields for PO document
    colorName?: string | null;
    styleCode?: string | null;
    orderNumber?: string | null;
    processingType?: string | null;
    fabricWidth?: number | null;
  }

  const poItems: POItemData[] = [];

  // Helper to extract enriched fields from a requirement
  const getEnrichedFields = (req: any) => ({
    colorName: req.colorName || null,
    styleCode: req.order_items?.styles?.styleCode || null,
    buyerStyleRef: req.order_items?.styles?.buyerStyleRef ?? null,
    orderNumber: req.orders?.orderNumber || null,
    processingType: req.printingType || (req.requirementType === 'PROCESSING' ? 'DYEING' : null),
    fabricWidth: req.fabricWidth ? Number(req.fabricWidth) : null,
  });

  // Billing basis: PROCESSING item quantities are FABRIC-out meters (what the processor
  // bills for = shortfall × (1 − shrinkage)); the requirement's shortfall itself stays
  // greige-basis (what to buy and physically issue). MATERIAL rows pass through unchanged.
  // Wizard qty overrides for PROCESSING are therefore fabric-basis too.
  const itemBaseQty = (req: (typeof requirements)[number]): number =>
    req.requirementType === 'PROCESSING'
      ? processingBillableQty(Number(req.shortfall), resolveProcessingShrinkagePercent(req as any))
      : Number(req.shortfall);

  if (consolidate) {
    const materialGroups = new Map<string, POItemData>();

    // P1.4 D5 fix: First pass — sum all shortfalls using the shared buildGroupKey helper
    for (const req of requirements) {
      const key = buildGroupKey(req);
      // P1.3: Price priority = manual override → snapshot → live resolver fallback → supplier → 0
      const snapshotPrice = req.unitPrice ? Number(req.unitPrice) : null;
      const price =
        itemPrices?.[key] ??
        itemPrices?.[req.materialId] ??
        snapshotPrice ??
        costSheetRateMap.get(key) ??
        costSheetRateMap.get(req.materialId) ??
        autoPriceMap.get(req.materialId) ??
        0;
      const existing = materialGroups.get(key);

      if (existing) {
        // Add shortfall to group (don't apply override yet — that's the second pass)
        existing.quantity += itemBaseQty(req);
        existing.requirementIds.push(req.id);
      } else {
        materialGroups.set(key, {
          materialId: req.materialId,
          quantity: itemBaseQty(req),
          unit: req.unit,
          unitPrice: price,
          requirementIds: [req.id],
          printingType: req.printingType || null,
          material: req.materials,
          ...getEnrichedFields(req),
        });
      }
    }

    // P1.4 D5 fix: Second pass — apply quantity overrides AFTER all shortfalls are summed.
    // This fixes the bug where an override on the first requirement would be ADDED to subsequent shortfalls.
    for (const [key, group] of materialGroups) {
      const overrideQty = (itemQuantities as any)?.[key] ?? (itemQuantities as any)?.[group.materialId];
      if (overrideQty != null) {
        group.quantity = Number(overrideQty); // REPLACE summed quantity, not add to it
      }
    }

    poItems.push(...materialGroups.values());
  } else {
    for (const req of requirements) {
      // P1.4 D5: Use shared buildGroupKey for consistency with consolidate and preview
      const groupKey = buildGroupKey(req);
      // P1.3: Price priority = manual override → snapshot → live resolver fallback → supplier → 0
      const snapshotPrice = req.unitPrice ? Number(req.unitPrice) : null;
      const price =
        itemPrices?.[groupKey] ??
        itemPrices?.[req.materialId] ??
        snapshotPrice ??
        costSheetRateMap.get(groupKey) ??
        costSheetRateMap.get(req.materialId) ??
        autoPriceMap.get(req.materialId) ??
        0;
      const baseQty = itemBaseQty(req);
      const overrideQty = (itemQuantities as any)?.[groupKey] ?? (itemQuantities as any)?.[req.materialId];
      poItems.push({
        materialId: req.materialId,
        quantity: overrideQty != null ? Number(overrideQty) : baseQty,
        unit: req.unit,
        unitPrice: price,
        requirementIds: [req.id],
        printingType: req.printingType || null,
        material: req.materials,
        ...getEnrichedFields(req),
      });
    }
  }

  // Validate: no items with zero price
  const zeroPriceItems = poItems.filter((item) => item.unitPrice <= 0);
  if (zeroPriceItems.length > 0) {
    const names = zeroPriceItems.map((i) => i.material?.code || i.materialId).join(', ');
    throw new Error(`Cannot generate PO with zero-price items: ${names}. Please set prices for all items.`);
  }

  // Determine PO category from material types (material POs only — PROCESSING
  // requirements return early below with a JWO and never reach the PO create)
  const materialTypes = requirements.map((req) => ({
    materialType: req.materials?.materialType || null,
  }));
  const poCategory = determinePOCategoryFromMaterials(materialTypes);

  // Check if these are PROCESSING requirements
  const isProcessingRequirements = requirements.every((req) => req.requirementType === 'PROCESSING');

  // JWC bridge (BUG-JWC1): derive the process type per requirement — the rate card is
  // authoritative, else printingType implies PRINTING, else DYEING. One JWO per PO
  // (1:1 purchaseOrderId), so a PO cannot mix process types.
  let processingProcessType: 'DYEING' | 'PRINTING' | null = null;
  if (isProcessingRequirements) {
    const deriveProcessType = (req: (typeof requirements)[number]): 'DYEING' | 'PRINTING' => {
      const rcType = (req as any).orderBomItem?.rateCard?.processingType;
      if (rcType === 'DYEING' || rcType === 'PRINTING') return rcType;
      return req.printingType ? 'PRINTING' : 'DYEING';
    };
    const processTypes = new Set(requirements.map(deriveProcessType));
    if (processTypes.size > 1) {
      throw new Error('Selected PROCESSING requirements mix DYEING and PRINTING — generate one PO per process type.');
    }
    processingProcessType = [...processTypes][0];
  }

  // ============================================================================
  // Phase 4c: PROCESSING requirements produce a Job Work Order ONLY — no purchase
  // order. The JWO is the commercial document (SAC-based GST via
  // computeCommercialTotals); receiving happens through the PO-less GRN path
  // (POST /api/grn/jwo, Phase 4b); dispatch through the JWO issue action.
  // Greige gating is natural: material cannot be issued before the greige lot exists.
  // ============================================================================
  if (isProcessingRequirements && processingProcessType) {
    // Billing vs material basis (user rule 2026-08-17): poItems.quantity is the BILLABLE
    // fabric-out qty (the processor charges for the finished fabric he returns); the greige
    // to physically issue is derived per item by dividing back through that item's shrinkage.
    // Each PROCESSING item carries exactly one requirement (buildGroupKey → req.id).
    const reqById = new Map(requirements.map((r) => [r.id, r]));
    const itemShrinkage = (item: (typeof poItems)[number]): number => {
      const req = reqById.get(item.requirementIds[0]);
      return req ? resolveProcessingShrinkagePercent(req as any) : 0;
    };
    const totalBillableMeters = poItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalGreigeMeters = poItems.reduce(
      (sum, item) => sum + toNumber(roundToCent(divideByShrinkage(item.quantity, itemShrinkage(item)))),
      0
    );
    // Single expectedShrinkage field on the JWO — the value implied by the two totals
    // (equals the rate-card % for the usual single-requirement job work).
    const impliedShrinkage =
      totalGreigeMeters > 0
        ? toNumber(
            roundToCent(toCurrency(1).minus(toCurrency(totalBillableMeters).dividedBy(totalGreigeMeters)).times(100))
          )
        : 0;

    // MRP-15: the JWO stores a single qty + a single rate, but a job work order can bundle several
    // requirements. This used to take `poItems[0].unitPrice` — the FIRST item's rate — and apply it
    // to the SUMMED quantity, so a bundle of items priced differently was billed entirely at
    // whichever happened to be first. Use the value-weighted average, which reproduces the exact
    // line-total sum, and refuse to guess when the units differ.
    const jwoUnits = [...new Set(poItems.map((item) => normalizeUnit(item.unit)))];
    if (jwoUnits.length > 1) {
      throw new Error(
        `Cannot create one job work order for requirements measured in different units (${jwoUnits.join(', ')}). ` +
          `Generate a separate job work order per unit.`
      );
    }
    const jwoUom = jwoUnits[0] ?? 'METER';
    const totalJobValue = poItems.reduce(
      (sum, item) => toNumber(addCurrency(sum, multiplyCurrency(item.quantity, item.unitPrice))),
      0
    );
    const ratePerMeter = totalBillableMeters > 0 ? toNumber(roundToCent(totalJobValue / totalBillableMeters)) : 0;
    if (poItems.length > 1 && new Set(poItems.map((i) => i.unitPrice)).size > 1) {
      logWarn(
        `[MRP] Job work order bundles ${poItems.length} items at different rates — storing the value-weighted ` +
          `average ${ratePerMeter} so the total (${totalJobValue}) is preserved.`
      );
    }
    const primary = requirements[0] as any;
    const styleCode = primary.order_items?.styles?.styleCode || 'STK';

    // Widths (industry model 2026-08-18): the processor is asked for a FINISHED width
    // (stenter target) = CAD cutable width + selvedge deduction; the greige width is what
    // is physically issued. Cutable stays internal to marker planning.
    const cutableWidth =
      primary.orderBomItem?.fabricWidthInches != null
        ? Number(primary.orderBomItem.fabricWidthInches)
        : primary.fabricWidth != null
          ? Number(primary.fabricWidth)
          : null;
    const widthDeduction = await systemSettingsService.getCutableWidthDeductionInches();
    const askedFinishedWidthInches = cutableWidth != null ? cutableWidth + widthDeduction : null;
    let greigeWidthInches: number | null = null;
    if (primary.orderBomItem?.greigeId) {
      const greigeMaster = await prisma.greige_master.findUnique({
        where: { id: primary.orderBomItem.greigeId },
        select: { greigeCode: true, greigeWidth: true, expectedFinishedWidthMin: true, expectedFinishedWidthMax: true },
      });
      greigeWidthInches = greigeMaster?.greigeWidth != null ? Number(greigeMaster.greigeWidth) : null;
      if (askedFinishedWidthInches != null && greigeMaster) {
        const bandMin =
          greigeMaster.expectedFinishedWidthMin != null ? Number(greigeMaster.expectedFinishedWidthMin) : null;
        const bandMax =
          greigeMaster.expectedFinishedWidthMax != null ? Number(greigeMaster.expectedFinishedWidthMax) : null;
        if (
          (bandMin != null && askedFinishedWidthInches < bandMin) ||
          (bandMax != null && askedFinishedWidthInches > bandMax)
        ) {
          logWarn(
            `[MRP] Asked finished width ${askedFinishedWidthInches}" is outside ${greigeMaster.greigeCode}'s ` +
              `achievable band ${bandMin ?? '?'}–${bandMax ?? '?'}" — creating anyway; verify with the processor.`
          );
        }
      }
    }

    const jwoResult = await prisma.$transaction(async (tx) => {
      // Guarded status flip — same double-order race protection as the PO path
      const allRequirementIds = [...new Set(poItems.flatMap((item) => item.requirementIds))];
      const allowedStatuses = [MaterialRequirementStatus.PO_REQUIRED, MaterialRequirementStatus.PARTIAL_STOCK];
      const flipResult = await tx.material_requirements.updateMany({
        where: { id: { in: allRequirementIds }, status: { in: allowedStatuses } },
        data: { status: MaterialRequirementStatus.PO_GENERATED },
      });
      if (flipResult.count !== allRequirementIds.length) {
        throw new Error(
          `Race condition: ${allRequirementIds.length - flipResult.count} of ${allRequirementIds.length} processing ` +
            `requirements were already covered by a concurrent request. Aborting to prevent duplicate job work.`
        );
      }

      const jobWorkNumber = await generateJobWorkNumber(processingProcessType!, styleCode);
      const processTypeMaster = await tx.process_type_master.findFirst({
        where: { code: processingProcessType!, isActive: true },
        select: { id: true },
      });

      // Fabric-naming: mint the finished fabric master NOW — the requirement chain carries
      // the full identity (colour, CAD pattern part, style, greige) — so the JWO PDF's
      // "Expected Output" names the real fabric before receipt. Never blocks JWO creation.
      let finishedFabricId: string | null = null;
      try {
        const identity = await resolveFinishedFabricIdentity({
          requirement: primary,
          jwo: { sentWidthInches: askedFinishedWidthInches },
          finishType: processingProcessType === 'PRINTING' ? 'PRINTED' : 'DYED',
          tx,
        });
        if (identity) {
          const minted = await getOrCreateFinishedFabricV2(identity, userId, 'AUTO_FROM_MRP_JWO', tx);
          finishedFabricId = minted.fabricId;
        } else {
          logWarn(`[MRP] JWO ${jobWorkNumber}: no greige lineage on requirement — finished fabric deferred to receipt`);
        }
      } catch (error) {
        logWarn(
          `[MRP] JWO ${jobWorkNumber}: finished fabric mint failed — deferred to receipt: ${error instanceof Error ? error.message : error}`
        );
      }

      const jwo = await tx.job_work_orders.create({
        data: {
          ...buildJwoDataForProcessingPO(
            {
              poId: null,
              processorId: supplierId,
              processType: processingProcessType!,
              styleId: primary.order_items?.styleId ?? null,
              fabricId: primary.orderBomItem?.fabricId ?? null,
              finishedFabricId,
              qtyMeters: toNumber(roundToCent(toCurrency(totalGreigeMeters))), // greige to issue
              qtyBillable: toNumber(roundToCent(toCurrency(totalBillableMeters))), // fabric the processor bills for
              greigeWidthInches,
              askedFinishedWidthInches,
              ratePerMeter,
              uom: unitToJwoUom(jwoUom), // MRP-15: carry the requirement's real unit
              expectedShrinkage: impliedShrinkage,
              expectedReturnDate: new Date(expectedDeliveryDate),
              requirementNumbers: requirements.map((r) => r.requirementNumber),
              userId,
            },
            jobWorkNumber
          ),
          processTypeId: processTypeMaster?.id ?? null,
          remarks: `[MRP] Job work for ${requirements.map((r) => r.requirementNumber).join(', ')}${remarks ? `\n${remarks}` : ''}`,
        },
      });

      // Commercial totals (unresolved GST downgrades to subtotal-only)
      try {
        await jobWorkOrderService.computeCommercialTotals(jwo.id, tx);
      } catch (error) {
        if (error instanceof JobWorkOrderError && error.code === JWO_ERROR_CODES.GST_RATE_UNRESOLVED) {
          await tx.job_work_orders.update({
            where: { id: jwo.id },
            data: { subtotal: roundToCent(totalBillableMeters * ratePerMeter).toNumber() },
          });
          logWarn(`[MRP] JWO ${jobWorkNumber} created without GST — ${processingProcessType} gstRate unresolved`);
        } else {
          throw error;
        }
      }

      // Requirement ↔ JWO links (processing items carry exactly one requirement each)
      let linkedCount = 0;
      for (const item of poItems) {
        for (const reqId of item.requirementIds) {
          await tx.requirement_jwo_links.create({
            data: {
              requirementId: reqId,
              jobWorkOrderId: jwo.id,
              allocatedQuantity:
                item.requirementIds.length > 1 ? item.quantity / item.requirementIds.length : item.quantity,
            },
          });
          linkedCount++;
        }
      }

      // MRP-12: same partial-coverage rule as the purchase-order path — a job work order that
      // covers only part of a processing requirement leaves the balance orderable rather than
      // closing the requirement silently. See the detailed note in the PO branch below.
      for (const req of requirements) {
        const allocated = await tx.requirement_jwo_links.aggregate({
          where: { requirementId: req.id },
          _sum: { allocatedQuantity: true },
        });
        // Links are billable/fabric-basis (what the processor is billed for); the
        // requirement's shortfall is greige-basis — convert before comparing.
        const reqShrinkage = resolveProcessingShrinkagePercent(req as any);
        const coveredFabric = Number(allocated._sum.allocatedQuantity ?? 0);
        const covered = toNumber(roundToCent(divideByShrinkage(coveredFabric, reqShrinkage)));
        const remainder = toNumber(subtractCurrency(Number(req.shortfall), covered));
        // 0.01 not 0.001: shortfall is stored at 3dp but coverage is roundToCent (2dp), so
        // structural dust up to ~0.005 m is possible — 0.001 minted phantom 2 mm
        // requirements that could never close (live case MR2608-0071).
        if (remainder <= 0.01) continue;

        const childNumber = await generateRequirementNumber(tx);
        await tx.material_requirements.create({
          data: {
            requirementNumber: childNumber,
            source: req.source,
            orderId: req.orderId,
            orderItemId: req.orderItemId,
            materialId: req.materialId,
            orderBomId: req.orderBomId,
            orderBomItemId: req.orderBomItemId,
            orderQuantity: req.orderQuantity,
            quantityPerUnit: req.quantityPerUnit,
            wastagePercent: req.wastagePercent,
            totalRequired: remainder,
            unit: req.unit,
            availableStock: 0,
            allocatedFromStock: 0,
            shortfall: remainder,
            preferredSupplierId: req.preferredSupplierId,
            status: MaterialRequirementStatus.PO_REQUIRED,
            requirementType: req.requirementType,
            processorId: req.processorId,
            processingCost: req.processingCost,
            printingType: req.printingType,
            linkedRequirementId: req.linkedRequirementId,
            // Shrinkage audit trail must survive the split — without it the child falls
            // back down resolveProcessingShrinkagePercent and can land on silent 0%.
            shrinkagePercentUsed: req.shrinkagePercentUsed,
            shrinkageSource: req.shrinkageSource,
            colorName: req.colorName,
            componentName: req.componentName,
            requiredDate: req.requiredDate,
            createdById: userId,
            unitPrice: req.unitPrice,
            rateSource: req.rateSource,
            splitFromId: req.id,
          },
        });
        await tx.material_requirements.update({ where: { id: req.id }, data: { shortfall: covered } });
        logWarn(
          `[MRP] JWO ${jobWorkNumber} covers ${covered} of ${Number(req.shortfall)} for ${req.requirementNumber}; ` +
            `balance ${remainder} carried forward as ${childNumber}`
        );
      }

      const fullJwo = await tx.job_work_orders.findUnique({
        where: { id: jwo.id },
        select: { id: true, jobWorkNumber: true, totalAmount: true, subtotal: true },
      });
      return { jwo: fullJwo!, linkedCount };
    });

    return {
      purchaseOrder: null,
      jobWorkOrder: {
        id: jwoResult.jwo.id,
        jobWorkNumber: jwoResult.jwo.jobWorkNumber,
        totalAmount: Number(jwoResult.jwo.totalAmount ?? jwoResult.jwo.subtotal ?? 0),
      },
      linkedRequirements: jwoResult.linkedCount,
      totalItems: poItems.length,
      jobWorkNumber: jwoResult.jwo.jobWorkNumber,
    };
  }

  // Phase 5a: dead PROCESSING tail deleted — processing requirements always return
  // early above with a JWO, so this point is only reached by material POs.
  const initialStatus = PurchaseOrderStatus.DRAFT;

  // Create PO with items in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Atomic sequence inside the creating tx (bug-hunt procurement-9: generateCode was
    // read-max+1 on a separate PrismaClient with a silent timestamp fallback)
    const poNumber = await generateAtomicPONumberInTx(tx);

    // Calculate GST per item and totals
    let subtotal = 0;
    let poTotalCgst = 0;
    let poTotalSgst = 0;
    let poTotalIgst = 0;

    // GST via the shared authority (bug-hunt procurement-10: the previous inline math bypassed
    // the HSN resolution chain + apparel price-slab, so the same material could be taxed
    // differently than on a manually-created PO)
    const itemsWithGst = await Promise.all(
      poItems.map(async (item) => {
        const lineTotal = item.quantity * item.unitPrice;

        const gst = await gstService.calculateLineItemGST({
          lineTotal,
          hsnSacCode: null, // Resolved from materialId
          materialId: item.materialId || null,
          isInterstate,
          unitPrice: item.unitPrice,
        });

        subtotal += lineTotal;
        poTotalCgst += gst.cgstAmount;
        poTotalSgst += gst.sgstAmount;
        poTotalIgst += gst.igstAmount;

        return {
          ...item,
          lineTotal,
          hsnCode: gst.hsnCode,
          gstRate: gst.gstRate,
          cgstRate: gst.cgstRate,
          cgstAmount: gst.cgstAmount,
          sgstRate: gst.sgstRate,
          sgstAmount: gst.sgstAmount,
          igstRate: gst.igstRate,
          igstAmount: gst.igstAmount,
          taxAmount: gst.taxAmount,
        };
      })
    );

    subtotal = roundToCent(subtotal).toNumber();
    const totalTax = roundToCent(poTotalCgst + poTotalSgst + poTotalIgst).toNumber();
    const totalAmount = roundToCent(subtotal + totalTax).toNumber();
    poTotalCgst = roundToCent(poTotalCgst).toNumber();
    poTotalSgst = roundToCent(poTotalSgst).toNumber();
    poTotalIgst = roundToCent(poTotalIgst).toNumber();

    // Create Purchase Order
    const po = await tx.purchase_orders.create({
      data: {
        id: crypto.randomUUID(),
        poNumber,
        supplierId,
        expectedDeliveryDate: new Date(expectedDeliveryDate),
        status: initialStatus,
        poSource: POSource.MRP,
        poCategory,
        totalAmount,
        subtotal,
        totalCgst: poTotalCgst,
        totalSgst: poTotalSgst,
        totalIgst: poTotalIgst,
        totalTax,
        isInterstate,
        remarks,
        createdById: userId,
      },
    });

    // P1.6: Guarded status flip — collect all requirement IDs and flip their status atomically.
    // This closes the double-order race: if two users click "Generate PO" on the same requirements,
    // only one updateMany will succeed (count will match); the other will find count=0 and abort.
    const allRequirementIds = [...new Set(itemsWithGst.flatMap((item) => item.requirementIds))];
    const allowedStatuses = [MaterialRequirementStatus.PO_REQUIRED, MaterialRequirementStatus.PARTIAL_STOCK];

    const flipResult = await tx.material_requirements.updateMany({
      where: {
        id: { in: allRequirementIds },
        status: { in: allowedStatuses },
      },
      data: { status: MaterialRequirementStatus.PO_GENERATED },
    });

    if (flipResult.count !== allRequirementIds.length) {
      // Some requirements were already flipped by a concurrent request — abort this transaction.
      // The other request's PO will cover those requirements.
      throw new Error(
        `Race condition: ${allRequirementIds.length - flipResult.count} of ${allRequirementIds.length} requirements ` +
          `were already PO_GENERATED/PO_SENT/PARTIALLY_RECEIVED/RECEIVED by a concurrent request. ` +
          `Aborting to prevent duplicate PO.`
      );
    }

    // Create PO items and links
    let linkedCount = 0;
    for (const item of itemsWithGst) {
      const poItem = await tx.purchase_order_items.create({
        data: {
          id: crypto.randomUUID(),
          poId: po.id,
          materialId: item.materialId,
          orderedQuantity: item.quantity,
          unit: item.unit as Unit,
          unitPrice: item.unitPrice,
          totalPrice: item.lineTotal,
          printingType: item.printingType || null,
          componentName: (item as any).componentName || null,
          colorName: (item as any).colorName || null,
          fabricWidth: (item as any).fabricWidth || null,
          hsnCode: item.hsnCode,
          gstRate: item.gstRate,
          cgstRate: item.cgstRate,
          cgstAmount: item.cgstAmount,
          sgstRate: item.sgstRate,
          sgstAmount: item.sgstAmount,
          igstRate: item.igstRate,
          igstAmount: item.igstAmount,
          taxAmount: item.taxAmount,
        },
      });

      // Create links to requirements with proportional allocation based on actual shortfall
      // Build shortfall map for proportional allocation
      const reqShortfalls = new Map<string, number>();
      let totalShortfall = 0;
      for (const reqId of item.requirementIds) {
        const req = requirements.find((r) => r.id === reqId);
        const shortfall = req ? Number(req.shortfall) : 0;
        reqShortfalls.set(reqId, shortfall);
        totalShortfall += shortfall;
      }

      for (const reqId of item.requirementIds) {
        // Allocate proportionally: each requirement gets its share based on its shortfall
        const reqShortfall = reqShortfalls.get(reqId) || 0;
        const allocatedQty =
          totalShortfall > 0
            ? (reqShortfall / totalShortfall) * item.quantity
            : item.quantity / item.requirementIds.length; // Fallback to equal split

        await tx.requirement_po_links.create({
          data: {
            requirementId: reqId,
            purchaseOrderId: po.id,
            purchaseOrderItemId: poItem.id,
            allocatedQuantity: allocatedQty,
          },
        });

        // P1.6: Status already flipped by the bulk updateMany above (guarded double-order race fix)
        linkedCount++;
      }
    }

    // ========================================================================
    // MRP-12: carry the UNCOVERED remainder forward as a split requirement.
    //
    // A purchase order may deliberately cover only part of a requirement — split across two
    // suppliers, or staged against cash flow. Until now the requirement flipped wholesale to
    // PO_GENERATED regardless of how much was actually ordered, and the duplicate-prevention
    // guard then excluded it from ever receiving a second PO. The uncovered balance silently
    // vanished from the plan. (This became reachable in practice once MRP-47 made the dialog's
    // quantity edits actually take effect.)
    //
    // The schema already anticipated this: material_requirements.splitFromId, self-relation
    // "mrp_split". The parent keeps what was ordered; a child row carries the balance and stays
    // orderable.
    // ========================================================================
    const splitRemainders: string[] = [];
    for (const req of requirements) {
      const allocatedToThisReq = await tx.requirement_po_links.aggregate({
        where: { requirementId: req.id, purchase_orders: { status: { notIn: ['CANCELLED'] } } },
        _sum: { allocatedQuantity: true },
      });
      const covered = Number(allocatedToThisReq._sum.allocatedQuantity ?? 0);
      const needed = Number(req.shortfall);
      const remainder = toNumber(subtractCurrency(needed, covered));

      // Ignore rounding dust from proportional allocation — only a materially uncovered
      // balance is worth carrying forward. 0.01 matches the 2dp allocation precision
      // (0.001 minted phantom sub-centimetre requirements).
      if (remainder <= 0.01) continue;

      const childNumber = await generateRequirementNumber(tx);
      const child = await tx.material_requirements.create({
        data: {
          requirementNumber: childNumber,
          source: req.source,
          orderId: req.orderId,
          orderItemId: req.orderItemId,
          materialId: req.materialId,
          orderBomId: req.orderBomId,
          orderBomItemId: req.orderBomItemId,
          orderQuantity: req.orderQuantity,
          quantityPerUnit: req.quantityPerUnit,
          wastagePercent: req.wastagePercent,
          // The child represents only the balance: nothing of it is covered by stock (the parent
          // already absorbed the stock allocation) and nothing of it is on a PO yet.
          totalRequired: remainder,
          unit: req.unit,
          availableStock: 0,
          allocatedFromStock: 0,
          shortfall: remainder,
          preferredSupplierId: req.preferredSupplierId,
          status: MaterialRequirementStatus.PO_REQUIRED,
          fabricWidth: req.fabricWidth,
          cadId: req.cadId,
          requirementType: req.requirementType,
          processorId: req.processorId,
          processingCost: req.processingCost,
          printingType: req.printingType,
          // The JWO split path copies these; this PO path silently dropped them, so a
          // PROCESSING child lost BOTH shrinkage fallbacks (own snapshot + linked greige)
          // and resolveProcessingShrinkagePercent landed on 0%.
          linkedRequirementId: req.linkedRequirementId,
          shrinkagePercentUsed: req.shrinkagePercentUsed,
          shrinkageSource: req.shrinkageSource,
          colorName: req.colorName,
          componentName: req.componentName,
          requiredDate: req.requiredDate,
          createdById: userId,
          unitPrice: req.unitPrice,
          rateSource: req.rateSource,
          splitFromId: req.id,
        },
        select: { id: true, requirementNumber: true },
      });

      // The parent now represents only what was actually ordered, so its shortfall is closed.
      await tx.material_requirements.update({
        where: { id: req.id },
        data: { shortfall: covered },
      });

      splitRemainders.push(`${req.requirementNumber} → ${child.requirementNumber} (${remainder} ${req.unit})`);
    }
    if (splitRemainders.length > 0) {
      logWarn(
        `[MRP] PO ${po.poNumber} covers less than the full requirement for ${splitRemainders.length} line(s); ` +
          `the balance remains orderable as: ${splitRemainders.join('; ')}`
      );
    }

    // MRP-44: the PROCESSING-PO bridge that used to sit here (a JWO carrying poId, from the
    // pre-consolidation design) was dead code — PROCESSING selections return from the JWO-only
    // branch far above and can never reach this point, and mixed selections are now rejected
    // outright (MRP-04). It was left as a re-entry hazard: relaxing the `every()` gate would
    // have silently resurrected PROCESSING-on-a-PO. Deleted; the JWO-only branch is the single
    // path for dyeing/printing.
    return { po, linkedCount, itemCount: itemsWithGst.length };
  });

  return {
    purchaseOrder: {
      id: result.po.id,
      poNumber: result.po.poNumber,
      totalAmount: Number(result.po.totalAmount || 0),
    },
    linkedRequirements: result.linkedCount,
    totalItems: result.itemCount,
  };
}

/**
 * Link a requirement to an existing PO item
 */
export async function linkRequirementToPO(
  data: LinkRequirementToPORequest,
  userId: string
): Promise<MaterialRequirementResponse> {
  const { requirementId, purchaseOrderId, purchaseOrderItemId, allocatedQuantity } = data;

  // Verify requirement exists
  const requirement = await prisma.material_requirements.findUnique({
    where: { id: requirementId },
  });

  if (!requirement) {
    throw new Error(`Requirement ${requirementId} not found`);
  }

  // Reject requirements already covered by a PO (bug-hunt procurement-16: linking blindly
  // force-set PO_GENERATED and allowed double-procurement of the same requirement)
  const coveredStatuses: MaterialRequirementStatus[] = [
    MaterialRequirementStatus.PO_GENERATED,
    MaterialRequirementStatus.PO_SENT,
    MaterialRequirementStatus.PARTIALLY_RECEIVED,
    MaterialRequirementStatus.RECEIVED,
  ];
  if (coveredStatuses.includes(requirement.status)) {
    throw new Error(`Requirement ${requirementId} is already ${requirement.status} — it is covered by an existing PO`);
  }

  // Link + status flip atomically; the guarded updateMany re-checks status INSIDE the tx so a
  // concurrent link cannot double-cover the requirement
  const updated = await prisma.$transaction(async (tx) => {
    await tx.requirement_po_links.create({
      data: {
        requirementId,
        purchaseOrderId,
        purchaseOrderItemId,
        allocatedQuantity,
      },
    });

    const flip = await tx.material_requirements.updateMany({
      where: { id: requirementId, status: { notIn: coveredStatuses } },
      data: { status: MaterialRequirementStatus.PO_GENERATED },
    });
    if (flip.count === 0) {
      throw new Error(`Requirement ${requirementId} was already covered by another PO`);
    }

    return tx.material_requirements.findUnique({
      where: { id: requirementId },
      include: getRequirementIncludes(),
    });
  });

  return mapToResponse(updated!);
}

/**
 * Update requirement status
 */
export async function updateRequirementStatus(
  id: string,
  status: MaterialRequirementStatus,
  userId: string,
  userRole?: string
): Promise<MaterialRequirementResponse> {
  // MRP-24: this was a raw `update({ data: { status } })` with no read of the current value — the
  // endpoint could walk a RECEIVED requirement back to PO_REQUIRED and make already-delivered
  // material re-orderable. Route it through the shared state machine like every other document.
  const current = await prisma.material_requirements.findUnique({
    where: { id },
    select: { status: true, requirementNumber: true },
  });
  if (!current) {
    throw new Error(`Requirement ${id} not found`);
  }

  const transition = validateTransition('materialRequirement', current.status, status, userRole);
  if (!transition.valid) {
    throw new Error(transition.message || `Cannot change status from ${current.status} to ${status}`);
  }
  if (transition.isAdminOverride) {
    logWarn(
      `[MRP] ADMIN OVERRIDE: requirement ${current.requirementNumber} forced ${current.status} → ${status} by user ${userId}`
    );
  }

  const updated = await prisma.material_requirements.update({
    where: { id },
    data: { status },
    include: getRequirementIncludes(),
  });

  return mapToResponse(updated);
}

/**
 * Cancel a requirement
 */
export async function cancelRequirement(id: string, userId: string): Promise<MaterialRequirementResponse> {
  // MRP-24: refuse to cancel something that has already been received, or that still carries a
  // live PO/JWO — cancelling those silently detaches real goods and real commitments from the plan.
  const current = await prisma.material_requirements.findUnique({
    where: { id },
    select: {
      status: true,
      requirementNumber: true,
      requirement_po_links: {
        where: { purchase_orders: { status: { notIn: ['CANCELLED'] } } },
        select: { id: true },
      },
      requirement_jwo_links: { select: { id: true } },
    },
  });
  if (!current) {
    throw new Error(`Requirement ${id} not found`);
  }
  if (current.status === MaterialRequirementStatus.RECEIVED) {
    throw new Error(`Cannot cancel ${current.requirementNumber}: it has already been received.`);
  }
  if (current.requirement_po_links.length > 0 || current.requirement_jwo_links.length > 0) {
    throw new Error(
      `Cannot cancel ${current.requirementNumber}: it is linked to an active purchase order or job work order. ` +
        `Cancel that document first.`
    );
  }

  const updated = await prisma.material_requirements.update({
    where: { id },
    data: { status: MaterialRequirementStatus.CANCELLED },
    include: getRequirementIncludes(),
  });

  return mapToResponse(updated);
}

/**
 * Update received quantity from GRN.
 * Called when a GRN is created/updated to update the requirement status.
 *
 * P1.5 fixes:
 * - Atomic { increment } instead of read-modify-write (kills race condition)
 * - Aggregate across ALL links of the requirement before deciding status
 * - PARTIALLY_RECEIVED when totalReceived > 0 but < totalAllocated
 * - Downgrade to PO_SENT when totalReceived becomes 0 (e.g., after full reversal)
 */
export async function updateReceivedQuantity(
  purchaseOrderItemId: string,
  receivedQuantity: number,
  tx?: any
): Promise<void> {
  // Use the caller's transaction when supplied (e.g. GRN approval) so these MRP updates commit/roll back
  // with the receipt — otherwise MRP can miss a committed receipt and raise a duplicate PO (bug-hunt F4 #12).
  const client = tx || prisma;

  // Find all links to this PO item.
  // orderBy is load-bearing: the pro-rata remainder lands on the LAST link, and it must be the same
  // link for a receipt and for its reversal — Postgres guarantees no ordering without it.
  const links = await client.requirement_po_links.findMany({
    where: { purchaseOrderItemId },
    select: { id: true, requirementId: true, allocatedQuantity: true },
    orderBy: { id: 'asc' },
  });

  // The receipt is one number against the PO item; each link gets its allocated share, never the full
  // amount (crediting the full receipt to every link declared small requirements RECEIVED early).
  const shares = splitReceiptAcrossLinks(links, receivedQuantity);
  const shareByLinkId = new Map(shares.map((s) => [s.id, s.qty]));

  // Track which requirements we've updated (avoid updating the same requirement multiple times
  // if it has multiple links to the same PO item — shouldn't happen but belt-and-suspenders)
  const updatedRequirementIds = new Set<string>();

  for (const link of links) {
    // P1.5: Atomic increment — kills read-modify-write race condition
    await client.requirement_po_links.update({
      where: { id: link.id },
      data: {
        receivedQuantity: {
          increment: shareByLinkId.get(link.id) ?? 0,
        },
      },
    });

    // Skip if we already updated this requirement's status
    if (updatedRequirementIds.has(link.requirementId)) {
      continue;
    }
    updatedRequirementIds.add(link.requirementId);

    // P1.5: Aggregate across ALL links of this requirement to determine true status
    const allLinks = await client.requirement_po_links.findMany({
      where: { requirementId: link.requirementId },
      select: {
        allocatedQuantity: true,
        receivedQuantity: true,
      },
    });

    const totalAllocated = allLinks.reduce(
      (sum: number, l: { allocatedQuantity: any }) => sum + Number(l.allocatedQuantity),
      0
    );
    const totalReceived = allLinks.reduce(
      (sum: number, l: { receivedQuantity: any }) => sum + Number(l.receivedQuantity),
      0
    );

    // P1.5: Determine correct status based on aggregated quantities
    let newStatus: MaterialRequirementStatus;
    // Tolerance, not a bare >=: independent per-receipt rounding can leave a link a millimetre
    // short across successive partials, which would strand a fully-received requirement.
    if (totalReceived >= totalAllocated - RECEIPT_COMPLETE_TOLERANCE) {
      newStatus = MaterialRequirementStatus.RECEIVED;
    } else if (totalReceived > 0) {
      newStatus = MaterialRequirementStatus.PARTIALLY_RECEIVED;
    } else {
      // P1.5: Zero received (after reversal) → downgrade to PO_SENT
      // (The PO was sent; we just haven't received anything yet)
      newStatus = MaterialRequirementStatus.PO_SENT;
    }

    await client.material_requirements.update({
      where: { id: link.requirementId },
      data: { status: newStatus },
    });
  }
}

/**
 * Phase 4b: JWO-keyed mirror of updateReceivedQuantity — advances MRP requirements
 * through requirement_jwo_links when a PO-less JWO GRN is approved/reversed.
 * Same semantics: atomic increment, aggregate across all JWO links of the requirement,
 * RECEIVED / PARTIALLY_RECEIVED / PO_SENT by totals.
 */
export async function updateJwoReceivedQuantity(
  jobWorkOrderId: string,
  receivedQuantity: number,
  tx?: any
): Promise<void> {
  const client = tx || prisma;

  // orderBy is load-bearing: the pro-rata remainder lands on the LAST link, and it must be the same
  // link for a receipt and for its reversal — Postgres guarantees no ordering without it.
  const links = await client.requirement_jwo_links.findMany({
    where: { jobWorkOrderId },
    select: { id: true, requirementId: true, allocatedQuantity: true },
    orderBy: { id: 'asc' },
  });

  // The receipt is one number against the JWO; each link gets its allocated share, never the full
  // amount (DJ-EBEW-003-001: 4,000 m credited to both links flipped the 1,099.92 requirement to
  // RECEIVED and dropped it out of the shortfall).
  const shares = splitReceiptAcrossLinks(links, receivedQuantity);
  const shareByLinkId = new Map(shares.map((s) => [s.id, s.qty]));

  const updatedRequirementIds = new Set<string>();

  for (const link of links) {
    await client.requirement_jwo_links.update({
      where: { id: link.id },
      data: { receivedQuantity: { increment: shareByLinkId.get(link.id) ?? 0 } },
    });

    if (updatedRequirementIds.has(link.requirementId)) continue;
    updatedRequirementIds.add(link.requirementId);

    const allLinks = await client.requirement_jwo_links.findMany({
      where: { requirementId: link.requirementId },
      select: { allocatedQuantity: true, receivedQuantity: true },
    });

    const totalAllocated = allLinks.reduce(
      (sum: number, l: { allocatedQuantity: any }) => sum + Number(l.allocatedQuantity),
      0
    );
    const totalReceived = allLinks.reduce(
      (sum: number, l: { receivedQuantity: any }) => sum + Number(l.receivedQuantity),
      0
    );

    let newStatus: MaterialRequirementStatus;
    // Tolerance, not a bare >=: independent per-receipt rounding can leave a link a millimetre
    // short across successive partials, which would strand a fully-received requirement.
    if (totalReceived >= totalAllocated - RECEIPT_COMPLETE_TOLERANCE) {
      newStatus = MaterialRequirementStatus.RECEIVED;
    } else if (totalReceived > 0) {
      newStatus = MaterialRequirementStatus.PARTIALLY_RECEIVED;
    } else {
      newStatus = MaterialRequirementStatus.PO_SENT;
    }

    await client.material_requirements.update({
      where: { id: link.requirementId },
      data: { status: newStatus },
    });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getRequirementIncludes() {
  return {
    orders: {
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        customers: { select: { name: true } },
      },
    },
    order_items: {
      select: {
        id: true,
        styleId: true,
        totalQuantity: true,
        styles: { select: { styleCode: true, buyerStyleRef: true, styleName: true } },
      },
    },
    materials: {
      select: {
        id: true,
        code: true,
        name: true,
        materialType: true,
        fabricId: true,
      },
    },
    preferredSupplier: {
      select: {
        id: true,
        code: true,
        name: true,
      },
    },
    processor: {
      select: {
        id: true,
        code: true,
        name: true,
      },
    },
    createdBy: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    },
    requirement_po_links: {
      include: {
        purchase_orders: {
          select: {
            id: true,
            poNumber: true,
            status: true,
            supplierId: true,
          },
        },
        purchase_order_items: {
          select: {
            id: true,
            orderedQuantity: true,
            receivedQuantity: true,
            unitPrice: true,
          },
        },
      },
    },
    orderBom: {
      select: { id: true, version: true },
    },
    requirement_jwo_links: {
      include: {
        job_work_orders: {
          select: {
            id: true,
            jobWorkNumber: true,
            status: true,
            jwoStatus: true,
          },
        },
      },
    },
    linkedRequirement: {
      select: {
        id: true,
        requirementNumber: true,
        requirementType: true,
        status: true,
        totalRequired: true,
        // Billing basis: legacy PROCESSING rows have NULL own-shrinkage; the linked
        // GREIGE requirement carries the % used to inflate fabric → greige.
        shrinkagePercentUsed: true,
        materials: { select: { id: true, code: true, name: true } },
      },
    },
    // Billing basis fallback (rate card is the authority when no snapshot exists)
    orderBomItem: { select: { rateCard: { select: { shrinkagePercent: true } } } },
  };
}

function mapToResponse(req: any): MaterialRequirementResponse {
  // Billing basis (2026-08-17): PROCESSING quantities are stored greige-basis (what to
  // issue), but the processor bills for the fabric he returns — expose both bases.
  const processingShrinkage = req.requirementType === 'PROCESSING' ? resolveProcessingShrinkagePercent(req) : null;
  return {
    id: req.id,
    requirementNumber: req.requirementNumber,
    source: req.source,
    orderId: req.orderId,
    orderItemId: req.orderItemId,
    materialId: req.materialId,
    orderBomId: req.orderBomId,
    orderQuantity: req.orderQuantity,
    quantityPerUnit: Number(req.quantityPerUnit),
    wastagePercent: Number(req.wastagePercent),
    totalRequired: Number(req.totalRequired),
    unit: req.unit,
    availableStock: Number(req.availableStock),
    allocatedFromStock: Number(req.allocatedFromStock),
    shortfall: Number(req.shortfall),
    preferredSupplierId: req.preferredSupplierId,
    requirementType: req.requirementType || 'MATERIAL',
    processorId: req.processorId || null,
    processingCost: req.processingCost ? Number(req.processingCost) : null,
    printingType: req.printingType || null,
    linkedRequirementId: req.linkedRequirementId || null,
    // MRP-12: set when this row is the uncovered balance of a partially-ordered requirement.
    // Without it a split remainder looks like an unexplained duplicate in the list.
    splitFromId: req.splitFromId || null,
    // MRP-48f: so the UI can show whether the quantity rests on the processor's committed
    // shrinkage or on a fallback average.
    shrinkagePercentUsed: req.shrinkagePercentUsed != null ? Number(req.shrinkagePercentUsed) : null,
    shrinkageSource: req.shrinkageSource || null,
    // Billing basis — PROCESSING rows only: the fabric-out qty the processor bills for
    // (primary display) vs the greige-basis totalRequired he is issued (secondary info).
    effectiveShrinkagePercent: processingShrinkage,
    billableQuantity:
      processingShrinkage != null ? processingBillableQty(Number(req.totalRequired), processingShrinkage) : null,
    greigeIssueQty: processingShrinkage != null ? Number(req.totalRequired) : null,
    colorName: req.colorName || null,
    componentName: req.componentName || null,
    fabricWidth: req.fabricWidth ? Number(req.fabricWidth) : null,

    // P5.3 Provenance fields
    unitPrice: req.unitPrice ? Number(req.unitPrice) : null,
    rateSource: req.rateSource || null,
    orderBomItemId: req.orderBomItemId || null,

    status: req.status,
    requiredDate: req.requiredDate.toISOString(),
    calculatedAt: req.calculatedAt.toISOString(),
    createdById: req.createdById,
    createdAt: req.createdAt.toISOString(),
    updatedAt: req.updatedAt.toISOString(),
    order: req.orders
      ? {
          id: req.orders.id,
          orderNumber: req.orders.orderNumber,
          customerId: req.orders.customerId,
          customerName: req.orders.customers?.name,
        }
      : null,
    orderItem: req.order_items
      ? {
          id: req.order_items.id,
          styleId: req.order_items.styleId,
          styleCode: req.order_items.styles?.styleCode,
          buyerStyleRef: req.order_items.styles?.buyerStyleRef ?? null,
          styleName: req.order_items.styles?.styleName,
          totalQuantity: req.order_items.totalQuantity,
        }
      : null,
    material: req.materials
      ? {
          id: req.materials.id,
          code: req.materials.code,
          name: req.materials.name,
          materialType: req.materials.materialType,
          fabricId: req.materials.fabricId ?? null,
        }
      : undefined,
    preferredSupplier: req.preferredSupplier
      ? {
          id: req.preferredSupplier.id,
          code: req.preferredSupplier.code,
          name: req.preferredSupplier.name,
        }
      : null,
    processor: req.processor
      ? {
          id: req.processor.id,
          code: req.processor.code,
          name: req.processor.name,
        }
      : null,
    createdBy: req.createdBy
      ? {
          id: req.createdBy.id,
          firstName: req.createdBy.firstName,
          lastName: req.createdBy.lastName,
        }
      : undefined,
    poLinks: req.requirement_po_links?.map((link: any) => ({
      id: link.id,
      requirementId: link.requirementId,
      purchaseOrderId: link.purchaseOrderId,
      purchaseOrderItemId: link.purchaseOrderItemId,
      allocatedQuantity: Number(link.allocatedQuantity),
      receivedQuantity: Number(link.receivedQuantity),
      createdAt: link.createdAt.toISOString(),
      purchaseOrder: link.purchase_orders
        ? {
            id: link.purchase_orders.id,
            poNumber: link.purchase_orders.poNumber,
            status: link.purchase_orders.status,
            supplierId: link.purchase_orders.supplierId,
          }
        : undefined,
      purchaseOrderItem: link.purchase_order_items
        ? {
            id: link.purchase_order_items.id,
            orderedQuantity: Number(link.purchase_order_items.orderedQuantity),
            receivedQuantity: Number(link.purchase_order_items.receivedQuantity),
            unitPrice: Number(link.purchase_order_items.unitPrice),
          }
        : undefined,
    })),
    jwoLinks: req.requirement_jwo_links?.map((link: any) => ({
      id: link.id,
      requirementId: link.requirementId,
      jobWorkOrderId: link.jobWorkOrderId,
      allocatedQuantity: Number(link.allocatedQuantity),
      receivedQuantity: Number(link.receivedQuantity),
      createdAt: link.createdAt.toISOString(),
      jobWorkOrder: link.job_work_orders
        ? {
            id: link.job_work_orders.id,
            jobWorkNumber: link.job_work_orders.jobWorkNumber,
            jwoStatus: link.job_work_orders.jwoStatus,
          }
        : undefined,
    })),
    orderBom: req.orderBom ? { id: req.orderBom.id, version: req.orderBom.version } : null,
    linkedRequirement: req.linkedRequirement
      ? {
          id: req.linkedRequirement.id,
          requirementNumber: req.linkedRequirement.requirementNumber,
          requirementType: req.linkedRequirement.requirementType,
          status: req.linkedRequirement.status,
          totalRequired: Number(req.linkedRequirement.totalRequired),
          material: req.linkedRequirement.materials
            ? {
                id: req.linkedRequirement.materials.id,
                code: req.linkedRequirement.materials.code,
                name: req.linkedRequirement.materials.name,
              }
            : undefined,
        }
      : null,
  };
}

/**
 * Group requirements by supplier for bulk PO generation
 * Returns requirements organized by their preferred supplier
 */
export async function groupRequirementsBySupplier(requirementIds: string[]): Promise<{
  groups: Map<string, MaterialRequirementResponse[]>;
  unassigned: MaterialRequirementResponse[];
  summary: {
    totalRequirements: number;
    totalSuppliers: number;
    unassignedCount: number;
  };
}> {
  console.log('[MRP] Grouping requirements by supplier', { count: requirementIds.length });

  // Get all requirements with supplier info
  const requirements = await prisma.material_requirements.findMany({
    where: {
      id: { in: requirementIds },
      status: { in: [MaterialRequirementStatus.PO_REQUIRED, MaterialRequirementStatus.PARTIAL_STOCK] },
    },
    include: getRequirementIncludes(),
  });

  if (requirements.length === 0) {
    return {
      groups: new Map(),
      unassigned: [],
      summary: {
        totalRequirements: 0,
        totalSuppliers: 0,
        unassignedCount: 0,
      },
    };
  }

  // Group by preferred supplier
  const groups = new Map<string, MaterialRequirementResponse[]>();
  const unassigned: MaterialRequirementResponse[] = [];

  // MRP-04 (defence in depth): a PROCESSING requirement's preferredSupplierId IS its processor,
  // so a processor who also supplies greige would land both types in one supplier group. The UI
  // cannot select across types (each tab queries a single requirementType) and
  // generatePOFromRequirements now hard-rejects a mixed set, but surface it here too — this is
  // the only place the mixing would otherwise be silent.
  const mixedTypeSuppliers = new Map<string, Set<string>>();
  for (const req of requirements) {
    if (!req.preferredSupplierId) continue;
    const seen = mixedTypeSuppliers.get(req.preferredSupplierId) ?? new Set<string>();
    seen.add(req.requirementType);
    mixedTypeSuppliers.set(req.preferredSupplierId, seen);
  }
  for (const [supplierId, types] of mixedTypeSuppliers) {
    if (types.size > 1) {
      logWarn(
        `[MRP] Supplier ${supplierId} has mixed requirement types in one bulk group (${[...types].join(' + ')}) — ` +
          `PO generation will reject this group. Generate PROCESSING (Job Work) and MATERIAL separately.`
      );
    }
  }

  for (const req of requirements) {
    const mapped = mapToResponse(req);

    if (req.preferredSupplierId) {
      const existing = groups.get(req.preferredSupplierId);
      if (existing) {
        existing.push(mapped);
      } else {
        groups.set(req.preferredSupplierId, [mapped]);
      }
    } else {
      unassigned.push(mapped);
    }
  }

  console.log('[MRP] Requirements grouped', {
    totalRequirements: requirements.length,
    totalSuppliers: groups.size,
    unassignedCount: unassigned.length,
  });

  return {
    groups,
    unassigned,
    summary: {
      totalRequirements: requirements.length,
      totalSuppliers: groups.size,
      unassignedCount: unassigned.length,
    },
  };
}

/**
 * Generate multiple Purchase Orders from grouped requirements
 * Creates one PO per supplier in a single transaction
 */
export async function generatePOsBySupplier(
  groups: Array<{
    supplierId: string;
    requirementIds: string[];
    expectedDeliveryDate: string;
    remarks?: string;
    itemPrices?: Record<string, number>;
    itemQuantities?: Record<string, number>;
  }>,
  userId: string
): Promise<{
  purchaseOrders: Array<{ id: string; poNumber: string; supplierId: string; totalAmount: number }>;
  totalPOs: number;
  /** PROCESSING groups create Job Work Orders — listed separately so the UI can say so. */
  jobWorkOrders: Array<{ id: string; jobWorkNumber: string; supplierId: string; totalAmount: number }>;
  totalJwos: number;
  totalRequirements: number;
  errors: Array<{ supplierId: string; error: string }>;
}> {
  console.log('[MRP] Generating multiple POs from requirements', { groupCount: groups.length });

  const purchaseOrders: Array<{ id: string; poNumber: string; supplierId: string; totalAmount: number }> = [];
  const jobWorkOrders: Array<{ id: string; jobWorkNumber: string; supplierId: string; totalAmount: number }> = [];
  const errors: Array<{ supplierId: string; error: string }> = [];
  let totalRequirements = 0;

  // Process each supplier group
  for (const group of groups) {
    try {
      // Validate supplier exists
      const supplier = await prisma.suppliers.findUnique({
        where: { id: group.supplierId },
      });

      if (!supplier || !supplier.isActive) {
        errors.push({
          supplierId: group.supplierId,
          error: 'Supplier not found or inactive',
        });
        continue;
      }

      // Generate PO for this supplier's requirements
      const result = await generatePOFromRequirements(
        {
          requirementIds: group.requirementIds,
          supplierId: group.supplierId,
          expectedDeliveryDate: group.expectedDeliveryDate,
          remarks: group.remarks,
          consolidate: true,
          itemPrices: group.itemPrices,
          itemQuantities: group.itemQuantities,
        },
        userId
      );

      // Phase 4c: PROCESSING groups return a Job Work Order instead of a PO. JWOs get
      // their own list + count (no more flattening into purchaseOrders as "JWO <n>"),
      // so the UI reports "job work" rather than "purchase order". The dialog is updated
      // in the same release to read totalJwos.
      if (result.jobWorkOrder) {
        jobWorkOrders.push({
          id: result.jobWorkOrder.id,
          jobWorkNumber: result.jobWorkOrder.jobWorkNumber,
          supplierId: group.supplierId,
          totalAmount: result.jobWorkOrder.totalAmount ?? 0,
        });
      }
      if (result.purchaseOrder) {
        purchaseOrders.push({
          id: result.purchaseOrder.id,
          poNumber: result.purchaseOrder.poNumber,
          supplierId: group.supplierId,
          totalAmount: result.purchaseOrder.totalAmount ?? 0,
        });
      }

      totalRequirements += result.linkedRequirements;

      console.log('[MRP] Document generated for supplier', {
        supplierId: group.supplierId,
        document: result.purchaseOrder?.poNumber ?? result.jobWorkNumber,
        requirements: result.linkedRequirements,
      });
    } catch (error) {
      logger.error('[MRP] Failed to generate PO for supplier', { supplierId: group.supplierId, error });
      errors.push({
        supplierId: group.supplierId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  console.log('[MRP] Bulk PO generation complete', {
    totalPOs: purchaseOrders.length,
    totalJwos: jobWorkOrders.length,
    totalRequirements,
    errors: errors.length,
  });

  return {
    purchaseOrders,
    totalPOs: purchaseOrders.length,
    jobWorkOrders,
    totalJwos: jobWorkOrders.length,
    totalRequirements,
    errors,
  };
}

/**
 * Validate requirements for bulk PO generation
 * Checks that all requirements have suppliers assigned
 */
export async function validateBulkPOGeneration(requirementIds: string[]): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
  requirementsWithoutSupplier: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const requirementsWithoutSupplier: string[] = [];

  // Get all requirements
  const requirements = await prisma.material_requirements.findMany({
    where: { id: { in: requirementIds } },
    select: {
      id: true,
      requirementNumber: true,
      preferredSupplierId: true,
      status: true,
      shortfall: true,
    },
  });

  if (requirements.length === 0) {
    errors.push('No requirements found');
    return { valid: false, errors, warnings, requirementsWithoutSupplier };
  }

  if (requirements.length < requirementIds.length) {
    warnings.push(`${requirementIds.length - requirements.length} requirements not found`);
  }

  // Check each requirement
  for (const req of requirements) {
    // Check status
    if (
      req.status !== MaterialRequirementStatus.PO_REQUIRED &&
      req.status !== MaterialRequirementStatus.PARTIAL_STOCK
    ) {
      warnings.push(`Requirement ${req.requirementNumber} has status ${req.status} (not eligible for PO)`);
      continue;
    }

    // Check shortfall
    if (Number(req.shortfall) <= 0) {
      warnings.push(`Requirement ${req.requirementNumber} has no shortfall`);
      continue;
    }

    // Check supplier
    if (!req.preferredSupplierId) {
      requirementsWithoutSupplier.push(req.id);
      errors.push(`Requirement ${req.requirementNumber} has no supplier assigned`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    requirementsWithoutSupplier,
  };
}

/**
 * Convert a MATERIAL requirement to GREIGE + PROCESSING requirements
 * Used when READY_FABRIC has a shortfall and user wants to process greige instead
 */
export async function convertToGreigeProcessing(
  requirementId: string,
  data: { processorId: string; greigeId: string; processingCost?: number; greigeCost?: number },
  userId: string
): Promise<{ greigeRequirement: any; processingRequirement: any; fabricProcessingId?: string }> {
  // 1. Find the existing MATERIAL requirement
  const requirement = await prisma.material_requirements.findUnique({
    where: { id: requirementId },
    include: { materials: true },
  });
  if (!requirement) throw new Error('Requirement not found');
  if (requirement.requirementType !== 'MATERIAL') throw new Error('Can only convert MATERIAL requirements');

  const shortfallQty = Number(requirement.shortfall);
  if (shortfallQty <= 0) throw new Error('Requirement has no shortfall to convert');

  // 2. Look up or auto-create greige material + get shrinkage percent
  let greigeMaterialId: string;
  const greigeMaterial = await prisma.materials.findFirst({ where: { greigeId: data.greigeId } });
  if (greigeMaterial) {
    greigeMaterialId = greigeMaterial.id;
  } else {
    const created = await ensureMaterialForGreige(data.greigeId);
    if (!created) throw new Error('Cannot resolve greige material');
    greigeMaterialId = created.id;
  }

  // MRP-48: same authority as the main calculation — the processor the user just picked in this
  // dialog decides the shrinkage, via their rate card for this greige. The greige master average
  // is only the fallback when that processor has no card for it yet.
  // MRP-48e: use the SHARED resolver, not a local findFirst. This previously ordered by
  // effectiveFrom desc and took the newest card — so where a processor held several divergent
  // shrinkage values it silently picked one, which is the opposite of the main calculation's
  // refuse-and-fall-back rule. Two paths, two policies, same decision: now one.
  const { cards, distinctPercents, unambiguous } = await findRateCardsForShrinkage(data.processorId, data.greigeId);
  const greigeMaster = await prisma.greige_master.findUnique({
    where: { id: data.greigeId },
    select: { averageShrinkagePercent: true },
  });
  const shrinkagePercent = unambiguous
    ? unambiguous.shrinkagePercent
    : greigeMaster?.averageShrinkagePercent
      ? Number(greigeMaster.averageShrinkagePercent)
      : 0;
  if (!unambiguous) {
    logWarn(
      distinctPercents.length > 1
        ? `[MRP] convert-to-greige: processor ${data.processorId} holds ${distinctPercents.length} different ` +
            `shrinkage values for this greige (${cards.map((c) => `${c.processingType}${c.printingType ? '/' + c.printingType : ''}=${c.shrinkagePercent}%`).join(', ')}). ` +
            `Not guessing — using the greige master average (${shrinkagePercent}%).`
        : `[MRP] convert-to-greige: processor ${data.processorId} has no rate-card shrinkage for this greige — ` +
            `using the greige master average (${shrinkagePercent}%).`
    );
  }

  // P3: Apply shrinkage adjustment to shortfall using shared formula
  // Formula: orderQty = need ÷ (1 − shrinkage%/100)
  let greigeQtyNeeded = shortfallQty;
  if (shrinkagePercent > 0) {
    const greigeResult = calculateGreigeQuantity({
      need: shortfallQty,
      wastagePercent: 0, // Wastage already in the parent requirement's shortfall
      shrinkagePercent,
    });
    greigeQtyNeeded = greigeResult.quantity;
    for (const warn of greigeResult.warnings) {
      logger.warn(`[MRP convert-to-greige] ${warn}`);
    }
  }

  // 3. Check greige stock for the adjusted quantity
  // MRP-03/MRP-14: same netting rules as the main calculation — exclude reserved quantity and
  // greige held at a processor, so this dialog and the recalc agree on what is actually free.
  const greigeStockResult = await prisma.greige_stock.aggregate({
    where: { greigeId: data.greigeId, status: 'AVAILABLE', quantityAvailable: { gt: 0 }, processorId: null },
    _sum: { quantityAvailable: true, quantityReserved: true },
  });
  const greigeAvailable = netFreeStock(greigeStockResult._sum);

  const greigeAllocated = Math.min(greigeAvailable, greigeQtyNeeded);
  const greigeShortfall = greigeQtyNeeded - greigeAllocated;
  const greigeStatus =
    greigeShortfall === 0
      ? MaterialRequirementStatus.FULFILLED_STOCK
      : greigeAllocated > 0
        ? MaterialRequirementStatus.PARTIAL_STOCK
        : MaterialRequirementStatus.PO_REQUIRED;

  // MRP-25: steps 4-6 were three unrelated writes with no transaction. A failure between them
  // left the parent CONVERTED with shortfall 0 and no greige/processing rows to replace it —
  // the fabric silently stopped being planned at all. They are now atomic.
  const { greigeReq, procReq } = await prisma.$transaction(async (tx) => {
    // 4. Update original requirement — mark as CONVERTED (P3: truthful status)
    // The fabric requirement is not "fulfilled from stock" — it was converted to greige+processing
    await tx.material_requirements.update({
      where: { id: requirementId },
      data: {
        shortfall: 0,
        status: MaterialRequirementStatus.CONVERTED,
      },
    });

    // 5. Create GREIGE requirement with price snapshot (P1: rateSource='MANUAL' for user-initiated convert-to-greige)
    const greigeReqNumber = await generateRequirementNumber(tx);
    const greigeReq = await tx.material_requirements.create({
      data: {
        requirementNumber: greigeReqNumber,
        source: requirement.source,
        orderId: requirement.orderId,
        orderItemId: requirement.orderItemId,
        materialId: greigeMaterialId,
        orderBomId: requirement.orderBomId,
        orderQuantity: requirement.orderQuantity,
        quantityPerUnit: requirement.quantityPerUnit,
        wastagePercent: requirement.wastagePercent,
        totalRequired: greigeQtyNeeded, // P3: shrinkage-adjusted quantity
        unit: requirement.unit,
        availableStock: greigeAvailable,
        allocatedFromStock: greigeAllocated,
        shortfall: greigeShortfall,
        status: greigeStatus,
        requirementType: 'MATERIAL',
        processorId: data.processorId,
        processingCost: data.processingCost || null,
        requiredDate: requirement.requiredDate,
        linkedRequirementId: requirementId,
        createdById: userId,
        // P1 snapshot: user-provided greige cost, manual conversion
        unitPrice: data.greigeCost ?? null,
        rateSource: 'MANUAL',
        orderBomItemId: null, // No direct BOM item — manual conversion
      },
      include: getRequirementIncludes(),
    });

    // 6. Create PROCESSING requirement (linked to greige) with price snapshot
    const procReqNumber = await generateRequirementNumber(tx);
    const procReq = await tx.material_requirements.create({
      data: {
        requirementNumber: procReqNumber,
        source: requirement.source,
        orderId: requirement.orderId,
        orderItemId: requirement.orderItemId,
        materialId: greigeMaterialId,
        orderBomId: requirement.orderBomId,
        orderQuantity: requirement.orderQuantity,
        quantityPerUnit: requirement.quantityPerUnit,
        wastagePercent: requirement.wastagePercent,
        totalRequired: greigeQtyNeeded, // P3: same qty as greige (shrinkage-adjusted)
        unit: requirement.unit,
        availableStock: 0,
        allocatedFromStock: 0,
        shortfall: greigeQtyNeeded, // P3: shrinkage-adjusted
        status: MaterialRequirementStatus.PO_REQUIRED,
        requirementType: 'PROCESSING',
        preferredSupplierId: data.processorId,
        processorId: data.processorId,
        processingCost: data.processingCost || null,
        linkedRequirementId: greigeReq.id,
        requiredDate: requirement.requiredDate,
        createdById: userId,
        // P1 snapshot: user-provided processing cost, manual conversion
        unitPrice: data.processingCost ?? null,
        rateSource: 'MANUAL',
        orderBomItemId: null, // No direct BOM item — manual conversion
      },
      include: getRequirementIncludes(),
    });

    return { greigeReq, procReq };
  });

  // 7. Phase 5b: no fabric_processing shadow record — the PROCESSING requirement's
  // JWO (created at PO-generation time) is the tracking document end-to-end.
  return {
    greigeRequirement: mapToResponse(greigeReq),
    processingRequirement: mapToResponse(procReq),
  };
}

/**
 * Preview POs from requirements — returns price + GST breakdown without creating POs
 */
export async function previewPOsFromRequirements(request: POPreviewRequest): Promise<POPreviewGroup[]> {
  const groups: POPreviewGroup[] = [];

  for (const group of request.groups) {
    // MRP-05: itemPrices/itemQuantities are the review-step edits; they must shape the preview
    // totals the same way they shape the generated PO.
    const { supplierId, requirementIds, itemPrices, itemQuantities } = group;

    // Fetch supplier info with address
    const supplier = await prisma.suppliers.findUnique({
      where: { id: supplierId },
      select: {
        id: true,
        code: true,
        name: true,
        address: true,
        billingPincode: true,
        billing_city: { select: { cityName: true } },
        billing_state: { select: { stateName: true } },
      },
    });
    if (!supplier) continue;

    // Build supplier address string
    const supplierAddress = [
      supplier.address,
      supplier.billing_city?.cityName,
      supplier.billing_state?.stateName,
      supplier.billingPincode,
    ]
      .filter(Boolean)
      .join(', ');

    // Get supplier's primary GST number to determine state
    const supplierGst = await prisma.supplier_gst_numbers.findFirst({
      where: { supplierId, isPrimary: true },
      select: { stateCode: true, gstNumber: true },
    });
    // Fallback: try any GST number for this supplier
    const fallbackGst = supplierGst
      ? null
      : await prisma.supplier_gst_numbers.findFirst({
          where: { supplierId },
          select: { stateCode: true, gstNumber: true },
        });
    const supplierStateCode = supplierGst?.stateCode || fallbackGst?.stateCode || null;
    const supplierGstin = supplierGst?.gstNumber || fallbackGst?.gstNumber || null;

    const isInterstate = supplierStateCode ? supplierStateCode !== COMPANY_CONFIG.stateCode : false;

    // MRP-05: exclude requirements that already carry an active PO link — generatePOFromRequirements
    // drops them, so a preview that included them promised line items the created PO never had.
    const previewPOLinks = await prisma.requirement_po_links.findMany({
      where: {
        requirementId: { in: requirementIds },
        purchase_orders: { status: { notIn: ['CANCELLED'] } },
      },
      select: { requirementId: true },
    });
    const previewLinkedIds = new Set(previewPOLinks.map((l) => l.requirementId));
    const previewableIds = requirementIds.filter((id) => !previewLinkedIds.has(id));
    if (previewableIds.length === 0) continue;

    // Fetch requirements with materials, order, and style info for enriched PO preview
    const requirements = await prisma.material_requirements.findMany({
      where: {
        id: { in: previewableIds },
        status: { in: [MaterialRequirementStatus.PO_REQUIRED, MaterialRequirementStatus.PARTIAL_STOCK] },
      },
      include: {
        materials: true,
        orderBom: { select: { sourceCostSheetId: true } },
        orders: { select: { orderNumber: true } },
        order_items: {
          select: {
            styles: { select: { styleCode: true, buyerStyleRef: true, styleName: true } },
          },
        },
        // Billing basis for PROCESSING rows (same fallback chain as generation)
        orderBomItem: { select: { rateCard: { select: { shrinkagePercent: true } } } },
        linkedRequirement: { select: { shrinkagePercentUsed: true } },
      },
    });

    if (requirements.length === 0) continue;

    // Get supplier prices
    const materialIds = [...new Set(requirements.map((r) => r.materialId))];
    const supplierPrices = await prisma.material_suppliers.findMany({
      where: { materialId: { in: materialIds }, supplierId, isActive: true },
      select: { materialId: true, supplierPrice: true },
    });
    const priceMap = new Map(
      supplierPrices
        .filter((sp) => sp.supplierPrice && Number(sp.supplierPrice) > 0)
        .map((sp) => [sp.materialId, Number(sp.supplierPrice)])
    );

    // Resolve cost-sheet rates for FABRIC / GREIGE / PROCESSING materials
    const costSheetRateMap = new Map<string, number>();
    for (const req of requirements) {
      const costSheetId = (req as any).orderBom?.sourceCostSheetId ?? null;
      const fabricId = (req.materials as any)?.fabricId ?? null;
      const matType = req.materials?.materialType;

      // PROCESSING requirements: resolve from processor rate card or use stored processingCost
      if (req.requirementType === 'PROCESSING') {
        const groupKey = req.id; // Each PROCESSING req is a separate PO item
        try {
          const resolved = await resolveRate({
            poCategory: 'PROCESSING' as any,
            // MRP-06: price against the processor the document will be issued to (see the same
            // fix in generatePOFromRequirements) — otherwise the preview quotes one processor's
            // rate for a job that goes out in another's name.
            supplierId,
            printingType: req.printingType || undefined,
            materialId: req.materialId,
          });
          if (resolved.rate && resolved.rate > 0) {
            costSheetRateMap.set(groupKey, resolved.rate);
          } else if (req.processingCost) {
            costSheetRateMap.set(groupKey, Number(req.processingCost));
          }
        } catch {
          // Fallback to stored processingCost from MRP calculation
          if (req.processingCost) {
            costSheetRateMap.set(groupKey, Number(req.processingCost));
          }
        }
        continue;
      }

      // FABRIC / GREIGE materials: resolve from cost sheet rate (fallback for legacy requirements without snapshot).
      // P1 note: D3 (trims/lace/thread rates skipped) is fixed by snapshotPrice above.
      if (!costSheetId) continue;
      if (matType !== 'FABRIC' && matType !== 'GREIGE') continue;
      const poCategory = matType === 'GREIGE' ? 'GREIGE' : 'FABRIC';
      // P1.7: Pass greigeId for GREIGE materials (fabricId is null for them)
      const greigeId = (req.materials as any)?.greigeId ?? null;
      try {
        const resolved = await resolveRate({
          poCategory: poCategory as any,
          costSheetId,
          fabricId: fabricId ?? undefined,
          greigeId: greigeId ?? undefined,
          supplierId,
          materialId: req.materialId,
        });
        if (resolved.rate && resolved.rate > 0) {
          costSheetRateMap.set(req.materialId, resolved.rate);
        }
      } catch {
        // silently skip — supplier price will be used as fallback
      }
    }

    // Consolidate by material — PROCESSING requirements are NEVER merged (each is a separate job)
    const materialGroups = new Map<
      string,
      {
        materialId: string;
        quantity: number;
        unit: string;
        requirementIds: string[];
        material: any;
        // P1.3: price snapshot from first requirement in group
        snapshotPrice: number | null;
        rateSource: string | null;
        // Enriched fields for PO preview
        colorName: string | null;
        styleName: string | null;
        styleCode: string | null;
        buyerStyleRef: string | null;
        orderNumber: string | null;
        processingType: string | null;
        componentName: string | null;
        fabricWidth: number | null;
        // PROCESSING only: greige to physically issue + the shrinkage linking it to quantity
        greigeIssueQty: number | null;
        shrinkagePercent: number | null;
      }
    >();

    // Billing basis: PROCESSING preview quantities are FABRIC-out meters (what the
    // processor bills for), mirroring itemBaseQty in generatePOFromRequirements.
    const previewBaseQty = (req: (typeof requirements)[number]): number =>
      req.requirementType === 'PROCESSING'
        ? processingBillableQty(Number(req.shortfall), resolveProcessingShrinkagePercent(req as any))
        : Number(req.shortfall);

    for (const req of requirements) {
      // P1.4 D5: Use shared buildGroupKey for consistency with generatePOFromRequirements
      const groupKey = buildGroupKey(req);

      const existing = materialGroups.get(groupKey);
      if (existing) {
        existing.quantity += previewBaseQty(req);
        existing.requirementIds.push(req.id);
      } else {
        const isProcessing = req.requirementType === 'PROCESSING';
        const reqShrinkage = isProcessing ? resolveProcessingShrinkagePercent(req as any) : 0;
        materialGroups.set(groupKey, {
          materialId: req.materialId,
          quantity: previewBaseQty(req),
          unit: req.unit,
          requirementIds: [req.id],
          material: req.materials,
          greigeIssueQty: isProcessing ? Number(req.shortfall) : null,
          shrinkagePercent: isProcessing ? reqShrinkage : null,
          // P1.3: price snapshot from first requirement in group
          snapshotPrice: req.unitPrice ? Number(req.unitPrice) : null,
          rateSource: req.rateSource || null,
          // Enriched fields
          colorName: req.colorName || null,
          styleName: (req as any).order_items?.styles?.styleName || null,
          styleCode: (req as any).order_items?.styles?.styleCode || null,
          buyerStyleRef: (req as any).order_items?.styles?.buyerStyleRef ?? null,
          orderNumber: (req as any).orders?.orderNumber || null,
          processingType: req.printingType || (req.requirementType === 'PROCESSING' ? 'DYEING' : null),
          componentName: req.componentName || null,
          fabricWidth: req.fabricWidth ? Number(req.fabricWidth) : null,
        });
      }
    }

    // Build preview items
    const items: POPreviewItem[] = [];
    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let hasZeroPriceItems = false;

    for (const [groupKey, mg] of materialGroups) {
      const mat = mg.material;
      const matType = mat?.materialType || '';
      const isGreige = matType === 'GREIGE' || matType === 'GREIGE_LACE';
      // P1.3: Price priority = snapshot → live resolver fallback → supplier → 0
      const unitPrice =
        mg.snapshotPrice ??
        costSheetRateMap.get(groupKey) ??
        costSheetRateMap.get(mg.materialId) ??
        priceMap.get(mg.materialId) ??
        0;
      // Track rate source for frontend display (exception-only: show badge only when NOT ORDER_BOM)
      const effectiveRateSource = mg.snapshotPrice
        ? mg.rateSource
        : costSheetRateMap.has(groupKey) || costSheetRateMap.has(mg.materialId)
          ? 'COST_SHEET'
          : priceMap.has(mg.materialId)
            ? 'SUPPLIER_PRICE'
            : null;
      // MRP-05: honour the prices/quantities the user edited in the review step, exactly as
      // generatePOFromRequirements does (same groupKey-then-materialId lookup order). Without
      // this the preview showed resolved rates while the created PO used the edited ones.
      const effectiveUnitPrice = itemPrices?.[groupKey] ?? itemPrices?.[mg.materialId] ?? unitPrice;
      const effectiveQuantity = itemQuantities?.[groupKey] ?? itemQuantities?.[mg.materialId] ?? mg.quantity;

      const priceRequired = effectiveUnitPrice === 0;
      if (priceRequired) hasZeroPriceItems = true;

      const lineTotal = toNumber(multiplyCurrency(effectiveQuantity, effectiveUnitPrice));

      // MRP-05: the preview used to resolve the rate itself and hand-roll the split on raw floats
      // (`parseFloat(((lineTotal * rate)/100).toFixed(2))`), while generation called
      // gstService.calculateLineItemGST (decimal.js, HSN resolution chain, apparel price slab).
      // Two implementations of the same tax meant the totals you approved were not necessarily the
      // totals that got created. Preview now calls the same authority with the same arguments, so
      // the two agree by construction.
      const gst = await gstService.calculateLineItemGST({
        lineTotal,
        hsnSacCode: mat?.hsnCode || null,
        materialId: mg.materialId || null,
        isInterstate,
        unitPrice: effectiveUnitPrice,
      });
      const { gstRate, cgstRate, cgstAmount, sgstRate, sgstAmount, igstRate, igstAmount, taxAmount } = gst;

      items.push({
        materialId: mg.materialId,
        materialCode: mat?.code || '',
        materialName: mat?.name || '',
        materialType: matType,
        hsnCode: mat?.hsnCode || null,
        gstRate,
        quantity: effectiveQuantity,
        unit: mg.unit,
        unitPrice: effectiveUnitPrice,
        lineTotal,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate,
        igstAmount,
        taxAmount,
        totalWithTax: lineTotal + taxAmount,
        isGreige,
        priceRequired,
        requirementIds: mg.requirementIds,
        // P1.3/P1.4: groupKey for frontend edits; rateSource for exception-only badge
        groupKey,
        rateSource: effectiveRateSource,
        // Enriched fields for PO context
        colorName: mg.colorName,
        styleName: mg.styleName,
        styleCode: mg.styleCode,
        buyerStyleRef: mg.buyerStyleRef ?? null,
        orderNumber: mg.orderNumber,
        processingType: mg.processingType,
        componentName: mg.componentName,
        fabricWidth: mg.fabricWidth,
        // PROCESSING rows: greige to issue tracks the (possibly edited) billable qty
        greigeIssueQty:
          mg.greigeIssueQty != null
            ? toNumber(roundToCent(divideByShrinkage(effectiveQuantity, mg.shrinkagePercent ?? 0)))
            : null,
        shrinkagePercent: mg.shrinkagePercent,
      });

      // MRP-05: decimal accumulation of the already-rounded line amounts, matching how
      // gst.service.calculateTotals builds PO headers — float `+=` drifted paise against the
      // stored item rows.
      subtotal = toNumber(addCurrency(subtotal, lineTotal));
      totalCgst = toNumber(addCurrency(totalCgst, cgstAmount));
      totalSgst = toNumber(addCurrency(totalSgst, sgstAmount));
      totalIgst = toNumber(addCurrency(totalIgst, igstAmount));
    }

    const totalTax = toNumber(addCurrency(totalCgst, totalSgst, totalIgst));

    groups.push({
      supplierId,
      supplierName: supplier.name,
      supplierCode: supplier.code,
      supplierGstin,
      supplierAddress,
      isInterstate,
      supplierStateCode,
      items,
      subtotal: toNumber(roundToCent(subtotal)),
      totalCgst: toNumber(roundToCent(totalCgst)),
      totalSgst: toNumber(roundToCent(totalSgst)),
      totalIgst: toNumber(roundToCent(totalIgst)),
      totalTax: toNumber(roundToCent(totalTax)),
      grandTotal: toNumber(roundToCent(addCurrency(subtotal, totalTax))),
      hasZeroPriceItems,
    });
  }

  return groups;
}

export default {
  calculateRequirementsFromOrder,
  createManualRequirement,
  getRequirements,
  getRequirementById,
  getDistinctRequirementStyles,
  getOrderRequirementsSummary,
  getDashboardStats,
  allocateStock,
  generatePOFromRequirements,
  linkRequirementToPO,
  updateRequirementStatus,
  cancelRequirement,
  updateReceivedQuantity,
  updateJwoReceivedQuantity,
  groupRequirementsBySupplier,
  generatePOsBySupplier,
  validateBulkPOGeneration,
  convertToGreigeProcessing,
  previewPOsFromRequirements,
};
