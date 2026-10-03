/**
 * A dyeing / printing job's greige lot must be the greige its fabric is made from (2026-10-03): the Processing →
 * New Job Work Order form offered every greige lot once a style and fabric were chosen, and the API took any.
 * Runs on garment_erp_test; tagged fixtures, torn down.
 */
import { prisma, createTestUser } from '../helpers/test-utils';
import { only, onlyAll } from '../../utils/prisma-test-guard';
import { assertLotMakesFabric } from '../../services/helpers/fabric-greige-lot.helper';

const RUN = `FGL${Date.now().toString(36).toUpperCase()}`;
let userId: string;
let greigeA: string;
let greigeB: string;
let fabricId: string;
let looseFabricId: string;

beforeAll(async () => {
  userId = (
    await createTestUser({
      email: `test-${RUN.toLowerCase()}@smoke.test`,
      role: 'ADMIN',
      isActive: true,
      isApproved: true,
    })
  ).id;
  const mkGreige = async (tag: string) =>
    (
      await prisma.greige_master.create({
        data: {
          greigeCode: `${RUN}-${tag}`,
          greigeName: `${RUN} ${tag}`,
          composition: '100% Viscose',
          greigeWidth: 44,
          createdById: userId,
        },
      })
    ).id;
  greigeA = await mkGreige('A');
  greigeB = await mkGreige('B');
  fabricId = (
    await prisma.fabric_master.create({
      data: {
        fabricCode: `${RUN}-FAB`,
        fabricName: `${RUN} Moss`,
        greigeId: greigeA,
        isActive: true,
        createdById: userId,
      },
    })
  ).id;
  looseFabricId = (
    await prisma.fabric_master.create({
      data: { fabricCode: `${RUN}-LOOSE`, fabricName: `${RUN} Loose`, isActive: true, createdById: userId },
    })
  ).id;
});

afterAll(async () => {
  await prisma.fabric_master.deleteMany({ where: { id: { in: onlyAll([fabricId, looseFabricId]) } } });
  await prisma.greige_master.deleteMany({ where: { id: { in: onlyAll([greigeA, greigeB]) } } });
  await prisma.users.deleteMany({ where: { id: only(userId) } });
  await prisma.$disconnect();
});

it('a lot of the fabric’s own greige is accepted', async () => {
  await expect(assertLotMakesFabric(prisma, { fabricId, lotGreigeId: greigeA })).resolves.toBeUndefined();
});

it('a lot of another greige is refused, naming both', async () => {
  await expect(assertLotMakesFabric(prisma, { fabricId, lotGreigeId: greigeB })).rejects.toMatchObject({
    details: { code: 'LOT_GREIGE_NOT_FABRICS' },
    message: expect.stringContaining(`is made from ${RUN}-A`),
  });
});

it('a fabric with no greige recorded is not checked', async () => {
  await expect(
    assertLotMakesFabric(prisma, { fabricId: looseFabricId, lotGreigeId: greigeB })
  ).resolves.toBeUndefined();
});
