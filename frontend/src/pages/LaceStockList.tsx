/**
 * Lace Stock List Page
 * Display and manage lace stock inventory with FIFO aging
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
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
import {
  Search,
  RefreshCw,
  Eye,
  ArrowRightLeft,
  Package,
  AlertTriangle,
  Clock,
  TrendingDown,
} from 'lucide-react';

export default function LaceStockList() {
  const navigate = useNavigate();
  const [stocks, setStocks] = useState<LaceStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState<LaceStockStatus | ''>('');
  const [stockTypeFilter, setStockTypeFilter] = useState<LaceStockType | ''>('');
  const [qualityFilter, setQualityFilter] = useState<LaceQualityGrade | ''>('');
  const [searchTerm, setSearchTerm] = useState('');

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
  }, [pagination.page, statusFilter, stockTypeFilter, qualityFilter]);

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchStocks();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
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
      stock.originStyleCode ? `-${stock.originStyleCode}` : '',
      stock.lotNumber ? `:${stock.lotNumber}` : '',
    ];
    return parts.filter(Boolean).join('');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Lace Stock</h1>
          <p className="text-gray-500 mt-1">
            Manage lace inventory with FIFO tracking and cross-style allocation
          </p>
        </div>
        <Button onClick={() => navigate('/lace-stock/aging-report')}>
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
                <div className="text-2xl font-bold text-green-600">
                  {summary.totalAvailable.toLocaleString()}m
                </div>
                <div className="text-sm text-gray-500">Available Stock</div>
              </div>
              <Package className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  {summary.totalReserved.toLocaleString()}m
                </div>
                <div className="text-sm text-gray-500">Reserved Stock</div>
              </div>
              <ArrowRightLeft className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {formatCurrency(summary.totalValue)}
                </div>
                <div className="text-sm text-gray-500">Total Value</div>
              </div>
              <TrendingDown className="h-8 w-8 text-gray-200" />
            </div>
          </CardContent>
        </Card>

        <Card className={summary.agingAlert > 0 ? 'border-amber-300 bg-amber-50' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-2xl font-bold ${summary.agingAlert > 0 ? 'text-amber-600' : ''}`}>
                  {summary.agingAlert}
                </div>
                <div className="text-sm text-gray-500">Aging Alert (&gt;60d)</div>
              </div>
              <AlertTriangle className={`h-8 w-8 ${summary.agingAlert > 0 ? 'text-amber-400' : 'text-gray-200'}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by lace, lot number, style..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as LaceStockStatus | '')}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Statuses</SelectItem>
            {Object.entries(LACE_STOCK_STATUS_LABELS).map(([status, label]) => (
              <SelectItem key={status} value={status}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={stockTypeFilter}
          onValueChange={(value) => setStockTypeFilter(value as LaceStockType | '')}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Types</SelectItem>
            {Object.entries(LACE_STOCK_TYPE_LABELS).map(([type, label]) => (
              <SelectItem key={type} value={type}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={qualityFilter}
          onValueChange={(value) => setQualityFilter(value as LaceQualityGrade | '')}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Grades" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Grades</SelectItem>
            <SelectItem value="A">Grade A</SelectItem>
            <SelectItem value="B">Grade B</SelectItem>
            <SelectItem value="DEFECT">Defect</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={fetchStocks} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">Loading...</div>
          ) : stocks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No lace stock found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lace / Lot
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Origin Style
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Available
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reserved
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      WAC
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Grade
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aging
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stocks.map((stock) => {
                    const agingBucket = getAgingBucket(stock.agingDays);
                    return (
                      <tr key={stock.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div className="font-medium">
                            {stock.laceMaster?.laceName || 'Unknown Lace'}
                          </div>
                          <div className="text-xs text-gray-500 font-mono">
                            {getDisplayName(stock)}
                          </div>
                          {stock.dyeLotNumber && (
                            <div className="text-xs text-purple-600">
                              Dye Lot: {stock.dyeLotNumber}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {stock.originStyleCode ? (
                            <span className="font-mono text-sm">
                              {stock.originStyleCode}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">Generic</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="font-medium text-green-600">
                            {stock.quantityAvailable.toLocaleString()}m
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="text-blue-600">
                            {stock.quantityReserved.toLocaleString()}m
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          {formatCurrency(stock.weightedAvgCost)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Badge
                            className={`${LACE_STOCK_STATUS_COLORS[stock.status]} border`}
                          >
                            {LACE_STOCK_STATUS_LABELS[stock.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Badge
                            className={`${LACE_QUALITY_GRADE_COLORS[stock.qualityGrade]} border`}
                          >
                            {stock.qualityGrade}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <Badge className={`${AGING_BUCKET_COLORS[agingBucket]} border`}>
                            {stock.agingDays}d
                          </Badge>
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
                                onClick={() => navigate(`/lace-stock/${stock.id}/transfer`)}
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
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page === 1}
            onClick={() =>
              setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
            }
          >
            Previous
          </Button>
          <span className="px-4 py-2 text-sm text-gray-600">
            Page {pagination.page} of {pagination.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page === pagination.pages}
            onClick={() =>
              setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
            }
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
