/**
 * Test script to verify snake_case to camelCase transformation
 * Run with: node test-transformation.js
 */

// Import the serializer
const { serialize, toCamelCase, applyRelationMappings, RELATION_MAPPINGS } = require('./dist/utils/serializer');

console.log('=== Testing Transformation Functions ===\n');

// Test 1: Basic camelCase transformation
console.log('Test 1: Basic camelCase transformation');
const test1Input = {
  material_categories: {
    id: '123',
    category_name: 'Fabric',
    parent_id: null,
  },
  cost_price: 100.50,
  reorder_level: 50,
};

const test1Output = toCamelCase(test1Input);
console.log('Input:', JSON.stringify(test1Input, null, 2));
console.log('Output:', JSON.stringify(test1Output, null, 2));
console.log('✓ Should convert material_categories → materialCategories');
console.log('✓ Should convert cost_price → costPrice\n');

// Test 2: Relation mapping
console.log('Test 2: Relation mapping');
const test2Input = {
  materialCategories: {
    id: '123',
    name: 'Fabric',
  },
  styleComponents: [
    { id: '1', componentName: 'Body' },
    { id: '2', componentName: 'Sleeve' },
  ],
};

const test2Output = applyRelationMappings(test2Input);
console.log('Input:', JSON.stringify(test2Input, null, 2));
console.log('Output:', JSON.stringify(test2Output, null, 2));
console.log('✓ Should convert materialCategories → category');
console.log('✓ Should convert styleComponents → components\n');

// Test 3: Full serialization (toCamelCase + applyRelationMappings)
console.log('Test 3: Full serialization');
const test3Input = {
  material_categories: {
    id: '123',
    category_name: 'Fabric',
  },
  style_components: [
    { id: '1', component_name: 'Body' },
  ],
  cost_price: 100.50,
};

const test3Output = serialize(test3Input);
console.log('Input:', JSON.stringify(test3Input, null, 2));
console.log('Output:', JSON.stringify(test3Output, null, 2));
console.log('✓ Should convert material_categories → category (with camelCase fields)');
console.log('✓ Should convert style_components → components\n');

// Test 4: Verbose Prisma relation names
console.log('Test 4: Verbose Prisma relation names');
const test4Input = {
  users_orders_createdByIdTousers: {
    id: '1',
    first_name: 'John',
    last_name: 'Doe',
  },
  users_orders_approvedByIdTousers: {
    id: '2',
    first_name: 'Jane',
    last_name: 'Smith',
  },
};

const test4Output = toCamelCase(test4Input);
console.log('Input:', JSON.stringify(test4Input, null, 2));
console.log('Output:', JSON.stringify(test4Output, null, 2));
console.log('✓ Should convert users_orders_createdByIdTousers → createdBy');
console.log('✓ Should convert users_orders_approvedByIdTousers → approvedBy\n');

// Test 5: Array of materials with nested relations
console.log('Test 5: Array with nested relations');
const test5Input = {
  data: [
    {
      id: '1',
      material_name: 'Cotton Fabric',
      material_categories: {
        id: 'cat1',
        name: 'Fabric',
        parent: {
          id: 'cat0',
          name: 'Textiles',
        },
      },
      inventory_stock: [
        { id: 'stock1', quantity: 100 },
      ],
    },
  ],
};

const test5Output = serialize(test5Input);
console.log('Input:', JSON.stringify(test5Input, null, 2));
console.log('Output:', JSON.stringify(test5Output, null, 2));
console.log('✓ Should handle nested objects and arrays');
console.log('✓ Should convert material_categories → category\n');

// Display all relation mappings
console.log('=== Current RELATION_MAPPINGS ===');
console.log(JSON.stringify(RELATION_MAPPINGS, null, 2));

console.log('\n=== All Tests Complete ===');
