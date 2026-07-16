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

// --- Stock-sync enforcement (bug-hunt BH-0333/BH-0338) --------------------------------
// The old check only looked at *stock*.service.ts, so it missed every controller and any
// service whose name lacks "stock" — which is how the ledger corruption slipped in. Detect
// stock-table writes by CONTENT instead, across all backend .ts files, and BLOCK new ones.
// A baseline grandfathers the existing violations so this can enforce without a big-bang fix.
const STOCK_WRITE_RE =
  /\b(?:prisma|tx)\.(greige_stock|fabric_stock|lace_stock|thread_stock|button_stock|zipper_stock|elastic_stock|label_stock|packaging_stock|stock_levels)\.(create|update|updateMany|createMany|upsert|delete|deleteMany)\b/;
// A file that writes a stock table is fine if it also uses one of the sanctioned sync paths.
const SYNC_MARKERS = ['material-sync.helper', 'stock-routing.helper', 'syncStockLevelQuantity', 'routeToSpecializedStock'];

function writesStockTableWithoutSync(content) {
  return STOCK_WRITE_RE.test(content) && !SYNC_MARKERS.some(m => content.includes(m));
}

function loadStockSyncBaseline() {
  try {
    const p = path.join(process.cwd(), 'scripts/hooks/stock-sync-baseline.json');
    return new Set(JSON.parse(fs.readFileSync(p, 'utf8')));
  } catch {
    return new Set();
  }
}

// Categorize files by type
function categorizeFiles(files) {
  return {
    schemas: files.filter(f => f.endsWith('.schema.ts')),
    controllers: files.filter(f => f.endsWith('.controller.ts')),
    types: files.filter(f => f.endsWith('.types.ts')),
    stockServices: files.filter(f => f.includes('stock') && f.endsWith('.service.ts')),
    backendTs: files.filter(f => f.startsWith('backend/') && f.endsWith('.ts') && !f.endsWith('.test.ts')),
    docs: files.filter(f => f.startsWith('docs/') && f.endsWith('.md')),
    prisma: files.filter(f => f.includes('schema.prisma')),
    typescript: files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx')),
    routes: files.filter(f => f.endsWith('.routes.ts')),
    frontend: files.filter(f => f.startsWith('frontend/') && (f.endsWith('.ts') || f.endsWith('.tsx'))),
  };
}

// ============================================================================
// CHECK FUNCTIONS
// ============================================================================

/**
 * Check: Schema-Controller naming matches (basic pagination check)
 */
function checkSchemaControllerSync() {
  console.log(`\n${c.cyan}Checking schema-controller sync...${c.reset}`);

  const controllersDir = path.join(process.cwd(), 'backend/src/controllers');

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
 * Check: Schema-Controller field alignment
 * Runs the full alignment checker to detect Zod schema vs controller destructuring mismatches.
 * Prevents silent data loss from Zod stripping unknown fields.
 */
function checkSchemaControllerAlignment() {
  console.log(`\n${c.cyan}Checking schema-controller field alignment...${c.reset}`);

  try {
    // Run the alignment script in check mode
    execSync('node scripts/hooks/check-schema-controller-alignment.js --check', {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    console.log(`${c.green}  ✓ Schema-controller fields aligned${c.reset}`);
    return true;
  } catch (error) {
    // Script exited with non-zero (critical mismatches found)
    console.log(`${c.yellow}  ⚠ Schema-controller field mismatches detected${c.reset}`);
    console.log(`${c.dim}    Run: node scripts/hooks/check-schema-controller-alignment.js --report${c.reset}`);
    // Return true (warning only) - don't block commits for now since there are legacy mismatches
    // Once all mismatches are fixed, change this to return false to enforce
    return true;
  }
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
function checkStockServicePattern(backendFiles) {
  console.log(`\n${c.cyan}Checking stock-sync pattern (any stock-table write must keep stock_levels in sync)...${c.reset}`);

  const baseline = loadStockSyncBaseline();
  const newViolations = [];
  const grandfathered = [];

  for (const file of backendFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    if (writesStockTableWithoutSync(content)) {
      (baseline.has(file) ? grandfathered : newViolations).push(file);
    }
  }

  if (grandfathered.length > 0) {
    console.log(`${c.yellow}  ⚠ ${grandfathered.length} known unsynced stock file(s) (grandfathered — fix when you touch them):${c.reset}`);
    grandfathered.forEach(file => console.log(`${c.dim}    ${file}${c.reset}`));
  }

  if (newViolations.length > 0) {
    console.log(`${c.red}  ✗ Stock-table write with NO sync — call syncStockLevelQuantity / routeToSpecializedStock:${c.reset}`);
    newViolations.forEach(file => console.log(`${c.red}    ${file}${c.reset}`));
    console.log(`${c.dim}    See CLAUDE.md "Stock Service Pattern". If this is genuinely intentional, add the file to scripts/hooks/stock-sync-baseline.json.${c.reset}`);
    return false; // BLOCK new violations
  }

  if (grandfathered.length === 0) {
    console.log(`${c.green}  ✓ Stock-sync OK${c.reset}`);
  }
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
 * Check: Frontend serializer mismatches (wrong camelCase fallbacks)
 * The backend serializer converts snake_case to specific camelCase names.
 * Using wrong fallbacks like `styleComponents` instead of `components` is a bug.
 */
function checkFrontendSerializerMismatch(frontendFiles) {
  console.log(`\n${c.cyan}Checking frontend serializer patterns...${c.reset}`);

  // Wrong patterns that indicate serializer confusion
  const wrongPatterns = [
    { pattern: /\.styleComponents/g, correct: '.components', reason: 'style_components → components' },
    { pattern: /\.styleFabrics(?!Flat)/g, correct: '.fabrics', reason: 'style_fabrics → fabrics' },
    { pattern: /\.styleFabricsFlat/g, correct: '.fabrics', reason: 'styleFabricsFlat doesn\'t exist' },
    { pattern: /\.styleProcesses/g, correct: '.processes', reason: 'style_processes → processes' },
    { pattern: /\.styleVariants/g, correct: '.variants', reason: 'style_variants → variants' },
    { pattern: /\.brand_categories/g, correct: '.brandCategories', reason: 'snake_case in frontend' },
    { pattern: /\.style_components/g, correct: '.components', reason: 'snake_case in frontend' },
    { pattern: /\.style_fabrics/g, correct: '.fabrics', reason: 'snake_case in frontend' },
    { pattern: /\.color_options/g, correct: '.colorOptions', reason: 'snake_case in frontend' },
    { pattern: /\.size_options/g, correct: '.sizeOptions', reason: 'snake_case in frontend' },
  ];

  const issues = [];

  for (const file of frontendFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comments and imports
      if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.includes('import ')) continue;

      for (const { pattern, correct, reason } of wrongPatterns) {
        if (pattern.test(line)) {
          issues.push({
            file,
            line: i + 1,
            found: pattern.source.replace(/\\/g, ''),
            correct,
            reason,
          });
        }
        // Reset regex lastIndex for global patterns
        pattern.lastIndex = 0;
      }
    }
  }

  if (issues.length > 0) {
    console.log(`${c.yellow}  ⚠ Frontend serializer mismatches (${issues.length}):${c.reset}`);
    issues.slice(0, 5).forEach(({ file, line, found, correct, reason }) => {
      console.log(`    ${file}:${line}`);
      console.log(`      ${c.dim}Found: ${found} → Should be: ${correct}${c.reset}`);
      console.log(`      ${c.dim}Reason: ${reason}${c.reset}`);
    });
    if (issues.length > 5) {
      console.log(`    ... and ${issues.length - 5} more`);
    }
    return true; // Warning only for now
  }

  console.log(`${c.green}  ✓ Frontend serializer patterns OK${c.reset}`);
  return true;
}

/**
 * Check: Controller response structure consistency
 * - POST/201 responses should have `data` wrapper and `message`
 * - Pagination should use `totalPages` not `pages` or `offset`
 */
function checkResponseStructure(controllerFiles) {
  console.log(`\n${c.cyan}Checking response structure...${c.reset}`);

  const issues = [];
  const controllersDir = path.join(process.cwd(), 'backend/src/controllers');

  for (const file of controllerFiles) {
    const fullPath = path.join(controllersDir, path.basename(file));
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for bare object response (no data wrapper) on 201
      // Multi-line aware: check next few lines for data: wrapper
      if (line.includes('res.status(201).json(')) {
        const nextLines = lines.slice(i, i + 5).join(' ');
        if (!nextLines.includes('data:') && !nextLines.includes('{ data')) {
          issues.push({
            file: path.basename(file),
            line: i + 1,
            type: 'bare-response',
            message: 'POST 201 without data wrapper',
          });
        }
      }

      // Check for pagination using offset instead of page
      if (line.includes('pagination') && line.includes('offset:') && !line.includes('// legacy')) {
        issues.push({
          file: path.basename(file),
          line: i + 1,
          type: 'offset-pagination',
          message: 'Uses offset instead of page for pagination',
        });
      }
    }
  }

  if (issues.length > 0) {
    console.log(`${c.yellow}  ⚠ Response structure issues (${issues.length}):${c.reset}`);
    issues.forEach(({ file, line, message }) => {
      console.log(`    ${file}:${line} - ${message}`);
    });
    return true; // Warning only
  }

  console.log(`${c.green}  ✓ Response structure OK${c.reset}`);
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
  if (categories.frontend.length) console.log(`  ${c.cyan}•${c.reset} ${categories.frontend.length} frontend file(s)`);

  let allPassed = true;
  let checksRun = 0;

  // Run relevant checks based on what changed

  // Schema or Controller changes → check sync
  if (categories.schemas.length || categories.controllers.length || categories.routes.length) {
    checksRun++;
    if (!checkSchemaControllerSync()) allPassed = false;
    // Also run full field alignment check
    checkSchemaControllerAlignment(); // Warning only for now
  }

  // Type file changes → check type sync
  if (categories.types.length) {
    checksRun++;
    checkTypeSync(); // Warning only
  }

  // Backend .ts changes → enforce stock-sync (blocks NEW stock-table writes that don't sync)
  if (categories.backendTs.length) {
    checksRun++;
    if (!checkStockServicePattern(categories.backendTs)) allPassed = false;
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

  // Frontend changes → check serializer patterns
  if (categories.frontend.length) {
    checksRun++;
    checkFrontendSerializerMismatch(categories.frontend);
  }

  // Controller changes → check response structure
  if (categories.controllers.length) {
    checksRun++;
    checkResponseStructure(categories.controllers);
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
