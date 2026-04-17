/**
 * Order BOM (Bill of Materials) Service
 * Business logic for Order-level BOM management
 *
 * Order BOM is created after Cost Sheet approval and contains
 * order-specific quantities and prices for MRP & Production.
 */

import { BaseService, PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';
import { Prisma, order_bom, OrderBOMStatus } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError, BusinessError } from '../errors';
import { logInfo, logError, logDebug, logWarn } from '../utils/logger';
import { systemSettingsService } from './system-settings.service';
import { SearchFilter } from '../types/prisma.types';
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

    // Fix 9a: Auto-populate style_material_bom from cost sheet if empty (root cause fix)
    const existingBomCount = await this.prisma.style_material_bom.count({
      where: { styleId: input.styleId, isActive: true },
    });

    if (existingBomCount === 0) {
      // Parse cost sheet JSON to check for trims/accessories
      const csTrims =
        (costSheet.trimsDetails as unknown as Array<{
          trimName?: string;
          trimRate?: number;
          trimQuantity?: number;
          materialType?: string;
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
        }>) || [];
      const csAccessories =
        (costSheet.accessoriesDetails as unknown as Array<{
          accessoryName?: string;
          accessoryRate?: number;
          accessoryQuantity?: number;
          labelId?: string;
          packagingId?: string;
          materialId?: string;
          materialType?: string;
        }>) || [];

      if (csTrims.length > 0 || csAccessories.length > 0) {
        logInfo('style_material_bom is empty — auto-populating from cost sheet', {
          styleId: input.styleId,
          trimsCount: csTrims.length,
          accessoriesCount: csAccessories.length,
        });

        let sortOrder = 0;

        // Create style_material_bom records from trimsDetails
        for (const trim of csTrims) {
          if (!trim.trimName) continue;
          const materialType = this.detectMaterialTypeFromName(trim.trimName, trim.materialType);

          await this.prisma.style_material_bom.create({
            data: {
              styleId: input.styleId,
              materialType: materialType as any,
              usageCategory: 'GARMENT_TRIM',
              componentName: trim.trimName,
              quantityPerGarment: trim.trimQuantity || 1,
              unit: 'PCS',
              unitPrice: trim.trimRate ?? 0, // NOTE: Zero rate = missing data in cost sheet
              notes: 'Auto-populated from cost sheet',
              sortOrder: sortOrder++,
              isActive: true,
              // Pass through master IDs from cost sheet
              threadId: trim.threadId || undefined,
              buttonId: trim.buttonId || undefined,
              zipperId: trim.zipperId || undefined,
              elasticId: trim.elasticId || undefined,
              labelId: trim.labelId || undefined,
              packagingId: trim.packagingId || undefined,
              materialId: trim.materialId || undefined,
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
        for (const acc of csAccessories) {
          if (!acc.accessoryName) continue;
          const materialType = this.detectMaterialTypeFromName(acc.accessoryName, acc.materialType);

          await this.prisma.style_material_bom.create({
            data: {
              styleId: input.styleId,
              materialType: materialType as any,
              usageCategory: 'PACKAGING',
              componentName: acc.accessoryName,
              quantityPerGarment: acc.accessoryQuantity || 1,
              unit: 'PCS',
              unitPrice: acc.accessoryRate ?? 0, // NOTE: Zero rate = missing data in cost sheet
              notes: 'Auto-populated from cost sheet',
              sortOrder: sortOrder++,
              isActive: true,
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

    // Parse cost sheet details for prices
    const fabricDetails =
      (costSheet.fabricDetails as unknown as Array<{
        fabricName?: string;
        fabricRate?: number;
        fabricAverage?: number;
        fabricTotal?: number;
        fabricWidth?: number;
        fabricId?: string;
        sourcingStrategy?: string;
        processorId?: string;
        greigeCost?: number;
        processingCost?: number;
        rateCardId?: string;
      }>) || [];

    // Phase 4: Prefer relational trimItems/accessoryItems, fall back to JSON for backwards compatibility
    // The relational tables are the SINGLE SOURCE OF TRUTH (all FK fields preserved)
    const trimItemsRelational = (costSheet as any).trimItems || [];
    const accessoryItemsRelational = (costSheet as any).accessoryItems || [];

    // Convert relational to the same shape as JSON for uniform downstream processing
    const trimsDetails =
      trimItemsRelational.length > 0
        ? trimItemsRelational.map((t: any) => ({
            trimName: t.trimName,
            trimRate: Number(t.trimRate) || 0,
            trimQuantity: Number(t.trimQuantity) || 0,
            trimTotal: Number(t.trimTotal) || 0,
            bomId: t.bomId,
            unit: t.unit,
            materialType: t.materialType,
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
          }))
        : // Fallback to JSON for old cost sheets without relational data
          (costSheet.trimsDetails as unknown as Array<{
            trimName?: string;
            trimRate?: number;
            trimQuantity?: number;
            trimTotal?: number;
            bomId?: string;
            unit?: string;
            materialType?: string;
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
          }>) || [];

    const accessoriesDetails =
      accessoryItemsRelational.length > 0
        ? accessoryItemsRelational.map((a: any) => ({
            accessoryName: a.accessoryName,
            accessoryRate: Number(a.accessoryRate) || 0,
            accessoryQuantity: Number(a.accessoryQuantity) || 0,
            accessoryTotal: Number(a.accessoryTotal) || 0,
            labelId: a.labelId,
            packagingId: a.packagingId,
            materialId: a.materialId,
            materialType: a.materialType,
          }))
        : // Fallback to JSON for old cost sheets
          (costSheet.accessoriesDetails as unknown as Array<{
            accessoryName?: string;
            accessoryRate?: number;
            accessoryQuantity?: number;
            accessoryTotal?: number;
            labelId?: string;
            packagingId?: string;
            materialId?: string;
            materialType?: string;
          }>) || [];

    logDebug('[OrderBOM] Trim/Accessory source', {
      trimSource: trimItemsRelational.length > 0 ? 'relational' : 'JSON',
      trimCount: trimsDetails.length,
      accessorySource: accessoryItemsRelational.length > 0 ? 'relational' : 'JSON',
      accessoryCount: accessoriesDetails.length,
    });

    // Build BOM items from style material BOM + cost sheet prices
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bomItems: any[] = [];

    // Add trim items from style_material_bom
    for (const material of styleMaterialBOM) {
      // Find matching price from cost sheet (trimsDetails for GARMENT_TRIM, accessoriesDetails for PACKAGING)
      const trimPrice = trimsDetails.find(
        (t: CostSheetTrimDetail) =>
          t.bomId === material.id || t.trimName?.toLowerCase() === this.getMaterialName(material)?.toLowerCase()
      );

      // Fallback: check accessoriesDetails for PACKAGING items
      const accessoryPrice = !trimPrice
        ? accessoriesDetails.find(
            (a: CostSheetAccessoryDetail) =>
              a.accessoryName?.toLowerCase() === this.getMaterialName(material)?.toLowerCase()
          )
        : null;

      // Default qty to 1 for PACKAGING items (1 label/polybag per garment)
      const quantityPerGarment =
        Number(material.quantityPerGarment) || (material.usageCategory === 'PACKAGING' ? 1 : 0);
      const totalQuantity = quantityPerGarment * orderQuantity;
      const wastagePercent = Number(material.extraPercentage) || 2;
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
        unit: material.unit || 'pcs',
        unitPrice,
        totalCost,
        componentName: material.componentName,
        usageCategory: material.usageCategory,
        notes: material.notes,
        sortOrder: material.sortOrder || 0,
      });
    }

    // Fix 9: Fallback — create BOM items from cost sheet JSON when style_material_bom is empty
    if (styleMaterialBOM.length === 0) {
      logInfo('style_material_bom is empty, creating BOM items from cost sheet JSON', {
        styleId: input.styleId,
        trimsCount: trimsDetails.length,
        accessoriesCount: accessoriesDetails.length,
      });

      let fallbackSortOrder = 100; // Start after fabric items

      // Create BOM items from trimsDetails JSON
      for (const trim of trimsDetails) {
        if (!trim.trimName) continue;
        const materialType = this.detectMaterialTypeFromName(trim.trimName, trim.materialType);
        const quantityPerGarment = trim.trimQuantity || 1;
        const totalQuantity = quantityPerGarment * orderQuantity;
        const wastagePercent = 2;
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
          unit: trim.unit || 'PCS',
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
          // Generic fallback for new material types
          masterId: trim.masterId || null,
        });
      }

      // Create BOM items from accessoriesDetails JSON
      for (const acc of accessoriesDetails) {
        if (!acc.accessoryName) continue;
        const materialType = this.detectMaterialTypeFromName(acc.accessoryName, acc.materialType);
        const quantityPerGarment = acc.accessoryQuantity || 1;
        const totalQuantity = quantityPerGarment * orderQuantity;
        const wastagePercent = 2;
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
          unit: 'PCS',
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
          // Generic fallback for new material types
          masterId: acc.masterId || null,
        });
      }
    }

    // Add fabric items - prefer relational fabricItems (has fabricId), fallback to JSON for legacy
    const hasFabricItemsRelation = costSheet.fabricItems && costSheet.fabricItems.length > 0;

    if (hasFabricItemsRelation) {
      // Use relational fabric items (newer, has fabricId for proper code display)
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
              const styleFabrics = await this.prisma.style_fabrics.findMany({
                where: { componentId: { in: styleComponents.map((c) => c.id) }, fabricId: { not: null } },
                select: { fabricId: true },
              });
              if (styleFabrics[i]) {
                resolvedFabricId = styleFabrics[i].fabricId;
              } else if (styleFabrics.length === 1) {
                resolvedFabricId = styleFabrics[0].fabricId;
              }
              if (resolvedFabricId) {
                logInfo('Resolved fabricId via style_fabrics', { fabricId: resolvedFabricId });
              }
            }
          }
        }

        const quantityPerGarment = Number(fabricItem.cadMeters) || 0;
        const totalQuantity = quantityPerGarment * orderQuantity;
        const wastagePercent = fabricItem.cadWastagePercent != null ? Number(fabricItem.cadWastagePercent) : 0;
        const totalWithWastage = totalQuantity * (1 + wastagePercent / 100);
        // For GREIGE_PROCESSED: use greige rate only (processing is a separate service)
        const unitPrice =
          fabricItem.sourcingStrategy === 'GREIGE_PROCESSED' && fabricItem.greigeCost
            ? Number(fabricItem.greigeCost)
            : Number(fabricItem.costPerMeter) || 0;
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
          processingCost: fabricItem.processingCost ? Number(fabricItem.processingCost) : null,
          rateCardId: fabricItem.rateCardId,
          colorName: fabricItem.colorName || null,
          fabricWidthInches: fabricItem.width ? Number(fabricItem.width) : null,
          selectedCadId: fabricItem.fabricCADId || null,
        });
      }
    } else {
      // Fallback to JSON fabricDetails (primary path — relational table is not populated)
      for (let i = 0; i < fabricDetails.length; i++) {
        const fabric = fabricDetails[i];
        const quantityPerGarment = fabric.fabricAverage;
        if (!quantityPerGarment || quantityPerGarment <= 0) {
          throw new Error(
            `Fabric average (consumption per garment) not set for "${fabric.fabricName || 'Unknown fabric'}". ` +
              `Set the fabric average in the cost sheet before approving BOM.`
          );
        }
        const totalQuantity = quantityPerGarment * orderQuantity;
        const wastagePercent = 2;
        const totalWithWastage = totalQuantity * (1 + wastagePercent / 100);

        // Resolve fabricId: use JSON value, then direct lookup from style_fabrics (set during CAD approval)
        let fabricId = fabric.fabricId || null;

        if (!fabricId && costSheet.styleId) {
          const styleComponents = await this.prisma.style_components.findMany({
            where: { styleId: costSheet.styleId },
            select: { id: true },
          });
          if (styleComponents.length > 0) {
            const styleFabrics = await this.prisma.style_fabrics.findMany({
              where: {
                componentId: { in: styleComponents.map((c) => c.id) },
                fabricId: { not: null },
              },
              select: { fabricId: true },
            });
            // Match by index — fabric items in JSON correspond to style_fabrics order
            if (styleFabrics[i]) {
              fabricId = styleFabrics[i].fabricId;
            } else if (styleFabrics.length === 1) {
              fabricId = styleFabrics[0].fabricId;
            }
          }
        }

        // Derive sourcingStrategy from fabric_width_cad if missing (backward compat for old cost sheets)
        let sourcingStrategy = fabric.sourcingStrategy || null;
        let processorId = fabric.processorId || null;
        let greigeCost = fabric.greigeCost ? Number(fabric.greigeCost) : null;
        let processingCost = fabric.processingCost ? Number(fabric.processingCost) : null;
        let cadGreigeId: string | null = null;
        if (!sourcingStrategy && costSheet.styleId) {
          const cadRow = await this.prisma.fabric_width_cad.findFirst({
            where: {
              costingStyleId: costSheet.styleId,
              processorId: { not: null },
            },
            select: { processorId: true, greigeId: true, greigeCostPerMeter: true, processingPricePerMeter: true },
          });
          if (cadRow?.processorId) {
            sourcingStrategy = 'GREIGE_PROCESSED';
            processorId = cadRow.processorId;
            cadGreigeId = cadRow.greigeId;
            greigeCost = cadRow.greigeCostPerMeter ? Number(cadRow.greigeCostPerMeter) : null;
            processingCost = cadRow.processingPricePerMeter ? Number(cadRow.processingPricePerMeter) : null;
          } else {
            sourcingStrategy = 'READY_FABRIC';
          }
        }

        // Resolve greigeId: from fabric master if fabricId available, otherwise from CAD row
        let greigeId: string | null = cadGreigeId;
        if (sourcingStrategy === 'GREIGE_PROCESSED' && fabricId && !greigeId) {
          const fm = await this.prisma.fabric_master.findUnique({
            where: { id: fabricId },
            select: { greigeId: true },
          });
          greigeId = fm?.greigeId || null;
        }

        // For GREIGE_PROCESSED: use greige rate only (processing is a separate service)
        const unitPrice = sourcingStrategy === 'GREIGE_PROCESSED' && greigeCost ? greigeCost : fabric.fabricRate || 0;
        const totalCost = totalWithWastage * unitPrice;

        bomItems.push({
          id: uuidv4(),
          orderBomId: '', // Will be set in transaction
          materialType: sourcingStrategy === 'GREIGE_PROCESSED' ? 'GREIGE' : 'FABRIC',
          fabricId,
          sourcingStrategy: sourcingStrategy || 'READY_FABRIC',
          greigeId,
          processorId,
          greigeCost,
          processingCost,
          rateCardId: fabric.rateCardId || null,
          quantityPerGarment,
          orderQuantity,
          totalQuantity,
          wastagePercent,
          totalWithWastage,
          unit: 'METER',
          unitPrice,
          totalCost,
          componentName: fabric.fabricName || `Fabric ${i + 1}`,
          usageCategory: 'FABRIC',
          sortOrder: i,
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
          : await systemSettingsService.getNumber('LACE_DEFAULT_WASTAGE_PERCENT', 5);
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
        sortOrder: fabricDetails.length + i,
        // Pass sourcing info for later reference
        sourcingStrategy: laceItem.sourcingStrategy,
        // Lace uses greigeId field for greige lace reference (same pattern as fabric)
        greigeId: laceItem.greigeLaceId, // For lace, greigeLaceId maps to greigeId
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
        for (let i = 0; i < threadItems.length; i++) {
          const threadItem = threadItems[i];
          // Thread cost is typically a flat cost per garment (not qty * rate)
          const costPerGarment = Number(threadItem.costPerGarment) || 4;
          const quantityPerGarment = 1; // 1 lot per garment
          const totalQuantity = quantityPerGarment * orderQuantity;
          const wastagePercent = 2;
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

    // Create Order BOM in transaction
    const orderBOM = await this.prisma.$transaction(async (tx) => {
      // Deactivate previous BOMs for this order/style
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
      // Non-blocking: log but don't fail BOM creation
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
      const unitPrice = Number(item.unitPrice);
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
        sourcingStrategy: item.sourcingStrategy,
        processorId: item.processorId,
        greigeCost: item.greigeCost ? Number(item.greigeCost) : null,
        processingCost: item.processingCost ? Number(item.processingCost) : null,
        rateCardId: item.rateCardId,
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
      // Deactivate previous BOMs
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
    userId: string;
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
          sourcingStrategy: item.sourcingStrategy,
          processorId: item.processorId,
          greigeCost: item.greigeCost ? Number(item.greigeCost) : null,
          processingCost: item.processingCost ? Number(item.processingCost) : null,
          rateCardId: item.rateCardId,
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
          selectedCadId: item.selectedCadId,
          fabricWidthInches: item.fabricWidthInches ? Number(item.fabricWidthInches) : null,
          cadAverageSnapshot: item.cadAverageSnapshot ? Number(item.cadAverageSnapshot) : null,
        };
      }
    });

    const totalMaterialCost = newItems.reduce((sum, item) => sum + (item.totalCost || 0), 0);

    // Create new BOM version in transaction
    const newBOM = await this.prisma.$transaction(async (tx) => {
      // Deactivate current BOM
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
          createdById: input.userId,
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

    return this.transformBOM(bom);
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

          return {
            id: uuidv4(),
            orderBomId: id,
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
      select: { status: true },
    });

    if (order?.status === 'CANCELLED') {
      throw new BusinessError('Cannot approve BOM for a cancelled order');
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

    await this.prisma.order_bom.update({
      where: { id },
      data: { isActive: false },
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

  private getMaterialName(material: {
    materialType?: string | null;
    lace_master?: { laceName?: string } | null;
    button_master?: { buttonName?: string } | null;
    thread_master?: { threadName?: string } | null;
    zipper_master?: { zipperName?: string } | null;
    elastic_master?: { elasticName?: string } | null;
    label_master?: { labelName?: string } | null;
    packaging_master?: { packagingName?: string } | null;
  }): string | null {
    switch (material.materialType) {
      case 'LACE':
        return material.lace_master?.laceName || null;
      case 'BUTTON':
        return material.button_master?.buttonName || null;
      case 'THREAD':
        return material.thread_master?.threadName || null;
      case 'ZIPPER':
        return material.zipper_master?.zipperName || null;
      case 'ELASTIC':
        return material.elastic_master?.elasticName || null;
      case 'LABEL':
        return material.label_master?.labelName || null;
      case 'PACKAGING':
        return material.packaging_master?.packagingName || null;
      default:
        return null;
    }
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
        wastagePercent: item.wastagePercent ? Number(item.wastagePercent) : null,
        totalWithWastage: item.totalWithWastage ? Number(item.totalWithWastage) : null,
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
