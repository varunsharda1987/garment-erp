/**
 * Schema Index
 *
 * Exports all validation schemas from a single entry point.
 */

// Auth schemas
export { loginSchema, registerSchema, type LoginInput, type RegisterInput } from './auth.schema';

// Customer schemas
export {
  createCustomerSchema,
  updateCustomerSchema,
  customerQuerySchema,
  type CreateCustomerInput,
  type UpdateCustomerInput,
  type CustomerQueryInput,
} from './customer.schema';

// Supplier schemas
export {
  createSupplierSchema,
  updateSupplierSchema,
  supplierQuerySchema,
  type CreateSupplierInput,
  type UpdateSupplierInput,
  type SupplierQueryInput,
} from './supplier.schema';

// Style schemas
export {
  createStyleSchema,
  updateStyleSchema,
  styleQuerySchema,
  type CreateStyleInput,
  type UpdateStyleInput,
  type StyleQueryInput,
} from './style.schema';

// Material schemas
export {
  createMaterialSchema,
  updateMaterialSchema,
  materialQuerySchema,
  type CreateMaterialInput,
  type UpdateMaterialInput,
  type MaterialQueryInput,
} from './material.schema';

// Order schemas
export {
  createOrderSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
  orderQuerySchema,
  OrderStatus,
  type CreateOrderInput,
  type UpdateOrderInput,
  type UpdateOrderStatusInput,
  type OrderQueryInput,
} from './order.schema';

// BOM schemas
export {
  createBOMSchema,
  updateBOMSchema,
  updateBOMStatusSchema,
  cloneBOMSchema,
  bomQuerySchema,
  BOMStatus,
  type CreateBOMInput,
  type UpdateBOMInput,
  type UpdateBOMStatusInput,
  type CloneBOMInput,
  type BOMQueryInput,
} from './bom.schema';

// Stock schemas
export {
  createStockMovementSchema,
  stockAdjustmentSchema,
  stockTransferSchema,
  createStockCountSchema,
  updateStockCountSchema,
  stockQuerySchema,
  movementQuerySchema,
  MovementType,
  CountStatus,
  type CreateStockMovementInput,
  type StockAdjustmentInput,
  type StockTransferInput,
  type CreateStockCountInput,
  type UpdateStockCountInput,
  type StockQueryInput,
  type MovementQueryInput,
} from './stock.schema';

// Fabric schemas - NOTE: Use fabricGreige.schema.ts instead (fabric.schema.ts is DEPRECATED)
// The active fabric/greige schemas are in fabricGreige.schema.ts and used by fabric-greige.routes.ts
// fabric.schema.ts is stale and should not be used for new code
