// Stock Adjustment Form - Adjust stock with reason
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ButtonSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import stockMovementService from '../services/stockMovement.service';
import warehouseService from '../services/warehouse.service';
import stockLevelService from '../services/stockLevel.service';
import { Unit, AdjustmentReason } from '../types/inventory-exports';
import type { Warehouse, StockLevel } from '../types/inventory-exports';
import { logError } from '../lib/logger';

export default function StockAdjustmentForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [availableStock, setAvailableStock] = useState<StockLevel[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockLevel | null>(null);

  const [formData, setFormData] = useState({
    materialId: '',
    warehouseId: '',
    adjustmentType: 'decrease' as 'increase' | 'decrease',
    quantity: '',
    unit: '' as Unit | '',
    reason: '' as AdjustmentReason | '',
    remarks: ''
  });

  useEffect(() => {
    loadWarehouses();
  }, []);

  useEffect(() => {
    if (formData.warehouseId) {
      loadStockLevels(formData.warehouseId);
    }
  }, [formData.warehouseId]);

  useEffect(() => {
    if (formData.materialId && availableStock.length > 0) {
      const stock = availableStock.find(s => s.materialId === formData.materialId);
      setSelectedStock(stock ?? null);
      if (stock) {
        setFormData(prev => ({ ...prev, unit: stock.unit }));
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
      setAvailableStock(data);
    } catch (err) {
      logError('Failed to load stock levels:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!formData.materialId || !formData.warehouseId || !formData.quantity || !formData.reason) {
      setError('Please fill in all required fields');
      return;
    }

    if (Number(formData.quantity) <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    if (formData.adjustmentType === 'decrease') {
      if (selectedStock && Number(formData.quantity) > Number(selectedStock.quantity)) {
        setError(`Cannot decrease by more than available stock: ${selectedStock.quantity} ${selectedStock.unit}`);
        return;
      }
    }

    try {
      setLoading(true);
      const adjustmentQuantity = formData.adjustmentType === 'increase'
        ? Number(formData.quantity)
        : -Number(formData.quantity);

      await stockMovementService.createAdjustment({
        materialId: formData.materialId,
        warehouseId: formData.warehouseId,
        quantity: adjustmentQuantity,
        unit: formData.unit as Unit,
        reason: formData.reason as AdjustmentReason,
        remarks: formData.remarks || undefined
      });

      setSuccess(true);
      setTimeout(() => navigate('/inventory/movements'), 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create adjustment';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string | number | boolean | null) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="container mx-auto py-6">
      <PageHeader title="Stock Adjustment" />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 bg-green-50 text-green-900 border-green-200">
          <AlertDescription>Stock adjustment created successfully! Redirecting...</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Warehouse Selection */}
              <div className="space-y-2">
                <Label htmlFor="warehouseId">
                  Warehouse <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.warehouseId}
                  onValueChange={(value) => handleChange('warehouseId', value)}
                >
                  <SelectTrigger id="warehouseId">
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

              {/* Material Selection */}
              <div className="space-y-2">
                <Label htmlFor="materialId">
                  Material <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.materialId}
                  onValueChange={(value) => handleChange('materialId', value)}
                  disabled={!formData.warehouseId}
                >
                  <SelectTrigger id="materialId">
                    <SelectValue placeholder="Select material" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStock.length === 0 ? (
                      <SelectItem value="none" disabled>No stock in warehouse</SelectItem>
                    ) : (
                      availableStock.map((stock) => (
                        <SelectItem key={stock.id} value={stock.materialId}>
                          {stock.materials?.materialCode} - {stock.materials?.materialName}
                          {' (Current: '}{Number(stock.quantity).toFixed(2)} {stock.unit})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Stock Info */}
              {selectedStock && (
                <div className="md:col-span-2">
                  <Alert className="bg-blue-50 text-blue-900 border-blue-200">
                    <AlertDescription>
                      Current Stock: {Number(selectedStock.quantity).toFixed(2)} {selectedStock.unit}
                      {' | '}
                      Rate: ₹{Number(selectedStock.valuationRate).toFixed(2)}
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Adjustment Type */}
              <div className="space-y-2 md:col-span-2">
                <Label>
                  Adjustment Type <span className="text-red-500">*</span>
                </Label>
                <RadioGroup
                  value={formData.adjustmentType}
                  onValueChange={(value) => handleChange('adjustmentType', value)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="increase" id="increase" />
                    <Label htmlFor="increase" className="font-normal">Increase Stock</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="decrease" id="decrease" />
                    <Label htmlFor="decrease" className="font-normal">Decrease Stock</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <Label htmlFor="quantity">
                  Quantity to {formData.adjustmentType === 'increase' ? 'Add' : 'Subtract'} <span className="text-red-500">*</span>
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
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Input
                  id="unit"
                  value={formData.unit}
                  disabled
                />
                <p className="text-sm text-muted-foreground">Auto-filled from material</p>
              </div>

              {/* Reason */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="reason">
                  Reason for Adjustment <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.reason}
                  onValueChange={(value) => handleChange('reason', value)}
                >
                  <SelectTrigger id="reason">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAMAGED">Damaged - Material damaged or defective</SelectItem>
                    <SelectItem value="EXPIRED">Expired - Material expired or obsolete</SelectItem>
                    <SelectItem value="LOST">Lost - Material lost or stolen</SelectItem>
                    <SelectItem value="FOUND">Found - Material found during count</SelectItem>
                    <SelectItem value="CORRECTION">Correction - Correcting previous error</SelectItem>
                    <SelectItem value="OTHER">Other - See remarks</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Remarks */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="remarks">
                  Detailed Remarks <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="remarks"
                  value={formData.remarks}
                  onChange={(e) => handleChange('remarks', e.target.value)}
                  rows={4}
                  required
                />
                <p className="text-sm text-muted-foreground">Please provide detailed explanation for this adjustment</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end md:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/inventory/movements')}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  variant={formData.adjustmentType === 'decrease' ? 'destructive' : 'default'}
                >
                  {loading ? (
                    <ButtonSpinner className="mr-2" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Create Adjustment
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
