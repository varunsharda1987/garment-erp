/**
 * Types Index
 * Export all shared TypeScript types
 */

// Auth types
export * from './auth.types';

// Prisma utility types
export * from './prisma.types';

// Style types
export * from './style.types';

// Re-export commonly used Prisma types
export type {
  customers,
  suppliers,
  styles,
  orders,
  users,
  materials,
  CustomerType,
  CustomerCategory,
  BusinessType,
  MarketType,
  UserRole,
} from '@prisma/client';
