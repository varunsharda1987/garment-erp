// Shared Lab Dip Create Form - works for both Dyeing and Printing
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Beaker, Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { styleService } from '@/services/style.service';
import { fabricService } from '@/services/fabricGreigeService';
import { getAllSuppliers } from '@/services/supplier.service';
import { colorService } from '@/services/colorService';
import { dyeLabDipService } from '@/services/dyeing.service';
import { labDipService as printLabDipService } from '@/services/printing.service';
import type { CreateLabDipRequest, PrintMethod, PrintChemistry } from '@/types/printing.types';
import type { Style } from '@/types/style.types';
import type { FabricMaster } from '@/types/fabric-greige.types';
import type { Supplier } from '@/types/supplier.types';
import type { ColorSearchResult } from '@/types/color.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { cn } from '@/lib/utils';

export type ProcessType = 'DYEING' | 'PRINTING';

interface LabDipCreateFormProps {
  processType: ProcessType;
  backPath: string;
  title: string;
}

// Print method and chemistry options
const PRINT_METHODS: { value: PrintMethod; label: string }[] = [
  { value: 'SCREEN_MACHINE', label: 'Screen Machine' },
  { value: 'SCREEN_HAND', label: 'Screen Hand' },
  { value: 'ROTARY', label: 'Rotary' },
  { value: 'BLOCK', label: 'Block' },
];

const PRINT_CHEMISTRIES: { value: PrintChemistry; label: string }[] = [
  { value: 'PIGMENT', label: 'Pigment' },
  { value: 'PROCIAN', label: 'Procian' },
  { value: 'DISCHARGE', label: 'Discharge' },
];

export default function LabDipCreateForm({ processType, backPath, title }: LabDipCreateFormProps) {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  // Style selection
  const [styleSearch, setStyleSearch] = useState('');
  const [styleOpen, setStyleOpen] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<Style | null>(null);

  // Fabric selection
  const [fabricSearch, setFabricSearch] = useState('');
  const [fabricOpen, setFabricOpen] = useState(false);
  const [selectedFabric, setSelectedFabric] = useState<FabricMaster | null>(null);

  // Processor selection
  const [processorSearch, setProcessorSearch] = useState('');
  const [processorOpen, setProcessorOpen] = useState(false);
  const [selectedProcessor, setSelectedProcessor] = useState<Supplier | null>(null);

  // Color selection (dyeing only)
  const [colorSearch, setColorSearch] = useState('');
  const [colorOpen, setColorOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<ColorSearchResult | null>(null);

  // Form fields
  const [colorReference, setColorReference] = useState('');
  const [designArtwork, setDesignArtwork] = useState('');
  const [printMethod, setPrintMethod] = useState<PrintMethod | ''>('');
  const [printChemistry, setPrintChemistry] = useState<PrintChemistry | ''>('');
  const [submissionDate, setSubmissionDate] = useState(today);
  const [expectedDate, setExpectedDate] = useState('');
  const [remarks, setRemarks] = useState('');

  // Style search query
  const { data: stylesData, isLoading: stylesLoading } = useQuery({
    queryKey: ['styles-search', styleSearch],
    queryFn: () => styleService.getAllStyles(1, 20, styleSearch),
    enabled: styleOpen || styleSearch.length >= 2,
  });

  // Fabric search query
  const { data: fabricsData, isLoading: fabricsLoading } = useQuery({
    queryKey: ['fabrics-search', fabricSearch],
    queryFn: () => fabricService.getAll({ search: fabricSearch, limit: 20 }),
    enabled: fabricOpen || fabricSearch.length >= 2,
  });

  // Processor search query (filter by DYEING_PRINTING category)
  const { data: processorsData, isLoading: processorsLoading } = useQuery({
    queryKey: ['processors-search', processorSearch],
    queryFn: () => getAllSuppliers({ search: processorSearch, category: 'DYEING_PRINTING', limit: 20 }),
    enabled: processorOpen || processorSearch.length >= 2,
  });

  // Color search query (dyeing only)
  const { data: colorsData, isLoading: colorsLoading } = useQuery({
    queryKey: ['colors-search', colorSearch],
    queryFn: () => colorService.search({ search: colorSearch, limit: 20 }),
    enabled: processType === 'DYEING' && (colorOpen || colorSearch.length >= 2),
  });

  // Transform data
  const styles = stylesData?.data || [];
  const fabrics = fabricsData?.data || [];
  const processors = processorsData?.data || [];
  const colors = colorsData || [];

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateLabDipRequest) => {
      if (processType === 'DYEING') {
        return dyeLabDipService.createLabDip({
          processType: 'DYEING',
          styleId: data.styleId,
          fabricId: data.fabricId,
          processorId: data.processorId,
          submissionDate: data.submissionDate,
          expectedDate: data.expectedDate,
          targetColorId: data.targetColorId,
          colorReference: data.colorReference,
          remarks: data.remarks,
        });
      } else {
        return printLabDipService.createLabDip({
          processType: 'PRINTING',
          styleId: data.styleId,
          fabricId: data.fabricId,
          processorId: data.processorId,
          submissionDate: data.submissionDate,
          expectedDate: data.expectedDate,
          designArtwork: data.designArtwork,
          printMethod: data.printMethod,
          printChemistry: data.printChemistry,
          remarks: data.remarks,
        });
      }
    },
    onSuccess: () => {
      handleApiSuccess(`${processType === 'DYEING' ? 'Dye' : 'Print'} lab dip created successfully`);
      navigate(backPath);
    },
    onError: (err) => handleApiError(err, 'Failed to create lab dip'),
  });

  const handleSubmit = () => {
    if (!selectedStyle) {
      handleApiError(new Error('No style selected'), 'Please select a style');
      return;
    }
    if (!selectedFabric) {
      handleApiError(new Error('No fabric selected'), 'Please select a fabric');
      return;
    }
    if (!selectedProcessor) {
      handleApiError(new Error('No processor selected'), 'Please select a processor/mill');
      return;
    }
    if (!submissionDate) {
      handleApiError(new Error('No submission date'), 'Please select a submission date');
      return;
    }

    // Printing-specific validation
    if (processType === 'PRINTING') {
      if (!printMethod) {
        handleApiError(new Error('No print method'), 'Please select a print method');
        return;
      }
      if (!printChemistry) {
        handleApiError(new Error('No print chemistry'), 'Please select a print chemistry');
        return;
      }
    }

    const request: CreateLabDipRequest = {
      processType,
      styleId: selectedStyle.id,
      fabricId: selectedFabric.id,
      processorId: selectedProcessor.id,
      submissionDate,
      expectedDate: expectedDate || undefined,
      remarks: remarks || undefined,
    };

    // Add process-specific fields
    if (processType === 'DYEING') {
      request.targetColorId = selectedColor?.id;
      request.colorReference = colorReference || undefined;
    } else {
      request.designArtwork = designArtwork || undefined;
      request.printMethod = printMethod as PrintMethod;
      request.printChemistry = printChemistry as PrintChemistry;
    }

    createMutation.mutate(request);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(backPath)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <Beaker className={cn('h-6 w-6', processType === 'DYEING' ? 'text-info' : 'text-accent')} />
            <h1 className="text-2xl font-display font-medium">{title}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Submit a lab dip sample for approval</p>
        </div>
      </div>

      {/* Style & Fabric Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Style & Fabric</CardTitle>
          <CardDescription>Select the style and fabric for this lab dip</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Style Selector */}
            <div className="space-y-2">
              <Label>Style *</Label>
              <Popover open={styleOpen} onOpenChange={setStyleOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={styleOpen}
                    className="w-full justify-between"
                  >
                    {selectedStyle ? (
                      <span className="truncate">
                        {selectedStyle.styleCode} - {selectedStyle.styleName}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Search styles...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search by code or name..."
                      value={styleSearch}
                      onValueChange={setStyleSearch}
                    />
                    <CommandList>
                      {stylesLoading && (
                        <div className="p-4 flex items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      )}
                      <CommandEmpty>No styles found</CommandEmpty>
                      <CommandGroup>
                        {styles.map((style: Style) => (
                          <CommandItem
                            key={style.id}
                            value={style.id}
                            onSelect={() => {
                              setSelectedStyle(style);
                              setStyleOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedStyle?.id === style.id ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">{style.styleCode}</span>
                              <span className="text-sm text-muted-foreground">{style.styleName}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Fabric Selector */}
            <div className="space-y-2">
              <Label>Fabric *</Label>
              <Popover open={fabricOpen} onOpenChange={setFabricOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={fabricOpen}
                    className="w-full justify-between"
                  >
                    {selectedFabric ? (
                      <span className="truncate">
                        {selectedFabric.fabricCode} - {selectedFabric.fabricName}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Search fabrics...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search by code or name..."
                      value={fabricSearch}
                      onValueChange={setFabricSearch}
                    />
                    <CommandList>
                      {fabricsLoading && (
                        <div className="p-4 flex items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      )}
                      <CommandEmpty>No fabrics found</CommandEmpty>
                      <CommandGroup>
                        {fabrics.map((fabric: FabricMaster) => (
                          <CommandItem
                            key={fabric.id}
                            value={fabric.id}
                            onSelect={() => {
                              setSelectedFabric(fabric);
                              setFabricOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedFabric?.id === fabric.id ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">{fabric.fabricCode}</span>
                              <span className="text-sm text-muted-foreground">{fabric.fabricName}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Processor Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Processor / Mill</CardTitle>
          <CardDescription>Select the processor who will handle this job</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Processor *</Label>
            <Popover open={processorOpen} onOpenChange={setProcessorOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={processorOpen}
                  className="w-full justify-between max-w-md"
                >
                  {selectedProcessor ? (
                    <span className="truncate">
                      {selectedProcessor.code} - {selectedProcessor.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Search processors...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search by code or name..."
                    value={processorSearch}
                    onValueChange={setProcessorSearch}
                  />
                  <CommandList>
                    {processorsLoading && (
                      <div className="p-4 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    )}
                    <CommandEmpty>No processors found</CommandEmpty>
                    <CommandGroup>
                      {processors.map((processor: Supplier) => (
                        <CommandItem
                          key={processor.id}
                          value={processor.id}
                          onSelect={() => {
                            setSelectedProcessor(processor);
                            setProcessorOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedProcessor?.id === processor.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">{processor.code}</span>
                            <span className="text-sm text-muted-foreground">{processor.name}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Process-Specific Fields */}
      <Card>
        <CardHeader>
          <CardTitle>{processType === 'DYEING' ? 'Color Details' : 'Print Details'}</CardTitle>
          <CardDescription>
            {processType === 'DYEING' ? 'Specify the target color for dyeing' : 'Specify the print design and method'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {processType === 'DYEING' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Target Color Selector */}
              <div className="space-y-2">
                <Label>Target Color</Label>
                <Popover open={colorOpen} onOpenChange={setColorOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={colorOpen}
                      className="w-full justify-between"
                    >
                      {selectedColor ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded border"
                            style={{ backgroundColor: selectedColor.hexCode || '#ccc' }}
                          />
                          <span className="truncate">
                            {selectedColor.colorCode} - {selectedColor.colorName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Search colors...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search by code or name..."
                        value={colorSearch}
                        onValueChange={setColorSearch}
                      />
                      <CommandList>
                        {colorsLoading && (
                          <div className="p-4 flex items-center justify-center">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        )}
                        <CommandEmpty>No colors found</CommandEmpty>
                        <CommandGroup>
                          {colors.map((color: ColorSearchResult) => (
                            <CommandItem
                              key={color.id}
                              value={color.id}
                              onSelect={() => {
                                setSelectedColor(color);
                                setColorOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  selectedColor?.id === color.id ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              <div
                                className="w-4 h-4 rounded border mr-2"
                                style={{ backgroundColor: color.hexCode || '#ccc' }}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">{color.colorCode}</span>
                                <span className="text-sm text-muted-foreground">{color.colorName}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Color Reference (Pantone) */}
              <div className="space-y-2">
                <Label htmlFor="colorReference">Color Reference (Pantone)</Label>
                <Input
                  id="colorReference"
                  value={colorReference}
                  onChange={(e) => setColorReference(e.target.value)}
                  placeholder="e.g., PANTONE 19-4052 TCX"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="designArtwork">Design/Artwork Name</Label>
                <Input
                  id="designArtwork"
                  value={designArtwork}
                  onChange={(e) => setDesignArtwork(e.target.value)}
                  placeholder="e.g., Floral Pattern A1"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Print Method *</Label>
                  <Select value={printMethod} onValueChange={(v) => setPrintMethod(v as PrintMethod)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select print method" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRINT_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Print Chemistry *</Label>
                  <Select value={printChemistry} onValueChange={(v) => setPrintChemistry(v as PrintChemistry)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select print chemistry" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRINT_CHEMISTRIES.map((chem) => (
                        <SelectItem key={chem.value} value={chem.value}>
                          {chem.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dates & Remarks */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule & Notes</CardTitle>
          <CardDescription>Submission dates and additional remarks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="submissionDate">Submission Date *</Label>
              <Input
                id="submissionDate"
                type="date"
                value={submissionDate}
                onChange={(e) => setSubmissionDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expectedDate">Expected Date</Label>
              <Input
                id="expectedDate"
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any additional notes or instructions..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => navigate(backPath)}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={createMutation.isPending || !selectedStyle || !selectedFabric || !selectedProcessor}
        >
          {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Create Lab Dip
        </Button>
      </div>
    </div>
  );
}
