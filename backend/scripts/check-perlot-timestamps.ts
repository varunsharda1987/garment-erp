import prisma from '../src/config/database';
(async () => {
  const tables = [
    'greige_stock', 'fabric_stock', 'lace_stock', 'thread_stock', 'button_stock', 'zipper_stock',
    'elastic_stock', 'label_stock', 'packaging_stock', 'machine_part_stock', 'other_material_stock',
  ];
  for (const t of tables) {
    const cols: any[] = await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = $1 AND data_type LIKE 'timestamp%' ORDER BY column_name`, t
    );
    console.log(t.padEnd(22), '->', cols.map((c) => c.column_name).join(', ') || '(no timestamp cols)');
  }
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
