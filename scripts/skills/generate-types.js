#!/usr/bin/env node
/**
 * Schema-to-Types Generator
 *
 * Reads Prisma schema models and generates matching frontend TypeScript types
 * with proper camelCase conversion (matching the serializer output).
 *
 * Complements /sync-types (which validates) — this skill GENERATES.
 *
 * Usage:
 *   node scripts/skills/generate-types.js --model <ModelName> [--output <path>] [--preview] [--list] [--help]
 *
 * Examples:
 *   node scripts/skills/generate-types.js --list                    # List all models
 *   node scripts/skills/generate-types.js --model agencies --preview # Preview generated types
 *   node scripts/skills/generate-types.js --model agencies          # Generate frontend types file
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m', bright: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m',
};

function c(color, text) { return `${colors[color]}${text}${colors.reset}`; }

// ─── Schema Parser ────────────────────────────────────────────

function readSchema() {
  const schemaPath = path.join(process.cwd(), 'backend', 'prisma', 'schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    console.error(`${c('red', 'Error:')} schema.prisma not found at ${schemaPath}`);
    process.exit(1);
  }
  return fs.readFileSync(schemaPath, 'utf8');
}

function parseModels(schema) {
  const models = {};
  // Use a more robust regex that handles nested braces in model bodies
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
  let match;

  while ((match = modelRegex.exec(schema)) !== null) {
    const modelName = match[1];
    const body = match[2];
    models[modelName] = body; // Store raw body, parse after all models collected
  }

  // Now parse fields with knowledge of all model names (for relation detection)
  const modelNames = new Set(Object.keys(models));
  const parsed = {};
  for (const [name, body] of Object.entries(models)) {
    parsed[name] = parseFields(body, modelNames);
  }

  return parsed;
}

const PRISMA_SCALAR_TYPES = new Set([
  'String', 'Int', 'Float', 'Boolean', 'DateTime', 'Decimal', 'BigInt', 'Json', 'Bytes',
]);

function parseFields(body, modelNames) {
  const fields = [];
  const lines = body.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;

    // Parse field: name Type[]? @attributes
    const fieldMatch = trimmed.match(/^(\w+)\s+(\w+)(\[\])?([\?]?)\s*(.*)?$/);
    if (!fieldMatch) continue;

    const [, name, type, isArray, isOptional, attributes] = fieldMatch;

    // Skip directive-like lines
    if (name === '@@map' || name === '@@index' || name === '@@unique') continue;

    // A field is a relation if its type matches another model name (not a scalar type)
    const isRelation = !PRISMA_SCALAR_TYPES.has(type) && modelNames.has(type);
    const hasRelationAttr = (attributes || '').includes('@relation');
    const isActualRelation = isRelation || hasRelationAttr;

    const isId = (attributes || '').includes('@id');
    const hasDefault = (attributes || '').includes('@default');
    const isUpdatedAt = (attributes || '').includes('@updatedAt');
    const mappedName = extractMap(attributes || '');

    fields.push({
      name,
      type,
      isArray: !!isArray,
      isOptional: !!isOptional,
      isRelation: isActualRelation,
      isId,
      hasDefault,
      isUpdatedAt,
      mappedName,
      raw: trimmed,
    });
  }

  return fields;
}

function extractMap(attributes) {
  const match = attributes.match(/@map\("([^"]+)"\)/);
  return match ? match[1] : null;
}

// ─── Serializer Mappings ──────────────────────────────────────

function readRelationMappings() {
  const serializerPath = path.join(process.cwd(), 'backend', 'src', 'utils', 'serializer.ts');
  if (!fs.existsSync(serializerPath)) {
    console.warn(`${c('yellow', 'Warning:')} serializer.ts not found, using default camelCase conversion`);
    return {};
  }

  const content = fs.readFileSync(serializerPath, 'utf8');
  const mappings = {};

  // Extract RELATION_MAPPINGS object
  const mapRegex = /['"](\w+)['"]\s*:\s*['"]([\w]+)['"]/g;
  let match;

  // Find the RELATION_MAPPINGS section
  const sectionMatch = content.match(/RELATION_MAPPINGS[^{]*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
  if (sectionMatch) {
    const section = sectionMatch[1];
    while ((match = mapRegex.exec(section)) !== null) {
      mappings[match[1]] = match[2];
    }
  }

  return mappings;
}

function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// ─── Type Generation ──────────────────────────────────────────

function prismaTypeToTs(prismaType, isOptional, isArray) {
  let tsType;
  switch (prismaType) {
    case 'String': tsType = 'string'; break;
    case 'Int': case 'Float': case 'Decimal': case 'BigInt': tsType = 'number'; break;
    case 'Boolean': tsType = 'boolean'; break;
    case 'DateTime': tsType = 'string'; break; // ISO string in frontend
    case 'Json': tsType = 'any'; break;
    case 'Bytes': tsType = 'string'; break;
    default: tsType = prismaType; // Relation type
  }

  if (isArray) tsType = `${tsType}[]`;
  if (isOptional) tsType = `${tsType} | null`;
  return tsType;
}

function generateFrontendType(modelName, fields, relationMappings) {
  const scalarFields = fields.filter(f => !f.isRelation);
  const relationFields = fields.filter(f => f.isRelation);

  // Determine the singular name for type (remove trailing 's' for plural models)
  let typeName = modelName;
  if (typeName.endsWith('ies')) typeName = typeName.slice(0, -3) + 'y';
  else if (typeName.endsWith('ses') || typeName.endsWith('xes') || typeName.endsWith('ches') || typeName.endsWith('shes')) typeName = typeName.slice(0, -2);
  else if (typeName.endsWith('s') && !typeName.endsWith('ss')) typeName = typeName.slice(0, -1);

  // Capitalize first letter
  typeName = typeName.charAt(0).toUpperCase() + typeName.slice(1);

  let output = `/**\n * ${typeName} Types\n * Auto-generated from Prisma model: ${modelName}\n * Frontend types use camelCase (serializer converts from snake_case)\n */\n\n`;

  // Main entity interface
  output += `export interface ${typeName} {\n`;

  for (const field of scalarFields) {
    // Convert field name to camelCase if it has underscores
    const frontendName = snakeToCamel(field.name);
    const tsType = prismaTypeToTs(field.type, field.isOptional, field.isArray);
    output += `  ${frontendName}: ${tsType};\n`;
  }

  // Add relation fields as optional
  if (relationFields.length > 0) {
    output += `  // Relations (optional, included when fetched with includes)\n`;
    for (const field of relationFields) {
      // Check if there's a custom mapping in serializer
      const mappedName = relationMappings[field.name] || snakeToCamel(field.name);
      const tsType = field.isArray ? `${field.type}[]` : field.type;
      output += `  ${mappedName}?: ${tsType}${field.isOptional ? ' | null' : ''};\n`;
    }
  }

  output += `}\n\n`;

  // Create request (exclude id, code, timestamps, relations, FK ids ending in Id)
  const createFields = scalarFields.filter(f =>
    !f.isId && !f.isUpdatedAt && f.name !== 'createdAt' && f.name !== 'created_at' &&
    f.name !== 'updatedAt' && f.name !== 'updated_at' && f.name !== 'code' &&
    !f.hasDefault && !f.name.endsWith('Id') && !f.name.endsWith('_id')
  );

  output += `export interface Create${typeName}Request {\n`;
  for (const field of createFields) {
    const frontendName = snakeToCamel(field.name);
    const baseType = prismaTypeToTs(field.type, false, field.isArray);
    output += `  ${frontendName}${field.isOptional ? '?' : ''}: ${baseType};\n`;
  }
  output += `}\n\n`;

  // Update request (all optional)
  output += `export interface Update${typeName}Request {\n`;
  for (const field of createFields) {
    const frontendName = snakeToCamel(field.name);
    const baseType = prismaTypeToTs(field.type, false, field.isArray);
    output += `  ${frontendName}?: ${baseType};\n`;
  }
  output += `}\n\n`;

  // Query params
  output += `export interface ${typeName}QueryParams {\n`;
  output += `  page?: number;\n`;
  output += `  limit?: number;\n`;
  output += `  search?: string;\n`;
  // Add boolean filters
  const boolFields = scalarFields.filter(f => f.type === 'Boolean' && f.name !== 'isActive');
  output += `  isActive?: boolean;\n`;
  for (const f of boolFields) {
    output += `  ${snakeToCamel(f.name)}?: boolean;\n`;
  }
  output += `  sortBy?: string;\n`;
  output += `  sortOrder?: 'asc' | 'desc';\n`;
  output += `}\n\n`;

  // Paginated response
  const pluralTypeName = typeName.endsWith('y')
    ? typeName.slice(0, -1) + 'ies'
    : typeName.endsWith('s') ? typeName + 'es' : typeName + 's';
  output += `export interface Paginated${pluralTypeName} {\n`;
  output += `  data: ${typeName}[];\n`;
  output += `  pagination: {\n`;
  output += `    page: number;\n`;
  output += `    limit: number;\n`;
  output += `    total: number;\n`;
  output += `    totalPages: number;\n`;
  output += `  };\n`;
  output += `}\n`;

  return { typeName, content: output };
}

// ─── Main Logic ───────────────────────────────────────────────

function listModels(models) {
  console.log(`\n${c('bright', c('cyan', '=== Prisma Models ==='))}\n`);

  const names = Object.keys(models).sort();
  console.log(`  ${c('bright', 'Total:')} ${names.length} models\n`);

  for (const name of names) {
    const fields = models[name];
    const scalarCount = fields.filter(f => !f.isRelation).length;
    const relationCount = fields.filter(f => f.isRelation).length;
    console.log(`  ${c('cyan', '•')} ${name.padEnd(35)} ${c('dim', `${scalarCount} fields, ${relationCount} relations`)}`);
  }
  console.log();
}

function showHelp() {
  console.log(`
${c('bright', c('cyan', 'Schema-to-Types Generator'))}

Reads Prisma schema and generates frontend TypeScript types with camelCase conversion.
Complements /sync-types (which validates) — this tool GENERATES.

${c('bright', 'Usage:')}
  node scripts/skills/generate-types.js [options]

${c('bright', 'Options:')}
  ${c('cyan', '--model <name>')}   Prisma model name (e.g., agencies, purchase_orders)
  ${c('cyan', '--output <path>')}  Output file path (default: frontend/src/types/<model>.types.ts)
  ${c('cyan', '--preview')}        Print generated types without writing file
  ${c('cyan', '--list')}           List all Prisma models
  ${c('cyan', '--help')}           Show this help

${c('bright', 'Examples:')}
  node scripts/skills/generate-types.js --list
  node scripts/skills/generate-types.js --model agencies --preview
  node scripts/skills/generate-types.js --model agencies
  node scripts/skills/generate-types.js --model purchase_orders --output frontend/src/types/po.types.ts

${c('bright', 'Notes:')}
  - Reads RELATION_MAPPINGS from serializer.ts for custom field name mappings
  - All field names are converted to camelCase (matching serializer output)
  - DateTime fields become 'string' (ISO format in frontend)
  - Decimal/BigInt fields become 'number'
  - Run /sync-types after generating to validate the output
`);
}

function main() {
  const args = process.argv.slice(2);
  let modelName = '', outputPath = '', preview = false, list = false, help = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--model': modelName = args[++i] || ''; break;
      case '--output': outputPath = args[++i] || ''; break;
      case '--preview': preview = true; break;
      case '--list': list = true; break;
      case '--help': help = true; break;
    }
  }

  if (help) { showHelp(); return 0; }

  const schema = readSchema();
  const models = parseModels(schema);

  if (list) { listModels(models); return 0; }

  if (!modelName) {
    console.error(`${c('red', 'Error:')} --model is required. Use --list to see available models, or --help for usage.`);
    return 1;
  }

  // Find model (case-insensitive)
  const matchedModel = Object.keys(models).find(m => m.toLowerCase() === modelName.toLowerCase());
  if (!matchedModel) {
    console.error(`${c('red', 'Error:')} Model "${modelName}" not found.`);
    console.log(`\n${c('dim', 'Available models:')}`);
    const similar = Object.keys(models).filter(m => m.toLowerCase().includes(modelName.toLowerCase()));
    if (similar.length > 0) {
      similar.forEach(m => console.log(`  ${c('cyan', '•')} ${m}`));
    } else {
      console.log(`  Use --list to see all models`);
    }
    return 1;
  }

  const fields = models[matchedModel];
  const relationMappings = readRelationMappings();

  console.log(`\n${c('bright', c('cyan', '=== Schema-to-Types Generator ==='))}\n`);
  console.log(`  Model:     ${c('bright', matchedModel)}`);
  console.log(`  Fields:    ${fields.filter(f => !f.isRelation).length} scalar, ${fields.filter(f => f.isRelation).length} relations`);
  console.log(`  Mappings:  ${Object.keys(relationMappings).length} custom mappings loaded\n`);

  const { typeName, content } = generateFrontendType(matchedModel, fields, relationMappings);

  if (preview) {
    console.log(c('dim', '─'.repeat(50)));
    console.log(content);
    console.log(c('dim', '─'.repeat(50)));
    console.log(`\n${c('yellow', 'Preview mode.')} Run without --preview to write file.\n`);
    return 0;
  }

  // Determine output path
  const defaultFileName = snakeToCamel(matchedModel.replace(/s$/, ''));
  const outFile = outputPath || `frontend/src/types/${defaultFileName}.types.ts`;
  const fullPath = path.join(process.cwd(), outFile);

  // Check if file exists
  if (fs.existsSync(fullPath)) {
    console.log(`${c('yellow', 'Warning:')} File already exists: ${outFile}`);
    console.log(`${c('dim', 'Use --preview to see generated types, then manually merge if needed.')}\n`);

    // Print the generated content for manual merging
    console.log(c('dim', '─'.repeat(50)));
    console.log(content);
    console.log(c('dim', '─'.repeat(50)));
    return 0;
  }

  // Write file
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`${c('green', '✓')} Generated: ${c('bright', outFile)}`);
  console.log(`${c('dim', `  Type name: ${typeName}`)}`);
  console.log(`\n${c('dim', 'Next: Run /sync-types to validate the generated types.')}\n`);

  return 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { parseModels, parseFields, generateFrontendType, snakeToCamel };
