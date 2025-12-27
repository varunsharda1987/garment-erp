#!/usr/bin/env node
/**
 * Post-Type-Change Hook
 *
 * Automatically triggered when backend or frontend type files change.
 * Validates type synchronization and updates dependent files.
 *
 * Triggers:
 * - When *.types.ts files in backend/src/types/ change
 * - When schema.prisma changes (affects types)
 *
 * Actions:
 * - Run /sync-types to validate synchronization
 * - Flag mismatches and missing frontend types
 * - Optionally regenerate API docs if controller types changed
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
    const output = execSync(command, { encoding: 'utf-8' });
    if (!silent) {
      console.log(output);
    }
    return output;
  } catch (error) {
    if (!silent) {
      console.error(error.stdout || error.message);
    }
    throw error;
  }
}

/**
 * Get list of changed type files
 */
function getChangedTypeFiles() {
  try {
    const status = exec('git status --porcelain', true);
    const lines = status.split('\n').filter(line => line.trim());

    const changedFiles = lines
      .filter(line => {
        const file = line.substring(3).trim();
        return file.endsWith('.types.ts') || file.endsWith('schema.prisma');
      })
      .map(line => line.substring(3).trim());

    return changedFiles;
  } catch (error) {
    return [];
  }
}

/**
 * Check if controller types changed
 */
function didControllerTypesChange() {
  const changedFiles = getChangedTypeFiles();
  return changedFiles.some(file =>
    file.includes('backend/src/types/') ||
    file.includes('backend/src/controllers/')
  );
}

/**
 * Main hook execution
 */
function main() {
  console.log(`\n${colors.bright}${colors.cyan}=== Post-Type-Change Hook ===${colors.reset}\n`);

  const changedFiles = getChangedTypeFiles();

  if (changedFiles.length === 0) {
    console.log(`${colors.yellow}No type files changed. Skipping hook.${colors.reset}\n`);
    return;
  }

  console.log(`${colors.bright}Changed type files (${changedFiles.length}):${colors.reset}`);
  changedFiles.forEach(file => {
    console.log(`  ${colors.cyan}M${colors.reset} ${file}`);
  });

  // Run type synchronization check
  console.log(`\n${colors.bright}Running type synchronization check...${colors.reset}\n`);

  try {
    exec('node scripts/skills/sync-types.js --check');
    console.log(`${colors.green}✓ Type synchronization check passed${colors.reset}`);
  } catch (error) {
    console.log(`${colors.yellow}⚠ Type synchronization issues detected${colors.reset}`);
    console.log(`${colors.cyan}Run: node scripts/skills/sync-types.js --report${colors.reset}`);
    console.log(`${colors.cyan}to see detailed synchronization status.${colors.reset}\n`);
  }

  // Check if API docs should be regenerated
  if (didControllerTypesChange()) {
    console.log(`\n${colors.bright}Controller types changed. Consider updating API docs:${colors.reset}`);
    console.log(`  ${colors.cyan}node scripts/skills/api-docs.js --generate${colors.reset}\n`);
  }

  console.log(`${colors.green}✓ Post-type-change hook completed${colors.reset}\n`);
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { main, getChangedTypeFiles, didControllerTypesChange };
