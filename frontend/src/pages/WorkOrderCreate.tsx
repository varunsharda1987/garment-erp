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
import { PageHeader } from '@/components/PageHeader';
import { StyleCombobox } from '@/components/StyleCombobox';
import { toast } from 'sonner';
import api from '@/lib/api';
import workOrderService from '@/services/workOrder.service';
import type { Priority } from '@/types/production.types';
import type { Style } from '@/types/style.types';
import { toDateInputValue } from '@/lib/date';

// GET /styles/:id returns the style's SKU grid as `styleVariants` with flat colour/size fields
interface StyleVariantRow {
  colorId: string | null;
  colorName: string | null;
  sizeId: string | null;
  sizeName: string | null;
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
  const [selectedStyle, setSelectedStyle] = useState<Style | undefined>(undefined);
  const [plannedStartDate, setPlannedStartDate] = useState(toDateInputValue(new Date()));
  const [plannedEndDate, setPlannedEndDate] = useState(
    toDateInputValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  );
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [remarks, setRemarks] = useState('');
  const [breakup, setBreakup] = useState<BreakupRow[]>([{ colorId: null, sizeId: '', quantity: 0 }]);

  // Lookup data
  const [colors, setColors] = useState<ColorOption[]>([]);
  const [sizes, setSizes] = useState<SizeOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setColors([]);
    setSizes([]);
    setBreakup([{ colorId: null, sizeId: '', quantity: 0 }]);
    if (!styleId) return;

    // A slower response for a previously picked style must not overwrite this one's sizes
    let cancelled = false;
    setOptionsLoading(true);
    api
      .get<{ data: { styleVariants?: StyleVariantRow[] } }>(`/styles/${styleId}`)
      .then((response) => {
        if (cancelled) return;
        const colorMap = new Map<string, ColorOption>();
        const sizeMap = new Map<string, SizeOption>();
        for (const v of response.data?.data?.styleVariants || []) {
          if (v.colorId) colorMap.set(v.colorId, { id: v.colorId, colorName: v.colorName || v.colorId });
          if (v.sizeId) sizeMap.set(v.sizeId, { id: v.sizeId, sizeName: v.sizeName || v.sizeId });
        }
        setColors(Array.from(colorMap.values()));
        setSizes(Array.from(sizeMap.values()));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load style options:', err);
        toast.error('Failed to load style color/size options');
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [styleId]);

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

    if (plannedEndDate < plannedStartDate) {
      setError('Planned end date cannot be before the planned start date');
      return;
    }

    const validBreakup = breakup.filter((row) => row.sizeId && row.quantity > 0);
    if (validBreakup.length === 0) {
      setError('Please add at least one valid size/quantity row');
      return;
    }

    const seen = new Set<string>();
    for (const row of validBreakup) {
      const key = `${row.colorId ?? ''}|${row.sizeId}`;
      if (seen.has(key)) {
        const sizeName = sizes.find((s) => s.id === row.sizeId)?.sizeName || 'this size';
        const colorName = colors.find((c) => c.id === row.colorId)?.colorName;
        setError(
          `${colorName ? `${colorName} / ` : ''}${sizeName} is entered twice — put its whole quantity on one row`
        );
        return;
      }
      seen.add(key);
    }

    try {
      setIsSaving(true);

      const created = await workOrderService.create({
        styleId,
        plannedStartDate,
        plannedEndDate,
        totalQuantity: validBreakup.reduce((sum, row) => sum + row.quantity, 0),
        priority,
        remarks: remarks || undefined,
        colorSizeBreakup: validBreakup.map((row) => ({
          colorId: row.colorId || null,
          sizeId: row.sizeId,
          quantity: row.quantity,
        })),
      });
      toast.success('Work order created successfully');
      navigate(`/production/work-orders/${created.id}`);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'Failed to create work order';
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

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
                  <StyleCombobox
                    value={styleId}
                    onChange={(id, style) => {
                      setStyleId(id);
                      setSelectedStyle(style);
                    }}
                    placeholder="Select a style..."
                  />
                </div>

                {styleId && selectedStyle && (
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

              {sizes.length === 0 && styleId && !optionsLoading && (
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
