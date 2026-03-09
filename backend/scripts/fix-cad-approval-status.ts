/**
 * Fix CAD Approval Status
 *
 * Finds styles with cadStatus = 'APPROVED' but missing CAD data for some/all
 * fabric groups, and resets them back to 'PENDING'.
 *
 * Usage: cd backend && npx ts-node scripts/fix-cad-approval-status.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(`\n=== Fix CAD Approval Status ${isDryRun ? '(DRY RUN)' : ''} ===\n`);

  // Find all styles with cadStatus = 'APPROVED'
  const approvedStyles = await prisma.styles.findMany({
    where: { cadStatus: 'APPROVED' },
    select: {
      id: true,
      styleCode: true,
      styleName: true,
      approvedCadDate: true,
      style_components: {
        select: {
          id: true,
          componentName: true,
          style_fabrics: {
            select: {
              id: true,
              genericGreigeName: true,
              fabricFinishType: true,
              fabricCADId: true,
              fabricCAD: {
                select: {
                  id: true,
                  cadAverage: true,
                },
              },
            },
          },
        },
      },
    },
  });

  console.log(`Found ${approvedStyles.length} styles with cadStatus = APPROVED\n`);

  const stylesToFix: Array<{ id: string; styleCode: string; reason: string }> = [];

  for (const style of approvedStyles) {
    const allFabrics = style.style_components.flatMap(c => c.style_fabrics);

    if (allFabrics.length === 0) {
      stylesToFix.push({
        id: style.id,
        styleCode: style.styleCode,
        reason: 'No fabrics defined',
      });
      continue;
    }

    const fabricsWithoutCAD = allFabrics.filter(sf => {
      if (!sf.fabricCADId || !sf.fabricCAD) return true;
      if (!sf.fabricCAD.cadAverage || Number(sf.fabricCAD.cadAverage) <= 0) return true;
      return false;
    });

    if (fabricsWithoutCAD.length > 0) {
      const missing = fabricsWithoutCAD
        .map(sf => `${sf.genericGreigeName || 'Unknown'}-${sf.fabricFinishType || 'PLAIN'}`)
        .join(', ');
      stylesToFix.push({
        id: style.id,
        styleCode: style.styleCode,
        reason: `${fabricsWithoutCAD.length}/${allFabrics.length} fabrics missing CAD: ${missing}`,
      });
    }
  }

  console.log(`Styles needing fix: ${stylesToFix.length}\n`);

  if (stylesToFix.length === 0) {
    console.log('No styles need fixing. All approved styles have complete CAD data.');
    return;
  }

  for (const style of stylesToFix) {
    console.log(`  ${style.styleCode} (${style.id}): ${style.reason}`);
  }

  if (isDryRun) {
    console.log('\n[DRY RUN] No changes made. Run without --dry-run to apply fixes.');
    return;
  }

  console.log('\nResetting cadStatus to PENDING...');

  const result = await prisma.styles.updateMany({
    where: { id: { in: stylesToFix.map(s => s.id) } },
    data: {
      cadStatus: 'PENDING',
      approvedCadDate: null,
    },
  });

  console.log(`\nDone. Reset ${result.count} styles to PENDING.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
