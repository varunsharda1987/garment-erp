// User type (from backend)
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: UserRole;
  department: string | null;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

// User roles (matches backend)
export const UserRole = {
  ADMIN: 'ADMIN',
  MERCHANDISER: 'MERCHANDISER',
  PRODUCTION_MANAGER: 'PRODUCTION_MANAGER',
  SALES: 'SALES',
  INVENTORY: 'INVENTORY',
  ACCOUNTS: 'ACCOUNTS',
  QUALITY: 'QUALITY',
  PURCHASE: 'PURCHASE',
  FACTORY_SUPERVISOR: 'FACTORY_SUPERVISOR',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// Create user data
export interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  department?: string;
}

// Update user data
export interface UpdateUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  department?: string | null;
  password?: string;
  isActive?: boolean;
}

// Users list response with pagination
export interface UsersListResponse {
  data: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
