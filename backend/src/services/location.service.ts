/**
 * Location Service
 * Handles CRUD operations for Indian states and cities
 */

import { indian_states, indian_cities, StateType, CityTier } from '@prisma/client';
import prisma from '../config/database';
import { NotFoundError, ValidationError } from '../errors';
import { logDebug, logError } from '../utils/logger';
import { BaseService } from './base.service';

// ============================================
// Types
// ============================================

export interface StateWithCityCount extends indian_states {
  _count?: {
    cities: number;
  };
}

export interface CityWithState extends indian_cities {
  state?: {
    id: string;
    stateName: string;
    stateCode: string;
  };
}

export interface StateFilterOptions {
  stateType?: StateType;
  isActive?: boolean;
  includeCityCount?: boolean;
}

export interface CityFilterOptions {
  stateId?: string;
  tier?: CityTier;
  isActive?: boolean;
  includeState?: boolean;
}

// ============================================
// Location Service Class
// ============================================

class LocationServiceClass extends BaseService<any, any, any> {
  protected readonly modelName = 'indian_states';
  protected readonly entityName = 'State';
  protected get model(): any {
    return this.prisma.indian_states;
  }
  protected buildSearchFilter(): [] {
    return [];
  }

  /**
   * Get all active states with optional filtering
   */
  async getAllStates(options: StateFilterOptions = {}): Promise<StateWithCityCount[]> {
    try {
      const { stateType, isActive = true, includeCityCount = false } = options;

      const states = await prisma.indian_states.findMany({
        where: {
          ...(stateType && { stateType }),
          isActive,
        },
        include: {
          ...(includeCityCount && {
            _count: {
              select: { cities: true },
            },
          }),
        },
        orderBy: { sortOrder: 'asc' },
      });

      logDebug(`Retrieved ${states.length} states`, { stateType, isActive, includeCityCount });
      return states;
    } catch (error) {
      logError('Error getting all states:', error);
      throw error;
    }
  }

  /**
   * Get state by ID
   */
  async getStateById(id: string): Promise<indian_states | null> {
    try {
      const state = await prisma.indian_states.findUnique({
        where: { id },
      });

      if (!state) {
        logDebug(`State not found: ${id}`);
        return null;
      }

      return state;
    } catch (error) {
      logError('Error getting state by ID:', error);
      throw error;
    }
  }

  /**
   * Get state by GST code
   */
  async getStateByCode(stateCode: string): Promise<indian_states | null> {
    try {
      const state = await prisma.indian_states.findUnique({
        where: { stateCode },
      });

      if (!state) {
        logDebug(`State not found for code: ${stateCode}`);
        return null;
      }

      logDebug(`Retrieved state: ${state.stateName} (${stateCode})`);
      return state;
    } catch (error) {
      logError('Error getting state by code:', error);
      throw error;
    }
  }

  /**
   * Get cities filtered by state
   */
  async getCitiesByState(stateId: string, options: CityFilterOptions = {}): Promise<CityWithState[]> {
    try {
      const { tier, isActive = true, includeState = false } = options;

      // Verify state exists
      const state = await this.getStateById(stateId);
      if (!state) {
        throw new NotFoundError(`State not found: ${stateId}`);
      }

      const cities = await prisma.indian_cities.findMany({
        where: {
          stateId,
          ...(tier && { tier }),
          isActive,
        },
        include: {
          ...(includeState && {
            state: {
              select: {
                id: true,
                stateName: true,
                stateCode: true,
              },
            },
          }),
        },
        orderBy: [
          { tier: 'asc' }, // TIER_1 first
          { sortOrder: 'asc' },
        ],
      });

      logDebug(`Retrieved ${cities.length} cities for state ${stateId}`, { tier, isActive });
      return cities;
    } catch (error) {
      logError('Error getting cities by state:', error);
      throw error;
    }
  }

  /**
   * Search cities with autocomplete support
   */
  async searchCities(searchTerm: string, stateId?: string): Promise<CityWithState[]> {
    try {
      if (!searchTerm || searchTerm.trim().length < 2) {
        throw new ValidationError('Search term must be at least 2 characters');
      }

      const cities = await prisma.indian_cities.findMany({
        where: {
          cityName: {
            contains: searchTerm.trim(),
            mode: 'insensitive',
          },
          ...(stateId && { stateId }),
          isActive: true,
        },
        include: {
          state: {
            select: {
              id: true,
              stateName: true,
              stateCode: true,
            },
          },
        },
        orderBy: [{ tier: 'asc' }, { cityName: 'asc' }],
        take: 20, // Limit autocomplete results
      });

      logDebug(`Search for "${searchTerm}" returned ${cities.length} cities`, { stateId });
      return cities;
    } catch (error) {
      logError('Error searching cities:', error);
      throw error;
    }
  }

  /**
   * Get city by ID
   */
  async getCityById(id: string): Promise<CityWithState | null> {
    try {
      const city = await prisma.indian_cities.findUnique({
        where: { id },
        include: {
          state: {
            select: {
              id: true,
              stateName: true,
              stateCode: true,
            },
          },
        },
      });

      if (!city) {
        logDebug(`City not found: ${id}`);
        return null;
      }

      return city;
    } catch (error) {
      logError('Error getting city by ID:', error);
      throw error;
    }
  }

  /**
   * Get all cities (with optional filters)
   */
  async getAllCities(options: CityFilterOptions = {}): Promise<CityWithState[]> {
    try {
      const { stateId, tier, isActive = true, includeState = true } = options;

      const cities = await prisma.indian_cities.findMany({
        where: {
          ...(stateId && { stateId }),
          ...(tier && { tier }),
          isActive,
        },
        include: {
          ...(includeState && {
            state: {
              select: {
                id: true,
                stateName: true,
                stateCode: true,
              },
            },
          }),
        },
        orderBy: [{ tier: 'asc' }, { sortOrder: 'asc' }],
      });

      logDebug(`Retrieved ${cities.length} cities`, options);
      return cities;
    } catch (error) {
      logError('Error getting all cities:', error);
      throw error;
    }
  }

  /**
   * Get states grouped by type
   */
  async getStatesGroupedByType(): Promise<{
    states: indian_states[];
    unionTerritories: indian_states[];
  }> {
    try {
      const allStates = await this.getAllStates();

      const states = allStates.filter((s) => s.stateType === 'STATE');
      const unionTerritories = allStates.filter((s) => s.stateType === 'UNION_TERRITORY');

      logDebug(`Grouped states: ${states.length} states, ${unionTerritories.length} UTs`);

      return {
        states,
        unionTerritories,
      };
    } catch (error) {
      logError('Error grouping states by type:', error);
      throw error;
    }
  }

  /**
   * Validate if a state ID exists and is active
   */
  async validateStateId(stateId: string): Promise<boolean> {
    try {
      const state = await prisma.indian_states.findUnique({
        where: { id: stateId },
      });

      return state !== null && state.isActive;
    } catch (error) {
      logError('Error validating state ID:', error);
      return false;
    }
  }

  /**
   * Validate if a city ID exists and is active
   */
  async validateCityId(cityId: string): Promise<boolean> {
    try {
      const city = await prisma.indian_cities.findUnique({
        where: { id: cityId },
      });

      return city !== null && city.isActive;
    } catch (error) {
      logError('Error validating city ID:', error);
      return false;
    }
  }

  /**
   * Get major garment manufacturing cities (Tier 1)
   */
  async getGarmentHubs(): Promise<CityWithState[]> {
    try {
      const hubs = await prisma.indian_cities.findMany({
        where: {
          tier: 'TIER_1',
          isActive: true,
        },
        include: {
          state: {
            select: {
              id: true,
              stateName: true,
              stateCode: true,
            },
          },
        },
        orderBy: {
          sortOrder: 'asc',
        },
      });

      logDebug(`Retrieved ${hubs.length} garment manufacturing hubs`);
      return hubs;
    } catch (error) {
      logError('Error getting garment hubs:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const locationService = new LocationServiceClass();
export default locationService;
