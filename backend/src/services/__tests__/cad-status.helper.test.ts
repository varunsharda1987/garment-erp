/**
 * cad-status.helper — pins the derived styles.cadStatus contract (landmine №3 fix).
 *
 * styles.cadStatus is a DERIVED summary of the style's fabric_width_cad rows:
 * APPROVED (≥1 approved row) / IN_PROGRESS (rows, none approved) / PENDING (no rows).
 * Style-level and row-level approval used to be written by different flows and drifted —
 * the stamp then bypassed the cost-sheet both-approvals gate.
 */

import { deriveCadStatus, recomputeStyleCadStatus, cadRowsOfStyle } from '../helpers/cad-status.helper';
import prisma from '../../config/database';
import { randomUUID } from 'crypto';
import { only } from '../../utils/prisma-test-guard';

describe('cad-status.helper', () => {
  const RUN = `TCDS${Date.now().toString(36).toUpperCase()}`;
  let testUserId: string;
  let styleId: string;

  beforeAll(async () => {
    const user = await prisma.users.create({
      data: {
        email: `${RUN.toLowerCase()}@test.com`,
        password: 'hashedpassword',
        firstName: 'Test',
        lastName: 'User',
        role: 'ADMIN',
      },
    });
    testUserId = user.id;
  });

  beforeEach(async () => {
    const style = await prisma.styles.create({
      data: {
        id: randomUUID(),
        styleCode: `${RUN}-${Date.now().toString(36)}`,
        styleName: `${RUN} Style`,
        createdById: testUserId,
      },
    });
    styleId = style.id;
  });

  afterEach(async () => {
    await prisma.fabric_width_cad.deleteMany({ where: { costingStyleId: only(styleId) } });
    await prisma.styles.deleteMany({ where: { id: only(styleId) } });
  });

  afterAll(async () => {
    try {
      await prisma.styles.deleteMany({ where: { styleCode: { startsWith: RUN } } });
      await prisma.users.deleteMany({ where: { email: `${RUN.toLowerCase()}@test.com` } });
    } catch {
      // ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  function createRow(approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED') {
    return prisma.fabric_width_cad.create({
      data: {
        id: randomUUID(),
        costingStyleId: styleId,
        cutableWidth: 44 + Math.floor(Math.random() * 20),
        cadMeters: 2,
        purpose: 'COSTING',
        purposeEnum: 'COSTING',
        approvalStatus,
        createdById: testUserId,
      },
    });
  }

  it('pure derivation: PENDING / IN_PROGRESS / APPROVED', () => {
    expect(deriveCadStatus(0, 0)).toBe('PENDING');
    expect(deriveCadStatus(3, 0)).toBe('IN_PROGRESS');
    expect(deriveCadStatus(3, 1)).toBe('APPROVED');
  });

  it('recompute follows the rows through the full lifecycle', async () => {
    // No rows → PENDING (creation default, unchanged)
    expect(await recomputeStyleCadStatus(prisma, styleId)).toBe('PENDING');

    // A pending row appears → IN_PROGRESS
    const row = await createRow('PENDING');
    expect(await recomputeStyleCadStatus(prisma, styleId)).toBe('IN_PROGRESS');
    let style = await prisma.styles.findUnique({ where: { id: styleId } });
    expect(style!.cadStatus).toBe('IN_PROGRESS');

    // Row approved → APPROVED with approvedCadDate stamped
    await prisma.fabric_width_cad.update({ where: { id: row.id }, data: { approvalStatus: 'APPROVED' } });
    expect(await recomputeStyleCadStatus(prisma, styleId)).toBe('APPROVED');
    style = await prisma.styles.findUnique({ where: { id: styleId } });
    expect(style!.cadStatus).toBe('APPROVED');
    expect(style!.approvedCadDate).not.toBeNull();

    // Row rejected → back to IN_PROGRESS, date cleared (the stamp can no longer outlive its rows)
    await prisma.fabric_width_cad.update({ where: { id: row.id }, data: { approvalStatus: 'REJECTED' } });
    expect(await recomputeStyleCadStatus(prisma, styleId)).toBe('IN_PROGRESS');
    style = await prisma.styles.findUnique({ where: { id: styleId } });
    expect(style!.cadStatus).toBe('IN_PROGRESS');
    expect(style!.approvedCadDate).toBeNull();

    // Last row deleted → PENDING (generalizes the old deleteCADTableRow partial reset)
    await prisma.fabric_width_cad.delete({ where: { id: row.id } });
    expect(await recomputeStyleCadStatus(prisma, styleId)).toBe('PENDING');
  });

  it('a stamped style with zero rows is corrected on the first recompute', async () => {
    // The landmine shape: cadStatus APPROVED, no approved rows behind it
    await prisma.styles.update({
      where: { id: styleId },
      data: { cadStatus: 'APPROVED', approvedCadDate: new Date() },
    });
    await createRow('PENDING');

    expect(await recomputeStyleCadStatus(prisma, styleId)).toBe('IN_PROGRESS');
    const style = await prisma.styles.findUnique({ where: { id: styleId } });
    expect(style!.cadStatus).toBe('IN_PROGRESS');
  });

  it('cadRowsOfStyle matches rows through both linkages', async () => {
    await createRow('PENDING'); // costingStyleId linkage
    const count = await prisma.fabric_width_cad.count({ where: cadRowsOfStyle(styleId) });
    expect(count).toBe(1);
  });
});
