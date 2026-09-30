import type { StitchingIssue } from '@/types/stitching.types';

/**
 * Issued, good, defect and not-yet-recorded pieces of a stitching issue (whole pieces). A defect is a
 * piece accounted for: the server caps each size at issued − (good + defect) and asks for a reason
 * to complete while any piece is not recorded.
 */
export function stitchingOutputTotals(issue: Pick<StitchingIssue, 'skuBreakdown' | 'dailyOutputs'>) {
  const issued = issue.skuBreakdown?.reduce((sum, sku) => sum + sku.issuedQty, 0) ?? 0;
  const outputs = issue.dailyOutputs?.flatMap((o) => o.skuOutputs ?? []) ?? [];
  const good = outputs.reduce((sum, o) => sum + o.goodQty, 0);
  const defect = outputs.reduce((sum, o) => sum + o.defectQty, 0);
  return { issued, good, defect, unrecorded: Math.max(0, issued - good - defect) };
}
