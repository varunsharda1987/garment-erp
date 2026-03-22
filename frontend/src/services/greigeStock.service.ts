// Greige Stock Service - API calls for greige stock
import axios from 'axios';
import type { GreigeStockSummary } from '../types/greigeStock.types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BASE_URL = `${API_URL}/greige`;

const getAuthHeader = () => {
  const authStorage = localStorage.getItem('auth-storage');
  if (authStorage) {
    try {
      const { state } = JSON.parse(authStorage);
      return state?.token ? { Authorization: `Bearer ${state.token}` } : {};
    } catch {
      return {};
    }
  }
  return {};
};

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const greigeStockService = {
  /**
   * Get greige stock summary for unified dashboard
   */
  async getSummary(): Promise<GreigeStockSummary> {
    const response = await axios.get<ApiResponse<GreigeStockSummary>>(`${BASE_URL}/summary`, {
      headers: getAuthHeader(),
    });
    return response.data.data;
  },
};

export default greigeStockService;
