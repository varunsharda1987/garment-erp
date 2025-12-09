/**
 * Lookup Values Types
 * For managing configurable dropdown options
 */

export interface LookupValue {
  id: string;
  category: string;
  code: string;
  value: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  isSystem: boolean;
}

export interface LookupCategory {
  category: string;
  count: number;
}

export interface LookupListResponse {
  data: LookupValue[];
}

export interface LookupCategoriesResponse {
  data: LookupCategory[];
  predefinedCategories: string[];
}

export interface CreateLookupRequest {
  category: string;
  value: string;
  code?: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateLookupRequest {
  value?: string;
  code?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface BulkCreateRequest {
  category: string;
  values: string[] | Array<{ value: string; code?: string }>;
}

export interface BulkCreateResult {
  success: boolean;
  value: string;
  id?: string;
  error?: string;
}

export interface BulkCreateResponse {
  data: BulkCreateResult[];
  summary: {
    total: number;
    success: number;
    failed: number;
  };
}

// Predefined categories - keep in sync with backend
export const LOOKUP_CATEGORIES = {
  LACE_TYPE: 'LACE_TYPE',
  BUTTON_TYPE: 'BUTTON_TYPE',
  THREAD_TYPE: 'THREAD_TYPE',
  ZIPPER_TYPE: 'ZIPPER_TYPE',
  ELASTIC_TYPE: 'ELASTIC_TYPE',
  WEAVE_TYPE: 'WEAVE_TYPE',
  LABEL_TYPE: 'LABEL_TYPE',
  PACKAGING_TYPE: 'PACKAGING_TYPE',
} as const;

export type LookupCategoryType = keyof typeof LOOKUP_CATEGORIES;

// Category display names for UI
export const LOOKUP_CATEGORY_LABELS: Record<string, string> = {
  LACE_TYPE: 'Lace Type',
  BUTTON_TYPE: 'Button Type',
  THREAD_TYPE: 'Thread Type',
  ZIPPER_TYPE: 'Zipper Type',
  ELASTIC_TYPE: 'Elastic Type',
  WEAVE_TYPE: 'Weave Type',
  LABEL_TYPE: 'Label Type',
  PACKAGING_TYPE: 'Packaging Type',
};
