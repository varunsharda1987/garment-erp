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

  // Helper to find matching closing brace using brace counting
  // Handles nested objects, regex patterns, and strings
  function findMatchingBrace(str, startIdx) {
    let depth = 1;
    let i = startIdx;
    let inString = false;
    let stringChar = '';
    let inRegex = false;

    while (i < str.length && depth > 0) {
      const char = str[i];
      const prevChar = i > 0 ? str[i - 1] : '';

      // Handle escape sequences
      if (prevChar === '\\' && (inString || inRegex)) {
        i++;
        continue;
      }

      // Handle strings
      if (!inRegex && (char === '"' || char === "'" || char === '`')) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
        i++;
        continue;
      }

      // Handle regex (simple detection: / not preceded by ( or ,)
      if (!inString && char === '/' && prevChar !== '(' && prevChar !== ',') {
        // Could be start or end of regex
        if (inRegex) {
          inRegex = false;
        } else if (/[=(:,]\s*$/.test(str.slice(Math.max(0, i - 10), i))) {
          inRegex = true;
        }
        i++;
        continue;
      }

      if (!inString && !inRegex) {
        if (char === '{') depth++;
        if (char === '}') depth--;
      }
      i++;
    }
    return depth === 0 ? i : -1;
  }

  // Helper to extract field names from a schema body
  function extractFields(schemaBody) {
    // Strip comments to avoid false positives
    schemaBody = schemaBody
      .replace(/\/\/[^\n]*/g, '') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

    // Extract top-level field names (before the colon)
    const fieldRegex = /^\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/gm;
    const fields = [];
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(schemaBody)) !== null) {
      const fieldName = fieldMatch[1];
      if (fieldName && !fields.includes(fieldName)) {
        fields.push(fieldName);
      }
    }
    return fields;
  }

  // Find: export const schemaName = z.object({ and then use brace counting
  const schemaStartRegex = /export\s+const\s+(\w+Schema)\s*=\s*z\.object\(\s*\{/g;

  let startMatch;
  while ((startMatch = schemaStartRegex.exec(content)) !== null) {
    const schemaName = startMatch[1];
    const bodyStart = startMatch.index + startMatch[0].length;
    const bodyEnd = findMatchingBrace(content, bodyStart);

    if (bodyEnd > bodyStart) {
      const schemaBody = content.slice(bodyStart, bodyEnd - 1); // -1 to exclude closing brace
      schemas[schemaName] = extractFields(schemaBody);
    }
  }

  // Also check for .extend({ ... }) patterns to capture extended fields
  const extendStartRegex = /(\w+Schema)\.extend\s*\(\s*\{/g;
  let extendMatch;
  while ((extendMatch = extendStartRegex.exec(content)) !== null) {
    const baseSchemaName = extendMatch[1];
    const bodyStart = extendMatch.index + extendMatch[0].length;
    const bodyEnd = findMatchingBrace(content, bodyStart);

    if (bodyEnd > bodyStart && schemas[baseSchemaName]) {
      const extendBody = content.slice(bodyStart, bodyEnd - 1);
      const extendedFields = extractFields(extendBody);

      for (const field of extendedFields) {
        if (!schemas[baseSchemaName].includes(field)) {
          schemas[baseSchemaName].push(field);
        }
      }
    }
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

  // Match: router.post('/path', [optional middleware...], validateBody(schemaName), asyncHandler(controllerFn))
  // The [^)]* allows for any middleware (like authorize()) between path and validateBody
  const routeRegex = /router\.(post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:[^)]*\)\s*,\s*)*validateBody\s*\(\s*(\w+)\s*\)\s*,\s*asyncHandler\s*\(\s*(\w+)\s*\)/g;

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

  // Helper to find matching closing brace using brace counting
  // Handles strings, template literals with ${...}, comments, and nested expressions
  function findFunctionEnd(str, startIdx) {
    let depth = 1;
    let i = startIdx;
    const stringStack = []; // Track nested string contexts
    let inLineComment = false;
    let inBlockComment = false;

    while (i < str.length && depth > 0) {
      const char = str[i];
      const nextChar = str[i + 1] || '';
      const prevChar = i > 0 ? str[i - 1] : '';
      const inString = stringStack.length > 0;
      const currentStringType = inString ? stringStack[stringStack.length - 1] : null;

      // Handle newline - ends line comments
      if (char === '\n') {
        inLineComment = false;
        i++;
        continue;
      }

      // Skip if in any comment
      if (inLineComment || inBlockComment) {
        // Check for end of block comment
        if (inBlockComment && char === '*' && nextChar === '/') {
          inBlockComment = false;
          i += 2;
          continue;
        }
        i++;
        continue;
      }

      // Check for start of comments (only outside strings)
      if (!inString && char === '/') {
        if (nextChar === '/') {
          inLineComment = true;
          i += 2;
          continue;
        }
        if (nextChar === '*') {
          inBlockComment = true;
          i += 2;
          continue;
        }
      }

      // Handle escape sequences
      if (prevChar === '\\' && inString && currentStringType !== '${') {
        i++;
        continue;
      }

      // Handle template literal interpolation ${...}
      if (currentStringType === '`' && char === '$' && nextChar === '{') {
        stringStack.push('${'); // Push template expression marker
        i += 2;
        continue;
      }

      // Handle strings - can be at top level, inside template expressions, or nested
      if (char === '"' || char === "'" || char === '`') {
        // Can start a new string if: not in any string, OR inside a template expression
        if (!inString || currentStringType === '${') {
          stringStack.push(char);
          i++;
          continue;
        }
        // End current string if matching quote
        if (char === currentStringType) {
          stringStack.pop();
          i++;
          continue;
        }
        // Different quote inside string - just continue
        i++;
        continue;
      }

      // Handle closing brace - could be end of template expression or regular brace
      if (char === '}') {
        if (currentStringType === '${') {
          stringStack.pop();
          i++;
          continue;
        }
        if (!inString) {
          depth--;
        }
        i++;
        continue;
      }

      // Handle opening brace
      if (char === '{') {
        if (!inString) {
          depth++;
        }
        i++;
        continue;
      }

      i++;
    }
    return depth === 0 ? i : startIdx + 5000; // Fallback to 5000 if parsing fails
  }

  // Multiple patterns to catch all function types:
  // 1. export async function fnName(req, res): Promise<void> { }
  // 2. export const fnName = async (req, res): Promise<void> => { }
  // 3. async methodName(req: Request, res: Response): Promise<void> { } (class methods)
  const fnPatterns = [
    // Pattern 1: Regular function declarations (with optional return type)
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/g,
    // Pattern 2: Arrow functions with const (with optional return type)
    /(?:export\s+)?const\s+(\w+)\s*=\s*async\s*\([^)]*\)\s*(?::\s*[^=>{]+)?\s*=>\s*\{/g,
    // Pattern 3: Class methods (with optional return type)
    /^\s*(?:async\s+)?(\w+)\s*\(\s*req\s*[,:][^)]*\)\s*(?::\s*[^{]+)?\s*\{/gm,
  ];

  for (const fnRegex of fnPatterns) {
    let fnMatch;
    // Reset regex state for each pattern
    fnRegex.lastIndex = 0;

    while ((fnMatch = fnRegex.exec(content)) !== null) {
      const fnName = fnMatch[1];
      if (!fnName || destructures[fnName]) continue; // Skip if already found

      const fnStart = fnMatch.index;
      const bodyStart = fnStart + fnMatch[0].length;

      // Use brace counting to find actual function end
      const fnEnd = findFunctionEnd(content, bodyStart);
      const fnBody = content.slice(fnStart, fnEnd);

      // Strip comments from function body to avoid false matches
      const fnBodyNoComments = fnBody
        .replace(/\/\/[^\n]*/g, '') // Remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

      const fields = [];

      // Pattern 1: const/let { field1, field2 } = req.body (with optional || {} or as Type)
      const destructRegex = /(?:const|let)\s*\{\s*([^}]+)\s*\}\s*=\s*req\.body(?:\s*\|\|\s*\{\})?(?:\s+as\s+\w+)?/;
      const destructMatch = fnBodyNoComments.match(destructRegex);

      if (destructMatch) {
        const fieldsStr = destructMatch[1];
        const parsedFields = fieldsStr
          .split(',')
          .map(f => f.trim().split(':')[0].split('=')[0].trim())
          .filter(f => f && !f.startsWith('...') && !f.startsWith('//'));
        fields.push(...parsedFields);
      }

      // Pattern 2: Direct access req.body.fieldName
      const directAccessRegex = /req\.body\.(\w+)/g;
      let directMatch;
      while ((directMatch = directAccessRegex.exec(fnBodyNoComments)) !== null) {
        if (!fields.includes(directMatch[1])) {
          fields.push(directMatch[1]);
        }
      }

      if (fields.length > 0) {
        destructures[fnName] = fields;
      }
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

  // 3. Parse all controller files - store by file AND function name
  // Key: "file:functionName" to handle same function names in different controllers
  const allControllers = {};
  const controllersByFile = {}; // { file: { fnName: { fields, file } } }
  const allFunctionsByFile = {}; // Track ALL functions (even without destructure)
  const controllerFiles = fs.readdirSync(CONTROLLERS_DIR).filter(f => f.endsWith('.controller.ts'));

  for (const file of controllerFiles) {
    const fullPath = path.join(CONTROLLERS_DIR, file);
    const destructures = parseControllerFile(fullPath);
    controllersByFile[file] = {};

    // Also detect all exported functions (not just those that destructure)
    const content = fs.readFileSync(fullPath, 'utf-8');
    const fnNames = new Set();
    // Match: export const fnName = async (
    const arrowMatches = content.matchAll(/export\s+const\s+(\w+)\s*=/g);
    for (const m of arrowMatches) fnNames.add(m[1]);
    // Match: export async function fnName(
    const funcMatches = content.matchAll(/export\s+(?:async\s+)?function\s+(\w+)\s*\(/g);
    for (const m of funcMatches) fnNames.add(m[1]);
    allFunctionsByFile[file] = fnNames;

    for (const [name, fields] of Object.entries(destructures)) {
      controllersByFile[file][name] = { fields, file };
      // Also store with composite key for precise matching
      allControllers[`${file}:${name}`] = { fields, file };
      // Keep simple key as fallback (last wins, but we'll prefer file-matched)
      allControllers[name] = { fields, file };
    }
  }

  // Helper: derive expected controller file from route file
  // e.g., "fabric-stock.routes.ts" -> "fabric-stock.controller.ts"
  //       "laceStock.routes.ts" -> "laceStock.controller.ts"
  function deriveControllerFile(routeFile) {
    // Simple replacement - routes and controllers use the same naming convention
    return routeFile.replace('.routes.ts', '.controller.ts');
  }

  // 4. Compare schema fields vs controller fields
  for (const mapping of routeMappings) {
    const schema = allSchemas[mapping.schemaName];

    // Try to find controller in the matching file first
    const expectedControllerFile = deriveControllerFile(mapping.routeFile);
    let controller = controllersByFile[expectedControllerFile]?.[mapping.controllerFn];

    // Check if function exists in expected file but doesn't destructure
    const functionExistsInExpectedFile = allFunctionsByFile[expectedControllerFile]?.has(mapping.controllerFn);

    // Only fallback to global lookup if function doesn't exist in expected file
    // This prevents cross-matching functions with same name from different controllers
    if (!controller && !functionExistsInExpectedFile) {
      controller = allControllers[mapping.controllerFn];
    }

    if (!schema) {
      results.warnings.push({
        type: 'MISSING_SCHEMA',
        message: `Schema '${mapping.schemaName}' not found (used in ${mapping.routeFile})`
      });
      continue;
    }

    if (!controller) {
      // Controller doesn't destructure req.body - might use req.body directly or internal schema
      const hint = functionExistsInExpectedFile
        ? ` (exists in ${expectedControllerFile} but uses internal validation)`
        : '';
      results.warnings.push({
        type: 'NO_DESTRUCTURE',
        message: `Controller '${mapping.controllerFn}' doesn't destructure req.body (${mapping.routeFile})${hint}`
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

module.exports = { checkAlignment };

// Run as a CLI only. smart-check.js require()s this module and calls checkAlignment() directly,
// so this block (and its process.exit) must not fire on import.
if (require.main === module) {
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
}
