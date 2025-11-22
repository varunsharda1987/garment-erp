const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function testLogin() {
  try {
    console.log('🧪 Testing Login Directly...\n');

    const email = 'admin@kashaya.com';
    const password = 'admin123';

    // Find user
    const user = await prisma.users.findUnique({
      where: { email }
    });

    if (!user) {
      console.log('❌ User not found with email:', email);
      await prisma.$disconnect();
      return;
    }

    console.log('✅ User found:');
    console.log('   Email:', user.email);
    console.log('   Name:', `${user.firstName} ${user.lastName}`);
    console.log('   Role:', user.role);
    console.log('   Active:', user.isActive);
    console.log('   Password Hash (first 20 chars):', user.password.substring(0, 20) + '...');

    // Test password
    console.log('\n🔐 Testing password...');
    const isValid = await bcrypt.compare(password, user.password);

    if (isValid) {
      console.log('✅ Password is CORRECT!');
      console.log('\n📋 Login should work with:');
      console.log('   Email:', email);
      console.log('   Password:', password);
    } else {
      console.log('❌ Password is INCORRECT!');
      console.log('   The password in database does not match "admin123"');
      console.log('\n   Let me reset it now...');

      const hashedPassword = await bcrypt.hash(password, 10);
      await prisma.users.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      });

      console.log('   ✅ Password reset to: admin123');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();
