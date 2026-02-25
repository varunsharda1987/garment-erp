import type { ReactNode } from 'react';

export type ProcessCategory =
  | 'pre-production'
  | 'order-management'
  | 'production'
  | 'fulfillment';

export interface ProcessPrerequisite {
  stage?: string; // prerequisite stage ID
  condition?: string; // e.g., "CAD status must be APPROVED"
  required: boolean;
}

export interface ProcessPage {
  title: string;
  path: string;
  icon: ReactNode;
}

export interface StatusTransition {
  from: string;
  to: string;
}

export interface ProcessStage {
  id: string;
  order: number;
  title: string;
  icon: ReactNode;
  category: ProcessCategory;
  description: string;
  purpose: string;
  prerequisites: ProcessPrerequisite[];
  pages: ProcessPage[];
  statusFlow: StatusTransition[];
  databaseModels: string[];
  keyFields?: string[];
  tips?: string[];
  gates?: string[]; // Critical approval gates that block next stages
}

export interface MasterDataItem {
  id: string;
  title: string;
  path: string;
  icon: ReactNode;
  phase: 'foundation' | 'business' | 'masters' | 'quality' | 'finance';
  description: string;
  priority: number; // 1 = highest priority
}

export interface ProcessCategoryInfo {
  id: ProcessCategory;
  title: string;
  description: string;
  color: string;
  gradientFrom: string;
  gradientTo: string;
}
