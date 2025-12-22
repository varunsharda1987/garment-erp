const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifySetup() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║           GST Implementation - Setup Verification                    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  try {
    // Check states
    const statesCount = await prisma.indian_states.count();
    const statesCheck = statesCount === 36;
    console.log(`✓ States: ${statesCount}/36 ${statesCheck ? '✅' : '❌'}`);

    // Check cities
    const citiesCount = await prisma.indian_cities.count();
    const citiesCheck = citiesCount >= 133;
    console.log(`✓ Cities: ${citiesCount}/133 ${citiesCheck ? '✅' : '❌'}`);

    // Check cities per state
    const citiesPerState = await prisma.indian_cities.groupBy({
      by: ['stateId'],
    });
    console.log(`✓ Cities Distribution: ${citiesPerState.length} states have cities ${citiesPerState.length > 0 ? '✅' : '❌'}`);

    // Check environment variable
    const companyStateId = process.env.COMPANY_STATE_ID;
    const envCheck = companyStateId && companyStateId !== 'YOUR_STATE_ID_HERE';
    console.log(`✓ COMPANY_STATE_ID: ${envCheck ? 'Set ✅' : 'Not set ❌'}`);

    if (envCheck) {
      // Verify the state ID exists
      const state = await prisma.indian_states.findUnique({
        where: { id: companyStateId },
      });
      if (state) {
        console.log(`  → Configured for: ${state.stateName} (GST Code: ${state.stateCode})`);
      } else {
        console.log(`  → ⚠️  Warning: State ID not found in database`);
      }
    } else {
      console.log('  → ⚠️  Set this in backend/.env to enable automatic tax calculation');
    }

    console.log('\n' + '─'.repeat(70));

    // Show some sample data
    console.log('\n📊 SAMPLE DATA:\n');

    // Top cities
    const topCities = await prisma.indian_cities.findMany({
      where: { tier: 'TIER_1' },
      include: { state: true },
      take: 5,
      orderBy: { sortOrder: 'asc' },
    });

    console.log('Sample Tier 1 Cities:');
    topCities.forEach(city => {
      console.log(`  • ${city.cityName}, ${city.state.stateName} (${city.tier})`);
    });

    // State statistics
    const statesWithCities = await prisma.indian_states.findMany({
      include: {
        _count: {
          select: { cities: true },
        },
      },
      orderBy: {
        cities: {
          _count: 'desc',
        },
      },
      take: 5,
    });

    console.log('\nStates with Most Cities:');
    statesWithCities.forEach(state => {
      console.log(`  • ${state.stateName}: ${state._count.cities} cities`);
    });

    console.log('\n' + '─'.repeat(70));
    console.log('\n✅ SETUP STATUS:\n');

    const allChecks = statesCheck && citiesCheck && envCheck;

    if (allChecks) {
      console.log('🎉 All checks passed! GST system is ready to use.\n');
      console.log('NEXT STEPS:');
      console.log('  1. Start backend: cd backend && npm run dev');
      console.log('  2. Start frontend: cd frontend && npm run dev');
      console.log('  3. Test APIs: See docs/GST_QUICK_START.md');
      console.log('  4. Integrate forms: See docs/GST_IMPLEMENTATION_GUIDE.md\n');
    } else {
      console.log('⚠️  Some checks failed. Please review the items marked with ❌ above.\n');

      if (!statesCheck) {
        console.log('To fix states: cd backend && npx prisma db seed');
      }
      if (!envCheck) {
        console.log('To fix COMPANY_STATE_ID:');
        console.log('  1. Run: node scripts/list-states.js');
        console.log('  2. Copy your state ID');
        console.log('  3. Update backend/.env with COMPANY_STATE_ID="<paste-id>"');
      }
      console.log('');
    }

    await prisma.$disconnect();
    process.exit(allChecks ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Error during verification:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

verifySetup();
