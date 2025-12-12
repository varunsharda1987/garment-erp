/**
 * Fabric Service
 * Business logic for fabric master management
 */

import { BaseService, PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';
import { fabric_master, Prisma } from '@prisma/client';
import { ConflictError, NotFoundError, ValidationError } from '../errors';
import { logInfo, logError, logDebug } from '../utils/logger';
import { SearchFilter } from '../types/prisma.types';

// ============================================
// Types
// ============================================

export interface FabricSupplierInput {
  supplierId: string;
  isPreferred?: boolean;
  isActive?: boolean;
  notes?: string;
}

export interface CreateFabricDTO {
  fabricCode: string;
  fabricName: string;
  greigeId: string;
  genericFabricName?: string;
  colorName?: string;
  colorCode?: string;
  finishType?: string;
  printDesign?: string;
  actualWidth: number;
  cutableWidth?: number;
  finishedConstruction?: string;
  actualGSM?: number;
  valueAddition?: string;
  valueAdditionCost?: number;
  styleReference?: string;
  componentType?: string;
  description?: string;
  notes?: string;
  imageUrl?: string;
  isGeneric?: boolean;
  isActive?: boolean;
  suppliers?: FabricSupplierInput[];
}

export interface UpdateFabricDTO extends Partial<CreateFabricDTO> {}

export interface FabricQueryOptions extends PaginationOptions {
  greigeId?: string;
  supplierId?: string;
  colorName?: string;
  finishType?: string;
  isActive?: boolean | 'all';
}

export interface BulkImportResult {
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

// ============================================
// Service
// ============================================

class FabricServiceClass extends BaseService<fabric_master, CreateFabricDTO, UpdateFabricDTO> {
  protected readonly modelName = 'fabric_master';
  protected readonly entityName = 'Fabric';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected get model(): any {
    return this.prisma.fabric_master;
  }

  protected buildSearchFilter(search: string): SearchFilter {
    return [
      { fabricCode: { contains: search, mode: 'insensitive' as const } },
      { fabricName: { contains: search, mode: 'insensitive' as const } },
      { colorName: { contains: search, mode: 'insensitive' as const } },
    ];
  }

  protected getDefaultIncludes(): IncludeConfig {
    return undefined; // Use specific includes in each method
  }

  // ============================================
  // Create Methods
  // ============================================

  /**
   * Create a new fabric master with suppliers
   */
  async createWithSuppliers(data: CreateFabricDTO, userId: string): Promise<fabric_master> {
    logDebug('Creating fabric master', { fabricCode: data.fabricCode });

    // Validate required fields
    if (!data.fabricCode || !data.fabricName || !data.greigeId || !data.actualWidth) {
      throw new ValidationError('Missing required fields: fabricCode, fabricName, greigeId, actualWidth');
    }

    // Check if fabric code already exists
    const existingFabric = await this.prisma.fabric_master.findUnique({
      where: { fabricCode: data.fabricCode },
    });

    if (existingFabric) {
      throw new ConflictError('Fabric code already exists');
    }

    // Verify greige exists
    const greige = await this.prisma.greige_master.findUnique({
      where: { id: data.greigeId },
    });

    if (!greige) {
      throw new NotFoundError('Greige master', data.greigeId);
    }

    const fabric = await this.prisma.fabric_master.create({
      data: {
        fabricCode: data.fabricCode,
        fabricName: data.fabricName,
        greigeId: data.greigeId,
        genericFabricName: data.genericFabricName || null,
        colorName: data.colorName || null,
        colorCode: data.colorCode || null,
        finishType: data.finishType || null,
        printDesign: data.printDesign || null,
        actualWidth: data.actualWidth,
        cutableWidth: data.cutableWidth || data.actualWidth - 2,
        finishedConstruction: data.finishedConstruction || null,
        actualGSM: data.actualGSM || null,
        valueAddition: data.valueAddition || null,
        valueAdditionCost: data.valueAdditionCost || null,
        styleReference: data.styleReference || null,
        componentType: data.componentType || null,
        description: data.description || null,
        notes: data.notes || null,
        imageUrl: data.imageUrl || null,
        isGeneric: data.isGeneric !== false,
        isActive: data.isActive !== false,
        createdById: userId,
        suppliers: data.suppliers
          ? {
              create: data.suppliers.map((s) => ({
                supplierId: s.supplierId,
                isPreferred: s.isPreferred || false,
                isActive: true,
                notes: null,
              })),
            }
          : undefined,
      },
      include: {
        greige: true,
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

    logInfo('Fabric master created', { id: fabric.id, fabricCode: fabric.fabricCode });
    return fabric;
  }

  // ============================================
  // Read Methods
  // ============================================

  /**
   * Find all fabrics with additional filters
   */
  async findAllWithFilters(options: FabricQueryOptions): Promise<PaginatedResult<fabric_master>> {
    const { page = 1, limit = 50, search, sortBy, sortOrder, ...filters } = options;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.fabric_masterWhereInput = {};

    if (filters.isActive !== 'all') {
      where.isActive = filters.isActive !== false;
    }

    if (search) {
      where.OR = this.buildSearchFilter(search);
    }

    if (filters.greigeId) {
      where.greigeId = filters.greigeId;
    }

    if (filters.supplierId) {
      where.suppliers = {
        some: {
          supplierId: filters.supplierId,
          isActive: true,
        },
      };
    }

    if (filters.colorName) {
      where.colorName = { contains: filters.colorName, mode: 'insensitive' };
    }

    if (filters.finishType) {
      where.finishType = filters.finishType;
    }

    const [fabrics, total] = await Promise.all([
      this.prisma.fabric_master.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy || 'createdAt']: sortOrder || 'desc' },
        include: {
          greige: true,
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
            orderBy: { isPreferred: 'desc' },
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
            select: { widthCADs: true },
          },
        },
      }),
      this.prisma.fabric_master.count({ where }),
    ]);

    return {
      data: fabrics,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get fabric with full details including width CADs
   */
  async getFullDetails(id: string): Promise<fabric_master> {
    const fabric = await this.prisma.fabric_master.findUnique({
      where: { id },
      include: {
        greige: true,
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
          orderBy: { isPreferred: 'desc' },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        widthCADs: {
          orderBy: { cutableWidth: 'asc' },
        },
      },
    });

    if (!fabric) {
      throw new NotFoundError('Fabric', id);
    }

    return fabric;
  }

  /**
   * Get fabrics by greige ID
   */
  async findByGreigeId(greigeId: string): Promise<fabric_master[]> {
    return this.prisma.fabric_master.findMany({
      where: { greigeId },
      include: {
        widthCADs: {
          orderBy: { cutableWidth: 'asc' },
        },
      },
      orderBy: { fabricName: 'asc' },
    });
  }

  /**
   * Get unique generic fabric names for dropdowns
   */
  async getGenericFabricNames(isActive?: boolean): Promise<string[]> {
    const where: Prisma.fabric_masterWhereInput = {
      genericFabricName: { not: null },
    };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const fabrics = await this.prisma.fabric_master.findMany({
      where,
      select: { genericFabricName: true },
      distinct: ['genericFabricName'],
      orderBy: { genericFabricName: 'asc' },
    });

    return fabrics
      .map((f) => f.genericFabricName)
      .filter((name): name is string => name !== null && name.trim().length > 0);
  }

  // ============================================
  // Update Methods
  // ============================================

  /**
   * Update fabric with suppliers
   */
  async updateWithSuppliers(id: string, data: UpdateFabricDTO): Promise<fabric_master> {
    logDebug('Updating fabric master', { id });

    const existingFabric = await this.prisma.fabric_master.findUnique({
      where: { id },
    });

    if (!existingFabric) {
      throw new NotFoundError('Fabric', id);
    }

    // If updating code, check for duplicates
    if (data.fabricCode && data.fabricCode !== existingFabric.fabricCode) {
      const duplicateCode = await this.prisma.fabric_master.findUnique({
        where: { fabricCode: data.fabricCode },
      });

      if (duplicateCode) {
        throw new ConflictError('Fabric code already exists');
      }
    }

    // If updating greige, verify it exists
    if (data.greigeId && data.greigeId !== existingFabric.greigeId) {
      const greige = await this.prisma.greige_master.findUnique({
        where: { id: data.greigeId },
      });

      if (!greige) {
        throw new NotFoundError('Greige master', data.greigeId);
      }
    }

    // Update suppliers if provided
    if (data.suppliers !== undefined) {
      await this.prisma.fabric_suppliers.deleteMany({
        where: { fabricId: id },
      });
    }

    const updatedFabric = await this.prisma.fabric_master.update({
      where: { id },
      data: {
        fabricCode: data.fabricCode,
        fabricName: data.fabricName,
        greigeId: data.greigeId,
        genericFabricName: data.genericFabricName,
        colorName: data.colorName,
        colorCode: data.colorCode,
        finishType: data.finishType,
        printDesign: data.printDesign,
        actualWidth: data.actualWidth,
        cutableWidth: data.cutableWidth,
        finishedConstruction: data.finishedConstruction,
        actualGSM: data.actualGSM,
        valueAddition: data.valueAddition,
        valueAdditionCost: data.valueAdditionCost,
        styleReference: data.styleReference,
        componentType: data.componentType,
        description: data.description,
        notes: data.notes,
        imageUrl: data.imageUrl,
        isGeneric: data.isGeneric,
        isActive: data.isActive,
        suppliers:
          data.suppliers !== undefined
            ? {
                create: data.suppliers.map((s) => ({
                  supplierId: s.supplierId,
                  isPreferred: s.isPreferred || false,
                  isActive: true,
                  notes: null,
                })),
              }
            : undefined,
      },
      include: {
        greige: true,
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

    logInfo('Fabric master updated', { id });
    return updatedFabric;
  }

  // ============================================
  // Statistics Methods
  // ============================================

  /**
   * Get fabric statistics
   */
  async getStatistics(): Promise<{
    totalFabrics: number;
    activeFabrics: number;
    inactiveFabrics: number;
    byFinishType: Array<{ finishType: string; count: number }>;
    byColor: Array<{ colorName: string; count: number }>;
  }> {
    const [totalFabrics, activeFabrics, byFinishType, byColor] = await Promise.all([
      this.prisma.fabric_master.count(),
      this.prisma.fabric_master.count({ where: { isActive: true } }),
      this.prisma.$queryRaw<Array<{ finishType: string; count: bigint }>>`
        SELECT "finishType", COUNT(*) as count
        FROM fabric_master
        WHERE "isActive" = true AND "finishType" IS NOT NULL
        GROUP BY "finishType"
        ORDER BY count DESC
      `,
      this.prisma.$queryRaw<Array<{ colorName: string; count: bigint }>>`
        SELECT "colorName", COUNT(*) as count
        FROM fabric_master
        WHERE "isActive" = true AND "colorName" IS NOT NULL
        GROUP BY "colorName"
        ORDER BY count DESC
        LIMIT 10
      `,
    ]);

    return {
      totalFabrics,
      activeFabrics,
      inactiveFabrics: totalFabrics - activeFabrics,
      byFinishType: byFinishType.map((item) => ({
        finishType: item.finishType,
        count: Number(item.count),
      })),
      byColor: byColor.map((item) => ({
        colorName: item.colorName,
        count: Number(item.count),
      })),
    };
  }

  /**
   * Get pricing history for a fabric
   */
  async getPricingHistory(
    id: string,
    limit: number = 5
  ): Promise<{
    fabricId: string;
    fabricName: string;
    fabricCode: string;
    pricingHistory: Array<{
      id: string;
      date: Date;
      supplier: { id: string; code: string; name: string } | null;
      quantity: number;
      unit: string;
      ratePerUnit: number;
      totalCost: number;
      width: number | null;
    }>;
  }> {
    const fabric = await this.prisma.fabric_master.findUnique({
      where: { id },
    });

    if (!fabric) {
      throw new NotFoundError('Fabric', id);
    }

    const procurements = await this.prisma.fabric_procurement.findMany({
      where: {
        fabricId: id,
        procurementType: 'FINISHED',
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
      orderBy: { purchaseDate: 'desc' },
      take: limit,
    });

    return {
      fabricId: id,
      fabricName: fabric.fabricName,
      fabricCode: fabric.fabricCode,
      pricingHistory: procurements.map((p) => ({
        id: p.id,
        date: p.purchaseDate,
        supplier: p.supplier,
        quantity: Number(p.quantityPurchased),
        unit: p.unit,
        ratePerUnit: Number(p.ratePerUnit),
        totalCost: Number(p.totalCost),
        width: p.width ? Number(p.width) : null,
      })),
    };
  }

  // ============================================
  // Bulk Import Methods
  // ============================================

  /**
   * Bulk import fabric masters
   */
  async bulkImport(
    fabrics: Array<Record<string, unknown>>,
    userId: string
  ): Promise<BulkImportResult> {
    const results: BulkImportResult = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
    };

    const currentCount = await this.prisma.fabric_master.count();

    for (let i = 0; i < fabrics.length; i++) {
      try {
        const fabric = fabrics[i];

        // Validate required fields
        if (!fabric.greigeCode && !fabric.greigeId) {
          results.failed++;
          results.errors.push({
            row: i + 2,
            error: 'Missing required field: greigeCode or greigeId',
          });
          continue;
        }

        if (!fabric.finishType || !fabric.actualWidth) {
          results.failed++;
          results.errors.push({
            row: i + 2,
            error: 'Missing required fields: finishType or actualWidth',
          });
          continue;
        }

        // Find greige by code if provided
        let greigeId = fabric.greigeId as string | undefined;
        if (fabric.greigeCode && !greigeId) {
          const greige = await this.prisma.greige_master.findUnique({
            where: { greigeCode: fabric.greigeCode as string },
          });

          if (!greige) {
            results.failed++;
            results.errors.push({
              row: i + 2,
              error: `Greige not found with code: ${fabric.greigeCode}`,
            });
            continue;
          }

          greigeId = greige.id;
        }

        // Auto-generate fabric code if not provided
        const fabricCode =
          (fabric.fabricCode as string) || `FAB-${String(currentCount + i + 1).padStart(4, '0')}`;

        // Auto-generate fabric name if not provided
        let fabricName = fabric.fabricName as string | undefined;
        if (!fabricName) {
          const greige = await this.prisma.greige_master.findUnique({ where: { id: greigeId } });
          const parts: string[] = [];

          if (fabric.styleReference && fabric.componentType) {
            parts.push(fabric.styleReference as string, fabric.componentType as string);
          }

          // Extract generic fabric name (everything before first digit or × character)
          let greigeGenericName = 'Fabric';
          if (greige?.greigeName) {
            const match = greige.greigeName.match(/^([A-Za-z\s]+?)(?:\s*\d|×)/);
            greigeGenericName = match ? match[1].trim() : greige.greigeName.split('/')[0].trim();
          }
          parts.push((fabric.genericFabricName as string) || greigeGenericName);
          parts.push(`${fabric.actualWidth}"`);

          if (fabric.colorName) {
            parts.push(fabric.colorName as string);
          }

          if (fabric.valueAddition) {
            parts.push(`+ ${fabric.valueAddition}`);
          }

          fabricName = parts.join(' - ');
        }

        const actualWidth = parseFloat(String(fabric.actualWidth));
        const cutableWidth =
          (fabric.cutableWidth as number) || actualWidth - 2;

        // Check if fabric code already exists
        const existingFabric = await this.prisma.fabric_master.findUnique({
          where: { fabricCode },
        });

        if (existingFabric) {
          await this.prisma.fabric_master.update({
            where: { fabricCode },
            data: {
              fabricName,
              greigeId,
              genericFabricName: (fabric.genericFabricName as string) || null,
              colorName: (fabric.colorName as string) || null,
              colorCode: (fabric.colorCode as string) || null,
              finishType: fabric.finishType as string,
              printDesign: (fabric.printDesign as string) || null,
              actualWidth,
              cutableWidth,
              finishedConstruction: (fabric.finishedConstruction as string) || null,
              actualGSM: fabric.actualGSM ? parseInt(String(fabric.actualGSM)) : null,
              valueAddition: (fabric.valueAddition as string) || null,
              valueAdditionCost: fabric.valueAdditionCost
                ? parseFloat(String(fabric.valueAdditionCost))
                : null,
              styleReference: (fabric.styleReference as string) || null,
              componentType: (fabric.componentType as string) || null,
              description: (fabric.description as string) || null,
              notes: (fabric.notes as string) || null,
              imageUrl: (fabric.imageUrl as string) || null,
              isGeneric: fabric.isGeneric !== false,
              isActive: fabric.isActive !== false,
            },
          });
          results.updated++;
        } else {
          await this.prisma.fabric_master.create({
            data: {
              fabricCode,
              fabricName,
              greigeId: greigeId!,
              genericFabricName: (fabric.genericFabricName as string) || null,
              colorName: (fabric.colorName as string) || null,
              colorCode: (fabric.colorCode as string) || null,
              finishType: fabric.finishType as string,
              printDesign: (fabric.printDesign as string) || null,
              actualWidth,
              cutableWidth,
              finishedConstruction: (fabric.finishedConstruction as string) || null,
              actualGSM: fabric.actualGSM ? parseInt(String(fabric.actualGSM)) : null,
              valueAddition: (fabric.valueAddition as string) || null,
              valueAdditionCost: fabric.valueAdditionCost
                ? parseFloat(String(fabric.valueAdditionCost))
                : null,
              styleReference: (fabric.styleReference as string) || null,
              componentType: (fabric.componentType as string) || null,
              description: (fabric.description as string) || null,
              notes: (fabric.notes as string) || null,
              imageUrl: (fabric.imageUrl as string) || null,
              isGeneric: fabric.isGeneric !== false,
              isActive: fabric.isActive !== false,
              createdById: userId,
            },
          });
          results.created++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          row: i + 2,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logInfo('Bulk import completed', {
      created: results.created,
      updated: results.updated,
      failed: results.failed,
    });

    return results;
  }

  /**
   * Export all fabric masters
   */
  async exportAll(): Promise<Array<Record<string, unknown>>> {
    const fabrics = await this.prisma.fabric_master.findMany({
      where: { isActive: true },
      orderBy: { fabricCode: 'asc' },
      include: {
        greige: {
          select: {
            greigeCode: true,
            greigeName: true,
            composition: true,
            yarnCount: true,
            construction: true,
          },
        },
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

    return fabrics.map((fabric) => ({
      'Fabric Code': fabric.fabricCode,
      'Fabric Name': fabric.fabricName,
      'Greige Code': fabric.greige?.greigeCode || '',
      'Greige Name': fabric.greige?.greigeName || '',
      'Generic Fabric Name': fabric.genericFabricName || '',
      'Style Reference': fabric.styleReference || '',
      'Component Type': fabric.componentType || '',
      'Color Name': fabric.colorName || '',
      'Color Code': fabric.colorCode || '',
      'Finish Type': fabric.finishType || '',
      'Print Design': fabric.printDesign || '',
      'Actual Width (inches)': Number(fabric.actualWidth),
      'Cutable Width (inches)': fabric.cutableWidth ? Number(fabric.cutableWidth) : '',
      'Finished Construction': fabric.finishedConstruction || '',
      'Actual GSM': fabric.actualGSM || '',
      'Value Addition': fabric.valueAddition || '',
      'Value Addition Cost': fabric.valueAdditionCost ? Number(fabric.valueAdditionCost) : '',
      Composition: fabric.greige?.composition || '',
      'Yarn Count': fabric.greige?.yarnCount || '',
      Construction: fabric.greige?.construction || '',
      Description: fabric.description || '',
      Notes: fabric.notes || '',
      Suppliers: fabric.suppliers.map((s) => `${s.supplier.code} - ${s.supplier.name}`).join('; '),
      'Is Generic': fabric.isGeneric ? 'TRUE' : 'FALSE',
      'Is Active': fabric.isActive ? 'TRUE' : 'FALSE',
    }));
  }
}

// Export singleton instance
export const fabricService = new FabricServiceClass();
