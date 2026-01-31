import { Request, Response } from 'express';
import * as materialMasterService from '../services/material-master.service';
import { MaterialType } from '@prisma/client';

/**
 * Unified Material Master Controller
 * Handles all material types through a single endpoint
 * Replaces 31 individual controllers (lace, button, thread, etc.)
 */

// GET /api/materials?type=LACE&active=true&search=floral
export const getAllMaterials = async (req: Request, res: Response) => {
  try {
    const { type, active, search, supplierId } = req.query;

    const materials = await materialMasterService.findAll({
      materialType: type as MaterialType,
      isActive: active === 'true',
      searchTerm: search as string,
      supplierId: supplierId as string,
    });

    res.json(materials);
  } catch (error: any) {
    console.error('Error fetching materials:', error);
    res.status(500).json({ error: error.message });
  }
};

// GET /api/materials/:id
export const getMaterialById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const material = await materialMasterService.findById(parseInt(id));

    if (!material) {
      return res.status(404).json({ error: 'Material not found' });
    }

    res.json(material);
  } catch (error: any) {
    console.error('Error fetching material:', error);
    res.status(500).json({ error: error.message });
  }
};

// POST /api/materials
export const createMaterial = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const material = await materialMasterService.create(req.body, userId);

    res.status(201).json(material);
  } catch (error: any) {
    console.error('Error creating material:', error);
    res.status(400).json({ error: error.message });
  }
};

// PUT /api/materials/:id
export const updateMaterial = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const material = await materialMasterService.update(parseInt(id), req.body);

    res.json(material);
  } catch (error: any) {
    console.error('Error updating material:', error);
    res.status(400).json({ error: error.message });
  }
};

// DELETE /api/materials/:id (soft delete)
export const deleteMaterial = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await materialMasterService.softDelete(parseInt(id));

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting material:', error);
    res.status(400).json({ error: error.message });
  }
};

// GET /api/materials/:id/suppliers
export const getMaterialSuppliers = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const suppliers = await materialMasterService.getSuppliers(parseInt(id));

    res.json(suppliers);
  } catch (error: any) {
    console.error('Error fetching material suppliers:', error);
    res.status(500).json({ error: error.message });
  }
};

// POST /api/materials/:id/suppliers
export const addMaterialSupplier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const mapping = await materialMasterService.addSupplier(
      parseInt(id),
      req.body
    );

    res.status(201).json(mapping);
  } catch (error: any) {
    console.error('Error adding material supplier:', error);
    res.status(400).json({ error: error.message });
  }
};

// Type-specific operations

// GET /api/materials/types
export const getMaterialTypes = async (req: Request, res: Response) => {
  try {
    const types = Object.values(MaterialType);
    res.json(types);
  } catch (error: any) {
    console.error('Error fetching material types:', error);
    res.status(500).json({ error: error.message });
  }
};

// GET /api/materials/types/:type/count
export const getMaterialCountByType = async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const count = await materialMasterService.countByType(type as MaterialType);

    res.json({ type, count });
  } catch (error: any) {
    console.error('Error counting materials by type:', error);
    res.status(500).json({ error: error.message });
  }
};
