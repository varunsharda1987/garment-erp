/**
 * Data Quality Review Script
 *
 * This script generates a comprehensive report on migrated data quality
 * and highlights areas that need manual updates.
 *
 * Reviews:
 * 1. Greige masters - Costs, compositions, widths
 * 2. Fabric masters - Costs, specifications
 * 3. Materials - Costs, stock levels
 * 4. CAD data - Values, efficiency
 * 5. Style fabrics - Linkage completeness
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface DataQualityIssue {
  type: 'warning' | 'info' | 'critical';
  category: string;
  item: string;
  issue: string;
  recommendation: string;
}

async function main() {
  console.log('🔍 Starting Data Quality Review...\n');

  const issues: DataQualityIssue[] = [];

  try {
    // Review 1: Greige Masters
    console.log('📦 Reviewing Greige Masters...');
    const greigeCount = await prisma.greige_master.count();
    const greiges = await prisma.greige_master.findMany();

    for (const greige of greiges) {
      // Check for default/placeholder values
      if (greige.composition?.includes('Migration')) {
        issues.push({
          type: 'warning',
          category: 'Greige Master',
          item: `${greige.greigeName} (${greige.greigeCode})`,
          issue: 'Composition contains placeholder text',
          recommendation: 'Update with actual fabric composition (e.g., "100% Cotton", "65% Polyester 35% Cotton")',
        });
      }

      if (greige.costPerMeter && Number(greige.costPerMeter) === 3.50) {
        issues.push({
          type: 'warning',
          category: 'Greige Master',
          item: `${greige.greigeName}`,
          issue: 'Using default cost ($3.50/meter)',
          recommendation: 'Update with actual greige procurement cost from suppliers',
        });
      }

      if (!greige.supplierId) {
        issues.push({
          type: 'info',
          category: 'Greige Master',
          item: `${greige.greigeName}`,
          issue: 'No supplier assigned',
          recommendation: 'Assign greige supplier for procurement',
        });
      }

      if (Number(greige.greigeWidth) === 58 && Number(greige.averageShrinkagePercent) === 8) {
        issues.push({
          type: 'info',
          category: 'Greige Master',
          item: `${greige.greigeName}`,
          issue: 'Using default width (58") and shrinkage (8%)',
          recommendation: 'Verify actual greige width and measure shrinkage from processing mill',
        });
      }
    }

    console.log(`   ✅ Reviewed ${greigeCount} greige masters\n`);

    // Review 2: Fabric Masters
    console.log('🎨 Reviewing Fabric Masters...');
    const fabricCount = await prisma.fabric_master.count();
    const fabrics = await prisma.fabric_master.findMany({
      include: {
        greige: true,
      },
    });

    for (const fabric of fabrics) {
      if (fabric.costPerMeter && Number(fabric.costPerMeter) === 5.00) {
        issues.push({
          type: 'warning',
          category: 'Fabric Master',
          item: `${fabric.fabricName} (${fabric.fabricCode})`,
          issue: 'Using default cost ($5.00/meter)',
          recommendation: 'Update with actual finished fabric cost (greige cost + processing cost)',
        });
      }

      if (!fabric.actualGSM) {
        issues.push({
          type: 'info',
          category: 'Fabric Master',
          item: `${fabric.fabricName}`,
          issue: 'No GSM specified',
          recommendation: 'Add actual fabric GSM for quality control',
        });
      }

      if (!fabric.supplierId) {
        issues.push({
          type: 'info',
          category: 'Fabric Master',
          item: `${fabric.fabricName}`,
          issue: 'No supplier assigned',
          recommendation: 'Assign fabric supplier or processing mill',
        });
      }
    }

    console.log(`   ✅ Reviewed ${fabricCount} fabric masters\n`);

    // Review 3: Materials
    console.log('📦 Reviewing Materials...');
    const materialCount = await prisma.materials.count({
      where: {
        materialType: { in: ['GREIGE_FABRIC', 'FINISHED_FABRIC'] },
      },
    });

    const materials = await prisma.materials.findMany({
      where: {
        materialType: { in: ['GREIGE_FABRIC', 'FINISHED_FABRIC'] },
      },
    });

    for (const material of materials) {
      if (material.reorderLevel === 200) {
        issues.push({
          type: 'info',
          category: 'Material',
          item: `${material.name} (${material.code})`,
          issue: 'Using default reorder level (200)',
          recommendation: 'Set reorder level based on average monthly consumption',
        });
      }

      if (!material.supplierId) {
        issues.push({
          type: 'info',
          category: 'Material',
          item: `${material.name}`,
          issue: 'No supplier assigned',
          recommendation: 'Assign primary supplier for procurement',
        });
      }
    }

    console.log(`   ✅ Reviewed ${materialCount} materials\n`);

    // Review 4: CAD Data
    console.log('📏 Reviewing CAD Data...');
    const cadCount = await prisma.fabric_width_cad.count();
    const cads = await prisma.fabric_width_cad.findMany({
      include: {
        fabric: true,
      },
    });

    for (const cad of cads) {
      if (cad.notes?.includes('Auto-generated')) {
        issues.push({
          type: 'info',
          category: 'CAD Data',
          item: `${cad.fabric.fabricName} (${cad.availableWidth}")`,
          issue: 'Auto-generated CAD values',
          recommendation: 'Verify CAD values against actual marker plans and update if needed',
        });
      }

      if (!cad.markerPlanFile) {
        issues.push({
          type: 'info',
          category: 'CAD Data',
          item: `${cad.fabric.fabricName} (${cad.availableWidth}")`,
          issue: 'No marker plan file attached',
          recommendation: 'Upload marker plan file for reference',
        });
      }
    }

    console.log(`   ✅ Reviewed ${cadCount} CAD records\n`);

    // Review 5: Style Fabrics Linkage
    console.log('🔗 Reviewing Style Fabrics Linkage...');
    const totalStyleFabrics = await prisma.style_fabrics.count({
      where: { fabricName: { not: null } },
    });

    const linkedStyleFabrics = await prisma.style_fabrics.count({
      where: { fabricId: { not: null } },
    });

    const unmigrated = totalStyleFabrics - linkedStyleFabrics;

    if (unmigrated > 0) {
      issues.push({
        type: 'critical',
        category: 'Style Fabrics',
        item: `${unmigrated} style_fabrics records`,
        issue: 'Not linked to fabric_master',
        recommendation: 'Run fix-unmigrated-fabrics.ts script to complete migration',
      });
    }

    console.log(`   ✅ ${linkedStyleFabrics}/${totalStyleFabrics} style_fabrics linked (${Math.round((linkedStyleFabrics / totalStyleFabrics) * 100)}%)\n`);

    // Generate Report
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 DATA QUALITY REVIEW REPORT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Summary
    const criticalIssues = issues.filter(i => i.type === 'critical');
    const warnings = issues.filter(i => i.type === 'warning');
    const infoItems = issues.filter(i => i.type === 'info');

    console.log('📈 Summary:');
    console.log(`   🔴 Critical Issues: ${criticalIssues.length}`);
    console.log(`   🟡 Warnings: ${warnings.length}`);
    console.log(`   🔵 Info/Recommendations: ${infoItems.length}`);
    console.log(`   📊 Total Items to Review: ${issues.length}\n`);

    // Critical Issues
    if (criticalIssues.length > 0) {
      console.log('\n🔴 CRITICAL ISSUES (Fix Immediately):');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      for (const issue of criticalIssues) {
        console.log(`\n[${issue.category}] ${issue.item}`);
        console.log(`   Issue: ${issue.issue}`);
        console.log(`   ➜ ${issue.recommendation}`);
      }
    }

    // Warnings
    if (warnings.length > 0 && warnings.length <= 10) {
      console.log('\n\n🟡 WARNINGS (Update Soon):');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      for (const issue of warnings) {
        console.log(`\n[${issue.category}] ${issue.item}`);
        console.log(`   Issue: ${issue.issue}`);
        console.log(`   ➜ ${issue.recommendation}`);
      }
    } else if (warnings.length > 10) {
      console.log('\n\n🟡 WARNINGS (Update Soon):');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`   ${warnings.length} warnings found`);
      console.log(`   Most common: Default costs need updating for greige and fabric masters`);
    }

    // Database Statistics
    console.log('\n\n📊 DATABASE STATISTICS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Greige Masters: ${greigeCount}`);
    console.log(`Fabric Masters: ${fabricCount}`);
    console.log(`Materials (Fabrics): ${materialCount}`);
    console.log(`CAD Records: ${cadCount}`);
    console.log(`Style Fabrics Linked: ${linkedStyleFabrics}/${totalStyleFabrics}`);

    // Next Steps
    console.log('\n\n✅ RECOMMENDED NEXT STEPS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. Fix any critical issues immediately');
    console.log('2. Update greige and fabric costs from supplier quotes');
    console.log('3. Add actual compositions and specifications');
    console.log('4. Assign suppliers to greige and fabric masters');
    console.log('5. Verify CAD values against actual marker plans');
    console.log('6. Update reorder levels based on consumption patterns');
    console.log('7. Upload marker plan files for CAD records');
    console.log('8. Start Phase 3 backend development\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('💡 TIP: Most data quality improvements can be made via the UI once Phase 3 is complete.\n');
    console.log('🎉 Data Quality Review Complete!\n');

  } catch (error) {
    console.error('❌ Error during data quality review:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
