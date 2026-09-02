/**
 * Material Quick Add Types
 * Type definitions for the unified material creation dialog
 */

// Material domain type
export type MaterialDomain = 'TRIM' | 'ACCESSORY';

// Conditional field configuration
export interface ConditionalConfig {
  /** Field name to check */
  field: string;
  /** Value that makes this field visible. Use true/false for booleans, or specific string values */
  value: boolean | string;
  /** If true, show when the condition is NOT met (inverse logic) */
  inverse?: boolean;
}

// Field configuration for dynamic form rendering
export interface MaterialFieldConfig {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  options?: string[];
  required?: boolean;
  placeholder?: string;
  gridColumn?: '1/2' | '2/3' | '1/3'; // For responsive layout
  /** Show this field only when condition is met */
  showWhen?: ConditionalConfig;
  /** Help text displayed below the field */
  helpText?: string;
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
  /**
   * Service function to create the material
   * @param data - Form data
   * @param styleCode - Optional style code to auto-associate the material with
   */
  createService: (data: MaterialFormData, styleCode?: string) => Promise<MaterialCreateResult>;
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
  [key: string]: string | number | boolean | undefined;
}

// Raw result from material create API - has id plus dynamic type-specific fields
export interface MaterialCreateResult {
  id: string;
  [key: string]: unknown;
}

// Created material response
export interface CreatedMaterial {
  id: string;
  code: string;
  name: string;
  color?: string | null;
  /** The material type that was actually created (e.g., 'BUTTON', 'LACE') */
  materialType?: string;
  [key: string]: unknown;
}
