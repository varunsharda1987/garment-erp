#!/usr/bin/env node
/**
 * Smart Check - Unified Auto-Detecting Hook
 *
 * ONE hook that automatically figures out what to check based on your changes.
 * No need to remember which hook does what - this does it all.
 *
 * Usage: Runs automatically on git commit via Husky
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for terminal output
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

// Get list of staged files
function getStagedFiles() {
  try {
    const result = execSync('git diff --cached --name-only', { encoding: 'utf-8' });
    return result.split('\n').filter(line => line.trim());
  } catch {
    return [];
  }
}

// Categorize files by type
function categorizeFiles(files) {
  return {
    schemas: files.filter(f => f.endsWith('.schema.ts')),
    controllers: files.filter(f => f.endsWith('.controller.ts')),
    types: files.filter(f => f.endsWith('.types.ts')),
    stockServices: files.filter(f => f.includes('stock') && f.endsWith('.service.ts')),
    docs: files.filter(f => f.startsWith('docs/') && f.endsWith('.md')),
    prisma: files.filter(f => f.includes('schema.prisma')),
    typescript: files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx')),
    routes: files.filter(f => f.endsWith('.routes.ts')),
  };
}

// ============================================================================
// CHECK FUNCTIONS
// ============================================================================

/**
 * Check: Schema-Controller naming matches
 */
function checkSchemaControllerSync() {
  console.log(`\n${c.cyan}Checking schema-controller sync...${c.reset}`);

  const controllersDir = path.join(process.cwd(), 'backend/src/controllers');
  const schemasDir = path.join(process.cwd(), 'backend/src/schemas');

  const issues = [];

  // Check pagination format in controllers
  const controllerFiles = fs.readdirSync(controllersDir).filter(f => f.endsWith('.controller.ts'));

  for (const file of controllerFiles) {
    const content = fs.readFileSync(path.join(controllersDir, file), 'utf8');

    // Find pagination objects with 'pages' instead of 'totalPages'
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('pages:') && lines[i].includes('Math.ceil') && !lines[i].includes('totalPages')) {
        issues.push({
          type: 'pagination',
          file,
          line: i + 1,
          message: `Uses "pages" instead of "totalPages"`,
        });
      }
    }
  }

  if (issues.length > 0) {
    console.log(`${c.red}  ✗ Found ${issues.length} issue(s):${c.reset}`);
    issues.forEach(issue => {
      console.log(`    ${issue.file}:${issue.line} - ${issue.message}`);
    });
    return false;
  }

  console.log(`${c.green}  ✓ Schema-controller sync OK${c.reset}`);
  return true;
}

/**
 * Check: Type synchronization between frontend and backend
 */
function checkTypeSync() {
  console.log(`\n${c.cyan}Checking type synchronization...${c.reset}`);

  try {
    execSync('node scripts/skills/sync-types.js --check', { encoding: 'utf-8', stdio: 'pipe' });
    console.log(`${c.green}  ✓ Types in sync${c.reset}`);
    return true;
  } catch (error) {
    console.log(`${c.yellow}  ⚠ Type sync issues detected${c.reset}`);
    console.log(`${c.dim}    Run: node scripts/skills/sync-types.js --report${c.reset}`);
    return true; // Warning only, don't block
  }
}

/**
 * Check: Stock services use material-sync helper
 */
function checkStockServicePattern(stockFiles) {
  console.log(`\n${c.cyan}Checking stock service pattern...${c.reset}`);

  const issues = [];

  for (const file of stockFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    if (!content.includes('material-sync.helper')) {
      issues.push(file);
    }
  }

  if (issues.length > 0) {
    console.log(`${c.yellow}  ⚠ Stock services missing material-sync.helper:${c.reset}`);
    issues.forEach(file => console.log(`    ${file}`));
    console.log(`${c.dim}    See CLAUDE.md "Stock Service Pattern" section${c.reset}`);
    return true; // Warning only
  }

  console.log(`${c.green}  ✓ Stock services OK${c.reset}`);
  return true;
}

/**
 * Check: No console.log in production code
 */
function checkConsoleLogs(tsFiles) {
  console.log(`\n${c.cyan}Checking for console.log...${c.reset}`);

  const issues = [];
  const excludePatterns = ['node_modules', '.test.', '.spec.', 'scripts/', 'hooks/'];

  for (const file of tsFiles) {
    if (excludePatterns.some(p => file.includes(p))) continue;

    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, i) => {
      if (line.includes('console.log') && !line.trim().startsWith('//')) {
        issues.push({ file, line: i + 1 });
      }
    });
  }

  if (issues.length > 0) {
    console.log(`${c.yellow}  ⚠ Found console.log (${issues.length} occurrences):${c.reset}`);
    issues.slice(0, 5).forEach(({ file, line }) => {
      console.log(`    ${file}:${line}`);
    });
    if (issues.length > 5) {
      console.log(`    ... and ${issues.length - 5} more`);
    }
    return true; // Warning only
  }

  console.log(`${c.green}  ✓ No console.log found${c.reset}`);
  return true;
}

/**
 * Check: Documentation links are valid
 */
function checkDocLinks(docFiles) {
  console.log(`\n${c.cyan}Checking documentation links...${c.reset}`);

  const brokenLinks = [];

  for (const file of docFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    const linkMatches = content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);

    for (const match of linkMatches) {
      const linkPath = match[2];

      // Skip external links and anchors
      if (linkPath.startsWith('http') || linkPath.startsWith('#')) continue;

      // Resolve relative path
      const resolvedPath = path.join(path.dirname(fullPath), linkPath.split('#')[0]);

      if (!fs.existsSync(resolvedPath)) {
        brokenLinks.push({ file, link: linkPath });
      }
    }
  }

  if (brokenLinks.length > 0) {
    console.log(`${c.red}  ✗ Broken links found:${c.reset}`);
    brokenLinks.forEach(({ file, link }) => {
      console.log(`    ${file}: ${link}`);
    });
    return false;
  }

  console.log(`${c.green}  ✓ Documentation links OK${c.reset}`);
  return true;
}

/**
 * Check: Prisma schema safety
 */
function checkPrismaSafety() {
  console.log(`\n${c.cyan}Checking Prisma schema safety...${c.reset}`);

  const schemaPath = path.join(process.cwd(), 'backend/prisma/schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    console.log(`${c.green}  ✓ No schema changes${c.reset}`);
    return true;
  }

  try {
    // Check for syntax errors
    execSync('cd backend && npx prisma format --check', { encoding: 'utf-8', stdio: 'pipe' });
  } catch {
    console.log(`${c.red}  ✗ Prisma schema has syntax errors${c.reset}`);
    console.log(`${c.dim}    Run: cd backend && npx prisma format${c.reset}`);
    return false;
  }

  // Check for destructive operations in diff
  try {
    const diff = execSync('git diff --cached backend/prisma/schema.prisma', { encoding: 'utf-8' });

    const destructivePatterns = [
      { pattern: /^-\s+\w+\s+\w+.*@id/m, message: 'Removing a primary key field' },
      { pattern: /^-model\s+\w+/m, message: 'Dropping a model/table' },
    ];

    for (const { pattern, message } of destructivePatterns) {
      if (pattern.test(diff)) {
        console.log(`${c.yellow}  ⚠ Potentially destructive: ${message}${c.reset}`);
      }
    }
  } catch {
    // No diff available
  }

  console.log(`${c.green}  ✓ Prisma schema OK${c.reset}`);
  return true;
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log(`\n${c.bright}${c.blue}═══════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.bright}${c.blue}       SMART CHECK - Auto-Detecting Hook            ${c.reset}`);
  console.log(`${c.bright}${c.blue}═══════════════════════════════════════════════════${c.reset}`);

  const stagedFiles = getStagedFiles();

  if (stagedFiles.length === 0) {
    console.log(`\n${c.yellow}No staged files. Nothing to check.${c.reset}\n`);
    return;
  }

  const categories = categorizeFiles(stagedFiles);

  // Show what was detected
  console.log(`\n${c.bright}Detected changes in:${c.reset}`);
  if (categories.schemas.length) console.log(`  ${c.cyan}•${c.reset} ${categories.schemas.length} schema file(s)`);
  if (categories.controllers.length) console.log(`  ${c.cyan}•${c.reset} ${categories.controllers.length} controller file(s)`);
  if (categories.types.length) console.log(`  ${c.cyan}•${c.reset} ${categories.types.length} type file(s)`);
  if (categories.stockServices.length) console.log(`  ${c.cyan}•${c.reset} ${categories.stockServices.length} stock service file(s)`);
  if (categories.docs.length) console.log(`  ${c.cyan}•${c.reset} ${categories.docs.length} documentation file(s)`);
  if (categories.prisma.length) console.log(`  ${c.cyan}•${c.reset} Prisma schema`);
  if (categories.routes.length) console.log(`  ${c.cyan}•${c.reset} ${categories.routes.length} route file(s)`);

  let allPassed = true;
  let checksRun = 0;

  // Run relevant checks based on what changed

  // Schema or Controller changes → check sync
  if (categories.schemas.length || categories.controllers.length || categories.routes.length) {
    checksRun++;
    if (!checkSchemaControllerSync()) allPassed = false;
  }

  // Type file changes → check type sync
  if (categories.types.length) {
    checksRun++;
    checkTypeSync(); // Warning only
  }

  // Stock service changes → check pattern
  if (categories.stockServices.length) {
    checksRun++;
    checkStockServicePattern(categories.stockServices);
  }

  // Any TypeScript changes → check console.log
  if (categories.typescript.length) {
    checksRun++;
    checkConsoleLogs(categories.typescript);
  }

  // Documentation changes → check links
  if (categories.docs.length) {
    checksRun++;
    if (!checkDocLinks(categories.docs)) allPassed = false;
  }

  // Prisma schema changes → check safety
  if (categories.prisma.length) {
    checksRun++;
    if (!checkPrismaSafety()) allPassed = false;
  }

  // Summary
  console.log(`\n${c.bright}${c.blue}═══════════════════════════════════════════════════${c.reset}`);

  if (checksRun === 0) {
    console.log(`${c.dim}No specific checks needed for these file types.${c.reset}`);
    console.log(`${c.green}✓ Commit allowed${c.reset}\n`);
    return;
  }

  if (allPassed) {
    console.log(`${c.green}${c.bright}✓ All ${checksRun} check(s) passed!${c.reset}`);
    console.log(`${c.green}✓ Commit allowed${c.reset}\n`);
  } else {
    console.log(`${c.red}${c.bright}✗ Some checks failed${c.reset}`);
    console.log(`${c.red}✗ Fix the issues above before committing${c.reset}\n`);
    process.exit(1);
  }
}

main();
