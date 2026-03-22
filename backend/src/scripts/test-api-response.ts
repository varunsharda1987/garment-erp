/**
 * Test script to check what the API returns for customers
 */

import prisma from '../config/database';

async function testApiResponse() {
  console.log('🔍 Testing what data is returned by getAllCustomers API...\n');

  try {
    // Simulate what the getAllCustomers API does
    const customers = await prisma.customers.findMany({
      where: { isActive: true },
      take: 10,
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        brand_categories: true,
        customer_gst_numbers: true,
        _count: {
          select: {
            orders: true,
            quotations: true,
            invoices: true,
          },
        },
      },
    });

    // Find the Kasya customer
    const kasyaCustomer = customers.find((c) => c.name.includes('Kasya'));

    if (kasyaCustomer) {
      console.log('✅ Found customer:', kasyaCustomer.name);
      console.log('\n📋 Customer Details:');
      console.log('ID:', kasyaCustomer.id);
      console.log('Code:', kasyaCustomer.code);
      console.log('BrandNames (old field):', kasyaCustomer.brandNames);
      console.log('\n📦 Brand Categories (NEW format):');
      console.log('Count:', kasyaCustomer.brand_categories?.length || 0);

      if (kasyaCustomer.brand_categories && kasyaCustomer.brand_categories.length > 0) {
        console.log('\nDetails:');
        kasyaCustomer.brand_categories.forEach((bc, index) => {
          console.log(`  ${index + 1}. Brand: "${bc.brandName}" → Category: "${bc.category}"`);
        });
      } else {
        console.log('⚠️  NO brand_categories found!');
      }

      // Check what the API would actually send
      console.log('\n📤 What the API sends to frontend:');
      console.log(JSON.stringify(kasyaCustomer, null, 2));
    } else {
      console.log('❌ Customer with "Kasya" not found');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testApiResponse();
