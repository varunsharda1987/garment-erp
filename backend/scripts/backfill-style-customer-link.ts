/**
 * Backfill `styles.customerId` — the buyer LINK — from the sibling homes that already hold it.
 *
 * WHY THIS EXISTS (2026-09-19)
 * ----------------------------
 * `styles` keeps the buyer in two homes: `customerId` (the FK into `customers`, what reports
 * and filters join on) and `customerName` (display text). Until today the style form sent only
 * the text, and `createStyleSchema`/`updateStyleSchema` had no `customerId` field at all — so
 * Zod stripped it before the service (which always wrote it) ever saw it. Result: 0 of 1130
 * styles carried a link, while all 1130 carried a name.
 *
 * Nothing broke, because the only two readers of `styles.customerId` are the buyer filters on
 * `GET /styles` and `GET /styles/running`, and no page calls them yet. They would have returned
 * zero rows for every buyer, silently, the day someone wired them up.
 *
 * RESOLUTION ORDER (most trustworthy first)
 *   1. brand_categories — `styles.brandCategoryId` -> `brand_categories.customerId` (NOT NULL FK).
 *      This is a real link already in the database, not a guess.
 *   2. exact name match — `lower(styles.customerName) = lower(customers.name)`, used only when
 *      the style has no brand category. Applied only when EXACTLY ONE customer matches.
 *
 * A style is skipped (never guessed at) when neither path resolves, or when path 1 and path 2
 * disagree. Both are reported so a human can decide.
 *
 * USAGE
 *   npx ts-node scripts/backfill-style-customer-link.ts            # dry run, writes nothing
 *   npx ts-node scripts/backfill-style-customer-link.ts --apply    # perform the update
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

type Row = {
  id: string;
  styleCode: string;
  customerName: string | null;
  currentCustomerId: string | null;
  viaBrandCatId: string | null;
  viaBrandCatName: string | null;
  viaNameId: string | null;
  viaNameName: string | null;
  nameMatchCount: number;
};

async function main() {
  console.log(`\n=== Backfill styles.customerId  [${APPLY ? 'APPLY' : 'DRY RUN'}] ===\n`);

  const rows = await prisma.$queryRawUnsafe<Row[]>(`
    SELECT
      s.id,
      s."styleCode",
      s."customerName",
      s."customerId"           AS "currentCustomerId",
      bc."customerId"          AS "viaBrandCatId",
      bcc.name                 AS "viaBrandCatName",
      nm.id                    AS "viaNameId",
      nm.name                  AS "viaNameName",
      COALESCE(nmc.n, 0)::int  AS "nameMatchCount"
    FROM styles s
    LEFT JOIN brand_categories bc ON bc.id = s."brandCategoryId"
    LEFT JOIN customers bcc       ON bcc.id = bc."customerId"
    LEFT JOIN LATERAL (
      SELECT c.id, c.name FROM customers c
      WHERE lower(c.name) = lower(s."customerName") LIMIT 1
    ) nm ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS n FROM customers c
      WHERE lower(c.name) = lower(s."customerName")
    ) nmc ON TRUE
    ORDER BY s."styleCode"
  `);

  const viaBrandCat: Row[] = [];
  const viaName: Row[] = [];
  const alreadyLinked: Row[] = [];
  const conflicts: Row[] = [];
  const unresolved: Row[] = [];

  for (const r of rows) {
    if (r.currentCustomerId) {
      alreadyLinked.push(r);
      continue;
    }
    // Disagreement between the two homes — never guess, surface it.
    if (r.viaBrandCatId && r.viaNameId && r.viaBrandCatId !== r.viaNameId) {
      conflicts.push(r);
      continue;
    }
    if (r.viaBrandCatId) {
      viaBrandCat.push(r);
    } else if (r.viaNameId && r.nameMatchCount === 1) {
      viaName.push(r);
    } else {
      unresolved.push(r);
    }
  }

  const summarise = (label: string, list: Row[]) => {
    const by = new Map<string, number>();
    for (const r of list) {
      const k = r.viaBrandCatName || r.viaNameName || '(none)';
      by.set(k, (by.get(k) || 0) + 1);
    }
    console.log(`${label}: ${list.length}`);
    for (const [k, n] of [...by.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${k.padEnd(28)} ${n}`);
    }
  };

  console.log(`Total styles                     : ${rows.length}`);
  console.log(`Already linked (left untouched)  : ${alreadyLinked.length}`);
  summarise('Will link via brand_categories  ', viaBrandCat);
  summarise('Will link via exact name match  ', viaName);
  console.log(`Conflicts (SKIPPED, need a human): ${conflicts.length}`);
  console.log(`Unresolved (SKIPPED)             : ${unresolved.length}`);

  if (conflicts.length) {
    console.log('\n--- CONFLICTS: brand category and name text point at different buyers ---');
    console.table(
      conflicts.slice(0, 50).map((r) => ({
        styleCode: r.styleCode,
        textName: r.customerName,
        viaBrandCategory: r.viaBrandCatName,
      }))
    );
  }

  if (unresolved.length) {
    console.log('\n--- UNRESOLVED: no brand category, and no single exact name match ---');
    console.table(
      unresolved.slice(0, 50).map((r) => ({
        styleCode: r.styleCode,
        textName: r.customerName,
        nameMatches: r.nameMatchCount,
      }))
    );
    if (unresolved.length > 50) console.log(`  ... and ${unresolved.length - 50} more`);
  }

  const toWrite = [...viaBrandCat, ...viaName];
  if (!toWrite.length) {
    console.log('\nNothing to write.');
    return;
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — would set customerId on ${toWrite.length} styles. Nothing written.`);
    console.log('Re-run with --apply to perform the update.');
    return;
  }

  // Group by target customer so this is a handful of updateMany calls, not 1100 round trips.
  const byCustomer = new Map<string, string[]>();
  for (const r of toWrite) {
    const cid = (r.viaBrandCatId || r.viaNameId)!;
    if (!byCustomer.has(cid)) byCustomer.set(cid, []);
    byCustomer.get(cid)!.push(r.id);
  }

  let written = 0;
  await prisma.$transaction(async (tx) => {
    for (const [customerId, ids] of byCustomer) {
      // `customerId: null` in the filter keeps this idempotent and prevents overwriting
      // any link a user set in the meantime.
      const res = await tx.styles.updateMany({
        where: { id: { in: ids }, customerId: null },
        data: { customerId },
      });
      written += res.count;
      console.log(`  linked ${res.count} styles -> ${customerId}`);
    }
  });

  console.log(`\nDone. ${written} styles linked.`);

  const remaining = await prisma.styles.count({ where: { customerId: null } });
  console.log(`styles still without a customerId: ${remaining}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
