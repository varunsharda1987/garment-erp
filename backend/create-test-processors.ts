import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestProcessors() {
  try {
    console.log('Creating test processors...\n');

    // Get admin user for createdById
    const adminUser = await prisma.users.findFirst({
      where: { role: 'ADMIN' }
    });

    if (!adminUser) {
      console.error('❌ No admin user found. Please create an admin user first.');
      return;
    }

    console.log(`Using admin user: ${adminUser.email}\n`);

    const testProcessors = [
      {
        name: 'ABC Dyeing Mill',
        code: 'PROC001',
        supplierCategories: ['DYEING_PRINTING'],
        contactPerson: 'Mr. Sharma',
        phone: '9876543210',
        email: 'abc.dyeing@example.com',
        address: '123 Industrial Area, City',
        isActive: true
      },
      {
        name: 'XYZ Washing Unit',
        code: 'PROC002',
        supplierCategories: ['WASHING'],
        contactPerson: 'Mr. Patel',
        phone: '9876543211',
        email: 'xyz.washing@example.com',
        address: '456 Processing Zone, City',
        isActive: true
      },
      {
        name: 'Premier Finishers',
        code: 'PROC003',
        supplierCategories: ['FINISHING_CONTRACTOR'],
        contactPerson: 'Ms. Gupta',
        phone: '9876543212',
        email: 'premier.finishing@example.com',
        address: '789 Textile Park, City',
        isActive: true
      },
      {
        name: 'Elite Embroidery Works',
        code: 'PROC004',
        supplierCategories: ['EMBROIDERY'],
        contactPerson: 'Mr. Khan',
        phone: '9876543213',
        email: 'elite.embroidery@example.com',
        address: '321 Craft Center, City',
        isActive: true
      },
      {
        name: 'Premium Dyeing & Printing',
        code: 'PROC005',
        supplierCategories: ['DYEING_PRINTING'],
        contactPerson: 'Mrs. Singh',
        phone: '9876543214',
        email: 'premium.dyeing@example.com',
        address: '654 Color Hub, City',
        isActive: true
      }
    ];

    for (const processor of testProcessors) {
      // Check if processor already exists
      const existing = await prisma.suppliers.findFirst({
        where: {
          name: processor.name
        }
      });

      if (existing) {
        console.log(`⚠️  Skipped: ${processor.name} (already exists)`);
        continue;
      }

      const created = await prisma.suppliers.create({
        data: {
          ...processor,
          createdById: adminUser.id
        }
      });

      console.log(`✅ Created: ${created.name} (${created.supplierCategories.join(', ')})`);
    }

    console.log('\n✨ Test processors setup complete!');
    console.log('\nNext steps:');
    console.log('1. Navigate to http://localhost:5173/processor-rate-cards');
    console.log('2. Create rate cards for these processors');
    console.log('3. Test fabric costing at http://localhost:5173/fabric-costing\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestProcessors();
