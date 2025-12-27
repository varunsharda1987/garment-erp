#!/usr/bin/env node
/**
 * Type Synchronization Skill
 *
 * Analyzes and validates type synchronization between backend and frontend.
 * Applies serializer camelCase transformation rules to ensure consistency.
 *
 * Usage:
 *   node scripts/skills/sync-types.js [--check|--report|--help]
 *
 * Modes:
 *   --check   Validate type synchronization (exit 1 if issues found)
 *   --report  Generate detailed report of type files and mappings
 *   --help    Show usage information
 */

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
 * Read RELATION_MAPPINGS from serializer.ts
 */
function readSerializerMappings() {
  const serializerPath = path.join(process.cwd(), 'backend', 'src', 'utils', 'serializer.ts');

  if (!fs.existsSync(serializerPath)) {
    console.error(`${colors.red}Error: Could not find serializer.ts at ${serializerPath}${colors.reset}`);
    return {};
  }

  const content = fs.readFileSync(serializerPath, 'utf-8');

  // Extract RELATION_MAPPINGS
  const mappingsMatch = content.match(/export const RELATION_MAPPINGS: Record<string, string> = \{([^}]+)\}/s);

  if (!mappingsMatch) {
    console.warn(`${colors.yellow}Warning: Could not parse RELATION_MAPPINGS from serializer.ts${colors.reset}`);
    return {};
  }

  const mappingsText = mappingsMatch[1];
  const mappings = {};

  // Parse each mapping line
  const lines = mappingsText.split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*(\w+):\s*'(\w+)'/);
    if (match) {
      mappings[match[1]] = match[2];
    }
  }

  return mappings;
}

/**
 * Get all type files from a directory
 */
function getTypeFiles(baseDir, subdir) {
  const typesDir = path.join(process.cwd(), baseDir, subdir);

  if (!fs.existsSync(typesDir)) {
    console.warn(`${colors.yellow}Warning: Directory not found: ${typesDir}${colors.reset}`);
    return [];
  }

  const files = fs.readdirSync(typesDir);
  const typeFiles = files.filter(f => f.endsWith('.types.ts'));

  return typeFiles.map(name => {
    const filePath = path.join(typesDir, name);
    const stats = fs.statSync(filePath);

    return {
      name,
      path: filePath,
      size: stats.size,
      exists: true,
    };
  });
}

/**
 * Generate synchronization report
 */
function generateSyncReport() {
  const backendFiles = getTypeFiles('backend', 'src/types');
  const frontendFiles = getTypeFiles('frontend', 'src/types');
  const serializerMappings = readSerializerMappings();

  // Create maps for quick lookup
  const backendMap = new Map(backendFiles.map(f => [f.name, f]));
  const frontendMap = new Map(frontendFiles.map(f => [f.name, f]));

  // Find matches and differences
  const matched = [];
  const backendOnly = [];
  const frontendOnly = [];

  // Check backend files
  for (const backendFile of backendFiles) {
    const frontendFile = frontendMap.get(backendFile.name);
    if (frontendFile) {
      matched.push({ backend: backendFile, frontend: frontendFile });
    } else {
      backendOnly.push(backendFile);
    }
  }

  // Check frontend-only files
  for (const frontendFile of frontendFiles) {
    if (!backendMap.has(frontendFile.name)) {
      frontendOnly.push(frontendFile);
    }
  }

  return {
    backendFiles,
    frontendFiles,
    matched,
    backendOnly,
    frontendOnly,
    serializerMappings,
  };
}

/**
 * Print detailed report
 */
function printReport(report) {
  console.log(`\n${colors.bright}${colors.cyan}=== Type Synchronization Report ===${colors.reset}\n`);

  // Summary
  console.log(`${colors.bright}Summary:${colors.reset}`);
  console.log(`  Backend type files:  ${report.backendFiles.length}`);
  console.log(`  Frontend type files: ${report.frontendFiles.length}`);
  console.log(`  Matched files:       ${colors.green}${report.matched.length}${colors.reset}`);
  console.log(`  Backend only:        ${colors.yellow}${report.backendOnly.length}${colors.reset}`);
  console.log(`  Frontend only:       ${colors.yellow}${report.frontendOnly.length}${colors.reset}`);

  // Serializer mappings
  console.log(`\n${colors.bright}Serializer Mappings:${colors.reset}`);
  console.log(`  Total mappings: ${Object.keys(report.serializerMappings).length}`);
  console.log(`  ${colors.cyan}(snake_case → camelCase transformations defined in backend/src/utils/serializer.ts)${colors.reset}`);

  // Show first 10 mappings as examples
  const mappingEntries = Object.entries(report.serializerMappings).slice(0, 10);
  if (mappingEntries.length > 0) {
    console.log(`  ${colors.bright}Examples:${colors.reset}`);
    for (const [key, value] of mappingEntries) {
      console.log(`    ${key} → ${value}`);
    }
    if (Object.keys(report.serializerMappings).length > 10) {
      console.log(`    ... and ${Object.keys(report.serializerMappings).length - 10} more`);
    }
  }

  // Matched files
  if (report.matched.length > 0) {
    console.log(`\n${colors.bright}${colors.green}✓ Matched Type Files (${report.matched.length}):${colors.reset}`);
    for (const { backend, frontend } of report.matched) {
      const backendSize = (backend.size / 1024).toFixed(1);
      const frontendSize = (frontend.size / 1024).toFixed(1);
      console.log(`  ${colors.green}✓${colors.reset} ${backend.name.padEnd(35)} (B: ${backendSize}KB, F: ${frontendSize}KB)`);
    }
  }

  // Backend-only files
  if (report.backendOnly.length > 0) {
    console.log(`\n${colors.bright}${colors.yellow}⚠ Backend Only (${report.backendOnly.length}):${colors.reset}`);
    for (const file of report.backendOnly) {
      const size = (file.size / 1024).toFixed(1);
      console.log(`  ${colors.yellow}!${colors.reset} ${file.name.padEnd(35)} (${size}KB)`);
    }
    console.log(`  ${colors.cyan}These backend types may need corresponding frontend types.${colors.reset}`);
  }

  // Frontend-only files
  if (report.frontendOnly.length > 0) {
    console.log(`\n${colors.bright}${colors.yellow}⚠ Frontend Only (${report.frontendOnly.length}):${colors.reset}`);
    for (const file of report.frontendOnly) {
      const size = (file.size / 1024).toFixed(1);
      console.log(`  ${colors.yellow}!${colors.reset} ${file.name.padEnd(35)} (${size}KB)`);
    }
    console.log(`  ${colors.cyan}These may be UI-specific types (forms, state, etc.).${colors.reset}`);
  }

  console.log(`\n${colors.bright}${colors.cyan}Key Reminders:${colors.reset}`);
  console.log(`  1. Backend uses snake_case for Prisma relations (e.g., brand_categories)`);
  console.log(`  2. Serializer converts to camelCase in API responses (e.g., brandCategories)`);
  console.log(`  3. Frontend MUST use camelCase when accessing nested relations`);
  console.log(`  4. Check RELATION_MAPPINGS in serializer.ts for custom mappings\n`);
}

/**
 * Check for synchronization issues
 */
function checkSync(report) {
  let hasIssues = false;

  // Check for backend files without frontend equivalents (warnings, not errors)
  if (report.backendOnly.length > 0) {
    console.log(`${colors.yellow}Warning: ${report.backendOnly.length} backend type file(s) have no frontend equivalent${colors.reset}`);
    hasIssues = true;
  }

  // Frontend-only files are OK (UI types are expected)
  if (report.frontendOnly.length > 0) {
    console.log(`${colors.cyan}Info: ${report.frontendOnly.length} frontend-only type files (UI-specific types)${colors.reset}`);
  }

  return !hasIssues;
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--report';

  if (mode === '--help') {
    console.log(`
${colors.bright}Type Synchronization Skill${colors.reset}

${colors.bright}Usage:${colors.reset}
  node scripts/skills/sync-types.js [--check|--report|--help]

${colors.bright}Modes:${colors.reset}
  --check   Validate type synchronization (exit 1 if issues found)
  --report  Generate detailed report of type files and mappings (default)
  --help    Show this help message

${colors.bright}What this tool does:${colors.reset}
  - Scans backend and frontend type files
  - Identifies matched, backend-only, and frontend-only files
  - Displays serializer camelCase transformation mappings
  - Validates synchronization status

${colors.bright}Important:${colors.reset}
  Backend uses snake_case (Prisma) → Serializer converts to camelCase → Frontend uses camelCase
  Example: backend.brand_categories → API brandCategories → frontend.brandCategories
    `);
    return;
  }

  const report = generateSyncReport();

  if (mode === '--check') {
    const isValid = checkSync(report);
    process.exit(isValid ? 0 : 1);
  } else if (mode === '--report') {
    printReport(report);
  } else {
    console.error(`${colors.red}Unknown mode: ${mode}${colors.reset}`);
    console.error(`Use --help for usage information`);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { generateSyncReport, printReport, checkSync };
