// Warehouse Form - Create/Edit Warehouse
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner, ButtonSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import warehouseService from '../services/warehouse.service';
import { WarehouseType } from '../types/inventory.types';

type CreateWarehouseDTO = {
  warehouseCode: string;
  warehouseName: string;
  warehouseType: WarehouseType;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  capacity?: number;
  isActive?: boolean;
};

export default function WarehouseForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    warehouseCode: '',
    warehouseName: '',
    warehouseType: '' as WarehouseType | '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    capacity: '',
    isActive: true,
  });

  useEffect(() => {
    if (isEdit && id) {
      loadWarehouse();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadWarehouse = async () => {
    try {
      setLoading(true);
      const data = await warehouseService.getById(id!);
      setFormData({
        warehouseCode: data.warehouseCode,
        warehouseName: data.warehouseName,
        warehouseType: data.warehouseType,
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        pincode: data.pincode || '',
        country: data.country || 'India',
        contactPerson: data.contactPerson || '',
        contactPhone: data.contactPhone || '',
        contactEmail: data.contactEmail || '',
        capacity: data.capacity?.toString() || '',
        isActive: data.isActive,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load warehouse';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    if (!formData.warehouseType) {
      setError('Please select warehouse type first');
      return;
    }

    try {
      setGenerating(true);
      const code = await warehouseService.generateCode(formData.warehouseType);
      setFormData({ ...formData, warehouseCode: code });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate code';
      setError(message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.warehouseCode || !formData.warehouseName || !formData.warehouseType) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const submitData: CreateWarehouseDTO = {
        warehouseCode: formData.warehouseCode,
        warehouseName: formData.warehouseName,
        warehouseType: formData.warehouseType as WarehouseType,
        address: formData.address || undefined,
        city: formData.city || undefined,
        state: formData.state || undefined,
        pincode: formData.pincode || undefined,
        country: formData.country || undefined,
        contactPerson: formData.contactPerson || undefined,
        contactPhone: formData.contactPhone || undefined,
        contactEmail: formData.contactEmail || undefined,
        capacity: formData.capacity ? Number(formData.capacity) : undefined,
        isActive: formData.isActive,
      };

      if (isEdit && id) {
        await warehouseService.update(id, submitData);
      } else {
        await warehouseService.create(submitData);
      }

      navigate('/inventory/warehouses');
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to ${isEdit ? 'update' : 'create'} warehouse`;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string | number | boolean | null) => {
    setFormData({ ...formData, [field]: value });
  };

  if (loading && isEdit) {
    return <LoadingSpinner />;
  }

  return (
    <div className="container mx-auto py-6">
      <PageHeader title={isEdit ? 'Edit Warehouse' : 'New Warehouse'} />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Warehouse Type */}
              <div className="space-y-2">
                <Label htmlFor="warehouseType">
                  Warehouse Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.warehouseType}
                  onValueChange={(value) => handleChange('warehouseType', value)}
                  disabled={isEdit}
                >
                  <SelectTrigger id="warehouseType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RAW_MATERIAL">Raw Material</SelectItem>
                    <SelectItem value="FINISHED_GOODS">Finished Goods</SelectItem>
                    <SelectItem value="WORK_IN_PROGRESS">Work In Progress</SelectItem>
                    <SelectItem value="GENERAL">General</SelectItem>
                    <SelectItem value="TRANSIT">Transit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Warehouse Code */}
              <div className="space-y-2">
                <Label htmlFor="warehouseCode">
                  Warehouse Code <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="warehouseCode"
                    value={formData.warehouseCode}
                    onChange={(e) => handleChange('warehouseCode', e.target.value)}
                    disabled={isEdit}
                    required
                  />
                  {!isEdit && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGenerateCode}
                      disabled={!formData.warehouseType || generating}
                      className="min-w-[120px]"
                    >
                      {generating ? <ButtonSpinner /> : 'Generate'}
                    </Button>
                  )}
                </div>
              </div>

              {/* Warehouse Name */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="warehouseName">
                  Warehouse Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="warehouseName"
                  value={formData.warehouseName}
                  onChange={(e) => handleChange('warehouseName', e.target.value)}
                  required
                />
              </div>

              {/* Address */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  rows={2}
                />
              </div>

              {/* City */}
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={formData.city} onChange={(e) => handleChange('city', e.target.value)} />
              </div>

              {/* State */}
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" value={formData.state} onChange={(e) => handleChange('state', e.target.value)} />
              </div>

              {/* Pincode */}
              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode</Label>
                <Input
                  id="pincode"
                  value={formData.pincode}
                  onChange={(e) => handleChange('pincode', e.target.value)}
                />
              </div>

              {/* Country */}
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => handleChange('country', e.target.value)}
                />
              </div>

              {/* Contact Person */}
              <div className="space-y-2">
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input
                  id="contactPerson"
                  value={formData.contactPerson}
                  onChange={(e) => handleChange('contactPerson', e.target.value)}
                />
              </div>

              {/* Contact Phone */}
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  value={formData.contactPhone}
                  onChange={(e) => handleChange('contactPhone', e.target.value)}
                />
              </div>

              {/* Contact Email */}
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => handleChange('contactEmail', e.target.value)}
                />
              </div>

              {/* Capacity */}
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity (sq. ft.)</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => handleChange('capacity', e.target.value)}
                />
              </div>

              {/* Active Status */}
              <div className="flex items-center space-x-2 md:col-span-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => handleChange('isActive', checked)}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end md:col-span-2">
                <Button type="button" variant="outline" onClick={() => navigate('/inventory/warehouses')}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? <ButtonSpinner className="mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                  {isEdit ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
