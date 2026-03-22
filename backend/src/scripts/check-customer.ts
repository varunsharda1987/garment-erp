import prisma from '../config/database';

async function checkCustomer() {
  const customers = await prisma.customers.findMany({
    where: {
      OR: [{ name: { contains: 'Kaaya', mode: 'insensitive' } }, { name: { contains: 'Kasya', mode: 'insensitive' } }],
    },
    include: {
      brand_categories: true,
    },
  });

  console.log('\n📋 Customers matching search:\n');

  customers.forEach((c) => {
    console.log('════════════════════════════════════════');
    console.log('Name:', c.name);
    console.log('Code:', c.code);
    console.log('BrandNames (old):', c.brandNames);
    console.log('Categories (old):', c.categories);
    console.log('Brand Categories (new):', c.brand_categories.length, 'entries');

    if (c.brand_categories.length > 0) {
      console.log('\nBrand-Category Mappings:');
      c.brand_categories.forEach((bc) => {
        console.log(`  • ${bc.brandName} → ${bc.category}`);
      });
    } else {
      console.log('\n⚠️  NO brand_categories found!');
    }
    console.log('════════════════════════════════════════\n');
  });

  await prisma.$disconnect();
}

checkCustomer();
