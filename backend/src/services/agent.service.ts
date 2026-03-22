/**
 * Agent Master Service
 * Business logic for agent master operations
 */

import prisma from '../config/database';
import { BaseService, PaginationOptions, PaginatedResult, IncludeConfig } from './base.service';
import { NotFoundError, ConflictError } from '../errors';
import { logError, logInfo, logDebug } from '../utils/logger';
import { SearchFilter, OrderByClause } from '../types/prisma.types';

/**
 * Agent type definition
 */
export interface Agent {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  agencyId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  agency?: {
    id: string;
    code: string;
    name: string;
  } | null;
  _count?: {
    customers: number;
  };
}

export interface AgentSearchResult {
  id: string;
  code: string;
  name: string;
  phone: string | null;
}

/**
 * Input types for agent operations
 */
interface CreateAgentInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  agencyId?: string;
  isActive?: boolean;
}

interface UpdateAgentInput {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  agencyId?: string | null;
  isActive?: boolean;
}

/**
 * Agent Service Class
 */
class AgentServiceClass extends BaseService<Agent, CreateAgentInput, UpdateAgentInput> {
  protected readonly modelName = 'agents';
  protected readonly entityName = 'Agent';

  protected get model() {
    return prisma.agents as unknown as {
      create: (args: { data: unknown; include?: IncludeConfig }) => Promise<Agent>;
      findUnique: (args: { where: { id: string }; include?: IncludeConfig }) => Promise<Agent | null>;
      findFirst: (args: { where?: Record<string, unknown>; include?: IncludeConfig }) => Promise<Agent | null>;
      findMany: (args: {
        where?: Record<string, unknown>;
        skip?: number;
        take?: number;
        orderBy?: Record<string, 'asc' | 'desc'> | Array<Record<string, 'asc' | 'desc'>>;
        include?: IncludeConfig;
      }) => Promise<Agent[]>;
      update: (args: { where: { id: string }; data: unknown; include?: IncludeConfig }) => Promise<Agent>;
      delete: (args: { where: { id: string } }) => Promise<Agent>;
      count: (args: { where?: Record<string, unknown> }) => Promise<number>;
    };
  }

  protected buildSearchFilter(search: string): SearchFilter {
    return [
      { code: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  protected getDefaultIncludes(): IncludeConfig {
    return {
      agency: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      _count: {
        select: { customers: true },
      },
    };
  }

  /**
   * Generate next agent code (AGT-001, AGT-002, etc.)
   */
  private async generateNextCode(): Promise<string> {
    const lastAgent = await prisma.agents.findFirst({
      where: {
        code: { startsWith: 'AGT-' },
      },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    if (!lastAgent) {
      return 'AGT-001';
    }

    const lastNumber = parseInt(lastAgent.code.replace('AGT-', ''), 10);
    const nextNumber = lastNumber + 1;
    return `AGT-${nextNumber.toString().padStart(3, '0')}`;
  }

  /**
   * Create a new agent
   */
  async createAgent(data: CreateAgentInput): Promise<Agent> {
    try {
      logDebug('Creating agent', { data });

      // Generate code
      const code = await this.generateNextCode();

      const agent = await prisma.agents.create({
        data: {
          code,
          name: data.name,
          phone: data.phone || null,
          email: data.email || null,
          address: data.address || null,
          agencyId: data.agencyId || null,
          isActive: data.isActive ?? true,
        },
        include: this.getDefaultIncludes(),
      });

      logInfo('Agent created successfully', { id: agent.id, code: agent.code });
      return agent as Agent;
    } catch (error) {
      logError('Failed to create agent', error instanceof Error ? error : new Error(String(error)));
      this.handlePrismaError(error);
      throw error;
    }
  }

  /**
   * Update an agent
   */
  async updateAgent(id: string, data: UpdateAgentInput): Promise<Agent> {
    try {
      logDebug('Updating agent', { id, data });

      // Verify agent exists
      await this.findByIdOrThrow(id);

      const agent = await prisma.agents.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.phone !== undefined && { phone: data.phone || null }),
          ...(data.email !== undefined && { email: data.email || null }),
          ...(data.address !== undefined && { address: data.address || null }),
          ...(data.agencyId !== undefined && { agencyId: data.agencyId || null }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
        include: this.getDefaultIncludes(),
      });

      logInfo('Agent updated successfully', { id });
      return agent as Agent;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logError('Failed to update agent', error instanceof Error ? error : new Error(String(error)));
      this.handlePrismaError(error);
      throw error;
    }
  }

  /**
   * Get all agents with pagination
   */
  async getAllAgents(
    options: PaginationOptions & { isActive?: boolean; agencyId?: string }
  ): Promise<PaginatedResult<Agent>> {
    try {
      const { page, limit, search, sortBy, sortOrder, isActive, agencyId } = options;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: Record<string, unknown> = {};

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      if (agencyId) {
        where.agencyId = agencyId;
      }

      if (search) {
        where.OR = this.buildSearchFilter(search);
      }

      // Count total
      const total = await prisma.agents.count({ where });

      // Build orderBy
      const orderBy: OrderByClause = sortBy ? { [sortBy]: sortOrder || 'asc' } : { createdAt: 'desc' };

      // Fetch agents
      const agents = await prisma.agents.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: this.getDefaultIncludes(),
      });

      return {
        data: agents as Agent[],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logError('Failed to get all agents', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Search agents (for dropdowns - minimal data)
   * Supports filtering by agencyId for cascading dropdown
   */
  async searchAgents(params: { search?: string; limit?: number; agencyId?: string }): Promise<AgentSearchResult[]> {
    try {
      const { search, limit = 50, agencyId } = params;

      const where: Record<string, unknown> = {
        isActive: true,
      };

      // Filter by agency if provided (for cascading dropdown)
      if (agencyId) {
        where.agencyId = agencyId;
      }

      if (search) {
        where.OR = [
          { code: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ];
      }

      const agents = await prisma.agents.findMany({
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

      return agents as AgentSearchResult[];
    } catch (error) {
      logError('Failed to search agents', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get agent by ID
   */
  async getById(id: string): Promise<Agent> {
    const agent = await prisma.agents.findUnique({
      where: { id },
      include: this.getDefaultIncludes(),
    });

    if (!agent) {
      throw new NotFoundError('Agent', id);
    }

    return agent as Agent;
  }

  /**
   * Delete agent (soft delete)
   */
  async deleteAgent(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.softDelete(id);
  }
}

// Export singleton instance
export const AgentService = new AgentServiceClass();
