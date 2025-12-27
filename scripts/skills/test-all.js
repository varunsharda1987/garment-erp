#!/usr/bin/env node
/**
 * Unified Test Orchestration Skill
 *
 * Runs frontend E2E (Playwright) + backend unit/integration (Jest) tests.
 * Generates combined coverage report and cleans up artifacts.
 *
 * Usage:
 *   node scripts/skills/test-all.js [--all|--e2e|--backend|--coverage|--clean|--help]
 *
 * Modes:
 *   --all       Run all tests (E2E + backend unit + integration) [default]
 *   --e2e       Run frontend E2E tests only
 *   --backend   Run backend tests only (unit + integration)
 *   --coverage  Run all tests with coverage reports
 *   --clean     Clean up test artifacts only
 *   --help      Show usage information
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
function exec(command, description, optional = false) {
  console.log(`${colors.cyan}→${colors.reset} ${description}...`);
  try {
    execSync(command, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log(`${colors.green}✓${colors.reset} ${description} complete\n`);
    return { success: true, error: null };
  } catch (error) {
    if (optional) {
      console.log(`${colors.yellow}⚠${colors.reset} ${description} skipped\n`);
      return { success: false, error, optional: true };
    } else {
      console.error(`${colors.red}✗${colors.reset} ${description} failed\n`);
      return { success: false, error };
    }
  }
}

/**
 * Clean up test artifacts
 */
function cleanArtifacts() {
  console.log(`\n${colors.bright}${colors.cyan}=== Cleaning Test Artifacts ===${colors.reset}\n`);

  const artifactDirs = [
    'frontend/test-results',
    'frontend/playwright-report',
    'backend/coverage',
    'frontend/coverage',
  ];

  let cleaned = 0;
  for (const dir of artifactDirs) {
    const fullPath = path.join(process.cwd(), dir);
    if (fs.existsSync(fullPath)) {
      try {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`${colors.green}✓${colors.reset} Removed ${dir}`);
        cleaned++;
      } catch (error) {
        console.log(`${colors.yellow}⚠${colors.reset} Could not remove ${dir}`);
      }
    }
  }

  if (cleaned > 0) {
    console.log(`\n${colors.green}${colors.bright}✓ Cleaned ${cleaned} artifact director${cleaned === 1 ? 'y' : 'ies'}${colors.reset}\n`);
  } else {
    console.log(`\n${colors.cyan}No artifacts to clean${colors.reset}\n`);
  }

  return true;
}

/**
 * Run frontend E2E tests
 */
function runE2ETests(coverage = false) {
  console.log(`\n${colors.bright}${colors.cyan}=== Frontend E2E Tests (Playwright) ===${colors.reset}\n`);

  const results = {
    foundation: null,
    masters: null,
    transactions: null,
    integration: null,
  };

  // Run each test suite
  results.foundation = exec(
    'cd frontend && npm run test:e2e:foundation',
    'Running foundation tests',
    true
  );

  results.masters = exec(
    'cd frontend && npm run test:e2e:masters',
    'Running masters tests',
    true
  );

  results.transactions = exec(
    'cd frontend && npm run test:e2e:transactions',
    'Running transactions tests',
    true
  );

  results.integration = exec(
    'cd frontend && npm run test:e2e:integration',
    'Running integration tests',
    true
  );

  // Summary
  const passed = Object.values(results).filter(r => r.success).length;
  const failed = Object.values(results).filter(r => !r.success && !r.optional).length;
  const skipped = Object.values(results).filter(r => r.optional && !r.success).length;

  console.log(`${colors.bright}E2E Test Summary:${colors.reset}`);
  console.log(`  Passed:  ${colors.green}${passed}${colors.reset}`);
  console.log(`  Failed:  ${colors.red}${failed}${colors.reset}`);
  console.log(`  Skipped: ${colors.yellow}${skipped}${colors.reset}\n`);

  return failed === 0;
}

/**
 * Run backend tests
 */
function runBackendTests(coverage = false) {
  console.log(`\n${colors.bright}${colors.cyan}=== Backend Tests (Jest) ===${colors.reset}\n`);

  let success = true;

  // Run unit tests
  const unitResult = exec(
    `cd backend && npm run test:unit${coverage ? ' -- --coverage' : ''}`,
    'Running unit tests'
  );
  success = unitResult.success && success;

  // Run integration tests
  const integrationResult = exec(
    `cd backend && npm run test:integration${coverage ? ' -- --coverage' : ''}`,
    'Running integration tests',
    true
  );
  success = integrationResult.success && success;

  return success;
}

/**
 * Run all tests
 */
function runAllTests(coverage = false) {
  console.log(`\n${colors.bright}${colors.cyan}=== Running All Tests ===${colors.reset}\n`);
  console.log('This will run:');
  console.log('  1. Frontend E2E tests (Playwright)');
  console.log('  2. Backend unit tests (Jest)');
  console.log('  3. Backend integration tests (Jest)');
  if (coverage) {
    console.log('  4. Generate coverage reports\n');
  } else {
    console.log('');
  }

  let allSuccess = true;

  // Run E2E tests
  const e2eSuccess = runE2ETests(coverage);
  allSuccess = e2eSuccess && allSuccess;

  // Run backend tests
  const backendSuccess = runBackendTests(coverage);
  allSuccess = backendSuccess && allSuccess;

  // Final summary
  console.log(`\n${colors.bright}${colors.cyan}=== Final Summary ===${colors.reset}\n`);
  if (allSuccess) {
    console.log(`${colors.green}${colors.bright}✓ All tests passed!${colors.reset}\n`);
  } else {
    console.log(`${colors.yellow}⚠ Some tests failed or were skipped${colors.reset}\n`);
  }

  if (coverage) {
    console.log(`${colors.cyan}Coverage reports:${colors.reset}`);
    console.log(`  Backend: backend/coverage/index.html`);
    console.log(`  Frontend: frontend/coverage/index.html\n`);
  }

  return allSuccess;
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
${colors.bright}Unified Test Orchestration Skill${colors.reset}

${colors.bright}Usage:${colors.reset}
  node scripts/skills/test-all.js [--all|--e2e|--backend|--coverage|--clean|--help]

${colors.bright}Modes:${colors.reset}
  --all       Run all tests (E2E + backend) [default]
  --e2e       Run frontend E2E tests only
  --backend   Run backend tests only (unit + integration)
  --coverage  Run all tests with coverage reports
  --clean     Clean up test artifacts only
  --help      Show this help message

${colors.bright}Examples:${colors.reset}
  ${colors.cyan}# Run all tests${colors.reset}
  node scripts/skills/test-all.js

  ${colors.cyan}# Run with coverage${colors.reset}
  node scripts/skills/test-all.js --coverage

  ${colors.cyan}# Run E2E tests only${colors.reset}
  node scripts/skills/test-all.js --e2e

  ${colors.cyan}# Clean up artifacts${colors.reset}
  node scripts/skills/test-all.js --clean

${colors.bright}What this replaces:${colors.reset}
  ${colors.yellow}Before (manual):${colors.reset}
    npm run test:e2e:foundation
    npm run test:e2e:masters
    npm run test:e2e:transactions
    npm run test:e2e:integration
    cd backend && npm run test:unit
    cd backend && npm run test:integration
    # ... plus cleanup and coverage

  ${colors.green}After (automated):${colors.reset}
    node scripts/skills/test-all.js --all

${colors.bright}Test Suites:${colors.reset}
  ${colors.cyan}Frontend E2E (Playwright):${colors.reset}
    - Foundation tests (login, navigation, etc.)
    - Masters tests (CRUD operations)
    - Transactions tests (workflows)
    - Integration tests (end-to-end flows)

  ${colors.cyan}Backend (Jest):${colors.reset}
    - Unit tests (__tests__/**/*.test.ts)
    - Integration tests (integration/**)

${colors.bright}Important:${colors.reset}
  - Run from project root directory
  - Requires both frontend and backend dependencies installed
  - Playwright browsers must be installed (npx playwright install)
  `);
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--all';

  switch (mode) {
    case '--all':
      return runAllTests(false) ? 0 : 1;

    case '--coverage':
      return runAllTests(true) ? 0 : 1;

    case '--e2e':
      return runE2ETests(false) ? 0 : 1;

    case '--backend':
      return runBackendTests(false) ? 0 : 1;

    case '--clean':
      return cleanArtifacts() ? 0 : 1;

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

module.exports = { runAllTests, runE2ETests, runBackendTests, cleanArtifacts };
