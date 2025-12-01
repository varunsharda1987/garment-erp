/**
 * StyleForm Feature Module
 *
 * Decomposed from the original monolithic StyleFormRedesigned.tsx (1,652 lines)
 * into smaller, maintainable components following feature-based architecture.
 *
 * Structure:
 * - types.ts: Type definitions and constants
 * - StyleFormContext.tsx: Centralized state management using React Context + useReducer
 * - tabs/: Individual tab components
 *   - BasicInfoTab.tsx: Basic info + additional details
 *   - FabricsTrimsTab.tsx: Fabrics & trims management
 *   - ProcessesTab.tsx: Production processes
 *   - AccessoriesTab.tsx: Garment & packaging accessories
 * - hooks/: Custom hooks for form logic
 *
 * Usage:
 * ```tsx
 * import { StyleFormProvider, useStyleForm } from '@/features/styles/StyleForm';
 * import { BasicInfoTab, FabricsTrimsTab } from '@/features/styles/StyleForm/tabs';
 * ```
 */

// Context and Provider
export { StyleFormProvider, useStyleForm } from './StyleFormContext';
export type { StyleFormState } from './StyleFormContext';

// Types and Constants
export * from './types';

// Tab Components
export * from './tabs';

// Hooks
export * from './hooks';
