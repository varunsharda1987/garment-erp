import { Page, APIRequestContext, expect } from '@playwright/test';
import { TestConfig, EntityDependencies } from '../config/test-config';

/**
 * Dependency Manager
 * Manages creation and tracking of test data dependencies
 */

export interface CreatedEntity {
  type: string;
  id: string;
  data: Record<string, any>;
  createdAt: Date;
}

export class DependencyManager {
  private createdEntities: Map<string, CreatedEntity[]> = new Map();
  private apiContext: APIRequestContext | null = null;
  private authToken: string | null = null;

  constructor(private page: Page) {}

  /**
   * Initialize API context with authentication
   */
  async initialize(apiContext: APIRequestContext, token: string): Promise<void> {
    this.apiContext = apiContext;
    this.authToken = token;
  }

  /**
   * Get all dependencies for an entity type
   */
  getDependencies(entityType: string): string[] {
    return EntityDependencies[entityType as keyof typeof EntityDependencies] || [];
  }

  /**
   * Check if all dependencies are satisfied
   */
  areDependenciesSatisfied(entityType: string): boolean {
    const deps = this.getDependencies(entityType);
    return deps.every((dep) => this.hasEntity(dep));
  }

  /**
   * Check if an entity type exists
   */
  hasEntity(entityType: string): boolean {
    const entities = this.createdEntities.get(entityType);
    return !!entities && entities.length > 0;
  }

  /**
   * Get entities of a specific type
   */
  getEntities(entityType: string): CreatedEntity[] {
    return this.createdEntities.get(entityType) || [];
  }

  /**
   * Get the first entity of a type
   */
  getEntity(entityType: string): CreatedEntity | undefined {
    const entities = this.getEntities(entityType);
    return entities[0];
  }

  /**
   * Register a created entity
   */
  registerEntity(type: string, id: string, data: Record<string, any>): void {
    const entity: CreatedEntity = {
      type,
      id,
      data,
      createdAt: new Date(),
    };

    if (!this.createdEntities.has(type)) {
      this.createdEntities.set(type, []);
    }
    this.createdEntities.get(type)!.push(entity);
  }

  /**
   * Create an entity via API for fast setup
   */
  async createViaAPI(entityType: string, data: Record<string, any>): Promise<CreatedEntity> {
    if (!this.apiContext || !this.authToken) {
      throw new Error('DependencyManager not initialized with API context');
    }

    const endpoints: Record<string, string> = {
      customer: '/customers',
      supplier: '/suppliers',
      material: '/materials',
      warehouse: '/warehouses',
      style: '/styles',
      order: '/orders',
      purchaseOrder: '/purchase-orders',
      bom: '/bom',
      workOrder: '/work-orders',
      fabric: '/fabrics',
      greige: '/greige',
      lace: '/materials/lace',
      button: '/materials/button',
      thread: '/materials/thread',
      zipper: '/materials/zipper',
      elastic: '/materials/elastic',
      label: '/materials/label',
      packaging: '/materials/packaging',
    };

    const endpoint = endpoints[entityType];
    if (!endpoint) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }

    const response = await this.apiContext.post(`${TestConfig.apiURL}${endpoint}`, {
      data,
      headers: {
        Authorization: `Bearer ${this.authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok()) {
      const errorBody = await response.text();
      throw new Error(`Failed to create ${entityType}: ${response.status()} - ${errorBody}`);
    }

    const responseData = await response.json();
    const createdData = responseData.data || responseData;
    const id = createdData.id;

    this.registerEntity(entityType, id, createdData);

    return {
      type: entityType,
      id,
      data: createdData,
      createdAt: new Date(),
    };
  }

  /**
   * Delete an entity via API
   */
  async deleteViaAPI(entityType: string, id: string): Promise<void> {
    if (!this.apiContext || !this.authToken) {
      throw new Error('DependencyManager not initialized with API context');
    }

    const endpoints: Record<string, string> = {
      customer: '/customers',
      supplier: '/suppliers',
      material: '/materials',
      warehouse: '/warehouses',
      style: '/styles',
      order: '/orders',
      purchaseOrder: '/purchase-orders',
      bom: '/bom',
      workOrder: '/work-orders',
    };

    const endpoint = endpoints[entityType];
    if (!endpoint) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }

    await this.apiContext.delete(`${TestConfig.apiURL}${endpoint}/${id}`, {
      headers: {
        Authorization: `Bearer ${this.authToken}`,
      },
    });

    // Remove from tracked entities
    const entities = this.createdEntities.get(entityType);
    if (entities) {
      const index = entities.findIndex((e) => e.id === id);
      if (index !== -1) {
        entities.splice(index, 1);
      }
    }
  }

  /**
   * Cleanup all created entities (in reverse dependency order)
   */
  async cleanup(): Promise<void> {
    // Define cleanup order (reverse of creation order)
    const cleanupOrder = [
      'workOrder',
      'invoice',
      'stockMovement',
      'grn',
      'costSheet',
      'order',
      'bom',
      'purchaseOrder',
      'style',
      'greige',
      'fabric',
      'material',
      'location',
      'supplier',
      'customer',
      'warehouse',
      'componentMaster',
      'materialCategory',
    ];

    for (const entityType of cleanupOrder) {
      const entities = this.createdEntities.get(entityType) || [];
      for (const entity of entities) {
        try {
          await this.deleteViaAPI(entityType, entity.id);
        } catch (error) {
          console.warn(`Failed to cleanup ${entityType} ${entity.id}:`, error);
        }
      }
    }

    this.createdEntities.clear();
  }

  /**
   * Setup required dependencies for an entity
   * Returns the created dependencies
   */
  async setupDependencies(entityType: string): Promise<Map<string, CreatedEntity>> {
    const results = new Map<string, CreatedEntity>();
    const deps = this.getDependencies(entityType);

    for (const dep of deps) {
      if (!this.hasEntity(dep)) {
        // Recursively setup dependencies
        const subDeps = await this.setupDependencies(dep);
        subDeps.forEach((entity, type) => results.set(type, entity));

        // Create the dependency
        const entity = await this.createDefaultEntity(dep);
        results.set(dep, entity);
      } else {
        results.set(dep, this.getEntity(dep)!);
      }
    }

    return results;
  }

  /**
   * Create a default entity with standard test data
   */
  async createDefaultEntity(entityType: string): Promise<CreatedEntity> {
    const timestamp = Date.now();
    const generators: Record<string, () => Record<string, any>> = {
      customer: () => ({
        code: `CUST-${timestamp}`,
        name: `Test Customer ${timestamp}`,
        type: 'BUYER',
        category: 'DOMESTIC',
        businessType: 'B2B',
        market: 'DOMESTIC',
        contactPerson: 'Test Contact',
        email: `customer${timestamp}@test.com`,
        phone: '9876543210',
        billingAddress: 'Test Billing Address',
      }),

      supplier: () => ({
        code: `SUP-${timestamp}`,
        name: `Test Supplier ${timestamp}`,
        contactPerson: 'Test Contact',
        email: `supplier${timestamp}@test.com`,
        phone: '9876543211',
        address: 'Test Address',
        supplierCategory: 'FABRIC',
      }),

      material: () => ({
        code: `MAT-${timestamp}`,
        name: `Test Material ${timestamp}`,
        unit: 'METER',
        materialType: 'GENERIC',
        description: 'Test material for E2E testing',
      }),

      warehouse: () => ({
        code: `WH-${timestamp}`,
        name: `Test Warehouse ${timestamp}`,
        address: 'Test Warehouse Address',
        type: 'WAREHOUSE',
      }),

      style: () => {
        const customer = this.getEntity('customer');
        return {
          styleCode: `STY-${timestamp}`,
          styleName: `Test Style ${timestamp}`,
          customerId: customer?.id,
          category: 'TOP',
          season: 'SS24',
          status: 'ACTIVE',
        };
      },

      order: () => {
        const customer = this.getEntity('customer');
        const style = this.getEntity('style');
        return {
          orderNumber: `ORD-${timestamp}`,
          customerId: customer?.id,
          orderDate: new Date().toISOString(),
          expectedDeliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'PENDING',
          items: [
            {
              styleId: style?.id,
              totalQuantity: 100,
              unitPrice: 500,
            },
          ],
        };
      },

      purchaseOrder: () => {
        const supplier = this.getEntity('supplier');
        const material = this.getEntity('material');
        return {
          poNumber: `PO-${timestamp}`,
          supplierId: supplier?.id,
          orderDate: new Date().toISOString(),
          expectedDeliveryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'PENDING',
          items: [
            {
              materialId: material?.id,
              quantity: 1000,
              unitPrice: 100,
            },
          ],
        };
      },

      bom: () => {
        const style = this.getEntity('style');
        const material = this.getEntity('material');
        return {
          styleId: style?.id,
          version: '1.0',
          status: 'DRAFT',
          items: [
            {
              materialId: material?.id,
              quantity: 2,
              unit: 'METER',
              wastagePercent: 5,
            },
          ],
        };
      },

      componentMaster: () => ({
        name: `Component ${timestamp}`,
        type: 'ATTRIBUTE',
        category: 'SIZE',
        values: ['S', 'M', 'L', 'XL'],
      }),
    };

    const generator = generators[entityType];
    if (!generator) {
      throw new Error(`No default generator for entity type: ${entityType}`);
    }

    return await this.createViaAPI(entityType, generator());
  }
}

/**
 * Factory function to create a DependencyManager
 */
export function createDependencyManager(page: Page): DependencyManager {
  return new DependencyManager(page);
}

export default DependencyManager;
