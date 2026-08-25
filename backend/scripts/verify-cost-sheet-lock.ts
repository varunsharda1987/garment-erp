/**
 * Live verification of the cost-sheet order-consumption freeze (2026-08-25).
 *
 * Attempts to revoke approval on the ESSKY091LS v2 cost sheet — which has a
 * LIVE consumer (order ORD2026080030's active APPROVED BOM v2 built from it).
 * With the guard deployed this must return 409 COST_SHEET_IN_USE naming the
 * order, and change NOTHING.
 *
 *   npx ts-node scripts/verify-cost-sheet-lock.ts [--sheet <costSheetId>]
 */

import jwt from 'jsonwebtoken';
import prisma from '../src/config/database';

const API = process.env.REPAIR_API_BASE || 'http://localhost:5000/api';
const argIdx = process.argv.indexOf('--sheet');
const SHEET_ID = argIdx > -1 ? process.argv[argIdx + 1] : 'CS-1787665155067-lrf8yvx';

async function main() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not in environment — run from backend/.');
  const admin =
    (await prisma.users.findFirst({ where: { email: 'admin@kasya.in' } })) ||
    (await prisma.users.findFirst({ where: { role: 'ADMIN', isActive: true } }));
  if (!admin) throw new Error('No ADMIN user found.');
  const token = jwt.sign({ userId: admin.id, role: admin.role }, secret, { expiresIn: '10m' });

  const before = await prisma.style_costing.findUnique({
    where: { id: SHEET_ID },
    select: { approvalStatus: true, isApproved: true, version: true },
  });
  if (!before) throw new Error(`Cost sheet ${SHEET_ID} not found`);
  console.log(`Before: v${before.version} approvalStatus=${before.approvalStatus} isApproved=${before.isApproved}`);

  const res = await fetch(`${API}/style-costing/${SHEET_ID}/approve`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'revoke' }),
  });
  const json: any = await res.json().catch(() => ({}));
  console.log(`HTTP ${res.status}`);
  console.log(`message: ${json.message}`);
  if (json.details) {
    console.log(`details.code: ${json.details.code}`);
    console.log(
      `active BOMs: ${(json.details.dependents?.activeBoms || [])
        .map((b: any) => `${b.orderNumber} (BOM v${b.bomVersion}, ${b.bomStatus})`)
        .join(', ')}`
    );
  }

  const after = await prisma.style_costing.findUnique({
    where: { id: SHEET_ID },
    select: { approvalStatus: true },
  });
  console.log(`After:  approvalStatus=${after?.approvalStatus} (must be unchanged)`);

  const pass =
    res.status === 409 &&
    json.details?.code === 'COST_SHEET_IN_USE' &&
    String(after?.approvalStatus) === String(before.approvalStatus);
  console.log(pass ? '\nPASS — consumed cost sheet cannot be unapproved.' : '\nFAIL — guard did not behave as expected.');
  process.exitCode = pass ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
