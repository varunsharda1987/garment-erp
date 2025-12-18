// Size Category Types

export interface SizeCategory {
  id: string;
  name: string;
  description?: string | null;
  sizes: string[]; // Array of size values: ["XS", "S", "M", "L", "XL"]
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  labelSizeVariants?: LabelSizeVariant[];
}

export interface LabelSizeVariant {
  id: string;
  labelId: string;
  sizeCategoryId?: string | null;
  size: string;
  stockQuantity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  label?: {
    id: string;
    labelCode: string;
    labelName: string;
  };
  sizeCategory?: SizeCategory;
}

export interface SizeCategoryFormData {
  name: string;
  description?: string;
  sizes: string[];
  isActive?: boolean;
}

export interface CreateSizeCategoryRequest {
  name: string;
  description?: string;
  sizes: string[];
}

export interface UpdateSizeCategoryRequest extends Partial<CreateSizeCategoryRequest> {
  isActive?: boolean;
}

export interface SizeCategoryListResponse {
  data: SizeCategory[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Predefined size category templates for quick creation
export const SIZE_CATEGORY_TEMPLATES = [
  {
    name: "Men's Standard",
    description: "Standard men's apparel sizes",
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
  },
  {
    name: "Women's Standard",
    description: "Standard women's apparel sizes",
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
  },
  {
    name: 'Kids Age (Years)',
    description: 'Kids sizes by age',
    sizes: ['2Y', '4Y', '6Y', '8Y', '10Y', '12Y', '14Y', '16Y'],
  },
  {
    name: 'Numeric Sizes (US)',
    description: 'US numeric sizing for pants/jeans',
    sizes: ['28', '30', '32', '34', '36', '38', '40', '42'],
  },
  {
    name: 'European Numeric',
    description: 'European numeric sizing',
    sizes: ['38', '40', '42', '44', '46', '48', '50', '52'],
  },
  {
    name: 'UK Sizes',
    description: 'UK standard sizing',
    sizes: ['6', '8', '10', '12', '14', '16', '18', '20'],
  },
  {
    name: 'One Size',
    description: 'One size fits all',
    sizes: ['OS'],
  },
  {
    name: 'Kids Months',
    description: 'Infant/baby sizes by months',
    sizes: ['0-3M', '3-6M', '6-9M', '9-12M', '12-18M', '18-24M'],
  },
] as const;
