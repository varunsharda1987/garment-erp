/**
 * @deprecated This file is STALE. Use fabricGreige.schema.ts instead.
 *
 * BUG-FM6 fix: Verified stale - zero imports found. Safe to delete in future cleanup.
 *
 * The fabric-greige.routes.ts uses schemas from fabricGreige.schema.ts which are
 * the current, maintained schemas for fabric and greige endpoints. This file was
 * created earlier but never used in routes and has drifted from the actual data model.
 *
 * DO NOT USE these schemas for new code. They are kept only for reference.
 *
 * Original description:
 * Fabric & Greige Validation Schemas - Zod schemas for fabric and greige management endpoints.
 */

import { z } from 'zod';

// Fabric type enum
export const FabricType = z.enum(['Woven', 'Knit', 'NonWoven', 'Denim', 'Jersey', 'Twill', 'Satin', 'Canvas', 'Other']);

// Fabric status enum
export const FabricStatus = z.enum(['Active', 'Inactive', 'Discontinued']);

// Create greige schema
export const createGreigeSchema = z.object({
  greigeCode: z.string().min(1, 'Greige code is required').max(50),
  greigeName: z.string().min(1, 'Greige name is required').max(100),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  composition: z.string().max(200).optional(),
  width: z.number().positive().optional(),
  widthUnit: z.enum(['cm', 'inch', 'mm']).default('cm'),
  weight: z.number().positive().optional(),
  weightUnit: z.enum(['gsm', 'oz']).default('gsm'),
  construction: z.string().max(100).optional(),
  fabricType: FabricType.default('Woven'),
  color: z.string().max(50).optional(),
  minimumOrderQuantity: z.number().positive().optional(),
  leadTime: z.number().int().positive().optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().length(3).default('INR'),
  notes: z.string().max(2000).optional(),
  status: FabricStatus.default('Active'),
});

// Update greige schema
export const updateGreigeSchema = createGreigeSchema.partial().extend({
  id: z.string().uuid(),
});

// Create fabric schema
export const createFabricSchema = z.object({
  fabricCode: z.string().min(1, 'Fabric code is required').max(50),
  fabricName: z.string().min(1, 'Fabric name is required').max(100),
  greigeId: z.string().uuid('Invalid greige ID').optional(),
  supplierId: z.string().uuid('Invalid supplier ID').optional(),
  composition: z.string().max(200).optional(),
  width: z.number().positive().optional(),
  widthUnit: z.enum(['cm', 'inch', 'mm']).default('cm'),
  weight: z.number().positive().optional(),
  weightUnit: z.enum(['gsm', 'oz']).default('gsm'),
  construction: z.string().max(100).optional(),
  fabricType: FabricType.default('Woven'),
  finishedColor: z.string().max(50).optional(),
  dyeMethod: z.string().max(50).optional(),
  washType: z.string().max(50).optional(),
  finish: z.string().max(100).optional(),
  shrinkage: z.number().min(0).max(100).optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().length(3).default('INR'),
  minimumOrderQuantity: z.number().positive().optional(),
  leadTime: z.number().int().positive().optional(),
  notes: z.string().max(2000).optional(),
  status: FabricStatus.default('Active'),
});

// Update fabric schema
export const updateFabricSchema = createFabricSchema.partial().extend({
  id: z.string().uuid(),
});

// Fabric/greige query params schema
export const fabricQuerySchema = z.object({
  supplierId: z.string().uuid().optional(),
  fabricType: FabricType.optional(),
  status: FabricStatus.optional(),
  color: z.string().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// Fabric CAD schema
export const createFabricCADSchema = z.object({
  fabricId: z.string().uuid('Invalid fabric ID'),
  cadNumber: z.string().min(1).max(50),
  averageConsumption: z.number().positive(),
  unit: z.string().min(1).max(20).default('meters'),
  efficiency: z.number().min(0).max(100).default(85),
  wastage: z.number().min(0).max(100).default(3),
  notes: z.string().max(1000).optional(),
});

// Update fabric CAD schema
export const updateFabricCADSchema = createFabricCADSchema.partial().extend({
  id: z.string().uuid(),
});

export type CreateGreigeInput = z.infer<typeof createGreigeSchema>;
export type UpdateGreigeInput = z.infer<typeof updateGreigeSchema>;
export type CreateFabricInput = z.infer<typeof createFabricSchema>;
export type UpdateFabricInput = z.infer<typeof updateFabricSchema>;
export type FabricQueryInput = z.infer<typeof fabricQuerySchema>;
export type CreateFabricCADInput = z.infer<typeof createFabricCADSchema>;
export type UpdateFabricCADInput = z.infer<typeof updateFabricCADSchema>;
