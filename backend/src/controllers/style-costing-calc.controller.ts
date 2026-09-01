import { Request, Response } from 'express';
import { costingService } from '../services/costing.service';
import { ValidationError } from '../errors';

// generateCostSheetFromStyle (POST /style-costing/generate/:styleId) was REMOVED 2026-09-01.
//
// It rebuilt fabricDetails/trimsDetails/embroideryDetails/accessoriesDetails plus the category
// prefill — all of which CostSheetForm already populates the moment a style is selected (from
// the approved fabric costings and the style BOM), and the two percentages it returned were
// hardcoded constants that duplicate defaults.registry.ts. The only thing it did NOT duplicate
// was applying a selected costing run, which lives in the form as "Load from Costing Run".
//
// The duplication was not harmless: this path deduped costed CAD rows on componentName (NULL on
// most live rows) while the style path keys on fabric identity, so the same style produced two
// different fabric costs depending on which route filled the form — understating fabric cost by
// ~2/3 on 8 styles until it was fixed in adab2e0e. Two paths computing one quote is the defect;
// deleting the redundant one removes the whole class rather than keeping the rules in sync.
// ============================================================================
// BUDGET SUGGESTIONS FOR DIRECT PROCUREMENT
// ============================================================================

/**
 * Get budget suggestions for a style
 * Used when creating RAW_MATERIAL_CALCULATION or PRODUCTION cost sheets
 * without going through COSTING approval first
 * GET /api/style-costing/budget-suggestions/:styleId
 */
export const getBudgetSuggestions = async (req: Request, res: Response): Promise<void> => {
  const { styleId } = req.params;

  if (!styleId) {
    throw new ValidationError('Style ID is required');
  }

  const suggestions = await costingService.getBudgetSuggestions(styleId);

  res.json({
    success: true,
    data: suggestions,
    message: 'Budget suggestions calculated successfully',
  });
};
