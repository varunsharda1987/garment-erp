// Shared Process PO Create Form - works for both Dyeing and Printing
// Creates a Process PO from an approved lab dip
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, Loader2, Check, ChevronsUpDown, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { dyeLabDipService, dyeProcessPOService } from '@/services/dyeing.service';
import {
  labDipService as printLabDipService,
  processPOService as printProcessPOService,
} from '@/services/printing.service';
import { greigeStockService, type GreigeStockEntry } from '@/services/greigeStock.service';
import { styleService } from '@/services/style.service';
import type { DyeLabDip } from '@/types/dyeing.types';
import type { LabDip, CreateProcessPORequest } from '@/types/printing.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { cn } from '@/lib/utils';

export type ProcessType = 'DYEING' | 'PRINTING';

interface ProcessPOCreateFormProps {
  processType: ProcessType;
  backPath: string;
  title: string;
}

type AnyLabDip = DyeLabDip | LabDip;

export default function ProcessPOCreateForm({ processType, backPath, title }: ProcessPOCreateFormProps) {
  const navigate = useNavigate();

  // Lab dip selection
  const [labDipSearch, setLabDipSearch] = useState('');
  const [labDipOpen, setLabDipOpen] = useState(false);
  const [selectedLabDip, setSelectedLabDip] = useState<AnyLabDip | null>(null);

  // Greige stock selection
  const [greigeStockOpen, setGreigeStockOpen] = useState(false);
  const [selectedGreigeStock, setSelectedGreigeStock] = useState<GreigeStockEntry | null>(null);

  // Form fields
  const [qtySentMeters, setQtySentMeters] = useState<number>(0);
  const [greigeWidth, setGreigeWidth] = useState<number>(0); // Read-only display from greige stock
  const [expectedFinishedWidth, setExpectedFinishedWidth] = useState<number>(0); // From CAD or manual
  const [expectedShrinkage, setExpectedShrinkage] = useState<number>(0);
  const [agreedRatePerMeter, setAgreedRatePerMeter] = useState<number>(0);
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [remarks, setRemarks] = useState('');

  // Fetch approved lab dips
  const { data: approvedLabDips, isLoading: labDipsLoading } = useQuery({
    queryKey: ['approved-lab-dips', processType],
    queryFn: async () => {
      if (processType === 'DYEING') {
        return dyeLabDipService.getApprovedLabDips();
      } else {
        return printLabDipService.getApprovedLabDips();
      }
    },
  });

  // Filter lab dips by search
  const filteredLabDips = (approvedLabDips || []).filter((ld: AnyLabDip) => {
    if (!labDipSearch) return true;
    const search = labDipSearch.toLowerCase();
    return (
      ld.labDipNumber.toLowerCase().includes(search) ||
      ld.style?.styleCode?.toLowerCase().includes(search) ||
      ld.style?.styleName?.toLowerCase().includes(search)
    );
  });

  // Fetch available greige stock
  // Note: Greige stock is filtered by greigeId (not fabricId) - the fabric in lab dip is the finished spec
  const { data: greigeStockData, isLoading: greigeStockLoading } = useQuery({
    queryKey: ['available-greige-stock'],
    queryFn: () => greigeStockService.listAvailableStock({ excludeTransferred: true }),
    enabled: !!selectedLabDip,
  });

  // Fetch style with style_fabrics to get cutableWidth (expected finished width from CAD)
  const { data: styleData } = useQuery({
    queryKey: ['style-with-fabrics', selectedLabDip?.styleId],
    queryFn: () => styleService.getStyleById(selectedLabDip!.styleId),
    enabled: !!selectedLabDip?.styleId,
  });

  // When lab dip is selected, try to get expected width from CAD
  useEffect(() => {
    if (styleData && selectedLabDip) {
      // Find the style_fabric entry that matches the selected fabric
      const styleFabrics = (styleData as any).styleFabrics || (styleData as any).components || [];
      const matchingFabric = styleFabrics.find((sf: any) => sf.fabricId === selectedLabDip.fabricId);

      if (matchingFabric?.cutableWidth) {
        setExpectedFinishedWidth(Number(matchingFabric.cutableWidth));
      }
    }
  }, [styleData, selectedLabDip]);

  // When greige stock is selected, update greige width
  useEffect(() => {
    if (selectedGreigeStock) {
      const width = Number(selectedGreigeStock.greigeWidth || 0);
      setGreigeWidth(width);

      // Calculate shrinkage if we have both widths
      if (expectedFinishedWidth > 0 && width > 0) {
        const shrinkage = ((width - expectedFinishedWidth) / width) * 100;
        setExpectedShrinkage(Math.round(shrinkage * 100) / 100);
      }
    }
  }, [selectedGreigeStock, expectedFinishedWidth]);

  // Update shrinkage when expected finished width changes
  useEffect(() => {
    if (expectedFinishedWidth > 0 && greigeWidth > 0) {
      const shrinkage = ((greigeWidth - expectedFinishedWidth) / greigeWidth) * 100;
      setExpectedShrinkage(Math.round(shrinkage * 100) / 100);
    }
  }, [expectedFinishedWidth, greigeWidth]);

  const greigeStockItems = greigeStockData || [];

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateProcessPORequest) => {
      if (processType === 'DYEING') {
        return dyeProcessPOService.create(data);
      } else {
        return printProcessPOService.create(data);
      }
    },
    onSuccess: () => {
      handleApiSuccess('Process PO created successfully');
      navigate(backPath);
    },
    onError: (err) => handleApiError(err, 'Failed to create Process PO'),
  });

  const handleSubmit = () => {
    if (!selectedLabDip) {
      handleApiError(new Error('No lab dip'), 'Please select an approved lab dip');
      return;
    }
    if (!selectedGreigeStock) {
      handleApiError(new Error('No greige stock'), 'Please select a greige stock lot');
      return;
    }
    if (qtySentMeters <= 0) {
      handleApiError(new Error('Invalid quantity'), 'Please enter a valid quantity');
      return;
    }
    if (qtySentMeters > Number(selectedGreigeStock.quantityAvailable)) {
      handleApiError(new Error('Quantity exceeds available'), 'Quantity cannot exceed available stock');
      return;
    }
    if (expectedFinishedWidth <= 0) {
      handleApiError(new Error('Invalid width'), 'Please enter expected finished width');
      return;
    }
    if (agreedRatePerMeter < 0) {
      handleApiError(new Error('Invalid rate'), 'Please enter a valid rate');
      return;
    }

    const request: CreateProcessPORequest = {
      labDipId: selectedLabDip.id,
      greigeStockLotId: selectedGreigeStock.id,
      qtySentMeters,
      sentWidthInches: expectedFinishedWidth, // Store expected finished width as sentWidthInches
      agreedRatePerMeter,
      expectedReturnDate: expectedReturnDate || undefined,
      expectedShrinkage: expectedShrinkage || undefined,
      remarks: remarks || undefined,
    };

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
            <FileText className={cn('h-6 w-6', processType === 'DYEING' ? 'text-info' : 'text-accent')} />
            <h1 className="text-2xl font-display font-medium">{title}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Create a process PO from an approved lab dip</p>
        </div>
      </div>

      {/* Lab Dip Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Approved Lab Dip</CardTitle>
          <CardDescription>Select an approved lab dip to create a Process PO</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Popover open={labDipOpen} onOpenChange={setLabDipOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={labDipOpen} className="w-full justify-between">
                  {selectedLabDip ? (
                    <span className="truncate">
                      {selectedLabDip.labDipNumber} - {selectedLabDip.style?.styleCode}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Select approved lab dip...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[500px] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search by number or style..."
                    value={labDipSearch}
                    onValueChange={setLabDipSearch}
                  />
                  <CommandList>
                    {labDipsLoading && (
                      <div className="p-4 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    )}
                    <CommandEmpty>No approved lab dips found</CommandEmpty>
                    <CommandGroup>
                      {filteredLabDips.map((ld: AnyLabDip) => (
                        <CommandItem
                          key={ld.id}
                          value={ld.id}
                          onSelect={() => {
                            setSelectedLabDip(ld);
                            setSelectedGreigeStock(null);
                            setLabDipOpen(false);
                          }}
                        >
                          <Check
                            className={cn('mr-2 h-4 w-4', selectedLabDip?.id === ld.id ? 'opacity-100' : 'opacity-0')}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">{ld.labDipNumber}</span>
                            <span className="text-sm text-muted-foreground">
                              {ld.style?.styleCode} - {ld.style?.styleName} | {ld.processor?.name}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* Auto-filled info from lab dip */}
            {selectedLabDip && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Style</p>
                  <p className="text-sm font-medium">{selectedLabDip.style?.styleCode}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fabric</p>
                  <p className="text-sm font-medium">{selectedLabDip.fabric?.fabricCode}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Processor</p>
                  <p className="text-sm font-medium">{selectedLabDip.processor?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {processType === 'DYEING' ? 'Target Color' : 'Print Design'}
                  </p>
                  <p className="text-sm font-medium">
                    {processType === 'DYEING'
                      ? selectedLabDip.targetColor?.colorName || selectedLabDip.colorReference || '-'
                      : (selectedLabDip as LabDip).designArtwork || '-'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Greige Stock Selection */}
      {selectedLabDip && (
        <Card>
          <CardHeader>
            <CardTitle>Greige Stock Lot</CardTitle>
            <CardDescription>Select the greige stock lot to send for processing</CardDescription>
          </CardHeader>
          <CardContent>
            <Popover open={greigeStockOpen} onOpenChange={setGreigeStockOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={greigeStockOpen}
                  className="w-full justify-between"
                >
                  {selectedGreigeStock ? (
                    <span className="truncate">
                      {selectedGreigeStock.greige.greigeCode} -{' '}
                      {Number(selectedGreigeStock.quantityAvailable).toFixed(2)}m available
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Select greige stock lot...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[500px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search lots..." />
                  <CommandList>
                    {greigeStockLoading && (
                      <div className="p-4 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    )}
                    <CommandEmpty>No greige stock found for this fabric</CommandEmpty>
                    <CommandGroup>
                      {greigeStockItems.map((stock: GreigeStockEntry) => (
                        <CommandItem
                          key={stock.id}
                          value={stock.id}
                          onSelect={() => {
                            setSelectedGreigeStock(stock);
                            setGreigeStockOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedGreigeStock?.id === stock.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <div className="flex flex-col flex-1">
                            <div className="flex justify-between">
                              <span className="font-medium">{stock.greige.greigeCode}</span>
                              <span className="text-sm text-muted-foreground">
                                {Number(stock.quantityAvailable).toFixed(2)}m
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {stock.greige.greigeName} | Width: {Number(stock.greigeWidth || 0)}" |{' '}
                              {stock.warehouseLocation || 'Default'}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>
      )}

      {/* Quantity & Width */}
      {selectedGreigeStock && (
        <Card>
          <CardHeader>
            <CardTitle>Quantity & Width</CardTitle>
            <CardDescription>Specify quantity and expected finished width</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Expected Finished Width</strong> is what you want the fabric back at (from CAD planning). This
                is communicated to the vendor. Greige width is shown for reference.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="qtySentMeters">Quantity to Send (meters) *</Label>
                <Input
                  id="qtySentMeters"
                  type="number"
                  min={0}
                  step={0.01}
                  max={Number(selectedGreigeStock.quantityAvailable)}
                  value={qtySentMeters || ''}
                  onChange={(e) => setQtySentMeters(parseFloat(e.target.value) || 0)}
                  placeholder={`Max: ${Number(selectedGreigeStock.quantityAvailable).toFixed(2)}`}
                />
                <p className="text-xs text-muted-foreground">
                  Available: {Number(selectedGreigeStock.quantityAvailable).toFixed(2)}m
                </p>
              </div>

              <div className="space-y-2">
                <Label>Greige Width (inches)</Label>
                <Input value={greigeWidth || ''} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Read-only (from greige stock)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expectedFinishedWidth">Expected Finished Width (inches) *</Label>
                <Input
                  id="expectedFinishedWidth"
                  type="number"
                  min={0}
                  step={0.5}
                  value={expectedFinishedWidth || ''}
                  onChange={(e) => setExpectedFinishedWidth(parseFloat(e.target.value) || 0)}
                  placeholder="e.g., 44"
                />
                <p className="text-xs text-muted-foreground">
                  {expectedFinishedWidth > 0 && greigeWidth > 0
                    ? `This is stored as sentWidthInches`
                    : 'Pre-filled from CAD if available'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expectedShrinkage">Expected Shrinkage (%)</Label>
              <Input
                id="expectedShrinkage"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={expectedShrinkage || ''}
                onChange={(e) => setExpectedShrinkage(parseFloat(e.target.value) || 0)}
                placeholder="Auto-calculated from widths"
              />
              <p className="text-xs text-muted-foreground">Auto-calculated: ((Greige - Finished) / Greige) × 100</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rate & Schedule */}
      {selectedGreigeStock && (
        <Card>
          <CardHeader>
            <CardTitle>Rate & Schedule</CardTitle>
            <CardDescription>Processing rate and expected return date</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agreedRatePerMeter">Agreed Rate (per meter) *</Label>
                <Input
                  id="agreedRatePerMeter"
                  type="number"
                  min={0}
                  step={0.01}
                  value={agreedRatePerMeter || ''}
                  onChange={(e) => setAgreedRatePerMeter(parseFloat(e.target.value) || 0)}
                  placeholder="e.g., 25.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expectedReturnDate">Expected Return Date</Label>
                <Input
                  id="expectedReturnDate"
                  type="date"
                  value={expectedReturnDate}
                  onChange={(e) => setExpectedReturnDate(e.target.value)}
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
      )}

      {/* Summary (if all selected) */}
      {selectedLabDip && selectedGreigeStock && qtySentMeters > 0 && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Quantity</p>
                <p className="font-medium">{qtySentMeters.toFixed(2)}m</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expected Finished Width</p>
                <p className="font-medium">{expectedFinishedWidth}"</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rate</p>
                <p className="font-medium">₹{agreedRatePerMeter.toFixed(2)}/m</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estimated Cost</p>
                <p className="font-medium">₹{(qtySentMeters * agreedRatePerMeter).toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={() => navigate(backPath)}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={
            createMutation.isPending ||
            !selectedLabDip ||
            !selectedGreigeStock ||
            qtySentMeters <= 0 ||
            expectedFinishedWidth <= 0
          }
        >
          {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Create Process PO
        </Button>
      </div>
    </div>
  );
}
