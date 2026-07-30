// Processing Batch Create Form - Create new processing batch for greige/fabric/lace
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Layers, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import processingBatchService from '@/services/processingBatch.service';
import { greigeService, fabricService } from '@/services/fabricGreigeService';
import { getAllLace } from '@/services/lace.service';
import type { MaterialType, CreateProcessingBatchDTO } from '@/types/processing.types';
import type { GreigeMaster, FabricMaster } from '@/types/fabric-greige.types';
import type { Lace } from '@/types/lace.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

type MaterialItem = { id: string; code: string; name: string; composition?: string };

export default function ProcessingBatchCreateForm() {
  const navigate = useNavigate();

  // Form state
  const [materialType, setMaterialType] = useState<MaterialType>('GREIGE');
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialItem | null>(null);
  const [materialSearchOpen, setMaterialSearchOpen] = useState(false);
  const [materialSearch, setMaterialSearch] = useState('');
  const [totalQuantitySent, setTotalQuantitySent] = useState<number>(0);
  const [quantityInProcess, setQuantityInProcess] = useState<number>(0);
  const [colorToApply, setColorToApply] = useState('');
  const [expectedShrinkagePercent, setExpectedShrinkagePercent] = useState<number>(0);

  // Reset material selection when type changes
  const handleMaterialTypeChange = (value: MaterialType) => {
    setMaterialType(value);
    setSelectedMaterial(null);
    setMaterialSearch('');
    // Reset lace-specific fields
    if (value !== 'LACE') {
      setColorToApply('');
      setExpectedShrinkagePercent(0);
    }
  };

  // Fetch materials based on type
  const { data: greigeData, isLoading: greigeLoading } = useQuery({
    queryKey: ['greige-search', materialSearch],
    queryFn: () => greigeService.getAll({ search: materialSearch, limit: 20 }),
    enabled: materialType === 'GREIGE' && (materialSearchOpen || !!materialSearch),
  });

  const { data: fabricData, isLoading: fabricLoading } = useQuery({
    queryKey: ['fabric-search', materialSearch],
    queryFn: () => fabricService.getAll({ search: materialSearch, limit: 20 }),
    enabled: materialType === 'FABRIC' && (materialSearchOpen || !!materialSearch),
  });

  const { data: laceData, isLoading: laceLoading } = useQuery({
    queryKey: ['lace-search', materialSearch],
    queryFn: () => getAllLace({ search: materialSearch, limit: 20 }),
    enabled: materialType === 'LACE' && (materialSearchOpen || !!materialSearch),
  });

  // Transform materials to common format
  const getMaterials = (): MaterialItem[] => {
    if (materialType === 'GREIGE' && greigeData?.data) {
      return greigeData.data.map((g: GreigeMaster) => ({
        id: g.id,
        code: g.greigeCode,
        name: g.greigeName,
        composition: g.composition ?? undefined,
      }));
    }
    if (materialType === 'FABRIC' && fabricData?.data) {
      return fabricData.data.map((f: FabricMaster) => ({
        id: f.id,
        code: f.fabricCode,
        name: f.fabricName,
        composition: f.composition ?? undefined,
      }));
    }
    if (materialType === 'LACE' && laceData?.data) {
      return laceData.data.map((l: Lace) => ({
        id: l.id,
        code: l.laceCode,
        name: l.laceName,
        composition: l.composition ?? undefined,
      }));
    }
    return [];
  };

  const materials = getMaterials();
  const isSearchLoading = greigeLoading || fabricLoading || laceLoading;

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateProcessingBatchDTO) => processingBatchService.create(data),
    onSuccess: (batch) => {
      handleApiSuccess('Processing batch created successfully');
      navigate(`/processing/batches/${batch.id}`);
    },
    onError: (err) => handleApiError(err, 'Failed to create processing batch'),
  });

  // Handle form submission
  const handleSubmit = () => {
    if (!selectedMaterial) {
      handleApiError(new Error('No material selected'), 'Please select a material');
      return;
    }

    if (totalQuantitySent <= 0) {
      handleApiError(new Error('Invalid quantity'), 'Please enter quantity to send');
      return;
    }

    const request: CreateProcessingBatchDTO = {
      materialType,
      totalQuantitySent,
      quantityInProcess: quantityInProcess || totalQuantitySent,
    };

    // Set material ID based on type
    if (materialType === 'GREIGE') {
      request.greigeId = selectedMaterial.id;
    } else if (materialType === 'FABRIC') {
      request.fabricId = selectedMaterial.id;
    } else if (materialType === 'LACE') {
      request.laceId = selectedMaterial.id;
      if (colorToApply) request.colorToApply = colorToApply;
      if (expectedShrinkagePercent > 0) request.expectedShrinkagePercent = expectedShrinkagePercent;
    }

    createMutation.mutate(request);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/processing/batches')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <Layers className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-display font-medium">Create Processing Batch</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Send material for job work processing</p>
        </div>
      </div>

      {/* Material Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Material Type</CardTitle>
          <CardDescription>Select the type of material to process</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={materialType}
            onValueChange={(v) => handleMaterialTypeChange(v as MaterialType)}
            className="flex gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="GREIGE" id="greige" />
              <Label htmlFor="greige" className="cursor-pointer">
                Greige Fabric
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="FABRIC" id="fabric" />
              <Label htmlFor="fabric" className="cursor-pointer">
                Finished Fabric
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="LACE" id="lace" />
              <Label htmlFor="lace" className="cursor-pointer">
                Lace
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Material Selection */}
      <Card>
        <CardHeader>
          <CardTitle>
            Select {materialType === 'GREIGE' ? 'Greige' : materialType === 'FABRIC' ? 'Fabric' : 'Lace'}
          </CardTitle>
          <CardDescription>Search and select the material to send for processing</CardDescription>
        </CardHeader>
        <CardContent>
          <Popover open={materialSearchOpen} onOpenChange={setMaterialSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={materialSearchOpen}
                className="w-full justify-between"
              >
                {selectedMaterial ? (
                  <span>
                    {selectedMaterial.code} — {selectedMaterial.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Search for {materialType.toLowerCase()}...</span>
                )}
                <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[500px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder={`Search by code or name...`}
                  value={materialSearch}
                  onValueChange={setMaterialSearch}
                />
                <CommandList>
                  <CommandEmpty>{isSearchLoading ? 'Searching...' : 'No materials found.'}</CommandEmpty>
                  <CommandGroup>
                    {materials.map((material) => (
                      <CommandItem
                        key={material.id}
                        value={material.id}
                        onSelect={() => {
                          setSelectedMaterial(material);
                          setMaterialSearchOpen(false);
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{material.code}</span>
                          <span className="text-sm text-muted-foreground">
                            {material.name}
                            {material.composition && ` • ${material.composition}`}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Selected Material Summary */}
          {selectedMaterial && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Code</p>
                  <p className="font-medium font-mono">{selectedMaterial.code}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Name</p>
                  <p className="font-medium">{selectedMaterial.name}</p>
                </div>
                {selectedMaterial.composition && (
                  <div>
                    <p className="text-muted-foreground">Composition</p>
                    <p className="font-medium">{selectedMaterial.composition}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quantity Details */}
      {selectedMaterial && (
        <Card>
          <CardHeader>
            <CardTitle>Quantity Details</CardTitle>
            <CardDescription>Enter the quantity to send for processing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalQuantitySent">Total Quantity to Send (meters)</Label>
                <Input
                  id="totalQuantitySent"
                  type="number"
                  min={0}
                  step={0.01}
                  value={totalQuantitySent || ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setTotalQuantitySent(val);
                    setQuantityInProcess(val); // Auto-fill
                  }}
                  placeholder="Enter quantity"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantityInProcess">Quantity In Process (meters)</Label>
                <Input
                  id="quantityInProcess"
                  type="number"
                  min={0}
                  step={0.01}
                  value={quantityInProcess || ''}
                  onChange={(e) => setQuantityInProcess(parseFloat(e.target.value) || 0)}
                  placeholder="Usually same as sent"
                />
                <p className="text-xs text-muted-foreground">Defaults to total quantity sent</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lace-specific Fields */}
      {selectedMaterial && materialType === 'LACE' && (
        <Card>
          <CardHeader>
            <CardTitle>Lace Processing Details</CardTitle>
            <CardDescription>Additional details for lace processing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="colorToApply">Color to Apply</Label>
                <Input
                  id="colorToApply"
                  value={colorToApply}
                  onChange={(e) => setColorToApply(e.target.value)}
                  placeholder="e.g., Red, Navy Blue"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expectedShrinkagePercent">Expected Shrinkage (%)</Label>
                <Input
                  id="expectedShrinkagePercent"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={expectedShrinkagePercent || ''}
                  onChange={(e) => setExpectedShrinkagePercent(parseFloat(e.target.value) || 0)}
                  placeholder="e.g., 5"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {selectedMaterial && (
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => navigate('/processing/batches')}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending || totalQuantitySent <= 0}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Batch
          </Button>
        </div>
      )}
    </div>
  );
}
