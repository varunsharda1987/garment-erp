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
import { findProcessingRequirementMatches, generatePOFromRequirements } from '../../services/mrp.service';
import { ensureMaterialRecord } from '../../services/helpers/material-sync.helper';

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
}) =>
  prisma.material_requirements.create({
    data: {
      requirementNumber: `${RUN}-MR-${randomUUID().slice(0, 8)}`,
      source: 'SALES_ORDER',
      requirementType: 'PROCESSING',
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
