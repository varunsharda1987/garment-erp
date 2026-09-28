/**
 * A CAD row's marker image (services/helpers/cad-marker.helper.ts, services/cad-file.service.ts).
 *
 * Walks the endpoints through the real API: attach an image to a row (read by backend/ocr when the reader
 * is installed), link one already uploaded for the style, read again, the table's row states, and the
 * delete guard. Tagged fixtures; everything — rows, images and their files on disk — is removed after.
 */
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';
import { markerFilePath } from '../../services/marker-reader.service';

const RUN = `CMI${Date.now().toString(36).toUpperCase()}`;
const FIXTURES = path.join(__dirname, '../fixtures/markers');
const IP00138 = path.join(FIXTURES, 'ip00138-pant-s-to-xxl.png');
const READER_INSTALLED = fs.existsSync(path.join(__dirname, '../../../ocr/.venv/Scripts/python.exe'));
const itRead = READER_INSTALLED ? it : it.skip;

let authHeader: Record<string, string>;
let userId: string;
let styleId: string;
let componentId: string;
let styleFabricId: string;
let rowCount = 0;

async function createRow(overrides: Record<string, unknown> = {}, sizes: string[] = []) {
  const row = await prisma.fabric_width_cad.create({
    data: {
      id: randomUUID(),
      cutableWidth: 52,
      // unique per row: (costingStyleId, componentName, styleFabricId, width, purpose, approval) is a unique key
      componentName: `${RUN}-ROW-${++rowCount}`,
      costingStyleId: styleId,
      // Approve checks a row belongs to the style through its fabric slot
      styleFabricId,
      purpose: 'RAW_MATERIAL_CALCULATION',
      purposeEnum: 'RAW_MATERIAL_CALCULATION',
      approvalStatus: 'PENDING',
      createdById: userId,
      ...overrides,
    },
  });
  if (sizes.length) {
    await prisma.cad_size_breakdown.createMany({
      data: sizes.map((sizeName) => ({ cadId: row.id, sizeName, quantity: 1 })),
    });
  }
  return row;
}

const attach = (rowId: string, file = IP00138) =>
  request(app).post(`/api/cad-planning/${styleId}/row/${rowId}/marker`).set(authHeader).attach('file', file);

async function rowMarkers() {
  const res = await request(app).get(`/api/cad-planning/${styleId}/row-markers`).set(authHeader).expect(200);
  return new Map<string, any>(res.body.data.map((m: any) => [m.cadId, m]));
}

beforeAll(async () => {
  const user = await createTestUser({
    email: `test-${RUN.toLowerCase()}@smoke.test`,
    role: 'ADMIN',
    isActive: true,
    isApproved: true,
  });
  userId = user.id;
  authHeader = getAuthHeader(user.id, 'ADMIN');
  const style = await prisma.styles.create({
    data: { id: randomUUID(), styleCode: `${RUN}S`, styleName: `${RUN} Style`, createdById: userId },
  });
  styleId = style.id;
  const component = await prisma.style_components.create({
    data: { id: randomUUID(), styleId, componentName: `${RUN}-COMP`, componentType: 'MAIN' },
  });
  componentId = component.id;
  styleFabricId = (await prisma.style_fabrics.create({ data: { id: randomUUID(), componentId } })).id;
});

afterAll(async () => {
  const files = await prisma.cad_purpose_files.findMany({ where: { styleId }, select: { fileUrl: true } });
  await prisma.cad_purpose_files.deleteMany({ where: { styleId: only(styleId) } });
  for (const f of new Set(files.map((x) => x.fileUrl))) {
    const full = markerFilePath(f);
    if (full && fs.existsSync(full)) fs.unlinkSync(full);
  }
  const rows = await prisma.fabric_width_cad.findMany({
    where: { componentName: { startsWith: RUN } },
    select: { id: true },
  });
  const ids = rows.map((r) => r.id);
  if (ids.length) {
    await prisma.cad_size_breakdown.deleteMany({ where: { cadId: { in: ids } } });
    await prisma.fabric_width_cad.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.audit_logs.deleteMany({ where: { entityType: 'fabric_width_cad', entityId: { in: ids } } });
  // the rows are gone, so nothing cascades from the slot
  await prisma.style_fabrics.deleteMany({ where: { id: only(styleFabricId) } });
  await prisma.style_components.deleteMany({ where: { id: only(componentId) } });
  await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

describe('CAD row marker image — endpoints', () => {
  it('row-markers: a Raw Mat row with values and no image NEEDS_IMAGE; an empty one is NONE', async () => {
    const withValues = await createRow({ cadMeters: 8.3 }, ['S', 'M']);
    const empty = await createRow({ cutableWidth: 0 });
    const costing = await createRow({ cadMeters: 2, purpose: 'COSTING', purposeEnum: 'COSTING' });
    const markers = await rowMarkers();
    expect(markers.get(withValues.id)).toMatchObject({ state: 'NEEDS_IMAGE', required: true, file: null });
    expect(markers.get(empty.id).state).toBe('NONE');
    expect(markers.get(costing.id)).toMatchObject({ state: 'NONE', required: false });
  });

  itRead(
    'attach reads the image: IP00138 saved at 8.3 m, XS–XL differs from its marker (8.29 m, S–XXL)',
    async () => {
      const row = await createRow({ cadMeters: 8.3 }, ['XS', 'S', 'M', 'L', 'XL']);
      const res = await attach(row.id).expect(201);
      const { file, summary } = res.body.data;
      expect(file).toMatchObject({ cadId: row.id, readStatus: 'READ', replacedAt: null });
      expect(summary.reading).toMatchObject({
        lengthM: 8.29,
        widthIn: 52,
        efficiencyPct: 89.05,
        placed: 135,
        total: 135,
      });
      expect(summary.reading.sizes.map((s: any) => s.sizeName)).toEqual(['S', 'M', 'L', 'XL', 'XXL']);
      expect(summary.state).toBe('DIFFERS');
      expect(summary.differences.map((d: any) => d.field)).toEqual(['length', 'sizes']);

      const history = await prisma.audit_logs.findFirst({
        where: { entityType: 'fabric_width_cad', entityId: row.id, action: 'MARKER_IMAGE' },
      });
      expect((history?.newValues as any)?.markerRead).toContain('Length 8.29 m');
    },
    120_000
  );

  it('a second image replaces the first; the row keeps exactly one current image', async () => {
    process.env.MARKER_READER_DISABLED = '1';
    try {
      const row = await createRow();
      const first = (await attach(row.id).expect(201)).body.data.file;
      const second = (await attach(row.id).expect(201)).body.data.file;
      const images = await prisma.cad_purpose_files.findMany({
        where: { cadId: row.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(images.map((i) => i.id)).toEqual([first.id, second.id]);
      expect(images[0].replacedAt).not.toBeNull();
      expect(images[1].replacedAt).toBeNull();
      // the reader was off: kept, not read, and the row reads "not checked"
      expect(images[1].readStatus).toBe('READER_UNAVAILABLE');
      expect((await rowMarkers()).get(row.id).differences[0].field).toBe('image');
    } finally {
      delete process.env.MARKER_READER_DISABLED;
    }
  });

  it("link: a gallery image becomes the row's; another row's image is shared, not taken", async () => {
    process.env.MARKER_READER_DISABLED = '1';
    try {
      const gallery = await request(app)
        .post(`/api/cad-planning/${styleId}/mini-markers`)
        .set(authHeader)
        .field('purpose', 'COSTING')
        .attach('file', IP00138)
        .expect(201);
      const galleryId = gallery.body.data.id;
      const a = await createRow();
      const b = await createRow();

      await request(app)
        .post(`/api/cad-planning/${styleId}/row/${a.id}/marker/link`)
        .set(authHeader)
        .send({ fileId: galleryId })
        .expect(200);
      const linked = await prisma.cad_purpose_files.findUnique({ where: { id: galleryId } });
      expect(linked).toMatchObject({ cadId: a.id, purpose: 'RAW_MATERIAL_CALCULATION', replacedAt: null });

      await request(app)
        .post(`/api/cad-planning/${styleId}/row/${b.id}/marker/link`)
        .set(authHeader)
        .send({ fileId: galleryId })
        .expect(200);
      const bImage = await prisma.cad_purpose_files.findFirst({ where: { cadId: b.id, replacedAt: null } });
      expect(bImage?.id).not.toBe(galleryId);
      expect(bImage?.fileUrl).toBe(linked?.fileUrl);
      expect((await prisma.cad_purpose_files.findUnique({ where: { id: galleryId } }))?.cadId).toBe(a.id);

      // the gallery shows which row each image is on
      const list = await request(app).get(`/api/cad-planning/${styleId}/mini-markers`).set(authHeader).expect(200);
      const shown = list.body.data.files.find((f: any) => f.id === galleryId);
      expect(shown.cadRow).toMatchObject({ id: a.id, current: true });
      expect(shown.cadRow.label).toContain('Raw Mat');
    } finally {
      delete process.env.MARKER_READER_DISABLED;
    }
  });

  itRead(
    'reread reads the current image again',
    async () => {
      process.env.MARKER_READER_DISABLED = '1';
      const row = await createRow();
      await attach(row.id).expect(201);
      delete process.env.MARKER_READER_DISABLED;
      const res = await request(app)
        .post(`/api/cad-planning/${styleId}/row/${row.id}/marker/reread`)
        .set(authHeader)
        .expect(200);
      expect(res.body.data.file.readStatus).toBe('READ');
      expect(res.body.data.summary.reading.lengthM).toBe(8.29);
    },
    120_000
  );

  it('an approved row is not given a new image (Correct CAD does that), and the upload is not left behind', async () => {
    const row = await createRow({ cadMeters: 8.29, approvalStatus: 'APPROVED' }, ['S']);
    const before = fs.readdirSync(path.join(__dirname, '../../../uploads/cad-files')).length;
    const res = await attach(row.id);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(fs.readdirSync(path.join(__dirname, '../../../uploads/cad-files')).length).toBe(before);
    expect(await prisma.cad_purpose_files.count({ where: { cadId: row.id } })).toBe(0);
  });

  it("delete: a Raw Mat row's marker is replaced, not deleted; a shared file stays on disk", async () => {
    process.env.MARKER_READER_DISABLED = '1';
    try {
      const withValues = await createRow({ cadMeters: 3 }, ['M']);
      const image = (await attach(withValues.id).expect(201)).body.data.file;
      const refused = await request(app)
        .delete(`/api/cad-planning/${styleId}/mini-markers/${image.id}`)
        .set(authHeader);
      expect(refused.status).toBe(422);
      expect(refused.body.message).toMatch(/Replace it from the row/);

      // an empty row's image can go; a second record on the same file keeps the file on disk
      const empty = await createRow();
      await request(app)
        .post(`/api/cad-planning/${styleId}/row/${empty.id}/marker/link`)
        .set(authHeader)
        .send({ fileId: image.id })
        .expect(200);
      const shared = await prisma.cad_purpose_files.findFirst({ where: { cadId: empty.id, replacedAt: null } });
      await request(app).delete(`/api/cad-planning/${styleId}/mini-markers/${shared!.id}`).set(authHeader).expect(200);
      expect(fs.existsSync(markerFilePath(image.fileUrl)!)).toBe(true);
    } finally {
      delete process.env.MARKER_READER_DISABLED;
    }
  });
});

// ---------------------------------------------------------------------------
// The rule on save, approve and copies (owner decisions 28-Sep-2026)
// ---------------------------------------------------------------------------

const put = (rowId: string, body: Record<string, unknown>) =>
  request(app).put(`/api/cad-planning/${styleId}/row/${rowId}`).set(authHeader).send(body);
const approve = (rowId: string) =>
  request(app).post(`/api/cad-planning/${styleId}/row/${rowId}/approve`).set(authHeader).send({});
const codeOf = (res: request.Response) => res.body?.details?.code;
const S_TO_XXL = ['S', 'M', 'L', 'XL', 'XXL'].map((sizeName) => ({ sizeName, quantity: 1 }));

describe('CAD values are saved from the marker image', () => {
  it('a Raw Mat row with no image cannot take a layer length; a Costing row can', async () => {
    const rawMat = await createRow();
    const refused = await put(rawMat.id, { layerLengthMeters: 3.82 });
    expect(refused.status).toBe(422);
    expect(codeOf(refused)).toBe('CAD_MARKER_IMAGE_REQUIRED');
    expect((await prisma.fabric_width_cad.findUnique({ where: { id: rawMat.id } }))?.cadMeters).toBeNull();

    const costing = await createRow({ purpose: 'COSTING', purposeEnum: 'COSTING' });
    await put(costing.id, { layerLengthMeters: 3.82 }).expect(200);
  });

  it('an edit that touches no CAD value needs no image (a Raw Mat row saved before the rule)', async () => {
    const legacy = await createRow({ cadMeters: 3.85 }, ['S', 'M']);
    await put(legacy.id, { printDirection: 'ONE_WAY' }).expect(200);
    const refused = await put(legacy.id, { layerLengthMeters: 3.82 });
    expect(codeOf(refused)).toBe('CAD_MARKER_IMAGE_REQUIRED');
  });

  it('an image that could not be read is "not checked": the save needs a reason, then it is EXPLAINED', async () => {
    process.env.MARKER_READER_DISABLED = '1';
    try {
      const row = await createRow();
      await attach(row.id).expect(201);
      const refused = await put(row.id, { layerLengthMeters: 3.82 });
      expect(refused.status).toBe(409);
      expect(codeOf(refused)).toBe('CAD_MARKER_MISMATCH');
      expect(refused.body.details.differences[0].field).toBe('image');

      await put(row.id, {
        layerLengthMeters: 3.82,
        markerOverrideReason: 'CAD PC offline — screenshot from a phone',
      }).expect(200);
      const saved = await prisma.fabric_width_cad.findUnique({ where: { id: row.id } });
      expect(saved).toMatchObject({ markerOverrideReason: 'CAD PC offline — screenshot from a phone' });
      expect(Number(saved?.cadMeters)).toBe(3.82);
      expect((await rowMarkers()).get(row.id).state).toBe('EXPLAINED');
      const history = await prisma.audit_logs.findFirst({
        where: { entityType: 'fabric_width_cad', entityId: row.id, action: 'MARKER_OVERRIDE' },
      });
      expect((history?.newValues as any)?.reason).toBe('CAD PC offline — screenshot from a phone');
    } finally {
      delete process.env.MARKER_READER_DISABLED;
    }
  });

  itRead(
    "IP00138: its marker's values save clean; 8.30 m needs a reason; an unexplained difference cannot be approved",
    async () => {
      const row = await createRow();
      await attach(row.id).expect(201);

      await put(row.id, {
        layerLengthMeters: 8.29,
        cutableWidth: 52,
        sizeBreakdowns: S_TO_XXL,
        piecesPerMarker: 5,
      }).expect(200);
      let saved = await prisma.fabric_width_cad.findUnique({ where: { id: row.id } });
      expect(Number(saved?.markerEfficiency)).toBe(89.05);
      expect(saved?.markerOverrideReason).toBeNull();
      expect(Number(saved?.cadAverage)).toBeCloseTo((8.29 + 0.1) / 5, 4);
      expect((await rowMarkers()).get(row.id).state).toBe('MATCHES');

      const refused = await put(row.id, { layerLengthMeters: 8.3 });
      expect(refused.status).toBe(409);
      expect(refused.body.details.differences).toEqual([
        expect.objectContaining({ field: 'length', image: '8.29 m', row: '8.3 m' }),
      ]);

      // The unexplained state cannot be approved: give the reason on a save first
      await prisma.fabric_width_cad.update({ where: { id: row.id }, data: { cadMeters: 8.3 } });
      const notApproved = await approve(row.id);
      expect(notApproved.status).toBe(409);
      expect(codeOf(notApproved)).toBe('CAD_MARKER_MISMATCH');

      await put(row.id, { layerLengthMeters: 8.3, markerOverrideReason: 'rounded by the CAD room' }).expect(200);
      await approve(row.id).expect(200);
      saved = await prisma.fabric_width_cad.findUnique({ where: { id: row.id } });
      expect(saved?.approvalStatus).toBe('APPROVED');
    },
    180_000
  );

  it('a Raw Mat row with values and no image cannot be approved', async () => {
    const row = await createRow({ cadMeters: 3.85, cadAverage: 0.78 }, ['S', 'M', 'L', 'XL', 'XS']);
    const res = await approve(row.id);
    expect(res.status).toBe(422);
    expect(codeOf(res)).toBe('CAD_MARKER_IMAGE_REQUIRED');
  });

  it("Copy to Raw Mat carries the Costing row's image (same file, its own record)", async () => {
    process.env.MARKER_READER_DISABLED = '1';
    try {
      const costing = await createRow({ purpose: 'COSTING', purposeEnum: 'COSTING', cadMeters: 3.82 }, ['S']);
      const image = (await attach(costing.id).expect(201)).body.data.file;
      const res = await request(app)
        .post(`/api/cad-planning/${styleId}/copy`)
        .set(authHeader)
        .send({ sourceCadId: costing.id, targetPurpose: 'RAW_MATERIAL_CALCULATION' });
      expect(res.status).toBeLessThan(300);
      const copy = await prisma.fabric_width_cad.findFirst({
        where: { copiedFromId: costing.id, purposeEnum: 'RAW_MATERIAL_CALCULATION' },
      });
      expect(copy).not.toBeNull();
      const copied = await prisma.cad_purpose_files.findFirst({ where: { cadId: copy!.id, replacedAt: null } });
      expect(copied).toMatchObject({ fileUrl: image.fileUrl, purpose: 'RAW_MATERIAL_CALCULATION' });
      expect(copied?.id).not.toBe(image.id);
    } finally {
      delete process.env.MARKER_READER_DISABLED;
    }
  });

  it('the writers that went around the rule are gone (410)', async () => {
    const row = await createRow();
    await request(app).put(`/api/cad-planning/cad/${row.id}`).set(authHeader).send({ cadMeters: 3 }).expect(410);
    await request(app).put(`/api/cad-planning/update-cad/${row.id}`).set(authHeader).send({ cadMeters: 3 }).expect(410);
    await request(app).post(`/api/cad-planning/${styleId}/add-width`).set(authHeader).send({}).expect(410);
  });
});
