// Component Pattern Part Service - manage which pattern parts belong to a component master
// Backend routes: /api/components/:componentId/pattern-parts (componentPatternPart.routes.ts)
import api from '../lib/api';
import type {
  AddComponentPatternPartInput,
  ComponentPatternPart,
  UpdateComponentPatternPartInput,
} from '../types/patternPart.types';

/**
 * Get pattern parts linked to a component master
 */
export const getComponentPatternParts = async (componentId: string): Promise<ComponentPatternPart[]> => {
  const { data } = await api.get<{ success: boolean; data: ComponentPatternPart[] }>(
    `/components/${componentId}/pattern-parts`
  );
  return data.data;
};

/**
 * Link a pattern part to a component master
 */
export const addComponentPatternPart = async (
  componentId: string,
  input: AddComponentPatternPartInput
): Promise<ComponentPatternPart> => {
  const { data } = await api.post<{ success: boolean; data: ComponentPatternPart }>(
    `/components/${componentId}/pattern-parts`,
    input
  );
  return data.data;
};

/**
 * Update a component ↔ pattern part link (quantity / required / notes)
 * NOTE: the route param is the PATTERN PART id, not the junction row id
 */
export const updateComponentPatternPart = async (
  componentId: string,
  patternPartId: string,
  input: UpdateComponentPatternPartInput
): Promise<ComponentPatternPart> => {
  const { data } = await api.put<{ success: boolean; data: ComponentPatternPart }>(
    `/components/${componentId}/pattern-parts/${patternPartId}`,
    input
  );
  return data.data;
};

/**
 * Unlink a pattern part from a component master
 */
export const removeComponentPatternPart = async (componentId: string, patternPartId: string): Promise<void> => {
  await api.delete(`/components/${componentId}/pattern-parts/${patternPartId}`);
};
