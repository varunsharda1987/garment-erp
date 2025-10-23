// Supplier types

export interface Supplier {
  id: string;
  code: string;
  name: string;
  materialCategories?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  gstNumber?: string | null;
  paymentTerms?: string | null;
  creditLimit?: number | null;
  creditDays?: number | null;
  rating?: number | null;
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
    materials: number;
    purchaseOrders: number;
    goodsReceivingNotes: number;
  };
}

export type CreateSupplierRequest = {
  code: string;
  name: string;
  materialCategories?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  gstNumber?: string;
  paymentTerms?: string;
  creditLimit?: number;
  creditDays?: number;
  rating?: number;
};

export type UpdateSupplierRequest = Partial<CreateSupplierRequest>;

export interface SupplierListResponse {
  data: Supplier[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SupplierResponse {
  data: Supplier;
  message?: string;
}
