// Customer types
import type { State, City } from './location.types';

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

export const BusinessType = {
  B2B: 'B2B',
  B2C: 'B2C',
} as const;

export type BusinessType = typeof BusinessType[keyof typeof BusinessType];

export const MarketType = {
  INTERNATIONAL: 'INTERNATIONAL',
  DOMESTIC: 'DOMESTIC',
} as const;

export type MarketType = typeof MarketType[keyof typeof MarketType];

export interface BrandCategory {
  id: string;
  customerId: string;
  brandName: string;
  category: string;
  subCategory?: string | null;
  subSubCategory?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerGstNumber {
  id: string;
  customerId: string;
  stateId?: string | null;
  stateName: string;
  stateCode: string;
  gstNumber: string;
  billingAddress?: string | null;
  billingCityId?: string | null;
  billingPincode?: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  // Relations (camelCase due to serializer)
  state?: {
    id: string;
    stateName: string;
    stateCode: string;
    stateType: string;
  } | null;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  billingName?: string | null;
  brandNames?: string | null;
  categories?: string | null;
  type: CustomerType;
  category: CustomerCategory;
  businessType: BusinessType;
  market: MarketType;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  gstNumber?: string | null;
  creditLimit?: number | null;
  creditDays?: number | null;
  // Structured Address Fields
  billingStateId?: string | null;
  billingCityId?: string | null;
  billingPincode?: string | null;
  shippingStateId?: string | null;
  shippingCityId?: string | null;
  shippingPincode?: string | null;
  // Testing Requirements (FPT/GPT)
  requiresFPT?: boolean;
  requiresGPT?: boolean;
  fptBlocksProduction?: boolean;
  gptBlocksShipment?: boolean;
  fptTemplateId?: string | null;
  gptTemplateId?: string | null;
  buyerApprovesFPT?: boolean;
  buyerApprovesGPT?: boolean;
  defaultTestingLabId?: string | null;
  // Relations for testing
  fptTemplate?: { id: string; templateCode: string; templateName: string } | null;
  gptTemplate?: { id: string; templateCode: string; templateName: string } | null;
  defaultLab?: { id: string; labCode: string; labName: string } | null;
  // Location Relations (camelCase due to serializer)
  billingState?: State | null;
  billingCity?: City | null;
  shippingState?: State | null;
  shippingCity?: City | null;
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
  brandCategories?: BrandCategory[];
  customerGstNumbers?: CustomerGstNumber[];
  _count?: {
    orders: number;
    quotations: number;
    invoices: number;
  };
}

export interface BrandCategoryInput {
  brandName: string;
  categories: string[];
}

export interface GstNumberInput {
  stateId?: string; // Optional - will be looked up from stateCode if not provided
  stateName: string;
  stateCode: string;
  gstNumber: string;
  billingAddress?: string;
  billingCityId?: string;
  billingPincode?: string;
  isPrimary: boolean;
}

export type CreateCustomerRequest = {
  code: string;
  name: string;
  billingName?: string;
  brandNames?: string;
  categories?: string;
  type: CustomerType;
  category: CustomerCategory;
  businessType: BusinessType;
  market: MarketType;
  contactPerson?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  shippingAddress?: string;
  gstNumber?: string;
  creditLimit?: number;
  creditDays?: number;
  brandCategories?: BrandCategoryInput[];
  gstNumbers?: GstNumberInput[];
  // Structured Address Fields
  billingStateId?: string;
  billingCityId?: string;
  billingPincode?: string;
  shippingStateId?: string;
  shippingCityId?: string;
  shippingPincode?: string;
  // Testing Requirements (FPT/GPT)
  requiresFPT?: boolean;
  requiresGPT?: boolean;
  fptBlocksProduction?: boolean;
  gptBlocksShipment?: boolean;
  fptTemplateId?: string;
  gptTemplateId?: string;
  buyerApprovesFPT?: boolean;
  buyerApprovesGPT?: boolean;
  defaultTestingLabId?: string;
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
