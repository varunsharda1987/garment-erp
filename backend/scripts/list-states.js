const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listStates() {
  try {
    const states = await prisma.indian_states.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        stateName: true,
        stateCode: true,
        stateType: true,
      },
    });

    console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║        Indian States/UTs with GST Codes                             ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

    console.log('📍 MAJOR STATES:\n');
    const majorStates = states.filter(s => s.stateType === 'STATE');
    majorStates.forEach(s => {
      console.log(`  ${s.stateCode} - ${s.stateName.padEnd(25)} ID: ${s.id}`);
    });

    console.log('\n📍 UNION TERRITORIES:\n');
    const unionTerritories = states.filter(s => s.stateType === 'UNION_TERRITORY');
    unionTerritories.forEach(s => {
      console.log(`  ${s.stateCode} - ${s.stateName.padEnd(25)} ID: ${s.id}`);
    });

    console.log('\n' + '─'.repeat(70));
    console.log(`Total States: ${majorStates.length} | Total UTs: ${unionTerritories.length} | Total: ${states.length}`);
    console.log('─'.repeat(70) + '\n');

    console.log('💡 NEXT STEP:');
    console.log('   1. Find your company\'s registered state from the list above');
    console.log('   2. Copy the ID (UUID)');
    console.log('   3. Update backend/.env with: COMPANY_STATE_ID="<paste-id-here>"');
    console.log('   4. Restart the backend server\n');

    console.log('📌 POPULAR GARMENT MANUFACTURING STATES:\n');
    const garmentStates = ['Tamil Nadu', 'Maharashtra', 'Gujarat', 'Karnataka', 'Delhi', 'Haryana', 'Uttar Pradesh'];
    garmentStates.forEach(stateName => {
      const state = states.find(s => s.stateName === stateName);
      if (state) {
        console.log(`  ⭐ ${state.stateCode} - ${state.stateName.padEnd(25)} ID: ${state.id}`);
      }
    });

    console.log('\n');
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fetching states:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

listStates();
