import React, { useState } from 'react';
import { Plus, Trash2, Star } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import type { CadAverageFormData } from '../types/cad-types';
import { COMMON_FABRIC_WIDTHS } from '../types/cad-types';

interface CadAverageInputProps {
  value: CadAverageFormData[];
  onChange: (value: CadAverageFormData[]) => void;
  fabricName?: string;
}

export const CadAverageInput: React.FC<CadAverageInputProps> = ({
  value = [],
  onChange,
  fabricName = 'Fabric',
}) => {
  const [customWidth, setCustomWidth] = useState<string>('');

  const addCadAverage = (width?: number) => {
    const newWidth = width || parseFloat(customWidth);

    if (!newWidth || isNaN(newWidth)) {
      alert('Please enter a valid fabric width');
      return;
    }

    // Check if width already exists
    if (value.some((cad) => cad.fabricWidth === newWidth)) {
      alert(`Width ${newWidth}" already exists for this fabric`);
      return;
    }

    const newCad: CadAverageFormData = {
      fabricWidth: newWidth,
      cadAverageMeters: undefined,
      cadAverageYards: undefined,
      cadWastagePercent: 2,
      markerEfficiency: undefined,
      isPreferred: value.length === 0, // First entry is preferred by default
      notes: '',
    };

    onChange([...value, newCad]);
    setCustomWidth('');
  };

  const removeCadAverage = (index: number) => {
    const updatedCads = value.filter((_, i) => i !== index);

    // If we removed the preferred one, make the first one preferred
    if (updatedCads.length > 0 && !updatedCads.some((cad) => cad.isPreferred)) {
      updatedCads[0].isPreferred = true;
    }

    onChange(updatedCads);
  };

  const updateCadAverage = (index: number, field: keyof CadAverageFormData, newValue: any) => {
    const updated = [...value];

    if (field === 'isPreferred' && newValue === true) {
      // Unset all other preferred flags
      updated.forEach((cad, i) => {
        if (i !== index) {
          cad.isPreferred = false;
        }
      });
    }

    updated[index] = {
      ...updated[index],
      [field]: newValue,
    };

    onChange(updated);
  };

  const getTotalCost = (cad: CadAverageFormData, ratePerMeter: number = 0) => {
    if (!cad.cadAverageMeters || !ratePerMeter) return 0;
    return cad.cadAverageMeters * ratePerMeter;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">
          CAD Averages by Fabric Width
        </Label>
        <Badge variant="secondary">
          {value.length} width{value.length !== 1 ? 's' : ''} configured
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Add different CAD consumption values for each fabric width to compare costs and optimize procurement decisions.
      </p>

      {/* Quick Add Common Widths */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-muted-foreground self-center">Quick add:</span>
        {COMMON_FABRIC_WIDTHS.filter(
          (w) => !value.some((cad) => cad.fabricWidth === w)
        ).map((width) => (
          <Button
            key={width}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addCadAverage(width)}
          >
            <Plus className="h-3 w-3 mr-1" />
            {width}"
          </Button>
        ))}
      </div>

      {/* Custom Width Input */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="number"
            placeholder="Custom width (inches)"
            value={customWidth}
            onChange={(e) => setCustomWidth(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCadAverage();
              }
            }}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => addCadAverage()}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Custom Width
        </Button>
      </div>

      {/* CAD Average Entries */}
      <div className="space-y-4">
        {value.length === 0 ? (
          <Card className="bg-muted/50">
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              No CAD averages configured yet. Add a fabric width to get started.
            </CardContent>
          </Card>
        ) : (
          value.map((cad, index) => (
            <Card key={index} className={cad.isPreferred ? 'border-primary' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    Width: {cad.fabricWidth}"
                    {cad.isPreferred && (
                      <Badge variant="default" className="gap-1">
                        <Star className="h-3 w-3 fill-current" />
                        Preferred
                      </Badge>
                    )}
                  </CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCadAverage(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Preferred Width Checkbox */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`preferred-${index}`}
                    checked={cad.isPreferred}
                    onChange={(e) =>
                      updateCadAverage(index, 'isPreferred', e.target.checked)
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label
                    htmlFor={`preferred-${index}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Set as preferred width (default for BOM)
                  </label>
                </div>

                {/* CAD Consumption */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`meters-${index}`}>
                      CAD Average (Meters) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`meters-${index}`}
                      type="number"
                      step="0.001"
                      placeholder="2.300"
                      value={cad.cadAverageMeters || ''}
                      onChange={(e) =>
                        updateCadAverage(
                          index,
                          'cadAverageMeters',
                          e.target.value ? parseFloat(e.target.value) : undefined
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={`yards-${index}`}>CAD Average (Yards)</Label>
                    <Input
                      id={`yards-${index}`}
                      type="number"
                      step="0.001"
                      placeholder="2.515"
                      value={cad.cadAverageYards || ''}
                      onChange={(e) =>
                        updateCadAverage(
                          index,
                          'cadAverageYards',
                          e.target.value ? parseFloat(e.target.value) : undefined
                        )
                      }
                    />
                  </div>
                </div>

                {/* Wastage and Efficiency */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor={`wastage-${index}`}>Wastage %</Label>
                    <Input
                      id={`wastage-${index}`}
                      type="number"
                      step="0.1"
                      placeholder="2.0"
                      value={cad.cadWastagePercent || ''}
                      onChange={(e) =>
                        updateCadAverage(
                          index,
                          'cadWastagePercent',
                          e.target.value ? parseFloat(e.target.value) : undefined
                        )
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={`efficiency-${index}`}>Marker Efficiency %</Label>
                    <Input
                      id={`efficiency-${index}`}
                      type="number"
                      step="0.1"
                      placeholder="90"
                      value={cad.markerEfficiency || ''}
                      onChange={(e) =>
                        updateCadAverage(
                          index,
                          'markerEfficiency',
                          e.target.value ? parseFloat(e.target.value) : undefined
                        )
                      }
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label htmlFor={`notes-${index}`}>Notes (Optional)</Label>
                  <Textarea
                    id={`notes-${index}`}
                    placeholder="e.g., Best marker efficiency, supplier availability..."
                    value={cad.notes || ''}
                    onChange={(e) =>
                      updateCadAverage(index, 'notes', e.target.value)
                    }
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Comparison Summary Table */}
      {value.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comparison Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Width</th>
                    <th className="text-right p-2">Meters</th>
                    <th className="text-right p-2">Yards</th>
                    <th className="text-right p-2">Wastage</th>
                    <th className="text-right p-2">Efficiency</th>
                    <th className="text-center p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {value.map((cad, index) => (
                    <tr key={index} className={`border-b ${cad.isPreferred ? 'bg-primary/5' : ''}`}>
                      <td className="p-2 font-medium">{cad.fabricWidth}"</td>
                      <td className="text-right p-2">
                        {cad.cadAverageMeters?.toFixed(3) || '-'}
                      </td>
                      <td className="text-right p-2">
                        {cad.cadAverageYards?.toFixed(3) || '-'}
                      </td>
                      <td className="text-right p-2">
                        {cad.cadWastagePercent?.toFixed(1)}%
                      </td>
                      <td className="text-right p-2">
                        {cad.markerEfficiency?.toFixed(1)}%
                      </td>
                      <td className="text-center p-2">
                        {cad.isPreferred && (
                          <Badge variant="default" className="text-xs">
                            Preferred
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
