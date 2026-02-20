/**
 * Order BOM Service
 * Frontend API service for Order-level BOM management
 *
 * Order BOM is created after Cost Sheet approval and contains
 * order-specific quantities and prices for MRP & Production.
 */

import api from '@/lib/api';
import type {
  OrderBOM,
  OrderBOMResponse,
  OrderBOMListResponse,
  OrderBOMFilters,
  CreateOrderBOMFromCostSheetRequest,
  CopyOrderBOMRequest,
  UpdateOrderBOMRequest,
  OrderBOMRequirementsResponse,
  OrderBOMRequirementsSummary,
  ChangeWidthRequest,
  FabricCadOption,
} from '@/types/orderBom.types';

// ============================================
// ORDER-LEVEL BOM OPERATIONS
// ============================================

/**
 * Create Order BOM from approved Cost Sheet
 * POST /api/orders/:orderId/bom
 */
export async function createFromCostSheet(
  orderId: string,
  data: CreateOrderBOMFromCostSheetRequest
): Promise<OrderBOM> {
  const response = await api.post<OrderBOMResponse>(`/orders/${orderId}/bom`, data);
  return response.data.data;
}

/**
 * Get Order BOM for an order
 * GET /api/orders/:orderId/bom
 */
export async function getByOrderId(
  orderId: string,
  styleId?: string
): Promise<OrderBOM | null> {
  const params = new URLSearchParams();
  if (styleId) params.append('styleId', styleId);

  try {
    const response = await api.get<OrderBOMResponse>(
      `/orders/${orderId}/bom?${params.toString()}`
    );
    return response.data.data;
  } catch (error: unknown) {
    // Return null if not found (404)
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as { response?: { status?: number } };
      if (axiosError.response?.status === 404) {
        return null;
      }
    }
    throw error;
  }
}

/**
 * Update Order BOM items (only DRAFT status)
 * PUT /api/orders/:orderId/bom
 */
export async function updateOrderBOM(
  orderId: string,
  data: UpdateOrderBOMRequest,
  styleId?: string
): Promise<OrderBOM> {
  const params = new URLSearchParams();
  if (styleId) params.append('styleId', styleId);

  const response = await api.put<OrderBOMResponse>(
    `/orders/${orderId}/bom?${params.toString()}`,
    data
  );
  return response.data.data;
}

/**
 * Approve Order BOM
 * PATCH /api/orders/:orderId/bom/approve
 */
export async function approveOrderBOM(
  orderId: string,
  styleId?: string
): Promise<OrderBOM> {
  const params = new URLSearchParams();
  if (styleId) params.append('styleId', styleId);

  const response = await api.patch<OrderBOMResponse>(
    `/orders/${orderId}/bom/approve?${params.toString()}`
  );
  return response.data.data;
}

/**
 * Approve Order BOM and optionally calculate MRP
 * POST /api/orders/:orderId/bom/approve-and-calculate
 */
export async function approveAndCalculateMRP(
  orderId: string,
  data: {
    styleId: string;
    calculateMRP?: boolean;
    requiredDate?: Date | string;
  }
): Promise<{
  bom: OrderBOM;
  mrp: { created: number; updated: number; requirements: unknown[] } | null;
  mrpCalculated: boolean;
  mrpError: string | null;
}> {
  const response = await api.post<{
    success: boolean;
    data: {
      bom: OrderBOM;
      mrp: { created: number; updated: number; requirements: unknown[] } | null;
      mrpCalculated: boolean;
      mrpError: string | null;
    };
    message: string;
  }>(`/orders/${orderId}/bom/approve-and-calculate`, data);
  return response.data.data;
}

/**
 * Calculate MRP for approved Order BOM (standalone trigger)
 * POST /api/orders/:orderId/bom/calculate-mrp
 */
export async function calculateMRPStandalone(
  orderId: string,
  data: {
    styleId: string;
    requiredDate?: Date | string;
  }
): Promise<{
  created: number;
  updated: number;
  requirements: unknown[];
}> {
  const response = await api.post<{
    success: boolean;
    data: {
      created: number;
      updated: number;
      requirements: unknown[];
    };
    message: string;
  }>(`/orders/${orderId}/bom/calculate-mrp`, data);
  return response.data.data;
}

/**
 * Lock Order BOM for production
 * PATCH /api/orders/:orderId/bom/lock
 */
export async function lockOrderBOM(
  orderId: string,
  styleId?: string
): Promise<OrderBOM> {
  const params = new URLSearchParams();
  if (styleId) params.append('styleId', styleId);

  const response = await api.patch<OrderBOMResponse>(
    `/orders/${orderId}/bom/lock?${params.toString()}`
  );
  return response.data.data;
}

/**
 * Copy Order BOM from previous order (repeat orders)
 * POST /api/orders/:orderId/bom/copy/:sourceOrderId
 */
export async function copyFromPreviousOrder(
  targetOrderId: string,
  sourceOrderId: string,
  data: CopyOrderBOMRequest
): Promise<OrderBOM> {
  const response = await api.post<OrderBOMResponse>(
    `/orders/${targetOrderId}/bom/copy/${sourceOrderId}`,
    data
  );
  return response.data.data;
}

/**
 * Calculate material requirements from Order BOM
 * GET /api/orders/:orderId/bom/requirements
 */
export async function calculateRequirements(
  orderId: string,
  styleId?: string
): Promise<OrderBOMRequirementsSummary> {
  const params = new URLSearchParams();
  if (styleId) params.append('styleId', styleId);

  const response = await api.get<OrderBOMRequirementsResponse>(
    `/orders/${orderId}/bom/requirements?${params.toString()}`
  );
  return response.data.data;
}

/**
 * Deactivate Order BOM
 * DELETE /api/orders/:orderId/bom
 */
export async function deactivateOrderBOM(
  orderId: string,
  styleId?: string
): Promise<void> {
  const params = new URLSearchParams();
  if (styleId) params.append('styleId', styleId);

  await api.delete(`/orders/${orderId}/bom?${params.toString()}`);
}

// ============================================
// STANDALONE ORDER BOM OPERATIONS
// ============================================

/**
 * List all Order BOMs with filtering
 * GET /api/order-bom
 */
export async function listOrderBOMs(filters?: OrderBOMFilters): Promise<OrderBOMListResponse> {
  const params = new URLSearchParams();

  if (filters) {
    if (filters.orderId) params.append('orderId', filters.orderId);
    if (filters.styleId) params.append('styleId', filters.styleId);
    if (filters.status) params.append('status', filters.status);
    if (filters.isActive !== undefined) params.append('isActive', String(filters.isActive));
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));
  }

  const response = await api.get<OrderBOMListResponse>(`/order-bom?${params.toString()}`);
  return response.data;
}

/**
 * Get Order BOM by ID with full details
 * GET /api/order-bom/:id
 */
export async function getById(id: string): Promise<OrderBOM> {
  const response = await api.get<OrderBOMResponse>(`/order-bom/${id}`);
  return response.data.data;
}

/**
 * Change fabric width on BOM (creates new version with recalculated consumption)
 * POST /api/order-bom/:id/change-width
 */
export async function changeWidth(
  bomId: string,
  data: ChangeWidthRequest
): Promise<OrderBOM> {
  const response = await api.post<OrderBOMResponse>(`/order-bom/${bomId}/change-width`, data);
  return response.data.data;
}

/**
 * Fetch available CAD width options for a fabric
 * GET /api/fabric-greige/cad/fabric/:fabricId
 */
export async function getFabricCadOptions(fabricId: string): Promise<FabricCadOption[]> {
  const response = await api.get<{ success: boolean; data: FabricCadOption[] }>(
    `/fabric-greige/cad/fabric/${fabricId}`
  );
  return response.data.data;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get the display name for a BOM item based on its material type
 */
export function getBOMItemDisplayName(item: OrderBOM['items'] extends (infer T)[] ? T : never): string {
  if (!item) return 'Unknown';

  switch (item.materialType) {
    case 'BUTTON':
      return item.buttonMaster?.buttonName || item.componentName || 'Button';
    case 'THREAD':
      return item.threadMaster?.threadName || item.componentName || 'Thread';
    case 'ZIPPER':
      return item.zipperMaster?.zipperName || item.componentName || 'Zipper';
    case 'LACE':
      return item.laceMaster?.laceName || item.componentName || 'Lace';
    case 'ELASTIC':
      return item.elasticMaster?.elasticName || item.componentName || 'Elastic';
    case 'LABEL':
      return item.labelMaster?.labelName || item.componentName || 'Label';
    case 'PACKAGING':
      return item.packagingMaster?.packagingName || item.componentName || 'Packaging';
    case 'FABRIC':
      return item.fabricMaster?.fabricName || item.componentName || 'Fabric';
    case 'GENERIC':
      return item.material?.name || item.componentName || 'Material';
    default:
      return item.componentName || 'Unknown';
  }
}

/**
 * Get the material code for a BOM item
 */
export function getBOMItemCode(item: OrderBOM['items'] extends (infer T)[] ? T : never): string {
  if (!item) return '-';

  switch (item.materialType) {
    case 'BUTTON':
      return item.buttonMaster?.buttonCode || '-';
    case 'THREAD':
      // Handle auto-added threads that have no threadMaster
      if (item.threadMaster?.threadCode) {
        return item.threadMaster.threadCode;
      }
      // Check if this is an auto-added thread by component name
      if (item.componentName?.toLowerCase().includes('auto')) {
        return 'AUTO';
      }
      return '-';
    case 'ZIPPER':
      return item.zipperMaster?.zipperCode || '-';
    case 'LACE':
      return item.laceMaster?.laceCode || '-';
    case 'ELASTIC':
      return item.elasticMaster?.elasticCode || '-';
    case 'LABEL':
      return item.labelMaster?.labelCode || '-';
    case 'PACKAGING':
      return item.packagingMaster?.packagingCode || '-';
    case 'FABRIC':
      // Strategy-based code display
      if (item.sourcingStrategy === 'GREIGE_PROCESSED') {
        // Show greige code for greige-processed fabrics
        const greigeCode = item.fabricMaster?.greige?.greigeCode;
        if (greigeCode) return greigeCode;
      }
      // For READY_FABRIC, STOCK_REUSE, or fallback - show fabric code
      if (item.fabricMaster?.fabricCode) {
        return item.fabricMaster.fabricCode;
      }
      // Legacy items without fabricId - show abbreviated componentName
      if (item.componentName) {
        return item.componentName.substring(0, 8).toUpperCase().replace(/\s+/g, '-');
      }
      return '-';
    case 'GENERIC':
      return item.material?.code || '-';
    default:
      return '-';
  }
}

/**
 * Get status badge color for Order BOM status
 */
export function getStatusBadgeColor(status: OrderBOM['status']): string {
  switch (status) {
    case 'DRAFT':
      return 'bg-yellow-100 text-yellow-800';
    case 'APPROVED':
      return 'bg-green-100 text-green-800';
    case 'LOCKED':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export default {
  createFromCostSheet,
  getByOrderId,
  updateOrderBOM,
  approveOrderBOM,
  lockOrderBOM,
  copyFromPreviousOrder,
  calculateRequirements,
  deactivateOrderBOM,
  listOrderBOMs,
  getById,
  getBOMItemDisplayName,
  getBOMItemCode,
  getStatusBadgeColor,
};
