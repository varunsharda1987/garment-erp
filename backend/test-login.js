const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function testLogin() {
  try {
    const user = await prisma.users.findUnique({
      where: { email: 'admin@kashaya.com' }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('✅ User found:', user.email);
    console.log('📝 Password hash:', user.password);
    console.log('📝 Is Active:', user.isActive);
    console.log('📝 Role:', user.role);

    const isValid = await bcrypt.compare('admin123', user.password);
    console.log('\n🔐 Testing password "admin123":', isValid ? '✅ VALID' : '❌ INVALID');

    if (!isValid) {
      console.log('\n⚠️  Password mismatch! Rehashing password...');
      const newHash = await bcrypt.hash('admin123', 10);
      await prisma.users.update({
        where: { id: user.id },
        data: { password: newHash }
      });
      console.log('✅ Password updated successfully!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();
