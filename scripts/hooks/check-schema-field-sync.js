#!/usr/bin/env node
/**
 * Schema Field Sync Validator
 *
 * Compares backend Zod schema field names with frontend TypeScript types
 * to detect mismatches that cause silent data loss.
 *
 * Usage:
 *   node scripts/hooks/check-schema-field-sync.js [--check|--report|--help]
 *
 * Modes:
 *   --report (default) - Generate detailed mismatch report
 *   --check - Exit with error code if mismatches found (for CI/hooks)
 *   --help - Show usage
 */

const fs = require('fs');
const path = require('path');

// Configuration
const BACKEND_SCHEMAS_DIR = path.join(__dirname, '../../backend/src/schemas');
const FRONTEND_TYPES_DIR = path.join(__dirname, '../../frontend/src/types');

// Known schema-to-type mappings (schema file -> frontend type file)
const SCHEMA_TYPE_MAPPINGS = {
  'fabricGreige.schema.ts': 'fabric-greige.types.ts',
  'embroidery.schema.ts': 'embroidery.types.ts',
  'season.schema.ts': 'season.types.ts',
  'agent.schema.ts': 'agent.types.ts',
  'componentMasters.schema.ts': 'componentMaster.types.ts',
  'genericTrim.schema.ts': 'genericTrim.types.ts',
  'trimMasters.schema.ts': 'trim.types.ts',
  'material.schema.ts': 'material.types.ts',
  'supplier.schema.ts': 'supplier.types.ts',
  'customer.schema.ts': 'customer.types.ts',
  'style.schema.ts': 'style.types.ts',
  'color.schema.ts': 'color.types.ts',
};

// Extract field names from Zod schema definition
function extractZodFields(content, schemaName) {
  // Match: export const schemaName = z.object({ ... })
  const regex = new RegExp(
    `export\\s+const\\s+${schemaName}\\s*=\\s*z\\.object\\(\\{([^}]+(?:\\{[^}]*\\}[^}]*)*)\\}\\)`,
    's'
  );

  const match = content.match(regex);
  if (!match) return null;

  const schemaBody = match[1];

  // Extract field names (word followed by colon)
  const fieldRegex = /^\s*(\w+)\s*:/gm;
  const fields = [];
  let fieldMatch;
  while ((fieldMatch = fieldRegex.exec(schemaBody)) !== null) {
    fields.push(fieldMatch[1]);
  }

  return fields;
}

// Extract field names from TypeScript interface/type
function extractTypeFields(content, typeName) {
  // Match: interface TypeName { ... } or type TypeName = { ... }
  const interfaceRegex = new RegExp(
    `(?:interface|type)\\s+${typeName}\\s*(?:=\\s*)?\\{([^}]+(?:\\{[^}]*\\}[^}]*)*)\\}`,
    's'
  );

  const match = content.match(interfaceRegex);
  if (!match) return null;

  const typeBody = match[1];

  // Extract field names (word followed by ? and colon, or just colon)
  const fieldRegex = /^\s*(\w+)\??\s*:/gm;
  const fields = [];
  let fieldMatch;
  while ((fieldMatch = fieldRegex.exec(typeBody)) !== null) {
    fields.push(fieldMatch[1]);
  }

  return fields;
}

// Compare two field arrays and find mismatches
function compareFields(schemaFields, typeFields) {
  if (!schemaFields || !typeFields) return { missing: [], extra: [], common: [] };

  const schemaSet = new Set(schemaFields);
  const typeSet = new Set(typeFields);

  const missing = typeFields.filter(f => !schemaSet.has(f)); // In frontend, not in backend
  const extra = schemaFields.filter(f => !typeSet.has(f)); // In backend, not in frontend
  const common = schemaFields.filter(f => typeSet.has(f));

  return { missing, extra, common };
}

// Main analysis
function analyzeSchemas() {
  const results = [];

  // Read all schema files
  const schemaFiles = fs.readdirSync(BACKEND_SCHEMAS_DIR)
    .filter(f => f.endsWith('.schema.ts'));

  for (const schemaFile of schemaFiles) {
    const schemaPath = path.join(BACKEND_SCHEMAS_DIR, schemaFile);
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

    // Find corresponding frontend type file
    const typeFile = SCHEMA_TYPE_MAPPINGS[schemaFile];
    if (!typeFile) continue;

    const typePath = path.join(FRONTEND_TYPES_DIR, typeFile);
    if (!fs.existsSync(typePath)) continue;

    const typeContent = fs.readFileSync(typePath, 'utf-8');

    // Find create/update schemas and their corresponding types
    const schemaPatterns = [
      { schema: 'create', type: 'Create' },
      { schema: 'update', type: 'Update' },
    ];

    // Extract schema names from the file
    const schemaNameRegex = /export\s+const\s+(\w+Schema)\s*=/g;
    let schemaMatch;
    while ((schemaMatch = schemaNameRegex.exec(schemaContent)) !== null) {
      const schemaName = schemaMatch[1];

      // Try to find matching type in frontend
      // e.g., createFabricMasterSchema -> CreateFabricMasterRequest/Input/FormData
      const baseName = schemaName
        .replace(/Schema$/, '')
        .replace(/^create/, '')
        .replace(/^update/, '');

      const isCreate = schemaName.toLowerCase().startsWith('create');
      const isUpdate = schemaName.toLowerCase().startsWith('update');

      if (!isCreate && !isUpdate) continue;

      const prefix = isCreate ? 'Create' : 'Update';
      const possibleTypeNames = [
        `${prefix}${baseName}Request`,
        `${prefix}${baseName}Input`,
        `${baseName}FormData`,
        `${prefix}${baseName}`,
      ];

      const schemaFields = extractZodFields(schemaContent, schemaName);

      for (const typeName of possibleTypeNames) {
        const typeFields = extractTypeFields(typeContent, typeName);
        if (typeFields) {
          const comparison = compareFields(schemaFields, typeFields);

          if (comparison.missing.length > 0 || comparison.extra.length > 0) {
            results.push({
              schemaFile,
              schemaName,
              typeFile,
              typeName,
              schemaFields,
              typeFields,
              missingInSchema: comparison.missing,
              extraInSchema: comparison.extra,
            });
          }
          break;
        }
      }
    }
  }

  return results;
}

// Print report
function printReport(results) {
  console.log('=== Schema/Frontend Field Sync Report ===\n');

  if (results.length === 0) {
    console.log('✅ No field name mismatches detected!\n');
    console.log('All analyzed schemas have matching field names with frontend types.');
    return;
  }

  console.log(`⚠️  Found ${results.length} potential mismatches:\n`);

  for (const result of results) {
    console.log(`📁 ${result.schemaFile} :: ${result.schemaName}`);
    console.log(`   ↔ ${result.typeFile} :: ${result.typeName}`);

    if (result.missingInSchema.length > 0) {
      console.log(`   ❌ Frontend sends but schema missing: ${result.missingInSchema.join(', ')}`);
    }
    if (result.extraInSchema.length > 0) {
      console.log(`   ⚠️  Schema expects but frontend may not send: ${result.extraInSchema.join(', ')}`);
    }
    console.log('');
  }

  console.log('---');
  console.log('Fix: Update backend schema field names to match frontend types.');
  console.log('The frontend types are the source of truth (they match Prisma/DB).');
}

// Main
function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--report';

  if (mode === '--help') {
    console.log(`
Schema Field Sync Validator

Detects field name mismatches between backend Zod schemas and frontend TypeScript types.
These mismatches cause silent data loss (Zod strips unknown fields).

Usage:
  node scripts/hooks/check-schema-field-sync.js [--check|--report|--help]

Modes:
  --report  Generate detailed mismatch report (default)
  --check   Exit with error code 1 if mismatches found (for CI/hooks)
  --help    Show this help message

Examples:
  node scripts/hooks/check-schema-field-sync.js --report
  node scripts/hooks/check-schema-field-sync.js --check && git commit
`);
    process.exit(0);
  }

  const results = analyzeSchemas();
  printReport(results);

  if (mode === '--check' && results.length > 0) {
    process.exit(1);
  }
}

main();
