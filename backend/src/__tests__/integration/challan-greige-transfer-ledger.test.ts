/**
 * Greige transfer-to-processor ledger (2026-09-07; on-hand at the unit since Phase 4e, 2026-09-26).
 *
 * Issuing an OUTWARD challan to a processor does two things: it consumes the metres from the
 * source lot, and it creates a new lot holding those metres at the processor's unit. Since Phase 4e
 * that lot is ON HAND at the unit — the store gives the metres up, the unit takes them on, and
 * derived_stock_view counts the lot — and the challan goes out as a job-work challan (toType VENDOR,
 * Rule 45 wording, one-year return) so ITC-04 lists it. Until then the lot was kept off the ledger,
 * and a Stock-Out's metres vanished from every stock total while the processor held them (GRG-0006).
 *
 * What was wrong was the audit trail. The source lot got TWO debit rows for one physical
 * movement: a CONSUMPTION written by consumeGreigeStock, plus a second TRANSFER_OUT written by
 * the challan service against the SAME (source) lot, with balanceAfter hard-coded to 0 and a
 * comment claiming consumeGreigeStock would correct it — which never happened, because that runs
 * first and writes its own row. Reading the lot's history, 500 m looked like 1000 m.
 *
 * Live evidence this suite is modelled on — greige GRG-0006, challan CH2607-0001, 29 Jul 2026:
 *     CONSUMPTION  -500  balanceAfter 4883.14   referenceId null
 *     TRANSFER_OUT -500  balanceAfter 0         referenceId <challan>
 * The duplicate row existed only to carry the challan reference, which the consumption row now
 * carries itself.
 */

import { randomUUID } from 'crypto';
import { prisma, createTestUser } from '../helpers/test-utils';
import { issueChallan, STOCK_OUT_TO_JOB_WORKER_REASON } from '../../services/challan.service';
import greigeStockService from '../../services/greige-stock.service';
import { jobWorkStatutoryService } from '../../services/job-work-statutory.service';
import { toDateInputValue } from '../../utils/date';

const RUN = `CGT${Date.now().toString(36).toUpperCase()}`;

let userId: string;
let greigeId: string;
let sourceStockId: string;
let processorId: string;
let processorWarehouseId: string;
let sourceWarehouseId: string;
let challanId: string;

const only = (id: string | undefined) => id ?? '__unset__';

const START_QTY = 5383.14;
const TRANSFER_QTY = 500;

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;

  const processor = await prisma.suppliers.create({
    data: {
      code: `${RUN}-PROC`,
      name: `${RUN} Processing Unit`,
      supplierCategories: ['DYEING_PRINTING'],
      isActive: true,
      createdById: userId,
    },
  });
  processorId = processor.id;

  const srcWh = await prisma.warehouses.create({
    data: {
      warehouseCode: `${RUN}-SRC`,
      warehouseName: `${RUN} Main Store`,
      warehouseType: 'RAW_MATERIAL',
      isActive: true,
      createdById: userId,
    },
  });
  sourceWarehouseId = srcWh.id;

  // The processor warehouse is found by supplierId — that link is what routes the new lot.
  const procWh = await prisma.warehouses.create({
    data: {
      warehouseCode: `${RUN}-PROCWH`,
      warehouseName: `${RUN} Processing Unit Warehouse`,
      warehouseType: 'JOB_WORK',
      supplierId: processorId,
      isActive: true,
      createdById: userId,
    },
  });
  processorWarehouseId = procWh.id;

  const greige = await prisma.greige_master.create({
    data: {
      greigeCode: `${RUN}-GRG`,
      greigeName: `${RUN} Cambric 48"`,
      composition: '100% Cotton',
      greigeWidth: 48,
      createdById: userId,
    },
  });
  greigeId = greige.id;

  const lot = await prisma.greige_stock.create({
    data: {
      greigeId,
      quantityAvailable: START_QTY,
      quantityReserved: 0,
      quantityConsumed: 0,
      unit: 'METER',
      greigeWidth: 48,
      warehouseId: sourceWarehouseId,
      warehouseLocation: srcWh.warehouseName,
      receivedDate: new Date(),
      status: 'AVAILABLE',
      stockType: 'GENERIC',
      sourceType: 'MANUAL',
      createdById: userId,
    },
  });
  sourceStockId = lot.id;

  const challan = await prisma.challans.create({
    data: {
      challanNumber: `${RUN}-CH`,
      challanType: 'OUTWARD',
      status: 'DRAFT',
      fromType: 'WAREHOUSE',
      fromName: srcWh.warehouseName,
      // What the Stock-Out screen posts; issuing turns it into a job-work challan (toType VENDOR)
      toType: 'SUPPLIER',
      toId: processorId,
      toName: processor.name,
      totalItems: 1,
      totalQuantity: TRANSFER_QTY,
      unit: 'METER',
      issuedById: userId,
      items: {
        create: [
          {
            id: randomUUID(),
            itemType: 'GREIGE',
            greigeStockId: sourceStockId,
            quantity: TRANSFER_QTY,
            unit: 'METER',
            description: `${RUN} greige to processor`,
          },
        ],
      },
    },
  });
  challanId = challan.id;
});

afterAll(async () => {
  const lots = await prisma.greige_stock.findMany({ where: { greigeId: only(greigeId) }, select: { id: true } });
  const lotIds = lots.map((l) => l.id);
  if (lotIds.length) {
    await prisma.greige_stock_transaction.deleteMany({ where: { stockId: { in: lotIds } } });
  }
  const materialIds = (
    await prisma.materials.findMany({ where: { greigeId: only(greigeId) }, select: { id: true } })
  ).map((m) => m.id);
  await prisma.stock_movements.deleteMany({ where: { materialId: { in: materialIds } } });
  await prisma.stock_transactions.deleteMany({ where: { materialId: { in: materialIds } } });
  await prisma.stock_levels.deleteMany({ where: { materialId: { in: materialIds } } });
  await prisma.challan_items.deleteMany({ where: { challanId: only(challanId) } });
  await prisma.challans.deleteMany({ where: { id: only(challanId) } });
  await prisma.greige_stock.deleteMany({ where: { greigeId: only(greigeId) } });
  await prisma.materials.deleteMany({ where: { greigeId: only(greigeId) } });
  await prisma.greige_master.deleteMany({ where: { id: only(greigeId) } });
  await prisma.warehouses.deleteMany({
    where: { id: { in: [only(sourceWarehouseId), only(processorWarehouseId)] } },
  });
  await prisma.suppliers.deleteMany({ where: { id: only(processorId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('greige transferred to a processor by challan', () => {
  it('moves the metres to a processor lot and leaves the source lot correct', async () => {
    await issueChallan(challanId, userId);

    const source = await prisma.greige_stock.findUnique({ where: { id: sourceStockId } });
    expect(Number(source?.quantityAvailable)).toBeCloseTo(START_QTY - TRANSFER_QTY, 2);
    expect(Number(source?.quantityConsumed)).toBeCloseTo(TRANSFER_QTY, 2);

    // The transferred metres live on as a separate lot AT THE PROCESSOR — this is why the lot
    // total legitimately exceeds what the Stock Levels page shows for on-hand.
    const processorLot = await prisma.greige_stock.findFirst({
      where: { greigeId, sourceType: 'TRANSFER' },
    });
    expect(processorLot).not.toBeNull();
    expect(Number(processorLot?.quantityAvailable)).toBeCloseTo(TRANSFER_QTY, 2);
    expect(processorLot?.processorId).toBe(processorId);
    expect(processorLot?.warehouseId).toBe(processorWarehouseId);
    expect(processorLot?.sourceChallanId).toBe(challanId);
  });

  it('puts the metres ON HAND at the processor unit, the view agreeing (Phase 4e)', async () => {
    const material = await prisma.materials.findFirstOrThrow({ where: { greigeId }, select: { id: true } });
    const level = await prisma.stock_levels.findFirst({
      where: { materialId: material.id, warehouseId: processorWarehouseId },
    });
    expect(Number(level?.quantity)).toBeCloseTo(TRANSFER_QTY, 2);
    const view = await prisma.$queryRaw<Array<{ quantity: unknown }>>`
      SELECT quantity FROM derived_stock_view
      WHERE "materialId" = ${material.id} AND "warehouseId" = ${processorWarehouseId}`;
    expect(Number(view[0]?.quantity)).toBeCloseTo(TRANSFER_QTY, 2);
  });

  it('goes out as a job-work challan: VENDOR, Rule 45 wording, one-year return, in ITC-04 Table A', async () => {
    const challan = await prisma.challans.findUniqueOrThrow({ where: { id: challanId } });
    expect(challan.status).toBe('ISSUED');
    expect(challan.toType).toBe('VENDOR');
    expect(challan.toId).toBe(processorId);
    expect(challan.reasonForTransport).toBe(STOCK_OUT_TO_JOB_WORKER_REASON);
    const oneYearOn = new Date(challan.issuedDate ?? challan.challanDate);
    oneYearOn.setFullYear(oneYearOn.getFullYear() + 1);
    expect(toDateInputValue(challan.expectedDate!)).toBe(toDateInputValue(oneYearOn));
    const DAY = 24 * 60 * 60 * 1000;
    const itc = await jobWorkStatutoryService.getITC04Extract(
      new Date(challan.challanDate.getTime() - DAY),
      new Date(Date.now() + DAY)
    );
    expect(itc.tableA.items.some((i) => i.challanId === challanId)).toBe(true);
  });

  it('is not offered to the next Stock-Out — nothing a processor holds is', async () => {
    const offered = await greigeStockService.getGreigeStock({ greigeId, excludeTransferred: true });
    const ids = offered.map((l) => l.id);
    expect(ids).toContain(sourceStockId);
    const processorLot = await prisma.greige_stock.findFirstOrThrow({ where: { greigeId, sourceType: 'TRANSFER' } });
    expect(ids).not.toContain(processorLot.id);
  });

  it('writes exactly ONE debit row for the movement, with a real balance and the challan link', async () => {
    const rows = await prisma.greige_stock_transaction.findMany({
      where: { stockId: sourceStockId },
      orderBy: { createdAt: 'asc' },
    });

    // Previously two rows: CONSUMPTION -500 and a duplicate TRANSFER_OUT -500 (balanceAfter 0).
    expect(rows).toHaveLength(1);

    const [row] = rows;
    expect(row.transactionType).toBe('CONSUMPTION');
    expect(Number(row.quantity)).toBeCloseTo(-TRANSFER_QTY, 2);
    // The hard-coded 0 is gone — the balance is the lot's real remaining quantity.
    expect(Number(row.balanceAfter)).toBeCloseTo(START_QTY - TRANSFER_QTY, 2);
    // The challan reference the duplicate row used to supply is now on the consumption row.
    expect(row.referenceType).toBe('CHALLAN');
    expect(row.referenceId).toBe(challanId);
    expect(row.notes).toContain('challan');

    // Total debits equal the metres that actually moved — not double.
    const totalOut = rows.reduce((sum, r) => sum + Math.abs(Number(r.quantity)), 0);
    expect(totalOut).toBeCloseTo(TRANSFER_QTY, 2);
  });
});
