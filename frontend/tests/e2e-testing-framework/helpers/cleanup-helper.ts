import { APIRequestContext } from '@playwright/test';
import { APIHelper } from './api-helper';

/**
 * Cleanup Helper
 * Provides utilities for cleaning up test data after tests
 */

export interface CleanupItem {
  type: string;
  id: string;
  createdAt: Date;
}

export class CleanupHelper {
  private cleanupQueue: CleanupItem[] = [];
  private apiHelper: APIHelper;

  constructor(request: APIRequestContext) {
    this.apiHelper = new APIHelper(request);
  }

  /**
   * Set authentication token
   */
  setToken(token: string): void {
    this.apiHelper.setToken(token);
  }

  /**
   * Register an entity for cleanup
   */
  register(type: string, id: string): void {
    this.cleanupQueue.push({
      type,
      id,
      createdAt: new Date(),
    });
  }

  /**
   * Get cleanup order based on dependencies
   * Items with dependencies on others should be deleted first
   */
  private getCleanupOrder(): CleanupItem[] {
    const priorityOrder: Record<string, number> = {
      // Level 4 - Delete first
      workOrder: 1,
      invoice: 1,
      stockMovement: 1,
      // Level 3
      grn: 2,
      costSheet: 2,
      order: 2,
      bom: 2,
      // Level 2
      purchaseOrder: 3,
      style: 3,
      fabric: 3,
      greige: 3,
      // Level 1
      material: 4,
      supplier: 4,
      customer: 4,
      // Level 0
      warehouse: 5,
      componentMaster: 5,
      user: 6, // Delete last
    };

    return [...this.cleanupQueue].sort((a, b) => {
      const priorityA = priorityOrder[a.type] || 10;
      const priorityB = priorityOrder[b.type] || 10;
      return priorityA - priorityB;
    });
  }

  /**
   * Delete a single entity
   */
  private async deleteEntity(item: CleanupItem): Promise<void> {
    const deleteMethod: Record<string, (id: string) => Promise<void>> = {
      customer: (id) => this.apiHelper.deleteCustomer(id),
      supplier: (id) => this.apiHelper.deleteSupplier(id),
      material: (id) => this.apiHelper.deleteMaterial(id),
      style: (id) => this.apiHelper.deleteStyle(id),
      order: (id) => this.apiHelper.deleteOrder(id),
      warehouse: (id) => this.apiHelper.deleteWarehouse(id),
      purchaseOrder: (id) => this.apiHelper.deletePurchaseOrder(id),
      bom: (id) => this.apiHelper.deleteBOM(id),
      workOrder: (id) => this.apiHelper.deleteWorkOrder(id),
    };

    const deleteFn = deleteMethod[item.type];
    if (deleteFn) {
      try {
        await deleteFn(item.id);
      } catch (error) {
        console.warn(`Failed to cleanup ${item.type} ${item.id}:`, error);
      }
    }
  }

  /**
   * Execute cleanup for all registered entities
   */
  async cleanup(): Promise<void> {
    const orderedItems = this.getCleanupOrder();

    for (const item of orderedItems) {
      await this.deleteEntity(item);
    }

    // Clear the queue
    this.cleanupQueue = [];
  }

  /**
   * Clear cleanup queue without executing
   */
  clear(): void {
    this.cleanupQueue = [];
  }

  /**
   * Get number of items in cleanup queue
   */
  get queueLength(): number {
    return this.cleanupQueue.length;
  }

  /**
   * Get all registered items
   */
  getRegisteredItems(): CleanupItem[] {
    return [...this.cleanupQueue];
  }
}

/**
 * Factory function to create a cleanup helper
 */
export function createCleanupHelper(request: APIRequestContext): CleanupHelper {
  return new CleanupHelper(request);
}

/**
 * Global cleanup function for test teardown
 */
export async function cleanupTestData(
  request: APIRequestContext,
  token: string,
  items: CleanupItem[]
): Promise<void> {
  const helper = createCleanupHelper(request);
  helper.setToken(token);

  for (const item of items) {
    helper.register(item.type, item.id);
  }

  await helper.cleanup();
}

export default CleanupHelper;
