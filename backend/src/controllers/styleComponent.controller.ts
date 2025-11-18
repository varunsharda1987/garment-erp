// Style Component controller
import { Request, Response } from 'express';
import prisma from '../config/database';

/**
 * Create component for a style
 * POST /api/styles/:styleId/components
 */
export const createComponent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId } = req.params;
    const { componentName, componentType, sortOrder } = req.body;

    if (!componentName || !componentType) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'componentName and componentType are required',
      });
      return;
    }

    const component = await prisma.style_components.create({
      data: {
        styleId,
        componentName,
        componentType,
        sortOrder: sortOrder || 0,
      },
      include: {
        style_fabrics: true,
        style_accessories: true,
      },
    });

    res.status(201).json({
      data: component,
      message: 'Component created successfully',
    });
  } catch (error) {
    console.error('Create component error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create component',
    });
  }
};

/**
 * Update component
 * PUT /api/components/:id
 */
export const updateComponent = async (req: Request, res: Response): Promise<void> => {
  try {
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
  } catch (error) {
    console.error('Update component error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update component',
    });
  }
};

/**
 * Delete component
 * DELETE /api/components/:id
 */
export const deleteComponent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.style_components.delete({
      where: { id },
    });

    res.status(200).json({
      message: 'Component deleted successfully',
    });
  } catch (error) {
    console.error('Delete component error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete component',
    });
  }
};

/**
 * Create fabric for a component
 * POST /api/components/:componentId/fabrics
 */
export const createFabric = async (req: Request, res: Response): Promise<void> => {
  try {
    const { componentId } = req.params;
    const {
      fabricName,
      fabricType,
      fabricColor,
      fabricGSM,
      fabricWidth,
      cadAverageMeters,
      cadAverageYards,
      supplierName,
      unitPrice,
    } = req.body;

    if (!fabricName || !fabricType) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'fabricName and fabricType are required',
      });
      return;
    }

    const fabric = await prisma.style_fabrics.create({
      data: {
        componentId,
        fabricName,
        fabricType,
        fabricColor,
        fabricGSM,
        fabricWidth,
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
  } catch (error) {
    console.error('Create fabric error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create fabric',
    });
  }
};

/**
 * Update fabric (including CAD averages)
 * PUT /api/fabrics/:id
 */
export const updateFabric = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      fabricName,
      fabricType,
      fabricColor,
      fabricGSM,
      fabricWidth,
      cadAverageMeters,
      cadAverageYards,
      supplierName,
      unitPrice,
    } = req.body;

    const fabric = await prisma.style_fabrics.update({
      where: { id },
      data: {
        fabricName,
        fabricType,
        fabricColor,
        fabricGSM,
        fabricWidth,
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
  } catch (error) {
    console.error('Update fabric error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update fabric',
    });
  }
};

/**
 * Delete fabric
 * DELETE /api/fabrics/:id
 */
export const deleteFabric = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.style_fabrics.delete({
      where: { id },
    });

    res.status(200).json({
      message: 'Fabric deleted successfully',
    });
  } catch (error) {
    console.error('Delete fabric error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete fabric',
    });
  }
};

/**
 * Create accessory for a component
 * POST /api/components/:componentId/accessories
 */
export const createAccessory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { componentId } = req.params;
    const {
      accessoryName,
      accessoryType,
      quantityPerPiece,
      unit,
      supplierName,
      unitPrice,
    } = req.body;

    if (!accessoryName || !accessoryType || !quantityPerPiece || !unit) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'accessoryName, accessoryType, quantityPerPiece, and unit are required',
      });
      return;
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
  } catch (error) {
    console.error('Create accessory error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create accessory',
    });
  }
};

/**
 * Update accessory
 * PUT /api/accessories/:id
 */
export const updateAccessory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      accessoryName,
      accessoryType,
      quantityPerPiece,
      unit,
      supplierName,
      unitPrice,
    } = req.body;

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
  } catch (error) {
    console.error('Update accessory error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update accessory',
    });
  }
};

/**
 * Delete accessory
 * DELETE /api/accessories/:id
 */
export const deleteAccessory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.style_accessories.delete({
      where: { id },
    });

    res.status(200).json({
      message: 'Accessory deleted successfully',
    });
  } catch (error) {
    console.error('Delete accessory error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete accessory',
    });
  }
};

/**
 * Create process for a style
 * POST /api/styles/:styleId/processes
 */
export const createProcess = async (req: Request, res: Response): Promise<void> => {
  try {
    const { styleId } = req.params;
    const {
      processName,
      processType,
      isRequired,
      sortOrder,
      vendorName,
      estimatedCost,
      estimatedDays,
      notes,
    } = req.body;

    if (!processName) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'processName is required',
      });
      return;
    }

    const process = await prisma.style_processes.create({
      data: {
        styleId,
        processName,
        processType: processType || processName,
        isRequired: isRequired !== false,
        sortOrder: sortOrder || 0,
        vendorName,
        estimatedCost,
        estimatedDays,
        notes,
      },
    });

    res.status(201).json({
      data: process,
      message: 'Process created successfully',
    });
  } catch (error) {
    console.error('Create process error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create process',
    });
  }
};

/**
 * Update process
 * PUT /api/processes/:id
 */
export const updateProcess = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      processName,
      processType,
      isRequired,
      sortOrder,
      vendorName,
      estimatedCost,
      estimatedDays,
      notes,
    } = req.body;

    const process = await prisma.style_processes.update({
      where: { id },
      data: {
        processName,
        processType,
        isRequired,
        sortOrder,
        vendorName,
        estimatedCost,
        estimatedDays,
        notes,
      },
    });

    res.status(200).json({
      data: process,
      message: 'Process updated successfully',
    });
  } catch (error) {
    console.error('Update process error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update process',
    });
  }
};

/**
 * Delete process
 * DELETE /api/processes/:id
 */
export const deleteProcess = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.style_processes.delete({
      where: { id },
    });

    res.status(200).json({
      message: 'Process deleted successfully',
    });
  } catch (error) {
    console.error('Delete process error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete process',
    });
  }
};
