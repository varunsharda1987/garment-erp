import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Trash2, Plus } from 'lucide-react';

interface FabricInputSectionProps {
  fabrics: Array<{
    genericGreigeName: string;
    fabricFinishType: 'DYED' | 'PRINTED' | 'BOTH' | '';
  }>;
  genericGreigeNames: string[];
  onFabricChange: (index: number, field: 'genericGreigeName' | 'fabricFinishType', value: string) => void;
  onAddFabric: () => void;
  onRemoveFabric: (index: number) => void;
}

export function FabricInputSection({
  fabrics,
  genericGreigeNames,
  onFabricChange,
  onAddFabric,
  onRemoveFabric,
}: FabricInputSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Fabrics</h3>
        <p className="text-sm text-muted-foreground">
          Select generic fabric names. CAD planning will happen after style creation.
        </p>
      </div>

      {fabrics.map((fabric, index) => (
        <div key={index} className="border rounded-lg p-4 space-y-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Fabric {index + 1}</h4>
            {fabrics.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemoveFabric(index)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Generic Greige Name */}
            <div className="space-y-2">
              <Label htmlFor={`fabric-name-${index}`}>
                Generic Greige Name <span className="text-red-500">*</span>
              </Label>
              <Select
                value={fabric.genericGreigeName}
                onValueChange={(value) => onFabricChange(index, 'genericGreigeName', value)}
              >
                <SelectTrigger id={`fabric-name-${index}`}>
                  <SelectValue placeholder="Select fabric type (e.g., Cotton Cambric)" />
                </SelectTrigger>
                <SelectContent>
                  {genericGreigeNames.length === 0 ? (
                    <SelectItem value="loading" disabled>
                      Loading fabrics...
                    </SelectItem>
                  ) : (
                    genericGreigeNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose generic fabric type. Specific greige will be selected during CAD planning.
              </p>
            </div>

            {/* Fabric Finish Type */}
            <div className="space-y-2">
              <Label>
                Finish Type <span className="text-red-500">*</span>
              </Label>
              <RadioGroup
                value={fabric.fabricFinishType}
                onValueChange={(value) => onFabricChange(index, 'fabricFinishType', value)}
                className="flex flex-col space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="DYED" id={`dyed-${index}`} />
                  <Label htmlFor={`dyed-${index}`} className="font-normal cursor-pointer">
                    Dyed Fabric
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PRINTED" id={`printed-${index}`} />
                  <Label htmlFor={`printed-${index}`} className="font-normal cursor-pointer">
                    Printed Fabric
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="BOTH" id={`both-${index}`} />
                  <Label htmlFor={`both-${index}`} className="font-normal cursor-pointer">
                    Both (Mixed Dyed & Printed)
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                Select finish type for CAD grouping and cost calculation.
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Fabric width selection and CAD calculations will be done in the CAD Planning tab after creating this style.
            </p>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={onAddFabric}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Another Fabric
      </Button>
    </div>
  );
}
