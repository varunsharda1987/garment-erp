// Component Master Types

export interface ComponentMaster {
  id: string;
  name: string;
  description?: string;
  componentCategory?: string;
  isActive: boolean;
  sortOrder: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  users?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
}

export interface ComponentMasterFormData {
  name: string;
  description?: string;
  componentCategory?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ComponentMasterListResponse {
  data: ComponentMaster[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ComponentMasterResponse {
  data: ComponentMaster;
  message: string;
}

export interface CategoriesResponse {
  data: string[];
  message: string;
}
