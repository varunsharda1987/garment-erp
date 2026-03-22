import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { challanService } from '@/services/challan.service';
import { ChallanTypeLabels, CHALLAN_ITEM_TYPES } from '@/types/challan.types';
import type { CreateChallanInput, CreateChallanItemInput } from '@/types/challan.types';
import { handleApiError } from '@/lib/api-error-handler';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, ArrowLeft, Save } from 'lucide-react';

export default function ChallanForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState<CreateChallanInput>({
    challanType: 'OUTWARD',
    fromType: 'WAREHOUSE',
    fromName: '',
    toType: 'VENDOR',
    toName: '',
    items: [
      {
        itemType: 'FABRIC',
        description: '',
        quantity: 0,
        unit: 'MTR',
      },
    ],
  });

  function updateField<K extends keyof CreateChallanInput>(key: K, value: CreateChallanInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateItem(index: number, field: keyof CreateChallanItemInput, value: any) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  }

  function addItem() {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { itemType: 'FABRIC', description: '', quantity: 0, unit: 'PCS' }],
    }));
  }

  function removeItem(index: number) {
    if (form.items.length <= 1) return;
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.fromName || !form.toName) {
      toast({ title: 'Validation Error', description: 'From and To names are required', variant: 'destructive' });
      return;
    }
    if (form.items.some((item) => !item.description || item.quantity <= 0)) {
      toast({
        title: 'Validation Error',
        description: 'All items must have a description and quantity > 0',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const challan = await challanService.createChallan(form);
      toast({ title: 'Success', description: `Challan ${challan.challanNumber} created` });
      navigate(`/manufacturing/challans/${challan.id}`);
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  const fromToOptions = [
    { value: 'WAREHOUSE', label: 'Warehouse' },
    { value: 'DEPARTMENT', label: 'Department' },
    { value: 'VENDOR', label: 'Vendor / Processor' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/manufacturing/challans')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">New Challan</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Challan Type & Transport */}
        <Card>
          <CardHeader>
            <CardTitle>Challan Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Challan Type *</Label>
              <Select value={form.challanType} onValueChange={(v) => updateField('challanType', v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ChallanTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Challan Date</Label>
              <Input
                type="date"
                value={form.challanDate || ''}
                onChange={(e) => updateField('challanDate', e.target.value)}
              />
            </div>
            <div>
              <Label>Expected Date</Label>
              <Input
                type="date"
                value={form.expectedDate || ''}
                onChange={(e) => updateField('expectedDate', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* From / To */}
        <Card>
          <CardHeader>
            <CardTitle>From / To</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground">FROM</h3>
              <div>
                <Label>Type *</Label>
                <Select value={form.fromType} onValueChange={(v) => updateField('fromType', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fromToOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Name *</Label>
                <Input
                  value={form.fromName}
                  onChange={(e) => updateField('fromName', e.target.value)}
                  placeholder="e.g., Main Warehouse, Cutting Dept"
                />
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground">TO</h3>
              <div>
                <Label>Type *</Label>
                <Select value={form.toType} onValueChange={(v) => updateField('toType', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fromToOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Name *</Label>
                <Input
                  value={form.toName}
                  onChange={(e) => updateField('toName', e.target.value)}
                  placeholder="e.g., Processor XYZ, Stitching Dept"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transport Details */}
        <Card>
          <CardHeader>
            <CardTitle>Transport Details (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Vehicle Number</Label>
              <Input value={form.vehicleNumber || ''} onChange={(e) => updateField('vehicleNumber', e.target.value)} />
            </div>
            <div>
              <Label>Driver Name</Label>
              <Input value={form.driverName || ''} onChange={(e) => updateField('driverName', e.target.value)} />
            </div>
            <div>
              <Label>Driver Phone</Label>
              <Input value={form.driverPhone || ''} onChange={(e) => updateField('driverPhone', e.target.value)} />
            </div>
            <div>
              <Label>LR Number</Label>
              <Input value={form.lrNumber || ''} onChange={(e) => updateField('lrNumber', e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Items</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {form.items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-3 items-end border-b pb-3">
                <div className="col-span-2">
                  <Label>Type</Label>
                  <Select value={item.itemType} onValueChange={(v) => updateItem(index, 'itemType', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHALLAN_ITEM_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4">
                  <Label>Description *</Label>
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    placeholder="Item description"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    value={item.quantity || ''}
                    onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-1">
                  <Label>Unit</Label>
                  <Select value={item.unit || 'PCS'} onValueChange={(v) => updateItem(index, 'unit', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PCS">PCS</SelectItem>
                      <SelectItem value="MTR">MTR</SelectItem>
                      <SelectItem value="KG">KG</SelectItem>
                      <SelectItem value="SET">SET</SelectItem>
                      <SelectItem value="GROSS">GROSS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Rate</Label>
                  <Input
                    type="number"
                    value={item.rate || ''}
                    onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || undefined)}
                    placeholder="Optional"
                  />
                </div>
                <div className="col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                    disabled={form.items.length <= 1}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Remarks & Submit */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div>
              <Label>Remarks</Label>
              <Textarea
                value={form.remarks || ''}
                onChange={(e) => updateField('remarks', e.target.value)}
                placeholder="Any additional notes..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => navigate('/manufacturing/challans')}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Creating...' : 'Create Challan'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
