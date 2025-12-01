/**
 * Entity Fixtures
 * Test data generators for all entity types in the ERP system
 */

// ============================================
// LEVEL 0 ENTITIES - No Dependencies
// ============================================

export interface TestUser {
  email: string;
  password: string;
  name: string;
  role: 'ADMIN' | 'USER' | 'MANAGER';
}

export function generateTestUser(prefix: string = 'test'): TestUser {
  const timestamp = Date.now();
  return {
    email: `${prefix}${timestamp}@kashayafabs.com`,
    password: 'Test@123',
    name: `Test User ${timestamp}`,
    role: 'USER',
  };
}

export interface TestWarehouse {
  code: string;
  name: string;
  address: string;
  type: 'WAREHOUSE' | 'FACTORY' | 'STORE';
  contactPerson?: string;
  phone?: string;
}

export function generateTestWarehouse(prefix: string = 'Test'): TestWarehouse {
  const timestamp = Date.now();
  return {
    code: `WH-${timestamp}`,
    name: `${prefix} Warehouse ${timestamp}`,
    address: 'Test Warehouse Address, City - 123456',
    type: 'WAREHOUSE',
    contactPerson: 'Warehouse Manager',
    phone: '9876543210',
  };
}

export interface TestComponentMaster {
  name: string;
  type: 'ATTRIBUTE' | 'SIZE' | 'COLOR';
  category: string;
  values: string[];
}

export function generateTestComponentMaster(type: string = 'SIZE'): TestComponentMaster {
  const timestamp = Date.now();
  const valuesByType: Record<string, string[]> = {
    SIZE: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    COLOR: ['Red', 'Blue', 'Green', 'Black', 'White'],
    FIT: ['Regular', 'Slim', 'Relaxed'],
    SLEEVE: ['Full', 'Half', 'Sleeveless'],
  };

  return {
    name: `Component ${type} ${timestamp}`,
    type: 'ATTRIBUTE',
    category: type,
    values: valuesByType[type] || ['Value1', 'Value2', 'Value3'],
  };
}

// ============================================
// LEVEL 1 ENTITIES - Basic Dependencies
// ============================================

export interface TestCustomer {
  code: string;
  name: string;
  type: 'BUYER';
  category: 'DOMESTIC' | 'EXPORT' | 'LOCAL';
  businessType: 'B2B' | 'B2C';
  market: 'INTERNATIONAL' | 'DOMESTIC';
  contactPerson: string;
  email: string;
  phone: string;
  billingAddress: string;
  shippingAddress?: string;
  gstNumber?: string;
  creditLimit?: number;
  creditDays?: number;
}

export function generateTestCustomer(prefix: string = 'Test'): TestCustomer {
  const timestamp = Date.now();
  return {
    code: `CUST-${timestamp}`,
    name: `${prefix} Customer ${timestamp}`,
    type: 'BUYER',
    category: 'DOMESTIC',
    businessType: 'B2B',
    market: 'DOMESTIC',
    contactPerson: 'John Doe',
    email: `customer${timestamp}@test.com`,
    phone: '9876543210',
    billingAddress: '123 Test Street, Test City, Test State - 123456',
    shippingAddress: '456 Ship Street, Ship City, Ship State - 654321',
    gstNumber: '22AAAAA0000A1Z5',
    creditLimit: 100000,
    creditDays: 30,
  };
}

export interface TestSupplier {
  code: string;
  name: string;
  supplierCategory: 'FABRIC' | 'TRIM' | 'PACKAGING' | 'OTHER';
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  gstNumber?: string;
  paymentTerms?: string;
  creditLimit?: number;
  creditDays?: number;
}

export function generateTestSupplier(prefix: string = 'Test'): TestSupplier {
  const timestamp = Date.now();
  return {
    code: `SUP-${timestamp}`,
    name: `${prefix} Supplier ${timestamp}`,
    supplierCategory: 'FABRIC',
    contactPerson: 'Jane Smith',
    email: `supplier${timestamp}@test.com`,
    phone: '9876543211',
    address: '789 Supplier Lane, Supply City, Supply State - 789012',
    gstNumber: '29BBBBB0000B1Z6',
    paymentTerms: 'Net 30 days',
    creditLimit: 500000,
    creditDays: 45,
  };
}

export interface TestMaterial {
  code: string;
  name: string;
  unit: 'METER' | 'KG' | 'PCS' | 'YARD' | 'GRAM';
  materialType: 'GENERIC' | 'GREIGE_FABRIC' | 'FINISHED_FABRIC' | 'LACE' | 'BUTTON' | 'THREAD' | 'ZIPPER' | 'ELASTIC' | 'LABEL' | 'PACKAGING';
  description?: string;
  specifications?: string;
  costPrice?: number;
  reorderLevel?: number;
}

export function generateTestMaterial(
  prefix: string = 'Test',
  type: TestMaterial['materialType'] = 'GENERIC'
): TestMaterial {
  const timestamp = Date.now();
  return {
    code: `MAT-${type.substring(0, 3)}-${timestamp}`,
    name: `${prefix} Material ${timestamp}`,
    unit: 'METER',
    materialType: type,
    description: 'Test material for E2E testing',
    specifications: 'Width: 60 inches, Weight: 200 GSM',
    costPrice: 150.5,
    reorderLevel: 100,
  };
}

// ============================================
// LEVEL 2 ENTITIES - Intermediate Dependencies
// ============================================

export interface TestStyle {
  styleCode: string;
  styleName: string;
  customerId: string;
  category: 'TOP' | 'BOTTOM' | 'DRESS' | 'OUTERWEAR' | 'ACCESSORY';
  season: string;
  year?: number;
  status: 'DRAFT' | 'ACTIVE' | 'DISCONTINUED';
  description?: string;
  fabricComposition?: string;
  careInstructions?: string;
}

export function generateTestStyle(prefix: string = 'Test', customerId: string): TestStyle {
  const timestamp = Date.now();
  const year = new Date().getFullYear();
  return {
    styleCode: `STY-${timestamp}`,
    styleName: `${prefix} Style ${timestamp}`,
    customerId,
    category: 'TOP',
    season: 'SS' + String(year).slice(-2),
    year,
    status: 'ACTIVE',
    description: 'Test style for E2E testing',
    fabricComposition: '100% Cotton',
    careInstructions: 'Machine wash cold',
  };
}

export interface TestFabric {
  code: string;
  name: string;
  fabricType: 'WOVEN' | 'KNIT' | 'NON_WOVEN';
  composition: string;
  width: number;
  weight: number;
  supplierId?: string;
  costPrice: number;
  color?: string;
}

export function generateTestFabric(prefix: string = 'Test', supplierId?: string): TestFabric {
  const timestamp = Date.now();
  return {
    code: `FAB-${timestamp}`,
    name: `${prefix} Fabric ${timestamp}`,
    fabricType: 'WOVEN',
    composition: '100% Cotton',
    width: 60,
    weight: 200,
    supplierId,
    costPrice: 350,
    color: 'White',
  };
}

export interface TestGreige {
  code: string;
  name: string;
  fabricType: 'WOVEN' | 'KNIT';
  composition: string;
  width: number;
  weight: number;
  supplierId?: string;
  costPrice: number;
}

export function generateTestGreige(prefix: string = 'Test', supplierId?: string): TestGreige {
  const timestamp = Date.now();
  return {
    code: `GRG-${timestamp}`,
    name: `${prefix} Greige ${timestamp}`,
    fabricType: 'WOVEN',
    composition: '100% Cotton',
    width: 60,
    weight: 180,
    supplierId,
    costPrice: 200,
  };
}

export interface TestPurchaseOrder {
  poNumber: string;
  supplierId: string;
  orderDate: string;
  expectedDeliveryDate: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'COMPLETED' | 'CANCELLED';
  items: {
    materialId: string;
    quantity: number;
    unitPrice: number;
    unit: string;
  }[];
  remarks?: string;
}

export function generateTestPurchaseOrder(
  prefix: string = 'Test',
  supplierId: string,
  materials: { id: string; price: number }[]
): TestPurchaseOrder {
  const timestamp = Date.now();
  const orderDate = new Date();
  const deliveryDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

  return {
    poNumber: `PO-${timestamp}`,
    supplierId,
    orderDate: orderDate.toISOString().split('T')[0],
    expectedDeliveryDate: deliveryDate.toISOString().split('T')[0],
    status: 'PENDING',
    items: materials.map((m) => ({
      materialId: m.id,
      quantity: 1000,
      unitPrice: m.price,
      unit: 'METER',
    })),
    remarks: `${prefix} test purchase order`,
  };
}

// ============================================
// LEVEL 3 ENTITIES - Complex Dependencies
// ============================================

export interface TestBOM {
  styleId: string;
  version: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  items: {
    materialId: string;
    quantity: number;
    unit: string;
    wastagePercent?: number;
    costPerUnit?: number;
  }[];
}

export function generateTestBOM(
  styleId: string,
  materials: { id: string; quantity: number; costPerUnit: number }[]
): TestBOM {
  return {
    styleId,
    version: '1.0',
    status: 'DRAFT',
    items: materials.map((m) => ({
      materialId: m.id,
      quantity: m.quantity,
      unit: 'METER',
      wastagePercent: 5,
      costPerUnit: m.costPerUnit,
    })),
  };
}

export interface TestOrder {
  orderNumber: string;
  customerId: string;
  orderDate: string;
  expectedDeliveryDate: string;
  status: 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  items: {
    styleId: string;
    itemDescription?: string;
    totalQuantity: number;
    unitPrice: number;
    deliveryDate?: string;
  }[];
  remarks?: string;
}

export function generateTestOrder(
  prefix: string = 'Test',
  customerId: string,
  styles: { id: string; name: string; quantity: number; price: number }[]
): TestOrder {
  const timestamp = Date.now();
  const orderDate = new Date();
  const deliveryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return {
    orderNumber: `ORD-${timestamp}`,
    customerId,
    orderDate: orderDate.toISOString().split('T')[0],
    expectedDeliveryDate: deliveryDate.toISOString().split('T')[0],
    status: 'PENDING',
    priority: 'MEDIUM',
    items: styles.map((s) => ({
      styleId: s.id,
      itemDescription: s.name,
      totalQuantity: s.quantity,
      unitPrice: s.price,
      deliveryDate: deliveryDate.toISOString().split('T')[0],
    })),
    remarks: `${prefix} test order`,
  };
}

export interface TestGRN {
  grnNumber: string;
  purchaseOrderId: string;
  supplierId: string;
  receivedDate: string;
  status: 'PENDING' | 'PARTIAL' | 'COMPLETED';
  items: {
    purchaseOrderItemId: string;
    receivedQuantity: number;
    acceptedQuantity: number;
    rejectedQuantity: number;
    remarks?: string;
  }[];
}

export function generateTestGRN(
  purchaseOrderId: string,
  supplierId: string,
  poItems: { id: string; orderedQuantity: number }[]
): TestGRN {
  const timestamp = Date.now();
  const receivedDate = new Date();

  return {
    grnNumber: `GRN-${timestamp}`,
    purchaseOrderId,
    supplierId,
    receivedDate: receivedDate.toISOString().split('T')[0],
    status: 'PENDING',
    items: poItems.map((item) => ({
      purchaseOrderItemId: item.id,
      receivedQuantity: item.orderedQuantity,
      acceptedQuantity: item.orderedQuantity,
      rejectedQuantity: 0,
    })),
  };
}

export interface TestCostSheet {
  styleId: string;
  bomId: string;
  version: string;
  targetCost: number;
  actualCost?: number;
  components: {
    description: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
  }[];
}

export function generateTestCostSheet(
  styleId: string,
  bomId: string,
  materials: { name: string; quantity: number; costPerUnit: number }[]
): TestCostSheet {
  const components = materials.map((m) => ({
    description: m.name,
    quantity: m.quantity,
    unitCost: m.costPerUnit,
    totalCost: m.quantity * m.costPerUnit,
  }));

  const totalCost = components.reduce((sum, c) => sum + c.totalCost, 0);

  return {
    styleId,
    bomId,
    version: '1.0',
    targetCost: totalCost * 1.1, // 10% margin
    actualCost: totalCost,
    components,
  };
}

// ============================================
// LEVEL 4 ENTITIES - Highest Level Dependencies
// ============================================

export interface TestWorkOrder {
  workOrderNumber: string;
  orderId: string;
  orderItemId?: string;
  locationId: string;
  startDate: string;
  expectedCompletionDate: string;
  status: 'DRAFT' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  quantity: number;
  remarks?: string;
}

export function generateTestWorkOrder(
  orderId: string,
  locationId: string,
  quantity: number,
  orderItemId?: string
): TestWorkOrder {
  const timestamp = Date.now();
  const startDate = new Date();
  const completionDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  return {
    workOrderNumber: `WO-${timestamp}`,
    orderId,
    orderItemId,
    locationId,
    startDate: startDate.toISOString().split('T')[0],
    expectedCompletionDate: completionDate.toISOString().split('T')[0],
    status: 'PENDING',
    quantity,
    remarks: 'Test work order',
  };
}

export interface TestStockMovement {
  materialId: string;
  warehouseId: string;
  movementType: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';
  quantity: number;
  unit: string;
  reference?: string;
  remarks?: string;
}

export function generateTestStockMovement(
  materialId: string,
  warehouseId: string,
  type: TestStockMovement['movementType'] = 'IN',
  quantity: number = 100
): TestStockMovement {
  const timestamp = Date.now();
  return {
    materialId,
    warehouseId,
    movementType: type,
    quantity,
    unit: 'METER',
    reference: `REF-${timestamp}`,
    remarks: `Test stock ${type.toLowerCase()} movement`,
  };
}

// ============================================
// SPECIALIZED MATERIALS
// ============================================

export interface TestLace {
  code: string;
  name: string;
  width: number;
  pattern: string;
  color: string;
  costPrice: number;
}

export function generateTestLace(prefix: string = 'Test'): TestLace {
  const timestamp = Date.now();
  return {
    code: `LACE-${timestamp}`,
    name: `${prefix} Lace ${timestamp}`,
    width: 2.5,
    pattern: 'Floral',
    color: 'White',
    costPrice: 50,
  };
}

export interface TestButton {
  code: string;
  name: string;
  size: number;
  holes: number;
  material: string;
  color: string;
  costPrice: number;
}

export function generateTestButton(prefix: string = 'Test'): TestButton {
  const timestamp = Date.now();
  return {
    code: `BTN-${timestamp}`,
    name: `${prefix} Button ${timestamp}`,
    size: 15,
    holes: 4,
    material: 'Plastic',
    color: 'Black',
    costPrice: 2,
  };
}

export interface TestThread {
  code: string;
  name: string;
  color: string;
  type: 'SEWING' | 'EMBROIDERY';
  weight: number;
  costPrice: number;
}

export function generateTestThread(prefix: string = 'Test'): TestThread {
  const timestamp = Date.now();
  return {
    code: `THR-${timestamp}`,
    name: `${prefix} Thread ${timestamp}`,
    color: 'Black',
    type: 'SEWING',
    weight: 40,
    costPrice: 25,
  };
}

export interface TestZipper {
  code: string;
  name: string;
  length: number;
  type: 'METAL' | 'NYLON' | 'INVISIBLE';
  color: string;
  costPrice: number;
}

export function generateTestZipper(prefix: string = 'Test'): TestZipper {
  const timestamp = Date.now();
  return {
    code: `ZIP-${timestamp}`,
    name: `${prefix} Zipper ${timestamp}`,
    length: 20,
    type: 'NYLON',
    color: 'Black',
    costPrice: 15,
  };
}

export interface TestElastic {
  code: string;
  name: string;
  width: number;
  type: 'WOVEN' | 'BRAIDED' | 'KNIT';
  color: string;
  costPrice: number;
}

export function generateTestElastic(prefix: string = 'Test'): TestElastic {
  const timestamp = Date.now();
  return {
    code: `ELS-${timestamp}`,
    name: `${prefix} Elastic ${timestamp}`,
    width: 25,
    type: 'WOVEN',
    color: 'White',
    costPrice: 30,
  };
}

export interface TestLabel {
  code: string;
  name: string;
  type: 'WOVEN' | 'PRINTED' | 'HEAT_TRANSFER';
  size: string;
  content: string;
  costPrice: number;
}

export function generateTestLabel(prefix: string = 'Test'): TestLabel {
  const timestamp = Date.now();
  return {
    code: `LBL-${timestamp}`,
    name: `${prefix} Label ${timestamp}`,
    type: 'WOVEN',
    size: 'M',
    content: 'Made in India',
    costPrice: 5,
  };
}

export interface TestPackaging {
  code: string;
  name: string;
  type: 'BOX' | 'POLYBAG' | 'HANGER' | 'TAG';
  size: string;
  costPrice: number;
}

export function generateTestPackaging(prefix: string = 'Test'): TestPackaging {
  const timestamp = Date.now();
  return {
    code: `PKG-${timestamp}`,
    name: `${prefix} Packaging ${timestamp}`,
    type: 'POLYBAG',
    size: 'Large',
    costPrice: 10,
  };
}

// ============================================
// BULK DATA GENERATORS
// ============================================

export function generateBulkCustomers(count: number, prefix: string = 'Bulk'): TestCustomer[] {
  return Array.from({ length: count }, (_, i) => generateTestCustomer(`${prefix}${i + 1}`));
}

export function generateBulkSuppliers(count: number, prefix: string = 'Bulk'): TestSupplier[] {
  return Array.from({ length: count }, (_, i) => generateTestSupplier(`${prefix}${i + 1}`));
}

export function generateBulkMaterials(
  count: number,
  prefix: string = 'Bulk',
  type: TestMaterial['materialType'] = 'GENERIC'
): TestMaterial[] {
  return Array.from({ length: count }, (_, i) => generateTestMaterial(`${prefix}${i + 1}`, type));
}

// ============================================
// VALID TEST DATA CONSTANTS
// ============================================

export const VALID_GST_NUMBERS = [
  '22AAAAA0000A1Z5',
  '29BBBBB0000B1Z6',
  '27CCCCC0000C1Z7',
  '33DDDDD0000D1Z8',
];

export const VALID_PHONE_NUMBERS = ['9876543210', '9876543211', '9876543212', '9876543213'];

export const VALID_EMAILS = [
  'test@example.com',
  'customer@kashayafabs.com',
  'supplier@test.com',
  'admin@erp.com',
];

export const MATERIAL_UNITS = ['METER', 'KG', 'PCS', 'YARD', 'GRAM', 'SET', 'DOZEN'] as const;

export const CUSTOMER_CATEGORIES = ['DOMESTIC', 'EXPORT', 'LOCAL'] as const;

export const SUPPLIER_CATEGORIES = ['FABRIC', 'TRIM', 'PACKAGING', 'OTHER'] as const;

export const ORDER_STATUSES = ['PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'CANCELLED'] as const;

export const STYLE_CATEGORIES = ['TOP', 'BOTTOM', 'DRESS', 'OUTERWEAR', 'ACCESSORY'] as const;
