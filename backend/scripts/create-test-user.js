const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    const hashedPassword = await bcrypt.hash('Admin@123', 10);

    const user = await prisma.users.upsert({
      where: { email: 'admin@kashayafabs.com' },
      update: {
        password: hashedPassword,
      },
      create: {
        email: 'admin@kashayafabs.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
        isActive: true,
      },
    });

    console.log('Test user created/updated:', user.email);
    console.log('Email: admin@kashayafabs.com');
    console.log('Password: Admin@123');
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
