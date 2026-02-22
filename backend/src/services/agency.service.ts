import { BaseService } from './base.service';
import prisma from '../config/database';
import { Prisma } from '@prisma/client';

interface AgencyCreateInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive?: boolean;
}

interface AgencyUpdateInput {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive?: boolean;
}

interface AgencyQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class AgencyService extends BaseService<'agencies'> {
  constructor() {
    super('agencies');
  }

  /**
   * Generate next agency code (AGY-001, AGY-002, etc.)
   */
  private async generateCode(): Promise<string> {
    const lastAgency = await prisma.agencies.findFirst({
      where: {
        code: {
          startsWith: 'AGY-',
        },
      },
      orderBy: {
        code: 'desc',
      },
      select: {
        code: true,
      },
    });

    if (!lastAgency) {
      return 'AGY-001';
    }

    const lastNumber = parseInt(lastAgency.code.replace('AGY-', ''), 10);
    const nextNumber = lastNumber + 1;
    return `AGY-${nextNumber.toString().padStart(3, '0')}`;
  }

  /**
   * Create a new agency
   */
  async create(data: AgencyCreateInput) {
    const code = await this.generateCode();

    return prisma.agencies.create({
      data: {
        code,
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
        isActive: data.isActive ?? true,
      },
      include: {
        _count: {
          select: {
            agents: true,
          },
        },
      },
    });
  }

  /**
   * Get all agencies with pagination and filtering
   */
  async getAll(params: AgencyQueryParams = {}) {
    const {
      page = 1,
      limit = 20,
      search,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const skip = (page - 1) * limit;

    const where: Prisma.agenciesWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await Promise.all([
      prisma.agencies.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          _count: {
            select: {
              agents: true,
            },
          },
        },
      }),
      prisma.agencies.count({ where }),
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
   * Get agency by ID
   */
  async getById(id: string) {
    return prisma.agencies.findUnique({
      where: { id },
      include: {
        agents: {
          where: { isActive: true },
          select: {
            id: true,
            code: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        _count: {
          select: {
            agents: true,
          },
        },
      },
    });
  }

  /**
   * Update agency
   */
  async update(id: string, data: AgencyUpdateInput) {
    return prisma.agencies.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        isActive: data.isActive,
      },
      include: {
        _count: {
          select: {
            agents: true,
          },
        },
      },
    });
  }

  /**
   * Delete agency
   */
  async delete(id: string) {
    // Check if agency has agents
    const agency = await prisma.agencies.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            agents: true,
          },
        },
      },
    });

    if (agency && agency._count.agents > 0) {
      throw new Error(
        `Cannot delete agency with ${agency._count.agents} linked agent(s). Please reassign or delete the agents first.`
      );
    }

    return prisma.agencies.delete({
      where: { id },
    });
  }

  /**
   * Search agencies for dropdown
   */
  async search(params: { search?: string; limit?: number; isActive?: boolean }) {
    const { search, limit = 50, isActive = true } = params;

    const where: Prisma.agenciesWhereInput = {
      isActive,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    return prisma.agencies.findMany({
      where,
      take: limit,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        phone: true,
      },
    });
  }
}

export const agencyService = new AgencyService();
