/**
 * Location Types
 * Type definitions for Indian states and cities
 */

export type StateType = 'STATE' | 'UNION_TERRITORY';
export type CityTier = 'TIER_1' | 'TIER_2' | 'TIER_3';

export interface State {
  id: string;
  stateName: string;
  stateCode: string; // 2-digit GST code (e.g., "27" for Maharashtra)
  stateType: StateType;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Optional count from API
  _count?: {
    cities: number;
  };
}

export interface City {
  id: string;
  stateId: string;
  cityName: string;
  tier: CityTier;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Relations (when included)
  state?: {
    id: string;
    stateName: string;
    stateCode: string;
  };
}

// API Response Types
export interface StatesResponse {
  success: boolean;
  data: State[];
  count: number;
}

export interface CitiesResponse {
  success: boolean;
  data: City[];
  count: number;
}

export interface StateGroupedResponse {
  success: boolean;
  data: {
    states: State[];
    unionTerritories: State[];
  };
}

// Filter Options
export interface StateFilterOptions {
  stateType?: StateType;
  isActive?: boolean;
  includeCityCount?: boolean;
  search?: string;
}

export interface CityFilterOptions {
  stateId?: string;
  tier?: CityTier;
  search?: string;
  isActive?: boolean;
  includeState?: boolean;
  isGarmentHub?: boolean;
}

// Extended types
export interface StateWithCityCount extends State {
  _count: {
    cities: number;
  };
}

export interface CityWithState extends City {
  state: {
    id: string;
    stateName: string;
    stateCode: string;
    stateType: StateType;
  };
}
