import prisma from '../src/config/database';
(async () => {
  // Does unified_stock_view have a stockValue column?
  const cols: any[] = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name='unified_stock_view' ORDER BY column_name`
  );
  console.log('unified_stock_view columns:', cols.map((c) => c.column_name).join(', '));
  console.log('has stockValue:', cols.some((c) => c.column_name === 'stockValue'));

  // Reproduce the current query -> expect a crash
  try {
    await prisma.$queryRawUnsafe(`SELECT "materialType", SUM("stockValue") FROM unified_stock_view GROUP BY "materialType"`);
    console.log('CURRENT query: OK (unexpected)');
  } catch (e: any) {
    console.log('CURRENT query: ❌ CRASHES ->', (e.message || '').split('\n')[0]);
  }

  // What the derived-based replacement returns
  const derived: any[] = await prisma.$queryRawUnsafe(
    `SELECT m."materialType", COUNT(*)::int AS "totalRecords", COALESCE(SUM(dv.quantity),0)::float AS "totalQuantity",
            COALESCE(SUM(dv."stockValue"),0)::float AS "totalValue"
     FROM derived_stock_view dv JOIN materials m ON m.id = dv."materialId"
     GROUP BY m."materialType" ORDER BY m."materialType"`
  );
  console.log('\nDerived-based replacement result:');
  console.table(derived);
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
