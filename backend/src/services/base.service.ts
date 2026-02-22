/**
 * Base Service Class
 * Provides common CRUD operations and patterns for all services
 */

import prisma from '../config/database';
import { NotFoundError, ConflictError, ValidationError } from '../errors';
import { logError, logInfo, logDebug } from '../utils/logger';
import {
  SearchFilter,
  AdditionalFilters,
  SoftDeleteWhereClause,
  OrderByClause,
  isPrismaError,
  PrismaErrorCode,
} from '../types/prisma.types';

/**
 * Maximum allowed limit for pagination to prevent performance issues
 */
export const MAX_PAGINATION_LIMIT = 200;

/**
 * Pagination options for list queries
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result structure
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Generic include configuration type
 * Supports nested includes, selects, and orderBy clauses as used by Prisma
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IncludeConfig = Record<string, boolean | Record<string, any>> | undefined;

/**
 * Base service class providing common CRUD operations
 * Extend this class for entity-specific services
 *
 * @template T - The entity type (Prisma model)
 * @template CreateDTO - DTO for creating entities
 * @template UpdateDTO - DTO for updating entities
 */
export abstract class BaseService<T, CreateDTO, UpdateDTO> {
  protected readonly prisma = prisma;
  protected abstract readonly modelName: string;
  protected abstract readonly entityName: string;

  /**
   * Get the Prisma model delegate
   * Must be implemented by subclasses
   * Note: Returns the Prisma delegate which has dynamic typing
   */
  protected abstract get model(): {
    create: (args: { data: unknown; include?: IncludeConfig }) => Promise<T>;
    findUnique: (args: { where: { id: string }; include?: IncludeConfig }) => Promise<T | null>;
    findFirst: (args: { where?: Record<string, unknown>; include?: IncludeConfig }) => Promise<T | null>;
    findMany: (args: {
      where?: Record<string, unknown>;
      skip?: number;
      take?: number;
      orderBy?: OrderByClause;
      include?: IncludeConfig;
    }) => Promise<T[]>;
    update: (args: { where: { id: string }; data: unknown; include?: IncludeConfig }) => Promise<T>;
    delete: (args: { where: { id: string } }) => Promise<T>;
    count: (args: { where?: Record<string, unknown> }) => Promise<number>;
  };

  /**
   * Build search filter for the entity
   * Must be implemented by subclasses
   */
  protected abstract buildSearchFilter(search: string): SearchFilter;

  /**
   * Get default include relations for queries
   * Override in subclasses to include related entities
   */
  protected getDefaultIncludes(): IncludeConfig {
    return undefined;
  }

  /**
   * Get include relations for list queries (may differ from single entity queries)
   */
  protected getListIncludes(): IncludeConfig {
    return this.getDefaultIncludes();
  }

  /**
   * Create a new entity
   */
  async create(data: CreateDTO, userId?: string): Promise<T> {
    try {
      logDebug(`Creating ${this.entityName}`, { data });

      const entity = await this.model.create({
        data: {
          ...(data as Record<string, unknown>),
          ...(userId && { createdById: userId }),
        },
        include: this.getDefaultIncludes(),
      });

      logInfo(`${this.entityName} created successfully`, { id: (entity as { id: string }).id });
      return entity;
    } catch (error: unknown) {
      logError(`Failed to create ${this.entityName}`, error instanceof Error ? error : new Error(String(error)));
      this.handlePrismaError(error);
      throw error;
    }
  }

  /**
   * Find entity by ID
   */
  async findById(id: string): Promise<T | null> {
    try {
      const entity = await this.model.findUnique({
        where: { id },
        include: this.getDefaultIncludes(),
      });

      return entity;
    } catch (error: unknown) {
      logError(`Failed to find ${this.entityName} by ID`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Find entity by ID or throw NotFoundError
   */
  async findByIdOrThrow(id: string): Promise<T> {
    const entity = await this.findById(id);
    if (!entity) {
      throw new NotFoundError(this.entityName, id);
    }
    return entity;
  }

  /**
   * Find all entities with pagination
   */
  async findAll(
    options: PaginationOptions,
    additionalFilters?: AdditionalFilters
  ): Promise<PaginatedResult<T>> {
    try {
      const { page, search, sortBy, sortOrder } = options;
      // Enforce maximum limit for performance
      const limit = Math.min(options.limit, MAX_PAGINATION_LIMIT);
      const skip = (page - 1) * limit;

      // Build where clause
      const where: SoftDeleteWhereClause & AdditionalFilters = {
        isActive: true,
        ...additionalFilters,
      };

      // Add search filter if provided
      if (search) {
        where.OR = this.buildSearchFilter(search);
      }

      // Count total
      const total = await this.model.count({ where });

      // Build orderBy
      const orderBy: OrderByClause = sortBy
        ? { [sortBy]: sortOrder || 'asc' }
        : { createdAt: 'desc' };

      // Fetch entities
      const entities = await this.model.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: this.getListIncludes(),
      });

      return {
        data: entities,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error: unknown) {
      logError(`Failed to find all ${this.entityName}`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Update entity by ID
   */
  async update(id: string, data: UpdateDTO): Promise<T> {
    try {
      logDebug(`Updating ${this.entityName}`, { id, data });

      // Verify entity exists
      await this.findByIdOrThrow(id);

      const entity = await this.model.update({
        where: { id },
        data: data as Record<string, unknown>,
        include: this.getDefaultIncludes(),
      });

      logInfo(`${this.entityName} updated successfully`, { id });
      return entity;
    } catch (error: unknown) {
      if (error instanceof NotFoundError) throw error;
      logError(`Failed to update ${this.entityName}`, error instanceof Error ? error : new Error(String(error)));
      this.handlePrismaError(error);
      throw error;
    }
  }

  /**
   * Soft delete entity by ID
   */
  async softDelete(id: string): Promise<void> {
    try {
      logDebug(`Soft deleting ${this.entityName}`, { id });

      // Verify entity exists
      await this.findByIdOrThrow(id);

      await this.model.update({
        where: { id },
        data: { isActive: false },
      });

      logInfo(`${this.entityName} soft deleted successfully`, { id });
    } catch (error: unknown) {
      if (error instanceof NotFoundError) throw error;
      logError(`Failed to soft delete ${this.entityName}`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Hard delete entity by ID (use with caution)
   */
  async hardDelete(id: string): Promise<void> {
    try {
      logDebug(`Hard deleting ${this.entityName}`, { id });

      // Verify entity exists
      await this.findByIdOrThrow(id);

      await this.model.delete({
        where: { id },
      });

      logInfo(`${this.entityName} hard deleted successfully`, { id });
    } catch (error: unknown) {
      if (error instanceof NotFoundError) throw error;
      logError(`Failed to hard delete ${this.entityName}`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Restore soft-deleted entity by ID
   */
  async restore(id: string): Promise<T> {
    try {
      logDebug(`Restoring ${this.entityName}`, { id });

      // Find including inactive
      const entity = await this.model.findUnique({
        where: { id },
      });

      if (!entity) {
        throw new NotFoundError(this.entityName, id);
      }

      // Cast to access isActive property (assumes all entities with soft delete have isActive)
      const entityWithStatus = entity as unknown as { isActive: boolean };
      if (entityWithStatus.isActive) {
        throw new ValidationError(`${this.entityName} is already active`);
      }

      const restored = await this.model.update({
        where: { id },
        data: { isActive: true },
      });

      logInfo(`${this.entityName} restored successfully`, { id });
      return restored;
    } catch (error: unknown) {
      if (error instanceof NotFoundError || error instanceof ValidationError) throw error;
      logError(`Failed to restore ${this.entityName}`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Check if entity exists by ID
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.model.count({
      where: { id },
    });
    return count > 0;
  }

  /**
   * Handle common Prisma errors and throw appropriate custom errors
   */
  protected handlePrismaError(error: unknown): void {
    if (!isPrismaError(error)) {
      return;
    }

    if (error.code === PrismaErrorCode.UniqueConstraint) {
      // Unique constraint violation
      const field = error.meta?.target?.[0] || 'field';
      throw new ConflictError(`A record with this ${field} already exists`);
    }
    if (error.code === PrismaErrorCode.RecordNotFound) {
      // Record not found
      throw new NotFoundError(this.entityName);
    }
    if (error.code === PrismaErrorCode.ForeignKeyConstraint) {
      // Foreign key constraint violation
      throw new ValidationError('Referenced record does not exist');
    }
  }
}
