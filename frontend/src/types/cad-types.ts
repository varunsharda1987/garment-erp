// Temporary re-export to fix module resolution issue
export interface CadAverageFormData {
  fabricWidth: number;
  cadAverageMeters?: number;
  cadAverageYards?: number;
  cadWastagePercent?: number;
  markerEfficiency?: number;
  markerPlanFile?: string;
  isPreferred?: boolean;
  notes?: string;
}

// Common fabric widths (in inches)
export const COMMON_FABRIC_WIDTHS = [
  36,  // 36 inches
  44,  // 44 inches
  54,  // 54 inches
  58,  // 58 inches
  60,  // 60 inches
  72,  // 72 inches
  108, // 108 inches (extra wide)
];
