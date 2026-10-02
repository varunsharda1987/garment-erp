/**
 * A job work order brings back ONE fabric (2026-09-30). MRP bundled SP27CK130's Red, Black and Teal orders
 * onto DJ-EBEW-002-001, and nothing checked that bundled requirements even shared a greige; a manual Process PO
 * linked every open requirement of the greige + processor whatever its style or colour. These pin:
 *  - MRP raises one job per greige (as it already did per rate);
 *  - the Process PO matcher offers for linking only requirements of the job's own style and colour, while the
 *    "MRP already made a job for this" check stays greige-wide.
 */

import { randomUUID } from 'crypto';
import { prisma, createTestUser } from '../helpers/test-utils';
import {
  convertToGreigeProcessing,
  findProcessingRequirementMatches,
  generatePOFromRequirements,
} from '../../services/mrp.service';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';
import { buildJobWorkOrderDocData } from '../../services/document-data/job-work-order.doc-data';

const RUN = `JOG${Date.now().toString(36).toUpperCase()}`;
const only = (id: string | undefined) => id ?? '__unset__';

let userId: string;
let dyerId: string;
let customerId: string;
let styleA: string;
let styleB: string;
let orderId: string;
let itemA: string;
let itemB: string;
const greigeIds: string[] = [];
const greigeMaterial: Record<string, string> = {};

const mkGreige = async (suffix: string) => {
  const g = await prisma.greige_master.create({
    data: {
      greigeCode: `${RUN}-G${suffix}`,
      greigeName: `${RUN} Greige ${suffix}`,
      genericGreigeName: `${RUN} Greige ${suffix}`,
      composition: '100% Viscose',
      greigeWidth: 63,
      createdById: userId,
    },
  });
  greigeIds.push(g.id);
  greigeMaterial[g.id] = await ensureMaterialRecord(g.id, 'GREIGE');
  return g.id;
};

const mkRequirement = (p: {
  greigeId: string;
  orderItemId: string;
  colorName: string | null;
  status?: 'PO_REQUIRED' | 'PO_GENERATED';
  /** What MRP records from the BOM line's card; null = not known (02-Oct-2026) */
  processingType?: 'DYEING' | 'PRINTING' | null;
}) =>
  prisma.material_requirements.create({
    data: {
      requirementNumber: `${RUN}-MR-${randomUUID().slice(0, 8)}`,
      source: 'SALES_ORDER',
      requirementType: 'PROCESSING',
      processingType: p.processingType === undefined ? 'DYEING' : p.processingType,
      orderId,
      orderItemId: p.orderItemId,
      materialId: greigeMaterial[p.greigeId],
      orderQuantity: 100,
      quantityPerUnit: 2.5,
      wastagePercent: 0,
      totalRequired: 250,
      shortfall: 250,
      unit: 'METER',
      status: p.status ?? 'PO_REQUIRED',
      processorId: dyerId,
      unitPrice: 10,
      colorName: p.colorName,
      requiredDate: new Date(Date.now() + 30 * 86400000),
      createdById: userId,
    },
  });

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;

  dyerId = (
    await prisma.suppliers.create({
      data: {
        code: `${RUN}-DYE`,
        name: `${RUN} Dyer`,
        supplierCategories: ['DYEING_PRINTING'],
        isActive: true,
        createdById: userId,
      },
    })
  ).id;
  customerId = (
    await prisma.customers.create({
      data: { code: `${RUN}C`, name: `${RUN} Customer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
    })
  ).id;
  styleA = (
    await prisma.styles.create({
      data: { id: randomUUID(), styleCode: `${RUN}A`, styleName: `${RUN} Style A`, createdById: userId },
    })
  ).id;
  styleB = (
    await prisma.styles.create({
      data: { id: randomUUID(), styleCode: `${RUN}B`, styleName: `${RUN} Style B`, createdById: userId },
    })
  ).id;
  orderId = (
    await prisma.orders.create({
      data: {
        id: randomUUID(),
        orderNumber: `${RUN}ORD`,
        customerId,
        expectedDeliveryDate: new Date(Date.now() + 30 * 86400000),
        totalQuantity: 200,
        totalAmount: 20000,
        createdById: userId,
      },
    })
  ).id;
  const mkItem = async (styleId: string) =>
    (
      await prisma.order_items.create({
        data: { id: randomUUID(), orderId, styleId, totalQuantity: 100, unitPrice: 100, totalPrice: 10000 },
      })
    ).id;
  itemA = await mkItem(styleA);
  itemB = await mkItem(styleB);
});

afterAll(async () => {
  const jwoIds = (
    await prisma.job_work_orders.findMany({ where: { processorId: only(dyerId) }, select: { id: true } })
  ).map((j) => j.id);
  await prisma.requirement_jwo_links.deleteMany({ where: { jobWorkOrderId: { in: jwoIds } } });
  await prisma.job_work_orders.deleteMany({ where: { id: { in: jwoIds } } });
  await prisma.material_requirements.deleteMany({ where: { orderId: only(orderId) } });
  await prisma.order_items.deleteMany({ where: { orderId: only(orderId) } });
  await prisma.orders.deleteMany({ where: { id: only(orderId) } });
  const fabricIds = (
    await prisma.fabric_master.findMany({ where: { greigeId: { in: greigeIds } }, select: { id: true } })
  ).map((f) => f.id);
  await prisma.materials.deleteMany({
    where: { OR: [{ fabricId: { in: fabricIds } }, { greigeId: { in: greigeIds } }] },
  });
  await prisma.fabric_master.deleteMany({ where: { id: { in: fabricIds } } });
  await prisma.greige_master.deleteMany({ where: { id: { in: greigeIds } } });
  await prisma.styles.deleteMany({ where: { id: { in: [only(styleA), only(styleB)] } } });
  await prisma.customers.deleteMany({ where: { id: only(customerId) } });
  await prisma.suppliers.deleteMany({ where: { id: only(dyerId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('MRP raises one job work order per greige', () => {
  it('splits two greiges at one rate into two jobs, each linked to its own requirement', async () => {
    const g1 = await mkGreige('1');
    const g2 = await mkGreige('2');
    const onG1 = await mkRequirement({ greigeId: g1, orderItemId: itemA, colorName: 'Red' });
    const onG2 = await mkRequirement({ greigeId: g2, orderItemId: itemA, colorName: 'Red' });

    const result = await generatePOFromRequirements(
      {
        requirementIds: [onG1.id, onG2.id],
        supplierId: dyerId,
        expectedDeliveryDate: new Date(Date.now() + 20 * 86400000).toISOString(),
        itemPrices: { [onG1.id]: 10, [onG2.id]: 10 },
      } as never,
      userId
    );

    expect(result.jobWorkOrders).toHaveLength(2);
    const links = await prisma.requirement_jwo_links.findMany({
      where: { jobWorkOrderId: { in: result.jobWorkOrders!.map((j) => j.id) } },
    });
    expect(links).toHaveLength(2);
    const jobOf = (reqId: string) => links.find((l) => l.requirementId === reqId)!.jobWorkOrderId;
    expect(jobOf(onG1.id)).not.toBe(jobOf(onG2.id));
  });

  // Owner, 02-Oct-2026: a blank print type does not make a job dyeing
  it('refuses a requirement whose process is not recorded anywhere, rather than send it as dyeing', async () => {
    const g = await mkGreige('U');
    const unknown = await mkRequirement({ greigeId: g, orderItemId: itemA, colorName: 'Red', processingType: null });

    await expect(
      generatePOFromRequirements(
        {
          requirementIds: [unknown.id],
          supplierId: dyerId,
          expectedDeliveryDate: new Date(Date.now() + 20 * 86400000).toISOString(),
          itemPrices: { [unknown.id]: 10 },
        } as never,
        userId
      )
    ).rejects.toThrow(`${unknown.requirementNumber}: not known whether this is dyeing or printing`);
    expect(await prisma.requirement_jwo_links.count({ where: { requirementId: unknown.id } })).toBe(0);
  });
});

describe('Convert to greige + processing records the process the planner chose', () => {
  const mkFabricRequirement = async (greigeId: string) =>
    prisma.material_requirements.create({
      data: {
        requirementNumber: `${RUN}-MR-${randomUUID().slice(0, 8)}`,
        source: 'SALES_ORDER',
        requirementType: 'MATERIAL',
        orderId,
        orderItemId: itemA,
        materialId: greigeMaterial[greigeId],
        orderQuantity: 100,
        quantityPerUnit: 2.5,
        wastagePercent: 0,
        totalRequired: 250,
        shortfall: 250,
        unit: 'METER',
        status: 'PO_REQUIRED',
        requiredDate: new Date(Date.now() + 30 * 86400000),
        createdById: userId,
      },
    });

  it('Printing (Procian) is written on the processing requirement — never left to a blank print type', async () => {
    const g = await mkGreige('C1');
    const fabricReq = await mkFabricRequirement(g);

    const { processingRequirement } = await convertToGreigeProcessing(
      fabricReq.id,
      { processorId: dyerId, greigeId: g, processingType: 'PRINTING', printingType: 'PROCIAN', processingCost: 20 },
      userId
    );

    const saved = await prisma.material_requirements.findUniqueOrThrow({ where: { id: processingRequirement.id } });
    expect(saved.processingType).toBe('PRINTING');
    expect(saved.printingType).toBe('PROCIAN');
  });

  it('Dyeing is written as DYEING; Printing without a print type is refused before anything is written', async () => {
    const g = await mkGreige('C2');
    const dyed = await convertToGreigeProcessing(
      (await mkFabricRequirement(g)).id,
      { processorId: dyerId, greigeId: g, processingType: 'DYEING', processingCost: 10 },
      userId
    );
    const saved = await prisma.material_requirements.findUniqueOrThrow({
      where: { id: dyed.processingRequirement.id },
    });
    expect(saved.processingType).toBe('DYEING');
    expect(saved.printingType).toBeNull();

    const untouched = await mkFabricRequirement(g);
    await expect(
      convertToGreigeProcessing(
        untouched.id,
        { processorId: dyerId, greigeId: g, processingType: 'PRINTING', processingCost: 10 },
        userId
      )
    ).rejects.toThrow('Choose the print type');
    expect((await prisma.material_requirements.findUniqueOrThrow({ where: { id: untouched.id } })).status).toBe(
      'PO_REQUIRED'
    );
  });
});

describe('MRP gives a job one line per fabric it brings back (DJ-EBEW-002-001)', () => {
  it('two Red orders of one style share a line; a Black order of another style gets its own, with its own fabric', async () => {
    const g4 = await mkGreige('4');
    const redA1 = await mkRequirement({ greigeId: g4, orderItemId: itemA, colorName: 'Red' });
    const redA2 = await mkRequirement({ greigeId: g4, orderItemId: itemA, colorName: 'Red' });
    const blackB = await mkRequirement({ greigeId: g4, orderItemId: itemB, colorName: 'Black' });

    const result = await generatePOFromRequirements(
      {
        requirementIds: [redA1.id, redA2.id, blackB.id],
        supplierId: dyerId,
        expectedDeliveryDate: new Date(Date.now() + 20 * 86400000).toISOString(),
        itemPrices: { [redA1.id]: 10, [redA2.id]: 10, [blackB.id]: 10 },
      } as never,
      userId
    );

    expect(result.jobWorkOrders ?? [result.jobWorkOrder]).toHaveLength(1);
    const jobId = result.jobWorkOrder!.id;
    const lines = await prisma.job_work_order_lines.findMany({
      where: { jobWorkOrderId: jobId },
      include: { requirementLinks: true },
      orderBy: { lineNo: 'asc' },
    });
    expect(lines).toHaveLength(2);
    const redLine = lines.find((l) => l.colorName === 'Red')!;
    const blackLine = lines.find((l) => l.colorName === 'Black')!;
    expect(redLine.styleId).toBe(styleA);
    expect(redLine.requirementLinks.map((l) => l.requirementId).sort()).toEqual([redA1.id, redA2.id].sort());
    expect(blackLine.styleId).toBe(styleB);
    expect(blackLine.requirementLinks.map((l) => l.requirementId)).toEqual([blackB.id]);
    expect(redLine.finishedFabricId).toBeTruthy();
    expect(blackLine.finishedFabricId).toBeTruthy();
    expect(redLine.finishedFabricId).not.toBe(blackLine.finishedFabricId);
    expect(Number(redLine.qtyExpected)).toBe(2 * Number(blackLine.qtyExpected));

    // The job mirrors its lines: totals summed, the style / colour / fabric they do not share left blank
    const job = await prisma.job_work_orders.findUniqueOrThrow({ where: { id: jobId } });
    expect(Number(job.qtySentMeters)).toBe(Number(redLine.qtySent) + Number(blackLine.qtySent));
    expect(Number(job.qtyBillable)).toBe(Number(redLine.qtyExpected) + Number(blackLine.qtyExpected));
    expect(job.styleId).toBeNull();
    expect(job.colorName).toBeNull();
    expect(job.finishedFabricId).toBeNull();

    // The printed job work order: one §03 row per fabric, adding up to the job's taxable value
    const doc = await buildJobWorkOrderDocData(jobId);
    expect(doc.colourLine).toBe('Several — see 03');
    expect(doc.chargeRows).toHaveLength(2);
    expect(doc.chargeRows.map((r) => r.spec).sort()).toEqual(['Black', 'Red']);
    expect(doc.chargeRows.every((r) => /for /.test(r.subline ?? ''))).toBe(true);
    const amount = (s: string) => Number(s.replace(/,/g, ''));
    expect(doc.chargeRows.reduce((total, r) => total + amount(r.amount), 0)).toBeCloseTo(amount(doc.taxableValue), 2);
  });
});

describe('the Process PO matcher links only requirements of the job’s own style and colour', () => {
  it('offers the job’s style + colour (and colourless requirements of that style), and warns greige-wide', async () => {
    const g3 = await mkGreige('3');
    const redA = await mkRequirement({ greigeId: g3, orderItemId: itemA, colorName: 'Red' });
    const noColourA = await mkRequirement({ greigeId: g3, orderItemId: itemA, colorName: null });
    const blackA = await mkRequirement({ greigeId: g3, orderItemId: itemA, colorName: 'Black' });
    const redB = await mkRequirement({ greigeId: g3, orderItemId: itemB, colorName: 'Red' });

    const all = await findProcessingRequirementMatches({ greigeId: g3, fabricId: null, processorId: dyerId });
    expect(all.openRequirements.map((r) => r.id).sort()).toEqual([redA.id, noColourA.id, blackA.id, redB.id].sort());

    const forJob = await findProcessingRequirementMatches({
      greigeId: g3,
      fabricId: null,
      processorId: dyerId,
      forJob: { styleId: styleA, colorName: ' red' },
    });
    expect(forJob.openRequirements.map((r) => r.id).sort()).toEqual([redA.id, noColourA.id].sort());

    // MRP already raised a job for style B's order on this greige — the duplicate-work warning still sees it
    const generated = await generatePOFromRequirements(
      {
        requirementIds: [redB.id],
        supplierId: dyerId,
        expectedDeliveryDate: new Date(Date.now() + 20 * 86400000).toISOString(),
        itemPrices: { [redB.id]: 10 },
      } as never,
      userId
    );
    const afterJob = await findProcessingRequirementMatches({
      greigeId: g3,
      fabricId: null,
      processorId: dyerId,
      forJob: { styleId: styleA, colorName: 'Red' },
    });
    expect(afterJob.activeJwos.map((j) => j.jwoId)).toContain(generated.jobWorkOrder!.id);
  });
});
