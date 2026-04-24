import api from '../lib/api';
import type { State, City, StateFilterOptions, CityFilterOptions } from '../types/location.types';

const API_BASE = '/locations';

class LocationService {
  /**
   * Get all states with optional filtering
   */
  async getAllStates(options: StateFilterOptions = {}): Promise<State[]> {
    const params = new URLSearchParams();

    if (options.stateType) {
      params.append('stateType', options.stateType);
    }
    if (options.search) {
      params.append('search', options.search);
    }
    if (options.isActive !== undefined) {
      params.append('isActive', options.isActive.toString());
    }

    const url = `${API_BASE}/states${params.toString() ? `?${params.toString()}` : ''}`;
    const { data } = await api.get(url);
    return data.data || [];
  }

  /**
   * Get a single state by its 2-digit GST code
   */
  async getStateByCode(stateCode: string): Promise<State> {
    const { data } = await api.get(`${API_BASE}/states/code/${stateCode}`);
    return data.data;
  }

  /**
   * Get cities with optional filtering
   */
  async getCities(options: CityFilterOptions = {}): Promise<City[]> {
    const params = new URLSearchParams();

    if (options.stateId) {
      params.append('stateId', options.stateId);
    }
    if (options.tier) {
      params.append('tier', options.tier);
    }
    if (options.search) {
      params.append('search', options.search);
    }
    if (options.isGarmentHub !== undefined) {
      params.append('isGarmentHub', options.isGarmentHub.toString());
    }

    const url = `${API_BASE}/cities${params.toString() ? `?${params.toString()}` : ''}`;
    const { data } = await api.get(url);
    return data.data || [];
  }

  /**
   * Get cities for a specific state
   */
  async getCitiesByState(stateId: string, options: Omit<CityFilterOptions, 'stateId'> = {}): Promise<City[]> {
    return this.getCities({ ...options, stateId });
  }

  /**
   * Search cities by name
   */
  async searchCities(searchTerm: string, stateId?: string): Promise<City[]> {
    return this.getCities({ search: searchTerm, stateId });
  }

  /**
   * Get all garment manufacturing hubs
   */
  async getGarmentHubs(): Promise<City[]> {
    const { data } = await api.get(`${API_BASE}/cities/hubs`);
    return data.data || [];
  }

  /**
   * Validate if a state ID exists
   */
  async validateStateId(stateId: string): Promise<boolean> {
    try {
      const { data } = await api.get(`${API_BASE}/validate/state/${stateId}`);
      return data.data?.isValid ?? false;
    } catch {
      return false;
    }
  }
}

export const locationService = new LocationService();
