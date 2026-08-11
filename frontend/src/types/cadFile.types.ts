/**
 * CAD File (Mini Marker) Types
 */

export type CadPurpose = 'COSTING' | 'RAW_MATERIAL_CALCULATION' | 'PRODUCTION';

export const CadPurposeLabels: Record<CadPurpose, string> = {
  COSTING: 'Costing',
  RAW_MATERIAL_CALCULATION: 'Raw Material',
  PRODUCTION: 'Production',
};

export interface MiniMarkerFile {
  id: string;
  styleId: string;
  purpose: CadPurpose;
  fileUrl: string;
  fileName: string | null;
  fileSize: number | null;
  sortOrder: number;
  uploadedById: string | null;
  createdAt: string;
}

/**
 * Flat list, NOT keyed by purpose — the backend response serializer camelizes
 * object keys, so purpose-named keys would arrive corrupted. Group with
 * `groupMiniMarkersByPurpose` instead.
 */
export interface MiniMarkersResponse {
  files: MiniMarkerFile[];
  total: number;
}

export type MiniMarkersByPurpose = Record<CadPurpose, MiniMarkerFile[]>;

export function groupMiniMarkersByPurpose(files: MiniMarkerFile[] | undefined): MiniMarkersByPurpose {
  const grouped: MiniMarkersByPurpose = {
    COSTING: [],
    RAW_MATERIAL_CALCULATION: [],
    PRODUCTION: [],
  };
  for (const file of files ?? []) {
    grouped[file.purpose]?.push(file);
  }
  return grouped;
}
