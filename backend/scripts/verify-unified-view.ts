/**
 * Verify unified_stock_view contents
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== Unified Stock View Verification ===\n');

  // Query the view
  const results = await prisma.$queryRaw<
    Array<{ materialType: string; count: bigint; total_qty: number }>
  >`
    SELECT "materialType", COUNT(*) as count, SUM(quantity) as total_qty
    FROM unified_stock_view
    GROUP BY "materialType"
    ORDER BY "materialType"
  `;

  console.log('Stock by Material Type:');
  console.log('| Material Type    | Records | Total Qty   |');
  console.log('|------------------|---------|-------------|');

  for (const r of results) {
    const type = r.materialType.padEnd(16);
    const count = String(r.count).padStart(7);
    const qty = Number(r.total_qty).toFixed(2).padStart(11);
    console.log(`| ${type} | ${count} | ${qty} |`);
  }

  // Compare with stock_levels
  console.log('\n--- Comparison with stock_levels ---\n');

  const stockLevelsTotals = await prisma.$queryRaw<
    Array<{ materialType: string; count: bigint; total_qty: number }>
  >`
    SELECT
      m."materialType",
      COUNT(*) as count,
      SUM(sl.quantity) as total_qty
    FROM stock_levels sl
    JOIN materials m ON m.id = sl."materialId"
    GROUP BY m."materialType"
    ORDER BY m."materialType"
  `;

  console.log('Stock Levels by Material Type:');
  console.log('| Material Type    | Records | Total Qty   |');
  console.log('|------------------|---------|-------------|');

  for (const r of stockLevelsTotals) {
    const type = (r.materialType || 'NULL').padEnd(16);
    const count = String(r.count).padStart(7);
    const qty = Number(r.total_qty || 0).toFixed(2).padStart(11);
    console.log(`| ${type} | ${count} | ${qty} |`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  prisma.$disconnect();
  process.exit(1);
});
