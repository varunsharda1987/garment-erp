#!/usr/bin/env node
/**
 * Schema-Controller Alignment Checker
 *
 * Detects field name mismatches between Zod schemas and controller destructuring.
 * Prevents silent data loss from Zod stripping unknown fields.
 *
 * Usage:
 *   node scripts/hooks/check-schema-controller-alignment.js [--report|--check|--help]
 *
 * Modes:
 *   --report  (default) Show detailed alignment report
 *   --check   Exit with code 1 if CRITICAL mismatches found (for pre-commit)
 *   --help    Show usage
 */

const fs = require('fs');
const path = require('path');

const BACKEND_DIR = path.join(__dirname, '../../backend/src');
const SCHEMAS_DIR = path.join(BACKEND_DIR, 'schemas');
const ROUTES_DIR = path.join(BACKEND_DIR, 'routes');
const CONTROLLERS_DIR = path.join(BACKEND_DIR, 'controllers');

// Parse command line args
const args = process.argv.slice(2);
const mode = args.includes('--check') ? 'check' : args.includes('--help') ? 'help' : 'report';

if (mode === 'help') {
  console.log(`
Schema-Controller Alignment Checker

Detects field name mismatches between Zod schemas and controller destructuring.

Usage:
  node scripts/hooks/check-schema-controller-alignment.js [--report|--check|--help]

Modes:
  --report  (default) Show detailed alignment report
  --check   Exit with code 1 if CRITICAL mismatches found (for pre-commit)
  --help    Show this help

What it checks:
  1. Parses Zod schemas to extract field names
  2. Finds routes that use validateBody(schemaName)
  3. Finds controller functions and extracts req.body destructuring
  4. Reports mismatches between schema fields and controller expectations

Exit codes:
  0 - No critical mismatches (or --report mode)
  1 - Critical mismatches found (--check mode only)
`);
  process.exit(0);
}

/**
 * Extract schema definitions from a schema file
 * Returns: { schemaName: [field1, field2, ...], ... }
 */
function parseSchemaFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const schemas = {};

  // Match: export const schemaName = z.object({ ... })
  // This is a simplified parser - handles most common patterns
  const schemaRegex = /export\s+const\s+(\w+Schema)\s*=\s*z\.object\(\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/gs;

  let match;
  while ((match = schemaRegex.exec(content)) !== null) {
    const schemaName = match[1];
    let schemaBody = match[2];

    // Strip comments to avoid false positives
    schemaBody = schemaBody
      .replace(/\/\/[^\n]*/g, '') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

    // Extract top-level field names (before the colon)
    // Only match valid JS identifiers at the start of lines
    const fieldRegex = /^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/gm;
    const fields = [];
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(schemaBody)) !== null) {
      const fieldName = fieldMatch[1];
      if (fieldName && !fields.includes(fieldName)) {
        fields.push(fieldName);
      }
    }

    schemas[schemaName] = fields;
  }

  return schemas;
}

/**
 * Extract route-to-schema mappings from a route file
 * Returns: [{ method, path, schemaName, controllerFn }, ...]
 */
function parseRouteFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const mappings = [];

  // Match: router.post('/path', validateBody(schemaName), asyncHandler(controllerFn))
  const routeRegex = /router\.(post|put|patch)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*validateBody\s*\(\s*(\w+)\s*\)\s*,\s*asyncHandler\s*\(\s*(\w+)\s*\)/g;

  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    mappings.push({
      method: match[1].toUpperCase(),
      path: match[2],
      schemaName: match[3],
      controllerFn: match[4],
      routeFile: path.basename(filePath)
    });
  }

  return mappings;
}

/**
 * Extract req.body destructuring from a controller file
 * Returns: { functionName: [field1, field2, ...], ... }
 */
function parseControllerFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const destructures = {};

  // Match function declarations and their req.body destructuring
  // Pattern 1: export async function fnName(req, res) { const { a, b } = req.body; }
  // Pattern 2: async fnName(req: Request, res: Response) { const { a, b } = req.body; }

  // Find all function definitions
  const fnRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{|(\w+)\s*(?:=|:)\s*async\s*\([^)]*\)\s*(?:=>)?\s*\{/g;

  let fnMatch;
  while ((fnMatch = fnRegex.exec(content)) !== null) {
    const fnName = fnMatch[1] || fnMatch[2];
    const fnStart = fnMatch.index;

    // Find the next 500 chars to look for req.body destructuring
    const fnBody = content.slice(fnStart, fnStart + 1500);

    // Match: const { field1, field2, ... } = req.body
    const destructRegex = /const\s*\{\s*([^}]+)\s*\}\s*=\s*req\.body/;
    const destructMatch = fnBody.match(destructRegex);

    if (destructMatch) {
      // Parse field names from destructuring
      const fieldsStr = destructMatch[1];
      const fields = fieldsStr
        .split(',')
        .map(f => f.trim().split(':')[0].split('=')[0].trim()) // Handle renaming and defaults
        .filter(f => f && !f.startsWith('...')); // Exclude spread

      destructures[fnName] = fields;
    }
  }

  return destructures;
}

/**
 * Main alignment check
 */
function checkAlignment() {
  const results = {
    aligned: [],
    misaligned: [],
    warnings: []
  };

  // 1. Parse all schema files
  const allSchemas = {};
  const schemaFiles = fs.readdirSync(SCHEMAS_DIR).filter(f => f.endsWith('.schema.ts'));

  for (const file of schemaFiles) {
    const schemas = parseSchemaFile(path.join(SCHEMAS_DIR, file));
    for (const [name, fields] of Object.entries(schemas)) {
      allSchemas[name] = { fields, file };
    }
  }

  // 2. Parse all route files to find schema usage
  const routeMappings = [];
  const routeFiles = fs.readdirSync(ROUTES_DIR).filter(f => f.endsWith('.routes.ts'));

  for (const file of routeFiles) {
    const mappings = parseRouteFile(path.join(ROUTES_DIR, file));
    routeMappings.push(...mappings);
  }

  // 3. Parse all controller files
  const allControllers = {};
  const controllerFiles = fs.readdirSync(CONTROLLERS_DIR).filter(f => f.endsWith('.controller.ts'));

  for (const file of controllerFiles) {
    const destructures = parseControllerFile(path.join(CONTROLLERS_DIR, file));
    for (const [name, fields] of Object.entries(destructures)) {
      allControllers[name] = { fields, file };
    }
  }

  // 4. Compare schema fields vs controller fields
  for (const mapping of routeMappings) {
    const schema = allSchemas[mapping.schemaName];
    const controller = allControllers[mapping.controllerFn];

    if (!schema) {
      results.warnings.push({
        type: 'MISSING_SCHEMA',
        message: `Schema '${mapping.schemaName}' not found (used in ${mapping.routeFile})`
      });
      continue;
    }

    if (!controller) {
      // Controller doesn't destructure req.body - might use req.body directly
      results.warnings.push({
        type: 'NO_DESTRUCTURE',
        message: `Controller '${mapping.controllerFn}' doesn't destructure req.body (${mapping.routeFile})`
      });
      continue;
    }

    const schemaFields = new Set(schema.fields);
    const controllerFields = new Set(controller.fields);

    // Fields controller expects but schema doesn't have (CRITICAL)
    const missingInSchema = [...controllerFields].filter(f => !schemaFields.has(f));

    // Fields schema has but controller doesn't use (warning)
    const unusedInSchema = [...schemaFields].filter(f => !controllerFields.has(f));

    if (missingInSchema.length > 0) {
      results.misaligned.push({
        route: `${mapping.method} ${mapping.path}`,
        routeFile: mapping.routeFile,
        schemaName: mapping.schemaName,
        schemaFile: schema.file,
        controllerFn: mapping.controllerFn,
        controllerFile: controller.file,
        critical: missingInSchema,
        unused: unusedInSchema
      });
    } else if (unusedInSchema.length > 0) {
      results.aligned.push({
        route: `${mapping.method} ${mapping.path}`,
        schemaName: mapping.schemaName,
        unusedFields: unusedInSchema
      });
    } else {
      results.aligned.push({
        route: `${mapping.method} ${mapping.path}`,
        schemaName: mapping.schemaName
      });
    }
  }

  return results;
}

/**
 * Print results
 */
function printResults(results) {
  console.log('\n=== Schema-Controller Alignment Check ===\n');

  // Misaligned (CRITICAL)
  if (results.misaligned.length > 0) {
    console.log(`\x1b[31m${results.misaligned.length} CRITICAL MISMATCHES:\x1b[0m\n`);

    for (const m of results.misaligned) {
      console.log(`\x1b[31m  ${m.route}\x1b[0m`);
      console.log(`    Schema: ${m.schemaName} (${m.schemaFile})`);
      console.log(`    Controller: ${m.controllerFn} (${m.controllerFile})`);
      console.log(`    \x1b[31mCRITICAL - Controller expects but schema missing:\x1b[0m`);
      for (const f of m.critical) {
        console.log(`      - ${f}`);
      }
      if (m.unused.length > 0) {
        console.log(`    Schema has but controller ignores:`);
        for (const f of m.unused) {
          console.log(`      - ${f}`);
        }
      }
      console.log();
    }
  }

  // Aligned
  const fullyAligned = results.aligned.filter(a => !a.unusedFields);
  const partiallyAligned = results.aligned.filter(a => a.unusedFields);

  if (fullyAligned.length > 0) {
    console.log(`\x1b[32m${fullyAligned.length} fully aligned:\x1b[0m`);
    for (const a of fullyAligned.slice(0, 10)) {
      console.log(`  ${a.route} (${a.schemaName})`);
    }
    if (fullyAligned.length > 10) {
      console.log(`  ... and ${fullyAligned.length - 10} more`);
    }
    console.log();
  }

  // Warnings
  if (results.warnings.length > 0) {
    console.log(`\x1b[33m${results.warnings.length} warnings:\x1b[0m`);
    for (const w of results.warnings.slice(0, 5)) {
      console.log(`  ${w.type}: ${w.message}`);
    }
    if (results.warnings.length > 5) {
      console.log(`  ... and ${results.warnings.length - 5} more`);
    }
    console.log();
  }

  // Summary
  console.log('--- Summary ---');
  console.log(`  Total routes checked: ${results.aligned.length + results.misaligned.length}`);
  console.log(`  Aligned: ${results.aligned.length}`);
  console.log(`  \x1b[31mMisaligned (CRITICAL): ${results.misaligned.length}\x1b[0m`);
  console.log(`  Warnings: ${results.warnings.length}`);
}

// Run
try {
  const results = checkAlignment();
  printResults(results);

  if (mode === 'check' && results.misaligned.length > 0) {
    console.log('\n\x1b[31mCRITICAL: Schema-controller mismatches found. Fix before committing.\x1b[0m');
    process.exit(1);
  }

  process.exit(0);
} catch (error) {
  console.error('Error running alignment check:', error.message);
  process.exit(1);
}
