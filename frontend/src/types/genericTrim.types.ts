/**
 * Generic Trim Types
 * Configuration-driven types for all new trim master tables
 */

// Base interface for all trim items
export interface BaseTrimItem {
  id: string;
  isActive: boolean;
  supplierId?: string | null;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  createdById?: string | null;
  supplier?: {
    id: string;
    code: string;
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
  } | null;
}

// Hook & Eye
export interface HookEyeItem extends BaseTrimItem {
  hookEyeCode: string;
  hookEyeName: string;
  size?: string | null;
  material?: string | null;
  color?: string | null;
  finish?: string | null;
  pricePerPair?: number | null;
  pricePerGross?: number | null;
}

// Snap Button
export interface SnapButtonItem extends BaseTrimItem {
  snapButtonCode: string;
  snapButtonName: string;
  size?: string | null;
  type?: string | null;
  material?: string | null;
  color?: string | null;
  pricePerPiece?: number | null;
  pricePerGross?: number | null;
}

// Buckle
export interface BuckleItem extends BaseTrimItem {
  buckleCode: string;
  buckleName: string;
  width?: string | null;
  type?: string | null;
  material?: string | null;
  color?: string | null;
  finish?: string | null;
  pricePerPiece?: number | null;
}

// Belt
export interface BeltItem extends BaseTrimItem {
  beltCode: string;
  beltName: string;
  width?: string | null;
  type?: string | null;
  material?: string | null;
  color?: string | null;
  buckleType?: string | null;
  pricePerPiece?: number | null;
}

// Velcro
export interface VelcroItem extends BaseTrimItem {
  velcroCode: string;
  velcroName: string;
  width?: string | null;
  type?: string | null;
  color?: string | null;
  pricePerMeter?: number | null;
}

// Drawstring
export interface DrawstringItem extends BaseTrimItem {
  drawstringCode: string;
  drawstringName: string;
  width?: string | null;
  material?: string | null;
  color?: string | null;
  hasAglets?: boolean;
  pricePerMeter?: number | null;
}

// Ribbon
export interface RibbonItem extends BaseTrimItem {
  ribbonCode: string;
  ribbonName: string;
  width?: string | null;
  type?: string | null;
  color?: string | null;
  pattern?: string | null;
  pricePerMeter?: number | null;
}

// Sequin
export interface SequinItem extends BaseTrimItem {
  sequinCode: string;
  sequinName: string;
  size?: string | null;
  shape?: string | null;
  finish?: string | null;
  color?: string | null;
  onTape?: boolean;
  pricePerMeter?: number | null;
  pricePerPack?: number | null;
}

// Bead
export interface BeadItem extends BaseTrimItem {
  beadCode: string;
  beadName: string;
  size?: string | null;
  shape?: string | null;
  material?: string | null;
  color?: string | null;
  pricePerPack?: number | null;
  packSize?: number | null;
}

// Motif
export interface MotifItem extends BaseTrimItem {
  motifCode: string;
  motifName: string;
  size?: string | null;
  type?: string | null;
  design?: string | null;
  color?: string | null;
  pricePerPiece?: number | null;
}

// Interlining
export interface InterliningItem extends BaseTrimItem {
  interliningCode: string;
  interliningName: string;
  weight?: string | null;
  type?: string | null;
  fusible?: boolean;
  width?: string | null;
  color?: string | null;
  pricePerMeter?: number | null;
}

// Padding
export interface PaddingItem extends BaseTrimItem {
  paddingCode: string;
  paddingName: string;
  type?: string | null;
  size?: string | null;
  thickness?: string | null;
  material?: string | null;
  color?: string | null;
  pricePerPair?: number | null;
  pricePerPiece?: number | null;
}

// Other Fastener (miscellaneous fasteners)
export interface OtherFastenerItem extends BaseTrimItem {
  otherFastenerCode: string;
  otherFastenerName: string;
  type?: string | null;
  size?: string | null;
  material?: string | null;
  color?: string | null;
  pricePerPiece?: number | null;
}

// Other Tape/Thread (miscellaneous tapes/threads)
export interface OtherTapeItem extends BaseTrimItem {
  otherTapeCode: string;
  otherTapeName: string;
  type?: string | null;
  width?: string | null;
  material?: string | null;
  color?: string | null;
  pricePerMeter?: number | null;
}

// Other Decorative (miscellaneous decorative items)
export interface OtherDecorativeItem extends BaseTrimItem {
  otherDecorativeCode: string;
  otherDecorativeName: string;
  type?: string | null;
  size?: string | null;
  material?: string | null;
  color?: string | null;
  pricePerPiece?: number | null;
}

// Other Functional (miscellaneous functional items)
export interface OtherFunctionalItem extends BaseTrimItem {
  otherFunctionalCode: string;
  otherFunctionalName: string;
  type?: string | null;
  size?: string | null;
  material?: string | null;
  color?: string | null;
  pricePerPiece?: number | null;
}

// Union type for all trim items
export type GenericTrimItem =
  | HookEyeItem
  | SnapButtonItem
  | BuckleItem
  | BeltItem
  | VelcroItem
  | DrawstringItem
  | RibbonItem
  | SequinItem
  | BeadItem
  | MotifItem
  | InterliningItem
  | PaddingItem
  | OtherFastenerItem
  | OtherTapeItem
  | OtherDecorativeItem
  | OtherFunctionalItem;

// Field definition for form rendering
export interface FieldConfig {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

// Trim type configuration
export interface TrimTypeConfig {
  type: string;
  label: string;
  codeField: string;
  nameField: string;
  defaultUnit: string;
  category: TrimCategory;
  fields: FieldConfig[];
}

// Trim categories for grouping
export type TrimCategory =
  | 'FASTENERS_CLOSURES'
  | 'THREADS_TAPES'
  | 'DECORATIVE'
  | 'FUNCTIONAL'
  | 'OTHERS';

export const TRIM_CATEGORY_LABELS: Record<TrimCategory, string> = {
  FASTENERS_CLOSURES: 'Fasteners & Closures',
  THREADS_TAPES: 'Threads & Tapes',
  DECORATIVE: 'Decorative',
  FUNCTIONAL: 'Functional',
  OTHERS: 'Others'
};

// Configuration for all trim types
export const TRIM_TYPE_CONFIGS: Record<string, TrimTypeConfig> = {
  hook_eye: {
    type: 'hook_eye',
    label: 'Hook & Eye',
    codeField: 'hookEyeCode',
    nameField: 'hookEyeName',
    defaultUnit: 'PAIR',
    category: 'FASTENERS_CLOSURES',
    fields: [
      { name: 'size', label: 'Size', type: 'select', options: ['0', '1', '2', '3', 'Small', 'Medium', 'Large'] },
      { name: 'material', label: 'Material', type: 'select', options: ['Metal', 'Plastic', 'Brass'] },
      { name: 'color', label: 'Color', type: 'text' },
      { name: 'finish', label: 'Finish', type: 'select', options: ['Nickel', 'Antique Brass', 'Black', 'Chrome'] },
      { name: 'pricePerPair', label: 'Price Per Pair', type: 'number' },
      { name: 'pricePerGross', label: 'Price Per Gross', type: 'number' }
    ]
  },
  snap_button: {
    type: 'snap_button',
    label: 'Snap Button',
    codeField: 'snapButtonCode',
    nameField: 'snapButtonName',
    defaultUnit: 'PIECE',
    category: 'FASTENERS_CLOSURES',
    fields: [
      { name: 'size', label: 'Size', type: 'select', options: ['10mm', '12mm', '15mm', '17mm', '20mm'] },
      { name: 'type', label: 'Type', type: 'select', options: ['Ring Snap', 'Pearl Snap', 'Heavy Duty', 'Press Button'] },
      { name: 'material', label: 'Material', type: 'select', options: ['Metal', 'Plastic', 'Brass'] },
      { name: 'color', label: 'Color', type: 'text' },
      { name: 'pricePerPiece', label: 'Price Per Piece', type: 'number' },
      { name: 'pricePerGross', label: 'Price Per Gross', type: 'number' }
    ]
  },
  buckle: {
    type: 'buckle',
    label: 'Buckle',
    codeField: 'buckleCode',
    nameField: 'buckleName',
    defaultUnit: 'PIECE',
    category: 'FASTENERS_CLOSURES',
    fields: [
      { name: 'width', label: 'Width', type: 'select', options: ['20mm', '25mm', '30mm', '38mm', '50mm'] },
      { name: 'type', label: 'Type', type: 'select', options: ['Pin Buckle', 'Slide Buckle', 'D-Ring', 'O-Ring', 'Center Bar'] },
      { name: 'material', label: 'Material', type: 'select', options: ['Metal', 'Plastic', 'Wooden', 'Alloy'] },
      { name: 'color', label: 'Color', type: 'text' },
      { name: 'finish', label: 'Finish', type: 'select', options: ['Chrome', 'Antique', 'Matte Black', 'Nickel', 'Gold'] },
      { name: 'pricePerPiece', label: 'Price Per Piece', type: 'number' }
    ]
  },
  belt: {
    type: 'belt',
    label: 'Belt',
    codeField: 'beltCode',
    nameField: 'beltName',
    defaultUnit: 'PIECE',
    category: 'FASTENERS_CLOSURES',
    fields: [
      { name: 'width', label: 'Width', type: 'select', options: ['20mm', '25mm', '30mm', '38mm', '50mm'] },
      { name: 'type', label: 'Type', type: 'select', options: ['Leather Belt', 'Fabric Belt', 'Chain Belt', 'Elastic Belt', 'Braided Belt', 'Ribbon Belt'] },
      { name: 'material', label: 'Material', type: 'select', options: ['Genuine Leather', 'PU Leather', 'Canvas', 'Fabric', 'Metal', 'Elastic'] },
      { name: 'color', label: 'Color', type: 'text' },
      { name: 'buckleType', label: 'Buckle Type', type: 'select', options: ['Pin Buckle', 'Slide Buckle', 'D-Ring', 'No Buckle', 'Clasp'] },
      { name: 'pricePerPiece', label: 'Price Per Piece', type: 'number' }
    ]
  },
  velcro: {
    type: 'velcro',
    label: 'Velcro',
    codeField: 'velcroCode',
    nameField: 'velcroName',
    defaultUnit: 'METER',
    category: 'FASTENERS_CLOSURES',
    fields: [
      { name: 'width', label: 'Width', type: 'select', options: ['16mm', '20mm', '25mm', '38mm', '50mm', '100mm'] },
      { name: 'type', label: 'Type', type: 'select', options: ['Sew-On', 'Adhesive', 'Both'] },
      { name: 'color', label: 'Color', type: 'text' },
      { name: 'pricePerMeter', label: 'Price Per Meter', type: 'number' }
    ]
  },
  drawstring: {
    type: 'drawstring',
    label: 'Drawstring',
    codeField: 'drawstringCode',
    nameField: 'drawstringName',
    defaultUnit: 'METER',
    category: 'THREADS_TAPES',
    fields: [
      { name: 'width', label: 'Width/Diameter', type: 'select', options: ['3mm', '5mm', '8mm', '10mm'] },
      { name: 'material', label: 'Material', type: 'select', options: ['Cotton', 'Polyester', 'Nylon', 'Leather', 'Waxed'] },
      { name: 'color', label: 'Color', type: 'text' },
      { name: 'hasAglets', label: 'Has Aglets', type: 'boolean' },
      { name: 'pricePerMeter', label: 'Price Per Meter', type: 'number' }
    ]
  },
  ribbon: {
    type: 'ribbon',
    label: 'Ribbon',
    codeField: 'ribbonCode',
    nameField: 'ribbonName',
    defaultUnit: 'METER',
    category: 'THREADS_TAPES',
    fields: [
      { name: 'width', label: 'Width', type: 'select', options: ['6mm', '10mm', '15mm', '25mm', '38mm', '50mm'] },
      { name: 'type', label: 'Type', type: 'select', options: ['Satin', 'Grosgrain', 'Velvet', 'Organza', 'Cotton'] },
      { name: 'color', label: 'Color', type: 'text' },
      { name: 'pattern', label: 'Pattern', type: 'select', options: ['Solid', 'Striped', 'Printed', 'Checked'] },
      { name: 'pricePerMeter', label: 'Price Per Meter', type: 'number' }
    ]
  },
  sequin: {
    type: 'sequin',
    label: 'Sequin',
    codeField: 'sequinCode',
    nameField: 'sequinName',
    defaultUnit: 'METER',
    category: 'DECORATIVE',
    fields: [
      { name: 'size', label: 'Size', type: 'select', options: ['3mm', '4mm', '5mm', '6mm', '8mm', '10mm'] },
      { name: 'shape', label: 'Shape', type: 'select', options: ['Round', 'Square', 'Star', 'Heart', 'Oval'] },
      { name: 'finish', label: 'Finish', type: 'select', options: ['Matte', 'Shiny', 'Holographic', 'Metallic'] },
      { name: 'color', label: 'Color', type: 'text' },
      { name: 'onTape', label: 'On Tape', type: 'boolean' },
      { name: 'pricePerMeter', label: 'Price Per Meter (Tape)', type: 'number' },
      { name: 'pricePerPack', label: 'Price Per Pack (Loose)', type: 'number' }
    ]
  },
  bead: {
    type: 'bead',
    label: 'Bead',
    codeField: 'beadCode',
    nameField: 'beadName',
    defaultUnit: 'PACK',
    category: 'DECORATIVE',
    fields: [
      { name: 'size', label: 'Size', type: 'select', options: ['2mm', '3mm', '4mm', '6mm', '8mm', '10mm'] },
      { name: 'shape', label: 'Shape', type: 'select', options: ['Round', 'Oval', 'Tube', 'Drop', 'Bicone'] },
      { name: 'material', label: 'Material', type: 'select', options: ['Glass', 'Plastic', 'Pearl', 'Crystal', 'Wood'] },
      { name: 'color', label: 'Color', type: 'text' },
      { name: 'packSize', label: 'Pack Size (count)', type: 'number' },
      { name: 'pricePerPack', label: 'Price Per Pack', type: 'number' }
    ]
  },
  motif: {
    type: 'motif',
    label: 'Motif',
    codeField: 'motifCode',
    nameField: 'motifName',
    defaultUnit: 'PIECE',
    category: 'DECORATIVE',
    fields: [
      { name: 'size', label: 'Size', type: 'select', options: ['Small', 'Medium', 'Large', 'Extra Large'] },
      { name: 'type', label: 'Type', type: 'select', options: ['Embroidered', 'Beaded', 'Sequined', 'Applique', 'Patch'] },
      { name: 'design', label: 'Design Description', type: 'text' },
      { name: 'color', label: 'Color', type: 'text' },
      { name: 'pricePerPiece', label: 'Price Per Piece', type: 'number' }
    ]
  },
  interlining: {
    type: 'interlining',
    label: 'Interlining',
    codeField: 'interliningCode',
    nameField: 'interliningName',
    defaultUnit: 'METER',
    category: 'FUNCTIONAL',
    fields: [
      { name: 'weight', label: 'Weight (GSM)', type: 'select', options: ['30gsm', '45gsm', '60gsm', '75gsm', '90gsm', '120gsm'] },
      { name: 'type', label: 'Type', type: 'select', options: ['Woven', 'Non-Woven', 'Knit'] },
      { name: 'fusible', label: 'Fusible', type: 'boolean' },
      { name: 'width', label: 'Width', type: 'select', options: ['90cm', '115cm', '150cm'] },
      { name: 'color', label: 'Color', type: 'select', options: ['White', 'Black', 'Charcoal', 'Grey'] },
      { name: 'pricePerMeter', label: 'Price Per Meter', type: 'number' }
    ]
  },
  padding: {
    type: 'padding',
    label: 'Padding',
    codeField: 'paddingCode',
    nameField: 'paddingName',
    defaultUnit: 'PAIR',
    category: 'FUNCTIONAL',
    fields: [
      { name: 'type', label: 'Type', type: 'select', options: ['Shoulder Pad', 'Bra Cup', 'Sleeve Head', 'Chest Pad', 'Hip Pad'] },
      { name: 'size', label: 'Size', type: 'select', options: ['XS', 'Small', 'Medium', 'Large', 'XL'] },
      { name: 'thickness', label: 'Thickness', type: 'select', options: ['Thin', 'Medium', 'Thick', 'Extra Thick'] },
      { name: 'material', label: 'Material', type: 'select', options: ['Foam', 'Cotton', 'Polyester', 'Sponge'] },
      { name: 'color', label: 'Color', type: 'text' },
      { name: 'pricePerPair', label: 'Price Per Pair', type: 'number' },
      { name: 'pricePerPiece', label: 'Price Per Piece', type: 'number' }
    ]
  },
  // "Others" categories - for miscellaneous items
  other_fastener: {
    type: 'other_fastener',
    label: 'Other Fastener',
    codeField: 'otherFastenerCode',
    nameField: 'otherFastenerName',
    defaultUnit: 'PIECE',
    category: 'FASTENERS_CLOSURES',
    fields: [
      { name: 'type', label: 'Type', type: 'text', placeholder: 'Describe the type of fastener' },
      { name: 'size', label: 'Size', type: 'text' },
      { name: 'material', label: 'Material', type: 'text' },
      { name: 'color', label: 'Color', type: 'text' },
      { name: 'pricePerPiece', label: 'Price Per Piece', type: 'number' }
    ]
  },
  other_tape: {
    type: 'other_tape',
    label: 'Other Tape/Thread',
    codeField: 'otherTapeCode',
    nameField: 'otherTapeName',
    defaultUnit: 'METER',
    category: 'THREADS_TAPES',
    fields: [
      { name: 'type', label: 'Type', type: 'text', placeholder: 'Describe the type of tape/thread' },
      { name: 'width', label: 'Width', type: 'text' },
      { name: 'material', label: 'Material', type: 'text' },
      { name: 'color', label: 'Color', type: 'text' },
      { name: 'pricePerMeter', label: 'Price Per Meter', type: 'number' }
    ]
  },
  other_decorative: {
    type: 'other_decorative',
    label: 'Other Decorative',
    codeField: 'otherDecorativeCode',
    nameField: 'otherDecorativeName',
    defaultUnit: 'PIECE',
    category: 'DECORATIVE',
    fields: [
      { name: 'type', label: 'Type', type: 'text', placeholder: 'Describe the decorative item' },
      { name: 'size', label: 'Size', type: 'text' },
      { name: 'material', label: 'Material', type: 'text' },
      { name: 'color', label: 'Color', type: 'text' },
      { name: 'pricePerPiece', label: 'Price Per Piece', type: 'number' }
    ]
  },
  other_functional: {
    type: 'other_functional',
    label: 'Other Functional',
    codeField: 'otherFunctionalCode',
    nameField: 'otherFunctionalName',
    defaultUnit: 'PIECE',
    category: 'FUNCTIONAL',
    fields: [
      { name: 'type', label: 'Type', type: 'text', placeholder: 'Describe the functional item' },
      { name: 'size', label: 'Size', type: 'text' },
      { name: 'material', label: 'Material', type: 'text' },
      { name: 'color', label: 'Color', type: 'text' },
      { name: 'pricePerPiece', label: 'Price Per Piece', type: 'number' }
    ]
  }
};

// Group configurations by category
export const TRIM_CATEGORIES = [
  {
    category: 'FASTENERS_CLOSURES' as TrimCategory,
    label: 'Fasteners & Closures',
    types: ['hook_eye', 'snap_button', 'buckle', 'belt', 'velcro', 'other_fastener']
  },
  {
    category: 'THREADS_TAPES' as TrimCategory,
    label: 'Threads & Tapes',
    types: ['drawstring', 'ribbon', 'other_tape']
  },
  {
    category: 'DECORATIVE' as TrimCategory,
    label: 'Decorative',
    types: ['sequin', 'bead', 'motif', 'other_decorative']
  },
  {
    category: 'FUNCTIONAL' as TrimCategory,
    label: 'Functional',
    types: ['interlining', 'padding', 'other_functional']
  }
];

// API Response types
export interface GenericTrimListResponse {
  data: GenericTrimItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GenericTrimResponse {
  data: GenericTrimItem;
  message?: string;
}

export interface TrimConfigResponse {
  type: string;
  displayName: string;
  codePrefix: string;
  defaultUnit: string;
  materialType: string;
}

export interface TrimCountsResponse {
  [key: string]: number;
}
