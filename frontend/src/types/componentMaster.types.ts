// Component Master Types
import type { ComponentGroup } from './componentGroup.types';

export interface ComponentMaster {
  id: string;
  name: string;
  description?: string;
  componentCategory?: string; // DEPRECATED - kept for backward compatibility
  componentGroupId?: string;
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
  componentGroup?: ComponentGroup;
}

export interface ComponentMasterFormData {
  name: string;
  description?: string;
  componentCategory?: string; // DEPRECATED - kept for backward compatibility
  componentGroupId?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ComponentMasterListResponse {
  data: ComponentMaster[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number; // backend returns totalPages, not pages (bug-hunt orders-13)
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
