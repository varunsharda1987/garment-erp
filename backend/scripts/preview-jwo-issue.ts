/**
 * READ-ONLY dry run of the consolidated issuance validation for a JWO — the CLI twin
 * of GET /api/job-work-orders/:id/issue-preview (no auth needed, zero writes).
 *
 *   npx ts-node scripts/preview-jwo-issue.ts <jwoId | jobWorkNumber>
 */
import 'dotenv/config';
import prisma from '../src/config/database';
import { validateIssue } from '../src/services/job-work-issuance.service';

async function main() {
  const key = process.argv[2];
  if (!key) {
    console.error('Usage: npx ts-node scripts/preview-jwo-issue.ts <jwoId | jobWorkNumber>');
    process.exit(1);
  }
  const jwo = await prisma.job_work_orders.findFirst({
    where: { OR: [{ id: key }, { jobWorkNumber: key }] },
    select: { id: true },
  });
  if (!jwo) {
    console.error(`No job work order matched '${key}'`);
    process.exit(1);
  }

  const v = await validateIssue(jwo.id, {});
  console.log('=== Issue Preview (read-only) ===');
  console.log(`JWO:            ${v.jwo.jobWorkNumber} [${v.jwo.jwoStatus ?? v.jwo.status}]`);
  console.log(`Required:       ${Number(v.jwo.qtySentMeters)} ${v.jwo.uom} (fabricType ${v.jwo.fabricType})`);
  console.log(`Expected greige: ${v.expectedGreige ? `${v.expectedGreige.greigeCode} — ${v.expectedGreige.greigeName}` : '(unresolvable)'}`);
  console.log(`Can issue:      ${v.blockers.length === 0 ? 'YES' : 'NO'}`);
  for (const b of v.blockers) console.log(`  ✗ [${b.code}] ${b.message}`);
  if (v.expectedGreigeId) {
    const lots = await prisma.greige_stock.findMany({
      where: {
        greigeId: v.expectedGreigeId,
        status: 'AVAILABLE',
        processorId: null,
        quantityAvailable: { gt: 0 },
        OR: [{ sourceType: null }, { sourceType: { not: 'TRANSFER' } }],
      },
      select: { id: true, quantityAvailable: true, greigeWidth: true },
      orderBy: { quantityAvailable: 'desc' },
    });
    console.log(`Candidate lots: ${lots.length}`);
    for (const l of lots) console.log(`  ${l.id}  ${Number(l.quantityAvailable)}m @ ${Number(l.greigeWidth)}"`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
