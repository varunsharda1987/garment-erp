/**
 * One-off repair: delete the label size rows `sizes-later-workflow.test.ts` leaked into `materials` (2026-09-26).
 *
 * The test creates a sized label (`SZL<run>-SZ`), and MRP creates one materials row per size for it
 * (`SZL<run>-SZ-S`, `-M`, `-L`, id = the size variant's). The teardown deleted the base row, the variants and
 * the label, but not these size rows: deleting the variant and the label SET NULL their `sizeVariantId` and
 * `labelId`, so every run left three orphaned rows behind. The teardown now deletes by labelId first.
 *
 * A row is deleted only if it carries that signature — code `SZL…-SZ-S|M|L`, LABEL, no labelId, no
 * sizeVariantId — AND no *id or JSON column anywhere in the database names it. One failure refuses the run.
 * These rows are the test's own fixtures, so this finishes its teardown (hard delete, like the teardown);
 * the API's material delete only deactivates. Each --apply appends its snapshot to the snapshot file.
 *
 *   npx ts-node scripts/repair-leaked-test-size-rows.ts            (dry run)
 *   npx ts-node scripts/repair-leaked-test-size-rows.ts --apply
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';

const APPLY = process.argv.includes('--apply');
const SNAPSHOT = path.join(__dirname, 'repair-leaked-test-size-rows-snapshot.json');
const SIGNATURE = /^SZL[A-Z0-9]+-SZ-(S|M|L)$/;

async function main() {
  const candidates = await prisma.materials.findMany({
    where: { code: { startsWith: 'SZL' }, materialType: 'LABEL', labelId: null, sizeVariantId: null },
    orderBy: { code: 'asc' },
  });
  const rows = candidates.filter((m) => SIGNATURE.test(m.code));
  console.log(`${rows.length} leaked test size row(s) match the signature.`);
  if (rows.length === 0) return;

  // Anything in any table that still names one of these ids, beyond the row itself
  const ids = rows.map((r) => r.id);
  const columns = await prisma.$queryRaw<Array<{ table_name: string; column_name: string; data_type: string }>>`
    SELECT c.table_name, c.column_name, c.data_type
      FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema
     WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
       AND ((c.data_type IN ('text', 'character varying', 'uuid') AND lower(c.column_name) LIKE '%id')
            OR c.data_type IN ('json', 'jsonb'))`;
  const references: string[] = [];
  for (const col of columns) {
    if (col.table_name === 'materials' && col.column_name === 'id') continue;
    const json = col.data_type === 'json' || col.data_type === 'jsonb';
    const [{ n }] = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
      json
        ? `SELECT count(*)::int n FROM "${col.table_name}" WHERE "${col.column_name}"::text LIKE ANY($1)`
        : `SELECT count(*)::int n FROM "${col.table_name}" WHERE "${col.column_name}"::text = ANY($1)`,
      json ? ids.map((id) => `%${id}%`) : ids
    );
    if (n > 0) references.push(`${col.table_name}.${col.column_name}=${n}`);
  }
  console.log(
    `Scan of ${columns.length} *id / JSON columns: ${references.length ? `FOUND ${references.join(', ')}` : 'no reference'}`
  );
  if (references.length) throw new Error('A row is still referenced — refusing to delete any of them.');

  if (!APPLY) {
    console.log('Dry run. Re-run with --apply to delete them.');
    return;
  }

  const previous = fs.existsSync(SNAPSHOT) ? JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')) : null;
  const runs = previous?.runs ?? [];
  runs.push({ takenAt: new Date().toISOString(), rows });
  fs.writeFileSync(SNAPSHOT, JSON.stringify({ runs }, null, 2));
  console.log(`Snapshot written: ${SNAPSHOT}`);

  const { count } = await prisma.materials.deleteMany({ where: { id: { in: ids } } });
  console.log(`Deleted ${count} of ${rows.length}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
