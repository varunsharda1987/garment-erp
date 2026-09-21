import api from '@/lib/api';
import type { MaterialLedger, MaterialLedgerParams } from '@/types/materialLedger.types';

function toQuery(params: MaterialLedgerParams): string {
  const q = new URLSearchParams();
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.warehouseId) q.set('warehouseId', params.warehouseId);
  return q.toString();
}

export async function getMaterialLedger(materialId: string, params: MaterialLedgerParams): Promise<MaterialLedger> {
  const query = toQuery(params);
  const response = await api.get<{ success: boolean; data: MaterialLedger }>(
    `/materials/${materialId}/ledger${query ? `?${query}` : ''}`
  );
  return response.data.data;
}

/** The endpoint path for `openPDF`. */
export function materialLedgerPdfPath(materialId: string, params: MaterialLedgerParams): string {
  const query = toQuery(params);
  return `/materials/${materialId}/ledger?${query ? `${query}&` : ''}format=pdf`;
}

export default { getMaterialLedger, materialLedgerPdfPath };
