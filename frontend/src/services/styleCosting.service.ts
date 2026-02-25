/**
 * Style Costing Service
 * Re-exports from costSheet.service for backward compatibility
 */

import { getCostSheetById } from './costSheet.service';

// Re-export getCostSheetById as getStyleCostingById for backward compatibility
export const getStyleCostingById = getCostSheetById;

// Re-export everything from costSheet.service
export * from './costSheet.service';
