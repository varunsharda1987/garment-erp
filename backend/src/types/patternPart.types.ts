// Zod schemas for pattern parts live in backend/src/schemas/patternPart.schema.ts
// (single source of truth, applied by routes via validateBody).
// Input types are re-exported here for backward compatibility with existing imports.
export type {
  CreatePatternPartInput,
  UpdatePatternPartInput,
  ReorderPatternPartsInput,
  AddComponentPatternPartInput,
  UpdateComponentPatternPartInput,
} from '../schemas/patternPart.schema';

// Component Group reference for pattern parts
export interface PatternPartGroupResponse {
  id: string;
  code: string;
  name: string;
}

// Response type
export interface PatternPartResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    componentPatternParts: number;
  };
  componentGroups?: PatternPartGroupResponse[]; // Associated component groups
}

// Component Pattern Part Response
export interface ComponentPatternPartResponse {
  id: string;
  componentId: string;
  patternPartId: string;
  quantity: number;
  isRequired: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  patternPart?: PatternPartResponse;
}

// List response with pagination
export interface PatternPartListResponse {
  data: PatternPartResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
