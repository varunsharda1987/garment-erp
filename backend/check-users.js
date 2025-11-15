const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.users.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLogin: true
      }
    });

    console.log('=== USERS IN DATABASE ===');
    console.log(JSON.stringify(users, null, 2));
    console.log(`\nTotal users: ${users.length}`);

    if (users.length === 0) {
      console.log('\n⚠️  NO USERS FOUND - Database is empty!');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
