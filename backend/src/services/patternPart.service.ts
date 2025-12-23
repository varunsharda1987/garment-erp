import prisma from '../config/database';
import {
  CreatePatternPartInput,
  UpdatePatternPartInput,
  ReorderPatternPartsInput,
  AddComponentPatternPartInput,
  UpdateComponentPatternPartInput,
  PatternPartResponse,
  PatternPartListResponse,
  ComponentPatternPartResponse,
} from '../types/patternPart.types';

export class PatternPartService {
  /**
   * Create a new pattern part
   */
  async createPatternPart(data: CreatePatternPartInput): Promise<PatternPartResponse> {
    // Check if code already exists
    const existing = await prisma.pattern_part_master.findFirst({
      where: { code: data.code, isActive: true },
    });

    if (existing) {
      throw new Error(`Pattern part with code "${data.code}" already exists`);
    }

    const patternPart = await prisma.pattern_part_master.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description || null,
        sortOrder: data.sortOrder || 0,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
      include: {
        _count: {
          select: { componentPatternParts: true },
        },
      },
    });

    return patternPart;
  }

  /**
   * Get all pattern parts with pagination and filtering
   */
  async getPatternParts(
    page: number = 1,
    limit: number = 50,
    search?: string,
    isActive?: boolean
  ): Promise<PatternPartListResponse> {
    const where: any = {};

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await Promise.all([
      prisma.pattern_part_master.findMany({
        where,
        include: {
          _count: {
            select: { componentPatternParts: true },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.pattern_part_master.count({ where }),
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
   * Get pattern part by ID
   */
  async getPatternPartById(id: string): Promise<PatternPartResponse | null> {
    const patternPart = await prisma.pattern_part_master.findUnique({
      where: { id },
      include: {
        _count: {
          select: { componentPatternParts: true },
        },
      },
    });

    return patternPart;
  }

  /**
   * Get pattern part by code
   */
  async getPatternPartByCode(code: string): Promise<PatternPartResponse | null> {
    const patternPart = await prisma.pattern_part_master.findFirst({
      where: { code, isActive: true },
      include: {
        _count: {
          select: { componentPatternParts: true },
        },
      },
    });

    return patternPart;
  }

  /**
   * Update pattern part
   */
  async updatePatternPart(
    id: string,
    data: UpdatePatternPartInput
  ): Promise<PatternPartResponse> {
    // Check if pattern part exists
    const existing = await prisma.pattern_part_master.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Pattern part not found');
    }

    // If updating code, check if new code already exists
    if (data.code && data.code !== existing.code) {
      const codeExists = await prisma.pattern_part_master.findFirst({
        where: { code: data.code, isActive: true },
      });

      if (codeExists) {
        throw new Error(`Pattern part with code "${data.code}" already exists`);
      }
    }

    const updated = await prisma.pattern_part_master.update({
      where: { id },
      data: {
        ...(data.code && { code: data.code }),
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        _count: {
          select: { componentPatternParts: true },
        },
      },
    });

    return updated;
  }

  /**
   * Soft delete pattern part (set isActive = false)
   */
  async deletePatternPart(id: string): Promise<PatternPartResponse> {
    const existing = await prisma.pattern_part_master.findUnique({
      where: { id },
      include: {
        _count: {
          select: { componentPatternParts: true },
        },
      },
    });

    if (!existing) {
      throw new Error('Pattern part not found');
    }

    // Check if any components are using this pattern part
    if (existing._count.componentPatternParts > 0) {
      throw new Error(
        `Cannot delete pattern part. ${existing._count.componentPatternParts} component(s) are using this pattern part.`
      );
    }

    const deleted = await prisma.pattern_part_master.update({
      where: { id },
      data: { isActive: false },
      include: {
        _count: {
          select: { componentPatternParts: true },
        },
      },
    });

    return deleted;
  }

  /**
   * Reorder pattern parts
   */
  async reorderPatternParts(data: ReorderPatternPartsInput): Promise<void> {
    // Update all pattern parts in a transaction
    await prisma.$transaction(
      data.orders.map((order) =>
        prisma.pattern_part_master.update({
          where: { id: order.id },
          data: { sortOrder: order.sortOrder },
        })
      )
    );
  }

  /**
   * Get pattern parts for a specific component
   */
  async getPatternPartsByComponent(componentId: string): Promise<ComponentPatternPartResponse[]> {
    return prisma.component_pattern_parts.findMany({
      where: { componentId },
      include: {
        patternPart: {
          include: {
            _count: {
              select: { componentPatternParts: true },
            },
          },
        },
      },
      orderBy: {
        patternPart: {
          sortOrder: 'asc',
        },
      },
    });
  }

  /**
   * Add pattern part to component
   */
  async addPatternPartToComponent(
    componentId: string,
    data: AddComponentPatternPartInput
  ): Promise<ComponentPatternPartResponse> {
    // Check if component exists
    const component = await prisma.component_masters.findUnique({
      where: { id: componentId },
    });

    if (!component) {
      throw new Error('Component not found');
    }

    // Check if pattern part exists
    const patternPart = await prisma.pattern_part_master.findUnique({
      where: { id: data.patternPartId },
    });

    if (!patternPart) {
      throw new Error('Pattern part not found');
    }

    // Check if association already exists
    const existing = await prisma.component_pattern_parts.findUnique({
      where: {
        componentId_patternPartId: {
          componentId,
          patternPartId: data.patternPartId,
        },
      },
    });

    if (existing) {
      throw new Error('This pattern part is already associated with the component');
    }

    const association = await prisma.component_pattern_parts.create({
      data: {
        componentId,
        patternPartId: data.patternPartId,
        quantity: data.quantity || 1,
        isRequired: data.isRequired !== undefined ? data.isRequired : true,
        notes: data.notes || null,
      },
      include: {
        patternPart: {
          include: {
            _count: {
              select: { componentPatternParts: true },
            },
          },
        },
      },
    });

    return association;
  }

  /**
   * Update component-pattern part association
   */
  async updateComponentPatternPart(
    componentId: string,
    patternPartId: string,
    data: UpdateComponentPatternPartInput
  ): Promise<ComponentPatternPartResponse> {
    const existing = await prisma.component_pattern_parts.findUnique({
      where: {
        componentId_patternPartId: {
          componentId,
          patternPartId,
        },
      },
    });

    if (!existing) {
      throw new Error('Pattern part association not found');
    }

    const updated = await prisma.component_pattern_parts.update({
      where: {
        componentId_patternPartId: {
          componentId,
          patternPartId,
        },
      },
      data: {
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.isRequired !== undefined && { isRequired: data.isRequired }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      include: {
        patternPart: {
          include: {
            _count: {
              select: { componentPatternParts: true },
            },
          },
        },
      },
    });

    return updated;
  }

  /**
   * Remove pattern part from component
   */
  async removePatternPartFromComponent(
    componentId: string,
    patternPartId: string
  ): Promise<void> {
    const existing = await prisma.component_pattern_parts.findUnique({
      where: {
        componentId_patternPartId: {
          componentId,
          patternPartId,
        },
      },
    });

    if (!existing) {
      throw new Error('Pattern part association not found');
    }

    await prisma.component_pattern_parts.delete({
      where: {
        componentId_patternPartId: {
          componentId,
          patternPartId,
        },
      },
    });
  }
}

export const patternPartService = new PatternPartService();
