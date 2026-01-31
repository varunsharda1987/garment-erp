/**
 * Material Quick Add Types
 * Type definitions for the unified material creation dialog
 */

// Material domain type
export type MaterialDomain = 'TRIM' | 'ACCESSORY';

// Field configuration for dynamic form rendering
export interface MaterialFieldConfig {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  options?: string[];
  required?: boolean;
  placeholder?: string;
  gridColumn?: '1/2' | '2/3' | '1/3'; // For responsive layout
}

// Material type configuration
export interface MaterialTypeConfig {
  type: string;
  label: string;
  icon: string;
  category: string;
  categoryLabel: string;
  codeField: string;
  nameField: string;
  fields: MaterialFieldConfig[];
  createService: (data: MaterialFormData) => Promise<any>;
}

// Category configuration
export interface CategoryConfig {
  category: string;
  label: string;
  types: string[];
}

// Form state
export interface MaterialFormData {
  name?: string;
  color?: string;
  _nameManuallyEdited?: boolean; // Internal flag to track manual edits
  [key: string]: any;
}

// Created material response
export interface CreatedMaterial {
  id: string;
  code: string;
  name: string;
  color?: string | null;
  [key: string]: any;
}
