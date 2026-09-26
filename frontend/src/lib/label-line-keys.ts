/**
 * The label key of a line, for each shape of line a screen shows — fed to `groupLabelLines` (./label-lines)
 * so a label's sizes sit under one heading. Every accessor returns null for anything that is not a label.
 */
import type { LabelLineKey } from './label-lines';
import type { MaterialRequirement, POPreviewItem } from '@/types/mrp.types';
import type { PendingPOItem } from '@/types/grn.types';
import type { MaterialSummary } from '@/types/purchaseOrder.types';

type LabelRef = { id: string; code: string; name: string; type?: string | null } | null | undefined;

function fromLabel(label: LabelRef, size: string | null | undefined): LabelLineKey | null {
  return label
    ? { labelId: label.id, code: label.code, name: label.name, type: label.type ?? null, size: size ?? null }
    : null;
}

/** A requirement (GET /mrp/requirements carries `label` + `size`). */
export const requirementLabelKey = (r: MaterialRequirement) => fromLabel(r.label, r.size);

/** A PO preview line. */
export const previewItemLabelKey = (i: POPreviewItem) => fromLabel(i.label, i.size);

/** A GRN pending line (GET /grn/po/:poId/pending). */
export const pendingItemLabelKey = (i: PendingPOItem) =>
  i.labelId && i.labelCode
    ? fromLabel({ id: i.labelId, code: i.labelCode, name: i.labelName ?? i.labelCode }, i.size)
    : null;

/** A saved PO line (GET /purchase-orders/:id — its `materials` carries labelMaster / labelSizeVariant). */
export const poItemLabelKey = (item: { materials?: MaterialSummary | null }) => {
  const lm = item.materials?.labelMaster;
  return lm
    ? fromLabel(
        { id: lm.id, code: lm.labelCode, name: lm.labelName, type: lm.labelType },
        item.materials?.labelSizeVariant?.size
      )
    : null;
};

/** A line on the PO form (label fields set when the line is added or loaded). */
export const formLineLabelKey = (line: {
  labelId?: string | null;
  labelCode?: string | null;
  labelName?: string | null;
  size?: string | null;
}) =>
  line.labelId && line.labelCode
    ? fromLabel({ id: line.labelId, code: line.labelCode, name: line.labelName ?? line.labelCode }, line.size)
    : null;
