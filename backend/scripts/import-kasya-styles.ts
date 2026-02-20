/**
 * Import Kasya Styles from Folder Structure
 *
 * This script scans the folder structure at Z:\Approved Photoshoots\1.Women\Approved Photoshoots
 * and creates styles for House Of Kasya Pvt Ltd with one image per style.
 *
 * Run: npx ts-node scripts/import-kasya-styles.ts
 *
 * Options:
 *   --dry-run    Preview what would be imported without creating records
 *   --limit=N    Only import first N styles (for testing)
 */

import * as fs from 'fs';
import * as path from 'path';
import { Gender } from '@prisma/client';
import prisma from '../src/config/database';
import { randomUUID } from 'crypto';

// ============================================
// Configuration
// ============================================

const BASE_PATH = 'Z:\\Approved Photoshoots\\1.Women\\Approved Photoshoots';
const CUSTOMER_NAME = 'House Of Kasya Pvt Ltd';
const BRAND_NAME = 'Kasya';
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'styles');

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT_ARG = args.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : null;

// Category to Brand Category Mapping
const CATEGORY_MAPPING: Record<string, { category: string; gender: Gender }> = {
  'Blouse': { category: 'Ethnic Wear', gender: 'WOMEN' },
  'Co-ord set': { category: 'Fusion Wear', gender: 'WOMEN' },
  'Corset Top': { category: 'Fusion Wear', gender: 'WOMEN' },
  'Dresses': { category: 'Fusion Wear', gender: 'WOMEN' },
  'Dupatta': { category: 'Ethnic Wear', gender: 'WOMEN' },
  'Ethnic Kurta Set': { category: 'Ethnic Wear', gender: 'WOMEN' },
  'Jumpsuit': { category: 'Fusion Wear', gender: 'WOMEN' },
  'KAFTAN': { category: 'Fusion Wear', gender: 'WOMEN' },
  'Kids': { category: 'Kids Wear', gender: 'KIDS' },
  'Kurta': { category: 'Ethnic Wear', gender: 'WOMEN' },
  'Lehenga choli': { category: 'Ethnic Wear', gender: 'WOMEN' },
  'Night Suit': { category: 'Sleepwear', gender: 'WOMEN' },
  'Nighty': { category: 'Sleepwear', gender: 'WOMEN' },
  'Pallazo': { category: 'Ethnic Wear', gender: 'WOMEN' },
  'SAREE': { category: 'Ethnic Wear', gender: 'WOMEN' },
  'Skirt': { category: 'Fusion Wear', gender: 'WOMEN' },
  'TOP': { category: 'Fusion Wear', gender: 'WOMEN' },
  'Western Wear': { category: 'Fusion Wear', gender: 'WOMEN' },
  'Zepto Nighty': { category: 'Sleepwear', gender: 'WOMEN' },
};

// ============================================
// Statistics
// ============================================

const stats = {
  totalFolders: 0,
  stylesCreated: 0,
  stylesSkipped: 0,
  imagesCopied: 0,
  errors: 0,
  errorDetails: [] as { styleCode: string; error: string }[],
};

// System user ID (will be fetched at runtime)
let SYSTEM_USER_ID: string;

// ============================================
// Helper Functions
// ============================================

/**
 * Generate internal style code in format STY-YYYYMM-XXXX
 */
let internalCodeCounter = 0;
async function generateInternalCode(): Promise<string> {
  if (internalCodeCounter === 0) {
    // Initialize counter from existing styles
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `STY-${yearMonth}-`;

    const lastStyle = await prisma.styles.findFirst({
      where: {
        internalCode: {
          startsWith: prefix,
        },
      },
      orderBy: {
        internalCode: 'desc',
      },
      select: {
        internalCode: true,
      },
    });

    if (lastStyle?.internalCode) {
      const lastNumber = parseInt(lastStyle.internalCode.replace(prefix, ''), 10);
      if (!isNaN(lastNumber)) {
        internalCodeCounter = lastNumber;
      }
    }
  }

  internalCodeCounter++;
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `STY-${yearMonth}-${String(internalCodeCounter).padStart(4, '0')}`;
}

/**
 * Find or create brand category for customer
 */
const brandCategoryCache = new Map<string, string>();

async function findOrCreateBrandCategory(
  customerId: string,
  brandName: string,
  category: string
): Promise<string> {
  const cacheKey = `${customerId}-${brandName}-${category}`;

  if (brandCategoryCache.has(cacheKey)) {
    return brandCategoryCache.get(cacheKey)!;
  }

  // Try to find existing
  let brandCategory = await prisma.brand_categories.findFirst({
    where: {
      customerId,
      brandName: {
        equals: brandName,
        mode: 'insensitive',
      },
      category: {
        equals: category,
        mode: 'insensitive',
      },
    },
  });

  if (!brandCategory) {
    // Create new
    brandCategory = await prisma.brand_categories.create({
      data: {
        id: randomUUID(),
        customerId,
        brandName,
        category,
        createdAt: new Date(),
      },
    });
    console.log(`  📁 Created brand category: ${brandName} → ${category}`);
  }

  brandCategoryCache.set(cacheKey, brandCategory.id);
  return brandCategory.id;
}

/**
 * Copy first image from style folder to uploads
 */
function copyFirstImage(styleCode: string, categoryFolder: string): string | null {
  const stylePath = path.join(BASE_PATH, categoryFolder, styleCode);

  if (!fs.existsSync(stylePath)) {
    return null;
  }

  const files = fs.readdirSync(stylePath);
  const images = files
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (images.length === 0) {
    return null;
  }

  const sourceImage = path.join(stylePath, images[0]);
  const ext = path.extname(images[0]).toLowerCase();
  const destName = `style-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const destPath = path.join(UPLOADS_DIR, destName);

  if (!DRY_RUN) {
    // Ensure uploads directory exists
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    fs.copyFileSync(sourceImage, destPath);
    stats.imagesCopied++;
  }

  return destName;
}

/**
 * Create a single style
 */
async function createStyle(
  styleCode: string,
  categoryFolder: string,
  mapping: { category: string; gender: Gender },
  customerId: string
): Promise<void> {
  try {
    // Check if style already exists
    const existing = await prisma.styles.findFirst({
      where: {
        styleCode,
        isActive: true,
      },
    });

    if (existing) {
      console.log(`  ⏭️  Skipped: ${styleCode} (already exists)`);
      stats.stylesSkipped++;
      return;
    }

    // Find or create brand category
    const brandCategoryId = await findOrCreateBrandCategory(
      customerId,
      BRAND_NAME,
      mapping.category
    );

    // Copy first image
    const imagePath = copyFirstImage(styleCode, categoryFolder);

    // Generate internal code
    const internalCode = await generateInternalCode();

    if (DRY_RUN) {
      console.log(`  📋 Would create: ${styleCode} (${categoryFolder} → ${mapping.category})`);
      stats.stylesCreated++;
      return;
    }

    // Create style
    await prisma.styles.create({
      data: {
        id: randomUUID(),
        styleCode,
        styleName: styleCode,
        internalCode,
        customerName: CUSTOMER_NAME,
        brandName: BRAND_NAME,
        brandCategoryId,
        gender: mapping.gender,
        image: imagePath,
        imageUrl: imagePath ? `/uploads/styles/${imagePath}` : null,
        status: 'DRAFT',
        cadStatus: 'PENDING',
        isActive: true,
        createdById: SYSTEM_USER_ID,
        createdAt: new Date(),
      },
    });

    console.log(`  ✅ Created: ${styleCode} (${mapping.category}, ${mapping.gender})`);
    stats.stylesCreated++;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`  ❌ Error: ${styleCode} - ${errorMessage}`);
    stats.errors++;
    stats.errorDetails.push({ styleCode, error: errorMessage });
  }
}

// ============================================
// Main Import Function
// ============================================

async function importStyles(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  KASYA STYLES IMPORT');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  if (LIMIT) {
    console.log(`📊 LIMIT: Only importing first ${LIMIT} styles\n`);
  }

  // Step 1: Find system user for createdById
  console.log('Step 1: Finding system user...');
  const systemUser = await prisma.users.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  if (!systemUser) {
    console.error(`❌ No active users found in the system.`);
    console.error('   Please create at least one user first.');
    process.exit(1);
  }
  SYSTEM_USER_ID = systemUser.id;
  const userName = `${systemUser.firstName} ${systemUser.lastName}`.trim() || systemUser.email;
  console.log(`  ✅ Using user: ${userName} (${systemUser.id})\n`);

  // Step 2: Verify customer exists
  console.log('Step 2: Verifying customer...');
  const customer = await prisma.customers.findFirst({
    where: {
      name: {
        equals: CUSTOMER_NAME,
        mode: 'insensitive',
      },
      isActive: true,
    },
  });

  if (!customer) {
    console.error(`❌ Customer not found: ${CUSTOMER_NAME}`);
    console.error('   Please create the customer first via the UI.');
    process.exit(1);
  }
  console.log(`  ✅ Customer found: ${customer.name} (${customer.code})\n`);

  // Step 3: Verify base path exists
  console.log('Step 3: Verifying folder path...');
  if (!fs.existsSync(BASE_PATH)) {
    console.error(`❌ Base path not found: ${BASE_PATH}`);
    console.error('   Please ensure the Z: drive is mounted.');
    process.exit(1);
  }
  console.log(`  ✅ Path accessible: ${BASE_PATH}\n`);

  // Step 4: Scan category folders
  console.log('Step 4: Scanning category folders...');
  const categoryFolders = fs.readdirSync(BASE_PATH)
    .filter(f => {
      const fullPath = path.join(BASE_PATH, f);
      return fs.statSync(fullPath).isDirectory() && CATEGORY_MAPPING[f];
    });

  console.log(`  📁 Found ${categoryFolders.length} category folders:\n`);
  for (const folder of categoryFolders) {
    const mapping = CATEGORY_MAPPING[folder];
    const folderPath = path.join(BASE_PATH, folder);
    const styleFolders = fs.readdirSync(folderPath)
      .filter(f => fs.statSync(path.join(folderPath, f)).isDirectory());
    console.log(`     ${folder}: ${styleFolders.length} styles → ${mapping.category} (${mapping.gender})`);
    stats.totalFolders += styleFolders.length;
  }
  console.log(`\n  📊 Total styles to import: ${stats.totalFolders}\n`);

  // Step 5: Import styles
  console.log('Step 5: Importing styles...\n');

  let processed = 0;
  const startTime = Date.now();

  for (const categoryFolder of categoryFolders) {
    const mapping = CATEGORY_MAPPING[categoryFolder];
    const categoryPath = path.join(BASE_PATH, categoryFolder);

    console.log(`\n📂 ${categoryFolder}:`);

    const styleFolders = fs.readdirSync(categoryPath)
      .filter(f => fs.statSync(path.join(categoryPath, f)).isDirectory())
      .sort();

    for (const styleCode of styleFolders) {
      // Check limit
      if (LIMIT && processed >= LIMIT) {
        console.log(`\n⚠️  Limit reached (${LIMIT} styles). Stopping.\n`);
        break;
      }

      await createStyle(styleCode, categoryFolder, mapping, customer.id);
      processed++;

      // Progress indicator every 100 styles
      if (processed % 100 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n   📊 Progress: ${processed}/${stats.totalFolders} (${elapsed}s elapsed)\n`);
      }
    }

    if (LIMIT && processed >= LIMIT) break;
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  // Step 5: Print summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  IMPORT SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`  📊 Total Folders Scanned: ${stats.totalFolders}`);
  console.log(`  ✅ Styles Created:        ${stats.stylesCreated}`);
  console.log(`  ⏭️  Styles Skipped:        ${stats.stylesSkipped}`);
  console.log(`  🖼️  Images Copied:         ${stats.imagesCopied}`);
  console.log(`  ❌ Errors:                ${stats.errors}`);
  console.log(`  ⏱️  Total Time:            ${totalTime}s`);

  if (stats.errorDetails.length > 0) {
    console.log('\n  ❌ Error Details:');
    for (const err of stats.errorDetails.slice(0, 10)) {
      console.log(`     - ${err.styleCode}: ${err.error}`);
    }
    if (stats.errorDetails.length > 10) {
      console.log(`     ... and ${stats.errorDetails.length - 10} more errors`);
    }
  }

  if (DRY_RUN) {
    console.log('\n  🔍 This was a DRY RUN. No changes were made.');
    console.log('     Run without --dry-run to actually import.\n');
  } else {
    console.log('\n  ✅ Import complete!');
    console.log('     You can now view styles in the UI at /styles\n');
  }
}

// ============================================
// Run Import
// ============================================

importStyles()
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
