/**
 * Bulk Update LNG Styles: Set Poplin + PRINTED fabric
 *
 * For all LNG styles (or specified list):
 * - If component has no fabric: CREATE with Poplin + PRINTED
 * - If component has fabric: UPDATE to Poplin + PRINTED
 *
 * Usage:
 *   npx ts-node scripts/bulk-update-lng-fabrics.ts --dry-run   # Preview only
 *   npx ts-node scripts/bulk-update-lng-fabrics.ts              # Execute
 */

import { PrismaClient, FabricFinishType } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

// Style codes from user request (deduplicated)
const TARGET_STYLE_CODES = [
  'LNG001', 'LNG002', 'LNG003', 'LNG004', 'LNG005', 'LNG006', 'LNG007', 'LNG008', 'LNG009', 'LNG010',
  'LNG011', 'LNG011B', 'LNG012', 'LNG013', 'LNG014', 'LNG015', 'LNG016', 'LNG017', 'LNG018', 'LNG019',
  'LNG020', 'LNG020B', 'LNG021', 'LNG022', 'LNG023', 'LNG025', 'LNG026', 'LNG027', 'LNG028', 'LNG029',
  'LNG030', 'LNG031', 'LNG032',
  'LNG101', 'LNG102', 'LNG104', 'LNG105', 'LNG106', 'LNG108', 'LNG110', 'LNG111', 'LNG112', 'LNG113',
  'LNG114', 'LNG115', 'LNG116', 'LNG117', 'LNG118', 'LNG120', 'LNG121', 'LNG122', 'LNG123', 'LNG124',
  'LNG125', 'LNG126', 'LNG127', 'LNG128', 'LNG129', 'LNG130', 'LNG131', 'LNG132', 'LNG133', 'LNG134',
  'LNG135', 'LNG136', 'LNG137', 'LNG138', 'LNG140', 'LNG141', 'LNG142', 'LNG143', 'LNG144', 'LNG145',
  'LNG146', 'LNG146B', 'LNG146Y', 'LNG147', 'LNG150', 'LNG151', 'LNG152', 'LNG153', 'LNG154', 'LNG154M',
  'LNG155', 'LNG156', 'LNG157', 'LNG158', 'LNG158B', 'LNG159', 'LNG160', 'LNG161', 'LNG162', 'LNG163',
  'LNG164', 'LNG165', 'LNG166', 'LNG167', 'LNG168', 'LNG170', 'LNG171', 'LNG172', 'LNG173', 'LNG174',
  'LNG175', 'LNG176', 'LNG177', 'LNG178', 'LNG180', 'LNG181', 'LNG182', 'LNG183', 'LNG184', 'LNG185',
  'LNG186', 'LNG187', 'LNG188', 'LNG189', 'LNG190', 'LNG191', 'LNG192', 'LNG193', 'LNG194', 'LNG195',
  'LNG196', 'LNG197', 'LNG199', 'LNG200', 'LNG202', 'LNG203', 'LNG204', 'LNG204B', 'LNG204P', 'LNG206',
  'LNG207', 'LNG209', 'LNG210', 'LNG213', 'LNG215', 'LNG215M', 'LNG215N', 'LNG215Y', 'LNG223', 'LNG225',
  'LNG226', 'LNG227', 'LNG231', 'LNG232', 'LNG233', 'LNG234', 'LNG235', 'LNG245', 'LNG250', 'LNG251',
  'LNG253', 'LNG254', 'LNG255', 'LNG256', 'LNG257', 'LNG258', 'LNG259', 'LNG260', 'LNG261', 'LNG262',
  'LNG263', 'LNG264', 'LNG265', 'LNG266', 'LNG470', 'LNG472',
];

async function main() {
  console.log('=== Bulk Update LNG Fabrics: Poplin + PRINTED ===');
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN' : '⚡ LIVE EXECUTION'}\n`);

  // Deduplicate
  const uniqueCodes = [...new Set(TARGET_STYLE_CODES)];
  console.log(`Target style codes: ${uniqueCodes.length}`);

  // Find matching styles with their components and fabrics
  const styles = await prisma.styles.findMany({
    where: { styleCode: { in: uniqueCodes } },
    include: {
      style_components: {
        include: { style_fabrics: true },
      },
    },
  });

  console.log(`Styles found in database: ${styles.length}`);

  // Report missing codes
  const foundCodes = new Set(styles.map(s => s.styleCode));
  const missingCodes = uniqueCodes.filter(c => !foundCodes.has(c));
  if (missingCodes.length > 0) {
    console.log(`\n⚠️  Missing codes (${missingCodes.length}): ${missingCodes.join(', ')}`);
  }

  let created = 0;
  let updated = 0;
  let skippedNoComponent = 0;

  for (const style of styles) {
    if (style.style_components.length === 0) {
      console.log(`  ${style.styleCode}: SKIPPED (no components)`);
      skippedNoComponent++;
      continue;
    }

    for (const component of style.style_components) {
      if (component.style_fabrics.length === 0) {
        // CREATE new fabric
        if (!DRY_RUN) {
          await prisma.style_fabrics.create({
            data: {
              id: randomUUID(),
              componentId: component.id,
              fabricName: 'Poplin',
              fabricType: 'GENERIC',
              genericGreigeName: 'Poplin',
              fabricFinishType: FabricFinishType.PRINTED,
              quantityNeeded: 0,
              allowCombinedCutting: true,
            },
          });
        }
        console.log(`  ${style.styleCode} / ${component.componentName}: CREATED fabric`);
        created++;
      } else {
        // UPDATE existing fabrics
        if (!DRY_RUN) {
          await prisma.style_fabrics.updateMany({
            where: { componentId: component.id },
            data: {
              genericGreigeName: 'Poplin',
              fabricFinishType: FabricFinishType.PRINTED,
            },
          });
        }
        console.log(`  ${style.styleCode} / ${component.componentName}: UPDATED ${component.style_fabrics.length} fabric(s)`);
        updated += component.style_fabrics.length;
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Styles processed: ${styles.length}`);
  console.log(`Fabrics created: ${created}`);
  console.log(`Fabrics updated: ${updated}`);
  console.log(`Skipped (no components): ${skippedNoComponent}`);
  console.log(`Missing style codes: ${missingCodes.length}`);

  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN complete. Run without --dry-run to execute.');
  } else {
    console.log('\n✅ Execution complete!');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
