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
 * Check for console.log statements
 */
function checkForConsoleLogs() {
  console.log(`${colors.bright}3. Checking for console.log statements...${colors.reset}`);

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
  const consoleCheckPassed = checkForConsoleLogs();

  allPassed = typeCheckPassed && typeSyncPassed;

  // console.log is warning only, doesn't block commit
  if (!consoleCheckPassed) {
    console.log(`${colors.yellow}⚠ Warning: console.log found (not blocking commit)${colors.reset}\n`);
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

module.exports = { main, checkConsoleLogs, getStagedFiles };
