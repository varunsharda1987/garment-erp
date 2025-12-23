// Warehouse Service - Manage warehouse master data
import { PrismaClient, WarehouseType, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateWarehouseDTO {
  warehouseCode: string;
  warehouseName: string;
  warehouseType: WarehouseType;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  contactPerson?: string;
  contactPhone?: string;
  capacity?: number;
  isActive?: boolean;
  createdById: string;
}

export interface UpdateWarehouseDTO {
  warehouseName?: string;
  warehouseType?: WarehouseType;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  contactPerson?: string;
  contactPhone?: string;
  capacity?: number;
  isActive?: boolean;
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
        pincode: data.pincode,
        contactPerson: data.contactPerson,
        contactPhone: data.contactPhone,
        capacity: data.capacity,
        isActive: data.isActive ?? true,
        createdById: data.createdById,
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
        _count: {
          select: {
            stock_levels: true,
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
        _count: {
          select: {
            stock_levels: true,
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
        pincode: data.pincode,
        contactPerson: data.contactPerson,
        contactPhone: data.contactPhone,
        capacity: data.capacity,
        isActive: data.isActive,
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
      include: {
        _count: {
          select: {
            stock_levels: true,
          },
        },
      },
    });

    if (!existing) {
      throw new Error(`Warehouse not found with ID: ${id}`);
    }

    // Check if warehouse has stock
    if (existing._count.stock_levels > 0) {
      throw new Error('Cannot delete warehouse with existing stock levels. Please transfer stock first.');
    }

    // Soft delete
    const warehouse = await prisma.warehouses.update({
      where: { id },
      data: { isActive: false },
    });

    return warehouse;
  }

  /**
   * Get warehouse stock summary
   */
  async getWarehouseStockSummary(id: string) {
    const warehouse = await prisma.warehouses.findUnique({
      where: { id },
      include: {
        stock_levels: {
          where: {
            quantity: { gt: 0 },
          },
          include: {
            materials: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
              },
            },
          },
          orderBy: {
            lastUpdated: 'desc',
          },
        },
      },
    });

    if (!warehouse) {
      throw new Error(`Warehouse not found with ID: ${id}`);
    }

    const summary = {
      warehouseId: warehouse.id,
      warehouseCode: warehouse.warehouseCode,
      warehouseName: warehouse.warehouseName,
      warehouseType: warehouse.warehouseType,
      totalMaterials: warehouse.stock_levels.length,
      totalValue: warehouse.stock_levels.reduce((sum, level) => {
        return sum + (level.stockValue ? parseFloat(level.stockValue.toString()) : 0);
      }, 0),
      stockLevels: warehouse.stock_levels,
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

    const lastWarehouse = await prisma.warehouses.findFirst({
      where: {
        warehouseCode: {
          startsWith: prefix,
        },
      },
      orderBy: {
        warehouseCode: 'desc',
      },
      select: {
        warehouseCode: true,
      },
    });

    let nextNumber = 1;
    if (lastWarehouse) {
      const lastNumber = parseInt(lastWarehouse.warehouseCode.replace(prefix, ''));
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
  }

  /**
   * Get warehouse type prefix for code generation
   */
  private getWarehouseTypePrefix(type: WarehouseType): string {
    switch (type) {
      case 'RAW_MATERIAL':
        return 'WH-RM-';
      case 'FINISHED_GOODS':
        return 'WH-FG-';
      case 'WORK_IN_PROGRESS':
        return 'WH-WIP-';
      case 'GENERAL':
        return 'WH-GEN-';
      case 'TRANSIT':
        return 'WH-TRN-';
      default:
        return 'WH-';
    }
  }
}

export default new WarehouseService();
