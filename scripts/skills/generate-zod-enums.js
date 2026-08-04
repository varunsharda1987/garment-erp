#!/usr/bin/env node
/**
 * /generate-zod-enums — Generate Zod enums FROM the Prisma schema (single source of truth).
 *
 * Retrospective background (2026-08-01): the enum-drift bug class (Zod enum values that don't
 * exist in the Prisma enum → guaranteed 500 on insert) exists because every enum was hand-typed
 * in TWO places (schema.prisma and *.schema.ts) and often a THIRD (frontend union types). This
 * generator makes prisma/schema.prisma the only authored copy: schemas import the generated
 * Zod enum instead of re-typing the values.
 *
 * Usage:
 *   node scripts/skills/generate-zod-enums.js            # (re)generate the file
 *   node scripts/skills/generate-zod-enums.js --check    # exit 1 if the file is stale (CI)
 *
 * Output: backend/src/schemas/generated/prisma-enums.ts
 *
 * Adoption is incremental: new schemas SHOULD import from the generated file
 * (e.g. `import { OrderStatusEnum } from './generated/prisma-enums'`); existing hand-written
 * z.enum(...)s stay guarded by the enum-drift ratchet in smart-check until migrated.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'backend', 'prisma', 'schema.prisma');
const OUT_DIR = path.join(REPO_ROOT, 'backend', 'src', 'schemas', 'generated');
const OUT_PATH = path.join(OUT_DIR, 'prisma-enums.ts');

function parseEnums(prismaSource) {
  const enums = [];
  const re = /^enum\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m;
  while ((m = re.exec(prismaSource))) {
    const name = m[1];
    const values = m[2]
      .split('\n')
      .map((l) => l.replace(/\/\/.*$/, '').trim())
      .filter((l) => /^\w+$/.test(l));
    if (values.length) enums.push({ name, values });
  }
  return enums;
}

function render(enums) {
  const header = `/**
 * AUTO-GENERATED from prisma/schema.prisma — DO NOT EDIT BY HAND.
 * Regenerate: node scripts/skills/generate-zod-enums.js
 *
 * One Zod enum per Prisma enum, same values, same order. Import these in *.schema.ts files
 * instead of re-typing the values — re-typed copies drift (the enum-drift bug class).
 */

import { z } from 'zod';

`;
  const body = enums
    .map(({ name, values }) => {
      const list = values.map((v) => `'${v}'`).join(', ');
      return `export const ${name}Enum = z.enum([${list}]);\nexport type ${name} = z.infer<typeof ${name}Enum>;\n`;
    })
    .join('\n');
  return header + body;
}

/**
 * Format through the repo's prettier so the emitted file is byte-identical to what
 * lint-staged's `prettier --write` produces at commit time — otherwise --check
 * reports the file stale after every commit (the formatting ping-pong bug).
 */
function formatWithPrettier(source) {
  try {
    return execSync(`npx prettier --stdin-filepath "${OUT_PATH}"`, {
      cwd: REPO_ROOT,
      input: source,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    console.warn('⚠ prettier unavailable — writing unformatted output');
    return source;
  }
}

function main() {
  const src = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const enums = parseEnums(src);
  if (!enums.length) {
    console.error('No enums found in schema.prisma — refusing to write an empty file.');
    process.exit(1);
  }
  const output = formatWithPrettier(render(enums));

  if (process.argv.includes('--check')) {
    let existing = null;
    try {
      existing = fs.readFileSync(OUT_PATH, 'utf8');
    } catch {
      /* missing counts as stale */
    }
    if (existing !== output) {
      console.error(
        `✗ ${path.relative(REPO_ROOT, OUT_PATH)} is stale vs schema.prisma (${enums.length} enums). ` +
          'Run: node scripts/skills/generate-zod-enums.js'
      );
      process.exit(1);
    }
    console.log(`✓ prisma-enums.ts up to date (${enums.length} enums)`);
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_PATH, output);
  console.log(`✓ Wrote ${path.relative(REPO_ROOT, OUT_PATH)} — ${enums.length} Zod enums generated from schema.prisma`);
}

main();
