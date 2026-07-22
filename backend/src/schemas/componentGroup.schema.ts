import { z } from 'zod';

// Single source of truth for component-group request validation.
// Applied at the route layer via validateBody() in componentGroup.routes.ts.

// Zod schema for creating a component group
export const createComponentGroupSchema = z.object({
  code: z.string().min(1, 'Code is required').max(50, 'Code must be at most 50 characters'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

// Zod schema for updating a component group
export const updateComponentGroupSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// Zod schema for reordering component groups
export const reorderComponentGroupsSchema = z.object({
  orders: z.array(
    z.object({
      id: z.string().uuid(),
      sortOrder: z.number().int().min(0),
    })
  ),
});

// TypeScript types inferred from Zod schemas
export type CreateComponentGroupInput = z.infer<typeof createComponentGroupSchema>;
export type UpdateComponentGroupInput = z.infer<typeof updateComponentGroupSchema>;
export type ReorderComponentGroupsInput = z.infer<typeof reorderComponentGroupsSchema>;
