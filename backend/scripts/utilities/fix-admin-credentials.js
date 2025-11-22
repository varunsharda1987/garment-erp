const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// SINGLE SOURCE OF TRUTH FOR ADMIN CREDENTIALS
const ADMIN_CREDENTIALS = {
  email: 'admin@kashaya.com',
  password: 'admin123',
  firstName: 'Admin',
  lastName: 'User',
  role: 'ADMIN'
};

async function fixAdminCredentials() {
  try {
    console.log('\n🔧 FIXING ADMIN CREDENTIALS - PERMANENT FIX\n');
    console.log('========================================\n');

    // Find any existing admin user
    const existingAdmin = await prisma.users.findFirst({
      where: { role: 'ADMIN' }
    });

    const hashedPassword = await bcrypt.hash(ADMIN_CREDENTIALS.password, 10);

    if (existingAdmin) {
      console.log('📝 Found existing admin:', existingAdmin.email);
      console.log('   Updating to standard credentials...\n');

      await prisma.users.update({
        where: { id: existingAdmin.id },
        data: {
          email: ADMIN_CREDENTIALS.email,
          password: hashedPassword,
          firstName: ADMIN_CREDENTIALS.firstName,
          lastName: ADMIN_CREDENTIALS.lastName,
          role: ADMIN_CREDENTIALS.role,
          isActive: true
        }
      });

      console.log('✅ Admin credentials UPDATED!\n');
    } else {
      console.log('📝 No admin found. Creating new admin...\n');

      await prisma.users.create({
        data: {
          email: ADMIN_CREDENTIALS.email,
          password: hashedPassword,
          firstName: ADMIN_CREDENTIALS.firstName,
          lastName: ADMIN_CREDENTIALS.lastName,
          role: ADMIN_CREDENTIALS.role,
          isActive: true
        }
      });

      console.log('✅ Admin user CREATED!\n');
    }

    console.log('========================================');
    console.log('🎉 ADMIN CREDENTIALS (PERMANENT)');
    console.log('========================================');
    console.log('Email:    ', ADMIN_CREDENTIALS.email);
    console.log('Password: ', ADMIN_CREDENTIALS.password);
    console.log('========================================');
    console.log('\n💡 Run this script anytime with:');
    console.log('   npm run fix-admin\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixAdminCredentials();
