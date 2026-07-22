/**
 * Phase 4 R1a verification (financial-gst-1): GSTR-1 must now include OVERDUE invoices and agree with
 * GSTR-3B for the same period. Compares old-filter vs new behavior against the live DB. Read-only.
 */
import prisma from '../src/config/database';
import { gstReportService } from '../src/services/gstReport.service';

async function main() {
  const byStatus = await prisma.invoices.groupBy({ by: ['status'], _count: true, _sum: { totalAmount: true } });
  console.log('invoices by status:', byStatus.map((s) => `${s.status}=${s._count} (₹${Number(s._sum.totalAmount || 0).toFixed(2)})`).join(', '));

  // pick a period covering everything
  const bounds = await prisma.invoices.aggregate({ _min: { invoiceDate: true }, _max: { invoiceDate: true } });
  if (!bounds._min.invoiceDate || !bounds._max.invoiceDate) { console.log('no invoices in DB — nothing to verify'); await prisma.$disconnect(); return; }
  const fromDate = bounds._min.invoiceDate.toISOString().slice(0, 10);
  const toDate = bounds._max.invoiceDate.toISOString().slice(0, 10);
  console.log('period:', fromDate, '→', toDate);

  // OLD behavior (the removed filter), reconstructed directly
  const oldCount = await prisma.invoices.count({
    where: { invoiceDate: { gte: new Date(fromDate), lte: new Date(toDate + 'T23:59:59.999Z') }, status: { not: 'OVERDUE' } },
  });
  const allCount = await prisma.invoices.count({
    where: { invoiceDate: { gte: new Date(fromDate), lte: new Date(toDate + 'T23:59:59.999Z') } },
  });

  const g1 = await gstReportService.generateGSTR1({ fromDate, toDate });
  const g3b = await gstReportService.generateGSTR3B({ fromDate, toDate });

  const g1Invoices = g1.b2b.length + (g1.b2cs ? g1.b2cs.length : 0);
  console.log(`OLD filter would report ${oldCount} invoices; ALL (reportable) = ${allCount}; dropped by old filter = ${allCount - oldCount}`);
  console.log(`GSTR-1 now reports: b2b=${g1.b2b.length}${g1.b2cs ? ' b2cs=' + g1.b2cs.length : ''} (total entries ${g1Invoices})`);
  const g1Tax = (g1 as any).totals || (g1 as any).summary;
  console.log('GSTR-1 totals:', JSON.stringify(g1Tax));
  console.log('GSTR-3B outward taxable:', JSON.stringify(g3b.outwardSupplies.taxable));
  const match = allCount === g1Invoices;
  console.log('GSTR-1 invoice count === ALL issued invoices:', match ? '✅' : `(entries ${g1Invoices} vs invoices ${allCount} — check split/aggregation semantics)`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
