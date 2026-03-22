// Stock Count Form - Create new physical inventory count
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
import { Checkbox } from '@/components/ui/checkbox';
import { ButtonSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import stockCountService from '../services/stockCount.service';
import warehouseService from '../services/warehouse.service';
import stockLevelService from '../services/stockLevel.service';
import { CountType } from '../types/inventory.types';
import { logError } from '../lib/logger';

export default function StockCountForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [availableMaterials, setAvailableMaterials] = useState<any[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    warehouseId: '',
    countType: '' as CountType | '',
    countDate: new Date().toISOString().split('T')[0],
    remarks: '',
  });

  useEffect(() => {
    loadWarehouses();
  }, []);

  useEffect(() => {
    if (formData.warehouseId) {
      loadMaterials(formData.warehouseId);
    }
  }, [formData.warehouseId]);

  const loadWarehouses = async () => {
    try {
      const data = await warehouseService.getAll({ isActive: true });
      setWarehouses(data);
    } catch (err) {
      logError('Failed to load warehouses:', err);
    }
  };

  const loadMaterials = async (warehouseId: string) => {
    try {
      const data = await stockLevelService.getByWarehouse(warehouseId);
      setAvailableMaterials(data);
    } catch (err) {
      logError('Failed to load materials:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!formData.warehouseId || !formData.countType) {
      setError('Please fill in all required fields');
      return;
    }

    // For PARTIAL, CYCLE, SPOT_CHECK types, materials must be selected
    if (['PARTIAL', 'CYCLE', 'SPOT_CHECK'].includes(formData.countType)) {
      if (selectedMaterials.length === 0) {
        setError('Please select at least one material for this count type');
        return;
      }
    }

    try {
      setLoading(true);
      const count = await stockCountService.create({
        warehouseId: formData.warehouseId,
        countType: formData.countType as CountType,
        countDate: formData.countDate,
        remarks: formData.remarks || undefined,
        materialIds: selectedMaterials.length > 0 ? selectedMaterials : undefined,
      });

      setSuccess(true);
      setTimeout(() => navigate(`/inventory/stock-counts/${count.id}`), 2000);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(axiosError.response?.data?.message || 'Failed to create stock count');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string | number | boolean | null) => {
    setFormData({ ...formData, [field]: value });
    // Reset material selection when count type changes
    if (field === 'countType') {
      setSelectedMaterials([]);
    }
  };

  const handleMaterialToggle = (materialId: string) => {
    setSelectedMaterials((prev) =>
      prev.includes(materialId) ? prev.filter((id) => id !== materialId) : [...prev, materialId]
    );
  };

  const requiresMaterialSelection = ['PARTIAL', 'CYCLE', 'SPOT_CHECK'].includes(formData.countType);

  return (
    <div className="container mx-auto py-6">
      <PageHeader title="New Stock Count" />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 bg-green-50 text-green-900 border-green-200">
          <AlertDescription>Stock count created successfully! Redirecting...</AlertDescription>
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
                <Select value={formData.warehouseId} onValueChange={(value) => handleChange('warehouseId', value)}>
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

              {/* Count Type */}
              <div className="space-y-2">
                <Label htmlFor="countType">
                  Count Type <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.countType} onValueChange={(value) => handleChange('countType', value)}>
                  <SelectTrigger id="countType">
                    <SelectValue placeholder="Select count type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FULL">Full Count - All materials in warehouse</SelectItem>
                    <SelectItem value="PARTIAL">Partial Count - Selected materials</SelectItem>
                    <SelectItem value="CYCLE">Cycle Count - Routine selected items</SelectItem>
                    <SelectItem value="SPOT_CHECK">Spot Check - Random verification</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Count Date */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="countDate">
                  Count Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="countDate"
                  type="date"
                  value={formData.countDate}
                  onChange={(e) => handleChange('countDate', e.target.value)}
                  required
                />
              </div>

              {/* Material Selection */}
              {requiresMaterialSelection && (
                <div className="md:col-span-2">
                  <Card className="border-2">
                    <CardContent className="pt-6">
                      <Label className="text-base mb-3 block">
                        Select Materials to Count <span className="text-red-500">*</span>
                      </Label>
                      {availableMaterials.length === 0 ? (
                        <Alert className="bg-blue-50 text-blue-900 border-blue-200">
                          <AlertDescription>
                            No materials in selected warehouse. Please select a warehouse with stock.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {availableMaterials.map((stock) => (
                            <div key={stock.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`material-${stock.id}`}
                                checked={selectedMaterials.includes(stock.materialId)}
                                onCheckedChange={() => handleMaterialToggle(stock.materialId)}
                              />
                              <Label
                                htmlFor={`material-${stock.id}`}
                                className="text-sm font-normal cursor-pointer flex-1"
                              >
                                {stock.materials?.code} - {stock.materials?.name}{' '}
                                <span className="text-muted-foreground">
                                  ({Number(stock.quantity).toFixed(2)} {stock.unit})
                                </span>
                              </Label>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground mt-3">
                        Selected: {selectedMaterials.length} material(s)
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Remarks */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={formData.remarks}
                  onChange={(e) => handleChange('remarks', e.target.value)}
                  rows={3}
                />
                <p className="text-sm text-muted-foreground">Purpose of count, special instructions, etc.</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end md:col-span-2">
                <Button type="button" variant="outline" onClick={() => navigate('/inventory/stock-counts')}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? <ButtonSpinner className="mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                  Create Stock Count
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
