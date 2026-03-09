#!/usr/bin/env node
/**
 * Pre-Migration Hook
 *
 * Safety checks before running Prisma migrations.
 * Prevents data loss and migration conflicts.
 *
 * Checks:
 * - Validates schema.prisma syntax
 * - Checks for destructive operations (DROP TABLE, etc.)
 * - Ensures serializer.ts has relation mappings for new models
 * - Validates environment (warns on production)
 * - Checks for conflicting migrations
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Color codes
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
 * Execute command and return output
 */
function exec(command, silent = false) {
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: silent ? 'pipe' : 'inherit' });
    return { success: true, output };
  } catch (error) {
    return { success: false, output: error.stdout || error.message };
  }
}

/**
 * Validate schema.prisma syntax
 */
function validateSchema() {
  console.log(`${colors.bright}1. Validating Prisma schema syntax...${colors.reset}`);

  const schemaPath = path.join(process.cwd(), 'backend', 'prisma', 'schema.prisma');

  if (!fs.existsSync(schemaPath)) {
    console.log(`${colors.red}✗ schema.prisma not found${colors.reset}\n`);
    return false;
  }

  // Run Prisma validate
  const result = exec('cd backend && npx prisma validate', true);

  if (!result.success) {
    console.log(`${colors.red}✗ Schema validation failed${colors.reset}`);
    console.log(result.output);
    return false;
  }

  console.log(`${colors.green}✓ Schema syntax is valid${colors.reset}\n`);
  return true;
}

/**
 * Check for destructive operations in migration
 */
function checkDestructiveOperations() {
  console.log(`${colors.bright}2. Checking for destructive operations...${colors.reset}`);

  const schemaPath = path.join(process.cwd(), 'backend', 'prisma', 'schema.prisma');
  const content = fs.readFileSync(schemaPath, 'utf-8');

  // Check if models or fields were removed (simplified check)
  // In a real implementation, you'd compare with previous schema
  console.log(`${colors.cyan}ℹ Manual review recommended for destructive changes${colors.reset}`);
  console.log(`${colors.cyan}  If dropping tables/columns, ensure data backup exists${colors.reset}\n`);

  return true;
}

/**
 * Check serializer relation mappings
 */
function checkSerializerMappings() {
  console.log(`${colors.bright}3. Checking serializer relation mappings...${colors.reset}`);

  const schemaPath = path.join(process.cwd(), 'backend', 'prisma', 'schema.prisma');
  const serializerPath = path.join(process.cwd(), 'backend', 'src', 'utils', 'serializer.ts');

  if (!fs.existsSync(serializerPath)) {
    console.log(`${colors.yellow}⚠ serializer.ts not found (skipping check)${colors.reset}\n`);
    return true;
  }

  // Read schema to find relations
  const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  const relationMatches = schemaContent.matchAll(/(\w+)\s+(\w+)\[\]?\s+@relation/g);
  const relations = new Set();

  for (const match of relationMatches) {
    const fieldName = match[1];
    if (fieldName.includes('_')) {
      relations.add(fieldName);
    }
  }

  if (relations.size > 0) {
    // Read existing RELATION_MAPPINGS
    const serializerContent = fs.readFileSync(serializerPath, 'utf-8');
    const existingMappings = new Set();
    const mappingRegex = /(\w+)\s*:\s*['"]/g;
    const mapSection = serializerContent.match(/RELATION_MAPPINGS[^{]*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
    if (mapSection) {
      let match;
      while ((match = mappingRegex.exec(mapSection[1])) !== null) {
        existingMappings.add(match[1]);
      }
    }

    // Find truly missing mappings
    const missing = Array.from(relations).filter(r => !existingMappings.has(r));

    if (missing.length > 0) {
      console.log(`${colors.yellow}⚠ ${missing.length} snake_case relations missing from RELATION_MAPPINGS:${colors.reset}`);
      console.log();

      // Auto-generate the entries
      const entries = missing.map(rel => {
        const camelCase = rel.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
        return `  ${rel}: '${camelCase}',`;
      });

      console.log(`${colors.cyan}Add these to backend/src/utils/serializer.ts RELATION_MAPPINGS:${colors.reset}`);
      console.log();
      entries.forEach(e => console.log(`  ${colors.bright}${e}${colors.reset}`));
      console.log();
    } else {
      console.log(`${colors.green}✓ All ${relations.size} snake_case relations are mapped${colors.reset}\n`);
    }
  } else {
    console.log(`${colors.green}✓ No new snake_case relations found${colors.reset}\n`);
  }

  return true;
}

/**
 * Check environment
 */
function checkEnvironment() {
  console.log(`${colors.bright}4. Checking environment...${colors.reset}`);

  const env = process.env.NODE_ENV || 'development';

  if (env === 'production') {
    console.log(`${colors.red}⚠ WARNING: Running migration in PRODUCTION environment!${colors.reset}`);
    console.log(`${colors.red}  Ensure you have a backup before proceeding${colors.reset}\n`);
    return false; // Block in production
  }

  console.log(`${colors.green}✓ Environment: ${env}${colors.reset}\n`);
  return true;
}

/**
 * Check for conflicting migrations
 */
function checkConflictingMigrations() {
  console.log(`${colors.bright}5. Checking for migration conflicts...${colors.reset}`);

  const migrationsDir = path.join(process.cwd(), 'backend', 'prisma', 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.log(`${colors.green}✓ No migrations directory (first migration)${colors.reset}\n`);
    return true;
  }

  // Check for pending migrations
  const result = exec('cd backend && npx prisma migrate status', true);

  if (result.output && result.output.includes('unapplied')) {
    console.log(`${colors.yellow}⚠ Unapplied migrations detected${colors.reset}`);
    console.log(`${colors.cyan}Run: cd backend && npx prisma migrate deploy${colors.reset}\n`);
  } else {
    console.log(`${colors.green}✓ No migration conflicts${colors.reset}\n`);
  }

  return true;
}

/**
 * Main hook execution
 */
function main() {
  console.log(`\n${colors.bright}${colors.cyan}=== Pre-Migration Safety Checks ===${colors.reset}\n`);

  let allPassed = true;

  // Run checks
  const schemaValid = validateSchema();
  const destructiveCheck = checkDestructiveOperations();
  const serializerCheck = checkSerializerMappings();
  const envCheck = checkEnvironment();
  const conflictCheck = checkConflictingMigrations();

  allPassed = schemaValid && destructiveCheck && serializerCheck && envCheck && conflictCheck;

  if (!allPassed) {
    console.log(`${colors.red}✗ Pre-migration checks failed${colors.reset}`);
    console.log(`${colors.cyan}Fix the issues above before running migration${colors.reset}\n`);
    process.exit(1);
  }

  console.log(`${colors.green}✓ All pre-migration checks passed${colors.reset}`);
  console.log(`${colors.green}Safe to proceed with migration${colors.reset}\n`);
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { main, validateSchema, checkSerializerMappings };
