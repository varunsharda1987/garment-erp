import prisma from '../config/database';
import {
  CreateComponentGroupInput,
  UpdateComponentGroupInput,
  ReorderComponentGroupsInput,
  ComponentGroupResponse,
  ComponentGroupListResponse,
} from '../types/componentGroup.types';

export class ComponentGroupService {
  /**
   * Create a new component group
   */
  async createComponentGroup(data: CreateComponentGroupInput): Promise<ComponentGroupResponse> {
    // Check if code already exists
    const existing = await prisma.component_group_master.findFirst({
      where: { code: data.code, isActive: true },
    });

    if (existing) {
      throw new Error(`Component group with code "${data.code}" already exists`);
    }

    const componentGroup = await prisma.component_group_master.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description || null,
        sortOrder: data.sortOrder || 0,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
      include: {
        _count: {
          select: { components: true },
        },
      },
    });

    return componentGroup;
  }

  /**
   * Get all component groups with pagination and filtering
   */
  async getComponentGroups(
    page: number = 1,
    limit: number = 50,
    search?: string,
    isActive?: boolean
  ): Promise<ComponentGroupListResponse> {
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
      prisma.component_group_master.findMany({
        where,
        include: {
          _count: {
            select: { components: true },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.component_group_master.count({ where }),
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
   * Get component group by ID
   */
  async getComponentGroupById(id: string): Promise<ComponentGroupResponse | null> {
    const componentGroup = await prisma.component_group_master.findUnique({
      where: { id },
      include: {
        _count: {
          select: { components: true },
        },
      },
    });

    return componentGroup;
  }

  /**
   * Get component group by code
   */
  async getComponentGroupByCode(code: string): Promise<ComponentGroupResponse | null> {
    const componentGroup = await prisma.component_group_master.findFirst({
      where: { code, isActive: true },
      include: {
        _count: {
          select: { components: true },
        },
      },
    });

    return componentGroup;
  }

  /**
   * Update component group
   */
  async updateComponentGroup(
    id: string,
    data: UpdateComponentGroupInput
  ): Promise<ComponentGroupResponse> {
    // Check if component group exists
    const existing = await prisma.component_group_master.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error('Component group not found');
    }

    // If updating code, check if new code already exists
    if (data.code && data.code !== existing.code) {
      const codeExists = await prisma.component_group_master.findFirst({
        where: { code: data.code, isActive: true },
      });

      if (codeExists) {
        throw new Error(`Component group with code "${data.code}" already exists`);
      }
    }

    const updated = await prisma.component_group_master.update({
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
          select: { components: true },
        },
      },
    });

    return updated;
  }

  /**
   * Soft delete component group (set isActive = false)
   */
  async deleteComponentGroup(id: string): Promise<ComponentGroupResponse> {
    const existing = await prisma.component_group_master.findUnique({
      where: { id },
      include: {
        _count: {
          select: { components: true },
        },
      },
    });

    if (!existing) {
      throw new Error('Component group not found');
    }

    // Check if any components are using this group
    if (existing._count.components > 0) {
      throw new Error(
        `Cannot delete component group. ${existing._count.components} component(s) are using this group.`
      );
    }

    const deleted = await prisma.component_group_master.update({
      where: { id },
      data: { isActive: false },
      include: {
        _count: {
          select: { components: true },
        },
      },
    });

    return deleted;
  }

  /**
   * Reorder component groups
   */
  async reorderComponentGroups(data: ReorderComponentGroupsInput): Promise<void> {
    // Update all component groups in a transaction
    await prisma.$transaction(
      data.orders.map((order) =>
        prisma.component_group_master.update({
          where: { id: order.id },
          data: { sortOrder: order.sortOrder },
        })
      )
    );
  }

  /**
   * Get components in a specific group
   */
  async getComponentsByGroup(groupId: string, isActive?: boolean) {
    const where: any = { componentGroupId: groupId };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    return prisma.component_masters.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }
}

export const componentGroupService = new ComponentGroupService();
