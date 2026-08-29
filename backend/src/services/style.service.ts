/**
 * Style Service
 * Business logic for style management
 */

import { BaseService, PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';
import { styles, ProductionStage, Gender, AgeGroup, Prisma, Unit } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../errors';
import { logInfo, logError, logDebug, logWarn } from '../utils/logger';
import { SearchFilter, AdditionalFilters } from '../types/prisma.types';
import { randomUUID } from 'crypto';
import {
  CreateStyleRequest,
  UpdateStyleRequest,
  StyleQueryOptions,
  StyleComponentInput,
  StyleFabricInput,
  StyleProcessInput,
  MaterialBOMInput,
  SKUVariantInput,
  PresetAccessoryItem,
  FabricGroupInput,
  FabricCADMapping,
  StyleTrimInput,
} from '../types/style.types';
import { generateSKU, checkMultipleSKUsExist, validateSKUFormat, getSizeOrder } from '../utils/sku-generator';
import { recomputeStyleCadStatus } from './helpers/cad-status.helper';
import { generateAtomicDocNumber } from '../utils/atomicCodeGenerator';
import { systemSettingsService } from './system-settings.service';

// ============================================
// Deduplicate Style Fabrics Helper
// Prevents duplicate fabric entries in same component (BUG-FIX)
// ============================================
function deduplicateStyleFabrics(fabrics: StyleFabricInput[]): StyleFabricInput[] {
  const seen = new Set<string>();
  const unique: StyleFabricInput[] = [];
  for (const fab of fabrics) {
    // Create composite key from identity fields
    const key = `${fab.genericGreigeName || ''}|${fab.fabricFinishType || ''}|${fab.hasEmbroidery || false}|${fab.embroideryId || ''}`;
    if (seen.has(key)) {
      logWarn(`Duplicate fabric skipped: ${key}`);
      continue;
    }
    seen.add(key);
    unique.push(fab);
  }
  return unique;
}

// ============================================
// Generic Trim FK Mapping
// ============================================
const GENERIC_TRIM_FK_MAP: Record<string, string> = {
  HOOK_EYE: 'hookEyeId',
  SNAP_BUTTON: 'snapButtonId',
  BUCKLE: 'buckleId',
  BELT: 'beltId',
  VELCRO: 'velcroId',
  DRAWSTRING: 'drawstringId',
  RIBBON: 'ribbonId',
  SEQUIN: 'sequinId',
  BEAD: 'beadId',
  MOTIF: 'motifId',
  INTERLINING: 'interliningId',
  PADDING: 'paddingId',
  OTHER_FASTENER: 'otherFastenerId',
  OTHER_TAPE: 'otherTapeId',
  OTHER_DECORATIVE: 'otherDecorativeId',
  OTHER_FUNCTIONAL: 'otherFunctionalId',
};

// Helper to build generic trim FK fields for a BOM entry (all null except matching type)
function buildGenericTrimFkFields(materialType: string, materialId: string | null): Record<string, string | null> {
  const fields: Record<string, string | null> = {};
  for (const [type, field] of Object.entries(GENERIC_TRIM_FK_MAP)) {
    fields[field] = materialType === type && materialId ? materialId : null;
  }
  return fields;
}

// ============================================
// Types
// ============================================

export interface CreateStyleDTO extends CreateStyleRequest {}
export interface UpdateStyleDTO extends UpdateStyleRequest {}

export interface StyleWithRelations extends styles {
  style_components?: unknown[];
  style_processes?: unknown[];
  style_costing?: unknown;
  style_material_bom?: unknown[];
  style_variants?: unknown[];
  style_value_additions?: unknown[];
  style_packaging?: unknown[];
}

// ============================================
// Service
// ============================================

class StyleServiceClass extends BaseService<styles, CreateStyleDTO, UpdateStyleDTO> {
  protected readonly modelName = 'styles';
  protected readonly entityName = 'Style';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected get model(): any {
    return this.prisma.styles;
  }

  protected buildSearchFilter(search: string): SearchFilter {
    return [
      { styleCode: { contains: search, mode: 'insensitive' as const } },
      { buyerStyleRef: { contains: search, mode: 'insensitive' as const } },
      { styleName: { contains: search, mode: 'insensitive' as const } },
      { customerName: { contains: search, mode: 'insensitive' as const } },
      { brandName: { contains: search, mode: 'insensitive' as const } },
    ];
  }

  protected getDefaultIncludes(): IncludeConfig {
    return undefined; // Use specific includes in each method
  }

  protected getListIncludes(): IncludeConfig {
    // Include relations needed for list view columns
    // Cast to IncludeConfig as the actual Prisma type supports nested includes
    return {
      product_category: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      brand_categories: {
        select: {
          id: true,
          category: true,
        },
      },
      style_components: {
        select: {
          id: true,
          componentName: true,
          componentType: true,
          componentMasterId: true,
          sortOrder: true,
          componentMaster: {
            select: {
              id: true,
              name: true,
              componentGroupId: true,
            },
          },
          style_fabrics: {
            select: {
              id: true,
              fabricName: true,
              genericGreigeName: true,
              hasEmbroidery: true,
              embroideryId: true,
              fabricCADId: true,
              fabric: {
                select: {
                  id: true,
                  fabricCode: true,
                  fabricName: true,
                  genericGreigeName: true,
                },
              },
            },
          },
        },
      },
      style_costing: {
        select: {
          totalCostPerPiece: true,
        },
      },
      size_options: {
        select: {
          sizeName: true,
        },
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' as const },
      },
    } as unknown as IncludeConfig;
  }

  /**
   * Generate internal style code (STY2607-0001).
   * Atomic sequence shared with style-import.service — both write styles.internalCode,
   * so both MUST use the same 'STY' prefix.
   */
  private async generateInternalCode(): Promise<string> {
    return generateAtomicDocNumber('STY');
  }

  /**
   * Generate style code based on customer prefix + category prefix + sequence.
   * Format: {BUYER_PREFIX}{CATEGORY_PREFIX}{SEQ} e.g., EBWKUR001
   *
   * @param customerId - Customer UUID (optional, uses 'STY' if not provided)
   * @param productCategoryId - Product category UUID (optional, uses 'GEN' if not provided)
   * @returns Generated style code
   */
  async generateStyleCode(brandCategoryId?: string | null, productCategoryId?: string | null): Promise<string> {
    // allow-count-numbering: Style codes are display-only; collisions caught by create-time dup-check + retry; partial unique index arrives via harden_code_uniqueness migration
    // Get brand prefix from brand_categories (e.g., "EBW" for Easybuy Westernwear)
    let brandPrefix = 'STY';
    if (brandCategoryId) {
      const brandCategory = await this.prisma.brand_categories.findUnique({
        where: { id: brandCategoryId },
        select: { styleCodePrefix: true, brandName: true },
      });
      if (brandCategory?.styleCodePrefix) {
        brandPrefix = brandCategory.styleCodePrefix.toUpperCase();
      }
    }

    // Get category prefix (e.g., "KUR")
    let catPrefix = '';
    if (productCategoryId) {
      const category = await this.prisma.product_category_master.findUnique({
        where: { id: productCategoryId },
        select: { codePrefix: true, code: true },
      });
      if (category?.codePrefix) {
        catPrefix = category.codePrefix.toUpperCase();
      } else if (category?.code) {
        // Fallback: use first 3 chars of category code
        catPrefix = category.code.substring(0, 3).toUpperCase();
        logWarn(
          'Product category has no codePrefix — falling back to first 3 chars of code; style code sequences may merge across categories sharing this prefix',
          { productCategoryId, catPrefix }
        );
      }
    }

    // Build the prefix
    const prefix = `${brandPrefix}${catPrefix}`;

    // Get next sequence for this prefix combination.
    // Scan ALL rows (including inactive) so soft-deleted codes are never re-minted.
    // Numeric max over suffixes (not `orderBy styleCode desc` + parseInt) fixes two bugs:
    // 1. Lexicographic wedge at 1000: "999" sorts above "1000" as a string, so the old
    //    query kept returning 999 and re-minting the same next code forever.
    // 2. Prefix-overlap NaN corruption: with prefix "EBW", a row "EBWKUR001" sorted last
    //    and parseInt("KUR001") = NaN silently reset the sequence.
    const existingCodes = await this.prisma.styles.findMany({
      where: { styleCode: { startsWith: prefix } },
      select: { styleCode: true },
    });

    let maxNumeric = 0;
    for (const row of existingCodes) {
      const suffix = row.styleCode.slice(prefix.length);
      // Only consider purely-numeric suffixes; skips codes from overlapping prefixes
      if (!/^\d+$/.test(suffix)) continue;
      const parsed = parseInt(suffix, 10);
      if (parsed > maxNumeric) maxNumeric = parsed;
    }
    const seq = maxNumeric + 1;

    return `${prefix}${seq.toString().padStart(3, '0')}`;
  }

  /**
   * Get the next style code preview (for frontend display before save)
   * @param brandCategoryId - The brand category ID (determines brand prefix like "EBW")
   * @param productCategoryId - The product category ID (determines category prefix like "KUR")
   */
  async getNextStyleCode(
    brandCategoryId?: string | null,
    productCategoryId?: string | null
  ): Promise<{
    nextCode: string;
    brandPrefix: string;
    categoryPrefix: string;
  }> {
    let brandPrefix = 'STY';
    let categoryPrefix = '';

    if (brandCategoryId) {
      const brandCategory = await this.prisma.brand_categories.findUnique({
        where: { id: brandCategoryId },
        select: { styleCodePrefix: true },
      });
      if (brandCategory?.styleCodePrefix) {
        brandPrefix = brandCategory.styleCodePrefix.toUpperCase();
      }
    }

    if (productCategoryId) {
      const category = await this.prisma.product_category_master.findUnique({
        where: { id: productCategoryId },
        select: { codePrefix: true, code: true },
      });
      if (category?.codePrefix) {
        categoryPrefix = category.codePrefix.toUpperCase();
      } else if (category?.code) {
        categoryPrefix = category.code.substring(0, 3).toUpperCase();
        logWarn(
          'Product category has no codePrefix — falling back to first 3 chars of code; style code sequences may merge across categories sharing this prefix',
          { productCategoryId, categoryPrefix }
        );
      }
    }

    const nextCode = await this.generateStyleCode(brandCategoryId, productCategoryId);

    return { nextCode, brandPrefix, categoryPrefix };
  }

  /**
   * Look up componentMasterId by componentName (case-insensitive)
   * Returns null if no match found
   */
  private async lookupComponentMasterId(componentName: string): Promise<string | null> {
    const master = await this.prisma.component_masters.findFirst({
      where: {
        name: {
          equals: componentName,
          mode: 'insensitive',
        },
        isActive: true,
      },
      select: { id: true },
    });
    return master?.id || null;
  }

  // ============================================
  // Create Methods
  // ============================================

  /**
   * Create style with all relations (components, fabrics, processes, BOM, etc.)
   */
  async createWithRelations(data: CreateStyleDTO, userId: string): Promise<styles> {
    logDebug('Creating style with relations', { styleCode: data.styleCode });

    // Auto-generate style code if not provided
    let styleCode = data.styleCode;
    if (!styleCode) {
      // Use brandCategoryId for style code generation (prefix comes from brand_categories)
      styleCode = await this.generateStyleCode(data.brandCategoryId, data.productCategoryId);
      logDebug('Auto-generated style code', { styleCode });
    }

    // Validation - only styleCode is required (and it's auto-generated)
    if (!styleCode) {
      throw new ValidationError('styleCode is required (auto-generated if not provided)');
    }
    if (data.status !== 'DRAFT' && !data.customerName) {
      throw new ValidationError('Customer name is required for non-draft styles');
    }

    // Duplicate style-code check happens at create time (see the dup-check + retry loop
    // below) so that auto-generated codes can regenerate on collision.

    // Load customer accessories preset if provided
    // Skip if frontend already sends resolved accessories (avoids duplicates)
    const presetAccessories =
      data.accessories && data.accessories.length > 0
        ? []
        : await this.loadPresetAccessories(data.customerAccessoriesPresetId);

    // Combine material BOM with preset accessories
    // Support both new simplified trims format and legacy materialBOM format
    const combinedMaterialBOM = this.buildCombinedMaterialBOM(
      data.materialBOM || [],
      presetAccessories,
      data.trims, // New simplified trims format
      data.accessories // New accessories format
    );

    logDebug('Combined material BOM', { count: combinedMaterialBOM.length });

    // Create style with nested relations
    // Generate internal code for new style
    const internalCode = await this.generateInternalCode();

    // Pre-process components to look up componentMasterId
    const componentsWithMasterIds =
      data.components && data.components.length > 0
        ? await Promise.all(
            data.components.map(async (comp: StyleComponentInput, idx: number) => {
              const componentMasterId = await this.lookupComponentMasterId(comp.componentName);
              return {
                id: randomUUID(),
                componentName: comp.componentName,
                componentType: comp.componentType || 'OTHER',
                componentMasterId, // Set FK if found, null otherwise
                sortOrder: idx,
                // Create nested fabrics if provided (deduplicated to prevent duplicate entries)
                ...(comp.fabrics && comp.fabrics.length > 0
                  ? {
                      style_fabrics: {
                        create: deduplicateStyleFabrics(comp.fabrics).map((fab: StyleFabricInput) => ({
                          id: randomUUID(),
                          fabricId: fab.fabricId || null,
                          fabricName: fab.fabricName || fab.greigeName || '',
                          fabricType: fab.fabricType || 'GENERIC',
                          genericGreigeName: fab.genericGreigeName || null,
                          fabricFinishType: (fab.fabricFinishType as 'DYED' | 'PRINTED' | 'YARN_DYED' | 'RAW') || null,
                          quantityNeeded: fab.quantityNeeded ? parseFloat(String(fab.quantityNeeded)) : 0,
                          notes: fab.notes || null,
                          // Embroidery support
                          hasEmbroidery: fab.hasEmbroidery || false,
                          // Use embroidery relation connect if embroideryId is provided
                          ...(fab.embroideryId ? { embroidery: { connect: { id: fab.embroideryId } } } : {}),
                          // Width tracking (field renamed to cutableWidth in schema)
                          cutableWidth: fab.usableWidth ? parseFloat(String(fab.usableWidth)) : null,
                          // Cost tracking
                          fabricCostPerMeter: fab.fabricCostPerMeter
                            ? parseFloat(String(fab.fabricCostPerMeter))
                            : null,
                          embroideryCostPerMeter: fab.embroideryCostPerMeter
                            ? parseFloat(String(fab.embroideryCostPerMeter))
                            : null,
                          totalCostPerMeter: fab.totalCostPerMeter ? parseFloat(String(fab.totalCostPerMeter)) : null,
                          // CAD control
                          allowCombinedCutting: fab.allowCombinedCutting !== false, // Default true
                          // Design/Color identification
                          printDesign: fab.printDesign || null,
                          colorMasterId: fab.colorMasterId || null,
                          // Pattern part association
                          ...(fab.patternPartIds && fab.patternPartIds.length > 0
                            ? {
                                stylePatternParts: {
                                  create: fab.patternPartIds.map((partId: string) => ({
                                    id: randomUUID(),
                                    patternPartId: partId,
                                    quantity: 1,
                                    goesToEmbroidery: fab.hasEmbroidery || false,
                                  })),
                                },
                              }
                            : {}),
                        })),
                      },
                    }
                  : {}),
              };
            })
          )
        : [];

    // Build nested components create
    const componentsCreate = componentsWithMasterIds.length > 0 ? { create: componentsWithMasterIds } : undefined;

    // Build nested processes create if provided - filter out processes without valid processType
    const validProcesses = (data.processes || []).filter((proc: StyleProcessInput) => proc.processType);
    const processesCreate =
      validProcesses.length > 0
        ? {
            create: validProcesses.map((proc: StyleProcessInput, idx: number) => ({
              id: randomUUID(),
              processName: proc.processName || proc.processType || '',
              processType: proc.processType as
                | 'PRINTING'
                | 'DYEING'
                | 'EMBROIDERY'
                | 'CUTTING'
                | 'STITCHING'
                | 'FINISHING'
                | 'WASHING'
                | 'TRANSPORTATION'
                | 'HANDWORK'
                | 'SMOCKING',
              isRequired: proc.isRequired !== false,
              supplierId: proc.supplierId || null,
              estimatedCost: proc.estimatedCost ? parseFloat(String(proc.estimatedCost)) : null,
              estimatedDays: proc.estimatedDays || null,
              notes: proc.notes || proc.description || null, // Accept both field names
              sortOrder: idx,
            })),
          }
        : undefined;

    // Build nested material BOM create for trims and accessories
    // Filter out BOM items that require a materialId but don't have one
    // (THREAD is a special case - can have null materialId for auto-thread)
    const validMaterialBOM = combinedMaterialBOM.filter((bom) => {
      // Thread can have null materialId (auto-thread placeholder)
      if (bom.materialType === 'THREAD') return true;
      // All other types require a valid materialId
      return bom.materialId && bom.materialId.trim() !== '';
    });

    logDebug(`Filtered BOM: ${combinedMaterialBOM.length} -> ${validMaterialBOM.length} valid items`);

    // BUG-S3 fix: Validate FK references BEFORE creating BOM records (matching UPDATE path behavior)
    // Map to store resolved packaging IDs (materialId -> packagingId)
    const resolvedPackagingIds = new Map<string, string>();

    for (const bom of validMaterialBOM) {
      if (bom.materialType === 'LABEL' && bom.materialId) {
        const exists = await this.prisma.label_master.findUnique({
          where: { id: bom.materialId },
          select: { id: true },
        });
        if (!exists) {
          throw new ValidationError(`Label with ID "${bom.materialId}" not found. Please select a valid label.`);
        }
      }
      if (bom.materialType === 'PACKAGING' && bom.materialId) {
        // For PACKAGING, materialId could be:
        // 1. A direct packagingId (from preset items that are already resolved)
        // 2. A materials table ID (from manually added items via unified materials)

        // First, check if it's a direct packaging_master ID (preset items)
        const directPackaging = await this.prisma.packaging_master.findUnique({
          where: { id: bom.materialId },
          select: { id: true, packagingName: true },
        });

        if (directPackaging) {
          // It's already a resolved packagingId from preset
          resolvedPackagingIds.set(bom.materialId, directPackaging.id);
          logDebug(
            `[CREATE] Packaging already resolved (preset): ${bom.materialId} (${directPackaging.packagingName})`
          );
        } else {
          // Not a direct packaging ID, try to resolve from materials table
          const material = await this.prisma.materials.findUnique({
            where: { id: bom.materialId },
            select: { packagingId: true, name: true },
          });
          if (!material?.packagingId) {
            throw new ValidationError(
              `Packaging material "${bom.materialId}" not found or has no packaging reference. Please select valid packaging.`
            );
          }
          // Store the resolved packagingId for use when creating the BOM record
          resolvedPackagingIds.set(bom.materialId, material.packagingId);
          logDebug(
            `[CREATE] Resolved packaging from materials: ${bom.materialId} -> ${material.packagingId} (${material.name})`
          );
        }
      }
      // Validate BUTTON
      if (bom.materialType === 'BUTTON' && bom.materialId) {
        const exists = await this.prisma.button_master.findUnique({
          where: { id: bom.materialId },
          select: { id: true },
        });
        if (!exists) {
          throw new ValidationError(`Button with ID "${bom.materialId}" not found. Please select a valid button.`);
        }
      }
      // Validate ZIPPER
      if (bom.materialType === 'ZIPPER' && bom.materialId) {
        const exists = await this.prisma.zipper_master.findUnique({
          where: { id: bom.materialId },
          select: { id: true },
        });
        if (!exists) {
          throw new ValidationError(`Zipper with ID "${bom.materialId}" not found. Please select a valid zipper.`);
        }
      }
      // Validate ELASTIC
      if (bom.materialType === 'ELASTIC' && bom.materialId) {
        const exists = await this.prisma.elastic_master.findUnique({
          where: { id: bom.materialId },
          select: { id: true },
        });
        if (!exists) {
          throw new ValidationError(`Elastic with ID "${bom.materialId}" not found. Please select a valid elastic.`);
        }
      }
      // Validate LACE
      if (bom.materialType === 'LACE' && bom.materialId) {
        const exists = await this.prisma.lace_master.findUnique({
          where: { id: bom.materialId },
          select: { id: true },
        });
        if (!exists) {
          throw new ValidationError(`Lace with ID "${bom.materialId}" not found. Please select a valid lace.`);
        }
      }
      // Validate THREAD (if materialId is provided; auto-thread can be null)
      if (bom.materialType === 'THREAD' && bom.materialId) {
        const exists = await this.prisma.thread_master.findUnique({
          where: { id: bom.materialId },
          select: { id: true },
        });
        if (!exists) {
          throw new ValidationError(`Thread with ID "${bom.materialId}" not found. Please select a valid thread.`);
        }
      }
    }

    const materialBomCreate =
      validMaterialBOM.length > 0
        ? {
            create: validMaterialBOM.map((bom, idx) => {
              // For PACKAGING, use the resolved packagingId from the validation step
              const resolvedPackagingId =
                bom.materialType === 'PACKAGING' && bom.materialId
                  ? resolvedPackagingIds.get(bom.materialId) || null
                  : null;

              return {
                id: randomUUID(),
                materialType: bom.materialType,
                materialId: bom.materialId || null,
                usageCategory: bom.usageCategory || 'GARMENT_TRIM',
                // Set the appropriate FK based on materialType
                // Use null if materialId is empty/undefined to avoid FK violations
                buttonId: bom.materialType === 'BUTTON' && bom.materialId ? bom.materialId : null,
                threadId: bom.materialType === 'THREAD' && bom.materialId ? bom.materialId : null,
                zipperId: bom.materialType === 'ZIPPER' && bom.materialId ? bom.materialId : null,
                elasticId: bom.materialType === 'ELASTIC' && bom.materialId ? bom.materialId : null,
                laceId: bom.materialType === 'LACE' && bom.materialId ? bom.materialId : null,
                labelId: bom.materialType === 'LABEL' && bom.materialId ? bom.materialId : null,
                packagingId: resolvedPackagingId,
                // Generic trim FK fields (DRAWSTRING, HOOK_EYE, SNAP_BUTTON, etc.)
                ...buildGenericTrimFkFields(bom.materialType, bom.materialId || null),
                componentName: bom.componentName || null,
                quantityPerGarment:
                  Number(bom.quantityPerGarment || 0) > 0
                    ? parseFloat(String(bom.quantityPerGarment))
                    : bom.materialType === 'LABEL' || bom.materialType === 'PACKAGING'
                      ? 1
                      : 0,
                unit: bom.unit || Unit.PIECE,
                unitPrice: bom.unitPrice ? parseFloat(String(bom.unitPrice)) : null,
                totalCost: bom.totalCost ? parseFloat(String(bom.totalCost)) : null,
                notes: bom.notes || null,
                sortOrder: idx,
              };
            }),
          }
        : undefined;

    // Dup-check + create with retry: when the styleCode was auto-generated, a collision
    // (racing create or a stale sequence) regenerates the code and retries instead of
    // surfacing a 409. Client-supplied codes (e.g. import) keep single-attempt behavior —
    // the caller chose the code, so a collision must surface as ConflictError.
    const wasAutoGenerated = !data.styleCode;
    const maxAttempts = wasAutoGenerated ? 3 : 1;

    const runDupCheckAndCreate = async (code: string) => {
      // Check for duplicate style code (only among active styles)
      const existingStyle = await this.prisma.styles.findFirst({
        where: {
          styleCode: code,
          isActive: true,
        },
        select: {
          id: true,
          styleCode: true,
          styleName: true,
        },
      });

      if (existingStyle) {
        throw new ConflictError('Style code already exists');
      }

      // Check for duplicate buyer style reference (only among active styles)
      if (data.buyerStyleRef?.trim()) {
        const existingBuyerRef = await this.prisma.styles.findFirst({
          where: {
            buyerStyleRef: data.buyerStyleRef.trim(),
            isActive: true,
          },
          select: {
            id: true,
            styleCode: true,
          },
        });

        if (existingBuyerRef) {
          throw new ConflictError(
            `Buyer reference "${data.buyerStyleRef}" already exists on style ${existingBuyerRef.styleCode}`
          );
        }
      }

      return this.prisma.styles.create({
        data: {
          id: randomUUID(),
          internalCode,
          styleCode: code,
          styleName: data.styleName,
          buyerStyleRef: data.buyerStyleRef || null,
          customerId: data.customerId || null,
          customerName: data.customerName || 'Draft',
          brandName: data.brandName || 'Draft',
          brandCategoryId: data.brandCategoryId || null,
          productCategoryId: data.productCategoryId || null,
          description: data.description,
          season: data.season,
          seasonId: data.seasonId || null,
          gender: (data.gender as Gender) || null,
          createdById: userId,
          specifications: data.specifications || data.category || null,
          cadStatus: 'PENDING',
          // BUG-S10: != null + '' check preserves a legitimate 0 (truthiness turned 0 into null)
          costPrice:
            data.costPrice != null && String(data.costPrice) !== '' ? parseFloat(String(data.costPrice)) : null,
          sellingPrice:
            data.sellingPrice != null && String(data.sellingPrice) !== ''
              ? parseFloat(String(data.sellingPrice))
              : null,
          // BUG-S6: column added 2026-08-02 — field was Zod-validated then silently discarded
          expectedOrderQuantity:
            data.expectedOrderQuantity != null && String(data.expectedOrderQuantity) !== ''
              ? parseInt(String(data.expectedOrderQuantity), 10)
              : null,
          hsnCode: data.hsnCode || null,
          productTaxRule: data.productTaxRule || null,
          accountingSKU: data.accountingSKU || null,
          accountingUnit: data.accountingUnit || null,
          bulletPoints: data.bulletPoints || null,
          imageUrl: data.imageUrl || null,
          // Nested creates
          ...(componentsCreate ? { style_components: componentsCreate } : {}),
          ...(processesCreate ? { style_processes: processesCreate } : {}),
          ...(materialBomCreate ? { style_material_bom: materialBomCreate } : {}),
        } as Prisma.stylesUncheckedCreateInput,
        include: {
          brand_categories: true,
          product_category: true,
          style_components: {
            include: {
              style_fabrics: true,
              style_accessories: true,
            },
          },
          style_processes: {
            include: {
              supplier: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  supplierCategories: true,
                },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
          style_costing: true,
          style_material_bom: true,
          style_value_additions: true,
          style_packaging: true,
          style_variants: true,
        },
      });
    };

    let style: Awaited<ReturnType<typeof runDupCheckAndCreate>> | null = null;
    for (let attempt = 1; style === null; attempt++) {
      try {
        style = await runDupCheckAndCreate(styleCode);
      } catch (error: unknown) {
        // P2002 target arrives once the harden_code_uniqueness partial unique index lands;
        // ConflictError comes from the pre-create dup-check above.
        const p2002Target =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
            ? String(error.meta?.target ?? '')
            : null;
        const isStyleCodeCollision =
          error instanceof ConflictError ||
          (p2002Target !== null &&
            (p2002Target === '' ||
              p2002Target.toLowerCase().includes('stylecode') ||
              p2002Target.includes('style_code')));
        if (!isStyleCodeCollision || attempt >= maxAttempts) {
          throw error;
        }
        logWarn('Auto-generated style code collided — regenerating and retrying', { styleCode, attempt });
        styleCode = await this.generateStyleCode(data.brandCategoryId, data.productCategoryId);
      }
    }

    // Handle SKU variants if provided (after style creation)
    if (data.skuVariants && data.skuVariants.length > 0) {
      const validVariants = (data.skuVariants as SKUVariantInput[])
        .filter((v) => v.sku && v.sku.trim() !== '')
        .reduce((acc, variant) => {
          // Keep only the first occurrence of each SKU (deduplicate)
          if (!acc.some((v) => v.sku === variant.sku)) {
            acc.push(variant);
          }
          return acc;
        }, [] as SKUVariantInput[]);

      for (const variant of validVariants) {
        // Get or create size option
        let sizeOption = await this.prisma.size_options.findFirst({
          where: { styleId: style.id, sizeName: variant.size },
        });

        if (!sizeOption) {
          sizeOption = await this.prisma.size_options.create({
            data: {
              id: randomUUID(),
              styleId: style.id,
              sizeName: variant.size,
              sizeCode: variant.size,
              sortOrder: getSizeOrder(variant.size),
              isActive: true,
            },
          });
        }

        // Create style_variant
        await this.prisma.style_variants.create({
          data: {
            id: randomUUID(),
            styleId: style.id,
            sizeId: sizeOption.id,
            sizeName: variant.size,
            sku: variant.sku,
            barcode: variant.barcode || null,
            accountingSKU: variant.accountingSKU || null,
            isActive: variant.isActive !== false,
            sortOrder: getSizeOrder(variant.size),
          },
        });
      }

      logDebug('SKU variants created', { count: validVariants.length, styleId: style.id });
    }

    logInfo('Style created successfully', {
      id: style.id,
      styleCode: style.styleCode,
      components: data.components?.length || 0,
    });
    return style;
  }

  // ============================================
  // Read Methods
  // ============================================

  /**
   * Find all styles with additional filters
   */
  async findAllWithFilters(options: StyleQueryOptions): Promise<PaginatedResult<styles>> {
    const additionalFilters: AdditionalFilters = {};

    // Filter by customerId (exact match) - WS1 added the FK to styles table
    if (options.customerId) {
      additionalFilters.customerId = options.customerId;
    }

    if (options.customerName) {
      additionalFilters.customerName = { contains: options.customerName, mode: 'insensitive' };
    }

    if (options.brandName) {
      additionalFilters.brandName = { contains: options.brandName, mode: 'insensitive' };
    }

    if (options.season) {
      additionalFilters.season = options.season;
    }

    if (options.status) {
      additionalFilters.status = options.status;
    }

    // Support cadStatus filter (PENDING, IN_PROGRESS, APPROVED)
    if (options.cadStatus) {
      additionalFilters.cadStatus = options.cadStatus;
    }

    return this.findAll(
      {
        page: options.page || 1,
        limit: options.limit || 10,
        search: options.search,
        sortBy: options.sortBy || 'createdAt',
        sortOrder: options.sortOrder || 'desc',
      },
      additionalFilters
    );
  }

  /**
   * Find all deleted (archived) styles
   */
  async findAllDeleted(options: { page?: number; limit?: number; search?: string }): Promise<PaginatedResult<styles>> {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.stylesWhereInput = {
      isActive: false,
    };

    if (options.search) {
      where.OR = [
        { styleCode: { contains: options.search, mode: 'insensitive' } },
        { buyerStyleRef: { contains: options.search, mode: 'insensitive' } },
        { styleName: { contains: options.search, mode: 'insensitive' } },
        { customerName: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.styles.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.styles.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Restore a soft-deleted style (collision guard).
   * Deletes are soft (isActive=false), so a deleted style's code may have been re-minted
   * or re-used by a newer ACTIVE style. Restoring blindly would leave two active styles
   * sharing one styleCode — block that before delegating to the base restore.
   */
  async restore(id: string): Promise<styles> {
    const deleted = await this.prisma.styles.findUnique({
      where: { id },
      select: { styleCode: true, isActive: true },
    });

    if (deleted && !deleted.isActive) {
      const activeDuplicate = await this.prisma.styles.findFirst({
        where: {
          styleCode: deleted.styleCode,
          isActive: true,
          id: { not: id },
        },
        select: { id: true },
      });
      if (activeDuplicate) {
        throw new ConflictError(`An active style already uses code ${deleted.styleCode} — cannot restore`);
      }
    }

    // Base restore handles not-found (404) and already-active (400) cases
    return super.restore(id);
  }

  /**
   * Find styles by production stage
   */
  async findByProductionStage(stage: ProductionStage, options: PaginationOptions): Promise<PaginatedResult<styles>> {
    const additionalFilters: AdditionalFilters = {
      productionTracking: {
        some: {
          currentStage: stage,
          piecesInStage: { gt: 0 },
        },
      },
    };

    return this.findAll(options, additionalFilters);
  }

  /**
   * Get style with full details including color/size options
   */
  async getFullDetails(id: string): Promise<styles> {
    const style = await this.prisma.styles.findUnique({
      where: { id },
      include: {
        color_options: { orderBy: { sortOrder: 'asc' } },
        size_options: { orderBy: { sortOrder: 'asc' } },
        brand_categories: true, // Include brand category for edit form
        product_category: true, // Include product category for edit form
        season_master: true, // Include season for edit form
        style_components: {
          include: {
            style_fabrics: {
              include: {
                embroidery: {
                  select: {
                    id: true,
                    embroideryCode: true,
                    designName: true,
                    designImage: true,
                    stitchCount: true,
                    threadColors: true,
                    cutableWidth: true,
                    costPerMeter: true,
                    supplier: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
                fabric: {
                  select: {
                    id: true,
                    fabricCode: true,
                    fabricName: true,
                    colorName: true,
                    genericGreigeName: true,
                    finishType: true,
                    printDesign: true,
                    colorMasterId: true,
                  },
                },
                colorMaster: {
                  select: {
                    id: true,
                    colorCode: true,
                    colorName: true,
                    hexCode: true,
                  },
                },
                stylePatternParts: {
                  include: {
                    patternPart: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                      },
                    },
                  },
                },
                selectedGreige: {
                  select: {
                    id: true,
                    greigeCode: true,
                    greigeName: true,
                    greigeWidth: true,
                  },
                },
                // Include CAD rows to get greige and color linked at CAD level
                cadRows: {
                  select: {
                    id: true,
                    greige: {
                      select: {
                        id: true,
                        greigeCode: true,
                        greigeName: true,
                        greigeWidth: true,
                      },
                    },
                    batchGroupColor: {
                      select: {
                        id: true,
                        colorCode: true,
                        colorName: true,
                      },
                    },
                  },
                  take: 1, // Only need first CAD row for greige/color info
                },
              },
            },
            style_accessories: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
        style_processes: {
          include: {
            supplier: {
              select: {
                id: true,
                code: true,
                name: true,
                supplierCategories: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        style_costing: true,
        style_production_tracking: true,
        style_value_additions: true,
        style_packaging: true,
        style_variants: { orderBy: { sizeName: 'asc' } },
        style_material_bom: {
          include: {
            lace_master: true,
            button_master: true,
            thread_master: true,
            zipper_master: true,
            elastic_master: true,
            label_master: true,
            packaging_master: true,
            machine_part_master: true,
            other_material_master: true,
            // Generic trim masters
            hook_eye_master: true,
            snap_button_master: true,
            buckle_master: true,
            belt_master: true,
            velcro_master: true,
            drawstring_master: true,
            ribbon_master: true,
            sequin_master: true,
            bead_master: true,
            motif_master: true,
            interlining_master: true,
            padding_master: true,
            other_fastener_master: true,
            other_tape_master: true,
            other_decorative_master: true,
            other_functional_master: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!style) {
      throw new NotFoundError('Style', id);
    }

    return style;
  }

  /**
   * Get approved fabric costing rates for a style
   * Returns the approved fabric_width_cad records with totalCostPerMeter
   * Used by Cost Sheet to auto-populate fabric rates from approved fabric costing
   */
  async getApprovedFabricCostingRates(styleId: string): Promise<
    {
      styleFabricId: string | null;
      totalCostPerMeter: number | null;
      cadMeters: number | null;
      cutableWidth: number | null;
    }[]
  > {
    const approvedOptions = await this.prisma.fabric_width_cad.findMany({
      where: {
        costingStyleId: styleId,
        purpose: 'COSTING',
        // PRICE approval (two-owner split) — these rates feed the cost sheet
        costingApprovalStatus: 'APPROVED',
        totalCostPerMeter: { not: null },
      },
      select: {
        styleFabricId: true,
        totalCostPerMeter: true,
        cadMeters: true,
        cutableWidth: true,
      },
      orderBy: {
        updatedAt: 'desc', // Get the most recently updated first
      },
    });

    return approvedOptions.map((opt) => ({
      styleFabricId: opt.styleFabricId,
      totalCostPerMeter: opt.totalCostPerMeter ? Number(opt.totalCostPerMeter) : null,
      cadMeters: opt.cadMeters ? Number(opt.cadMeters) : null,
      cutableWidth: opt.cutableWidth ? Number(opt.cutableWidth) : null,
    }));
  }

  /**
   * Get styles by style codes (for multi-select components)
   * Returns minimal data needed for selection
   */
  async getByStyleCodes(
    codes: string[]
  ): Promise<{ id: string; styleCode: string; buyerStyleRef: string | null; styleName: string }[]> {
    if (codes.length === 0) return [];

    const styles = await this.prisma.styles.findMany({
      where: {
        styleCode: { in: codes },
        isActive: true,
      },
      select: {
        id: true,
        styleCode: true,
        buyerStyleRef: true,
        styleName: true,
      },
    });

    return styles;
  }

  // ============================================
  // Update Methods
  // ============================================

  /**
   * Update style with relations
   */
  async updateWithRelations(id: string, data: UpdateStyleDTO): Promise<styles> {
    logDebug('Updating style', { id, components: data.components?.length, processes: data.processes?.length });

    // Verify style exists
    await this.findByIdOrThrow(id);

    // Check for duplicate buyer style reference (only among OTHER active styles)
    if (data.buyerStyleRef?.trim()) {
      const existingBuyerRef = await this.prisma.styles.findFirst({
        where: {
          buyerStyleRef: data.buyerStyleRef.trim(),
          isActive: true,
          id: { not: id }, // Exclude current style
        },
        select: {
          id: true,
          styleCode: true,
        },
      });

      if (existingBuyerRef) {
        throw new ConflictError(
          `Buyer reference "${data.buyerStyleRef}" already exists on style ${existingBuyerRef.styleCode}`
        );
      }
    }

    // Identity key used to match a pre-edit style_fabric to its recreated twin
    // (component replacement below deletes + recreates style_fabrics with new IDs)
    const fabricIdentityKey = (f: {
      componentName?: string | null;
      fabricId?: string | null;
      genericGreigeName?: string | null;
      fabricFinishType?: string | null;
      printDesign?: string | null;
      colorMasterId?: string | null;
    }) =>
      [
        (f.componentName || '').toLowerCase(),
        f.fabricId || '',
        (f.genericGreigeName || '').toLowerCase(),
        f.fabricFinishType || '',
        f.printDesign || '',
        f.colorMasterId || '',
      ].join('|');

    // Use transaction to handle all updates atomically
    return this.prisma.$transaction(async (tx) => {
      // Pre-edit snapshot of CAD links + fabric identities, captured BEFORE the unlink
      // below wipes styleFabricId. Used to restore exact links after recreation —
      // including combined-cutting rows (combinedFabricIds must be rewritten to the
      // new IDs) and fabric-master rows (which have no greige to match by).
      let preEditCadLinks: Array<{
        id: string;
        styleFabricId: string | null;
        isCombinedCutting: boolean;
        combinedFabricIds: string | null;
      }> = [];
      const preEditFabricIdentity = new Map<string, string>(); // old style_fabric id -> identity key

      // Handle components replacement if provided
      if (data.components !== undefined) {
        // First get existing style_fabrics for all components
        const existingComponents = await tx.style_components.findMany({
          where: { styleId: id },
          select: { id: true },
        });

        // Get all existing style_fabrics with identity fields to preserve CAD/costing data
        // Fixed: Single batch query instead of N+1 loop
        const existingFabrics = await tx.style_fabrics.findMany({
          where: { componentId: { in: existingComponents.map((c) => c.id) } },
          select: {
            id: true,
            fabricId: true,
            genericGreigeName: true,
            fabricFinishType: true,
            printDesign: true,
            colorMasterId: true,
            style_components: { select: { componentName: true } },
          },
        });
        const existingFabricIds = existingFabrics.map((f) => f.id);
        for (const f of existingFabrics) {
          preEditFabricIdentity.set(
            f.id,
            fabricIdentityKey({
              componentName: f.style_components?.componentName,
              fabricId: f.fabricId,
              genericGreigeName: f.genericGreigeName,
              fabricFinishType: f.fabricFinishType,
              printDesign: f.printDesign,
              colorMasterId: f.colorMasterId,
            })
          );
        }

        // Snapshot which CAD row pointed at which fabric before the unlink below
        if (existingFabricIds.length > 0) {
          preEditCadLinks = await tx.fabric_width_cad.findMany({
            where: { styleFabricId: { in: existingFabricIds } },
            select: { id: true, styleFabricId: true, isCombinedCutting: true, combinedFabricIds: true },
          });
        }

        // CRITICAL: Unlink fabric_width_cad records BEFORE deleting style_fabrics
        // This preserves CAD planning and costing data that was approved
        // Note: Only fabric_width_cad has nullable styleFabricId - other tables will cascade delete
        if (existingFabricIds.length > 0) {
          const unlinkResult = await tx.fabric_width_cad.updateMany({
            where: { styleFabricId: { in: existingFabricIds } },
            data: { styleFabricId: null },
          });

          if (unlinkResult.count > 0) {
            logDebug(`[UPDATE] Preserved ${unlinkResult.count} CAD/costing records by unlinking from style_fabrics`);
          }
        }

        // Preserve pattern parts: capture before cascade delete
        // style_pattern_parts has onDelete: Cascade so they'd be lost without this
        const existingComponentsWithParts = await tx.style_components.findMany({
          where: { styleId: id },
          include: { style_fabrics: { include: { stylePatternParts: true } } },
        });
        type SavedPP = { patternPartId: string; quantity: number; goesToEmbroidery: boolean; notes: string | null };
        const savedPatternPartsByComponent = new Map<string, SavedPP[]>();
        for (const comp of existingComponentsWithParts) {
          const parts: SavedPP[] = comp.style_fabrics.flatMap((f) =>
            f.stylePatternParts.map((pp) => ({
              patternPartId: pp.patternPartId,
              quantity: pp.quantity,
              goesToEmbroidery: pp.goesToEmbroidery,
              notes: pp.notes,
            }))
          );
          if (parts.length > 0) {
            savedPatternPartsByComponent.set(comp.componentName.toLowerCase(), parts);
          }
        }

        // Now safe to delete style_fabrics - CAD data is preserved
        // Fixed: Single batch delete instead of N+1 loop
        if (existingComponents.length > 0) {
          await tx.style_fabrics.deleteMany({
            where: { componentId: { in: existingComponents.map((c) => c.id) } },
          });
        }

        // Delete existing components
        await tx.style_components.deleteMany({
          where: { styleId: id },
        });

        // Create new components if provided
        if (data.components.length > 0) {
          for (let idx = 0; idx < data.components.length; idx++) {
            const comp = data.components[idx] as StyleComponentInput;
            const componentId = randomUUID();

            // Look up componentMasterId by name
            const componentMaster = await tx.component_masters.findFirst({
              where: {
                name: { equals: comp.componentName, mode: 'insensitive' },
                isActive: true,
              },
              select: { id: true },
            });

            await tx.style_components.create({
              data: {
                id: componentId,
                styleId: id,
                componentName: comp.componentName,
                componentType: comp.componentType || 'OTHER',
                componentMasterId: componentMaster?.id || null,
                sortOrder: idx,
              },
            });

            // Create nested fabrics if provided (deduplicated to prevent duplicate entries)
            let firstFabricIdForComponent: string | null = null;
            if (comp.fabrics && comp.fabrics.length > 0) {
              const uniqueFabrics = deduplicateStyleFabrics(comp.fabrics as StyleFabricInput[]);
              for (const fab of uniqueFabrics) {
                const newFabricId = randomUUID();
                if (!firstFabricIdForComponent) firstFabricIdForComponent = newFabricId;
                await tx.style_fabrics.create({
                  data: {
                    id: newFabricId,
                    fabricId: fab.fabricId || null,
                    fabricName: fab.fabricName || fab.greigeName || '',
                    fabricType: fab.fabricType || 'GENERIC',
                    genericGreigeName: fab.genericGreigeName || null,
                    fabricFinishType: (fab.fabricFinishType as 'DYED' | 'PRINTED' | 'YARN_DYED' | 'RAW') || null,
                    quantityNeeded: fab.quantityNeeded ? parseFloat(String(fab.quantityNeeded)) : 0,
                    notes: fab.notes || null,
                    // Embroidery support
                    hasEmbroidery: fab.hasEmbroidery || false,
                    embroideryId: fab.embroideryId || null,
                    // Width tracking
                    cutableWidth: fab.usableWidth ? parseFloat(String(fab.usableWidth)) : null,
                    // Cost tracking
                    fabricCostPerMeter: fab.fabricCostPerMeter ? parseFloat(String(fab.fabricCostPerMeter)) : null,
                    embroideryCostPerMeter: fab.embroideryCostPerMeter
                      ? parseFloat(String(fab.embroideryCostPerMeter))
                      : null,
                    totalCostPerMeter: fab.totalCostPerMeter ? parseFloat(String(fab.totalCostPerMeter)) : null,
                    // CAD control
                    allowCombinedCutting: fab.allowCombinedCutting !== false, // Default true
                    // Design/Color identification
                    printDesign: fab.printDesign || null,
                    colorMasterId: fab.colorMasterId || null,
                    // Connect to the component
                    componentId: componentId,
                  },
                });

                // Create pattern parts if provided with this fabric
                if (fab.patternPartIds && fab.patternPartIds.length > 0) {
                  for (const partId of fab.patternPartIds) {
                    await tx.style_pattern_parts.create({
                      data: {
                        id: randomUUID(),
                        styleFabricId: newFabricId,
                        patternPartId: partId,
                        quantity: 1,
                        goesToEmbroidery: fab.hasEmbroidery || false,
                      },
                    });
                  }
                }
              }
            }
            // Restore pattern parts (preserved before deletion) to first fabric of this component
            if (firstFabricIdForComponent) {
              const partsToRestore = savedPatternPartsByComponent.get(comp.componentName.toLowerCase()) || [];
              for (const pp of partsToRestore) {
                await tx.style_pattern_parts.create({
                  data: { id: randomUUID(), styleFabricId: firstFabricIdForComponent, ...pp },
                });
              }
            }
          }
        }
      }

      // NOTE: Standalone fabrics[] array handling was REMOVED (2026-04-16)
      // Fabrics are now ONLY handled via components[].fabrics[] (nested)
      // This prevents duplicate data paths that were overwriting each other

      // Re-link orphaned CAD records to new fabrics (after component replacement)
      // This ensures CAD planning data is preserved when style components are updated
      if (data.components !== undefined) {
        const newFabrics = await tx.style_fabrics.findMany({
          where: { style_components: { styleId: id } },
          include: { style_components: { select: { componentName: true } } },
        });

        // Pass 1 — precise re-link via identity: map each pre-edit fabric to its
        // recreated twin (same component + fabric identity) and restore the exact
        // CAD links. This is the only correct path for combined-cutting rows and
        // fabric-master rows, which the greige-name fallback below cannot place.
        const newIdsByIdentity = new Map<string, string[]>();
        for (const f of newFabrics) {
          const key = fabricIdentityKey({
            componentName: f.style_components?.componentName,
            fabricId: f.fabricId,
            genericGreigeName: f.genericGreigeName,
            fabricFinishType: f.fabricFinishType,
            printDesign: f.printDesign,
            colorMasterId: f.colorMasterId,
          });
          if (!newIdsByIdentity.has(key)) newIdsByIdentity.set(key, []);
          newIdsByIdentity.get(key)!.push(f.id);
        }
        const oldToNewFabricId = new Map<string, string>();
        for (const [oldId, key] of preEditFabricIdentity) {
          const candidates = newIdsByIdentity.get(key);
          if (candidates && candidates.length > 0) {
            oldToNewFabricId.set(oldId, candidates.shift() as string);
          }
        }

        let identityRelinked = 0;
        for (const link of preEditCadLinks) {
          const newPrimary = link.styleFabricId ? oldToNewFabricId.get(link.styleFabricId) : undefined;

          // Rewrite combined-cutting coverage through the old→new map (drop stale IDs)
          let newCombinedJson: string | undefined;
          if (link.isCombinedCutting && link.combinedFabricIds) {
            try {
              const oldIds: unknown = JSON.parse(link.combinedFabricIds);
              if (Array.isArray(oldIds)) {
                const mapped = oldIds
                  .map((fid) => (typeof fid === 'string' ? oldToNewFabricId.get(fid) : undefined))
                  .filter((v): v is string => Boolean(v));
                if (mapped.length > 0) newCombinedJson = JSON.stringify(mapped);
              }
            } catch {
              // unparseable JSON — leave as-is
            }
          }

          if (newPrimary || newCombinedJson) {
            await tx.fabric_width_cad.update({
              where: { id: link.id },
              data: {
                ...(newPrimary ? { styleFabricId: newPrimary } : {}),
                ...(newCombinedJson ? { combinedFabricIds: newCombinedJson } : {}),
              },
            });
            identityRelinked++;
          }
        }
        if (identityRelinked > 0) {
          logDebug(`[UPDATE] Re-linked ${identityRelinked} CAD records to recreated fabrics by identity`);
        }

        // Pass 2 — fallback for CADs still orphaned (orphaned before this edit, or the
        // fabric's identity changed in this edit)
        const orphanedCADs = await tx.fabric_width_cad.findMany({
          where: {
            costingStyleId: id,
            styleFabricId: null,
          },
          include: { greige: { select: { genericGreigeName: true } } },
        });

        if (orphanedCADs.length > 0) {
          // Group orphaned CADs by purpose and greige/fabric to distribute correctly
          const cadsByPurpose = new Map<string, typeof orphanedCADs>();
          for (const cad of orphanedCADs) {
            const key = `${cad.purpose}_${cad.greige?.genericGreigeName || cad.fabricId || ''}`;
            if (!cadsByPurpose.has(key)) cadsByPurpose.set(key, []);
            cadsByPurpose.get(key)!.push(cad);
          }

          // Re-link: for each purpose-greige group, distribute CADs across matching fabrics
          for (const [, cads] of cadsByPurpose) {
            const sortedCADs = cads.sort((a, b) => Number(a.cadMeters) - Number(b.cadMeters));
            const genericGreige = cads[0]?.greige?.genericGreigeName?.toLowerCase();
            const cadFabricId = cads[0]?.fabricId;

            // Match by greige name; ready-fabric rows (no greige) match by fabric master
            const matchingFabrics = genericGreige
              ? newFabrics.filter((f) => f.genericGreigeName?.toLowerCase() === genericGreige)
              : cadFabricId
                ? newFabrics.filter((f) => f.fabricId === cadFabricId)
                : [];

            // Distribute CADs across matching fabrics (round-robin if more CADs than fabrics)
            for (let i = 0; i < sortedCADs.length; i++) {
              const cad = sortedCADs[i];
              const fabric = matchingFabrics.length > 0 ? matchingFabrics[i % matchingFabrics.length] : undefined;
              if (fabric) {
                await tx.fabric_width_cad.update({
                  where: { id: cad.id },
                  data: {
                    styleFabricId: fabric.id,
                    componentName: fabric.style_components?.componentName || null,
                  },
                });
              }
            }
          }
          logDebug(`[UPDATE] Re-linked ${orphanedCADs.length} orphaned CAD records to new fabrics`);
        }
      }

      // Handle processes replacement if provided
      if (data.processes !== undefined) {
        await tx.style_processes.deleteMany({
          where: { styleId: id },
        });

        if (data.processes.length > 0) {
          for (let idx = 0; idx < data.processes.length; idx++) {
            const proc = data.processes[idx] as StyleProcessInput;
            // Only create process if processType is valid
            if (proc.processType) {
              await tx.style_processes.create({
                data: {
                  id: randomUUID(),
                  styleId: id,
                  processName: proc.processName || proc.processType,
                  processType: proc.processType as
                    | 'PRINTING'
                    | 'DYEING'
                    | 'EMBROIDERY'
                    | 'CUTTING'
                    | 'STITCHING'
                    | 'FINISHING'
                    | 'WASHING'
                    | 'TRANSPORTATION'
                    | 'HANDWORK'
                    | 'SMOCKING',
                  isRequired: proc.isRequired !== false,
                  supplierId: proc.supplierId || null,
                  estimatedCost: proc.estimatedCost ? parseFloat(String(proc.estimatedCost)) : null,
                  estimatedDays: proc.estimatedDays || null,
                  notes: proc.notes || proc.description || null, // Accept both field names
                  sortOrder: idx,
                },
              });
            }
          }
        }
      }

      // Auto-sync: Ensure EMBROIDERY process exists if any fabric has hasEmbroidery=true
      const styleFabricsForEmbSync = await tx.style_fabrics.findMany({
        where: { style_components: { styleId: id } },
        select: { hasEmbroidery: true },
      });
      const anyFabricHasEmbroidery = styleFabricsForEmbSync.some((f) => f.hasEmbroidery);
      if (anyFabricHasEmbroidery) {
        const existingEmbProcess = await tx.style_processes.findFirst({
          where: { styleId: id, processType: 'EMBROIDERY' },
        });
        if (!existingEmbProcess) {
          await tx.style_processes.create({
            data: {
              id: randomUUID(),
              styleId: id,
              processName: 'Embroidery',
              processType: 'EMBROIDERY',
              isRequired: true,
              sortOrder: 99,
            },
          });
        }
      }

      // Handle SKU variants replacement if provided
      if (data.skuVariants !== undefined) {
        // Delete existing variants (but keep size_options for now)
        await tx.style_variants.deleteMany({
          where: { styleId: id },
        });

        if (data.skuVariants.length > 0) {
          // Filter out variants with empty SKUs and deduplicate by SKU
          const validVariants = (data.skuVariants as SKUVariantInput[])
            .filter((v) => v.sku && v.sku.trim() !== '')
            .reduce((acc, variant) => {
              // Keep only the first occurrence of each SKU
              if (!acc.some((v) => v.sku === variant.sku)) {
                acc.push(variant);
              }
              return acc;
            }, [] as SKUVariantInput[]);

          for (const variant of validVariants) {
            // Get or create size option first
            let sizeOption = await tx.size_options.findFirst({
              where: { styleId: id, sizeName: variant.size },
            });

            if (!sizeOption) {
              sizeOption = await tx.size_options.create({
                data: {
                  id: randomUUID(),
                  styleId: id,
                  sizeName: variant.size,
                  sizeCode: variant.size,
                  sortOrder: getSizeOrder(variant.size),
                  isActive: true,
                },
              });
            }

            // Use upsert to handle any edge cases with existing SKUs
            await tx.style_variants.upsert({
              where: { sku: variant.sku },
              create: {
                id: randomUUID(),
                styleId: id,
                sizeId: sizeOption.id,
                sizeName: variant.size,
                sku: variant.sku,
                barcode: variant.barcode || null,
                accountingSKU: variant.accountingSKU || null,
                isActive: variant.isActive !== false,
                sortOrder: getSizeOrder(variant.size),
              },
              update: {
                styleId: id,
                sizeId: sizeOption.id,
                sizeName: variant.size,
                barcode: variant.barcode || null,
                accountingSKU: variant.accountingSKU || null,
                isActive: variant.isActive !== false,
                sortOrder: getSizeOrder(variant.size),
              },
            });
          }
        }
      }

      // Handle trims and accessories replacement if provided
      if (data.trims !== undefined || data.accessories !== undefined) {
        // Delete existing style_material_bom records
        await tx.style_material_bom.deleteMany({
          where: { styleId: id },
        });

        // Build combined material BOM from trims and accessories
        const combinedMaterialBOM = this.buildCombinedMaterialBOM(
          data.materialBOM || [],
          [], // No preset accessories during update
          data.trims,
          data.accessories
        );

        // Filter out BOM items that require a materialId but don't have one
        // (THREAD is a special case - can have null materialId for auto-thread)
        const validMaterialBOM = combinedMaterialBOM.filter((bom) => {
          // Thread can have null materialId (auto-thread placeholder)
          if (bom.materialType === 'THREAD') return true;
          // All other types require a valid materialId
          return bom.materialId && bom.materialId.trim() !== '';
        });

        logDebug(`[UPDATE] Filtered BOM: ${combinedMaterialBOM.length} -> ${validMaterialBOM.length} valid items`);

        // Validate and resolve material IDs before creating BOM
        // Map to store resolved packaging IDs (materialId -> packagingId)
        const resolvedPackagingIds = new Map<string, string>();

        for (const bom of validMaterialBOM) {
          if (bom.materialType === 'LABEL' && bom.materialId) {
            const exists = await tx.label_master.findUnique({
              where: { id: bom.materialId },
              select: { id: true },
            });
            if (!exists) {
              throw new ValidationError(`Label with ID "${bom.materialId}" not found. Please select a valid label.`);
            }
          }
          if (bom.materialType === 'PACKAGING' && bom.materialId) {
            // For PACKAGING, materialId could be:
            // 1. A direct packagingId (from preset items that are already resolved)
            // 2. A materials table ID (from manually added items via unified materials)

            // First, check if it's a direct packaging_master ID (preset items)
            const directPackaging = await tx.packaging_master.findUnique({
              where: { id: bom.materialId },
              select: { id: true, packagingName: true },
            });

            if (directPackaging) {
              // It's already a resolved packagingId from preset
              resolvedPackagingIds.set(bom.materialId, directPackaging.id);
              logDebug(
                `[UPDATE] Packaging already resolved (preset): ${bom.materialId} (${directPackaging.packagingName})`
              );
            } else {
              // Not a direct packaging ID, try to resolve from materials table
              const material = await tx.materials.findUnique({
                where: { id: bom.materialId },
                select: { packagingId: true, name: true },
              });
              if (!material?.packagingId) {
                throw new ValidationError(
                  `Packaging material "${bom.materialId}" not found or has no packaging reference. Please select valid packaging.`
                );
              }
              // Store the resolved packagingId for use when creating the BOM record
              resolvedPackagingIds.set(bom.materialId, material.packagingId);
              logDebug(
                `[UPDATE] Resolved packaging from materials: ${bom.materialId} -> ${material.packagingId} (${material.name})`
              );
            }
          }
          // BUG-S3 fix: Validate remaining FK references (matching CREATE path behavior)
          if (bom.materialType === 'BUTTON' && bom.materialId) {
            const exists = await tx.button_master.findUnique({
              where: { id: bom.materialId },
              select: { id: true },
            });
            if (!exists) {
              throw new ValidationError(`Button with ID "${bom.materialId}" not found. Please select a valid button.`);
            }
          }
          if (bom.materialType === 'ZIPPER' && bom.materialId) {
            const exists = await tx.zipper_master.findUnique({
              where: { id: bom.materialId },
              select: { id: true },
            });
            if (!exists) {
              throw new ValidationError(`Zipper with ID "${bom.materialId}" not found. Please select a valid zipper.`);
            }
          }
          if (bom.materialType === 'ELASTIC' && bom.materialId) {
            const exists = await tx.elastic_master.findUnique({
              where: { id: bom.materialId },
              select: { id: true },
            });
            if (!exists) {
              throw new ValidationError(
                `Elastic with ID "${bom.materialId}" not found. Please select a valid elastic.`
              );
            }
          }
          if (bom.materialType === 'LACE' && bom.materialId) {
            const exists = await tx.lace_master.findUnique({
              where: { id: bom.materialId },
              select: { id: true },
            });
            if (!exists) {
              throw new ValidationError(`Lace with ID "${bom.materialId}" not found. Please select a valid lace.`);
            }
          }
          if (bom.materialType === 'THREAD' && bom.materialId) {
            const exists = await tx.thread_master.findUnique({
              where: { id: bom.materialId },
              select: { id: true },
            });
            if (!exists) {
              throw new ValidationError(`Thread with ID "${bom.materialId}" not found. Please select a valid thread.`);
            }
          }
        }

        if (validMaterialBOM.length > 0) {
          // Resolved once outside the loop — every row that does not carry its own wastage
          // gets the configured default rather than the DB column default.
          const trimDefaultWastage = await systemSettingsService.getNumberDefault('TRIM_DEFAULT_WASTAGE_PERCENT');
          for (let idx = 0; idx < validMaterialBOM.length; idx++) {
            const bom = validMaterialBOM[idx];

            // For PACKAGING, use the resolved packagingId from the materials table
            const resolvedPackagingId =
              bom.materialType === 'PACKAGING' && bom.materialId
                ? resolvedPackagingIds.get(bom.materialId) || null
                : null;

            await tx.style_material_bom.create({
              data: {
                id: randomUUID(),
                styleId: id,
                materialType: bom.materialType,
                materialId: bom.materialId || null,
                usageCategory: bom.usageCategory || 'GARMENT_TRIM',
                // Set the appropriate FK based on materialType
                // Use null if materialId is empty/undefined to avoid FK violations
                buttonId: bom.materialType === 'BUTTON' && bom.materialId ? bom.materialId : null,
                threadId: bom.materialType === 'THREAD' && bom.materialId ? bom.materialId : null,
                zipperId: bom.materialType === 'ZIPPER' && bom.materialId ? bom.materialId : null,
                elasticId: bom.materialType === 'ELASTIC' && bom.materialId ? bom.materialId : null,
                laceId: bom.materialType === 'LACE' && bom.materialId ? bom.materialId : null,
                labelId: bom.materialType === 'LABEL' && bom.materialId ? bom.materialId : null,
                packagingId: resolvedPackagingId,
                // Generic trim FK fields (DRAWSTRING, HOOK_EYE, SNAP_BUTTON, etc.)
                ...buildGenericTrimFkFields(bom.materialType, bom.materialId || null),
                componentName: bom.componentName || null,
                quantityPerGarment:
                  Number(bom.quantityPerGarment || 0) > 0
                    ? parseFloat(String(bom.quantityPerGarment))
                    : bom.materialType === 'LABEL' || bom.materialType === 'PACKAGING'
                      ? 1
                      : 0,
                unit: bom.unit || Unit.PIECE,
                unitPrice: bom.unitPrice ? parseFloat(String(bom.unitPrice)) : null,
                totalCost: bom.totalCost ? parseFloat(String(bom.totalCost)) : null,
                notes: bom.notes || null,
                sortOrder: idx,
                // Explicit, so the DB column default cannot inject a wastage nobody chose.
                // `!= null` keeps a deliberate 0 from falling through to the default.
                extraPercentage:
                  (bom as { extraPercentage?: number | null }).extraPercentage != null
                    ? Number((bom as { extraPercentage?: number | null }).extraPercentage)
                    : trimDefaultWastage,
              },
            });
          }
          logDebug(`Created ${validMaterialBOM.length} material BOM records for trims/accessories`);
        }
      }

      // BUG-S6 bridge: expectedOrderQuantity column added 2026-08-02, but the running API
      // holds the generated Prisma client DLL (prisma generate EPERMs). The `as object`
      // spread compiles against the stale client types; inline it into the data literal
      // after the next deploy regenerates the client.
      const expectedOrderQtyPatch =
        data.expectedOrderQuantity !== undefined
          ? {
              expectedOrderQuantity:
                data.expectedOrderQuantity != null && String(data.expectedOrderQuantity) !== ''
                  ? parseInt(String(data.expectedOrderQuantity), 10)
                  : null,
            }
          : {};

      // ageGroup/projectGroup are styles columns not yet declared on UpdateStyleRequest
      // (style.types.ts is extended in a parallel change); local widening keeps this file
      // compiling against either version of the DTO.
      const dataWithGroups = data as UpdateStyleDTO & { ageGroup?: string | null; projectGroup?: string | null };

      // Update the main style record
      const style = await tx.styles.update({
        where: { id },
        data: {
          styleName: data.styleName,
          customerId: data.customerId !== undefined ? data.customerId || null : undefined,
          customerName: data.customerName,
          brandName: data.brandName,
          // BUG-S7: the bare `|| null` pattern (without the !== undefined guard) wiped both
          // category FKs on every partial update — e.g. the remove-image call that sends
          // only {imageUrl: null}. Guard like every other nullable field: absent key = keep,
          // present-but-empty = clear to null.
          brandCategoryId: data.brandCategoryId !== undefined ? data.brandCategoryId || null : undefined,
          productCategoryId: data.productCategoryId !== undefined ? data.productCategoryId || null : undefined,
          gender: data.gender !== undefined ? (data.gender as Gender) || null : undefined,
          ageGroup: dataWithGroups.ageGroup !== undefined ? (dataWithGroups.ageGroup as AgeGroup) || null : undefined,
          projectGroup: dataWithGroups.projectGroup !== undefined ? dataWithGroups.projectGroup || null : undefined,
          description: data.description,
          season: data.season,
          seasonId: data.seasonId !== undefined ? data.seasonId || null : undefined,
          numberOfComponents:
            data.numberOfComponents !== undefined
              ? data.numberOfComponents
                ? parseInt(String(data.numberOfComponents), 10)
                : null
              : undefined,
          // BUG-S10: != null + '' check preserves a legitimate 0 (truthiness turned 0 into null)
          costPrice:
            data.costPrice !== undefined
              ? data.costPrice != null && String(data.costPrice) !== ''
                ? parseFloat(String(data.costPrice))
                : null
              : undefined,
          sellingPrice:
            data.sellingPrice !== undefined
              ? data.sellingPrice != null && String(data.sellingPrice) !== ''
                ? parseFloat(String(data.sellingPrice))
                : null
              : undefined,
          hsnCode: data.hsnCode !== undefined ? data.hsnCode : undefined,
          productTaxRule: data.productTaxRule !== undefined ? data.productTaxRule : undefined,
          accountingSKU: data.accountingSKU !== undefined ? data.accountingSKU : undefined,
          accountingUnit: data.accountingUnit !== undefined ? data.accountingUnit : undefined,
          bulletPoints: data.bulletPoints !== undefined ? data.bulletPoints : undefined,
          specifications:
            data.specifications !== undefined
              ? data.specifications
              : data.category !== undefined
                ? data.category
                : undefined,
          imageUrl: data.imageUrl !== undefined ? data.imageUrl : undefined,
          buyerStyleRef: data.buyerStyleRef !== undefined ? data.buyerStyleRef || null : undefined,
          customerAccessoriesPresetId:
            data.customerAccessoriesPresetId !== undefined ? data.customerAccessoriesPresetId || null : undefined,
          ...(expectedOrderQtyPatch as object),
        },
        include: {
          brand_categories: true,
          product_category: true,
          season_master: true,
          style_components: {
            include: {
              style_fabrics: true,
              style_accessories: true,
            },
            orderBy: { sortOrder: 'asc' },
          },
          style_processes: {
            include: {
              supplier: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  supplierCategories: true,
                },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
          style_costing: true,
          style_material_bom: true,
          style_variants: true,
        },
      });

      logInfo('Style updated successfully', { id, components: data.components?.length || 0 });
      return style;
    });
  }

  /**
   * Update style image
   */
  async updateImage(id: string, imageUrl: string): Promise<{ id: string; styleCode: string; imageUrl: string | null }> {
    await this.findByIdOrThrow(id);

    return this.prisma.styles.update({
      where: { id },
      data: { imageUrl },
      select: {
        id: true,
        styleCode: true,
        imageUrl: true,
      },
    });
  }

  // ============================================
  // Draft Methods
  // ============================================

  /**
   * Get all drafts
   */
  async findAllDrafts(options: PaginationOptions): Promise<PaginatedResult<styles>> {
    const additionalFilters: AdditionalFilters = {
      status: 'DRAFT',
    };

    return this.findAll(options, additionalFilters);
  }

  /**
   * Get draft by ID
   */
  async findDraftById(id: string): Promise<styles> {
    const draft = await this.prisma.styles.findFirst({
      where: { id, status: 'DRAFT' },
      include: {
        style_components: {
          include: {
            style_fabrics: {
              include: {
                fabric: true,
                fabricCAD: true,
              },
            },
          },
        },
        style_processes: {
          include: {
            supplier: {
              select: {
                id: true,
                code: true,
                name: true,
                supplierCategories: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        style_value_additions: true,
        style_packaging: true,
        style_variants: {
          include: { size: true },
        },
      },
    });

    if (!draft) {
      throw new NotFoundError('Draft', id);
    }

    return draft;
  }

  /**
   * Publish draft to active status
   */
  async publishDraft(id: string): Promise<styles> {
    const draft = await this.prisma.styles.findFirst({
      where: { id, status: 'DRAFT' },
      include: {
        style_components: {
          include: { style_fabrics: true },
        },
      },
    });

    if (!draft) {
      throw new NotFoundError('Draft', id);
    }

    if (!draft.customerName) {
      throw new ValidationError('Customer name is required before publishing a style');
    }

    if (!draft.brandName && !draft.brandCategoryId) {
      throw new ValidationError('Brand or brand category is required before publishing a style');
    }

    const hasFabric = draft.style_components?.some((comp) => comp.style_fabrics && comp.style_fabrics.length > 0);
    if (!hasFabric) {
      throw new ValidationError(
        'At least one fabric must be defined before publishing a style. Add fabrics in the style form.'
      );
    }

    const publishedStyle = await this.prisma.styles.update({
      where: { id },
      data: { status: 'ACTIVE' },
      include: {
        style_components: {
          include: { style_fabrics: true },
        },
        style_processes: {
          include: {
            supplier: {
              select: {
                id: true,
                code: true,
                name: true,
                supplierCategories: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    logInfo('Draft published to ACTIVE', { id, styleCode: draft.styleCode });
    return publishedStyle;
  }

  // ============================================
  // Variant Methods
  // ============================================

  /**
   * Create or update style variants
   */
  async upsertVariants(styleId: string, variants: SKUVariantInput[]): Promise<unknown[]> {
    logDebug('Upserting style variants', { styleId, count: variants.length });

    // Validate
    if (!variants || variants.length === 0) {
      throw new ValidationError('Variants array is required and must not be empty');
    }

    // Check style exists
    const style = await this.prisma.styles.findUnique({
      where: { id: styleId },
      select: { id: true, styleCode: true },
    });

    if (!style) {
      throw new NotFoundError('Style', styleId);
    }

    // Validate SKU formats
    const invalidSKUs = variants.filter((v) => !validateSKUFormat(v.sku));
    if (invalidSKUs.length > 0) {
      throw new ValidationError(`Invalid SKU format for: ${invalidSKUs.map((v) => v.sku).join(', ')}`);
    }

    // Check for duplicates within request
    const skuCounts = new Map<string, number>();
    variants.forEach((v) => {
      skuCounts.set(v.sku, (skuCounts.get(v.sku) || 0) + 1);
    });
    const duplicates = Array.from(skuCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([sku]) => sku);

    if (duplicates.length > 0) {
      throw new ValidationError(`Duplicate SKUs in request: ${duplicates.join(', ')}`);
    }

    // Check for existing SKUs in other styles
    const allSKUs = variants.map((v) => v.sku);
    const existingSKUs = await checkMultipleSKUsExist(allSKUs);

    const existingVariantsForStyle = await this.prisma.style_variants.findMany({
      where: { styleId, sku: { in: allSKUs } },
      select: { sku: true },
    });
    const existingSKUsForThisStyle = new Set(existingVariantsForStyle.map((v) => v.sku));
    const conflictingSKUs = existingSKUs.filter((sku) => !existingSKUsForThisStyle.has(sku));

    if (conflictingSKUs.length > 0) {
      throw new ConflictError(`SKUs already exist for other styles: ${conflictingSKUs.join(', ')}`);
    }

    // Process in transaction
    const createdVariants = await this.prisma.$transaction(async (tx) => {
      const results = [];

      for (const variant of variants) {
        // Get or create size option
        let sizeOption = await tx.size_options.findFirst({
          where: { styleId, sizeName: variant.size },
        });

        if (!sizeOption) {
          sizeOption = await tx.size_options.create({
            data: {
              id: randomUUID(),
              styleId,
              sizeName: variant.size,
              sizeCode: variant.size,
              sortOrder: getSizeOrder(variant.size),
              isActive: true,
            },
          });
        }

        // Upsert variant
        const styleVariant = await tx.style_variants.upsert({
          where: { sku: variant.sku },
          create: {
            id: randomUUID(),
            styleId,
            sku: variant.sku,
            sizeId: sizeOption.id,
            sizeName: variant.size,
            colorId: null,
            colorName: null,
            barcode: variant.barcode || null,
            accountingSKU: variant.accountingSKU || null,
            isActive: variant.isActive !== false,
            sortOrder: getSizeOrder(variant.size),
          },
          update: {
            sizeId: sizeOption.id,
            sizeName: variant.size,
            barcode: variant.barcode || null,
            accountingSKU: variant.accountingSKU || null,
            isActive: variant.isActive !== false,
            sortOrder: getSizeOrder(variant.size),
          },
        });

        results.push(styleVariant);
      }

      return results;
    });

    logInfo('Variants upserted', { styleCode: style.styleCode, count: createdVariants.length });
    return createdVariants;
  }

  // ============================================
  // CAD Planning Methods
  // ============================================

  /**
   * Get CAD planning data for a style
   */
  async getCADPlanning(styleId: string): Promise<{ style: unknown; fabricGroups: unknown[] }> {
    const style = await this.prisma.styles.findUnique({
      where: { id: styleId },
      include: {
        style_components: {
          include: {
            style_fabrics: {
              include: {
                fabric: {
                  include: {
                    greige: true,
                    widthCADs: { orderBy: { cutableWidth: 'asc' } },
                  },
                },
                fabricCAD: true,
                embroidery: true, // Include embroidery details
              },
            },
          },
        },
      },
    });

    if (!style) {
      throw new NotFoundError('Style', styleId);
    }

    // Group fabrics by cadGroupKey
    // New grouping logic: fabric + finish + usableWidth + embroidery + allowCombinedCutting
    const fabricGroups: Record<string, unknown> = {};
    for (const component of style.style_components) {
      for (const fabric of component.style_fabrics) {
        // Generate CAD group key considering embroidery state
        let groupKey = fabric.cadGroupKey;

        if (!groupKey) {
          const genericName = fabric.genericGreigeName || fabric.fabric?.genericGreigeName || 'Unknown';
          const finishType = fabric.fabricFinishType || 'Unknown';
          const cutableWidthStr = fabric.cutableWidth ? String(fabric.cutableWidth) : 'UNK';
          const embroideryPart =
            fabric.hasEmbroidery && fabric.embroideryId ? `EMB-${fabric.embroideryId.substring(0, 8)}` : 'PLAIN';

          // If not allowing combined cutting, make unique per component
          if (fabric.allowCombinedCutting === false) {
            groupKey = `${genericName}-${finishType}-${cutableWidthStr}-${embroideryPart}-${component.componentName}`;
          } else {
            groupKey = `${genericName}-${finishType}-${cutableWidthStr}-${embroideryPart}`;
          }
        }

        if (!fabricGroups[groupKey]) {
          fabricGroups[groupKey] = {
            groupKey,
            genericGreigeName: fabric.genericGreigeName || fabric.fabric?.genericGreigeName,
            fabricFinishType: fabric.fabricFinishType,
            cutableWidth: fabric.cutableWidth ? Number(fabric.cutableWidth) : null,
            hasEmbroidery: fabric.hasEmbroidery || false,
            embroidery: fabric.embroidery
              ? {
                  id: fabric.embroidery.id,
                  embroideryCode: fabric.embroidery.embroideryCode,
                  designName: fabric.embroidery.designName,
                  costPerMeter: fabric.embroidery.costPerMeter ? Number(fabric.embroidery.costPerMeter) : null,
                }
              : null,
            fabrics: [],
            components: [],
            cutableWidthOptions: fabric.fabric?.widthCADs || [],
            selectedCADId: fabric.fabricCADId || undefined,
          };
        }

        const group = fabricGroups[groupKey] as {
          fabrics: unknown[];
          components: string[];
        };

        group.fabrics.push({
          id: fabric.id,
          componentName: component.componentName,
          fabricName: fabric.fabric?.fabricName || fabric.fabricName,
          genericGreigeName: fabric.genericGreigeName,
          fabricFinishType: fabric.fabricFinishType,
          currentCADId: fabric.fabricCADId,
          hasEmbroidery: fabric.hasEmbroidery || false,
          embroideryId: fabric.embroideryId,
          cutableWidth: fabric.cutableWidth ? Number(fabric.cutableWidth) : null,
          allowCombinedCutting: fabric.allowCombinedCutting !== false,
        });

        if (!group.components.includes(component.componentName)) {
          group.components.push(component.componentName);
        }
      }
    }

    return {
      style: {
        id: style.id,
        styleCode: style.styleCode,
        styleName: style.styleName,
        cadStatus: style.cadStatus,
        approvedCadDate: style.approvedCadDate,
      },
      fabricGroups: Object.values(fabricGroups),
    };
  }

  /**
   * Update CAD grouping for fabrics
   */
  async updateCADGrouping(styleId: string, fabricGroups: FabricGroupInput[]): Promise<void> {
    if (!fabricGroups || !Array.isArray(fabricGroups)) {
      throw new ValidationError('fabricGroups array is required');
    }

    await Promise.all(
      fabricGroups.map((group) =>
        this.prisma.style_fabrics.update({
          where: { id: group.fabricId },
          data: { cadGroupKey: group.cadGroupKey },
        })
      )
    );

    // Style status is derived from the rows (landmine №3) — never write it directly
    await recomputeStyleCadStatus(this.prisma, styleId);

    logInfo('CAD grouping updated', { styleId });
  }

  /**
   * Approve CAD plan and link fabrics to CAD entries
   */
  async approveCADPlan(styleId: string, fabricCADMappings: FabricCADMapping[], approvedById?: string): Promise<styles> {
    if (!fabricCADMappings || !Array.isArray(fabricCADMappings)) {
      throw new ValidationError('fabricCADMappings array is required');
    }

    // Validate all style_fabrics have CAD data before approving
    const allStyleFabrics = await this.prisma.style_fabrics.findMany({
      where: { style_components: { styleId } },
      select: { id: true, genericGreigeName: true, fabricFinishType: true },
    });

    if (allStyleFabrics.length === 0) {
      throw new ValidationError('No fabrics found for this style. Cannot approve CAD plan.');
    }

    // Fetch mapped CAD records up front — combined-cutting rows carry their full fabric
    // coverage in combinedFabricIds (the styleFabricId FK only points at the first fabric)
    const cadIds = fabricCADMappings.map((m) => m.fabricCADId);
    const cadRecords = await this.prisma.fabric_width_cad.findMany({
      where: { id: { in: cadIds } },
      // BUG-CS5 FIX: Include fabricId - CAD rows can use either greigeId (greige processing) OR fabricId (ready fabric)
      select: {
        id: true,
        cadAverage: true,
        patternPartId: true,
        greigeId: true,
        fabricId: true,
        isCombinedCutting: true,
        combinedFabricIds: true,
      },
    });

    const cadMap = new Map(cadRecords.map((c) => [c.id, c]));

    // Expand combined-cutting rows into per-fabric mappings. Explicit mappings win;
    // expansion only fills fabrics the client didn't send. Stale combinedFabricIds
    // entries (style edits recreate style_fabrics with new IDs) are skipped by
    // intersecting with the style's actual fabrics.
    const styleFabricIdSet = new Set(allStyleFabrics.map((sf) => sf.id));
    const mappingByFabricId = new Map<string, string>();
    for (const m of fabricCADMappings) {
      mappingByFabricId.set(m.fabricId, m.fabricCADId);
    }
    for (const m of fabricCADMappings) {
      const cad = cadMap.get(m.fabricCADId);
      if (!cad?.isCombinedCutting || !cad.combinedFabricIds) continue;
      let combinedIds: unknown;
      try {
        combinedIds = JSON.parse(cad.combinedFabricIds);
      } catch {
        continue;
      }
      if (!Array.isArray(combinedIds)) continue;
      for (const fid of combinedIds) {
        if (typeof fid === 'string' && styleFabricIdSet.has(fid) && !mappingByFabricId.has(fid)) {
          mappingByFabricId.set(fid, cad.id);
        }
      }
    }
    const expandedMappings: FabricCADMapping[] = Array.from(mappingByFabricId, ([fabricId, fabricCADId]) => ({
      fabricId,
      fabricCADId,
    }));

    const unmappedFabrics = allStyleFabrics.filter((sf) => !mappingByFabricId.has(sf.id));

    if (unmappedFabrics.length > 0) {
      const missing = unmappedFabrics
        .map((sf) => `${sf.genericGreigeName || 'Unknown'}-${sf.fabricFinishType || 'PLAIN'}`)
        .join(', ');
      throw new ValidationError(
        `Cannot approve: ${unmappedFabrics.length} fabric(s) have no CAD data. Missing: ${missing}`
      );
    }

    // Validate each mapped CAD record has valid data
    const invalidMappings = expandedMappings.filter((m) => {
      const cad = cadMap.get(m.fabricCADId);
      return !cad || !cad.cadAverage || Number(cad.cadAverage) <= 0;
    });

    if (invalidMappings.length > 0) {
      throw new ValidationError(
        `Cannot approve: ${invalidMappings.length} CAD record(s) have no calculated CAD average. Please complete all CAD entries before approving.`
      );
    }

    // Validate all CAD records have a pattern part assigned
    const rowsWithoutPart = cadRecords.filter((c) => !c.patternPartId);
    if (rowsWithoutPart.length > 0) {
      throw new ValidationError(
        `Cannot approve: ${rowsWithoutPart.length} CAD row(s) are missing a Part. Please select a Part for all rows before approving.`
      );
    }

    // Validate all CAD records have EITHER greige OR fabric selected
    // BUG-CS5 FIX: Previously only checked greigeId, blocking approval for ready-fabric styles
    const rowsWithoutFabricSource = cadRecords.filter((c) => !c.greigeId && !c.fabricId);
    if (rowsWithoutFabricSource.length > 0) {
      throw new ValidationError(
        `Cannot approve: ${rowsWithoutFabricSource.length} CAD row(s) are missing a Greige/Fabric selection. Please select a Greige or Fabric for all rows before approving.`
      );
    }

    // One transaction: link fabrics -> flip the SELECTED rows to APPROVED -> derive the
    // style status from the rows. The old code stamped only styles.cadStatus and never
    // touched row-level approval — the purest producer of the style-vs-row drift
    // (landmine №3), and under the derived model the button would have been a no-op.
    const mappedCadIds = [...new Set(expandedMappings.map((m) => m.fabricCADId))];
    await this.prisma.$transaction(async (tx) => {
      await Promise.all(
        expandedMappings.map((mapping) =>
          tx.style_fabrics.update({
            where: { id: mapping.fabricId },
            data: { fabricCADId: mapping.fabricCADId },
          })
        )
      );

      await tx.fabric_width_cad.updateMany({
        where: { id: { in: mappedCadIds } },
        data: {
          approvalStatus: 'APPROVED', // allow-cad-approval: this IS the CAD-side approval
          ...(approvedById ? { approvedBy: approvedById } : {}),
          approvedAt: new Date(),
          rejectedBy: null,
          rejectedAt: null,
        },
      });

      await recomputeStyleCadStatus(tx, styleId);
    });

    const updatedStyle = await this.prisma.styles.findUniqueOrThrow({ where: { id: styleId } });
    logInfo('CAD plan approved', { styleId, approvedRows: mappedCadIds.length });
    return updatedStyle;
  }

  /**
   * Reject/Unapprove CAD plan - revert to PENDING status
   * @param styleId - The style ID
   * @param rejectionReason - Reason for rejection
   * @param rejectedById - User ID of who rejected
   */
  async rejectCADPlan(styleId: string, rejectionReason: string, rejectedById: string): Promise<styles> {
    // Verify style exists and is approved
    const style = await this.prisma.styles.findUnique({
      where: { id: styleId },
      select: { id: true, cadStatus: true },
    });

    if (!style) {
      throw new ValidationError('Style not found');
    }

    if (style.cadStatus !== 'APPROVED') {
      throw new ValidationError('CAD plan is not approved. Current status: ' + style.cadStatus);
    }

    // Get all style_fabrics for this style
    const styleFabrics = await this.prisma.style_fabrics.findMany({
      where: { style_components: { styleId } },
      select: { id: true },
    });

    const styleFabricIds = styleFabrics.map((sf) => sf.id);

    // Reset all CAD rows linked to these style_fabrics to PENDING.
    // Policy (two-owner split, user decision 2026-08-22): rejecting the CAD plan ALSO
    // un-approves prices — a price approved against rejected geometry must be re-reviewed
    // after the CAD rework. Cost numbers are kept; only the approvals reset.
    if (styleFabricIds.length > 0) {
      await this.prisma.fabric_width_cad.updateMany({
        where: { styleFabricId: { in: styleFabricIds } },
        data: {
          approvalStatus: 'PENDING', // allow-cad-approval: CAD-side reset is this method's job
          approvedBy: null,
          approvedAt: null,
          approvalNotes: rejectionReason,
          rejectedBy: rejectedById,
          rejectedAt: new Date(),
          costingApprovalStatus: null,
          costingApprovedBy: null,
          costingApprovedAt: null,
          isPreferred: false,
        },
      });

      // Clear fabricCADId links on style_fabrics
      await this.prisma.style_fabrics.updateMany({
        where: { id: { in: styleFabricIds } },
        data: { fabricCADId: null },
      });
    }

    // Style status is DERIVED from the rows (landmine №3): with every row just reset to
    // PENDING this computes IN_PROGRESS (rows exist, none approved) — or PENDING if the
    // style has no rows at all.
    await recomputeStyleCadStatus(this.prisma, styleId);
    const updatedStyle = await this.prisma.styles.findUniqueOrThrow({ where: { id: styleId } });

    logInfo('CAD plan rejected', { styleId });
    return updatedStyle;
  }

  // ============================================
  // Running Styles (Active Orders/Work Orders)
  // ============================================

  /**
   * Get styles with active orders or work orders ("running" styles)
   * Used for sample tracking to auto-populate styles that are actively in production
   */
  async getRunningStyles(customerId?: string): Promise<
    {
      id: string;
      styleCode: string;
      buyerStyleRef: string | null;
      styleName: string;
      customerName: string | null;
    }[]
  > {
    return this.prisma.styles.findMany({
      where: {
        isActive: true,
        ...(customerId && { customerId }),
        OR: [
          { order_items: { some: { orders: { status: { notIn: ['COMPLETED', 'CANCELLED', 'DISPATCHED'] } } } } },
          { sale_order_items: { some: { saleOrder: { status: { notIn: ['DISPATCHED', 'DELIVERED', 'CANCELLED'] } } } } },
          { work_orders: { some: { status: { in: ['PENDING', 'IN_PRODUCTION'] } } } },
        ],
      },
      select: {
        id: true,
        styleCode: true,
        buyerStyleRef: true,
        styleName: true,
        customerName: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  // ============================================
  // Deactivation Validation
  // ============================================

  /**
   * Validate if a style can be deactivated
   * Checks for active dependencies that would block deactivation
   */
  async validateDeactivation(styleId: string): Promise<{
    canDeactivate: boolean;
    blockers: { type: string; count: number }[];
  }> {
    const blockers: { type: string; count: number }[] = [];

    // 1. Active Order Items (orders not completed/cancelled/dispatched)
    const activeOrderItems = await this.prisma.order_items.count({
      where: {
        styleId,
        orders: {
          isActive: true,
          status: { notIn: ['COMPLETED', 'CANCELLED', 'DISPATCHED'] },
        },
      },
    });
    if (activeOrderItems > 0) {
      blockers.push({ type: 'Active Orders', count: activeOrderItems });
    }

    // 2. Active Work Orders
    const activeWorkOrders = await this.prisma.work_orders.count({
      where: {
        styleId,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
    });
    if (activeWorkOrders > 0) {
      blockers.push({ type: 'Active Work Orders', count: activeWorkOrders });
    }

    // 3. Pending Samples (not approved or rejected)
    const pendingSamples = await this.prisma.samples.count({
      where: {
        styleId,
        isActive: true,
        status: { notIn: ['APPROVED', 'REJECTED'] },
      },
    });
    if (pendingSamples > 0) {
      blockers.push({ type: 'Pending Samples', count: pendingSamples });
    }

    return { canDeactivate: blockers.length === 0, blockers };
  }

  /**
   * Override softDelete to add validation before deactivation
   */
  async softDelete(id: string): Promise<void> {
    // Verify style exists
    await this.findByIdOrThrow(id);

    // Validate deactivation
    const validation = await this.validateDeactivation(id);
    if (!validation.canDeactivate) {
      const message = validation.blockers.map((b) => `${b.count} ${b.type}`).join(', ');
      throw new ValidationError(`Cannot deactivate style. Active dependencies: ${message}`);
    }

    // Proceed with soft delete
    await this.prisma.styles.update({
      where: { id },
      data: { isActive: false },
    });

    logInfo('Style deactivated successfully', { id });
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private async loadPresetAccessories(presetId?: string): Promise<PresetAccessoryItem[]> {
    if (!presetId) return [];

    try {
      const preset = await this.prisma.customer_accessories_presets.findUnique({
        where: { id: presetId },
        include: {
          items: {
            include: {
              // Include the material relation to get the packagingId
              material: {
                select: {
                  id: true,
                  packagingId: true,
                  labelId: true,
                },
              },
            },
          },
        },
      });

      if (preset && preset.items) {
        const results: PresetAccessoryItem[] = [];

        for (const item of preset.items) {
          let resolvedMaterialId: string | undefined;

          if (item.materialType === 'LABEL') {
            // Unified identity: materialId is authoritative (=== label_master.id post
            // id-unification); labelId kept as the transition fallback for old rows
            resolvedMaterialId = item.materialId ?? item.labelId ?? undefined;
          } else if (item.materialType === 'PACKAGING') {
            // For PACKAGING types, the preset stores materialId (references materials table)
            // But style_material_bom.packagingId references packaging_master directly
            // So we need to get the packagingId from the materials record
            if (item.material?.packagingId) {
              resolvedMaterialId = item.material.packagingId;
            } else {
              // Skip this item - no valid packagingId available
              logWarn('Preset item has no valid packagingId', {
                presetId,
                itemId: item.id,
                materialId: item.materialId,
              });
              continue;
            }
          }

          if (resolvedMaterialId) {
            // Default usageCategory based on materialType if not explicitly set
            // Labels and Packaging items should default to 'PACKAGING' category
            let usageCategory = item.usageCategory as 'GARMENT_TRIM' | 'VALUE_ADDITION' | 'PACKAGING' | undefined;
            if (!usageCategory) {
              if (item.materialType === 'LABEL' || item.materialType === 'PACKAGING') {
                usageCategory = 'PACKAGING';
              } else {
                usageCategory = 'GARMENT_TRIM';
              }
            }

            // For labels, quantity is usually not stored (it's always 1 per garment with extra percentage)
            // For packaging, quantity comes from the preset item
            const quantity =
              item.materialType === 'LABEL'
                ? 1 // Labels are 1 per garment (extra percentage handled separately)
                : Number(item.quantity) || 1;

            results.push({
              materialType: item.materialType,
              materialId: resolvedMaterialId,
              quantityPerGarment: quantity,
              usageCategory,
              componentName: item.componentName ?? undefined,
            });
          }
        }

        return results;
      }
    } catch (error) {
      logWarn('Failed to load customer accessories preset', { presetId, error });
    }

    return [];
  }

  private buildCombinedMaterialBOM(
    materialBOM: MaterialBOMInput[],
    presetAccessories: PresetAccessoryItem[],
    trims?: StyleTrimInput[],
    accessories?: MaterialBOMInput[]
  ): MaterialBOMInput[] {
    // If new format trims/accessories are provided, use them
    // Otherwise fall back to legacy materialBOM format
    const trimItems: MaterialBOMInput[] = trims
      ? this.convertTrimsToMaterialBOM(trims)
      : materialBOM.filter((m) => m.usageCategory !== 'PACKAGING');

    const accessoryItems: MaterialBOMInput[] = accessories
      ? accessories
      : materialBOM.filter((m) => m.usageCategory === 'PACKAGING');

    const combined: MaterialBOMInput[] = [...trimItems, ...accessoryItems, ...presetAccessories];

    // Auto-add Thread if not present
    const hasThread = combined.some((item) => item.materialType === 'THREAD');
    if (!hasThread) {
      combined.push({
        materialType: 'THREAD',
        usageCategory: 'GARMENT_TRIM',
        componentName: 'Default Thread',
        quantityPerGarment: 0,
        unit: 'cone',
      });
    }

    return combined;
  }

  /**
   * Convert simplified trims to MaterialBOMInput format
   * Quantity/cost fields are set to 0 - will be filled at order/costing level
   * THREAD is a bulk item: quantity defaults to 1, price represents total estimated cost
   */
  private convertTrimsToMaterialBOM(trims: StyleTrimInput[]): MaterialBOMInput[] {
    const trimTypeToMaterialType: Record<string, string> = {
      BUTTON: 'BUTTON',
      THREAD: 'THREAD',
      ZIPPER: 'ZIPPER',
      ELASTIC: 'ELASTIC',
      LACE: 'LACE',
      LABEL: 'LABEL',
    };

    return trims.map((trim) => {
      const isBulkItem = trim.trimType === 'THREAD';
      return {
        materialType: (trimTypeToMaterialType[trim.trimType] || trim.trimType) as MaterialBOMInput['materialType'],
        materialId: trim.masterId === 'auto-thread' ? null : trim.masterId,
        usageCategory: 'GARMENT_TRIM' as const,
        componentName: trim.masterName,
        // Thread is bulk item: quantity=1, price represents total estimated order cost
        quantityPerGarment: isBulkItem ? 1 : 0,
        unit: isBulkItem ? 'lot' : 'pcs',
        unitPrice: null,
        totalCost: null,
        notes: trim.color || null,
      };
    });
  }

  private buildComponentsData(components?: StyleComponentInput[]) {
    return (
      components?.map((comp, index) => ({
        id: randomUUID(),
        componentName: comp.componentName,
        componentType: comp.componentType,
        sortOrder: index,
        style_fabrics: {
          create:
            comp.fabrics?.map((fabric) => ({
              id: randomUUID(),
              fabricId: fabric.fabricId || null,
              fabricCADId: fabric.fabricCADId || null,
              fabricFinishType: fabric.fabricFinishType || null,
              cadGroupKey: fabric.cadGroupKey || null,
              fabricName: fabric.fabricName,
              fabricType: fabric.fabricType,
              greigeName: fabric.greigeName || null,
              quantityNeeded: fabric.quantityNeeded ? parseFloat(String(fabric.quantityNeeded)) : null,
              unitPrice: fabric.unitPrice ? parseFloat(String(fabric.unitPrice)) : null,
              notes: fabric.notes || null,
            })) || [],
        },
      })) || []
    );
  }

  private buildProcessesData(processes?: StyleProcessInput[]) {
    return (
      processes?.map((proc, index) => ({
        id: randomUUID(),
        processName: proc.processName || proc.processType,
        processType: proc.processType || proc.processName,
        isRequired: proc.isRequired !== false,
        sortOrder: index,
        supplierId: proc.supplierId || null,
        estimatedCost: proc.estimatedCost || null,
        estimatedDays: proc.estimatedDays || null,
        notes: proc.notes || proc.description || null,
      })) || []
    );
  }

  private buildMaterialBOMData(materialBOM: MaterialBOMInput[]) {
    return materialBOM.map((bom, index) => {
      const isValidMaterialId = bom.materialId && !bom.materialId.startsWith('auto-');
      const materialId = isValidMaterialId ? bom.materialId : null;

      return {
        id: randomUUID(),
        materialType: bom.materialType,
        materialId,
        usageCategory: bom.usageCategory || 'GARMENT_TRIM',
        componentName: bom.componentName || null,
        quantityPerGarment: bom.quantityPerGarment ? parseFloat(String(bom.quantityPerGarment)) : 0,
        unit: bom.unit || Unit.PIECE,
        unitPrice: bom.unitPrice ? parseFloat(String(bom.unitPrice)) : null,
        totalCost: bom.totalCost ? parseFloat(String(bom.totalCost)) : null,
        notes: bom.notes || null,
        sortOrder: index,
        // Material-specific IDs
        laceId: bom.materialType === 'LACE' ? materialId : null,
        buttonId: bom.materialType === 'BUTTON' ? materialId : null,
        threadId: bom.materialType === 'THREAD' ? materialId : null,
        zipperId: bom.materialType === 'ZIPPER' ? materialId : null,
        elasticId: bom.materialType === 'ELASTIC' ? materialId : null,
        labelId: bom.materialType === 'LABEL' ? materialId : null,
        packagingId: bom.materialType === 'PACKAGING' ? materialId : null,
      };
    });
  }

  private buildVariantsData(skuVariants?: SKUVariantInput[]) {
    return (
      skuVariants?.map((sku) => ({
        id: randomUUID(),
        sizeName: sku.size,
        sku: sku.sku,
        barcode: sku.barcode || null,
        accountingSKU: sku.accountingSKU || null,
        isActive: sku.isActive !== false,
      })) || []
    );
  }
}

// Export singleton instance
export const styleService = new StyleServiceClass();
