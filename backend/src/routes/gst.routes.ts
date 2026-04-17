/**
 * GST Routes
 * API endpoints for GST validation and tax calculation
 */

import express, { Request, Response } from 'express';
import { gstService } from '../services/gst.service';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validation.middleware';
import { ValidationError } from '../errors';
import {
  validateGSTSchema,
  calculateGSTSchema,
  getDefaultRateSchema,
  calculateBulkGSTSchema,
  type ValidateGSTInput,
  type CalculateGSTInput,
  type CalculateBulkGSTInput,
} from '../schemas/gst.schema';

const router = express.Router();

// ============================================
// GST Validation Routes
// ============================================

/**
 * POST /api/gst/validate
 * Validate GST number format and state code match
 *
 * Body:
 *  - gstNumber: string (15 characters)
 *  - stateCode: string (2 digits)
 */
router.post(
  '/validate',
  validateBody(validateGSTSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { gstNumber, stateCode } = req.body as ValidateGSTInput;

    // Validate GST number
    const isValid = gstService.validateGSTNumber(gstNumber, stateCode);

    res.json({
      success: true,
      data: {
        isValid,
        gstNumber,
        stateCode,
        message: isValid
          ? 'GST number is valid and matches state code'
          : 'GST number is invalid or does not match state code',
      },
    });
  })
);

/**
 * GET /api/gst/extract-state/:gstNumber
 * Extract state code from GST number
 */
router.get(
  '/extract-state/:gstNumber',
  asyncHandler(async (req: Request, res: Response) => {
    const { gstNumber } = req.params;

    if (!gstNumber || gstNumber.length !== 15) {
      throw new ValidationError('GST number must be exactly 15 characters');
    }

    const stateCode = gstService.extractStateCodeFromGST(gstNumber);

    if (!stateCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid GST number format',
      });
    }

    res.json({
      success: true,
      data: {
        gstNumber,
        stateCode,
      },
    });
  })
);

// ============================================
// GST Calculation Routes
// ============================================

/**
 * POST /api/gst/calculate
 * Calculate GST breakdown (CGST/SGST or IGST)
 *
 * Body:
 *  - amount: number (taxable amount)
 *  - taxRate: number (total tax rate, e.g., 12, 18, 28)
 *  - supplierStateId: string (seller's state)
 *  - customerStateId: string (buyer's state)
 */
router.post(
  '/calculate',
  validateBody(calculateGSTSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { amount, taxRate, supplierStateId, customerStateId } = req.body as CalculateGSTInput;

    // Calculate GST breakdown
    const calculation = await gstService.calculateGST(amount, taxRate, supplierStateId, customerStateId);

    res.json({
      success: true,
      data: calculation,
    });
  })
);

/**
 * POST /api/gst/default-rate
 * Get default GST rate for a product
 *
 * Body:
 *  - hsnCode: string (optional HSN/SAC code)
 */
router.post(
  '/default-rate',
  validateBody(getDefaultRateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { hsnCode } = req.body;

    const defaultRate = gstService.getDefaultGSTRate(hsnCode);

    res.json({
      success: true,
      data: {
        hsnCode: hsnCode || 'Default (Garments)',
        rate: defaultRate,
        message: `Default GST rate: ${defaultRate}%`,
      },
    });
  })
);

// ============================================
// Bulk Calculation Routes
// ============================================

/**
 * POST /api/gst/calculate-bulk
 * Calculate GST for multiple line items
 *
 * Body:
 *  - items: Array of { amount, taxRate }
 *  - supplierStateId: string
 *  - customerStateId: string
 */
router.post(
  '/calculate-bulk',
  validateBody(calculateBulkGSTSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { items, supplierStateId, customerStateId } = req.body as CalculateBulkGSTInput;

    // Calculate GST for each item
    const calculations = await Promise.all(
      items.map(async (item) => {
        const calc = await gstService.calculateGST(
          item.amount,
          item.taxRate || 5, // Default to 5% base rate for garments (≤₹2,500/piece)
          supplierStateId,
          customerStateId
        );

        return {
          amount: item.amount,
          taxRate: item.taxRate || 5,
          ...calc,
        };
      })
    );

    // Calculate totals
    const totals = calculations.reduce(
      (acc, calc) => ({
        totalAmount: acc.totalAmount + calc.amount,
        totalCGST: acc.totalCGST + calc.cgst,
        totalSGST: acc.totalSGST + calc.sgst,
        totalIGST: acc.totalIGST + calc.igst,
        totalTax: acc.totalTax + calc.totalTax,
      }),
      {
        totalAmount: 0,
        totalCGST: 0,
        totalSGST: 0,
        totalIGST: 0,
        totalTax: 0,
      }
    );

    res.json({
      success: true,
      data: {
        items: calculations,
        totals: {
          ...totals,
          grandTotal: totals.totalAmount + totals.totalTax,
          isInterstate: calculations[0]?.isInterstate || false,
        },
      },
    });
  })
);

// ============================================
// Tax Rate Information Routes
// ============================================

/**
 * GET /api/gst/rates
 * Get common GST rates and their applications
 */
router.get(
  '/rates',
  asyncHandler(async (req: Request, res: Response) => {
    const commonRates = [
      {
        rate: 0,
        description: 'Nil Rate',
        examples: ['Basic food items', 'Educational services'],
      },
      {
        rate: 5,
        description: 'Lower Rate',
        examples: ['Footwear (HSN 64)', 'Raw materials (HSN 50-60)', 'Certain textiles'],
      },
      {
        rate: 12,
        description: 'Standard Rate (Garments)',
        examples: ['Knitted garments (HSN 61)', 'Non-knitted garments (HSN 62)', 'Made-up textiles (HSN 63)'],
      },
      {
        rate: 18,
        description: 'Standard Rate',
        examples: ['Most manufactured goods', 'IT services', 'Business services'],
      },
      {
        rate: 28,
        description: 'Luxury Rate',
        examples: ['Luxury items', 'Sin goods', 'High-end products'],
      },
    ];

    res.json({
      success: true,
      data: commonRates,
    });
  })
);

/**
 * GET /api/gst/hsn-codes
 * Get common HSN codes for garment industry
 */
router.get(
  '/hsn-codes',
  asyncHandler(async (req: Request, res: Response) => {
    const garmentHSNCodes = [
      {
        code: '61',
        description: 'Knitted or crocheted garments and accessories',
        rate: 12,
        examples: ['T-shirts', 'Sweaters', 'Hosiery'],
      },
      {
        code: '62',
        description: 'Non-knitted or crocheted garments and accessories',
        rate: 12,
        examples: ['Shirts', 'Trousers', 'Jackets', 'Dresses'],
      },
      {
        code: '63',
        description: 'Other made-up textile articles',
        rate: 12,
        examples: ['Bed linen', 'Table linen', 'Curtains', 'Bags'],
      },
      {
        code: '64',
        description: 'Footwear',
        rate: 5,
        examples: ['Shoes', 'Sandals', 'Boots'],
      },
      {
        code: '50-60',
        description: 'Raw materials and fabrics',
        rate: 5,
        examples: ['Cotton', 'Silk', 'Wool', 'Synthetic fabrics'],
      },
    ];

    res.json({
      success: true,
      data: garmentHSNCodes,
    });
  })
);

export default router;
