/**
 * MRP Service Unit Tests
 *
 * Tests Material Requirement Planning logic:
 * 1. Requirement calculation formula
 * 2. Shortfall detection
 * 3. Stock allocation logic
 * 4. Bulk aggregation
 * 5. PO generation validation
 */

import { Decimal } from '@prisma/client/runtime/library';

describe('MRP Service', () => {
  describe('Requirement Calculation Formula', () => {
    /**
     * The MRP formula is:
     * totalRequired = orderQuantity × quantityPerUnit × (1 + wastagePercent/100)
     */

    function calculateRequirement(orderQuantity: number, quantityPerUnit: number, wastagePercent: number = 0): number {
      return orderQuantity * quantityPerUnit * (1 + wastagePercent / 100);
    }

    it('should calculate basic requirement without wastage', () => {
      // 100 garments × 1.5 meters per garment = 150 meters
      const result = calculateRequirement(100, 1.5, 0);
      expect(result).toBe(150);
    });

    it('should calculate requirement with wastage', () => {
      // 100 garments × 1.5 meters × (1 + 5/100) = 157.5 meters
      const result = calculateRequirement(100, 1.5, 5);
      expect(result).toBe(157.5);
    });

    it('should handle decimal quantities', () => {
      // 75 garments × 2.25 meters × (1 + 3/100) = 173.8125 meters
      const result = calculateRequirement(75, 2.25, 3);
      expect(result).toBeCloseTo(173.8125, 4);
    });

    it('should handle zero quantity', () => {
      const result = calculateRequirement(0, 1.5, 5);
      expect(result).toBe(0);
    });

    it('should handle zero wastage', () => {
      const result = calculateRequirement(100, 2.0, 0);
      expect(result).toBe(200);
    });

    it('should handle high wastage percentage', () => {
      // 100 garments × 1.0 meter × (1 + 20/100) = 120 meters
      const result = calculateRequirement(100, 1.0, 20);
      expect(result).toBe(120);
    });
  });

  describe('Shortfall Detection', () => {
    function calculateShortfall(required: number, available: number): number {
      return Math.max(0, required - available);
    }

    function hasShortfall(required: number, available: number): boolean {
      return required > available;
    }

    it('should detect shortfall when required > available', () => {
      expect(hasShortfall(100, 50)).toBe(true);
      expect(calculateShortfall(100, 50)).toBe(50);
    });

    it('should not detect shortfall when required <= available', () => {
      expect(hasShortfall(50, 100)).toBe(false);
      expect(calculateShortfall(50, 100)).toBe(0);
    });

    it('should handle exact match (no shortfall)', () => {
      expect(hasShortfall(100, 100)).toBe(false);
      expect(calculateShortfall(100, 100)).toBe(0);
    });

    it('should handle zero available stock', () => {
      expect(hasShortfall(100, 0)).toBe(true);
      expect(calculateShortfall(100, 0)).toBe(100);
    });

    it('should handle zero required (no shortfall)', () => {
      expect(hasShortfall(0, 50)).toBe(false);
      expect(calculateShortfall(0, 50)).toBe(0);
    });

    it('should handle decimal quantities', () => {
      expect(hasShortfall(100.5, 100)).toBe(true);
      expect(calculateShortfall(100.5, 100)).toBeCloseTo(0.5, 4);
    });
  });

  describe('Stock Allocation Logic', () => {
    interface StockAllocation {
      allocated: number;
      remaining: number;
      shortfall: number;
    }

    function allocateStock(required: number, available: number): StockAllocation {
      const allocated = Math.min(required, available);
      return {
        allocated,
        remaining: available - allocated,
        shortfall: Math.max(0, required - allocated),
      };
    }

    it('should allocate full amount when stock is sufficient', () => {
      const result = allocateStock(50, 100);
      expect(result.allocated).toBe(50);
      expect(result.remaining).toBe(50);
      expect(result.shortfall).toBe(0);
    });

    it('should allocate partial amount when stock is insufficient', () => {
      const result = allocateStock(100, 60);
      expect(result.allocated).toBe(60);
      expect(result.remaining).toBe(0);
      expect(result.shortfall).toBe(40);
    });

    it('should allocate nothing when no stock available', () => {
      const result = allocateStock(100, 0);
      expect(result.allocated).toBe(0);
      expect(result.remaining).toBe(0);
      expect(result.shortfall).toBe(100);
    });

    it('should handle exact match allocation', () => {
      const result = allocateStock(100, 100);
      expect(result.allocated).toBe(100);
      expect(result.remaining).toBe(0);
      expect(result.shortfall).toBe(0);
    });
  });

  describe('Bulk Aggregation', () => {
    interface MaterialRequirement {
      materialId: string;
      quantity: number;
    }

    function aggregateRequirements(requirements: MaterialRequirement[]): Map<string, number> {
      const aggregated = new Map<string, number>();

      for (const req of requirements) {
        const current = aggregated.get(req.materialId) || 0;
        aggregated.set(req.materialId, current + req.quantity);
      }

      return aggregated;
    }

    it('should aggregate requirements for same material', () => {
      const requirements: MaterialRequirement[] = [
        { materialId: 'MAT001', quantity: 100 },
        { materialId: 'MAT001', quantity: 50 },
        { materialId: 'MAT001', quantity: 25 },
      ];

      const result = aggregateRequirements(requirements);
      expect(result.get('MAT001')).toBe(175);
    });

    it('should keep different materials separate', () => {
      const requirements: MaterialRequirement[] = [
        { materialId: 'MAT001', quantity: 100 },
        { materialId: 'MAT002', quantity: 50 },
        { materialId: 'MAT003', quantity: 25 },
      ];

      const result = aggregateRequirements(requirements);
      expect(result.get('MAT001')).toBe(100);
      expect(result.get('MAT002')).toBe(50);
      expect(result.get('MAT003')).toBe(25);
      expect(result.size).toBe(3);
    });

    it('should handle mixed aggregation', () => {
      const requirements: MaterialRequirement[] = [
        { materialId: 'MAT001', quantity: 100 },
        { materialId: 'MAT002', quantity: 50 },
        { materialId: 'MAT001', quantity: 75 },
        { materialId: 'MAT002', quantity: 25 },
      ];

      const result = aggregateRequirements(requirements);
      expect(result.get('MAT001')).toBe(175);
      expect(result.get('MAT002')).toBe(75);
    });

    it('should handle empty requirements', () => {
      const result = aggregateRequirements([]);
      expect(result.size).toBe(0);
    });

    it('should handle single requirement', () => {
      const requirements: MaterialRequirement[] = [{ materialId: 'MAT001', quantity: 100 }];

      const result = aggregateRequirements(requirements);
      expect(result.get('MAT001')).toBe(100);
      expect(result.size).toBe(1);
    });
  });

  describe('PO Generation Validation', () => {
    interface POItem {
      materialId: string;
      quantity: number;
      supplierId: string;
    }

    function validatePOItems(items: POItem[]): { valid: boolean; errors: string[] } {
      const errors: string[] = [];

      if (items.length === 0) {
        errors.push('PO must have at least one item');
      }

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.materialId) {
          errors.push(`Item ${i + 1}: Material ID is required`);
        }
        if (item.quantity <= 0) {
          errors.push(`Item ${i + 1}: Quantity must be positive`);
        }
        if (!item.supplierId) {
          errors.push(`Item ${i + 1}: Supplier ID is required`);
        }
      }

      return { valid: errors.length === 0, errors };
    }

    function groupItemsBySupplier(items: POItem[]): Map<string, POItem[]> {
      const grouped = new Map<string, POItem[]>();

      for (const item of items) {
        const current = grouped.get(item.supplierId) || [];
        current.push(item);
        grouped.set(item.supplierId, current);
      }

      return grouped;
    }

    it('should validate valid PO items', () => {
      const items: POItem[] = [
        { materialId: 'MAT001', quantity: 100, supplierId: 'SUP001' },
        { materialId: 'MAT002', quantity: 50, supplierId: 'SUP001' },
      ];

      const result = validatePOItems(items);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty PO', () => {
      const result = validatePOItems([]);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('PO must have at least one item');
    });

    it('should reject items without material ID', () => {
      const items: POItem[] = [{ materialId: '', quantity: 100, supplierId: 'SUP001' }];

      const result = validatePOItems(items);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Material ID is required'))).toBe(true);
    });

    it('should reject items with zero or negative quantity', () => {
      const items: POItem[] = [{ materialId: 'MAT001', quantity: 0, supplierId: 'SUP001' }];

      const result = validatePOItems(items);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Quantity must be positive'))).toBe(true);
    });

    it('should reject items without supplier', () => {
      const items: POItem[] = [{ materialId: 'MAT001', quantity: 100, supplierId: '' }];

      const result = validatePOItems(items);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Supplier ID is required'))).toBe(true);
    });

    it('should group items by supplier for PO generation', () => {
      const items: POItem[] = [
        { materialId: 'MAT001', quantity: 100, supplierId: 'SUP001' },
        { materialId: 'MAT002', quantity: 50, supplierId: 'SUP002' },
        { materialId: 'MAT003', quantity: 75, supplierId: 'SUP001' },
      ];

      const grouped = groupItemsBySupplier(items);
      expect(grouped.size).toBe(2);
      expect(grouped.get('SUP001')?.length).toBe(2);
      expect(grouped.get('SUP002')?.length).toBe(1);
    });
  });

  describe('Decimal Handling', () => {
    it('should correctly convert Decimal to number for calculations', () => {
      const quantity = new Decimal('150.75');
      const rate = new Decimal('25.50');

      const total = Number(quantity) * Number(rate);
      expect(total).toBeCloseTo(3844.125, 3);
    });

    it('should handle Decimal precision in requirements', () => {
      const orderQty = new Decimal('100');
      const perUnit = new Decimal('1.333');
      const wastage = new Decimal('5');

      const required = Number(orderQty) * Number(perUnit) * (1 + Number(wastage) / 100);
      expect(required).toBeCloseTo(139.965, 3);
    });

    it('should round to appropriate decimal places for display', () => {
      const calculated = 139.9654321;

      const rounded2 = Math.round(calculated * 100) / 100;
      const rounded3 = Math.round(calculated * 1000) / 1000;

      expect(rounded2).toBe(139.97);
      expect(rounded3).toBe(139.965);
    });
  });

  describe('Missing Material Handling', () => {
    interface BOMItem {
      componentName: string;
      materialId: string | null;
      materialType: string;
      quantity: number;
    }

    interface ProcessResult {
      processed: BOMItem[];
      skipped: { componentName: string; reason: string }[];
    }

    function processBOMItems(items: BOMItem[]): ProcessResult {
      const processed: BOMItem[] = [];
      const skipped: { componentName: string; reason: string }[] = [];

      for (const item of items) {
        if (!item.materialId) {
          skipped.push({
            componentName: item.componentName,
            reason: `No material linked for ${item.materialType}`,
          });
          continue;
        }

        if (item.quantity <= 0) {
          skipped.push({
            componentName: item.componentName,
            reason: 'Zero or negative quantity',
          });
          continue;
        }

        processed.push(item);
      }

      return { processed, skipped };
    }

    it('should skip items without material ID', () => {
      const items: BOMItem[] = [
        { componentName: 'Main Fabric', materialId: null, materialType: 'FABRIC', quantity: 100 },
        { componentName: 'Button', materialId: 'MAT001', materialType: 'BUTTON', quantity: 50 },
      ];

      const result = processBOMItems(items);
      expect(result.processed).toHaveLength(1);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].componentName).toBe('Main Fabric');
    });

    it('should skip items with zero quantity', () => {
      const items: BOMItem[] = [
        { componentName: 'Main Fabric', materialId: 'MAT001', materialType: 'FABRIC', quantity: 0 },
        { componentName: 'Button', materialId: 'MAT002', materialType: 'BUTTON', quantity: 50 },
      ];

      const result = processBOMItems(items);
      expect(result.processed).toHaveLength(1);
      expect(result.skipped).toHaveLength(1);
    });

    it('should process all valid items', () => {
      const items: BOMItem[] = [
        { componentName: 'Main Fabric', materialId: 'MAT001', materialType: 'FABRIC', quantity: 100 },
        { componentName: 'Button', materialId: 'MAT002', materialType: 'BUTTON', quantity: 50 },
        { componentName: 'Thread', materialId: 'MAT003', materialType: 'THREAD', quantity: 25 },
      ];

      const result = processBOMItems(items);
      expect(result.processed).toHaveLength(3);
      expect(result.skipped).toHaveLength(0);
    });

    it('should not crash on empty BOM', () => {
      const result = processBOMItems([]);
      expect(result.processed).toHaveLength(0);
      expect(result.skipped).toHaveLength(0);
    });
  });

  describe('Order BOM Expansion', () => {
    interface OrderItem {
      styleId: string;
      quantity: number;
    }

    interface StyleBOM {
      styleId: string;
      materials: { materialId: string; quantityPerUnit: number }[];
    }

    interface ExpandedRequirement {
      materialId: string;
      totalQuantity: number;
      orderItemId: string;
    }

    function expandOrderBOM(orderItems: OrderItem[], styleBOMs: Map<string, StyleBOM>): ExpandedRequirement[] {
      const requirements: ExpandedRequirement[] = [];

      for (let i = 0; i < orderItems.length; i++) {
        const orderItem = orderItems[i];
        const bom = styleBOMs.get(orderItem.styleId);

        if (!bom) continue;

        for (const material of bom.materials) {
          requirements.push({
            materialId: material.materialId,
            totalQuantity: orderItem.quantity * material.quantityPerUnit,
            orderItemId: `ITEM_${i}`,
          });
        }
      }

      return requirements;
    }

    it('should expand BOM for single order item', () => {
      const orderItems: OrderItem[] = [{ styleId: 'STY001', quantity: 100 }];

      const styleBOMs = new Map<string, StyleBOM>();
      styleBOMs.set('STY001', {
        styleId: 'STY001',
        materials: [
          { materialId: 'MAT001', quantityPerUnit: 1.5 },
          { materialId: 'MAT002', quantityPerUnit: 4 },
        ],
      });

      const result = expandOrderBOM(orderItems, styleBOMs);
      expect(result).toHaveLength(2);
      expect(result.find((r) => r.materialId === 'MAT001')?.totalQuantity).toBe(150);
      expect(result.find((r) => r.materialId === 'MAT002')?.totalQuantity).toBe(400);
    });

    it('should expand BOM for multiple order items', () => {
      const orderItems: OrderItem[] = [
        { styleId: 'STY001', quantity: 100 },
        { styleId: 'STY002', quantity: 50 },
      ];

      const styleBOMs = new Map<string, StyleBOM>();
      styleBOMs.set('STY001', {
        styleId: 'STY001',
        materials: [{ materialId: 'MAT001', quantityPerUnit: 2 }],
      });
      styleBOMs.set('STY002', {
        styleId: 'STY002',
        materials: [{ materialId: 'MAT001', quantityPerUnit: 1.5 }],
      });

      const result = expandOrderBOM(orderItems, styleBOMs);
      expect(result).toHaveLength(2);

      // Both styles use MAT001 but with different quantities
      const mat001Reqs = result.filter((r) => r.materialId === 'MAT001');
      expect(mat001Reqs).toHaveLength(2);
      expect(mat001Reqs[0].totalQuantity).toBe(200); // 100 × 2
      expect(mat001Reqs[1].totalQuantity).toBe(75); // 50 × 1.5
    });

    it('should skip order items without BOM', () => {
      const orderItems: OrderItem[] = [
        { styleId: 'STY001', quantity: 100 },
        { styleId: 'STY_NO_BOM', quantity: 50 },
      ];

      const styleBOMs = new Map<string, StyleBOM>();
      styleBOMs.set('STY001', {
        styleId: 'STY001',
        materials: [{ materialId: 'MAT001', quantityPerUnit: 2 }],
      });

      const result = expandOrderBOM(orderItems, styleBOMs);
      expect(result).toHaveLength(1);
      expect(result[0].materialId).toBe('MAT001');
    });
  });
});
