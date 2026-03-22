import prisma from '../config/database';

async function verifyCustomerCodes() {
  try {
    const customers = await prisma.customers.findMany({
      select: {
        code: true,
        name: true,
        businessType: true,
        market: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    console.log('\n=== CUSTOMER CODES (Alphabetically Sorted) ===\n');
    console.log('Code                      | Name                           | Type      ');
    console.log('--------------------------|--------------------------------|-----------');

    customers.forEach((c) => {
      const marketCode = c.market === 'INTERNATIONAL' ? 'INT' : 'DOM';
      console.log(`${c.code.padEnd(25)} | ${c.name.substring(0, 30).padEnd(30)} | ${c.businessType}-${marketCode}`);
    });

    console.log('\n==============================================\n');
    console.log(`Total customers: ${customers.length}`);

    // Group by type
    const grouped = customers.reduce(
      (acc, c) => {
        const marketCode = c.market === 'INTERNATIONAL' ? 'INT' : 'DOM';
        const key = `${c.businessType}-${marketCode}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    console.log('\nCustomers by category:');
    for (const [category, count] of Object.entries(grouped)) {
      console.log(`  ${category}: ${count}`);
    }
    console.log('');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

verifyCustomerCodes();
