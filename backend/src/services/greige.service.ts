/**
 * Greige Master Service
 * Business logic for raw, unfinished fabric specifications management
 */

import { BaseService, PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';
import { greige_master, Prisma } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError, BusinessError } from '../errors';
import { logInfo, logDebug } from '../utils/logger';
import { SearchFilter } from '../types/prisma.types';
import { materialService } from './material.service';
import { generateCode } from '../utils/code-generator';
import { syncMasterToMaterials } from './helpers/material-sync.helper';

// ============================================
// Types
// ============================================

export interface GreigeSupplierInput {
  supplierId: string;
  isPreferred?: boolean;
  isActive?: boolean;
  notes?: string;
}

// BUG-GR6 fix: aligned validation - added greigeQuality and weaver to match controller
export interface CreateGreigeDTO {
  greigeCode: string;
  greigeName: string;
  yarnCount?: string;
  construction?: string;
  composition: string;
  weaveType?: string;
  greigeQuality?: 'PRINTING' | 'DYEING' | 'SUPER_DYEING' | null;
  weaver?: string;
  greigeWidth: number;
  defaultCutableWidth?: number;
  expectedFinishedWidthMin?: number;
  expectedFinishedWidthMax?: number;
  averageShrinkagePercent?: number;
  gsmRange?: string;
  description?: string;
  notes?: string;
  isActive?: boolean;
  suppliers?: GreigeSupplierInput[];
}

// BUG-GR6 fix: aligned validation - added greigeQuality and weaver to match controller
export interface UpdateGreigeDTO {
  greigeCode?: string;
  greigeName?: string;
  yarnCount?: string;
  construction?: string;
  composition?: string;
  weaveType?: string;
  greigeQuality?: 'PRINTING' | 'DYEING' | 'SUPER_DYEING' | null;
  weaver?: string;
  greigeWidth?: number;
  defaultCutableWidth?: number;
  expectedFinishedWidthMin?: number;
  expectedFinishedWidthMax?: number;
  averageShrinkagePercent?: number;
  gsmRange?: string;
  description?: string;
  notes?: string;
  isActive?: boolean;
  suppliers?: GreigeSupplierInput[];
}

export interface GreigeQueryOptions extends PaginationOptions {
  supplierId?: string;
  isActive?: boolean | 'all';
  composition?: string;
  weaveType?: string;
}

// BUG-GR6 fix: aligned validation with single create - added greigeQuality, weaver, defaultCutableWidth
export interface BulkImportGreigeInput {
  greigeName: string;
  composition: string;
  greigeWidth: string | number;
  yarnCount?: string;
  construction?: string;
  weaveType?: string;
  greigeQuality?: 'PRINTING' | 'DYEING' | 'SUPER_DYEING' | null;
  weaver?: string;
  defaultCutableWidth?: string | number;
  expectedFinishedWidthMin?: string | number;
  expectedFinishedWidthMax?: string | number;
  averageShrinkagePercent?: string | number;
  gsmRange?: string;
  description?: string;
  notes?: string;
  isActive?: boolean;
}

export interface BulkImportResult {
  created: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

// ============================================
// Service
// ============================================

class GreigeServiceClass extends BaseService<greige_master, CreateGreigeDTO, UpdateGreigeDTO> {
  protected readonly modelName = 'greige_master';
  protected readonly entityName = 'Greige';

  protected get model(): any {
    return this.prisma.greige_master;
  }

  protected buildSearchFilter(search: string): SearchFilter {
    return [
      { greigeCode: { contains: search, mode: 'insensitive' as const } },
      { greigeName: { contains: search, mode: 'insensitive' as const } },
      { composition: { contains: search, mode: 'insensitive' as const } },
    ];
  }

  protected getDefaultIncludes(): IncludeConfig {
    return undefined; // Use specific includes in each method
  }

  protected getListIncludes(): IncludeConfig {
    return undefined; // Use specific includes in each method
  }

  // ============================================
  // Create Methods
  // ============================================

  /**
   * Create greige with suppliers
   */
  async createWithSuppliers(data: CreateGreigeDTO, userId: string): Promise<greige_master> {
    logDebug('Creating greige master with suppliers', { greigeCode: data.greigeCode });

    // Validate required fields
    if (!data.greigeCode || !data.greigeName || !data.composition || !data.greigeWidth) {
      throw new ValidationError('Missing required fields: greigeCode, greigeName, composition, greigeWidth');
    }

    // Check for duplicate code (only among active greige)
    const existingGreige = await this.prisma.greige_master.findFirst({
      where: {
        greigeCode: data.greigeCode,
        isActive: true,
      },
    });

    if (existingGreige) {
      throw new ConflictError(`Greige with code '${data.greigeCode}' already exists`);
    }

    // BUG-GR6 fix: Check for duplicate name + quality combination (same as controller createGreigeMaster)
    const duplicateNameQuality = await this.prisma.greige_master.findFirst({
      where: {
        greigeName: data.greigeName,
        greigeQuality: data.greigeQuality || null,
        isActive: true,
      },
    });
    if (duplicateNameQuality) {
      throw new ConflictError(
        `A greige with name "${data.greigeName}" and quality "${data.greigeQuality || 'None'}" already exists (${duplicateNameQuality.greigeCode}). Use a different quality or edit the existing entry.`
      );
    }

    // Validate suppliers exist
    if (data.suppliers && data.suppliers.length > 0) {
      const supplierIds = data.suppliers.map((s) => s.supplierId);
      const suppliers = await this.prisma.suppliers.findMany({
        where: { id: { in: supplierIds } },
      });

      if (suppliers.length !== supplierIds.length) {
        throw new ValidationError('One or more suppliers not found');
      }
    }

    // Create greige + materials record atomically so a failure cannot leave a master
    // without its materials record (split-ledger)
    const greige = await this.prisma.$transaction(async (tx) => {
      const created = await tx.greige_master.create({
        data: {
          greigeCode: data.greigeCode,
          greigeName: data.greigeName,
          yarnCount: data.yarnCount || null,
          construction: data.construction || null,
          composition: data.composition,
          weaveType: data.weaveType || null,
          // BUG-GR6 fix: greigeQuality and weaver now supported
          greigeQuality: data.greigeQuality || null,
          weaver: data.weaver || null,
          greigeWidth: data.greigeWidth,
          defaultCutableWidth: data.defaultCutableWidth || null,
          expectedFinishedWidthMin: data.expectedFinishedWidthMin || null,
          expectedFinishedWidthMax: data.expectedFinishedWidthMax || null,
          averageShrinkagePercent: data.averageShrinkagePercent ?? null,
          gsmRange: data.gsmRange || null,
          description: data.description || null,
          notes: data.notes || null,
          isActive: data.isActive ?? true,
          createdById: userId,
          suppliers: data.suppliers
            ? {
                create: data.suppliers.map((s) => ({
                  supplierId: s.supplierId,
                  isPreferred: s.isPreferred || false,
                  isActive: s.isActive !== undefined ? s.isActive : true,
                  notes: s.notes || null,
                })),
              }
            : undefined,
        },
        include: {
          suppliers: {
            include: {
              supplier: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  contactPerson: true,
                  email: true,
                  phone: true,
                  isActive: true,
                },
              },
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Auto-create corresponding materials record with same ID — same transaction, so a
      // failure rolls back the greige master instead of leaving the two tables inconsistent
      await materialService.createFromMaster(
        { id: created.id, code: data.greigeCode, name: data.greigeName },
        'GREIGE',
        tx
      );

      return created;
    });

    logInfo('Greige master created successfully', { id: greige.id, greigeCode: data.greigeCode });

    return this.serializeGreige(greige) as greige_master;
  }

  // ============================================
  // Read Methods
  // ============================================

  /**
   * Find all greiges with filters
   */
  async findAllWithFilters(options: GreigeQueryOptions): Promise<PaginatedResult<greige_master>> {
    const { page = 1, limit = 50, search, sortBy, sortOrder, ...filters } = options;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.greige_masterWhereInput = {};

    if (search) {
      where.OR = this.buildSearchFilter(search);
    }

    // Active filter
    if (filters.isActive !== 'all' && filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    // Supplier filter
    if (filters.supplierId) {
      where.suppliers = {
        some: {
          supplierId: filters.supplierId,
          isActive: true,
        },
      };
    }

    // Composition filter
    if (filters.composition) {
      where.composition = { contains: filters.composition, mode: 'insensitive' };
    }

    // Weave type filter
    if (filters.weaveType) {
      where.weaveType = filters.weaveType;
    }

    const [greiges, total] = await Promise.all([
      this.prisma.greige_master.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy || 'createdAt']: sortOrder || 'desc' },
        include: {
          suppliers: {
            include: {
              supplier: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  contactPerson: true,
                  email: true,
                  phone: true,
                  isActive: true,
                },
              },
            },
            orderBy: {
              isPreferred: 'desc',
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          _count: {
            select: {
              finishedFabrics: true,
            },
          },
        },
      }),
      this.prisma.greige_master.count({ where }),
    ]);

    // Serialize Decimal fields
    const serializedData = greiges.map((g) => this.serializeGreige(g));

    return {
      data: serializedData as greige_master[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get greige by ID with full details
   */
  async getFullDetails(id: string): Promise<greige_master> {
    const greige = await this.prisma.greige_master.findUnique({
      where: { id },
      include: {
        suppliers: {
          include: {
            supplier: {
              select: {
                id: true,
                code: true,
                name: true,
                contactPerson: true,
                email: true,
                phone: true,
                isActive: true,
              },
            },
          },
          orderBy: {
            isPreferred: 'desc',
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        finishedFabrics: {
          include: {
            widthCADs: true,
          },
        },
      },
    });

    if (!greige) {
      throw new NotFoundError('Greige', id);
    }

    return this.serializeGreige(greige) as greige_master;
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    totalGreige: number;
    activeGreige: number;
    inactiveGreige: number;
    byComposition: Array<{ composition: string; count: number }>;
    byWeaveType: Array<{ weaveType: string; count: number }>;
  }> {
    const [totalGreige, activeGreige] = await Promise.all([
      this.prisma.greige_master.count(),
      this.prisma.greige_master.count({ where: { isActive: true } }),
    ]);

    // Group by composition
    const byComposition = await this.prisma.$queryRaw<Array<{ composition: string; count: bigint }>>`
      SELECT composition, COUNT(*) as count
      FROM greige_master
      WHERE "isActive" = true
      GROUP BY composition
      ORDER BY count DESC
      LIMIT 10
    `;

    // Group by weave type
    const byWeaveType = await this.prisma.$queryRaw<Array<{ weaveType: string; count: bigint }>>`
      SELECT "weaveType", COUNT(*) as count
      FROM greige_master
      WHERE "isActive" = true AND "weaveType" IS NOT NULL
      GROUP BY "weaveType"
      ORDER BY count DESC
    `;

    return {
      totalGreige,
      activeGreige,
      inactiveGreige: totalGreige - activeGreige,
      byComposition: byComposition.map((item) => ({
        composition: item.composition,
        count: Number(item.count),
      })),
      byWeaveType: byWeaveType.map((item) => ({
        weaveType: item.weaveType,
        count: Number(item.count),
      })),
    };
  }

  /**
   * Get pricing history from fabric procurement
   */
  async getPricingHistory(
    id: string,
    limit: number = 5
  ): Promise<{
    greigeId: string;
    greigeName: string;
    greigeCode: string;
    pricingHistory: Array<{
      id: string;
      date: Date;
      supplier: { id: string; code: string; name: string } | null;
      quantity: unknown;
      unit: string;
      ratePerUnit: unknown;
      totalCost: unknown;
      width: unknown;
    }>;
  }> {
    const greige = await this.prisma.greige_master.findUnique({
      where: { id },
    });

    if (!greige) {
      throw new NotFoundError('Greige', id);
    }

    const procurements = await this.prisma.fabric_procurement.findMany({
      where: {
        greigeId: id,
        procurementType: 'GREIGE',
      },
      include: {
        supplier: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: {
        purchaseDate: 'desc',
      },
      take: limit,
    });

    const pricingHistory = procurements.map((p) => ({
      id: p.id,
      date: p.purchaseDate,
      supplier: p.supplier,
      quantity: p.quantityPurchased,
      unit: p.unit,
      ratePerUnit: p.ratePerUnit,
      totalCost: p.totalCost,
      width: p.width,
    }));

    return {
      greigeId: id,
      greigeName: greige.greigeName,
      greigeCode: greige.greigeCode,
      pricingHistory,
    };
  }

  // ============================================
  // Update Methods
  // ============================================

  /**
   * Update greige with suppliers
   */
  async updateWithSuppliers(id: string, data: UpdateGreigeDTO): Promise<greige_master> {
    logDebug('Updating greige master', { id });

    const existingGreige = await this.prisma.greige_master.findUnique({
      where: { id },
    });

    if (!existingGreige) {
      throw new NotFoundError('Greige', id);
    }

    // Check for duplicate code if updating
    if (data.greigeCode && data.greigeCode !== existingGreige.greigeCode) {
      const duplicateCode = await this.prisma.greige_master.findFirst({
        where: { greigeCode: data.greigeCode, isActive: true },
      });

      if (duplicateCode) {
        throw new ConflictError(`Greige with code '${data.greigeCode}' already exists`);
      }
    }

    // Build update data
    const updateData: Prisma.greige_masterUpdateInput = {
      greigeCode: data.greigeCode,
      greigeName: data.greigeName,
      yarnCount: data.yarnCount,
      construction: data.construction,
      composition: data.composition,
      weaveType: data.weaveType,
      greigeWidth: data.greigeWidth,
      defaultCutableWidth: data.defaultCutableWidth,
      expectedFinishedWidthMin: data.expectedFinishedWidthMin,
      expectedFinishedWidthMax: data.expectedFinishedWidthMax,
      averageShrinkagePercent: data.averageShrinkagePercent,
      gsmRange: data.gsmRange,
      description: data.description,
      notes: data.notes,
      isActive: data.isActive,
    };

    // Update suppliers if provided
    if (data.suppliers !== undefined) {
      // Delete existing supplier relationships
      await this.prisma.greige_suppliers.deleteMany({
        where: { greigeId: id },
      });

      // Create new supplier relationships
      updateData.suppliers = {
        create: data.suppliers.map((s) => ({
          supplierId: s.supplierId,
          isPreferred: s.isPreferred || false,
          isActive: s.isActive !== undefined ? s.isActive : true,
          notes: s.notes || null,
        })),
      };
    }

    const updatedGreige = await this.prisma.greige_master.update({
      where: { id },
      data: updateData,
      include: {
        suppliers: {
          include: {
            supplier: {
              select: {
                id: true,
                code: true,
                name: true,
                contactPerson: true,
                email: true,
                phone: true,
                isActive: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // BUG-MM13 fix: sync code to materials
    const syncUpdates: { code?: string; name?: string } = {};
    if (data.greigeCode && data.greigeCode !== existingGreige.greigeCode) {
      syncUpdates.code = data.greigeCode;
    }
    if (data.greigeName && data.greigeName !== existingGreige.greigeName) {
      syncUpdates.name = data.greigeName;
    }
    if (syncUpdates.code || syncUpdates.name) {
      await syncMasterToMaterials(id, 'GREIGE', syncUpdates);
    }

    logInfo('Greige master updated successfully', { id });
    return this.serializeGreige(updatedGreige) as greige_master;
  }

  // ============================================
  // Delete Methods
  // ============================================

  /**
   * Delete greige (with validation)
   */
  async deleteGreige(id: string): Promise<void> {
    logDebug('Deleting greige master', { id });

    const existingGreige = await this.prisma.greige_master.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            finishedFabrics: true,
          },
        },
      },
    });

    if (!existingGreige) {
      throw new NotFoundError('Greige', id);
    }

    // Check if greige has finished fabrics
    if (existingGreige._count.finishedFabrics > 0) {
      throw new BusinessError(
        `Cannot delete greige master with ${existingGreige._count.finishedFabrics} linked finished fabrics. Please delete or reassign the fabrics first.`
      );
    }

    await this.prisma.greige_master.delete({
      where: { id },
    });

    logInfo('Greige master deleted successfully', { id });
  }

  // ============================================
  // Bulk Operations
  // ============================================

  /**
   * Bulk import greige masters
   * BUG-GR6 fix: aligned validation with single create
   */
  async bulkImport(greiges: BulkImportGreigeInput[], userId: string): Promise<BulkImportResult> {
    logDebug('Bulk importing greige masters', { count: greiges.length });

    const results: BulkImportResult = {
      created: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < greiges.length; i++) {
      try {
        const greige = greiges[i];

        // BUG-GR6 fix: aligned validation with single create
        // Validate required fields (same as createWithSuppliers)
        if (!greige.greigeName || !greige.composition || !greige.greigeWidth) {
          results.failed++;
          results.errors.push({
            row: i + 2,
            error: 'Missing required fields: greigeName, composition, or greigeWidth',
          });
          continue;
        }

        // BUG-GR6 fix: Check for duplicate name + quality combination (same as createWithSuppliers)
        const duplicateNameQuality = await this.prisma.greige_master.findFirst({
          where: {
            greigeName: greige.greigeName,
            greigeQuality: greige.greigeQuality || null,
            isActive: true,
          },
        });
        if (duplicateNameQuality) {
          results.failed++;
          results.errors.push({
            row: i + 2,
            error: `A greige with name "${greige.greigeName}" and quality "${greige.greigeQuality || 'None'}" already exists (${duplicateNameQuality.greigeCode}). Use a different quality or edit the existing entry.`,
          });
          continue;
        }

        // Auto-generate greige code from the shared atomic 'GRG' sequence (same series as single
        // create / getNextGreigeCode) — the old count()-based numbering raced and duplicated codes
        const greigeCode = await generateCode('GRG', 'greige_master', 'greigeCode');

        // BUG-GR6 fix: Create greige master + materials record in transaction (same as createWithSuppliers)
        await this.prisma.$transaction(async (tx) => {
          const created = await tx.greige_master.create({
            data: {
              greigeCode,
              greigeName: greige.greigeName,
              yarnCount: greige.yarnCount || null,
              construction: greige.construction || null,
              composition: greige.composition,
              weaveType: greige.weaveType || null,
              // BUG-GR6 fix: greigeQuality and weaver now supported in bulk import
              greigeQuality: greige.greigeQuality || null,
              weaver: greige.weaver || null,
              greigeWidth: parseFloat(String(greige.greigeWidth)),
              // BUG-GR6 fix: defaultCutableWidth now supported in bulk import
              defaultCutableWidth: greige.defaultCutableWidth ? parseFloat(String(greige.defaultCutableWidth)) : null,
              expectedFinishedWidthMin: greige.expectedFinishedWidthMin
                ? parseFloat(String(greige.expectedFinishedWidthMin))
                : null,
              expectedFinishedWidthMax: greige.expectedFinishedWidthMax
                ? parseFloat(String(greige.expectedFinishedWidthMax))
                : null,
              averageShrinkagePercent: greige.averageShrinkagePercent
                ? parseFloat(String(greige.averageShrinkagePercent))
                : null,
              gsmRange: greige.gsmRange || null,
              description: greige.description || null,
              notes: greige.notes || null,
              isActive: greige.isActive !== false,
              createdById: userId,
            },
          });

          // BUG-GR6 fix: Create corresponding materials record (same as createWithSuppliers)
          await materialService.createFromMaster(
            { id: created.id, code: greigeCode, name: greige.greigeName },
            'GREIGE',
            tx
          );
        });

        results.created++;
      } catch (error: unknown) {
        // allow-swallow — per-row bulk-import reporter: single-table create, the failure is surfaced in errors[]
        results.failed++;
        results.errors.push({
          row: i + 2,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logInfo('Bulk import completed', {
      total: greiges.length,
      created: results.created,
      failed: results.failed,
    });

    return results;
  }

  /**
   * Export all greige masters
   */
  async exportAll(): Promise<{
    data: Array<Record<string, unknown>>;
    totalRecords: number;
  }> {
    const greigeMasters = await this.prisma.greige_master.findMany({
      where: { isActive: true },
      orderBy: { greigeCode: 'asc' },
      include: {
        suppliers: {
          include: {
            supplier: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const exportData = greigeMasters.map((greige) => {
      // Use stored genericGreigeName, fallback to extraction for legacy data
      let genericName = greige.genericGreigeName;
      if (!genericName) {
        const match = greige.greigeName.match(/^([A-Za-z\s]+?)(?:\s*\d|×)/);
        genericName = match ? match[1].trim() : greige.greigeName.split('/')[0].trim();
      }

      return {
        'Greige Code': greige.greigeCode,
        'Generic Greige Name': genericName,
        'Greige Name': greige.greigeName,
        'Yarn Count': greige.yarnCount || '',
        Construction: greige.construction || '',
        'Greige Width (inches)': Number(greige.greigeWidth),
        'Default Cutable Width (inches)': greige.defaultCutableWidth ? Number(greige.defaultCutableWidth) : '',
        Composition: greige.composition,
        'Weave Type': greige.weaveType || '',
        'GSM Range': greige.gsmRange || '',
        'Expected Finished Width Min': greige.expectedFinishedWidthMin ? Number(greige.expectedFinishedWidthMin) : '',
        'Expected Finished Width Max': greige.expectedFinishedWidthMax ? Number(greige.expectedFinishedWidthMax) : '',
        'Average Shrinkage %': Number(greige.averageShrinkagePercent),
        Description: greige.description || '',
        Notes: greige.notes || '',
        Suppliers: greige.suppliers.map((s) => `${s.supplier.code} - ${s.supplier.name}`).join('; '),
        'Is Active': greige.isActive ? 'TRUE' : 'FALSE',
      };
    });

    return {
      data: exportData,
      totalRecords: exportData.length,
    };
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private serializeGreige(greige: unknown): unknown {
    const data = greige as {
      greigeWidth?: unknown;
      defaultCutableWidth?: unknown;
      expectedFinishedWidthMin?: unknown;
      expectedFinishedWidthMax?: unknown;
      averageShrinkagePercent?: unknown;
      [key: string]: unknown;
    };

    return {
      ...data,
      greigeWidth: data.greigeWidth ? Number(data.greigeWidth) : null,
      defaultCutableWidth: data.defaultCutableWidth ? Number(data.defaultCutableWidth) : null,
      expectedFinishedWidthMin: data.expectedFinishedWidthMin ? Number(data.expectedFinishedWidthMin) : null,
      expectedFinishedWidthMax: data.expectedFinishedWidthMax ? Number(data.expectedFinishedWidthMax) : null,
      averageShrinkagePercent: data.averageShrinkagePercent ? Number(data.averageShrinkagePercent) : null,
    };
  }
}

// Export singleton instance
export const greigeService = new GreigeServiceClass();
