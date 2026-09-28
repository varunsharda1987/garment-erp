/**
 * Requirements page (Material tab) — what it opens on, its status choices, and how it pages.
 *
 * 2026-09-28 (owner): the page opened on a flat list of every status, one row per size, 20 at a time — a label
 * set was cut across pages and ticks were lost on every page turn. It now opens GROUPED by order + style on the
 * requirements that still need action, and the grouped views page whole groups, so a set is never split.
 */
import type { MaterialRequirementStatus } from '@/types/mrp.types';

// ─── Views ──────────────────────────────────────────────────

export type MaterialView = 'byOrderStyle' | 'byMaterial' | 'byParty' | 'list';

export const MATERIAL_VIEWS: readonly { value: MaterialView; label: string }[] = [
  { value: 'byOrderStyle', label: 'Order & Style' },
  { value: 'byMaterial', label: 'Material' },
  { value: 'byParty', label: 'Vendor' },
  { value: 'list', label: 'List' },
];

export const DEFAULT_VIEW: MaterialView = 'byOrderStyle';

/**
 * `?view=` → the view. No view opens Order & Style; `flat` is the List view's old name, and the retired
 * `byStyle` (Order & Style covers it) lands on Order & Style, so old links still open something sensible.
 */
export function viewFromParam(raw: string | null): MaterialView {
  if (raw === 'list' || raw === 'flat') return 'list';
  if (raw === 'byMaterial' || raw === 'byParty') return raw;
  return DEFAULT_VIEW;
}

// ─── Status ─────────────────────────────────────────────────

export type StatusPreset = 'open' | 'onOrder' | 'done' | 'cancelled' | 'all';

export const STATUS_PRESETS: readonly {
  value: StatusPreset;
  label: string;
  /** undefined = no status filter: the API's default, everything except CANCELLED */
  statuses: MaterialRequirementStatus[] | undefined;
}[] = [
  {
    value: 'open',
    label: 'Needs action',
    statuses: ['PENDING', 'SIZE_PENDING', 'PO_REQUIRED', 'PARTIAL_STOCK', 'DECISION_PENDING'],
  },
  { value: 'onOrder', label: 'On order', statuses: ['PO_GENERATED', 'PO_SENT', 'PARTIALLY_RECEIVED'] },
  { value: 'done', label: 'Received / from stock', statuses: ['RECEIVED', 'FULFILLED_STOCK', 'CONVERTED'] },
  { value: 'cancelled', label: 'Cancelled', statuses: ['CANCELLED'] },
  { value: 'all', label: 'All (not cancelled)', statuses: undefined },
];

export const DEFAULT_STATUS_PRESET: StatusPreset = 'open';

/** `?status=` → what the Status filter shows: a preset, or an exact status (list) as a link wrote it */
export function statusFilterValue(raw: string | null): string {
  return raw || DEFAULT_STATUS_PRESET;
}

/** `?status=` → the statuses sent to the API (undefined = the API's default: everything except CANCELLED) */
export function statusesForParam(raw: string | null): MaterialRequirementStatus[] | undefined {
  const value = statusFilterValue(raw);
  const preset = STATUS_PRESETS.find((p) => p.value === value);
  if (preset) return preset.statuses;
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as MaterialRequirementStatus[];
}

// ─── Paging ─────────────────────────────────────────────────

/** Grouped views page whole groups (sets); the List view pages rows on the server */
export const GROUP_PAGE_SIZES = [10, 25, 50];
export const DEFAULT_GROUP_PAGE_SIZE = 10;
export const LIST_PAGE_SIZES = [20, 50, 100];
export const DEFAULT_LIST_PAGE_SIZE = 20;

export interface GroupPage<T> {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
}

/**
 * One page of whole groups. A page past the end (a filter or a PO left fewer groups) shows the last page
 * rather than an empty one.
 */
export function pageGroups<T>(groups: readonly T[], page: number, size: number): GroupPage<T> {
  const perPage = Math.max(1, Math.floor(size));
  const totalPages = Math.max(1, Math.ceil(groups.length / perPage));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  return {
    items: groups.slice((current - 1) * perPage, current * perPage),
    page: current,
    totalPages,
    total: groups.length,
  };
}
