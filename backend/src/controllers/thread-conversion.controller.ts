/**
import { logger } from '../utils/logger';
 * Thread Conversion Utility Controller
 *
 * API endpoint for real-time thread quantity conversions
 */

import { Request, Response } from 'express';
import * as threadConversionService from '../services/thread-conversion.service';

/**
 * POST /api/materials/thread/convert
 * Convert between units, boxes, and meters
 */
export async function convertThreadQuantity(req: Request, res: Response) {
  try {
    const { ply, packagingType, inputType, value } = req.body;

    // Validate inputs
    if (!ply || !packagingType || !inputType || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: ply, packagingType, inputType, value',
      });
    }

    let conversion;

    // Convert based on input type
    switch (inputType) {
      case 'UNITS':
        conversion = await threadConversionService.convertUnitsToAll(value, ply, packagingType);
        break;
      case 'BOXES':
        conversion = await threadConversionService.convertBoxesToAll(value, ply, packagingType);
        break;
      case 'METERS':
        conversion = await threadConversionService.convertMetersToAll(value, ply, packagingType);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid inputType. Must be UNITS, BOXES, or METERS',
        });
    }

    res.json({
      success: true,
      data: conversion,
    });
  } catch (error: any) {
    logger.error('Error converting thread quantity:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to convert thread quantity',
    });
  }
}

/**
 * GET /api/materials/thread/packaging-specs
 * Get all active packaging specifications
 */
export async function getPackagingSpecs(req: Request, res: Response) {
  try {
    const specs = await threadConversionService.getAllPackagingSpecs();

    res.json({
      success: true,
      data: specs,
    });
  } catch (error: any) {
    logger.error('Error fetching packaging specs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch packaging specs',
    });
  }
}

export default {
  convertThreadQuantity,
  getPackagingSpecs,
};
