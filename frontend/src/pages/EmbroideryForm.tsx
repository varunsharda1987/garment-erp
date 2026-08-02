import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { embroideryService } from '@/services/embroidery.service';
import { getAllSuppliers } from '@/services/supplier.service';
import type { CreateEmbroideryRequest } from '@/types/embroidery.types';
import type { Supplier } from '@/types/supplier.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Sparkles, ArrowLeft } from 'lucide-react';

interface EmbroideryFormProps {
  mode?: 'create' | 'edit';
}

interface FormData {
  designName: string;
  description?: string;
  designFile?: string;
  designImage?: string;
  stitchCount?: string;
  threadColors?: string;
  repeatWidth?: string;
  repeatHeight?: string;
  usableWidthAfter: string;
  costPerMeter: string;
  leadTimeDays?: string;
  isActive?: boolean;
}

export default function EmbroideryForm({ mode = 'create' }: EmbroideryFormProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [embroideryCode, setEmbroideryCode] = useState<string>('');
  const [isActive, setIsActive] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      isActive: true,
    },
  });

  const isNewEmbroidery = mode === 'create' || !id;

  // Load suppliers
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const response = await getAllSuppliers({ limit: 100, category: 'EMBROIDERY_SUPPLIER' });
        // If no embroidery suppliers, try getting all suppliers
        if (response.data.length === 0) {
          const allResponse = await getAllSuppliers({ limit: 100 });
          setSuppliers(allResponse.data);
        } else {
          setSuppliers(response.data);
        }
      } catch (err) {
        console.error('Failed to fetch suppliers:', err);
        // Try to get all suppliers as fallback
        try {
          const allResponse = await getAllSuppliers({ limit: 100 });
          setSuppliers(allResponse.data);
        } catch {
          // Ignore
        }
      }
    };
    fetchSuppliers();
  }, []);

  // Load embroidery data for edit mode
  useEffect(() => {
    if (!isNewEmbroidery && id) {
      const fetchEmbroidery = async () => {
        try {
          setIsLoading(true);
          const embroidery = await embroideryService.getEmbroideryById(id);

          setEmbroideryCode(embroidery.embroideryCode);
          setValue('designName', embroidery.designName);
          setValue('description', embroidery.description || '');
          setValue('designFile', embroidery.designFile || '');
          setValue('designImage', embroidery.designImage || '');
          setValue('stitchCount', embroidery.stitchCount?.toString() || '');
          setValue('threadColors', embroidery.threadColors?.toString() || '');
          setValue('repeatWidth', embroidery.repeatWidth?.toString() || '');
          setValue('repeatHeight', embroidery.repeatHeight?.toString() || '');
          setValue('usableWidthAfter', embroidery.usableWidthAfter?.toString() || '');
          setValue('costPerMeter', embroidery.costPerMeter?.toString() || '');
          setValue('leadTimeDays', embroidery.leadTimeDays?.toString() || '');
          setIsActive(embroidery.isActive);

          if (embroidery.supplierId) {
            setSelectedSupplierId(embroidery.supplierId);
          }
        } catch (err: unknown) {
          const errorMessage = handleApiError(err, 'Failed to load embroidery design', false);
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      fetchEmbroidery();
    }
  }, [id, isNewEmbroidery, setValue]);

  const onSubmit = async (data: FormData) => {
    try {
      setIsLoading(true);
      setError(null);

      // BUG-EMB12 fix: validate required fields
      if (!data.designName?.trim()) {
        setError('Design name is required');
        return;
      }
      if (!data.usableWidthAfter) {
        setError('Usable width after embroidery is required');
        return;
      }
      if (!data.costPerMeter) {
        setError('Cost per meter is required');
        return;
      }

      // BUG-EMB10 fix: validate parsed numbers aren't NaN
      const parsedUsableWidth = parseFloat(data.usableWidthAfter);
      const parsedCostPerMeter = parseFloat(data.costPerMeter);

      if (!Number.isFinite(parsedUsableWidth) || parsedUsableWidth <= 0) {
        setError('Usable width must be a valid positive number');
        return;
      }
      if (!Number.isFinite(parsedCostPerMeter) || parsedCostPerMeter < 0) {
        setError('Cost per meter must be a valid non-negative number');
        return;
      }

      const payload: CreateEmbroideryRequest = {
        designName: data.designName.trim(),
        description: data.description?.trim() || null,
        designFile: data.designFile?.trim() || null,
        designImage: data.designImage?.trim() || null,
        stitchCount: data.stitchCount ? parseInt(data.stitchCount, 10) : null,
        threadColors: data.threadColors ? parseInt(data.threadColors, 10) : null,
        repeatWidth: data.repeatWidth ? parseFloat(data.repeatWidth) : null,
        repeatHeight: data.repeatHeight ? parseFloat(data.repeatHeight) : null,
        usableWidthAfter: parsedUsableWidth,
        costPerMeter: parsedCostPerMeter,
        supplierId: selectedSupplierId || null,
        leadTimeDays: data.leadTimeDays ? parseInt(data.leadTimeDays, 10) : null,
      };

      if (isNewEmbroidery) {
        await embroideryService.createEmbroidery(payload);
        handleApiSuccess('Embroidery created', 'Embroidery design has been successfully created.');
      } else if (id) {
        await embroideryService.updateEmbroidery(id, { ...payload, isActive });
        handleApiSuccess('Embroidery updated', 'Embroidery design has been successfully updated.');
      }

      navigate('/embroidery');
    } catch (err: unknown) {
      const errorMessage = handleApiError(
        err,
        `Failed to ${isNewEmbroidery ? 'create' : 'update'} embroidery design`,
        false
      );
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !isNewEmbroidery) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading embroidery design...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/embroidery')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Embroidery Designs
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {isNewEmbroidery ? 'Create New Embroidery Design' : 'Edit Embroidery Design'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && <div className="bg-destructive/10 text-destructive p-4 rounded-md">{error}</div>}

            {/* BASIC INFORMATION */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-foreground">Design Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Embroidery Code */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1 flex items-center gap-2">
                    Embroidery Code
                    {isNewEmbroidery && (
                      <span className="text-xs bg-info-muted text-info px-2 py-0.5 rounded">Auto-generated</span>
                    )}
                  </label>
                  {!isNewEmbroidery && embroideryCode ? (
                    <div className="mt-2">
                      <Badge variant="secondary" className="font-mono text-sm">
                        {embroideryCode}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        This code is automatically generated and cannot be changed
                      </p>
                    </div>
                  ) : (
                    <>
                      <Input
                        value=""
                        readOnly
                        placeholder="Will be auto-generated (e.g., EMB-202512-0001)"
                        className="bg-muted cursor-not-allowed"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Code will be automatically assigned upon creation
                      </p>
                    </>
                  )}
                </div>

                {/* Design Name */}
                <div className="md:col-span-2">
                  <Label htmlFor="designName">Design Name *</Label>
                  <Input
                    id="designName"
                    {...register('designName', { required: 'Design name is required' })}
                    placeholder="e.g., Floral Vine Pattern, Geometric Border"
                  />
                  {errors.designName && <p className="text-sm text-destructive mt-1">{errors.designName.message}</p>}
                </div>

                {/* Design Image URL */}
                <div>
                  <Label htmlFor="designImage">Design Image URL</Label>
                  <Input id="designImage" {...register('designImage')} placeholder="https://example.com/image.jpg" />
                  <p className="text-xs text-muted-foreground mt-1">URL to a preview image of the design</p>
                </div>

                {/* Design File URL */}
                <div>
                  <Label htmlFor="designFile">Design File URL</Label>
                  <Input id="designFile" {...register('designFile')} placeholder="https://example.com/design.dst" />
                  <p className="text-xs text-muted-foreground mt-1">URL to the embroidery file (DST, PES, etc.)</p>
                </div>
              </div>
            </div>

            {/* DESIGN SPECIFICATIONS */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 text-foreground">Design Specifications</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Stitch Count */}
                <div>
                  <Label htmlFor="stitchCount">Stitch Count</Label>
                  <Input id="stitchCount" type="number" {...register('stitchCount')} placeholder="e.g., 45000" />
                </div>

                {/* Thread Colors */}
                <div>
                  <Label htmlFor="threadColors">Thread Colors</Label>
                  <Input id="threadColors" type="number" {...register('threadColors')} placeholder="e.g., 3" />
                </div>

                {/* Repeat Width */}
                <div>
                  <Label htmlFor="repeatWidth">Repeat Width (inches)</Label>
                  <Input
                    id="repeatWidth"
                    type="number"
                    step="0.01"
                    {...register('repeatWidth')}
                    placeholder="e.g., 6.5"
                  />
                </div>

                {/* Repeat Height */}
                <div>
                  <Label htmlFor="repeatHeight">Repeat Height (inches)</Label>
                  <Input
                    id="repeatHeight"
                    type="number"
                    step="0.01"
                    {...register('repeatHeight')}
                    placeholder="e.g., 4.5"
                  />
                </div>
              </div>
            </div>

            {/* WIDTH IMPACT */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 text-foreground">Width Impact</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Usable Width After */}
                <div>
                  <Label htmlFor="usableWidthAfter">Usable Width After Embroidery (inches) *</Label>
                  <Input
                    id="usableWidthAfter"
                    type="number"
                    step="0.01"
                    {...register('usableWidthAfter', { required: 'Usable width is required' })}
                    placeholder="e.g., 50"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Cuttable width after embroidery is complete</p>
                  {errors.usableWidthAfter && (
                    <p className="text-sm text-destructive mt-1">{errors.usableWidthAfter.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* COSTING */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 text-foreground">Costing</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cost Per Meter */}
                <div>
                  <Label htmlFor="costPerMeter">Cost per Meter (₹) *</Label>
                  <Input
                    id="costPerMeter"
                    type="number"
                    step="0.01"
                    {...register('costPerMeter', { required: 'Cost per meter is required' })}
                    placeholder="e.g., 120.00"
                  />
                  {errors.costPerMeter && (
                    <p className="text-sm text-destructive mt-1">{errors.costPerMeter.message}</p>
                  )}
                </div>

                {/* Lead Time */}
                <div>
                  <Label htmlFor="leadTimeDays">Lead Time (days)</Label>
                  <Input id="leadTimeDays" type="number" {...register('leadTimeDays')} placeholder="e.g., 7" />
                </div>
              </div>
            </div>

            {/* SUPPLIER INFORMATION */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 text-foreground">Supplier Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Supplier */}
                <div>
                  <Label htmlFor="supplierId">Supplier</Label>
                  <Select
                    value={selectedSupplierId || undefined}
                    onValueChange={(value) => setSelectedSupplierId(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.code} - {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedSupplierId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedSupplierId('')}
                      className="mt-1 text-xs"
                    >
                      Clear supplier
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* DESCRIPTION */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 text-foreground">Additional Information</h3>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  rows={4}
                  placeholder="Additional notes about this embroidery design..."
                />
              </div>
            </div>

            {/* STATUS (Edit mode only) */}
            {!isNewEmbroidery && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4 text-foreground">Status</h3>
                <div className="flex items-center gap-3">
                  <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
                  <Label htmlFor="isActive" className="cursor-pointer">
                    {isActive ? 'Active' : 'Inactive'}
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Inactive designs will not appear in selection dropdowns
                </p>
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="flex gap-4 justify-end pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => navigate('/embroidery')} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : isNewEmbroidery ? 'Create Design' : 'Update Design'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
