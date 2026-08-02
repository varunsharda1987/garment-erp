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

// Response type (SERVICE LAYER - not the API response wrapper)
// BUG-CG4 fix: createdAt/updatedAt are Date from Prisma at service layer, but become ISO strings
// after JSON serialization in the API response. Using Date | string for compatibility.
// Frontend uses `string` only since it receives the serialized JSON - this is intentional.
// BUG-CG5 fix: This type represents the ENTITY data returned by service methods.
// The controller wraps this in { success: true, data: ComponentGroupResponse } for API responses.
// Frontend types use the same name but include the success wrapper - naming divergence is intentional.
export interface ComponentGroupResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  _count?: {
    components: number;
  };
}

// List response with pagination (SERVICE LAYER)
// BUG-CG5 fix: Controller adds `success: true` when sending response; this type is for service layer.
// Frontend ComponentGroupListResponse includes success wrapper - naming divergence is documented.
export interface ComponentGroupListResponse {
  data: ComponentGroupResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
