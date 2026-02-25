#!/usr/bin/env node
/**
 * Documentation Validation Skill
 *
 * Validates documentation coverage, broken links, and accuracy.
 * Wrapper around backend/scripts/doc-validator.ts with enhanced reporting.
 *
 * Usage:
 *   node scripts/skills/validate-docs.js [--all|--controllers|--endpoints|--links|--materials|--help]
 *
 * Modes:
 *   --all          Run all validations (default)
 *   --controllers  Check controller documentation coverage
 *   --endpoints    Check API endpoint documentation coverage
 *   --links        Validate internal markdown links
 *   --materials    Verify material types count accuracy
 *   --help         Show usage information
 */

const { execSync } = require('child_process');
const path = require('path');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

/**
 * Print header with styling
 */
function printHeader(text) {
  const line = '═'.repeat(text.length + 4);
  console.log(`\n${colors.cyan}╔${line}╗${colors.reset}`);
  console.log(`${colors.cyan}║  ${colors.bright}${text}${colors.reset}${colors.cyan}  ║${colors.reset}`);
  console.log(`${colors.cyan}╚${line}╝${colors.reset}\n`);
}

/**
 * Print section header
 */
function printSection(text) {
  console.log(`\n${colors.blue}▶ ${colors.bright}${text}${colors.reset}\n`);
}

/**
 * Print success message
 */
function printSuccess(text) {
  console.log(`${colors.green}✓ ${text}${colors.reset}`);
}

/**
 * Print error message
 */
function printError(text) {
  console.log(`${colors.red}✗ ${text}${colors.reset}`);
}

/**
 * Print warning message
 */
function printWarning(text) {
  console.log(`${colors.yellow}⚠ ${text}${colors.reset}`);
}

/**
 * Print info message
 */
function printInfo(text) {
  console.log(`${colors.cyan}ℹ ${text}${colors.reset}`);
}

/**
 * Execute validator script
 */
function runValidator(mode = '--all') {
  const validatorPath = path.join(process.cwd(), 'backend', 'scripts', 'doc-validator.ts');

  try {
    // Run the TypeScript validator using ts-node
    const output = execSync(`npx ts-node ${validatorPath} ${mode}`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    console.log(output);
    return { success: true, output };
  } catch (error) {
    // Validator failed (non-zero exit code)
    console.log(error.stdout || error.message);
    return { success: false, output: error.stdout || error.message };
  }
}

/**
 * Display usage information
 */
function showHelp() {
  printHeader('Documentation Validation Skill');

  console.log('Validates documentation quality and coverage.\n');

  console.log(`${colors.bright}Usage:${colors.reset}`);
  console.log('  node scripts/skills/validate-docs.js [mode]\n');

  console.log(`${colors.bright}Modes:${colors.reset}`);
  console.log('  --all          Run all validations (default)');
  console.log('  --controllers  Check controller documentation coverage');
  console.log('  --endpoints    Check API endpoint documentation coverage');
  console.log('  --links        Validate internal markdown links');
  console.log('  --materials    Verify material types count accuracy');
  console.log('  --help         Show this help message\n');

  console.log(`${colors.bright}Examples:${colors.reset}`);
  console.log('  node scripts/skills/validate-docs.js');
  console.log('  node scripts/skills/validate-docs.js --controllers');
  console.log('  node scripts/skills/validate-docs.js --links\n');

  console.log(`${colors.bright}What Gets Validated:${colors.reset}`);
  console.log('  • Controller Coverage - % of controllers mentioned in docs');
  console.log('  • API Endpoint Coverage - % of endpoints documented');
  console.log('  • Internal Links - Broken markdown links in docs/');
  console.log('  • Material Types - Count accuracy in MATERIALS_MASTER_GUIDE.md\n');

  console.log(`${colors.dim}This is a wrapper around backend/scripts/doc-validator.ts${colors.reset}\n`);
}

/**
 * Provide suggestions based on validation results
 */
function provideSuggestions(mode, success) {
  if (success) {
    printSuccess('All validations passed!');
    return;
  }

  console.log('');
  printSection('💡 Suggestions');

  switch (mode) {
    case '--controllers':
      console.log('To improve controller coverage:');
      console.log('  1. Add controller references to relevant guides in docs/');
      console.log('  2. Create new guides for major undocumented features');
      console.log('  3. Update PROJECT_BIBLE.md with new module references\n');
      break;

    case '--endpoints':
      console.log('To improve endpoint coverage:');
      console.log('  1. Add API Reference sections to guides');
      console.log('  2. Document request/response types');
      console.log('  3. Use /api-docs skill to generate endpoint lists\n');
      break;

    case '--links':
      console.log('To fix broken links:');
      console.log('  1. Update file paths in markdown links');
      console.log('  2. Move or rename files referenced in docs');
      console.log('  3. Remove links to deleted files\n');
      break;

    case '--materials':
      console.log('To fix material types count:');
      console.log('  1. Update MATERIALS_MASTER_GUIDE.md header');
      console.log('  2. Count material master tables in schema.prisma');
      console.log('  3. Update Section 1.2 table with accurate count\n');
      break;

    case '--all':
      console.log('Run individual modes for specific suggestions:');
      console.log('  node scripts/skills/validate-docs.js --controllers');
      console.log('  node scripts/skills/validate-docs.js --endpoints');
      console.log('  node scripts/skills/validate-docs.js --links');
      console.log('  node scripts/skills/validate-docs.js --materials\n');
      break;
  }
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--all';

  // Handle help
  if (mode === '--help') {
    showHelp();
    process.exit(0);
  }

  // Validate mode
  const validModes = ['--all', '--controllers', '--endpoints', '--links', '--materials'];
  if (!validModes.includes(mode)) {
    printError(`Invalid mode: ${mode}`);
    console.log(`Valid modes: ${validModes.join(', ')}`);
    console.log('Run with --help for more information\n');
    process.exit(1);
  }

  // Run validation
  printHeader(`Documentation Validation${mode !== '--all' ? ` (${mode.slice(2)})` : ''}`);

  const result = runValidator(mode);

  // Provide suggestions
  provideSuggestions(mode, result.success);

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { runValidator };
