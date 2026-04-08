import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Search,
  Package2,
  Plus,
  ArrowLeft,
  Download,
  Tag,
  Pencil,
  Trash2,
  PackagePlus,
  AlertTriangle,
} from 'lucide-react';
import { Label } from '../components/ui/label';
import { DialogFooter } from '../components/ui/dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { StyleCombobox } from '../components/StyleCombobox';
import { logError } from '../lib/logger';
import { API_URL } from '../config/api.config';
import { formatCurrency } from '../lib/currency';
import { EditStockModal } from '../components/fabric/EditStockModal';
import { ConfirmDeleteDialog } from '../components/dialogs/ConfirmDeleteDialog';
import { fabricStockService } from '../services/fabricStockService';
import { toast } from 'sonner';

interface PatternPart {
  id: string;
  code: string;
  name: string;
  quantity: number;
  goesToEmbroidery: boolean;
}

interface FabricStock {
  id: string;
  fabricId: string;
  fabric?: {
    fabricCode: string;
    fabricName: string;
    colorName?: string;
    finishedConstruction?: string;
    valueAddition?: string;
    styleReference?: string;
    componentType?: string;
    componentName?: string;
    patternParts?: PatternPart[];
    actualWidth: number;
    cutableWidth?: number;
    greige?: {
      greigeCode: string;
      greigeName: string;
      composition: string;
    };
  };
  width: number;
  quantityAvailable: number;
  quantityReserved: number;
  weightedAvgCost?: number;
  unit: string;
  purchaseCost?: number;
  qualityGrade: 'A' | 'B' | 'DEFECT';
  warehouseLocation?: string;
  rackNumber?: string;
  rollNumbers?: string;
  receivedDate: string;
  agingDays?: number;
  stockType: string;
  status: string;
  needsEmbroidery?: boolean;
}

export default function FabricAvailableStock() {
  const navigate = useNavigate();
  const [fabricStock, setFabricStock] = useState<FabricStock[]>([]);
  const [filteredStock, setFilteredStock] = useState<FabricStock[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAgedOnly, setShowAgedOnly] = useState(false);
  const [qualityFilter, setQualityFilter] = useState<string>('all');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('AVAILABLE');
  const [editingStock, setEditingStock] = useState<FabricStock | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [stockToDelete, setStockToDelete] = useState<FabricStock | null>(null);
  const [styleSelectOpen, setStyleSelectOpen] = useState(false);
  const [selectedStyleId, setSelectedStyleId] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Stock adjustment state
  const [adjustingStock, setAdjustingStock] = useState<FabricStock | null>(null);
  const [adjustForm, setAdjustForm] = useState({
    type: 'DECREASE' as 'INCREASE' | 'DECREASE',
    quantity: '',
    reason: 'CORRECTION',
    remarks: '',
  });
  const [isAdjusting, setIsAdjusting] = useState(false);

  useEffect(() => {
    loadFabricStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, showAgedOnly, qualityFilter, warehouseFilter, fabricStock]);

  const loadFabricStock = async () => {
    try {
      setIsLoading(true);

      // Get token from localStorage
      const authStorage = localStorage.getItem('auth-storage');
      let token = null;
      if (authStorage) {
        try {
          const parsed = JSON.parse(authStorage);
          token = parsed.state?.token;
        } catch (e) {
          logError('Error parsing auth storage:', e);
        }
      }

      const statusParam = statusFilter === 'ALL' ? '' : `status=${statusFilter}`;
      const response = await fetch(`${API_URL}/stock${statusParam ? `?${statusParam}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to load fabric stock');
      }

      const data = await response.json();
      setFabricStock(data.data || data || []);
    } catch (err) {
      logError('Failed to load fabric stock:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...fabricStock];

    if (searchTerm) {
      filtered = filtered.filter(
        (stock) =>
          stock.fabric?.fabricCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          stock.fabric?.fabricName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          stock.fabric?.colorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          stock.fabric?.greige?.greigeCode.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (showAgedOnly) {
      filtered = filtered.filter((stock) => (stock.agingDays || 0) > 180); // 6 months
    }

    if (qualityFilter !== 'all') {
      filtered = filtered.filter((stock) => stock.qualityGrade === qualityFilter);
    }

    if (warehouseFilter !== 'all') {
      filtered = filtered.filter((stock) => stock.warehouseLocation === warehouseFilter);
    }

    setFilteredStock(filtered);
  };

  const handleAdjust = async () => {
    if (!adjustingStock || !adjustForm.quantity) return;
    setIsAdjusting(true);
    try {
      const qty = parseFloat(adjustForm.quantity);
      if (isNaN(qty) || qty <= 0) {
        toast.error('Enter a valid quantity');
        return;
      }
      await fabricStockService.adjustStock(adjustingStock.id, {
        adjustmentType: adjustForm.type,
        quantity: qty,
        reason: adjustForm.reason,
        notes: adjustForm.remarks || undefined,
      });
      toast.success(`Stock ${adjustForm.type === 'INCREASE' ? 'increased' : 'decreased'} by ${qty} meters`);
      setAdjustingStock(null);
      setAdjustForm({ type: 'DECREASE', quantity: '', reason: 'CORRECTION', remarks: '' });
      await loadFabricStock();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to adjust stock');
    } finally {
      setIsAdjusting(false);
    }
  };

  const getTotalMeters = () => {
    return filteredStock.reduce((sum, stock) => sum + stock.quantityAvailable, 0);
  };

  const getTotalValue = () => {
    return filteredStock.reduce((sum, stock) => sum + stock.quantityAvailable * (stock.purchaseCost || 0), 0);
  };

  const getAgedStockCount = () => {
    return fabricStock.filter((stock) => (stock.agingDays || 0) > 180).length;
  };

  const getAgingBadge = (agingDays: number = 0) => {
    if (agingDays < 90) {
      return <span className="px-2 py-1 bg-success-muted text-success rounded text-xs font-medium">Fresh</span>;
    } else if (agingDays < 180) {
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">Aging</span>;
    } else {
      return (
        <span className="px-2 py-1 bg-destructive/10 text-destructive rounded text-xs font-medium">
          Old ({agingDays}d)
        </span>
      );
    }
  };

  const getQualityBadge = (grade: string) => {
    const badges = {
      A: <span className="px-2 py-1 bg-info-muted text-info rounded text-xs font-medium">Grade A</span>,
      B: <span className="px-2 py-1 bg-muted text-foreground rounded text-xs font-medium">Grade B</span>,
      DEFECT: <span className="px-2 py-1 bg-destructive/10 text-destructive rounded text-xs font-medium">Defect</span>,
    };
    return badges[grade as keyof typeof badges] || grade;
  };

  const getUniqueWarehouses = () => {
    const warehouses = fabricStock
      .map((s) => s.warehouseLocation)
      .filter((w) => w)
      .filter((v, i, a) => a.indexOf(v) === i);
    return warehouses as string[];
  };

  const handleExport = () => {
    // Export to CSV
    const headers = [
      'Fabric Code',
      'Fabric Name',
      'Color',
      'Construction',
      'Value Addition',
      'Style Ref',
      'Component',
      'Pattern Parts',
      'Greige Base',
      'Quantity',
      'Width',
      'Cutable Width',
      'Quality',
      'Warehouse',
      'Rack',
      'Value',
      'Age',
      'Received',
    ];

    const rows = filteredStock.map((stock) => [
      stock.fabric?.fabricCode || '',
      stock.fabric?.fabricName || '',
      stock.fabric?.colorName || '',
      stock.fabric?.finishedConstruction || '',
      stock.fabric?.valueAddition || '',
      stock.fabric?.styleReference || '',
      stock.fabric?.componentName || stock.fabric?.componentType || '',
      stock.fabric?.patternParts?.map((p) => p.name).join('; ') || '',
      stock.fabric?.greige?.greigeCode || '',
      stock.quantityAvailable,
      `${stock.width}"`,
      stock.fabric?.cutableWidth ? `${stock.fabric.cutableWidth}"` : '',
      stock.qualityGrade,
      stock.warehouseLocation || '',
      stock.rackNumber || '',
      stock.purchaseCost ? (stock.quantityAvailable * stock.purchaseCost).toFixed(2) : '',
      stock.agingDays || 0,
      new Date(stock.receivedDate).toLocaleDateString(),
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fabric-stock-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleDeleteClick = (stock: FabricStock) => {
    setStockToDelete(stock);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!stockToDelete) return;

    setIsDeleting(true);
    try {
      await fabricStockService.deleteStock(stockToDelete.id);

      toast.success('Stock deleted successfully', {
        description: `${stockToDelete.fabric?.fabricCode} - ${stockToDelete.quantityAvailable.toFixed(2)}m deleted`,
      });

      setDeleteDialogOpen(false);
      setStockToDelete(null);
      loadFabricStock(); // Refresh the list
    } catch (error) {
      logError('Error deleting stock:', error);

      const errorMessage = error instanceof Error ? error.message : 'Failed to delete stock';
      toast.error('Failed to delete stock', {
        description: errorMessage,
        duration: 8000, // Show longer for dependency errors
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="mx-auto py-8 px-4 max-w-[1600px]">
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-info">
          Home
        </Link>
        {' > '}
        <Link to="/fabric" className="hover:text-info">
          Finished Fabric
        </Link>
        {' > '}
        <span className="font-medium text-foreground">Stock View</span>
      </div>

      {/* Back Button */}
      <div className="mb-4">
        <Button variant="ghost" onClick={() => navigate('/fabric')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Fabric Master
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package2 className="h-6 w-6 text-info" />
                Finished Fabric Stock
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                View and manage {statusFilter === 'ALL' ? 'all' : statusFilter.toLowerCase()} finished fabric inventory
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" onClick={() => setStyleSelectOpen(true)}>
                <PackagePlus className="h-4 w-4 mr-2" />
                Add Stock Against Style
              </Button>
              <Button onClick={() => navigate('/fabric-stock-entry')}>
                <Plus className="h-4 w-4 mr-2" />
                Add Stock
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-info-muted border-info/20">
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Total Stock Items</div>
                <div className="text-2xl font-bold text-info">{filteredStock.length}</div>
              </CardContent>
            </Card>
            <Card className="bg-success-muted border-success/20">
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Total Meters</div>
                <div className="text-2xl font-bold text-success">{getTotalMeters().toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className="bg-accent/10 border-accent/20">
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Total Value</div>
                <div className="text-2xl font-bold text-accent">{formatCurrency(getTotalValue())}</div>
              </CardContent>
            </Card>
            <Card className="bg-destructive/10 border-destructive/20">
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Aged Stock (&gt;180d)</div>
                <div className="text-2xl font-bold text-destructive">{getAgedStockCount()}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search fabric code, name, color, greige..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AVAILABLE">Available</SelectItem>
                  <SelectItem value="RESERVED">Reserved</SelectItem>
                  <SelectItem value="EXHAUSTED">Exhausted</SelectItem>
                  <SelectItem value="ALL">All Status</SelectItem>
                </SelectContent>
              </Select>

              <Select value={qualityFilter} onValueChange={setQualityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by quality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Qualities</SelectItem>
                  <SelectItem value="A">Grade A</SelectItem>
                  <SelectItem value="B">Grade B</SelectItem>
                  <SelectItem value="DEFECT">Defect</SelectItem>
                </SelectContent>
              </Select>

              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by warehouse" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {getUniqueWarehouses().map((warehouse) => (
                    <SelectItem key={warehouse} value={warehouse}>
                      {warehouse}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showAgedOnly"
                  checked={showAgedOnly}
                  onChange={(e) => setShowAgedOnly(e.target.checked)}
                  className="h-4 w-4 text-info focus:ring-blue-500 border-border rounded"
                />
                <label htmlFor="showAgedOnly" className="ml-2 text-sm text-foreground">
                  Show aged only (&gt;180d)
                </label>
              </div>
            </div>
          </div>

          {/* Stock Table */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-info mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading stock...</p>
            </div>
          ) : filteredStock.length === 0 ? (
            <div className="text-center py-12 bg-muted rounded-lg border-2 border-dashed border-border">
              <Package2 className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No fabric stock found</p>
              <Button className="mt-4" onClick={() => navigate('/fabric-stock-entry')}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Stock Entry
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1400px]">
                <thead className="bg-muted border-b">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium text-foreground whitespace-nowrap">Fabric Code</th>
                    <th className="px-3 py-3 text-left font-medium text-foreground whitespace-nowrap">Fabric Name</th>
                    <th className="px-3 py-3 text-left font-medium text-foreground whitespace-nowrap">Color</th>
                    <th className="px-3 py-3 text-left font-medium text-foreground whitespace-nowrap">Construction</th>
                    <th className="px-3 py-3 text-left font-medium text-foreground whitespace-nowrap">Greige Base</th>
                    <th className="px-3 py-3 text-left font-medium text-foreground whitespace-nowrap">
                      Style / Component
                    </th>
                    <th className="px-3 py-3 text-right font-medium text-foreground whitespace-nowrap">Quantity</th>
                    <th className="px-3 py-3 text-center font-medium text-foreground whitespace-nowrap">Width</th>
                    <th className="px-3 py-3 text-center font-medium text-foreground whitespace-nowrap">Quality</th>
                    <th className="px-3 py-3 text-left font-medium text-foreground whitespace-nowrap">Location</th>
                    <th className="px-3 py-3 text-right font-medium text-foreground whitespace-nowrap">Price/Meter</th>
                    <th className="px-3 py-3 text-right font-medium text-foreground whitespace-nowrap">Total Value</th>
                    <th className="px-3 py-3 text-center font-medium text-foreground whitespace-nowrap">Age</th>
                    <th className="px-3 py-3 text-center font-medium text-foreground whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredStock.map((stock) => (
                    <tr key={stock.id} className="hover:bg-muted">
                      <td className="px-3 py-3">
                        <Link
                          to={`/fabric/${stock.fabricId}`}
                          className="text-info hover:underline font-medium whitespace-nowrap"
                        >
                          {stock.fabric?.fabricCode}
                        </Link>
                        {stock.needsEmbroidery && (
                          <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/10 text-accent border border-accent/20">
                            Needs Embroidery
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div>
                          <div className="font-medium text-foreground">{stock.fabric?.fabricName}</div>
                          {stock.fabric?.valueAddition && (
                            <div className="text-xs text-accent flex items-center gap-1 mt-1">
                              <Tag className="h-3 w-3" />+ {stock.fabric.valueAddition}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-foreground">{stock.fabric?.colorName || '-'}</td>
                      <td className="px-3 py-3 text-foreground">{stock.fabric?.finishedConstruction || '-'}</td>
                      <td className="px-3 py-3">
                        {stock.fabric?.greige && (
                          <Link
                            to={`/greige/${stock.fabric.greige.greigeCode}`}
                            className="text-info hover:underline text-xs whitespace-nowrap"
                          >
                            {stock.fabric.greige.greigeCode}
                          </Link>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {stock.fabric?.styleReference ? (
                          <div className="text-xs">
                            <div className="font-medium text-foreground">{stock.fabric.styleReference}</div>
                            {(stock.fabric.componentName || stock.fabric.componentType) && (
                              <div className="text-muted-foreground">
                                {stock.fabric.componentName || stock.fabric.componentType}
                              </div>
                            )}
                            {stock.fabric.patternParts && stock.fabric.patternParts.length > 0 && (
                              <div className="text-muted-foreground mt-0.5">
                                {stock.fabric.patternParts.map((p) => p.name).join(', ')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">Generic</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-medium whitespace-nowrap">
                        {stock.quantityAvailable.toFixed(2)} m
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="text-foreground">{stock.width}"</div>
                        {stock.fabric?.cutableWidth && (
                          <div className="text-xs text-muted-foreground whitespace-nowrap">
                            ({stock.fabric.cutableWidth}" cut)
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">{getQualityBadge(stock.qualityGrade)}</td>
                      <td className="px-3 py-3">
                        <div className="text-foreground">{stock.warehouseLocation || '-'}</div>
                        {stock.rackNumber && <div className="text-xs text-muted-foreground">{stock.rackNumber}</div>}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-foreground whitespace-nowrap">
                        {stock.purchaseCost ? formatCurrency(stock.purchaseCost) : '-'}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-foreground whitespace-nowrap">
                        {stock.purchaseCost ? formatCurrency(stock.quantityAvailable * stock.purchaseCost) : '-'}
                      </td>
                      <td className="px-3 py-3 text-center">{getAgingBadge(stock.agingDays)}</td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-primary hover:text-primary"
                            title="Adjust Stock"
                            onClick={() => {
                              setAdjustingStock(stock);
                              setAdjustForm({ type: 'DECREASE', quantity: '', reason: 'CORRECTION', remarks: '' });
                            }}
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditingStock(stock)} title="Edit stock">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Stock Modal */}
      {editingStock && (
        <EditStockModal
          isOpen={!!editingStock}
          stockId={editingStock.id}
          currentData={{
            fabricCode: editingStock.fabric?.fabricCode || '',
            fabricName: editingStock.fabric?.fabricName || '',
            colorName: editingStock.fabric?.colorName,
            quantityAvailable: editingStock.quantityAvailable,
            purchaseCost: editingStock.purchaseCost || 0,
            weightedAvgCost: editingStock.weightedAvgCost || editingStock.purchaseCost || 0,
            qualityGrade: editingStock.qualityGrade,
            warehouseLocation: editingStock.warehouseLocation,
            rackNumber: editingStock.rackNumber,
            rollNumbers: editingStock.rollNumbers,
          }}
          onClose={() => setEditingStock(null)}
          onSuccess={() => {
            setEditingStock(null);
            loadFabricStock(); // Refresh the list
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {/* Style Selection Dialog */}
      <Dialog
        open={styleSelectOpen}
        onOpenChange={(open) => {
          setStyleSelectOpen(open);
          if (!open) setSelectedStyleId('');
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Style for Fabric Stock Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <StyleCombobox
              value={selectedStyleId}
              onChange={(styleId) => setSelectedStyleId(styleId)}
              placeholder="Search by style code..."
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStyleSelectOpen(false);
                  setSelectedStyleId('');
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={!selectedStyleId}
                onClick={() => {
                  navigate(`/styles/${selectedStyleId}/stock-entry`);
                  setStyleSelectOpen(false);
                }}
              >
                Continue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stock Adjustment Dialog */}
      <Dialog open={!!adjustingStock} onOpenChange={(open) => !open && setAdjustingStock(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Fabric Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Current stock display */}
            <div className="p-3 bg-muted rounded-lg text-sm">
              <div className="font-medium text-foreground">
                {adjustingStock?.fabric?.fabricCode} - {adjustingStock?.fabric?.fabricName}
                {adjustingStock?.fabric?.colorName ? ` (${adjustingStock.fabric.colorName})` : ''}
              </div>
              <div className="mt-1">
                <span className="text-muted-foreground">Current Available:</span>
                <span className="ml-2 font-semibold text-success">
                  {adjustingStock?.quantityAvailable.toFixed(2)} meters
                </span>
              </div>
            </div>

            {/* Adjustment type */}
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

            {/* Quantity */}
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
                adjustingStock &&
                parseFloat(adjustForm.quantity) > adjustingStock.quantityAvailable && (
                  <p className="text-xs text-destructive">Cannot decrease more than available stock</p>
                )}
            </div>

            {/* Reason */}
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

            {/* Remarks */}
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
            <Button variant="outline" onClick={() => setAdjustingStock(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdjust}
              disabled={
                isAdjusting ||
                !adjustForm.quantity ||
                (adjustForm.type === 'DECREASE' &&
                  adjustingStock != null &&
                  parseFloat(adjustForm.quantity || '0') > adjustingStock.quantityAvailable)
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
