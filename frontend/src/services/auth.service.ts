import api from '../lib/api';
import type { User, AuthResponse, LoginData, RegisterData } from '../types/auth.types';

// Re-export types for use in components
export type { User, AuthResponse, LoginData, RegisterData };

// Auth service
export const authService = {
  // Login user
  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  // Register user
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', data);
    return response.data;
  },

  // Get current user
  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },
};
