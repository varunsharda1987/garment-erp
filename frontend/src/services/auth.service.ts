import api from '../lib/api';
import type { User, AuthResponse, LoginData, RegisterData, PendingRegistrationResponse } from '../types/auth.types';

// Re-export types for use in components
export type { User, AuthResponse, LoginData, RegisterData, PendingRegistrationResponse };

// Response types for new endpoints
export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
}

// Auth service
export const authService = {
  // Login user
  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', data);
    return response.data;
  },

  // Register user (returns pending response - no token)
  register: async (data: RegisterData): Promise<PendingRegistrationResponse> => {
    const response = await api.post<PendingRegistrationResponse>('/auth/register', data);
    return response.data;
  },

  // Get current user
  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<User>('/auth/me');
    return response.data;
  },

  // Refresh access token using refresh token (BUG-AUTH6)
  refreshToken: async (refreshToken: string): Promise<RefreshTokenResponse> => {
    const response = await api.post<RefreshTokenResponse>('/auth/refresh', { refreshToken });
    return response.data;
  },

  // Logout - revoke refresh token
  logout: async (refreshToken?: string): Promise<void> => {
    await api.post('/auth/logout', { refreshToken });
  },

  // Logout from all devices
  logoutAll: async (): Promise<void> => {
    await api.post('/auth/logout-all');
  },
};
