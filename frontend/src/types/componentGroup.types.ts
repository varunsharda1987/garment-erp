// Component Group Master Types

export interface ComponentGroup {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
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
