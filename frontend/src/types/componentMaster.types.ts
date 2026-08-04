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

// BUG-CM5 fix: Added success field to match componentGroup controller pattern
// BUG-CM9 fix: success is included in response types to document the API contract
export interface ComponentMasterListResponse {
  success: boolean;
  data: ComponentMaster[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number; // backend returns totalPages, not pages (bug-hunt orders-13)
  };
}

export interface ComponentMasterResponse {
  success: boolean;
  data: ComponentMaster;
  message?: string;
  warning?: string; // BUG-CM8: Present when pattern part assignment fails
}

export interface CategoriesResponse {
  success: boolean;
  data: string[];
  message?: string;
}
