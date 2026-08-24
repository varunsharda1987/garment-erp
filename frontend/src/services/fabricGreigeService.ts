import api from '../lib/api';
import type {
  GreigeMaster,
  FabricMaster,
  FabricWidthCAD,
  GreigeMasterFormData,
  FabricMasterSavePayload,
  FabricWidthCADFormData,
  PaginatedResponse,
  GreigeStatistics,
  FabricStatistics,
  CADStatistics,
  CostComparison,
  FabricStyleAllocationsResponse,
  AllocateToStyleRequest,
  AllocateToStyleResponse,
  RemoveAllocationResponse,
  StyleForAllocation,
  PatternPartForAllocation,
} from '../types/fabric-greige.types';

const API_PREFIX = '/fabric-management';

// ============================================
// GREIGE MASTER SERVICES
// ============================================

export const greigeService = {
  // Get all greige masters with pagination and filters
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    supplierId?: string;
    isActive?: string;
    composition?: string;
    weaveType?: string;
  }): Promise<PaginatedResponse<GreigeMaster>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.supplierId) queryParams.append('supplierId', params.supplierId);
    if (params?.isActive) queryParams.append('isActive', params.isActive);
    if (params?.composition) queryParams.append('composition', params.composition);
    if (params?.weaveType) queryParams.append('weaveType', params.weaveType);

    const url = `${API_PREFIX}/greige${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await api.get<PaginatedResponse<GreigeMaster>>(url);
    return response.data;
  },

  // Get single greige master by ID
  async getById(id: string): Promise<GreigeMaster> {
    const response = await api.get<GreigeMaster>(`${API_PREFIX}/greige/${id}`);
    return response.data;
  },

  // Create new greige master
  async create(data: GreigeMasterFormData): Promise<GreigeMaster> {
    const response = await api.post<GreigeMaster>(`${API_PREFIX}/greige`, data);
    return response.data;
  },

  // Update greige master
  async update(id: string, data: Partial<GreigeMasterFormData>): Promise<GreigeMaster> {
    const response = await api.put<GreigeMaster>(`${API_PREFIX}/greige/${id}`, data);
    return response.data;
  },

  // Delete greige master
  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(`${API_PREFIX}/greige/${id}`);
    return response.data;
  },

  // Get greige statistics
  async getStatistics(): Promise<GreigeStatistics> {
    const response = await api.get<GreigeStatistics>(`${API_PREFIX}/greige/statistics`);
    return response.data;
  },

  // Get processors with available greige stock (for processor return flow)
  async getProcessorsWithStock(): Promise<
    Array<{
      processorId: string;
      processorName: string;
      processorCode: string;
      warehouseName: string | null;
      totalQuantity: number;
      stockEntries: number;
    }>
  > {
    // NOTE: These routes are at /api/greige, not /api/fabric-management/greige
    const response = await api.get<{
      success: boolean;
      data: Array<{
        processorId: string;
        processorName: string;
        processorCode: string;
        warehouseName: string | null;
        totalQuantity: number;
        stockEntries: number;
      }>;
    }>('/greige/processors-with-stock');
    return response.data.data;
  },

  // Get greige stock at a specific processor
  async getProcessorStock(processorId: string): Promise<
    Array<{
      id: string;
      greigeId: string;
      greige: {
        id: string;
        greigeCode: string;
        greigeName: string;
        composition: string;
      };
      quantityAvailable: number;
      greigeWidth: number;
      warehouseLocation: string | null;
      qualityGrade: string;
      receivedDate: string;
    }>
  > {
    // NOTE: These routes are at /api/greige, not /api/fabric-management/greige
    const response = await api.get<{
      success: boolean;
      data: Array<{
        id: string;
        greigeId: string;
        greige: {
          id: string;
          greigeCode: string;
          greigeName: string;
          composition: string;
        };
        quantityAvailable: number;
        greigeWidth: number;
        warehouseLocation: string | null;
        qualityGrade: string;
        receivedDate: string;
      }>;
    }>(`/greige/processor-stock/${processorId}`);
    return response.data.data;
  },
};

// ============================================
// FABRIC MASTER SERVICES
// ============================================

export const fabricService = {
  // Get all fabric masters with pagination and filters
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    greigeId?: string;
    supplierId?: string;
    isActive?: string;
    colorName?: string;
    finishType?: string;
  }): Promise<PaginatedResponse<FabricMaster>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.greigeId) queryParams.append('greigeId', params.greigeId);
    if (params?.supplierId) queryParams.append('supplierId', params.supplierId);
    if (params?.isActive) queryParams.append('isActive', params.isActive);
    if (params?.colorName) queryParams.append('colorName', params.colorName);
    if (params?.finishType) queryParams.append('finishType', params.finishType);

    const url = `${API_PREFIX}/fabric${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await api.get<PaginatedResponse<FabricMaster>>(url);
    return response.data;
  },

  // Get single fabric master by ID
  async getById(id: string): Promise<FabricMaster> {
    const response = await api.get<FabricMaster>(`${API_PREFIX}/fabric/${id}`);
    return response.data;
  },

  // Get fabrics by greige ID
  async getByGreigeId(greigeId: string): Promise<FabricMaster[]> {
    const response = await api.get<FabricMaster[]>(`${API_PREFIX}/fabric/by-greige/${greigeId}`);
    return response.data;
  },

  // Create new fabric master
  async create(data: FabricMasterSavePayload): Promise<FabricMaster> {
    const response = await api.post<FabricMaster>(`${API_PREFIX}/fabric`, data);
    return response.data;
  },

  // Update fabric master
  async update(id: string, data: Partial<FabricMasterSavePayload>): Promise<FabricMaster> {
    const response = await api.put<FabricMaster>(`${API_PREFIX}/fabric/${id}`, data);
    return response.data;
  },

  // Delete fabric master
  async delete(id: string): Promise<{ message: string; deletedCADs: number }> {
    const response = await api.delete<{ message: string; deletedCADs: number }>(`${API_PREFIX}/fabric/${id}`);
    return response.data;
  },

  // Get fabric statistics
  async getStatistics(): Promise<FabricStatistics> {
    const response = await api.get<FabricStatistics>(`${API_PREFIX}/fabric/statistics`);
    return response.data;
  },

  // Get unique generic fabric names for style creation
  async getGenericFabricNames(isActive: boolean = true): Promise<string[]> {
    const response = await api.get<{ data: string[]; count: number }>(
      `${API_PREFIX}/fabric/generic-names?isActive=${isActive}`
    );
    return response.data.data;
  },

  // ============================================
  // FABRIC STYLE ALLOCATION METHODS
  // ============================================

  // Get all style allocations for a fabric
  async getStyleAllocations(fabricId: string): Promise<FabricStyleAllocationsResponse> {
    const response = await api.get<FabricStyleAllocationsResponse>(
      `${API_PREFIX}/fabric/${fabricId}/style-allocations`
    );
    return response.data;
  },

  // Allocate fabric to a style component
  async allocateToStyle(fabricId: string, data: AllocateToStyleRequest): Promise<AllocateToStyleResponse> {
    const response = await api.post<AllocateToStyleResponse>(
      `${API_PREFIX}/fabric/${fabricId}/allocate-to-style`,
      data
    );
    return response.data;
  },

  // Remove a style allocation
  async removeStyleAllocation(fabricId: string, styleFabricId: string): Promise<RemoveAllocationResponse> {
    const response = await api.delete<RemoveAllocationResponse>(
      `${API_PREFIX}/fabric/${fabricId}/style-allocations/${styleFabricId}`
    );
    return response.data;
  },

  // Update pattern parts for an existing allocation (edit mode)
  async updateAllocationPatternParts(fabricId: string, allocationId: string, patternPartIds: string[]): Promise<void> {
    await api.put(`${API_PREFIX}/fabric/${fabricId}/allocations/${allocationId}/pattern-parts`, { patternPartIds });
  },

  // Get styles with components for allocation dropdown
  async getStylesForAllocation(): Promise<StyleForAllocation[]> {
    const response = await api.get<{ data: StyleForAllocation[] }>('/styles?limit=200&isActive=true');
    return response.data.data;
  },

  // Get pattern parts for a component (from component_pattern_parts)
  // Route is GET /components/:componentId/pattern-parts and returns { success, data: [...] },
  // where each element is a component_pattern_parts junction row with a nested `patternPart`.
  // Flatten to the pattern-part identity (id/code/name): the allocation endpoint validates
  // patternPartIds against pattern_part_master, so `id` MUST be the pattern-part id — NOT the
  // junction row id. (The old /component-masters/:id/pattern-parts path 404'd — no such route.)
  async getPatternPartsForComponent(componentMasterId: string): Promise<PatternPartForAllocation[]> {
    const response = await api.get<{
      data: Array<{ patternPart?: { id: string; code: string; name: string } }>;
    }>(`/components/${componentMasterId}/pattern-parts`);
    return (response.data.data || [])
      .map((row) => row.patternPart)
      .filter((pp): pp is { id: string; code: string; name: string } => Boolean(pp))
      .map((pp) => ({ id: pp.id, code: pp.code, name: pp.name }));
  },

  // Get CAD pattern parts for a style component (CAD-defined parts first, then component master parts)
  async getCADPatternPartsForComponent(
    styleId: string,
    componentId: string
  ): Promise<{
    cadPatternParts: PatternPartForAllocation[];
    masterPatternParts: PatternPartForAllocation[];
  }> {
    const response = await api.get<{
      success: boolean;
      data: {
        styleId: string;
        componentId: string;
        componentName: string;
        cadPatternParts: PatternPartForAllocation[];
        masterPatternParts: PatternPartForAllocation[];
      };
    }>(`/cad-planning/${styleId}/components/${componentId}/pattern-parts`);
    return {
      cadPatternParts: response.data.data?.cadPatternParts || [],
      masterPatternParts: response.data.data?.masterPatternParts || [],
    };
  },

  // Get all pattern parts from pattern_part_master (fallback when no CAD/component parts exist)
  async getAllPatternParts(): Promise<PatternPartForAllocation[]> {
    const response = await api.get<{
      success: boolean;
      data: Array<{ id: string; code: string; name: string; isActive: boolean }>;
    }>('/pattern-parts?isActive=true&limit=200');
    const items = response.data.data;
    return items.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
    }));
  },
};

// ============================================
// CAD WIDTH SERVICES
// ============================================

export const cadService = {
  // Get all CAD entries for a fabric
  async getByFabricId(fabricId: string): Promise<FabricWidthCAD[]> {
    const response = await api.get<FabricWidthCAD[]>(`${API_PREFIX}/cad/fabric/${fabricId}`);
    return response.data;
  },

  // Get single CAD entry by ID
  async getById(id: string): Promise<FabricWidthCAD> {
    const response = await api.get<FabricWidthCAD>(`${API_PREFIX}/cad/${id}`);
    return response.data;
  },

  // Create new CAD entry
  async create(data: FabricWidthCADFormData): Promise<FabricWidthCAD> {
    const response = await api.post<FabricWidthCAD>(`${API_PREFIX}/cad`, data);
    return response.data;
  },

  // Update CAD entry
  async update(id: string, data: Partial<FabricWidthCADFormData>): Promise<FabricWidthCAD> {
    const response = await api.put<FabricWidthCAD>(`${API_PREFIX}/cad/${id}`, data);
    return response.data;
  },

  // setPreferred removed (landmine №9): the route is retired — only Fabric Costing's
  // approve flow writes the preferred mark

  // Delete CAD entry
  async delete(id: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(`${API_PREFIX}/cad/${id}`);
    return response.data;
  },

  // Get cost comparison for a fabric
  async getCostComparison(fabricId: string, orderQuantity: number = 1000): Promise<CostComparison> {
    const response = await api.get<CostComparison>(
      `${API_PREFIX}/cad/comparison/${fabricId}?orderQuantity=${orderQuantity}`
    );
    return response.data;
  },

  // Get CAD statistics
  async getStatistics(): Promise<CADStatistics> {
    const response = await api.get<CADStatistics>(`${API_PREFIX}/cad/statistics`);
    return response.data;
  },
};

// Export all services as a single object
export default {
  greige: greigeService,
  fabric: fabricService,
  cad: cadService,
};
