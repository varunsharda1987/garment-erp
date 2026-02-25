/**
 * Designer Dashboard Service
 * API service for designer dashboard functionality
 */

import api from '../lib/api';
import type {
  DashboardData,
  DashboardResponse,
  RecentStyle,
  RecentStylesResponse,
  TeamActivity,
  ActivityResponse,
} from '../types/designerDashboard.types';

export const designerDashboardService = {
  /**
   * Get full dashboard data (stats, recent styles, activity)
   */
  getDashboard: async (): Promise<DashboardData> => {
    const response = await api.get<DashboardResponse>('/designer/dashboard');
    return response.data.data;
  },

  /**
   * Get recent styles for current user
   */
  getMyStyles: async (
    page: number = 1,
    limit: number = 10
  ): Promise<{ styles: RecentStyle[]; total: number; totalPages: number }> => {
    const response = await api.get<RecentStylesResponse>('/designer/my-styles', {
      params: { page, limit },
    });
    return {
      styles: response.data.data,
      total: response.data.pagination?.total || response.data.data.length,
      totalPages: response.data.pagination?.totalPages || 1,
    };
  },

  /**
   * Get team activity
   */
  getActivity: async (limit: number = 20): Promise<TeamActivity[]> => {
    const response = await api.get<ActivityResponse>('/designer/activity', {
      params: { limit },
    });
    return response.data.data;
  },
};

export default designerDashboardService;
