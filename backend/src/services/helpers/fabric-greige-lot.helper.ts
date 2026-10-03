/**
 * A dyeing / printing job dyes ONE greige into ONE finished fabric: the greige lot it sends must be the greige that
 * fabric is made from (fabric_master.greigeId). The Processing → New Job Work Order form listed every greige lot in
 * stock once a style and fabric were chosen, and the API took any of them — a wrong pick dyed the wrong cloth into
 * the style's fabric (2026-10-03). A fabric with no greige recorded is not checked (nothing to compare with).
 */
import { Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { BusinessError } from '../../errors';

type Db = Prisma.TransactionClient | typeof prisma;

export async function assertLotMakesFabric(
  db: Db,
  args: { fabricId: string | null | undefined; lotGreigeId: string }
): Promise<void> {
  if (!args.fabricId) return;
  const fabric = await db.fabric_master.findUnique({
    where: { id: args.fabricId },
    select: { fabricCode: true, greigeId: true, greige: { select: { greigeCode: true } } },
  });
  if (!fabric?.greigeId || fabric.greigeId === args.lotGreigeId) return;
  const lotGreige = await db.greige_master.findUnique({
    where: { id: args.lotGreigeId },
    select: { greigeCode: true },
  });
  const want = fabric.greige?.greigeCode ?? 'its own greige';
  throw new BusinessError(
    `This lot is ${lotGreige?.greigeCode ?? 'another greige'}, but ${fabric.fabricCode} is made from ${want}. ` +
      `Pick a ${want} lot.`,
    { code: 'LOT_GREIGE_NOT_FABRICS', fabricGreigeId: fabric.greigeId, lotGreigeId: args.lotGreigeId }
  );
}
