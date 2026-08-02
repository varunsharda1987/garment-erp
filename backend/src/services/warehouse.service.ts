// Warehouse Service - Manage warehouse master data
import { WarehouseType, Prisma } from '@prisma/client';
import prisma from '../config/database';
import { getDerivedStock, getDerivedValuation } from './helpers/derived-stock.helper';
import { generateAtomicMasterCode } from '../utils/atomicCodeGenerator';

export interface CreateWarehouseDTO {
  warehouseCode: string;
  warehouseName: string;
  warehouseType: WarehouseType;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  capacity?: number | null;
  isActive?: boolean;
  isVirtual?: boolean;
  createdById: string;
  supplierId?: string | null;
}

export interface UpdateWarehouseDTO {
  warehouseName?: string;
  warehouseType?: WarehouseType;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  capacity?: number | null;
  isActive?: boolean;
  isVirtual?: boolean;
  supplierId?: string | null;
}

export interface WarehouseFilters {
  warehouseType?: WarehouseType;
  isActive?: boolean;
  search?: string;
}

class WarehouseService {
  /**
   * Create a new warehouse
   */
  async createWarehouse(data: CreateWarehouseDTO) {
    // Check for duplicate warehouse code
    const existing = await prisma.warehouses.findFirst({
      where: { warehouseCode: data.warehouseCode, isActive: true },
    });

    if (existing) {
      throw new Error(`Warehouse code "${data.warehouseCode}" already exists`);
    }

    const warehouse = await prisma.warehouses.create({
      data: {
        warehouseCode: data.warehouseCode,
        warehouseName: data.warehouseName,
        warehouseType: data.warehouseType,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        pincode: data.pincode,
        contactPerson: data.contactPerson,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
        capacity: data.capacity,
        isActive: data.isActive ?? true,
        isVirtual: data.isVirtual ?? false,
        createdById: data.createdById,
        supplierId: data.supplierId || null,
      },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        supplier: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return warehouse;
  }

  /**
   * Get all warehouses with optional filters
   */
  async getAllWarehouses(filters?: WarehouseFilters) {
    const where: Prisma.warehousesWhereInput = {};

    if (filters?.warehouseType) {
      where.warehouseType = filters.warehouseType;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.search) {
      where.OR = [
        { warehouseCode: { contains: filters.search, mode: 'insensitive' } },
        { warehouseName: { contains: filters.search, mode: 'insensitive' } },
        { city: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const warehouses = await prisma.warehouses.findMany({
      where,
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        supplier: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        _count: {
          select: {
            stock_counts: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return warehouses;
  }

  /**
   * Get warehouse by ID
   */
  async getWarehouseById(id: string) {
    const warehouse = await prisma.warehouses.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        supplier: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        _count: {
          select: {
            stock_movements: true,
            stock_reservations: true,
            stock_counts: true,
          },
        },
      },
    });

    if (!warehouse) {
      throw new Error(`Warehouse not found with ID: ${id}`);
    }

    return warehouse;
  }

  /**
   * Get warehouse by code
   */
  async getWarehouseByCode(warehouseCode: string) {
    const warehouse = await prisma.warehouses.findFirst({
      where: { warehouseCode, isActive: true },
      include: {
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

    if (!warehouse) {
      throw new Error(`Warehouse not found with code: ${warehouseCode}`);
    }

    return warehouse;
  }

  /**
   * Update warehouse
   */
  async updateWarehouse(id: string, data: UpdateWarehouseDTO) {
    const existing = await prisma.warehouses.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Warehouse not found with ID: ${id}`);
    }

    const warehouse = await prisma.warehouses.update({
      where: { id },
      data: {
        warehouseName: data.warehouseName,
        warehouseType: data.warehouseType,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        pincode: data.pincode,
        contactPerson: data.contactPerson,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
        capacity: data.capacity,
        isActive: data.isActive,
        isVirtual: data.isVirtual,
        ...(data.supplierId !== undefined && { supplierId: data.supplierId }),
      },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        supplier: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return warehouse;
  }

  /**
   * Delete warehouse (soft delete by setting isActive = false)
   */
  async deleteWarehouse(id: string) {
    const existing = await prisma.warehouses.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Warehouse not found with ID: ${id}`);
    }

    // Block on derived (per-lot) truth, not the stock_levels shim, which can drift
    const derivedRows = await getDerivedStock({ warehouseId: id });
    if (derivedRows.some((row) => Number(row.quantity) > 0)) {
      throw new Error('Cannot delete warehouse with stock on hand');
    }

    // Soft delete + shim maintenance: derived on-hand is zero, so any remaining
    // stock_levels/stock_settings rows for this warehouse are leftovers — clear them
    const [, , warehouse] = await prisma.$transaction([
      prisma.stock_levels.deleteMany({ where: { warehouseId: id } }),
      prisma.stock_settings.deleteMany({ where: { warehouseId: id } }),
      prisma.warehouses.update({
        where: { id },
        data: { isActive: false },
      }),
    ]);

    return warehouse;
  }

  /**
   * Get warehouse stock summary
   */
  async getWarehouseStockSummary(id: string) {
    const warehouse = await prisma.warehouses.findUnique({ where: { id } });

    if (!warehouse) {
      throw new Error(`Warehouse not found with ID: ${id}`);
    }

    // T2-1 Stage C: derived on-hand + valuation for this warehouse instead of hand-maintained stock_levels.stockValue.
    // BUG-WH10 FIX: Proper error handling to surface issues instead of silent failures
    let rows: Awaited<ReturnType<typeof getDerivedValuation>>['rows'] = [];
    let totalValue = 0;

    try {
      const valuation = await getDerivedValuation({ warehouseId: id });
      rows = valuation.rows;
      totalValue = valuation.totalValue;
    } catch (error) {
      // Log the error for debugging but return empty stock data rather than failing silently
      console.error(`[WarehouseService] Error fetching stock summary for warehouse ${id}:`, error);
      // Re-throw with context so the controller can handle it properly
      throw new Error(
        `Failed to retrieve stock summary for warehouse ${warehouse.warehouseCode}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    const summary = {
      warehouseId: warehouse.id,
      warehouseCode: warehouse.warehouseCode,
      warehouseName: warehouse.warehouseName,
      warehouseType: warehouse.warehouseType,
      totalMaterials: rows.length,
      totalValue,
      stockLevels: rows,
    };

    return summary;
  }

  /**
   * Get active warehouses by type
   */
  async getWarehousesByType(warehouseType: WarehouseType) {
    const warehouses = await prisma.warehouses.findMany({
      where: {
        warehouseType,
        isActive: true,
      },
      select: {
        id: true,
        warehouseCode: true,
        warehouseName: true,
        warehouseType: true,
        city: true,
      },
      orderBy: { warehouseName: 'asc' },
    });

    return warehouses;
  }

  /**
   * Generate next warehouse code
   */
  async generateWarehouseCode(warehouseType: WarehouseType): Promise<string> {
    const prefix = this.getWarehouseTypePrefix(warehouseType);
    // Atomic sequence; the helper appends "-NNNN" so codes stay e.g. WH-RM-0001
    return generateAtomicMasterCode(prefix, 4);
  }

  /**
   * Get warehouse type prefix for code generation (helper appends the trailing dash)
   */
  private getWarehouseTypePrefix(type: WarehouseType): string {
    switch (type) {
      case 'RAW_MATERIAL':
        return 'WH-RM';
      case 'FINISHED_GOODS':
        return 'WH-FG';
      case 'WORK_IN_PROGRESS':
        return 'WH-WIP';
      case 'GENERAL':
        return 'WH-GEN';
      case 'TRANSIT':
        return 'WH-TRN';
      case 'JOB_WORK':
        return 'WH-JW';
      default:
        return 'WH';
    }
  }
}

export default new WarehouseService();
