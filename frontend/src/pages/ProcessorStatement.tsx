/**
 * Processor Statement — what is with this dyer/printer, and does it reconcile?
 *
 * The screen and the printed PDF come from the same endpoint, but they are not the same
 * document: the print goes TO the processor to sign back, so it omits our tolerance verdict and
 * debit exposure. Those live here, under each job, for our side of the conversation.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Printer, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/PageHeader';
import { SupplierCombobox } from '@/components/SupplierCombobox';
import { handleApiError } from '@/lib/api-error-handler';
import { formatQuantity } from '@/lib/formatters';
import { openPDF } from '@/lib/document-utils';
import { getProcessorStatement, processorStatementPdfPath } from '@/services/processorStatement.service';
import type { ProcessorStatement as Statement, StatementJobLine, StatementUom } from '@/types/processorStatement.types';
import { formatDate } from '@/lib/date';

function thisMonth(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(first), to: iso(last) };
}

const qty = (value: number, unit: StatementUom) => formatQuantity(value, unit === 'PCS' ? 'pcs' : 'm', 2);

/** Signed on purpose: "short" is ours to chase, "over" is theirs to be credited. */
function shortfallText(value: number, unit: StatementUom): string {
  if (Math.abs(value) <= 0.005) return '—';
  return value > 0 ? `${qty(Math.abs(value), unit)} short` : `${qty(Math.abs(value), unit)} over`;
}

const fmtDate = (value: string | null) => (value ? formatDate(new Date(value)) : '—');

function JobRow({ job }: { job: StatementJobLine }) {
  return (
    <TableRow className="bg-muted/20">
      <TableCell className="pl-10 text-xs text-muted-foreground">
        <Link to={`/job-work-orders/${job.jwoId}`} className="font-medium text-foreground hover:underline">
          {job.jobWorkNumber}
        </Link>{' '}
        · {job.processType} · sent {fmtDate(job.sentDate)}
        {job.challanNumbers.length > 0 && <> · challan {job.challanNumbers.join(', ')}</>}
        {job.virtual && <span className="ml-1 italic">(already at processor)</span>}
        {job.agreedShrinkagePct != null && job.dueBack != null && (
          <div>
            {job.agreedShrinkagePct.toFixed(1)}% agreed → due back {qty(job.dueBack, job.unit)}
          </div>
        )}
        {job.receipts.map((r) => (
          <div key={r.grnNumber}>
            received {r.grnNumber} · {fmtDate(r.date)} · {qty(r.qty, job.unit)}
          </div>
        ))}
        {job.screenOnly.isOverTolerance && (
          <div className="text-destructive">
            Over the agreed tolerance of {job.screenOnly.tolerancePercent}%
            {job.screenOnly.qtyAbnormalLoss != null && job.screenOnly.qtyAbnormalLoss > 0 && (
              <> · abnormal loss {qty(job.screenOnly.qtyAbnormalLoss, job.unit)}</>
            )}
          </div>
        )}
        {job.damaged != null && job.damaged > 0 && <div>damaged {qty(job.damaged, job.unit)}</div>}
      </TableCell>
      <TableCell className="text-right text-xs" />
      <TableCell className="text-right text-xs">{qty(job.sentQty, job.unit)}</TableCell>
      <TableCell className="text-right text-xs">
        {job.receipts.length
          ? qty(
              job.receipts.reduce((s, r) => s + r.qty, 0),
              job.unit
            )
          : '—'}
      </TableCell>
      <TableCell className="text-right text-xs">{job.returned ? qty(job.returned, job.unit) : '—'}</TableCell>
      <TableCell className="text-right text-xs">{job.shrinkage ? qty(job.shrinkage, job.unit) : '—'}</TableCell>
      <TableCell className="text-right text-xs">{shortfallText(job.shortfall, job.unit)}</TableCell>
      <TableCell className="text-right text-xs font-medium">{qty(job.balance, job.unit)}</TableCell>
    </TableRow>
  );
}

export default function ProcessorStatementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaults = thisMonth();

  const [processorId, setProcessorId] = useState(searchParams.get('processorId') ?? '');
  const [periodStart, setPeriodStart] = useState(searchParams.get('periodStart') ?? defaults.from);
  const [periodEnd, setPeriodEnd] = useState(searchParams.get('periodEnd') ?? defaults.to);

  const [statement, setStatement] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const params = { processorId, periodStart, periodEnd };

  const generate = useCallback(async () => {
    if (!processorId) {
      setError('Pick a processor first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getProcessorStatement({ processorId, periodStart, periodEnd });
      setStatement(data);
      // Open every material row: the whole point is seeing the jobs underneath.
      setExpanded(new Set(data.sections.flatMap((s) => s.rows.map((r) => `${r.material.kind}:${r.material.id}`))));
      setSearchParams({ processorId, periodStart, periodEnd }, { replace: true });
    } catch (err) {
      setStatement(null);
      setError(handleApiError(err, 'Could not build the statement', false));
    } finally {
      setLoading(false);
    }
  }, [processorId, periodStart, periodEnd, setSearchParams]);

  // A shared link (?processorId=…) should land on the answer, not an empty form.
  useEffect(() => {
    if (processorId && !statement && !loading && !error) void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const clothSections = statement?.sections.filter((s) => s.kind !== 'GARMENT') ?? [];
  const kpi = clothSections.reduce(
    (acc, s) => ({
      opening: acc.opening + s.totals.opening,
      sent: acc.sent + s.totals.sent,
      received: acc.received + s.totals.received,
      closing: acc.closing + s.totals.closing,
    }),
    { opening: 0, sent: 0, received: 0, closing: 0 }
  );

  return (
    <div className="container mx-auto py-6">
      <PageHeader title="Processor Statement">
        <Button variant="outline" onClick={generate} disabled={loading || !processorId}>
          {loading ? 'Building…' : 'Generate'}
        </Button>
        <Button
          variant="outline"
          disabled={!statement}
          onClick={() => openPDF(processorStatementPdfPath(params))}
          title="The processor's copy — without our tolerance and debit figures"
        >
          <Printer className="mr-2 h-4 w-4" />
          Print / PDF
        </Button>
      </PageHeader>
      <p className="text-muted-foreground -mt-4 mb-4">
        What our records say is with this processor, greige-wise — print it and have them confirm it.
      </p>

      <Card className="mb-6">
        <CardContent className="grid gap-4 pt-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label>Processor</Label>
            <SupplierCombobox
              value={processorId}
              onValueChange={setProcessorId}
              categoryFilter="PROCESSOR"
              placeholder="Select a dyer, printer or vendor…"
            />
          </div>
          <div>
            <Label htmlFor="ps-from">From</Label>
            <Input id="ps-from" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ps-to">To</Label>
            <Input id="ps-to" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="mb-4 rounded border border-destructive/20 bg-destructive/10 px-4 py-3 text-destructive">
          {error}
        </div>
      )}

      {statement && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: 'Opening with them', value: kpi.opening },
              { label: 'Sent in period', value: kpi.sent },
              { label: 'Received back', value: kpi.received },
              { label: 'Closing with them', value: kpi.closing },
            ].map((tile) => (
              <Card key={tile.label}>
                <CardContent className="pt-6">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{tile.label}</div>
                  <div className="mt-1 text-2xl font-semibold">{formatQuantity(tile.value, 'm', 2)}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {statement.warnings.length > 0 && (
            <Card className="mb-6 border-amber-300">
              <CardContent className="pt-6">
                <div className="mb-2 flex items-center gap-2 font-medium text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  Worth checking before you send this
                </div>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {statement.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {statement.sections.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Nothing was sent to or received from {statement.processor.name} in this period, and nothing was
                outstanding before it.
              </CardContent>
            </Card>
          )}

          {statement.sections.map((section) => (
            <Card key={section.kind} className="mb-6">
              <CardContent className="pt-6">
                <div className="mb-3 font-medium">{section.title}</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Opening</TableHead>
                      <TableHead className="text-right">Sent</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Returned</TableHead>
                      <TableHead className="text-right">Agreed shrinkage</TableHead>
                      <TableHead className="text-right">Short / Over</TableHead>
                      <TableHead className="text-right">Closing</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {section.rows.map((row) => {
                      const key = `${row.material.kind}:${row.material.id}`;
                      const isOpen = expanded.has(key);
                      return (
                        <>
                          <TableRow key={key} className="cursor-pointer" onClick={() => toggle(key)}>
                            <TableCell className="font-medium">
                              <span className="mr-1 inline-flex align-middle">
                                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </span>
                              {row.material.code} · {row.material.name}
                              {row.unitMixed && (
                                <Badge variant="outline" className="ml-2">
                                  mixed units
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{qty(row.opening, row.unit)}</TableCell>
                            <TableCell className="text-right">{qty(row.sent, row.unit)}</TableCell>
                            <TableCell className="text-right">{qty(row.received, row.unit)}</TableCell>
                            <TableCell className="text-right">
                              {row.returned ? qty(row.returned, row.unit) : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              {row.shrinkage ? qty(row.shrinkage, row.unit) : '—'}
                            </TableCell>
                            <TableCell className="text-right">{shortfallText(row.shortfall, row.unit)}</TableCell>
                            <TableCell
                              className={`text-right font-semibold ${row.closing < -0.005 ? 'text-destructive' : ''}`}
                            >
                              {qty(row.closing, row.unit)}
                            </TableCell>
                          </TableRow>
                          {isOpen && row.jobs.map((job) => <JobRow key={job.jwoId} job={job} />)}
                        </>
                      );
                    })}
                    <TableRow className="border-t-2 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{qty(section.totals.opening, section.unit)}</TableCell>
                      <TableCell className="text-right">{qty(section.totals.sent, section.unit)}</TableCell>
                      <TableCell className="text-right">{qty(section.totals.received, section.unit)}</TableCell>
                      <TableCell className="text-right">
                        {section.totals.returned ? qty(section.totals.returned, section.unit) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {section.totals.shrinkage ? qty(section.totals.shrinkage, section.unit) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {shortfallText(section.totals.shortfall, section.unit)}
                      </TableCell>
                      <TableCell className="text-right">{qty(section.totals.closing, section.unit)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </>
      )}

      {!statement && !error && !loading && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Pick a processor and a period, then choose Generate.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
