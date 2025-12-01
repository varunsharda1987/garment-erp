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
    const existingCostSheet = await this.prisma.style_costing.findUnique({
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
    const costSheet = await this.prisma.style_costing.findUnique({
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
    const existingCostSheet = await this.prisma.style_costing.findUnique({
      where: { styleId },
    });

    if (existingCostSheet) {
      throw new ConflictError('Cost sheet already exists for this style');
    }

    // Calculate fabric costs from approved CAD
    const { fabricDetails, totalFabricCost } = this.calculateFabricCosts(style);

    // Calculate material costs from BOM
    const { trimsDetails, accessoriesDetails, totalTrimsCost, totalAccessoriesCost } =
      this.calculateMaterialCosts(style);

    // Calculate process costs
    const totalProcessingCost = this.calculateProcessCosts(style);

    // Create cost sheet
    const costSheet = await this.prisma.style_costing.create({
      data: {
        id: `CS-${style.styleCode}-${Date.now()}`,
        styleId,
        createdById: userId,
        fabricCost: totalFabricCost,
        trimsCost: totalTrimsCost,
        accessoriesCost: totalAccessoriesCost,
        totalMaterialCost: totalFabricCost + totalTrimsCost + totalAccessoriesCost,
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
        fabricTotal: totalFabricCost,
        trimsTotal: totalTrimsCost,
        accessoriesTotal: totalAccessoriesCost,
        valueLossPercent: 2,
        valueLossAmount: 0,
        markupPercent: 15,
        markupAmount: 0,
        subtotal: totalFabricCost + totalTrimsCost + totalAccessoriesCost + totalProcessingCost,
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
    const embroideryTotal = (data.embroideryDetails || []).reduce(
      (sum, e) => sum + e.embroideryTotal,
      0
    );
    const accessoriesTotal = (data.accessoriesDetails || []).reduce(
      (sum, a) => sum + a.accessoryTotal,
      0
    );

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

  private mergeWithExisting(
    existing: style_costing,
    updates: UpdateCostSheetDTO
  ): CreateCostSheetDTO {
    return {
      styleId: existing.styleId,
      numberOfComponents: updates.numberOfComponents ?? existing.numberOfComponents ?? undefined,
      category: updates.category ?? existing.category ?? undefined,
      subCategory: updates.subCategory ?? existing.subCategory ?? undefined,
      fabricDetails:
        updates.fabricDetails || (existing.fabricDetails as unknown as FabricDetail[]) || [],
      trimsDetails:
        updates.trimsDetails || (existing.trimsDetails as unknown as TrimDetail[]) || [],
      cmtCosts: updates.cmtCosts || {
        cuttingCost: Number(existing.cuttingCost) || 0,
        stitchingCost: Number(existing.stitchingCost) || 0,
        finishingCost: Number(existing.finishingCost) || 0,
        buttonAttachmentCost: Number(existing.buttonAttachmentCost) || 0,
        handworkCost: Number(existing.handworkCmtCost) || 0,
      },
      embroideryDetails:
        updates.embroideryDetails ||
        (existing.embroideryDetails as unknown as EmbroideryDetail[]) ||
        [],
      accessoriesDetails:
        updates.accessoriesDetails ||
        (existing.accessoriesDetails as unknown as AccessoryDetail[]) ||
        [],
      valueLossPercent: updates.valueLossPercent ?? Number(existing.valueLossPercent) ?? 2,
      markupPercent: updates.markupPercent ?? Number(existing.markupPercent) ?? 15,
      notes: updates.notes ?? existing.notes ?? undefined,
    };
  }

  private calculateFabricCosts(style: {
    style_components: Array<{
      style_fabrics: Array<{
        id: string;
        fabricCADId: string | null;
        fabricCAD: {
          cadMeters: unknown;
          availableWidth: unknown;
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
          parseFloat(cad.cadMeters?.toString() || '0') *
          parseFloat(styleFabric.unitPrice?.toString() || '0');

        fabricDetails.push({
          fabricName: styleFabric.fabric?.fabricName || styleFabric.fabricName || 'Unknown',
          fabricWidth: parseFloat(cad.availableWidth?.toString() || '0'),
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

  private calculateProcessCosts(style: {
    style_processes: Array<{ estimatedCost: unknown }>;
  }): number {
    let totalProcessingCost = 0;

    for (const process of style.style_processes) {
      if (process.estimatedCost) {
        totalProcessingCost += parseFloat(process.estimatedCost.toString());
      }
    }

    return totalProcessingCost;
  }
}

// Export singleton instance
export const costingService = new CostingServiceClass();
