/**
 * Processor Rate Card Controller
 * Handles API endpoints for processor rate card management
 */

import { Request, Response } from 'express';
import {
  searchRateCards,
  createRateCard,
  updateRateCard,
  getProcessorsForType,
  getRatePreview,
  getProcessorRate,
} from '../services/processor-rate.service';
import { serializeResponse } from '../utils/serializer';

/**
 * GET /api/processor-rate-cards/search
 * Search rate cards with filters
 */
export async function searchProcessorRateCards(req: Request, res: Response) {
  try {
    const { processorId, processingType, fabricCategory, isActive, page, limit } = req.query;

    const result = await searchRateCards({
      processorId: processorId as string,
      processingType: processingType as string,
      fabricCategory: fabricCategory as string,
      isActive: isActive === 'false' ? false : true,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json(serializeResponse({
      success: true,
      ...result,
    }));
  } catch (error: any) {
    console.error('Error searching rate cards:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search rate cards',
    });
  }
}

/**
 * POST /api/processor-rate-cards
 * Create new rate card
 */
export async function createProcessorRateCard(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
    }

    const {
      processorId,
      processingType,
      fabricCategory,
      genericFabricName,
      minQuantityMeters,
      maxQuantityMeters,
      ratePerMeter,
      setupCharge,
      minimumCharge,
      turnaroundDays,
      conditions,
      priority,
      effectiveFrom,
      effectiveTo,
    } = req.body;

    // Validation
    if (!processorId || !processingType || !fabricCategory || !minQuantityMeters || !maxQuantityMeters || !ratePerMeter) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const rateCard = await createRateCard(
      {
        processorId,
        processingType,
        fabricCategory,
        genericFabricName,
        minQuantityMeters: parseFloat(minQuantityMeters),
        maxQuantityMeters: parseFloat(maxQuantityMeters),
        ratePerMeter: parseFloat(ratePerMeter),
        setupCharge: setupCharge ? parseFloat(setupCharge) : undefined,
        minimumCharge: minimumCharge ? parseFloat(minimumCharge) : undefined,
        turnaroundDays: turnaroundDays ? parseInt(turnaroundDays) : undefined,
        conditions,
        priority: priority ? parseInt(priority) : undefined,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : undefined,
        effectiveTo: effectiveTo ? new Date(effectiveTo) : undefined,
      },
      userId
    );

    res.status(201).json(serializeResponse({
      success: true,
      data: rateCard,
      message: 'Rate card created successfully',
    }));
  } catch (error: any) {
    console.error('Error creating rate card:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create rate card',
    });
  }
}

/**
 * PUT /api/processor-rate-cards/:id
 * Update rate card
 */
export async function updateProcessorRateCard(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { ratePerMeter, setupCharge, minimumCharge, turnaroundDays, conditions, priority, effectiveTo, isActive } = req.body;

    const updateData: any = {};
    if (ratePerMeter !== undefined) updateData.ratePerMeter = parseFloat(ratePerMeter);
    if (setupCharge !== undefined) updateData.setupCharge = parseFloat(setupCharge);
    if (minimumCharge !== undefined) updateData.minimumCharge = parseFloat(minimumCharge);
    if (turnaroundDays !== undefined) updateData.turnaroundDays = parseInt(turnaroundDays);
    if (conditions !== undefined) updateData.conditions = conditions;
    if (priority !== undefined) updateData.priority = parseInt(priority);
    if (effectiveTo !== undefined) updateData.effectiveTo = new Date(effectiveTo);
    if (isActive !== undefined) updateData.isActive = isActive;

    const rateCard = await updateRateCard(id, updateData);

    res.json(serializeResponse({
      success: true,
      data: rateCard,
      message: 'Rate card updated successfully',
    }));
  } catch (error: any) {
    console.error('Error updating rate card:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update rate card',
    });
  }
}

/**
 * GET /api/processor-rate-cards/processors/:processingType
 * Get available processors for a processing type
 */
export async function getProcessorsByType(req: Request, res: Response) {
  try {
    const { processingType } = req.params;

    const processors = await getProcessorsForType(processingType);

    res.json(serializeResponse({
      success: true,
      data: processors,
    }));
  } catch (error: any) {
    console.error('Error fetching processors:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch processors',
    });
  }
}

/**
 * GET /api/processor-rate-cards/preview
 * Get rate preview for specific processor and fabric
 */
export async function getProcessorRatePreview(req: Request, res: Response) {
  try {
    const { processorId, processingType, fabricCategory } = req.query;

    if (!processorId || !processingType || !fabricCategory) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameters: processorId, processingType, fabricCategory',
      });
    }

    const preview = await getRatePreview(
      processorId as string,
      processingType as string,
      fabricCategory as string
    );

    res.json(serializeResponse({
      success: true,
      data: preview,
    }));
  } catch (error: any) {
    console.error('Error fetching rate preview:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch rate preview',
    });
  }
}

/**
 * POST /api/processor-rate-cards/lookup
 * Lookup best rate for given parameters
 */
export async function lookupProcessorRate(req: Request, res: Response) {
  try {
    const { processorId, processingType, fabricCategory, quantityMeters, genericFabricName } = req.body;

    if (!processingType || !fabricCategory || !quantityMeters) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: processingType, fabricCategory, quantityMeters',
      });
    }

    const rate = await getProcessorRate({
      processorId,
      processingType,
      fabricCategory,
      quantityMeters: parseFloat(quantityMeters),
      genericFabricName,
    });

    if (!rate) {
      return res.status(404).json({
        success: false,
        error: 'No matching rate found for the given parameters',
      });
    }

    res.json(serializeResponse({
      success: true,
      data: rate,
    }));
  } catch (error: any) {
    console.error('Error looking up processor rate:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to lookup processor rate',
    });
  }
}

export default {
  searchProcessorRateCards,
  createProcessorRateCard,
  updateProcessorRateCard,
  getProcessorsByType,
  getProcessorRatePreview,
  lookupProcessorRate,
};
