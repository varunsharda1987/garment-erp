export interface StyleVariantData {
  sku: string;
  sizeName?: string;
  colorName?: string;
  sizeId?: string;
  colorId?: string;
  barcode?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface CreateStyleVariantsRequest {
  styleId: string;
  variants: StyleVariantData[];
}

export interface StyleVariantResponse {
  id: string;
  styleId: string;
  sku: string;
  sizeName: string | null;
  colorName: string | null;
  barcode: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
