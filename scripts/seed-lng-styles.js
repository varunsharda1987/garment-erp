/**
 * Seed script: Replicate LNG470 style + CAD data to 27 other LNG styles
 *
 * For each style:
 * 1. Update style status → ACTIVE, cadStatus → APPROVED
 * 2. Add Poplin fabric to component (if missing)
 * 3. Add BOM items (Thread, Labels, Poly Bag) if missing
 * 4. Create fabric_width_cad record (RAW_MATERIAL_CALCULATION, 42" cutable, 16.2m CAD)
 * 5. Create 6 size breakdowns (S-XXXL, qty 1 each)
 * 6. Link fabric → CAD
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TARGET_CODES = [
  'LNG117','LNG134','LNG145','LNG111','LNG146Y','LNG135','LNG114','LNG146',
  'LNG009','LNG104','LNG027','LNG150','LNG147','LNG118','LNG106','LNG146B',
  'LNG110','LNG105','LNG108','LNG013','LNG008','LNG017','LNG137','LNG021',
  'LNG136','LNG016','LNG472'
];

// Reference IDs from LNG470
const GREIGE_ID = '63500570-0265-4e1e-8f1c-5cb4347a59ba';       // Poplin 40×40 / 88×66 / 48"
const PATTERN_PART_ID = 'da1a1841-451c-4d76-8106-8c47c44e6570'; // All Parts
const CREATED_BY_ID = '4fdefbd8-b4c6-494b-92a7-4421acbf3333';

// BOM items from LNG470
const BOM_TEMPLATE = [
  { materialType: 'THREAD', usageCategory: 'GARMENT_TRIM', componentName: 'Thread (Auto-added)', unit: 'lot', quantityPerGarment: '1', extraPercentage: '5', sortOrder: 0 },
  { materialType: 'LABEL', usageCategory: 'PACKAGING', componentName: 'Price Tag', unit: 'pcs', quantityPerGarment: '1', extraPercentage: '5', sortOrder: 1, labelId: '8102c7ed-9a43-4e2e-9678-add9923105c9' },
  { materialType: 'LABEL', usageCategory: 'PACKAGING', componentName: 'Washcare Label', unit: 'pcs', quantityPerGarment: '1', extraPercentage: '5', sortOrder: 2, labelId: '974f047c-dfb2-4b20-807c-a54d33181021' },
  { materialType: 'LABEL', usageCategory: 'PACKAGING', componentName: 'Size Label', unit: 'pcs', quantityPerGarment: '1', extraPercentage: '5', sortOrder: 3, labelId: '3f7505e4-6790-44d0-b484-d7eb615627e3' },
  { materialType: 'LABEL', usageCategory: 'PACKAGING', componentName: 'Main Label', unit: 'pcs', quantityPerGarment: '1', extraPercentage: '5', sortOrder: 4, labelId: 'e081edd4-0736-4add-b995-eaae49c20380' },
  { materialType: 'PACKAGING', usageCategory: 'PACKAGING', componentName: 'Poly Bag', unit: 'pcs', quantityPerGarment: '1', extraPercentage: '5', sortOrder: 5, packagingId: '75fa130b-fd0e-4bed-8c93-82cdf44c7036' },
];

async function main() {
  console.log('=== Seeding LNG Style + CAD Data ===\n');

  for (const code of TARGET_CODES) {
    console.log(`--- Processing ${code} ---`);

    const style = await prisma.styles.findFirst({
      where: { styleCode: code },
      select: {
        id: true, styleCode: true, status: true, cadStatus: true,
        style_components: {
          select: {
            id: true,
            style_fabrics: { select: { id: true, fabricCADId: true } }
          }
        },
        size_options: { select: { id: true, sizeName: true } },
        _count: { select: { style_material_bom: true, fabricWidthCadCostings: true } }
      }
    });

    if (!style) {
      console.log(`  SKIP: ${code} not found`);
      continue;
    }

    const component = style.style_components[0];
    if (!component) {
      console.log(`  SKIP: ${code} has no component`);
      continue;
    }

    // Build size map (only S through XXXL)
    const sizeMap = {};
    for (const so of style.size_options) {
      if (['S','M','L','XL','XXL','XXXL'].includes(so.sizeName)) {
        sizeMap[so.sizeName] = so.id;
      }
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update style status
      if (style.status !== 'ACTIVE' || style.cadStatus !== 'APPROVED') {
        await tx.styles.update({
          where: { id: style.id },
          data: {
            status: 'ACTIVE',
            cadStatus: 'APPROVED',
            accountingSKU: code,
            accountingUnit: 'Units',
          }
        });
        console.log(`  Updated status → ACTIVE, cadStatus → APPROVED`);
      } else {
        console.log(`  Status already ACTIVE/APPROVED`);
      }

      // 2. Add fabric if missing
      let fabricId;
      if (component.style_fabrics.length === 0) {
        const fabric = await tx.style_fabrics.create({
          data: {
            componentId: component.id,
            fabricName: 'Poplin',
            fabricType: 'GENERIC',
            fabricFinishType: 'PRINTED',
            genericGreigeName: 'Poplin',
            averagingMode: 'COMBINED',
            allowCombinedCutting: true,
            hasEmbroidery: false,
            quantityNeeded: 0,
          }
        });
        fabricId = fabric.id;
        console.log(`  Created fabric: ${fabricId}`);
      } else {
        fabricId = component.style_fabrics[0].id;
        console.log(`  Fabric exists: ${fabricId}`);
      }

      // 3. Add BOM if missing
      if (style._count.style_material_bom === 0) {
        for (const item of BOM_TEMPLATE) {
          await tx.style_material_bom.create({
            data: {
              styleId: style.id,
              materialType: item.materialType,
              usageCategory: item.usageCategory,
              componentName: item.componentName,
              unit: item.unit,
              quantityPerGarment: item.quantityPerGarment,
              extraPercentage: item.extraPercentage,
              sortOrder: item.sortOrder,
              ...(item.labelId ? { labelId: item.labelId } : {}),
              ...(item.packagingId ? { packagingId: item.packagingId } : {}),
            }
          });
        }
        console.log(`  Created 6 BOM items`);
      } else {
        console.log(`  BOM already exists (${style._count.style_material_bom} items)`);
      }

      // 4. Create CAD if no RAW_MATERIAL_CALCULATION CAD exists
      const existingCad = await tx.fabric_width_cad.findFirst({
        where: {
          costingStyleId: style.id,
          purpose: 'RAW_MATERIAL_CALCULATION',
          approvalStatus: 'APPROVED',
        }
      });

      if (!existingCad) {
        const now = new Date();
        const cad = await tx.fabric_width_cad.create({
          data: {
            costingStyleId: style.id,
            styleFabricId: fabricId,
            cutableWidth: 42,
            widthUnit: 'inches',
            cadMeters: 16.2,
            cadWastagePercent: 5,
            piecesPerMarker: 6,
            layerMarginMeters: 0.2,
            greigeId: GREIGE_ID,
            greigeCostPerMeter: 42,
            greigeRateSource: 'PROCUREMENT',
            greigeRateSourceDate: new Date('2026-01-11'),
            printDirection: 'TWO_WAY',
            purpose: 'RAW_MATERIAL_CALCULATION',
            approvalStatus: 'APPROVED',
            approvedAt: now,
            approvedBy: CREATED_BY_ID,
            cadAverage: 2.7333,
            patternPartId: PATTERN_PART_ID,
            createdById: CREATED_BY_ID,
            version: 1,
            isLocked: false,
            isCombinedCutting: false,
            isEmbroidery: false,
            costInputMode: 'AUTO_CALCULATED',
            varianceApprovalStatus: 'NOT_REQUIRED',
          }
        });
        console.log(`  Created CAD: ${cad.id}`);

        // 5. Create size breakdowns
        const sizeNames = ['S','M','L','XL','XXL','XXXL'];
        for (const sizeName of sizeNames) {
          if (sizeMap[sizeName]) {
            await tx.cad_size_breakdown.create({
              data: {
                cadId: cad.id,
                sizeName: sizeName,
                sizeId: sizeMap[sizeName],
                quantity: 1,
              }
            });
          }
        }
        console.log(`  Created ${Object.keys(sizeMap).length} size breakdowns`);

        // 6. Link fabric → CAD
        await tx.style_fabrics.update({
          where: { id: fabricId },
          data: { fabricCADId: cad.id }
        });
        console.log(`  Linked fabric → CAD`);
      } else {
        console.log(`  CAD already exists: ${existingCad.id}`);
        // Still link fabric if not linked
        if (!component.style_fabrics[0]?.fabricCADId) {
          await tx.style_fabrics.update({
            where: { id: fabricId },
            data: { fabricCADId: existingCad.id }
          });
          console.log(`  Linked fabric → existing CAD`);
        }
      }
    });

    console.log(`  ✓ ${code} done\n`);
  }

  console.log('=== COMPLETE ===');
}

main()
  .catch(e => { console.error('FATAL:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
