/**
 * Tests for migration-contract.js — run:  node --test scripts/hooks/migration-contract.test.js
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { findContractViolations, isRuledMigration } = require('./migration-contract');

const MIGRATIONS = path.resolve(__dirname, '..', '..', 'backend', 'prisma', 'migrations');
const read = (name) => fs.readFileSync(path.join(MIGRATIONS, name, 'migration.sql'), 'utf8');
const reasons = (sql) => findContractViolations(sql).map((v) => v.reason.split(' ')[0] + ' ' + v.reason.split(' ')[1]);

test('the four migrations that broke live code are flagged', () => {
  for (const name of [
    '20260809053758_add_tally_settings',
    '20260824140000_retire_legacy_jwo_status',
    '20260919135947_wash_care_per_customer_fabric',
    '20260930170000_jwo_line_links_required',
  ]) {
    assert.ok(findContractViolations(read(name)).length > 0, `${name} should be flagged`);
  }
});

test('additive migrations pass', () => {
  for (const name of [
    '20261002120000_requirement_processing_type',
    '20260930180000_finishing_slip_takings_and_cutting_slips',
    '20260928170000_colour_optional_production_chain',
    '20260926190000_thread_stock_per_pack',
    '20260921112453',
  ].map((n) => fs.readdirSync(MIGRATIONS).find((d) => d.startsWith(n)) || n)) {
    assert.deepStrictEqual(findContractViolations(read(name)), [], `${name} should pass`);
  }
});

test('each contract statement is named', () => {
  assert.deepStrictEqual(reasons('ALTER TABLE "a" DROP COLUMN "b";'), ['DROP COLUMN']);
  assert.deepStrictEqual(reasons('ALTER TABLE "a" ALTER COLUMN "b" SET NOT NULL;'), ['SET NOT']);
  assert.deepStrictEqual(reasons('ALTER TABLE "a" ALTER COLUMN "b" SET DATA TYPE TEXT;'), ['ALTER COLUMN']);
  assert.deepStrictEqual(reasons('ALTER TABLE "a" RENAME COLUMN "b" TO "c";'), ['RENAME —']);
  assert.deepStrictEqual(reasons('ALTER TYPE "E" RENAME VALUE \'X\' TO \'Y\';'), ['RENAME —']);
  assert.deepStrictEqual(reasons('DROP TABLE "a";'), ['DROP TABLE']);
  assert.deepStrictEqual(reasons('DROP TYPE "E";'), ['DROP TYPE']);
  assert.deepStrictEqual(reasons('TRUNCATE "a";'), ['TRUNCATE —']);
});

test('ADD COLUMN NOT NULL needs a DEFAULT, across lines and clauses', () => {
  assert.deepStrictEqual(reasons('ALTER TABLE "a" ADD COLUMN "b" TEXT\n  NOT NULL;'), ['ADD COLUMN']);
  assert.deepStrictEqual(reasons('ALTER TABLE "a" ADD COLUMN "b" TEXT NOT NULL DEFAULT \'x\';'), []);
  assert.deepStrictEqual(reasons('ALTER TABLE "a" ADD COLUMN "b" TEXT,\nADD COLUMN "c" INTEGER NOT NULL;'), ['ADD COLUMN']);
  assert.deepStrictEqual(reasons('ALTER TABLE "a" ADD COLUMN "b" TEXT;'), []);
  assert.deepStrictEqual(reasons('CREATE TABLE "a" ("id" TEXT NOT NULL);'), []);
});

test('loosening is allowed: indexes, constraints, enum values, nullable', () => {
  assert.deepStrictEqual(reasons('DROP INDEX "a_b_key";'), []);
  assert.deepStrictEqual(reasons('ALTER TABLE "a" DROP CONSTRAINT "a_fkey";'), []);
  assert.deepStrictEqual(reasons('ALTER TABLE "a" ALTER COLUMN "b" DROP NOT NULL;'), []);
  assert.deepStrictEqual(reasons('ALTER TYPE "E" ADD VALUE \'Z\';'), []);
  assert.deepStrictEqual(reasons('ALTER INDEX "a" RENAME TO "b";'), []);
  assert.deepStrictEqual(reasons('ALTER TABLE "a" RENAME CONSTRAINT "x" TO "y";'), []);
});

test('a view may be dropped only when the migration recreates it', () => {
  assert.deepStrictEqual(reasons('DROP VIEW IF EXISTS "v";\nCREATE VIEW "v" AS SELECT 1;'), []);
  assert.deepStrictEqual(reasons('DROP VIEW IF EXISTS v;\nCREATE OR REPLACE VIEW v AS SELECT 1;'), []);
  assert.deepStrictEqual(reasons('DROP VIEW "v";'), ['DROP VIEW']);
});

test('allow-contract on the statement or the comment just above it', () => {
  assert.deepStrictEqual(reasons('-- allow-contract: column unused since abc123\nALTER TABLE "a" DROP COLUMN "b";'), []);
  assert.deepStrictEqual(reasons('ALTER TABLE "a" DROP COLUMN "b"; -- allow-contract: unused'), ['DROP COLUMN']);
  assert.deepStrictEqual(reasons('ALTER TABLE "a" -- allow-contract: unused since abc\n DROP COLUMN "b";'), []);
  assert.deepStrictEqual(reasons('-- allow-contract:\nALTER TABLE "a" DROP COLUMN "b";'), ['DROP COLUMN'], 'a reason is required');
  assert.deepStrictEqual(
    reasons('-- allow-contract: only the first\nALTER TABLE "a" DROP COLUMN "b";\nALTER TABLE "a" DROP COLUMN "c";'),
    ['DROP COLUMN'],
    'the marker covers one statement'
  );
});

test('semicolons inside strings and dollar-quoted bodies do not split', () => {
  assert.deepStrictEqual(reasons("COMMENT ON TABLE a IS 'x; DROP TABLE b';"), []);
  assert.deepStrictEqual(reasons('DO $$ BEGIN PERFORM 1; END $$;'), []);
  assert.deepStrictEqual(reasons('DO $$ BEGIN ALTER TABLE a DROP COLUMN b; END $$;'), ['DROP COLUMN'], 'a DO block is still checked');
});

test('only migrations from the rule date on are checked', () => {
  assert.strictEqual(isRuledMigration('backend/prisma/migrations/20261003120000_cutting_return_short/migration.sql'), true);
  assert.strictEqual(isRuledMigration('backend/prisma/migrations/20260919135947_wash_care_per_customer_fabric/migration.sql'), false);
  assert.strictEqual(isRuledMigration('backend/prisma/schema.prisma'), false);
});
