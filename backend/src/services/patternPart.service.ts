import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { assignPartToGroupComponents } from './componentPatternParts.service';
import { logError } from '../utils/logger';
import {
  CreatePatternPartInput,
  UpdatePatternPartInput,
  ReorderPatternPartsInput,
  AddComponentPatternPartInput,
  UpdateComponentPatternPartInput,
  PatternPartResponse,
  PatternPartListResponse,
  ComponentPatternPartResponse,
  PatternPartGroupResponse,
} from '../types/patternPart.types';

/**
 * Prisma type for pattern_part_master with standard includes.
 * Used instead of `any` in transformPatternPartResponse.
 */
type PatternPartWithIncludes = Prisma.pattern_part_masterGetPayload<{
  include: {
    _count: { select: { componentPatternParts: true } };
    patternPartGroups: {
      include: {
        componentGroup: { select: { id: true; code: true; name: true } };
      };
    };
  };
}>;

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

    const { componentGroupIds, ...patternPartData } = data;

    const patternPart = await prisma.pattern_part_master.create({
      data: {
        code: patternPartData.code,
        name: patternPartData.name,
        description: patternPartData.description || null,
        sortOrder: patternPartData.sortOrder || 0,
        isActive: patternPartData.isActive !== undefined ? patternPartData.isActive : true,
        // Create group associations if provided
        ...(componentGroupIds &&
          componentGroupIds.length > 0 && {
            patternPartGroups: {
              create: componentGroupIds.map((groupId) => ({
                componentGroupId: groupId,
              })),
            },
          }),
      },
      include: {
        _count: {
          select: { componentPatternParts: true },
        },
        patternPartGroups: {
          include: {
            componentGroup: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    });

    // Propagate to existing components of the tagged groups (additive; non-fatal —
    // part creation must not fail because a link couldn't be created)
    if (componentGroupIds && componentGroupIds.length > 0) {
      try {
        await assignPartToGroupComponents(patternPart.id, componentGroupIds);
      } catch (error) {
        logError('Failed to propagate new pattern part to group components:', error);
      }
    }

    // Transform response to include componentGroups array
    return this.transformPatternPartResponse(patternPart);
  }

  /**
   * Transform pattern part response to include componentGroups array
   */
  private transformPatternPartResponse(patternPart: PatternPartWithIncludes): PatternPartResponse {
    const { patternPartGroups, ...rest } = patternPart;
    return {
      ...rest,
      componentGroups: patternPartGroups?.map((ppg): PatternPartGroupResponse => ppg.componentGroup) || [],
    };
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
    // BUG-PP9 fix: replaced `any` with proper Prisma type
    const where: Prisma.pattern_part_masterWhereInput = {};

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

    const [rawData, total] = await Promise.all([
      prisma.pattern_part_master.findMany({
        where,
        include: {
          _count: {
            select: { componentPatternParts: true },
          },
          patternPartGroups: {
            include: {
              componentGroup: {
                select: { id: true, code: true, name: true },
              },
            },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.pattern_part_master.count({ where }),
    ]);

    // Transform to include componentGroups array
    const data = rawData.map((item) => this.transformPatternPartResponse(item));

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
        patternPartGroups: {
          include: {
            componentGroup: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    });

    return patternPart ? this.transformPatternPartResponse(patternPart) : null;
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
        patternPartGroups: {
          include: {
            componentGroup: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    });

    return patternPart ? this.transformPatternPartResponse(patternPart) : null;
  }

  /**
   * Update pattern part
   */
  async updatePatternPart(id: string, data: UpdatePatternPartInput): Promise<PatternPartResponse> {
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

    const { componentGroupIds, ...updateData } = data;

    // Use transaction if updating group associations
    if (componentGroupIds !== undefined) {
      const updated = await prisma.$transaction(async (tx) => {
        // Delete existing group associations
        await tx.pattern_part_groups.deleteMany({
          where: { patternPartId: id },
        });

        // Create new associations
        if (componentGroupIds.length > 0) {
          await tx.pattern_part_groups.createMany({
            data: componentGroupIds.map((groupId) => ({
              patternPartId: id,
              componentGroupId: groupId,
            })),
          });
        }

        // Update pattern part
        return tx.pattern_part_master.update({
          where: { id },
          data: {
            ...(updateData.code && { code: updateData.code }),
            ...(updateData.name && { name: updateData.name }),
            ...(updateData.description !== undefined && { description: updateData.description }),
            ...(updateData.sortOrder !== undefined && { sortOrder: updateData.sortOrder }),
            ...(updateData.isActive !== undefined && { isActive: updateData.isActive }),
          },
          include: {
            _count: {
              select: { componentPatternParts: true },
            },
            patternPartGroups: {
              include: {
                componentGroup: {
                  select: { id: true, code: true, name: true },
                },
              },
            },
          },
        });
      });

      // Propagate the (possibly new) group tags to existing components (additive;
      // removed tags never delete links — that stays manual via the Manage Parts UI)
      if (updated.isActive && componentGroupIds.length > 0) {
        try {
          await assignPartToGroupComponents(id, componentGroupIds);
        } catch (error) {
          logError('Failed to propagate updated pattern part to group components:', error);
        }
      }

      return this.transformPatternPartResponse(updated);
    }

    // Simple update without group changes
    const updated = await prisma.pattern_part_master.update({
      where: { id },
      data: {
        ...(updateData.code && { code: updateData.code }),
        ...(updateData.name && { name: updateData.name }),
        ...(updateData.description !== undefined && { description: updateData.description }),
        ...(updateData.sortOrder !== undefined && { sortOrder: updateData.sortOrder }),
        ...(updateData.isActive !== undefined && { isActive: updateData.isActive }),
      },
      include: {
        _count: {
          select: { componentPatternParts: true },
        },
        patternPartGroups: {
          include: {
            componentGroup: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    });

    return this.transformPatternPartResponse(updated);
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
        patternPartGroups: {
          include: {
            componentGroup: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    });

    return this.transformPatternPartResponse(deleted);
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
  async removePatternPartFromComponent(componentId: string, patternPartId: string): Promise<void> {
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
