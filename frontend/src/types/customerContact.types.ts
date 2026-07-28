// Customer Contact (Buyer) types

export interface CustomerContact {
  id: string;
  customerId: string;
  name: string;
  designation?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  isPrimary: boolean;
  isActive: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  // Relations (camelCase due to serializer)
  customer?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export interface CreateCustomerContactRequest {
  customerId: string;
  name: string;
  designation?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  isPrimary?: boolean;
  isActive?: boolean;
  notes?: string | null;
}

export interface UpdateCustomerContactRequest {
  name?: string;
  designation?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  isPrimary?: boolean;
  isActive?: boolean;
  notes?: string | null;
}
