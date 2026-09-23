/**
 * PUT /api/cad-planning/:styleId/row/:rowId must keep a typed cutable width.
 *
 * The CAD table posts only the fields that changed (and its size-breakdown auto-sync posts only
 * sizeBreakdowns + piecesPerMarker). Until 2026-09-23 the endpoint read a missing width as "empty"
 * and wrote the greige default over the stored one: KMC was entered at 41.5", saved again for its
 * layer length, and every record built after that — cost sheet, Order BOM, MRP — said 40".
 *
 * The default must still apply when the greige changes, when the width is cleared, and when the row
 * has no width yet.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only, onlyAll } from '../../utils/prisma-test-guard';

const RUN = `CRW${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let testUserId: string;
let styleId: string;
let wideGreigeId: string; // 63" → default 52", finished range 48–58
let narrowGreigeId: string; // 48" → default 40", finished range 40–42

async function createRow(overrides: Record<string, unknown> = {}) {
  return prisma.fabric_width_cad.create({
    data: {
      id: randomUUID(),
      cutableWidth: 50,
      componentName: `${RUN}-ROW`,
      costingStyleId: styleId,
      greigeId: wideGreigeId,
      purpose: 'COSTING',
      purposeEnum: 'COSTING',
      approvalStatus: 'PENDING',
      createdById: testUserId,
      ...overrides,
    },
  });
}

async function put(rowId: string, body: Record<string, unknown>) {
  return request(app).put(`/api/cad-planning/${styleId}/row/${rowId}`).set(authHeader).send(body).expect(200);
}

async function widthOf(rowId: string) {
  const row = await prisma.fabric_width_cad.findUnique({ where: { id: rowId }, select: { cutableWidth: true } });
  return Number(row!.cutableWidth);
}

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  testUserId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');

  const style = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Style`, createdById: testUserId },
  });
  styleId = style.id;

  const wide = await prisma.greige_master.create({
    data: {
      greigeCode: `${RUN}-G63`,
      greigeName: `${RUN} Wide`,
      composition: '100% Cotton',
      greigeWidth: 63,
      expectedFinishedWidthMin: 48,
      expectedFinishedWidthMax: 58,
      createdById: testUserId,
    },
  });
  wideGreigeId = wide.id;

  const narrow = await prisma.greige_master.create({
    data: {
      greigeCode: `${RUN}-G48`,
      greigeName: `${RUN} Narrow`,
      composition: '100% Cotton',
      greigeWidth: 48,
      expectedFinishedWidthMin: 40,
      expectedFinishedWidthMax: 42,
      createdById: testUserId,
    },
  });
  narrowGreigeId = narrow.id;
});

afterAll(async () => {
  const rows = await prisma.fabric_width_cad.findMany({
    where: { componentName: { startsWith: RUN } },
    select: { id: true },
  });
  const rowIds = rows.map((r) => r.id);
  if (rowIds.length > 0) {
    await prisma.cad_size_breakdown.deleteMany({ where: { cadId: { in: rowIds } } });
    await prisma.fabric_width_cad.deleteMany({ where: { id: { in: rowIds } } });
  }
  await prisma.greige_master.deleteMany({ where: { id: { in: onlyAll([wideGreigeId, narrowGreigeId]) } } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.users.deleteMany({ where: { id: only(testUserId) } });
  await prisma.$disconnect();
});

describe('PUT /api/cad-planning/:styleId/row/:rowId — cutable width', () => {
  it('keeps the typed width on a size-breakdown save (the auto-sync payload)', async () => {
    const row = await createRow();
    await put(row.id, { sizeBreakdowns: [{ sizeName: 'M', quantity: 2 }], piecesPerMarker: 2 });
    expect(await widthOf(row.id)).toBe(50);
  });

  it('keeps the typed width on any other partial save', async () => {
    const row = await createRow();
    await put(row.id, { printDirection: 'ONE_WAY' });
    expect(await widthOf(row.id)).toBe(50);
  });

  it('keeps the typed width when the same greige is re-sent', async () => {
    const row = await createRow();
    await put(row.id, { greigeId: wideGreigeId });
    expect(await widthOf(row.id)).toBe(50);
  });

  it('resets to the new greige default when the greige changes and no width is sent', async () => {
    const row = await createRow();
    await put(row.id, { greigeId: narrowGreigeId });
    expect(await widthOf(row.id)).toBe(40);
  });

  it('applies the default to a row that has no width yet', async () => {
    const row = await createRow({ cutableWidth: 0 });
    await put(row.id, { printDirection: 'ONE_WAY' });
    expect(await widthOf(row.id)).toBe(52);
  });

  it('applies the default when the width is cleared', async () => {
    const row = await createRow();
    await put(row.id, { cutableWidth: null });
    expect(await widthOf(row.id)).toBe(52);
  });

  it('saves a width the request sends', async () => {
    const row = await createRow();
    await put(row.id, { cutableWidth: 51.5 });
    expect(await widthOf(row.id)).toBe(51.5);
  });
});
