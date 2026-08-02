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

// BUG-PP6 fix: Type alias to document the Date/string duality.
// Prisma returns Date objects, but JSON.stringify (in response serialization)
// converts them to ISO-8601 strings. Frontend should treat these as strings.
// Using this alias makes the intent explicit and searchable.
type DateOrISOString = Date | string;

// Response type
// BUG-PP6 fix: createdAt/updatedAt use DateOrISOString to document the Prisma Date
// vs JSON-serialized ISO string duality. Service layer receives Date, API consumers
// receive string after serialization.
export interface PatternPartResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: DateOrISOString;
  updatedAt: DateOrISOString;
  _count?: {
    componentPatternParts: number;
  };
  componentGroups?: PatternPartGroupResponse[]; // Associated component groups
}

// Component Pattern Part Response
// BUG-PP6 fix: createdAt/updatedAt use DateOrISOString to document the Prisma Date
// vs JSON-serialized ISO string duality. Service layer receives Date, API consumers
// receive string after serialization.
export interface ComponentPatternPartResponse {
  id: string;
  componentId: string;
  patternPartId: string;
  quantity: number;
  isRequired: boolean;
  notes: string | null;
  createdAt: DateOrISOString;
  updatedAt: DateOrISOString;
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
