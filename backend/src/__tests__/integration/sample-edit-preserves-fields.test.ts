/**
 * Editing a sample must save the type-specific fields it lets you edit
 * (silent-data-loss finding #14).
 *
 * SampleForm renders Production Lot, Linked Dispatch, Sent To and Purpose as fully editable in edit
 * mode (unlike the colorway/size-set tabs, which are correctly locked) and prefills them from the
 * loaded sample. But the edit request sent only `{ requiredDate, remarks }`, `updateSampleSchema`
 * never declared the four fields, and `updateSample` never destructured them. Three layers agreeing
 * to ignore the same input.
 *
 * So changing a photoshoot's "Sent To" from Studio A to Studio B reported "Sample has been updated
 * successfully" and reverted on the next page load — samples chased at the wrong studio, shipment
 * samples tied to the wrong lot, with no error anywhere to explain it.
 *
 * The `!== undefined` gate on each field is what keeps a PHOTO_SAMPLE edit from nulling a
 * SHIPMENT_SAMPLE's fields and vice versa; both directions are pinned below.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `SMPE${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let customerId: string;
let styleId: string;

const sampleIds: string[] = [];

async function makeSample(sampleType: 'PHOTO_SAMPLE' | 'SHIPMENT_SAMPLE', over: Record<string, unknown> = {}) {
  const s = await prisma.samples.create({
    data: {
      id: randomUUID(),
      sampleNumber: `${RUN}-${sampleIds.length + 1}`,
      sampleType,
      customerId,
      styleId,
      requiredDate: new Date(Date.now() + 14 * 86400000),
      createdById: userId,
      ...over,
    },
  });
  sampleIds.push(s.id);
  return s.id;
}

const editSample = (id: string, body: Record<string, unknown>) =>
  request(app).put(`/api/samples/${id}`).set(authHeader).send(body);

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  const customer = await prisma.customers.create({
    data: { code: `${RUN}-CUST`, name: `${RUN} Customer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
  });
  customerId = customer.id;

  const style = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}-STY`, styleName: `${RUN} Style`, createdById: userId },
  });
  styleId = style.id;
});

afterAll(async () => {
  // Sweep by customer as well as by tracked ids, so an interrupted run cannot leave a sample behind
  // holding an FK on the fixtures below.
  const stranded = await prisma.samples.findMany({ where: { customerId: only(customerId) }, select: { id: true } });
  const allIds = [...new Set([...sampleIds, ...stranded.map((s) => s.id)])];
  if (allIds.length > 0) {
    await prisma.sample_measurements.deleteMany({ where: { sampleId: { in: allIds } } });
    await prisma.samples.deleteMany({ where: { id: { in: allIds } } });
  }
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.customers.deleteMany({ where: { id: only(customerId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('Editing a sample', () => {
  it('saves a changed Sent To and Purpose on a photo sample', async () => {
    // The reported case: the photoshoot destination corrected from Studio A to Studio B.
    const id = await makeSample('PHOTO_SAMPLE', { sentTo: 'Studio A', purpose: 'Lookbook' });

    const res = await editSample(id, { sentTo: 'Studio B', purpose: 'E-commerce' });
    expect(res.status).toBe(200);

    const after = await prisma.samples.findUniqueOrThrow({ where: { id } });
    expect(after.sentTo).toBe('Studio B');
    expect(after.purpose).toBe('E-commerce');
  });

  it('saves Production Lot and a free-text Linked Dispatch on a shipment sample', async () => {
    const id = await makeSample('SHIPMENT_SAMPLE', { productionLot: 'LOT-1' });

    // A human-typed reference, not a uuid. The create schema demanded a uuid while the input is
    // placeholdered "Optional dispatch reference", so anything real was a 400.
    const res = await editSample(id, { productionLot: 'LOT-2', linkedDispatchId: 'DN-2026-0042' });
    expect(res.status).toBe(200);

    const after = await prisma.samples.findUniqueOrThrow({ where: { id } });
    expect(after.productionLot).toBe('LOT-2');
    expect(after.linkedDispatchId).toBe('DN-2026-0042');
  });

  it('clears a field when it is sent empty', async () => {
    const id = await makeSample('PHOTO_SAMPLE', { sentTo: 'Studio A' });
    expect((await editSample(id, { sentTo: '' })).status).toBe(200);
    expect((await prisma.samples.findUniqueOrThrow({ where: { id } })).sentTo).toBeNull();
  });

  it('leaves the other sample type’s fields untouched when they are not sent', async () => {
    // This is what the `!== undefined` gate protects: a PHOTO edit must not null a SHIPMENT field.
    const id = await makeSample('SHIPMENT_SAMPLE', { productionLot: 'LOT-KEEP', sentTo: 'Studio KEEP' });

    expect((await editSample(id, { remarks: 'just a note' })).status).toBe(200);

    const after = await prisma.samples.findUniqueOrThrow({ where: { id } });
    expect(after.productionLot).toBe('LOT-KEEP');
    expect(after.sentTo).toBe('Studio KEEP');
    expect(after.remarks).toBe('just a note');
  });
});
