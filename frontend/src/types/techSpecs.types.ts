/**
 * Tech Specs Types
 * TypeScript types for style technical specifications
 */

export type SleeveType =
  | 'SET_IN'
  | 'RAGLAN'
  | 'CAP'
  | 'SLEEVELESS'
  | 'BELL'
  | 'PUFF'
  | 'KIMONO'
  | 'DOLMAN'
  | 'BISHOP'
  | 'OTHER';

export type CollarType =
  | 'ROUND_NECK'
  | 'V_NECK'
  | 'COLLAR'
  | 'MANDARIN'
  | 'BOAT_NECK'
  | 'SQUARE_NECK'
  | 'TURTLE_NECK'
  | 'COWL_NECK'
  | 'HALTER'
  | 'OFF_SHOULDER'
  | 'OTHER';

export type FitType =
  | 'SLIM'
  | 'REGULAR'
  | 'RELAXED'
  | 'OVERSIZED'
  | 'FITTED'
  | 'LOOSE';

export type ClosureType =
  | 'BUTTONS'
  | 'ZIPPER'
  | 'PULLOVER'
  | 'TIE'
  | 'WRAP'
  | 'HOOK_EYE'
  | 'SNAP'
  | 'DRAWSTRING'
  | 'NONE'
  | 'OTHER';

export interface TechSpecs {
  id: string;
  styleId: string;

  // Basic Measurements
  overallLength?: number | null;
  topLength?: number | null;
  bottomLength?: number | null;
  lengthUnit: string;

  // Style Details
  sleeveType?: SleeveType | null;
  collarType?: CollarType | null;
  fitType?: FitType | null;
  closureType?: ClosureType | null;

  // Notes
  designNotes?: string | null;
  constructionNotes?: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface CreateUpdateTechSpecsDTO {
  overallLength?: number | null;
  topLength?: number | null;
  bottomLength?: number | null;
  lengthUnit?: string;
  sleeveType?: SleeveType | null;
  collarType?: CollarType | null;
  fitType?: FitType | null;
  closureType?: ClosureType | null;
  designNotes?: string | null;
  constructionNotes?: string | null;
}

// API Response types
export interface TechSpecsResponse {
  data: TechSpecs;
  message?: string;
}

export interface TechSpecsOptionsResponse {
  data: {
    sleeveTypes: Array<{ value: SleeveType; label: string }>;
    collarTypes: Array<{ value: CollarType; label: string }>;
    fitTypes: Array<{ value: FitType; label: string }>;
    closureTypes: Array<{ value: ClosureType; label: string }>;
    lengthUnits: Array<{ value: string; label: string }>;
  };
}

// Display labels
export const SLEEVE_TYPE_LABELS: Record<SleeveType, string> = {
  SET_IN: 'Set-In',
  RAGLAN: 'Raglan',
  CAP: 'Cap Sleeve',
  SLEEVELESS: 'Sleeveless',
  BELL: 'Bell Sleeve',
  PUFF: 'Puff Sleeve',
  KIMONO: 'Kimono',
  DOLMAN: 'Dolman',
  BISHOP: 'Bishop',
  OTHER: 'Other',
};

export const COLLAR_TYPE_LABELS: Record<CollarType, string> = {
  ROUND_NECK: 'Round Neck',
  V_NECK: 'V-Neck',
  COLLAR: 'Collar',
  MANDARIN: 'Mandarin',
  BOAT_NECK: 'Boat Neck',
  SQUARE_NECK: 'Square Neck',
  TURTLE_NECK: 'Turtle Neck',
  COWL_NECK: 'Cowl Neck',
  HALTER: 'Halter',
  OFF_SHOULDER: 'Off Shoulder',
  OTHER: 'Other',
};

export const FIT_TYPE_LABELS: Record<FitType, string> = {
  SLIM: 'Slim Fit',
  REGULAR: 'Regular Fit',
  RELAXED: 'Relaxed Fit',
  OVERSIZED: 'Oversized',
  FITTED: 'Fitted',
  LOOSE: 'Loose',
};

export const CLOSURE_TYPE_LABELS: Record<ClosureType, string> = {
  BUTTONS: 'Buttons',
  ZIPPER: 'Zipper',
  PULLOVER: 'Pullover',
  TIE: 'Tie/Ribbon',
  WRAP: 'Wrap',
  HOOK_EYE: 'Hook & Eye',
  SNAP: 'Snap Buttons',
  DRAWSTRING: 'Drawstring',
  NONE: 'None',
  OTHER: 'Other',
};
