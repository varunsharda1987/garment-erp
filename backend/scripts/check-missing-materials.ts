// Check how many master records are missing corresponding materials records
import prisma from '../src/config/database';

async function checkMissingMaterials() {
  console.log('=== Master Records Missing Materials Records ===\n');

  // Greige
  const greigeTotal = await prisma.greige_master.count();
  const greigeWithMaterial = await prisma.materials.count({ where: { greigeId: { not: null } } });
  console.log(`Greige Master:  ${greigeTotal} total, ${greigeWithMaterial} have materials, ${greigeTotal - greigeWithMaterial} MISSING`);

  // Fabric
  const fabricTotal = await prisma.fabric_master.count();
  const fabricWithMaterial = await prisma.materials.count({ where: { fabricId: { not: null } } });
  console.log(`Fabric Master:  ${fabricTotal} total, ${fabricWithMaterial} have materials, ${fabricTotal - fabricWithMaterial} MISSING`);

  // Lace
  const laceTotal = await prisma.lace_master.count();
  const laceWithMaterial = await prisma.materials.count({ where: { laceId: { not: null } } });
  console.log(`Lace Master:    ${laceTotal} total, ${laceWithMaterial} have materials, ${laceTotal - laceWithMaterial} MISSING`);

  // Thread
  const threadTotal = await prisma.thread_master.count();
  const threadWithMaterial = await prisma.materials.count({ where: { threadId: { not: null } } });
  console.log(`Thread Master:  ${threadTotal} total, ${threadWithMaterial} have materials, ${threadTotal - threadWithMaterial} MISSING`);

  // Button
  const buttonTotal = await prisma.button_master.count();
  const buttonWithMaterial = await prisma.materials.count({ where: { buttonId: { not: null } } });
  console.log(`Button Master:  ${buttonTotal} total, ${buttonWithMaterial} have materials, ${buttonTotal - buttonWithMaterial} MISSING`);

  // Zipper
  const zipperTotal = await prisma.zipper_master.count();
  const zipperWithMaterial = await prisma.materials.count({ where: { zipperId: { not: null } } });
  console.log(`Zipper Master:  ${zipperTotal} total, ${zipperWithMaterial} have materials, ${zipperTotal - zipperWithMaterial} MISSING`);

  // Elastic
  const elasticTotal = await prisma.elastic_master.count();
  const elasticWithMaterial = await prisma.materials.count({ where: { elasticId: { not: null } } });
  console.log(`Elastic Master: ${elasticTotal} total, ${elasticWithMaterial} have materials, ${elasticTotal - elasticWithMaterial} MISSING`);

  // Label
  const labelTotal = await prisma.label_master.count();
  const labelWithMaterial = await prisma.materials.count({ where: { labelId: { not: null } } });
  console.log(`Label Master:   ${labelTotal} total, ${labelWithMaterial} have materials, ${labelTotal - labelWithMaterial} MISSING`);

  // Packaging
  const packagingTotal = await prisma.packaging_master.count();
  const packagingWithMaterial = await prisma.materials.count({ where: { packagingId: { not: null } } });
  console.log(`Packaging:      ${packagingTotal} total, ${packagingWithMaterial} have materials, ${packagingTotal - packagingWithMaterial} MISSING`);

  // Machine Part
  const machinePartTotal = await prisma.machine_part_master.count();
  const machinePartWithMaterial = await prisma.materials.count({ where: { machinePartId: { not: null } } });
  console.log(`Machine Part:   ${machinePartTotal} total, ${machinePartWithMaterial} have materials, ${machinePartTotal - machinePartWithMaterial} MISSING`);

  // Other Material
  const otherTotal = await prisma.other_material_master.count();
  const otherWithMaterial = await prisma.materials.count({ where: { otherMaterialId: { not: null } } });
  console.log(`Other Material: ${otherTotal} total, ${otherWithMaterial} have materials, ${otherTotal - otherWithMaterial} MISSING`);

  // Summary
  const totalMasters = greigeTotal + fabricTotal + laceTotal + threadTotal + buttonTotal +
                       zipperTotal + elasticTotal + labelTotal + packagingTotal + machinePartTotal + otherTotal;
  const totalWithMaterials = greigeWithMaterial + fabricWithMaterial + laceWithMaterial + threadWithMaterial +
                             buttonWithMaterial + zipperWithMaterial + elasticWithMaterial + labelWithMaterial +
                             packagingWithMaterial + machinePartWithMaterial + otherWithMaterial;

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total master records: ${totalMasters}`);
  console.log(`Have materials records: ${totalWithMaterials}`);
  console.log(`MISSING materials records: ${totalMasters - totalWithMaterials}`);

  await prisma.$disconnect();
}

checkMissingMaterials().catch(console.error);
