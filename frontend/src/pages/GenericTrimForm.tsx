import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { genericTrimService } from '@/services/genericTrim.service';
import { TRIM_TYPE_CONFIGS } from '@/types/genericTrim.types';
import type { FieldConfig } from '@/types/genericTrim.types';
import { getAllSuppliers } from '@/services/supplier.service';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

interface Supplier {
  id: string;
  code: string;
  name: string;
}

export default function GenericTrimForm() {
  const navigate = useNavigate();
  const { trimType, id } = useParams<{ trimType: string; id?: string }>();
  const isEditMode = !!id && id !== 'new';

  // Get config for this trim type
  const config = trimType ? TRIM_TYPE_CONFIGS[trimType] : null;

  // Form state - dynamic based on config
  const [formData, setFormData] = useState<Record<string, string | number | boolean | null>>({});
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(isEditMode);
  const [error, setError] = useState<string | null>(null);

  // Load trim suppliers only
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await getAllSuppliers({ limit: 100, category: 'TRIMS_SUPPLIER' });
        setSuppliers(response.data || []);
      } catch (err) {
        console.error('Failed to load suppliers:', err);
      }
    };
    fetchSuppliers();
  }, []);

  // Load existing item for edit mode
  useEffect(() => {
    if (isEditMode && trimType && id) {
      const fetchItem = async () => {
        try {
          setIsFetching(true);
          const item = await genericTrimService.getById(trimType, id);
          // Convert to form data
          const data: Record<string, string | number | boolean | null> = {};
          if (config) {
            const itemRecord = item as unknown as Record<string, string | number | boolean | null>;
            data[config.nameField] = itemRecord[config.nameField];
            config.fields.forEach((field) => {
              data[field.name] = itemRecord[field.name];
            });
          }
          data.supplierId = item.supplierId || '';
          data.description = item.description || '';
          data.isActive = item.isActive;
          setFormData(data);
        } catch (err) {
          handleApiError(err, `Failed to load ${config?.label || 'item'}`);
          navigate(`/materials/${trimType}`);
        } finally {
          setIsFetching(false);
        }
      };
      fetchItem();
    } else if (config) {
      // Initialize with defaults for new item
      const initial: Record<string, string | number | boolean | null> = {};
      initial[config.nameField] = '';
      config.fields.forEach((field) => {
        if (field.type === 'boolean') {
          initial[field.name] = false;
        } else {
          initial[field.name] = '';
        }
      });
      initial.supplierId = '';
      initial.description = '';
      initial.isActive = true;
      setFormData(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, trimType, id, config]);

  const handleInputChange = (field: string, value: string | number | boolean | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimType || !config) return;

    // Validate required field (name)
    const name = formData[config.nameField];
    if (!name || name.trim() === '') {
      setError(`${config.label} name is required`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Prepare data - convert empty strings to null for optional fields
      const submitData: Record<string, string | number | boolean | null> = {};
      submitData[config.nameField] = name.trim();

      config.fields.forEach((field) => {
        const value = formData[field.name];
        if (field.type === 'number') {
          submitData[field.name] = value ? parseFloat(value) : null;
        } else if (field.type === 'boolean') {
          submitData[field.name] = !!value;
        } else {
          submitData[field.name] = value || null;
        }
      });

      submitData.supplierId = formData.supplierId || null;
      submitData.description = formData.description || null;
      if (isEditMode) {
        submitData.isActive = formData.isActive;
      }

      if (isEditMode && id) {
        await genericTrimService.update(trimType, id, submitData);
        handleApiSuccess('Success', `${config.label} updated successfully`);
      } else {
        await genericTrimService.create(trimType, submitData);
        handleApiSuccess('Success', `${config.label} created successfully`);
      }

      navigate(`/materials/${trimType}`);
    } catch (err) {
      handleApiError(err, `Failed to ${isEditMode ? 'update' : 'create'} ${config.label.toLowerCase()}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!trimType || !config) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Invalid trim type specified.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/trim-masters')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Trim Masters
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isFetching) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-6 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading...
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render a field based on its config
  const renderField = (field: FieldConfig) => {
    const value = formData[field.name];

    if (field.type === 'select' && field.options) {
      return (
        <Select value={value || ''} onValueChange={(val) => handleInputChange(field.name, val)}>
          <SelectTrigger>
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (field.type === 'boolean') {
      return (
        <div className="flex items-center space-x-2">
          <Switch checked={!!value} onCheckedChange={(checked) => handleInputChange(field.name, checked)} />
          <span className="text-sm text-muted-foreground">{value ? 'Yes' : 'No'}</span>
        </div>
      );
    }

    if (field.type === 'number') {
      return (
        <Input
          type="number"
          step="0.01"
          value={value || ''}
          onChange={(e) => handleInputChange(field.name, e.target.value)}
          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
        />
      );
    }

    return (
      <Input
        type="text"
        value={value || ''}
        onChange={(e) => handleInputChange(field.name, e.target.value)}
        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
      />
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/materials/${trimType}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-display font-medium text-foreground">
            {isEditMode ? 'Edit' : 'Add New'} {config.label}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isEditMode ? 'Update the details below' : 'Fill in the details below'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Name field (required) */}
            <div className="space-y-2">
              <Label htmlFor={config.nameField}>
                {config.label} Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id={config.nameField}
                value={formData[config.nameField] || ''}
                onChange={(e) => handleInputChange(config.nameField, e.target.value)}
                placeholder={`Enter ${config.label.toLowerCase()} name`}
                required
              />
            </div>

            {/* Dynamic fields from config */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {config.fields.map((field) => (
                <div key={field.name} className="space-y-2">
                  <Label htmlFor={field.name}>
                    {field.label}
                    {field.required && <span className="text-destructive">*</span>}
                  </Label>
                  {renderField(field)}
                </div>
              ))}
            </div>

            {/* Supplier */}
            <div className="space-y-2">
              <Label htmlFor="supplierId">Supplier</Label>
              <Select
                value={formData.supplierId || 'none'}
                onValueChange={(val) => handleInputChange('supplierId', val === 'none' ? '' : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Supplier</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name} ({supplier.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Enter description (optional)"
                rows={3}
              />
            </div>

            {/* Active status (edit mode only) */}
            {isEditMode && (
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.isActive ?? true}
                  onCheckedChange={(checked) => handleInputChange('isActive', checked)}
                />
                <Label>Active</Label>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit buttons */}
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(`/materials/${trimType}`)}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditMode ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {isEditMode ? 'Update' : 'Create'} {config.label}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
