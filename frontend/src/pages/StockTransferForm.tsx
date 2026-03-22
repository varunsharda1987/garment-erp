// Stock Transfer Form - Transfer between warehouses
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, X, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { ButtonSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import stockMovementService from '../services/stockMovement.service';
import warehouseService from '../services/warehouse.service';
import stockLevelService from '../services/stockLevel.service';
import { Unit } from '../types/inventory-exports';
import type { Warehouse, StockLevel } from '../types/inventory-exports';
import { logError } from '../lib/logger';

export default function StockTransferForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [availableStock, setAvailableStock] = useState<StockLevel[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockLevel | null>(null);

  const [formData, setFormData] = useState({
    materialId: '',
    fromWarehouseId: '',
    toWarehouseId: '',
    quantity: '',
    unit: '' as Unit | '',
    remarks: '',
  });

  useEffect(() => {
    loadWarehouses();
  }, []);

  useEffect(() => {
    if (formData.fromWarehouseId) {
      loadStockLevels(formData.fromWarehouseId);
    }
  }, [formData.fromWarehouseId]);

  useEffect(() => {
    if (formData.materialId && availableStock.length > 0) {
      const stock = availableStock.find((s) => s.materialId === formData.materialId);
      setSelectedStock(stock || null);
      if (stock) {
        setFormData((prev) => ({ ...prev, unit: stock.unit }));
      }
    }
  }, [formData.materialId, availableStock]);

  const loadWarehouses = async () => {
    try {
      const data = await warehouseService.getAll({ isActive: true });
      setWarehouses(data);
    } catch (err) {
      logError('Failed to load warehouses:', err);
    }
  };

  const loadStockLevels = async (warehouseId: string) => {
    try {
      const data = await stockLevelService.getByWarehouse(warehouseId);
      setAvailableStock(data.filter((s) => Number(s.quantity) > 0));
    } catch (err) {
      logError('Failed to load stock levels:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!formData.materialId || !formData.fromWarehouseId || !formData.toWarehouseId || !formData.quantity) {
      setError('Please fill in all required fields');
      return;
    }

    if (formData.fromWarehouseId === formData.toWarehouseId) {
      setError('Source and destination warehouses must be different');
      return;
    }

    if (Number(formData.quantity) <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    if (selectedStock && Number(formData.quantity) > Number(selectedStock.quantity)) {
      setError(`Insufficient stock. Available: ${selectedStock.quantity} ${selectedStock.unit}`);
      return;
    }

    try {
      setLoading(true);
      await stockMovementService.createTransfer({
        materialId: formData.materialId,
        fromWarehouseId: formData.fromWarehouseId,
        toWarehouseId: formData.toWarehouseId,
        quantity: Number(formData.quantity),
        unit: formData.unit as Unit,
        remarks: formData.remarks || undefined,
      });

      setSuccess(true);
      setTimeout(() => navigate('/inventory/movements'), 2000);
    } catch (err) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to create transfer';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string | number | boolean | null) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSwapWarehouses = () => {
    setFormData({
      ...formData,
      fromWarehouseId: formData.toWarehouseId,
      toWarehouseId: formData.fromWarehouseId,
    });
  };

  return (
    <div className="container mx-auto py-6">
      <PageHeader title="Stock Transfer" />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 bg-green-50 text-green-900 border-green-200">
          <AlertDescription>Stock transfer created successfully! Redirecting...</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* From Warehouse */}
              <div className="space-y-2 md:col-span-5">
                <Label htmlFor="fromWarehouseId">
                  From Warehouse <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.fromWarehouseId}
                  onValueChange={(value) => handleChange('fromWarehouseId', value)}
                >
                  <SelectTrigger id="fromWarehouseId">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((wh) => (
                      <SelectItem key={wh.id} value={wh.id}>
                        {wh.warehouseCode} - {wh.warehouseName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Swap Button */}
              <div className="flex items-end justify-center md:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSwapWarehouses}
                  disabled={!formData.fromWarehouseId || !formData.toWarehouseId}
                  className="w-full"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>
              </div>

              {/* To Warehouse */}
              <div className="space-y-2 md:col-span-5">
                <Label htmlFor="toWarehouseId">
                  To Warehouse <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.toWarehouseId} onValueChange={(value) => handleChange('toWarehouseId', value)}>
                  <SelectTrigger id="toWarehouseId">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((wh) => (
                      <SelectItem key={wh.id} value={wh.id} disabled={wh.id === formData.fromWarehouseId}>
                        {wh.warehouseCode} - {wh.warehouseName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Material Selection */}
              <div className="space-y-2 md:col-span-12">
                <Label htmlFor="materialId">
                  Material <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.materialId}
                  onValueChange={(value) => handleChange('materialId', value)}
                  disabled={!formData.fromWarehouseId}
                >
                  <SelectTrigger id="materialId">
                    <SelectValue placeholder="Select material" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStock.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No stock available in source warehouse
                      </SelectItem>
                    ) : (
                      availableStock.map((stock) => (
                        <SelectItem key={stock.id} value={stock.materialId}>
                          {stock.materials?.code} - {stock.materials?.name}
                          {' (Avail: '}
                          {Number(stock.quantity).toFixed(2)} {stock.unit})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Stock Info */}
              {selectedStock && (
                <div className="md:col-span-12">
                  <Alert className="bg-blue-50 text-blue-900 border-blue-200">
                    <AlertDescription>
                      Available in Source Warehouse: {Number(selectedStock.quantity).toFixed(2)} {selectedStock.unit}
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Quantity */}
              <div className="space-y-2 md:col-span-6">
                <Label htmlFor="quantity">
                  Quantity to Transfer <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => handleChange('quantity', e.target.value)}
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              {/* Unit (readonly) */}
              <div className="space-y-2 md:col-span-6">
                <Label htmlFor="unit">Unit</Label>
                <Input id="unit" value={formData.unit} disabled />
                <p className="text-sm text-muted-foreground">Auto-filled from material</p>
              </div>

              {/* Remarks */}
              <div className="space-y-2 md:col-span-12">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={formData.remarks}
                  onChange={(e) => handleChange('remarks', e.target.value)}
                  rows={3}
                />
                <p className="text-sm text-muted-foreground">Reason for transfer, reference numbers, etc.</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end md:col-span-12">
                <Button type="button" variant="outline" onClick={() => navigate('/inventory/movements')}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? <ButtonSpinner className="mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                  Transfer Stock
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
