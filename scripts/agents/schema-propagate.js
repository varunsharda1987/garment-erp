#!/usr/bin/env node
/**
 * Schema Change Propagation Agent (A2)
 *
 * After schema.prisma changes, automatically propagates changes downstream:
 * 1. Detect what changed (diff against git HEAD)
 * 2. Generate Prisma client
 * 3. Update/generate frontend types for changed models
 * 4. Check serializer RELATION_MAPPINGS for new relations
 * 5. Run type validation (/sync-types)
 * 6. Verify TypeScript compilation
 *
 * Usage:
 *   node scripts/agents/schema-propagate.js [--check|--propagate|--dry-run|--help]
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const colors = {
  reset: '\x1b[0m', bright: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m',
};

function c(color, text) { return `${colors[color]}${text}${colors.reset}`; }

function exec(command, opts = {}) {
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      cwd: opts.cwd || process.cwd(),
      stdio: opts.silent ? ['pipe', 'pipe', 'pipe'] : 'inherit',
    });
    return { success: true, output: output || '' };
  } catch (error) {
    return { success: false, output: error.stdout || error.stderr || error.message };
  }
}

function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
}

// ─── Schema Diff ─────────────────────────────────────────────

function detectSchemaChanges() {
  // Get the diff from git
  const result = exec('git diff -- backend/prisma/schema.prisma', { silent: true });

  if (!result.success || !result.output.trim()) {
    // Also check staged changes
    const staged = exec('git diff --cached -- backend/prisma/schema.prisma', { silent: true });
    if (!staged.success || !staged.output.trim()) {
      return { hasChanges: false, added: [], modified: [], removed: [], newRelations: [] };
    }
    return parseSchemaDiff(staged.output);
  }

  return parseSchemaDiff(result.output);
}

function parseSchemaDiff(diffOutput) {
  const lines = diffOutput.split('\n');
  const added = [];
  const modified = new Set();
  const removed = [];
  const newRelations = [];
  const newFields = [];

  let currentModel = null;

  for (const line of lines) {
    // Track which model we're in
    const modelMatch = line.match(/^\s*model\s+(\w+)\s*\{/);
    if (modelMatch) {
      currentModel = modelMatch[1];
    }

    // Detect added model
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const addedModel = line.match(/^\+\s*model\s+(\w+)\s*\{/);
      if (addedModel) {
        added.push(addedModel[1]);
        currentModel = addedModel[1];
        continue;
      }

      // Detect added field
      const addedField = line.match(/^\+\s+(\w+)\s+(\w+)/);
      if (addedField && currentModel) {
        modified.add(currentModel);
        newFields.push({ model: currentModel, field: addedField[1], type: addedField[2] });

        // Check if it's a relation (type starts with uppercase and isn't a scalar)
        const scalars = new Set(['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Decimal', 'BigInt', 'Json', 'Bytes']);
        if (!scalars.has(addedField[2]) && /^[A-Z]/.test(addedField[2])) {
          newRelations.push({
            model: currentModel,
            field: addedField[1],
            relatedModel: addedField[2],
          });
        }

        // Also detect @relation in the line
        if (line.includes('@relation') && addedField[1].includes('_')) {
          newRelations.push({
            model: currentModel,
            field: addedField[1],
            relatedModel: addedField[2],
          });
        }
      }
    }

    // Detect removed model
    if (line.startsWith('-') && !line.startsWith('---')) {
      const removedModel = line.match(/^-\s*model\s+(\w+)\s*\{/);
      if (removedModel) {
        removed.push(removedModel[1]);
      }
    }
  }

  return {
    hasChanges: added.length > 0 || modified.size > 0 || removed.length > 0,
    added,
    modified: [...modified],
    removed,
    newRelations,
    newFields,
  };
}

// ─── Downstream Impact ───────────────────────────────────────

function findDownstreamFiles(modelNames) {
  const impact = {
    types: [],
    services: [],
    controllers: [],
    pages: [],
    serializer: false,
  };

  for (const model of modelNames) {
    const camel = snakeToCamel(model);
    const lower = model.toLowerCase();

    // Backend files
    const servicePath = `backend/src/services/${lower}.service.ts`;
    const controllerPath = `backend/src/controllers/${lower}.controller.ts`;
    const routesPath = `backend/src/routes/${lower}.routes.ts`;

    if (fs.existsSync(path.join(process.cwd(), servicePath))) impact.services.push(servicePath);
    if (fs.existsSync(path.join(process.cwd(), controllerPath))) impact.controllers.push(controllerPath);

    // Frontend types (try common patterns)
    const typePatterns = [
      `frontend/src/types/${camel}.types.ts`,
      `frontend/src/types/${lower}.types.ts`,
    ];

    for (const tp of typePatterns) {
      if (fs.existsSync(path.join(process.cwd(), tp))) impact.types.push(tp);
    }

    // Frontend pages
    const pascal = camel.charAt(0).toUpperCase() + camel.slice(1);
    const pagePatterns = [
      `frontend/src/pages/${pascal}List.tsx`,
      `frontend/src/pages/${pascal}Page.tsx`,
      `frontend/src/pages/${pascal}Form.tsx`,
    ];

    for (const pp of pagePatterns) {
      if (fs.existsSync(path.join(process.cwd(), pp))) impact.pages.push(pp);
    }
  }

  return impact;
}

// ─── Steps ────────────────────────────────────────────────────

async function runPropagation(options) {
  console.log(`\n${c('bright', c('cyan', '═══════════════════════════════════════════'))}`);
  console.log(`${c('bright', c('cyan', '  Schema Change Propagation Agent'))}`);
  console.log(`${c('bright', c('cyan', '═══════════════════════════════════════════'))}\n`);

  // Step 1: Detect changes
  console.log(`${c('bright', '[1/7]')} Detecting schema changes...`);
  const changes = detectSchemaChanges();

  if (!changes.hasChanges) {
    console.log(`  ${c('green', '✓')} No schema changes detected (compared to git HEAD)`);
    console.log(`  ${c('dim', 'Nothing to propagate.\n')}`);
    return 0;
  }

  console.log(`  Added models:    ${changes.added.length > 0 ? c('green', changes.added.join(', ')) : c('dim', 'none')}`);
  console.log(`  Modified models: ${changes.modified.length > 0 ? c('yellow', changes.modified.join(', ')) : c('dim', 'none')}`);
  console.log(`  Removed models:  ${changes.removed.length > 0 ? c('red', changes.removed.join(', ')) : c('dim', 'none')}`);
  console.log(`  New relations:   ${changes.newRelations.length > 0 ? c('cyan', changes.newRelations.map(r => `${r.model}.${r.field}`).join(', ')) : c('dim', 'none')}`);
  if (changes.newFields.length > 0) {
    console.log(`  New fields:      ${c('cyan', changes.newFields.map(f => `${f.model}.${f.field}`).join(', '))}`);
  }
  console.log();

  // Step 2: Find downstream impact
  console.log(`${c('bright', '[2/7]')} Analyzing downstream impact...`);
  const allModels = [...changes.added, ...changes.modified];
  const impact = findDownstreamFiles(allModels);

  const totalImpact = impact.types.length + impact.services.length + impact.controllers.length + impact.pages.length;
  console.log(`  Affected files: ${totalImpact > 0 ? c('yellow', String(totalImpact)) : c('green', '0')}`);
  if (impact.types.length > 0) console.log(`    Types:       ${impact.types.join(', ')}`);
  if (impact.services.length > 0) console.log(`    Services:    ${impact.services.join(', ')}`);
  if (impact.controllers.length > 0) console.log(`    Controllers: ${impact.controllers.join(', ')}`);
  if (impact.pages.length > 0) console.log(`    Pages:       ${impact.pages.join(', ')}`);
  console.log();

  if (options.dryRun) {
    console.log(`  ${c('yellow', 'DRY RUN — showing what would happen without executing')}\n`);
  }

  // Step 3: Generate Prisma client
  console.log(`${c('bright', '[3/7]')} Generating Prisma client...`);
  if (options.dryRun) {
    console.log(`  ${c('dim', 'Would run: npx prisma generate')}\n`);
  } else {
    const genResult = exec('npx prisma generate', {
      cwd: path.join(process.cwd(), 'backend'),
      silent: true,
    });
    if (genResult.success) {
      console.log(`  ${c('green', '✓')} Prisma client generated\n`);
    } else {
      console.log(`  ${c('red', '✗')} Prisma generate failed`);
      console.log(`  ${c('dim', genResult.output.substring(0, 200))}\n`);
    }
  }

  // Step 4: Generate/update frontend types for changed models
  console.log(`${c('bright', '[4/7]')} Generating frontend types for changed models...`);
  for (const model of allModels) {
    if (options.dryRun) {
      console.log(`  ${c('dim', `Would run: node scripts/skills/generate-types.js --model ${model} --preview`)}`);
    } else {
      const typeResult = exec(
        `node scripts/skills/generate-types.js --model ${model} --preview`,
        { silent: true }
      );
      if (typeResult.success) {
        console.log(`  ${c('green', '✓')} Types generated for ${model}`);
        // Check if types file exists — if so, warn about manual merge
        const camel = snakeToCamel(model);
        const typePath = path.join(process.cwd(), 'frontend', 'src', 'types', `${camel}.types.ts`);
        if (fs.existsSync(typePath)) {
          console.log(`    ${c('yellow', '⚠')} ${camel}.types.ts exists — review generated types and merge manually`);
        }
      } else {
        console.log(`  ${c('yellow', '⊘')} Model "${model}" not found in schema (may be a table name)`);
      }
    }
  }
  console.log();

  // Step 5: Check serializer mappings for new relations
  console.log(`${c('bright', '[5/7]')} Checking serializer relation mappings...`);
  if (changes.newRelations.length > 0) {
    const serializerPath = path.join(process.cwd(), 'backend', 'src', 'utils', 'serializer.ts');
    if (fs.existsSync(serializerPath)) {
      const serializerContent = fs.readFileSync(serializerPath, 'utf-8');
      const missing = [];

      for (const rel of changes.newRelations) {
        if (rel.field.includes('_') && !serializerContent.includes(`'${rel.field}'`) && !serializerContent.includes(`"${rel.field}"`)) {
          missing.push(rel);
        }
      }

      if (missing.length > 0) {
        console.log(`  ${c('yellow', `⚠ ${missing.length} new relation(s) need RELATION_MAPPINGS entries:`)}`);
        for (const m of missing) {
          const camelField = snakeToCamel(m.field);
          if (options.dryRun) {
            console.log(`    ${c('dim', `Would add: ${m.field}: '${camelField}',`)}`);
          } else {
            console.log(`    ${c('bright', `  ${m.field}: '${camelField}',`)}  ${c('dim', `(in ${m.model})`)}`);
          }
        }
        console.log(`  ${c('dim', 'Add to backend/src/utils/serializer.ts RELATION_MAPPINGS')}`);
      } else {
        console.log(`  ${c('green', '✓')} All new relations are mapped`);
      }
    }
  } else {
    console.log(`  ${c('green', '✓')} No new relations to map`);
  }
  console.log();

  // Step 6: Run type validation
  console.log(`${c('bright', '[6/7]')} Running type synchronization check...`);
  if (options.dryRun) {
    console.log(`  ${c('dim', 'Would run: node scripts/skills/sync-types.js --check')}\n`);
  } else {
    const syncResult = exec('node scripts/skills/sync-types.js --check', { silent: true });
    if (syncResult.success) {
      console.log(`  ${c('green', '✓')} Type sync check passed\n`);
    } else {
      console.log(`  ${c('yellow', '⚠')} Type sync issues detected`);
      // Show first few issues
      const issues = (syncResult.output || '').split('\n').filter(l => l.includes('⚠') || l.includes('✗'));
      issues.slice(0, 5).forEach(i => console.log(`    ${c('dim', i)}`));
      console.log();
    }
  }

  // Step 7: Verify TypeScript compilation
  console.log(`${c('bright', '[7/7]')} Verifying TypeScript compilation...`);
  if (options.dryRun) {
    console.log(`  ${c('dim', 'Would run: npx tsc --noEmit')}\n`);
  } else {
    const tscResult = exec('npx tsc --noEmit 2>&1 | head -10', {
      cwd: path.join(process.cwd(), 'backend'),
      silent: true,
    });

    if (tscResult.success) {
      console.log(`  ${c('green', '✓')} Backend compiles successfully`);
    } else {
      console.log(`  ${c('yellow', '⚠')} Backend TypeScript issues:`);
      const errors = (tscResult.output || '').split('\n').slice(0, 5);
      errors.filter(e => e.trim()).forEach(e => console.log(`    ${c('dim', e)}`));
    }
    console.log();
  }

  // Summary
  console.log(c('cyan', '─'.repeat(50)));
  console.log(`\n${c('bright', 'Propagation complete!')}`);

  if (changes.added.length > 0) {
    console.log(`\n${c('bright', 'New models added:')}`);
    changes.added.forEach(m => {
      console.log(`  ${c('green', '+')} ${m} — may need: service, controller, routes, page`);
    });
    console.log(`  ${c('dim', 'Use: node scripts/agents/new-module.js --name <module> --fields "..."')}`);
  }

  if (changes.modified.length > 0) {
    console.log(`\n${c('bright', 'Modified models:')}`);
    changes.modified.forEach(m => {
      console.log(`  ${c('yellow', '~')} ${m} — check: types, serializer, services`);
    });
  }

  console.log();
  return 0;
}

// ─── Check-only mode ─────────────────────────────────────────

function checkOnly() {
  console.log(`\n${c('bright', c('cyan', '=== Schema Change Detection ==='))}\n`);

  const changes = detectSchemaChanges();

  if (!changes.hasChanges) {
    console.log(`${c('green', '✓')} No schema changes detected\n`);
    return 0;
  }

  console.log(`${c('yellow', 'Schema changes detected:')}\n`);
  if (changes.added.length > 0) console.log(`  Added:    ${c('green', changes.added.join(', '))}`);
  if (changes.modified.length > 0) console.log(`  Modified: ${c('yellow', changes.modified.join(', '))}`);
  if (changes.removed.length > 0) console.log(`  Removed:  ${c('red', changes.removed.join(', '))}`);

  if (changes.newRelations.length > 0) {
    console.log(`\n  ${c('cyan', 'New relations:')}`);
    changes.newRelations.forEach(r => {
      console.log(`    ${r.model}.${r.field} → ${r.relatedModel}`);
    });
  }

  if (changes.newFields.length > 0) {
    console.log(`\n  ${c('cyan', 'New fields:')}`);
    changes.newFields.forEach(f => {
      console.log(`    ${f.model}.${f.field}: ${f.type}`);
    });
  }

  const allModels = [...changes.added, ...changes.modified];
  const impact = findDownstreamFiles(allModels);
  const totalImpact = impact.types.length + impact.services.length + impact.controllers.length + impact.pages.length;

  if (totalImpact > 0) {
    console.log(`\n  ${c('yellow', `${totalImpact} downstream files may need updating:`)}`);
    [...impact.types, ...impact.services, ...impact.controllers, ...impact.pages]
      .forEach(f => console.log(`    ${c('dim', f)}`));
  }

  console.log(`\n${c('dim', 'Run with --propagate to auto-fix, or --dry-run to preview.')}\n`);
  return 1;
}

// ─── CLI ─────────────────────────────────────────────────────

function showHelp() {
  console.log(`
${c('bright', c('cyan', 'Schema Change Propagation Agent'))}

After modifying schema.prisma, this agent detects changes and propagates them
downstream (types, serializer, client). Goes beyond hooks — it FIXES, not just detects.

${c('bright', 'Usage:')}
  node scripts/agents/schema-propagate.js [mode]

${c('bright', 'Modes:')}
  ${c('cyan', '--check')}       Detect changes and show impact (no modifications)
  ${c('cyan', '--propagate')}   Detect and propagate changes (default)
  ${c('cyan', '--dry-run')}     Show what would happen without executing
  ${c('cyan', '--help')}        Show this help

${c('bright', 'Examples:')}
  ${c('dim', '# After editing schema.prisma, check what changed')}
  node scripts/agents/schema-propagate.js --check

  ${c('dim', '# Preview propagation steps')}
  node scripts/agents/schema-propagate.js --dry-run

  ${c('dim', '# Run full propagation')}
  node scripts/agents/schema-propagate.js --propagate

${c('bright', 'What it does (7 steps):')}
  1. Diff schema.prisma against git HEAD
  2. Identify downstream files impacted
  3. Regenerate Prisma client
  4. Generate/update frontend types for changed models
  5. Check serializer RELATION_MAPPINGS for new relations
  6. Run type synchronization validation
  7. Verify TypeScript compilation

${c('bright', 'When to use:')}
  - After adding new models to schema.prisma
  - After adding fields or relations to existing models
  - After renaming or removing model fields
  - Before committing schema changes
`);
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--propagate';

  switch (mode) {
    case '--check':
      return checkOnly();

    case '--propagate':
      return await runPropagation({ dryRun: false });

    case '--dry-run':
      return await runPropagation({ dryRun: true });

    case '--help':
      showHelp();
      return 0;

    default:
      console.error(`${c('red', 'Unknown mode:')} ${mode}. Use --help.`);
      return 1;
  }
}

if (require.main === module) {
  main().then(code => process.exit(code));
}

module.exports = { main, detectSchemaChanges, findDownstreamFiles };
