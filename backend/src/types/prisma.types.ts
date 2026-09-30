/**
 * Prisma Type Definitions
 * Common types for Prisma operations and model delegates
 */

import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Generic Prisma model delegate type
 * Used for type-safe model operations in BaseService
 */
export type PrismaModelDelegate<T, CreateInput, UpdateInput, WhereUniqueInput, WhereInput, IncludeInput> = {
  create: (args: { data: CreateInput; include?: IncludeInput }) => Promise<T>;
  findUnique: (args: { where: WhereUniqueInput; include?: IncludeInput }) => Promise<T | null>;
  findFirst: (args: { where?: WhereInput; include?: IncludeInput }) => Promise<T | null>;
  findMany: (args: {
    where?: WhereInput;
    skip?: number;
    take?: number;
    orderBy?: Record<string, 'asc' | 'desc'>;
    include?: IncludeInput;
  }) => Promise<T[]>;
  update: (args: { where: WhereUniqueInput; data: UpdateInput; include?: IncludeInput }) => Promise<T>;
  delete: (args: { where: WhereUniqueInput }) => Promise<T>;
  count: (args: { where?: WhereInput }) => Promise<number>;
};

/**
 * Prisma error interface for type-safe error handling
 */
export interface PrismaError extends Error {
  code?: string;
  meta?: {
    target?: string[];
    [key: string]: unknown;
  };
}

/**
 * Check if error is a Prisma error
 */
export function isPrismaError(error: unknown): error is PrismaError {
  return error instanceof Error && 'code' in error && typeof (error as PrismaError).code === 'string';
}

/**
 * Common Prisma error codes
 */
export const PrismaErrorCode = {
  UniqueConstraint: 'P2002',
  RecordNotFound: 'P2025',
  ForeignKeyConstraint: 'P2003',
  InvalidForeignKey: 'P2015',
  RelatedRecordNotFound: 'P2018',
} as const;

export type PrismaErrorCodeType = (typeof PrismaErrorCode)[keyof typeof PrismaErrorCode];

/**
 * Base filter types for search queries
 */
export interface StringFilter {
  contains?: string;
  mode?: 'insensitive' | 'default';
  equals?: string;
  startsWith?: string;
  endsWith?: string;
}

export interface NumberFilter {
  equals?: number;
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
  in?: number[];
}

export interface DateFilter {
  equals?: Date;
  gt?: Date;
  gte?: Date;
  lt?: Date;
  lte?: Date;
}

/**
 * Base where clause for entities with soft delete
 */
export interface SoftDeleteWhereClause {
  isActive?: boolean;
  OR?: Record<string, unknown>[];
}

/**
 * Order by direction type
 */
export type OrderByDirection = 'asc' | 'desc';

/**
 * Generic order by clause
 */
export type OrderByClause = Record<string, OrderByDirection>;

/**
 * User selection for includes (commonly used in relations)
 */
export interface UserSelect {
  id: boolean;
  firstName: boolean;
  lastName: boolean;
  email: boolean;
}

export const DEFAULT_USER_SELECT: UserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
};

/**
 * The safe include for a `users` relation whose row reaches an API response: the name only.
 * `createdBy: true` (or any users relation `: true`) loads the whole row — password hash and
 * tokenVersion included — and a transform that spreads or passes it through sends it to the
 * browser. Stitching and finishing daily outputs did exactly that (2026-09-30). Enforced by the
 * *full user record include* smart-check.
 */
export const USER_NAME_SELECT = { select: { id: true, firstName: true, lastName: true } } as const;

/** `{ id, name }` for a user loaded with USER_NAME_SELECT — the shape the pages read. */
export function userName(
  user: { id: string; firstName: string; lastName: string } | null | undefined
): { id: string; name: string } | null {
  return user ? { id: user.id, name: `${user.firstName} ${user.lastName}` } : null;
}

/**
 * Common include patterns
 */
export interface CreatedByInclude {
  users: {
    select: UserSelect;
  };
}

/**
 * Search filter item for OR queries
 */
export type SearchFilterItem = {
  [key: string]: StringFilter;
};

/**
 * Search filter array type
 */
export type SearchFilter = SearchFilterItem[];

/**
 * Type for additional filters passed to findAll
 */
export type AdditionalFilters = Record<string, unknown>;
