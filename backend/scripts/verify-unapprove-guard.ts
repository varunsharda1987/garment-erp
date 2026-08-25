/**
 * Live verification of the unapprove guard (ESSKY091LS incident).
 *
 * Replays the EXACT action that caused the incident — unapproving the
 * ESSKY091LS Top/52" costing option — against the running API. With the guard
 * deployed this must return 409 COSTING_OPTION_IN_USE (blocking: the active
 * APPROVED cost sheet v2 was built from it) and change NOTHING in the DB.
 *
 *   npx ts-node scripts/verify-unapprove-guard.ts [--cad <cadId>]
 */

import jwt from 'jsonwebtoken';
import prisma from '../src/config/database';

const API = process.env.REPAIR_API_BASE || 'http://localhost:5000/api';
const cadArgIdx = process.argv.indexOf('--cad');
const CAD_ID = cadArgIdx > -1 ? process.argv[cadArgIdx + 1] : 'bc636c7c-048b-4392-9653-fe134f380995';

async function main() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not in environment — run from backend/.');
  const admin =
    (await prisma.users.findFirst({ where: { email: 'admin@kasya.in' } })) ||
    (await prisma.users.findFirst({ where: { role: 'ADMIN', isActive: true } }));
  if (!admin) throw new Error('No ADMIN user found.');
  const token = jwt.sign({ userId: admin.id, role: admin.role }, secret, { expiresIn: '10m' });

  const before = await prisma.fabric_width_cad.findUnique({
    where: { id: CAD_ID },
    select: { costingApprovalStatus: true, totalCostPerMeter: true },
  });
  console.log(`Before: costingApprovalStatus=${before?.costingApprovalStatus} cost=${before?.totalCostPerMeter}`);

  const res = await fetch(`${API}/fabric-costing/option/${CAD_ID}/unapprove`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
  const json: any = await res.json().catch(() => ({}));
  console.log(`HTTP ${res.status}`);
  console.log(`message: ${json.message}`);
  if (json.details) {
    console.log(`details.code: ${json.details.code}  blocking: ${json.details.blocking}`);
    console.log(
      `blocking sheets: ${(json.details.dependents?.blockingCostSheets || [])
        .map((s: any) => `${s.costSheetId} (v${s.version}, ${s.costSheetApprovalStatus})`)
        .join(', ')}`
    );
    const c = json.details.dependents?.counts;
    if (c) console.log(`dependent counts: ${JSON.stringify(c)}`);
  }

  const after = await prisma.fabric_width_cad.findUnique({
    where: { id: CAD_ID },
    select: { costingApprovalStatus: true },
  });
  console.log(`After:  costingApprovalStatus=${after?.costingApprovalStatus} (must be unchanged)`);

  const pass = res.status === 409 && json.details?.blocking === true && after?.costingApprovalStatus === before?.costingApprovalStatus;
  console.log(pass ? '\nPASS — guard blocked the incident action.' : '\nFAIL — guard did not behave as expected.');
  process.exitCode = pass ? 0 : 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
