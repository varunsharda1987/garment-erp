/**
 * Dev preview for kf-document renders.
 *   npx ts-node scripts/preview-kf-doc.ts <template> <recordId> [outPath]
 * Renders the given record through its adapter + template and writes a PDF.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { renderDocument, KfTemplateName } from '../src/services/html-document.service';
import { closeBrowser } from '../src/services/html-renderer.service';
import { buildChallanDocData, CHALLAN_COPY_MARKS } from '../src/services/document-data/challan.doc-data';

// Lazy string requires so the script works while adapters are still being added
// (ts-node would otherwise fail compiling static imports of missing modules).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyAdapter(moduleName: string, fnName: string): (id?: string) => Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require(`../src/services/document-data/${moduleName}`);
  return mod[fnName];
}

async function buildData(template: KfTemplateName, id: string): Promise<{ data: Record<string, unknown>; copies?: string[] }> {
  switch (template) {
    case 'challan':
      return { data: (await buildChallanDocData(id)) as unknown as Record<string, unknown>, copies: CHALLAN_COPY_MARKS };
    case 'job-work-order':
      return { data: await lazyAdapter('job-work-order.doc-data', 'buildJobWorkOrderDocData')(id) };
    case 'grn':
      return { data: await lazyAdapter('grn.doc-data', 'buildGrnDocData')(id) };
    case 'tax-invoice':
      return { data: await lazyAdapter('tax-invoice.doc-data', 'buildTaxInvoiceDocData')(id) };
    case 'purchase-order':
      return { data: await lazyAdapter('purchase-order.doc-data', 'buildPurchaseOrderDocData')(id) };
    case 'report-job-work-ageing':
      return { data: await lazyAdapter('reports.doc-data', 'buildAgeingReportData')() };
    case 'report-itc-04':
      return { data: await lazyAdapter('reports.doc-data', 'buildItc04ReportData')() };
    case 'report-vendor-performance':
      return { data: await lazyAdapter('reports.doc-data', 'buildVendorPerformanceReportData')() };
    default:
      throw new Error(`No preview binding for template: ${template}`);
  }
}

async function main() {
  const [template, id, outArg] = process.argv.slice(2);
  if (!template) {
    console.error('Usage: npx ts-node scripts/preview-kf-doc.ts <template> <recordId> [outPath]');
    process.exit(1);
  }
  const { data, copies } = await buildData(template as KfTemplateName, id);
  const pdf = await renderDocument(template as KfTemplateName, data, { copies });
  const out = outArg || path.join(os.tmpdir(), `kf-preview-${template}-${Date.now()}.pdf`);
  fs.writeFileSync(out, pdf);
  console.log(`Rendered ${template} → ${out} (${(pdf.length / 1024).toFixed(1)} KB)`);
  await closeBrowser();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await closeBrowser();
  process.exit(1);
});
