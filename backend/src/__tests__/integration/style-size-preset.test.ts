/**
 * The Style form's "Size Category Preset" must survive a save.
 *
 * Until 2026-09-25 the choice lived only in React state: the payload never sent it and `styles` had
 * no column for it, so reopening a style always read "None (Manual Sizes)" even though its sizes had
 * come from the preset. Creating a style also dropped the ACCESSORIES preset id — only the update
 * path wrote `customerAccessoriesPresetId`.
 *
 * Pins: a save records the preset; absent key = keep, null = clear (the form sends null on
 * "None"); create writes both preset ids; deleting a preset clears the style's pointer (FK SET NULL).
 *
 * Runs against the real app + live DB; tagged fixtures, per-step teardown.
 */

import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../../app';
import { prisma, createTestUser, getAuthHeader } from '../helpers/test-utils';
import { only } from '../../utils/prisma-test-guard';

const RUN = `SSP${Date.now().toString(36).toUpperCase()}`;

let authHeader: Record<string, string>;
let userId: string;
let customerId: string;
let sizeCategoryId: string;
let presetId: string;
let otherPresetId: string;
let accessoriesPresetId: string;
const styleIds: string[] = [];

const presetOf = async (id: string) =>
  (await prisma.styles.findUnique({ where: { id }, select: { customerSizePresetId: true } }))?.customerSizePresetId;

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
    data: { code: `${RUN}-CUST`, name: `${RUN} Buyer`, type: 'BUYER', category: 'DOMESTIC', createdById: userId },
  });
  customerId = customer.id;

  const category = await prisma.size_categories.create({
    data: { name: `${RUN} Sizes`, sizes: ['S', 'M', 'L'] },
  });
  sizeCategoryId = category.id;

  const preset = await prisma.customer_size_category_presets.create({
    data: { customerId, presetName: `${RUN} S-L`, sizeCategoryId },
  });
  presetId = preset.id;
  const other = await prisma.customer_size_category_presets.create({
    data: { customerId, presetName: `${RUN} Other`, sizeCategoryId },
  });
  otherPresetId = other.id;

  // No items: the create path's loadPresetAccessories then adds nothing to the BOM
  const accessories = await prisma.customer_accessories_presets.create({
    data: { customerId, presetName: `${RUN} Packing` },
  });
  accessoriesPresetId = accessories.id;

  const styleId = randomUUID();
  await prisma.styles.create({
    data: { id: styleId, styleCode: `${RUN}-STY`, styleName: `${RUN} Kurta`, customerId, createdById: userId },
  });
  styleIds.push(styleId);
});

afterAll(async () => {
  const steps: Array<[string, () => Promise<unknown>]> = [
    ['size_options', () => prisma.size_options.deleteMany({ where: { styleId: { in: styleIds } } })],
    ['color_options', () => prisma.color_options.deleteMany({ where: { styleId: { in: styleIds } } })],
    ['style_material_bom', () => prisma.style_material_bom.deleteMany({ where: { styleId: { in: styleIds } } })],
    ['styles', () => prisma.styles.deleteMany({ where: { id: { in: styleIds } } })],
    [
      'customer_size_category_presets',
      () => prisma.customer_size_category_presets.deleteMany({ where: { customerId: only(customerId) } }),
    ],
    [
      'customer_accessories_presets',
      () => prisma.customer_accessories_presets.deleteMany({ where: { customerId: only(customerId) } }),
    ],
    ['size_categories', () => prisma.size_categories.deleteMany({ where: { id: only(sizeCategoryId) } })],
    ['customers', () => prisma.customers.deleteMany({ where: { id: only(customerId) } })],
    ['users', () => prisma.users.deleteMany({ where: { id: only(userId) } })],
  ];
  for (const [label, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`[style-size-preset teardown] could not clean ${label}:`, err);
    }
  }
  await prisma.$disconnect();
});

describe('the Style form remembers its size preset', () => {
  it('records the preset a save sends', async () => {
    await request(app)
      .put(`/api/styles/${styleIds[0]}`)
      .set(authHeader)
      .send({ customerSizePresetId: presetId })
      .expect(200);
    expect(await presetOf(styleIds[0])).toBe(presetId);
  });

  it('keeps it when a save does not send the key', async () => {
    await request(app).put(`/api/styles/${styleIds[0]}`).set(authHeader).send({ bulletPoints: 'x' }).expect(200);
    expect(await presetOf(styleIds[0])).toBe(presetId);
  });

  it('clears it when the form picks None (sends null)', async () => {
    await request(app)
      .put(`/api/styles/${styleIds[0]}`)
      .set(authHeader)
      .send({ customerSizePresetId: null })
      .expect(200);
    expect(await presetOf(styleIds[0])).toBeNull();
  });

  it('create records both the size preset and the accessories preset', async () => {
    const res = await request(app)
      .post('/api/styles')
      .set(authHeader)
      .send({
        styleCode: `${RUN}NEW`,
        styleName: `${RUN} Created`,
        customerId,
        customerName: `${RUN} Buyer`,
        brandName: 'Kasya',
        customerSizePresetId: presetId,
        customerAccessoriesPresetId: accessoriesPresetId,
      })
      .expect(201);
    const id = res.body.data.id as string;
    styleIds.push(id);

    const saved = await prisma.styles.findUnique({
      where: { id },
      select: { customerSizePresetId: true, customerAccessoriesPresetId: true },
    });
    expect(saved?.customerSizePresetId).toBe(presetId);
    expect(saved?.customerAccessoriesPresetId).toBe(accessoriesPresetId);
  });

  it('deleting the preset clears the pointer instead of leaving a dangling id', async () => {
    await request(app)
      .put(`/api/styles/${styleIds[0]}`)
      .set(authHeader)
      .send({ customerSizePresetId: otherPresetId })
      .expect(200);
    await prisma.customer_size_category_presets.delete({ where: { id: otherPresetId } });
    expect(await presetOf(styleIds[0])).toBeNull();
  });
});
