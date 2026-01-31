/**
 * Season Master Seed Script
 * Creates initial seasons for years 2023-2030
 */

import { PrismaClient, SeasonType } from '@prisma/client';

const prisma = new PrismaClient();

interface SeasonData {
  code: string;
  name: string;
  year: number;
  seasonType: SeasonType;
  sortOrder: number;
}

const SEASON_TYPE_NAMES: Record<SeasonType, string> = {
  SS: 'Spring/Summer',
  AW: 'Autumn/Winter',
};

/**
 * Calculate sort order for a season
 * Format: YYYYS where S is 1 for SS, 2 for AW
 */
function calculateSortOrder(year: number, seasonType: SeasonType): number {
  const seasonOrder = seasonType === 'SS' ? 1 : 2;
  return year * 10 + seasonOrder;
}

/**
 * Generate seasons for a year range
 */
function generateSeasonData(startYear: number, endYear: number): SeasonData[] {
  const seasons: SeasonData[] = [];
  const seasonTypes: SeasonType[] = ['SS', 'AW'];

  for (let year = startYear; year <= endYear; year++) {
    for (const seasonType of seasonTypes) {
      const yearSuffix = year.toString().slice(-2);
      seasons.push({
        code: `${seasonType}${yearSuffix}`,
        name: `${SEASON_TYPE_NAMES[seasonType]} ${year}`,
        year,
        seasonType,
        sortOrder: calculateSortOrder(year, seasonType),
      });
    }
  }

  return seasons;
}

async function main() {
  console.log('🌱 Starting Season Master seed...\n');

  // Generate seasons for years 2023-2030
  const seasons = generateSeasonData(2023, 2030);

  console.log(`📅 Generating ${seasons.length} seasons (2023-2030)...\n`);

  let created = 0;
  let skipped = 0;

  for (const season of seasons) {
    // Check if already exists
    const existing = await prisma.season_master.findUnique({
      where: { code: season.code },
    });

    if (existing) {
      console.log(`  ⏭️  Skipped: ${season.code} (${season.name}) - already exists`);
      skipped++;
      continue;
    }

    await prisma.season_master.create({
      data: {
        code: season.code,
        name: season.name,
        year: season.year,
        seasonType: season.seasonType,
        sortOrder: season.sortOrder,
        isActive: true,
      },
    });

    console.log(`  ✅ Created: ${season.code} - ${season.name}`);
    created++;
  }

  console.log('\n📊 Summary:');
  console.log(`  Created: ${created}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total:   ${seasons.length}`);

  console.log('\n✨ Season Master seed completed!\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error seeding seasons:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
