/**
 * Order Thread Requirement Controller
 *
 * REST API endpoints for managing order-level thread requirements
 */

import { Request, Response } from 'express';
import * as orderThreadRequirementService from '../services/order-thread-requirement.service';

// ==================== CRUD ENDPOINTS ====================

/**
 * POST /api/orders/:orderId/thread-requirements
 * Create a new thread requirement for an order
 */
export async function createThreadRequirement(req: Request, res: Response) {
  try {
    const { orderId } = req.params;
    const data = { ...req.body, orderId };

    const requirement = await orderThreadRequirementService.createThreadRequirement(data);

    res.status(201).json({
      success: true,
      data: requirement,
      message: 'Thread requirement created successfully',
    });
  } catch (error: any) {
    console.error('Error creating thread requirement:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create thread requirement',
    });
  }
}

/**
 * GET /api/orders/:orderId/thread-requirements
 * Get all thread requirements for an order
 */
export async function getThreadRequirements(req: Request, res: Response) {
  try {
    const { orderId } = req.params;

    const requirements = await orderThreadRequirementService.getThreadRequirements(orderId);

    // Calculate summary
    const summary = {
      totalLineItems: requirements.length,
      totalMeters: requirements.reduce((sum, r) => sum + r.totalMeters, 0),
      totalCost: requirements.reduce((sum, r) => sum + (r.totalCost || 0), 0),
    };

    res.json({
      success: true,
      data: requirements,
      summary,
    });
  } catch (error: any) {
    console.error('Error fetching thread requirements:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch thread requirements',
    });
  }
}

/**
 * GET /api/orders/:orderId/thread-requirements/:id
 * Get a single thread requirement by ID
 */
export async function getThreadRequirement(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const requirement = await orderThreadRequirementService.getThreadRequirement(id);

    if (!requirement) {
      return res.status(404).json({
        success: false,
        error: 'Thread requirement not found',
      });
    }

    res.json({
      success: true,
      data: requirement,
    });
  } catch (error: any) {
    console.error('Error fetching thread requirement:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch thread requirement',
    });
  }
}

/**
 * PUT /api/orders/:orderId/thread-requirements/:id
 * Update a thread requirement
 */
export async function updateThreadRequirement(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const data = req.body;

    const requirement = await orderThreadRequirementService.updateThreadRequirement(id, data);

    res.json({
      success: true,
      data: requirement,
      message: 'Thread requirement updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating thread requirement:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update thread requirement',
    });
  }
}

/**
 * DELETE /api/orders/:orderId/thread-requirements/:id
 * Delete a thread requirement
 */
export async function deleteThreadRequirement(req: Request, res: Response) {
  try {
    const { id } = req.params;

    await orderThreadRequirementService.deleteThreadRequirement(id);

    res.json({
      success: true,
      message: 'Thread requirement deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting thread requirement:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete thread requirement',
    });
  }
}

// ==================== SHORTAGE DETECTION ====================

/**
 * POST /api/orders/:orderId/thread-requirements/check-shortage
 * Check stock shortages for all thread requirements in an order
 */
export async function checkShortages(req: Request, res: Response) {
  try {
    const { orderId } = req.params;

    const shortages = await orderThreadRequirementService.checkShortages(orderId);

    res.json({
      success: true,
      data: shortages,
      summary: {
        totalShortages: shortages.length,
        hasShortages: shortages.length > 0,
      },
    });
  } catch (error: any) {
    console.error('Error checking shortages:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check shortages',
    });
  }
}

// ==================== SKU GENERATION ====================

/**
 * GET /api/orders/:orderId/thread-requirements/:threadId/sku
 * Generate style-specific SKU for a thread
 */
export async function generateStyleSpecificSKU(req: Request, res: Response) {
  try {
    const { orderId, threadId } = req.params;

    const sku = await orderThreadRequirementService.generateStyleSpecificSKU(threadId, orderId);

    res.json({
      success: true,
      data: { sku },
    });
  } catch (error: any) {
    console.error('Error generating SKU:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate SKU',
    });
  }
}

export default {
  createThreadRequirement,
  getThreadRequirements,
  getThreadRequirement,
  updateThreadRequirement,
  deleteThreadRequirement,
  checkShortages,
  generateStyleSpecificSKU,
};
