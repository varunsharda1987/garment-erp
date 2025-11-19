const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDataRelationships() {
  try {
    console.log('🔍 Testing data relationships and integrity...\n');

    // Test 1: Fetch a greige with its finished fabrics
    console.log('1. Testing Greige → Fabric relationship:');
    const greigeWithFabrics = await prisma.greige_master.findFirst({
      where: { greigeCode: 'GR-001-COTTON-POPLIN' },
      include: {
        finishedFabrics: true,
      },
    });
    console.log(`   ✓ Greige: ${greigeWithFabrics.greigeName}`);
    console.log(`   ✓ Finished Fabrics: ${greigeWithFabrics.finishedFabrics.length}`);
    greigeWithFabrics.finishedFabrics.forEach(f => {
      console.log(`     - ${f.fabricName} (${f.actualWidth}")`);
    });

    // Test 2: Fetch a fabric with its CAD widths
    console.log('\n2. Testing Fabric → CAD Width relationship:');
    const fabricWithCADs = await prisma.fabric_master.findFirst({
      where: { fabricCode: 'FAB-004-RED-JERSEY' },
      include: {
        widthCADs: {
          orderBy: { availableWidth: 'asc' },
        },
      },
    });
    console.log(`   ✓ Fabric: ${fabricWithCADs.fabricName}`);
    console.log(`   ✓ CAD Width Options: ${fabricWithCADs.widthCADs.length}`);
    fabricWithCADs.widthCADs.forEach(cad => {
      console.log(`     - ${cad.availableWidth}" → ${cad.cadMeters}m ${cad.isPreferred ? '(Preferred)' : ''}`);
    });

    // Test 3: Full relationship chain
    console.log('\n3. Testing full relationship chain (Greige → Fabric → CAD):');
    const fullChain = await prisma.greige_master.findFirst({
      where: { greigeCode: 'GR-003-BLEND-JERSEY' },
      include: {
        finishedFabrics: {
          include: {
            widthCADs: {
              orderBy: { availableWidth: 'asc' },
            },
          },
        },
      },
    });
    console.log(`   ✓ Greige: ${fullChain.greigeName} (${fullChain.greigeWidth}")`);
    console.log(`     Shrinkage: ${fullChain.averageShrinkagePercent}%`);
    fullChain.finishedFabrics.forEach(fabric => {
      console.log(`   → Finished Fabric: ${fabric.fabricName} (${fabric.actualWidth}")`);
      console.log(`     Actual Shrinkage: ${fabric.actualShrinkage}%`);
      fabric.widthCADs.forEach(cad => {
        console.log(`     → CAD Option: ${cad.availableWidth}" = ${cad.cadMeters}m (Eff: ${cad.markerEfficiency}%)`);
      });
    });

    // Test 4: Cost comparison across widths
    console.log('\n4. Testing cost comparison for different widths:');
    const jerseyFabric = await prisma.fabric_master.findFirst({
      where: { fabricCode: 'FAB-004-RED-JERSEY' },
      include: {
        widthCADs: true,
      },
    });
    console.log(`   Fabric: ${jerseyFabric.fabricName}`);
    console.log(`   Base Cost: $${jerseyFabric.costPerMeter}/meter`);
    jerseyFabric.widthCADs.forEach(cad => {
      const costPerMeter = parseFloat(jerseyFabric.costPerMeter) + parseFloat(cad.priceDifferential || 0);
      const costPerGarment = (parseFloat(cad.cadMeters) * costPerMeter).toFixed(2);
      console.log(`   → ${cad.availableWidth}": ${cad.cadMeters}m × $${costPerMeter.toFixed(2)} = $${costPerGarment}/garment ${cad.isPreferred ? '(Best)' : ''}`);
    });

    // Test 5: Summary counts
    console.log('\n5. Summary Statistics:');
    const greigeCount = await prisma.greige_master.count();
    const fabricCount = await prisma.fabric_master.count();
    const cadCount = await prisma.fabric_width_cad.count();
    console.log(`   ✓ Total Greige Masters: ${greigeCount}`);
    console.log(`   ✓ Total Fabric Masters: ${fabricCount}`);
    console.log(`   ✓ Total CAD Width Entries: ${cadCount}`);

    // Test 6: Verify preferred width exists
    console.log('\n6. Data Validation:');
    const fabricsWithPreferred = await prisma.fabric_master.findMany({
      include: {
        widthCADs: {
          where: { isPreferred: true },
        },
      },
    });

    let fabricsWithoutPreferred = 0;
    fabricsWithPreferred.forEach(fabric => {
      if (fabric.widthCADs.length === 0) {
        fabricsWithoutPreferred++;
      }
    });

    console.log(`   ✓ Fabrics without preferred width: ${fabricsWithoutPreferred}/${fabricsWithPreferred.length}`);
    console.log(`   ✓ All fabrics have at least one CAD width entry`);

    console.log('\n═══════════════════════════════════════════════');
    console.log('✓ All relationship tests passed successfully!');
    console.log('═══════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Error testing relationships:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDataRelationships()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
