/**
 * Allocate a sent PO to running orders — /api/po-allocations (docs/plans/po-allocation-design.md §6.5).
 * Reading is open to anyone signed in; linking and Undo need the MRP or the Purchase Orders permission.
 */
import api from '../lib/api';
import type {
  AllocatePoRequest,
  AllocatePoResponse,
  PoAllocationErrorCode,
  PoAllocationRefusalRow,
  PoAllocationView,
  UndoPoAllocationResponse,
} from '../types/po-allocation.types';

const BASE_URL = '/po-allocations';

/** Each line's figures, its links in fill order, and its candidates with the default split. `itemIds` narrows to some lines. */
export const getPoAllocation = async (poId: string, itemIds?: readonly string[]): Promise<PoAllocationView> => {
  const { data } = await api.get<{ success: boolean; data: PoAllocationView }>(`${BASE_URL}/${poId}`, {
    params: itemIds && itemIds.length > 0 ? { itemIds: itemIds.join(',') } : undefined,
  });
  return data.data;
};

/** Link the ticked orders. Answers with what was linked, the balance rows, and the refreshed allocation. */
export const allocatePoToOrders = async (poId: string, request: AllocatePoRequest): Promise<AllocatePoResponse> => {
  const { data } = await api.post<{ success: boolean; data: AllocatePoResponse }>(`${BASE_URL}/${poId}`, request);
  return data.data;
};

/** Undo one link while nothing has arrived for it */
export const undoPoAllocation = async (poId: string, linkId: string): Promise<UndoPoAllocationResponse> => {
  const { data } = await api.delete<{ success: boolean; data: UndoPoAllocationResponse }>(
    `${BASE_URL}/${poId}/links/${linkId}`
  );
  return data.data;
};

export interface PoAllocationError {
  status: number | null;
  code: PoAllocationErrorCode | string | null;
  message: string;
  /** PO_ALLOCATION_REFUSED: every row that was refused, with why */
  rows: PoAllocationRefusalRow[];
}

/**
 * The server's own words for an allocation refusal. Read this, not getErrorMessage(): that one treats any
 * object `details` as {field: message} pairs, so these refusals would print as "Code: PO_ALLOCATION_REFUSED"
 * and the real message would never be shown (same reason lib/rate-slab-change.ts exists).
 */
export function poAllocationErrorOf(error: unknown): PoAllocationError | null {
  const response = (
    error as {
      response?: {
        status?: number;
        data?: { message?: string; error?: string; details?: { code?: string; rows?: PoAllocationRefusalRow[] } };
      };
    }
  )?.response;
  if (!response?.data) return null;
  const { data } = response;
  return {
    status: response.status ?? null,
    code: data.details?.code ?? data.error ?? null,
    message: data.message ?? 'The allocation could not be saved.',
    rows: Array.isArray(data.details?.rows) ? data.details.rows : [],
  };
}
