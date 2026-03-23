/**
 * Style Service
 * Business logic for style management
 */

import { BaseService, PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';
import { styles, ProductionStage, Gender, Prisma } from '@prisma/client';
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
    } as unknown as IncludeConfig;
  }

  /**
   * Generate internal style code in format STY-YYYYMM-XXXX
   * e.g., STY-202506-0001, STY-202506-0002, etc.
   */
  private async generateInternalCode(): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `STY-${yearMonth}-`;

    // Find the highest existing code for this month
    const lastStyle = await this.prisma.styles.findFirst({
      where: {
        internalCode: {
          startsWith: prefix,
        },
      },
      orderBy: {
        internalCode: 'desc',
      },
      select: {
        internalCode: true,
      },
    });

    let nextNumber = 1;
    if (lastStyle?.internalCode) {
      const lastNumber = parseInt(lastStyle.internalCode.replace(prefix, ''), 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    return `${prefix}${String(nextNumber).padStart(4, '0')}`;
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

    // Validation
    if (!data.styleCode || !data.styleName) {
      throw new ValidationError('styleCode and styleName are required');
    }
    if (data.status !== 'DRAFT' && !data.customerName) {
      throw new ValidationError('Customer name is required for non-draft styles');
    }

    // Check for duplicate style code (only among active styles)
    const existingStyle = await this.prisma.styles.findFirst({
      where: {
        styleCode: data.styleCode,
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
                // Create nested fabrics if provided
                ...(comp.fabrics && comp.fabrics.length > 0
                  ? {
                      style_fabrics: {
                        create: comp.fabrics.map((fab: StyleFabricInput) => ({
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

    const materialBomCreate =
      validMaterialBOM.length > 0
        ? {
            create: validMaterialBOM.map((bom, idx) => ({
              id: randomUUID(),
              materialType: bom.materialType,
              usageCategory: bom.usageCategory || 'GARMENT_TRIM',
              // Set the appropriate FK based on materialType
              // Use null if materialId is empty/undefined to avoid FK violations
              buttonId: bom.materialType === 'BUTTON' && bom.materialId ? bom.materialId : null,
              threadId: bom.materialType === 'THREAD' && bom.materialId ? bom.materialId : null,
              zipperId: bom.materialType === 'ZIPPER' && bom.materialId ? bom.materialId : null,
              elasticId: bom.materialType === 'ELASTIC' && bom.materialId ? bom.materialId : null,
              laceId: bom.materialType === 'LACE' && bom.materialId ? bom.materialId : null,
              labelId: bom.materialType === 'LABEL' && bom.materialId ? bom.materialId : null,
              packagingId: bom.materialType === 'PACKAGING' && bom.materialId ? bom.materialId : null,
              componentName: bom.componentName || null,
              quantityPerGarment:
                Number(bom.quantityPerGarment || 0) > 0
                  ? parseFloat(String(bom.quantityPerGarment))
                  : bom.materialType === 'LABEL' || bom.materialType === 'PACKAGING'
                    ? 1
                    : 0,
              unit: bom.unit || 'pcs',
              unitPrice: bom.unitPrice ? parseFloat(String(bom.unitPrice)) : null,
              totalCost: bom.totalCost ? parseFloat(String(bom.totalCost)) : null,
              notes: bom.notes || null,
              sortOrder: idx,
            })),
          }
        : undefined;

    const style = await this.prisma.styles.create({
      data: {
        id: randomUUID(),
        internalCode,
        styleCode: data.styleCode,
        styleName: data.styleName,
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
        costPrice: data.costPrice ? parseFloat(String(data.costPrice)) : null,
        sellingPrice: data.sellingPrice ? parseFloat(String(data.sellingPrice)) : null,
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
        approvalStatus: 'APPROVED',
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

    // Use transaction to handle all updates atomically
    return this.prisma.$transaction(async (tx) => {
      // Handle components replacement if provided
      if (data.components !== undefined) {
        // First get existing style_fabrics for all components
        const existingComponents = await tx.style_components.findMany({
          where: { styleId: id },
          select: { id: true },
        });

        // Get all existing style_fabric IDs to preserve CAD/costing data
        // Fixed: Single batch query instead of N+1 loop
        const existingFabrics = await tx.style_fabrics.findMany({
          where: { componentId: { in: existingComponents.map((c) => c.id) } },
          select: { id: true },
        });
        const existingFabricIds = existingFabrics.map((f) => f.id);

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

            // Create nested fabrics if provided
            let firstFabricIdForComponent: string | null = null;
            if (comp.fabrics && comp.fabrics.length > 0) {
              for (const fab of comp.fabrics as StyleFabricInput[]) {
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
                    // Connect to the component
                    componentId: componentId,
                  },
                });
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

      // Handle standalone fabrics array (alternative to nested fabrics in components)
      // This handles the case where frontend sends fabrics separately with componentName
      if (data.fabrics !== undefined && Array.isArray(data.fabrics) && data.fabrics.length > 0) {
        // Get all components for this style to map componentName to componentId
        const styleComponents = await tx.style_components.findMany({
          where: { styleId: id },
          select: { id: true, componentName: true },
        });

        // Create a map for quick lookup
        const componentMap = new Map<string, string>();
        for (const comp of styleComponents) {
          componentMap.set(comp.componentName.toLowerCase(), comp.id);
        }

        // Get all existing style_fabric IDs to preserve CAD/costing data
        const standaloneFabricIds: string[] = [];
        for (const comp of styleComponents) {
          const fabrics = await tx.style_fabrics.findMany({
            where: { componentId: comp.id },
            select: { id: true },
          });
          standaloneFabricIds.push(...fabrics.map((f) => f.id));
        }

        // CRITICAL: Unlink CAD/costing records BEFORE deleting style_fabrics
        // Note: Only fabric_width_cad has nullable styleFabricId
        if (standaloneFabricIds.length > 0) {
          const unlinkResult = await tx.fabric_width_cad.updateMany({
            where: { styleFabricId: { in: standaloneFabricIds } },
            data: { styleFabricId: null },
          });

          if (unlinkResult.count > 0) {
            logDebug(`[UPDATE] Preserved ${unlinkResult.count} CAD/costing records from standalone fabrics`);
          }
        }

        // Now safe to delete existing fabrics for all components (to replace with new ones)
        for (const comp of styleComponents) {
          await tx.style_fabrics.deleteMany({
            where: { componentId: comp.id },
          });
        }

        // Create new fabrics
        for (const fab of data.fabrics as Array<{
          componentName?: string;
          fabricName?: string;
          genericGreigeName?: string;
          fabricId?: string;
          fabricFinishType?: string;
          estimatedConsumption?: number;
          unit?: string;
          notes?: string;
          hasEmbroidery?: boolean;
          embroideryId?: string;
          usableWidth?: number;
          allowCombinedCutting?: boolean;
        }>) {
          if (!fab.componentName) continue;

          // Find the component ID
          const componentId = componentMap.get(fab.componentName.toLowerCase());
          if (!componentId) {
            logDebug(`Component not found for fabric: ${fab.componentName}`);
            continue;
          }

          const isReadyFabric = !!fab.fabricId;
          await tx.style_fabrics.create({
            data: {
              id: randomUUID(),
              componentId,
              fabricId: fab.fabricId || null,
              fabricName: fab.fabricName || fab.genericGreigeName || '',
              fabricType: isReadyFabric ? 'FABRIC' : 'GENERIC',
              genericGreigeName: isReadyFabric ? null : fab.genericGreigeName || null,
              fabricFinishType: (fab.fabricFinishType as 'DYED' | 'PRINTED' | 'YARN_DYED' | 'RAW') || null,
              quantityNeeded: fab.estimatedConsumption ? parseFloat(String(fab.estimatedConsumption)) : 0,
              notes: fab.notes || null,
              // Embroidery support
              hasEmbroidery: fab.hasEmbroidery || false,
              embroideryId: fab.embroideryId || null,
              // Width tracking
              cutableWidth: fab.usableWidth ? parseFloat(String(fab.usableWidth)) : null,
              // CAD control
              allowCombinedCutting: fab.allowCombinedCutting !== false,
            },
          });
        }

        logDebug(`Created ${data.fabrics.length} fabrics from standalone fabrics array`);
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
        }

        if (validMaterialBOM.length > 0) {
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
                componentName: bom.componentName || null,
                quantityPerGarment:
                  Number(bom.quantityPerGarment || 0) > 0
                    ? parseFloat(String(bom.quantityPerGarment))
                    : bom.materialType === 'LABEL' || bom.materialType === 'PACKAGING'
                      ? 1
                      : 0,
                unit: bom.unit || 'pcs',
                unitPrice: bom.unitPrice ? parseFloat(String(bom.unitPrice)) : null,
                totalCost: bom.totalCost ? parseFloat(String(bom.totalCost)) : null,
                notes: bom.notes || null,
                sortOrder: idx,
              },
            });
          }
          logDebug(`Created ${validMaterialBOM.length} material BOM records for trims/accessories`);
        }
      }

      // Update the main style record
      const style = await tx.styles.update({
        where: { id },
        data: {
          styleName: data.styleName,
          customerName: data.customerName,
          brandName: data.brandName,
          // IMPORTANT: Keep all category ID fields consistent - use simple || null pattern
          // Do NOT use ternary operators for nullable foreign keys
          brandCategoryId: data.brandCategoryId || null,
          productCategoryId: data.productCategoryId || null,
          description: data.description,
          season: data.season,
          seasonId: data.seasonId !== undefined ? data.seasonId || null : undefined,
          numberOfComponents:
            data.numberOfComponents !== undefined
              ? data.numberOfComponents
                ? parseInt(String(data.numberOfComponents), 10)
                : null
              : undefined,
          costPrice:
            data.costPrice !== undefined ? (data.costPrice ? parseFloat(String(data.costPrice)) : null) : undefined,
          sellingPrice:
            data.sellingPrice !== undefined
              ? data.sellingPrice
                ? parseFloat(String(data.sellingPrice))
                : null
              : undefined,
          hsnCode: data.hsnCode !== undefined ? data.hsnCode : undefined,
          productTaxRule: data.productTaxRule !== undefined ? data.productTaxRule : undefined,
          accountingSKU: data.accountingSKU !== undefined ? data.accountingSKU : undefined,
          accountingUnit: data.accountingUnit !== undefined ? data.accountingUnit : undefined,
          bulletPoints: data.bulletPoints !== undefined ? data.bulletPoints : undefined,
          specifications: data.specifications !== undefined ? data.specifications : undefined,
          imageUrl: data.imageUrl !== undefined ? data.imageUrl : undefined,
          customerAccessoriesPresetId:
            data.customerAccessoriesPresetId !== undefined ? data.customerAccessoriesPresetId || null : undefined,
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
    });

    if (!draft) {
      throw new NotFoundError('Draft', id);
    }

    if (!draft.customerName) {
      throw new ValidationError('Customer name is required before publishing a style');
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

    await this.prisma.styles.update({
      where: { id: styleId },
      data: { cadStatus: 'IN_PROGRESS' },
    });

    logInfo('CAD grouping updated', { styleId });
  }

  /**
   * Approve CAD plan and link fabrics to CAD entries
   */
  async approveCADPlan(styleId: string, fabricCADMappings: FabricCADMapping[]): Promise<styles> {
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

    const mappedFabricIds = new Set(fabricCADMappings.map((m) => m.fabricId));
    const unmappedFabrics = allStyleFabrics.filter((sf) => !mappedFabricIds.has(sf.id));

    if (unmappedFabrics.length > 0) {
      const missing = unmappedFabrics
        .map((sf) => `${sf.genericGreigeName || 'Unknown'}-${sf.fabricFinishType || 'PLAIN'}`)
        .join(', ');
      throw new ValidationError(
        `Cannot approve: ${unmappedFabrics.length} fabric(s) have no CAD data. Missing: ${missing}`
      );
    }

    // Validate each mapped CAD record has valid data
    const cadIds = fabricCADMappings.map((m) => m.fabricCADId);
    const cadRecords = await this.prisma.fabric_width_cad.findMany({
      where: { id: { in: cadIds } },
      select: { id: true, cadAverage: true },
    });

    const cadMap = new Map(cadRecords.map((c) => [c.id, c]));
    const invalidMappings = fabricCADMappings.filter((m) => {
      const cad = cadMap.get(m.fabricCADId);
      return !cad || !cad.cadAverage || Number(cad.cadAverage) <= 0;
    });

    if (invalidMappings.length > 0) {
      throw new ValidationError(
        `Cannot approve: ${invalidMappings.length} CAD record(s) have no calculated CAD average. Please complete all CAD entries before approving.`
      );
    }

    await Promise.all(
      fabricCADMappings.map((mapping) =>
        this.prisma.style_fabrics.update({
          where: { id: mapping.fabricId },
          data: { fabricCADId: mapping.fabricCADId },
        })
      )
    );

    const updatedStyle = await this.prisma.styles.update({
      where: { id: styleId },
      data: {
        cadStatus: 'APPROVED',
        approvedCadDate: new Date(),
      },
    });

    logInfo('CAD plan approved', { styleId });
    return updatedStyle;
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
            // For LABEL types, use the direct labelId from preset item
            resolvedMaterialId = item.labelId ?? undefined;
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
        unit: bom.unit || 'pcs',
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
