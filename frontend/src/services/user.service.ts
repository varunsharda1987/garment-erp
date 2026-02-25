import api from '../lib/api';
import type { User, CreateUserData, UpdateUserData, UsersListResponse } from '../types/user.types';

// Re-export types for use in components
export type { User, CreateUserData, UpdateUserData, UsersListResponse };

// User management service
export const userService = {
  // Get all users (paginated)
  getAllUsers: async (page: number = 1, limit: number = 10, search?: string): Promise<UsersListResponse> => {
    let url = `/users?page=${page}&limit=${limit}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    const response = await api.get<UsersListResponse>(url);
    return response.data;
  },

  // Get user by ID
  getUserById: async (id: string): Promise<User> => {
    const response = await api.get<{ data: User }>(`/users/${id}`);
    return response.data.data;
  },

  // Create new user (Admin only)
  createUser: async (data: CreateUserData): Promise<User> => {
    const response = await api.post<{ data: User; message: string }>('/users', data);
    return response.data.data;
  },

  // Update user
  updateUser: async (id: string, data: UpdateUserData): Promise<User> => {
    const response = await api.put<{ data: User; message: string }>(`/users/${id}`, data);
    return response.data.data;
  },

  // Update user role (Admin only)
  updateUserRole: async (id: string, role: string): Promise<User> => {
    const response = await api.put<{ data: User; message: string }>(`/users/${id}/role`, { role });
    return response.data.data;
  },

  // Delete user (Admin only - soft delete)
  deleteUser: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },

  // Permanently delete user (Admin only - hard delete)
  permanentDeleteUser: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}/permanent`);
  },

  // Change password (Self only)
  changePassword: async (id: string, currentPassword: string, newPassword: string): Promise<void> => {
    await api.put(`/users/${id}/change-password`, { currentPassword, newPassword });
  },

  // Get pending users (Admin only)
  getPendingUsers: async (): Promise<{ data: User[]; count: number }> => {
    const response = await api.get<{ data: User[]; count: number }>('/users/pending');
    return response.data;
  },

  // Approve user (Admin only)
  approveUser: async (id: string): Promise<User> => {
    const response = await api.post<{ data: User; message: string }>(`/users/${id}/approve`);
    return response.data.data;
  },

  // Reject user (Admin only)
  rejectUser: async (id: string): Promise<void> => {
    await api.post(`/users/${id}/reject`);
  },
};
