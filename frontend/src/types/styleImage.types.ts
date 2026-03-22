/**
 * Style Image Types
 * TypeScript types for the style gallery functionality
 */

export const StyleImageType = {
  MAIN: 'MAIN',
  SKETCH_FRONT: 'SKETCH_FRONT',
  SKETCH_BACK: 'SKETCH_BACK',
  SKETCH_SIDE: 'SKETCH_SIDE',
  TECHNICAL_FLAT: 'TECHNICAL_FLAT',
  DETAIL_VIEW: 'DETAIL_VIEW',
  CONSTRUCTION: 'CONSTRUCTION',
  OTHER: 'OTHER',
} as const;

export type StyleImageType = (typeof StyleImageType)[keyof typeof StyleImageType];

export interface StyleImage {
  id: string;
  styleId: string;
  imageUrl: string;
  imageType: StyleImageType;
  caption?: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface CreateStyleImageDTO {
  imageType?: StyleImageType;
  caption?: string;
}

export interface UpdateStyleImageDTO {
  imageType?: StyleImageType;
  caption?: string;
}

export interface StyleImageTypeOption {
  value: StyleImageType;
  label: string;
}

// API Response types
export interface StyleImagesResponse {
  data: StyleImage[];
}

export interface StyleImageResponse {
  data: StyleImage;
  message?: string;
}

export interface StyleImageTypesResponse {
  data: StyleImageTypeOption[];
}
