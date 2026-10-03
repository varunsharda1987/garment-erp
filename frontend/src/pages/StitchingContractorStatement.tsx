// Stitching Contractor Statement — what each stitching contractor is owed (owner, 2026-10-03).
// Per stitching issue: its GOOD pieces × the rate given to the operators, plus the contractor's commission
// (the % frozen on the issue the day it was made). Dates bound the day the pieces were recorded, so a
// week's statement is that week's stitched pieces. Every number comes from the server
// (backend stitching-rate.helper); issues made before rates were kept show "No rate".
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SupplierCombobox } from '@/components/SupplierCombobox';
import { StyleIdentity } from '@/components/StyleIdentity';
import { FilterBar, DateRangeFilter } from '@/components/filters';
import { stitchingSummaryService } from '@/services/stitching.service';
import { formatCurrency } from '@/lib/currency';
import { formatDate } from '@/lib/date';
import { BUYER_STYLE_CODE_LABEL } from '@/lib/style-code';

export default function StitchingContractorStatement() {
  const [contractorId, setContractorId] = useState('');
  const [dates, setDates] = useState({ from: '', to: '' });

  const { data, isLoading, error } = useQuery({
    queryKey: ['stitching-contractor-statement', contractorId, dates.from, dates.to],
    queryFn: () =>
      stitchingSummaryService.getContractorStatement({
        contractorId: contractorId || undefined,
        fromDate: dates.from || undefined,
        toDate: dates.to || undefined,
      }),
  });

  const activeFilters = (contractorId ? 1 : 0) + (dates.from || dates.to ? 1 : 0);
  const rows = data?.rows ?? [];
  const totals = data?.totals;

  return (
    <>
      <PageHeader title="Stitching Contractor Statement" />
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">
        What each stitching contractor is owed for the good pieces stitched: the rate to operators plus the commission.
      </p>

      <Card className="mb-4">
        <CardContent className="pt-6">
          <FilterBar
            hasActiveFilters={activeFilters > 0}
            onClear={() => {
              setContractorId('');
              setDates({ from: '', to: '' });
            }}
            clearText={`Clear ${activeFilters} filter${activeFilters === 1 ? '' : 's'}`}
          >
            <div className="w-64">
              <SupplierCombobox
                value={contractorId}
                onValueChange={setContractorId}
                categoryFilter="STITCHING_CONTRACTOR"
                allowAll
                allLabel="All contractors"
                placeholder="Contractor"
              />
            </div>
            <DateRangeFilter
              label="Pieces stitched"
              from={dates.from}
              to={dates.to}
              onChange={(value) => setDates(value)}
            />
          </FilterBar>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Could not load the statement. Try again.</AlertDescription>
        </Alert>
      )}

      {totals && (
        <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Good pieces</div>
              <div className="text-2xl font-bold text-success">{totals.goodPieces}</div>
              {totals.defectPieces > 0 && (
                <div className="text-xs text-muted-foreground">{totals.defectPieces} defect pieces not paid</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">To operators</div>
              <div className="text-2xl font-bold">{formatCurrency(totals.operatorAmount)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Commission</div>
              <div className="text-2xl font-bold">{formatCurrency(totals.commissionAmount)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Total owed</div>
              <div className="text-2xl font-bold text-info">{formatCurrency(totals.totalAmount)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {totals && totals.unpricedGoodPieces > 0 && (
        <Alert className="mb-4">
          <AlertDescription>
            {totals.unpricedGoodPieces} good pieces are on issues with no stitching rate (made before rates were kept)
            and are not in the amounts. Open the issue and use Edit to enter its rate.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {dates.from || dates.to
                ? 'No pieces were recorded stitched in these dates.'
                : 'No stitching issues for this contractor yet.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Issue</TableHead>
                    <TableHead>Contractor</TableHead>
                    <TableHead>{BUYER_STYLE_CODE_LABEL}</TableHead>
                    <TableHead className="text-right">Issued</TableHead>
                    <TableHead className="text-right">Good</TableHead>
                    <TableHead className="text-right">Rate / pc</TableHead>
                    <TableHead className="text-right">With commission</TableHead>
                    <TableHead className="text-right">Costing / pc</TableHead>
                    <TableHead className="text-right">Operators</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead className="text-right">Owed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          to={`/manufacturing/stitching/${row.id}`}
                          className="font-medium text-info hover:underline"
                        >
                          {row.issueNumber}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(row.issueDate)} · {row.workOrder?.workOrderNumber ?? '—'}
                        </div>
                      </TableCell>
                      <TableCell>{row.contractor?.name ?? '—'}</TableCell>
                      <TableCell>
                        <StyleIdentity
                          style={row.workOrder?.style}
                          name={row.workOrder?.style?.styleName}
                          layout="stacked"
                          showStyleCode={false}
                        />
                      </TableCell>
                      <TableCell className="text-right">{row.issuedPieces}</TableCell>
                      <TableCell className="text-right font-medium text-success">
                        {row.goodPieces}
                        {row.defectPieces > 0 && (
                          <div className="text-xs font-normal text-muted-foreground">{row.defectPieces} defect</div>
                        )}
                      </TableCell>
                      {row.operatorRatePerPiece == null ? (
                        <TableCell colSpan={6} className="text-right">
                          <Badge variant="outline">No rate</Badge>
                        </TableCell>
                      ) : (
                        <>
                          <TableCell className="text-right">{formatCurrency(row.operatorRatePerPiece)}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(row.totalPerPiece)}
                            <div className="text-xs text-muted-foreground">+{row.commissionPercent ?? 0}%</div>
                          </TableCell>
                          <TableCell className="text-right">
                            {row.costingRatePerPiece != null ? formatCurrency(row.costingRatePerPiece) : '—'}
                            {row.differencePerPiece != null && row.differencePerPiece !== 0 && (
                              <div
                                className={`text-xs ${row.differencePerPiece > 0 ? 'text-destructive' : 'text-success'}`}
                              >
                                {row.differencePerPiece > 0 ? '+' : '−'}
                                {formatCurrency(Math.abs(row.differencePerPiece))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(row.owed?.operatorAmount ?? 0)}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(row.owed?.commissionAmount ?? 0)}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(row.owed?.totalAmount ?? 0)}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
                {totals && (
                  <tfoot className="bg-muted">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-sm font-semibold">
                        Total
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold">{totals.issuedPieces}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-success">{totals.goodPieces}</td>
                      <td colSpan={3} />
                      <td className="px-4 py-3 text-right text-sm font-bold">
                        {formatCurrency(totals.operatorAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold">
                        {formatCurrency(totals.commissionAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-info">
                        {formatCurrency(totals.totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
