/**
 * FabricsTrimsTab Component
 * Tab 2: Fabrics & Trims (merged)
 */

import { useStyleForm } from '../StyleFormContext';
import { FABRIC_FINISH_TYPES } from '../types';
import type { FabricFinishType } from '../types';
import { Button } from '../../../../components/ui/button';
import { Card } from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { Badge } from '../../../../components/ui/badge';
import { GenericGreigeSelector } from '../../../../components/GenericGreigeSelector';
import { Plus, Trash2, AlertCircle } from 'lucide-react';

interface FabricsTrimsTabProps {
  onPrevious: () => void;
  onNext: () => void;
  onOpenPicker: () => void;
}

export function FabricsTrimsTab({ onPrevious, onNext, onOpenPicker }: FabricsTrimsTabProps) {
  const { state, addFabric, removeFabric, updateFabric, removeMaterial } = useStyleForm();

  const { fabrics, materialBOM } = state;

  return (
    <div className="space-y-6">
      {/* Fabrics Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-display font-semibold">Fabrics</h2>
          <Button type="button" variant="outline" size="sm" onClick={addFabric}>
            <Plus className="h-4 w-4 mr-2" />
            Add Fabric
          </Button>
        </div>

        <div className="space-y-4">
          {fabrics.map((fabric, index) => (
            <div key={fabric.id} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">Fabric {index + 1}</span>
                {fabrics.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeFabric(fabric.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Component Name</Label>
                  <Input
                    value={fabric.componentName}
                    onChange={(e) => updateFabric(fabric.id, 'componentName', e.target.value)}
                    placeholder="e.g., Front Panel, Sleeve"
                  />
                </div>
                <div>
                  <GenericGreigeSelector
                    value={fabric.genericGreigeName}
                    onChange={(name) => updateFabric(fabric.id, 'genericGreigeName', name)}
                    required
                  />
                </div>
                <div>
                  <Label>Fabric Finish Type *</Label>
                  <Select
                    value={fabric.fabricFinishType}
                    onValueChange={(v) => updateFabric(fabric.id, 'fabricFinishType', v as FabricFinishType)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select finish..." />
                    </SelectTrigger>
                    <SelectContent>
                      {FABRIC_FINISH_TYPES.map((ft) => (
                        <SelectItem key={ft.value} value={ft.value}>
                          {ft.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Est. Consumption</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={fabric.estimatedConsumption}
                      onChange={(e) => updateFabric(fabric.id, 'estimatedConsumption', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label>Unit</Label>
                    <Select
                      value={fabric.unit}
                      onValueChange={(v) => updateFabric(fabric.id, 'unit', v as 'METER' | 'YARD')}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="METER">Meter</SelectItem>
                        <SelectItem value="YARD">Yard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Input
                  value={fabric.notes || ''}
                  onChange={(e) => updateFabric(fabric.id, 'notes', e.target.value)}
                  placeholder="Additional notes..."
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Trims/Materials Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-display font-semibold">Trims & Materials</h2>
            <p className="text-sm text-muted-foreground">Buttons, Zippers, Lace, Thread, etc.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onOpenPicker}>
            <Plus className="h-4 w-4 mr-2" />
            Add Material
          </Button>
        </div>

        {materialBOM.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No materials added yet</p>
            <p className="text-sm mt-1">Click "Add Material" to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {materialBOM.map((material, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{material.materialCode}</Badge>
                    <span className="font-medium text-sm">{material.materialName}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Qty: {material.quantityPerGarment} {material.unit} · Category:{' '}
                    {material.usageCategory.replace('_', ' ')}
                    {material.componentName && ` · Component: ${material.componentName}`}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeMaterial(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onPrevious}>
          Previous
        </Button>
        <Button type="button" onClick={onNext}>
          Next: Processes
        </Button>
      </div>
    </div>
  );
}
