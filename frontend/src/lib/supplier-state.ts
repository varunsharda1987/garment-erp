/**
 * A supplier's state for GST — the ONE rule for "is this purchase interstate (IGST) or not (CGST + SGST)".
 *
 * Same order as the server (`gstService.isInterstatePO`): the primary GSTIN's state code, else any GSTIN's,
 * else the billing state's code. None of them → null: the server then assumes in-state (CGST + SGST), so the
 * form must SAY it is assuming. Before 2026-09-28 the form read only the GSTINs and the server also read the
 * billing state, so the two could split the tax differently for one supplier.
 */

/**
 * What the rule reads. Both shapes the PO form holds fit: GET /suppliers/:id (`Supplier`, billing state with
 * its code) and a loaded PO's `supplier` (`SupplierSummary`, whose billing state carries only its name).
 */
export interface SupplierStateSource {
  gstNumbers?: ReadonlyArray<{ stateCode?: string | null; isPrimary?: boolean | null }> | null;
  billingState?: { stateCode?: string | null; stateName?: string | null } | null;
}

function code(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** The supplier's two-digit GST state code ("08"), or null when nothing on file says where it is. */
export function supplierStateCode(supplier: SupplierStateSource | null | undefined): string | null {
  if (!supplier) return null;
  const gstins = supplier.gstNumbers ?? [];
  const primary = gstins.find((g) => g.isPrimary && code(g.stateCode));
  if (primary) return code(primary.stateCode);
  const any = gstins.find((g) => code(g.stateCode));
  if (any) return code(any.stateCode);
  return code(supplier.billingState?.stateCode);
}
