const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
  // Check for Cotton Flex fabric
  const cottonFlex = await p.fabric_master.findFirst({
    where: {
      OR: [
        { fabricName: { contains: 'Cotton Flex', mode: 'insensitive' } },
        { fabricCode: { contains: 'COTTON', mode: 'insensitive' } }
      ]
    }
  });
  console.log('Cotton Flex fabric:', cottonFlex ? { id: cottonFlex.id, code: cottonFlex.fabricCode, name: cottonFlex.fabricName } : 'NOT FOUND');

  if (cottonFlex) {
    const mat = await p.materials.findFirst({ where: { fabricId: cottonFlex.id }});
    console.log('  -> Materials record:', mat ? mat.id : 'NOT FOUND');
  }

  // Check for Galaxy 4-Hole Button
  const button = await p.button_master.findFirst({
    where: {
      OR: [
        { buttonName: { contains: 'Galaxy', mode: 'insensitive' } },
        { buttonCode: { contains: 'BTN', mode: 'insensitive' } }
      ]
    }
  });
  console.log('Galaxy Button:', button ? { id: button.id, code: button.buttonCode, name: button.buttonName } : 'NOT FOUND');

  if (button) {
    const mat = await p.materials.findFirst({ where: { buttonId: button.id }});
    console.log('  -> Materials record:', mat ? mat.id : 'NOT FOUND');
  }

  // Check all materials
  console.log('\n--- All Materials with FABRIC type ---');
  const fabMats = await p.materials.findMany({ where: { materialType: 'FABRIC' }, take: 10 });
  fabMats.forEach(m => console.log('  ', m.id, '|', m.code, '|', m.name, '| fabricId:', m.fabricId));

  console.log('\n--- All Materials with BUTTON type ---');
  const btnMats = await p.materials.findMany({ where: { materialType: 'BUTTON' }, take: 10 });
  btnMats.forEach(m => console.log('  ', m.id, '|', m.code, '|', m.name, '| buttonId:', m.buttonId));
}

check().catch(console.error).finally(() => p.$disconnect());
