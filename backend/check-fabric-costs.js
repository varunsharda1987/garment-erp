const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFabricCosts() {
  try {
    // Check if there's any procurement data for these fabrics
    const fabrics = await prisma.fabric_master.findMany({
      where: { isActive: true },
      include: {
        fabricStock: {
          select: {
            weightedAvgCost: true,
            purchaseCost: true,
            quantityAvailable: true,
          },
          take: 5,
        },
        widthCADs: {
          select: {
            totalCostPerMeter: true,
            processingPricePerMeter: true,
          },
          take: 5,
        },
      },
      take: 5,
    });

    console.log('\n=== Fabric Cost Data Analysis ===\n');

    fabrics.forEach((fabric) => {
      console.log(`Fabric: ${fabric.fabricCode} - ${fabric.fabricName}`);
      console.log(`  Cost/Meter in fabric_master: ${fabric.costPerMeter || 'NULL'}`);
      console.log(`  Stock entries:`);

      if (fabric.fabricStock.length > 0) {
        fabric.fabricStock.forEach((stock, idx) => {
          console.log(`    Stock ${idx + 1}:`);
          console.log(`      Weighted Avg Cost: ${stock.weightedAvgCost || 'NULL'}`);
          console.log(`      Purchase Cost: ${stock.purchaseCost || 'NULL'}`);
          console.log(`      Quantity Available: ${stock.quantityAvailable}`);
        });
      } else {
        console.log(`    No stock entries`);
      }

      console.log(`  CAD entries:`);
      if (fabric.widthCADs.length > 0) {
        fabric.widthCADs.forEach((cad, idx) => {
          console.log(`    CAD ${idx + 1}:`);
          console.log(`      Total Cost/Meter: ${cad.totalCostPerMeter || 'NULL'}`);
          console.log(`      Processing Price/Meter: ${cad.processingPricePerMeter || 'NULL'}`);
        });
      } else {
        console.log(`    No CAD entries`);
      }

      console.log('');
    });

    // Check for procurement data
    console.log('\n=== Recent Procurements ===\n');
    const procurements = await prisma.fabric_procurement.findMany({
      where: {
        procurementType: 'FINISHED',
      },
      include: {
        fabric: {
          select: {
            fabricCode: true,
            fabricName: true,
          },
        },
      },
      orderBy: {
        purchaseDate: 'desc',
      },
      take: 5,
    });

    if (procurements.length > 0) {
      procurements.forEach((p) => {
        console.log(`${p.fabric.fabricCode}: ₹${p.ratePerUnit}/meter (${p.purchaseDate.toLocaleDateString()})`);
      });
    } else {
      console.log('No procurement records found');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkFabricCosts();
