import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { handleApiError } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import api from '@/lib/api';
import { FileText, Download, Calendar } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface B2BInvoice {
  gstin: string;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalValue: number;
}

interface B2CSEntry {
  placeOfSupply: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
}

interface CDNREntry {
  gstin: string;
  customerName: string;
  noteNumber: string;
  invoiceNumber: string;
  noteDate: string;
  value: number;
  reason: string;
}

interface HSNSummaryEntry {
  hsnCode: string;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
}

interface GSTR1Report {
  summary: {
    totalInvoices: number;
    totalTaxableValue: number;
    totalTax: number;
    totalInvoiceValue: number;
  };
  b2b: B2BInvoice[];
  b2cs: B2CSEntry[];
  cdnr: CDNREntry[];
  hsnSummary: HSNSummaryEntry[];
}

interface TaxBreakdown {
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
}

interface GSTR3BSummary {
  outwardSupplies: TaxBreakdown;
  inputTaxCredit: {
    cgst: number;
    sgst: number;
    igst: number;
  };
  netTaxPayable: {
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
  };
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getThisMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toISODate(from), to: toISODate(to) };
}

function getLastMonthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: toISODate(from), to: toISODate(to) };
}

function getThisQuarterRange(): { from: string; to: string } {
  const now = new Date();
  const qMonth = Math.floor(now.getMonth() / 3) * 3;
  const from = new Date(now.getFullYear(), qMonth, 1);
  const to = new Date(now.getFullYear(), qMonth + 3, 0);
  return { from: toISODate(from), to: toISODate(to) };
}

function getThisFYRange(): { from: string; to: string } {
  const now = new Date();
  // Indian financial year: April to March
  const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const from = new Date(fyStartYear, 3, 1); // April 1
  const to = new Date(fyStartYear + 1, 2, 31); // March 31
  return { from: toISODate(from), to: toISODate(to) };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GSTReports() {
  const [fromDate, setFromDate] = useState(() => getThisMonthRange().from);
  const [toDate, setToDate] = useState(() => getThisMonthRange().to);
  const [activeTab, setActiveTab] = useState('gstr1');
  const [loading, setLoading] = useState(false);

  const [gstr1Data, setGstr1Data] = useState<GSTR1Report | null>(null);
  const [gstr3bData, setGstr3bData] = useState<GSTR3BSummary | null>(null);

  // --- Period quick-select ---
  function applyRange(rangeFn: () => { from: string; to: string }) {
    const range = rangeFn();
    setFromDate(range.from);
    setToDate(range.to);
  }

  // --- API calls ---
  async function handleGenerate() {
    if (!fromDate || !toDate) return;
    setLoading(true);
    try {
      if (activeTab === 'gstr1') {
        const res = await api.get('/gst-reports/gstr1', {
          params: { fromDate, toDate },
        });
        setGstr1Data(res.data.data);
      } else {
        const res = await api.get('/gst-reports/gstr3b', {
          params: { fromDate, toDate },
        });
        setGstr3bData(res.data.data);
      }
    } catch (err) {
      handleApiError(err, 'Failed to generate GST report');
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">GST Reports</h1>
        </div>
      </div>

      {/* Period Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fromDate">From Date</Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="toDate">To Date</Label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-44"
              />
            </div>

            {/* Quick-select buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyRange(getThisMonthRange)}
              >
                <Calendar className="mr-1.5 h-3.5 w-3.5" />
                This Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyRange(getLastMonthRange)}
              >
                Last Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyRange(getThisQuarterRange)}
              >
                This Quarter
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyRange(getThisFYRange)}
              >
                This FY
              </Button>
            </div>

            {/* Generate */}
            <Button onClick={handleGenerate} disabled={loading || !fromDate || !toDate}>
              {loading ? 'Generating...' : 'Generate Report'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="gstr1">GSTR-1</TabsTrigger>
          <TabsTrigger value="gstr3b">GSTR-3B</TabsTrigger>
        </TabsList>

        {/* ====== GSTR-1 Tab ====== */}
        <TabsContent value="gstr1" className="space-y-6">
          {gstr1Data ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard
                  title="Total Invoices"
                  value={String(gstr1Data.summary.totalInvoices)}
                  plain
                />
                <SummaryCard
                  title="Total Taxable Value"
                  value={formatCurrency(gstr1Data.summary.totalTaxableValue)}
                />
                <SummaryCard
                  title="Total Tax"
                  value={formatCurrency(gstr1Data.summary.totalTax)}
                />
                <SummaryCard
                  title="Total Invoice Value"
                  value={formatCurrency(gstr1Data.summary.totalInvoiceValue)}
                />
              </div>

              {/* B2B Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">B2B - Business to Business</CardTitle>
                </CardHeader>
                <CardContent>
                  {gstr1Data.b2b.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No B2B invoices for this period.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>GSTIN</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Taxable Value</TableHead>
                            <TableHead className="text-right">CGST</TableHead>
                            <TableHead className="text-right">SGST</TableHead>
                            <TableHead className="text-right">IGST</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gstr1Data.b2b.map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-xs">{row.gstin}</TableCell>
                              <TableCell>{row.customerName}</TableCell>
                              <TableCell>{row.invoiceNumber}</TableCell>
                              <TableCell>{formatDate(row.invoiceDate)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(row.taxableValue)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(row.cgst)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(row.sgst)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(row.igst)}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(row.totalValue)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* B2CS Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">B2CS - B2C (Small)</CardTitle>
                </CardHeader>
                <CardContent>
                  {gstr1Data.b2cs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No B2C (Small) supplies for this period.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Place of Supply</TableHead>
                            <TableHead className="text-right">Taxable Value</TableHead>
                            <TableHead className="text-right">CGST</TableHead>
                            <TableHead className="text-right">SGST</TableHead>
                            <TableHead className="text-right">IGST</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gstr1Data.b2cs.map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{row.placeOfSupply}</TableCell>
                              <TableCell className="text-right">{formatCurrency(row.taxableValue)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(row.cgst)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(row.sgst)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(row.igst)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* CDNR Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">CDNR - Credit / Debit Notes (Registered)</CardTitle>
                </CardHeader>
                <CardContent>
                  {gstr1Data.cdnr.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No credit/debit notes for this period.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>GSTIN</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Note #</TableHead>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Value</TableHead>
                            <TableHead>Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gstr1Data.cdnr.map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-xs">{row.gstin}</TableCell>
                              <TableCell>{row.customerName}</TableCell>
                              <TableCell>{row.noteNumber}</TableCell>
                              <TableCell>{row.invoiceNumber}</TableCell>
                              <TableCell>{formatDate(row.noteDate)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(row.value)}</TableCell>
                              <TableCell>{row.reason}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* HSN Summary Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">HSN Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  {gstr1Data.hsnSummary.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No HSN data for this period.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>HSN Code</TableHead>
                            <TableHead className="text-right">Taxable Value</TableHead>
                            <TableHead className="text-right">CGST</TableHead>
                            <TableHead className="text-right">SGST</TableHead>
                            <TableHead className="text-right">IGST</TableHead>
                            <TableHead className="text-right">Total Tax</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gstr1Data.hsnSummary.map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono">{row.hsnCode}</TableCell>
                              <TableCell className="text-right">{formatCurrency(row.taxableValue)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(row.cgst)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(row.sgst)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(row.igst)}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(row.totalTax)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <EmptyState tab="GSTR-1" />
          )}
        </TabsContent>

        {/* ====== GSTR-3B Tab ====== */}
        <TabsContent value="gstr3b" className="space-y-6">
          {gstr3bData ? (
            <>
              {/* 3.1 - Outward Supplies */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">3.1 - Outward Supplies &amp; Outward Tax</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Taxable Value</TableHead>
                          <TableHead className="text-right">CGST</TableHead>
                          <TableHead className="text-right">SGST</TableHead>
                          <TableHead className="text-right">IGST</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">Outward taxable supplies (other than zero rated, nil rated and exempted)</TableCell>
                          <TableCell className="text-right">{formatCurrency(gstr3bData.outwardSupplies.taxableValue)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(gstr3bData.outwardSupplies.cgst)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(gstr3bData.outwardSupplies.sgst)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(gstr3bData.outwardSupplies.igst)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* 4 - Eligible ITC */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">4 - Eligible Input Tax Credit (ITC)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">CGST</TableHead>
                          <TableHead className="text-right">SGST</TableHead>
                          <TableHead className="text-right">IGST</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">ITC Available (from purchases)</TableCell>
                          <TableCell className="text-right">{formatCurrency(gstr3bData.inputTaxCredit.cgst)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(gstr3bData.inputTaxCredit.sgst)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(gstr3bData.inputTaxCredit.igst)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* 6 - Net Tax Payable */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">6 - Net Tax Payable</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tax Component</TableHead>
                          <TableHead className="text-right">Output Tax</TableHead>
                          <TableHead className="text-right">Input Tax Credit</TableHead>
                          <TableHead className="text-right font-semibold">Net Payable</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">CGST</TableCell>
                          <TableCell className="text-right">{formatCurrency(gstr3bData.outwardSupplies.cgst)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(gstr3bData.inputTaxCredit.cgst)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(gstr3bData.netTaxPayable.cgst)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">SGST</TableCell>
                          <TableCell className="text-right">{formatCurrency(gstr3bData.outwardSupplies.sgst)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(gstr3bData.inputTaxCredit.sgst)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(gstr3bData.netTaxPayable.sgst)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">IGST</TableCell>
                          <TableCell className="text-right">{formatCurrency(gstr3bData.outwardSupplies.igst)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(gstr3bData.inputTaxCredit.igst)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(gstr3bData.netTaxPayable.igst)}</TableCell>
                        </TableRow>
                        <TableRow className="border-t-2 bg-muted/50">
                          <TableCell className="font-bold">Total</TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(
                              gstr3bData.outwardSupplies.cgst +
                              gstr3bData.outwardSupplies.sgst +
                              gstr3bData.outwardSupplies.igst
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(
                              gstr3bData.inputTaxCredit.cgst +
                              gstr3bData.inputTaxCredit.sgst +
                              gstr3bData.inputTaxCredit.igst
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary">
                            {formatCurrency(gstr3bData.netTaxPayable.total)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <EmptyState tab="GSTR-3B" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  title,
  value,
  plain,
}: {
  title: string;
  value: string;
  plain?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={plain ? 'text-2xl font-bold' : 'text-2xl font-bold'}>{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ tab }: { tab: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16">
        <FileText className="mb-4 h-12 w-12 text-muted-foreground/40" />
        <p className="text-lg font-medium text-muted-foreground">No {tab} data loaded</p>
        <p className="mt-1 text-sm text-muted-foreground/70">
          Select a date range and click &quot;Generate Report&quot; to view the {tab} report.
        </p>
      </CardContent>
    </Card>
  );
}
