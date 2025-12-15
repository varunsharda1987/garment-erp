/**
 * Product Category Types
 * Type definitions for product category management
 */

export interface ProductCategory {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  level: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  parent?: {
    id: string;
    code: string;
    name: string;
  } | null;
  children?: ProductCategoryChild[];
}

export interface ProductCategoryChild {
  id: string;
  code: string;
  name: string;
  level: number;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductCategoryHierarchy extends ProductCategory {
  children: ProductCategoryHierarchy[];
}

export interface CreateProductCategoryRequest {
  code: string;
  name: string;
  description?: string;
  parentId?: string | null;
  level?: number;
  sortOrder?: number;
}

export interface UpdateProductCategoryRequest extends Partial<CreateProductCategoryRequest> {
  isActive?: boolean;
}

export interface ProductCategoryListResponse {
  data: ProductCategory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProductCategoryResponse {
  data: ProductCategory;
  message?: string;
}

export interface ProductCategoryHierarchyResponse {
  data: ProductCategoryHierarchy[];
}

export interface ReorderCategoriesRequest {
  orders: {
    id: string;
    sortOrder: number;
  }[];
}

export interface ProductCategoryQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  parentId?: string | null;
  level?: number;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// Category Component Defaults Types
// ============================================

export interface ComponentMasterBasic {
  id: string;
  name: string;
  description?: string | null;
  componentCategory?: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface CategoryComponentDefault {
  id: string;
  productCategoryId: string;
  componentMasterId: string;
  isRequired: boolean;
  sortOrder: number;
  defaultCount: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  componentMaster: ComponentMasterBasic;
}

export interface ComponentSuggestion {
  componentMasterId: string;
  componentMaster: ComponentMasterBasic;
  isRequired: boolean;
  sortOrder: number;
  defaultCount: number;
  notes: string | null;
  sourceCategory: {
    id: string;
    name: string;
    code: string;
    isInherited: boolean;
  };
}

export interface ComponentDefaultInput {
  componentMasterId: string;
  isRequired?: boolean;
  sortOrder?: number;
  defaultCount?: number;
  notes?: string;
}

export interface CategoryComponentDefaultsResponse {
  data: CategoryComponentDefault[];
  message?: string;
}

export interface ComponentSuggestionsResponse {
  data: ComponentSuggestion[];
}
