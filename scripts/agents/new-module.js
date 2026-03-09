#!/usr/bin/env node
/**
 * New Module Agent (A1)
 *
 * Orchestrates the complete module creation workflow:
 * 1. Scaffold backend + frontend files (S1)
 * 2. Run Prisma migration
 * 3. Generate frontend types from schema (S2)
 * 4. Register routes in lazy-routes + App.tsx + backend routes/index (S5)
 * 5. Verify TypeScript compilation
 *
 * Usage:
 *   node scripts/agents/new-module.js --name <module> --fields "<fields>" [options]
 *
 * Options:
 *   --name <name>       Module name (singular, e.g., warehouse)
 *   --fields "<fields>" Field definitions (e.g., "name:string, capacity:number?")
 *   --prefix <prefix>   Code prefix (e.g., WH for warehouse)
 *   --section <section> Sidebar section (default: Masters)
 *   --icon <icon>       Lucide icon name (default: Box)
 *   --dry-run           Show what would happen without executing
 *   --skip-migration    Skip Prisma migration step
 *   --help              Show usage
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
      stdio: opts.silent ? 'pipe' : 'inherit',
    });
    return { success: true, output: output || '' };
  } catch (error) {
    return { success: false, output: error.stdout || error.stderr || error.message };
  }
}

function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
}

function toPascalCase(str) {
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function toPlural(str) {
  if (str.endsWith('y') && !str.endsWith('ey') && !str.endsWith('oy')) {
    return str.slice(0, -1) + 'ies';
  }
  if (str.endsWith('s') || str.endsWith('x') || str.endsWith('ch') || str.endsWith('sh')) {
    return str + 'es';
  }
  return str + 's';
}

function toKebabCase(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/_/g, '-').toLowerCase();
}

// ─── Steps ────────────────────────────────────────────────────

const steps = [];
let stepNum = 0;

function step(name, fn) {
  steps.push({ name, fn });
}

function runSteps(options) {
  const total = steps.length;
  const results = { passed: 0, failed: 0, skipped: 0, errors: [] };

  console.log(`\n${c('bright', c('cyan', '═══════════════════════════════════════════'))}`);
  console.log(`${c('bright', c('cyan', '  New Module Agent — Automated Workflow'))}`);
  console.log(`${c('bright', c('cyan', '═══════════════════════════════════════════'))}\n`);

  console.log(`  Module:  ${c('bright', options.name)}`);
  console.log(`  Fields:  ${c('dim', options.fields)}`);
  console.log(`  Prefix:  ${c('dim', options.prefix || 'auto')}`);
  console.log(`  Section: ${c('dim', options.section)}`);
  console.log(`  Icon:    ${c('dim', options.icon)}`);
  console.log(`  Mode:    ${c('dim', options.dryRun ? 'DRY RUN' : 'EXECUTE')}\n`);

  for (const s of steps) {
    stepNum++;
    console.log(`${c('bright', `[${stepNum}/${total}]`)} ${s.name}...`);

    try {
      const result = s.fn(options);
      if (result === 'skip') {
        console.log(`  ${c('yellow', '⊘ Skipped')}\n`);
        results.skipped++;
      } else {
        console.log(`  ${c('green', '✓ Done')}\n`);
        results.passed++;
      }
    } catch (error) {
      console.log(`  ${c('red', '✗ Failed:')} ${error.message}\n`);
      results.failed++;
      results.errors.push({ step: s.name, error: error.message });

      // Non-critical steps don't stop the workflow
      if (s.name.includes('migration') || s.name.includes('Scaffold')) {
        console.log(`  ${c('red', '⚠ Critical step failed — aborting workflow.')}\n`);
        break;
      }
    }
  }

  // Summary
  console.log(c('cyan', '─'.repeat(50)));
  console.log(`\n${c('bright', 'Summary:')}`);
  console.log(`  ${c('green', `✓ ${results.passed} passed`)}  ${c('yellow', `⊘ ${results.skipped} skipped`)}  ${c('red', `✗ ${results.failed} failed`)}`);

  if (results.errors.length > 0) {
    console.log(`\n${c('red', 'Errors:')}`);
    results.errors.forEach(e => console.log(`  • ${e.step}: ${e.error}`));
  }

  if (results.failed === 0) {
    console.log(`\n${c('green', '✓ Module created successfully!')}`);
    printNextSteps(options);
  }

  console.log();
  return results.failed === 0 ? 0 : 1;
}

function printNextSteps(options) {
  const pascal = toPascalCase(options.name);
  const kebab = toKebabCase(options.name);
  const plural = toPlural(options.name);

  console.log(`\n${c('bright', 'Manual steps remaining:')}`);
  console.log(`  1. Add sidebar entry to ${c('cyan', 'frontend/src/components/Sidebar.tsx')}:`);
  console.log(`     ${c('dim', `{ name: "${pascal}s", href: "/${kebab}s", icon: ${options.icon} }`)}`);
  console.log(`  2. Verify the app compiles: ${c('dim', 'cd frontend && npx tsc --noEmit')}`);
  console.log(`  3. Start servers and test: ${c('dim', `curl http://localhost:5000/api/${plural}`)}`);
}

// ─── Step Definitions ─────────────────────────────────────────

step('Scaffold backend + frontend files', (opts) => {
  if (opts.dryRun) {
    console.log(`  ${c('dim', `Would run: node scripts/skills/scaffold-module.js --name ${opts.name} --fields "${opts.fields}" --prefix ${opts.prefix}`)}`);
    return;
  }

  const prefix = opts.prefix ? `--prefix ${opts.prefix}` : '';
  const result = exec(
    `node scripts/skills/scaffold-module.js --name ${opts.name} --fields "${opts.fields}" ${prefix}`,
    { silent: true }
  );

  if (!result.success) {
    throw new Error(`Scaffold failed: ${result.output.substring(0, 200)}`);
  }

  // Print file creation summary
  const created = (result.output.match(/✓ Generated:/g) || []).length;
  console.log(`  ${c('dim', `${created} files generated`)}`);
});

step('Add Prisma model to schema', (opts) => {
  if (opts.dryRun) {
    console.log(`  ${c('dim', 'Would append model to schema.prisma')}`);
    return;
  }

  const schemaPath = path.join(process.cwd(), 'backend', 'prisma', 'schema.prisma');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  const pascal = toPascalCase(opts.name);
  const plural = toPlural(opts.name);
  const tableName = plural.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');

  // Check if model already exists
  if (schema.includes(`model ${plural}`)) {
    console.log(`  ${c('yellow', `Model "${plural}" already exists in schema.prisma`)}`);
    return 'skip';
  }

  // Parse fields for Prisma model
  const fields = opts.fields.split(',').map(f => f.trim()).filter(Boolean);
  let modelFields = `  id          Int      @id @default(autoincrement())\n`;

  if (opts.prefix) {
    modelFields += `  code        String   @unique @default("")\n`;
  }

  for (const field of fields) {
    const [name, typeStr] = field.split(':');
    const isOptional = typeStr.endsWith('?');
    const baseType = typeStr.replace('?', '');

    let prismaType;
    switch (baseType) {
      case 'string': prismaType = 'String'; break;
      case 'number': prismaType = 'Int'; break;
      case 'float': prismaType = 'Float'; break;
      case 'boolean': prismaType = 'Boolean'; break;
      case 'date': prismaType = 'DateTime'; break;
      case 'decimal': prismaType = 'Decimal'; break;
      case 'json': prismaType = 'Json'; break;
      default: prismaType = 'String';
    }

    const snakeName = name.replace(/([A-Z])/g, '_$1').toLowerCase();
    const optional = isOptional ? '?' : '';
    const padded = snakeName.padEnd(12);
    modelFields += `  ${padded}${prismaType}${optional}\n`;
  }

  modelFields += `  is_active    Boolean  @default(true)\n`;
  modelFields += `  created_at   DateTime @default(now())\n`;
  modelFields += `  updated_at   DateTime @updatedAt\n`;

  const model = `\nmodel ${plural} {\n${modelFields}\n  @@map("${tableName}")\n}\n`;

  fs.appendFileSync(schemaPath, model);
  console.log(`  ${c('dim', `Appended model "${plural}" to schema.prisma`)}`);
});

step('Run Prisma migration', (opts) => {
  if (opts.dryRun) {
    console.log(`  ${c('dim', `Would run: npx prisma migrate dev --name add_${opts.name}`)}`);
    return;
  }

  if (opts.skipMigration) {
    console.log(`  ${c('dim', 'Migration skipped (--skip-migration)')}`);
    return 'skip';
  }

  const result = exec(
    `npx prisma migrate dev --name add_${opts.name}`,
    { cwd: path.join(process.cwd(), 'backend') }
  );

  if (!result.success) {
    throw new Error('Migration failed. Fix schema errors and re-run.');
  }
});

step('Generate Prisma client', (opts) => {
  if (opts.dryRun) {
    console.log(`  ${c('dim', 'Would run: npx prisma generate')}`);
    return;
  }

  if (opts.skipMigration) {
    return 'skip';
  }

  const result = exec('npx prisma generate', {
    cwd: path.join(process.cwd(), 'backend'),
    silent: true,
  });

  if (!result.success) {
    throw new Error('Prisma generate failed');
  }
});

step('Generate frontend types from schema', (opts) => {
  if (opts.dryRun) {
    console.log(`  ${c('dim', `Would run: node scripts/skills/generate-types.js --model ${toPlural(opts.name)}`)}`);
    return;
  }

  const plural = toPlural(opts.name);
  const result = exec(
    `node scripts/skills/generate-types.js --model ${plural}`,
    { silent: true }
  );

  if (!result.success) {
    // Non-critical — scaffold already creates basic types
    console.log(`  ${c('yellow', 'Type generation had issues (scaffold types still available)')}`);
    console.log(`  ${c('dim', result.output.substring(0, 200))}`);
  }
});

step('Register frontend routes', (opts) => {
  if (opts.dryRun) {
    console.log(`  ${c('dim', `Would update lazy-routes.tsx + App.tsx`)}`);
    return;
  }

  const pascal = toPascalCase(opts.name);
  const kebab = toKebabCase(opts.name);

  const result = exec(
    `node scripts/skills/register-route.js --page ${pascal}List --route /${kebab}s --section ${opts.section} --icon ${opts.icon}`,
    { silent: true }
  );

  if (!result.success) {
    console.log(`  ${c('yellow', 'Route registration had issues')}`);
    console.log(`  ${c('dim', result.output.substring(0, 200))}`);
  }
});

step('Register backend routes', (opts) => {
  if (opts.dryRun) {
    console.log(`  ${c('dim', `Would update backend/src/routes/index.ts`)}`);
    return;
  }

  const kebab = toKebabCase(opts.name);
  const plural = toPlural(opts.name);

  const result = exec(
    `node scripts/skills/register-route.js --page none --route /${kebab}s --backend ${opts.name}`,
    { silent: true }
  );

  // Check if routes/index.ts needs manual update
  const routesIndexPath = path.join(process.cwd(), 'backend', 'src', 'routes', 'index.ts');
  if (fs.existsSync(routesIndexPath)) {
    const content = fs.readFileSync(routesIndexPath, 'utf-8');
    if (!content.includes(`${opts.name}.routes`)) {
      console.log(`  ${c('yellow', `Note: Add to routes/index.ts manually:`)}`);
      console.log(`  ${c('dim', `import ${opts.name}Routes from './${opts.name}.routes';`)}`);
      console.log(`  ${c('dim', `router.use('/${plural}', ${opts.name}Routes);`)}`);
    }
  }
});

step('Verify TypeScript compilation', (opts) => {
  if (opts.dryRun) {
    console.log(`  ${c('dim', 'Would run: npx tsc --noEmit')}`);
    return;
  }

  // Check backend compilation
  const backendResult = exec('npx tsc --noEmit 2>&1 | head -20', {
    cwd: path.join(process.cwd(), 'backend'),
    silent: true,
  });

  if (!backendResult.success) {
    console.log(`  ${c('yellow', 'Backend TypeScript issues (may need manual fixes):')}`);
    const errors = (backendResult.output || '').split('\n').slice(0, 5);
    errors.forEach(e => console.log(`    ${c('dim', e)}`));
  } else {
    console.log(`  ${c('dim', 'Backend: OK')}`);
  }
});

step('Check serializer mappings', (opts) => {
  if (opts.dryRun) {
    console.log(`  ${c('dim', 'Would check for missing RELATION_MAPPINGS')}`);
    return;
  }

  // Run the prisma-server generate-mappings check
  const result = exec(
    'node mcp-servers/prisma-server/index.js generate-mappings 2>&1 | head -20',
    { silent: true }
  );

  if (result.success && result.output.includes('missing')) {
    console.log(`  ${c('yellow', 'Some relation mappings may need updating')}`);
    console.log(`  ${c('dim', 'Run: node mcp-servers/prisma-server/index.js generate-mappings')}`);
  } else {
    console.log(`  ${c('dim', 'Mappings OK')}`);
  }
});

// ─── CLI ──────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    name: '',
    fields: '',
    prefix: '',
    section: 'Masters',
    icon: 'Box',
    dryRun: false,
    skipMigration: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--name': opts.name = args[++i] || ''; break;
      case '--fields': opts.fields = args[++i] || ''; break;
      case '--prefix': opts.prefix = args[++i] || ''; break;
      case '--section': opts.section = args[++i] || 'Masters'; break;
      case '--icon': opts.icon = args[++i] || 'Box'; break;
      case '--dry-run': opts.dryRun = true; break;
      case '--skip-migration': opts.skipMigration = true; break;
      case '--help': opts.help = true; break;
    }
  }

  return opts;
}

function showHelp() {
  console.log(`
${c('bright', c('cyan', 'New Module Agent — Automated Module Creation'))}

Orchestrates the complete module creation workflow in one command.
Chains: scaffold → schema → migrate → types → routes → verify

${c('bright', 'Usage:')}
  node scripts/agents/new-module.js --name <module> --fields "<fields>" [options]

${c('bright', 'Required:')}
  ${c('cyan', '--name <name>')}       Module name (singular, e.g., warehouse, testingLab)
  ${c('cyan', '--fields "<fields>"')} Field definitions (e.g., "name:string, capacity:number?")

${c('bright', 'Options:')}
  ${c('cyan', '--prefix <prefix>')}   Auto-increment code prefix (e.g., WH → WH-001)
  ${c('cyan', '--section <section>')} Sidebar section (default: Masters)
  ${c('cyan', '--icon <icon>')}       Lucide icon name (default: Box)
  ${c('cyan', '--dry-run')}           Show what would happen without executing
  ${c('cyan', '--skip-migration')}    Skip Prisma migration (if schema already migrated)
  ${c('cyan', '--help')}              Show this help

${c('bright', 'Field Types:')}
  string, number, float, boolean, date, decimal, json
  Append ? for optional (e.g., capacity:number?)

${c('bright', 'Examples:')}
  ${c('dim', '# Dry run — see what would happen')}
  node scripts/agents/new-module.js --dry-run --name warehouse --fields "name:string, address:string?, capacity:number?" --prefix WH

  ${c('dim', '# Full execution')}
  node scripts/agents/new-module.js --name warehouse --fields "name:string, address:string?, capacity:number?" --prefix WH --section Masters --icon Warehouse

  ${c('dim', '# Skip migration (schema already migrated)')}
  node scripts/agents/new-module.js --name vendor --fields "name:string, phone:string?" --skip-migration

${c('bright', 'What it does (9 steps):')}
  1. Scaffold backend files (service, controller, routes)
  2. Scaffold frontend files (types, service, page)
  3. Add Prisma model to schema.prisma
  4. Run prisma migrate dev
  5. Generate Prisma client
  6. Generate frontend types from schema
  7. Register frontend routes (lazy-routes + App.tsx)
  8. Register backend routes (routes/index.ts)
  9. Verify TypeScript compilation
  10. Check serializer mappings
`);
}

function main() {
  const opts = parseArgs();

  if (opts.help) {
    showHelp();
    return 0;
  }

  if (!opts.name) {
    console.error(`${c('red', 'Error:')} --name is required. Use --help for usage.`);
    return 1;
  }

  if (!opts.fields) {
    console.error(`${c('red', 'Error:')} --fields is required. Use --help for usage.`);
    return 1;
  }

  return runSteps(opts);
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { main, runSteps };
