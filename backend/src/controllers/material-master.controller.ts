import { Request, Response } from 'express';
import * as materialMasterService from '../services/material-master.service';
import { MaterialType } from '@prisma/client';
import { NotFoundError, ValidationError } from '../errors';

/**
 * Unified Material Master Controller
 * Handles all material types through a single endpoint
 * Replaces 31 individual controllers (lace, button, thread, etc.)
 */

// GET /api/materials?type=LACE&active=true&search=floral
export const getAllMaterials = async (req: Request, res: Response) => {
  const { type, active, search, supplierId } = req.query;

  const materials = await materialMasterService.findAll({
    materialType: type as MaterialType,
    isActive: active === 'true',
    searchTerm: search as string,
    supplierId: supplierId as string,
  });

  res.json(materials);
};

// GET /api/materials/:id
export const getMaterialById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const material = await materialMasterService.findById(parseInt(id));

  if (!material) {
    throw new NotFoundError('Material', id);
  }

  res.json(material);
};

// POST /api/materials
export const createMaterial = async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const material = await materialMasterService.create(req.body, userId);

  res.status(201).json(material);
};

// PUT /api/materials/:id
export const updateMaterial = async (req: Request, res: Response) => {
  const { id } = req.params;
  const material = await materialMasterService.update(parseInt(id), req.body);

  res.json(material);
};

// DELETE /api/materials/:id (soft delete)
export const deleteMaterial = async (req: Request, res: Response) => {
  const { id } = req.params;
  await materialMasterService.softDelete(parseInt(id));

  res.status(204).send();
};

// GET /api/materials/:id/suppliers
export const getMaterialSuppliers = async (req: Request, res: Response) => {
  const { id } = req.params;
  const suppliers = await materialMasterService.getSuppliers(parseInt(id));

  res.json(suppliers);
};

// POST /api/materials/:id/suppliers
export const addMaterialSupplier = async (req: Request, res: Response) => {
  const { id } = req.params;
  const mapping = await materialMasterService.addSupplier(
    parseInt(id),
    req.body
  );

  res.status(201).json(mapping);
};

// Type-specific operations

// GET /api/materials/types
export const getMaterialTypes = async (req: Request, res: Response) => {
  const types = Object.values(MaterialType);
  res.json(types);
};

// GET /api/materials/types/:type/count
export const getMaterialCountByType = async (req: Request, res: Response) => {
  const { type } = req.params;
  const count = await materialMasterService.countByType(type as MaterialType);

  res.json({ type, count });
};
