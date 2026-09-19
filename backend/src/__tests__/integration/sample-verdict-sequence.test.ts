/**
 * A sample's verdict follows its journey: it must be SENT to the buyer (and optionally back as
 * FEEDBACK_PENDING) before it can be APPROVED / REJECTED / REVISION_NEEDED / APPROVED_WITH_COMMENTS.
 *
 * The screen has always worked this way (Record Feedback shows only in those two states). The API
 * did not: PATCH /:id/status, PUT /:id and POST /:id/feedback all took a verdict from REQUESTED —
 * and an approved Size Set Sample is what unlocks cutting. Owner decision 2026-09-17 (order-system
 * plan T4-C): enforce it, with an ADMIN override that needs a reason and is logged.
 *
 * Runs against the LIVE database; tagged fixtures, per-step teardown. The PRODUCTION_MANAGER ×
 * samples switch is set ON for the run and restored afterwards.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `SVS${Date.now().toString(36).toUpperCase()}`;
const ROLE = 'PRODUCTION_MANAGER' as const;
const KEY = 'samples';
const REASON = 'House-brand stock style — no buyer to send it to (test run)';

let adminId: string;
let adminHeader: Record<string, string>;
let pmId: string;
let pmHeader: Record<string, string>;
let originalAllowed: boolean | null = null;
let customerId: string;
let styleId: string;

async function setSwitch(allowed: boolean) {
  await request(app)
    .patch('/api/permissions/toggle')
    .set(adminHeader)
    .send({ role: ROLE, permissionKey: KEY, allowed })
    .expect(200);
}

async function newSample(header: Record<string, string> = adminHeader) {
  const res = await request(app)
    .post('/api/samples')
    .set(header)
    .send({
      customerId,
      styleId,
      sampleType: 'FIT_SAMPLE',
      requiredDate: new Date(Date.now() + 3 * 86400000).toISOString(),
    });
  if (res.status !== 201) throw new Error(`create sample: HTTP ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.id as string;
}
const statusOf = async (id: string) => (await prisma.samples.findUniqueOrThrow({ where: { id } })).status;
const overrideRows = (sampleId: string) => prisma.stage_transition_overrides.findMany({ where: { sampleId } });

beforeAll(async () => {
  const admin = await createTestUser({
    email: `test-${RUN.toLowerCase()}-admin@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  adminId = admin.id;
  adminHeader = getAuthHeader(admin.id, 'ADMIN');
  const pm = await createTestUser({
    email: `test-${RUN.toLowerCase()}-pm@smoke.test`,
    role: ROLE,
    isActive: true,
    isApproved: true,
  });
  pmId = pm.id;
  pmHeader = getAuthHeader(pm.id, ROLE);

  const row = await prisma.role_permissions.findUnique({
    where: { role_permissionKey: { role: ROLE, permissionKey: KEY } },
  });
  originalAllowed = row?.allowed ?? null;
  await setSwitch(true);

  const customer = await prisma.customers.create({
    data: { code: `${RUN}-CUS`, name: `${RUN} House Brand`, type: 'BUYER', category: 'DOMESTIC', createdById: adminId },
  });
  customerId = customer.id;
  styleId = randomUUID();
  await prisma.styles.create({
    data: { id: styleId, styleCode: `${RUN}-STY`, styleName: `${RUN} Kurta`, createdById: adminId },
  });
});

afterAll(async () => {
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['restore permission switch', () => (originalAllowed !== null ? setSwitch(originalAllowed) : Promise.resolve())],
    [
      'stage_transition_overrides',
      () => prisma.stage_transition_overrides.deleteMany({ where: { sample: { customerId: only(customerId) } } }),
    ],
    ['samples', () => prisma.samples.deleteMany({ where: { customerId: only(customerId) } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: only(styleId) } })],
    ['customers', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: { in: [adminId, pmId].map((id) => only(id)) } } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[sample-verdict-sequence teardown] could not clean ${label} — fixtures left behind:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('a verdict needs the sample to have gone to the buyer', () => {
  it('refuses APPROVED straight from REQUESTED on all three write paths', async () => {
    const id = await newSample();

    const viaStatus = await request(app).patch(`/api/samples/${id}/status`).set(pmHeader).send({ status: 'APPROVED' });
    expect(viaStatus.status).toBe(422);
    expect(viaStatus.body.message).toMatch(/mark it Sent/i);

    const viaUpdate = await request(app)
      .put(`/api/samples/${id}`)
      .set(pmHeader)
      .send({ status: 'APPROVED_WITH_COMMENTS' });
    expect(viaUpdate.status).toBe(422);

    const viaFeedback = await request(app)
      .post(`/api/samples/${id}/feedback`)
      .set(pmHeader)
      .send({ status: 'REJECTED', feedback: 'no' });
    expect(viaFeedback.status).toBe(422);

    expect(await statusOf(id)).toBe('REQUESTED');
    expect(await overrideRows(id)).toHaveLength(0);
  });

  it('the intermediate steps still pass, and the verdict lands once the sample is Sent', async () => {
    const id = await newSample();
    // The Quick Action bar's own path: Start Progress → Mark Complete (PUT with a status)
    await request(app).put(`/api/samples/${id}`).set(pmHeader).send({ status: 'IN_PROGRESS' }).expect(200);
    await request(app).put(`/api/samples/${id}`).set(pmHeader).send({ status: 'SUBMITTED' }).expect(200);
    await request(app).post(`/api/samples/${id}/send`).set(pmHeader).send({ courierMode: 'Courier' }).expect(200);
    expect(await statusOf(id)).toBe('SENT');

    const res = await request(app)
      .post(`/api/samples/${id}/feedback`)
      .set(pmHeader)
      .send({ status: 'APPROVED', feedback: 'fits well' });
    expect(res.status).toBe(200);
    expect(await statusOf(id)).toBe('APPROVED');
    expect(await overrideRows(id)).toHaveLength(0);
  });

  it('a verdict from FEEDBACK_PENDING (sample came back) is fine too', async () => {
    const id = await newSample();
    await request(app).post(`/api/samples/${id}/send`).set(pmHeader).send({}).expect(200);
    await request(app).post(`/api/samples/${id}/receive`).set(pmHeader).send({}).expect(200);
    expect(await statusOf(id)).toBe('FEEDBACK_PENDING');
    await request(app)
      .patch(`/api/samples/${id}/status`)
      .set(pmHeader)
      .send({ status: 'REVISION_NEEDED', feedback: 'sleeve short' })
      .expect(200);
    expect(await statusOf(id)).toBe('REVISION_NEEDED');
  });

  it('a production manager cannot override, even with a reason', async () => {
    const id = await newSample();
    const res = await request(app)
      .patch(`/api/samples/${id}/status`)
      .set(pmHeader)
      .send({ status: 'APPROVED', adminOverride: true, overrideReason: REASON });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ADMIN_ONLY');
    expect(await statusOf(id)).toBe('REQUESTED');
  });

  it('an admin override needs a reason, then goes through and is logged once', async () => {
    const id = await newSample();
    const noReason = await request(app)
      .patch(`/api/samples/${id}/status`)
      .set(adminHeader)
      .send({ status: 'APPROVED', adminOverride: true });
    expect(noReason.status).toBe(400);
    expect(await statusOf(id)).toBe('REQUESTED');

    const res = await request(app)
      .patch(`/api/samples/${id}/status`)
      .set(adminHeader)
      .send({ status: 'APPROVED', adminOverride: true, overrideReason: REASON });
    expect(res.status).toBe(200);
    expect(await statusOf(id)).toBe('APPROVED');

    const rows = await overrideRows(id);
    expect(rows).toHaveLength(1);
    expect(rows[0].blockType).toBe('SAMPLE_STATUS');
    expect(rows[0].blockedSampleType).toBe('FIT_SAMPLE');
    expect(rows[0].overrideReason).toContain(REASON);
    expect(rows[0].overriddenById).toBe(adminId);
  });
});
