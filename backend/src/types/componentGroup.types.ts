// Zod schemas moved to backend/src/schemas/componentGroup.schema.ts (single source of truth,
// applied at the route layer via validateBody). Re-exported here for existing consumers.
export {
  createComponentGroupSchema,
  updateComponentGroupSchema,
  reorderComponentGroupsSchema,
} from '../schemas/componentGroup.schema';
export type {
  CreateComponentGroupInput,
  UpdateComponentGroupInput,
  ReorderComponentGroupsInput,
} from '../schemas/componentGroup.schema';

// Response type
export interface ComponentGroupResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    components: number;
  };
}

// List response with pagination
export interface ComponentGroupListResponse {
  data: ComponentGroupResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
