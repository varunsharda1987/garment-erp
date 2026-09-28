import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllGRNs } from '@/services/grn.service';
import type { GRN, GRNItem, GRNStatus } from '@/types/grn.types';
import { GRNStatusLabels } from '@/types/grn.types';
import { MaterialTypeLabels, type MaterialType } from '@/types/material.types';
import { unitPer } from '@/lib/units';
import SearchInput from '@/components/SearchInput';
import { FilterBar, DateRangeFilter, type DateRangeValue } from '@/components/filters';
import DataTable from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { SupplierCombobox } from '@/components/SupplierCombobox';
import { handleApiError } from '@/lib/api-error-handler';
import { PackageOpen, Eye } from 'lucide-react';
import { formatDate } from '@/lib/date';
import { isInvoiceToFollow } from '@/lib/receipt-invoice';
import { formatCurrency } from '@/lib/currency';
import { formatQuantity } from '@/lib/formatters';
import { foldActual, hasFold } from '@/lib/fold-length';

type Column<T> = {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

type Unit = GRNItem['unit'];

/**
 * Quantity summed per unit, so a mixed-unit receipt reads "120 m · 50 pcs". ACTUAL metres by default —
 * a line counted at fold L is converted — or the counted figures as the supplier's paper has them.
 */
function sumByUnit(
  items: GRNItem[],
  field: 'receivedQuantity' | 'acceptedQuantity',
  basis: 'actual' | 'counted' = 'actual'
): string {
  const totals = new Map<Unit, number>();
  for (const item of items) {
    const qty = basis === 'actual' ? foldActual(item[field], item.foldLengthCm) : Number(item[field] ?? 0);
    totals.set(item.unit, (totals.get(item.unit) ?? 0) + qty);
  }
  return [...totals].map(([unit, qty]) => formatQuantity(qty, unit, 3)).join(' · ');
}

/** "Dyeing charge" — a job-work return is priced at what the processor bills, not the fabric's stock cost. */
function processChargeLabel(jwo: NonNullable<GRN['jobWorkOrder']>): string {
  const name =
    jwo.processTypeMaster?.name ??
    (jwo.processType ? jwo.processType.charAt(0) + jwo.processType.slice(1).toLowerCase().replace(/_/g, ' ') : 'Job');
  return `${name} charge`;
}

export default function GRNList() {
  const navigate = useNavigate();
  const [grns, setGRNs] = useState<GRN[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: '', to: '' });

  // Every filter change goes back to page 1 (set together, so the old page is never fetched with the new filter)
  const changeFilter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setCurrentPage(1);
    };

  const activeFilterCount = [
    searchQuery,
    supplierFilter,
    statusFilter !== 'all',
    dateRange.from || dateRange.to,
  ].filter(Boolean).length;
  const clearFilters = () => {
    setSearchQuery('');
    setSupplierFilter('');
    setStatusFilter('all');
    setDateRange({ from: '', to: '' });
    setCurrentPage(1);
  };

  useEffect(() => {
    fetchGRNs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, searchQuery, supplierFilter, statusFilter, dateRange]);

  const fetchGRNs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getAllGRNs({
        page: currentPage,
        limit: pageSize,
        search: searchQuery || undefined,
        supplierId: supplierFilter || undefined,
        status: statusFilter !== 'all' ? (statusFilter as GRNStatus) : undefined,
        startDate: dateRange.from || undefined,
        endDate: dateRange.to || undefined,
      });
      setGRNs(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err: unknown) {
      const errorMessage = handleApiError(err, 'Failed to load GRNs', false);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusVariant = (status: GRNStatus) => {
    switch (status) {
      case 'PENDING_QC':
        return 'warning';
      case 'ACCEPTED':
        return 'success';
      case 'REJECTED':
        return 'destructive';
      case 'PARTIALLY_ACCEPTED':
        return 'warning';
      default:
        return 'secondary';
    }
  };

  const columns: Column<GRN>[] = [
    {
      key: 'grnNumber',
      header: 'GRN Number',
      render: (grn) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/procurement/grn/${grn.id}`);
          }}
          className="text-sm font-medium text-info hover:underline"
        >
          {grn.grnNumber}
        </button>
      ),
    },
    {
      key: 'inwardDate',
      header: 'Inward Date',
      render: (grn) => <div className="text-sm text-foreground">{formatDate(grn.receivingDate)}</div>,
    },
    {
      key: 'poNumber',
      header: 'PO / JWO',
      render: (grn) =>
        grn.poId ? (
          <div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/procurement/purchase-orders/${grn.poId}`);
              }}
              className="text-sm text-info hover:underline"
            >
              {grn.purchaseOrders?.poNumber || '-'}
            </button>
            <div className="text-xs text-muted-foreground">PO date {formatDate(grn.purchaseOrders?.poDate)}</div>
          </div>
        ) : grn.jobWorkOrder ? (
          <div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/job-work-orders/${grn.jobWorkOrder!.id}`);
                }}
                className="text-sm text-info hover:underline"
              >
                {grn.jobWorkOrder.jobWorkNumber}
              </button>
              {/* The print already calls these "Job work return" — the list should say the same. */}
              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
                Job work return
              </span>
            </div>
            {/* A JWO's date is the day it went to the processor — the JWO list's "Sent Date". */}
            <div className="text-xs text-muted-foreground">Sent {formatDate(grn.jobWorkOrder.sentDate)}</div>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      render: (grn) => (
        <div>
          <div className="text-sm font-medium text-foreground">{grn.supplier?.name || 'N/A'}</div>
          <div className="text-xs text-muted-foreground">{grn.supplier?.code}</div>
        </div>
      ),
    },
    {
      key: 'material',
      header: 'Material',
      render: (grn) => {
        const items = grn.items ?? [];
        const first = items[0];
        if (!first) return <span className="text-sm text-muted-foreground">-</span>;
        const type = first.materials?.materialType as MaterialType | undefined;
        return (
          <div className="max-w-[280px] space-y-1">
            {type && <StatusBadge status={MaterialTypeLabels[type] ?? type} variant="info" />}
            <div className="text-sm text-foreground line-clamp-2" title={first.materials?.name}>
              {first.materials?.name || '-'}
            </div>
            {items.length > 1 && <div className="text-xs text-muted-foreground">+{items.length - 1} more</div>}
          </div>
        );
      },
    },
    {
      // The supplier's / processor's own figure — what their bill and than tags say.
      key: 'qty',
      header: 'Qty (counted)',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (grn) => {
        const items = grn.items ?? [];
        if (items.length === 0) return <span className="text-sm text-muted-foreground">-</span>;
        const received = sumByUnit(items, 'receivedQuantity', 'counted');
        const accepted = sumByUnit(items, 'acceptedQuantity', 'counted');
        return (
          <div className="whitespace-nowrap">
            <div className="text-sm text-foreground">{received}</div>
            {/* Value is on the accepted qty — say so when it differs from what arrived. */}
            {accepted !== received && <div className="text-xs text-muted-foreground">accepted {accepted}</div>}
          </div>
        );
      },
    },
    {
      // Counted × L/100 — the metres stock, the PO and the value run on. Only where an L applies.
      key: 'actualQty',
      header: 'Actual (after L)',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (grn) => {
        const items = grn.items ?? [];
        const folds = [...new Set(items.filter((i) => hasFold(i.foldLengthCm)).map((i) => Number(i.foldLengthCm)))];
        if (folds.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
        const received = sumByUnit(items, 'receivedQuantity');
        const accepted = sumByUnit(items, 'acceptedQuantity');
        return (
          <div className="whitespace-nowrap">
            <div className="text-sm font-medium text-info">{received}</div>
            <div className="text-xs text-muted-foreground">@ L={folds.join('/')}</div>
            {accepted !== received && <div className="text-xs text-muted-foreground">accepted {accepted}</div>}
          </div>
        );
      },
    },
    {
      key: 'rate',
      header: 'Rate',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (grn) => {
        const items = grn.items ?? [];
        const jwo = !grn.poId ? grn.jobWorkOrder : null;
        const first = items[0];
        const varies = new Set(items.map((i) => `${i.rate ?? ''}|${i.unit}`)).size > 1;
        return (
          <div className="whitespace-nowrap">
            {!first || first.rate == null ? (
              <span className="text-sm text-muted-foreground">—</span>
            ) : varies ? (
              <span className="text-sm text-muted-foreground">Varies</span>
            ) : (
              <span className="text-sm text-foreground">
                {formatCurrency(first.rate)} / {unitPer(first.unit)}
              </span>
            )}
            {jwo && (
              <div className="text-xs text-muted-foreground">
                {first?.rate == null ? 'kaaj + button' : processChargeLabel(jwo)}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'value',
      header: 'Value',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (grn) =>
        grn.totalValue != null ? (
          <div className="text-sm font-medium text-foreground whitespace-nowrap">{formatCurrency(grn.totalValue)}</div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (grn) => <div className="text-sm text-foreground">{grn.warehouse?.warehouseName || '-'}</div>,
    },
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      render: (grn) =>
        grn.invoiceNumber ? (
          <div className="text-sm text-foreground">
            {grn.invoiceNumber}
            {grn.invoiceDate && <div className="text-xs text-muted-foreground">{formatDate(grn.invoiceDate)}</div>}
          </div>
        ) : isInvoiceToFollow(grn) ? (
          <div className="text-sm text-amber-700" title="Received without the bill — add it on the GRN">
            To follow
          </div>
        ) : (
          <div className="text-sm text-foreground">-</div>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (grn) => <StatusBadge status={GRNStatusLabels[grn.status]} variant={getStatusVariant(grn.status)} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (grn) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/procurement/grn/${grn.id}`);
            }}
            title="View"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <PackageOpen className="h-5 w-5" />
            Goods Receiving Notes
          </CardTitle>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/procurement/grn/new')}>+ Create GRN</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <FilterBar
          className="mb-6"
          onClear={clearFilters}
          hasActiveFilters={activeFilterCount > 0}
          clearText={`Clear ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
        >
          <SearchInput
            className="flex-1 min-w-[240px]"
            placeholder="Search GRN, PO or JWO number, invoice, material, supplier, style or warehouse..."
            value={searchQuery}
            onChange={changeFilter(setSearchQuery)}
            // The API refuses a longer search (grnQuerySchema: max 100)
            maxLength={100}
          />

          <SupplierCombobox
            value={supplierFilter}
            onValueChange={changeFilter(setSupplierFilter)}
            placeholder="All suppliers"
            allowAll
            allLabel="All suppliers"
            className="w-[220px]"
          />

          <Select value={statusFilter} onValueChange={changeFilter(setStatusFilter)}>
            <SelectTrigger className="w-[180px]" aria-label="Status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(GRNStatusLabels) as GRNStatus[]).map((status) => (
                <SelectItem key={status} value={status}>
                  {GRNStatusLabels[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DateRangeFilter
            label="Inward date"
            from={dateRange.from}
            to={dateRange.to}
            onChange={changeFilter(setDateRange)}
          />
        </FilterBar>

        {/* DataTable */}
        <DataTable
          data={grns}
          columns={columns}
          keyExtractor={(grn) => grn.id}
          loading={isLoading}
          error={error}
          emptyState={
            activeFilterCount > 0
              ? {
                  icon: <PackageOpen className="h-16 w-16" />,
                  title: 'No GRNs match these filters.',
                  actionLabel: 'Clear filters',
                  onAction: clearFilters,
                }
              : {
                  icon: <PackageOpen className="h-16 w-16" />,
                  title: 'No GRNs found',
                  description: 'Create a GRN when receiving goods against a purchase order',
                  actionLabel: 'Create GRN',
                  onAction: () => navigate('/procurement/grn/new'),
                }
          }
          pagination={{
            currentPage,
            totalPages,
            pageSize,
            totalItems,
            onPageChange: setCurrentPage,
            onPageSizeChange: (size) => {
              setPageSize(size);
              setCurrentPage(1);
            },
          }}
          onRowClick={(grn) => navigate(`/procurement/grn/${grn.id}`)}
        />
      </CardContent>
    </Card>
  );
}
