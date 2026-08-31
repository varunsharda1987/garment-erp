#!/usr/bin/env node
/**
 * Impact Analysis Tool
 *
 * Run BEFORE editing a file to understand:
 * - Who imports/calls this file
 * - What Prisma tables it touches
 * - What fields it writes (high-impact changes)
 * - Suggested verification steps
 *
 * Usage: node scripts/tools/impact-check.js <file-path>
 * Example: node scripts/tools/impact-check.js backend/src/services/job-work-issuance.service.ts
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BACKEND_SRC = path.join(__dirname, '../../backend/src');
const FRONTEND_SRC = path.join(__dirname, '../../frontend/src');

// ANSI colors
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function main() {
  const targetFile = process.argv[2];

  if (!targetFile || targetFile === '--help') {
    console.log(`
${BOLD}Impact Analysis Tool${RESET}

Run BEFORE editing a file to understand its dependencies and what to verify after changes.

${BOLD}Usage:${RESET}
  node scripts/tools/impact-check.js <file-path>

${BOLD}Examples:${RESET}
  node scripts/tools/impact-check.js backend/src/services/job-work-issuance.service.ts
  node scripts/tools/impact-check.js backend/src/controllers/mrp.controller.ts
`);
    process.exit(0);
  }

  const absolutePath = path.isAbsolute(targetFile)
    ? targetFile
    : path.resolve(process.cwd(), targetFile);

  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
  }

  const relativePath = path.relative(path.join(__dirname, '../..'), absolutePath);
  console.log(`\n${BOLD}=== Impact Analysis: ${path.basename(absolutePath)} ===${RESET}\n`);

  // Read target file content
  const content = fs.readFileSync(absolutePath, 'utf-8');

  // 1. Find callers (who imports this file)
  const callers = findCallers(absolutePath);

  // 2. Find Prisma tables touched
  const tables = findPrismaTables(content);

  // 3. Find fields written
  const fieldsWritten = findFieldsWritten(content);

  // 4. Count table usage across codebase
  const tableUsage = countTableUsage(tables);

  // 5. Find field readers
  const fieldReaders = findFieldReaders(fieldsWritten, absolutePath);

  // Output results
  printCallers(callers);
  printTables(tables, tableUsage);
  printFields(fieldsWritten, fieldReaders);
  printVerificationChecklist(tables, fieldsWritten, relativePath);
}

function findCallers(targetFile) {
  const callers = [];
  const targetName = path.basename(targetFile, path.extname(targetFile));
  const targetDir = path.dirname(targetFile);

  // Build possible import patterns
  const importPatterns = [
    targetName,
    `./${targetName}`,
    `../${path.basename(targetDir)}/${targetName}`,
  ];

  // Scan all .ts files in backend and frontend
  const allFiles = getAllTsFiles([BACKEND_SRC, FRONTEND_SRC]);

  for (const file of allFiles) {
    if (file === targetFile) continue;

    try {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.includes('import')) continue;

        // Check if this import references our target file
        for (const pattern of importPatterns) {
          if (line.includes(`'${pattern}'`) || line.includes(`"${pattern}"`) ||
              line.includes(`'${pattern}.`) || line.includes(`"${pattern}.`) ||
              line.includes(`/${targetName}'`) || line.includes(`/${targetName}"`)) {

            // Extract imported functions/classes
            const importMatch = line.match(/import\s*{([^}]+)}/);
            const functions = importMatch
              ? importMatch[1].split(',').map(f => f.trim().split(' as ')[0].trim())
              : ['(default)'];

            callers.push({
              file: path.relative(path.join(__dirname, '../..'), file),
              line: i + 1,
              functions,
            });
            break;
          }
        }
      }
    } catch (e) {
      // Skip unreadable files
    }
  }

  return callers;
}

function findPrismaTables(content) {
  const tables = new Set();

  // Match prisma.<table>.<operation>
  const prismaPattern = /prisma\.(\w+)\.(findMany|findFirst|findUnique|create|update|updateMany|delete|deleteMany|upsert|count|aggregate)/g;
  let match;

  while ((match = prismaPattern.exec(content)) !== null) {
    tables.add(match[1]);
  }

  // Also match txClient.<table> for transactions
  const txPattern = /txClient\.(\w+)\.(findMany|findFirst|findUnique|create|update|updateMany|delete|deleteMany|upsert|count)/g;
  while ((match = txPattern.exec(content)) !== null) {
    tables.add(match[1]);
  }

  return Array.from(tables);
}

function findFieldsWritten(content) {
  const fields = new Set();

  // Match data: { field: value } patterns in create/update calls
  // This is a simplified heuristic
  const dataBlockPattern = /data:\s*{([^}]+)}/g;
  let match;

  while ((match = dataBlockPattern.exec(content)) !== null) {
    const block = match[1];
    // Extract field names (keys before colons)
    const fieldPattern = /(\w+)\s*:/g;
    let fieldMatch;
    while ((fieldMatch = fieldPattern.exec(block)) !== null) {
      const field = fieldMatch[1];
      // Skip common non-field names
      if (!['where', 'data', 'include', 'select', 'orderBy', 'take', 'skip'].includes(field)) {
        fields.add(field);
      }
    }
  }

  return Array.from(fields);
}

function countTableUsage(tables) {
  const usage = {};
  const allFiles = getAllTsFiles([BACKEND_SRC]);

  for (const table of tables) {
    let count = 0;
    for (const file of allFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        if (content.includes(`prisma.${table}.`) || content.includes(`txClient.${table}.`)) {
          count++;
        }
      } catch (e) {
        // Skip unreadable files
      }
    }
    usage[table] = count;
  }

  return usage;
}

function findFieldReaders(fields, excludeFile) {
  const readers = {};
  const allFiles = getAllTsFiles([BACKEND_SRC]);
  const excludeBasename = path.basename(excludeFile);

  for (const field of fields.slice(0, 5)) { // Limit to top 5 fields
    readers[field] = [];
    const fieldRegex = new RegExp(`\\b${field}\\b`);

    for (const file of allFiles) {
      if (path.basename(file) === excludeBasename) continue;
      if (readers[field].length >= 3) break; // Limit results

      try {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          if (fieldRegex.test(lines[i])) {
            readers[field].push({
              file: path.relative(path.join(__dirname, '../..'), file),
              line: i + 1,
            });
            break; // One match per file is enough
          }
        }
      } catch (e) {
        // Skip unreadable files
      }
    }
  }

  return readers;
}

function getAllTsFiles(dirs) {
  const files = [];

  function scan(dir) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        scan(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
  }

  for (const dir of dirs) {
    scan(dir);
  }

  return files;
}

function printCallers(callers) {
  console.log(`${CYAN}CALLERS (files that import this):${RESET}`);

  if (callers.length === 0) {
    console.log(`  ${DIM}(no callers found)${RESET}\n`);
    return;
  }

  for (const caller of callers) {
    console.log(`  └─ ${caller.file}:${caller.line}`);
    for (const fn of caller.functions) {
      console.log(`     ├─ ${fn}`);
    }
  }
  console.log();
}

function printTables(tables, usage) {
  console.log(`${CYAN}PRISMA TABLES TOUCHED:${RESET}`);

  if (tables.length === 0) {
    console.log(`  ${DIM}(no Prisma tables found)${RESET}\n`);
    return;
  }

  // Sort by usage count (highest first)
  const sorted = tables.sort((a, b) => (usage[b] || 0) - (usage[a] || 0));

  for (const table of sorted) {
    const count = usage[table] || 0;
    const highlight = count > 10 ? YELLOW : '';
    console.log(`  ${highlight}${table.padEnd(30)}${RESET} → ${count} other files also use this`);
  }
  console.log();
}

function printFields(fields, readers) {
  console.log(`${CYAN}FIELDS WRITTEN (check these for side effects):${RESET}`);

  if (fields.length === 0) {
    console.log(`  ${DIM}(no field writes detected)${RESET}\n`);
    return;
  }

  // Show first 10 fields
  for (const field of fields.slice(0, 10)) {
    console.log(`  ${field}`);
    const fieldReaders = readers[field] || [];
    for (const reader of fieldReaders.slice(0, 3)) {
      console.log(`    └─ Also read by: ${DIM}${reader.file}:${reader.line}${RESET}`);
    }
  }

  if (fields.length > 10) {
    console.log(`  ${DIM}... and ${fields.length - 10} more fields${RESET}`);
  }
  console.log();
}

function printVerificationChecklist(tables, fields, relativePath) {
  console.log(`${GREEN}${BOLD}SUGGESTED VERIFICATION:${RESET}`);
  console.log(`  □ Run: cd backend && npx tsc -b`);

  // Suggest based on tables touched
  const stockTables = ['greige_stock', 'fabric_stock', 'thread_stock', 'lace_stock', 'stock_levels'];
  const orderTables = ['orders', 'order_items', 'order_bom_items', 'sale_orders'];
  const mrpTables = ['material_requirements', 'requirement_jwo_links', 'requirement_po_links'];

  if (tables.some(t => stockTables.includes(t))) {
    console.log(`  □ Check: mrp.service.ts, stock-levels.controller.ts (stock changes)`);
  }

  if (tables.some(t => orderTables.includes(t))) {
    console.log(`  □ Check: orderCosting.service.ts, order-bom.service.ts (order changes)`);
  }

  if (tables.some(t => mrpTables.includes(t))) {
    console.log(`  □ Check: job-work-order.controller.ts (MRP/JWO linkage)`);
  }

  if (fields.includes('status')) {
    console.log(`  □ Check: stateMachine.ts (status transitions allowed?)`);
  }

  // Suggest running related tests
  const moduleName = path.basename(relativePath).replace(/\.(service|controller|routes)\.ts$/, '');
  console.log(`  □ Test: npm test -- --grep "${moduleName}"`);

  console.log();
}

main();
