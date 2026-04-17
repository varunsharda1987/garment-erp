// Style Component controller
import { Request, Response } from 'express';
import prisma from '../config/database';
import { ValidationError } from '../errors';

/**
 * Create component for a style
 * POST /api/styles/:styleId/components
 */
export const createComponent = async (req: Request, res: Response): Promise<void> => {
  const { styleId } = req.params;
  const { componentName, componentType, sortOrder } = req.body;

  if (!componentName || !componentType) {
    throw new ValidationError('componentName and componentType are required');
  }

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
 */
export const updateComponent = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { componentName, componentType, sortOrder } = req.body;

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
 */
export const createFabric = async (req: Request, res: Response): Promise<void> => {
  const { componentId } = req.params;
  const { fabricName, fabricType, fabricColor, fabricGSM, cadAverageMeters, cadAverageYards, supplierName, unitPrice } =
    req.body;

  if (!fabricName || !fabricType) {
    throw new ValidationError('fabricName and fabricType are required');
  }

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
 */
export const updateFabric = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { fabricName, fabricType, fabricColor, fabricGSM, cadAverageMeters, cadAverageYards, supplierName, unitPrice } =
    req.body;

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
 */
export const createAccessory = async (req: Request, res: Response): Promise<void> => {
  const { componentId } = req.params;
  const { accessoryName, accessoryType, quantityPerPiece, unit, supplierName, unitPrice } = req.body;

  if (!accessoryName || !accessoryType || !quantityPerPiece || !unit) {
    throw new ValidationError('accessoryName, accessoryType, quantityPerPiece, and unit are required');
  }

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
 */
export const updateAccessory = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { accessoryName, accessoryType, quantityPerPiece, unit, supplierName, unitPrice } = req.body;

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
 */
export const createProcess = async (req: Request, res: Response): Promise<void> => {
  const { styleId } = req.params;
  const { processName, processType, isRequired, sortOrder, supplierId, estimatedCost, estimatedDays, notes } = req.body;

  if (!processName) {
    throw new ValidationError('processName is required');
  }

  const process = await prisma.style_processes.create({
    data: {
      styleId,
      processName,
      processType: processType || processName,
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
 */
export const updateProcess = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { processName, processType, isRequired, sortOrder, supplierId, estimatedCost, estimatedDays, notes } = req.body;

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
