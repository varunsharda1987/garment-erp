/**
 * Product Category Service
 * API service for product category management
 */

import api from '../lib/api';
import type {
  ProductCategory,
  ProductCategoryHierarchy,
  CreateProductCategoryRequest,
  UpdateProductCategoryRequest,
  ProductCategoryListResponse,
  ProductCategoryResponse,
  ProductCategoryHierarchyResponse,
  ProductCategoryQueryParams,
  ReorderCategoriesRequest,
  CategoryComponentDefault,
  CategoryComponentDefaultsResponse,
  ComponentSuggestion,
  ComponentSuggestionsResponse,
  ComponentDefaultInput,
} from '../types/productCategory.types';

export const productCategoryService = {
  /**
   * Get all product categories with pagination and filters
   */
  getAllCategories: async (params?: ProductCategoryQueryParams): Promise<ProductCategoryListResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.parentId !== undefined)
      queryParams.append('parentId', params.parentId === null ? 'null' : params.parentId);
    if (params?.level !== undefined) queryParams.append('level', params.level.toString());
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    const response = await api.get<ProductCategoryListResponse>(`/product-categories?${queryParams.toString()}`);
    return response.data;
  },

  /**
   * Get product category by ID
   */
  getCategoryById: async (id: string): Promise<ProductCategory> => {
    const response = await api.get<ProductCategoryResponse>(`/product-categories/${id}`);
    return response.data.data;
  },

  /**
   * Get full category hierarchy tree
   */
  getHierarchy: async (parentId?: string | null): Promise<ProductCategoryHierarchy[]> => {
    const queryParams = new URLSearchParams();
    if (parentId !== undefined) queryParams.append('parentId', parentId === null ? 'null' : parentId);

    const response = await api.get<ProductCategoryHierarchyResponse>(
      `/product-categories/hierarchy?${queryParams.toString()}`
    );
    return response.data.data;
  },

  /**
   * Get main categories (Level 1)
   */
  getMainCategories: async (): Promise<ProductCategory[]> => {
    const response = await api.get<{ data: ProductCategory[] }>('/product-categories/main');
    return response.data.data;
  },

  /**
   * Get categories by level
   */
  getCategoriesByLevel: async (level: number): Promise<ProductCategory[]> => {
    const response = await api.get<{ data: ProductCategory[] }>(`/product-categories/level/${level}`);
    return response.data.data;
  },

  /**
   * Get children of a category
   */
  getChildren: async (parentId: string): Promise<ProductCategory[]> => {
    const response = await api.get<{ data: ProductCategory[] }>(`/product-categories/${parentId}/children`);
    return response.data.data;
  },

  /**
   * Get path from root to a category
   */
  getCategoryPath: async (id: string): Promise<ProductCategory[]> => {
    const response = await api.get<{ data: ProductCategory[] }>(`/product-categories/${id}/path`);
    return response.data.data;
  },

  /**
   * Create a new product category
   */
  createCategory: async (data: CreateProductCategoryRequest): Promise<ProductCategory> => {
    const response = await api.post<ProductCategoryResponse>('/product-categories', data);
    return response.data.data;
  },

  /**
   * Update a product category
   */
  updateCategory: async (id: string, data: UpdateProductCategoryRequest): Promise<ProductCategory> => {
    const response = await api.put<ProductCategoryResponse>(`/product-categories/${id}`, data);
    return response.data.data;
  },

  /**
   * Delete (deactivate) a product category
   */
  deleteCategory: async (id: string): Promise<void> => {
    await api.delete(`/product-categories/${id}`);
  },

  /**
   * Toggle category active status
   */
  toggleActive: async (id: string): Promise<ProductCategory> => {
    const response = await api.patch<ProductCategoryResponse>(`/product-categories/${id}/toggle-active`);
    return response.data.data;
  },

  /**
   * Reorder categories
   */
  reorderCategories: async (data: ReorderCategoriesRequest): Promise<void> => {
    await api.post('/product-categories/reorder', data);
  },

  // ============================================
  // Category Component Defaults API
  // ============================================

  /**
   * Get default components for a category
   */
  getDefaultComponents: async (categoryId: string): Promise<CategoryComponentDefault[]> => {
    const response = await api.get<CategoryComponentDefaultsResponse>(
      `/product-categories/${categoryId}/default-components`
    );
    return response.data.data;
  },

  /**
   * Get suggested components for a category (with inheritance from parent categories)
   */
  getSuggestedComponents: async (categoryId: string): Promise<ComponentSuggestion[]> => {
    const response = await api.get<ComponentSuggestionsResponse>(
      `/product-categories/${categoryId}/suggested-components`
    );
    return response.data.data;
  },

  /**
   * Set default components for a category (bulk replace)
   */
  setDefaultComponents: async (
    categoryId: string,
    components: ComponentDefaultInput[]
  ): Promise<CategoryComponentDefault[]> => {
    const response = await api.post<CategoryComponentDefaultsResponse>(
      `/product-categories/${categoryId}/default-components`,
      { components }
    );
    return response.data.data;
  },

  /**
   * Add a single default component to a category
   */
  addDefaultComponent: async (
    categoryId: string,
    component: ComponentDefaultInput
  ): Promise<CategoryComponentDefault> => {
    const response = await api.post<{ data: CategoryComponentDefault }>(
      `/product-categories/${categoryId}/default-components/add`,
      component
    );
    return response.data.data;
  },

  /**
   * Remove a default component from a category
   */
  removeDefaultComponent: async (categoryId: string, componentId: string): Promise<void> => {
    await api.delete(`/product-categories/${categoryId}/default-components/${componentId}`);
  },
};

export default productCategoryService;
