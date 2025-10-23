import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding material categories...');

  const categories = [
    {
      name: 'Fabric',
      description: 'Textile materials used for garment construction (woven, knit, etc.)'
    },
    {
      name: 'Trims',
      description: 'Decorative or functional components (buttons, zippers, labels, etc.)'
    },
    {
      name: 'Accessories',
      description: 'Additional components and embellishments (ribbons, laces, beads, etc.)'
    },
    {
      name: 'Packaging',
      description: 'Materials for product packaging and shipping'
    },
    {
      name: 'Thread & Yarn',
      description: 'Sewing threads, yarns, and related materials'
    },
    {
      name: 'Interlining',
      description: 'Support materials placed between garment layers'
    },
    {
      name: 'Elastic',
      description: 'Stretchable materials for waistbands, cuffs, etc.'
    }
  ];

  for (const category of categories) {
    const existing = await prisma.materialCategory.findUnique({
      where: { name: category.name }
    });

    if (!existing) {
      await prisma.materialCategory.create({
        data: category
      });
      console.log(`✅ Created category: ${category.name}`);
    } else {
      console.log(`⏭️  Category already exists: ${category.name}`);
    }
  }

  console.log('✨ Material categories seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding material categories:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
