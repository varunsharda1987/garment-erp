const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedFabricGreigeData() {
  try {
    console.log('🌱 Starting fabric and greige data seeding...\n');

    // Get a default user for createdBy fields
    const defaultUser = await prisma.users.findFirst({
      where: { role: 'ADMIN' }
    });

    if (!defaultUser) {
      throw new Error('No admin user found. Please create a user first.');
    }

    // Get suppliers (optional)
    const suppliers = await prisma.suppliers.findMany({ take: 3 });
    const supplierId = suppliers.length > 0 ? suppliers[0].id : null;

    console.log('✓ Found default user and suppliers\n');

    // ============================================
    // 1. Create Greige Masters
    // ============================================
    console.log('Creating greige masters...');

    const greige1 = await prisma.greige_master.create({
      data: {
        greigeCode: 'GR-001-COTTON-POPLIN',
        greigeName: 'Cotton Poplin Greige 60"',
        yarnCount: '40x40',
        construction: '133x72',
        composition: '100% Cotton',
        weaveType: 'Plain',
        greigeWidth: 60.0,
        expectedFinishedWidthMin: 54.0,
        expectedFinishedWidthMax: 58.0,
        averageShrinkagePercent: 8.0,
        supplierId: supplierId,
        gsmRange: '120-130',
        costPerMeter: 2.50,
        moq: 1000,
        leadTimeDays: 15,
        description: 'High-quality cotton poplin greige, suitable for shirts and light garments',
        isActive: true,
        createdById: defaultUser.id,
      },
    });
    console.log('  ✓ Created:', greige1.greigeCode);

    const greige2 = await prisma.greige_master.create({
      data: {
        greigeCode: 'GR-002-POLYESTER-TWILL',
        greigeName: 'Polyester Twill Greige 58"',
        yarnCount: '75D x 150D',
        construction: '110x76',
        composition: '100% Polyester',
        weaveType: 'Twill',
        greigeWidth: 58.0,
        expectedFinishedWidthMin: 54.0,
        expectedFinishedWidthMax: 56.0,
        averageShrinkagePercent: 5.0,
        supplierId: supplierId,
        gsmRange: '150-160',
        costPerMeter: 3.20,
        moq: 800,
        leadTimeDays: 20,
        description: 'Durable polyester twill greige for pants and jackets',
        isActive: true,
        createdById: defaultUser.id,
      },
    });
    console.log('  ✓ Created:', greige2.greigeCode);

    const greige3 = await prisma.greige_master.create({
      data: {
        greigeCode: 'GR-003-BLEND-JERSEY',
        greigeName: 'Cotton-Polyester Jersey Greige 72"',
        yarnCount: '30s',
        construction: 'Single Jersey',
        composition: '65% Polyester, 35% Cotton',
        weaveType: 'Knit',
        greigeWidth: 72.0,
        expectedFinishedWidthMin: 60.0,
        expectedFinishedWidthMax: 66.0,
        averageShrinkagePercent: 10.0,
        supplierId: supplierId,
        gsmRange: '160-180',
        costPerMeter: 2.80,
        moq: 500,
        leadTimeDays: 12,
        description: 'Comfortable blend jersey for t-shirts and casual wear',
        isActive: true,
        createdById: defaultUser.id,
      },
    });
    console.log('  ✓ Created:', greige3.greigeCode);

    const greige4 = await prisma.greige_master.create({
      data: {
        greigeCode: 'GR-004-COTTON-DENIM',
        greigeName: 'Cotton Denim Greige 60"',
        yarnCount: '10x7',
        construction: '72x44',
        composition: '100% Cotton',
        weaveType: 'Twill (3/1)',
        greigeWidth: 60.0,
        expectedFinishedWidthMin: 54.0,
        expectedFinishedWidthMax: 58.0,
        averageShrinkagePercent: 8.0,
        supplierId: supplierId,
        gsmRange: '300-350',
        costPerMeter: 4.50,
        moq: 1500,
        leadTimeDays: 25,
        description: 'Heavy-duty denim greige for jeans and workwear',
        isActive: true,
        createdById: defaultUser.id,
      },
    });
    console.log('  ✓ Created:', greige4.greigeCode);

    console.log('\n✓ Created 4 greige masters\n');

    // ============================================
    // 2. Create Fabric Masters (Finished Fabrics)
    // ============================================
    console.log('Creating fabric masters (finished fabrics)...');

    // Fabric 1: Navy Poplin from Greige 1
    const fabric1 = await prisma.fabric_master.create({
      data: {
        fabricCode: 'FAB-001-NAVY-POPLIN',
        fabricName: 'Navy Blue Solid Poplin',
        greigeId: greige1.id,
        colorName: 'Navy Blue',
        colorCode: 'PANTONE 19-4028',
        finishType: 'Dyed',
        finishProcess: 'Sanforized, Mercerized',
        actualWidth: 54.0,
        actualGSM: 125,
        actualShrinkage: 10.0,  // (60 - 54) / 60 * 100 = 10%
        supplierId: supplierId,
        costPerMeter: 4.20,
        moq: 500,
        leadTimeDays: 18,
        description: 'Premium navy poplin for formal shirts',
        isActive: true,
        createdById: defaultUser.id,
      },
    });
    console.log('  ✓ Created:', fabric1.fabricCode);

    // Fabric 2: White Poplin from Greige 1
    const fabric2 = await prisma.fabric_master.create({
      data: {
        fabricCode: 'FAB-002-WHITE-POPLIN',
        fabricName: 'Optical White Poplin',
        greigeId: greige1.id,
        colorName: 'Optical White',
        colorCode: 'PANTONE 11-0601',
        finishType: 'Dyed',
        finishProcess: 'Sanforized, Optical Brightened',
        actualWidth: 58.0,
        actualGSM: 128,
        actualShrinkage: 3.3,  // (60 - 58) / 60 * 100 = 3.3%
        supplierId: supplierId,
        costPerMeter: 4.50,
        moq: 500,
        leadTimeDays: 18,
        description: 'Crisp white poplin for dress shirts',
        isActive: true,
        createdById: defaultUser.id,
      },
    });
    console.log('  ✓ Created:', fabric2.fabricCode);

    // Fabric 3: Black Twill from Greige 2
    const fabric3 = await prisma.fabric_master.create({
      data: {
        fabricCode: 'FAB-003-BLACK-TWILL',
        fabricName: 'Jet Black Polyester Twill',
        greigeId: greige2.id,
        colorName: 'Jet Black',
        colorCode: 'PANTONE 19-0303',
        finishType: 'Dyed',
        finishProcess: 'Disperse Dyed, Heat Set',
        actualWidth: 54.0,
        actualGSM: 155,
        actualShrinkage: 6.9,  // (58 - 54) / 58 * 100 = 6.9%
        supplierId: supplierId,
        costPerMeter: 5.80,
        moq: 400,
        leadTimeDays: 22,
        description: 'Professional black twill for pants and uniforms',
        isActive: true,
        createdById: defaultUser.id,
      },
    });
    console.log('  ✓ Created:', fabric3.fabricCode);

    // Fabric 4: Red Jersey from Greige 3
    const fabric4 = await prisma.fabric_master.create({
      data: {
        fabricCode: 'FAB-004-RED-JERSEY',
        fabricName: 'Cherry Red Jersey Knit',
        greigeId: greige3.id,
        colorName: 'Cherry Red',
        colorCode: 'PANTONE 18-1664',
        finishType: 'Dyed',
        finishProcess: 'Reactive Dyed, Softened',
        actualWidth: 60.0,
        actualGSM: 170,
        actualShrinkage: 16.7,  // (72 - 60) / 72 * 100 = 16.7%
        supplierId: supplierId,
        costPerMeter: 4.50,
        moq: 300,
        leadTimeDays: 15,
        description: 'Soft jersey for t-shirts and activewear',
        isActive: true,
        createdById: defaultUser.id,
      },
    });
    console.log('  ✓ Created:', fabric4.fabricCode);

    // Fabric 5: Indigo Denim from Greige 4
    const fabric5 = await prisma.fabric_master.create({
      data: {
        fabricCode: 'FAB-005-INDIGO-DENIM',
        fabricName: 'Classic Indigo Denim 12oz',
        greigeId: greige4.id,
        colorName: 'Indigo Blue',
        colorCode: 'Classic Indigo',
        finishType: 'Dyed',
        finishProcess: 'Rope Dyed, Sanforized',
        actualWidth: 58.0,
        actualGSM: 340,
        actualShrinkage: 3.3,  // (60 - 58) / 60 * 100 = 3.3%
        supplierId: supplierId,
        costPerMeter: 7.20,
        moq: 800,
        leadTimeDays: 28,
        description: 'Traditional indigo denim for premium jeans',
        isActive: true,
        createdById: defaultUser.id,
      },
    });
    console.log('  ✓ Created:', fabric5.fabricCode);

    console.log('\n✓ Created 5 fabric masters\n');

    // ============================================
    // 3. Create Fabric Width CAD Entries
    // ============================================
    console.log('Creating fabric width CAD entries...');

    // CAD for Fabric 1 (Navy Poplin) - 54" width
    await prisma.fabric_width_cad.create({
      data: {
        fabricId: fabric1.id,
        availableWidth: 54.0,
        cadMeters: 2.300,
        cadYards: 2.515,
        cadWastagePercent: 5.0,
        markerEfficiency: 88.5,
        isPreferred: true,
        supplierAvailability: 'Readily Available',
        notes: 'Standard width with optimal marker efficiency',
        createdById: defaultUser.id,
      },
    });

    // CAD for Fabric 2 (White Poplin) - 58" width
    await prisma.fabric_width_cad.create({
      data: {
        fabricId: fabric2.id,
        availableWidth: 58.0,
        cadMeters: 2.150,
        cadYards: 2.352,
        cadWastagePercent: 4.0,
        markerEfficiency: 92.0,
        isPreferred: true,
        supplierAvailability: 'Readily Available',
        notes: 'Wider width allows better marker efficiency',
        createdById: defaultUser.id,
      },
    });

    // CAD for Fabric 3 (Black Twill) - 54" width
    await prisma.fabric_width_cad.create({
      data: {
        fabricId: fabric3.id,
        availableWidth: 54.0,
        cadMeters: 1.850,
        cadYards: 2.023,
        cadWastagePercent: 6.0,
        markerEfficiency: 85.0,
        isPreferred: true,
        supplierAvailability: 'Readily Available',
        notes: 'Standard width for pant production',
        createdById: defaultUser.id,
      },
    });

    // CAD for Fabric 4 (Red Jersey) - 60" width
    const cad4a = await prisma.fabric_width_cad.create({
      data: {
        fabricId: fabric4.id,
        availableWidth: 60.0,
        cadMeters: 0.850,
        cadYards: 0.930,
        cadWastagePercent: 5.0,
        markerEfficiency: 90.0,
        isPreferred: true,
        supplierAvailability: 'Readily Available',
        notes: 'Most economical width for t-shirts',
        createdById: defaultUser.id,
      },
    });

    // Alternative width for Jersey
    const cad4b = await prisma.fabric_width_cad.create({
      data: {
        fabricId: fabric4.id,
        availableWidth: 72.0,
        cadMeters: 0.780,
        cadYards: 0.853,
        cadWastagePercent: 4.0,
        markerEfficiency: 93.0,
        isPreferred: false,
        supplierAvailability: '2-week lead time',
        priceDifferential: 0.30,
        notes: 'Extra wide width - lower CAD but higher cost per meter',
        createdById: defaultUser.id,
      },
    });

    // CAD for Fabric 5 (Indigo Denim) - 58" width
    await prisma.fabric_width_cad.create({
      data: {
        fabricId: fabric5.id,
        availableWidth: 58.0,
        cadMeters: 1.650,
        cadYards: 1.805,
        cadWastagePercent: 8.0,
        markerEfficiency: 82.0,
        isPreferred: true,
        supplierAvailability: 'Readily Available',
        notes: 'Standard denim width for 5-pocket jeans',
        createdById: defaultUser.id,
      },
    });

    console.log('  ✓ Created 6 fabric width CAD entries');
    console.log('    - Including comparison widths for Red Jersey (60" vs 72")\n');

    // ============================================
    // Summary
    // ============================================
    console.log('═══════════════════════════════════════════════');
    console.log('✓ Seed data creation completed successfully!');
    console.log('═══════════════════════════════════════════════');
    console.log('Created:');
    console.log('  • 4 Greige Masters');
    console.log('  • 5 Fabric Masters (finished fabrics)');
    console.log('  • 6 CAD Width Entries');
    console.log('\nSample Data Overview:');
    console.log('  - Cotton Poplin (Navy & White)');
    console.log('  - Polyester Twill (Black)');
    console.log('  - Jersey Knit (Red) with comparison widths');
    console.log('  - Denim (Indigo)');
    console.log('═══════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Error seeding data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedFabricGreigeData()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
