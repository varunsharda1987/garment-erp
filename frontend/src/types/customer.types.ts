// Customer types

export const CustomerType = {
  BUYER: 'BUYER',
} as const;

export type CustomerType = typeof CustomerType[keyof typeof CustomerType];

export const CustomerCategory = {
  DOMESTIC: 'DOMESTIC',
  EXPORT: 'EXPORT',
  LOCAL: 'LOCAL',
} as const;

export type CustomerCategory = typeof CustomerCategory[keyof typeof CustomerCategory];

export interface Customer {
  id: string;
  code: string;
  name: string;
  brandNames?: string | null;
  categories?: string | null;
  type: CustomerType;
  category: CustomerCategory;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  gstNumber?: string | null;
  creditLimit?: number | null;
  creditDays?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  _count?: {
    orders: number;
    quotations: number;
    invoices: number;
  };
}

export type CreateCustomerRequest = {
  code: string;
  name: string;
  brandNames?: string;
  categories?: string;
  type: CustomerType;
  category: CustomerCategory;
  contactPerson?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  shippingAddress?: string;
  gstNumber?: string;
  creditLimit?: number;
  creditDays?: number;
};

export type UpdateCustomerRequest = Partial<CreateCustomerRequest>;

export interface CustomerListResponse {
  data: Customer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CustomerResponse {
  data: Customer;
  message?: string;
}
