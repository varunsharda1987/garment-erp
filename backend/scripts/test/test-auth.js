const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getUser() {
  try {
    const user = await prisma.users.findFirst({
      select: {
        email: true,
        firstName: true,
        lastName: true
      }
    });
    console.log(JSON.stringify(user, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

getUser();
