// Auth-related TypeScript types

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string | null;
  createdAt?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
}

// Response when registration is pending approval (no token)
export interface PendingRegistrationResponse {
  message: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    isApproved: boolean;
  };
}
