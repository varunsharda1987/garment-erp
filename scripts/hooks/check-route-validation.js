#!/usr/bin/env node
/**
 * Pre-commit Hook: Check Route Validation
 *
 * Ensures all route files with POST/PUT/PATCH endpoints have Zod validation.
 * Fails the commit if routes are missing validateBody middleware.
 *
 * Usage:
 *   node scripts/hooks/check-route-validation.js [--check|--report|--help]
 *
 * Modes:
 *   --check (default) - Exit with error if violations found (for CI/pre-commit)
 *   --report - Print detailed report without failing
 *   --help - Show usage
 */

const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '../../backend/src/routes');
const SCHEMAS_DIR = path.join(__dirname, '../../backend/src/schemas');

// Routes that are exempt from validation (read-only or special cases)
const EXEMPT_ROUTES = [
  'index.routes.ts',      // Router aggregator
  'health.routes.ts',     // Health check
  'static.routes.ts',     // Static files
];

// Patterns that indicate write operations needing validation
const WRITE_PATTERNS = [
  /router\.(post|put|patch)\s*\(/gi,
  /router\.(post|put|patch)\s*\[/gi,
];

function getRouteFiles() {
  if (!fs.existsSync(ROUTES_DIR)) {
    console.error(`Routes directory not found: ${ROUTES_DIR}`);
    process.exit(1);
  }

  return fs.readdirSync(ROUTES_DIR)
    .filter(f => f.endsWith('.routes.ts'))
    .filter(f => !EXEMPT_ROUTES.includes(f));
}

function hasWriteOperations(content) {
  return WRITE_PATTERNS.some(pattern => pattern.test(content));
}

function hasValidation(content) {
  return content.includes('validateBody') || content.includes('validateQuery');
}

function getSchemaFile(routeFile) {
  const baseName = routeFile.replace('.routes.ts', '');
  const schemaFile = `${baseName}.schema.ts`;
  return fs.existsSync(path.join(SCHEMAS_DIR, schemaFile)) ? schemaFile : null;
}

function analyzeRoutes() {
  const routeFiles = getRouteFiles();
  const results = {
    compliant: [],
    nonCompliant: [],
    readOnly: [],
    total: routeFiles.length,
  };

  for (const file of routeFiles) {
    const filePath = path.join(ROUTES_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const hasWrites = hasWriteOperations(content);
    const hasVal = hasValidation(content);
    const schema = getSchemaFile(file);

    if (!hasWrites) {
      results.readOnly.push({ file, schema });
    } else if (hasVal) {
      results.compliant.push({ file, schema });
    } else {
      results.nonCompliant.push({ file, schema });
    }
  }

  return results;
}

function printReport(results) {
  console.log('\n=== Route Validation Audit ===\n');

  console.log(`Total route files: ${results.total}`);
  console.log(`Compliant (has validateBody): ${results.compliant.length}`);
  console.log(`Non-compliant (missing validation): ${results.nonCompliant.length}`);
  console.log(`Read-only (no POST/PUT/PATCH): ${results.readOnly.length}`);

  if (results.nonCompliant.length > 0) {
    console.log('\n--- Routes MISSING validation ---\n');
    for (const { file, schema } of results.nonCompliant) {
      const schemaStatus = schema ? `(schema: ${schema})` : '(NO SCHEMA)';
      console.log(`  - ${file} ${schemaStatus}`);
    }
  }

  if (results.compliant.length > 0) {
    console.log('\n--- Compliant routes ---\n');
    for (const { file } of results.compliant) {
      console.log(`  + ${file}`);
    }
  }

  const complianceRate = ((results.compliant.length / (results.compliant.length + results.nonCompliant.length)) * 100).toFixed(1);
  console.log(`\nCompliance rate: ${complianceRate}%`);

  return results.nonCompliant.length;
}

function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--check';

  if (mode === '--help') {
    console.log(`
Route Validation Checker

Usage: node check-route-validation.js [--check|--report|--help]

Modes:
  --check   Exit with error if violations found (default, for CI/pre-commit)
  --report  Print detailed report without failing
  --help    Show this help message

This hook ensures all route files with POST/PUT/PATCH endpoints use
validateBody() middleware for Zod schema validation.
    `);
    process.exit(0);
  }

  const results = analyzeRoutes();
  const violations = printReport(results);

  if (mode === '--check' && violations > 0) {
    console.log(`\n[FAILED] ${violations} route(s) missing validation.\n`);
    console.log('To fix: Create Zod schema in backend/src/schemas/ and add validateBody() to routes.\n');
    console.log('To bypass (not recommended): git commit --no-verify\n');
    process.exit(1);
  }

  if (violations === 0) {
    console.log('\n[PASSED] All routes with write operations have validation.\n');
  }
}

main();
