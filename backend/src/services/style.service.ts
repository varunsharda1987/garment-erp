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
} from '../types/style.types';
import {
  generateSKU,
  checkMultipleSKUsExist,
  validateSKUFormat,
  getSizeOrder,
} from '../utils/sku-generator';

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
  style_garment_trims?: unknown[];
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
    return undefined; // Use specific includes in each method
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

    // Check for duplicate style code
    const existingStyle = await this.prisma.styles.findFirst({
      where: {
        styleCode: data.styleCode,
        isActive: true,
      },
    });

    if (existingStyle) {
      throw new ConflictError('Style code already exists');
    }

    // Load customer accessories preset if provided
    const presetAccessories = await this.loadPresetAccessories(data.customerAccessoriesPresetId);

    // Combine material BOM with preset accessories
    const combinedMaterialBOM = this.buildCombinedMaterialBOM(
      data.materialBOM || [],
      presetAccessories
    );

    logDebug('Combined material BOM', { count: combinedMaterialBOM.length });

    // Create style with nested relations
    // Generate internal code for new style
    const internalCode = await this.generateInternalCode();

    // Build nested components create if provided
    const componentsCreate = data.components && data.components.length > 0
      ? {
          create: data.components.map((comp: StyleComponentInput, idx: number) => ({
            id: randomUUID(),
            componentName: comp.componentName,
            componentType: comp.componentType || 'OTHER',
            sortOrder: idx,
            // Create nested fabrics if provided
            ...(comp.fabrics && comp.fabrics.length > 0
              ? {
                  style_fabrics: {
                    create: comp.fabrics.map((fab: StyleFabricInput) => ({
                      id: randomUUID(),
                      fabricName: fab.fabricName || fab.greigeName || '',
                      fabricType: fab.fabricType || 'GENERIC',
                      fabricFinishType: (fab.fabricFinishType as 'DYED' | 'PRINTED' | 'YARN_DYED' | 'RAW') || null,
                      quantityNeeded: fab.quantityNeeded ? parseFloat(String(fab.quantityNeeded)) : 0,
                      notes: fab.notes || null,
                    })),
                  },
                }
              : {}),
          })),
        }
      : undefined;

    // Build nested processes create if provided - filter out processes without valid processType
    const validProcesses = (data.processes || []).filter((proc: StyleProcessInput) => proc.processType);
    const processesCreate = validProcesses.length > 0
      ? {
          create: validProcesses.map((proc: StyleProcessInput, idx: number) => ({
            id: randomUUID(),
            processName: proc.processName || proc.processType || '',
            processType: proc.processType as 'PRINTING' | 'DYEING' | 'EMBROIDERY' | 'CUTTING' | 'STITCHING' | 'FINISHING' | 'WASHING' | 'TRANSPORTATION' | 'HANDWORK' | 'SMOCKING',
            isRequired: proc.isRequired !== false,
            supplierId: proc.supplierId || null,
            estimatedCost: proc.estimatedCost ? parseFloat(String(proc.estimatedCost)) : null,
            estimatedDays: proc.estimatedDays || null,
            notes: proc.notes || proc.description || null, // Accept both field names
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
        description: data.description,
        season: data.season,
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
      } as Prisma.stylesUncheckedCreateInput,
      include: {
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
                supplierCategory: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        style_costing: true,
        style_material_bom: true,
        style_garment_trims: true,
        style_value_additions: true,
        style_packaging: true,
        style_variants: true,
      },
    });

    logInfo('Style created successfully', { id: style.id, styleCode: style.styleCode, components: data.components?.length || 0 });
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
   * Find styles by production stage
   */
  async findByProductionStage(
    stage: ProductionStage,
    options: PaginationOptions
  ): Promise<PaginatedResult<styles>> {
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
                supplierCategory: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        style_costing: true,
        style_production_tracking: true,
        style_garment_trims: true,
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
        // First delete existing style_fabrics for all components
        const existingComponents = await tx.style_components.findMany({
          where: { styleId: id },
          select: { id: true },
        });

        for (const comp of existingComponents) {
          await tx.style_fabrics.deleteMany({
            where: { componentId: comp.id },
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

            await tx.style_components.create({
              data: {
                id: componentId,
                styleId: id,
                componentName: comp.componentName,
                componentType: comp.componentType || 'OTHER',
                sortOrder: idx,
              },
            });

            // Create nested fabrics if provided
            if (comp.fabrics && comp.fabrics.length > 0) {
              for (const fab of comp.fabrics as StyleFabricInput[]) {
                await tx.style_fabrics.create({
                  data: {
                    id: randomUUID(),
                    componentId,
                    fabricName: fab.fabricName || fab.greigeName || '',
                    fabricType: fab.fabricType || 'GENERIC',
                    fabricFinishType: (fab.fabricFinishType as 'DYED' | 'PRINTED' | 'YARN_DYED' | 'RAW') || null,
                    quantityNeeded: fab.quantityNeeded ? parseFloat(String(fab.quantityNeeded)) : 0,
                    notes: fab.notes || null,
                  },
                });
              }
            }
          }
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
                  processType: proc.processType as 'PRINTING' | 'DYEING' | 'EMBROIDERY' | 'CUTTING' | 'STITCHING' | 'FINISHING' | 'WASHING' | 'TRANSPORTATION' | 'HANDWORK' | 'SMOCKING',
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
        await tx.style_variants.deleteMany({
          where: { styleId: id },
        });

        if (data.skuVariants.length > 0) {
          // Filter out variants with empty SKUs and deduplicate by SKU
          const validVariants = (data.skuVariants as SKUVariantInput[])
            .filter(v => v.sku && v.sku.trim() !== '')
            .reduce((acc, variant) => {
              // Keep only the first occurrence of each SKU
              if (!acc.some(v => v.sku === variant.sku)) {
                acc.push(variant);
              }
              return acc;
            }, [] as SKUVariantInput[]);

          for (const variant of validVariants) {
            // Use upsert to handle any edge cases with existing SKUs
            await tx.style_variants.upsert({
              where: { sku: variant.sku },
              create: {
                id: randomUUID(),
                styleId: id,
                sizeName: variant.size,
                sku: variant.sku,
                barcode: variant.barcode || null,
                accountingSKU: variant.accountingSKU || null,
                isActive: variant.isActive !== false,
              },
              update: {
                styleId: id,
                sizeName: variant.size,
                barcode: variant.barcode || null,
                accountingSKU: variant.accountingSKU || null,
                isActive: variant.isActive !== false,
              },
            });
          }
        }
      }

      // Update the main style record
      const style = await tx.styles.update({
        where: { id },
        data: {
          styleName: data.styleName,
          customerName: data.customerName,
          brandName: data.brandName,
          brandCategoryId: data.brandCategoryId || null,
          description: data.description,
          season: data.season,
          numberOfComponents: data.numberOfComponents !== undefined
            ? (data.numberOfComponents ? parseInt(String(data.numberOfComponents), 10) : null)
            : undefined,
          costPrice: data.costPrice !== undefined
            ? (data.costPrice ? parseFloat(String(data.costPrice)) : null)
            : undefined,
          sellingPrice: data.sellingPrice !== undefined
            ? (data.sellingPrice ? parseFloat(String(data.sellingPrice)) : null)
            : undefined,
          hsnCode: data.hsnCode !== undefined ? data.hsnCode : undefined,
          productTaxRule: data.productTaxRule !== undefined ? data.productTaxRule : undefined,
          accountingSKU: data.accountingSKU !== undefined ? data.accountingSKU : undefined,
          accountingUnit: data.accountingUnit !== undefined ? data.accountingUnit : undefined,
          bulletPoints: data.bulletPoints !== undefined ? data.bulletPoints : undefined,
          specifications: data.specifications !== undefined ? data.specifications : undefined,
          imageUrl: data.imageUrl !== undefined ? data.imageUrl : undefined,
        },
        include: {
          brand_categories: true,
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
                  supplierCategory: true,
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
                supplierCategory: true,
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        style_garment_trims: true,
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
                supplierCategory: true,
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
      throw new ValidationError(
        `Invalid SKU format for: ${invalidSKUs.map((v) => v.sku).join(', ')}`
      );
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
                    widthCADs: { orderBy: { availableWidth: 'asc' } },
                  },
                },
                fabricCAD: true,
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
    const fabricGroups: Record<string, unknown> = {};
    for (const component of style.style_components) {
      for (const fabric of component.style_fabrics) {
        const groupKey =
          fabric.cadGroupKey ||
          `${fabric.fabric?.genericFabricName || 'Unknown'}-${fabric.fabricFinishType || 'Unknown'}`;

        if (!fabricGroups[groupKey]) {
          fabricGroups[groupKey] = {
            groupKey,
            genericFabricName: fabric.fabric?.genericFabricName,
            fabricFinishType: fabric.fabricFinishType,
            fabrics: [],
            components: [],
            availableWidthOptions: fabric.fabric?.widthCADs || [],
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
          currentCADId: fabric.fabricCADId,
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
  // Private Helper Methods
  // ============================================

  private async loadPresetAccessories(presetId?: string): Promise<PresetAccessoryItem[]> {
    if (!presetId) return [];

    try {
      const preset = await this.prisma.customer_accessories_presets.findUnique({
        where: { id: presetId },
      });

      if (preset && preset.accessoryItems) {
        return Array.isArray(preset.accessoryItems)
          ? (preset.accessoryItems as unknown as PresetAccessoryItem[])
          : [];
      }
    } catch (error) {
      logWarn('Failed to load customer accessories preset', { presetId, error });
    }

    return [];
  }

  private buildCombinedMaterialBOM(
    materialBOM: MaterialBOMInput[],
    presetAccessories: PresetAccessoryItem[]
  ): MaterialBOMInput[] {
    const combined: MaterialBOMInput[] = [...materialBOM, ...presetAccessories];

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
              quantityNeeded: fabric.quantityNeeded
                ? parseFloat(String(fabric.quantityNeeded))
                : null,
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
