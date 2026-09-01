/**
 * Order BOM (Bill of Materials) Service
 * Business logic for Order-level BOM management
 *
 * Order BOM is created after Cost Sheet approval and contains
 * order-specific quantities and prices for MRP & Production.
 */

import { BaseService, PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';
import { Prisma, order_bom, OrderBOMStatus, Unit } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError, BusinessError } from '../errors';
import { logInfo, logError, logDebug, logWarn } from '../utils/logger';
import { processorRateValidationService } from './processor-rate-validation.service';
// Qty-rate audit 2026-08-24: the single slab-aware rate authority (never re-implement slab matching)
import { lookupRate } from './processor-rate-v2.service';
import type { ProcessingTypeV2, PrintingTypeV2 } from '../types/processor-rate-v2.types';
import { systemSettingsService } from './system-settings.service';
import { resolveShrinkagePercent } from './helpers/shrinkage-resolver.helper';
import { getOrCreateDefaultThreadId } from './helpers/default-thread.helper';
import { divideByShrinkage, toNumber, toCurrency, roundToCent } from '../utils/currency';
import { SearchFilter } from '../types/prisma.types';
import { GENERIC_TRIM_FK_FIELDS } from '../schemas/orderBom.schema';
import { v4 as uuidv4 } from 'uuid';
import {
  CreateOrderBOMInput,
  CreateOrderBOMFromCostSheetInput,
  CopyOrderBOMInput,
  UpdateOrderBOMInput,
  ApproveOrderBOMInput,
  OrderBOMQueryFilters,
  OrderBOMItemInput,
  OrderBOMMaterialRequirement,
  OrderBOMCalculationSummary,
} from '../types/order-bom.types';

// ============================================
// Preserved-column carry-forward
// ============================================

/**
 * Columns of order_bom_items that a rebuild (delete + recreate) must not lose.
 *
 * The wastage-edit endpoint, copy-from-previous-order and change-width all recreate rows from a
 * partial shape. Any column absent from that shape is written back NULL, which silently drops an
 * interlining line out of MRP (no resolvable material) and detaches a fabric line from the CAD
 * width it was planned against. GENERIC_TRIM_FK_FIELDS is imported from the Zod schema so the
 * validator and every rebuild mapping share one list.
 */
// greigeLaceId is here (not in GENERIC_TRIM_FK_FIELDS) because it is not a trim master FK: it is
// the greige lace a dyed lace line is processed from, and dropping it on a rebuild would detach the
// line from its greige source for MRP/PO purposes.
const PRESERVED_STRING_FK_FIELDS = [...GENERIC_TRIM_FK_FIELDS, 'selectedCadId', 'greigeLaceId'] as const;
const PRESERVED_DECIMAL_FIELDS = ['fabricWidthInches', 'cadAverageSnapshot'] as const;

type PreservedFieldSource = object | null | undefined;

function readPreservedField(source: PreservedFieldSource, field: string): unknown {
  return source ? (source as Record<string, unknown>)[field] : undefined;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/**
 * Build the preserved-column slice for one rebuilt row.
 *
 * Precedence is payload-wins-when-present: a client that explicitly sends one of these fields
 * (including an explicit null to clear it) is honoured — the schema now accepts them, so silently
 * overriding the sender would just re-create the bug class in the opposite direction. When the
 * payload omits the field, the previously stored value is kept.
 */
function carryForwardPreservedFields(
  payload: PreservedFieldSource,
  prev: PreservedFieldSource
): Record<string, string | number | null> {
  const result: Record<string, string | number | null> = {};

  for (const field of PRESERVED_STRING_FK_FIELDS) {
    const sent = readPreservedField(payload, field);
    const kept = sent !== undefined ? sent : readPreservedField(prev, field);
    result[field] = (kept as string | null | undefined) ?? null;
  }

  for (const field of PRESERVED_DECIMAL_FIELDS) {
    const sent = readPreservedField(payload, field);
    result[field] = toNullableNumber(sent !== undefined ? sent : readPreservedField(prev, field));
  }

  return result;
}

// ============================================
// Types
// ============================================

export interface OrderBOMQueryOptions extends PaginationOptions {
  orderId?: string;
  styleId?: string;
  status?: OrderBOMStatus;
  isActive?: boolean;
}

// Internal types for cost sheet trim/accessory detail mapping
interface CostSheetTrimDetail {
  trimName?: string;
  trimRate?: number;
  trimQuantity?: number;
  trimTotal?: number;
  bomId?: string;
  unit?: string;
  materialType?: string;
  isNotApplicable?: boolean;
  threadId?: string;
  buttonId?: string;
  zipperId?: string;
  elasticId?: string;
  labelId?: string;
  packagingId?: string;
  materialId?: string;
  hookEyeId?: string;
  snapButtonId?: string;
  buckleId?: string;
  beltId?: string;
  velcroId?: string;
  drawstringId?: string;
  ribbonId?: string;
  sequinId?: string;
  beadId?: string;
  motifId?: string;
  interliningId?: string;
  paddingId?: string;
  otherFastenerId?: string;
  otherTapeId?: string;
  otherDecorativeId?: string;
  otherFunctionalId?: string;
}

interface CostSheetAccessoryDetail {
  accessoryName?: string;
  accessoryRate?: number;
  accessoryQuantity?: number;
  accessoryTotal?: number;
  labelId?: string;
  packagingId?: string;
  materialId?: string;
  materialType?: string;
  isNotApplicable?: boolean;
}

// ============================================
// Service
// ============================================

class OrderBOMServiceClass extends BaseService<order_bom, CreateOrderBOMInput, UpdateOrderBOMInput> {
  protected readonly modelName = 'order_bom';
  protected readonly entityName = 'Order BOM';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected get model(): any {
    return this.prisma.order_bom;
  }

  protected buildSearchFilter(search: string): SearchFilter {
    return [];
  }

  protected getDefaultIncludes(): IncludeConfig {
    return {
      items: {
        include: {
          material: true,
          button_master: true,
          thread_master: true,
          zipper_master: true,
          lace_master: true,
          elastic_master: true,
          label_master: true,
          packaging_master: true,
          // Generic trim masters — code/name only, so the BOM UI can show the Code column
          hook_eye_master: { select: { id: true, hookEyeCode: true, hookEyeName: true } },
          snap_button_master: { select: { id: true, snapButtonCode: true, snapButtonName: true } },
          buckle_master: { select: { id: true, buckleCode: true, buckleName: true } },
          belt_master: { select: { id: true, beltCode: true, beltName: true } },
          velcro_master: { select: { id: true, velcroCode: true, velcroName: true } },
          drawstring_master: { select: { id: true, drawstringCode: true, drawstringName: true } },
          ribbon_master: { select: { id: true, ribbonCode: true, ribbonName: true } },
          sequin_master: { select: { id: true, sequinCode: true, sequinName: true } },
          bead_master: { select: { id: true, beadCode: true, beadName: true } },
          motif_master: { select: { id: true, motifCode: true, motifName: true } },
          interlining_master: { select: { id: true, interliningCode: true, interliningName: true } },
          padding_master: { select: { id: true, paddingCode: true, paddingName: true } },
          other_fastener_master: { select: { id: true, otherFastenerCode: true, otherFastenerName: true } },
          other_tape_master: { select: { id: true, otherTapeCode: true, otherTapeName: true } },
          other_decorative_master: { select: { id: true, otherDecorativeCode: true, otherDecorativeName: true } },
          other_functional_master: { select: { id: true, otherFunctionalCode: true, otherFunctionalName: true } },
          fabric_master: {
            include: {
              greige: {
                select: {
                  id: true,
                  greigeCode: true,
                  greigeName: true,
                },
              },
            },
          },
          greige: {
            select: {
              id: true,
              greigeCode: true,
              greigeName: true,
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          totalQuantity: true,
          status: true,
        },
      },
      style: {
        select: {
          id: true,
          styleCode: true,
          buyerStyleRef: true,
          styleName: true,
        },
      },
      users_order_bom_createdByIdTousers: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      users_order_bom_approvedByIdTousers: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    };
  }

  protected getListIncludes(): IncludeConfig {
    return {
      order: {
        select: {
          id: true,
          orderNumber: true,
          totalQuantity: true,
        },
      },
      style: {
        select: {
          id: true,
          styleCode: true,
          buyerStyleRef: true,
          styleName: true,
        },
      },
      _count: {
        select: {
          items: true,
        },
      },
    };
  }

  // ============================================
  // Create Methods
  // ============================================

  /**
   * Create Order BOM from approved Cost Sheet
   * This is the primary method for creating Order BOM
   */
  async createFromCostSheet(input: CreateOrderBOMFromCostSheetInput): Promise<order_bom> {
    logDebug('Creating Order BOM from Cost Sheet', {
      orderId: input.orderId,
      styleId: input.styleId,
      costSheetId: input.costSheetId,
    });

    // Validate order exists
    const order = await this.prisma.orders.findUnique({
      where: { id: input.orderId },
      include: {
        order_items: {
          where: { styleId: input.styleId },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Order', input.orderId);
    }

    // Validate cost sheet exists and is approved
    const costSheet = await this.prisma.style_costing.findUnique({
      where: { id: input.costSheetId },
      include: {
        styles: true,
        fabricItems: {
          include: {
            fabric: {
              select: {
                id: true,
                fabricCode: true,
                fabricName: true,
                greigeId: true,
              },
            },
            greige: {
              select: {
                id: true,
                greigeCode: true,
                greigeName: true,
              },
            },
            processor: {
              select: {
                id: true,
                name: true,
              },
            },
            rateCard: {
              select: {
                id: true,
              },
            },
            fabricCAD: {
              select: {
                styleFabric: {
                  select: {
                    style_components: { select: { componentName: true } },
                  },
                },
              },
            },
          },
        },
        // Include relational trim items (new - Phase 4)
        trimItems: true,
        // Include relational accessory items (new - Phase 4)
        accessoryItems: true,
      },
    });

    if (!costSheet) {
      throw new NotFoundError('Cost Sheet', input.costSheetId);
    }

    if (costSheet.approvalStatus !== 'APPROVED') {
      throw new BusinessError('Cost Sheet must be approved before creating Order BOM');
    }

    // Validate processor rates have not changed significantly since cost sheet creation
    // BLOCKS order BOM creation if rates have changed >=5%
    const rateValidation = await processorRateValidationService.validateCostSheetRates(input.costSheetId);

    if (rateValidation.requiresNewCostSheet) {
      const blockingItemNames = rateValidation.blockingItems
        .map((item) => `${item.itemName} (${item.percentageChange.toFixed(1)}% change)`)
        .join(', ');

      throw new BusinessError(
        `Processor rates have changed significantly since this cost sheet was created. ` +
          `${rateValidation.blockingItems.length} item(s) have rate changes ≥5%: ${blockingItemNames}. ` +
          `Please create a new cost sheet version with current rates before creating Order BOM.`,
        {
          code: 'RATES_OUTDATED',
          blockingItems: rateValidation.blockingItems,
          warningItems: rateValidation.warningItems,
          suggestedAction: rateValidation.suggestedAction,
          summary: rateValidation.summary,
        }
      );
    }

    // Log warning if there are minor rate changes (but don't block)
    if (rateValidation.warningItems.length > 0) {
      logWarn('Order BOM creation proceeding with minor rate changes', {
        costSheetId: input.costSheetId,
        warningCount: rateValidation.warningItems.length,
        warnings: rateValidation.warningItems.map((w) => ({
          itemName: w.itemName,
          change: `${w.costSheetRate} → ${w.currentRate} (${w.percentageChange.toFixed(2)}%)`,
        })),
      });
    }

    // Qty-rate audit 2026-08-24: the check above pins the ORIGINAL slab (time drift). This one
    // re-runs the slab lookup at THIS ORDER's actual meters — the costed 2500m may sit in a
    // different slab than the ordered 1500m. Blocks until the caller accepts, then the ORDER's
    // BOM lines carry the fresh rate + card (style-level costing stays untouched, so repeat
    // orders of the same style at other quantities keep their own correct basis).
    const bomOrderQuantity = order.order_items[0]?.totalQuantity || order.totalQuantity;
    const slabValidation = await processorRateValidationService.validateQuantitySlabs(
      input.costSheetId,
      bomOrderQuantity
    );
    const rateOverridesByItemId = new Map<string, { processingCost: number; rateCardId: string }>();
    if (slabValidation.driftItems.length > 0) {
      if (!input.acceptRateChanges) {
        const driftSummary = slabValidation.driftItems
          .map(
            (d) =>
              `${d.itemName}: ₹${d.costSheetRate}/m @ ${d.slabLabelOld ?? 'costed slab'} → ₹${d.orderRate}/m @ ${d.slabLabelNew} (${d.percentageChange > 0 ? '+' : ''}${d.percentageChange.toFixed(1)}%)`
          )
          .join('; ');
        throw new BusinessError(
          `This order's quantity (${bomOrderQuantity} pcs) falls in a different processor rate slab than the style ` +
            `was costed at. ${driftSummary}. Review and accept the order-quantity rates to continue — the accepted ` +
            `rates apply to THIS order's BOM only.`,
          {
            code: 'RATE_SLAB_CHANGED',
            driftItems: slabValidation.driftItems,
            orderQuantity: bomOrderQuantity,
          }
        );
      }
      for (const drift of slabValidation.driftItems) {
        rateOverridesByItemId.set(drift.itemId, {
          processingCost: drift.orderRate,
          rateCardId: drift.rateCardIdNew,
        });
      }
      logWarn('Order BOM creation applying accepted order-quantity rate overrides', {
        orderId: input.orderId,
        costSheetId: input.costSheetId,
        overrides: slabValidation.driftItems.map((d) => ({
          item: d.itemName,
          rate: `${d.costSheetRate} → ${d.orderRate}`,
          slab: `${d.slabLabelOld ?? '?'} → ${d.slabLabelNew}`,
        })),
      });
    }

    // Fix 9a: Auto-populate style_material_bom from cost sheet if empty (root cause fix)
    const existingBomCount = await this.prisma.style_material_bom.count({
      where: { styleId: input.styleId, isActive: true },
    });

    if (existingBomCount === 0) {
      // Relational item tables are the source of truth (the JSON detail columns are only a
      // display snapshot) — read trims/accessories from style_costing_trim_items /
      // style_costing_accessory_items, converting Decimals to numbers so the `|| 1` /
      // `?? 0` fallbacks below behave like they did on plain JSON numbers.
      const csTrims = (((costSheet as any).trimItems || []) as any[]).map((t) => ({
        ...t,
        trimRate: t.trimRate != null ? Number(t.trimRate) : undefined,
        trimQuantity: t.trimQuantity != null ? Number(t.trimQuantity) : undefined,
        isNotApplicable: t.isNotApplicable === true,
      }));
      const csAccessories = (((costSheet as any).accessoryItems || []) as any[]).map((a) => ({
        ...a,
        accessoryRate: a.accessoryRate != null ? Number(a.accessoryRate) : undefined,
        accessoryQuantity: a.accessoryQuantity != null ? Number(a.accessoryQuantity) : undefined,
        isNotApplicable: a.isNotApplicable === true,
      }));

      if (csTrims.length > 0 || csAccessories.length > 0) {
        logInfo('style_material_bom is empty — auto-populating from cost sheet', {
          styleId: input.styleId,
          trimsCount: csTrims.length,
          accessoriesCount: csAccessories.length,
        });

        let sortOrder = 0;

        // Create style_material_bom records from trimsDetails
        // BUG-ORD4 fix: Skip trims marked "Not Applicable" on cost sheet
        for (const trim of csTrims) {
          if (!trim.trimName || trim.isNotApplicable) continue;
          const materialType = this.detectMaterialTypeFromName(trim.trimName, trim.materialType);

          // Never persist an all-null-FK BOM row (the "Thread (Auto-added)" orphan class):
          // a name-only THREAD trim resolves to the shared Default Thread master
          let threadId = trim.threadId || undefined;
          let materialId = trim.materialId || undefined;
          const hasAnyFk = !!(
            threadId ||
            materialId ||
            trim.buttonId ||
            trim.zipperId ||
            trim.elasticId ||
            trim.labelId ||
            trim.packagingId ||
            trim.hookEyeId ||
            trim.snapButtonId ||
            trim.buckleId ||
            trim.beltId ||
            trim.velcroId ||
            trim.drawstringId ||
            trim.ribbonId ||
            trim.sequinId ||
            trim.beadId ||
            trim.motifId ||
            trim.interliningId ||
            trim.paddingId ||
            trim.otherFastenerId ||
            trim.otherTapeId ||
            trim.otherDecorativeId ||
            trim.otherFunctionalId
          );
          if (!hasAnyFk && materialType === 'THREAD') {
            const defaultThreadId = await getOrCreateDefaultThreadId();
            threadId = defaultThreadId;
            materialId = defaultThreadId;
          }

          await this.prisma.style_material_bom.create({
            data: {
              styleId: input.styleId,
              materialType: materialType as any,
              usageCategory: 'GARMENT_TRIM',
              componentName: trim.trimName,
              quantityPerGarment: trim.trimQuantity || 1,
              unit: Unit.PIECE,
              unitPrice: trim.trimRate ?? 0, // NOTE: Zero rate = missing data in cost sheet
              notes: 'Auto-populated from cost sheet',
              sortOrder: sortOrder++,
              isActive: true,
              // Set explicitly. Omitting it let the DB column default (5) fire silently —
              // that is what put 5% on every trim of every BOM in the system.
              extraPercentage: await systemSettingsService.getNumberDefault('TRIM_DEFAULT_WASTAGE_PERCENT'),
              // Pass through master IDs from cost sheet
              threadId,
              buttonId: trim.buttonId || undefined,
              zipperId: trim.zipperId || undefined,
              elasticId: trim.elasticId || undefined,
              labelId: trim.labelId || undefined,
              packagingId: trim.packagingId || undefined,
              materialId,
              // Generic trim FK IDs
              hookEyeId: trim.hookEyeId || undefined,
              snapButtonId: trim.snapButtonId || undefined,
              buckleId: trim.buckleId || undefined,
              beltId: trim.beltId || undefined,
              velcroId: trim.velcroId || undefined,
              drawstringId: trim.drawstringId || undefined,
              ribbonId: trim.ribbonId || undefined,
              sequinId: trim.sequinId || undefined,
              beadId: trim.beadId || undefined,
              motifId: trim.motifId || undefined,
              interliningId: trim.interliningId || undefined,
              paddingId: trim.paddingId || undefined,
              otherFastenerId: trim.otherFastenerId || undefined,
              otherTapeId: trim.otherTapeId || undefined,
              otherDecorativeId: trim.otherDecorativeId || undefined,
              otherFunctionalId: trim.otherFunctionalId || undefined,
              // Note: masterId fallback removed - field doesn't exist in schema
              // Use specific FK fields (threadId, buttonId, etc.) instead
            },
          });
        }

        // Create style_material_bom records from accessoriesDetails
        // BUG-ORD4 fix: Skip accessories marked "Not Applicable" on cost sheet
        for (const acc of csAccessories) {
          if (!acc.accessoryName || acc.isNotApplicable) continue;
          const materialType = this.detectMaterialTypeFromName(acc.accessoryName, acc.materialType);

          await this.prisma.style_material_bom.create({
            data: {
              styleId: input.styleId,
              materialType: materialType as any,
              usageCategory: 'PACKAGING',
              componentName: acc.accessoryName,
              quantityPerGarment: acc.accessoryQuantity || 1,
              unit: Unit.PIECE,
              unitPrice: acc.accessoryRate ?? 0, // NOTE: Zero rate = missing data in cost sheet
              notes: 'Auto-populated from cost sheet',
              sortOrder: sortOrder++,
              isActive: true,
              // Set explicitly — see the trim branch above.
              extraPercentage: await systemSettingsService.getNumberDefault('LABEL_DEFAULT_EXTRA_PERCENT'),
              // Pass through master IDs from cost sheet
              labelId: acc.labelId || undefined,
              packagingId: acc.packagingId || undefined,
              materialId: acc.materialId || undefined,
              // Note: masterId fallback removed - field doesn't exist in schema
              // Use specific FK fields (labelId, packagingId, materialId) instead
            },
          });
        }
      }
    }

    // Get style's material BOM for quantities (may now include auto-populated records)
    const styleMaterialBOM = await this.prisma.style_material_bom.findMany({
      where: {
        styleId: input.styleId,
        isActive: true,
      },
      include: {
        lace_master: true,
        button_master: true,
        thread_master: true,
        zipper_master: true,
        elastic_master: true,
        label_master: true,
        packaging_master: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Get order quantity for this style
    const orderItem = order.order_items.find((item) => item.styleId === input.styleId);
    const orderQuantity = orderItem?.totalQuantity || order.totalQuantity;

    // Get next version number
    const latestBOM = await this.prisma.order_bom.findFirst({
      where: {
        orderId: input.orderId,
        styleId: input.styleId,
      },
      orderBy: { version: 'desc' },
    });

    const nextVersion = latestBOM ? latestBOM.version + 1 : 1;

    // Relational item tables are the SINGLE SOURCE OF TRUTH (all FK fields preserved).
    // The JSON detail columns (trimsDetails/accessoriesDetails/fabricDetails) are a display
    // snapshot only — the legacy JSON fallback branches were removed (2026-08-25): every
    // live cost sheet has relational rows, and the copy/version flows now clone them too.
    const trimItemsRelational = (costSheet as any).trimItems || [];
    const accessoryItemsRelational = (costSheet as any).accessoryItems || [];

    // An empty relational trim list on a sheet whose JSON snapshot has trims means a legacy
    // sheet that predates the relational tables — re-save it to populate them. Warn loudly
    // instead of silently emitting a trimless BOM. (Create schema enforces ≥1 trim, so this
    // only fires for pre-migration sheets.)
    if (
      trimItemsRelational.length === 0 &&
      Array.isArray(costSheet.trimsDetails) &&
      costSheet.trimsDetails.length > 0
    ) {
      logWarn(
        `[OrderBOM] Cost sheet ${input.costSheetId} has trims in its JSON snapshot but no relational ` +
          `style_costing_trim_items rows — legacy sheet. Re-save the cost sheet to populate them; ` +
          `generating this BOM WITHOUT trims.`
      );
    }

    // Convert relational to the plain-number shape used by downstream matching
    const trimsDetails: CostSheetTrimDetail[] = trimItemsRelational.map((t: any) => ({
      trimName: t.trimName,
      trimRate: Number(t.trimRate) || 0,
      trimQuantity: Number(t.trimQuantity) || 0,
      trimTotal: Number(t.trimTotal) || 0,
      bomId: t.bomId,
      unit: t.unit,
      materialType: t.materialType,
      isNotApplicable: t.isNotApplicable === true,
      threadId: t.threadId,
      buttonId: t.buttonId,
      zipperId: t.zipperId,
      elasticId: t.elasticId,
      labelId: t.labelId,
      packagingId: t.packagingId,
      materialId: t.materialId,
      hookEyeId: t.hookEyeId,
      snapButtonId: t.snapButtonId,
      buckleId: t.buckleId,
      beltId: t.beltId,
      velcroId: t.velcroId,
      drawstringId: t.drawstringId,
      ribbonId: t.ribbonId,
      sequinId: t.sequinId,
      beadId: t.beadId,
      motifId: t.motifId,
      interliningId: t.interliningId,
      paddingId: t.paddingId,
      otherFastenerId: t.otherFastenerId,
      otherTapeId: t.otherTapeId,
      otherDecorativeId: t.otherDecorativeId,
      otherFunctionalId: t.otherFunctionalId,
    }));

    // Zero accessories is legitimate (accessoriesDetails is optional on the create schema) —
    // an empty relational list simply means the sheet has none.
    const accessoriesDetails: CostSheetAccessoryDetail[] = accessoryItemsRelational.map((a: any) => ({
      accessoryName: a.accessoryName,
      accessoryRate: Number(a.accessoryRate) || 0,
      accessoryQuantity: Number(a.accessoryQuantity) || 0,
      accessoryTotal: Number(a.accessoryTotal) || 0,
      labelId: a.labelId,
      packagingId: a.packagingId,
      materialId: a.materialId,
      materialType: a.materialType,
      isNotApplicable: a.isNotApplicable === true,
    }));

    logDebug('[OrderBOM] Trim/Accessory source', {
      trimCount: trimsDetails.length,
      accessoryCount: accessoriesDetails.length,
    });

    // Build BOM items from style material BOM + cost sheet prices
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bomItems: any[] = [];

    // Consumption tracking pairs cost sheet entries 1:1 with style BOM rows;
    // leftovers are appended after the loop (cost-sheet-only trims)
    const consumedTrims = new Set<CostSheetTrimDetail>();
    const consumedAccessories = new Set<CostSheetAccessoryDetail>();
    // P3.5+ wastage unification: use system setting instead of hardcoded 2%
    const trimDefaultWastagePercent = await systemSettingsService.getNumberDefault('TRIM_DEFAULT_WASTAGE_PERCENT');

    // Add trim items from style_material_bom
    for (const material of styleMaterialBOM) {
      // Match cost sheet entry by master FK → bomId → normalized name
      // (trimsDetails for GARMENT_TRIM, accessoriesDetails for PACKAGING)
      const trimPrice = this.matchTrimDetail(material, trimsDetails, consumedTrims);
      const accessoryPrice = !trimPrice
        ? this.matchAccessoryDetail(material, accessoriesDetails, consumedAccessories)
        : null;

      // Quantity: matched cost sheet entry is the authority; style BOM value is fallback only
      const styleQty = Number(material.quantityPerGarment) || 0;
      const costSheetQty = trimPrice
        ? Number(trimPrice.trimQuantity) || 0
        : accessoryPrice
          ? Number(accessoryPrice.accessoryQuantity) || 0
          : 0;
      const { qty: quantityPerGarment, source: qtySource } = this.resolveTrimQuantity(
        styleQty,
        costSheetQty,
        material.usageCategory
      );
      if (qtySource === 'UNRESOLVED') {
        logWarn(
          `[OrderBOM] Quantity/garment resolves to 0 for '${material.componentName || material.materialType}' — not set in style BOM or cost sheet; MRP will purchase 0. Fix: set quantity on the cost sheet trim.`,
          { styleId: input.styleId, materialType: material.materialType }
        );
      }
      const totalQuantity = quantityPerGarment * orderQuantity;
      // `??` not `||`: a deliberate 0% on the style BOM row is a real value. With `||` it was
      // falsy and fell through to the default, so 0 could never be saved — invisible while the
      // default was 5, fatal now that the default IS 0.
      const wastagePercent =
        material.extraPercentage != null ? Number(material.extraPercentage) : trimDefaultWastagePercent;
      const totalWithWastage = totalQuantity * (1 + wastagePercent / 100);
      // Price resolution: try cost sheet trim price, then accessory price, then material's own unitPrice
      let unitPrice = 0;
      if (trimPrice?.trimRate) {
        unitPrice = trimPrice.trimRate;
      } else if (accessoryPrice?.accessoryRate) {
        unitPrice = accessoryPrice.accessoryRate;
      } else if (Number(material.unitPrice)) {
        unitPrice = Number(material.unitPrice);
      } else {
        // Stage 4: Try master record prices (already included in query)
        const masterPrice = this.getMasterRecordPrice(material);
        if (masterPrice > 0) {
          unitPrice = masterPrice;
          logInfo(
            `[OrderBOM] Resolved price from master record for '${material.componentName || material.materialType}': ₹${masterPrice}`
          );
        } else {
          logWarn(
            `[OrderBOM] No price found for BOM item '${material.componentName || material.materialType}' (materialId: ${material.materialId || 'none'}). Unit price defaults to 0 — BOM total will be understated. Fix: add price in Cost Sheet trims/accessories or set unitPrice on the material.`
          );
        }
      }
      const totalCost = totalWithWastage * unitPrice;

      bomItems.push({
        id: uuidv4(),
        orderBomId: '', // Will be set in transaction
        materialType: material.materialType || 'GENERIC',
        materialId: material.materialId,
        buttonId: material.buttonId,
        threadId: material.threadId,
        zipperId: material.zipperId,
        laceId: material.laceId,
        elasticId: material.elasticId,
        labelId: material.labelId,
        packagingId: material.packagingId,
        // Generic trim FK IDs
        hookEyeId: material.hookEyeId,
        snapButtonId: material.snapButtonId,
        buckleId: material.buckleId,
        beltId: material.beltId,
        velcroId: material.velcroId,
        drawstringId: material.drawstringId,
        ribbonId: material.ribbonId,
        sequinId: material.sequinId,
        beadId: material.beadId,
        motifId: material.motifId,
        interliningId: material.interliningId,
        paddingId: material.paddingId,
        otherFastenerId: material.otherFastenerId,
        otherTapeId: material.otherTapeId,
        otherDecorativeId: material.otherDecorativeId,
        otherFunctionalId: material.otherFunctionalId,
        quantityPerGarment,
        orderQuantity,
        totalQuantity,
        wastagePercent,
        totalWithWastage,
        unit: material.unit || Unit.PIECE,
        unitPrice,
        totalCost,
        componentName: material.componentName,
        usageCategory: material.usageCategory,
        notes: material.notes,
        sortOrder: material.sortOrder || 0,
      });
    }

    // Cost sheet entries with no matching style BOM row: append them so they still appear
    // in the Order BOM (previously silently missing whenever style_material_bom was non-empty).
    // Recomputed from scratch on every (re)generation, so regenerate picks up cost sheet changes.
    if (styleMaterialBOM.length > 0) {
      const unmatchedTrims = trimsDetails.filter((t) => t.trimName && !t.isNotApplicable && !consumedTrims.has(t));
      const unmatchedAccessories = accessoriesDetails.filter(
        (a) => a.accessoryName && !a.isNotApplicable && !consumedAccessories.has(a)
      );

      let appendSortOrder = 300; // after style rows (0+), Fix 9 rows (100+), thread rows (200+)
      let appendedTrimCount = 0;
      let appendedAccessoryCount = 0;

      for (const trim of unmatchedTrims) {
        const materialType = this.detectMaterialTypeFromName(trim.trimName!, trim.materialType);
        // Thread cost is flat per garment — a second THREAD row would double-count it
        if (materialType === 'THREAD' && bomItems.some((i) => i.materialType === 'THREAD')) {
          logInfo('[OrderBOM] Skipping unmatched cost sheet thread entry — thread already in BOM', {
            trimName: trim.trimName,
          });
          continue;
        }
        const { qty: quantityPerGarment, source: qtySource } = this.resolveTrimQuantity(
          0,
          Number(trim.trimQuantity) || 0,
          'GARMENT_TRIM'
        );
        if (qtySource === 'UNRESOLVED') {
          logWarn(
            `[OrderBOM] Quantity/garment resolves to 0 for cost-sheet-only trim '${trim.trimName}' — MRP will purchase 0. Fix: set quantity on the cost sheet trim.`,
            { styleId: input.styleId, materialType }
          );
        }
        const totalQuantity = quantityPerGarment * orderQuantity;
        const wastagePercent = trimDefaultWastagePercent;
        const totalWithWastage = totalQuantity * (1 + wastagePercent / 100);
        const unitPrice = Number(trim.trimRate) || 0;
        const totalCost = totalWithWastage * unitPrice;

        bomItems.push({
          id: uuidv4(),
          orderBomId: '',
          materialType,
          quantityPerGarment,
          orderQuantity,
          totalQuantity,
          wastagePercent,
          totalWithWastage,
          unit: trim.unit || Unit.PIECE,
          unitPrice,
          totalCost,
          componentName: trim.trimName,
          usageCategory: 'GARMENT_TRIM',
          notes: 'Auto-added from cost sheet (not in style material BOM)',
          sortOrder: appendSortOrder++,
          // Pass through master IDs from cost sheet
          threadId: trim.threadId || null,
          buttonId: trim.buttonId || null,
          zipperId: trim.zipperId || null,
          elasticId: trim.elasticId || null,
          labelId: trim.labelId || null,
          packagingId: trim.packagingId || null,
          materialId: trim.materialId || null,
          // Generic trim FK IDs
          hookEyeId: trim.hookEyeId || null,
          snapButtonId: trim.snapButtonId || null,
          buckleId: trim.buckleId || null,
          beltId: trim.beltId || null,
          velcroId: trim.velcroId || null,
          drawstringId: trim.drawstringId || null,
          ribbonId: trim.ribbonId || null,
          sequinId: trim.sequinId || null,
          beadId: trim.beadId || null,
          motifId: trim.motifId || null,
          interliningId: trim.interliningId || null,
          paddingId: trim.paddingId || null,
          otherFastenerId: trim.otherFastenerId || null,
          otherTapeId: trim.otherTapeId || null,
          otherDecorativeId: trim.otherDecorativeId || null,
          otherFunctionalId: trim.otherFunctionalId || null,
        });
        appendedTrimCount++;
        logInfo('[OrderBOM] Appended cost sheet trim missing from style BOM', {
          trimName: trim.trimName,
          materialType,
          quantityPerGarment,
          unitPrice,
        });
      }

      for (const acc of unmatchedAccessories) {
        const materialType = this.detectMaterialTypeFromName(acc.accessoryName!, acc.materialType);
        const { qty: quantityPerGarment } = this.resolveTrimQuantity(
          0,
          Number(acc.accessoryQuantity) || 0,
          'PACKAGING'
        );
        const totalQuantity = quantityPerGarment * orderQuantity;
        const wastagePercent = trimDefaultWastagePercent;
        const totalWithWastage = totalQuantity * (1 + wastagePercent / 100);
        const unitPrice = Number(acc.accessoryRate) || 0;
        const totalCost = totalWithWastage * unitPrice;

        bomItems.push({
          id: uuidv4(),
          orderBomId: '',
          materialType,
          quantityPerGarment,
          orderQuantity,
          totalQuantity,
          wastagePercent,
          totalWithWastage,
          unit: Unit.PIECE,
          unitPrice,
          totalCost,
          componentName: acc.accessoryName,
          usageCategory: 'PACKAGING',
          notes: 'Auto-added from cost sheet (not in style material BOM)',
          sortOrder: appendSortOrder++,
          // Pass through master IDs from cost sheet
          labelId: acc.labelId || null,
          packagingId: acc.packagingId || null,
          materialId: acc.materialId || null,
        });
        appendedAccessoryCount++;
        logInfo('[OrderBOM] Appended cost sheet accessory missing from style BOM', {
          accessoryName: acc.accessoryName,
          materialType,
          quantityPerGarment,
          unitPrice,
        });
      }

      if (appendedTrimCount > 0 || appendedAccessoryCount > 0) {
        logInfo('[OrderBOM] Appended cost sheet entries missing from style BOM', {
          appendedTrims: appendedTrimCount,
          appendedAccessories: appendedAccessoryCount,
        });
      }
    }

    // Fix 9: Fallback — create BOM items from cost sheet JSON when style_material_bom is empty
    if (styleMaterialBOM.length === 0) {
      logInfo('style_material_bom is empty, creating BOM items from cost sheet JSON', {
        styleId: input.styleId,
        trimsCount: trimsDetails.length,
        accessoriesCount: accessoriesDetails.length,
      });

      let fallbackSortOrder = 100; // Start after fabric items

      // P3.5+ wastage unification: fetch system defaults before loops
      const trimDefaultWastage = await systemSettingsService.getNumberDefault('TRIM_DEFAULT_WASTAGE_PERCENT');
      const fabricDefaultWastage = await systemSettingsService.getNumberDefault('FABRIC_DEFAULT_WASTAGE_PERCENT');
      const threadDefaultCost = await systemSettingsService.getNumberDefault('THREAD_DEFAULT_COST_PER_GARMENT');

      // Create BOM items from trimsDetails JSON
      // BUG-ORD4 fix: Skip trims marked "Not Applicable" on cost sheet
      for (const trim of trimsDetails) {
        if (!trim.trimName || trim.isNotApplicable) continue;
        const materialType = this.detectMaterialTypeFromName(trim.trimName, trim.materialType);
        const quantityPerGarment = trim.trimQuantity || 1;
        const totalQuantity = quantityPerGarment * orderQuantity;
        const wastagePercent = trimDefaultWastage;
        const totalWithWastage = totalQuantity * (1 + wastagePercent / 100);
        const unitPrice = trim.trimRate || 0;
        const totalCost = totalWithWastage * unitPrice;

        bomItems.push({
          id: uuidv4(),
          orderBomId: '',
          materialType,
          quantityPerGarment,
          orderQuantity,
          totalQuantity,
          wastagePercent,
          totalWithWastage,
          unit: trim.unit || Unit.PIECE,
          unitPrice,
          totalCost,
          componentName: trim.trimName,
          usageCategory: 'GARMENT_TRIM',
          notes: 'Auto-created from cost sheet (no style_material_bom)',
          sortOrder: fallbackSortOrder++,
          // Pass through master IDs from cost sheet
          threadId: trim.threadId || null,
          buttonId: trim.buttonId || null,
          zipperId: trim.zipperId || null,
          elasticId: trim.elasticId || null,
          labelId: trim.labelId || null,
          packagingId: trim.packagingId || null,
          materialId: trim.materialId || null,
          // Generic trim FK IDs
          hookEyeId: trim.hookEyeId || null,
          snapButtonId: trim.snapButtonId || null,
          buckleId: trim.buckleId || null,
          beltId: trim.beltId || null,
          velcroId: trim.velcroId || null,
          drawstringId: trim.drawstringId || null,
          ribbonId: trim.ribbonId || null,
          sequinId: trim.sequinId || null,
          beadId: trim.beadId || null,
          motifId: trim.motifId || null,
          interliningId: trim.interliningId || null,
          paddingId: trim.paddingId || null,
          otherFastenerId: trim.otherFastenerId || null,
          otherTapeId: trim.otherTapeId || null,
          otherDecorativeId: trim.otherDecorativeId || null,
          otherFunctionalId: trim.otherFunctionalId || null,
          // Note: masterId removed - field doesn't exist on order_bom_items (Prisma would throw)
        });
      }

      // Create BOM items from accessoriesDetails JSON
      // BUG-ORD4 fix: Skip accessories marked "Not Applicable" on cost sheet
      for (const acc of accessoriesDetails) {
        if (!acc.accessoryName || acc.isNotApplicable) continue;
        const materialType = this.detectMaterialTypeFromName(acc.accessoryName, acc.materialType);
        const quantityPerGarment = acc.accessoryQuantity || 1;
        const totalQuantity = quantityPerGarment * orderQuantity;
        const wastagePercent = trimDefaultWastage;
        const totalWithWastage = totalQuantity * (1 + wastagePercent / 100);
        const unitPrice = acc.accessoryRate || 0;
        const totalCost = totalWithWastage * unitPrice;

        bomItems.push({
          id: uuidv4(),
          orderBomId: '',
          materialType,
          quantityPerGarment,
          orderQuantity,
          totalQuantity,
          wastagePercent,
          totalWithWastage,
          unit: Unit.PIECE,
          unitPrice,
          totalCost,
          componentName: acc.accessoryName,
          usageCategory: 'PACKAGING',
          notes: 'Auto-created from cost sheet (no style_material_bom)',
          sortOrder: fallbackSortOrder++,
          // Pass through master IDs from cost sheet
          labelId: acc.labelId || null,
          packagingId: acc.packagingId || null,
          materialId: acc.materialId || null,
          // Note: masterId removed - field doesn't exist on order_bom_items (Prisma would throw)
        });
      }
    }

    // Add fabric items from the relational style_costing_fabric_items table — the ONLY
    // source Order-BOM trusts. The legacy JSON-fabricDetails fallback was removed
    // (2026-08-25): it silently dropped fabricWidthInches/selectedCadId/colorName/rateCardId
    // on every BOM line it produced. A sheet with no relational fabric rows is a
    // pre-migration sheet — re-save it (the create schema enforces ≥1 fabric).
    const hasFabricItemsRelation = costSheet.fabricItems && costSheet.fabricItems.length > 0;
    if (!hasFabricItemsRelation) {
      throw new BusinessError(
        `Cost sheet has no fabric items in style_costing_fabric_items (legacy sheet). ` +
          `Open the cost sheet and re-save it to populate its fabric items, then generate the Order BOM again.`
      );
    }

    {
      // Use relational fabric items (has fabricId for proper code display)
      for (let i = 0; i < costSheet.fabricItems.length; i++) {
        const fabricItem = costSheet.fabricItems[i];

        // Fix 10: Resolve fabricId when null on relational fabric items
        let resolvedFabricId = fabricItem.fabricId;
        if (!resolvedFabricId && fabricItem.fabricName) {
          // Try name-based lookup in fabric_master
          const fabricMatch = await this.prisma.fabric_master.findFirst({
            where: { fabricName: { equals: fabricItem.fabricName, mode: 'insensitive' } },
            select: { id: true },
          });
          if (fabricMatch) {
            resolvedFabricId = fabricMatch.id;
            logInfo('Resolved fabricId by name match', { fabricName: fabricItem.fabricName, fabricId: fabricMatch.id });
          } else if (costSheet.styleId) {
            // Fallback: look up via style_fabrics
            const styleComponents = await this.prisma.style_components.findMany({
              where: { styleId: costSheet.styleId },
              select: { id: true },
            });
            if (styleComponents.length > 0) {
              // P1.9: Include fabric relation for name-based matching instead of index
              const styleFabrics = await this.prisma.style_fabrics.findMany({
                where: { componentId: { in: styleComponents.map((c) => c.id) }, fabricId: { not: null } },
                select: { fabricId: true, fabric: { select: { fabricName: true } } },
              });
              // P1.9: Match by fabricName instead of index
              const fabricItemName = (fabricItem.fabricName || '').toLowerCase().trim();
              const matchedStyleFabric = styleFabrics.find(
                (sf) => sf.fabric?.fabricName && sf.fabric.fabricName.toLowerCase().trim() === fabricItemName
              );
              if (matchedStyleFabric) {
                resolvedFabricId = matchedStyleFabric.fabricId;
                logInfo('Resolved fabricId via style_fabrics (name match)', {
                  fabricName: fabricItem.fabricName,
                  fabricId: resolvedFabricId,
                });
              } else if (styleFabrics.length === 1) {
                // Single fabric fallback (unambiguous)
                resolvedFabricId = styleFabrics[0].fabricId;
                logInfo('Resolved fabricId via style_fabrics (single fabric)', { fabricId: resolvedFabricId });
              } else if (styleFabrics[i]) {
                // P1.9: Index fallback with warning
                resolvedFabricId = styleFabrics[i].fabricId;
                logWarn(
                  `[P1.9] order-bom: Index-based fallback for fabric "${fabricItem.fabricName}" at index ${i}. ` +
                    `Consider ensuring fabricId is set on cost sheet fabric items.`
                );
              }
            }
          }
        }

        const quantityPerGarment = Number(fabricItem.cadMeters) || 0;
        const totalQuantity = quantityPerGarment * orderQuantity;
        const wastagePercent = fabricItem.cadWastagePercent != null ? Number(fabricItem.cadWastagePercent) : 0;
        const totalWithWastage = totalQuantity * (1 + wastagePercent / 100);
        // unitPrice = the APPROVED cost sheet's ALL-IN ₹/m on fabric-basis qty. For
        // GREIGE_PROCESSED that is greige + shrinkage uplift + processing + transport —
        // pricing at the bare greige rate (pre-2026-08-19) made the BOM total match
        // NOTHING (not greige spend, not all-in) and understate the order ~30%.
        // greigeCost/processingCost stay on the row as the procurement breakdown:
        // MRP reads THOSE (never unitPrice) for greige-processed lines, so PO/JWO
        // pricing is unaffected. Matches lace, READY_FABRIC and the width-change path.
        // Accepted order-quantity rate override (RATE_SLAB_CHANGED flow): processing enters the
        // build-up linearly, so the all-in unitPrice shifts by exactly the processing delta.
        const rateOverride = rateOverridesByItemId.get(fabricItem.id);
        const baseUnitPrice = Number(fabricItem.costPerMeter) || 0;
        const unitPrice =
          rateOverride && baseUnitPrice > 0
            ? toNumber(
                roundToCent(
                  toCurrency(baseUnitPrice)
                    .plus(toCurrency(rateOverride.processingCost))
                    .minus(toCurrency(Number(fabricItem.processingCost) || 0))
                )
              )
            : baseUnitPrice;
        const totalCost = totalWithWastage * unitPrice;

        bomItems.push({
          id: uuidv4(),
          orderBomId: '', // Will be set in transaction
          materialType: fabricItem.sourcingStrategy === 'GREIGE_PROCESSED' ? 'GREIGE' : 'FABRIC',
          fabricId: resolvedFabricId || null, // Use resolved ID (Fix 10)
          sourcingStrategy: fabricItem.sourcingStrategy, // Copy sourcing strategy for code display
          quantityPerGarment,
          orderQuantity,
          totalQuantity,
          wastagePercent,
          totalWithWastage,
          unit: 'METER',
          unitPrice,
          totalCost,
          componentName: (fabricItem as any).fabricCAD?.styleFabric?.style_components?.componentName
            ? `${(fabricItem as any).fabricCAD.styleFabric.style_components.componentName} - ${fabricItem.fabricName || fabricItem.fabric?.fabricName || 'Fabric'}`
            : fabricItem.fabricName || fabricItem.fabric?.fabricName || `Fabric ${i + 1}`,
          usageCategory: 'FABRIC',
          sortOrder: i,
          // Preserve greigeId regardless of sourcingStrategy — for READY_FABRIC + landed price,
          // greigeId identifies the material to procure (no processing step).
          // Only fall back to fabric.greigeId for GREIGE_PROCESSED (where fabric_master links back to greige).
          greigeId:
            fabricItem.greigeId ||
            fabricItem.greige?.id ||
            (fabricItem.sourcingStrategy === 'GREIGE_PROCESSED' ? fabricItem.fabric?.greigeId : null) ||
            null,
          processorId: fabricItem.processorId,
          greigeCost: fabricItem.greigeCost ? Number(fabricItem.greigeCost) : null,
          // Order-scoped rate: the accepted order-quantity slab rate wins over the costed snapshot
          processingCost: rateOverride
            ? rateOverride.processingCost
            : fabricItem.processingCost
              ? Number(fabricItem.processingCost)
              : null,
          rateCardId: rateOverride ? rateOverride.rateCardId : fabricItem.rateCardId,
          colorName: fabricItem.colorName || null,
          fabricWidthInches: fabricItem.width ? Number(fabricItem.width) : null,
          selectedCadId: fabricItem.fabricCADId || null,
        });
      }
    }

    // Add lace items from style_costing_lace_items (relational table)
    const laceItems = await this.prisma.style_costing_lace_items.findMany({
      where: { costingId: input.costSheetId },
      include: {
        lace: true,
        greigeLace: true,
        processor: {
          select: {
            id: true,
            name: true,
          },
        },
        rateCard: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    for (let i = 0; i < laceItems.length; i++) {
      const laceItem = laceItems[i];
      const quantityPerGarment = Number(laceItem.quantityPerGarment) || 0;
      const totalQuantity = quantityPerGarment * orderQuantity;
      const wastagePercent =
        laceItem.wastagePercent != null
          ? Number(laceItem.wastagePercent)
          : await systemSettingsService.getNumberDefault('LACE_DEFAULT_WASTAGE_PERCENT');
      const totalWithWastage = totalQuantity * (1 + wastagePercent / 100);
      const unitPrice = Number(laceItem.costPerMeter) || 0;
      const totalCost = totalWithWastage * unitPrice;

      bomItems.push({
        id: uuidv4(),
        orderBomId: '', // Will be set in transaction
        materialType: 'LACE',
        laceId: laceItem.laceId,
        quantityPerGarment,
        orderQuantity,
        totalQuantity,
        wastagePercent,
        totalWithWastage,
        unit: 'METER',
        unitPrice,
        totalCost,
        componentName: laceItem.laceName || laceItem.lace?.laceName || `Lace ${i + 1}`,
        usageCategory: 'LACE',
        notes: laceItem.notes || (laceItem.sourcingStrategy ? `Sourcing: ${laceItem.sourcingStrategy}` : undefined),
        sortOrder: costSheet.fabricItems.length + i,
        // Pass sourcing info for later reference
        sourcingStrategy: laceItem.sourcingStrategy,
        // Lace greige source goes in greigeLaceId (FK to lace_master). It must NOT go in
        // greigeId, which FKs greige_master (fabric) — writing a lace id there is a P2003.
        greigeLaceId: laceItem.greigeLaceId,
        processorId: laceItem.processorId,
        greigeCost: laceItem.greigeCost ? Number(laceItem.greigeCost) : null,
        processingCost: laceItem.processingCost ? Number(laceItem.processingCost) : null,
        rateCardId: laceItem.rateCardId,
      });
    }

    // Fix 12: Add thread items from style_costing_thread_items (relational table)
    const threadItems = await this.prisma.style_costing_thread_items.findMany({
      where: { costingId: input.costSheetId },
      include: {
        thread: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Add thread items or backfill threadId on existing placeholders
    const hasThreadInBom = bomItems.some((item) => item.materialType === 'THREAD');
    if (threadItems.length > 0) {
      if (hasThreadInBom) {
        // Backfill threadId on existing placeholder thread items (e.g., auto-added with null threadId)
        const nullThreadItems = bomItems.filter((item) => item.materialType === 'THREAD' && !item.threadId);
        if (nullThreadItems.length > 0 && threadItems[0]?.threadId) {
          for (const item of nullThreadItems) {
            item.threadId = threadItems[0].threadId;
            item.componentName = threadItems[0].thread?.threadName || item.componentName;
            logInfo('Backfilled threadId on placeholder thread item', { threadId: threadItems[0].threadId });
          }
        }
      } else {
        // No thread at all — add from relational table
        // P3.5+ wastage unification: fetch thread defaults
        const threadDefaultCostSetting = await systemSettingsService.getNumberDefault(
          'THREAD_DEFAULT_COST_PER_GARMENT'
        );
        const threadWastageSetting = await systemSettingsService.getNumberDefault('TRIM_DEFAULT_WASTAGE_PERCENT');

        for (let i = 0; i < threadItems.length; i++) {
          const threadItem = threadItems[i];
          // Thread cost is typically a flat cost per garment (not qty * rate)
          const costPerGarment = Number(threadItem.costPerGarment) || threadDefaultCostSetting;
          const quantityPerGarment = 1; // 1 lot per garment
          const totalQuantity = quantityPerGarment * orderQuantity;
          const wastagePercent = threadWastageSetting;
          const totalWithWastage = totalQuantity * (1 + wastagePercent / 100);
          const unitPrice = costPerGarment;
          const totalCost = totalWithWastage * unitPrice;

          bomItems.push({
            id: uuidv4(),
            orderBomId: '',
            materialType: 'THREAD',
            threadId: threadItem.threadId || null,
            quantityPerGarment,
            orderQuantity,
            totalQuantity,
            wastagePercent,
            totalWithWastage,
            unit: 'LOT',
            unitPrice,
            totalCost,
            componentName: threadItem.threadName || threadItem.thread?.threadName || `Thread ${i + 1}`,
            usageCategory: 'GARMENT_TRIM',
            notes: threadItem.notes || 'From cost sheet thread items',
            sortOrder: 200 + i, // After fabric and lace
          });
        }
      }
    }

    // Calculate total material cost
    const totalMaterialCost = bomItems.reduce((sum, item) => sum + (item.totalCost || 0), 0);

    // BUG-S3 fix: Validate all FK IDs before creating BOM items
    await this.validateBomItemFKs(bomItems);

    // Create Order BOM in transaction
    const orderBOM = await this.prisma.$transaction(async (tx) => {
      // Cancel open requirements of the BOMs being superseded, then deactivate them
      await this.cancelBomRequirements(tx, {
        orderBom: { orderId: input.orderId, styleId: input.styleId, isActive: true },
      });
      await tx.order_bom.updateMany({
        where: {
          orderId: input.orderId,
          styleId: input.styleId,
          isActive: true,
        },
        data: { isActive: false },
      });

      // Create new Order BOM
      const newBOM = await tx.order_bom.create({
        data: {
          id: uuidv4(),
          orderId: input.orderId,
          orderItemId: input.orderItemId || orderItem?.id,
          styleId: input.styleId,
          version: nextVersion,
          isActive: true,
          status: 'DRAFT',
          totalMaterialCost,
          sourceCostSheetId: input.costSheetId,
          createdById: input.createdById,
        },
      });

      // Create BOM items
      if (bomItems.length > 0) {
        await tx.order_bom_items.createMany({
          data: bomItems.map((item) => ({
            ...item,
            orderBomId: newBOM.id,
          })),
        });
      }

      // Return with includes
      return tx.order_bom.findUnique({
        where: { id: newBOM.id },
        include: this.getDefaultIncludes(),
      });
    });

    // Fix 13: Auto-populate style_processes from cost sheet when none exist
    try {
      const existingProcesses = await this.prisma.style_processes.count({
        where: { styleId: input.styleId },
      });

      if (existingProcesses === 0) {
        const processCostMapping: Array<{ field: string; processType: string; processName: string }> = [
          { field: 'cuttingCost', processType: 'CUTTING', processName: 'Cutting' },
          { field: 'stitchingCost', processType: 'STITCHING', processName: 'Stitching' },
          { field: 'finishingCost', processType: 'FINISHING', processName: 'Finishing' },
          { field: 'printingCost', processType: 'PRINTING', processName: 'Printing' },
          { field: 'dyeingCost', processType: 'DYEING', processName: 'Dyeing' },
          { field: 'washingCost', processType: 'WASHING', processName: 'Washing' },
          { field: 'embroideryWork', processType: 'EMBROIDERY', processName: 'Embroidery' },
          { field: 'handWork', processType: 'HANDWORK', processName: 'Hand Work' },
          { field: 'smockingCost', processType: 'SMOCKING', processName: 'Smocking' },
        ];

        let sortOrder = 0;
        const createdProcesses: string[] = [];

        for (const mapping of processCostMapping) {
          const costValue = Number((costSheet as Record<string, unknown>)[mapping.field]) || 0;
          if (costValue > 0) {
            await this.prisma.style_processes.create({
              data: {
                styleId: input.styleId,
                processName: mapping.processName,
                processType: mapping.processType as any,
                isRequired: true,
                estimatedCost: costValue,
                sortOrder: sortOrder++,
              },
            });
            createdProcesses.push(`${mapping.processName} (₹${costValue})`);
          }
        }

        if (createdProcesses.length > 0) {
          logInfo('Auto-created style_processes from cost sheet', {
            styleId: input.styleId,
            processes: createdProcesses,
          });
        }
      }
    } catch (processError) {
      // allow-swallow — style_processes auto-population is style-level enrichment, not BOM contents; BOM stays consistent if it fails
      logError('Failed to auto-create style_processes:', processError);
    }

    logInfo('Order BOM created from Cost Sheet', {
      id: orderBOM?.id,
      orderId: input.orderId,
      styleId: input.styleId,
      version: nextVersion,
      itemCount: bomItems.length,
    });

    return orderBOM as order_bom;
  }

  /**
   * Copy Order BOM from a previous order (for repeat orders)
   */
  async copyFromPreviousOrder(input: CopyOrderBOMInput): Promise<order_bom> {
    logDebug('Copying Order BOM from previous order', {
      targetOrderId: input.targetOrderId,
      sourceOrderId: input.sourceOrderId,
      styleId: input.styleId,
    });

    // Get source order BOM
    const sourceBOM = await this.prisma.order_bom.findFirst({
      where: {
        orderId: input.sourceOrderId,
        styleId: input.styleId,
        isActive: true,
      },
      include: {
        items: true,
      },
    });

    if (!sourceBOM) {
      throw new NotFoundError('Source Order BOM for order', input.sourceOrderId);
    }

    // Get target order
    const targetOrder = await this.prisma.orders.findUnique({
      where: { id: input.targetOrderId },
      include: {
        order_items: {
          where: { styleId: input.styleId },
        },
      },
    });

    if (!targetOrder) {
      throw new NotFoundError('Target Order', input.targetOrderId);
    }

    const targetOrderItem = targetOrder.order_items.find((item) => item.styleId === input.styleId);
    const newOrderQuantity = input.adjustQuantity || targetOrderItem?.totalQuantity || targetOrder.totalQuantity;

    // Qty-rate audit 2026-08-24: this was the single most exposed repeat-order path — the copy
    // recalculated QUANTITIES at the target order but carried the source order's historical
    // RATES verbatim, with neither the ≥5% staleness gate nor any slab check. Re-price every
    // greige-processed line at the TARGET quantity; block until accepted, then the new BOM's
    // lines carry the fresh rate (order-scoped — source order and style costing untouched).
    const copyRateOverrides = await this.checkCopiedItemsRateDrift(
      sourceBOM.items,
      newOrderQuantity,
      input.acceptRateChanges === true,
      { targetOrderId: input.targetOrderId, sourceOrderId: input.sourceOrderId }
    );

    // Get next version
    const latestBOM = await this.prisma.order_bom.findFirst({
      where: {
        orderId: input.targetOrderId,
        styleId: input.styleId,
      },
      orderBy: { version: 'desc' },
    });

    const nextVersion = latestBOM ? latestBOM.version + 1 : 1;

    // Recalculate items with new order quantity
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newItems = sourceBOM.items.map((item: any) => {
      const quantityPerGarment = Number(item.quantityPerGarment);
      const totalQuantity = quantityPerGarment * newOrderQuantity;
      const wastagePercent = Number(item.wastagePercent) || 0;
      const totalWithWastage = totalQuantity * (1 + wastagePercent / 100);
      const rateOverride = copyRateOverrides.get(item.id);
      // Processing enters the all-in price linearly → shift unitPrice by the accepted delta
      const unitPrice = rateOverride
        ? toNumber(roundToCent(toCurrency(Number(item.unitPrice)).plus(toCurrency(rateOverride.delta))))
        : Number(item.unitPrice);
      const totalCost = totalWithWastage * unitPrice;

      return {
        id: uuidv4(),
        orderBomId: '', // Will be set in transaction
        materialType: item.materialType,
        materialId: item.materialId,
        buttonId: item.buttonId,
        threadId: item.threadId,
        zipperId: item.zipperId,
        laceId: item.laceId,
        elasticId: item.elasticId,
        labelId: item.labelId,
        packagingId: item.packagingId,
        fabricId: item.fabricId,
        greigeId: item.greigeId,
        // Same style, so the source row's CAD link, greige-lace source and generic trim FKs stay
        // valid on the copy. Omitting them here NULLed the interlining FK on every copied BOM.
        ...carryForwardPreservedFields(undefined, item),
        sourcingStrategy: item.sourcingStrategy,
        processorId: item.processorId,
        greigeCost: item.greigeCost ? Number(item.greigeCost) : null,
        processingCost: rateOverride
          ? rateOverride.processingCost
          : item.processingCost
            ? Number(item.processingCost)
            : null,
        rateCardId: rateOverride ? rateOverride.rateCardId : item.rateCardId,
        colorName: item.colorName || null,
        quantityPerGarment,
        orderQuantity: newOrderQuantity,
        totalQuantity,
        wastagePercent,
        totalWithWastage,
        unit: item.unit,
        unitPrice,
        totalCost,
        componentName: item.componentName,
        usageCategory: item.usageCategory,
        notes: item.notes,
        sortOrder: item.sortOrder,
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalMaterialCost = newItems.reduce((sum: number, item: any) => sum + item.totalCost, 0);

    // Create in transaction
    const newBOM = await this.prisma.$transaction(async (tx) => {
      // Cancel open requirements of the BOMs being superseded, then deactivate them
      await this.cancelBomRequirements(tx, {
        orderBom: { orderId: input.targetOrderId, styleId: input.styleId, isActive: true },
      });
      await tx.order_bom.updateMany({
        where: {
          orderId: input.targetOrderId,
          styleId: input.styleId,
          isActive: true,
        },
        data: { isActive: false },
      });

      // Create new Order BOM
      const bom = await tx.order_bom.create({
        data: {
          id: uuidv4(),
          orderId: input.targetOrderId,
          orderItemId: input.orderItemId || targetOrderItem?.id,
          styleId: input.styleId,
          version: nextVersion,
          isActive: true,
          status: 'DRAFT',
          totalMaterialCost,
          sourceCostSheetId: sourceBOM.sourceCostSheetId,
          copiedFromOrderId: input.sourceOrderId,
          createdById: input.createdById,
        },
      });

      // Create items
      if (newItems.length > 0) {
        await tx.order_bom_items.createMany({
          data: newItems.map((item) => ({
            ...item,
            orderBomId: bom.id,
          })),
        });
      }

      return tx.order_bom.findUnique({
        where: { id: bom.id },
        include: this.getDefaultIncludes(),
      });
    });

    logInfo('Order BOM copied from previous order', {
      id: newBOM?.id,
      targetOrderId: input.targetOrderId,
      sourceOrderId: input.sourceOrderId,
      version: nextVersion,
    });

    return newBOM as order_bom;
  }

  /**
   * Create a new BOM version with fabric width changes
   * Used when a fabric needs to be ordered at a different width (different CAD consumption & costing)
   */
  async createVersionWithWidthChange(input: {
    orderBomId: string;
    fabricItemChanges: Array<{
      bomItemId: string;
      newCadId: string;
    }>;
    // BUG-ORD10 fix: standardized user ID property (was 'userId', now 'createdById' for consistency)
    createdById: string;
  }): Promise<order_bom> {
    logDebug('Creating BOM version with width change', {
      orderBomId: input.orderBomId,
      changes: input.fabricItemChanges.length,
    });

    // Load current BOM with items
    const currentBOM = await this.prisma.order_bom.findUnique({
      where: { id: input.orderBomId },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!currentBOM) {
      throw new NotFoundError('Order BOM', input.orderBomId);
    }

    if (currentBOM.status === 'LOCKED') {
      throw new BusinessError('Cannot change width on a LOCKED Order BOM');
    }

    // Build a map of bomItemId → newCadId
    const changeMap = new Map(input.fabricItemChanges.map((c) => [c.bomItemId, c.newCadId]));

    // Fetch all referenced CAD records
    const cadIds = input.fabricItemChanges.map((c) => c.newCadId);
    const cadRecords = await this.prisma.fabric_width_cad.findMany({
      where: { id: { in: cadIds } },
    });
    const cadMap = new Map(cadRecords.map((c) => [c.id, c]));

    // Validate all CAD records exist and have cadAverage
    for (const change of input.fabricItemChanges) {
      const cad = cadMap.get(change.newCadId);
      if (!cad) {
        throw new NotFoundError('CAD Width Record', change.newCadId);
      }
      if (!cad.cadAverage) {
        throw new ValidationError(`CAD record ${change.newCadId} has no cadAverage (consumption) calculated`);
      }
    }

    // Get next version
    const latestBOM = await this.prisma.order_bom.findFirst({
      where: {
        orderId: currentBOM.orderId,
        styleId: currentBOM.styleId,
      },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (latestBOM?.version || currentBOM.version) + 1;

    // Build new items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newItems: any[] = currentBOM.items.map((item: any) => {
      const newCadId = changeMap.get(item.id);

      if (newCadId) {
        // This fabric item has a width change
        const cad = cadMap.get(newCadId)!;
        const newCadAverage = Number(cad.cadAverage);
        const newWidth = Number(cad.cutableWidth);
        const orderQuantity = item.orderQuantity;
        const totalQuantity = newCadAverage * orderQuantity;
        const wastagePercent = Number(item.wastagePercent) || 0;
        const totalWithWastage = totalQuantity * (1 + wastagePercent / 100);
        // Use CAD's totalCostPerMeter if available, otherwise keep existing unitPrice
        const unitPrice = cad.totalCostPerMeter ? Number(cad.totalCostPerMeter) : Number(item.unitPrice);
        const totalCost = totalWithWastage * unitPrice;

        return {
          id: uuidv4(),
          orderBomId: '', // Set in transaction
          materialType: item.materialType,
          materialId: item.materialId,
          buttonId: item.buttonId,
          threadId: item.threadId,
          zipperId: item.zipperId,
          laceId: item.laceId,
          elasticId: item.elasticId,
          labelId: item.labelId,
          packagingId: item.packagingId,
          fabricId: item.fabricId,
          greigeId: item.greigeId,
          // Generic trim FKs survive a width change untouched; the CAD trio below deliberately
          // overrides this spread with the NEW width's values.
          ...carryForwardPreservedFields(undefined, item),
          sourcingStrategy: item.sourcingStrategy,
          // Qty-rate audit 2026-08-24: the new width's CAD row carries its own processor
          // economics — copying the OLD item's rates while taking the NEW row's unitPrice mixed
          // two different widths' pricing (MRP prices greige POs off greigeCost, so the old copy
          // silently mispriced procurement after a width change). Prefer the new CAD's values,
          // falling back to the old item's only when the CAD row has none.
          processorId: cad.processorId ?? item.processorId,
          greigeCost:
            cad.greigeCostPerMeter != null
              ? Number(cad.greigeCostPerMeter)
              : item.greigeCost
                ? Number(item.greigeCost)
                : null,
          processingCost:
            cad.processingPricePerMeter != null
              ? Number(cad.processingPricePerMeter)
              : item.processingCost
                ? Number(item.processingCost)
                : null,
          rateCardId: cad.rateCardId ?? item.rateCardId,
          colorName: item.colorName || null,
          quantityPerGarment: newCadAverage,
          orderQuantity,
          totalQuantity,
          wastagePercent,
          totalWithWastage,
          unit: item.unit,
          unitPrice,
          totalCost,
          componentName: item.componentName,
          usageCategory: item.usageCategory,
          notes: item.notes,
          sortOrder: item.sortOrder,
          // New CAD-linked fields
          selectedCadId: newCadId,
          fabricWidthInches: newWidth,
          cadAverageSnapshot: newCadAverage,
        };
      } else {
        // Unchanged item — copy as-is
        return {
          id: uuidv4(),
          orderBomId: '', // Set in transaction
          materialType: item.materialType,
          materialId: item.materialId,
          buttonId: item.buttonId,
          threadId: item.threadId,
          zipperId: item.zipperId,
          laceId: item.laceId,
          elasticId: item.elasticId,
          labelId: item.labelId,
          packagingId: item.packagingId,
          fabricId: item.fabricId,
          greigeId: item.greigeId,
          // Untouched line: keep its CAD provenance AND its generic trim FKs. Only the CAD trio
          // used to be carried here, so a width change on the fabric line stripped the
          // interlining/hook-eye/etc FKs from every OTHER line of the new version.
          ...carryForwardPreservedFields(undefined, item),
          sourcingStrategy: item.sourcingStrategy,
          processorId: item.processorId,
          greigeCost: item.greigeCost ? Number(item.greigeCost) : null,
          processingCost: item.processingCost ? Number(item.processingCost) : null,
          rateCardId: item.rateCardId,
          colorName: item.colorName || null,
          quantityPerGarment: Number(item.quantityPerGarment),
          orderQuantity: item.orderQuantity,
          totalQuantity: Number(item.totalQuantity),
          wastagePercent: Number(item.wastagePercent) || 0,
          totalWithWastage: item.totalWithWastage ? Number(item.totalWithWastage) : null,
          unit: item.unit,
          unitPrice: Number(item.unitPrice),
          totalCost: Number(item.totalCost),
          componentName: item.componentName,
          usageCategory: item.usageCategory,
          notes: item.notes,
          sortOrder: item.sortOrder,
        };
      }
    });

    const totalMaterialCost = newItems.reduce((sum, item) => sum + (item.totalCost || 0), 0);

    // Create new BOM version in transaction
    const newBOM = await this.prisma.$transaction(async (tx) => {
      // Cancel open requirements of the superseded version, then deactivate it
      // (they are revived/recreated when the new version is approved and MRP recalculates)
      await this.cancelBomRequirements(tx, { orderBomId: currentBOM.id });
      await tx.order_bom.update({
        where: { id: currentBOM.id },
        data: { isActive: false },
      });

      // Create new version
      const bom = await tx.order_bom.create({
        data: {
          id: uuidv4(),
          orderId: currentBOM.orderId,
          orderItemId: currentBOM.orderItemId,
          styleId: currentBOM.styleId,
          version: nextVersion,
          isActive: true,
          status: 'DRAFT',
          totalMaterialCost,
          sourceCostSheetId: currentBOM.sourceCostSheetId,
          copiedFromOrderId: currentBOM.copiedFromOrderId,
          createdById: input.createdById,
        },
      });

      // Create items
      if (newItems.length > 0) {
        await tx.order_bom_items.createMany({
          data: newItems.map((item) => ({
            ...item,
            orderBomId: bom.id,
          })),
        });
      }

      return tx.order_bom.findUnique({
        where: { id: bom.id },
        include: this.getDefaultIncludes(),
      });
    });

    logInfo('Order BOM version created with width change', {
      id: newBOM?.id,
      orderId: currentBOM.orderId,
      version: nextVersion,
      changedFabrics: input.fabricItemChanges.length,
    });

    return newBOM as order_bom;
  }

  /**
   * Qty-rate audit 2026-08-24: slab/rate re-check for BOM paths that COPY existing items
   * (copyFromPreviousOrder — and any future clone path). For every greige-processed line,
   * re-runs the slab-aware lookup at the TARGET order's meters and compares against the
   * copied rate. Throws RATE_SLAB_CHANGED with the full diff unless `accepted`; when
   * accepted, returns the per-item overrides (fresh rate + card + unit-price delta) for the
   * caller to write onto the NEW order-scoped items.
   */
  private async checkCopiedItemsRateDrift(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sourceItems: any[],
    targetOrderQuantity: number,
    accepted: boolean,
    context: { targetOrderId: string; sourceOrderId?: string }
  ): Promise<Map<string, { processingCost: number; rateCardId: string; delta: number }>> {
    const overrides = new Map<string, { processingCost: number; rateCardId: string; delta: number }>();
    if (!targetOrderQuantity || targetOrderQuantity <= 0) return overrides;

    const driftItems: Array<{
      itemId: string;
      itemName: string;
      processorId: string;
      greigeId: string;
      copiedRate: number;
      orderRate: number;
      slabLabelOld: string | null;
      slabLabelNew: string;
      orderQuantityMeters: number;
      difference: number;
      percentageChange: number;
      rateCardIdNew: string;
    }> = [];

    for (const item of sourceItems) {
      if (item.sourcingStrategy !== 'GREIGE_PROCESSED' || !item.processorId || !item.greigeId) continue;
      const copiedRate = item.processingCost != null ? Number(item.processingCost) : 0;
      if (copiedRate <= 0) continue;

      const quantityPerGarment = Number(item.quantityPerGarment) || 0;
      const wastagePercent = Number(item.wastagePercent) || 0;
      const targetMeters = quantityPerGarment * targetOrderQuantity * (1 + wastagePercent / 100);
      if (targetMeters <= 0) continue;

      // Process/print type + original slab from the pinned rate card when it exists
      let processingType: ProcessingTypeV2 = 'DYEING';
      let printingType: PrintingTypeV2 | undefined;
      let slabLabelOld: string | null = null;
      if (item.rateCardId) {
        const card = await this.prisma.processor_rate_card.findUnique({
          where: { id: item.rateCardId },
          select: { processingType: true, printingType: true, slab: { select: { slabLabel: true } } },
        });
        if (card?.processingType === 'PRINTING') {
          processingType = 'PRINTING';
          printingType = (card.printingType ?? undefined) as PrintingTypeV2 | undefined;
          if (!printingType) continue; // unresolvable print sub-type — skip beats false alarm
        }
        slabLabelOld = card?.slab?.slabLabel ?? null;
      }

      let fresh: Awaited<ReturnType<typeof lookupRate>> = null;
      try {
        fresh = await lookupRate({
          processorId: item.processorId,
          processingType,
          printingType,
          greigeId: item.greigeId,
          quantityMeters: targetMeters,
        });
      } catch {
        // unresolvable — treat as no card, skip
      }
      if (!fresh || fresh.ratePerMeter <= 0) continue;

      // Copied rates are historical: BOTH time drift and slab drift matter on this path,
      // so any paise-level difference is reportable.
      const differenceDec = toCurrency(fresh.ratePerMeter).minus(toCurrency(copiedRate));
      if (differenceDec.abs().lessThan(0.005)) continue;

      const difference = differenceDec.toNumber();
      driftItems.push({
        itemId: item.id,
        itemName: item.componentName || 'Fabric',
        processorId: item.processorId,
        greigeId: item.greigeId,
        copiedRate,
        orderRate: fresh.ratePerMeter,
        slabLabelOld,
        slabLabelNew: fresh.slabLabel,
        orderQuantityMeters: targetMeters,
        difference,
        percentageChange: toCurrency(difference)
          .dividedBy(toCurrency(copiedRate))
          .times(100)
          .toDecimalPlaces(2)
          .toNumber(),
        rateCardIdNew: fresh.id,
      });
      overrides.set(item.id, { processingCost: fresh.ratePerMeter, rateCardId: fresh.id, delta: difference });
    }

    if (driftItems.length > 0 && !accepted) {
      const driftSummary = driftItems
        .map(
          (d) =>
            `${d.itemName}: ₹${d.copiedRate}/m (${d.slabLabelOld ?? 'copied'}) → ₹${d.orderRate}/m @ ${d.slabLabelNew} ` +
            `(${d.percentageChange > 0 ? '+' : ''}${d.percentageChange.toFixed(1)}%)`
        )
        .join('; ');
      throw new BusinessError(
        `The copied BOM carries rates from the source order that no longer match this order's quantity. ` +
          `${driftSummary}. Review and accept the current rates to continue — they apply to THIS order's BOM only.`,
        {
          code: 'RATE_SLAB_CHANGED',
          driftItems,
          sourceOrderId: context.sourceOrderId,
          targetOrderId: context.targetOrderId,
        }
      );
    }

    return overrides;
  }

  // ============================================
  // Read Methods
  // ============================================

  /**
   * Get Order BOM by order ID
   */
  async getByOrderId(orderId: string, styleId?: string): Promise<order_bom | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      orderId,
      isActive: true,
    };

    if (styleId) {
      where.styleId = styleId;
    }

    const bom = await this.prisma.order_bom.findFirst({
      where,
      include: this.getDefaultIncludes(),
      orderBy: { version: 'desc' },
    });

    return bom ? this.transformBOM(bom) : null;
  }

  /**
   * Find all Order BOMs with filters
   */
  async findAllWithFilters(options: OrderBOMQueryOptions): Promise<PaginatedResult<order_bom>> {
    const { page = 1, limit = 20, search, sortBy, sortOrder, ...filters } = options;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (filters.orderId) {
      where.orderId = filters.orderId;
    }

    if (filters.styleId) {
      where.styleId = filters.styleId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const [boms, total] = await Promise.all([
      this.prisma.order_bom.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy || 'createdAt']: sortOrder || 'desc' },
        include: this.getListIncludes(),
      }),
      this.prisma.order_bom.count({ where }),
    ]);

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: boms.map((bom: any) => this.transformBOM(bom)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get full details of an Order BOM
   */
  async getFullDetails(id: string): Promise<order_bom> {
    const bom = await this.prisma.order_bom.findUnique({
      where: { id },
      include: this.getDefaultIncludes(),
    });

    if (!bom) {
      throw new NotFoundError('Order BOM', id);
    }

    return this.withGreigeRequirement(this.transformBOM(bom));
  }

  /**
   * MRP-31: annotate greige-processed lines with the greige quantity the order will actually
   * consume.
   *
   * A GREIGE_PROCESSED line shows the greige master's name against `quantityPerGarment`, which is
   * the CAD marker consumption at cutable width — i.e. FINISHED fabric, before shrinkage. MRP then
   * divides by (1 - shrinkage) to decide what to buy, so the BOM understated the real greige by
   * the shrinkage allowance and nothing on the page hinted at it. Same resolver MRP uses, so the
   * two pages cannot drift.
   *
   * Display-only: nothing is persisted, and `totalWithWastage` is left untouched.
   */
  private async withGreigeRequirement(bom: order_bom): Promise<order_bom> {
    const items = (bom as unknown as { items?: any[] }).items;
    if (!Array.isArray(items) || items.length === 0) return bom;

    await Promise.all(
      items.map(async (item) => {
        if (!item?.greigeId) return;
        const { percent, source } = await resolveShrinkagePercent(item);
        const finished = Number(item.totalWithWastage ?? item.totalQuantity ?? 0);
        item.shrinkagePercentUsed = percent;
        item.shrinkageSource = source;
        // Same formula as planning — guarded against a 100% divisor.
        item.greigeRequired = percent > 0 ? toNumber(divideByShrinkage(finished, percent)) : finished;
      })
    );

    return bom;
  }

  // ============================================
  // Update Methods
  // ============================================

  /**
   * Update Order BOM items (only if DRAFT status)
   */
  async updateItems(id: string, data: UpdateOrderBOMInput): Promise<order_bom> {
    logDebug('Updating Order BOM items', { id });

    const currentBOM = await this.prisma.order_bom.findUnique({
      where: { id },
    });

    if (!currentBOM) {
      throw new NotFoundError('Order BOM', id);
    }

    if (currentBOM.status !== 'DRAFT') {
      throw new BusinessError('Can only update Order BOM in DRAFT status');
    }

    if (!data.items || data.items.length === 0) {
      throw new ValidationError('At least one BOM item is required');
    }

    // Recalculate totals
    const totalMaterialCost = data.items.reduce((sum, item) => {
      const totalQuantity = item.quantityPerGarment * item.orderQuantity;
      const totalWithWastage = totalQuantity * (1 + (item.wastagePercent || 0) / 100);
      return sum + totalWithWastage * item.unitPrice;
    }, 0);

    // Update in transaction
    const updatedBOM = await this.prisma.$transaction(async (tx) => {
      // Silent-data-loss fix 2026-08-31: this endpoint rebuilds every row from the request body,
      // but the body cannot express the CAD provenance trio or the 16 generic trim FKs for lines
      // the UI does not edit. Snapshot the rows first so the rebuild can carry them forward;
      // without this a single wastage-% blur NULLed them (ORD2026080032 lost its interlining FK
      // and its 52" CAD link that way).
      const existingById = new Map(
        (await tx.order_bom_items.findMany({ where: { orderBomId: id } })).map((row) => [row.id, row])
      );

      // Delete existing items
      await tx.order_bom_items.deleteMany({
        where: { orderBomId: id },
      });

      // Update BOM
      await tx.order_bom.update({
        where: { id },
        data: {
          totalMaterialCost,
        },
      });

      // Create new items
      await tx.order_bom_items.createMany({
        data: data.items!.map((item, index) => {
          const totalQuantity = item.quantityPerGarment * item.orderQuantity;
          const totalWithWastage = totalQuantity * (1 + (item.wastagePercent || 0) / 100);
          const totalCost = totalWithWastage * item.unitPrice;

          // Only ids that belong to THIS BOM resolve — a foreign or stale id falls through to a
          // fresh row rather than adopting another BOM's provenance.
          const prev = item.id ? existingById.get(item.id) : undefined;

          return {
            // Reuse the row id when it is one of ours. The page applies an optimistic local
            // update instead of refetching, so it re-sends the ids it already had; minting new
            // uuids here made the carry-forward above miss on every subsequent edit in the same
            // page session — the exact usage pattern that stripped ORD2026080032.
            id: prev ? prev.id : uuidv4(),
            orderBomId: id,
            materialType: item.materialType,
            // Carry forward what the payload cannot express. Payload wins when it explicitly
            // sends a value (including an explicit null to clear); otherwise keep the stored one.
            ...carryForwardPreservedFields(item, prev),
            materialId: item.materialId,
            buttonId: item.buttonId,
            threadId: item.threadId,
            zipperId: item.zipperId,
            laceId: item.laceId,
            elasticId: item.elasticId,
            labelId: item.labelId,
            packagingId: item.packagingId,
            fabricId: item.fabricId,
            greigeId: item.greigeId || null,
            sourcingStrategy: item.sourcingStrategy || null,
            processorId: item.processorId || null,
            greigeCost: item.greigeCost || null,
            processingCost: item.processingCost || null,
            rateCardId: item.rateCardId || null,
            colorName: item.colorName || null,
            quantityPerGarment: item.quantityPerGarment,
            orderQuantity: item.orderQuantity,
            totalQuantity,
            wastagePercent: item.wastagePercent || 0,
            totalWithWastage,
            unit: item.unit,
            unitPrice: item.unitPrice,
            totalCost,
            componentName: item.componentName,
            usageCategory: item.usageCategory,
            notes: item.notes,
            sortOrder: item.sortOrder || index,
          };
        }),
      });

      return tx.order_bom.findUnique({
        where: { id },
        include: this.getDefaultIncludes(),
      });
    });

    logInfo('Order BOM updated', { id });
    return this.transformBOM(updatedBOM!);
  }

  /**
   * Approve Order BOM (changes status to APPROVED)
   */
  async approve(id: string, input: ApproveOrderBOMInput): Promise<order_bom> {
    logDebug('Approving Order BOM', { id });

    const bom = await this.prisma.order_bom.findUnique({
      where: { id },
    });

    if (!bom) {
      throw new NotFoundError('Order BOM', id);
    }

    if (bom.status !== 'DRAFT') {
      throw new BusinessError('Can only approve Order BOM in DRAFT status');
    }

    // Check if parent order is cancelled
    const order = await this.prisma.orders.findUnique({
      where: { id: bom.orderId },
      select: {
        status: true,
        totalQuantity: true,
        order_items: { where: { styleId: bom.styleId }, select: { totalQuantity: true } },
      },
    });

    if (order?.status === 'CANCELLED') {
      throw new BusinessError('Cannot approve BOM for a cancelled order');
    }

    // Qty-rate audit 2026-08-24: a DRAFT BOM survives order-item edits with its stale
    // orderQuantity, and approval used to accept it without ever comparing against the LIVE
    // order — a BOM computed at 2500 pcs could be approved for an order now carrying 1500 pcs,
    // with every rate slab-picked at the old quantity. Approval is the last gate before MRP
    // explodes from these lines, so refuse the mismatch and demand a regenerated BOM.
    const liveOrderQuantity = order?.order_items?.[0]?.totalQuantity ?? order?.totalQuantity ?? null;
    if (liveOrderQuantity != null && liveOrderQuantity > 0) {
      const staleItems = await this.prisma.order_bom_items.findMany({
        where: { orderBomId: id, orderQuantity: { not: liveOrderQuantity } },
        select: { orderQuantity: true },
        take: 1,
      });
      if (staleItems.length > 0) {
        throw new BusinessError(
          `This BOM was calculated for ${staleItems[0].orderQuantity} pcs but the order now carries ` +
            `${liveOrderQuantity} pcs. Regenerate the BOM from the cost sheet (or re-copy it) so quantities ` +
            `and processor rate slabs match the live order before approving.`,
          { code: 'BOM_QUANTITY_STALE', bomQuantity: staleItems[0].orderQuantity, orderQuantity: liveOrderQuantity }
        );
      }
    }

    const updatedBOM = await this.prisma.order_bom.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: input.approvedById,
        approvedAt: new Date(),
      },
      include: this.getDefaultIncludes(),
    });

    logInfo('Order BOM approved', { id });
    return this.transformBOM(updatedBOM);
  }

  /**
   * Lock Order BOM for production (changes status to LOCKED)
   */
  async lock(id: string): Promise<order_bom> {
    logDebug('Locking Order BOM for production', { id });

    const bom = await this.prisma.order_bom.findUnique({
      where: { id },
    });

    if (!bom) {
      throw new NotFoundError('Order BOM', id);
    }

    if (bom.status !== 'APPROVED') {
      throw new BusinessError('Can only lock APPROVED Order BOM');
    }

    // Check if parent order is cancelled
    const order = await this.prisma.orders.findUnique({
      where: { id: bom.orderId },
      select: { status: true },
    });

    if (order?.status === 'CANCELLED') {
      throw new BusinessError('Cannot lock BOM for a cancelled order');
    }

    const updatedBOM = await this.prisma.order_bom.update({
      where: { id },
      data: {
        status: 'LOCKED',
      },
      include: this.getDefaultIncludes(),
    });

    logInfo('Order BOM locked for production', { id });
    return this.transformBOM(updatedBOM);
  }

  /**
   * Cancel open (non-terminal, not on a PO) MRP requirements matching the given filter.
   * Must be called wherever a BOM is deactivated, or its requirements linger as
   * PO_REQUIRED and duplicate on the next MRP recalculation.
   */
  private async cancelBomRequirements(
    client: Prisma.TransactionClient,
    where: Prisma.material_requirementsWhereInput
  ): Promise<number> {
    const result = await client.material_requirements.updateMany({
      where: {
        ...where,
        status: { notIn: ['RECEIVED', 'CANCELLED', 'PO_GENERATED', 'PO_SENT', 'PARTIALLY_RECEIVED'] },
      },
      data: { status: 'CANCELLED' },
    });
    if (result.count > 0) {
      logInfo('Cancelled MRP requirements for deactivated BOM(s)', { where, cancelledCount: result.count });
    }
    return result.count;
  }

  /**
   * Deactivate Order BOM
   */
  async deactivate(id: string): Promise<void> {
    logDebug('Deactivating Order BOM', { id });

    const bom = await this.prisma.order_bom.findUnique({
      where: { id },
    });

    if (!bom) {
      throw new NotFoundError('Order BOM', id);
    }

    if (bom.status === 'LOCKED') {
      throw new BusinessError('Cannot deactivate LOCKED Order BOM');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.cancelBomRequirements(tx, { orderBomId: id });
      await tx.order_bom.update({
        where: { id },
        data: { isActive: false },
      });
    });

    logInfo('Order BOM deactivated', { id });
  }

  /**
   * Cleanup: Deactivate all BOMs for cancelled orders
   * This is a one-time cleanup for orders that were cancelled before the cascade fix
   */
  async cleanupBomsForCancelledOrders(): Promise<{ deactivatedCount: number }> {
    logDebug('Running cleanup for BOMs of cancelled orders');

    // Find all active BOMs where the parent order is cancelled
    // Note: order_bom has 'order' relation (singular), not 'orders'
    const result = await this.prisma.order_bom.updateMany({
      where: {
        isActive: true,
        order: {
          status: 'CANCELLED',
        },
      },
      data: { isActive: false },
    });

    logInfo('Cleanup completed: deactivated BOMs for cancelled orders', {
      deactivatedCount: result.count,
    });

    return { deactivatedCount: result.count };
  }

  // ============================================
  // Calculation Methods
  // ============================================

  /**
   * Calculate material requirements from Order BOM
   */
  async calculateRequirements(id: string): Promise<OrderBOMCalculationSummary> {
    const bom = await this.prisma.order_bom.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            material: true,
            button_master: true,
            thread_master: true,
            zipper_master: true,
            lace_master: true,
            elastic_master: true,
            label_master: true,
            packaging_master: true,
            fabric_master: true,
            greige: {
              select: {
                id: true,
                greigeCode: true,
                greigeName: true,
              },
            },
          },
        },
      },
    });

    if (!bom) {
      throw new NotFoundError('Order BOM', id);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requirements: OrderBOMMaterialRequirement[] = bom.items.map((item: any) => {
      const quantityPerGarment = Number(item.quantityPerGarment);
      const orderQuantity = item.orderQuantity;
      const baseQuantity = quantityPerGarment * orderQuantity;
      const wastagePercent = Number(item.wastagePercent) || 0;
      const wastageQuantity = baseQuantity * (wastagePercent / 100);
      const totalQuantity = baseQuantity + wastageQuantity;
      const unitPrice = Number(item.unitPrice);
      const totalCost = totalQuantity * unitPrice;

      // Get material name and code
      const materialInfo = this.getMaterialInfo(item);

      return {
        materialType: item.materialType,
        materialName: materialInfo.name,
        materialCode: materialInfo.code,
        quantityPerGarment,
        orderQuantity,
        baseQuantity,
        wastagePercent,
        wastageQuantity,
        totalQuantity,
        unit: item.unit,
        unitPrice,
        totalCost,
      };
    });

    // Group by category
    const byCategory: { [category: string]: { itemCount: number; totalCost: number } } = {};
    for (const req of requirements) {
      const category =
        bom.items.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (i: any) => this.getMaterialInfo(i).code === req.materialCode
        )?.usageCategory || 'OTHER';

      if (!byCategory[category]) {
        byCategory[category] = { itemCount: 0, totalCost: 0 };
      }
      byCategory[category].itemCount++;
      byCategory[category].totalCost += req.totalCost;
    }

    return {
      totalItems: requirements.length,
      totalMaterialCost: requirements.reduce((sum, req) => sum + req.totalCost, 0),
      requirements,
      byCategory,
    };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  /**
   * BUG-S3 fix: Validate all FK IDs in BOM items before creating them
   * This prevents FK constraint violations and provides better error messages
   */
  private async validateBomItemFKs(
    bomItems: Array<{
      fabricId?: string | null;
      greigeId?: string | null;
      greigeLaceId?: string | null;
      laceId?: string | null;
      buttonId?: string | null;
      threadId?: string | null;
      zipperId?: string | null;
      elasticId?: string | null;
      labelId?: string | null;
      packagingId?: string | null;
      materialId?: string | null;
      componentName?: string;
      materialType?: string;
    }>
  ): Promise<void> {
    // Collect unique IDs for each FK type
    const fabricIds = new Set<string>();
    const greigeIds = new Set<string>();
    const greigeLaceIds = new Set<string>();
    const laceIds = new Set<string>();
    const buttonIds = new Set<string>();
    const threadIds = new Set<string>();
    const zipperIds = new Set<string>();
    const elasticIds = new Set<string>();
    const labelIds = new Set<string>();
    const packagingIds = new Set<string>();
    const materialIds = new Set<string>();

    for (const item of bomItems) {
      if (item.fabricId) fabricIds.add(item.fabricId);
      if (item.greigeId) greigeIds.add(item.greigeId);
      if (item.greigeLaceId) greigeLaceIds.add(item.greigeLaceId);
      if (item.laceId) laceIds.add(item.laceId);
      if (item.buttonId) buttonIds.add(item.buttonId);
      if (item.threadId) threadIds.add(item.threadId);
      if (item.zipperId) zipperIds.add(item.zipperId);
      if (item.elasticId) elasticIds.add(item.elasticId);
      if (item.labelId) labelIds.add(item.labelId);
      if (item.packagingId) packagingIds.add(item.packagingId);
      if (item.materialId) materialIds.add(item.materialId);
    }

    const invalidIds: string[] = [];

    // Validate each FK type in parallel
    const validations = await Promise.all([
      fabricIds.size > 0
        ? this.prisma.fabric_master
            .findMany({ where: { id: { in: [...fabricIds] } }, select: { id: true } })
            .then((found) => {
              const foundIds = new Set(found.map((f) => f.id));
              for (const id of fabricIds) {
                if (!foundIds.has(id)) invalidIds.push(`fabricId: ${id}`);
              }
            })
        : Promise.resolve(),
      greigeIds.size > 0
        ? this.prisma.greige_master
            .findMany({ where: { id: { in: [...greigeIds] } }, select: { id: true } })
            .then((found) => {
              const foundIds = new Set(found.map((f) => f.id));
              for (const id of greigeIds) {
                if (!foundIds.has(id)) invalidIds.push(`greigeId: ${id}`);
              }
            })
        : Promise.resolve(),
      laceIds.size > 0
        ? this.prisma.lace_master
            .findMany({ where: { id: { in: [...laceIds] } }, select: { id: true } })
            .then((found) => {
              const foundIds = new Set(found.map((f) => f.id));
              for (const id of laceIds) {
                if (!foundIds.has(id)) invalidIds.push(`laceId: ${id}`);
              }
            })
        : Promise.resolve(),
      // greigeLaceId FKs lace_master (NOT greige_master) — the greige lace a dyed variant
      // is processed from. Validated separately so a mixed-up id fails loud here rather
      // than as an opaque P2003 at createMany.
      greigeLaceIds.size > 0
        ? this.prisma.lace_master
            .findMany({ where: { id: { in: [...greigeLaceIds] } }, select: { id: true } })
            .then((found) => {
              const foundIds = new Set(found.map((f) => f.id));
              for (const id of greigeLaceIds) {
                if (!foundIds.has(id)) invalidIds.push(`greigeLaceId: ${id}`);
              }
            })
        : Promise.resolve(),
      buttonIds.size > 0
        ? this.prisma.button_master
            .findMany({ where: { id: { in: [...buttonIds] } }, select: { id: true } })
            .then((found) => {
              const foundIds = new Set(found.map((f) => f.id));
              for (const id of buttonIds) {
                if (!foundIds.has(id)) invalidIds.push(`buttonId: ${id}`);
              }
            })
        : Promise.resolve(),
      threadIds.size > 0
        ? this.prisma.thread_master
            .findMany({ where: { id: { in: [...threadIds] } }, select: { id: true } })
            .then((found) => {
              const foundIds = new Set(found.map((f) => f.id));
              for (const id of threadIds) {
                if (!foundIds.has(id)) invalidIds.push(`threadId: ${id}`);
              }
            })
        : Promise.resolve(),
      zipperIds.size > 0
        ? this.prisma.zipper_master
            .findMany({ where: { id: { in: [...zipperIds] } }, select: { id: true } })
            .then((found) => {
              const foundIds = new Set(found.map((f) => f.id));
              for (const id of zipperIds) {
                if (!foundIds.has(id)) invalidIds.push(`zipperId: ${id}`);
              }
            })
        : Promise.resolve(),
      elasticIds.size > 0
        ? this.prisma.elastic_master
            .findMany({ where: { id: { in: [...elasticIds] } }, select: { id: true } })
            .then((found) => {
              const foundIds = new Set(found.map((f) => f.id));
              for (const id of elasticIds) {
                if (!foundIds.has(id)) invalidIds.push(`elasticId: ${id}`);
              }
            })
        : Promise.resolve(),
      labelIds.size > 0
        ? this.prisma.label_master
            .findMany({ where: { id: { in: [...labelIds] } }, select: { id: true } })
            .then((found) => {
              const foundIds = new Set(found.map((f) => f.id));
              for (const id of labelIds) {
                if (!foundIds.has(id)) invalidIds.push(`labelId: ${id}`);
              }
            })
        : Promise.resolve(),
      packagingIds.size > 0
        ? this.prisma.packaging_master
            .findMany({ where: { id: { in: [...packagingIds] } }, select: { id: true } })
            .then((found) => {
              const foundIds = new Set(found.map((f) => f.id));
              for (const id of packagingIds) {
                if (!foundIds.has(id)) invalidIds.push(`packagingId: ${id}`);
              }
            })
        : Promise.resolve(),
      materialIds.size > 0
        ? this.prisma.materials
            .findMany({ where: { id: { in: [...materialIds] } }, select: { id: true } })
            .then((found) => {
              const foundIds = new Set(found.map((f) => f.id));
              for (const id of materialIds) {
                if (!foundIds.has(id)) invalidIds.push(`materialId: ${id}`);
              }
            })
        : Promise.resolve(),
    ]);

    if (invalidIds.length > 0) {
      throw new ValidationError(
        `Invalid material references in BOM: ${invalidIds.slice(0, 5).join(', ')}${invalidIds.length > 5 ? ` and ${invalidIds.length - 5} more` : ''}`
      );
    }
  }

  private getMaterialName(material: {
    materialType?: string | null;
    componentName?: string | null;
    lace_master?: { laceName?: string } | null;
    button_master?: { buttonName?: string } | null;
    thread_master?: { threadName?: string } | null;
    zipper_master?: { zipperName?: string } | null;
    elastic_master?: { elasticName?: string } | null;
    label_master?: { labelName?: string } | null;
    packaging_master?: { packagingName?: string } | null;
  }): string | null {
    let masterName: string | null = null;
    switch (material.materialType) {
      case 'LACE':
        masterName = material.lace_master?.laceName || null;
        break;
      case 'BUTTON':
        masterName = material.button_master?.buttonName || null;
        break;
      case 'THREAD':
        masterName = material.thread_master?.threadName || null;
        break;
      case 'ZIPPER':
        masterName = material.zipper_master?.zipperName || null;
        break;
      case 'ELASTIC':
        masterName = material.elastic_master?.elasticName || null;
        break;
      case 'LABEL':
        masterName = material.label_master?.labelName || null;
        break;
      case 'PACKAGING':
        masterName = material.packaging_master?.packagingName || null;
        break;
      default:
        masterName = null;
    }
    // componentName fallback: generic trim types and rows without a linked master
    // (style-form-created rows) would otherwise never name-match cost sheet entries
    return masterName || material.componentName || null;
  }

  // Master FK fields shared between cost sheet trim entries and style_material_bom rows.
  // laceId is deliberately absent: lace flows through style_costing_lace_items, not trimsDetails.
  private static readonly TRIM_MASTER_FK_FIELDS = [
    'materialId',
    'threadId',
    'buttonId',
    'zipperId',
    'elasticId',
    'labelId',
    'packagingId',
    'hookEyeId',
    'snapButtonId',
    'buckleId',
    'beltId',
    'velcroId',
    'drawstringId',
    'ribbonId',
    'sequinId',
    'beadId',
    'motifId',
    'interliningId',
    'paddingId',
    'otherFastenerId',
    'otherTapeId',
    'otherDecorativeId',
    'otherFunctionalId',
  ] as const;

  private static readonly ACCESSORY_MASTER_FK_FIELDS = ['materialId', 'labelId', 'packagingId'] as const;

  private normalizeName(name?: string | null): string | null {
    if (!name) return null;
    const normalized = name.trim().toLowerCase().replace(/\s+/g, ' ');
    return normalized || null;
  }

  private sharesMasterFK(
    entry: Record<string, unknown>,
    material: Record<string, unknown>,
    fkFields: readonly string[]
  ): boolean {
    return fkFields.some((f) => entry[f] != null && material[f] != null && entry[f] === material[f]);
  }

  /**
   * Match a style BOM row to a cost sheet trim entry: master FK → bomId → normalized name.
   * Identity strength beats consumption freshness: an FK match on an already-consumed entry
   * still wins over a name match on a fresh one. Within a stage, unconsumed entries are
   * preferred so duplicate names pair 1:1; leftovers are appended by the caller.
   */
  private matchTrimDetail(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    material: any,
    trims: CostSheetTrimDetail[],
    consumed: Set<CostSheetTrimDetail>
  ): CostSheetTrimDetail | undefined {
    const candidates = trims.filter((t) => t.trimName && !t.isNotApplicable);
    const materialName = this.normalizeName(this.getMaterialName(material));

    const stages: Array<{ label: string; test: (t: CostSheetTrimDetail) => boolean }> = [
      {
        label: 'masterFK',
        test: (t) =>
          this.sharesMasterFK(
            t as Record<string, unknown>,
            material as Record<string, unknown>,
            OrderBOMServiceClass.TRIM_MASTER_FK_FIELDS
          ),
      },
      { label: 'bomId', test: (t) => !!t.bomId && t.bomId === material.id },
      { label: 'name', test: (t) => materialName !== null && this.normalizeName(t.trimName) === materialName },
    ];

    for (const stage of stages) {
      const matches = candidates.filter(stage.test);
      if (matches.length === 0) continue;
      const unconsumed = matches.find((m) => !consumed.has(m));
      if (unconsumed) {
        consumed.add(unconsumed);
        return unconsumed;
      }
      logDebug('[OrderBOM] Reusing consumed cost sheet trim entry (more style BOM rows than entries)', {
        stage: stage.label,
        trimName: matches[0].trimName,
      });
      return matches[0];
    }
    return undefined;
  }

  private matchAccessoryDetail(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    material: any,
    accessories: CostSheetAccessoryDetail[],
    consumed: Set<CostSheetAccessoryDetail>
  ): CostSheetAccessoryDetail | undefined {
    const candidates = accessories.filter((a) => a.accessoryName && !a.isNotApplicable);
    const materialName = this.normalizeName(this.getMaterialName(material));

    const stages: Array<{ label: string; test: (a: CostSheetAccessoryDetail) => boolean }> = [
      {
        label: 'masterFK',
        test: (a) =>
          this.sharesMasterFK(
            a as Record<string, unknown>,
            material as Record<string, unknown>,
            OrderBOMServiceClass.ACCESSORY_MASTER_FK_FIELDS
          ),
      },
      { label: 'name', test: (a) => materialName !== null && this.normalizeName(a.accessoryName) === materialName },
    ];

    for (const stage of stages) {
      const matches = candidates.filter(stage.test);
      if (matches.length === 0) continue;
      const unconsumed = matches.find((m) => !consumed.has(m));
      if (unconsumed) {
        consumed.add(unconsumed);
        return unconsumed;
      }
      logDebug('[OrderBOM] Reusing consumed cost sheet accessory entry (more style BOM rows than entries)', {
        stage: stage.label,
        accessoryName: matches[0].accessoryName,
      });
      return matches[0];
    }
    return undefined;
  }

  /**
   * Quantity per garment: the cost sheet is the authority — it is the only place users
   * deliberately type quantities. Style BOM qty is a FALLBACK only (style-form rows are
   * created with qty 0/hardcoded 1, and Fix 9a seeds are stale cost-sheet snapshots —
   * none of these represent explicit user intent, so they must never override a matched
   * cost sheet entry). PACKAGING defaults to 1 per garment.
   */
  private resolveTrimQuantity(
    styleQty: number,
    costSheetQty: number,
    usageCategory?: string | null
  ): { qty: number; source: 'COST_SHEET' | 'STYLE_BOM_FALLBACK' | 'PACKAGING_DEFAULT' | 'UNRESOLVED' } {
    if (costSheetQty > 0) return { qty: costSheetQty, source: 'COST_SHEET' };
    if (styleQty > 0) return { qty: styleQty, source: 'STYLE_BOM_FALLBACK' };
    if (usageCategory === 'PACKAGING') return { qty: 1, source: 'PACKAGING_DEFAULT' };
    return { qty: 0, source: 'UNRESOLVED' };
  }

  /**
   * Try to resolve unit price from material master records.
   * Used as Stage 4 fallback when cost sheet and BOM unitPrice are both missing.
   */
  private getMasterRecordPrice(material: {
    button_master?: { pricePerPiece?: unknown } | null;
    thread_master?: { pricePerCone?: unknown } | null;
    zipper_master?: { pricePerPiece?: unknown } | null;
    elastic_master?: { pricePerMeter?: unknown } | null;
    label_master?: { pricePerPiece?: unknown } | null;
    packaging_master?: { pricePerPiece?: unknown } | null;
    lace_master?: { pricePerMeter?: unknown } | null;
  }): number {
    if (material.button_master?.pricePerPiece) return Number(material.button_master.pricePerPiece);
    if (material.thread_master?.pricePerCone) return Number(material.thread_master.pricePerCone);
    if (material.zipper_master?.pricePerPiece) return Number(material.zipper_master.pricePerPiece);
    if (material.elastic_master?.pricePerMeter) return Number(material.elastic_master.pricePerMeter);
    if (material.label_master?.pricePerPiece) return Number(material.label_master.pricePerPiece);
    if (material.packaging_master?.pricePerPiece) return Number(material.packaging_master.pricePerPiece);
    if (material.lace_master?.pricePerMeter) return Number(material.lace_master.pricePerMeter);
    return 0;
  }

  /**
   * Detect material type from item name (used when creating BOM items from cost sheet JSON fallback)
   */
  private detectMaterialTypeFromName(name: string, explicitType?: string): string {
    if (explicitType) return explicitType;
    const lower = name.toLowerCase();
    if (lower.includes('thread')) return 'THREAD';
    if (
      lower.includes('label') ||
      lower.includes('washcare') ||
      lower.includes('size label') ||
      lower.includes('main label')
    )
      return 'LABEL';
    if (lower.includes('poly bag') || lower.includes('polybag') || lower.includes('hanger') || lower.includes('carton'))
      return 'PACKAGING';
    if (lower.includes('button')) return 'BUTTON';
    if (lower.includes('zipper') || lower.includes('zip')) return 'ZIPPER';
    if (lower.includes('elastic')) return 'ELASTIC';
    if (lower.includes('lace')) return 'LACE';
    if (lower.includes('price tag') || lower.includes('tag')) return 'LABEL';
    if (lower.includes('ribbon')) return 'RIBBON';
    if (lower.includes('interlining')) return 'INTERLINING';
    return 'TRIMS';
  }

  private getMaterialInfo(item: {
    materialType: string;
    material?: { name?: string; code?: string } | null;
    button_master?: { buttonName?: string; buttonCode?: string } | null;
    thread_master?: { threadName?: string; threadCode?: string } | null;
    zipper_master?: { zipperName?: string; zipperCode?: string } | null;
    lace_master?: { laceName?: string; laceCode?: string } | null;
    elastic_master?: { elasticName?: string; elasticCode?: string } | null;
    label_master?: { labelName?: string; labelCode?: string } | null;
    packaging_master?: { packagingName?: string; packagingCode?: string } | null;
    fabric_master?: { fabricName?: string; fabricCode?: string } | null;
    greige?: { greigeName?: string; greigeCode?: string } | null;
  }): { name: string; code: string } {
    switch (item.materialType) {
      case 'BUTTON':
        return {
          name: item.button_master?.buttonName || 'Unknown Button',
          code: item.button_master?.buttonCode || '',
        };
      case 'THREAD':
        return {
          name: item.thread_master?.threadName || 'Unknown Thread',
          code: item.thread_master?.threadCode || '',
        };
      case 'ZIPPER':
        return {
          name: item.zipper_master?.zipperName || 'Unknown Zipper',
          code: item.zipper_master?.zipperCode || '',
        };
      case 'LACE':
        return {
          name: item.lace_master?.laceName || 'Unknown Lace',
          code: item.lace_master?.laceCode || '',
        };
      case 'ELASTIC':
        return {
          name: item.elastic_master?.elasticName || 'Unknown Elastic',
          code: item.elastic_master?.elasticCode || '',
        };
      case 'LABEL':
        return {
          name: item.label_master?.labelName || 'Unknown Label',
          code: item.label_master?.labelCode || '',
        };
      case 'PACKAGING':
        return {
          name: item.packaging_master?.packagingName || 'Unknown Packaging',
          code: item.packaging_master?.packagingCode || '',
        };
      case 'FABRIC':
        return {
          name: item.fabric_master?.fabricName || 'Unknown Fabric',
          code: item.fabric_master?.fabricCode || '',
        };
      case 'GREIGE':
        return {
          name: item.greige?.greigeName || item.fabric_master?.fabricName || 'Unknown Greige',
          code: item.greige?.greigeCode || '',
        };
      default:
        return {
          name: item.material?.name || 'Unknown Material',
          code: item.material?.code || '',
        };
    }
  }

  private transformBOM(bom: unknown): order_bom {
    const bomData = bom as {
      totalMaterialCost?: unknown;
      items?: Array<{
        quantityPerGarment?: unknown;
        totalQuantity?: unknown;
        wastagePercent?: unknown;
        totalWithWastage?: unknown;
        unitPrice?: unknown;
        totalCost?: unknown;
        [key: string]: unknown;
      }>;
      [key: string]: unknown;
    };

    return {
      ...bomData,
      totalMaterialCost: bomData.totalMaterialCost ? Number(bomData.totalMaterialCost) : null,
      items: bomData.items?.map((item) => ({
        ...item,
        quantityPerGarment: Number(item.quantityPerGarment),
        totalQuantity: Number(item.totalQuantity),
        // `!= null`, not truthiness: a stored 0% is a real, deliberate value. The old
        // `item.wastagePercent ? ... : null` turned every legitimate 0 into null on the way
        // out, so a 0 the user saved came back as "not set" and the input re-rendered blank.
        wastagePercent: item.wastagePercent != null ? Number(item.wastagePercent) : null,
        totalWithWastage: item.totalWithWastage != null ? Number(item.totalWithWastage) : null,
        unitPrice: Number(item.unitPrice),
        totalCost: Number(item.totalCost),
      })),
    } as unknown as order_bom;
  }

  /**
   * Validate BOM items for MRP readiness.
   * Returns warnings for items that will be skipped during MRP calculation.
   */
  async validateForMRP(
    bomId: string
  ): Promise<{ ready: boolean; warnings: { componentName: string; materialType: string; issue: string }[] }> {
    const bom = await this.prisma.order_bom.findUnique({
      where: { id: bomId },
      include: {
        items: {
          select: {
            id: true,
            componentName: true,
            materialType: true,
            materialId: true,
            fabricId: true,
            laceId: true,
            greigeId: true,
            sourcingStrategy: true,
            buttonId: true,
            threadId: true,
            zipperId: true,
            elasticId: true,
            labelId: true,
            packagingId: true,
          },
        },
      },
    });

    if (!bom) return { ready: false, warnings: [{ componentName: 'BOM', materialType: '-', issue: 'BOM not found' }] };

    const warnings: { componentName: string; materialType: string; issue: string }[] = [];

    for (const item of bom.items) {
      const hasMaterial = !!item.materialId;
      const hasFabric = item.materialType === 'FABRIC' && !!item.fabricId;
      const hasLace = item.materialType === 'LACE' && !!item.laceId;
      const hasGreige = !!item.greigeId; // greigeId = linked regardless of strategy (covers landed price too)
      const hasTrimMaster = !!(
        item.buttonId ||
        item.threadId ||
        item.zipperId ||
        item.elasticId ||
        item.labelId ||
        item.packagingId
      );

      if (!hasMaterial && !hasFabric && !hasLace && !hasGreige && !hasTrimMaster) {
        let issue = '';
        switch (item.materialType) {
          case 'THREAD':
            issue = `"${item.componentName}" has no thread_master linked. Select a Thread Master in the cost sheet trims section.`;
            break;
          case 'BUTTON':
            issue = `"${item.componentName}" has no button_master linked. Select a Button Master in the cost sheet trims section.`;
            break;
          case 'ZIPPER':
            issue = `"${item.componentName}" has no zipper_master linked. Select a Zipper Master in the cost sheet trims section.`;
            break;
          case 'ELASTIC':
            issue = `"${item.componentName}" has no elastic_master linked. Select an Elastic Master in the cost sheet trims section.`;
            break;
          case 'LABEL':
            issue = `"${item.componentName}" has no label_master linked. Create a Label Master record and add it to the customer's accessory preset, or select it in the cost sheet.`;
            break;
          case 'PACKAGING':
            issue = `"${item.componentName}" has no packaging_master linked. Create a Packaging Master record and add it to the customer's accessory preset, or select it in the cost sheet.`;
            break;
          default:
            issue = `"${item.componentName}" (${item.materialType}) has no material linkage. Link it to a material or master record.`;
        }
        warnings.push({
          componentName: item.componentName || 'Unknown',
          materialType: item.materialType,
          issue,
        });
      }
    }

    return {
      ready: warnings.length === 0,
      warnings,
    };
  }
}

// Export singleton instance
export const orderBomService = new OrderBOMServiceClass();

/**
 * Sync BOM items' fabricId when a real fabric replaces a generic/planning one.
 * Called when PRODUCTION CAD links to stock with a different fabricId than
 * the planning fabric stored in style_fabrics.
 *
 * Updates ALL active BOMs for the style (covers repeat orders).
 * Safe: POs reference materialId (not fabricId), MRP uses quantities.
 */
export async function syncBomFabricId(styleId: string, genericFabricId: string, realFabricId: string): Promise<number> {
  if (genericFabricId === realFabricId) return 0;

  const prismaClient = orderBomService['prisma'];
  const result = await prismaClient.order_bom_items.updateMany({
    where: {
      fabricId: genericFabricId,
      materialType: { in: ['GREIGE', 'FABRIC'] },
      orderBom: { styleId, isActive: true },
    },
    data: { fabricId: realFabricId },
  });

  if (result.count > 0) {
    logInfo(`Synced ${result.count} BOM item(s) fabricId: ${genericFabricId} → ${realFabricId} for style ${styleId}`);
  }
  return result.count;
}
