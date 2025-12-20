import api from '../lib/api';

/**
 * Master Data Service
 * Provides unified access to all master data types summary
 */

export interface MasterType {
  type: string;
  label: string;
  count: number;
  active: number;
  route: string;
}

export interface MasterCategory {
  category: string;
  totalCount: number;
  activeCount: number;
  masters: MasterType[];
}

export interface MasterDataSummary {
  fabricsRawMaterials: MasterCategory;
  otherMaterials: MasterCategory;
  fastenersClosures: MasterCategory;
  threadsTapes: MasterCategory;
  decorative: MasterCategory;
  packagingLabels: MasterCategory;
  functional: MasterCategory;
}

export interface MasterDataResponse {
  success: boolean;
  data: {
    summary: MasterDataSummary;
    totals: {
      totalItems: number;
      activeItems: number;
      categories: number;
    };
  };
}

class MasterDataService {
  /**
   * Get summary of all master data types with counts
   */
  async getSummary(): Promise<MasterDataResponse> {
    const response = await api.get('/master-data/summary');
    return response.data;
  }
}

export const masterDataService = new MasterDataService();
export default masterDataService;
