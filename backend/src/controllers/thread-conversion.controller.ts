/**
 * Thread Conversion Utility Controller
 *
 * API endpoint for real-time thread quantity conversions
 */

import { Request, Response } from 'express';
import * as threadConversionService from '../services/thread-conversion.service';
import { ValidationError } from '../errors';

/**
 * POST /api/materials/thread/convert
 * Convert between units, boxes, and meters
 */
export async function convertThreadQuantity(req: Request, res: Response) {
  const { ply, packagingType, inputType, value } = req.body;

  // Validate inputs
  if (!ply || !packagingType || !inputType || value === undefined) {
    throw new ValidationError('Missing required fields: ply, packagingType, inputType, value');
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
      throw new ValidationError('Invalid inputType. Must be UNITS, BOXES, or METERS');
  }

  res.json({
    success: true,
    data: conversion,
  });
}

/**
 * GET /api/materials/thread/packaging-specs
 * Get all active packaging specifications
 */
export async function getPackagingSpecs(req: Request, res: Response) {
  const specs = await threadConversionService.getAllPackagingSpecs();

  res.json({
    success: true,
    data: specs,
  });
}

export default {
  convertThreadQuantity,
  getPackagingSpecs,
};
