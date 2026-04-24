// Seed admin user
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding admin user...');

  const email = 'admin@kashaya.com';
  const password = 'admin123';

  // Check if admin already exists
  const existingAdmin = await prisma.users.findUnique({
    where: { email },
  });

  if (existingAdmin) {
    console.log('✅ Admin user already exists!');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('👤 Name:', existingAdmin.firstName, existingAdmin.lastName);
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create admin user
  const admin = await prisma.users.create({
    data: {
      email,
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      phone: '1234567890',
      role: UserRole.ADMIN,
      department: 'Management',
      isActive: true,
    },
  });

  console.log('✅ Admin user created successfully!');
  console.log('📧 Email:', email);
  console.log('🔑 Password:', password);
  console.log('👤 Name:', admin.firstName, admin.lastName);
  console.log('🎭 Role:', admin.role);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding admin user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
