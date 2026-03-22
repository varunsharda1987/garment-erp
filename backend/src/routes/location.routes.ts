/**
 * Location Routes
 * API endpoints for Indian states and cities
 */

import express, { Request, Response, NextFunction } from 'express';
import { locationService, StateFilterOptions, CityFilterOptions } from '../services/location.service';
import { StateType, CityTier } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler';
import { ValidationError } from '../errors';

const router = express.Router();

// ============================================
// State Routes
// ============================================

/**
 * GET /api/locations/states
 * Get all states with optional filtering
 * Query params:
 *  - stateType: STATE | UNION_TERRITORY
 *  - isActive: true | false
 *  - includeCityCount: true | false
 */
router.get(
  '/states',
  asyncHandler(async (req: Request, res: Response) => {
    const { stateType, isActive, includeCityCount } = req.query;

    const options: StateFilterOptions = {
      ...(stateType && { stateType: stateType as StateType }),
      ...(isActive !== undefined && { isActive: isActive === 'true' }),
      ...(includeCityCount !== undefined && { includeCityCount: includeCityCount === 'true' }),
    };

    const states = await locationService.getAllStates(options);

    res.json({
      success: true,
      data: states,
      count: states.length,
    });
  })
);

/**
 * GET /api/locations/states/grouped
 * Get states grouped by type (states vs union territories)
 */
router.get(
  '/states/grouped',
  asyncHandler(async (req: Request, res: Response) => {
    const grouped = await locationService.getStatesGroupedByType();

    res.json({
      success: true,
      data: grouped,
    });
  })
);

/**
 * GET /api/locations/states/code/:stateCode
 * Get state by GST code
 */
router.get(
  '/states/code/:stateCode',
  asyncHandler(async (req: Request, res: Response) => {
    const { stateCode } = req.params;

    const state = await locationService.getStateByCode(stateCode);

    if (!state) {
      return res.status(404).json({
        success: false,
        message: `State not found for code: ${stateCode}`,
      });
    }

    res.json({
      success: true,
      data: state,
    });
  })
);

/**
 * GET /api/locations/states/:id
 * Get state by ID
 */
router.get(
  '/states/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const state = await locationService.getStateById(id);

    if (!state) {
      return res.status(404).json({
        success: false,
        message: `State not found: ${id}`,
      });
    }

    res.json({
      success: true,
      data: state,
    });
  })
);

// ============================================
// City Routes
// ============================================

/**
 * GET /api/locations/cities
 * Get cities with optional filtering
 * Query params:
 *  - stateId: string (filter by state)
 *  - tier: TIER_1 | TIER_2 | TIER_3
 *  - search: string (search city names)
 *  - isActive: true | false
 *  - includeState: true | false
 */
router.get(
  '/cities',
  asyncHandler(async (req: Request, res: Response) => {
    const { stateId, tier, search, isActive, includeState } = req.query;

    // If search query provided, use search method
    if (search) {
      const cities = await locationService.searchCities(search as string, stateId as string | undefined);

      return res.json({
        success: true,
        data: cities,
        count: cities.length,
      });
    }

    // If stateId provided, get cities by state
    if (stateId) {
      const options: CityFilterOptions = {
        ...(tier && { tier: tier as CityTier }),
        ...(isActive !== undefined && { isActive: isActive === 'true' }),
        ...(includeState !== undefined && { includeState: includeState === 'true' }),
      };

      const cities = await locationService.getCitiesByState(stateId as string, options);

      return res.json({
        success: true,
        data: cities,
        count: cities.length,
      });
    }

    // Otherwise get all cities
    const options: CityFilterOptions = {
      ...(tier && { tier: tier as CityTier }),
      ...(isActive !== undefined && { isActive: isActive === 'true' }),
      ...(includeState !== undefined && { includeState: includeState === 'true' }),
    };

    const cities = await locationService.getAllCities(options);

    res.json({
      success: true,
      data: cities,
      count: cities.length,
    });
  })
);

/**
 * GET /api/locations/cities/hubs
 * Get major garment manufacturing hubs (Tier 1 cities)
 */
router.get(
  '/cities/hubs',
  asyncHandler(async (req: Request, res: Response) => {
    const hubs = await locationService.getGarmentHubs();

    res.json({
      success: true,
      data: hubs,
      count: hubs.length,
    });
  })
);

/**
 * GET /api/locations/cities/:id
 * Get city by ID
 */
router.get(
  '/cities/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const city = await locationService.getCityById(id);

    if (!city) {
      return res.status(404).json({
        success: false,
        message: `City not found: ${id}`,
      });
    }

    res.json({
      success: true,
      data: city,
    });
  })
);

// ============================================
// Validation Routes
// ============================================

/**
 * GET /api/locations/validate/state/:id
 * Validate if a state ID exists and is active
 */
router.get(
  '/validate/state/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const isValid = await locationService.validateStateId(id);

    res.json({
      success: true,
      data: { isValid },
    });
  })
);

/**
 * GET /api/locations/validate/city/:id
 * Validate if a city ID exists and is active
 */
router.get(
  '/validate/city/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const isValid = await locationService.validateCityId(id);

    res.json({
      success: true,
      data: { isValid },
    });
  })
);

export default router;
