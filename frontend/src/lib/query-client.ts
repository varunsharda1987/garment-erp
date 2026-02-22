/**
 * React Query Client Configuration
 *
 * Centralized query client setup with:
 * - Smart caching defaults
 * - Error handling
 * - Stale time configuration
 * - Retry logic
 */

import { QueryClient } from '@tanstack/react-query';
import { notify } from './notify';

/**
 * Create and configure the QueryClient
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 5 minutes
        staleTime: 5 * 60 * 1000,
        // Cache data for 30 minutes
        gcTime: 30 * 60 * 1000,
        // Retry failed queries 2 times
        retry: 2,
        // Don't retry on 4xx errors (client errors)
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        // Refetch on window focus in production
        refetchOnWindowFocus: import.meta.env.PROD,
        // Don't refetch on reconnect by default
        refetchOnReconnect: false,
      },
      mutations: {
        // Handle global mutation errors
        onError: (error: unknown) => {
          const message = error instanceof Error ? error.message : 'An error occurred';
          notify.error(message);
        },
      },
    },
  });
}

// Create singleton instance
export const queryClient = createQueryClient();

/**
 * Query key factory for consistent key generation
 */
export const queryKeys = {
  // Styles
  styles: {
    all: ['styles'] as const,
    lists: () => [...queryKeys.styles.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.styles.lists(), filters] as const,
    details: () => [...queryKeys.styles.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.styles.details(), id] as const,
  },

  // Customers
  customers: {
    all: ['customers'] as const,
    lists: () => [...queryKeys.customers.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.customers.lists(), filters] as const,
    details: () => [...queryKeys.customers.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.customers.details(), id] as const,
  },

  // Suppliers
  suppliers: {
    all: ['suppliers'] as const,
    lists: () => [...queryKeys.suppliers.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.suppliers.lists(), filters] as const,
    details: () => [...queryKeys.suppliers.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.suppliers.details(), id] as const,
  },

  // Materials
  materials: {
    all: ['materials'] as const,
    lists: () => [...queryKeys.materials.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.materials.lists(), filters] as const,
    details: () => [...queryKeys.materials.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.materials.details(), id] as const,
  },

  // Orders
  orders: {
    all: ['orders'] as const,
    lists: () => [...queryKeys.orders.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.orders.lists(), filters] as const,
    details: () => [...queryKeys.orders.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.orders.details(), id] as const,
  },

  // BOMs
  boms: {
    all: ['boms'] as const,
    lists: () => [...queryKeys.boms.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.boms.lists(), filters] as const,
    details: () => [...queryKeys.boms.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.boms.details(), id] as const,
    forStyle: (styleId: string | number) => [...queryKeys.boms.all, 'style', styleId] as const,
  },

  // Warehouses
  warehouses: {
    all: ['warehouses'] as const,
    lists: () => [...queryKeys.warehouses.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.warehouses.lists(), filters] as const,
    details: () => [...queryKeys.warehouses.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.warehouses.details(), id] as const,
  },

  // Stock Levels
  stockLevels: {
    all: ['stock-levels'] as const,
    lists: () => [...queryKeys.stockLevels.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.stockLevels.lists(), filters] as const,
    forWarehouse: (warehouseId: string | number) =>
      [...queryKeys.stockLevels.all, 'warehouse', warehouseId] as const,
  },

  // Dashboard
  dashboard: {
    all: ['dashboard'] as const,
    stats: () => [...queryKeys.dashboard.all, 'stats'] as const,
  },

  // Component Masters
  componentMasters: {
    all: ['component-masters'] as const,
    lists: () => [...queryKeys.componentMasters.all, 'list'] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.componentMasters.lists(), filters] as const,
    byCategory: (category: string) =>
      [...queryKeys.componentMasters.all, 'category', category] as const,
  },

  // Fabrics
  fabrics: {
    all: ['fabrics'] as const,
    lists: () => [...queryKeys.fabrics.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.fabrics.lists(), filters] as const,
    details: () => [...queryKeys.fabrics.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.fabrics.details(), id] as const,
  },

  // Greige
  greige: {
    all: ['greige'] as const,
    lists: () => [...queryKeys.greige.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.greige.lists(), filters] as const,
    details: () => [...queryKeys.greige.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.greige.details(), id] as const,
  },

  // Users
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string | number) => [...queryKeys.users.details(), id] as const,
    current: () => [...queryKeys.users.all, 'current'] as const,
  },

  // CAD Planning
  cadPlanning: {
    all: ['cad-planning'] as const,
    statusCounts: () => [...queryKeys.cadPlanning.all, 'status-counts'] as const,
    lists: () => [...queryKeys.cadPlanning.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.cadPlanning.lists(), filters] as const,
    detail: (styleId: string | number) => [...queryKeys.cadPlanning.all, 'detail', styleId] as const,
  },

  // MRP (Material Requirements Planning)
  mrp: {
    all: ['mrp'] as const,
    dashboard: () => [...queryKeys.mrp.all, 'dashboard'] as const,
    lists: () => [...queryKeys.mrp.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.mrp.lists(), filters] as const,
    detail: (id: string | number) => [...queryKeys.mrp.all, 'detail', id] as const,
  },

  // Service Requirements
  serviceRequirements: {
    all: ['service-requirements'] as const,
    dashboard: () => [...queryKeys.serviceRequirements.all, 'dashboard'] as const,
    lists: () => [...queryKeys.serviceRequirements.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.serviceRequirements.lists(), filters] as const,
    detail: (id: string | number) => [...queryKeys.serviceRequirements.all, 'detail', id] as const,
  },
};

export default queryClient;
