// Stock IN Form - Create stock receipt
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
import { LoadingSpinner, ButtonSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import stockMovementService from '../services/stockMovement.service';
import warehouseService from '../services/warehouse.service';
import { Unit } from '../types/inventory.types';

// This would normally come from material service
interface Material {
  id: string;
  materialCode: string;
  materialName: string;
  unit: string;
}

export default function StockInForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);

  const [formData, setFormData] = useState({
    materialId: '',
    warehouseId: '',
    quantity: '',
    unit: '' as Unit | '',
    rate: '',
    referenceType: '',
    referenceNumber: '',
    remarks: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [warehousesData] = await Promise.all([
        warehouseService.getAll({ isActive: true })
        // TODO: Load materials from material service
      ]);
      setWarehouses(warehousesData);
      // setMaterials(materialsData);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validation
    if (!formData.materialId || !formData.warehouseId || !formData.quantity || !formData.unit) {
      setError('Please fill in all required fields');
      return;
    }

    if (Number(formData.quantity) <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    try {
      setLoading(true);
      await stockMovementService.createStockIn({
        materialId: formData.materialId,
        warehouseId: formData.warehouseId,
        quantity: Number(formData.quantity),
        unit: formData.unit as Unit,
        rate: formData.rate ? Number(formData.rate) : undefined,
        referenceType: formData.referenceType || undefined,
        referenceNumber: formData.referenceNumber || undefined,
        remarks: formData.remarks || undefined
      });

      setSuccess(true);
      setTimeout(() => navigate('/inventory/movements'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create stock in');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="container mx-auto py-6">
      <PageHeader title="Stock IN (Receipt)" />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 bg-green-50 text-green-900 border-green-200">
          <AlertDescription>Stock IN created successfully! Redirecting...</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Material Selection */}
              <div className="space-y-2">
                <Label htmlFor="materialId">
                  Material <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.materialId}
                  onValueChange={(value) => handleChange('materialId', value)}
                >
                  <SelectTrigger id="materialId">
                    <SelectValue placeholder="Select material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.length === 0 ? (
                      <SelectItem value="none" disabled>No materials available</SelectItem>
                    ) : (
                      materials.map((mat) => (
                        <SelectItem key={mat.id} value={mat.id}>
                          {mat.materialCode} - {mat.materialName}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

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

              {/* Quantity */}
              <div className="space-y-2">
                <Label htmlFor="quantity">
                  Quantity <span className="text-red-500">*</span>
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

              {/* Unit */}
              <div className="space-y-2">
                <Label htmlFor="unit">
                  Unit <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => handleChange('unit', value)}
                >
                  <SelectTrigger id="unit">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIECE">Piece</SelectItem>
                    <SelectItem value="METER">Meter</SelectItem>
                    <SelectItem value="KILOGRAM">Kilogram</SelectItem>
                    <SelectItem value="GRAM">Gram</SelectItem>
                    <SelectItem value="LITER">Liter</SelectItem>
                    <SelectItem value="BOX">Box</SelectItem>
                    <SelectItem value="SET">Set</SelectItem>
                    <SelectItem value="DOZEN">Dozen</SelectItem>
                    <SelectItem value="YARD">Yard</SelectItem>
                    <SelectItem value="ROLL">Roll</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Rate */}
              <div className="space-y-2">
                <Label htmlFor="rate">Rate per Unit</Label>
                <Input
                  id="rate"
                  type="number"
                  value={formData.rate}
                  onChange={(e) => handleChange('rate', e.target.value)}
                  min="0"
                  step="0.01"
                />
                <p className="text-sm text-muted-foreground">Optional: For valuation tracking</p>
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
                    <SelectItem value="all">None</SelectItem>
                    <SelectItem value="GRN">GRN (Goods Receipt Note)</SelectItem>
                    <SelectItem value="PURCHASE_ORDER">Purchase Order</SelectItem>
                    <SelectItem value="RETURN">Return</SelectItem>
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
                <p className="text-sm text-muted-foreground">GRN number, PO number, etc.</p>
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
                  Create Stock IN
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
