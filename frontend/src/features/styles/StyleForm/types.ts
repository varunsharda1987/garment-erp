/**
 * StyleForm Types and Constants
 * Shared type definitions for the Style Form components
 */

// ============================================
// Enums and Type Aliases
// ============================================

export type FabricFinishType = 'DYED' | 'PRINTED' | 'YARN_DYED' | 'RAW';
export type CADStatus = 'PENDING' | 'IN_PROGRESS' | 'APPROVED';
export type ProcessType =
  | 'CUTTING'
  | 'STITCHING'
  | 'FINISHING'
  | 'TRANSPORTATION'
  | 'EMBROIDERY'
  | 'HANDWORK'
  | 'SMOCKING'
  | 'WASHING';

// ============================================
// Interfaces
// ============================================

export interface FabricEntry {
  id: string;
  componentName: string;
  genericGreigeName: string;
  fabricFinishType: FabricFinishType | '';
  estimatedConsumption: number;
  unit: 'METER' | 'YARD';
  notes?: string;
}

export interface SKUVariant {
  size: string;
  sku: string;
  barcode?: string;
  accountingSKU?: string;
  isActive: boolean;
}

export interface ProcessEntry {
  processType: ProcessType;
  description?: string;
  vendor?: string;
  estimatedCost?: number;
  isRequired: boolean;
}

export interface SelectedComponent {
  category: string;
  componentId: string;
}

// ============================================
// Constants
// ============================================

export const FABRIC_FINISH_TYPES: { value: FabricFinishType; label: string }[] = [
  { value: 'DYED', label: 'Solid Dyed' },
  { value: 'PRINTED', label: 'Printed' },
  { value: 'YARN_DYED', label: 'Yarn Dyed (Checks/Stripes)' },
  { value: 'RAW', label: 'Raw/Unfinished' },
];

export const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export const PRODUCTION_PROCESSES: { type: ProcessType; label: string; preChecked: boolean }[] = [
  { type: 'CUTTING', label: 'Cutting', preChecked: true },
  { type: 'STITCHING', label: 'Stitching', preChecked: true },
  { type: 'FINISHING', label: 'Finishing', preChecked: true },
  { type: 'TRANSPORTATION', label: 'Transportation', preChecked: true },
  { type: 'EMBROIDERY', label: 'Embroidery', preChecked: false },
  { type: 'HANDWORK', label: 'Handwork', preChecked: false },
  { type: 'SMOCKING', label: 'Smocking', preChecked: false },
  { type: 'WASHING', label: 'Washing', preChecked: false },
];

// ============================================
// Helper Functions
// ============================================

export const createDefaultFabric = (index: number = 1): FabricEntry => ({
  id: crypto.randomUUID(),
  componentName: `Component ${index}`,
  genericGreigeName: '',
  fabricFinishType: '',
  estimatedConsumption: 0,
  unit: 'METER',
  notes: ''
});

export const createDefaultSKUVariants = (): SKUVariant[] =>
  DEFAULT_SIZES.map(size => ({
    size,
    sku: '',
    barcode: '',
    isActive: true
  }));

export const createDefaultProcesses = (): ProcessEntry[] =>
  PRODUCTION_PROCESSES.map(p => ({
    processType: p.type,
    isRequired: p.preChecked,
    description: '',
    vendor: '',
    estimatedCost: undefined
  }));
