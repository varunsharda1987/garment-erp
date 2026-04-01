/**
 * Thread Conversion Service
 *
 * Core logic for thread quantity conversions:
 * - Boxes ↔ Units ↔ Meters
 * - Packaging spec lookups
 * - Validation functions
 *
 * This is the BRAIN of the Thread Material module.
 */

import { ThreadPly, ThreadPackagingType } from '@prisma/client';
import prisma from '../config/database';

// ==================== TYPES ====================

export interface ThreadPackagingSpec {
  ply: ThreadPly;
  packagingType: ThreadPackagingType;
  unitsPerBox: number;
  metersPerUnit: number;
}

export interface ThreadQuantityConversion {
  totalUnits: number;
  totalBoxes: number;
  totalMeters: number;
}

export interface ThreadQuantityInput {
  inputType: 'UNITS' | 'BOXES';
  unitsOrdered?: number;
  boxesOrdered?: number;
}

// ==================== PACKAGING SPEC LOOKUP ====================

/**
 * Get packaging specifications from database
 * Fallback to hardcoded values if database lookup fails
 */
export async function getPackagingSpec(
  ply: ThreadPly,
  packagingType: ThreadPackagingType
): Promise<ThreadPackagingSpec> {
  try {
    const spec = await prisma.thread_packaging_specs.findUnique({
      where: {
        ply_packagingType: { ply, packagingType },
      },
    });

    if (spec && spec.isActive) {
      return {
        ply: spec.ply,
        packagingType: spec.packagingType,
        unitsPerBox: spec.unitsPerBox,
        metersPerUnit: parseFloat(spec.metersPerUnit.toString()),
      };
    }
  } catch (error) {
    console.warn(`Database lookup failed for ${ply} ${packagingType}, using hardcoded fallback:`, error);
  }

  // Fallback to hardcoded specs
  return getHardcodedPackagingSpec(ply, packagingType);
}

/**
 * Hardcoded packaging specs (fallback)
 */
function getHardcodedPackagingSpec(ply: ThreadPly, packagingType: ThreadPackagingType): ThreadPackagingSpec {
  const specs: Record<string, ThreadPackagingSpec> = {
    THREE_PLY_SPOOL: { ply: 'THREE_PLY', packagingType: 'SPOOL', unitsPerBox: 15, metersPerUnit: 400 },
    THREE_PLY_CONE_5K: { ply: 'THREE_PLY', packagingType: 'CONE_5K', unitsPerBox: 10, metersPerUnit: 5000 },
    THREE_PLY_CONE_10K: { ply: 'THREE_PLY', packagingType: 'CONE_10K', unitsPerBox: 10, metersPerUnit: 10000 },
    TWO_PLY_SPOOL: { ply: 'TWO_PLY', packagingType: 'SPOOL', unitsPerBox: 10, metersPerUnit: 800 },
    TWO_PLY_CONE_5K: { ply: 'TWO_PLY', packagingType: 'CONE_5K', unitsPerBox: 10, metersPerUnit: 5000 },
    TWO_PLY_CONE_10K: { ply: 'TWO_PLY', packagingType: 'CONE_10K', unitsPerBox: 10, metersPerUnit: 10000 },
    // Legacy CONE mapping (default to CONE_5K)
    THREE_PLY_CONE: { ply: 'THREE_PLY', packagingType: 'CONE', unitsPerBox: 10, metersPerUnit: 5000 },
    TWO_PLY_CONE: { ply: 'TWO_PLY', packagingType: 'CONE', unitsPerBox: 10, metersPerUnit: 5000 },
    // Legacy TUBE mapping (default to small spool)
    THREE_PLY_TUBE: { ply: 'THREE_PLY', packagingType: 'TUBE', unitsPerBox: 15, metersPerUnit: 400 },
    TWO_PLY_TUBE: { ply: 'TWO_PLY', packagingType: 'TUBE', unitsPerBox: 10, metersPerUnit: 800 },
  };

  const key = `${ply}_${packagingType}`;
  const spec = specs[key];

  if (!spec) {
    throw new Error(
      `No packaging specification found for ${ply} ${packagingType}. ` +
        `Valid combinations: ${Object.keys(specs).join(', ')}`
    );
  }

  return spec;
}

/**
 * Get all active packaging specs
 */
export async function getAllPackagingSpecs(): Promise<ThreadPackagingSpec[]> {
  const specs = await prisma.thread_packaging_specs.findMany({
    where: { isActive: true },
    orderBy: [{ ply: 'asc' }, { packagingType: 'asc' }],
  });

  return specs.map((spec) => ({
    ply: spec.ply,
    packagingType: spec.packagingType,
    unitsPerBox: spec.unitsPerBox,
    metersPerUnit: parseFloat(spec.metersPerUnit.toString()),
  }));
}

// ==================== CONVERSION FUNCTIONS ====================

/**
 * Convert boxes to units and meters
 *
 * @param boxes - Number of boxes
 * @param ply - Thread ply (2-PLY or 3-PLY)
 * @param packagingType - Packaging type (SPOOL, CONE_5K, CONE_10K)
 * @returns Conversion result with total units, boxes, and meters
 *
 * @example
 * convertBoxesToAll(2, 'THREE_PLY', 'SPOOL')
 * // Returns: { totalUnits: 30, totalBoxes: 2, totalMeters: 12000 }
 */
export async function convertBoxesToAll(
  boxes: number,
  ply: ThreadPly,
  packagingType: ThreadPackagingType
): Promise<ThreadQuantityConversion> {
  if (boxes < 0) {
    throw new Error('Boxes cannot be negative');
  }

  const spec = await getPackagingSpec(ply, packagingType);
  const totalUnits = boxes * spec.unitsPerBox;
  const totalMeters = totalUnits * spec.metersPerUnit;

  return {
    totalUnits,
    totalBoxes: boxes,
    totalMeters,
  };
}

/**
 * Convert units (spools/cones) to boxes and meters
 *
 * @param units - Number of units (spools or cones)
 * @param ply - Thread ply (2-PLY or 3-PLY)
 * @param packagingType - Packaging type (SPOOL, CONE_5K, CONE_10K)
 * @returns Conversion result with total units, boxes (may be fractional), and meters
 *
 * @example
 * convertUnitsToAll(30, 'THREE_PLY', 'SPOOL')
 * // Returns: { totalUnits: 30, totalBoxes: 2, totalMeters: 12000 }
 */
export async function convertUnitsToAll(
  units: number,
  ply: ThreadPly,
  packagingType: ThreadPackagingType
): Promise<ThreadQuantityConversion> {
  if (units < 0) {
    throw new Error('Units cannot be negative');
  }

  const spec = await getPackagingSpec(ply, packagingType);
  const totalBoxes = units / spec.unitsPerBox;
  const totalMeters = units * spec.metersPerUnit;

  return {
    totalUnits: units,
    totalBoxes,
    totalMeters,
  };
}

/**
 * Convert meters to units and boxes
 *
 * @param meters - Number of meters
 * @param ply - Thread ply (2-PLY or 3-PLY)
 * @param packagingType - Packaging type (SPOOL, CONE_5K, CONE_10K)
 * @returns Conversion result with total units (may be fractional), boxes, and meters
 *
 * @example
 * convertMetersToAll(12000, 'THREE_PLY', 'SPOOL')
 * // Returns: { totalUnits: 30, totalBoxes: 2, totalMeters: 12000 }
 */
export async function convertMetersToAll(
  meters: number,
  ply: ThreadPly,
  packagingType: ThreadPackagingType
): Promise<ThreadQuantityConversion> {
  if (meters < 0) {
    throw new Error('Meters cannot be negative');
  }

  const spec = await getPackagingSpec(ply, packagingType);
  const totalUnits = meters / spec.metersPerUnit;
  const totalBoxes = totalUnits / spec.unitsPerBox;

  return {
    totalUnits,
    totalBoxes,
    totalMeters: meters,
  };
}

// ==================== VALIDATION ====================

/**
 * Validate thread quantity input
 *
 * Rules:
 * - If inputType is UNITS, unitsOrdered must be provided
 * - If inputType is BOXES, boxesOrdered must be provided
 * - Cannot specify both units AND boxes (must choose one)
 *
 * @throws Error if validation fails
 */
export function validateThreadQuantityInput(input: ThreadQuantityInput): void {
  const { inputType, unitsOrdered, boxesOrdered } = input;

  // Check: Must specify input type
  if (!inputType) {
    throw new Error('Input type is required (UNITS or BOXES)');
  }

  // Check: If input type is UNITS, unitsOrdered must be provided
  if (inputType === 'UNITS' && (unitsOrdered === undefined || unitsOrdered === null)) {
    throw new Error('Units are required when inputType is UNITS');
  }

  // Check: If input type is BOXES, boxesOrdered must be provided
  if (inputType === 'BOXES' && (boxesOrdered === undefined || boxesOrdered === null)) {
    throw new Error('Boxes are required when inputType is BOXES');
  }

  // Check: Cannot specify both
  if (unitsOrdered !== undefined && unitsOrdered !== null && boxesOrdered !== undefined && boxesOrdered !== null) {
    throw new Error('Cannot specify both units and boxes. Choose one input type.');
  }

  // Check: Values must be positive
  if (inputType === 'UNITS' && unitsOrdered! <= 0) {
    throw new Error('Units must be greater than 0');
  }

  if (inputType === 'BOXES' && boxesOrdered! <= 0) {
    throw new Error('Boxes must be greater than 0');
  }
}

/**
 * Process thread quantity input and return conversion
 *
 * @param input - Thread quantity input (either units or boxes)
 * @param ply - Thread ply
 * @param packagingType - Packaging type
 * @returns Conversion result
 */
export async function processThreadQuantityInput(
  input: ThreadQuantityInput,
  ply: ThreadPly,
  packagingType: ThreadPackagingType
): Promise<ThreadQuantityConversion> {
  // Validate first
  validateThreadQuantityInput(input);

  // Convert based on input type
  if (input.inputType === 'UNITS') {
    return convertUnitsToAll(input.unitsOrdered!, ply, packagingType);
  } else {
    return convertBoxesToAll(input.boxesOrdered!, ply, packagingType);
  }
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Round boxes to nearest full box (for purchase orders)
 *
 * @param boxes - Number of boxes (may be fractional)
 * @param roundUp - If true, round up; otherwise round down
 * @returns Rounded number of boxes
 */
export function roundBoxes(boxes: number, roundUp: boolean = true): number {
  return roundUp ? Math.ceil(boxes) : Math.floor(boxes);
}

/**
 * Calculate suggested reorder quantity in boxes
 *
 * @param shortageUnits - Number of units short
 * @param ply - Thread ply
 * @param packagingType - Packaging type
 * @param buffer - Additional buffer percentage (e.g., 0.1 for 10% extra)
 * @returns Suggested boxes to order (rounded up)
 */
export async function calculateReorderQuantity(
  shortageUnits: number,
  ply: ThreadPly,
  packagingType: ThreadPackagingType,
  buffer: number = 0.1
): Promise<number> {
  const spec = await getPackagingSpec(ply, packagingType);
  const unitsWithBuffer = shortageUnits * (1 + buffer);
  const boxes = unitsWithBuffer / spec.unitsPerBox;
  return Math.ceil(boxes); // Always round up for reorders
}

// ==================== EXPORTS ====================

export default {
  getPackagingSpec,
  getAllPackagingSpecs,
  convertBoxesToAll,
  convertUnitsToAll,
  convertMetersToAll,
  validateThreadQuantityInput,
  processThreadQuantityInput,
  roundBoxes,
  calculateReorderQuantity,
};
