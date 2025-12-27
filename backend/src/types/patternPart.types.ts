import { z } from 'zod';

// Zod schema for creating a pattern part
export const createPatternPartSchema = z.object({
  code: z.string().min(1, 'Code is required').max(50, 'Code must be at most 50 characters'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
  componentGroupIds: z.array(z.string().uuid()).optional(), // Array of component group IDs
});

// Zod schema for updating a pattern part
export const updatePatternPartSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  componentGroupIds: z.array(z.string().uuid()).optional(), // Array of component group IDs
});

// Zod schema for reordering pattern parts
export const reorderPatternPartsSchema = z.object({
  orders: z.array(
    z.object({
      id: z.string().uuid(),
      sortOrder: z.number().int().min(0),
    })
  ),
});

// Zod schema for adding pattern parts to a component
export const addComponentPatternPartSchema = z.object({
  patternPartId: z.string().uuid('Invalid pattern part ID'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').default(1),
  isRequired: z.boolean().optional().default(true),
  notes: z.string().optional().nullable(),
});

// Zod schema for updating component-pattern part association
export const updateComponentPatternPartSchema = z.object({
  quantity: z.number().int().min(1).optional(),
  isRequired: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

// TypeScript types inferred from Zod schemas
export type CreatePatternPartInput = z.infer<typeof createPatternPartSchema>;
export type UpdatePatternPartInput = z.infer<typeof updatePatternPartSchema>;
export type ReorderPatternPartsInput = z.infer<typeof reorderPatternPartsSchema>;
export type AddComponentPatternPartInput = z.infer<typeof addComponentPatternPartSchema>;
export type UpdateComponentPatternPartInput = z.infer<typeof updateComponentPatternPartSchema>;

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
