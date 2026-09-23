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
 *   node scripts/skills/generate-zod-enums.js            # (re)generate both files
 *   node scripts/skills/generate-zod-enums.js --check    # exit 1 if either file is stale (CI)
 *
 * Outputs:
 *   backend/src/schemas/generated/prisma-enums.ts   — one Zod enum per Prisma enum
 *   frontend/src/types/generated/prisma-enums.ts    — one `as const` object + type per Prisma enum
 *     (the frontend's own enum shape; `erasableSyntaxOnly` forbids TS `enum`, and pages should not
 *     pull zod in just to name a unit). Added 2026-09-23 after the frontend's three hand-typed
 *     `Unit` copies drifted to 13 of the 16 values — the THIRD copy this header always warned about.
 *
 * Adoption is incremental: new schemas SHOULD import from the generated file
 * (e.g. `import { OrderStatusEnum } from './generated/prisma-enums'`); existing hand-written
 * z.enum(...)s stay guarded by the enum-drift ratchet in smart-check until migrated. Frontend code
 * re-exports from `@/types/generated/prisma-enums` instead of re-typing values.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'backend', 'prisma', 'schema.prisma');
const BACKEND_OUT = path.join(REPO_ROOT, 'backend', 'src', 'schemas', 'generated', 'prisma-enums.ts');
const FRONTEND_OUT = path.join(REPO_ROOT, 'frontend', 'src', 'types', 'generated', 'prisma-enums.ts');

function parseEnums(prismaSource) {
  const enums = [];
  const re = /^enum\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m;
  while ((m = re.exec(prismaSource))) {
    const name = m[1];
    const values = m[2]
      // Split on CRLF *or* LF. On a Windows checkout every line ends with \r, and in JS `.` does
      // not match \r (it is a line terminator), so `//.*$` could never reach end-of-string and the
      // comment strip silently did nothing. The value then read "MANUAL // Direct creation via …",
      // failed the \w+ test, and was dropped. Any enum whose values ALL carry an inline comment
      // therefore yielded zero values and was skipped entirely — silently losing 8 in-use enums
      // (POSource, SeasonType, ChallanType, CostSheetPurpose, CostSheetVarianceStatus,
      // DefectDisposition, ThreadPackagingType, ThreadQuantityInput) plus individual commented
      // values from others. Regenerating then broke the build, which made the guardrail's own
      // "regenerate the enums" instruction a trap on Windows.
      .split(/\r?\n/)
      .map((l) => l.replace(/\/\/.*$/, '').trim())
      .filter((l) => /^\w+$/.test(l));
    if (values.length) enums.push({ name, values });
  }
  return enums;
}

function renderBackend(enums) {
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

function renderFrontend(enums) {
  const header = `/**
 * AUTO-GENERATED from backend/prisma/schema.prisma — DO NOT EDIT BY HAND.
 * Regenerate: node scripts/skills/generate-zod-enums.js
 *
 * One const object + type per Prisma enum, same values, same order. Import (or re-export) these
 * instead of re-typing the values — the hand-typed frontend \`Unit\` copies drifted to 13 of 16.
 */

`;
  const body = enums
    .map(({ name, values }) => {
      const members = values.map((v) => `  ${v}: '${v}',`).join('\n');
      return `export const ${name} = {\n${members}\n} as const;\nexport type ${name} = (typeof ${name})[keyof typeof ${name}];\n`;
    })
    .join('\n');
  return header + body;
}

const TARGETS = [
  { outPath: BACKEND_OUT, render: renderBackend },
  { outPath: FRONTEND_OUT, render: renderFrontend },
];

/**
 * Format through the repo's prettier so the emitted file is byte-identical to what
 * lint-staged's `prettier --write` produces at commit time — otherwise --check
 * reports the file stale after every commit (the formatting ping-pong bug).
 */
function formatWithPrettier(source, outPath) {
  try {
    return execSync(`npx prettier --stdin-filepath "${outPath}"`, {
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
  const outputs = TARGETS.map((t) => ({ ...t, output: formatWithPrettier(t.render(enums), t.outPath) }));

  if (process.argv.includes('--check')) {
    // Compare content, not line endings. git's autocrlf checks these files out as CRLF on Windows
    // while the generator emits LF, so a byte comparison reported "stale" on every fresh checkout
    // even when the file was correct — blocking commits and sending you to regenerate a file that
    // did not need regenerating. Same CRLF root cause as the value parser above.
    const sameContent = (a, b) => a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n');
    const stale = outputs.filter(({ outPath, output }) => {
      let existing = null;
      try {
        existing = fs.readFileSync(outPath, 'utf8');
      } catch {
        /* missing counts as stale */
      }
      return existing === null || !sameContent(existing, output);
    });
    if (stale.length) {
      for (const { outPath } of stale) {
        console.error(
          `✗ ${path.relative(REPO_ROOT, outPath)} is stale vs schema.prisma (${enums.length} enums). ` +
            'Run: node scripts/skills/generate-zod-enums.js'
        );
      }
      process.exit(1);
    }
    console.log(`✓ generated prisma-enums.ts (backend + frontend) up to date (${enums.length} enums)`);
    return;
  }

  for (const { outPath, output } of outputs) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, output);
    console.log(`✓ Wrote ${path.relative(REPO_ROOT, outPath)} — ${enums.length} enums generated from schema.prisma`);
  }
}

main();
