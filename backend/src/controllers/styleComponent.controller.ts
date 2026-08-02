// Style Component controller
// BUG-CM7 fix: Type safety via Zod inferred types
// All req.body access uses type assertions from validated Zod schemas.
// Routes use validateBody(schema) middleware, guaranteeing the shape before
// the controller executes. Types are exported from ../schemas/style.schema.ts
// as z.infer<typeof schemaName>.

import { Request, Response } from 'express';
import prisma from '../config/database';
import { ValidationError } from '../errors';
import type {
  CreateComponentInput,
  UpdateComponentInput,
  CreateComponentFabricInput,
  UpdateComponentFabricInput,
  CreateComponentAccessoryInput,
  UpdateComponentAccessoryInput,
  CreateStyleProcessInput,
  UpdateStyleProcessInput,
} from '../schemas/style.schema';

/**
 * Create component for a style
 * POST /api/styles/:styleId/components
 * Body validated by validateBody(createComponentSchema) at the route layer
 */
export const createComponent = async (req: Request, res: Response): Promise<void> => {
  const { styleId } = req.params;
  const { componentName, componentType, sortOrder } = req.body as CreateComponentInput;

  // Look up componentMasterId by name (case-insensitive)
  const componentMaster = await prisma.component_masters.findFirst({
    where: {
      name: { equals: componentName, mode: 'insensitive' },
      isActive: true,
    },
    select: { id: true },
  });

  const component = await prisma.style_components.create({
    data: {
      styleId,
      componentName,
      componentType,
      componentMasterId: componentMaster?.id || null,
      sortOrder: sortOrder || 0,
    },
    include: {
      style_fabrics: true,
      style_accessories: true,
      componentMaster: {
        select: { id: true, name: true, componentGroupId: true },
      },
    },
  });

  res.status(201).json({
    data: component,
    message: 'Component created successfully',
  });
};

/**
 * Update component
 * PUT /api/components/:id
 * Body validated by validateBody(updateComponentSchema) at the route layer
 */
export const updateComponent = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { componentName, componentType, sortOrder } = req.body as UpdateComponentInput;

  const component = await prisma.style_components.update({
    where: { id },
    data: {
      componentName,
      componentType,
      sortOrder,
    },
    include: {
      style_fabrics: true,
      style_accessories: true,
    },
  });

  res.status(200).json({
    data: component,
    message: 'Component updated successfully',
  });
};

/**
 * Delete component
 * DELETE /api/components/:id
 */
export const deleteComponent = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  await prisma.style_components.delete({
    where: { id },
  });

  res.status(200).json({
    message: 'Component deleted successfully',
  });
};

/**
 * Create fabric for a component
 * POST /api/components/:componentId/fabrics
 * BUG-S2 fix: now handles all 22+ style_fabrics fields instead of just 8
 * Body validated by validateBody(createComponentFabricSchema) at the route layer
 */
export const createFabric = async (req: Request, res: Response): Promise<void> => {
  const { componentId } = req.params;
  const {
    // Required fields
    fabricName,
    fabricType,
    // Optional basic fields
    fabricColor,
    fabricGSM,
    cadAverageMeters,
    cadAverageYards,
    supplierName,
    unitPrice,
    // FK references
    fabricId,
    fabricCADId,
    embroideryId,
    selectedGreigeId,
    colorMasterId,
    // Fabric identification
    fabricFinishType,
    greigeName,
    genericGreigeName,
    printDesign,
    // CAD & costing fields
    cadGroupKey,
    quantityNeeded,
    cutableWidth,
    fabricCostPerMeter,
    embroideryCostPerMeter,
    totalCostPerMeter,
    // Embroidery & cutting
    hasEmbroidery,
    allowCombinedCutting,
    numberOfColors,
    averagingMode,
    // Notes
    notes,
  } = req.body as CreateComponentFabricInput;

  const fabric = await prisma.style_fabrics.create({
    data: {
      componentId,
      fabricName,
      fabricType,
      fabricColor,
      fabricGSM,
      cadAverageMeters,
      cadAverageYards,
      supplierName,
      unitPrice,
      // FK references
      fabricId,
      fabricCADId,
      embroideryId,
      selectedGreigeId,
      colorMasterId,
      // Fabric identification
      fabricFinishType,
      greigeName,
      genericGreigeName,
      printDesign,
      // CAD & costing
      cadGroupKey,
      quantityNeeded,
      cutableWidth,
      fabricCostPerMeter,
      embroideryCostPerMeter,
      totalCostPerMeter,
      // Embroidery & cutting
      hasEmbroidery: hasEmbroidery ?? false,
      allowCombinedCutting: allowCombinedCutting ?? true,
      numberOfColors,
      averagingMode,
      // Notes
      notes,
    },
  });

  res.status(201).json({
    data: fabric,
    message: 'Fabric created successfully',
  });
};

/**
 * Update fabric (including CAD averages)
 * PUT /api/fabrics/:id
 * BUG-S2 fix: now handles all 22+ style_fabrics fields instead of just 8
 * Body validated by validateBody(updateComponentFabricSchema) at the route layer
 */
export const updateFabric = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const {
    // Basic fields
    fabricName,
    fabricType,
    fabricColor,
    fabricGSM,
    cadAverageMeters,
    cadAverageYards,
    supplierName,
    unitPrice,
    // FK references
    fabricId,
    fabricCADId,
    embroideryId,
    selectedGreigeId,
    colorMasterId,
    // Fabric identification
    fabricFinishType,
    greigeName,
    genericGreigeName,
    printDesign,
    // CAD & costing fields
    cadGroupKey,
    quantityNeeded,
    cutableWidth,
    fabricCostPerMeter,
    embroideryCostPerMeter,
    totalCostPerMeter,
    // Embroidery & cutting
    hasEmbroidery,
    allowCombinedCutting,
    numberOfColors,
    averagingMode,
    // Notes
    notes,
  } = req.body as UpdateComponentFabricInput;

  const fabric = await prisma.style_fabrics.update({
    where: { id },
    data: {
      fabricName,
      fabricType,
      fabricColor,
      fabricGSM,
      cadAverageMeters,
      cadAverageYards,
      supplierName,
      unitPrice,
      // FK references
      fabricId,
      fabricCADId,
      embroideryId,
      selectedGreigeId,
      colorMasterId,
      // Fabric identification
      fabricFinishType,
      greigeName,
      genericGreigeName,
      printDesign,
      // CAD & costing
      cadGroupKey,
      quantityNeeded,
      cutableWidth,
      fabricCostPerMeter,
      embroideryCostPerMeter,
      totalCostPerMeter,
      // Embroidery & cutting
      hasEmbroidery,
      allowCombinedCutting,
      numberOfColors,
      averagingMode,
      // Notes
      notes,
    },
  });

  res.status(200).json({
    data: fabric,
    message: 'Fabric updated successfully',
  });
};

/**
 * Delete fabric
 * DELETE /api/fabrics/:id
 */
export const deleteFabric = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  await prisma.style_fabrics.delete({
    where: { id },
  });

  res.status(200).json({
    message: 'Fabric deleted successfully',
  });
};

/**
 * Create accessory for a component
 * POST /api/components/:componentId/accessories
 * Body validated by validateBody(createComponentAccessorySchema) at the route layer
 */
export const createAccessory = async (req: Request, res: Response): Promise<void> => {
  const { componentId } = req.params;
  const { accessoryName, accessoryType, quantityPerPiece, unit, supplierName, unitPrice } =
    req.body as CreateComponentAccessoryInput;

  const accessory = await prisma.style_accessories.create({
    data: {
      componentId,
      accessoryName,
      accessoryType,
      quantityPerPiece,
      unit,
      supplierName,
      unitPrice,
    },
  });

  res.status(201).json({
    data: accessory,
    message: 'Accessory created successfully',
  });
};

/**
 * Update accessory
 * PUT /api/accessories/:id
 * Body validated by validateBody(updateComponentAccessorySchema) at the route layer
 */
export const updateAccessory = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { accessoryName, accessoryType, quantityPerPiece, unit, supplierName, unitPrice } =
    req.body as UpdateComponentAccessoryInput;

  const accessory = await prisma.style_accessories.update({
    where: { id },
    data: {
      accessoryName,
      accessoryType,
      quantityPerPiece,
      unit,
      supplierName,
      unitPrice,
    },
  });

  res.status(200).json({
    data: accessory,
    message: 'Accessory updated successfully',
  });
};

/**
 * Delete accessory
 * DELETE /api/accessories/:id
 */
export const deleteAccessory = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  await prisma.style_accessories.delete({
    where: { id },
  });

  res.status(200).json({
    message: 'Accessory deleted successfully',
  });
};

/**
 * Create process for a style
 * POST /api/styles/:styleId/processes
 * Body validated by validateBody(createStyleProcessSchema) at the route layer
 */
export const createProcess = async (req: Request, res: Response): Promise<void> => {
  const { styleId } = req.params;
  const { processName, processType, isRequired, sortOrder, supplierId, estimatedCost, estimatedDays, notes } =
    req.body as CreateStyleProcessInput;

  const process = await prisma.style_processes.create({
    data: {
      styleId,
      processName,
      processType: processType ?? (processName as any), // processType required by Prisma enum
      isRequired: isRequired !== false,
      sortOrder: sortOrder || 0,
      supplierId,
      estimatedCost,
      estimatedDays,
      notes,
    },
  });

  res.status(201).json({
    data: process,
    message: 'Process created successfully',
  });
};

/**
 * Update process
 * PUT /api/processes/:id
 * Body validated by validateBody(updateStyleProcessSchema) at the route layer
 */
export const updateProcess = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { processName, processType, isRequired, sortOrder, supplierId, estimatedCost, estimatedDays, notes } =
    req.body as UpdateStyleProcessInput;

  const process = await prisma.style_processes.update({
    where: { id },
    data: {
      processName,
      processType,
      isRequired,
      sortOrder,
      supplierId,
      estimatedCost,
      estimatedDays,
      notes,
    },
  });

  res.status(200).json({
    data: process,
    message: 'Process updated successfully',
  });
};

/**
 * Delete process
 * DELETE /api/processes/:id
 */
export const deleteProcess = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  await prisma.style_processes.delete({
    where: { id },
  });

  res.status(200).json({
    message: 'Process deleted successfully',
  });
};
