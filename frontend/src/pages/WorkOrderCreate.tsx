import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Combobox } from '@/components/ui/combobox';
import { PageHeader } from '@/components/PageHeader';
import { toast } from 'sonner';
import api from '@/lib/api';
import { formatStyleCodeWithRef } from '@/utils/style-ref-format';
import type { Priority } from '@/types/production.types';

interface Style {
  id: string;
  styleCode: string;
  buyerStyleRef?: string;
  styleName: string;
}

interface ColorOption {
  id: string;
  colorName: string;
}

interface SizeOption {
  id: string;
  sizeName: string;
}

interface BreakupRow {
  colorId: string | null;
  sizeId: string;
  quantity: number;
}

export default function WorkOrderCreate() {
  const navigate = useNavigate();

  // Form state
  const [styleId, setStyleId] = useState('');
  const [plannedStartDate, setPlannedStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [plannedEndDate, setPlannedEndDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [remarks, setRemarks] = useState('');
  const [breakup, setBreakup] = useState<BreakupRow[]>([{ colorId: null, sizeId: '', quantity: 0 }]);

  // Lookup data
  const [styles, setStyles] = useState<Style[]>([]);
  const [colors, setColors] = useState<ColorOption[]>([]);
  const [sizes, setSizes] = useState<SizeOption[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (styleId) {
      loadStyleOptions(styleId);
    }
  }, [styleId]);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/styles', { params: { limit: 200, isActive: true } });
      setStyles(response.data?.data || []);
    } catch (err) {
      console.error('Failed to load styles:', err);
      toast.error('Failed to load styles');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStyleOptions = async (selectedStyleId: string) => {
    try {
      const response = await api.get(`/styles/${selectedStyleId}`);
      const style = response.data?.data;

      // Extract colors from style variants
      const colorSet = new Map<string, ColorOption>();
      const sizeSet = new Map<string, SizeOption>();

      (style.variants || []).forEach((v: any) => {
        if (v.colorOptions?.id) {
          colorSet.set(v.colorOptions.id, {
            id: v.colorOptions.id,
            colorName: v.colorOptions.colorName,
          });
        }
        if (v.sizeRange?.id) {
          sizeSet.set(v.sizeRange.id, {
            id: v.sizeRange.id,
            sizeName: v.sizeRange.sizeName,
          });
        }
      });

      setColors(Array.from(colorSet.values()));
      setSizes(Array.from(sizeSet.values()));

      // Reset breakup when style changes
      setBreakup([{ colorId: null, sizeId: '', quantity: 0 }]);
    } catch (err) {
      console.error('Failed to load style options:', err);
      toast.error('Failed to load style color/size options');
    }
  };

  const addBreakupRow = () => {
    setBreakup([...breakup, { colorId: null, sizeId: '', quantity: 0 }]);
  };

  const removeBreakupRow = (index: number) => {
    if (breakup.length > 1) {
      setBreakup(breakup.filter((_, i) => i !== index));
    }
  };

  const updateBreakupRow = (index: number, field: keyof BreakupRow, value: any) => {
    const updated = [...breakup];
    updated[index] = { ...updated[index], [field]: value };
    setBreakup(updated);
  };

  const totalQuantity = breakup.reduce((sum, row) => sum + (row.quantity || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!styleId) {
      setError('Please select a style');
      return;
    }

    const validBreakup = breakup.filter((row) => row.sizeId && row.quantity > 0);
    if (validBreakup.length === 0) {
      setError('Please add at least one valid size/quantity row');
      return;
    }

    try {
      setIsSaving(true);

      const payload = {
        styleId,
        plannedStartDate,
        plannedEndDate,
        totalQuantity,
        priority,
        remarks: remarks || undefined,
        colorSizeBreakup: validBreakup.map((row) => ({
          colorId: row.colorId || null,
          sizeId: row.sizeId,
          quantity: row.quantity,
        })),
      };

      const response = await api.post('/work-orders', payload);
      toast.success('Work order created successfully');

      // Navigate to the new work order
      const newId = response.data?.data?.id;
      if (newId) {
        navigate(`/production/work-orders/${newId}`);
      } else {
        navigate('/production/work-orders');
      }
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Failed to create work order';
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedStyle = styles.find((s) => s.id === styleId);

  return (
    <>
      <PageHeader title="Create Work Order">
        <Button variant="outline" onClick={() => navigate('/production/work-orders')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to List
        </Button>
      </PageHeader>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          {/* Style Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Style Selection</CardTitle>
              <CardDescription>Select the style for this production run</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="style">Style *</Label>
                  <Combobox
                    options={styles.map((s) => ({
                      value: s.id,
                      label: `${formatStyleCodeWithRef(s.styleCode, s.buyerStyleRef)} - ${s.styleName}`,
                      searchText: `${s.styleCode} ${s.buyerStyleRef || ''} ${s.styleName}`,
                    }))}
                    value={styleId}
                    onValueChange={setStyleId}
                    placeholder={isLoading ? 'Loading styles...' : 'Select a style...'}
                    searchPlaceholder="Search by code or name..."
                    emptyText="No styles found"
                    disabled={isLoading}
                  />
                </div>

                {selectedStyle && (
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-muted-foreground">Code:</span>{' '}
                        <span className="font-medium">{selectedStyle.styleCode}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Name:</span>{' '}
                        <span className="font-medium">{selectedStyle.styleName}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Planning Details */}
          <Card>
            <CardHeader>
              <CardTitle>Planning Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Planned Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={plannedStartDate}
                    onChange={(e) => setPlannedStartDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">Planned End Date *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={plannedEndDate}
                    onChange={(e) => setPlannedEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                    <SelectTrigger id="priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional notes..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Quantity Breakup */}
          <Card>
            <CardHeader>
              <CardTitle>Quantity Breakup</CardTitle>
              <CardDescription>
                Define the color/size breakdown for this production run. Total:{' '}
                <span className="font-bold text-foreground">{totalQuantity} pcs</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {breakup.map((row, index) => (
                  <div key={index} className="flex gap-3 items-end">
                    <div className="flex-1">
                      <Label className="text-xs">Color (optional)</Label>
                      <Select
                        value={row.colorId || 'NONE'}
                        onValueChange={(v) => updateBreakupRow(index, 'colorId', v === 'NONE' ? null : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Any color" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">Any / N/A</SelectItem>
                          {colors.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.colorName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">Size *</Label>
                      <Select value={row.sizeId || ''} onValueChange={(v) => updateBreakupRow(index, 'sizeId', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent>
                          {sizes.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.sizeName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-32">
                      <Label className="text-xs">Qty *</Label>
                      <Input
                        type="number"
                        min="0"
                        value={row.quantity ?? ''}
                        onChange={(e) => updateBreakupRow(index, 'quantity', parseInt(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeBreakupRow(index)}
                      disabled={breakup.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}

                <Button type="button" variant="outline" size="sm" onClick={addBreakupRow}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Row
                </Button>
              </div>

              {sizes.length === 0 && styleId && (
                <p className="text-sm text-warning mt-3">
                  No sizes found for this style. Please check the style's variant configuration.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate('/production/work-orders')}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !styleId || totalQuantity === 0}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Creating...' : 'Create Work Order'}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
