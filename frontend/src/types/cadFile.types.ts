/**
 * CAD File (Mini Marker) Types
 */
import type { MarkerReadStatus } from '@/types/generated/prisma-enums';

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
  /** The CAD row this image is the marker of (null = only in the style's gallery) */
  cadId?: string | null;
  /** Set when another image became that row's marker */
  replacedAt?: string | null;
  readStatus?: MarkerReadStatus | null;
  /** The row, as the gallery names it: "Raw Mat · Front · 52″" */
  cadRow?: { id: string; label: string; current: boolean } | null;
}

// ---------------------------------------------------------------------------
// A CAD row's marker image (backend services/helpers/cad-marker.helper.ts)
// ---------------------------------------------------------------------------

export interface MarkerSize {
  sizeName: string;
  quantity: number;
}

/** What the marker reader read from the image */
export interface MarkerReading {
  /** null = never read */
  status: MarkerReadStatus | null;
  lengthM: number | null;
  widthIn: number | null;
  efficiencyPct: number | null;
  placed: number | null;
  total: number | null;
  sizes: MarkerSize[];
  /** 'pieces' = read from the piece table because the screenshot begins below the title bar */
  sizesFrom?: 'title' | 'pieces' | null;
  pieces: number | null;
  title: string | null;
  error: string | null;
  readAt: string | null;
}

export interface MarkerDifference {
  field: 'image' | 'length' | 'width' | 'sizes' | 'placed';
  /** One line to show as-is: "Layer length: image 3.82 m, row 3.85 m" */
  label: string;
  image: string | null;
  row: string | null;
}

/**
 * NONE — no image, none needed · NEEDS_IMAGE — Raw Mat / Production row with values and no image ·
 * UNUSED — an image, but the row has no length or sizes yet ("Use these values" fills it) ·
 * MATCHES · EXPLAINED — differs (or not readable) and a reason covers it · DIFFERS — nothing explains it
 */
export type MarkerState = 'NONE' | 'NEEDS_IMAGE' | 'UNUSED' | 'MATCHES' | 'EXPLAINED' | 'DIFFERS';

export interface CadRowMarker {
  cadId: string;
  state: MarkerState;
  /** Raw Mat and Production rows need an image; Costing rows may have one */
  required: boolean;
  file: { id: string; fileUrl: string; fileName: string | null; uploadedAt: string } | null;
  reading: MarkerReading | null;
  differences: MarkerDifference[];
  overrideReason: string | null;
  /** What the image implies by the row's own formula: the margin the length rule adds, and
   *  (image length + that margin) ÷ image pieces */
  imageMarginM: number | null;
  imageAverage: number | null;
}

export interface MarkerImageResult {
  file: MiniMarkerFile;
  summary: Omit<CadRowMarker, 'cadId'> | null;
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
