/**
 * Style Costing Service
 * Business logic for cost sheet management
 */

import { BaseService, PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';
import { style_costing, Prisma } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError, BusinessError } from '../errors';
import { logInfo, logError, logDebug, logWarn } from '../utils/logger';
import { SearchFilter, AdditionalFilters } from '../types/prisma.types';

// ============================================
// Types
// ============================================

export interface FabricDetail {
  fabricName: string;
  fabricWidth: number;
  fabricAverage: number;
  fabricRate: number;
  fabricTotal: number;
  fabricId?: string;
}

export interface TrimDetail {
  trimName: string;
  trimQuantity: number;
  trimRate: number;
  trimTotal: number;
}

export interface EmbroideryDetail {
  embroideryName: string;
  embroideryAverage: number;
  embroideryRate: number;
  embroideryTotal: number;
}

export interface AccessoryDetail {
  accessoryName: string;
  accessoryQuantity: number;
  accessoryRate: number;
  accessoryTotal: number;
}

export interface CMTCosts {
  cuttingCost: number;
  stitchingCost: number;
  finishingCost: number;
  buttonAttachmentCost: number;
  handworkCost: number;
  smockingCost: number;
}

export interface CreateCostSheetDTO {
  styleId: string;
  numberOfComponents?: number;
  category?: string;
  subCategory?: string;
  fabricDetails: FabricDetail[];
  trimsDetails: TrimDetail[];
  cmtCosts: CMTCosts;
  embroideryDetails?: EmbroideryDetail[];
  accessoriesDetails?: AccessoryDetail[];
  valueLossPercent?: number;
  markupPercent?: number;
  notes?: string;
}

export interface UpdateCostSheetDTO extends Partial<Omit<CreateCostSheetDTO, 'styleId'>> {}

export interface CostSheetQueryOptions extends PaginationOptions {
  approved?: 'all' | 'true' | 'false';
}

export interface CostCalculationResult {
  fabricTotal: number;
  trimsTotal: number;
  cmtTotal: number;
  embroideryTotal: number;
  accessoriesTotal: number;
  subtotal: number;
  valueLossAmount: number;
  markupAmount: number;
  totalProductCost: number;
}

// ============================================
// Service
// ============================================

class CostingServiceClass extends BaseService<style_costing, CreateCostSheetDTO, UpdateCostSheetDTO> {
  protected readonly modelName = 'style_costing';
  protected readonly entityName = 'Cost Sheet';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected get model(): any {
    return this.prisma.style_costing;
  }

  protected buildSearchFilter(search: string): SearchFilter {
    // Complex search done in custom methods
    return [];
  }

  protected getDefaultIncludes(): IncludeConfig {
    return undefined; // Use specific includes in each method
  }

  // ============================================
  // Create Methods
  // ============================================

  /**
   * Create a new cost sheet for a style
   */
  async createCostSheet(data: CreateCostSheetDTO, userId: string): Promise<style_costing> {
    logDebug('Creating cost sheet', { styleId: data.styleId });

    // Check if style exists
    const style = await this.prisma.styles.findUnique({
      where: { id: data.styleId },
    });

    if (!style) {
      throw new NotFoundError('Style', data.styleId);
    }

    // Check if cost sheet already exists
    const existingCostSheet = await this.prisma.style_costing.findFirst({
      where: { styleId: data.styleId },
    });

    if (existingCostSheet) {
      throw new ConflictError('Cost sheet already exists for this style');
    }

    // Calculate all totals
    const calculations = this.calculateCosts(data);

    // Generate cost sheet ID
    const costSheetId = `CS-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const costSheet = await this.prisma.style_costing.create({
      data: {
        id: costSheetId,
        styleId: data.styleId,
        numberOfComponents: data.numberOfComponents,
        category: data.category,
        subCategory: data.subCategory,
        fabricDetails: JSON.parse(JSON.stringify(data.fabricDetails)),
        fabricTotal: calculations.fabricTotal,
        trimsDetails: JSON.parse(JSON.stringify(data.trimsDetails)),
        trimsTotal: calculations.trimsTotal,
        cuttingCost: data.cmtCosts.cuttingCost,
        stitchingCost: data.cmtCosts.stitchingCost,
        finishingCost: data.cmtCosts.finishingCost,
        buttonAttachmentCost: data.cmtCosts.buttonAttachmentCost,
        handworkCmtCost: data.cmtCosts.handworkCost,
        smockingCost: data.cmtCosts.smockingCost,
        cmtTotal: calculations.cmtTotal,
        embroideryDetails: JSON.parse(JSON.stringify(data.embroideryDetails || [])),
        embroideryTotal: calculations.embroideryTotal,
        accessoriesDetails: JSON.parse(JSON.stringify(data.accessoriesDetails || [])),
        accessoriesTotal: calculations.accessoriesTotal,
        valueLossPercent: data.valueLossPercent ?? 2,
        valueLossAmount: calculations.valueLossAmount,
        markupPercent: data.markupPercent ?? 15,
        markupAmount: calculations.markupAmount,
        subtotal: calculations.subtotal,
        totalProductCost: calculations.totalProductCost,
        notes: data.notes,
        createdById: userId,
      },
      include: this.getDefaultIncludes(),
    });

    logInfo('Cost sheet created', { id: costSheet.id, styleId: data.styleId });
    return costSheet;
  }

  // ============================================
  // Read Methods
  // ============================================

  /**
   * Find all cost sheets with filters
   */
  async findAllWithFilters(options: CostSheetQueryOptions): Promise<PaginatedResult<style_costing>> {
    const { page = 1, limit = 10, search, sortBy, sortOrder, approved } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.style_costingWhereInput = {};

    if (search) {
      where.styles = {
        OR: [
          { styleCode: { contains: search, mode: 'insensitive' } },
          { styleName: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    if (approved !== 'all') {
      where.isApproved = approved === 'true';
    }

    const [costSheets, total] = await Promise.all([
      this.prisma.style_costing.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy || 'createdAt']: sortOrder || 'desc' },
        include: this.getDefaultIncludes(),
      }),
      this.prisma.style_costing.count({ where }),
    ]);

    return {
      data: costSheets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get cost sheet by style ID
   */
  async findByStyleId(styleId: string): Promise<style_costing> {
    const costSheet = await this.prisma.style_costing.findFirst({
      where: { styleId },
      include: this.getDefaultIncludes(),
    });

    if (!costSheet) {
      throw new NotFoundError('Cost sheet for style', styleId);
    }

    return costSheet;
  }

  // ============================================
  // Update Methods
  // ============================================

  /**
   * Update cost sheet (only for unapproved cost sheets)
   */
  async updateCostSheet(id: string, data: UpdateCostSheetDTO): Promise<style_costing> {
    logDebug('Updating cost sheet', { id });

    const existingCostSheet = await this.prisma.style_costing.findUnique({
      where: { id },
    });

    if (!existingCostSheet) {
      throw new NotFoundError('Cost Sheet', id);
    }

    if (existingCostSheet.isApproved) {
      throw new BusinessError('Cannot update approved cost sheet');
    }

    // Merge existing data with updates for calculation
    const mergedData = this.mergeWithExisting(existingCostSheet, data);
    const calculations = this.calculateCosts(mergedData);

    const updateData: Prisma.style_costingUpdateInput = {
      ...(data.numberOfComponents !== undefined && { numberOfComponents: data.numberOfComponents }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.subCategory !== undefined && { subCategory: data.subCategory }),
      ...(data.fabricDetails && {
        fabricDetails: JSON.parse(JSON.stringify(data.fabricDetails)),
      }),
      fabricTotal: calculations.fabricTotal,
      ...(data.trimsDetails && {
        trimsDetails: JSON.parse(JSON.stringify(data.trimsDetails)),
      }),
      trimsTotal: calculations.trimsTotal,
      ...(data.cmtCosts && {
        cuttingCost: data.cmtCosts.cuttingCost,
        stitchingCost: data.cmtCosts.stitchingCost,
        finishingCost: data.cmtCosts.finishingCost,
        buttonAttachmentCost: data.cmtCosts.buttonAttachmentCost,
        handworkCmtCost: data.cmtCosts.handworkCost,
        smockingCost: data.cmtCosts.smockingCost,
      }),
      cmtTotal: calculations.cmtTotal,
      ...(data.embroideryDetails && {
        embroideryDetails: JSON.parse(JSON.stringify(data.embroideryDetails)),
      }),
      embroideryTotal: calculations.embroideryTotal,
      ...(data.accessoriesDetails && {
        accessoriesDetails: JSON.parse(JSON.stringify(data.accessoriesDetails)),
      }),
      accessoriesTotal: calculations.accessoriesTotal,
      ...(data.valueLossPercent !== undefined && { valueLossPercent: data.valueLossPercent }),
      valueLossAmount: calculations.valueLossAmount,
      ...(data.markupPercent !== undefined && { markupPercent: data.markupPercent }),
      markupAmount: calculations.markupAmount,
      subtotal: calculations.subtotal,
      totalProductCost: calculations.totalProductCost,
      ...(data.notes !== undefined && { notes: data.notes }),
    };

    const costSheet = await this.prisma.style_costing.update({
      where: { id },
      data: updateData,
      include: this.getDefaultIncludes(),
    });

    logInfo('Cost sheet updated', { id });
    return costSheet;
  }

  /**
   * Approve or reject cost sheet
   */
  async approve(id: string, userId: string, approved: boolean): Promise<style_costing> {
    logDebug('Approving cost sheet', { id, approved });

    const costSheet = await this.prisma.style_costing.findUnique({
      where: { id },
    });

    if (!costSheet) {
      throw new NotFoundError('Cost Sheet', id);
    }

    const updatedCostSheet = await this.prisma.style_costing.update({
      where: { id },
      data: {
        isApproved: approved,
        approvedById: approved ? userId : null,
        approvedAt: approved ? new Date() : null,
      },
      include: this.getDefaultIncludes(),
    });

    logInfo(approved ? 'Cost sheet approved' : 'Cost sheet approval revoked', { id });
    return updatedCostSheet;
  }

  /**
   * Delete cost sheet (only unapproved)
   */
  async deleteCostSheet(id: string): Promise<void> {
    logDebug('Deleting cost sheet', { id });

    const costSheet = await this.prisma.style_costing.findUnique({
      where: { id },
    });

    if (!costSheet) {
      throw new NotFoundError('Cost Sheet', id);
    }

    if (costSheet.isApproved) {
      throw new BusinessError('Cannot delete approved cost sheet');
    }

    await this.prisma.style_costing.delete({
      where: { id },
    });

    logInfo('Cost sheet deleted', { id });
  }

  // ============================================
  // Auto-generation Methods
  // ============================================

  /**
   * Auto-generate cost sheet from approved CAD data
   */
  async generateFromStyle(styleId: string, userId: string): Promise<style_costing> {
    logDebug('Generating cost sheet from style', { styleId });

    // Get style with all related data including embroidery
    const style = await this.prisma.styles.findUnique({
      where: { id: styleId },
      include: {
        style_components: {
          include: {
            style_fabrics: {
              include: {
                fabric: true,
                fabricCAD: true,
                embroidery: true, // Include embroidery details
              },
            },
          },
        },
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
        },
        style_processes: true,
      },
    });

    if (!style) {
      throw new NotFoundError('Style', styleId);
    }

    // Validate CAD is approved
    if (style.cadStatus !== 'APPROVED') {
      throw new BusinessError('CAD planning must be approved before generating cost sheet');
    }

    // Check if cost sheet already exists
    const existingCostSheet = await this.prisma.style_costing.findFirst({
      where: { styleId },
    });

    if (existingCostSheet) {
      throw new ConflictError('Cost sheet already exists for this style');
    }

    // Calculate fabric costs from approved CAD
    const { fabricDetails, totalFabricCost } = this.calculateFabricCosts(style);

    // Calculate embroidery costs from style fabrics
    const { embroideryDetails, totalEmbroideryCost } = this.calculateEmbroideryCosts(style);

    // Calculate material costs from BOM
    const { trimsDetails, accessoriesDetails, totalTrimsCost, totalAccessoriesCost } =
      this.calculateMaterialCosts(style);

    // Calculate process costs
    const totalProcessingCost = this.calculateProcessCosts(style);

    // Calculate subtotal including embroidery
    const subtotal =
      totalFabricCost + totalTrimsCost + totalAccessoriesCost + totalEmbroideryCost + totalProcessingCost;

    // Create cost sheet
    const costSheet = await this.prisma.style_costing.create({
      data: {
        id: `CS-${style.styleCode}-${Date.now()}`,
        styleId,
        createdById: userId,
        fabricCost: totalFabricCost,
        trimsCost: totalTrimsCost,
        accessoriesCost: totalAccessoriesCost,
        totalMaterialCost: totalFabricCost + totalTrimsCost + totalAccessoriesCost + totalEmbroideryCost,
        totalProcessingCost,
        cuttingCost: 0,
        stitchingCost: 0,
        finishingCost: 0,
        checkingCost: 0,
        buttonAttachmentCost: 0,
        handworkCmtCost: 0,
        cmtCost: 0,
        totalProductionCost: 0,
        adminOverhead: 0,
        factoryOverhead: 0,
        transportCost: 0,
        otherOverheads: 0,
        fabricDetails: JSON.parse(JSON.stringify(fabricDetails)),
        trimsDetails: JSON.parse(JSON.stringify(trimsDetails)),
        accessoriesDetails: JSON.parse(JSON.stringify(accessoriesDetails)),
        embroideryDetails: JSON.parse(JSON.stringify(embroideryDetails)),
        fabricTotal: totalFabricCost,
        trimsTotal: totalTrimsCost,
        accessoriesTotal: totalAccessoriesCost,
        embroideryTotal: totalEmbroideryCost,
        valueLossPercent: 2,
        valueLossAmount: 0,
        markupPercent: 15,
        markupAmount: 0,
        subtotal,
        totalProductCost: 0,
        totalCostPerPiece: 0,
        sellingPricePerPiece: 0,
        profitMargin: 0,
        profitAmount: 0,
        isApproved: false,
      },
      include: this.getDefaultIncludes(),
    });

    logInfo('Cost sheet auto-generated', {
      costSheetId: costSheet.id,
      styleCode: style.styleCode,
      embroideryCount: embroideryDetails.length,
      totalEmbroideryCost,
    });

    return costSheet;
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private calculateCosts(data: CreateCostSheetDTO | ReturnType<typeof this.mergeWithExisting>): CostCalculationResult {
    const fabricTotal = data.fabricDetails.reduce((sum, f) => sum + f.fabricTotal, 0);
    const trimsTotal = data.trimsDetails.reduce((sum, t) => sum + t.trimTotal, 0);
    const cmtTotal = Object.values(data.cmtCosts).reduce((sum, c) => sum + c, 0);
    const embroideryTotal = (data.embroideryDetails || []).reduce((sum, e) => sum + e.embroideryTotal, 0);
    const accessoriesTotal = (data.accessoriesDetails || []).reduce((sum, a) => sum + a.accessoryTotal, 0);

    const subtotal = fabricTotal + trimsTotal + cmtTotal + embroideryTotal + accessoriesTotal;
    const valueLossPercent = data.valueLossPercent ?? 2;
    const valueLossAmount = (subtotal * valueLossPercent) / 100;
    const totalAfterValueLoss = subtotal + valueLossAmount;
    const markupPercent = data.markupPercent ?? 15;
    const markupAmount = (totalAfterValueLoss * markupPercent) / 100;
    const totalProductCost = totalAfterValueLoss + markupAmount;

    return {
      fabricTotal,
      trimsTotal,
      cmtTotal,
      embroideryTotal,
      accessoriesTotal,
      subtotal,
      valueLossAmount,
      markupAmount,
      totalProductCost,
    };
  }

  /** Convert nullable Prisma Decimal to number, using the provided default for NULL values */
  private decimalToNum(value: unknown, defaultValue = 0): number {
    if (value == null) return defaultValue;
    const num = Number(value);
    if (Number.isNaN(num)) return defaultValue;
    return num;
  }

  private mergeWithExisting(existing: style_costing, updates: UpdateCostSheetDTO): CreateCostSheetDTO {
    return {
      styleId: existing.styleId,
      numberOfComponents: updates.numberOfComponents ?? existing.numberOfComponents ?? undefined,
      category: updates.category ?? existing.category ?? undefined,
      subCategory: updates.subCategory ?? existing.subCategory ?? undefined,
      fabricDetails: updates.fabricDetails ?? (existing.fabricDetails as unknown as FabricDetail[]) ?? [],
      trimsDetails: updates.trimsDetails ?? (existing.trimsDetails as unknown as TrimDetail[]) ?? [],
      cmtCosts: updates.cmtCosts ?? {
        cuttingCost: this.decimalToNum(existing.cuttingCost),
        stitchingCost: this.decimalToNum(existing.stitchingCost),
        finishingCost: this.decimalToNum(existing.finishingCost),
        buttonAttachmentCost: this.decimalToNum(existing.buttonAttachmentCost),
        handworkCost: this.decimalToNum(existing.handworkCmtCost),
        smockingCost: this.decimalToNum(existing.smockingCost),
      },
      embroideryDetails:
        updates.embroideryDetails ?? (existing.embroideryDetails as unknown as EmbroideryDetail[]) ?? [],
      accessoriesDetails:
        updates.accessoriesDetails ?? (existing.accessoriesDetails as unknown as AccessoryDetail[]) ?? [],
      valueLossPercent: updates.valueLossPercent ?? this.decimalToNum(existing.valueLossPercent, 2),
      markupPercent: updates.markupPercent ?? this.decimalToNum(existing.markupPercent, 15),
      notes: updates.notes ?? existing.notes ?? undefined,
    };
  }

  private calculateFabricCosts(style: {
    style_components: Array<{
      style_fabrics: Array<{
        id: string;
        fabricId: string | null;
        fabricCADId: string | null;
        fabricCAD: {
          cadMeters: unknown;
          cutableWidth: unknown;
        } | null;
        fabric: { fabricName: string } | null;
        fabricName: string | null;
        unitPrice: unknown;
      }>;
    }>;
  }): { fabricDetails: FabricDetail[]; totalFabricCost: number } {
    let totalFabricCost = 0;
    const fabricDetails: FabricDetail[] = [];

    for (const component of style.style_components) {
      for (const styleFabric of component.style_fabrics) {
        if (!styleFabric.fabricCADId) {
          logWarn(`Style fabric ${styleFabric.id} missing CAD assignment`);
          continue;
        }

        const cad = styleFabric.fabricCAD;
        if (!cad) continue;

        const fabricCost =
          parseFloat(cad.cadMeters?.toString() || '0') * parseFloat(styleFabric.unitPrice?.toString() || '0');

        fabricDetails.push({
          fabricId: styleFabric.fabricId || undefined,
          fabricName: styleFabric.fabric?.fabricName || styleFabric.fabricName || 'Unknown',
          fabricWidth: parseFloat(cad.cutableWidth?.toString() || '0'),
          fabricAverage: parseFloat(cad.cadMeters?.toString() || '0'),
          fabricRate: parseFloat(styleFabric.unitPrice?.toString() || '0'),
          fabricTotal: fabricCost,
        });

        totalFabricCost += fabricCost;
      }
    }

    return { fabricDetails, totalFabricCost };
  }

  private calculateMaterialCosts(style: {
    style_material_bom: Array<{
      quantityPerGarment: unknown;
      unitPrice: unknown;
      usageCategory: string;
      lace_master: { laceName: string } | null;
      button_master: { buttonName: string } | null;
      thread_master: { threadName: string } | null;
      zipper_master: { zipperName: string } | null;
      elastic_master: { elasticName: string } | null;
      label_master: { labelName: string } | null;
      packaging_master: { packagingName: string } | null;
    }>;
  }): {
    trimsDetails: TrimDetail[];
    accessoriesDetails: AccessoryDetail[];
    totalTrimsCost: number;
    totalAccessoriesCost: number;
  } {
    let totalTrimsCost = 0;
    let totalAccessoriesCost = 0;
    const trimsDetails: TrimDetail[] = [];
    const accessoriesDetails: AccessoryDetail[] = [];

    for (const bom of style.style_material_bom) {
      const quantity = parseFloat(bom.quantityPerGarment?.toString() || '0');
      const unitPrice = parseFloat(bom.unitPrice?.toString() || '0');
      const total = quantity * unitPrice;

      // Get material name
      let materialName = 'Unknown';
      if (bom.lace_master) materialName = bom.lace_master.laceName;
      else if (bom.button_master) materialName = bom.button_master.buttonName;
      else if (bom.thread_master) materialName = bom.thread_master.threadName;
      else if (bom.zipper_master) materialName = bom.zipper_master.zipperName;
      else if (bom.elastic_master) materialName = bom.elastic_master.elasticName;
      else if (bom.label_master) materialName = bom.label_master.labelName;
      else if (bom.packaging_master) materialName = bom.packaging_master.packagingName;

      if (bom.usageCategory === 'GARMENT_TRIM') {
        trimsDetails.push({
          trimName: materialName,
          trimQuantity: quantity,
          trimRate: unitPrice,
          trimTotal: total,
        });
        totalTrimsCost += total;
      } else if (bom.usageCategory === 'PACKAGING') {
        accessoriesDetails.push({
          accessoryName: materialName,
          accessoryQuantity: quantity,
          accessoryRate: unitPrice,
          accessoryTotal: total,
        });
        totalAccessoriesCost += total;
      }
    }

    return { trimsDetails, accessoriesDetails, totalTrimsCost, totalAccessoriesCost };
  }

  private calculateProcessCosts(style: { style_processes: Array<{ estimatedCost: unknown }> }): number {
    let totalProcessingCost = 0;

    for (const process of style.style_processes) {
      if (process.estimatedCost) {
        totalProcessingCost += parseFloat(process.estimatedCost.toString());
      }
    }

    return totalProcessingCost;
  }

  /**
   * Calculate embroidery costs from style fabrics
   * Uses CAD meters * embroidery cost per meter
   */
  private calculateEmbroideryCosts(style: {
    style_components: Array<{
      componentName: string;
      style_fabrics: Array<{
        id: string;
        hasEmbroidery: boolean | null;
        embroideryId: string | null;
        embroidery: {
          designName: string;
          embroideryCode: string;
          costPerMeter: unknown;
        } | null;
        fabricCAD: {
          cadMeters: unknown;
        } | null;
        genericGreigeName: string | null;
      }>;
    }>;
  }): { embroideryDetails: EmbroideryDetail[]; totalEmbroideryCost: number } {
    let totalEmbroideryCost = 0;
    const embroideryDetails: EmbroideryDetail[] = [];
    const processedEmbroideries = new Set<string>();

    for (const component of style.style_components) {
      for (const styleFabric of component.style_fabrics) {
        // Skip fabrics without embroidery
        if (!styleFabric.hasEmbroidery || !styleFabric.embroideryId || !styleFabric.embroidery) {
          continue;
        }

        // Create unique key for embroidery + fabric combination to avoid duplicates
        const uniqueKey = `${styleFabric.embroideryId}-${styleFabric.genericGreigeName || 'unknown'}`;

        // Skip if already processed (same embroidery on same fabric type across components)
        if (processedEmbroideries.has(uniqueKey)) {
          continue;
        }
        processedEmbroideries.add(uniqueKey);

        const embroidery = styleFabric.embroidery;
        const cadMeters = styleFabric.fabricCAD?.cadMeters ? parseFloat(styleFabric.fabricCAD.cadMeters.toString()) : 0;
        const embroideryRate = embroidery.costPerMeter ? parseFloat(embroidery.costPerMeter.toString()) : 0;

        // Calculate embroidery cost: CAD meters * embroidery rate per meter
        const embroideryCost = cadMeters * embroideryRate;

        if (embroideryCost > 0) {
          embroideryDetails.push({
            embroideryName: `${embroidery.designName} (${embroidery.embroideryCode})`,
            embroideryAverage: cadMeters,
            embroideryRate: embroideryRate,
            embroideryTotal: embroideryCost,
          });

          totalEmbroideryCost += embroideryCost;
        }
      }
    }

    return { embroideryDetails, totalEmbroideryCost };
  }

  // ============================================
  // Budget Suggestions for Direct Procurement
  // ============================================

  /**
   * Calculate budget suggestions from style data for direct procurement
   * Used when creating RAW_MATERIAL_CALCULATION or PRODUCTION cost sheets
   * without going through COSTING approval first
   */
  async getBudgetSuggestions(styleId: string): Promise<{
    fabricBudget: number;
    trimsBudget: number;
    cmtBudget: number;
    embroideryBudget: number;
    accessoriesBudget: number;
    totalBudget: number;
    sources: {
      fabricSource: string;
      trimsSource: string;
      cmtSource: string;
      embroiderySource: string;
      accessoriesSource: string;
    };
  }> {
    logDebug('Calculating budget suggestions', { styleId });

    // Get style with all related data
    const style = await this.prisma.styles.findUnique({
      where: { id: styleId },
      include: {
        style_components: {
          include: {
            style_fabrics: {
              include: {
                fabric: true,
                fabricCAD: true,
                embroidery: true,
              },
            },
          },
        },
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
        },
        style_processes: {
          include: {
            supplier: true,
          },
        },
      },
    });

    if (!style) {
      throw new NotFoundError('Style', styleId);
    }

    // Calculate fabric budget from CAD data
    let fabricBudget = 0;
    let fabricSource = 'No CAD data available';
    const cadRows = await this.prisma.fabric_width_cad.findMany({
      where: {
        costingStyleId: styleId,
        purpose: { in: ['COSTING', 'RAW_MATERIAL_CALCULATION'] },
      },
      select: {
        greigeCostPerMeter: true,
        processingPricePerMeter: true,
        cadMeters: true,
      },
    });

    if (cadRows.length > 0) {
      for (const cad of cadRows) {
        const greigeCost = Number(cad.greigeCostPerMeter) || 0;
        const processingCost = Number(cad.processingPricePerMeter) || 0;
        const consumption = Number(cad.cadMeters) || 0;
        fabricBudget += (greigeCost + processingCost) * consumption;
      }
      fabricSource = `Calculated from ${cadRows.length} CAD row(s)`;
    } else {
      // Fallback to style_fabrics unit prices
      const { totalFabricCost } = this.calculateFabricCosts(style);
      fabricBudget = totalFabricCost;
      fabricSource = 'Calculated from style fabric unit prices';
    }

    // Calculate trims and accessories budget from BOM
    const { totalTrimsCost, totalAccessoriesCost } = this.calculateMaterialCosts(style);
    const trimsSource =
      style.style_material_bom.length > 0
        ? `Calculated from ${style.style_material_bom.filter((b) => b.usageCategory === 'GARMENT_TRIM').length} BOM items`
        : 'No BOM data available';
    const accessoriesSource =
      style.style_material_bom.length > 0
        ? `Calculated from ${style.style_material_bom.filter((b) => b.usageCategory === 'PACKAGING').length} BOM items`
        : 'No BOM data available';

    // Calculate embroidery budget
    const { totalEmbroideryCost } = this.calculateEmbroideryCosts(style);
    const embroiderySource =
      totalEmbroideryCost > 0 ? 'Calculated from style embroidery settings' : 'No embroidery data available';

    // Calculate CMT budget from style processes with rate card lookup
    let cmtBudget = 0;
    let cmtSource = 'No process data available';

    if (style.style_processes.length > 0) {
      // Try to get rates from processor rate cards
      // Note: style_processes uses processType (enum), rate cards use processingType (string)
      const processTypes = style.style_processes.map((p: any) => p.processType as string);
      const rateCards = await this.prisma.processor_rate_card.findMany({
        where: {
          processingType: { in: processTypes },
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const rateMap = new Map<string, number>();
      for (const card of rateCards) {
        if (!rateMap.has(card.processingType)) {
          rateMap.set(card.processingType, Number(card.ratePerMeter) || 0);
        }
      }

      for (const process of style.style_processes as any[]) {
        const rate = rateMap.get(process.processType) || Number(process.estimatedCost) || 0;
        cmtBudget += rate;
      }

      cmtSource =
        rateCards.length > 0
          ? `Calculated from ${rateCards.length} rate card(s)`
          : `Estimated from ${style.style_processes.length} process(es)`;
    }

    const totalBudget = fabricBudget + totalTrimsCost + cmtBudget + totalEmbroideryCost + totalAccessoriesCost;

    logInfo('Budget suggestions calculated', {
      styleId,
      fabricBudget,
      trimsBudget: totalTrimsCost,
      cmtBudget,
      embroideryBudget: totalEmbroideryCost,
      accessoriesBudget: totalAccessoriesCost,
      totalBudget,
    });

    return {
      fabricBudget,
      trimsBudget: totalTrimsCost,
      cmtBudget,
      embroideryBudget: totalEmbroideryCost,
      accessoriesBudget: totalAccessoriesCost,
      totalBudget,
      sources: {
        fabricSource,
        trimsSource,
        cmtSource,
        embroiderySource,
        accessoriesSource,
      },
    };
  }
}

// Export singleton instance
export const costingService = new CostingServiceClass();
