/**
 * A material's second line — who it is for · what tells it apart ("Easybuy · Easybuy - Western Wear · Sewn-in ·
 * Main Cum Size Label"), the ONE way every screen prints it.
 *
 * The server builds both parts from the type master (`backend/src/services/helpers/material-detail.helper.ts`,
 * `attachMaterialDetails`) and sends them on the material as `buyerBrand` and `spec`. PO2609-0231 listed
 * LBL-0004 S/M/L/XL with nothing to say they were Easybuy's labels (2026-09-28): the PO page, PO list, GRN
 * screens and the PO form's picker now all show this line.
 */

export interface MaterialDetailSource {
  /** "customer · brand" — only labels and packaging carry one */
  buyerBrand?: string | null;
  /** The master's distinguishing facts, " · "-joined */
  spec?: string | null;
}

/** buyerBrand · spec, blanks skipped — '' when the material has neither (or is not loaded) */
export function materialDetailLine(material?: MaterialDetailSource | null): string {
  if (!material) return '';
  return [material.buyerBrand, material.spec]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' · ');
}
