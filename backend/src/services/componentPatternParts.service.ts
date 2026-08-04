/**
 * Component Pattern Parts Service
 *
 * Handles automatic assignment of pattern parts to components based on their component group.
 */

import prisma from '../config/database';
import { logInfo, logError } from '../utils/logger';

export interface PatternPartsAssignmentResult {
  assigned: number;
  patterns: string[];
  skipped: number;
  componentId: string;
  componentName: string;
  componentGroupName: string;
}

/**
 * Automatically assign pattern parts to a component based on its component group
 *
 * @param componentId - The ID of the component to assign pattern parts to
 * @param componentGroupId - The component group ID that determines which pattern parts to assign
 * @returns Result object with assignment statistics and pattern part codes
 */
export async function assignPatternPartsToComponent(
  componentId: string,
  componentGroupId: string
): Promise<PatternPartsAssignmentResult> {
  try {
    // Get component details
    const component = await prisma.component_masters.findUnique({
      where: { id: componentId },
      include: { componentGroup: true },
    });

    if (!component) {
      throw new Error(`Component with ID ${componentId} not found`);
    }

    // Get all pattern parts for this component group (active parts only —
    // soft-deleted parts must not be auto-assigned to new components)
    const patternPartGroups = await prisma.pattern_part_groups.findMany({
      where: { componentGroupId, patternPart: { isActive: true } },
      include: { patternPart: true },
    });

    if (patternPartGroups.length === 0) {
      logInfo(`No pattern parts found for component group ${componentGroupId}`);
      return {
        assigned: 0,
        patterns: [],
        skipped: 0,
        componentId,
        componentName: component.name,
        componentGroupName: component.componentGroup?.name || 'Unknown',
      };
    }

    // Create component_pattern_parts mappings
    let assignedCount = 0;
    let skippedCount = 0;
    const assignedPatterns: string[] = [];

    for (const ppg of patternPartGroups) {
      const patternPart = ppg.patternPart;

      // Check if mapping already exists
      const existingMapping = await prisma.component_pattern_parts.findFirst({
        where: {
          componentId,
          patternPartId: patternPart.id,
        },
      });

      if (existingMapping) {
        skippedCount++;
        continue;
      }

      // Create the mapping
      await prisma.component_pattern_parts.create({
        data: {
          componentId,
          patternPartId: patternPart.id,
          quantity: patternPart.code === 'SLEEVE' ? 2 : 1, // 2 sleeves, 1 for others
          isRequired: ['ALL_PARTS', 'BODY_FRONT', 'BODY_BACK'].includes(patternPart.code),
        },
      });

      assignedCount++;
      assignedPatterns.push(patternPart.code);
    }

    logInfo(
      `Assigned ${assignedCount} pattern parts to component "${component.name}" (${component.componentGroup?.name})`
    );

    return {
      assigned: assignedCount,
      patterns: assignedPatterns,
      skipped: skippedCount,
      componentId,
      componentName: component.name,
      componentGroupName: component.componentGroup?.name || 'Unknown',
    };
  } catch (error) {
    logError('Error assigning pattern parts to component:', error);
    throw error;
  }
}

/**
 * Inverse of assignPatternPartsToComponent: link ONE pattern part to ALL active
 * components of the given groups. Called when a pattern part is created/updated
 * with group tags, so existing components pick up the new part without manual
 * linking or the resync script. Additive only — never removes existing links.
 *
 * @param patternPartId - The pattern part to propagate
 * @param componentGroupIds - Component groups whose components should receive it
 * @returns Number of component links created
 */
export async function assignPartToGroupComponents(patternPartId: string, componentGroupIds: string[]): Promise<number> {
  if (componentGroupIds.length === 0) return 0;

  const patternPart = await prisma.pattern_part_master.findUnique({
    where: { id: patternPartId },
  });

  if (!patternPart || !patternPart.isActive) return 0;

  const components = await prisma.component_masters.findMany({
    where: { isActive: true, componentGroupId: { in: componentGroupIds } },
    select: { id: true },
  });

  if (components.length === 0) return 0;

  const result = await prisma.component_pattern_parts.createMany({
    data: components.map((component) => ({
      componentId: component.id,
      patternPartId,
      quantity: patternPart.code === 'SLEEVE' ? 2 : 1,
      isRequired: ['ALL_PARTS', 'BODY_FRONT', 'BODY_BACK'].includes(patternPart.code),
    })),
    skipDuplicates: true,
  });

  if (result.count > 0) {
    logInfo(`Propagated pattern part "${patternPart.code}" to ${result.count} component(s) via group tags`);
  }

  return result.count;
}

/**
 * Check if a component has pattern parts assigned
 *
 * @param componentId - The ID of the component to check
 * @returns True if component has pattern parts, false otherwise
 */
export async function hasPatternParts(componentId: string): Promise<boolean> {
  const count = await prisma.component_pattern_parts.count({
    where: { componentId },
  });

  return count > 0;
}

/**
 * Get pattern parts for a component
 *
 * @param componentId - The ID of the component
 * @returns Array of pattern parts with details
 */
export async function getComponentPatternParts(componentId: string) {
  return await prisma.component_pattern_parts.findMany({
    where: { componentId },
    include: {
      patternPart: true,
    },
    orderBy: {
      patternPart: {
        sortOrder: 'asc',
      },
    },
  });
}
