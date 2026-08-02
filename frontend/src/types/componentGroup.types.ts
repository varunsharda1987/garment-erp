// Component Group Master Types (API RESPONSE LAYER)

export interface ComponentGroup {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  // BUG-CG4 fix: Using string (not Date) because JSON serialization converts Date to ISO string.
  // Backend uses Date | string for service-layer compatibility; frontend receives only string.
  createdAt: string;
  updatedAt: string;
  _count?: {
    components: number;
  };
}

export interface CreateComponentGroupInput {
  code: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateComponentGroupInput {
  code?: string;
  name?: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

// BUG-CG5 fix: These response types include the success wrapper that the controller adds.
// Backend types with same names are SERVICE-LAYER types (without success wrapper).
// This naming divergence is intentional: backend types are for internal service use,
// frontend types represent the actual API response shape.
export interface ComponentGroupListResponse {
  success: boolean;
  data: ComponentGroup[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ComponentGroupResponse {
  success: boolean;
  data: ComponentGroup;
  message?: string;
}

export interface ReorderComponentGroupsInput {
  orders: Array<{
    id: string;
    sortOrder: number;
  }>;
}
