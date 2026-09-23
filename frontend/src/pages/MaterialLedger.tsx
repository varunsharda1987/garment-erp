/**
 * Material Ledger — for one material: when it came in, where it went, what is left.
 *
 * The closing balance is shown next to what stock records actually say. They should agree; when
 * they do not, the page says so loudly rather than quietly presenting one of them as the truth.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Printer, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/PageHeader';
import { MaterialCombobox } from '@/components/MaterialCombobox';
import { WarehouseCombobox } from '@/components/WarehouseCombobox';
import { handleApiError } from '@/lib/api-error-handler';
import { formatQuantity, formatMaterialType } from '@/lib/formatters';
import { openPDF } from '@/lib/document-utils';
import { getMaterialLedger, materialLedgerPdfPath } from '@/services/materialLedger.service';
import type { LedgerRow, MaterialLedger as Ledger } from '@/types/materialLedger.types';
import { formatDate } from '@/lib/date';
import { unitShort } from '@/lib/units';

const KIND_LABEL: Record<string, string> = {
  RECEIPT: 'Received',
  ISSUE: 'Issued',
  RETURN: 'Returned',
  TRANSFER: 'Transfer',
  ADJUSTMENT: 'Adjustment',
  RESERVE: 'Reserved',
  RELEASE: 'Released',
};

const SOURCE_LABEL: Record<string, string> = {
  GRN: 'GRN',
  PO: 'Purchase order',
  JOB_WORK_ORDER: 'Job work',
  CHALLAN: 'Challan',
  EXTERNAL_PROCESS: 'Send-out',
  ISSUE_NOTE: 'Issue note',
  PROCESSING_BATCH: 'Batch',
  CUTTING: 'Cutting',
  ORDER: 'Order',
  PROCUREMENT: 'Purchase',
  TRANSFER: 'Transfer',
  ADJUSTMENT: 'Adjustment',
  STOCK_IN: 'Stock In',
  MANUAL: 'Manual',
};

const fmtDate = (value: string) => formatDate(new Date(value));

function Row({ row, unit }: { row: LedgerRow; unit: string }) {
  const doc = SOURCE_LABEL[row.source.type] ?? row.source.type;
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-sm">{fmtDate(row.date)}</TableCell>
      <TableCell className="text-sm">
        <div>{KIND_LABEL[row.kind] ?? row.kind}</div>
        <div className="text-xs text-muted-foreground">
          {doc}{' '}
          {row.source.route && row.source.number ? (
            <Link to={row.source.route} className="hover:underline">
              {row.source.number}
            </Link>
          ) : (
            (row.source.number ?? '—')
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm">
        {row.source.party ?? row.source.destination ?? '—'}
        {row.source.party && row.source.destination && (
          <div className="text-xs text-muted-foreground">{row.source.destination}</div>
        )}
        {row.remarks && <div className="text-xs text-muted-foreground">{row.remarks}</div>}
        {row.flags.map((f) => (
          <div key={f} className="text-xs text-amber-700">
            {f}
          </div>
        ))}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{row.warehouse?.name ?? '—'}</TableCell>
      <TableCell className="text-xs">{row.lot?.label ?? (row.lot ? row.lot.id.slice(0, 8) : '—')}</TableCell>
      <TableCell className="text-right text-sm">
        {row.direction === 'IN' ? formatQuantity(row.qty, row.unit || unit) : '—'}
      </TableCell>
      <TableCell className="text-right text-sm">
        {row.direction === 'OUT' ? formatQuantity(row.qty, row.unit || unit) : '—'}
      </TableCell>
      <TableCell className={`text-right text-sm font-medium ${row.balance < -0.005 ? 'text-destructive' : ''}`}>
        {formatQuantity(row.balance, unit)}
      </TableCell>
    </TableRow>
  );
}

export default function MaterialLedgerPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [materialId, setMaterialId] = useState(searchParams.get('materialId') ?? '');
  const [warehouseId, setWarehouseId] = useState(searchParams.get('warehouseId') ?? '');
  const [from, setFrom] = useState(searchParams.get('from') ?? '');
  const [to, setTo] = useState(searchParams.get('to') ?? '');

  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = { from: from || undefined, to: to || undefined, warehouseId: warehouseId || undefined };

  const load = useCallback(async () => {
    if (!materialId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getMaterialLedger(materialId, {
        from: from || undefined,
        to: to || undefined,
        warehouseId: warehouseId || undefined,
      });
      setLedger(data);
      const next: Record<string, string> = { materialId };
      if (from) next.from = from;
      if (to) next.to = to;
      if (warehouseId) next.warehouseId = warehouseId;
      setSearchParams(next, { replace: true });
    } catch (err) {
      setLedger(null);
      setError(handleApiError(err, 'Could not load the ledger', false));
    } finally {
      setLoading(false);
    }
  }, [materialId, from, to, warehouseId, setSearchParams]);

  // Filters are cheap to apply and the answer is the whole page — reload as they change.
  useEffect(() => {
    void load();
  }, [load]);

  const unit = ledger?.material.unit ?? 'MTR';

  return (
    <div className="container mx-auto py-6">
      <PageHeader title="Material Ledger">
        <Button variant="outline" disabled={!ledger} onClick={() => openPDF(materialLedgerPdfPath(materialId, params))}>
          <Printer className="mr-2 h-4 w-4" />
          Print / PDF
        </Button>
      </PageHeader>
      <p className="text-muted-foreground -mt-4 mb-4">
        Every receipt and issue for one material, with a running balance.
      </p>

      <Card className="mb-6">
        <CardContent className="grid gap-4 pt-6 md:grid-cols-4">
          <div>
            <Label>Material</Label>
            <MaterialCombobox value={materialId} onValueChange={setMaterialId} placeholder="Pick a material…" />
          </div>
          <div>
            <Label>Warehouse</Label>
            <div className="flex gap-1">
              <WarehouseCombobox
                value={warehouseId}
                onValueChange={setWarehouseId}
                placeholder="All warehouses"
                className="flex-1"
              />
              {warehouseId && (
                <Button variant="ghost" size="icon" onClick={() => setWarehouseId('')} title="All warehouses">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="ml-from">From</Label>
            <Input id="ml-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ml-to">To</Label>
            <Input id="ml-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="mb-4 rounded border border-destructive/20 bg-destructive/10 px-4 py-3 text-destructive">
          {error}
        </div>
      )}

      {!materialId && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Pick a material to see where it came from and where it went.
          </CardContent>
        </Card>
      )}

      {ledger && (
        <>
          <Card className="mb-6">
            <CardContent className="flex flex-wrap items-center justify-between gap-6 pt-6">
              <div>
                <div className="text-lg font-semibold">
                  {ledger.material.code} · {ledger.material.name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatMaterialType(ledger.material.materialType)} · measured in {unitShort(ledger.material.unit)}
                  {ledger.filters.warehouseName && <> · {ledger.filters.warehouseName}</>}
                </div>
              </div>
              <div className="flex flex-wrap gap-6">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Ledger closing</div>
                  <div className="text-xl font-semibold">
                    {formatQuantity(ledger.onHand.ledgerClosingAllTime, unit)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Stock records</div>
                  <div className="text-xl font-semibold">
                    {ledger.onHand.stockLevels != null ? formatQuantity(ledger.onHand.stockLevels, unit) : '—'}
                  </div>
                </div>
                {ledger.onHand.lotsAvailable != null && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Lots available</div>
                    <div className="text-xl font-semibold">{formatQuantity(ledger.onHand.lotsAvailable, unit)}</div>
                    {ledger.onHand.lotsReserved ? (
                      <div className="text-xs text-muted-foreground">
                        {formatQuantity(ledger.onHand.lotsReserved, unit)} reserved
                      </div>
                    ) : null}
                  </div>
                )}
                <div className="self-center">
                  {ledger.onHand.drift ? (
                    <Badge variant="destructive">Books and shelf disagree</Badge>
                  ) : (
                    <Badge variant="outline" className="border-green-600 text-green-700">
                      Matches stock
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {ledger.warnings.length > 0 && (
            <Card className="mb-6 border-amber-300">
              <CardContent className="pt-6">
                <div className="mb-2 flex items-center gap-2 font-medium text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  Worth checking
                </div>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {ledger.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead>Party / Destination</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead className="text-right">In</TableHead>
                    <TableHead className="text-right">Out</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.opening != null && (
                    <TableRow className="bg-muted/40">
                      <TableCell colSpan={7} className="font-medium">
                        Opening balance
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatQuantity(ledger.opening, unit)}</TableCell>
                    </TableRow>
                  )}
                  {ledger.rows.map((row) => (
                    <Row key={row.id} row={row} unit={unit} />
                  ))}
                  {ledger.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                        {loading ? 'Loading…' : 'No movements for this material in this period.'}
                      </TableCell>
                    </TableRow>
                  )}
                  {ledger.rows.length > 0 && (
                    <TableRow className="border-t-2 font-semibold">
                      <TableCell colSpan={5}>Total for the period</TableCell>
                      <TableCell className="text-right">{formatQuantity(ledger.totals.in, unit)}</TableCell>
                      <TableCell className="text-right">{formatQuantity(ledger.totals.out, unit)}</TableCell>
                      <TableCell className="text-right">{formatQuantity(ledger.totals.closing, unit)}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {ledger.rows.length > 0 && (
                <div className="mt-3 text-xs text-muted-foreground">Showing {ledger.rows.length} movements</div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
