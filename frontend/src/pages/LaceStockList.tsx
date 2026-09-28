/**
 * Lace Stock List Page
 * Display and manage lace stock inventory with FIFO aging
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import Pagination from '../components/Pagination';
import SearchInput from '../components/SearchInput';
import { FilterBar } from '../components/filters';
import { StyleCombobox } from '../components/StyleCombobox';
import { laceStockService } from '../services/laceStock.service';
import type {
  LaceStock,
  LaceStockStatus,
  LaceStockType,
  LaceQualityGrade,
  LaceStockListFilters,
} from '../types/laceStock.types';
import {
  LACE_STOCK_STATUS_COLORS,
  LACE_STOCK_STATUS_LABELS,
  LACE_QUALITY_GRADE_COLORS,
  LACE_STOCK_TYPE_LABELS,
  AGING_BUCKET_COLORS,
} from '../types/laceStock.types';
import { notify } from '../lib/notify';
import { formatStyleCodeWithRef } from '../utils/style-ref-format';
import { RefreshCw, Eye, ArrowRightLeft, Package, AlertTriangle, Clock, TrendingDown } from 'lucide-react';

export default function LaceStockList() {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState<LaceStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0, // backend key is totalPages (bug-hunt orders-13)
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState<LaceStockStatus | ''>('');
  const [stockTypeFilter, setStockTypeFilter] = useState<LaceStockType | ''>('');
  const [qualityFilter, setQualityFilter] = useState<LaceQualityGrade | ''>('');
  const [styleFilter, setStyleFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Every filter change goes back to page 1 (set together, so the old page is never fetched with the new filter)
  const changeFilter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPagination((prev) => ({ ...prev, page: 1 }));
    };

  const activeFilterCount = [searchTerm, statusFilter, stockTypeFilter, qualityFilter, styleFilter].filter(
    Boolean
  ).length;
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setStockTypeFilter('');
    setQualityFilter('');
    setStyleFilter('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Summary statistics
  const [summary, setSummary] = useState({
    totalAvailable: 0,
    totalReserved: 0,
    totalValue: 0,
    agingAlert: 0,
  });

  const fetchStocks = async () => {
    setLoading(true);
    try {
      const filters: LaceStockListFilters = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (statusFilter) filters.status = statusFilter;
      if (stockTypeFilter) filters.stockType = stockTypeFilter;
      if (qualityFilter) filters.qualityGrade = qualityFilter;
      if (styleFilter) filters.originStyleId = styleFilter;
      if (searchTerm) filters.search = searchTerm;

      const response = await laceStockService.getAllLaceStock(filters);
      setStocks(response.data);
      setPagination(response.pagination);

      // Calculate summary
      let available = 0;
      let reserved = 0;
      let value = 0;
      let aging = 0;

      response.data.forEach((stock) => {
        available += stock.quantityAvailable;
        reserved += stock.quantityReserved;
        value += stock.quantityAvailable * stock.weightedAvgCost;
        if (stock.agingDays > 60) aging++;
      });

      setSummary({
        totalAvailable: available,
        totalReserved: reserved,
        totalValue: value,
        agingAlert: aging,
      });
    } catch (error) {
      console.error('Failed to fetch lace stock:', error);
      notify.error('Failed to load lace stock');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.limit, searchTerm, statusFilter, stockTypeFilter, qualityFilter, styleFilter]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const getAgingBucket = (days: number): string => {
    if (days <= 30) return '0-30';
    if (days <= 60) return '31-60';
    if (days <= 90) return '61-90';
    return '90+';
  };

  const getDisplayName = (stock: LaceStock): string => {
    const parts = [
      stock.laceMaster?.laceCode || 'Unknown',
      stock.laceMaster?.color || '',
      stock.originStyleCode ? `-${formatStyleCodeWithRef(stock.originStyleCode, stock.originBuyerStyleRef)}` : '',
      stock.lotNumber ? `:${stock.lotNumber}` : '',
    ];
    return parts.filter(Boolean).join('');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-display font-medium">Lace Stock</h1>
          <p className="text-muted-foreground mt-1">
            Manage lace inventory with FIFO tracking and cross-style allocation
          </p>
        </div>
        <Button onClick={() => navigate('/lace-stock/aging')}>
          <Clock className="h-4 w-4 mr-2" />
          Aging Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-success">{summary.totalAvailable.toLocaleString()}m</div>
                <div className="text-sm text-muted-foreground">Available Stock</div>
              </div>
              <Package className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-info">{summary.totalReserved.toLocaleString()}m</div>
                <div className="text-sm text-muted-foreground">Reserved Stock</div>
              </div>
              <ArrowRightLeft className="h-8 w-8 text-info" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{formatCurrency(summary.totalValue)}</div>
                <div className="text-sm text-muted-foreground">Total Value</div>
              </div>
              <TrendingDown className="h-8 w-8 text-gray-200" />
            </div>
          </CardContent>
        </Card>

        <Card className={summary.agingAlert > 0 ? 'border-warning/25 bg-warning-muted' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-2xl font-bold ${summary.agingAlert > 0 ? 'text-warning' : ''}`}>
                  {summary.agingAlert}
                </div>
                <div className="text-sm text-muted-foreground">Aging Alert (&gt;60d)</div>
              </div>
              <AlertTriangle className={`h-8 w-8 ${summary.agingAlert > 0 ? 'text-warning' : 'text-gray-200'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <FilterBar
        className="mb-6"
        onClear={clearFilters}
        hasActiveFilters={activeFilterCount > 0}
        clearText={`Clear ${activeFilterCount} ${activeFilterCount === 1 ? 'filter' : 'filters'}`}
      >
        <SearchInput
          className="flex-1 min-w-[200px] max-w-md"
          placeholder="Search lace, color, lot or dye lot, style or buyer ref..."
          value={searchTerm}
          onChange={changeFilter(setSearchTerm)}
          // The API refuses a longer search (laceStockQuerySchema: max 100)
          maxLength={100}
        />

        <Select
          value={statusFilter || '__all__'}
          onValueChange={(value) =>
            changeFilter(setStatusFilter)(value === '__all__' ? '' : (value as LaceStockStatus))
          }
        >
          <SelectTrigger className="w-[160px]" aria-label="Status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {Object.entries(LACE_STOCK_STATUS_LABELS).map(([status, label]) => (
              <SelectItem key={status} value={status}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={stockTypeFilter || '__all__'}
          onValueChange={(value) =>
            changeFilter(setStockTypeFilter)(value === '__all__' ? '' : (value as LaceStockType))
          }
        >
          <SelectTrigger className="w-[160px]" aria-label="Stock type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            {Object.entries(LACE_STOCK_TYPE_LABELS).map(([type, label]) => (
              <SelectItem key={type} value={type}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={qualityFilter || '__all__'}
          onValueChange={(value) =>
            changeFilter(setQualityFilter)(value === '__all__' ? '' : (value as LaceQualityGrade))
          }
        >
          <SelectTrigger className="w-[140px]" aria-label="Grade">
            <SelectValue placeholder="All grades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All grades</SelectItem>
            <SelectItem value="A">Grade A</SelectItem>
            <SelectItem value="B">Grade B</SelectItem>
            <SelectItem value="DEFECT">Defect</SelectItem>
          </SelectContent>
        </Select>

        <StyleCombobox
          value={styleFilter}
          onValueChange={changeFilter(setStyleFilter)}
          status={null}
          allowAll
          allLabel="All origin styles"
          placeholder="All origin styles"
          className="w-[220px]"
        />

        <Button variant="outline" onClick={fetchStocks} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </FilterBar>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">Loading...</div>
          ) : stocks.length === 0 && activeFilterCount > 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="mb-4">No lace stock lots match these filters.</p>
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : stocks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No lace stock found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Lace / Lot
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Origin Style
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Available
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Reserved
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      WAC
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Grade
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Aging
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stocks.map((stock) => {
                    const agingBucket = getAgingBucket(stock.agingDays);
                    return (
                      <tr key={stock.id} className="hover:bg-muted">
                        <td className="px-4 py-4">
                          <div className="font-medium">{stock.laceMaster?.laceName || 'Unknown Lace'}</div>
                          <div className="text-xs text-muted-foreground font-mono">{getDisplayName(stock)}</div>
                          {stock.dyeLotNumber && (
                            <div className="text-xs text-accent">Dye Lot: {stock.dyeLotNumber}</div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {stock.originStyleCode ? (
                            <span className="font-mono text-sm">
                              {stock.originStyleCode}
                              {stock.originBuyerStyleRef && (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  ({stock.originBuyerStyleRef})
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">Generic</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="font-medium text-success">{stock.quantityAvailable.toLocaleString()}m</span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="text-info">{stock.quantityReserved.toLocaleString()}m</span>
                        </td>
                        <td className="px-4 py-4 text-right">{formatCurrency(stock.weightedAvgCost)}</td>
                        <td className="px-4 py-4 text-center">
                          <Badge className={`${LACE_STOCK_STATUS_COLORS[stock.status]} border`}>
                            {LACE_STOCK_STATUS_LABELS[stock.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Badge className={`${LACE_QUALITY_GRADE_COLORS[stock.qualityGrade]} border`}>
                            {stock.qualityGrade}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Badge className={`${AGING_BUCKET_COLORS[agingBucket]} border`}>{stock.agingDays}d</Badge>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/lace-stock/${stock.id}`)}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {stock.status === 'AVAILABLE' && stock.quantityAvailable > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/lace-stock/${stock.id}`)}
                                title="Transfer"
                              >
                                <ArrowRightLeft className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        pageSize={pagination.limit}
        totalItems={pagination.total}
        onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
        onPageSizeChange={(limit) => setPagination((prev) => ({ ...prev, page: 1, limit }))}
        pageSizeOptions={[20, 50, 100]}
        itemLabel="lots"
      />
    </div>
  );
}
