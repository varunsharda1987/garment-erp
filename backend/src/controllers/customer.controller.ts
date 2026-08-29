/**
 * Customer Management Controller
 * Handles HTTP requests and delegates business logic to CustomerService
 */

import { Request, Response } from 'express';
import { CustomerType, CustomerCategory } from '@prisma/client';
import { customerService } from '../services/customer.service';

/**
 * Create new customer
 * POST /api/customers
 */
export const createCustomer = async (req: Request, res: Response): Promise<void> => {
  const customer = await customerService.createWithRelations(req.body, req.user!.userId);

  res.status(201).json({
    data: customer,
    message: 'Customer created successfully',
  });
};

/**
 * Get all customers with pagination and search
 * GET /api/customers
 */
export const getAllCustomers = async (req: Request, res: Response): Promise<void> => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const search = req.query.search as string;
  const type = req.query.type as CustomerType;
  const category = req.query.category as CustomerCategory;

  const result = await customerService.findAllWithFilters({
    page,
    limit,
    search,
    type,
    category,
  });

  res.status(200).json(result);
};

/**
 * Get customer by ID
 * GET /api/customers/:id
 */
export const getCustomerById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const customer = await customerService.findByIdOrThrow(id);

  res.status(200).json({ data: customer });
};

/**
 * Update customer
 * PUT /api/customers/:id
 */
export const updateCustomer = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const customer = await customerService.updateWithRelations(id, req.body);

  res.status(200).json({
    data: customer,
    message: 'Customer updated successfully',
  });
};

/**
 * Delete customer (soft delete)
 * DELETE /api/customers/:id
 */
export const deleteCustomer = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  await customerService.softDelete(id);

  res.status(200).json({
    message: 'Customer deleted successfully',
  });
};

/**
 * Get all accessory presets for a customer
 * GET /api/customers/:id/accessory-presets
 */
export const getCustomerAccessoryPresets = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const presets = await customerService.getAccessoryPresets(id);

  res.status(200).json({
    data: presets,
    message: 'Accessory presets retrieved successfully',
  });
};

/**
 * Create new accessory preset for a customer
 * POST /api/customers/:id/accessory-presets
 */
export const createAccessoryPreset = async (req: Request, res: Response): Promise<void> => {
  const { id: customerId } = req.params;
  const preset = await customerService.createAccessoryPreset(customerId, req.body);

  res.status(201).json({
    data: preset,
    message: 'Accessory preset created successfully',
  });
};

/**
 * Update accessory preset
 * PUT /api/customers/:id/accessory-presets/:presetId
 */
export const updateAccessoryPreset = async (req: Request, res: Response): Promise<void> => {
  const { id: customerId, presetId } = req.params;
  const preset = await customerService.updateAccessoryPreset(customerId, presetId, req.body);

  res.status(200).json({
    data: preset,
    message: 'Accessory preset updated successfully',
  });
};

/**
 * Delete accessory preset
 * DELETE /api/customers/:id/accessory-presets/:presetId
 */
export const deleteAccessoryPreset = async (req: Request, res: Response): Promise<void> => {
  const { presetId } = req.params;
  await customerService.deleteAccessoryPreset(presetId);

  res.status(200).json({
    message: 'Accessory preset deleted successfully',
  });
};

/**
 * Check if customer can be deactivated
 * GET /api/customers/:id/can-deactivate
 */
export const canDeactivateCustomer = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const validation = await customerService.validateDeactivation(id);

  const message = validation.canDeactivate
    ? 'Customer can be deactivated'
    : `Cannot deactivate. Please resolve: ${validation.blockers.map((b) => `${b.count} ${b.type}`).join(', ')}`;

  res.status(200).json({
    canDeactivate: validation.canDeactivate,
    blockers: validation.blockers,
    message,
  });
};

/**
 * Get sample requirements for a customer
 * GET /api/customers/:id/sample-requirements
 */
export const getSampleRequirements = async (req: Request, res: Response): Promise<void> => {
  const { id: customerId } = req.params;
  const requirements = await customerService.getSampleRequirements(customerId);

  res.status(200).json({
    data: requirements,
  });
};

/**
 * Upsert sample requirements for a customer (bulk)
 * PUT /api/customers/:id/sample-requirements
 */
export const upsertSampleRequirements = async (req: Request, res: Response): Promise<void> => {
  const { id: customerId } = req.params;
  const { requirements } = req.body;
  const updated = await customerService.upsertSampleRequirements(customerId, requirements);

  res.status(200).json({
    data: updated,
    message: 'Sample requirements updated successfully',
  });
};
