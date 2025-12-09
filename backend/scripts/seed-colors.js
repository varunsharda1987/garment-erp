const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const colors = [
  // Neutrals (15 colors)
  { colorName: 'White', hexCode: '#FFFFFF', colorFamily: 'Neutrals' },
  { colorName: 'Off White', hexCode: '#FAF9F6', colorFamily: 'Neutrals' },
  { colorName: 'Ivory', hexCode: '#FFFFF0', colorFamily: 'Neutrals' },
  { colorName: 'Cream', hexCode: '#FFFDD0', colorFamily: 'Neutrals' },
  { colorName: 'Beige', hexCode: '#F5F5DC', colorFamily: 'Neutrals' },
  { colorName: 'Ecru', hexCode: '#C2B280', colorFamily: 'Neutrals' },
  { colorName: 'Natural', hexCode: '#F5F5E1', colorFamily: 'Neutrals' },
  { colorName: 'Black', hexCode: '#000000', colorFamily: 'Neutrals' },
  { colorName: 'Jet Black', hexCode: '#0A0A0A', colorFamily: 'Neutrals' },
  { colorName: 'Charcoal', hexCode: '#36454F', colorFamily: 'Neutrals' },
  { colorName: 'Grey', hexCode: '#808080', colorFamily: 'Neutrals' },
  { colorName: 'Light Grey', hexCode: '#D3D3D3', colorFamily: 'Neutrals' },
  { colorName: 'Dark Grey', hexCode: '#A9A9A9', colorFamily: 'Neutrals' },
  { colorName: 'Slate Grey', hexCode: '#708090', colorFamily: 'Neutrals' },
  { colorName: 'Smoke Grey', hexCode: '#848884', colorFamily: 'Neutrals' },

  // Blues (25 colors)
  { colorName: 'Navy Blue', hexCode: '#000080', colorFamily: 'Blues' },
  { colorName: 'Dark Navy', hexCode: '#00003C', colorFamily: 'Blues' },
  { colorName: 'Royal Blue', hexCode: '#4169E1', colorFamily: 'Blues' },
  { colorName: 'Cobalt Blue', hexCode: '#0047AB', colorFamily: 'Blues' },
  { colorName: 'Sky Blue', hexCode: '#87CEEB', colorFamily: 'Blues' },
  { colorName: 'Baby Blue', hexCode: '#89CFF0', colorFamily: 'Blues' },
  { colorName: 'Powder Blue', hexCode: '#B0E0E6', colorFamily: 'Blues' },
  { colorName: 'Teal', hexCode: '#008080', colorFamily: 'Blues' },
  { colorName: 'Turquoise', hexCode: '#40E0D0', colorFamily: 'Blues' },
  { colorName: 'Aqua', hexCode: '#00FFFF', colorFamily: 'Blues' },
  { colorName: 'Aquamarine', hexCode: '#7FFFD4', colorFamily: 'Blues' },
  { colorName: 'Indigo', hexCode: '#4B0082', colorFamily: 'Blues' },
  { colorName: 'Denim Blue', hexCode: '#1560BD', colorFamily: 'Blues' },
  { colorName: 'Light Denim', hexCode: '#6EAFDB', colorFamily: 'Blues' },
  { colorName: 'Dark Denim', hexCode: '#1F4064', colorFamily: 'Blues' },
  { colorName: 'Midnight Blue', hexCode: '#191970', colorFamily: 'Blues' },
  { colorName: 'Steel Blue', hexCode: '#4682B4', colorFamily: 'Blues' },
  { colorName: 'Slate Blue', hexCode: '#6A5ACD', colorFamily: 'Blues' },
  { colorName: 'Ocean Blue', hexCode: '#4F97A3', colorFamily: 'Blues' },
  { colorName: 'Peacock Blue', hexCode: '#005F6A', colorFamily: 'Blues' },
  { colorName: 'Sapphire', hexCode: '#0F52BA', colorFamily: 'Blues' },
  { colorName: 'Electric Blue', hexCode: '#7DF9FF', colorFamily: 'Blues' },
  { colorName: 'Cerulean', hexCode: '#007BA7', colorFamily: 'Blues' },
  { colorName: 'Periwinkle', hexCode: '#CCCCFF', colorFamily: 'Blues' },
  { colorName: 'Ice Blue', hexCode: '#A5F2F3', colorFamily: 'Blues' },

  // Reds (20 colors)
  { colorName: 'Red', hexCode: '#FF0000', colorFamily: 'Reds' },
  { colorName: 'Bright Red', hexCode: '#EE4B2B', colorFamily: 'Reds' },
  { colorName: 'Dark Red', hexCode: '#8B0000', colorFamily: 'Reds' },
  { colorName: 'Maroon', hexCode: '#800000', colorFamily: 'Reds' },
  { colorName: 'Burgundy', hexCode: '#800020', colorFamily: 'Reds' },
  { colorName: 'Crimson', hexCode: '#DC143C', colorFamily: 'Reds' },
  { colorName: 'Cherry Red', hexCode: '#DE3163', colorFamily: 'Reds' },
  { colorName: 'Wine', hexCode: '#722F37', colorFamily: 'Reds' },
  { colorName: 'Wine Red', hexCode: '#5E2129', colorFamily: 'Reds' },
  { colorName: 'Blood Red', hexCode: '#880808', colorFamily: 'Reds' },
  { colorName: 'Scarlet', hexCode: '#FF2400', colorFamily: 'Reds' },
  { colorName: 'Vermilion', hexCode: '#E34234', colorFamily: 'Reds' },
  { colorName: 'Ruby', hexCode: '#E0115F', colorFamily: 'Reds' },
  { colorName: 'Garnet', hexCode: '#733635', colorFamily: 'Reds' },
  { colorName: 'Brick Red', hexCode: '#CB4154', colorFamily: 'Reds' },
  { colorName: 'Indian Red', hexCode: '#CD5C5C', colorFamily: 'Reds' },
  { colorName: 'Tomato Red', hexCode: '#FF6347', colorFamily: 'Reds' },
  { colorName: 'Fire Engine Red', hexCode: '#CE2029', colorFamily: 'Reds' },
  { colorName: 'Oxblood', hexCode: '#4A0000', colorFamily: 'Reds' },
  { colorName: 'Carmine', hexCode: '#960018', colorFamily: 'Reds' },

  // Greens (20 colors)
  { colorName: 'Green', hexCode: '#008000', colorFamily: 'Greens' },
  { colorName: 'Dark Green', hexCode: '#013220', colorFamily: 'Greens' },
  { colorName: 'Light Green', hexCode: '#90EE90', colorFamily: 'Greens' },
  { colorName: 'Forest Green', hexCode: '#228B22', colorFamily: 'Greens' },
  { colorName: 'Olive', hexCode: '#808000', colorFamily: 'Greens' },
  { colorName: 'Olive Drab', hexCode: '#6B8E23', colorFamily: 'Greens' },
  { colorName: 'Army Green', hexCode: '#4B5320', colorFamily: 'Greens' },
  { colorName: 'Sage', hexCode: '#BCB88A', colorFamily: 'Greens' },
  { colorName: 'Sage Green', hexCode: '#9DC183', colorFamily: 'Greens' },
  { colorName: 'Mint', hexCode: '#98FF98', colorFamily: 'Greens' },
  { colorName: 'Mint Green', hexCode: '#3EB489', colorFamily: 'Greens' },
  { colorName: 'Emerald', hexCode: '#50C878', colorFamily: 'Greens' },
  { colorName: 'Hunter Green', hexCode: '#355E3B', colorFamily: 'Greens' },
  { colorName: 'Sea Green', hexCode: '#2E8B57', colorFamily: 'Greens' },
  { colorName: 'Kelly Green', hexCode: '#4CBB17', colorFamily: 'Greens' },
  { colorName: 'Lime Green', hexCode: '#32CD32', colorFamily: 'Greens' },
  { colorName: 'Neon Green', hexCode: '#39FF14', colorFamily: 'Greens' },
  { colorName: 'Pistachio', hexCode: '#93C572', colorFamily: 'Greens' },
  { colorName: 'Jade', hexCode: '#00A86B', colorFamily: 'Greens' },
  { colorName: 'Bottle Green', hexCode: '#006A4E', colorFamily: 'Greens' },

  // Yellows (15 colors)
  { colorName: 'Yellow', hexCode: '#FFFF00', colorFamily: 'Yellows' },
  { colorName: 'Bright Yellow', hexCode: '#FFEA00', colorFamily: 'Yellows' },
  { colorName: 'Light Yellow', hexCode: '#FFFFE0', colorFamily: 'Yellows' },
  { colorName: 'Mustard', hexCode: '#FFDB58', colorFamily: 'Yellows' },
  { colorName: 'Mustard Yellow', hexCode: '#E1AD01', colorFamily: 'Yellows' },
  { colorName: 'Gold', hexCode: '#FFD700', colorFamily: 'Yellows' },
  { colorName: 'Golden Yellow', hexCode: '#FFDF00', colorFamily: 'Yellows' },
  { colorName: 'Lemon', hexCode: '#FFF44F', colorFamily: 'Yellows' },
  { colorName: 'Canary Yellow', hexCode: '#FFEF00', colorFamily: 'Yellows' },
  { colorName: 'Amber', hexCode: '#FFBF00', colorFamily: 'Yellows' },
  { colorName: 'Saffron', hexCode: '#F4C430', colorFamily: 'Yellows' },
  { colorName: 'Butter Yellow', hexCode: '#FFFD74', colorFamily: 'Yellows' },
  { colorName: 'Sunflower', hexCode: '#FFDA03', colorFamily: 'Yellows' },
  { colorName: 'Marigold', hexCode: '#EAA221', colorFamily: 'Yellows' },
  { colorName: 'Honey', hexCode: '#EB9605', colorFamily: 'Yellows' },

  // Oranges (15 colors)
  { colorName: 'Orange', hexCode: '#FFA500', colorFamily: 'Oranges' },
  { colorName: 'Bright Orange', hexCode: '#FF5F1F', colorFamily: 'Oranges' },
  { colorName: 'Dark Orange', hexCode: '#FF8C00', colorFamily: 'Oranges' },
  { colorName: 'Rust', hexCode: '#B7410E', colorFamily: 'Oranges' },
  { colorName: 'Rust Orange', hexCode: '#C45519', colorFamily: 'Oranges' },
  { colorName: 'Coral', hexCode: '#FF7F50', colorFamily: 'Oranges' },
  { colorName: 'Light Coral', hexCode: '#F08080', colorFamily: 'Oranges' },
  { colorName: 'Peach', hexCode: '#FFCBA4', colorFamily: 'Oranges' },
  { colorName: 'Apricot', hexCode: '#FBCEB1', colorFamily: 'Oranges' },
  { colorName: 'Tangerine', hexCode: '#FF9966', colorFamily: 'Oranges' },
  { colorName: 'Burnt Orange', hexCode: '#CC5500', colorFamily: 'Oranges' },
  { colorName: 'Pumpkin', hexCode: '#FF7518', colorFamily: 'Oranges' },
  { colorName: 'Terracotta', hexCode: '#E2725B', colorFamily: 'Oranges' },
  { colorName: 'Persimmon', hexCode: '#EC5800', colorFamily: 'Oranges' },
  { colorName: 'Carrot Orange', hexCode: '#ED9121', colorFamily: 'Oranges' },

  // Pinks (20 colors)
  { colorName: 'Pink', hexCode: '#FFC0CB', colorFamily: 'Pinks' },
  { colorName: 'Light Pink', hexCode: '#FFB6C1', colorFamily: 'Pinks' },
  { colorName: 'Baby Pink', hexCode: '#F4C2C2', colorFamily: 'Pinks' },
  { colorName: 'Hot Pink', hexCode: '#FF69B4', colorFamily: 'Pinks' },
  { colorName: 'Neon Pink', hexCode: '#FF6EC7', colorFamily: 'Pinks' },
  { colorName: 'Blush', hexCode: '#DE5D83', colorFamily: 'Pinks' },
  { colorName: 'Blush Pink', hexCode: '#FE828C', colorFamily: 'Pinks' },
  { colorName: 'Rose', hexCode: '#FF007F', colorFamily: 'Pinks' },
  { colorName: 'Rose Pink', hexCode: '#FF66CC', colorFamily: 'Pinks' },
  { colorName: 'Dusty Rose', hexCode: '#C08081', colorFamily: 'Pinks' },
  { colorName: 'Salmon', hexCode: '#FA8072', colorFamily: 'Pinks' },
  { colorName: 'Salmon Pink', hexCode: '#FF91A4', colorFamily: 'Pinks' },
  { colorName: 'Fuchsia', hexCode: '#FF00FF', colorFamily: 'Pinks' },
  { colorName: 'Magenta', hexCode: '#FF0090', colorFamily: 'Pinks' },
  { colorName: 'Deep Pink', hexCode: '#FF1493', colorFamily: 'Pinks' },
  { colorName: 'Cerise', hexCode: '#DE3163', colorFamily: 'Pinks' },
  { colorName: 'Bubblegum Pink', hexCode: '#FFC1CC', colorFamily: 'Pinks' },
  { colorName: 'Candy Pink', hexCode: '#E4717A', colorFamily: 'Pinks' },
  { colorName: 'Watermelon', hexCode: '#FD4659', colorFamily: 'Pinks' },
  { colorName: 'Flamingo', hexCode: '#FC8EAC', colorFamily: 'Pinks' },

  // Purples (18 colors)
  { colorName: 'Purple', hexCode: '#800080', colorFamily: 'Purples' },
  { colorName: 'Dark Purple', hexCode: '#301934', colorFamily: 'Purples' },
  { colorName: 'Light Purple', hexCode: '#CBC3E3', colorFamily: 'Purples' },
  { colorName: 'Lavender', hexCode: '#E6E6FA', colorFamily: 'Purples' },
  { colorName: 'Lilac', hexCode: '#C8A2C8', colorFamily: 'Purples' },
  { colorName: 'Violet', hexCode: '#EE82EE', colorFamily: 'Purples' },
  { colorName: 'Plum', hexCode: '#DDA0DD', colorFamily: 'Purples' },
  { colorName: 'Mauve', hexCode: '#E0B0FF', colorFamily: 'Purples' },
  { colorName: 'Orchid', hexCode: '#DA70D6', colorFamily: 'Purples' },
  { colorName: 'Grape', hexCode: '#6F2DA8', colorFamily: 'Purples' },
  { colorName: 'Eggplant', hexCode: '#614051', colorFamily: 'Purples' },
  { colorName: 'Aubergine', hexCode: '#3D0C02', colorFamily: 'Purples' },
  { colorName: 'Amethyst', hexCode: '#9966CC', colorFamily: 'Purples' },
  { colorName: 'Iris', hexCode: '#5A4FCF', colorFamily: 'Purples' },
  { colorName: 'Wisteria', hexCode: '#C9A0DC', colorFamily: 'Purples' },
  { colorName: 'Heather', hexCode: '#B7A8B3', colorFamily: 'Purples' },
  { colorName: 'Royal Purple', hexCode: '#7851A9', colorFamily: 'Purples' },
  { colorName: 'Wine Purple', hexCode: '#482D3F', colorFamily: 'Purples' },

  // Browns (20 colors)
  { colorName: 'Brown', hexCode: '#A52A2A', colorFamily: 'Browns' },
  { colorName: 'Dark Brown', hexCode: '#654321', colorFamily: 'Browns' },
  { colorName: 'Light Brown', hexCode: '#C4A484', colorFamily: 'Browns' },
  { colorName: 'Chocolate', hexCode: '#7B3F00', colorFamily: 'Browns' },
  { colorName: 'Chocolate Brown', hexCode: '#3D2117', colorFamily: 'Browns' },
  { colorName: 'Tan', hexCode: '#D2B48C', colorFamily: 'Browns' },
  { colorName: 'Camel', hexCode: '#C19A6B', colorFamily: 'Browns' },
  { colorName: 'Coffee', hexCode: '#6F4E37', colorFamily: 'Browns' },
  { colorName: 'Coffee Brown', hexCode: '#4B3621', colorFamily: 'Browns' },
  { colorName: 'Khaki', hexCode: '#C3B091', colorFamily: 'Browns' },
  { colorName: 'Dark Khaki', hexCode: '#BDB76B', colorFamily: 'Browns' },
  { colorName: 'Mocha', hexCode: '#967969', colorFamily: 'Browns' },
  { colorName: 'Espresso', hexCode: '#4E312D', colorFamily: 'Browns' },
  { colorName: 'Chestnut', hexCode: '#954535', colorFamily: 'Browns' },
  { colorName: 'Mahogany', hexCode: '#C04000', colorFamily: 'Browns' },
  { colorName: 'Walnut', hexCode: '#773F1A', colorFamily: 'Browns' },
  { colorName: 'Sienna', hexCode: '#A0522D', colorFamily: 'Browns' },
  { colorName: 'Cinnamon', hexCode: '#D2691E', colorFamily: 'Browns' },
  { colorName: 'Cocoa', hexCode: '#875F42', colorFamily: 'Browns' },
  { colorName: 'Saddle Brown', hexCode: '#8B4513', colorFamily: 'Browns' },

  // Metallics (10 colors)
  { colorName: 'Silver', hexCode: '#C0C0C0', colorFamily: 'Metallics' },
  { colorName: 'Bright Silver', hexCode: '#D3D3D3', colorFamily: 'Metallics' },
  { colorName: 'Antique Silver', hexCode: '#848482', colorFamily: 'Metallics' },
  { colorName: 'Bronze', hexCode: '#CD7F32', colorFamily: 'Metallics' },
  { colorName: 'Antique Bronze', hexCode: '#665D1E', colorFamily: 'Metallics' },
  { colorName: 'Copper', hexCode: '#B87333', colorFamily: 'Metallics' },
  { colorName: 'Rose Gold', hexCode: '#B76E79', colorFamily: 'Metallics' },
  { colorName: 'Champagne', hexCode: '#F7E7CE', colorFamily: 'Metallics' },
  { colorName: 'Gunmetal', hexCode: '#2A3439', colorFamily: 'Metallics' },
  { colorName: 'Pewter', hexCode: '#8BA8B7', colorFamily: 'Metallics' },

  // Prints (common print descriptions - no hex codes)
  { colorName: 'Multi Color', hexCode: null, colorFamily: 'Prints' },
  { colorName: 'Floral Print', hexCode: null, colorFamily: 'Prints' },
  { colorName: 'Stripe', hexCode: null, colorFamily: 'Prints' },
  { colorName: 'Check', hexCode: null, colorFamily: 'Prints' },
  { colorName: 'Plaid', hexCode: null, colorFamily: 'Prints' },
  { colorName: 'Polka Dot', hexCode: null, colorFamily: 'Prints' },
  { colorName: 'Abstract Print', hexCode: null, colorFamily: 'Prints' },
  { colorName: 'Animal Print', hexCode: null, colorFamily: 'Prints' },
  { colorName: 'Leopard Print', hexCode: null, colorFamily: 'Prints' },
  { colorName: 'Zebra Print', hexCode: null, colorFamily: 'Prints' },
  { colorName: 'Paisley', hexCode: null, colorFamily: 'Prints' },
  { colorName: 'Geometric Print', hexCode: null, colorFamily: 'Prints' },
  { colorName: 'Tie Dye', hexCode: null, colorFamily: 'Prints' },
  { colorName: 'Camouflage', hexCode: null, colorFamily: 'Prints' },
  { colorName: 'Tropical Print', hexCode: null, colorFamily: 'Prints' },
];

async function seedColors() {
  console.log('Starting color seed...');
  console.log(`Total colors to process: ${colors.length}`);

  let created = 0;
  let skipped = 0;

  for (const color of colors) {
    try {
      const existing = await prisma.color_master.findFirst({
        where: { colorName: color.colorName }
      });

      if (existing) {
        skipped++;
        continue;
      }

      const count = await prisma.color_master.count();
      const colorCode = 'CLR' + String(count + 1).padStart(3, '0');

      await prisma.color_master.create({
        data: {
          colorCode,
          colorName: color.colorName,
          hexCode: color.hexCode,
          colorFamily: color.colorFamily,
          isActive: true,
          sortOrder: 0,
        }
      });
      created++;

      if (created % 20 === 0) {
        console.log(`  Created ${created} colors...`);
      }
    } catch (err) {
      console.error(`Error creating ${color.colorName}:`, err.message);
    }
  }

  console.log('\n========================================');
  console.log(`Colors seeded: ${created} created, ${skipped} skipped (already exist)`);

  const total = await prisma.color_master.count();
  console.log(`Total colors in database: ${total}`);

  // Show summary by family
  const families = await prisma.color_master.groupBy({
    by: ['colorFamily'],
    _count: { id: true },
    orderBy: { colorFamily: 'asc' }
  });

  console.log('\nColors by family:');
  families.forEach(f => console.log(`  ${f.colorFamily || 'No Family'}: ${f._count.id}`));
  console.log('========================================');
}

seedColors()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
