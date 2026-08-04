import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { sampleService } from '@/services/sample.service';
import { styleService } from '@/services/style.service';
import { stageValidationService } from '@/services/stageValidation.service';
import { useAuthStore } from '@/stores/auth.store';
import { AdminOverrideModal } from '@/components/AdminOverrideModal';
import type {
  SampleType,
  CreateSampleRequest,
  SampleMeasurementInput,
  SampleColorwayInput,
  SampleSizeSetInput,
} from '@/types/sample.types';
import { SampleTypeLabels } from '@/types/sample.types';
// BUG-CU10 fix: Use shared CustomerLookup type instead of duplicate local interface
import type { CustomerLookup } from '@/types/customer.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { TestTube, ArrowLeft, Save, Plus, Trash2, Ruler, Palette, Grid3X3 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '@/lib/api';

interface Style {
  id: string;
  styleCode: string;
  styleName: string;
  customerId?: string;
  sizeOptions?: Array<{ id: string; sizeName: string; sizeCode: string }>;
  colorOptions?: Array<{ id: string; colorName: string; colorCode?: string }>;
}

export default function SampleForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const { user } = useAuthStore();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Lookup data
  const [customers, setCustomers] = useState<CustomerLookup[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<Style | null>(null);

  // Admin override state
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [pendingSampleData, setPendingSampleData] = useState<CreateSampleRequest | null>(null);
  const [validationBlockers, setValidationBlockers] = useState<
    Array<{ type: string; message: string; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' }>
  >([]);

  // Form state
  const [formData, setFormData] = useState<{
    customerId: string;
    styleId: string;
    sampleType: SampleType;
    requiredDate: string;
    remarks: string;
    // Shipment sample fields
    linkedDispatchId: string;
    productionLot: string;
    // Photoshoot sample fields
    sentTo: string;
    purpose: string;
  }>({
    customerId: '',
    styleId: '',
    sampleType: 'FIT_SAMPLE',
    requiredDate: '',
    remarks: '',
    linkedDispatchId: '',
    productionLot: '',
    sentTo: '',
    purpose: '',
  });

  // Nested data
  const [measurements, setMeasurements] = useState<SampleMeasurementInput[]>([]);
  const [colorways, setColorways] = useState<SampleColorwayInput[]>([]);
  const [sizeSets, setSizeSets] = useState<SampleSizeSetInput[]>([]);

  useEffect(() => {
    fetchCustomers();
    if (isEditing && id) {
      fetchSample();
    } else {
      // Set default required date to 7 days from now
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 7);
      setFormData((prev) => ({
        ...prev,
        requiredDate: defaultDate.toISOString().split('T')[0],
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Fetch styles when customer changes
  useEffect(() => {
    if (formData.customerId) {
      fetchStyles(formData.customerId);
    } else {
      setStyles([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.customerId]);

  // Fetch style details when style changes
  useEffect(() => {
    if (formData.styleId) {
      fetchStyleDetails(formData.styleId);
    } else {
      setSelectedStyle(null);
    }
  }, [formData.styleId]);

  const fetchCustomers = async () => {
    try {
      const response = await api.get<{ data: CustomerLookup[] }>('/customers?limit=1000&isActive=true');
      setCustomers(response.data.data);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    }
  };

  const fetchStyles = async (customerId: string) => {
    try {
      // Get customer name first
      const customer = customers.find((c) => c.id === customerId);
      const response = await api.get<{ data: Style[] }>(
        `/styles?limit=1000&search=${encodeURIComponent(customer?.name || '')}&status=ACTIVE`
      );
      setStyles(response.data.data);
    } catch (err) {
      console.error('Failed to fetch styles:', err);
    }
  };

  const fetchStyleDetails = async (styleId: string) => {
    try {
      const style = await styleService.getStyleById(styleId);
      setSelectedStyle(style as unknown as Style);
    } catch (err) {
      console.error('Failed to fetch style details:', err);
    }
  };

  const fetchSample = async () => {
    try {
      setIsLoading(true);
      const sample = await sampleService.getSampleById(id!);

      setFormData({
        customerId: sample.customerId,
        styleId: sample.styleId || '',
        sampleType: sample.sampleType,
        requiredDate: sample.requiredDate.split('T')[0],
        remarks: sample.remarks || '',
        linkedDispatchId: sample.linkedDispatchId || '',
        productionLot: sample.productionLot || '',
        sentTo: sample.sentTo || '',
        purpose: sample.purpose || '',
      });

      // Load nested data
      if (sample.measurements) {
        setMeasurements(
          sample.measurements.map((m) => ({
            sizeId: m.sizeId || undefined,
            measurementPoint: m.measurementPoint,
            specValue: m.specValue,
            actualValue: m.actualValue || undefined,
            tolerance: m.tolerance,
          }))
        );
      }

      if (sample.colorways) {
        setColorways(
          sample.colorways.map((c) => ({
            colorId: c.colorId,
            sizeId: c.sizeId || undefined,
            fabricLot: c.fabricLot || undefined,
            qtySent: c.qtySent,
          }))
        );
      }

      if (sample.sizeSets) {
        setSizeSets(
          sample.sizeSets.map((s) => ({
            sizeId: s.sizeId,
            colorId: s.colorId,
            qty: s.qty,
          }))
        );
      }
    } catch (err: unknown) {
      handleApiError(err, 'Failed to load sample');
      navigate('/samples');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.customerId) {
      handleApiError(null, 'Please select a customer');
      return;
    }
    if (!formData.requiredDate) {
      handleApiError(null, 'Please enter required date');
      return;
    }

    try {
      setIsSaving(true);

      const requestData: CreateSampleRequest = {
        customerId: formData.customerId,
        styleId: formData.styleId || undefined,
        sampleType: formData.sampleType,
        requiredDate: formData.requiredDate,
        remarks: formData.remarks || undefined,
        measurements: measurements.length > 0 ? measurements : undefined,
        colorways: colorways.length > 0 ? colorways : undefined,
        sizeSets: sizeSets.length > 0 ? sizeSets : undefined,
      };

      // Add type-specific fields
      if (formData.sampleType === 'SHIPMENT_SAMPLE') {
        requestData.linkedDispatchId = formData.linkedDispatchId || undefined;
        requestData.productionLot = formData.productionLot || undefined;
      }
      if (formData.sampleType === 'PHOTO_SAMPLE') {
        requestData.sentTo = formData.sentTo || undefined;
        requestData.purpose = formData.purpose || undefined;
      }

      // SEQUENTIAL SAMPLE VALIDATION (only for new samples, not edits)
      if (!isEditing && formData.styleId && ['PP_SAMPLE', 'SIZE_SET_SAMPLE'].includes(formData.sampleType)) {
        try {
          const validation = await stageValidationService.checkSampleCreation(formData.styleId, formData.sampleType);

          if (!validation.canCreate) {
            if (user?.role === 'ADMIN') {
              // Show override modal for admin
              setPendingSampleData(requestData);
              setValidationBlockers([
                {
                  type: 'SAMPLE_CREATION_BLOCKED',
                  message: validation.blocker?.message || 'Sample creation blocked',
                  severity: 'CRITICAL' as const,
                },
              ]);
              setShowOverrideModal(true);
              setIsSaving(false);
              return;
            } else {
              // Non-admin: show error
              handleApiError(null, validation.blocker?.message || 'Sample creation blocked');
              setIsSaving(false);
              return;
            }
          }
        } catch (error) {
          console.error('Validation check failed:', error);
          // Continue anyway if validation service fails
        }
      }

      // Proceed with sample creation/update
      await createOrUpdateSample(requestData, false, null);
    } catch (err: unknown) {
      handleApiError(err, 'Failed to save sample');
    } finally {
      setIsSaving(false);
    }
  };

  const createOrUpdateSample = async (
    requestData: CreateSampleRequest,
    adminOverride: boolean,
    overrideReason: string | null
  ) => {
    if (isEditing) {
      await sampleService.updateSample(id!, {
        requiredDate: requestData.requiredDate,
        remarks: requestData.remarks || undefined,
      });
      // Update nested data separately if needed
      if (measurements.length > 0) {
        await sampleService.updateMeasurements(id!, measurements);
      }
      handleApiSuccess('Sample updated', 'Sample has been updated successfully.');
    } else {
      const sample = await sampleService.createSample({
        ...requestData,
        adminOverride,
        overrideReason: overrideReason || undefined,
      } as CreateSampleRequest & { adminOverride?: boolean; overrideReason?: string });
      handleApiSuccess('Sample created', `Sample ${sample.sampleNumber} has been created.`);
      navigate(`/samples/${sample.id}`);
    }
  };

  const handleOverrideConfirm = async (reason: string) => {
    if (pendingSampleData) {
      setIsSaving(true);
      try {
        await createOrUpdateSample(pendingSampleData, true, reason);
        setShowOverrideModal(false);
        setPendingSampleData(null);
      } catch (err: unknown) {
        handleApiError(err, 'Failed to save sample');
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Measurement management
  const addMeasurement = () => {
    setMeasurements([...measurements, { measurementPoint: '', specValue: 0, tolerance: 0.5 }]);
  };

  const removeMeasurement = (index: number) => {
    setMeasurements(measurements.filter((_, i) => i !== index));
  };

  const updateMeasurement = (index: number, field: string, value: string | number) => {
    setMeasurements(measurements.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  // Colorway management (for PP samples)
  const addColorway = () => {
    setColorways([...colorways, { colorId: '', qtySent: 1 }]);
  };

  const removeColorway = (index: number) => {
    setColorways(colorways.filter((_, i) => i !== index));
  };

  const updateColorway = (index: number, field: string, value: string | number) => {
    setColorways(colorways.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  // Size Set management (for Size Set samples)
  const addSizeSet = () => {
    setSizeSets([...sizeSets, { sizeId: '', colorId: '', qty: 1 }]);
  };

  const removeSizeSet = (index: number) => {
    setSizeSets(sizeSets.filter((_, i) => i !== index));
  };

  const updateSizeSet = (index: number, field: string, value: string | number) => {
    setSizeSets(sizeSets.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/samples')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          <TestTube className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-display font-medium text-foreground">
              {isEditing ? 'Edit Sample' : 'New Sample'}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? 'Update sample details' : 'Create a new sample request'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Customer *</Label>
                    <Select
                      value={formData.customerId}
                      onValueChange={(v) => setFormData({ ...formData, customerId: v, styleId: '' })}
                      disabled={isEditing}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Sample Type *</Label>
                    <Select
                      value={formData.sampleType}
                      onValueChange={(v) => setFormData({ ...formData, sampleType: v as SampleType })}
                      disabled={isEditing}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SampleTypeLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Style (Optional)</Label>
                    <Select
                      value={formData.styleId || 'none'}
                      onValueChange={(v) => setFormData({ ...formData, styleId: v === 'none' ? '' : v })}
                      disabled={isEditing || !formData.customerId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select style" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No style</SelectItem>
                        {styles.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.styleCode} - {s.styleName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Required By *</Label>
                    <Input
                      type="date"
                      value={formData.requiredDate}
                      onChange={(e) => setFormData({ ...formData, requiredDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Any special instructions or notes..."
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Type-specific fields */}
            {formData.sampleType === 'SHIPMENT_SAMPLE' && (
              <Card>
                <CardHeader>
                  <CardTitle>Shipment Sample Details</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Production Lot</Label>
                    <Input
                      placeholder="e.g., LOT-2024-001"
                      value={formData.productionLot}
                      onChange={(e) => setFormData({ ...formData, productionLot: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Linked Dispatch ID</Label>
                    <Input
                      placeholder="Optional dispatch reference"
                      value={formData.linkedDispatchId}
                      onChange={(e) => setFormData({ ...formData, linkedDispatchId: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {formData.sampleType === 'PHOTO_SAMPLE' && (
              <Card>
                <CardHeader>
                  <CardTitle>Photoshoot Sample Details</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sent To</Label>
                    <Input
                      placeholder="Studio/Agency name"
                      value={formData.sentTo}
                      onChange={(e) => setFormData({ ...formData, sentTo: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Purpose</Label>
                    <Input
                      placeholder="e.g., Catalog, Lookbook, Social Media"
                      value={formData.purpose}
                      onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tabs for nested data */}
            <Tabs defaultValue="measurements">
              <TabsList>
                <TabsTrigger value="measurements" className="flex items-center gap-2">
                  <Ruler className="h-4 w-4" />
                  Measurements
                </TabsTrigger>
                {formData.sampleType === 'PP_SAMPLE' && (
                  <TabsTrigger value="colorways" className="flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Colorways
                  </TabsTrigger>
                )}
                {formData.sampleType === 'SIZE_SET_SAMPLE' && (
                  <TabsTrigger value="sizeSets" className="flex items-center gap-2">
                    <Grid3X3 className="h-4 w-4" />
                    Size Set
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="measurements">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Measurements</CardTitle>
                      <CardDescription>Define spec measurements for QC</CardDescription>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addMeasurement}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {measurements.length > 0 ? (
                      <div className="space-y-3">
                        {measurements.map((m, index) => (
                          <div key={index} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                            <div className="flex-1">
                              <Input
                                placeholder="Measurement point (e.g., Chest)"
                                value={m.measurementPoint}
                                onChange={(e) => updateMeasurement(index, 'measurementPoint', e.target.value)}
                              />
                            </div>
                            <div className="w-24">
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="Spec"
                                value={m.specValue || ''}
                                onChange={(e) => updateMeasurement(index, 'specValue', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <div className="w-24">
                              <Input
                                type="number"
                                step="0.1"
                                placeholder="±Tol"
                                value={m.tolerance || ''}
                                onChange={(e) =>
                                  updateMeasurement(index, 'tolerance', parseFloat(e.target.value) || 0.5)
                                }
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMeasurement(index)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        No measurements added. Click "Add" to add measurement specs.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {formData.sampleType === 'PP_SAMPLE' && (
                <TabsContent value="colorways">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Colorways</CardTitle>
                        <CardDescription>Multiple colorways for buyer approval</CardDescription>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addColorway}
                        disabled={isEditing || !selectedStyle?.colorOptions?.length}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {isEditing && (
                        <p className="text-sm text-warning mb-3">
                          Colorways can only be edited when creating the sample.
                        </p>
                      )}
                      {!selectedStyle?.colorOptions?.length ? (
                        <p className="text-muted-foreground text-center py-8">
                          Select a style with color options to add colorways.
                        </p>
                      ) : colorways.length > 0 ? (
                        <div className="space-y-3">
                          {colorways.map((c, index) => (
                            <div key={index} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                              <div className="flex-1">
                                <Select
                                  value={c.colorId}
                                  onValueChange={(v) => updateColorway(index, 'colorId', v)}
                                  disabled={isEditing}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select color" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {selectedStyle?.colorOptions?.map((color) => (
                                      <SelectItem key={color.id} value={color.id}>
                                        {color.colorName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="w-32">
                                <Input
                                  placeholder="Fabric Lot"
                                  value={c.fabricLot || ''}
                                  onChange={(e) => updateColorway(index, 'fabricLot', e.target.value)}
                                  disabled={isEditing}
                                />
                              </div>
                              <div className="w-20">
                                <Input
                                  type="number"
                                  min="1"
                                  placeholder="Qty"
                                  value={c.qtySent || ''}
                                  onChange={(e) => updateColorway(index, 'qtySent', parseInt(e.target.value) || 1)}
                                  disabled={isEditing}
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeColorway(index)}
                                disabled={isEditing}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">
                          No colorways added. Click "Add" to add colorways.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {formData.sampleType === 'SIZE_SET_SAMPLE' && (
                <TabsContent value="sizeSets">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Size Set</CardTitle>
                        <CardDescription>Jumping sizes with mix of colors</CardDescription>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addSizeSet}
                        disabled={
                          isEditing || !selectedStyle?.sizeOptions?.length || !selectedStyle?.colorOptions?.length
                        }
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {isEditing && (
                        <p className="text-sm text-warning mb-3">
                          Size-set entries can only be edited when creating the sample.
                        </p>
                      )}
                      {!selectedStyle?.sizeOptions?.length || !selectedStyle?.colorOptions?.length ? (
                        <p className="text-muted-foreground text-center py-8">
                          Select a style with size and color options to add size set entries.
                        </p>
                      ) : sizeSets.length > 0 ? (
                        <div className="space-y-3">
                          {sizeSets.map((s, index) => (
                            <div key={index} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                              <div className="flex-1">
                                <Select
                                  value={s.sizeId}
                                  onValueChange={(v) => updateSizeSet(index, 'sizeId', v)}
                                  disabled={isEditing}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select size" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {selectedStyle?.sizeOptions?.map((size) => (
                                      <SelectItem key={size.id} value={size.id}>
                                        {size.sizeName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex-1">
                                <Select
                                  value={s.colorId}
                                  onValueChange={(v) => updateSizeSet(index, 'colorId', v)}
                                  disabled={isEditing}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select color" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {selectedStyle?.colorOptions?.map((color) => (
                                      <SelectItem key={color.id} value={color.id}>
                                        {color.colorName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="w-20">
                                <Input
                                  type="number"
                                  min="1"
                                  placeholder="Qty"
                                  value={s.qty || ''}
                                  onChange={(e) => updateSizeSet(index, 'qty', parseInt(e.target.value) || 1)}
                                  disabled={isEditing}
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeSizeSet(index)}
                                disabled={isEditing}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">
                          No size set entries added. Click "Add" to add entries.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Action Card */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button type="submit" className="w-full" disabled={isSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : isEditing ? 'Update Sample' : 'Create Sample'}
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/samples')}>
                  Cancel
                </Button>
              </CardContent>
            </Card>

            {/* Help Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Sample Types</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2">
                <p>
                  <strong>FIT Sample:</strong> First sample with measurements. Buyer approval required.
                </p>
                <p>
                  <strong>PP Sample:</strong> Pre-production with actual fabric. Multiple colorways.
                </p>
                <p>
                  <strong>Size Set:</strong> Jumping sizes for approval before bulk production.
                </p>
                <p>
                  <strong>Shipment:</strong> Sent before each shipment from production lot.
                </p>
                <p>
                  <strong>Photoshoot:</strong> For catalog/marketing. No return tracking.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>

      {/* Admin Override Modal */}
      <AdminOverrideModal
        isOpen={showOverrideModal}
        onClose={() => setShowOverrideModal(false)}
        onConfirm={handleOverrideConfirm}
        action={`create ${SampleTypeLabels[formData.sampleType]}`}
        blockers={validationBlockers}
      />
    </div>
  );
}
