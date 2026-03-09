import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Batch {
  genericGreigeName: string;
  styleCodes: string[];
}

const batches: Batch[] = [
  {
    genericGreigeName: 'Poplin',
    styleCodes: [
      'LNG255','LNG143','LNG015','LNG025','LNG131','LNG130','LNG141','LNG152',
      'LNG163','LNG165','LNG167','LNG200','LNG232','LNG233','LNG199','LNG180',
      'LNG190','LNG202','LNG250','LNG122','LNG123','LNG124','LNG125','LNG126',
      'LNG127','LNG128','LNG132','LNG112','LNG113','LNG140','LNG133','LNG142',
      'LNG151','LNG155','LNG116','LNG120','LNG129','LNG153','LNG175','LNG184',
      'LNG187','LNG204','LNG204P','LNG204B','LNG470','LNG472','LNG008','LNG009',
      'LNG013','LNG016','LNG017','LNG021','LNG027','LNG104','LNG105','LNG106',
      'LNG108','LNG110','LNG111','LNG114','LNG117','LNG118','LNG134','LNG135',
      'LNG136','LNG137','LNG146','LNG147','LNG150','LNG146Y','LNG146B','LNG145',
      'LNG257','LNG001','LNG002','LNG003','LNG004','LNG005','LNG006','LNG007',
      'LNG010','LNG011','LNG011B','LNG012','LNG014','LNG018','LNG019','LNG020',
      'LNG020B','LNG022','LNG023','LNG026','LNG028','LNG029','LNG030','LNG031',
      'LNG101','LNG102','LNG115','LNG138','LNG144','LNG032','LNG154','LNG156',
      'LNG157','LNG158','LNG159','LNG160','LNG161','LNG162','LNG191','LNG192',
      'LNG193','LNG194','LNG195','LNG196','LNG197','LNG164','LNG166','LNG210',
      'LNG213','LNG154M','LNG158B','LNG223','LNG225','LNG226','LNG227','LNG234',
      'LNG235','LNG245','LNG172','LNG186','LNG203','LNG207','LNG231','LNG251',
      'LNG253','LNG254','LNG256','LNG206','LNG209','LNG215','LNG260','LNG215M',
      'LNG215N','LNG170','LNG171','LNG173','LNG174','LNG177','LNG178','LNG185',
      'LNG188','LNG121','LNG168','LNG181','LNG182','LNG183','LNG189','LNG258',
      'LNG259','LNG261','LNG262','LNG176','LNG215Y',
    ],
  },
  {
    genericGreigeName: 'Viscose Staple',
    styleCodes: [
      'LNG109','LNG109P','LNG109B','LNG237','LNG169','LNG169Y','LNG248B',
      'LNG241','LNG242B','LNG241B','LNG242','LNG246G','LNG243','LNG246',
      'LNG248M','LNG249','LNG249T','LNG247','LNG248','LNG229','LNG230',
      'LNG244','LNG198','LNG201','LNG211','LNG212','LNG198B','LNG198BL',
      'LNG198M','LNG198O','LNG240','LNG243G','LNG236','LNG248T',
    ],
  },
];

async function main() {
  console.log('=== Bulk Update genericGreigeName ===\n');

  for (const batch of batches) {
    // Deduplicate
    const uniqueCodes = [...new Set(batch.styleCodes)];
    console.log(`--- Batch: "${batch.genericGreigeName}" (${uniqueCodes.length} style codes) ---`);

    // 1. Find matching styles
    const styles = await prisma.styles.findMany({
      where: { styleCode: { in: uniqueCodes } },
      select: { id: true, styleCode: true },
    });
    console.log(`  Styles found: ${styles.length} / ${uniqueCodes.length}`);

    if (styles.length === 0) {
      console.log('  SKIPPED: No styles found.\n');
      continue;
    }

    // 2. Find components
    const components = await prisma.style_components.findMany({
      where: { styleId: { in: styles.map(s => s.id) } },
      select: { id: true },
    });
    console.log(`  Components found: ${components.length}`);

    if (components.length === 0) {
      console.log('  SKIPPED: No components found.\n');
      continue;
    }

    // 3. Update style_fabrics
    const result = await prisma.style_fabrics.updateMany({
      where: { componentId: { in: components.map(c => c.id) } },
      data: { genericGreigeName: batch.genericGreigeName },
    });
    console.log(`  style_fabrics updated: ${result.count}`);

    // 4. Report missing codes
    const foundCodes = new Set(styles.map(s => s.styleCode));
    const missing = uniqueCodes.filter(c => !foundCodes.has(c));
    if (missing.length > 0) {
      console.log(`  WARNING - ${missing.length} codes not found: ${missing.join(', ')}`);
    }

    console.log('');
  }

  console.log('=== Done ===');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
