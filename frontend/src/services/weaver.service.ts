/**
 * Weavers — the mill that wove a greige or fabric we bought (Phase 1b). Picked, or added on the
 * spot, on the PO line and the GRN line; the stock lot carries it. Never on the greige master.
 */
import api from '@/lib/api';

export interface Weaver {
  id: string;
  name: string;
  city: string | null;
  supplierId: string | null;
}

export async function searchWeavers(search?: string, limit = 50): Promise<Weaver[]> {
  const response = await api.get('/weavers', { params: { search: search || undefined, limit } });
  return response.data.data;
}

/** Add on the spot — the server hands back the existing weaver when the name already exists. */
export async function addWeaver(name: string): Promise<{ weaver: Weaver; created: boolean }> {
  const response = await api.post('/weavers', { name });
  return { weaver: response.data.data, created: response.data.created };
}
