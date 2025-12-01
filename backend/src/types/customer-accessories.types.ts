// Customer Accessories Types
// Related to pre-defined garment and packaging accessories for customers

export enum AccessoryType {
  GARMENT = 'GARMENT',
  PACKAGING = 'PACKAGING',
}

export interface CustomerAccessory {
  id: string;
  customerId: string;
  accessoryType: AccessoryType;
  itemName: string;
  itemCategory?: string;
  specification?: string;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerAccessoryDTO {
  customerId: string;
  accessoryType: AccessoryType;
  itemName: string;
  itemCategory?: string;
  specification?: string;
  isDefault?: boolean;
  sortOrder?: number;
}

export interface UpdateCustomerAccessoryDTO {
  itemName?: string;
  itemCategory?: string;
  specification?: string;
  isDefault?: boolean;
  sortOrder?: number;
}

export interface CustomerAccessoriesResponse {
  data: CustomerAccessory[];
  total: number;
}

export interface BulkSetDefaultAccessoriesDTO {
  accessoryIds: string[];
}
