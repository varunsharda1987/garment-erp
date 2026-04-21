#!/usr/bin/env node
/**
 * Schema-Controller Sync Checker
 *
 * Pre-commit hook to detect mismatches between:
 * 1. What controllers destructure from req.body
 * 2. What Zod schemas define as valid fields
 *
 * Catches the "schema lag" bug where schemas weren't updated for bulk APIs.
 *
 * Usage:
 *   node scripts/hooks/check-schema-controller-sync.js [--fix]
 */

const fs = require('fs');
const path = require('path');

const CONTROLLERS_DIR = path.join(__dirname, '../../backend/src/controllers');
const SCHEMAS_DIR = path.join(__dirname, '../../backend/src/schemas');
const ROUTES_DIR = path.join(__dirname, '../../backend/src/routes');

// Patterns to match bulk import/update operations
const BULK_PATTERNS = [
  /const\s*\{\s*(\w+)(?:\s*,\s*\w+)*\s*\}\s*=\s*req\.body/g,  // destructuring
  /req\.body\.(\w+)/g,  // direct access
];

// Schema property patterns
const SCHEMA_PROPERTY_PATTERN = /z\.object\(\s*\{([^}]+)\}/gs;

function extractControllerBodyFields(content, filename) {
  const fields = new Set();
  const bulkMethods = [];

  // Find bulk import/update methods
  const methodMatches = content.matchAll(/(?:bulkImport|bulkUpdate|bulk\w+)\s*=\s*async[^{]+\{([\s\S]*?)^\s*\};/gm);

  for (const match of methodMatches) {
    const methodBody = match[0];

    // Extract destructured fields
    const destructureMatch = methodBody.match(/const\s*\{\s*([^}]+)\s*\}\s*=\s*req\.body/);
    if (destructureMatch) {
      const fieldList = destructureMatch[1].split(',').map(f => {
        const name = f.trim().split('=')[0].trim(); // handle defaults like `createStock = false`
        return name;
      });

      bulkMethods.push({
        file: filename,
        fields: fieldList.filter(f => f && !f.includes('{')),
      });
    }
  }

  return bulkMethods;
}

function extractSchemaFields(content, schemaName) {
  // Find the schema definition
  const schemaRegex = new RegExp(`export\\s+const\\s+${schemaName}\\s*=\\s*z\\.object\\(\\s*\\{([^}]+)\\}`, 's');
  const match = content.match(schemaRegex);

  if (!match) return null;

  const schemaBody = match[1];
  const fields = [];

  // Extract field names (keys before :)
  const fieldMatches = schemaBody.matchAll(/(\w+)\s*:/g);
  for (const m of fieldMatches) {
    fields.push(m[1]);
  }

  return fields;
}

function findRoutesForController(controllerName) {
  const routes = [];
  const routeFiles = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.routes.ts'));

  for (const file of routeFiles) {
    const content = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');

    // Check if this route imports from the controller
    if (content.includes(controllerName) || content.includes(controllerName.replace('.controller', ''))) {
      // Find validateBody usages
      const validateMatches = content.matchAll(/validateBody\((\w+)\)/g);
      for (const m of validateMatches) {
        routes.push({
          file,
          schema: m[1],
        });
      }

      // Find routes without validateBody (potential issues)
      const postRoutes = content.matchAll(/router\.(post|put|patch)\([^,]+,\s*(?!.*validateBody)/g);
      for (const m of postRoutes) {
        // This route might be missing validation
      }
    }
  }

  return routes;
}

function checkMismatches() {
  const issues = [];
  const controllerFiles = fs.readdirSync(CONTROLLERS_DIR).filter(f => f.endsWith('.controller.ts'));

  console.log('🔍 Checking schema-controller sync...\n');

  for (const file of controllerFiles) {
    const content = fs.readFileSync(path.join(CONTROLLERS_DIR, file), 'utf8');
    const bulkMethods = extractControllerBodyFields(content, file);

    for (const method of bulkMethods) {
      // Check if any field is named 'data', 'items', 'entries' etc. (bulk wrapper fields)
      const bulkField = method.fields.find(f => ['data', 'items', 'entries', 'records', 'rows'].includes(f));

      if (bulkField) {
        // This controller expects a bulk wrapper - verify schema matches
        const routes = findRoutesForController(file);

        for (const route of routes) {
          // Find the schema file
          const schemaFiles = fs.readdirSync(SCHEMAS_DIR).filter(f => f.endsWith('.schema.ts'));

          for (const schemaFile of schemaFiles) {
            const schemaContent = fs.readFileSync(path.join(SCHEMAS_DIR, schemaFile), 'utf8');

            if (schemaContent.includes(`export const ${route.schema}`)) {
              const schemaFields = extractSchemaFields(schemaContent, route.schema);

              if (schemaFields && !schemaFields.includes(bulkField)) {
                issues.push({
                  controller: file,
                  expectedField: bulkField,
                  schema: route.schema,
                  schemaFile,
                  schemaHas: schemaFields.slice(0, 5).join(', ') + (schemaFields.length > 5 ? '...' : ''),
                });
              }
            }
          }
        }
      }
    }
  }

  return issues;
}

function checkPaginationFormat() {
  const issues = [];
  const controllerFiles = fs.readdirSync(CONTROLLERS_DIR).filter(f => f.endsWith('.controller.ts'));

  console.log('📊 Checking pagination format consistency...\n');

  for (const file of controllerFiles) {
    const content = fs.readFileSync(path.join(CONTROLLERS_DIR, file), 'utf8');

    // Find pagination objects with 'pages' instead of 'totalPages'
    const pagesMatches = content.matchAll(/pagination:\s*\{[^}]*\bpages\b[^}]*\}/g);

    for (const match of pagesMatches) {
      if (!match[0].includes('totalPages')) {
        // Find line number
        const beforeMatch = content.substring(0, match.index);
        const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1;

        issues.push({
          file,
          line: lineNumber,
          found: 'pages',
          expected: 'totalPages',
        });
      }
    }
  }

  return issues;
}

function checkRoutesWithoutValidation() {
  const issues = [];
  const routeFiles = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.routes.ts'));

  console.log('🛡️ Checking routes for missing validation...\n');

  for (const file of routeFiles) {
    const content = fs.readFileSync(path.join(ROUTES_DIR, file), 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // POST/PUT/PATCH routes should have validateBody
      if (line.match(/router\.(post|put|patch)\s*\(/)) {
        const isBulkRoute = line.includes('bulk') || line.includes('import');
        const hasValidation = line.includes('validateBody');

        if (isBulkRoute && !hasValidation) {
          issues.push({
            file,
            line: i + 1,
            route: line.trim().substring(0, 80),
            reason: 'Bulk operation missing validateBody',
          });
        }
      }
    }
  }

  return issues;
}

function main() {
  let hasErrors = false;

  // Check schema-controller sync
  const syncIssues = checkMismatches();
  if (syncIssues.length > 0) {
    console.log('❌ Schema-Controller Mismatches Found:\n');
    for (const issue of syncIssues) {
      console.log(`  ${issue.controller}`);
      console.log(`    Controller expects: req.body.${issue.expectedField}`);
      console.log(`    Schema ${issue.schema} has: ${issue.schemaHas}`);
      console.log(`    File: ${issue.schemaFile}\n`);
    }
    hasErrors = true;
  } else {
    console.log('✅ Schema-controller sync: OK\n');
  }

  // Check pagination format
  const paginationIssues = checkPaginationFormat();
  if (paginationIssues.length > 0) {
    console.log('❌ Pagination Format Issues:\n');
    for (const issue of paginationIssues) {
      console.log(`  ${issue.file}:${issue.line}`);
      console.log(`    Found: "${issue.found}", Expected: "${issue.expected}"\n`);
    }
    hasErrors = true;
  } else {
    console.log('✅ Pagination format: OK\n');
  }

  // Check routes without validation
  const validationIssues = checkRoutesWithoutValidation();
  if (validationIssues.length > 0) {
    console.log('⚠️ Routes Missing Validation:\n');
    for (const issue of validationIssues) {
      console.log(`  ${issue.file}:${issue.line}`);
      console.log(`    ${issue.route}`);
      console.log(`    Reason: ${issue.reason}\n`);
    }
    // Warning only, don't fail
  } else {
    console.log('✅ Route validation: OK\n');
  }

  // Summary
  console.log('─'.repeat(50));
  console.log(`Schema-Controller: ${syncIssues.length} issues`);
  console.log(`Pagination: ${paginationIssues.length} issues`);
  console.log(`Route Validation: ${validationIssues.length} warnings`);

  if (hasErrors) {
    console.log('\n🚫 Fix the issues above before committing.');
    process.exit(1);
  } else {
    console.log('\n✅ All checks passed!');
    process.exit(0);
  }
}

main();
