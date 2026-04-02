import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Search, Package2, Plus, ArrowLeft, Download, Tag, Pencil, Trash2, PackagePlus } from 'lucide-react';
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
  const [editingStock, setEditingStock] = useState<FabricStock | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [stockToDelete, setStockToDelete] = useState<FabricStock | null>(null);
  const [styleSelectOpen, setStyleSelectOpen] = useState(false);
  const [selectedStyleId, setSelectedStyleId] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadFabricStock();
  }, []);

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

      const response = await fetch(`${API_URL}/stock?status=AVAILABLE`, {
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
      return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Fresh</span>;
    } else if (agingDays < 180) {
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">Aging</span>;
    } else {
      return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">Old ({agingDays}d)</span>;
    }
  };

  const getQualityBadge = (grade: string) => {
    const badges = {
      A: <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">Grade A</span>,
      B: <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">Grade B</span>,
      DEFECT: <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">Defect</span>,
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
      <div className="mb-4 text-sm text-gray-600">
        <Link to="/" className="hover:text-blue-600">
          Home
        </Link>
        {' > '}
        <Link to="/fabric" className="hover:text-blue-600">
          Finished Fabric
        </Link>
        {' > '}
        <span className="font-medium text-gray-900">Stock View</span>
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
                <Package2 className="h-6 w-6 text-blue-600" />
                Finished Fabric Stock
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">View and manage available finished fabric inventory</p>
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
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="text-sm text-gray-600">Total Stock Items</div>
                <div className="text-2xl font-bold text-blue-600">{filteredStock.length}</div>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-4">
                <div className="text-sm text-gray-600">Total Meters</div>
                <div className="text-2xl font-bold text-green-600">{getTotalMeters().toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="pt-4">
                <div className="text-sm text-gray-600">Total Value</div>
                <div className="text-2xl font-bold text-purple-600">{formatCurrency(getTotalValue())}</div>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200">
              <CardContent className="pt-4">
                <div className="text-sm text-gray-600">Aged Stock (&gt;180d)</div>
                <div className="text-2xl font-bold text-red-600">{getAgedStockCount()}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search fabric code, name, color, greige..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

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
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="showAgedOnly" className="ml-2 text-sm text-gray-700">
                  Show aged only (&gt;180d)
                </label>
              </div>
            </div>
          </div>

          {/* Stock Table */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading stock...</p>
            </div>
          ) : filteredStock.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <Package2 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No fabric stock found</p>
              <Button className="mt-4" onClick={() => navigate('/fabric-stock-entry')}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Stock Entry
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1400px]">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 whitespace-nowrap">Fabric Code</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 whitespace-nowrap">Fabric Name</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 whitespace-nowrap">Color</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 whitespace-nowrap">Construction</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 whitespace-nowrap">Greige Base</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 whitespace-nowrap">
                      Style / Component
                    </th>
                    <th className="px-3 py-3 text-right font-medium text-gray-700 whitespace-nowrap">Quantity</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-700 whitespace-nowrap">Width</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-700 whitespace-nowrap">Quality</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-700 whitespace-nowrap">Location</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-700 whitespace-nowrap">Price/Meter</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-700 whitespace-nowrap">Total Value</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-700 whitespace-nowrap">Age</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-700 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredStock.map((stock) => (
                    <tr key={stock.id} className="hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <Link
                          to={`/fabric/${stock.fabricId}`}
                          className="text-blue-600 hover:underline font-medium whitespace-nowrap"
                        >
                          {stock.fabric?.fabricCode}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <div>
                          <div className="font-medium text-gray-900">{stock.fabric?.fabricName}</div>
                          {stock.fabric?.valueAddition && (
                            <div className="text-xs text-purple-600 flex items-center gap-1 mt-1">
                              <Tag className="h-3 w-3" />+ {stock.fabric.valueAddition}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-700">{stock.fabric?.colorName || '-'}</td>
                      <td className="px-3 py-3 text-gray-700">{stock.fabric?.finishedConstruction || '-'}</td>
                      <td className="px-3 py-3">
                        {stock.fabric?.greige && (
                          <Link
                            to={`/greige/${stock.fabric.greige.greigeCode}`}
                            className="text-blue-600 hover:underline text-xs whitespace-nowrap"
                          >
                            {stock.fabric.greige.greigeCode}
                          </Link>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {stock.fabric?.styleReference ? (
                          <div className="text-xs">
                            <div className="font-medium text-gray-900">{stock.fabric.styleReference}</div>
                            {(stock.fabric.componentName || stock.fabric.componentType) && (
                              <div className="text-gray-600">
                                {stock.fabric.componentName || stock.fabric.componentType}
                              </div>
                            )}
                            {stock.fabric.patternParts && stock.fabric.patternParts.length > 0 && (
                              <div className="text-gray-500 mt-0.5">
                                {stock.fabric.patternParts.map((p) => p.name).join(', ')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">Generic</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-medium whitespace-nowrap">
                        {stock.quantityAvailable.toFixed(2)} m
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="text-gray-900">{stock.width}"</div>
                        {stock.fabric?.cutableWidth && (
                          <div className="text-xs text-gray-500 whitespace-nowrap">
                            ({stock.fabric.cutableWidth}" cut)
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">{getQualityBadge(stock.qualityGrade)}</td>
                      <td className="px-3 py-3">
                        <div className="text-gray-900">{stock.warehouseLocation || '-'}</div>
                        {stock.rackNumber && <div className="text-xs text-gray-500">{stock.rackNumber}</div>}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-gray-900 whitespace-nowrap">
                        {stock.purchaseCost ? formatCurrency(stock.purchaseCost) : '-'}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-gray-900 whitespace-nowrap">
                        {stock.purchaseCost ? formatCurrency(stock.quantityAvailable * stock.purchaseCost) : '-'}
                      </td>
                      <td className="px-3 py-3 text-center">{getAgingBadge(stock.agingDays)}</td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
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
    </div>
  );
}
