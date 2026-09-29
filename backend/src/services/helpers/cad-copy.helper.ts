/**
 * Copying a CAD row's MARKER — the geometry CAD Planning owns — into a new row.
 *
 * Two writers make a row from another one: "Copy to Raw Mat" (cad-approval.controller
 * copyCADPurpose) and "Create CAD" on a received stock lot (cad-embroidery.controller
 * createProductionCADFromStock). Until 2026-09-23 they copied different subsets: Copy (then also
 * "Copy to Production") took the sizes but also the PRICE, and Create CAD took the layer length but
 * no sizes, pieces or average (so the row arrived with CAD Avg blank). One field list now serves
 * both. Since 2026-09-25 Create CAD is the only way to make a Production CAD.
 *
 * Costing columns are deliberately NOT here — see CLAUDE.md "Fabric Costing IS the CAD row":
 * they belong to Fabric Costing, and a PRODUCTION row is never costed.
 */

import { Prisma, fabric_width_cad } from '@prisma/client';

type Tx = Prisma.TransactionClient;

type MarkerSource = Pick<
  fabric_width_cad,
  | 'fabricId'
  | 'cutableWidth'
  | 'widthUnit'
  | 'cadMeters'
  | 'cadYards'
  | 'cadAverage'
  | 'cadWastagePercent'
  | 'markerEfficiency'
  | 'printDirection'
  | 'layerMarginMeters'
  | 'greigeId'
  | 'componentName'
  | 'patternPartId'
  | 'isEmbroidery'
  | 'piecesPerMarker'
  | 'markerLengthMeters'
>;

/** The marker a copy inherits: width, layer, pieces, average, part, print — never a price. */
export function cadMarkerFields(src: MarkerSource) {
  return {
    fabricId: src.fabricId,
    cutableWidth: src.cutableWidth,
    widthUnit: src.widthUnit,
    cadMeters: src.cadMeters,
    cadYards: src.cadYards,
    cadAverage: src.cadAverage,
    cadWastagePercent: src.cadWastagePercent,
    markerEfficiency: src.markerEfficiency,
    printDirection: src.printDirection,
    layerMarginMeters: src.layerMarginMeters,
    greigeId: src.greigeId,
    componentName: src.componentName,
    patternPartId: src.patternPartId,
    isEmbroidery: src.isEmbroidery,
    piecesPerMarker: src.piecesPerMarker,
    markerLengthMeters: src.markerLengthMeters,
    // markerPlanFile is retired (2026-09-28): the marker IMAGE is carried by copyMarkerImage (cad-marker.helper)
  };
}

/**
 * The marker's children: the size ratio and the multi-part selection.
 *
 * `sizeIdMap` is for a copy into ANOTHER style (Create Colourway): each size row's `sizeId` points at the
 * source style's size_options, so it is swapped for the target style's size of the same name (null when that
 * size was not copied — the row keeps its sizeName). Within one style it is omitted and sizeId is kept.
 */
export async function copyCadChildren(
  tx: Tx,
  sourceCadId: string,
  targetCadId: string,
  sizeIdMap?: ReadonlyMap<string, string>
): Promise<void> {
  const [sizes, parts] = await Promise.all([
    tx.cad_size_breakdown.findMany({ where: { cadId: sourceCadId } }),
    tx.cad_pattern_parts.findMany({ where: { cadId: sourceCadId } }),
  ]);
  const sizeIdOf = (sizeId: string | null): string | null =>
    sizeIdMap ? (sizeId ? (sizeIdMap.get(sizeId) ?? null) : null) : sizeId;
  if (sizes.length > 0) {
    await tx.cad_size_breakdown.createMany({
      data: sizes.map((s) => ({
        cadId: targetCadId,
        sizeName: s.sizeName,
        sizeId: sizeIdOf(s.sizeId),
        quantity: s.quantity,
      })),
    });
  }
  if (parts.length > 0) {
    await tx.cad_pattern_parts.createMany({
      data: parts.map((p) => ({ cadId: targetCadId, patternPartId: p.patternPartId })),
      skipDuplicates: true,
    });
  }
}
