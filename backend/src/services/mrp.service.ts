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
import { roundToCent, toCurrency, multiplyCurrency, toNumber } from '../utils/currency';
import { calculateGreigeQuantity } from '../utils/greige-quantity';
import prisma from '../config/database';
import { getDerivedOnHand } from './helpers/derived-stock.helper';
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
import logger, { logWarn } from '../utils/logger';
import { MASTER_CONFIG } from './helpers/master-config';
import { ensureMaterialRecord } from './helpers/material-sync.helper';

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
  const { orderId, orderItemId, requiredDate, checkStock = true } = input;

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
      orderBoms: {
        where: {
          isActive: true,
          status: 'APPROVED', // P3: Require approved BOM
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
              rateCard: { select: { printingType: true } },
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
  const activeBomIds = order.orderBoms.map((b) => b.id);
  if (activeBomIds.length > 0) {
    // First, find ALL requirements for this order that have active PO links (PO not cancelled)
    // BUG-ORD3 FIX: Query by orderId alone (not orderBomId) because:
    // 1. Manual requirements have null orderBomId
    // 2. The `in` filter doesn't match null values
    // 3. This caused requirements with PO links to be cancelled -> duplicate POs
    const linkedReqs = await prisma.requirement_po_links.findMany({
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

    // Cancel only requirements:
    // 1. Belonging to this order AND one of the active BOMs (or null orderBomId for manual reqs)
    // 2. NOT in terminal/PO-progression statuses
    // 3. NOT linked to active POs
    await prisma.material_requirements.updateMany({
      where: {
        orderId,
        // Include BOM-linked, manual (null orderBomId), AND stale (inactive/superseded BOM)
        // requirements for this order. Without the isActive:false branch, requirements from
        // deactivated BOMs linger as PO_REQUIRED and recalc creates duplicates next to them.
        OR: [{ orderBomId: { in: activeBomIds } }, { orderBomId: null }, { orderBom: { isActive: false } }],
        // Exclude terminal statuses AND PO-progression statuses
        status: { notIn: ['RECEIVED', 'CANCELLED', 'PO_GENERATED', 'PO_SENT', 'PARTIALLY_RECEIVED'] },
        // Also exclude any with active PO links (belt-and-suspenders)
        id: { notIn: poLinkedIds },
      },
      data: { status: 'CANCELLED' },
    });
  }

  const calculatedRequirements: CalculatedRequirement[] = [];

  // Process each order item
  for (const orderItem of order.order_items) {
    const style = orderItem.styles;
    // Find the active order BOM for this style
    const bom = order.orderBoms.find((b: any) => b.styleId === style.id);

    if (!bom) {
      console.warn(`No active BOM found for style ${style.styleCode}`);
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
            const mat = await prisma.materials.findFirst({
              where: { [lookup.field]: lookup.value },
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
      // Shrinkage comes from greige_master.averageShrinkagePercent (relation: greige)
      if ((hasGreigeProcessing || hasLandedGreige) && bomItem.greigeId) {
        const shrinkagePercent = bomItem.greige?.averageShrinkagePercent
          ? Number(bomItem.greige.averageShrinkagePercent)
          : 0;
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
            },
            _sum: { quantityAvailable: true },
          });
          const totalGreigeStock = Number(greigeStockResult._sum?.quantityAvailable || 0);

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
            _sum: { quantityAvailable: true },
          });
          const stockAtBomWidth = Number(fabricStockAtWidth._sum?.quantityAvailable || 0);

          // Also check stock at ANY width for this fabric (for split scenarios)
          const fabricStockAnyWidth = await prisma.fabric_stock.aggregate({
            where: {
              fabricId: bomItem.fabricId,
              status: 'AVAILABLE',
            },
            _sum: { quantityAvailable: true },
          });
          const totalFabricStock = Number(fabricStockAnyWidth._sum?.quantityAvailable || 0);

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
          } else if (totalFabricStock > 0 && totalFabricStock < totalRequired) {
            // Stock exists but at different width — create split requirement
            // Main requirement: use stock at available width
            availableStock = totalFabricStock;
            allocatedFromStock = totalFabricStock;
            shortfall = totalRequired - totalFabricStock;
            status = MaterialRequirementStatus.PARTIAL_STOCK;
          }
          // else: no stock at all, defaults remain (PO_REQUIRED)
        } else if (bomItem.materialType === 'FABRIC' && bomItem.fabricId && !bomItem.fabricWidthInches) {
          // FABRIC without width info — check fabric_stock at ANY width
          const fabricStockAnyWidth = await prisma.fabric_stock.aggregate({
            where: {
              fabricId: bomItem.fabricId,
              status: 'AVAILABLE',
            },
            _sum: { quantityAvailable: true },
          });
          const totalFabricStock = Number(fabricStockAnyWidth._sum?.quantityAvailable || 0);

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
            _sum: { quantityAvailable: true },
          });
          const totalLaceStock = Number(laceStockResult._sum?.quantityAvailable || 0);

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
              const mat = await prisma.materials.findFirst({
                where: { [lookup.field]: lookup.value },
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

      // Track GREIGE requirements by materialId for linking PROCESSING requirements
      const greigeRequirementIds: Map<string, string> = new Map();

      // First pass: Create/update MATERIAL requirements (including GREIGE)
      for (const req of materialReqs) {
        // CRITICAL: First check if a requirement already exists with an active PO
        // (PO_GENERATED, PO_SENT, PARTIALLY_RECEIVED) — do NOT create duplicates
        const existingWithPO = await tx.material_requirements.findFirst({
          where: {
            orderId: req.orderId,
            orderItemId: req.orderItemId,
            materialId: req.materialId,
            requirementType: req.requirementType || 'MATERIAL',
            colorName: req.colorName || null,
            status: { in: ['PO_GENERATED', 'PO_SENT', 'PARTIALLY_RECEIVED'] },
          },
          include: getRequirementIncludes(),
        });

        if (existingWithPO) {
          // Skip - already has an active PO, don't duplicate
          // Track for GREIGE linking if needed
          if (req.isGreigeRequirement) {
            greigeRequirementIds.set(
              `${req.orderId}-${req.orderItemId}-${req.materialId}-${req.colorName || ''}`,
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
            status: 'CANCELLED', // Only reuse CANCELLED — prevents second BOM item overwriting first
          },
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
            `${req.orderId}-${req.orderItemId}-${req.materialId}-${req.colorName || ''}`,
            saved.id
          );
        }

        savedRequirements.push(mapToResponse(saved));
      }

      // Second pass: Create/update PROCESSING requirements with linked GREIGE IDs
      for (const req of processingReqs) {
        const linkedGreigeId = greigeRequirementIds.get(
          `${req.orderId}-${req.orderItemId}-${req.linkedGreigeMaterialId || req.materialId}-${req.colorName || ''}`
        );

        // CRITICAL: First check if a requirement already exists with an active PO
        // (PO_GENERATED, PO_SENT, PARTIALLY_RECEIVED) — do NOT create duplicates
        const existingWithPO = await tx.material_requirements.findFirst({
          where: {
            orderId: req.orderId,
            orderItemId: req.orderItemId,
            materialId: req.materialId,
            requirementType: 'PROCESSING',
            colorName: req.colorName || null,
            status: { in: ['PO_GENERATED', 'PO_SENT', 'PARTIALLY_RECEIVED'] },
          },
          include: getRequirementIncludes(),
        });

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
            status: 'CANCELLED', // Only reuse CANCELLED — prevents second BOM item overwriting first
          },
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
    { timeout: 30000 }
  ); // 30s timeout for large BOMs

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

  return {
    totalPendingRequirements: pendingCount,
    totalShortfall: Number(shortfallSum._sum.shortfall || 0),
    requirementsNeedingPO: needingPOCount,
    poInProgress: poInProgressCount,
    awaitingReceipt: awaitingReceiptCount,
    overdueRequirements: overdueCount,
    processingRequirementsCount: processingCount,
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
  ratePerMeter: number;
  expectedShrinkage: number | null;
  expectedReturnDate: Date | null;
  requirementNumbers: string[];
  userId: string;
}

export function buildJwoDataForProcessingPO(seed: ProcessingJwoSeed, jobWorkNumber: string) {
  return {
    jobWorkNumber,
    processType: seed.processType,
    processorId: seed.processorId,
    purchaseOrderId: seed.poId ?? null,
    styleId: seed.styleId,
    fabricId: seed.fabricId,
    fabricType: 'GREIGE',
    qtySentMeters: seed.qtyMeters,
    uom: 'MTR',
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
      if (jwo.jwoStatus === 'CLOSED' || jwo.jwoStatus === 'CANCELLED' || jwo.status === 'STOCK_UPDATED') continue;
      const existing = activeJwoMap.get(jwo.id);
      if (existing) {
        existing.requirementNumbers.push(req.requirementNumber);
      } else {
        activeJwoMap.set(jwo.id, {
          jwoId: jwo.id,
          jobWorkNumber: jwo.jobWorkNumber,
          status: jwo.jwoStatus || jwo.status,
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
          rateCardId: true,
          greigeId: true,
          fabricId: true,
          sourcingStrategy: true,
          rateCard: { select: { processingType: true, printingType: true, shrinkagePercent: true } },
        },
      },
    },
  });

  if (requirements.length === 0) {
    throw new Error('No valid requirements found for PO generation');
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
  const costSheetRateMap = new Map<string, number>();
  for (const req of requirements) {
    if (itemPrices?.[req.materialId] != null) continue; // manual override takes priority, skip
    const costSheetId = (req as any).orderBom?.sourceCostSheetId ?? null;
    const fabricId = (req.materials as any)?.fabricId ?? null;
    const matType = req.materials?.materialType;

    // PROCESSING requirements: resolve from processor rate card or stored processingCost
    if (req.requirementType === 'PROCESSING') {
      const groupKey = req.id; // Each PROCESSING req is a separate PO item
      if (itemPrices?.[groupKey] != null) continue;
      try {
        const resolved = await resolveRate({
          poCategory: 'PROCESSING' as any,
          supplierId: req.processorId || req.preferredSupplierId || supplierId,
          printingType: req.printingType || undefined,
          materialId: req.materialId,
        });
        if (resolved.rate && resolved.rate > 0) {
          costSheetRateMap.set(groupKey, resolved.rate);
        } else if (req.processingCost) {
          costSheetRateMap.set(groupKey, Number(req.processingCost));
        }
      } catch {
        if (req.processingCost) {
          costSheetRateMap.set(groupKey, Number(req.processingCost));
        }
      }
      continue;
    }

    // FABRIC / GREIGE: resolve from cost sheet (fallback for legacy requirements without snapshot).
    // P1 note: D3 (trims/lace/thread rates skipped) is fixed by req.unitPrice snapshot above.
    // This fallback path still only handles FABRIC/GREIGE since resolveRate doesn't support TRIMS.
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
        existing.quantity += Number(req.shortfall);
        existing.requirementIds.push(req.id);
      } else {
        materialGroups.set(key, {
          materialId: req.materialId,
          quantity: Number(req.shortfall),
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
      const baseQty = Number(req.shortfall);
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

  // Determine PO category from material types or requirement types
  const materialTypes = requirements.map((req) => ({
    materialType: req.materials?.materialType || null,
  }));
  let poCategory = determinePOCategoryFromMaterials(materialTypes);

  // Check if these are PROCESSING requirements
  const isProcessingRequirements = requirements.every((req) => req.requirementType === 'PROCESSING');
  if (isProcessingRequirements) {
    poCategory = POCategory.PROCESSING;
  }

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
    const totalQtyMeters = poItems.reduce((sum, item) => sum + item.quantity, 0);
    const ratePerMeter = poItems[0].unitPrice;
    const primary = requirements[0] as any;
    const styleCode = primary.order_items?.styles?.styleCode || 'STK';

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
      const jwo = await tx.job_work_orders.create({
        data: {
          ...buildJwoDataForProcessingPO(
            {
              poId: null,
              processorId: supplierId,
              processType: processingProcessType!,
              styleId: primary.order_items?.styleId ?? null,
              fabricId: primary.orderBomItem?.fabricId ?? null,
              qtyMeters: totalQtyMeters,
              ratePerMeter,
              expectedShrinkage:
                primary.orderBomItem?.rateCard?.shrinkagePercent != null
                  ? Number(primary.orderBomItem.rateCard.shrinkagePercent)
                  : null,
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
            data: { subtotal: roundToCent(totalQtyMeters * ratePerMeter).toNumber() },
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

  // For PROCESSING requirements, find the linked GREIGE PO
  let linkedGreigePOId: string | null = null;
  if (isProcessingRequirements) {
    const linkedGreigeReqIds = requirements
      .map((req) => req.linkedRequirementId)
      .filter((id): id is string => id !== null);

    if (linkedGreigeReqIds.length > 0) {
      const greigePoLink = await prisma.requirement_po_links.findFirst({
        where: { requirementId: { in: linkedGreigeReqIds } },
        select: { purchaseOrderId: true },
      });
      linkedGreigePOId = greigePoLink?.purchaseOrderId || null;
    }
  }

  // Determine initial status
  const initialStatus =
    isProcessingRequirements && linkedGreigePOId ? PurchaseOrderStatus.PENDING_GREIGE : PurchaseOrderStatus.DRAFT;

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
        linkedGreigePOId,
        totalAmount,
        subtotal,
        totalCgst: poTotalCgst,
        totalSgst: poTotalSgst,
        totalIgst: poTotalIgst,
        totalTax,
        isInterstate,
        remarks:
          isProcessingRequirements && linkedGreigePOId
            ? `${remarks || ''}\n[Processing PO] Waiting for greige fabric receipt.`
            : remarks,
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

    // JWC bridge (BUG-JWC1): a PROCESSING PO must carry its Job Work Order — the JWO is what
    // makes the work visible in /job-work-orders and the dyeing/printing process-PO lists,
    // and what the GRN JWO branch keys on. Same 1:1 purchaseOrderId pattern as the
    // dyeing/printing createProcessPO flow.
    let bridgedJobWorkNumber: string | null = null;
    if (isProcessingRequirements && processingProcessType) {
      const primary = requirements[0] as any;
      const styleCode = primary.order_items?.styles?.styleCode || 'STK';
      const jobWorkNumber = await generateJobWorkNumber(processingProcessType, styleCode);
      const totalQtyMeters = itemsWithGst.reduce((sum, item) => sum + item.quantity, 0);
      // Phase 4a (BUG-JWC6): processTypeId is required for commercial totals — without it
      // computeCommercialTotals can never resolve a GST rate for machine-created JWOs
      const processTypeMaster = await tx.process_type_master.findFirst({
        where: { code: processingProcessType, isActive: true },
        select: { id: true },
      });
      const jwo = await tx.job_work_orders.create({
        data: {
          ...buildJwoDataForProcessingPO(
            {
              poId: po.id,
              processorId: supplierId,
              processType: processingProcessType,
              styleId: primary.order_items?.styleId ?? null,
              fabricId: primary.orderBomItem?.fabricId ?? null,
              qtyMeters: totalQtyMeters,
              ratePerMeter: itemsWithGst[0].unitPrice,
              expectedShrinkage:
                primary.orderBomItem?.rateCard?.shrinkagePercent != null
                  ? Number(primary.orderBomItem.rateCard.shrinkagePercent)
                  : null,
              expectedReturnDate: new Date(expectedDeliveryDate),
              requirementNumbers: requirements.map((r) => r.requirementNumber),
              userId,
            },
            jobWorkNumber
          ),
          processTypeId: processTypeMaster?.id ?? null,
        },
      });

      // Phase 4a (BUG-JWC6): the JWO carries its own commercial totals (SAC/service GST).
      // Unresolved GST (e.g. PRINTING master rate is TBD) downgrades to subtotal-only —
      // creation never fails; totalAmount stays null as the R1 "docs blocked" marker.
      try {
        await jobWorkOrderService.computeCommercialTotals(jwo.id, tx);
      } catch (error) {
        if (error instanceof JobWorkOrderError && error.code === JWO_ERROR_CODES.GST_RATE_UNRESOLVED) {
          await tx.job_work_orders.update({
            where: { id: jwo.id },
            data: { subtotal: roundToCent(totalQtyMeters * itemsWithGst[0].unitPrice).toNumber() },
          });
          logWarn(
            `[MRP] JWO ${jobWorkNumber} created without GST — ${processingProcessType} gstRate unresolved in process_type_master`
          );
        } else {
          throw error;
        }
      }

      // Phase 4a: requirement ↔ JWO links, mirroring the requirement_po_links just written
      const poLinks = await tx.requirement_po_links.findMany({
        where: { purchaseOrderId: po.id },
        select: { requirementId: true, allocatedQuantity: true },
      });
      if (poLinks.length > 0) {
        await tx.requirement_jwo_links.createMany({
          data: poLinks.map((l) => ({
            requirementId: l.requirementId,
            jobWorkOrderId: jwo.id,
            allocatedQuantity: l.allocatedQuantity,
          })),
          skipDuplicates: true,
        });
      }
      bridgedJobWorkNumber = jobWorkNumber;
    }

    return { po, linkedCount, itemCount: itemsWithGst.length, jobWorkNumber: bridgedJobWorkNumber };
  });

  return {
    purchaseOrder: {
      id: result.po.id,
      poNumber: result.po.poNumber,
      totalAmount: Number(result.po.totalAmount || 0),
    },
    linkedRequirements: result.linkedCount,
    totalItems: result.itemCount,
    // Phase 4a: surface the bridged JWO so the UI can show both documents
    jobWorkNumber: result.jobWorkNumber ?? undefined,
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
  userId: string
): Promise<MaterialRequirementResponse> {
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

  // Find all links to this PO item
  const links = await client.requirement_po_links.findMany({
    where: { purchaseOrderItemId },
    select: { id: true, requirementId: true },
  });

  // Track which requirements we've updated (avoid updating the same requirement multiple times
  // if it has multiple links to the same PO item — shouldn't happen but belt-and-suspenders)
  const updatedRequirementIds = new Set<string>();

  for (const link of links) {
    // P1.5: Atomic increment — kills read-modify-write race condition
    await client.requirement_po_links.update({
      where: { id: link.id },
      data: {
        receivedQuantity: {
          increment: receivedQuantity,
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
    if (totalReceived >= totalAllocated) {
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

  const links = await client.requirement_jwo_links.findMany({
    where: { jobWorkOrderId },
    select: { id: true, requirementId: true },
  });

  const updatedRequirementIds = new Set<string>();

  for (const link of links) {
    await client.requirement_jwo_links.update({
      where: { id: link.id },
      data: { receivedQuantity: { increment: receivedQuantity } },
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
    if (totalReceived >= totalAllocated) {
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
    linkedRequirement: {
      select: {
        id: true,
        requirementNumber: true,
        requirementType: true,
        status: true,
        totalRequired: true,
        materials: { select: { id: true, code: true, name: true } },
      },
    },
  };
}

function mapToResponse(req: any): MaterialRequirementResponse {
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
  totalRequirements: number;
  errors: Array<{ supplierId: string; error: string }>;
}> {
  console.log('[MRP] Generating multiple POs from requirements', { groupCount: groups.length });

  const purchaseOrders: Array<{ id: string; poNumber: string; supplierId: string; totalAmount: number }> = [];
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

      // Phase 4c: PROCESSING groups return a Job Work Order instead of a PO —
      // surface it in the same list with the JWO number as the document number
      const doc = result.purchaseOrder ?? result.jobWorkOrder;
      purchaseOrders.push({
        id: doc?.id ?? '',
        poNumber:
          result.purchaseOrder?.poNumber ?? (result.jobWorkOrder ? `JWO ${result.jobWorkOrder.jobWorkNumber}` : ''),
        supplierId: group.supplierId,
        totalAmount: doc?.totalAmount ?? 0,
      });

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
    totalRequirements,
    errors: errors.length,
  });

  return {
    purchaseOrders,
    totalPOs: purchaseOrders.length,
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

  // P3: Fetch greige_master for shrinkage percent
  const greigeMaster = await prisma.greige_master.findUnique({
    where: { id: data.greigeId },
    select: { averageShrinkagePercent: true },
  });
  const shrinkagePercent = greigeMaster?.averageShrinkagePercent ? Number(greigeMaster.averageShrinkagePercent) : 0;

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
  const greigeStockResult = await prisma.greige_stock.aggregate({
    where: { greigeId: data.greigeId, status: 'AVAILABLE', quantityAvailable: { gt: 0 } },
    _sum: { quantityAvailable: true },
  });
  const greigeAvailable = Number(greigeStockResult._sum?.quantityAvailable || 0);

  const greigeAllocated = Math.min(greigeAvailable, greigeQtyNeeded);
  const greigeShortfall = greigeQtyNeeded - greigeAllocated;
  const greigeStatus =
    greigeShortfall === 0
      ? MaterialRequirementStatus.FULFILLED_STOCK
      : greigeAllocated > 0
        ? MaterialRequirementStatus.PARTIAL_STOCK
        : MaterialRequirementStatus.PO_REQUIRED;

  // 4. Update original requirement — mark as CONVERTED (P3: truthful status)
  // The fabric requirement is not "fulfilled from stock" — it was converted to greige+processing
  await prisma.material_requirements.update({
    where: { id: requirementId },
    data: {
      shortfall: 0,
      status: MaterialRequirementStatus.CONVERTED,
    },
  });

  // 5. Create GREIGE requirement with price snapshot (P1: rateSource='MANUAL' for user-initiated convert-to-greige)
  const greigeReqNumber = await generateRequirementNumber();
  const greigeReq = await prisma.material_requirements.create({
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
  const procReqNumber = await generateRequirementNumber();
  const procReq = await prisma.material_requirements.create({
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

  // 7. Auto-create fabric_processing record for tracking
  const fabricProcessing = await prisma.fabric_processing.create({
    data: {
      processorId: data.processorId,
      processingType: 'DYEING', // Default; can be updated
      greigeId: data.greigeId,
      greigeQuantitySent: greigeQtyNeeded, // P3: shrinkage-adjusted
      greigeCost: data.greigeCost || null,
      processingCost: data.processingCost || null,
      finishedFabricId: requirement.materials?.fabricId || null,
      processingStatus: 'PLANNED',
      componentName: (data as any).componentName || (requirement as any).componentName || null,
      colorName: (data as any).colorName || (requirement as any).colorName || null,
      createdById: userId,
    },
  });

  return {
    greigeRequirement: mapToResponse(greigeReq),
    processingRequirement: mapToResponse(procReq),
    fabricProcessingId: fabricProcessing.id,
  };
}

/**
 * Preview POs from requirements — returns price + GST breakdown without creating POs
 */
export async function previewPOsFromRequirements(request: POPreviewRequest): Promise<POPreviewGroup[]> {
  const groups: POPreviewGroup[] = [];

  for (const group of request.groups) {
    const { supplierId, requirementIds } = group;

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

    // Fetch requirements with materials, order, and style info for enriched PO preview
    const requirements = await prisma.material_requirements.findMany({
      where: {
        id: { in: requirementIds },
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
            supplierId: req.processorId || req.preferredSupplierId || supplierId,
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
      }
    >();

    for (const req of requirements) {
      // P1.4 D5: Use shared buildGroupKey for consistency with generatePOFromRequirements
      const groupKey = buildGroupKey(req);

      const existing = materialGroups.get(groupKey);
      if (existing) {
        existing.quantity += Number(req.shortfall);
        existing.requirementIds.push(req.id);
      } else {
        materialGroups.set(groupKey, {
          materialId: req.materialId,
          quantity: Number(req.shortfall),
          unit: req.unit,
          requirementIds: [req.id],
          material: req.materials,
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
      const priceRequired = unitPrice === 0;
      if (priceRequired) hasZeroPriceItems = true;

      const lineTotal = mg.quantity * unitPrice;
      // BUG-FIN4 fix: Use async getGSTRate() instead of deprecated getDefaultGSTRate()
      // This enables price-based apparel GST slab (5% ≤₹2,500 / 18% >₹2,500)
      const gstRate = mat?.gstRate
        ? Number(mat.gstRate)
        : await gstService.getGSTRate({
            hsnSacCode: mat?.hsnCode || undefined,
            materialId: mg.materialId,
            unitPrice: unitPrice || undefined,
          });

      // Calculate GST
      let cgstRate = 0,
        cgstAmount = 0,
        sgstRate = 0,
        sgstAmount = 0,
        igstRate = 0,
        igstAmount = 0;
      if (isInterstate) {
        igstRate = gstRate;
        igstAmount = parseFloat(((lineTotal * gstRate) / 100).toFixed(2));
      } else {
        cgstRate = gstRate / 2;
        sgstRate = gstRate / 2;
        cgstAmount = parseFloat(((lineTotal * cgstRate) / 100).toFixed(2));
        sgstAmount = parseFloat(((lineTotal * sgstRate) / 100).toFixed(2));
      }
      const taxAmount = cgstAmount + sgstAmount + igstAmount;

      items.push({
        materialId: mg.materialId,
        materialCode: mat?.code || '',
        materialName: mat?.name || '',
        materialType: matType,
        hsnCode: mat?.hsnCode || null,
        gstRate,
        quantity: mg.quantity,
        unit: mg.unit,
        unitPrice,
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
      });

      subtotal += lineTotal;
      totalCgst += cgstAmount;
      totalSgst += sgstAmount;
      totalIgst += igstAmount;
    }

    const totalTax = totalCgst + totalSgst + totalIgst;

    groups.push({
      supplierId,
      supplierName: supplier.name,
      supplierCode: supplier.code,
      supplierGstin,
      supplierAddress,
      isInterstate,
      supplierStateCode,
      items,
      subtotal: parseFloat(subtotal.toFixed(2)),
      totalCgst: parseFloat(totalCgst.toFixed(2)),
      totalSgst: parseFloat(totalSgst.toFixed(2)),
      totalIgst: parseFloat(totalIgst.toFixed(2)),
      totalTax: parseFloat(totalTax.toFixed(2)),
      grandTotal: parseFloat((subtotal + totalTax).toFixed(2)),
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
