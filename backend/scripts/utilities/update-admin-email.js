const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateEmail() {
  try {
    console.log('📧 Updating Admin Email...\n');

    // Find current admin user
    const adminUser = await prisma.users.findFirst({
      where: { role: 'ADMIN' }
    });

    if (!adminUser) {
      console.error('❌ Admin user not found!');
      await prisma.$disconnect();
      return;
    }

    console.log('Current Email:', adminUser.email);

    // Update to the email the frontend is using
    const updatedUser = await prisma.users.update({
      where: { id: adminUser.id },
      data: { email: 'admin@kashaya.com' }
    });

    console.log('✅ Email updated to:', updatedUser.email);
    console.log('\n📋 Login Credentials:');
    console.log('   Email: admin@kashaya.com');
    console.log('   Password: admin123');
    console.log('\n🌐 Login at: http://localhost:5176');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

updateEmail();
