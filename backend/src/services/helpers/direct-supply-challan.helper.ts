/**
 * The Rule 45 challan for goods a supplier delivered STRAIGHT to a job worker (direct-to-processor
 * plan, Phase 2, 2026-09-25).
 *
 * CGST Rule 45(1): inputs go to a job worker under a challan issued by the principal "including where
 * such goods are sent directly to a job worker"; Sec 19 counts the one-year return period from the day
 * the job worker received them. So when a purchase receipt books goods at a processor's unit, we issue
 * that challan in the same transaction — OUTWARD, from the supplier on our account, to the processor,
 * already ISSUED, and dated the day the processor got the goods. It is what puts the goods on the
 * Processor Statement, in ITC-04 and in §143 ageing from arrival.
 *
 * THE ONE WRITER of these challans: GRN approval and the one-time conversion script
 * (scripts/backfill-direct-delivery.ts) both call it. A job that later uses the goods where they lie
 * files no second challan — this one covers them.
 */
import type { Prisma } from '@prisma/client';
import { Unit } from '@prisma/client';
import { createChallan, type CreateChallanItemInput } from '../challan.service';
import { addCurrency, multiplyCurrency, roundToCent, toCurrency, toNumber } from '../../utils/currency';
import { formatDate } from '../../utils/date';
import greigeStockService from '../greige-stock.service';

type Tx = Prisma.TransactionClient;

export const DIRECT_SUPPLY_REASON =
  'Job work — inputs supplied directly to the job worker on our account (CGST Rule 45(1)) — not a supply';

export interface DirectSupplyLine {
  itemType: 'GREIGE' | 'LACE' | 'FABRIC' | 'TRIM';
  greigeStockId?: string;
  laceStockId?: string;
  fabricStockId?: string;
  materialId?: string;
  /** ACTUAL metres (or units) — the fold-length rule's stock figure, never the counted one. */
  quantity: number;
  unit: Unit;
  /** The purchase rate — the material's value for the declaration, never a job-work rate. */
  rate: number;
  foldLengthCm?: number;
  description: string;
}

export interface DirectSupplyChallanInput {
  grnId: string;
  grnNumber: string;
  supplierId: string | null;
  supplierName: string;
  processorId: string;
  processorName: string;
  invoiceNumber?: string | null;
  invoiceDate?: Date | null;
  /** The day the job worker received the goods — starts the one-year return period. */
  receivedOn: Date;
  /** The challan's own date: the receipt date for a live GRN, the conversion day for a late one. */
  challanDate: Date;
  lines: DirectSupplyLine[];
  userId: string;
  /** Extra wording for the remarks, e.g. why a challan is issued late. */
  note?: string;
}

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export async function createDirectSupplyChallanInTx(
  tx: Tx,
  input: DirectSupplyChallanInput
): Promise<{ id: string; challanNumber: string }> {
  if (input.lines.length === 0) throw new Error('A direct-supply challan needs at least one line');

  const items: CreateChallanItemInput[] = input.lines.map((l) => ({
    itemType: l.itemType,
    greigeStockId: l.greigeStockId,
    laceStockId: l.laceStockId,
    fabricStockId: l.fabricStockId,
    materialId: l.materialId,
    quantity: l.quantity,
    unit: l.unit,
    rate: l.rate,
    foldLengthCm: l.foldLengthCm,
    description: l.description,
    declaredValue: toNumber(roundToCent(multiplyCurrency(l.quantity, l.rate))),
  }));
  const totalDeclared = items.reduce((acc, i) => addCurrency(acc, i.declaredValue ?? 0), toCurrency(0));

  const invoice = input.invoiceNumber
    ? `invoice ${input.invoiceNumber}${input.invoiceDate ? ` dated ${formatDate(input.invoiceDate)}` : ''}, `
    : '';
  const remarks =
    `Supplied directly by ${input.supplierName} vide ${invoice}GRN ${input.grnNumber}; ` +
    `received by job worker on ${formatDate(input.receivedOn)}.` +
    (input.note ? ` ${input.note}` : '');

  const challan = await createChallan(
    {
      challanType: 'OUTWARD',
      challanDate: input.challanDate,
      fromType: 'SUPPLIER',
      fromId: input.supplierId ?? undefined,
      fromName: `Supplied directly by ${input.supplierName}`,
      toType: 'VENDOR',
      toId: input.processorId,
      toName: input.processorName,
      issuedById: input.userId,
      status: 'ISSUED',
      issuedDate: input.challanDate,
      // The return period runs from the job worker's receipt, not from the challan's own date.
      expectedDate: new Date(input.receivedOn.getTime() + ONE_YEAR_MS),
      directSupplyGrnId: input.grnId,
      reasonForTransport: DIRECT_SUPPLY_REASON,
      totalDeclaredValue: toNumber(roundToCent(totalDeclared)),
      unit: input.lines.every((l) => l.unit === input.lines[0].unit) ? input.lines[0].unit : Unit.PIECE,
      remarks,
      items,
    },
    tx
  );

  // Greige lots point back at the challan that covers them (lace / fabric rows have no such column;
  // their challan is found through challans.directSupplyGrnId).
  const greigeIds = input.lines.map((l) => l.greigeStockId).filter((id): id is string => !!id);
  await greigeStockService.linkCoveringChallan(greigeIds, challan.id, tx);
  return { id: challan.id, challanNumber: challan.challanNumber };
}
