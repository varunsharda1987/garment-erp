/**
 * Material Quick Add Configuration
 * Central configuration for all 23 material types (21 trims + 2 accessories)
 */

import type {
  MaterialTypeConfig,
  CategoryConfig,
  MaterialFormData,
  MaterialCreateResult,
} from '../types/material-quick-add.types';
import { TRIM_TYPE_CONFIGS } from '../types/genericTrim.types';

// Service imports
import { createButton } from '../services/button.service';
import { createThread } from '../services/thread.service';
import { createZipper } from '../services/zipper.service';
import { createElastic } from '../services/elastic.service';
import { createLace } from '../services/lace.service';
import { createLabel } from '../services/label.service';
import { createPackaging } from '../services/packaging.service';
import * as genericTrimService from '../services/genericTrim.service';

/**
 * Material Type Configurations
 */

/** Shape of the dynamically-assembled quick-add payload */
type QuickAddPayload = Record<string, string | number | boolean | string[] | undefined>;

/**
 * Single deliberate bridge between the dynamic quick-add payload and each
 * material service's typed create function. The payload is assembled at runtime
 * from field configs, so TypeScript cannot prove it matches the service's input
 * type; the backend Zod schema for each material type is the real validation
 * contract (it also auto-generates names/codes the dialog intentionally omits).
 */
const submitQuickAdd = async <TInput>(
  create: (input: TInput) => Promise<{ id: string }>,
  payload: QuickAddPayload
): Promise<MaterialCreateResult> => {
  const result = await create(payload as QuickAddPayload & TInput);
  return result;
};

// Dedicated trim services (5 types)
const BUTTON_CONFIG: MaterialTypeConfig = {
  type: 'BUTTON',
  label: 'Button',
  icon: '🔘',
  category: 'FASTENERS_CLOSURES',
  categoryLabel: 'Fasteners & Closures',
  codeField: 'buttonCode',
  nameField: 'buttonName',
  fields: [
    { name: 'size', label: 'Size', type: 'text', required: false, placeholder: 'e.g., 15mm, 1 inch' },
    { name: 'holes', label: 'Holes', type: 'number', required: false, placeholder: '2, 4' },
    { name: 'material', label: 'Material', type: 'text', required: false, placeholder: 'Plastic, Metal, Wood' },
    { name: 'shape', label: 'Shape', type: 'text', required: false, placeholder: 'Round, Square' },
    { name: 'color', label: 'Color', type: 'text', required: false },
    { name: 'pricePerPiece', label: 'Price per Piece (₹)', type: 'number', required: false, placeholder: '0.50' },
  ],
  createService: async (data: MaterialFormData, styleCode?: string) => {
    // Don't force-set the name field; let backend auto-generate if not provided
    const payload: QuickAddPayload = { ...data };

    // Only set type-specific name field if name was provided
    if (data.name !== undefined) {
      payload.buttonName = data.name;
    }

    // Auto-associate with style if styleCode provided
    if (styleCode) {
      payload.styleCodes = [styleCode];
    }

    // Remove generic 'name' field and internal tracking flag
    delete payload.name;
    delete payload._nameManuallyEdited;

    return submitQuickAdd(createButton, payload);
  },
};

const THREAD_CONFIG: MaterialTypeConfig = {
  type: 'THREAD',
  label: 'Thread',
  icon: '🧵',
  category: 'THREADS_TAPES',
  categoryLabel: 'Threads & Tapes',
  codeField: 'threadCode',
  nameField: 'threadName',
  fields: [
    { name: 'brand', label: 'Brand', type: 'text', required: false, placeholder: 'e.g., Coats, Amann' },
    { name: 'packagingType', label: 'Packaging Type', type: 'select', options: ['CONE', 'TUBE'], required: false },
    { name: 'metersPerUnit', label: 'Meters Per Unit', type: 'number', required: false, placeholder: '5000' },
    { name: 'color', label: 'Color', type: 'text', required: false },
    { name: 'pricePerCone', label: 'Price per Cone (₹)', type: 'number', required: false, placeholder: '120' },
  ],
  createService: async (data: MaterialFormData, styleCode?: string) => {
    const payload: QuickAddPayload = { ...data };
    if (data.name !== undefined) {
      payload.threadName = data.name;
    }
    if (styleCode) {
      payload.styleCodes = [styleCode];
    }
    delete payload.name;
    delete payload._nameManuallyEdited;
    return submitQuickAdd(createThread, payload);
  },
};

const ZIPPER_CONFIG: MaterialTypeConfig = {
  type: 'ZIPPER',
  label: 'Zipper',
  icon: '🔗',
  category: 'FASTENERS_CLOSURES',
  categoryLabel: 'Fasteners & Closures',
  codeField: 'zipperCode',
  nameField: 'zipperName',
  fields: [
    { name: 'length', label: 'Length (inches)', type: 'number', required: false, placeholder: '7, 12' },
    { name: 'brand', label: 'Brand', type: 'text', required: false, placeholder: 'YKK, SBS' },
    { name: 'teethType', label: 'Teeth Type', type: 'text', required: false, placeholder: 'Metal, Plastic, Coil' },
    { name: 'sliderType', label: 'Slider Type', type: 'text', required: false, placeholder: 'Auto Lock, Pin Lock' },
    { name: 'color', label: 'Color', type: 'text', required: false },
    { name: 'pricePerPiece', label: 'Price per Piece (₹)', type: 'number', required: false, placeholder: '15' },
  ],
  createService: async (data: MaterialFormData, styleCode?: string) => {
    const payload: QuickAddPayload = { ...data };
    if (data.name !== undefined) {
      payload.zipperName = data.name;
    }
    if (styleCode) {
      payload.styleCodes = [styleCode];
    }
    delete payload.name;
    delete payload._nameManuallyEdited;
    return submitQuickAdd(createZipper, payload);
  },
};

const ELASTIC_CONFIG: MaterialTypeConfig = {
  type: 'ELASTIC',
  label: 'Elastic',
  icon: '〰️',
  category: 'THREADS_TAPES',
  categoryLabel: 'Threads & Tapes',
  codeField: 'elasticCode',
  nameField: 'elasticName',
  fields: [
    { name: 'width', label: 'Width (mm)', type: 'number', required: false, placeholder: '6, 12, 25' },
    { name: 'composition', label: 'Composition', type: 'text', required: false, placeholder: 'Polyester, Rubber' },
    { name: 'elasticType', label: 'Elastic Type', type: 'text', required: false, placeholder: 'Braided, Knit, Woven' },
    { name: 'color', label: 'Color', type: 'text', required: false },
    { name: 'pricePerMeter', label: 'Price per Meter (₹)', type: 'number', required: false, placeholder: '5' },
  ],
  createService: async (data: MaterialFormData, styleCode?: string) => {
    const payload: QuickAddPayload = { ...data };
    if (data.name !== undefined) {
      payload.elasticName = data.name;
    }
    if (styleCode) {
      payload.styleCodes = [styleCode];
    }
    delete payload.name;
    delete payload._nameManuallyEdited;
    return submitQuickAdd(createElastic, payload);
  },
};

const LACE_CONFIG: MaterialTypeConfig = {
  type: 'LACE',
  label: 'Lace',
  icon: '🎀',
  category: 'DECORATIVE',
  categoryLabel: 'Decorative',
  codeField: 'laceCode',
  nameField: 'laceName',
  fields: [
    // Greige toggle - determines if this is raw lace or finished lace
    {
      name: 'isGreige',
      label: 'This is Greige (raw) lace that needs dyeing/processing',
      type: 'boolean',
      required: false,
      helpText: 'Greige lace is raw material that will be sent for dyeing. Finished lace is ready to use.',
    },
    // Greige-specific fields (shown when isGreige=true)
    {
      name: 'expectedShrinkagePercent',
      label: 'Expected Shrinkage %',
      type: 'number',
      required: false,
      placeholder: '3-8',
      showWhen: { field: 'isGreige', value: true },
      helpText: 'Shrinkage during dyeing process (typically 3-8%)',
    },
    {
      name: 'costPerMeterGreige',
      label: 'Greige Cost (per meter)',
      type: 'number',
      required: false,
      placeholder: '50',
      showWhen: { field: 'isGreige', value: true },
      helpText: 'Raw material cost before processing',
    },
    // Standard lace fields
    { name: 'laceType', label: 'Lace Type', type: 'text', required: false, placeholder: 'Crochet, Embroidered' },
    { name: 'width', label: 'Width (inches)', type: 'number', required: false, placeholder: '1, 2, 3' },
    { name: 'composition', label: 'Composition', type: 'text', required: false, placeholder: 'Cotton, Nylon' },
    { name: 'design', label: 'Design', type: 'text', required: false, placeholder: 'Floral, Geometric' },
    // Color only shown for finished lace (when isGreige=false or not set)
    {
      name: 'color',
      label: 'Color',
      type: 'text',
      required: false,
      showWhen: { field: 'isGreige', value: true, inverse: true },
      helpText:
        'Color is not applicable for greige lace - it will be applied during dyeing. ' +
        'To record a lace dyed FROM a greige, use "Create Dyed Variant" in the cost sheet sourcing window ' +
        'so it is linked to its greige source.',
    },
    // Price per meter - shown for finished lace only
    {
      name: 'pricePerMeter',
      label: 'Price per Meter (₹)',
      type: 'number',
      required: false,
      placeholder: '25',
      showWhen: { field: 'isGreige', value: true, inverse: true },
      helpText: 'Ready lace price per meter',
    },
  ],
  createService: async (data: MaterialFormData, styleCode?: string) => {
    const payload: QuickAddPayload = { ...data };
    if (data.name !== undefined) {
      payload.laceName = data.name;
    }
    if (styleCode) {
      payload.styleCodes = [styleCode];
    }
    delete payload.name;
    delete payload._nameManuallyEdited;

    // If greige lace, ensure color is not sent (backend sets it to null)
    if (payload.isGreige) {
      delete payload.color;
    }

    return submitQuickAdd(createLace, payload);
  },
};

// Generic trim types (16 types) - Use configuration from TRIM_TYPE_CONFIGS
const createGenericTrimConfig = (trimType: string): MaterialTypeConfig => {
  const config = TRIM_TYPE_CONFIGS[trimType];
  if (!config) {
    throw new Error(`Configuration not found for trim type: ${trimType}`);
  }

  // Map to uppercase with underscores for consistency
  const typeKey = trimType.toUpperCase();

  // Icon mapping for generic trims
  const iconMap: Record<string, string> = {
    hook_eye: '🪝',
    snap_button: '⚫',
    buckle: '🔲',
    belt: '👔',
    velcro: '📎',
    drawstring: '➰',
    ribbon: '🎗️',
    sequin: '✨',
    bead: '🔵',
    motif: '🌺',
    interlining: '📄',
    padding: '🛏️',
    other_fastener: '🔧',
    other_tape: '📏',
    other_decorative: '💫',
    other_functional: '⚙️',
  };

  return {
    type: typeKey,
    label: config.label,
    icon: iconMap[trimType] || '📦',
    category: config.category,
    categoryLabel: config.category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    codeField: config.codeField,
    nameField: config.nameField,
    fields: config.fields.map((field) => ({
      ...field,
      gridColumn: field.name === 'color' ? '1/3' : '1/2',
    })),
    createService: async (data: MaterialFormData, styleCode?: string) => {
      // Prepare data with the correct field names
      const payload: QuickAddPayload = {};

      // Only set name field if provided
      if (data.name !== undefined) {
        payload[config.nameField] = data.name;
      }

      // Auto-associate with style if styleCode provided
      if (styleCode) {
        payload.styleCodes = [styleCode];
      }

      // Copy other fields
      config.fields.forEach((field) => {
        if (data[field.name] !== undefined && data[field.name] !== '') {
          payload[field.name] = data[field.name];
        }
      });

      return submitQuickAdd(
        (input: Parameters<typeof genericTrimService.createGenericTrim>[1]) =>
          genericTrimService.createGenericTrim(trimType, input).then((response) => response.data),
        payload
      );
    },
  };
};

// Accessory configurations
const LABEL_CONFIG: MaterialTypeConfig = {
  type: 'LABEL',
  label: 'Label',
  icon: '🏷️',
  category: 'ACCESSORIES',
  categoryLabel: 'Accessories',
  codeField: 'labelCode',
  nameField: 'labelName',
  fields: [
    {
      name: 'labelType',
      label: 'Label Type',
      type: 'select',
      options: ['Hangtag', 'Price Tag', 'Brand Tag', 'Barcode Tag'],
      required: false,
    },
    { name: 'size', label: 'Size', type: 'text', required: false, placeholder: 'e.g., 2x3 inches' },
    { name: 'material', label: 'Material', type: 'text', required: false, placeholder: 'Polyester, Satin, Card' },
    { name: 'printMethod', label: 'Print Method', type: 'text', required: false, placeholder: 'Screen Print, Digital' },
    { name: 'color', label: 'Color', type: 'text', required: false },
    { name: 'pricePerPiece', label: 'Price per Piece (₹)', type: 'number', required: false, placeholder: '2' },
  ],
  createService: async (data: MaterialFormData, styleCode?: string) => {
    // Determine labelCategory based on labelType
    const labelCategory = data.labelType === 'Price Tag' ? 'PRICE_TAG' : 'HANGTAG';

    const payload: QuickAddPayload = {
      labelCategory,
      ...data,
    };

    if (data.name !== undefined) {
      payload.labelName = data.name;
    }

    if (styleCode) {
      payload.styleCodes = [styleCode];
    }

    delete payload.name;
    delete payload._nameManuallyEdited;

    return submitQuickAdd(createLabel, payload);
  },
};

const PACKAGING_CONFIG: MaterialTypeConfig = {
  type: 'PACKAGING',
  label: 'Packaging',
  icon: '📦',
  category: 'ACCESSORIES',
  categoryLabel: 'Accessories',
  codeField: 'packagingCode',
  nameField: 'packagingName',
  fields: [
    {
      name: 'packagingType',
      label: 'Packaging Type',
      type: 'select',
      options: ['Polybag', 'Carton', 'Hanger', 'Tissue', 'Sticker'],
      required: false,
    },
    { name: 'size', label: 'Size', type: 'text', required: false, placeholder: 'e.g., 12x16 inches' },
    { name: 'material', label: 'Material', type: 'text', required: false, placeholder: 'LDPE, Cardboard' },
    { name: 'thickness', label: 'Thickness', type: 'text', required: false, placeholder: '40 microns, 3 ply' },
    { name: 'pricePerPiece', label: 'Price per Piece (₹)', type: 'number', required: false, placeholder: '1.50' },
  ],
  createService: async (data: MaterialFormData, styleCode?: string) => {
    const payload: QuickAddPayload = { ...data };
    if (data.name !== undefined) {
      payload.packagingName = data.name;
    }
    if (styleCode) {
      payload.styleCodes = [styleCode];
    }
    delete payload.name;
    delete payload._nameManuallyEdited;
    return submitQuickAdd(createPackaging, payload);
  },
};

/**
 * All Material Configurations
 */
const ALL_MATERIAL_CONFIGS: MaterialTypeConfig[] = [
  // Dedicated services (5 trims)
  BUTTON_CONFIG,
  ZIPPER_CONFIG,
  THREAD_CONFIG,
  ELASTIC_CONFIG,
  LACE_CONFIG,

  // Generic trims (16 types)
  createGenericTrimConfig('hook_eye'),
  createGenericTrimConfig('snap_button'),
  createGenericTrimConfig('buckle'),
  createGenericTrimConfig('belt'),
  createGenericTrimConfig('velcro'),
  createGenericTrimConfig('drawstring'),
  createGenericTrimConfig('ribbon'),
  createGenericTrimConfig('sequin'),
  createGenericTrimConfig('bead'),
  createGenericTrimConfig('motif'),
  createGenericTrimConfig('interlining'),
  createGenericTrimConfig('padding'),
  createGenericTrimConfig('other_fastener'),
  createGenericTrimConfig('other_tape'),
  createGenericTrimConfig('other_decorative'),
  createGenericTrimConfig('other_functional'),

  // Accessories (2 types)
  LABEL_CONFIG,
  PACKAGING_CONFIG,
];

/**
 * Category Definitions
 */
export const TRIM_CATEGORIES: CategoryConfig[] = [
  {
    category: 'FASTENERS_CLOSURES',
    label: 'Fasteners & Closures',
    types: ['BUTTON', 'ZIPPER', 'HOOK_EYE', 'SNAP_BUTTON', 'BUCKLE', 'BELT', 'VELCRO', 'OTHER_FASTENER'],
  },
  {
    category: 'THREADS_TAPES',
    label: 'Threads & Tapes',
    types: ['THREAD', 'ELASTIC', 'DRAWSTRING', 'RIBBON', 'OTHER_TAPE'],
  },
  {
    category: 'DECORATIVE',
    label: 'Decorative',
    types: ['LACE', 'SEQUIN', 'BEAD', 'MOTIF', 'OTHER_DECORATIVE'],
  },
  {
    category: 'FUNCTIONAL',
    label: 'Functional',
    types: ['INTERLINING', 'PADDING', 'OTHER_FUNCTIONAL'],
  },
];

export const ACCESSORY_CATEGORIES: CategoryConfig[] = [
  {
    category: 'ACCESSORIES',
    label: 'Accessories',
    types: ['LABEL', 'PACKAGING'],
  },
];

/**
 * Helper Functions
 */

/**
 * Get all material configurations for a specific domain
 */
export const getMaterialConfigs = (domain: 'TRIM' | 'ACCESSORY'): MaterialTypeConfig[] => {
  if (domain === 'TRIM') {
    return ALL_MATERIAL_CONFIGS.filter((config) => config.category !== 'ACCESSORIES');
  }
  return ALL_MATERIAL_CONFIGS.filter((config) => config.category === 'ACCESSORIES');
};

/**
 * Get configuration for a specific material type
 */
export const getMaterialConfig = (type: string): MaterialTypeConfig | undefined => {
  return ALL_MATERIAL_CONFIGS.find((config) => config.type === type);
};

/**
 * Get all categories for a domain
 */
export const getAllCategories = (domain: 'TRIM' | 'ACCESSORY'): CategoryConfig[] => {
  return domain === 'TRIM' ? TRIM_CATEGORIES : ACCESSORY_CATEGORIES;
};
