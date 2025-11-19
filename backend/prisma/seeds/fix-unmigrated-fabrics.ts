/**
 * Fix Unmigrated Fabrics Script
 *
 * Handles the 3 style_fabrics that failed during Phase 2 migration
 * due to missing greige bases.
 *
 * This script:
 * 1. Finds style_fabrics without fabricId (unmigrated)
 * 2. Creates greige masters for their base fabrics
 * 3. Creates fabric masters
 * 4. Links them properly
 * 5. Creates materials entries
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Starting Unmigrated Fabrics Fix...\n');

  try {
    // Step 1: Find unmigrated style_fabrics
    const unmigrated = await prisma.style_fabrics.findMany({
      where: {
        fabricId: null,
        fabricName: { not: null },
      },
    });

    console.log(`📊 Found ${unmigrated.length} unmigrated style_fabrics\n`);

    if (unmigrated.length === 0) {
      console.log('✅ No unmigrated fabrics found. All done!\n');
      return;
    }

    // Step 2: Get admin user for createdBy
    let adminUser = await prisma.users.findFirst({
      where: { role: 'ADMIN' },
    });

    if (!adminUser) {
      console.log('⚠️  No admin user found. Using migration user...');
      adminUser = await prisma.users.findFirst({
        where: { email: 'migration@system.local' },
      });
    }

    if (!adminUser) {
      throw new Error('No admin or migration user found. Please create one first.');
    }

    const userId = adminUser.id;

    // Step 3: Process each unmigrated fabric
    for (const sf of unmigrated) {
      console.log(`\n🔍 Processing: ${sf.fabricName} (${sf.fabricColor || 'no color'})`);

      // Extract greige name - use fabricName as base if no greigeName
      let greigeName = sf.greigeName || `${sf.fabricName} Base`;

      // Clean up greige name
      greigeName = greigeName.trim();

      console.log(`   📦 Creating greige: ${greigeName}`);

      // Check if greige already exists
      let greige = await prisma.greige_master.findFirst({
        where: { greigeName },
      });

      if (!greige) {
        // Create greige master
        greige = await prisma.greige_master.create({
          data: {
            greigeCode: `GRG-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
            greigeName,
            composition: sf.fabricType || 'Cotton/Polyester Blend',
            greigeWidth: sf.fabricWidth ? Number(sf.fabricWidth) + 2 : 60, // Assume 2" shrinkage
            averageShrinkagePercent: 8,
            costPerMeter: 3.50, // Default - to be updated
            createdById: userId,
            isActive: true,
          },
        });
        console.log(`   ✅ Created greige: ${greigeName} (${greige.greigeCode})`);
      } else {
        console.log(`   ℹ️  Greige already exists: ${greigeName}`);
      }

      // Create fabric master
      console.log(`   🎨 Creating fabric: ${sf.fabricName} (${sf.fabricColor || 'no color'})`);

      const whereClause: any = {
        fabricName: sf.fabricName,
      };
      if (sf.fabricColor) {
        whereClause.colorName = sf.fabricColor;
      }

      let fabric = await prisma.fabric_master.findFirst({
        where: whereClause,
      });

      if (!fabric) {
        fabric = await prisma.fabric_master.create({
          data: {
            fabricCode: `FAB-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
            fabricName: sf.fabricName!,
            greigeId: greige.id,
            colorName: sf.fabricColor || null,
            finishType: sf.fabricType || 'solid',
            actualWidth: sf.fabricWidth ? Number(sf.fabricWidth) : 58,
            actualGSM: sf.fabricGSM ? parseInt(sf.fabricGSM) : null,
            costPerMeter: 5.00, // Default - to be updated
            createdById: userId,
            isActive: true,
          },
        });
        console.log(`   ✅ Created fabric: ${fabric.fabricName} (${fabric.fabricCode})`);
      } else {
        console.log(`   ℹ️  Fabric already exists: ${fabric.fabricName}`);
      }

      // Link style_fabric to fabric master
      await prisma.style_fabrics.update({
        where: { id: sf.id },
        data: { fabricId: fabric.id },
      });
      console.log(`   🔗 Linked style_fabric to fabric master`);

      // Create materials entry
      const fabricCategory = await prisma.material_categories.findFirst({
        where: { name: 'FABRIC' },
      });

      if (fabricCategory) {
        // Check if material already exists
        const existingMaterial = await prisma.materials.findFirst({
          where: {
            materialType: 'FINISHED_FABRIC',
            fabricId: fabric.id,
          },
        });

        if (!existingMaterial) {
          await prisma.materials.create({
            data: {
              id: `mat-${fabric.fabricCode}-${Date.now()}`,
              code: fabric.fabricCode,
              name: fabric.fabricName,
              categoryId: fabricCategory.id,
              materialType: 'FINISHED_FABRIC',
              fabricId: fabric.id,
              unit: 'METER',
              costPrice: fabric.costPerMeter,
              reorderLevel: 200,
              isActive: true,
              updatedAt: new Date(),
            },
          });
          console.log(`   📦 Created material entry`);
        }

        // Also create greige material if not exists
        const existingGreigeMaterial = await prisma.materials.findFirst({
          where: {
            materialType: 'GREIGE_FABRIC',
            greigeId: greige.id,
          },
        });

        if (!existingGreigeMaterial) {
          await prisma.materials.create({
            data: {
              id: `mat-${greige.greigeCode}-${Date.now()}`,
              code: greige.greigeCode,
              name: greige.greigeName,
              categoryId: fabricCategory.id,
              materialType: 'GREIGE_FABRIC',
              greigeId: greige.id,
              unit: 'METER',
              costPrice: greige.costPerMeter || 3.00,
              reorderLevel: 200,
              isActive: true,
              updatedAt: new Date(),
            },
          });
          console.log(`   📦 Created greige material entry`);
        }
      }

      console.log(`   ✅ Complete: ${sf.fabricName}`);
    }

    // Final validation
    console.log('\n📊 Final Validation...\n');

    const totalStyleFabrics = await prisma.style_fabrics.count({
      where: { fabricName: { not: null } },
    });

    const linkedStyleFabrics = await prisma.style_fabrics.count({
      where: { fabricId: { not: null } },
    });

    const unmigrationCount = await prisma.style_fabrics.count({
      where: {
        fabricId: null,
        fabricName: { not: null },
      },
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total Style Fabrics: ${totalStyleFabrics}`);
    console.log(`Linked to Fabric Masters: ${linkedStyleFabrics}`);
    console.log(`Still Unmigrated: ${unmigrationCount}`);
    console.log(`Migration Rate: ${Math.round((linkedStyleFabrics / totalStyleFabrics) * 100)}%`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (unmigrationCount === 0) {
      console.log('🎉 All style_fabrics successfully migrated!\n');
    } else {
      console.log(`⚠️  ${unmigrationCount} style_fabrics still need attention\n`);
    }

  } catch (error) {
    console.error('❌ Error fixing unmigrated fabrics:', error);
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
