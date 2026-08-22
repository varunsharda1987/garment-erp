import { useState, useEffect, useCallback, Fragment } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { getGenericGreigeStock } from '../services/style-stock.service';
import { greigeStockService } from '../services/greigeStock.service';
import { warehouseService } from '../services/warehouse.service';
import type { GenericGreigeStock, GreigeStockDetail, UpdateGreigeStockData } from '../types/style-stock.types';
import {
  Search,
  Package2,
  Plus,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  Download,
  Pencil,
  IndianRupee,
  AlertTriangle,
  Layers,
  Warehouse,
} from 'lucide-react';
import { logError } from '../lib/logger';
import { toast } from 'sonner';
import { getSystemSettingByKey } from '../services/system-settings.service';

const PAGE_SIZE = 25;
// BUG-GR10 fix: Default aging threshold; overridden by STOCK_AGING_THRESHOLD_DAYS system setting
const DEFAULT_AGING_THRESHOLD_DAYS = 180;

// BUG-GR10 fix: Aging threshold is now configurable via system settings
function getAgeBadge(days: number, agingThreshold: number) {
  if (days >= agingThreshold) return <Badge variant="destructive">Old ({days}d)</Badge>;
  if (days >= agingThreshold / 2)
    return (
      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
        Aging ({days}d)
      </Badge>
    );
  return (
    <Badge variant="secondary" className="bg-success-muted text-success">
      Fresh ({days}d)
    </Badge>
  );
}

function formatCurrency(value: number | null | undefined) {
  if (value == null || isNaN(value)) return '-';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export default function GreigeAvailableStock() {
  const navigate = useNavigate();
  const [greigeStock, setGreigeStock] = useState<GenericGreigeStock[]>([]);
  const [filteredStock, setFilteredStock] = useState<GenericGreigeStock[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [qualityFilter, setQualityFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [showAgedOnly, setShowAgedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; warehouseCode: string; warehouseName: string }>>([]);

  // Expandable rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedRowData, setExpandedRowData] = useState<Record<string, GreigeStockDetail[]>>({});
  const [loadingExpanded, setLoadingExpanded] = useState<Set<string>>(new Set());

  // Edit dialog
  const [editingEntry, setEditingEntry] = useState<GreigeStockDetail | null>(null);
  const [editForm, setEditForm] = useState<UpdateGreigeStockData>({});
  const [isSaving, setIsSaving] = useState(false);

  // Adjust dialog
  const [adjustingEntry, setAdjustingEntry] = useState<GreigeStockDetail | null>(null);
  const [adjustForm, setAdjustForm] = useState({
    type: 'DECREASE' as 'INCREASE' | 'DECREASE',
    quantity: '',
    reason: 'CORRECTION',
    remarks: '',
  });
  const [isAdjusting, setIsAdjusting] = useState(false);

  // BUG-GR10 fix: Configurable aging threshold from system settings
  const [agingThreshold, setAgingThreshold] = useState(DEFAULT_AGING_THRESHOLD_DAYS);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [stockData, warehouseData] = await Promise.all([
        getGenericGreigeStock(),
        warehouseService.getAll({ isActive: true }),
      ]);
      setGreigeStock(stockData);
      setWarehouses(warehouseData);

      // BUG-GR10 fix: Fetch configurable aging threshold from system settings
      try {
        const setting = await getSystemSettingByKey('STOCK_AGING_THRESHOLD_DAYS');
        if (setting?.value) {
          const threshold = parseInt(setting.value, 10);
          if (!isNaN(threshold) && threshold > 0) {
            setAgingThreshold(threshold);
          }
        }
      } catch {
        // allow-silent-catch — deliberate fallback: setting not found → use default (180 days)
      }
    } catch (err) {
      logError('Failed to load greige stock:', err);
      toast.error('Failed to load greige stock');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = useCallback(() => {
    // Only show greige with stock (totalStock > 0)
    let filtered = greigeStock.filter((s) => s.totalStock > 0);

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.greigeCode?.toLowerCase().includes(term) ||
          s.greigeName?.toLowerCase().includes(term) ||
          s.composition?.toLowerCase().includes(term)
      );
    }

    if (qualityFilter !== 'all') {
      filtered = filtered.filter((s) => s.greigeQuality === qualityFilter);
    }

    if (warehouseFilter !== 'all') {
      filtered = filtered.filter((s) => s.warehouses?.includes(warehouseFilter));
    }

    if (showAgedOnly) {
      // BUG-GR10 fix: Use configurable aging threshold
      filtered = filtered.filter((s) => s.maxAgingDays >= agingThreshold);
    }

    setFilteredStock(filtered);
    setPage(1);
  }, [greigeStock, searchTerm, qualityFilter, warehouseFilter, showAgedOnly, agingThreshold]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Derived data
  const totalPages = Math.ceil(filteredStock.length / PAGE_SIZE);
  const paginatedStock = filteredStock.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const uniqueWarehouses = [
    ...new Set([...greigeStock.flatMap((s) => s.warehouses || []), ...warehouses.map((w) => w.warehouseName)]),
  ]
    .filter(Boolean)
    .sort();

  const getTotalStock = () => filteredStock.reduce((sum, s) => sum + (s.totalStock || 0), 0);
  const getTotalValue = () => filteredStock.reduce((sum, s) => sum + (s.totalValue || 0), 0);
  // BUG-GR10 fix: Use configurable aging threshold
  const getAgedCount = () => filteredStock.filter((s) => s.maxAgingDays >= agingThreshold).length;

  // Expandable row handling
  const toggleRowExpand = async (greigeId: string) => {
    const next = new Set(expandedRows);
    if (next.has(greigeId)) {
      next.delete(greigeId);
      setExpandedRows(next);
      return;
    }
    next.add(greigeId);
    setExpandedRows(next);

    if (!expandedRowData[greigeId]) {
      setLoadingExpanded((prev) => new Set(prev).add(greigeId));
      try {
        const entries = await greigeStockService.getStockEntriesByGreige(greigeId);
        setExpandedRowData((prev) => ({ ...prev, [greigeId]: entries }));
      } catch (err) {
        logError('Failed to load stock entries:', err);
        toast.error('Failed to load stock entries');
      } finally {
        setLoadingExpanded((prev) => {
          const n = new Set(prev);
          n.delete(greigeId);
          return n;
        });
      }
    }
  };

  const refreshExpandedRow = async (greigeId: string) => {
    try {
      const entries = await greigeStockService.getStockEntriesByGreige(greigeId);
      setExpandedRowData((prev) => ({ ...prev, [greigeId]: entries }));
    } catch (err) {
      console.error('Failed to refresh stock entries:', err);
      toast.error('Failed to refresh stock entries');
    }
  };

  // Edit
  const openEdit = (entry: GreigeStockDetail) => {
    setEditingEntry(entry);
    setEditForm({
      purchaseCost: entry.purchaseCost ?? undefined,
      qualityGrade: entry.qualityGrade,
      warehouseLocation: entry.warehouseLocation ?? undefined,
      rollNumbers: entry.rollNumbers ?? undefined,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    setIsSaving(true);
    try {
      await greigeStockService.updateStock(editingEntry.id, editForm);
      toast.success('Stock entry updated');
      setEditingEntry(null);
      await refreshExpandedRow(editingEntry.greigeId);
      await loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete
  const handleAdjust = async () => {
    if (!adjustingEntry || !adjustForm.quantity) return;
    setIsAdjusting(true);
    try {
      const qty = parseFloat(adjustForm.quantity);
      if (isNaN(qty) || qty <= 0) {
        toast.error('Enter a valid quantity');
        return;
      }
      await greigeStockService.adjustStock(adjustingEntry.id, {
        adjustmentType: adjustForm.type,
        quantity: qty,
        reason: adjustForm.reason,
        remarks: adjustForm.remarks,
      });
      toast.success(`Stock ${adjustForm.type === 'INCREASE' ? 'increased' : 'decreased'} by ${qty} meters`);
      setAdjustingEntry(null);
      setAdjustForm({ type: 'DECREASE', quantity: '', reason: 'CORRECTION', remarks: '' });
      await refreshExpandedRow(adjustingEntry.greigeId);
      await loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to adjust stock');
    } finally {
      setIsAdjusting(false);
    }
  };

  // CSV Export
  const handleExport = () => {
    const headers = [
      'Greige Code',
      'Name',
      'Composition',
      'Greige Quality',
      'Weaver',
      'Width',
      'Cutable Width',
      'Total Stock',
      'Bales',
      'Thans',
      'Warehouses',
      'Avg Cost/m',
      'Total Value',
      'Max Age (days)',
      'Entry Count',
    ];
    const rows = filteredStock.map((s) => [
      s.greigeCode,
      s.greigeName,
      s.composition,
      s.greigeQuality || '',
      s.weaver || '',
      s.greigeWidth ?? '',
      s.cutableWidth ?? '',
      s.totalStock.toFixed(2),
      s.totalBales || 0,
      s.totalThans || 0,
      (s.warehouses || []).join('; '),
      s.totalStock > 0 ? (s.totalValue / s.totalStock).toFixed(2) : '',
      (s.totalValue || 0).toFixed(2),
      s.maxAgingDays,
      s.entryCount,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `greige-stock-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  return (
    <div className="mx-auto py-8 px-4 max-w-[1600px]">
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-info">
          Home
        </Link>
        {' > '}
        <Link to="/greige" className="hover:text-info">
          Greige Master
        </Link>
        {' > '}
        <span className="font-medium text-foreground">Stock View</span>
      </div>

      {/* Back Button */}
      <div className="mb-4">
        <Button variant="ghost" onClick={() => navigate('/greige')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Greige Master
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package2 className="h-6 w-6 text-info" />
                Generic Greige Stock
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Available greige fabric stock that can be allocated to any future style
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExport} disabled={filteredStock.length === 0}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <Button onClick={() => navigate('/greige-stock-entry')}>
                <Plus className="h-4 w-4 mr-1" />
                Add Greige Stock
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-info-muted rounded-lg border border-info/20">
              <div className="flex items-center gap-2 text-sm text-info font-medium">
                <Layers className="h-4 w-4" />
                Total Greige Types
              </div>
              <div className="text-2xl font-bold text-info">{filteredStock.length}</div>
            </div>
            <div className="p-4 bg-success-muted rounded-lg border border-success/20">
              <div className="flex items-center gap-2 text-sm text-success font-medium">
                <Package2 className="h-4 w-4" />
                Total Stock
              </div>
              <div className="text-2xl font-bold text-success">{getTotalStock().toFixed(2)} m</div>
            </div>
            <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
              <div className="flex items-center gap-2 text-sm text-accent font-medium">
                <IndianRupee className="h-4 w-4" />
                Total Value
              </div>
              <div className="text-2xl font-bold text-accent">{formatCurrency(getTotalValue())}</div>
            </div>
            <div className="p-4 bg-primary/10 rounded-lg border border-orange-200">
              <div className="flex items-center gap-2 text-sm text-primary font-medium">
                <AlertTriangle className="h-4 w-4" />
                {/* BUG-GR10 fix: Use configurable aging threshold */}
                Aged Stock (&gt;{agingThreshold}d)
              </div>
              <div className="text-2xl font-bold text-orange-900">{getAgedCount()}</div>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search greige code, name, composition..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={qualityFilter} onValueChange={setQualityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Qualities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Qualities</SelectItem>
                <SelectItem value="PRINTING">Printing</SelectItem>
                <SelectItem value="DYEING">Dyeing</SelectItem>
                <SelectItem value="SUPER_DYEING">Super Dyeing</SelectItem>
              </SelectContent>
            </Select>
            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Warehouses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Warehouses</SelectItem>
                {uniqueWarehouses.map((wh) => (
                  <SelectItem key={wh} value={wh}>
                    {wh}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 px-3">
              <Checkbox
                id="aged-only"
                checked={showAgedOnly}
                onCheckedChange={(checked) => setShowAgedOnly(checked === true)}
              />
              <label htmlFor="aged-only" className="text-sm cursor-pointer">
                {/* BUG-GR10 fix: Use configurable aging threshold */}
                Show aged only (&gt;{agingThreshold}d)
              </label>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-lg">Loading greige stock...</div>
            </div>
          ) : filteredStock.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-64 text-muted-foreground">
              <Package2 className="h-16 w-16 text-gray-300 mb-4" />
              <p>No greige stock found</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/greige-stock-entry')}>
                Add First Greige Stock
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-[1400px] w-full divide-y divide-gray-200">
                  <thead className="bg-muted">
                    <tr>
                      <th className="w-10 px-2 py-3"></th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Greige Code
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Composition
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                        Greige Quality
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Weaver
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                        Width
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                        Total Stock
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                        Bales
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                        Thans
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                        Warehouse
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                        Total Value
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Age</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                        Avg Cost/m
                      </th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase">
                        Entries
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-gray-200">
                    {paginatedStock.map((stock) => (
                      <Fragment key={stock.greigeId}>
                        {/* Aggregated row */}
                        <tr className="hover:bg-muted cursor-pointer" onClick={() => toggleRowExpand(stock.greigeId)}>
                          <td className="px-2 py-3 text-center">
                            {expandedRows.has(stock.greigeId) ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium">
                            <Link
                              to={`/greige/${stock.greigeId}`}
                              className="text-info hover:text-info hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {stock.greigeCode}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-foreground">{stock.greigeName}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{stock.composition}</td>
                          <td className="px-3 py-3 text-sm text-center">
                            {stock.greigeQuality ? (
                              <Badge
                                variant="outline"
                                className={
                                  stock.greigeQuality === 'SUPER_DYEING'
                                    ? 'bg-accent/10 text-accent border-accent/20'
                                    : stock.greigeQuality === 'DYEING'
                                      ? 'bg-info-muted text-info border-info/20'
                                      : 'bg-orange-100 text-orange-800 border-orange-200'
                                }
                              >
                                {stock.greigeQuality === 'SUPER_DYEING'
                                  ? 'Super Dyeing'
                                  : stock.greigeQuality === 'DYEING'
                                    ? 'Dyeing'
                                    : 'Printing'}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {stock.weaver || <span className="text-muted-foreground">-</span>}
                          </td>
                          <td className="px-3 py-3 text-sm text-center">
                            {stock.greigeWidth != null ? (
                              <div>
                                <span className="font-medium">{stock.greigeWidth}"</span>
                              </div>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            <span className="font-semibold text-success">{stock.totalStock.toFixed(2)}</span>
                          </td>
                          <td className="px-3 py-3 text-sm text-center">
                            {stock.totalBales > 0 ? (
                              <Badge variant="outline" className="bg-info-muted text-info border-info/20">
                                {stock.totalBales}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-sm text-center">
                            {stock.totalThans > 0 ? (
                              <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20">
                                {stock.totalThans}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {(stock.warehouses || []).length > 0 ? (
                              <div className="flex items-center gap-1">
                                <Warehouse className="h-3 w-3 text-muted-foreground" />
                                <span>{stock.warehouses.join(', ')}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium">
                            {formatCurrency(stock.totalValue)}
                          </td>
                          <td className="px-3 py-3 text-center">{getAgeBadge(stock.maxAgingDays, agingThreshold)}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium">
                            {stock.totalStock > 0 ? (
                              formatCurrency(stock.totalValue / stock.totalStock)
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-sm text-center">
                            <Badge variant="outline">{stock.entryCount}</Badge>
                          </td>
                        </tr>

                        {/* Expanded sub-table */}
                        {expandedRows.has(stock.greigeId) && (
                          <tr key={`${stock.greigeId}-expanded`}>
                            <td colSpan={15} className="px-0 py-0">
                              <div className="bg-muted border-t border-b border-border px-8 py-4">
                                {loadingExpanded.has(stock.greigeId) ? (
                                  <div className="text-center py-4 text-muted-foreground">Loading entries...</div>
                                ) : (expandedRowData[stock.greigeId] || []).length === 0 ? (
                                  <div className="text-center py-4 text-muted-foreground">
                                    No individual entries found
                                  </div>
                                ) : (
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-xs text-muted-foreground uppercase border-b">
                                        <th className="px-3 py-2 text-right">Qty Avail</th>
                                        <th className="px-3 py-2 text-right">Qty Reserved</th>
                                        <th className="px-3 py-2 text-center">Width</th>
                                        <th className="px-3 py-2 text-right">Cost/m</th>
                                        <th className="px-3 py-2 text-left">Warehouse</th>
                                        <th className="px-3 py-2 text-left">Roll Numbers</th>
                                        <th className="px-3 py-2 text-left">Received</th>
                                        <th className="px-3 py-2 text-left">Invoice#</th>
                                        <th className="px-3 py-2 text-center">Age</th>
                                        <th className="px-3 py-2 text-center">Status</th>
                                        <th className="px-3 py-2 text-left">Supplier</th>
                                        <th className="px-3 py-2 text-left">At Processor</th>
                                        <th className="px-3 py-2 text-left">Challan #</th>
                                        <th className="px-3 py-2 text-center">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                      {(expandedRowData[stock.greigeId] || []).map((entry) => (
                                        <tr key={entry.id} className="hover:bg-card">
                                          <td className="px-3 py-2 text-right font-medium text-success">
                                            {entry.quantityAvailable.toFixed(2)}
                                          </td>
                                          <td className="px-3 py-2 text-right text-primary">
                                            {entry.quantityReserved > 0 ? entry.quantityReserved.toFixed(2) : '-'}
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            {entry.greigeWidth}"
                                            {entry.cutableWidth != null && (
                                              <span className="text-xs text-muted-foreground ml-1">
                                                ({entry.cutableWidth}")
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-right">
                                            {entry.purchaseCost != null ? formatCurrency(entry.purchaseCost) : '-'}
                                          </td>
                                          <td className="px-3 py-2 text-muted-foreground">
                                            {entry.warehouseLocation || '-'}
                                          </td>
                                          <td
                                            className="px-3 py-2 text-muted-foreground max-w-[150px] truncate"
                                            title={entry.rollNumbers || ''}
                                          >
                                            {entry.rollNumbers || '-'}
                                          </td>
                                          <td className="px-3 py-2 text-muted-foreground">
                                            {entry.receivedDate
                                              ? new Date(entry.receivedDate).toLocaleDateString('en-IN')
                                              : '-'}
                                          </td>
                                          <td className="px-3 py-2 text-muted-foreground">
                                            {entry.invoiceNumber || '-'}
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            {getAgeBadge(entry.agingDays, agingThreshold)}
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <Badge variant={entry.status === 'AVAILABLE' ? 'outline' : 'secondary'}>
                                              {entry.status}
                                            </Badge>
                                          </td>
                                          <td className="px-3 py-2 text-muted-foreground text-xs">
                                            {entry.supplier?.name || '-'}
                                          </td>
                                          <td className="px-3 py-2 text-muted-foreground text-xs">
                                            {entry.processor?.name || '-'}
                                          </td>
                                          <td className="px-3 py-2 text-muted-foreground text-xs">
                                            {entry.sourceChallan?.challanNumber || '-'}
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <div className="flex gap-1 justify-center">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  openEdit(entry);
                                                }}
                                              >
                                                <Pencil className="h-3 w-3" />
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 text-primary hover:text-primary"
                                                title="Adjust Stock"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setAdjustingEntry(entry);
                                                  setAdjustForm({
                                                    type: 'DECREASE',
                                                    quantity: '',
                                                    reason: 'CORRECTION',
                                                    remarks: '',
                                                  });
                                                }}
                                              >
                                                <AlertTriangle className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 px-2">
                  <div className="text-sm text-muted-foreground">
                    Showing {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, filteredStock.length)} of{' '}
                    {filteredStock.length}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      Previous
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Greige Stock Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Purchase Cost (per meter)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.purchaseCost ?? ''}
                  onChange={(e) =>
                    setEditForm({ ...editForm, purchaseCost: e.target.value ? parseFloat(e.target.value) : undefined })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Quality Grade</Label>
                <Select
                  value={editForm.qualityGrade || 'A'}
                  onValueChange={(v) => setEditForm({ ...editForm, qualityGrade: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Grade A</SelectItem>
                    <SelectItem value="B">Grade B</SelectItem>
                    <SelectItem value="DEFECT">Defect</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Warehouse Location</Label>
              <Select
                value={editForm.warehouseLocation || '__none__'}
                onValueChange={(v) =>
                  // '__none__' is a Radix-safe sentinel for the empty "Select warehouse" option
                  // (Radix SelectItem forbids value=""); map it back to undefined so the saved value is unchanged.
                  setEditForm({ ...editForm, warehouseLocation: v === '__none__' ? undefined : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select warehouse</SelectItem>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.warehouseName}>
                      {wh.warehouseCode} - {wh.warehouseName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Roll Numbers</Label>
              <Input
                value={editForm.rollNumbers ?? ''}
                onChange={(e) => setEditForm({ ...editForm, rollNumbers: e.target.value })}
                placeholder="Comma-separated roll numbers"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEntry(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Adjustment Dialog */}
      <Dialog open={!!adjustingEntry} onOpenChange={(open) => !open && setAdjustingEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-lg text-sm">
              <span className="text-muted-foreground">Current Available:</span>
              <span className="ml-2 font-semibold text-success">
                {adjustingEntry?.quantityAvailable.toFixed(2)} meters
              </span>
            </div>
            <div className="space-y-2">
              <Label>Adjustment Type</Label>
              <Select
                value={adjustForm.type}
                onValueChange={(v) => setAdjustForm({ ...adjustForm, type: v as 'INCREASE' | 'DECREASE' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DECREASE">Decrease (Write-off / Correction)</SelectItem>
                  <SelectItem value="INCREASE">Increase (Found / Correction)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity (meters)</Label>
              <Input
                type="number"
                step="0.01"
                value={adjustForm.quantity}
                onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                placeholder="Enter adjustment quantity"
              />
              {adjustForm.type === 'DECREASE' &&
                adjustForm.quantity &&
                adjustingEntry &&
                parseFloat(adjustForm.quantity) > adjustingEntry.quantityAvailable && (
                  <p className="text-xs text-destructive">Cannot decrease more than available stock</p>
                )}
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select value={adjustForm.reason} onValueChange={(v) => setAdjustForm({ ...adjustForm, reason: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WRONG_ENTRY">Wrong Entry</SelectItem>
                  <SelectItem value="CORRECTION">Correction</SelectItem>
                  <SelectItem value="DAMAGED">Damaged</SelectItem>
                  <SelectItem value="LOST">Lost</SelectItem>
                  <SelectItem value="FOUND">Found</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Input
                value={adjustForm.remarks}
                onChange={(e) => setAdjustForm({ ...adjustForm, remarks: e.target.value })}
                placeholder="Optional notes about this adjustment"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustingEntry(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdjust}
              disabled={
                isAdjusting ||
                !adjustForm.quantity ||
                (adjustForm.type === 'DECREASE' &&
                  adjustingEntry != null &&
                  parseFloat(adjustForm.quantity || '0') > adjustingEntry.quantityAvailable)
              }
            >
              {isAdjusting ? 'Adjusting...' : 'Apply Adjustment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
