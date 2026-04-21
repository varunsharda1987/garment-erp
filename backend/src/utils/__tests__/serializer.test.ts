/**
 * Unit Tests for API Serializer
 *
 * Tests API contract consistency:
 * 1. snake_case to camelCase conversion
 * 2. Relation name mappings (62+ mappings)
 * 3. Nested object serialization
 * 4. Array serialization
 * 5. Decimal/BigInt conversion
 * 6. UUID preservation
 */

import { toCamelCase, toSnakeCase, applyRelationMappings, serialize, RELATION_MAPPINGS } from '../serializer';
import { Decimal } from '@prisma/client/runtime/library';

describe('Serializer', () => {
  describe('toCamelCase', () => {
    it('should convert snake_case keys to camelCase', () => {
      const input = {
        user_name: 'John',
        email_address: 'john@example.com',
        created_at: '2024-01-01',
      };

      const result = toCamelCase(input);

      expect(result).toEqual({
        userName: 'John',
        emailAddress: 'john@example.com',
        createdAt: '2024-01-01',
      });
    });

    it('should handle already camelCase keys', () => {
      const input = {
        userName: 'John',
        emailAddress: 'john@example.com',
      };

      const result = toCamelCase(input);

      expect(result).toEqual({
        userName: 'John',
        emailAddress: 'john@example.com',
      });
    });

    it('should handle null and undefined', () => {
      expect(toCamelCase(null)).toBeNull();
      expect(toCamelCase(undefined)).toBeUndefined();
    });

    it('should handle primitive values', () => {
      expect(toCamelCase('string')).toBe('string');
      expect(toCamelCase(123)).toBe(123);
      expect(toCamelCase(true)).toBe(true);
    });

    it('should handle nested objects', () => {
      const input = {
        user_data: {
          first_name: 'John',
          last_name: 'Doe',
          contact_info: {
            phone_number: '1234567890',
          },
        },
      };

      const result = toCamelCase(input);

      expect(result).toEqual({
        userData: {
          firstName: 'John',
          lastName: 'Doe',
          contactInfo: {
            phoneNumber: '1234567890',
          },
        },
      });
    });

    it('should handle arrays of objects', () => {
      const input = [
        { user_name: 'John', user_id: 1 },
        { user_name: 'Jane', user_id: 2 },
      ];

      const result = toCamelCase(input);

      expect(result).toEqual([
        { userName: 'John', userId: 1 },
        { userName: 'Jane', userId: 2 },
      ]);
    });

    it('should preserve UUID keys', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const input = {
        [uuid]: { name: 'Test' },
        regular_key: 'value',
      };

      const result = toCamelCase(input);

      // UUID key should be preserved as-is
      expect(result).toHaveProperty(uuid);
      expect(result).toHaveProperty('regularKey');
    });

    it('should convert Prisma Decimal to number', () => {
      const input = {
        price: new Decimal('99.99'),
        quantity: new Decimal('10'),
      };

      const result = toCamelCase(input);

      expect(result).toEqual({
        price: 99.99,
        quantity: 10,
      });
    });

    it('should convert BigInt to number', () => {
      const input = BigInt(1234567890);
      const result = toCamelCase(input);
      expect(result).toBe(1234567890);
    });

    it('should preserve Date objects', () => {
      const date = new Date('2024-01-15');
      const input = { created_at: date };

      const result = toCamelCase(input);

      expect(result).toEqual({ createdAt: date });
      expect((result as any).createdAt).toBeInstanceOf(Date);
    });

    it('should handle deeply nested Decimals', () => {
      const input = {
        order: {
          items: [
            { price: new Decimal('100.50'), quantity: new Decimal('5') },
            { price: new Decimal('200.75'), quantity: new Decimal('3') },
          ],
          total_amount: new Decimal('1105.25'),
        },
      };

      const result = toCamelCase(input);

      expect((result as any).order.items[0].price).toBe(100.5);
      expect((result as any).order.items[1].quantity).toBe(3);
      expect((result as any).order.totalAmount).toBe(1105.25);
    });

    it('should handle verbose Prisma relation names', () => {
      const input = {
        usersOrdersCreatedByIdTousers: { id: '1', name: 'Admin' },
        usersOrdersApprovedByIdTousers: { id: '2', name: 'Manager' },
      };

      const result = toCamelCase(input);

      expect(result).toHaveProperty('createdBy');
      expect(result).toHaveProperty('approvedBy');
    });
  });

  describe('toSnakeCase', () => {
    it('should convert camelCase keys to snake_case', () => {
      const input = {
        userName: 'John',
        emailAddress: 'john@example.com',
        createdAt: '2024-01-01',
      };

      const result = toSnakeCase(input);

      expect(result).toEqual({
        user_name: 'John',
        email_address: 'john@example.com',
        created_at: '2024-01-01',
      });
    });

    it('should handle nested objects', () => {
      const input = {
        userData: {
          firstName: 'John',
          contactInfo: {
            phoneNumber: '123',
          },
        },
      };

      const result = toSnakeCase(input);

      expect(result).toEqual({
        user_data: {
          first_name: 'John',
          contact_info: {
            phone_number: '123',
          },
        },
      });
    });

    it('should handle arrays', () => {
      const input = [{ userName: 'John' }, { userName: 'Jane' }];

      const result = toSnakeCase(input);

      expect(result).toEqual([{ user_name: 'John' }, { user_name: 'Jane' }]);
    });
  });

  describe('applyRelationMappings', () => {
    it('should apply known relation mappings', () => {
      const input = {
        materialCategories: { id: '1', name: 'Fabric' },
        styleComponents: [{ id: '1' }, { id: '2' }],
      };

      const result = applyRelationMappings(input);

      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('components');
    });

    it('should preserve unmapped keys', () => {
      const input = {
        id: '123',
        name: 'Test',
        customField: 'value',
      };

      const result = applyRelationMappings(input);

      expect(result).toEqual(input);
    });

    it('should handle nested mappings', () => {
      const input = {
        orders: {
          customers: { id: '1', name: 'Customer' },
          purchaseOrderItems: [{ id: '1' }],
        },
      };

      const result = applyRelationMappings(input);

      expect((result as any).orders).toHaveProperty('customer');
      expect((result as any).orders).toHaveProperty('items');
    });

    it('should handle arrays with mappings', () => {
      const input = [{ materialCategories: { name: 'A' } }, { materialCategories: { name: 'B' } }];

      const result = applyRelationMappings(input);

      expect((result as any)[0]).toHaveProperty('category');
      expect((result as any)[1]).toHaveProperty('category');
    });
  });

  describe('serialize (full pipeline)', () => {
    it('should combine camelCase and relation mapping', () => {
      const input = {
        material_categories: { category_name: 'Fabric' },
        style_components: [{ component_name: 'Sleeve' }],
      };

      const result = serialize(input);

      // Should be camelCased AND mapped
      expect(result).toHaveProperty('category');
      expect((result as any).category).toHaveProperty('categoryName');
    });

    it('should handle complex nested structure', () => {
      const input = {
        id: '123',
        order_number: 'ORD-001',
        customers: {
          id: '456',
          customer_name: 'Acme Corp',
          billing_address: {
            street_name: '123 Main St',
          },
        },
        purchase_order_items: [
          {
            item_id: '789',
            unit_price: new Decimal('99.99'),
            ordered_quantity: 10,
          },
        ],
        created_at: new Date('2024-01-01'),
      };

      const result = serialize(input);

      // Check camelCase conversion
      expect(result).toHaveProperty('orderNumber', 'ORD-001');

      // Check relation mapping (customers -> customer)
      expect(result).toHaveProperty('customer');
      expect((result as any).customer).toHaveProperty('customerName', 'Acme Corp');

      // Check nested camelCase
      expect((result as any).customer.billingAddress).toHaveProperty('streetName', '123 Main St');

      // Check array mapping (purchaseOrderItems -> items)
      expect(result).toHaveProperty('items');
      expect((result as any).items[0]).toHaveProperty('unitPrice', 99.99);
      expect((result as any).items[0]).toHaveProperty('orderedQuantity', 10);

      // Check Date preservation
      expect((result as any).createdAt).toBeInstanceOf(Date);
    });
  });

  describe('RELATION_MAPPINGS coverage', () => {
    it('should have at least 60 relation mappings', () => {
      const mappingCount = Object.keys(RELATION_MAPPINGS).length;
      expect(mappingCount).toBeGreaterThanOrEqual(60);
    });

    it('should map material relations correctly', () => {
      expect(RELATION_MAPPINGS.materialCategories).toBe('category');
      expect(RELATION_MAPPINGS.styleComponents).toBe('components');
      expect(RELATION_MAPPINGS.styleFabrics).toBe('fabrics');
    });

    it('should map customer/supplier relations correctly', () => {
      expect(RELATION_MAPPINGS.customers).toBe('customer');
      expect(RELATION_MAPPINGS.suppliers).toBe('supplier');
    });

    it('should map item collections to "items"', () => {
      expect(RELATION_MAPPINGS.purchaseOrderItems).toBe('items');
      expect(RELATION_MAPPINGS.grnItems).toBe('items');
      expect(RELATION_MAPPINGS.bomItems).toBe('items');
      expect(RELATION_MAPPINGS.quotationItems).toBe('items');
    });

    it('should map user relation shortcuts', () => {
      expect(RELATION_MAPPINGS.usersOrdersCreatedByIdTousers).toBe('createdBy');
      expect(RELATION_MAPPINGS.usersOrdersApprovedByIdTousers).toBe('approvedBy');
    });

    it('should map stock relations correctly', () => {
      expect(RELATION_MAPPINGS.stockLevels).toBe('stockLevels');
      expect(RELATION_MAPPINGS.stockMovements).toBe('stockMovements');
      expect(RELATION_MAPPINGS.finishedGoodsStock).toBe('finishedGoodsStock');
    });

    it('should map trim master relations correctly', () => {
      expect(RELATION_MAPPINGS.buttonMaster).toBe('buttonMaster');
      expect(RELATION_MAPPINGS.zipperMaster).toBe('zipperMaster');
      expect(RELATION_MAPPINGS.elasticMaster).toBe('elasticMaster');
      expect(RELATION_MAPPINGS.labelMaster).toBe('labelMaster');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty objects', () => {
      expect(toCamelCase({})).toEqual({});
      expect(serialize({})).toEqual({});
    });

    it('should handle empty arrays', () => {
      expect(toCamelCase([])).toEqual([]);
      expect(serialize([])).toEqual([]);
    });

    it('should handle mixed arrays', () => {
      const input = [1, 'string', { snake_case: 'value' }, null];
      const result = toCamelCase(input);

      expect(result).toEqual([1, 'string', { snakeCase: 'value' }, null]);
    });

    it('should handle very deep nesting', () => {
      const input = {
        level_1: {
          level_2: {
            level_3: {
              level_4: {
                deep_value: 'found',
              },
            },
          },
        },
      };

      const result = toCamelCase(input);

      expect((result as any).level1.level2.level3.level4.deepValue).toBe('found');
    });

    it('should handle keys with numbers', () => {
      const input = {
        address_line_1: '123 Main St',
        address_line_2: 'Suite 100',
      };

      const result = toCamelCase(input);

      expect(result).toHaveProperty('addressLine1');
      expect(result).toHaveProperty('addressLine2');
    });

    it('should handle special characters in values', () => {
      const input = {
        description: 'Test\'s "special" <characters> & symbols',
        sql_injection: "'; DROP TABLE users; --",
      };

      const result = toCamelCase(input);

      expect((result as any).description).toBe('Test\'s "special" <characters> & symbols');
      expect((result as any).sqlInjection).toBe("'; DROP TABLE users; --");
    });
  });
});
