const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function resetPassword() {
  try {
    console.log('🔐 Resetting Admin Password...\n');

    // Find admin user
    const adminUser = await prisma.users.findFirst({
      where: { email: 'admin@kashayafabs.com' }
    });

    if (!adminUser) {
      console.error('❌ Admin user not found!');
      await prisma.$disconnect();
      return;
    }

    console.log('✅ Found admin user:', adminUser.email);
    console.log('   Name:', `${adminUser.firstName} ${adminUser.lastName}`);
    console.log('   Role:', adminUser.role);

    // Hash new password
    const newPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.users.update({
      where: { id: adminUser.id },
      data: { password: hashedPassword }
    });

    console.log('\n✅ Password reset successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('   Email:', adminUser.email);
    console.log('   Password:', newPassword);
    console.log('\n🌐 Login at: http://localhost:5176');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();
