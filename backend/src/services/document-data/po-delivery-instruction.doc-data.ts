/**
 * Delivery Instruction — one page telling the supplier where to deliver a PO (direct-to-processor plan,
 * Phase 3, 2026-09-26). Shared at the "decide at dispatch" moment, or after the delivery changes,
 * without re-sending the whole PO. Built from the same data as the PO print's 03 Delivery Points
 * (po-ship-to.ts), so the two never disagree.
 */
import prisma from '../../config/database';
import { BusinessError, NotFoundError } from '../../errors';
import { buildCompanyBlock, CompanyBlock } from './company-block';
import { fmtDate } from './format';
import { JOB_WORK_SHIP_TO_NOTE, loadPoShipToPlan, ONE_INVOICE_PER_DELIVERY, PoShipTo } from './po-ship-to';

export interface PoDeliveryInstructionDocData {
  company: CompanyBlock;
  docNo: string;
  docPill: string;
  poNumber: string;
  poDate: string;
  requiredBy: string;
  supplierName: string;
  toBeAdvised: boolean;
  toBeAdvisedLine: string;
  shipTos: PoShipTo[];
  placesLabel: string;
  jobWorkNote: string;
  oneInvoiceNote: string;
  revisionLine: string;
}

export async function buildPoDeliveryInstructionDocData(poId: string): Promise<PoDeliveryInstructionDocData> {
  const [company, po] = await Promise.all([
    buildCompanyBlock(),
    prisma.purchase_orders.findUnique({
      where: { id: poId },
      select: {
        poNumber: true,
        poDate: true,
        expectedDeliveryDate: true,
        poCategory: true,
        suppliers: { select: { name: true } },
      },
    }),
  ]);
  if (!po) throw new NotFoundError('Purchase order', poId);
  if (po.poCategory === 'PROCESSING') {
    throw new BusinessError('This is a legacy processing order — print the Job Work Order instead');
  }

  const plan = await loadPoShipToPlan(poId, { addressLine: company.addressLine, gstin: company.gstin ?? null });
  return {
    company,
    docNo: `${po.poNumber}-DI${plan.amendmentNo > 0 ? `-A${plan.amendmentNo}` : ''}`,
    docPill: 'Delivery Instruction · against our PO',
    poNumber: po.poNumber,
    poDate: fmtDate(po.poDate),
    requiredBy: fmtDate(po.expectedDeliveryDate),
    supplierName: po.suppliers.name,
    toBeAdvised: plan.mode === 'TO_BE_ADVISED',
    toBeAdvisedLine: plan.toBeAdvisedLine,
    shipTos: plan.shipTos,
    placesLabel: plan.mode === 'SPLIT' ? `${plan.shipTos.length} delivery places` : 'One delivery place',
    jobWorkNote: JOB_WORK_SHIP_TO_NOTE,
    oneInvoiceNote: ONE_INVOICE_PER_DELIVERY,
    revisionLine:
      plan.amendmentNo > 0
        ? `Amendment ${plan.amendmentNo} · ${plan.amendmentDate} — supersedes earlier instructions`
        : 'Original instruction',
    // The internal reason for a change stays on the PO's revision history — never on the supplier's page
  };
}
