// Fabric Width CAD Create/Edit Dialog
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cadService } from '@/services/fabricGreigeService';
import type { FabricWidthCAD, FabricWidthCADFormData } from '@/types/fabric-greige.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

interface FabricWidthCADDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fabricId: string;
  fabricCode: string;
  existingCAD?: FabricWidthCAD;
  onSuccess?: () => void;
}

export default function FabricWidthCADDialog({
  open,
  onOpenChange,
  fabricId,
  fabricCode,
  existingCAD,
  onSuccess,
}: FabricWidthCADDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!existingCAD;

  // Form state
  const [cutableWidth, setCutableWidth] = useState<number>(0);
  const [widthUnit, setWidthUnit] = useState('inches');
  const [cadMeters, setCadMeters] = useState<number | undefined>();
  const [cadYards, setCadYards] = useState<number | undefined>();
  const [cadWastagePercent, setCadWastagePercent] = useState<number>(5);
  const [markerEfficiency, setMarkerEfficiency] = useState<number | undefined>();
  const [isPreferred, setIsPreferred] = useState(false);
  const [supplierAvailability, setSupplierAvailability] = useState<'always' | 'limited' | 'rare'>('always');
  const [priceDifferential, setPriceDifferential] = useState<number | undefined>();
  const [notes, setNotes] = useState('');

  // Populate form when editing
  useEffect(() => {
    if (existingCAD) {
      setCutableWidth(existingCAD.cutableWidth || 0);
      setWidthUnit(existingCAD.widthUnit || 'inches');
      setCadMeters(existingCAD.cadMeters ?? undefined);
      setCadYards(existingCAD.cadYards ?? undefined);
      setCadWastagePercent(existingCAD.cadWastagePercent || 5);
      setMarkerEfficiency(existingCAD.markerEfficiency ?? undefined);
      setIsPreferred(existingCAD.isPreferred || false);
      setSupplierAvailability(existingCAD.supplierAvailability || 'always');
      setPriceDifferential(existingCAD.priceDifferential ?? undefined);
      setNotes(existingCAD.notes || '');
    } else {
      // Reset form for new entry
      setCutableWidth(0);
      setWidthUnit('inches');
      setCadMeters(undefined);
      setCadYards(undefined);
      setCadWastagePercent(5);
      setMarkerEfficiency(undefined);
      setIsPreferred(false);
      setSupplierAvailability('always');
      setPriceDifferential(undefined);
      setNotes('');
    }
  }, [existingCAD, open]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: FabricWidthCADFormData) => cadService.create(data),
    onSuccess: () => {
      handleApiSuccess('Width CAD created successfully');
      queryClient.invalidateQueries({ queryKey: ['fabric', fabricId] });
      queryClient.invalidateQueries({ queryKey: ['fabric-width-cads', fabricId] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => handleApiError(err, 'Failed to create width CAD'),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: Partial<FabricWidthCADFormData>) => cadService.update(existingCAD!.id, data),
    onSuccess: () => {
      handleApiSuccess('Width CAD updated successfully');
      queryClient.invalidateQueries({ queryKey: ['fabric', fabricId] });
      queryClient.invalidateQueries({ queryKey: ['fabric-width-cads', fabricId] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err) => handleApiError(err, 'Failed to update width CAD'),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    if (cutableWidth <= 0) {
      handleApiError(new Error('Invalid width'), 'Please enter a valid cutable width');
      return;
    }

    const data: FabricWidthCADFormData = {
      fabricId,
      availableWidth: cutableWidth,
      widthUnit,
      cadMeters: cadMeters || undefined,
      cadYards: cadYards || undefined,
      cadWastagePercent,
      markerEfficiency: markerEfficiency || undefined,
      isPreferred,
      supplierAvailability,
      priceDifferential: priceDifferential || undefined,
      notes: notes || undefined,
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Width CAD' : 'Add Width CAD'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update' : 'Add'} a width CAD option for fabric {fabricCode}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Width and Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cutableWidth">Cutable Width *</Label>
              <Input
                id="cutableWidth"
                type="number"
                min={0}
                step={0.5}
                value={cutableWidth || ''}
                onChange={(e) => setCutableWidth(parseFloat(e.target.value) || 0)}
                placeholder="e.g., 44"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="widthUnit">Unit</Label>
              <Select value={widthUnit} onValueChange={setWidthUnit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inches">Inches</SelectItem>
                  <SelectItem value="cm">Centimeters</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* CAD Values */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cadMeters">CAD (meters)</Label>
              <Input
                id="cadMeters"
                type="number"
                min={0}
                step={0.01}
                value={cadMeters ?? ''}
                onChange={(e) => setCadMeters(e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="e.g., 1.25"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cadYards">CAD (yards)</Label>
              <Input
                id="cadYards"
                type="number"
                min={0}
                step={0.01}
                value={cadYards ?? ''}
                onChange={(e) => setCadYards(e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="e.g., 1.37"
              />
            </div>
          </div>

          {/* Wastage and Efficiency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cadWastagePercent">Wastage (%)</Label>
              <Input
                id="cadWastagePercent"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={cadWastagePercent || ''}
                onChange={(e) => setCadWastagePercent(parseFloat(e.target.value) || 0)}
                placeholder="e.g., 5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="markerEfficiency">Marker Efficiency (%)</Label>
              <Input
                id="markerEfficiency"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={markerEfficiency ?? ''}
                onChange={(e) => setMarkerEfficiency(e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="e.g., 85"
              />
            </div>
          </div>

          {/* Supplier Availability and Price Differential */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplierAvailability">Supplier Availability</Label>
              <Select
                value={supplierAvailability}
                onValueChange={(v) => setSupplierAvailability(v as 'always' | 'limited' | 'rare')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="always">Always Available</SelectItem>
                  <SelectItem value="limited">Limited</SelectItem>
                  <SelectItem value="rare">Rare</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priceDifferential">Price Differential (%)</Label>
              <Input
                id="priceDifferential"
                type="number"
                step={0.1}
                value={priceDifferential ?? ''}
                onChange={(e) => setPriceDifferential(e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="e.g., +5 or -3"
              />
            </div>
          </div>

          {/* Preferred Toggle */}
          <div className="flex items-center space-x-2">
            <Switch id="isPreferred" checked={isPreferred} onCheckedChange={setIsPreferred} />
            <Label htmlFor="isPreferred" className="cursor-pointer">
              Mark as preferred width
            </Label>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || cutableWidth <= 0}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? 'Update' : 'Add'} Width CAD
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
