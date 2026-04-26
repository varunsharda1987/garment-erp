#!/usr/bin/env node
/**
 * Pre-Commit Hook
 *
 * Quality gates before allowing commits.
 * Ensures code quality, type safety, and consistency.
 *
 * Checks:
 * - TypeScript type checking (tsc --noEmit)
 * - Type synchronization validation
 * - No console.log in production code
 * - Commit message format (if applicable)
 * - Run affected tests (optional)
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
 * Get staged files
 */
function getStagedFiles() {
  try {
    const result = execSync('git diff --cached --name-only', { encoding: 'utf-8' });
    return result.split('\n').filter(line => line.trim());
  } catch (error) {
    return [];
  }
}

/**
 * Check for console.log in staged files
 */
function checkConsoleLogs() {
  const stagedFiles = getStagedFiles();
  const codeFiles = stagedFiles.filter(file =>
    (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) &&
    !file.includes('node_modules') &&
    !file.includes('.test.') &&
    !file.includes('.spec.') &&
    !file.includes('scripts/') &&
    !file.includes('skills/') &&
    !file.includes('hooks/')
  );

  const filesWithConsole = [];

  for (const file of codeFiles) {
    if (!fs.existsSync(file)) continue;

    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      if (line.includes('console.log') && !line.trim().startsWith('//')) {
        filesWithConsole.push({
          file,
          line: index + 1,
          content: line.trim()
        });
      }
    });
  }

  return filesWithConsole;
}

/**
 * Run TypeScript type checking (incremental)
 */
function runTypeCheck() {
  console.log(`${colors.bright}1. Running TypeScript type checking...${colors.reset}`);

  // Check backend
  const backendResult = exec('cd backend && npx tsc --noEmit', true);
  if (!backendResult.success) {
    console.log(`${colors.red}✗ Backend TypeScript errors found${colors.reset}`);
    console.log(backendResult.output);
    return false;
  }

  // Check frontend
  const frontendResult = exec('cd frontend && npx tsc --noEmit', true);
  if (!frontendResult.success) {
    console.log(`${colors.red}✗ Frontend TypeScript errors found${colors.reset}`);
    console.log(frontendResult.output);
    return false;
  }

  console.log(`${colors.green}✓ TypeScript type checking passed${colors.reset}\n`);
  return true;
}

/**
 * Validate type synchronization
 */
function validateTypeSync() {
  console.log(`${colors.bright}2. Validating type synchronization...${colors.reset}`);

  const result = exec('node scripts/skills/sync-types.js --check', true);

  if (!result.success) {
    console.log(`${colors.yellow}⚠ Type synchronization issues detected${colors.reset}`);
    console.log(`${colors.cyan}Run: node scripts/skills/sync-types.js --report for details${colors.reset}\n`);
    return false;
  }

  console.log(`${colors.green}✓ Type synchronization validated${colors.reset}\n`);
  return true;
}

/**
 * Validate schema-controller sync and pagination format
 */
function validateSchemaControllerSync() {
  console.log(`${colors.bright}3. Validating schema-controller sync...${colors.reset}`);

  const result = exec('node scripts/hooks/check-schema-controller-sync.js', true);

  if (!result.success) {
    console.log(`${colors.red}✗ Schema-controller sync issues found${colors.reset}`);
    console.log(result.output);
    return false;
  }

  console.log(`${colors.green}✓ Schema-controller sync validated${colors.reset}\n`);
  return true;
}

/**
 * Check schema-controller field alignment (comprehensive)
 * Currently warning-only until all legacy mismatches are fixed
 */
function checkSchemaControllerAlignment() {
  console.log(`${colors.bright}3b. Checking schema-controller field alignment...${colors.reset}`);

  const result = exec('node scripts/hooks/check-schema-controller-alignment.js --check', true);

  if (!result.success) {
    console.log(`${colors.yellow}⚠ Schema-controller field alignment issues found${colors.reset}`);
    console.log(`${colors.cyan}Run: node scripts/hooks/check-schema-controller-alignment.js --report for details${colors.reset}`);
    console.log(`${colors.yellow}(Warning only - not blocking commit until legacy issues are fixed)${colors.reset}\n`);
    return false; // Return false but don't block commit
  }

  console.log(`${colors.green}✓ Schema-controller field alignment validated${colors.reset}\n`);
  return true;
}

/**
 * Check for new routes being added - warns about duplicate prevention
 */
function checkNewRoutes() {
  const stagedFiles = getStagedFiles();
  const routeFiles = stagedFiles.filter(f =>
    f.includes('backend/src/routes/') && f.endsWith('.ts')
  );

  if (routeFiles.length === 0) return { hasNewRoutes: false, files: [] };

  const newRoutes = [];

  for (const file of routeFiles) {
    try {
      // Get the diff for this file
      const diff = execSync(`git diff --cached ${file}`, { encoding: 'utf-8' });

      // Find new router.get/post/put/patch/delete lines
      const addedRoutes = diff.match(/^\+.*router\.(get|post|put|patch|delete)\(['"][^'"]+['"]/gm);

      if (addedRoutes && addedRoutes.length > 0) {
        newRoutes.push({
          file,
          routes: addedRoutes.map(r => r.replace(/^\+\s*/, '').trim())
        });
      }
    } catch (e) {
      // File might not exist or git diff failed
    }
  }

  return { hasNewRoutes: newRoutes.length > 0, files: newRoutes };
}

/**
 * Check for console.log statements
 */
function checkForConsoleLogs() {
  console.log(`${colors.bright}4. Checking for console.log statements...${colors.reset}`);

  const filesWithConsole = checkConsoleLogs();

  if (filesWithConsole.length > 0) {
    console.log(`${colors.yellow}⚠ Found console.log in production code:${colors.reset}`);
    filesWithConsole.forEach(({ file, line, content }) => {
      console.log(`  ${file}:${line}`);
      console.log(`    ${colors.cyan}${content}${colors.reset}`);
    });
    console.log(`${colors.yellow}Consider removing console.log statements before committing${colors.reset}\n`);
    return false;
  }

  console.log(`${colors.green}✓ No console.log found${colors.reset}\n`);
  return true;
}

/**
 * Main hook execution
 */
function main() {
  console.log(`\n${colors.bright}${colors.cyan}=== Pre-Commit Quality Gates ===${colors.reset}\n`);

  const stagedFiles = getStagedFiles();

  if (stagedFiles.length === 0) {
    console.log(`${colors.yellow}No staged files. Nothing to check.${colors.reset}\n`);
    return;
  }

  console.log(`${colors.bright}Staged files: ${stagedFiles.length}${colors.reset}\n`);

  let allPassed = true;

  // Run checks
  const typeCheckPassed = runTypeCheck();
  const typeSyncPassed = validateTypeSync();
  const schemaControllerPassed = validateSchemaControllerSync();
  const schemaAlignmentPassed = checkSchemaControllerAlignment(); // Warning only for now
  const consoleCheckPassed = checkForConsoleLogs();

  // Schema alignment is warning-only until legacy issues fixed
  allPassed = typeCheckPassed && typeSyncPassed && schemaControllerPassed;
  // TODO: Add schemaAlignmentPassed to allPassed once legacy mismatches are fixed

  // console.log is warning only, doesn't block commit
  if (!consoleCheckPassed) {
    console.log(`${colors.yellow}⚠ Warning: console.log found (not blocking commit)${colors.reset}\n`);
  }

  // Check stock service pattern compliance (warning only)
  const stockFiles = stagedFiles.filter(f => f.includes('stock') && f.endsWith('.service.ts') && f.includes('backend'));
  for (const file of stockFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      if (!content.includes('material-sync.helper')) {
        console.log(`${colors.yellow}⚠ Stock service pattern: ${file} does not import material-sync.helper.${colors.reset}`);
        console.log(`  Stock services MUST use ensureMaterialRecord() + syncStockLevelQuantity() for data consistency.`);
        console.log(`  See CLAUDE.md "Stock Service Pattern" section.\n`);
      }
    } catch (e) {
      // File might not exist in working tree
    }
  }

  // Check for new routes being added - warn about duplicate prevention
  const { hasNewRoutes, files: routeChanges } = checkNewRoutes();
  if (hasNewRoutes) {
    console.log(`${colors.yellow}${colors.bright}⚠️  New API Routes Detected:${colors.reset}\n`);
    for (const { file, routes } of routeChanges) {
      console.log(`  ${colors.cyan}${file}${colors.reset}`);
      for (const route of routes) {
        console.log(`    + ${route}`);
      }
    }
    console.log(`\n${colors.yellow}${colors.bright}BEFORE committing new endpoints:${colors.reset}`);
    console.log(`  1. Search for existing similar endpoints:`);
    console.log(`     ${colors.cyan}node scripts/skills/api-docs.js --find "<keyword>"${colors.reset}`);
    console.log(`  2. Verify no duplicate functionality exists`);
    console.log(`  3. Document in reference_endpoint_duplicates.md if needed\n`);
  }

  if (!allPassed) {
    console.log(`${colors.red}✗ Pre-commit checks failed${colors.reset}`);
    console.log(`${colors.cyan}Fix the issues above before committing${colors.reset}\n`);
    process.exit(1);
  }

  console.log(`${colors.green}✓ All pre-commit checks passed${colors.reset}\n`);
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { main, checkConsoleLogs, getStagedFiles, checkNewRoutes };
