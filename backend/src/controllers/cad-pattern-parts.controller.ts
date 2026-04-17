/**
 * CAD Pattern Parts Controller
 * Handles pattern part assignment and retrieval for CAD planning.
 * Extracted from cad-planning.controller.ts
 */

import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { NotFoundError, ValidationError } from '../errors';

// ============================================================================
// PATTERN PARTS API ENDPOINTS
// ============================================================================

/**
 * Get pattern parts assigned to a style fabric
 * GET /api/styles/:styleId/fabrics/:fabricId/pattern-parts
 */
export async function getStyleFabricPatternParts(req: Request, res: Response) {
  const { styleId, fabricId } = req.params;

  // Verify style and fabric exist
  const styleFabric = await prisma.style_fabrics.findFirst({
    where: {
      id: fabricId,
      style_components: {
        styleId: styleId,
      },
    },
    include: {
      style_components: true,
      stylePatternParts: {
        include: {
          patternPart: true,
        },
      },
    },
  });

  if (!styleFabric) {
    throw new NotFoundError('Style fabric', fabricId);
  }

  // Get component pattern parts from component_master
  // Look up by componentType (which should match component_masters.name)
  const componentMaster = await prisma.component_masters.findFirst({
    where: {
      OR: [{ name: styleFabric.style_components.componentType }, { name: styleFabric.style_components.componentName }],
      isActive: true,
    },
    include: {
      patternParts: {
        include: {
          patternPart: true,
        },
      },
    },
  });

  // Get available pattern parts from component master (for selection)
  const availableFromComponent =
    componentMaster?.patternParts.map(
      (cpp: { patternPartId: string; quantity: number; patternPart: { name: string; code: string } }) => ({
        id: cpp.patternPartId,
        partName: cpp.patternPart.name,
        partCode: cpp.patternPart.code,
        quantity: cpp.quantity,
        isFromComponent: true,
      })
    ) || [];

  // Get currently assigned pattern parts
  const assignedParts = styleFabric.stylePatternParts.map((spp) => ({
    id: spp.id,
    patternPartId: spp.patternPartId,
    partName: spp.patternPart.name,
    partCode: spp.patternPart.code,
    quantity: spp.quantity,
    goesToEmbroidery: spp.goesToEmbroidery,
    notes: spp.notes,
  }));

  return res.json({
    success: true,
    data: {
      styleFabricId: fabricId,
      componentId: styleFabric.componentId,
      componentName: styleFabric.style_components.componentName,
      componentType: styleFabric.style_components.componentType,
      availableFromComponent,
      assignedParts,
      hasEmbroideryParts: assignedParts.some((p) => p.goesToEmbroidery),
    },
  });
}

/**
 * Assign pattern parts to a style fabric
 * POST /api/styles/:styleId/fabrics/:fabricId/pattern-parts
 * Body: { patternParts: [{ patternPartId, quantity?, goesToEmbroidery?, notes? }] }
 */
export async function assignPatternParts(req: Request, res: Response) {
  const { styleId, fabricId } = req.params;
  const { patternParts } = req.body;

  if (!patternParts || !Array.isArray(patternParts)) {
    throw new ValidationError('patternParts array is required');
  }

  // Verify style fabric exists
  const styleFabric = await prisma.style_fabrics.findFirst({
    where: {
      id: fabricId,
      style_components: {
        styleId: styleId,
      },
    },
  });

  if (!styleFabric) {
    throw new NotFoundError('Style fabric', fabricId);
  }

  // Delete existing assignments and create new ones
  await prisma.style_pattern_parts.deleteMany({
    where: { styleFabricId: fabricId },
  });

  // Create new assignments
  const createdParts = await prisma.style_pattern_parts.createMany({
    data: patternParts.map(
      (part: { patternPartId: string; quantity?: number; goesToEmbroidery?: boolean; notes?: string }) => ({
        styleFabricId: fabricId,
        patternPartId: part.patternPartId,
        quantity: part.quantity || 1,
        goesToEmbroidery: part.goesToEmbroidery || false,
        notes: part.notes || null,
      })
    ),
  });

  // Fetch created parts with relations
  const assignedParts = await prisma.style_pattern_parts.findMany({
    where: { styleFabricId: fabricId },
    include: {
      patternPart: true,
    },
  });

  return res.json({
    success: true,
    message: `${createdParts.count} pattern parts assigned successfully`,
    data: {
      styleFabricId: fabricId,
      assignedParts: assignedParts.map((spp) => ({
        id: spp.id,
        patternPartId: spp.patternPartId,
        partName: spp.patternPart.name,
        partCode: spp.patternPart.code,
        quantity: spp.quantity,
        goesToEmbroidery: spp.goesToEmbroidery,
        notes: spp.notes,
      })),
      hasEmbroideryParts: assignedParts.some((p) => p.goesToEmbroidery),
    },
  });
}

/**
 * Update a pattern part assignment (e.g., toggle embroidery flag)
 * PUT /api/styles/:styleId/pattern-parts/:partId
 * Body: { quantity?, goesToEmbroidery?, notes? }
 */
export async function updatePatternPartAssignment(req: Request, res: Response) {
  const { styleId, partId } = req.params;
  const { quantity, goesToEmbroidery, notes } = req.body;

  // Verify assignment exists and belongs to this style
  const existing = await prisma.style_pattern_parts.findFirst({
    where: {
      id: partId,
      styleFabric: {
        style_components: {
          styleId: styleId,
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError('Pattern part assignment', partId);
  }

  // Build update data
  const updateData: Prisma.style_pattern_partsUpdateInput = {};
  if (quantity !== undefined) updateData.quantity = quantity;
  if (goesToEmbroidery !== undefined) updateData.goesToEmbroidery = goesToEmbroidery;
  if (notes !== undefined) updateData.notes = notes;

  const updated = await prisma.style_pattern_parts.update({
    where: { id: partId },
    data: updateData,
    include: {
      patternPart: true,
    },
  });

  return res.json({
    success: true,
    message: 'Pattern part assignment updated successfully',
    data: {
      id: updated.id,
      patternPartId: updated.patternPartId,
      partName: updated.patternPart.name,
      partCode: updated.patternPart.code,
      quantity: updated.quantity,
      goesToEmbroidery: updated.goesToEmbroidery,
      notes: updated.notes,
    },
  });
}

/**
 * Delete a pattern part assignment
 * DELETE /api/styles/:styleId/pattern-parts/:partId
 */
export async function deletePatternPartAssignment(req: Request, res: Response) {
  const { styleId, partId } = req.params;

  // Verify assignment exists and belongs to this style
  const existing = await prisma.style_pattern_parts.findFirst({
    where: {
      id: partId,
      styleFabric: {
        style_components: {
          styleId: styleId,
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError('Pattern part assignment', partId);
  }

  await prisma.style_pattern_parts.delete({
    where: { id: partId },
  });

  return res.json({
    success: true,
    message: 'Pattern part assignment deleted successfully',
  });
}

/**
 * Bulk assign pattern parts from component definition
 * POST /api/styles/:styleId/fabrics/:fabricId/pattern-parts/from-component
 * Copies pattern parts from component_pattern_parts to style_pattern_parts
 */
export async function assignPatternPartsFromComponent(req: Request, res: Response) {
  const { styleId, fabricId } = req.params;

  // Verify style fabric exists
  const styleFabric = await prisma.style_fabrics.findFirst({
    where: {
      id: fabricId,
      style_components: {
        styleId: styleId,
      },
    },
    include: {
      style_components: true,
    },
  });

  if (!styleFabric) {
    throw new NotFoundError('Style fabric', fabricId);
  }

  // Get component pattern parts from component_master
  const componentMaster = await prisma.component_masters.findFirst({
    where: {
      OR: [{ name: styleFabric.style_components.componentType }, { name: styleFabric.style_components.componentName }],
      isActive: true,
    },
    include: {
      patternParts: {
        include: {
          patternPart: true,
        },
      },
      componentGroup: true,
    },
  });

  // Define a common structure for pattern parts from either source
  type PatternPartItem = {
    patternPartId: string;
    quantity: number;
    patternPart: {
      id: string;
      name: string;
      code: string;
    };
  };

  let componentParts: PatternPartItem[] = (componentMaster?.patternParts || []).map((pp) => ({
    patternPartId: pp.patternPartId,
    quantity: pp.quantity,
    patternPart: {
      id: pp.patternPart.id,
      name: pp.patternPart.name,
      code: pp.patternPart.code,
    },
  }));

  // If no direct pattern parts, try to get pattern parts via component group
  if (componentParts.length === 0 && componentMaster?.componentGroup) {
    const groupPatternParts = await prisma.pattern_part_groups.findMany({
      where: {
        componentGroupId: componentMaster.componentGroup.id,
      },
      include: {
        patternPart: true,
      },
    });

    // Map to same structure
    componentParts = groupPatternParts.map((gpp) => ({
      patternPartId: gpp.patternPartId,
      quantity: 1, // Default quantity when loading from group
      patternPart: {
        id: gpp.patternPart.id,
        name: gpp.patternPart.name,
        code: gpp.patternPart.code,
      },
    }));
  }

  if (componentParts.length === 0) {
    throw new ValidationError(
      'No pattern parts defined for this component (checked both component_pattern_parts and pattern_part_groups)'
    );
  }

  // Delete existing assignments
  await prisma.style_pattern_parts.deleteMany({
    where: { styleFabricId: fabricId },
  });

  // Create assignments from component definition
  await prisma.style_pattern_parts.createMany({
    data: componentParts.map((cpp: { patternPartId: string; quantity: number }) => ({
      styleFabricId: fabricId,
      patternPartId: cpp.patternPartId,
      quantity: cpp.quantity,
      goesToEmbroidery: false, // Default to false - user marks which go to embroidery
      notes: null,
    })),
  });

  // Fetch created parts
  const assignedParts = await prisma.style_pattern_parts.findMany({
    where: { styleFabricId: fabricId },
    include: {
      patternPart: true,
    },
  });

  return res.json({
    success: true,
    message: `${assignedParts.length} pattern parts copied from component`,
    data: {
      styleFabricId: fabricId,
      assignedParts: assignedParts.map((spp) => ({
        id: spp.id,
        patternPartId: spp.patternPartId,
        partName: spp.patternPart.name,
        partCode: spp.patternPart.code,
        quantity: spp.quantity,
        goesToEmbroidery: spp.goesToEmbroidery,
        notes: spp.notes,
      })),
      hasEmbroideryParts: false,
    },
  });
}

/**
 * Get CAD pattern parts for a style component
 * Returns pattern parts from CAD entries first, then remaining component master parts
 *
 * @route GET /api/styles/:styleId/components/:componentId/cad-pattern-parts
 */
export async function getCADPatternPartsForComponent(req: Request, res: Response) {
  const { styleId, componentId } = req.params;

  // 1. Get the component with style_fabrics, CAD rows, and stylePatternParts
  const component = await prisma.style_components.findUnique({
    where: { id: componentId },
    include: {
      style_fabrics: {
        include: {
          cadRows: {
            where: {
              patternPartId: { not: null },
            },
            include: {
              patternPart: true,
            },
          },
          stylePatternParts: {
            include: {
              patternPart: true,
            },
          },
        },
      },
    },
  });

  if (!component) {
    throw new NotFoundError('Component', componentId);
  }

  // Verify the component belongs to the specified style
  if (component.styleId !== styleId) {
    throw new ValidationError('Component does not belong to the specified style');
  }

  // 2. Build a map of pattern part ID -> goesToEmbroidery from stylePatternParts
  const embroideryMap = new Map<string, boolean>();
  component.style_fabrics.forEach(
    (fabric: {
      stylePatternParts: Array<{
        patternPartId: string;
        goesToEmbroidery?: boolean;
      }>;
    }) => {
      fabric.stylePatternParts.forEach((spp) => {
        if (spp.goesToEmbroidery) {
          embroideryMap.set(spp.patternPartId, true);
        }
      });
    }
  );

  // 3. Get pattern parts from CAD entries (from cadRows with patternPartId)
  const cadPartIds = new Set<string>();
  const cadPatternParts: Array<{
    id: string;
    code: string;
    name: string;
    hasCAD: boolean;
    goesToEmbroidery: boolean;
    cadRowId?: string;
  }> = [];

  component.style_fabrics.forEach(
    (fabric: {
      cadRows: Array<{
        id: string;
        patternPartId: string | null;
        patternPart: { id: string; code: string; name: string } | null;
      }>;
    }) => {
      fabric.cadRows.forEach((cadRow) => {
        if (cadRow.patternPartId && cadRow.patternPart && !cadPartIds.has(cadRow.patternPartId)) {
          cadPartIds.add(cadRow.patternPartId);
          cadPatternParts.push({
            id: cadRow.patternPart.id,
            code: cadRow.patternPart.code,
            name: cadRow.patternPart.name,
            hasCAD: true,
            goesToEmbroidery: embroideryMap.get(cadRow.patternPartId) || false,
            cadRowId: cadRow.id,
          });
        }
      });
    }
  );

  // 4. Look up component master by name (not FK - uses componentType/componentName)
  const componentMaster = await prisma.component_masters.findFirst({
    where: {
      OR: [{ name: component.componentType }, { name: component.componentName }],
      isActive: true,
    },
    include: {
      patternParts: {
        include: {
          patternPart: true,
        },
        orderBy: { patternPart: { sortOrder: 'asc' } },
      },
      componentGroup: true,
    },
  });

  // 5. Get remaining pattern parts from component master (not in CAD)
  const masterPatternParts: Array<{
    id: string;
    code: string;
    name: string;
    hasCAD: boolean;
    goesToEmbroidery: boolean;
  }> = [];

  if (componentMaster?.patternParts) {
    componentMaster.patternParts.forEach(
      (pp: { patternPartId: string; patternPart: { id: string; code: string; name: string } }) => {
        if (!cadPartIds.has(pp.patternPartId)) {
          masterPatternParts.push({
            id: pp.patternPart.id,
            code: pp.patternPart.code,
            name: pp.patternPart.name,
            hasCAD: false,
            goesToEmbroidery: embroideryMap.get(pp.patternPartId) || false,
          });
        }
      }
    );
  }

  // 6. If no direct pattern parts, try via component group
  if (masterPatternParts.length === 0 && componentMaster?.componentGroup) {
    const groupPatternParts = await prisma.pattern_part_groups.findMany({
      where: {
        componentGroupId: componentMaster.componentGroup.id,
      },
      include: {
        patternPart: true,
      },
    });

    groupPatternParts.forEach(
      (gpp: { patternPartId: string; patternPart: { id: string; code: string; name: string } }) => {
        if (!cadPartIds.has(gpp.patternPartId)) {
          masterPatternParts.push({
            id: gpp.patternPart.id,
            code: gpp.patternPart.code,
            name: gpp.patternPart.name,
            hasCAD: false,
            goesToEmbroidery: embroideryMap.get(gpp.patternPartId) || false,
          });
        }
      }
    );
  }

  return res.json({
    success: true,
    data: {
      styleId,
      componentId,
      componentName: component.componentName,
      cadPatternParts,
      masterPatternParts,
    },
  });
}
