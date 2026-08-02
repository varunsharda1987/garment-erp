// Authentication related types
import { UserRole } from '@prisma/client';

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    name: string; // computed display name (backward compatibility)
    role: UserRole;
  };
  token: string;
}

export interface JWTPayload {
  userId: string;
  /** Alias for userId - both are available for convenience */
  id: string;
  email: string;
  role: UserRole;
}

// Extend Express Request type to include user and validated data
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      validatedQuery?: Record<string, unknown>;
      validatedParams?: Record<string, unknown>;
    }
  }
}
