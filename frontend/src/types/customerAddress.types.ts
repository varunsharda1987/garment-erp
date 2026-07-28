// Customer Address types

export const CustomerAddressType = {
  SHIP_TO: 'SHIP_TO',
  COURIER: 'COURIER',
  OFFICE: 'OFFICE',
} as const;

export type CustomerAddressType = (typeof CustomerAddressType)[keyof typeof CustomerAddressType];

export const CustomerAddressTypeLabels: Record<CustomerAddressType, string> = {
  SHIP_TO: 'Ship To',
  COURIER: 'Courier',
  OFFICE: 'Office',
};

export interface CustomerAddress {
  id: string;
  customerId: string;
  label: string;
  addressType: CustomerAddressType;
  addressLine1: string;
  addressLine2?: string | null;
  landmark?: string | null;
  stateId?: string | null;
  cityId?: string | null;
  pincode: string;
  country: string;
  contactPerson?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Relations (camelCase due to serializer)
  state?: {
    id: string;
    stateName: string;
    stateCode: string;
  } | null;
  city?: {
    id: string;
    cityName: string;
    tier: string;
  } | null;
  customer?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export interface CreateCustomerAddressRequest {
  customerId: string;
  label: string;
  addressType: CustomerAddressType;
  addressLine1: string;
  addressLine2?: string | null;
  landmark?: string | null;
  stateId?: string | null;
  cityId?: string | null;
  pincode: string;
  country?: string;
  contactPerson?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  isPrimary?: boolean;
  isActive?: boolean;
}

export interface UpdateCustomerAddressRequest {
  label?: string;
  addressType?: CustomerAddressType;
  addressLine1?: string;
  addressLine2?: string | null;
  landmark?: string | null;
  stateId?: string | null;
  cityId?: string | null;
  pincode?: string;
  country?: string;
  contactPerson?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  isPrimary?: boolean;
  isActive?: boolean;
}
