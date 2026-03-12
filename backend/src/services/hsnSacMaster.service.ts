import prisma from '../config/database';
import { HSNSACType, Prisma } from '@prisma/client';

interface HSNSACCreateInput {
  code: string;
  type: HSNSACType;
  description: string;
  chapter?: string;
  section?: string;
  defaultGstRate: number;
  unit?: string;
  isActive?: boolean;
}

interface HSNSACUpdateInput {
  code?: string;
  type?: HSNSACType;
  description?: string;
  chapter?: string;
  section?: string;
  defaultGstRate?: number;
  unit?: string;
  isActive?: boolean;
}

interface HSNSACQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: HSNSACType;
  chapter?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class HSNSACMasterService {
  /**
   * Create a new HSN/SAC code
   */
  async create(data: HSNSACCreateInput) {
    // Auto-extract chapter from code (first 2 digits)
    const chapter = data.chapter || data.code.substring(0, 2);

    return prisma.hsn_sac_masters.create({
      data: {
        code: data.code.trim(),
        type: data.type,
        description: data.description,
        chapter,
        section: data.section || null,
        defaultGstRate: data.defaultGstRate,
        unit: data.unit || null,
        isActive: data.isActive ?? true,
      },
    });
  }

  /**
   * Get all HSN/SAC codes with pagination, search, and filters
   */
  async getAll(params: HSNSACQueryParams) {
    const {
      page = 1,
      limit = 20,
      search,
      type,
      chapter,
      isActive,
      sortBy = 'code',
      sortOrder = 'asc',
    } = params;

    const skip = (page - 1) * limit;

    const where: Prisma.hsn_sac_mastersWhereInput = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (type) {
      where.type = type;
    }

    if (chapter) {
      where.chapter = chapter;
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { chapter: { contains: search, mode: 'insensitive' } },
        { section: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.hsn_sac_masters.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.hsn_sac_masters.count({ where }),
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
   * Get HSN/SAC code by ID
   */
  async getById(id: string) {
    return prisma.hsn_sac_masters.findUnique({
      where: { id },
    });
  }

  /**
   * Get HSN/SAC code by code string
   */
  async getByCode(code: string) {
    return prisma.hsn_sac_masters.findUnique({
      where: { code },
    });
  }

  /**
   * Update HSN/SAC code
   */
  async update(id: string, data: HSNSACUpdateInput) {
    const updateData: any = { ...data };

    // Re-extract chapter if code changed
    if (data.code) {
      updateData.chapter = data.chapter || data.code.substring(0, 2);
    }

    return prisma.hsn_sac_masters.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete HSN/SAC code (soft delete)
   */
  async delete(id: string) {
    return prisma.hsn_sac_masters.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Search HSN/SAC codes for autocomplete/dropdown
   */
  async search(params: { search?: string; type?: HSNSACType; limit?: number }) {
    const { search, type, limit = 50 } = params;

    const where: Prisma.hsn_sac_mastersWhereInput = {
      isActive: true,
    };

    if (type) {
      where.type = type;
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    return prisma.hsn_sac_masters.findMany({
      where,
      take: limit,
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        type: true,
        description: true,
        defaultGstRate: true,
        unit: true,
      },
    });
  }

  /**
   * Get default GST rate for a given HSN/SAC code
   * Falls back to chapter-level match if exact code not found
   */
  async getDefaultRate(code: string): Promise<number | null> {
    // Try exact match first
    const exact = await prisma.hsn_sac_masters.findUnique({
      where: { code },
      select: { defaultGstRate: true },
    });

    if (exact) {
      return Number(exact.defaultGstRate);
    }

    // Try chapter-level match (first 4 digits, then first 2 digits)
    for (const len of [4, 2]) {
      if (code.length >= len) {
        const prefix = code.substring(0, len);
        const chapterMatch = await prisma.hsn_sac_masters.findFirst({
          where: { chapter: prefix, isActive: true },
          select: { defaultGstRate: true },
        });
        if (chapterMatch) {
          return Number(chapterMatch.defaultGstRate);
        }
      }
    }

    return null;
  }

  /**
   * Bulk create HSN/SAC codes (for seeding)
   */
  async bulkCreate(data: HSNSACCreateInput[]) {
    const records = data.map(item => ({
      code: item.code.trim(),
      type: item.type,
      description: item.description,
      chapter: item.chapter || item.code.substring(0, 2),
      section: item.section || null,
      defaultGstRate: item.defaultGstRate,
      unit: item.unit || null,
      isActive: item.isActive ?? true,
    }));

    return prisma.hsn_sac_masters.createMany({
      data: records,
      skipDuplicates: true,
    });
  }
}

export const hsnSacMasterService = new HSNSACMasterService();
