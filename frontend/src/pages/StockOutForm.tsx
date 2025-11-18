// Stock OUT Form - Issue materials from warehouse
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
import { ButtonSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import stockMovementService from '../services/stockMovement.service';
import warehouseService from '../services/warehouse.service';
import stockLevelService from '../services/stockLevel.service';
import { Unit } from '../types/inventory.types';

export default function StockOutForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [availableStock, setAvailableStock] = useState<any[]>([]);
  const [selectedMaterialStock, setSelectedMaterialStock] = useState<any>(null);

  const [formData, setFormData] = useState({
    materialId: '',
    warehouseId: '',
    quantity: '',
    unit: '' as Unit | '',
    referenceType: '',
    referenceNumber: '',
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
      setSelectedMaterialStock(stock);
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
      console.error('Failed to load warehouses:', err);
    }
  };

  const loadStockLevels = async (warehouseId: string) => {
    try {
      const data = await stockLevelService.getByWarehouse(warehouseId);
      setAvailableStock(data.filter(s => Number(s.quantity) > 0));
    } catch (err) {
      console.error('Failed to load stock levels:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!formData.materialId || !formData.warehouseId || !formData.quantity || !formData.unit) {
      setError('Please fill in all required fields');
      return;
    }

    if (Number(formData.quantity) <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    if (selectedMaterialStock && Number(formData.quantity) > Number(selectedMaterialStock.quantity)) {
      setError(`Insufficient stock. Available: ${selectedMaterialStock.quantity} ${selectedMaterialStock.unit}`);
      return;
    }

    try {
      setLoading(true);
      await stockMovementService.createStockOut({
        materialId: formData.materialId,
        warehouseId: formData.warehouseId,
        quantity: Number(formData.quantity),
        unit: formData.unit as Unit,
        referenceType: formData.referenceType || undefined,
        referenceNumber: formData.referenceNumber || undefined,
        remarks: formData.remarks || undefined
      });

      setSuccess(true);
      setTimeout(() => navigate('/inventory/movements'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create stock out');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="container mx-auto py-6">
      <PageHeader title="Stock OUT (Issue)" />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 bg-green-50 text-green-900 border-green-200">
          <AlertDescription>Stock OUT created successfully! Redirecting...</AlertDescription>
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
                      <SelectItem value="none" disabled>No stock available</SelectItem>
                    ) : (
                      availableStock.map((stock) => (
                        <SelectItem key={stock.id} value={stock.materialId}>
                          {stock.materials?.materialCode} - {stock.materials?.materialName}
                          {' (Avail: '}{Number(stock.quantity).toFixed(2)} {stock.unit})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Stock Info */}
              {selectedMaterialStock && (
                <div className="md:col-span-2">
                  <Alert className="bg-blue-50 text-blue-900 border-blue-200">
                    <AlertDescription>
                      Available Stock: {Number(selectedMaterialStock.quantity).toFixed(2)} {selectedMaterialStock.unit}
                      {' | '}
                      Rate: ₹{Number(selectedMaterialStock.valuationRate).toFixed(2)} per {selectedMaterialStock.unit}
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Quantity */}
              <div className="space-y-2">
                <Label htmlFor="quantity">
                  Quantity to Issue <span className="text-red-500">*</span>
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

              {/* Reference Type */}
              <div className="space-y-2">
                <Label htmlFor="referenceType">Reference Type</Label>
                <Select
                  value={formData.referenceType}
                  onValueChange={(value) => handleChange('referenceType', value)}
                >
                  <SelectTrigger id="referenceType">
                    <SelectValue placeholder="Select reference type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    <SelectItem value="REQUISITION">Material Requisition</SelectItem>
                    <SelectItem value="PRODUCTION_ORDER">Production Order</SelectItem>
                    <SelectItem value="SALES_ORDER">Sales Order</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reference Number */}
              <div className="space-y-2">
                <Label htmlFor="referenceNumber">Reference Number</Label>
                <Input
                  id="referenceNumber"
                  value={formData.referenceNumber}
                  onChange={(e) => handleChange('referenceNumber', e.target.value)}
                />
                <p className="text-sm text-muted-foreground">Requisition number, order number, etc.</p>
              </div>

              {/* Remarks */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={formData.remarks}
                  onChange={(e) => handleChange('remarks', e.target.value)}
                  rows={3}
                />
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
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <ButtonSpinner className="mr-2" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Issue Stock
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
