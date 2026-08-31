#!/usr/bin/env node
/**
 * Smart Check - Unified Auto-Detecting Hook
 *
 * ONE hook that automatically figures out what to check based on your changes.
 * No need to remember which hook does what - this does it all.
 *
 * Usage: Runs automatically on git commit via Husky
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadBaseline, diff } = require('./ratchet');
const { checkAlignment } = require('./check-schema-controller-alignment');
const detectors = require('./drift-detectors');

// Colors for terminal output
const c = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

// Get list of staged files
function getStagedFiles() {
  try {
    const result = execSync('git diff --cached --name-only', { encoding: 'utf-8' });
    return result.split('\n').filter(line => line.trim());
  } catch {
    return [];
  }
}

// --- Stock-sync enforcement (bug-hunt BH-0333/BH-0338) --------------------------------
// The old check only looked at *stock*.service.ts, so it missed every controller and any
// service whose name lacks "stock" — which is how the ledger corruption slipped in. Detect
// stock-table writes by CONTENT instead, across all backend .ts files, and BLOCK new ones.
// A baseline grandfathers the existing violations so this can enforce without a big-bang fix.
const STOCK_WRITE_RE =
  /\b(?:prisma|tx)\.(greige_stock|fabric_stock|lace_stock|thread_stock|button_stock|zipper_stock|elastic_stock|label_stock|packaging_stock|stock_levels)\.(create|update|updateMany|createMany|upsert|delete|deleteMany)\b/;
// A file that writes a stock table is fine if it also uses one of the sanctioned sync paths.
const SYNC_MARKERS = ['material-sync.helper', 'stock-routing.helper', 'syncStockLevelQuantity', 'routeToSpecializedStock'];

function writesStockTableWithoutSync(content) {
  return STOCK_WRITE_RE.test(content) && !SYNC_MARKERS.some(m => content.includes(m));
}

function loadStockSyncBaseline() {
  try {
    const p = path.join(process.cwd(), 'scripts/hooks/stock-sync-baseline.json');
    return new Set(JSON.parse(fs.readFileSync(p, 'utf8')));
  } catch {
    return new Set();
  }
}

// Categorize files by type
function categorizeFiles(files) {
  return {
    schemas: files.filter(f => f.endsWith('.schema.ts')),
    controllers: files.filter(f => f.endsWith('.controller.ts')),
    services: files.filter(f => f.endsWith('.service.ts')),
    types: files.filter(f => f.endsWith('.types.ts')),
    stockServices: files.filter(f => f.includes('stock') && f.endsWith('.service.ts')),
    backendTs: files.filter(f => f.startsWith('backend/') && f.endsWith('.ts') && !f.endsWith('.test.ts')),
    docs: files.filter(f => f.startsWith('docs/') && f.endsWith('.md')),
    prisma: files.filter(f => f.includes('schema.prisma')),
    typescript: files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx')),
    routes: files.filter(f => f.endsWith('.routes.ts')),
    frontend: files.filter(f => f.startsWith('frontend/') && (f.endsWith('.ts') || f.endsWith('.tsx'))),
  };
}

// ============================================================================
// CHECK FUNCTIONS
// ============================================================================

/**
 * Check: Schema-Controller naming matches (basic pagination check)
 */
function checkSchemaControllerSync() {
  console.log(`\n${c.cyan}Checking schema-controller sync...${c.reset}`);

  const controllersDir = path.join(process.cwd(), 'backend/src/controllers');

  const issues = [];

  // Check pagination format in controllers
  const controllerFiles = fs.readdirSync(controllersDir).filter(f => f.endsWith('.controller.ts'));

  for (const file of controllerFiles) {
    const content = fs.readFileSync(path.join(controllersDir, file), 'utf8');

    // Find pagination objects with 'pages' instead of 'totalPages'
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('pages:') && lines[i].includes('Math.ceil') && !lines[i].includes('totalPages')) {
        issues.push({
          type: 'pagination',
          file,
          line: i + 1,
          message: `Uses "pages" instead of "totalPages"`,
        });
      }
    }
  }

  if (issues.length > 0) {
    console.log(`${c.red}  ✗ Found ${issues.length} issue(s):${c.reset}`);
    issues.forEach(issue => {
      console.log(`    ${issue.file}:${issue.line} - ${issue.message}`);
    });
    return false;
  }

  console.log(`${c.green}  ✓ Schema-controller sync OK${c.reset}`);
  return true;
}

/**
 * Check: Schema-Controller field alignment
 * Runs the full alignment checker to detect Zod schema vs controller destructuring mismatches.
 * Prevents silent data loss from Zod stripping unknown fields.
 */
// Shared ratchet runner: grandfather baselined violations, BLOCK new ones. Returns true=pass.
function runRatchetedCheck(label, violations, baselineName, fixHint) {
  const baseline = loadBaseline(baselineName);
  const { fresh, grandfathered } = diff(violations.map(v => v.key), baseline);
  const freshUniq = [...new Set(fresh)];
  const grandUniq = [...new Set(grandfathered)];

  if (grandUniq.length) {
    console.log(`${c.yellow}  ⚠ ${grandUniq.length} known ${label} (grandfathered — fix when you touch them)${c.reset}`);
  }
  if (freshUniq.length) {
    const byKey = new Map(violations.map(v => [v.key, v]));
    console.log(`${c.red}  ✗ NEW ${label}:${c.reset}`);
    freshUniq.forEach(k => {
      const v = byKey.get(k);
      console.log(`${c.red}    ${v.file}:${v.line} — ${v.detail}${c.reset}`);
    });
    console.log(`${c.dim}    ${fixHint}${c.reset}`);
    return false;
  }
  if (!grandUniq.length) console.log(`${c.green}  ✓ ${label} OK${c.reset}`);
  return true;
}

/**
 * Check (A1): Schema-Controller field alignment — BLOCKING + ratchet.
 * The controller reads a field the Zod schema strips → silent data loss. Runs the full
 * repo-wide alignment analysis in-process and blocks only NEW mismatches vs the baseline.
 */
function checkSchemaControllerAlignment() {
  console.log(`\n${c.cyan}Checking schema-controller field alignment...${c.reset}`);
  let results;
  try {
    results = checkAlignment();
  } catch (e) {
    console.log(`${c.yellow}  ⚠ alignment check could not run: ${e.message}${c.reset}`);
    return true; // fail-open on our own analyzer error — never block on a hook bug
  }
  const violations = [];
  for (const m of results.misaligned) {
    for (const f of m.critical) {
      violations.push({
        key: `${m.route} :: ${m.schemaName} :: ${f}`,
        file: m.controllerFile || m.schemaFile || m.route,
        line: 0,
        detail: `${m.controllerFn} reads '${f}' but ${m.schemaName} strips it`,
      });
    }
  }
  return runRatchetedCheck(
    'schema/controller field mismatch(es)',
    violations,
    'schema-alignment-baseline.json',
    'Add the field to the Zod schema. If intentional, add the key to scripts/hooks/schema-alignment-baseline.json.'
  );
}

/** Check (A2): mutating routes must use validateBody — BLOCKING new + ratchet. */
function checkRouteValidation(routeFiles) {
  console.log(`\n${c.cyan}Checking routes have body validation...${c.reset}`);
  return runRatchetedCheck(
    'mutating route(s) with no validateBody',
    detectors.perRouteValidation(routeFiles),
    'route-validation-baseline.json',
    'Add validateBody(schema) to the route (or mark it `// no-body`). If intentional, add the key to scripts/hooks/route-validation-baseline.json.'
  );
}

/** Check (A3): a Zod enum value not in the correspondingly-named Prisma enum — BLOCKING new + ratchet. */
function checkEnumDrift(schemaFiles) {
  console.log(`\n${c.cyan}Checking Zod enums vs Prisma enums...${c.reset}`);
  return runRatchetedCheck(
    'Zod enum value(s) not in the Prisma enum',
    detectors.enumDrift(schemaFiles),
    'enum-drift-baseline.json',
    'Align the z.enum values with the Prisma enum. If intentional, add the key to scripts/hooks/enum-drift-baseline.json.'
  );
}

/** Check (A4): z.string().datetime() in a schema rejects date-picker input — BLOCKING new + ratchet. */
function checkDatetimeSchema(schemaFiles) {
  console.log(`\n${c.cyan}Checking schemas for z.string().datetime()...${c.reset}`);
  return runRatchetedCheck(
    'z.string().datetime() field(s) (reject YYYY-MM-DD)',
    detectors.datetimeSchema(schemaFiles),
    'datetime-schema-baseline.json',
    'Use z.coerce.date() for date-input fields (or mark `// allow-datetime`). If intentional, add the key to scripts/hooks/datetime-schema-baseline.json.'
  );
}

/** Check (B1): raw divide-by-shrinkage → Infinity at 100% — BLOCKING new + ratchet. */
function checkShrinkageDivide(tsFiles) {
  console.log(`\n${c.cyan}Checking divide-by-shrinkage is guarded...${c.reset}`);
  return runRatchetedCheck(
    'raw divide-by-shrinkage /(1 - x/100)',
    detectors.shrinkageDivide(tsFiles),
    'shrinkage-divide-baseline.json',
    'Route through divideByShrinkage() in backend/src/utils/currency.ts (guards >= 100%). If intentional, add the key to scripts/hooks/shrinkage-divide-baseline.json.'
  );
}

/** Check (B2): en-IN currency toLocaleString must set maximumFractionDigits — BLOCKING new + ratchet. */
function checkCurrencyFormat(tsFiles) {
  console.log(`\n${c.cyan}Checking en-IN currency formatting...${c.reset}`);
  return runRatchetedCheck(
    "en-IN currency format(s) missing maximumFractionDigits",
    detectors.currencyFormat(tsFiles),
    'currency-format-baseline.json',
    'Add maximumFractionDigits: 2 to the toLocaleString options. If intentional, add the key to scripts/hooks/currency-format-baseline.json.'
  );
}

/** Check (C1): controller re-parses req.body/query after route validation — BLOCKING new + ratchet. */
function checkControllerReparse(tsFiles) {
  console.log(`\n${c.cyan}Checking for controller re-parse (dual-schema validation)...${c.reset}`);
  return runRatchetedCheck(
    'controller re-parse(s) of req.body/query (dual-schema drift)',
    detectors.controllerReparse(tsFiles),
    'controller-reparse-baseline.json',
    'Validate ONCE at the route with validateBody/validateQuery using this schema; type req.body in the controller (or mark `// allow-reparse`). If intentional, add the key to scripts/hooks/controller-reparse-baseline.json.'
  );
}

/** Check (C2): global prisma client WRITE inside a $transaction callback — BLOCKING new + ratchet. */
function checkGlobalPrismaInTx(tsFiles) {
  console.log(`\n${c.cyan}Checking for global-prisma writes inside transactions...${c.reset}`);
  return runRatchetedCheck(
    'global-prisma write(s) inside $transaction (escape rollback)',
    detectors.globalPrismaInTx(tsFiles),
    'global-prisma-tx-baseline.json',
    'Use the tx client for every write inside the $transaction callback (or mark `// allow-global-prisma`). If intentional, add the key to scripts/hooks/global-prisma-tx-baseline.json.'
  );
}

/** Check (C3): raw relational compare between Decimal-looking fields — BLOCKING new + ratchet. */
function checkDecimalCompare(tsFiles) {
  console.log(`\n${c.cyan}Checking for raw Decimal comparisons...${c.reset}`);
  return runRatchetedCheck(
    'raw Decimal comparison(s) (compare as strings)',
    detectors.decimalCompare(tsFiles),
    'decimal-compare-baseline.json',
    'Wrap both sides in Number() or use .gte()/.lte() (or mark `// allow-decimal-compare`). If intentional, add the key to scripts/hooks/decimal-compare-baseline.json.'
  );
}

/** Check (C4): count()/findFirst-max+1 document numbering — BLOCKING new + ratchet. */
function checkCountNumbering(tsFiles) {
  console.log(`\n${c.cyan}Checking for count-based document numbering...${c.reset}`);
  return runRatchetedCheck(
    'count()/max+1 number generator(s) (racy duplicates)',
    detectors.countNumbering(tsFiles),
    'count-numbering-baseline.json',
    'Use a sequence table with retry-on-P2002 (or mark `// allow-count-numbering`). If intentional, add the key to scripts/hooks/count-numbering-baseline.json.'
  );
}

/** Check (C5): catch around a Prisma write that only logs — BLOCKING new + ratchet. */
function checkSwallowedWriteErrors(tsFiles) {
  console.log(`\n${c.cyan}Checking for swallowed write errors...${c.reset}`);
  return runRatchetedCheck(
    'swallowed write error(s) (catch only logs)',
    detectors.swallowedWriteErrors(tsFiles),
    'swallowed-write-baseline.json',
    'Rethrow, respond, or surface a flag from the catch (or mark `// allow-swallow` inside it). If intentional, add the key to scripts/hooks/swallowed-write-baseline.json.'
  );
}

/** Check (C6): quantity field assigned arithmetic in update data (lost-update race) — BLOCKING new + ratchet. */
function checkAssignNotIncrement(tsFiles) {
  console.log(`\n${c.cyan}Checking for assign-where-increment-expected...${c.reset}`);
  return runRatchetedCheck(
    'quantity assignment(s) that should be increment/decrement',
    detectors.assignNotIncrement(tsFiles),
    'assign-increment-baseline.json',
    'Use { increment/decrement } or hold a FOR UPDATE row lock (or mark `// allow-assign`). If intentional, add the key to scripts/hooks/assign-increment-baseline.json.'
  );
}

/** Check (C7): required backend schema field missing from paired frontend request type — BLOCKING new + ratchet. */
function checkSchemaFrontendParity(files) {
  console.log(`\n${c.cyan}Checking schema↔frontend payload parity...${c.reset}`);
  return runRatchetedCheck(
    'schema↔frontend parity gap(s) (required field absent from request type)',
    detectors.schemaFrontendParity(files),
    'schema-frontend-parity-baseline.json',
    'Add the field to the frontend Create*Request type (or make it optional in the schema; `// allow-parity` on the interface line opts the pair out). If intentional, add the key to scripts/hooks/schema-frontend-parity-baseline.json.'
  );
}

/** Check (D1): syncStockLevelQuantity called without a warehouseId — BLOCKING new + ratchet. */
function checkStockSyncNoWarehouse(tsFiles) {
  console.log(`\n${c.cyan}Checking stock syncs pass a warehouseId...${c.reset}`);
  return runRatchetedCheck(
    'warehouse-less syncStockLevelQuantity call(s) (helper must guess the row)',
    detectors.stockSyncNoWarehouse(tsFiles),
    'stock-sync-warehouse-baseline.json',
    'Pass the warehouseId this movement belongs to (or mark `// allow-no-warehouse`). If intentional, add the key to scripts/hooks/stock-sync-warehouse-baseline.json.'
  );
}

/** Check (D2): frontend catch that is empty or only console-logs — BLOCKING new + ratchet. */
function checkSilentCatchFrontend(tsFiles) {
  console.log(`\n${c.cyan}Checking frontend catches surface their failures...${c.reset}`);
  return runRatchetedCheck(
    'silent frontend catch(es) (user sees nothing on failure)',
    detectors.silentCatchFrontend(tsFiles),
    'silent-catch-baseline.json',
    'Surface the failure (toast/handleApiError/setError) or mark `// allow-silent-catch` inside the catch. If intentional, add the key to scripts/hooks/silent-catch-baseline.json.'
  );
}

/** Check (D3): `moneyOrQty || null/undefined/""` — a real 0 becomes the fallback — BLOCKING new + ratchet. */
function checkNumericOrFallback(tsFiles) {
  console.log(`\n${c.cyan}Checking for || fallbacks that lose a real 0...${c.reset}`);
  return runRatchetedCheck(
    '|| fallback(s) on money/quantity fields (0 becomes null)',
    detectors.numericOrFallback(tsFiles),
    'numeric-or-fallback-baseline.json',
    'Use ?? so only null/undefined trigger the fallback (or mark `// allow-or-fallback`). If intentional, add the key to scripts/hooks/numeric-or-fallback-baseline.json.'
  );
}

/** Check (D4): schema↔service update parity — field in Zod update schema missing from service update() — BLOCKING new + ratchet. */
function checkSchemaServiceUpdateParity(schemaFiles) {
  console.log(`\n${c.cyan}Checking schema↔service update parity (field silently ignored on update)...${c.reset}`);
  return runRatchetedCheck(
    'schema field(s) missing from service update()',
    detectors.schemaServiceUpdateParity(schemaFiles),
    'schema-service-parity-baseline.json',
    'Add the field to the service\'s Prisma update({ data: {...} }) block. If intentional (nested/relation), add the key to scripts/hooks/schema-service-parity-baseline.json.'
  );
}

/** Check (E1): materials.create with a hand-written literal id (`mat-<code>` etc.) — BLOCKING new + ratchet. */
function checkManualMaterialCreate(tsFiles) {
  console.log(`\n${c.cyan}Checking for hand-written materials.id assignment...${c.reset}`);
  return runRatchetedCheck(
    'hand-written materials.id assignment(s) (forks the material registry)',
    detectors.manualMaterialCreate(tsFiles),
    'manual-material-create-baseline.json',
    'Use materialService.createFromMaster(master, TYPE, tx) — materials.id must equal the master uuid (or mark `// allow-manual-material-create`). If intentional, add the key to scripts/hooks/manual-material-create-baseline.json.'
  );
}

/** Check (E2): placeholder colour literal (Natural/Unknown/Printed) written to colorName — BLOCKING new + ratchet. */
function checkColourSentinelLiteral(tsFiles) {
  console.log(`\n${c.cyan}Checking for placeholder colour sentinels...${c.reset}`);
  return runRatchetedCheck(
    'placeholder colour literal(s) written to colorName (merges every real colour into one fabric)',
    detectors.colourSentinelLiteral(tsFiles),
    'colour-sentinel-baseline.json',
    'Store NULL for unknown colour and resolve the real one via services/helpers/fabric-identity.helper.ts (or mark `// allow-colour-sentinel` for a genuine colour value). If intentional, add the key to scripts/hooks/colour-sentinel-baseline.json.'
  );
}

/** Check (E3): a delete that destroys approved CAD planning work — BLOCKING new + ratchet. */
function checkUnguardedCadDelete(tsFiles) {
  console.log(`\n${c.cyan}Checking for unguarded CAD deletes...${c.reset}`);
  return runRatchetedCheck(
    'unguarded CAD delete(s) (destroys approved CAD planning + costing data)',
    detectors.unguardedCadDelete(tsFiles),
    'cad-delete-baseline.json',
    'Guard fabric_width_cad deletes with validateCADModification(id, "delete"); unlink fabric_width_cad (styleFabricId: null) before deleting style_fabrics/style_components (see style.service.ts). Or mark `// allow-cad-delete`. If intentional, add the key to scripts/hooks/cad-delete-baseline.json.'
  );
}

/** Check (E5): costing code touching the CAD-geometry approval column — BLOCKING new + ratchet. */
function checkCostingApprovalDrift(tsFiles) {
  console.log(`\n${c.cyan}Checking for CAD/costing approval drift...${c.reset}`);
  return runRatchetedCheck(
    'bare approvalStatus use(s) in costing-module code (two-owner split: costing approval is costingApprovalStatus)',
    detectors.costingCadApprovalDrift(tsFiles),
    'costing-approval-drift-baseline.json',
    'Costing semantics must use costingApprovalStatus/costingApprovedBy/costingApprovedAt; approvalStatus is CAD-geometry approval only. Mark a genuine CAD-side use with `// allow-cad-approval`. If intentional, add the key to scripts/hooks/costing-approval-drift-baseline.json.'
  );
}

/** Check (E6): raw sale_orders.status write outside the recompute helper — BLOCKING new + ratchet. */
function checkSaleOrderStatusWrite(tsFiles) {
  console.log(`\n${c.cyan}Checking for raw sale-order status writes...${c.reset}`);
  return runRatchetedCheck(
    'raw sale_orders.status write(s) (progress states are derived — B2B reads this column live)',
    detectors.saleOrderStatusWrite(tsFiles),
    'sale-order-status-baseline.json',
    'Call recomputeSaleOrderStatus(tx, saleOrderId) from services/helpers/sale-order-status.helper.ts after quantity changes; mark a commercial event write (confirm/cancel/POD DELIVERED) with `// allow-sale-order-status`. If intentional, add the key to scripts/hooks/sale-order-status-baseline.json.'
  );
}

/** Check (E7): fabric_width_cad write touching one purpose column without the other — BLOCKING new + ratchet. */
function checkCadPurposeSingleWrite(tsFiles) {
  console.log(`\n${c.cyan}Checking CAD purpose dual-column parity...${c.reset}`);
  return runRatchetedCheck(
    'one-sided fabric_width_cad purpose write(s) (enum-only and string-only gates split)',
    detectors.cadPurposeSingleWrite(tsFiles),
    'cad-purpose-parity-baseline.json',
    'Set BOTH `purpose` and `purposeEnum` in every fabric_width_cad create/update (or neither); mark a deliberate one-sided write with `// allow-single-purpose`. If intentional, add the key to scripts/hooks/cad-purpose-parity-baseline.json.'
  );
}

/** Check (E4): a business default declared outside defaults.registry.ts — BLOCKING new + ratchet. */
function checkHardcodedDefault(tsFiles) {
  console.log(`\n${c.cyan}Checking for hardcoded default values...${c.reset}`);
  return runRatchetedCheck(
    'hardcoded default value(s) competing with backend/src/config/defaults.registry.ts',
    detectors.hardcodedDefault(tsFiles),
    'hardcoded-default-baseline.json',
    'Declare the value once in backend/src/config/defaults.registry.ts and read it with systemSettingsService.getNumberDefault("KEY") (backend) or useDefaultSettings() (frontend). Or mark `// allow-hardcoded-default`. If intentional, add the key to scripts/hooks/hardcoded-default-baseline.json.'
  );
}

/**
 * Check: Type synchronization between frontend and backend
 */
function checkTypeSync() {
  console.log(`\n${c.cyan}Checking type synchronization...${c.reset}`);

  try {
    execSync('node scripts/skills/sync-types.js --check', { encoding: 'utf-8', stdio: 'pipe' });
    console.log(`${c.green}  ✓ Types in sync${c.reset}`);
    return true;
  } catch (error) {
    console.log(`${c.yellow}  ⚠ Type sync issues detected${c.reset}`);
    console.log(`${c.dim}    Run: node scripts/skills/sync-types.js --report${c.reset}`);
    return true; // Warning only, don't block
  }
}

/**
 * Check: AI how-to guides still match the pages/routes/schemas they were written from.
 * Stale guides make the assistant hand the team outdated steps — worse than no guide.
 * Warn-only: prints the stale slugs and the command that regenerates them.
 */
function checkAiGuides() {
  console.log(`\n${c.cyan}Checking AI guide freshness...${c.reset}`);

  try {
    const output = execSync('node scripts/hooks/check-ai-guides.js', { encoding: 'utf-8', stdio: 'pipe' });
    if (output.includes('STALE')) {
      console.log(output.trim());
    } else {
      console.log(`${c.green}  ✓ AI guides current${c.reset}`);
    }
    return true;
  } catch (error) {
    console.log(`${c.yellow}  ⚠ Could not check AI guides${c.reset}`);
    return true; // Warning only, don't block
  }
}

/**
 * Check: the B2B contract suite — runs the executable contract when its surface is staged.
 * Blocks on a genuine test failure; a suite that cannot run (no DB) warns instead.
 */
function checkB2bContract() {
  console.log(`\n${c.cyan}Running the B2B contract test (staged files touch the House of Kasya surface)...${c.reset}`);
  try {
    execSync('node node_modules/jest/bin/jest.js --testPathPatterns=b2b-contract --runInBand --silent', {
      encoding: 'utf-8',
      stdio: 'pipe',
      cwd: path.join(process.cwd(), 'backend'),
      timeout: 180000,
    });
    console.log(`${c.green}  ✓ B2B contract holds (10 promises verified)${c.reset}`);
    return true;
  } catch (error) {
    const out = `${error.stdout || ''}${error.stderr || ''}`;
    if (/ECONNREFUSED|connect|P1001|database/i.test(out) && !/Tests:\s+\d+ failed/.test(out)) {
      console.log(`${c.yellow}  ⚠ Could not run the B2B contract suite (DB unreachable?) — not blocking${c.reset}`);
      return true;
    }
    console.log(`${c.red}  ✗ B2B CONTRACT BROKEN — a promise the House of Kasya app depends on failed${c.reset}`);
    console.log(`${c.dim}    Run: cd backend && node node_modules/jest/bin/jest.js --testPathPatterns=b2b-contract --runInBand${c.reset}`);
    console.log(`${c.dim}    Fix the breaking change (or coordinate with the B2B app and update guide + test together).${c.reset}`);
    return false;
  }
}

/**
 * Check: Frontend TypeScript compiles
 */
function checkFrontendTypeScript() {
  console.log(`\n${c.cyan}Checking frontend TypeScript compilation...${c.reset}`);

  try {
    execSync('npx tsc -b', {
      encoding: 'utf-8',
      stdio: 'pipe',
      cwd: path.join(process.cwd(), 'frontend'),
      timeout: 180000, // 3 min timeout (frontend is larger)
    });
    console.log(`${c.green}  ✓ Frontend TypeScript compiles${c.reset}`);
    return true;
  } catch (error) {
    const output = error.stdout || error.stderr || '';
    const errorLines = output.split('\n').filter(line =>
      line.includes('error TS') || line.includes('.ts(') || line.includes('.tsx(')
    ).slice(0, 10);

    console.log(`${c.red}  ✗ Frontend TypeScript compilation failed${c.reset}`);
    if (errorLines.length > 0) {
      errorLines.forEach(line => console.log(`${c.red}    ${line.trim()}${c.reset}`));
    }
    console.log(`${c.dim}    Run: cd frontend && npx tsc -b${c.reset}`);
    return false;
  }
}

/**
 * Check: Backend TypeScript compiles (catches interface/type mismatches)
 * This check was added after the colorId bug: field was in Zod schema + service,
 * but missing from the TypeScript interface. Would have caught it in 10 seconds.
 */
function checkBackendTypeScript() {
  console.log(`\n${c.cyan}Checking backend TypeScript compilation...${c.reset}`);

  try {
    execSync('npx tsc --noEmit', {
      encoding: 'utf-8',
      stdio: 'pipe',
      cwd: path.join(process.cwd(), 'backend'),
      timeout: 120000, // 2 min timeout
    });
    console.log(`${c.green}  ✓ Backend TypeScript compiles${c.reset}`);
    return true;
  } catch (error) {
    const output = error.stdout || error.stderr || '';
    // Extract just the error lines (not the full output)
    const errorLines = output.split('\n').filter(line =>
      line.includes('error TS') || line.includes('.ts(')
    ).slice(0, 10); // Show first 10 errors max

    console.log(`${c.red}  ✗ Backend TypeScript compilation failed${c.reset}`);
    if (errorLines.length > 0) {
      errorLines.forEach(line => console.log(`${c.red}    ${line.trim()}${c.reset}`));
      if (output.split('\n').filter(l => l.includes('error TS')).length > 10) {
        console.log(`${c.dim}    ... and more errors${c.reset}`);
      }
    }
    console.log(`${c.dim}    Run: cd backend && npx tsc --noEmit${c.reset}`);
    return false;
  }
}

/**
 * Check: Stock services use material-sync helper
 */
function checkStockServicePattern(backendFiles) {
  console.log(`\n${c.cyan}Checking stock-sync pattern (any stock-table write must keep stock_levels in sync)...${c.reset}`);

  const baseline = loadStockSyncBaseline();
  const newViolations = [];
  const grandfathered = [];

  for (const file of backendFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    if (writesStockTableWithoutSync(content)) {
      (baseline.has(file) ? grandfathered : newViolations).push(file);
    }
  }

  if (grandfathered.length > 0) {
    console.log(`${c.yellow}  ⚠ ${grandfathered.length} known unsynced stock file(s) (grandfathered — fix when you touch them):${c.reset}`);
    grandfathered.forEach(file => console.log(`${c.dim}    ${file}${c.reset}`));
  }

  if (newViolations.length > 0) {
    console.log(`${c.red}  ✗ Stock-table write with NO sync — call syncStockLevelQuantity / routeToSpecializedStock:${c.reset}`);
    newViolations.forEach(file => console.log(`${c.red}    ${file}${c.reset}`));
    console.log(`${c.dim}    See CLAUDE.md "Stock Service Pattern". If this is genuinely intentional, add the file to scripts/hooks/stock-sync-baseline.json.${c.reset}`);
    return false; // BLOCK new violations
  }

  if (grandfathered.length === 0) {
    console.log(`${c.green}  ✓ Stock-sync OK${c.reset}`);
  }
  return true;
}

/**
 * Check: No console.log in production code
 */
function checkConsoleLogs(tsFiles) {
  console.log(`\n${c.cyan}Checking for console.log...${c.reset}`);

  const issues = [];
  const excludePatterns = ['node_modules', '.test.', '.spec.', 'scripts/', 'hooks/'];

  for (const file of tsFiles) {
    if (excludePatterns.some(p => file.includes(p))) continue;

    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, i) => {
      if (line.includes('console.log') && !line.trim().startsWith('//')) {
        issues.push({ file, line: i + 1 });
      }
    });
  }

  if (issues.length > 0) {
    console.log(`${c.yellow}  ⚠ Found console.log (${issues.length} occurrences):${c.reset}`);
    issues.slice(0, 5).forEach(({ file, line }) => {
      console.log(`    ${file}:${line}`);
    });
    if (issues.length > 5) {
      console.log(`    ... and ${issues.length - 5} more`);
    }
    return true; // Warning only
  }

  console.log(`${c.green}  ✓ No console.log found${c.reset}`);
  return true;
}

/**
 * Check: Documentation links are valid
 */
function checkDocLinks(docFiles) {
  console.log(`\n${c.cyan}Checking documentation links...${c.reset}`);

  // Exclude archived docs - they contain historical cross-references that may be broken
  const activeDocFiles = docFiles.filter(f => !f.includes('docs/archive/'));

  const brokenLinks = [];

  for (const file of activeDocFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    const linkMatches = content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);

    for (const match of linkMatches) {
      const linkPath = match[2];

      // Skip external links and anchors
      if (linkPath.startsWith('http') || linkPath.startsWith('#')) continue;

      // Resolve relative path
      const resolvedPath = path.join(path.dirname(fullPath), linkPath.split('#')[0]);

      if (!fs.existsSync(resolvedPath)) {
        brokenLinks.push({ file, link: linkPath });
      }
    }
  }

  if (brokenLinks.length > 0) {
    console.log(`${c.red}  ✗ Broken links found:${c.reset}`);
    brokenLinks.forEach(({ file, link }) => {
      console.log(`    ${file}: ${link}`);
    });
    return false;
  }

  console.log(`${c.green}  ✓ Documentation links OK${c.reset}`);
  return true;
}

/**
 * Check: Frontend serializer mismatches (wrong camelCase fallbacks)
 * The backend serializer converts snake_case to specific camelCase names.
 * Using wrong fallbacks like `styleComponents` instead of `components` is a bug.
 */
function checkFrontendSerializerMismatch(frontendFiles) {
  console.log(`\n${c.cyan}Checking frontend serializer patterns...${c.reset}`);

  // Wrong patterns that indicate serializer confusion
  const wrongPatterns = [
    { pattern: /\.styleComponents/g, correct: '.components', reason: 'style_components → components' },
    { pattern: /\.styleFabrics(?!Flat)/g, correct: '.fabrics', reason: 'style_fabrics → fabrics' },
    { pattern: /\.styleFabricsFlat/g, correct: '.fabrics', reason: 'styleFabricsFlat doesn\'t exist' },
    { pattern: /\.styleProcesses/g, correct: '.processes', reason: 'style_processes → processes' },
    { pattern: /\.styleVariants/g, correct: '.variants', reason: 'style_variants → variants' },
    { pattern: /\.brand_categories/g, correct: '.brandCategories', reason: 'snake_case in frontend' },
    { pattern: /\.style_components/g, correct: '.components', reason: 'snake_case in frontend' },
    { pattern: /\.style_fabrics/g, correct: '.fabrics', reason: 'snake_case in frontend' },
    { pattern: /\.color_options/g, correct: '.colorOptions', reason: 'snake_case in frontend' },
    { pattern: /\.size_options/g, correct: '.sizeOptions', reason: 'snake_case in frontend' },
  ];

  const issues = [];

  for (const file of frontendFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comments and imports
      if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.includes('import ')) continue;

      for (const { pattern, correct, reason } of wrongPatterns) {
        if (pattern.test(line)) {
          issues.push({
            file,
            line: i + 1,
            found: pattern.source.replace(/\\/g, ''),
            correct,
            reason,
          });
        }
        // Reset regex lastIndex for global patterns
        pattern.lastIndex = 0;
      }
    }
  }

  if (issues.length > 0) {
    console.log(`${c.yellow}  ⚠ Frontend serializer mismatches (${issues.length}):${c.reset}`);
    issues.slice(0, 5).forEach(({ file, line, found, correct, reason }) => {
      console.log(`    ${file}:${line}`);
      console.log(`      ${c.dim}Found: ${found} → Should be: ${correct}${c.reset}`);
      console.log(`      ${c.dim}Reason: ${reason}${c.reset}`);
    });
    if (issues.length > 5) {
      console.log(`    ... and ${issues.length - 5} more`);
    }
    return true; // Warning only for now
  }

  console.log(`${c.green}  ✓ Frontend serializer patterns OK${c.reset}`);
  return true;
}

/**
 * Check: Controller response structure consistency
 * - POST/201 responses should have `data` wrapper and `message`
 * - Pagination should use `totalPages` not `pages` or `offset`
 */
function checkResponseStructure(controllerFiles) {
  console.log(`\n${c.cyan}Checking response structure...${c.reset}`);

  const issues = [];
  const controllersDir = path.join(process.cwd(), 'backend/src/controllers');

  for (const file of controllerFiles) {
    const fullPath = path.join(controllersDir, path.basename(file));
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for bare object response (no data wrapper) on 201
      // Multi-line aware: check next few lines for data: wrapper
      if (line.includes('res.status(201).json(')) {
        const nextLines = lines.slice(i, i + 5).join(' ');
        if (!nextLines.includes('data:') && !nextLines.includes('{ data')) {
          issues.push({
            file: path.basename(file),
            line: i + 1,
            type: 'bare-response',
            message: 'POST 201 without data wrapper',
          });
        }
      }

      // Check for pagination using offset instead of page
      if (line.includes('pagination') && line.includes('offset:') && !line.includes('// legacy')) {
        issues.push({
          file: path.basename(file),
          line: i + 1,
          type: 'offset-pagination',
          message: 'Uses offset instead of page for pagination',
        });
      }
    }
  }

  if (issues.length > 0) {
    console.log(`${c.yellow}  ⚠ Response structure issues (${issues.length}):${c.reset}`);
    issues.forEach(({ file, line, message }) => {
      console.log(`    ${file}:${line} - ${message}`);
    });
    return true; // Warning only
  }

  console.log(`${c.green}  ✓ Response structure OK${c.reset}`);
  return true;
}

/**
 * Show: Impact analysis for modified services/controllers (non-blocking)
 * Shows what tables/fields are touched and what to verify after committing.
 */
function showImpactAnalysis(files) {
  console.log(`\n${c.cyan}Impact Analysis (verify after commit):${c.reset}`);

  const backendSrc = path.join(process.cwd(), 'backend/src');
  const highImpactFiles = [];

  for (const file of files) {
    const fullPath = path.join(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');

      // Find Prisma tables touched
      const tables = new Set();
      const prismaPattern = /(?:prisma|txClient)\.(\w+)\.(findMany|findFirst|findUnique|create|update|updateMany|delete|deleteMany|upsert)/g;
      let match;
      while ((match = prismaPattern.exec(content)) !== null) {
        tables.add(match[1]);
      }

      // Find fields written (in data: { ... } blocks)
      const fields = new Set();
      const dataBlockPattern = /data:\s*{([^}]+)}/g;
      while ((match = dataBlockPattern.exec(content)) !== null) {
        const block = match[1];
        const fieldPattern = /(\w+)\s*:/g;
        let fieldMatch;
        while ((fieldMatch = fieldPattern.exec(block)) !== null) {
          const field = fieldMatch[1];
          if (!['where', 'data', 'include', 'select', 'orderBy', 'take', 'skip', 'AND', 'OR', 'NOT'].includes(field)) {
            fields.add(field);
          }
        }
      }

      if (tables.size > 0) {
        highImpactFiles.push({
          file: path.basename(file),
          tables: Array.from(tables),
          fields: Array.from(fields).slice(0, 5),
          hasStatus: fields.has('status'),
        });
      }
    } catch (e) {
      // Skip unreadable files
    }
  }

  if (highImpactFiles.length === 0) {
    console.log(`${c.dim}  (no Prisma operations in changed files)${c.reset}`);
    return;
  }

  // Show summary
  for (const { file, tables, fields, hasStatus } of highImpactFiles) {
    console.log(`\n  ${c.bright}${file}${c.reset}`);
    console.log(`    Tables: ${tables.slice(0, 5).join(', ')}${tables.length > 5 ? ` (+${tables.length - 5} more)` : ''}`);
    if (fields.length > 0) {
      console.log(`    Fields written: ${fields.join(', ')}`);
    }
  }

  // Verification checklist
  console.log(`\n  ${c.yellow}${c.bright}Verify after commit:${c.reset}`);
  console.log(`    □ cd backend && npx tsc -b`);

  const allTables = new Set(highImpactFiles.flatMap(f => f.tables));
  const stockTables = ['greige_stock', 'fabric_stock', 'thread_stock', 'lace_stock', 'stock_levels'];
  const orderTables = ['orders', 'order_items', 'order_bom_items', 'sale_orders'];
  const mrpTables = ['material_requirements', 'requirement_jwo_links', 'requirement_po_links'];

  if ([...allTables].some(t => stockTables.includes(t))) {
    console.log(`    □ Check mrp.service.ts, stock-levels.controller.ts`);
  }
  if ([...allTables].some(t => orderTables.includes(t))) {
    console.log(`    □ Check orderCosting.service.ts, order-bom.service.ts`);
  }
  if ([...allTables].some(t => mrpTables.includes(t))) {
    console.log(`    □ Check job-work-order.controller.ts`);
  }
  if (highImpactFiles.some(f => f.hasStatus)) {
    console.log(`    □ Check stateMachine.ts (status transitions)`);
  }
}

/**
 * Check: Prisma schema safety
 */
function checkPrismaSafety() {
  console.log(`\n${c.cyan}Checking Prisma schema safety...${c.reset}`);

  const schemaPath = path.join(process.cwd(), 'backend/prisma/schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    console.log(`${c.green}  ✓ No schema changes${c.reset}`);
    return true;
  }

  try {
    // Check for syntax errors
    execSync('cd backend && npx prisma format --check', { encoding: 'utf-8', stdio: 'pipe' });
  } catch {
    console.log(`${c.red}  ✗ Prisma schema has syntax errors${c.reset}`);
    console.log(`${c.dim}    Run: cd backend && npx prisma format${c.reset}`);
    return false;
  }

  // Check for destructive operations in diff
  try {
    const diff = execSync('git diff --cached backend/prisma/schema.prisma', { encoding: 'utf-8' });

    const destructivePatterns = [
      { pattern: /^-\s+\w+\s+\w+.*@id/m, message: 'Removing a primary key field' },
      { pattern: /^-model\s+\w+/m, message: 'Dropping a model/table' },
    ];

    for (const { pattern, message } of destructivePatterns) {
      if (pattern.test(diff)) {
        console.log(`${c.yellow}  ⚠ Potentially destructive: ${message}${c.reset}`);
      }
    }
  } catch {
    // No diff available
  }

  console.log(`${c.green}  ✓ Prisma schema OK${c.reset}`);
  return true;
}

/**
 * Check: generated Zod enums freshness (backend/src/schemas/generated/prisma-enums.ts)
 * 2026-08-04 incident: schema.prisma gained CadApprovalStatus + GRNStatus.REVERSED but the
 * generated file was never regenerated — validation would then 400 real enum values and
 * 500 on removed ones. Regeneration is a manual step, so freshness must gate the commit.
 */
function checkGeneratedZodEnums() {
  console.log(`\n${c.cyan}Checking generated Zod enums freshness...${c.reset}`);
  try {
    execSync('node scripts/skills/generate-zod-enums.js --check', { encoding: 'utf-8', stdio: 'pipe' });
    console.log(`${c.green}  ✓ prisma-enums.ts in sync with schema.prisma${c.reset}`);
    return true;
  } catch {
    console.log(`${c.red}  ✗ schemas/generated/prisma-enums.ts is stale vs schema.prisma${c.reset}`);
    console.log(`${c.dim}    Run: node scripts/skills/generate-zod-enums.js  (then stage the regenerated file)${c.reset}`);
    return false;
  }
}

/**
 * Check: the type-gates themselves must stay in place (guard-the-guard) — BLOCKING.
 * History: a deployable frontend dist/ was once produced via bare `npx vite build`, which
 * skips tsc entirely. The gates that close that class of bypass are:
 *   1. frontend/vite.config.ts    — the 'enforce-typecheck' plugin runs `tsc -b` INSIDE vite build
 *   2. backend/tsconfig.json      — "noEmitOnError": true (tsc's default emits JS despite type errors)
 * This check fails the commit/CI if either gate is removed or renamed. There is no baseline
 * and no escape hatch on purpose: removing a gate must be a loud, deliberate act.
 */
function checkBuildGates() {
  console.log(`\n${c.cyan}Checking build type-gates are in place...${c.reset}`);
  const root = process.cwd();
  const gates = [
    {
      file: 'frontend/vite.config.ts',
      needle: 'enforce-typecheck',
      why: "the 'enforce-typecheck' vite plugin makes `vite build` run tsc — without it, bare `npx vite build` ships an unchecked bundle",
    },
    {
      file: 'backend/tsconfig.json',
      needle: /"noEmitOnError"\s*:\s*true/,
      why: 'without "noEmitOnError": true, tsc emits dist/ even when the typecheck fails',
    },
  ];
  let ok = true;
  for (const g of gates) {
    let content = '';
    try {
      content = fs.readFileSync(path.join(root, g.file), 'utf-8');
    } catch {
      /* missing file handled below */
    }
    const present = typeof g.needle === 'string' ? content.includes(g.needle) : g.needle.test(content);
    if (!present) {
      console.log(`${c.red}  ✗ Type-gate missing in ${g.file}${c.reset}`);
      console.log(`${c.dim}    ${g.why}${c.reset}`);
      ok = false;
    }
  }
  if (ok) console.log(`${c.green}  ✓ Build type-gates present (vite enforce-typecheck + backend noEmitOnError)${c.reset}`);
  return ok;
}

// ============================================================================
// MAIN
// ============================================================================

// --- CI backstop: run the ratcheted guardrails across the WHOLE repo (ignores git staging).
// Used by `node scripts/hooks/smart-check.js --all` in CI so `git commit --no-verify` can't slip
// new drift/money-math violations past the local hook.
function walkFiles(dir, acc = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!/node_modules|\.git|dist|build|coverage/.test(p)) walkFiles(p, acc);
    } else {
      acc.push(p);
    }
  }
  return acc;
}

function runAllModeChecks() {
  const root = detectors.REPO_ROOT;
  const files = [...walkFiles(path.join(root, 'backend/src')), ...walkFiles(path.join(root, 'frontend/src'))].map(f =>
    path.relative(root, f).split(path.sep).join('/')
  );
  const routeFiles = files.filter(f => f.endsWith('.routes.ts'));
  const schemaFiles = files.filter(f => f.endsWith('.schema.ts'));
  const tsFiles = files.filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts'));

  console.log(`\n${c.bright}Running guardrails across the whole repo (CI mode)...${c.reset}`);
  let ok = true;
  if (!checkBuildGates()) ok = false;
  if (!checkGeneratedZodEnums()) ok = false;
  if (!checkSchemaControllerAlignment()) ok = false;
  if (!checkRouteValidation(routeFiles)) ok = false;
  if (!checkEnumDrift(schemaFiles)) ok = false;
  if (!checkDatetimeSchema(schemaFiles)) ok = false;
  if (!checkShrinkageDivide(tsFiles)) ok = false;
  if (!checkCurrencyFormat(tsFiles)) ok = false;
  if (!checkControllerReparse(tsFiles)) ok = false;
  if (!checkGlobalPrismaInTx(tsFiles)) ok = false;
  if (!checkDecimalCompare(tsFiles)) ok = false;
  if (!checkCountNumbering(tsFiles)) ok = false;
  if (!checkSwallowedWriteErrors(tsFiles)) ok = false;
  if (!checkAssignNotIncrement(tsFiles)) ok = false;
  if (!checkSchemaFrontendParity(tsFiles)) ok = false;
  if (!checkStockSyncNoWarehouse(tsFiles)) ok = false;
  if (!checkSilentCatchFrontend(tsFiles)) ok = false;
  if (!checkNumericOrFallback(tsFiles)) ok = false;
  if (!checkManualMaterialCreate(tsFiles)) ok = false;
  if (!checkColourSentinelLiteral(tsFiles)) ok = false;
  if (!checkUnguardedCadDelete(tsFiles)) ok = false;
  if (!checkCostingApprovalDrift(tsFiles)) ok = false;
  if (!checkSaleOrderStatusWrite(tsFiles)) ok = false;
  if (!checkCadPurposeSingleWrite(tsFiles)) ok = false;
  if (!checkHardcodedDefault(tsFiles)) ok = false;
  if (!checkSchemaServiceUpdateParity(schemaFiles)) ok = false;
  checkAiGuides(); // warn-only

  // Frontend typecheck gate (CI mode only — too slow for per-commit). The frontend reached ZERO tsc
  // errors on 2026-07-23 after clearing 184 pre-existing ones (several were real display bugs: pages
  // reading fields the API never returns). This keeps the count at zero.
  console.log(`\n${c.cyan}Typechecking frontend (tsc -b)...${c.reset}`);
  try {
    execSync('npx tsc -b', { cwd: path.join(process.cwd(), 'frontend'), encoding: 'utf-8', stdio: 'pipe' });
    console.log(`${c.green}  ✓ Frontend typecheck OK (0 errors)${c.reset}`);
  } catch (e) {
    const out = ((e.stdout || '') + (e.stderr || '')).split('\n').filter((l) => /error TS/.test(l));
    console.log(`${c.red}  ✗ Frontend typecheck FAILED (${out.length} error(s)) — the frontend must stay at ZERO tsc errors:${c.reset}`);
    out.slice(0, 10).forEach((l) => console.log(`${c.red}    ${l.trim()}${c.reset}`));
    ok = false;
  }

  console.log(`\n${c.bright}${c.blue}═══════════════════════════════════════════════════${c.reset}`);
  if (ok) {
    console.log(`${c.green}${c.bright}✓ Guardrails passed (no new drift / money-math violations)${c.reset}\n`);
  } else {
    console.log(`${c.red}${c.bright}✗ Guardrails failed — the new violations above are not in the baselines${c.reset}\n`);
    process.exit(1);
  }
}

function main() {
  console.log(`\n${c.bright}${c.blue}═══════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.bright}${c.blue}       SMART CHECK - Auto-Detecting Hook            ${c.reset}`);
  console.log(`${c.bright}${c.blue}═══════════════════════════════════════════════════${c.reset}`);

  if (process.argv.includes('--all')) {
    return runAllModeChecks();
  }

  const stagedFiles = getStagedFiles();

  if (stagedFiles.length === 0) {
    console.log(`\n${c.yellow}No staged files. Nothing to check.${c.reset}\n`);
    return;
  }

  const categories = categorizeFiles(stagedFiles);

  // Show what was detected
  console.log(`\n${c.bright}Detected changes in:${c.reset}`);
  if (categories.schemas.length) console.log(`  ${c.cyan}•${c.reset} ${categories.schemas.length} schema file(s)`);
  if (categories.controllers.length) console.log(`  ${c.cyan}•${c.reset} ${categories.controllers.length} controller file(s)`);
  if (categories.services.length) console.log(`  ${c.cyan}•${c.reset} ${categories.services.length} service file(s)`);
  if (categories.types.length) console.log(`  ${c.cyan}•${c.reset} ${categories.types.length} type file(s)`);
  if (categories.stockServices.length) console.log(`  ${c.cyan}•${c.reset} ${categories.stockServices.length} stock service file(s)`);
  if (categories.docs.length) console.log(`  ${c.cyan}•${c.reset} ${categories.docs.length} documentation file(s)`);
  if (categories.prisma.length) console.log(`  ${c.cyan}•${c.reset} Prisma schema`);
  if (categories.routes.length) console.log(`  ${c.cyan}•${c.reset} ${categories.routes.length} route file(s)`);
  if (categories.frontend.length) console.log(`  ${c.cyan}•${c.reset} ${categories.frontend.length} frontend file(s)`);

  let allPassed = true;
  let checksRun = 0;

  // Run relevant checks based on what changed

  // Always: the type-gates themselves must stay in place (3 cheap file reads)
  checksRun++;
  if (!checkBuildGates()) allPassed = false;

  // Schema or Controller or Route changes → basic sync + field alignment (BLOCKING + ratchet)
  if (categories.schemas.length || categories.controllers.length || categories.routes.length) {
    checksRun++;
    if (!checkSchemaControllerSync()) allPassed = false;
    if (!checkSchemaControllerAlignment()) allPassed = false;
  }

  // Route changes → every mutating route must validate its body (BLOCKING new + ratchet)
  if (categories.routes.length) {
    checksRun++;
    if (!checkRouteValidation(categories.routes)) allPassed = false;
  }

  // Schema changes → enum-vs-Prisma drift + z.string().datetime() + schema↔service parity (BLOCKING new + ratchet)
  if (categories.schemas.length) {
    checksRun++;
    if (!checkEnumDrift(categories.schemas)) allPassed = false;
    if (!checkDatetimeSchema(categories.schemas)) allPassed = false;
    if (!checkSchemaServiceUpdateParity(categories.schemas)) allPassed = false;
  }

  // Any TS/TSX changes → money-math guards: divide-by-shrinkage + en-IN currency (BLOCKING new + ratchet)
  if (categories.typescript.length) {
    checksRun++;
    if (!checkShrinkageDivide(categories.typescript)) allPassed = false;
    if (!checkCurrencyFormat(categories.typescript)) allPassed = false;
    // Phase-3 guardrails: dual-schema re-parse, rollback-escaping writes, Decimal string-compare,
    // count-based numbering (BLOCKING new + ratchet)
    if (!checkControllerReparse(categories.typescript)) allPassed = false;
    if (!checkGlobalPrismaInTx(categories.typescript)) allPassed = false;
    if (!checkDecimalCompare(categories.typescript)) allPassed = false;
    if (!checkCountNumbering(categories.typescript)) allPassed = false;
    if (!checkSwallowedWriteErrors(categories.typescript)) allPassed = false;
    if (!checkAssignNotIncrement(categories.typescript)) allPassed = false;
    if (!checkSchemaFrontendParity(categories.typescript)) allPassed = false;
    if (!checkStockSyncNoWarehouse(categories.typescript)) allPassed = false;
    if (!checkSilentCatchFrontend(categories.typescript)) allPassed = false;
    if (!checkNumericOrFallback(categories.typescript)) allPassed = false;
    if (!checkManualMaterialCreate(categories.typescript)) allPassed = false;
    if (!checkColourSentinelLiteral(categories.typescript)) allPassed = false;
    if (!checkUnguardedCadDelete(categories.typescript)) allPassed = false;
    if (!checkCostingApprovalDrift(categories.typescript)) allPassed = false;
    if (!checkSaleOrderStatusWrite(categories.typescript)) allPassed = false;
    if (!checkCadPurposeSingleWrite(categories.typescript)) allPassed = false;
    if (!checkHardcodedDefault(categories.typescript)) allPassed = false;
  }

  // Type file changes → check type sync
  if (categories.types.length) {
    checksRun++;
    checkTypeSync(); // Warning only
  }

  // Frontend page / route / schema changes → the AI how-to guides written from those
  // files may now describe screens that no longer exist (warning only)
  if (categories.frontend.length || categories.routes.length || categories.schemas.length) {
    checksRun++;
    checkAiGuides(); // Warning only
  }

  // Backend .ts changes → enforce stock-sync (blocks NEW stock-table writes that don't sync)
  if (categories.backendTs.length) {
    checksRun++;
    if (!checkStockServicePattern(categories.backendTs)) allPassed = false;
  }

  // Backend .ts changes → TypeScript must compile (catches missing interface fields)
  // This check caught the colorId bug: field was in Zod schema but missing from TS interface
  if (categories.backendTs.length) {
    checksRun++;
    if (!checkBackendTypeScript()) allPassed = false;
  }

  // B2B contract surface touched → run the executable contract (blocks on failure).
  // The House of Kasya app is a LIVE external consumer; docs/B2B_INTEGRATION_GUIDE.md §5
  // froze these shapes after a July incident where a schema change silently 400'd every
  // push. Needs the local DB — skipped with a warning if the suite cannot run.
  if (stagedFiles.some((f) => /saleOrder\.(schema|controller|service|routes)|serializer\.ts|style\.schema\.ts|style\.service\.ts|b2b-contract\.test/.test(f))) {
    checksRun++;
    if (!checkB2bContract()) allPassed = false;
  }

  // Any TypeScript changes → check console.log
  if (categories.typescript.length) {
    checksRun++;
    checkConsoleLogs(categories.typescript);
  }

  // Documentation changes → check links
  if (categories.docs.length) {
    checksRun++;
    if (!checkDocLinks(categories.docs)) allPassed = false;
  }

  // Prisma schema changes → check safety + generated Zod enums freshness
  // (also re-check freshness when the generated file itself is staged — hand edits drift too)
  if (categories.prisma.length || stagedFiles.some((f) => f.includes('schemas/generated/prisma-enums'))) {
    checksRun++;
    if (categories.prisma.length && !checkPrismaSafety()) allPassed = false;
    if (!checkGeneratedZodEnums()) allPassed = false;
  }

  // Frontend changes → check serializer patterns
  if (categories.frontend.length) {
    checksRun++;
    checkFrontendSerializerMismatch(categories.frontend);
  }

  // Frontend .ts/.tsx changes → TypeScript must compile
  if (categories.frontend.length) {
    checksRun++;
    if (!checkFrontendTypeScript()) allPassed = false;
  }

  // Controller changes → check response structure
  if (categories.controllers.length) {
    checksRun++;
    checkResponseStructure(categories.controllers);
  }

  // Service or Controller changes → show impact analysis (non-blocking)
  // Helps verify changes don't break dependent code
  if (categories.services.length || categories.controllers.length) {
    const impactFiles = [...categories.services, ...categories.controllers];
    showImpactAnalysis(impactFiles);
  }

  // Summary
  console.log(`\n${c.bright}${c.blue}═══════════════════════════════════════════════════${c.reset}`);

  if (checksRun === 0) {
    console.log(`${c.dim}No specific checks needed for these file types.${c.reset}`);
    console.log(`${c.green}✓ Commit allowed${c.reset}\n`);
    return;
  }

  if (allPassed) {
    console.log(`${c.green}${c.bright}✓ All ${checksRun} check(s) passed!${c.reset}`);
    console.log(`${c.green}✓ Commit allowed${c.reset}\n`);
  } else {
    console.log(`${c.red}${c.bright}✗ Some checks failed${c.reset}`);
    console.log(`${c.red}✗ Fix the issues above before committing${c.reset}\n`);
    process.exit(1);
  }
}

main();
