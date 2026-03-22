import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { materialMasterService } from '../services/materialMaster.service';
import { MaterialType, MaterialTypeLabels } from '../types/material-master.types';
import type { CreateMaterialMasterDto } from '../types/material-master.types';

interface MaterialMasterFormProps {
  mode: 'create' | 'edit';
}

export default function MaterialMasterForm({ mode }: MaterialMasterFormProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // Form state
  const [formData, setFormData] = useState<CreateMaterialMasterDto>({
    materialType: MaterialType.LACE,
    name: '',
    description: '',
    code: '',
    pricePerUnit: undefined,
    pricePerMeter: undefined,
    pricePerPiece: undefined,
    pricePerKg: undefined,
    pricePerGross: undefined,
    unit: '',
    isActive: true,
    hsnCode: '',
    gstRate: undefined,
    specifications: {},
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'edit' && id) {
      loadMaterial();
    }
  }, [mode, id]);

  const loadMaterial = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const material = await materialMasterService.getById(parseInt(id));
      setFormData({
        materialType: material.materialType,
        name: material.name,
        description: material.description,
        code: material.code,
        pricePerUnit: material.pricePerUnit,
        pricePerMeter: material.pricePerMeter,
        pricePerPiece: material.pricePerPiece,
        pricePerKg: material.pricePerKg,
        pricePerGross: material.pricePerGross,
        unit: material.unit,
        currencyId: material.currencyId ? Number(material.currencyId) : undefined,
        isActive: material.isActive,
        hsnCode: material.hsnCode,
        gstRate: material.gstRate,
        specifications: material.specifications || {},
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load material');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'create') {
        await materialMasterService.create(formData);
      } else if (id) {
        await materialMasterService.update(parseInt(id), formData);
      }
      navigate('/material-master');
    } catch (err: any) {
      setError(err.message || 'Failed to save material');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  if (loading && mode === 'edit') {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader title={mode === 'create' ? 'Create Material' : 'Edit Material'}>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/material-master')}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save Material'}
          </Button>
        </div>
      </PageHeader>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="materialType">Material Type *</Label>
                <Select
                  value={formData.materialType}
                  onValueChange={(value) => handleChange('materialType', value as MaterialType)}
                  disabled={mode === 'edit'}
                >
                  <SelectTrigger id="materialType">
                    <SelectValue placeholder="Select material type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MaterialTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">Material Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => handleChange('code', e.target.value)}
                  placeholder="Auto-generated if empty"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Material Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Enter material name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Enter material description"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Pricing Information */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pricePerMeter">Price per Meter</Label>
                <Input
                  id="pricePerMeter"
                  type="number"
                  step="0.01"
                  value={formData.pricePerMeter || ''}
                  onChange={(e) =>
                    handleChange('pricePerMeter', e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pricePerPiece">Price per Piece</Label>
                <Input
                  id="pricePerPiece"
                  type="number"
                  step="0.01"
                  value={formData.pricePerPiece || ''}
                  onChange={(e) =>
                    handleChange('pricePerPiece', e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pricePerKg">Price per Kg</Label>
                <Input
                  id="pricePerKg"
                  type="number"
                  step="0.01"
                  value={formData.pricePerKg || ''}
                  onChange={(e) => handleChange('pricePerKg', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pricePerGross">Price per Gross</Label>
                <Input
                  id="pricePerGross"
                  type="number"
                  step="0.01"
                  value={formData.pricePerGross || ''}
                  onChange={(e) =>
                    handleChange('pricePerGross', e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pricePerUnit">Price per Unit</Label>
                <Input
                  id="pricePerUnit"
                  type="number"
                  step="0.01"
                  value={formData.pricePerUnit || ''}
                  onChange={(e) =>
                    handleChange('pricePerUnit', e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Input
                  id="unit"
                  value={formData.unit}
                  onChange={(e) => handleChange('unit', e.target.value)}
                  placeholder="e.g., meter, piece, kg"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tax & Compliance */}
        <Card>
          <CardHeader>
            <CardTitle>Tax & Compliance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hsnCode">HSN Code</Label>
                <Input
                  id="hsnCode"
                  value={formData.hsnCode}
                  onChange={(e) => handleChange('hsnCode', e.target.value)}
                  placeholder="Enter HSN code"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gstRate">GST Rate (%)</Label>
                <Input
                  id="gstRate"
                  type="number"
                  step="0.01"
                  value={formData.gstRate || ''}
                  onChange={(e) => handleChange('gstRate', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => handleChange('isActive', checked)}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/material-master')}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : mode === 'create' ? 'Create Material' : 'Update Material'}
          </Button>
        </div>
      </form>
    </div>
  );
}
