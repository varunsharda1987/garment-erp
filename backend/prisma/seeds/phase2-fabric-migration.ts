/**
 * Phase 2: Fabric Materials Integration - Data Migration Script
 *
 * This script migrates existing style_fabrics data to the new fabric_master system
 *
 * Migration Steps:
 * 1. Extract unique fabric specifications from style_fabrics
 * 2. Create greige_master records for base fabrics
 * 3. Create fabric_master records for finished fabrics
 * 4. Link style_fabrics to fabric_master via fabricId
 * 5. Migrate cad_averages to fabric_width_cad
 * 6. Create materials entries for all fabrics
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface FabricSpec {
  fabricName: string;
  fabricType: string | null;
  fabricColor: string | null;
  fabricGSM: string | null;
  fabricWidth: number | null;
  greigeName: string | null;
  supplierName: string | null;
}

async function main() {
  console.log('🚀 Starting Phase 2 Fabric Migration...\n');

  try {
    // Step 1: Get all existing style_fabrics
    const styleFabrics = await prisma.style_fabrics.findMany({
      include: {
        cad_averages: true,
      },
    });

    console.log(`📊 Found ${styleFabrics.length} style_fabrics records to migrate\n`);

    // Step 2: Extract unique fabric specifications
    const uniqueFabrics = new Map<string, FabricSpec>();

    for (const sf of styleFabrics) {
      if (!sf.fabricName) continue;

      const key = `${sf.fabricName}-${sf.fabricColor || 'no-color'}`;

      if (!uniqueFabrics.has(key)) {
        uniqueFabrics.set(key, {
          fabricName: sf.fabricName,
          fabricType: sf.fabricType,
          fabricColor: sf.fabricColor,
          fabricGSM: sf.fabricGSM,
          fabricWidth: sf.fabricWidth ? Number(sf.fabricWidth) : null,
          greigeName: sf.greigeName,
          supplierName: sf.supplierName,
        });
      }
    }

    console.log(`🎯 Identified ${uniqueFabrics.size} unique fabric specifications\n`);

    // Step 3: Get or create a default user for createdBy
    let defaultUser = await prisma.users.findFirst({
      where: { role: 'ADMIN' },
    });

    if (!defaultUser) {
      console.log('⚠️  No admin user found. Creating default migration user...');
      defaultUser = await prisma.users.create({
        data: {
          email: 'migration@system.local',
          password: 'temp-password-change-me',
          firstName: 'System',
          lastName: 'Migration',
          role: 'ADMIN',
          isActive: false, // Inactive account for migration only
        },
      });
      console.log('✅ Created migration user\n');
    }

    const userId = defaultUser.id;

    // Step 4: Create greige masters for unique base fabrics
    console.log('📦 Creating greige master records...');
    const greigeMap = new Map<string, string>(); // greigeName -> greigeId

    const uniqueGreiges = new Set(
      Array.from(uniqueFabrics.values())
        .map(f => f.greigeName)
        .filter(g => g && g.length > 0)
    );

    for (const greigeName of uniqueGreiges) {
      if (!greigeName) continue;

      // Check if greige already exists
      let greige = await prisma.greige_master.findFirst({
        where: { greigeName },
      });

      if (!greige) {
        // Create new greige master
        greige = await prisma.greige_master.create({
          data: {
            greigeCode: `GRG-MIG-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
            greigeName,
            composition: 'Migration - Update Required',
            greigeWidth: 58, // Default assumption, should be updated
            averageShrinkagePercent: 8, // Default 8%
            createdById: userId,
            isActive: true,
          },
        });
        console.log(`   ✅ Created greige: ${greigeName}`);
      }

      greigeMap.set(greigeName, greige.id);
    }

    console.log(`✅ Created/found ${greigeMap.size} greige master records\n`);

    // Step 5: Create fabric masters
    console.log('🎨 Creating fabric master records...');
    const fabricMap = new Map<string, string>(); // fabricName-color -> fabricId

    for (const [key, spec] of uniqueFabrics.entries()) {
      // Get greige ID
      const greigeId = spec.greigeName
        ? greigeMap.get(spec.greigeName)
        : null;

      if (!greigeId) {
        console.log(`   ⚠️  Skipping ${spec.fabricName} - no greige base found`);
        continue;
      }

      // Check if fabric already exists
      let fabric = await prisma.fabric_master.findFirst({
        where: {
          fabricName: spec.fabricName,
          colorName: spec.fabricColor || undefined,
        },
      });

      if (!fabric) {
        // Create new fabric master
        fabric = await prisma.fabric_master.create({
          data: {
            fabricCode: `FAB-MIG-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
            fabricName: spec.fabricName,
            greigeId,
            colorName: spec.fabricColor || null,
            finishType: spec.fabricType || 'solid',
            actualWidth: spec.fabricWidth || 58, // Default if not specified
            actualGSM: spec.fabricGSM ? parseInt(spec.fabricGSM) : null,
            costPerMeter: 5.00, // Default - should be updated
            createdById: userId,
            isActive: true,
          },
        });
        console.log(`   ✅ Created fabric: ${spec.fabricName} (${spec.fabricColor || 'no color'})`);
      }

      fabricMap.set(key, fabric.id);
    }

    console.log(`✅ Created/found ${fabricMap.size} fabric master records\n`);

    // Step 6: Migrate CAD averages to fabric_width_cad
    console.log('📏 Migrating CAD averages to fabric_width_cad...');
    let cadMigrationCount = 0;

    for (const sf of styleFabrics) {
      const key = `${sf.fabricName}-${sf.fabricColor || 'no-color'}`;
      const fabricId = fabricMap.get(key);

      if (!fabricId || !sf.cad_averages || sf.cad_averages.length === 0) continue;

      for (const cad of sf.cad_averages) {
        // Check if CAD already exists for this fabric-width combination
        const existingCad = await prisma.fabric_width_cad.findFirst({
          where: {
            fabricId,
            availableWidth: cad.fabric_width,
          },
        });

        if (!existingCad) {
          await prisma.fabric_width_cad.create({
            data: {
              fabricId,
              availableWidth: cad.fabric_width,
              cadMeters: cad.cad_average_meters || null,
              cadYards: cad.cad_average_yards || null,
              cadWastagePercent: cad.cad_wastage_percent || 5,
              markerEfficiency: cad.marker_efficiency || null,
              markerPlanFile: cad.marker_plan_file || null,
              isPreferred: cad.is_preferred || false,
              notes: cad.notes || null,
              createdById: userId,
            },
          });
          cadMigrationCount++;
        }
      }
    }

    console.log(`✅ Migrated ${cadMigrationCount} CAD records to fabric_width_cad\n`);

    // Step 7: Link style_fabrics to fabric_master
    console.log('🔗 Linking style_fabrics to fabric_master...');
    let linkCount = 0;

    for (const sf of styleFabrics) {
      const key = `${sf.fabricName}-${sf.fabricColor || 'no-color'}`;
      const fabricId = fabricMap.get(key);

      if (fabricId) {
        await prisma.style_fabrics.update({
          where: { id: sf.id },
          data: { fabricId },
        });
        linkCount++;
      }
    }

    console.log(`✅ Linked ${linkCount} style_fabrics to fabric masters\n`);

    // Step 8: Create materials entries for all fabrics
    console.log('📦 Creating materials entries for fabrics...');
    let materialsCount = 0;

    // Get or create FABRIC material category
    let fabricCategory = await prisma.material_categories.findFirst({
      where: { name: 'FABRIC' },
    });

    if (!fabricCategory) {
      fabricCategory = await prisma.material_categories.create({
        data: {
          id: `cat-fabric-${Date.now()}`,
          name: 'FABRIC',
          description: 'Fabrics and textile materials',
          level: 1,
        },
      });
      console.log('   ✅ Created FABRIC material category');
    }

    for (const [key, fabricId] of fabricMap.entries()) {
      const fabric = await prisma.fabric_master.findUnique({
        where: { id: fabricId },
        include: { greige: true },
      });

      if (!fabric) continue;

      // Check if material already exists
      const existingMaterial = await prisma.materials.findFirst({
        where: {
          materialType: 'FINISHED_FABRIC',
          fabricId,
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
            fabricId,
            unit: 'METER',
            costPrice: fabric.costPerMeter,
            reorderLevel: 200,
            isActive: true,
            updatedAt: new Date(),
          },
        });
        materialsCount++;
      }

      // Also create material for greige
      const existingGreigeMaterial = await prisma.materials.findFirst({
        where: {
          materialType: 'GREIGE_FABRIC',
          greigeId: fabric.greigeId,
        },
      });

      if (!existingGreigeMaterial && fabric.greige) {
        await prisma.materials.create({
          data: {
            id: `mat-${fabric.greige.greigeCode}-${Date.now()}`,
            code: fabric.greige.greigeCode,
            name: fabric.greige.greigeName,
            categoryId: fabricCategory.id,
            materialType: 'GREIGE_FABRIC',
            greigeId: fabric.greigeId,
            unit: 'METER',
            costPrice: fabric.greige.costPerMeter || 3.00,
            reorderLevel: 200,
            isActive: true,
            updatedAt: new Date(),
          },
        });
      }
    }

    console.log(`✅ Created ${materialsCount} materials entries\n`);

    // Summary
    console.log('📊 Migration Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Greige Masters Created: ${greigeMap.size}`);
    console.log(`✅ Fabric Masters Created: ${fabricMap.size}`);
    console.log(`✅ CAD Records Migrated: ${cadMigrationCount}`);
    console.log(`✅ Style Fabrics Linked: ${linkCount}`);
    console.log(`✅ Materials Created: ${materialsCount}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🎉 Phase 2 Migration Complete!\n');
    console.log('⚠️  IMPORTANT: Review migrated data and update:');
    console.log('   - Greige specifications (width, composition, shrinkage)');
    console.log('   - Fabric costs (currently set to defaults)');
    console.log('   - Supplier assignments');
    console.log('   - Material stock levels\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
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
