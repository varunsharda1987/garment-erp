/**
 * Test Requirement Forms — list.
 *
 * Every TRF ever raised, newest first, with the print button. Printing from here rather than
 * only from the form matters: the common action is reprinting a sheet that was lost or needs
 * to go with a second sample, not editing one.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Plus, Printer, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Pagination from '@/components/Pagination';
import SearchInput from '@/components/SearchInput';
import { FilterBar } from '@/components/filters';
import { CustomerCombobox } from '@/components/CustomerCombobox';
import { StyleCombobox } from '@/components/StyleCombobox';
import { buyerTrfService } from '@/services/buyerTrf.service';
import { openPDF } from '@/lib/document-utils';
import { handleApiError } from '@/lib/api-error-handler';
import type { BuyerTrf, TrfSampleStage, TrfStatus } from '@/types/buyerTrf.types';

const STATUS_VARIANT: Record<TrfStatus, 'default' | 'secondary' | 'outline'> = {
  DRAFT: 'outline',
  ISSUED: 'secondary',
  SENT_TO_LAB: 'default',
  CLOSED: 'secondary',
};

const STATUS_LABEL: Record<TrfStatus, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  SENT_TO_LAB: 'Sent to lab',
  CLOSED: 'Closed',
};

const STAGE_LABEL: Record<TrfSampleStage, string> = {
  PP: 'PP',
  SHIPMENT: 'Shipment',
};

export default function BuyerTrfList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TrfStatus | 'all'>('all');
  const [stageFilter, setStageFilter] = useState<TrfSampleStage | 'all'>('all');
  const [customerFilter, setCustomerFilter] = useState('');
  const [styleFilter, setStyleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['buyer-trfs', { page, pageSize, search, statusFilter, stageFilter, customerFilter, styleFilter }],
    queryFn: () =>
      buyerTrfService.getAll({
        page,
        limit: pageSize,
        search: search || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        sampleStage: stageFilter !== 'all' ? stageFilter : undefined,
        customerId: customerFilter || undefined,
        styleId: styleFilter || undefined,
      }),
  });

  // Every filter change goes back to page 1
  const changeFilter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPage(1);
    };

  const activeFilterCount = [search, statusFilter !== 'all', stageFilter !== 'all', customerFilter, styleFilter].filter(
    Boolean
  ).length;

  // Clears every filter; page size stays as chosen
  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setStageFilter('all');
    setCustomerFilter('');
    setStyleFilter('');
    setPage(1);
  };

  const handlePrint = async (trf: BuyerTrf) => {
    setPrintingId(trf.id);
    try {
      await openPDF(`/documents/buyer-trfs/${trf.id}/pdf`);
    } catch (error) {
      handleApiError(error, 'Could not open the form');
    } finally {
      setPrintingId(null);
    }
  };

  const rows = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <FileText className="h-6 w-6" />
            Test Requirement Forms
          </h1>
          <p className="text-sm text-muted-foreground">
            The sheet that goes to the lab with a garment sample. Raise one, print it, keep the record.
          </p>
        </div>
        <Button onClick={() => navigate('/test-requirement-forms/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New TRF
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All forms</CardTitle>
          <CardDescription>
            Search by TRF number, style, buyer, buyer order number, sale or work order, or colour.
          </CardDescription>
          <FilterBar
            className="mt-2"
            onClear={clearFilters}
            hasActiveFilters={activeFilterCount > 0}
            clearText={`Clear ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
          >
            <SearchInput
              className="flex-1 min-w-[240px]"
              placeholder="Search TRF number, style, buyer's code, buyer, order number, SO / WO, colour…"
              value={search}
              onChange={changeFilter(setSearch)}
              aria-label="Search forms"
            />
            <Select
              value={statusFilter}
              onValueChange={changeFilter((v: string) => setStatusFilter(v as TrfStatus | 'all'))}
            >
              <SelectTrigger className="w-[160px]" aria-label="Status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(Object.keys(STATUS_LABEL) as TrfStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={stageFilter}
              onValueChange={changeFilter((v: string) => setStageFilter(v as TrfSampleStage | 'all'))}
            >
              <SelectTrigger className="w-[150px]" aria-label="Stage">
                <SelectValue placeholder="All stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {(Object.keys(STAGE_LABEL) as TrfSampleStage[]).map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {STAGE_LABEL[stage]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <CustomerCombobox
              value={customerFilter}
              onValueChange={changeFilter(setCustomerFilter)}
              placeholder="All buyers"
              allowAll
              allLabel="All buyers"
              className="w-[220px]"
            />
            {/* Any status: a form outlives its style being archived */}
            <StyleCombobox
              value={styleFilter}
              onValueChange={changeFilter(setStyleFilter)}
              status={null}
              allowAll
              allLabel="All styles"
              placeholder="All styles"
              className="w-[220px]"
            />
          </FilterBar>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {activeFilterCount > 0 ? (
                <div className="flex flex-col items-center gap-3">
                  <p>No forms match these filters.</p>
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    <X className="mr-1 h-4 w-4" />
                    Clear filters
                  </Button>
                </div>
              ) : (
                'No test requirement forms yet.'
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>TRF No.</TableHead>
                  <TableHead>Style</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Order No.</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Linked to</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((trf) => (
                  <TableRow
                    key={trf.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/test-requirement-forms/${trf.id}`)}
                  >
                    <TableCell className="font-mono font-medium">{trf.trfNumber}</TableCell>
                    <TableCell>
                      <div className="font-medium">{trf.styleNo ?? trf.style?.styleCode ?? '—'}</div>
                      {trf.style?.styleName && (
                        <div className="text-xs text-muted-foreground">{trf.style.styleName}</div>
                      )}
                    </TableCell>
                    <TableCell>{trf.customer?.name ?? '—'}</TableCell>
                    <TableCell className="font-mono text-sm">{trf.orderNumber ?? '—'}</TableCell>
                    <TableCell>{STAGE_LABEL[trf.sampleStage] ?? trf.sampleStage}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {trf.saleOrder
                        ? `SO ${trf.saleOrder.saleOrderNumber}`
                        : trf.workOrder
                          ? `WO ${trf.workOrder.workOrderNumber}`
                          : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[trf.status]}>{STATUS_LABEL[trf.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={printingId === trf.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handlePrint(trf);
                        }}
                      >
                        {printingId === trf.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Printer className="mr-2 h-4 w-4" />
                        )}
                        Print
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {pagination && (
            <Pagination
              currentPage={page}
              totalPages={pagination.totalPages}
              pageSize={pageSize}
              totalItems={pagination.total}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              pageSizeOptions={[20, 50, 100]}
              itemLabel="forms"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
