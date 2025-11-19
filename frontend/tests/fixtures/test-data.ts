/**
 * Test Data Fixtures for E2E Tests
 * Provides reusable test data for various modules
 */

export interface TestCustomer {
  code: string;
  name: string;
  type: 'BUYER';
  category: 'DOMESTIC' | 'EXPORT' | 'LOCAL';
  contactPerson: string;
  email: string;
  phone: string;
  billingAddress: string;
  shippingAddress: string;
  gstNumber: string;
  creditLimit?: string;
  creditDays?: string;
}

export interface TestMaterial {
  code: string;
  name: string;
  unit: string;
  description: string;
  specifications: string;
  costPrice: string;
  reorderLevel: string;
}

export interface TestSupplier {
  code: string;
  name: string;
  supplierCategory: 'FABRIC' | 'TRIM' | 'PACKAGING' | 'OTHER';
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  gstNumber: string;
  paymentTerms: string;
  creditLimit: string;
  creditDays: string;
}

/**
 * Generate a unique customer for testing
 */
export function generateTestCustomer(prefix: string = 'Test'): TestCustomer {
  const timestamp = Date.now();
  return {
    code: `CUST${timestamp}`,
    name: `${prefix} Customer ${timestamp}`,
    type: 'BUYER',
    category: 'DOMESTIC',
    contactPerson: 'John Doe',
    email: `customer${timestamp}@test.com`,
    phone: '9876543210',
    billingAddress: '123 Test Street, Test City, Test State - 123456',
    shippingAddress: '456 Ship Street, Ship City, Ship State - 654321',
    gstNumber: '22AAAAA0000A1Z5',
    creditLimit: '100000',
    creditDays: '30',
  };
}

/**
 * Generate a unique material for testing
 */
export function generateTestMaterial(prefix: string = 'Test'): TestMaterial {
  const timestamp = Date.now();
  return {
    code: `MAT${timestamp}`,
    name: `${prefix} Material ${timestamp}`,
    unit: 'METER',
    description: 'Test material description',
    specifications: 'Width: 60 inches, Weight: 200 GSM',
    costPrice: '150.50',
    reorderLevel: '100',
  };
}

/**
 * Generate a unique supplier for testing
 */
export function generateTestSupplier(prefix: string = 'Test'): TestSupplier {
  const timestamp = Date.now();
  return {
    code: `SUP${timestamp}`,
    name: `${prefix} Supplier ${timestamp}`,
    supplierCategory: 'FABRIC',
    contactPerson: 'Jane Smith',
    email: `supplier${timestamp}@test.com`,
    phone: '9876543211',
    address: '789 Supplier Lane, Supply City, Supply State - 789012',
    gstNumber: '29BBBBB0000B1Z6',
    paymentTerms: 'Net 30 days',
    creditLimit: '500000',
    creditDays: '45',
  };
}

/**
 * Bulk test data for performance/pagination testing
 */
export function generateBulkCustomers(count: number): TestCustomer[] {
  return Array.from({ length: count }, (_, i) => generateTestCustomer(`Bulk${i + 1}`));
}

export function generateBulkMaterials(count: number): TestMaterial[] {
  return Array.from({ length: count }, (_, i) => generateTestMaterial(`Bulk${i + 1}`));
}

export function generateBulkSuppliers(count: number): TestSupplier[] {
  return Array.from({ length: count }, (_, i) => generateTestSupplier(`Bulk${i + 1}`));
}

/**
 * Valid GST numbers for testing
 */
export const VALID_GST_NUMBERS = [
  '22AAAAA0000A1Z5',
  '29BBBBB0000B1Z6',
  '27CCCCC0000C1Z7',
  '33DDDDD0000D1Z8',
];

/**
 * Valid phone numbers for testing
 */
export const VALID_PHONE_NUMBERS = [
  '9876543210',
  '9876543211',
  '9876543212',
  '9876543213',
];

/**
 * Valid email domains for testing
 */
export const TEST_EMAIL_DOMAINS = [
  '@test.com',
  '@kashayafabs.com',
  '@example.com',
];
