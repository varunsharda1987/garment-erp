/**
 * The Permissions page controls real endpoints.
 *
 * Until 2026-09-13 nothing read the role_permissions table when deciding a request: an admin
 * could flip a switch and every role could still do everything. This pins the contract end to
 * end: a switch turned off on the page → the module's writes 403 for that role; turned on →
 * they succeed; reads stay open; the admin floor ignores the page; ADMIN ignores the switches;
 * and the keys ride on /auth/me so the menu can follow.
 *
 * Runs against the real app + live dev DB. It toggles ONE switch (SALES × colorMaster) and
 * restores whatever value it found, in afterAll.
 */

import request from 'supertest';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { PermissionService } from '../../services/permission.service';

const RUN = `PRM${Date.now().toString(36).toUpperCase()}`;
const ROLE = 'SALES' as const;
const KEY = 'colorMaster';

let adminHeader: Record<string, string>;
let salesHeader: Record<string, string>;
let adminId: string;
let salesId: string;
let originalAllowed: boolean | null = null;
const createdColorIds: string[] = [];

async function setSwitch(allowed: boolean) {
  await request(app)
    .patch('/api/permissions/toggle')
    .set(adminHeader)
    .send({ role: ROLE, permissionKey: KEY, allowed })
    .expect(200);
}

beforeAll(async () => {
  const admin = await createTestUser({
    email: `test-${RUN.toLowerCase()}-admin@perm.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  adminId = admin.id;
  adminHeader = getAuthHeader(admin.id, 'ADMIN');

  const sales = await createTestUser({
    email: `test-${RUN.toLowerCase()}-sales@perm.test`,
    role: ROLE,
    isActive: true,
    isApproved: true,
  });
  salesId = sales.id;
  salesHeader = getAuthHeader(sales.id, ROLE);

  const row = await prisma.role_permissions.findUnique({
    where: { role_permissionKey: { role: ROLE, permissionKey: KEY } },
  });
  originalAllowed = row?.allowed ?? null;
});

afterAll(async () => {
  try {
    if (originalAllowed !== null) await setSwitch(originalAllowed);
  } catch (err) {
    console.error('permissionsEnforced: could not restore switch', err);
  }
  try {
    if (createdColorIds.length) await prisma.color_master.deleteMany({ where: { id: { in: createdColorIds } } });
  } catch (err) {
    console.error('permissionsEnforced: colour cleanup failed', err);
  }
  await prisma.users.deleteMany({ where: { id: { in: [adminId, salesId].map((id) => only(id)) } } });
  await prisma.$disconnect();
});

describe('Permissions page → API enforcement', () => {
  it("a switch turned OFF blocks that module's writes for the role with PERMISSION_DENIED", async () => {
    await setSwitch(false);
    expect(await PermissionService.hasPermission(ROLE, KEY)).toBe(false);

    const res = await request(app)
      .post('/api/colors')
      .set(salesHeader)
      .send({ colorName: `${RUN} Denied`, colorCode: `${RUN}-D` });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
    expect(res.body.permission).toBe(KEY);
    expect(res.body.message).toContain('Color Master');
  });

  it('reads of that module stay open to the role while the switch is OFF', async () => {
    await request(app).get('/api/colors').set(salesHeader).expect(200);
  });

  it('a switch turned ON lets the same write through', async () => {
    await setSwitch(true);
    expect(await PermissionService.hasPermission(ROLE, KEY)).toBe(true);

    const res = await request(app)
      .post('/api/colors')
      .set(salesHeader)
      .send({ colorName: `${RUN} Allowed`, colorCode: `${RUN}-A` });

    expect(res.status).not.toBe(403);
    if (res.status === 201 && res.body?.data?.id) createdColorIds.push(res.body.data.id);
  });

  it('the admin floor ignores the page: a fully-granted non-admin still cannot manage users', async () => {
    const res = await request(app).delete(`/api/users/${adminId}`).set(salesHeader);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ADMIN_ONLY');
  });

  it('non-admins cannot read or change the permission matrix itself', async () => {
    await request(app).get('/api/permissions/matrix').set(salesHeader).expect(403);
    await request(app)
      .patch('/api/permissions/toggle')
      .set(salesHeader)
      .send({ role: ROLE, permissionKey: KEY, allowed: true })
      .expect(403);
  });

  it('ADMIN passes every switch, and its own column cannot be turned off', async () => {
    const res = await request(app)
      .patch('/api/permissions/toggle')
      .set(adminHeader)
      .send({ role: 'ADMIN', permissionKey: KEY, allowed: false });
    expect(res.status).toBe(400);

    const matrix = await request(app).get('/api/permissions/matrix').set(adminHeader).expect(200);
    const row = matrix.body.data.permissions.find((p: { permissionKey: string }) => p.permissionKey === KEY);
    expect(row.roles.ADMIN).toBe(true);
  });

  it('/auth/me carries the granted keys the menu decides on', async () => {
    await setSwitch(false);
    const off = await request(app).get('/api/auth/me').set(salesHeader).expect(200);
    expect(Array.isArray(off.body.permissions)).toBe(true);
    expect(off.body.permissions).not.toContain(KEY);

    await setSwitch(true);
    const on = await request(app).get('/api/auth/me').set(salesHeader).expect(200);
    expect(on.body.permissions).toContain(KEY);

    const admin = await request(app).get('/api/auth/me').set(adminHeader).expect(200);
    expect(admin.body.permissions).toContain('permissions');
    expect(admin.body.permissions.length).toBeGreaterThan(50);
  });
});
