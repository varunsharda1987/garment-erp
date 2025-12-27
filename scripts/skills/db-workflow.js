#!/usr/bin/env node
/**
 * Database Workflow Skill
 *
 * Unified database operations: migrate, seed, reset, and documentation generation.
 * Consolidates 4+ manual commands into single workflows.
 *
 * Usage:
 *   node scripts/skills/db-workflow.js [--setup|--migrate|--reset|--seed|--help]
 *
 * Modes:
 *   --setup    Full first-time setup (migrate + seed + docs)
 *   --migrate  Run migration + generate docs
 *   --reset    Reset database + migrate + seed
 *   --seed     Run all seed scripts
 *   --docs     Generate schema documentation only
 *   --help     Show usage information
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Execute command with output
 */
function exec(command, description) {
  console.log(`${colors.cyan}→${colors.reset} ${description}...`);
  try {
    execSync(command, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log(`${colors.green}✓${colors.reset} ${description} complete\n`);
    return true;
  } catch (error) {
    console.error(`${colors.red}✗${colors.reset} ${description} failed\n`);
    return false;
  }
}

/**
 * Check if Prisma is available
 */
function checkPrisma() {
  const schemaPath = path.join(process.cwd(), 'backend', 'prisma', 'schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    console.error(`${colors.red}Error: Prisma schema not found at ${schemaPath}${colors.reset}`);
    console.error('Make sure you run this from the project root directory.');
    return false;
  }
  return true;
}

/**
 * Full database setup (first-time use)
 */
function setup() {
  console.log(`\n${colors.bright}${colors.cyan}=== Database Setup ===${colors.reset}\n`);
  console.log('This will:');
  console.log('  1. Generate Prisma client');
  console.log('  2. Run migrations');
  console.log('  3. Seed all modules');
  console.log('  4. Generate schema documentation\n');

  if (!checkPrisma()) return false;

  let success = true;

  // Generate Prisma client
  success = exec(
    'cd backend && npx prisma generate',
    'Generating Prisma client'
  ) && success;

  // Run migrations
  success = exec(
    'cd backend && npx prisma migrate dev --name initial_setup',
    'Running database migrations'
  ) && success;

  // Seed all modules
  success = exec(
    'cd backend && npx ts-node scripts/seed-all-modules.ts',
    'Seeding all modules'
  ) && success;

  // Seed production data
  success = exec(
    'cd backend && npx ts-node scripts/seed-production-data.ts',
    'Seeding production data'
  ) && success;

  // Generate schema docs
  success = exec(
    'cd backend && node scripts/generate-schema-docs.js',
    'Generating schema documentation'
  ) && success;

  if (success) {
    console.log(`${colors.green}${colors.bright}✓ Database setup complete!${colors.reset}\n`);
  } else {
    console.log(`${colors.yellow}⚠ Database setup completed with errors${colors.reset}\n`);
  }

  return success;
}

/**
 * Run migration + generate docs
 */
function migrate() {
  console.log(`\n${colors.bright}${colors.cyan}=== Database Migration ===${colors.reset}\n`);

  if (!checkPrisma()) return false;

  let success = true;

  // Run migration
  success = exec(
    'cd backend && npx prisma migrate dev',
    'Running database migration'
  ) && success;

  // Generate schema docs
  success = exec(
    'cd backend && node scripts/generate-schema-docs.js',
    'Generating schema documentation'
  ) && success;

  if (success) {
    console.log(`${colors.green}${colors.bright}✓ Migration complete!${colors.reset}\n`);
  } else {
    console.log(`${colors.yellow}⚠ Migration completed with errors${colors.reset}\n`);
  }

  return success;
}

/**
 * Reset database + migrate + seed
 */
function reset() {
  console.log(`\n${colors.bright}${colors.yellow}=== Database Reset ===${colors.reset}\n`);
  console.log(`${colors.red}WARNING: This will delete all data!${colors.reset}\n`);
  console.log('This will:');
  console.log('  1. Reset database (delete all data)');
  console.log('  2. Run migrations');
  console.log('  3. Seed all modules');
  console.log('  4. Generate schema documentation\n');

  if (!checkPrisma()) return false;

  let success = true;

  // Reset database
  success = exec(
    'cd backend && npx prisma migrate reset --force',
    'Resetting database'
  ) && success;

  // Seed all modules
  success = exec(
    'cd backend && npx ts-node scripts/seed-all-modules.ts',
    'Seeding all modules'
  ) && success;

  // Seed production data
  success = exec(
    'cd backend && npx ts-node scripts/seed-production-data.ts',
    'Seeding production data'
  ) && success;

  // Generate schema docs
  success = exec(
    'cd backend && node scripts/generate-schema-docs.js',
    'Generating schema documentation'
  ) && success;

  if (success) {
    console.log(`${colors.green}${colors.bright}✓ Database reset complete!${colors.reset}\n`);
  } else {
    console.log(`${colors.yellow}⚠ Database reset completed with errors${colors.reset}\n`);
  }

  return success;
}

/**
 * Run seed scripts only
 */
function seed() {
  console.log(`\n${colors.bright}${colors.cyan}=== Database Seeding ===${colors.reset}\n`);

  if (!checkPrisma()) return false;

  let success = true;

  // Seed all modules
  success = exec(
    'cd backend && npx ts-node scripts/seed-all-modules.ts',
    'Seeding all modules'
  ) && success;

  // Seed production data
  success = exec(
    'cd backend && npx ts-node scripts/seed-production-data.ts',
    'Seeding production data'
  ) && success;

  if (success) {
    console.log(`${colors.green}${colors.bright}✓ Database seeding complete!${colors.reset}\n`);
  } else {
    console.log(`${colors.yellow}⚠ Database seeding completed with errors${colors.reset}\n`);
  }

  return success;
}

/**
 * Generate schema documentation only
 */
function generateDocs() {
  console.log(`\n${colors.bright}${colors.cyan}=== Schema Documentation ===${colors.reset}\n`);

  if (!checkPrisma()) return false;

  const success = exec(
    'cd backend && node scripts/generate-schema-docs.js',
    'Generating schema documentation'
  );

  if (success) {
    console.log(`${colors.green}${colors.bright}✓ Documentation generated!${colors.reset}\n`);
  }

  return success;
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
${colors.bright}Database Workflow Skill${colors.reset}

${colors.bright}Usage:${colors.reset}
  node scripts/skills/db-workflow.js [--setup|--migrate|--reset|--seed|--docs|--help]

${colors.bright}Modes:${colors.reset}
  --setup    Full first-time setup (migrate + seed + docs)
  --migrate  Run migration + generate docs (default)
  --reset    Reset database + migrate + seed (⚠ deletes all data!)
  --seed     Run all seed scripts only
  --docs     Generate schema documentation only
  --help     Show this help message

${colors.bright}Examples:${colors.reset}
  ${colors.cyan}# First-time setup${colors.reset}
  node scripts/skills/db-workflow.js --setup

  ${colors.cyan}# After schema changes${colors.reset}
  node scripts/skills/db-workflow.js --migrate

  ${colors.cyan}# Reset and start fresh${colors.reset}
  node scripts/skills/db-workflow.js --reset

  ${colors.cyan}# Just run seeds${colors.reset}
  node scripts/skills/db-workflow.js --seed

${colors.bright}What this replaces:${colors.reset}
  ${colors.yellow}Before (manual):${colors.reset}
    npx prisma migrate dev
    npx ts-node scripts/seed-all-modules.ts
    npx ts-node scripts/seed-production-data.ts
    node scripts/generate-schema-docs.js

  ${colors.green}After (automated):${colors.reset}
    node scripts/skills/db-workflow.js --setup

${colors.bright}Important:${colors.reset}
  - Always run from project root directory
  - --reset deletes ALL data (use with caution!)
  - Requires backend/prisma/schema.prisma to exist
  `);
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--migrate';

  switch (mode) {
    case '--setup':
      return setup() ? 0 : 1;

    case '--migrate':
      return migrate() ? 0 : 1;

    case '--reset':
      return reset() ? 0 : 1;

    case '--seed':
      return seed() ? 0 : 1;

    case '--docs':
      return generateDocs() ? 0 : 1;

    case '--help':
      showHelp();
      return 0;

    default:
      console.error(`${colors.red}Unknown mode: ${mode}${colors.reset}`);
      console.error('Use --help for usage information');
      return 1;
  }
}

// Run if executed directly
if (require.main === module) {
  const exitCode = main();
  process.exit(exitCode);
}

module.exports = { setup, migrate, reset, seed, generateDocs };
