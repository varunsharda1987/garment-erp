/**
 * Season Data Migration Script
 * Migrates existing free-text season values to season_master references
 *
 * Run this AFTER running seed-seasons.ts
 */

import { PrismaClient, SeasonType } from '@prisma/client';

const prisma = new PrismaClient();

const SEASON_TYPE_NAMES: Record<SeasonType, string> = {
  SS: 'Spring/Summer',
  AW: 'Autumn/Winter',
};

/**
 * Calculate sort order for a season
 */
function calculateSortOrder(year: number, seasonType: SeasonType): number {
  const seasonOrder = seasonType === 'SS' ? 1 : 2;
  return year * 10 + seasonOrder;
}

/**
 * Pattern definitions for matching season text
 */
interface SeasonPattern {
  regex: RegExp;
  type: SeasonType;
}

const SEASON_PATTERNS: SeasonPattern[] = [
  // Direct code patterns (most specific first)
  { regex: /^SS[-_\s]?(\d{2,4})$/i, type: 'SS' },
  { regex: /^AW[-_\s]?(\d{2,4})$/i, type: 'AW' },

  // Full name patterns with year
  { regex: /^Summer[-_\s]?(\d{2,4})$/i, type: 'SS' },
  { regex: /^Winter[-_\s]?(\d{2,4})$/i, type: 'AW' },
  { regex: /^Spring[-_/]?Summer[-_\s]?(\d{2,4})$/i, type: 'SS' },
  { regex: /^Autumn[-_/]?Winter[-_\s]?(\d{2,4})$/i, type: 'AW' },
  { regex: /^Fall[-_/]?Winter[-_\s]?(\d{2,4})$/i, type: 'AW' },

  // Slash notation
  { regex: /^S\/S[-_\s]?(\d{2,4})$/i, type: 'SS' },
  { regex: /^A\/W[-_\s]?(\d{2,4})$/i, type: 'AW' },
  { regex: /^F\/W[-_\s]?(\d{2,4})$/i, type: 'AW' },

  // Reversed patterns (year first)
  { regex: /^(\d{2,4})[-_\s]?SS$/i, type: 'SS' },
  { regex: /^(\d{2,4})[-_\s]?AW$/i, type: 'AW' },
  { regex: /^(\d{2,4})[-_\s]?Summer$/i, type: 'SS' },
  { regex: /^(\d{2,4})[-_\s]?Winter$/i, type: 'AW' },
];

/**
 * Parse a season text to extract type and year
 */
function parseSeasonText(text: string): { type: SeasonType; year: number } | null {
  const trimmed = text.trim();

  for (const pattern of SEASON_PATTERNS) {
    const match = trimmed.match(pattern.regex);
    if (match) {
      let yearStr = match[1];
      let year = parseInt(yearStr, 10);

      // Handle 2-digit years
      if (year < 100) {
        year = year < 50 ? 2000 + year : 1900 + year;
      }

      return { type: pattern.type, year };
    }
  }

  return null;
}

/**
 * Find or create a season_master record
 */
async function findOrCreateSeason(text: string): Promise<string | null> {
  const parsed = parseSeasonText(text);

  if (!parsed) {
    return null;
  }

  const code = `${parsed.type}${parsed.year.toString().slice(-2)}`;

  // Try to find existing
  let season = await prisma.season_master.findUnique({
    where: { code },
  });

  if (!season) {
    // Create new season
    season = await prisma.season_master.create({
      data: {
        code,
        name: `${SEASON_TYPE_NAMES[parsed.type]} ${parsed.year}`,
        year: parsed.year,
        seasonType: parsed.type,
        sortOrder: calculateSortOrder(parsed.year, parsed.type),
        isActive: true,
      },
    });
    console.log(`  📦 Auto-created season: ${season.code} - ${season.name}`);
  }

  return season.id;
}

interface MigrationResult {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  unmatchedValues: string[];
}

async function main() {
  console.log('🔄 Starting Season Data Migration...\n');

  const result: MigrationResult = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    unmatchedValues: [],
  };

  // Get all styles with season text but no seasonId
  const styles = await prisma.styles.findMany({
    where: {
      season: { not: null },
      seasonId: null,
    },
    select: {
      id: true,
      styleCode: true,
      season: true,
    },
  });

  result.total = styles.length;

  console.log(`📋 Found ${styles.length} styles with season text to migrate\n`);

  if (styles.length === 0) {
    console.log('✨ No styles need migration!\n');
    return;
  }

  // Group by unique season values for reporting
  const uniqueSeasons = new Map<string, number>();
  for (const style of styles) {
    if (style.season) {
      const count = uniqueSeasons.get(style.season) || 0;
      uniqueSeasons.set(style.season, count + 1);
    }
  }

  console.log(`📊 Unique season values found: ${uniqueSeasons.size}\n`);

  // Process each style
  for (const style of styles) {
    if (!style.season) {
      result.skipped++;
      continue;
    }

    try {
      const seasonId = await findOrCreateSeason(style.season);

      if (seasonId) {
        await prisma.styles.update({
          where: { id: style.id },
          data: { seasonId },
        });
        result.migrated++;
        console.log(`  ✅ ${style.styleCode}: "${style.season}" → seasonId linked`);
      } else {
        result.failed++;
        if (!result.unmatchedValues.includes(style.season)) {
          result.unmatchedValues.push(style.season);
        }
        console.log(`  ⚠️  ${style.styleCode}: "${style.season}" - pattern not matched`);
      }
    } catch (error) {
      result.failed++;
      console.error(`  ❌ ${style.styleCode}: Error - ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary:');
  console.log('='.repeat(60));
  console.log(`  Total styles processed:  ${result.total}`);
  console.log(`  Successfully migrated:   ${result.migrated}`);
  console.log(`  Skipped (no season):     ${result.skipped}`);
  console.log(`  Failed (unmatched):      ${result.failed}`);

  if (result.unmatchedValues.length > 0) {
    console.log('\n⚠️  Unmatched season values (need manual review):');
    for (const value of result.unmatchedValues) {
      const count = uniqueSeasons.get(value) || 0;
      console.log(`    - "${value}" (${count} styles)`);
    }
    console.log('\n💡 Tip: You can manually update these styles in the Style form');
    console.log('   or create custom season_master entries for these values.\n');
  }

  console.log('\n✨ Migration completed!\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error during migration:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
