// Pattern Part Types - Individual pattern pieces that make up garment components

// Component Group reference for pattern parts
export interface PatternPartGroup {
  id: string;
  code: string;
  name: string;
}

export interface PatternPart {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    componentPatternParts: number;
  };
  componentGroups?: PatternPartGroup[]; // Associated component groups
}

export interface PatternPartFormData {
  code: string;
  name: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
  componentGroupIds?: string[]; // Array of component group IDs
}

export interface PatternPartListResponse {
  data: PatternPart[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PatternPartResponse {
  data: PatternPart;
  message: string;
}

export interface ReorderPatternPartsInput {
  orders: Array<{
    id: string;
    sortOrder: number;
  }>;
}
