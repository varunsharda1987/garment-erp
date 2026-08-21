// Shared Job Work Order Create Form - works for both Dyeing and Printing
// Creates a Job Work Order from an approved lab dip OR directly from style+fabric+processor
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, Loader2, Check, ChevronsUpDown, Info, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { dyeLabDipService, dyeProcessPOService } from '@/services/dyeing.service';
import { processorRateCardV2Service } from '@/services/processorRateCardV2.service';
import {
  labDipService as printLabDipService,
  processPOService as printProcessPOService,
} from '@/services/printing.service';
import { greigeStockService, type GreigeStockEntry } from '@/services/greigeStock.service';
import { styleService } from '@/services/style.service';
import { fabricService } from '@/services/fabricGreigeService';
import { getAllSuppliers } from '@/services/supplier.service';
import { useDefaultSettings } from '@/hooks/useDefaultSettings';
import type { DyeLabDip } from '@/types/dyeing.types';
import type { LabDip, CreateProcessPORequest } from '@/types/printing.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { cn } from '@/lib/utils';
import { formatStyleCodeWithRef } from '@/utils/style-ref-format';

type CreateMode = 'lab-dip' | 'style-based';

export type ProcessType = 'DYEING' | 'PRINTING';

interface ProcessPOCreateFormProps {
  processType: ProcessType;
  backPath: string;
  title: string;
}

type AnyLabDip = DyeLabDip | LabDip;

export default function ProcessPOCreateForm({ processType, backPath, title }: ProcessPOCreateFormProps) {
  const navigate = useNavigate();

  // Mode: lab-dip (from approved lab dip) or style-based (direct style+fabric+processor)
  const [createMode, setCreateMode] = useState<CreateMode>('lab-dip');

  // Lab dip selection (lab-dip mode)
  const [labDipSearch, setLabDipSearch] = useState('');
  const [labDipOpen, setLabDipOpen] = useState(false);
  const [selectedLabDip, setSelectedLabDip] = useState<AnyLabDip | null>(null);

  // Style-based selection (style-based mode)
  const [styleSearch, setStyleSearch] = useState('');
  const [styleOpen, setStyleOpen] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<any | null>(null);

  // All fabrics from style (unified view - both DYED and PRINTED)
  const [styleFabrics, setStyleFabrics] = useState<any[]>([]);
  const [selectedStyleFabric, setSelectedStyleFabric] = useState<any | null>(null);
  const [isLoadingStyleFabrics, setIsLoadingStyleFabrics] = useState(false);

  // Fabric selection - styleFabrics table with fallback to search all fabrics
  const [useOtherFabric, setUseOtherFabric] = useState(false);
  const [fabricSearch, setFabricSearch] = useState('');
  const [fabricOpen, setFabricOpen] = useState(false);
  const [selectedFabric, setSelectedFabric] = useState<any | null>(null);

  const [processorSearch, setProcessorSearch] = useState('');
  const [processorOpen, setProcessorOpen] = useState(false);
  const [selectedProcessor, setSelectedProcessor] = useState<any | null>(null);

  // Greige stock selection
  const [greigeStockOpen, setGreigeStockOpen] = useState(false);
  const [selectedGreigeStock, setSelectedGreigeStock] = useState<GreigeStockEntry | null>(null);

  // Form fields
  const [qtySentMeters, setQtySentMeters] = useState<number>(0);
  const [greigeWidth, setGreigeWidth] = useState<number>(0); // Read-only display from greige stock
  const [expectedFinishedWidth, setExpectedFinishedWidth] = useState<number>(0); // From CAD or manual
  // Industry model (2026-08-18): the processor is asked for a FINISHED (stenter) width =
  // CAD cutable width + selvedge deduction. Prefilling the bare cutable width under-asks
  // by the deduction and the marker no longer fits.
  const { cutableWidthDeduction } = useDefaultSettings();
  const [expectedShrinkage, setExpectedShrinkage] = useState<number>(0);
  // MRP-48g: true once the processor rate card has supplied the shrinkage.
  const [shrinkageFromRateCard, setShrinkageFromRateCard] = useState(false);
  const [agreedRatePerMeter, setAgreedRatePerMeter] = useState<number>(0);
  const [isRateTbd, setIsRateTbd] = useState(false); // Explicit TBD when rate=0 is intentional
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [remarks, setRemarks] = useState('');

  // Track which submit action is in progress
  const [submitAction, setSubmitAction] = useState<'create' | 'create-send' | null>(null);

  // Reset selections when mode changes
  const handleModeChange = (mode: CreateMode) => {
    setCreateMode(mode);
    setSelectedLabDip(null);
    setSelectedStyle(null);
    setSelectedFabric(null);
    setSelectedProcessor(null);
    setSelectedGreigeStock(null);
    setQtySentMeters(0);
    setExpectedFinishedWidth(0);
    setExpectedShrinkage(0);
    setAgreedRatePerMeter(0);
    setIsRateTbd(false);
    setExpectedReturnDate('');
    setRemarks('');
  };

  // Fetch approved lab dips (for lab-dip mode)
  const { data: approvedLabDips, isLoading: labDipsLoading } = useQuery({
    queryKey: ['approved-lab-dips', processType],
    queryFn: async () => {
      if (processType === 'DYEING') {
        return dyeLabDipService.getApprovedLabDips();
      } else {
        return printLabDipService.getApprovedLabDips();
      }
    },
    enabled: createMode === 'lab-dip',
  });

  // Fetch styles (for style-based mode)
  const { data: stylesResponse, isLoading: stylesLoading } = useQuery({
    queryKey: ['styles-search', styleSearch],
    queryFn: () => styleService.getAllStyles(1, 20, styleSearch),
    enabled: createMode === 'style-based',
  });
  const stylesData = stylesResponse?.data || [];

  // Fetch fabrics (for searching all fabrics when "other" is selected)
  const { data: fabricsData, isLoading: fabricsLoading } = useQuery({
    queryKey: ['fabrics-search', fabricSearch],
    queryFn: () => fabricService.getAll({ search: fabricSearch, limit: 20 }),
    enabled: createMode === 'style-based' && useOtherFabric && fabricSearch.length >= 2,
  });

  // Fetch processors (mills for dyeing/printing)
  // Enable when style + fabric (from styleFabrics OR searched fabric) is selected
  const hasFabricSelected = !!selectedStyleFabric || !!selectedFabric;
  const { data: processorsResponse, isLoading: processorsLoading } = useQuery({
    queryKey: ['processors-search', processorSearch],
    queryFn: () =>
      getAllSuppliers({
        search: processorSearch,
        category: 'DYEING_PRINTING', // Both dyeing and printing use same processor category
        limit: 20,
      }),
    enabled: createMode === 'style-based' && !!selectedStyle && hasFabricSelected,
  });
  const processorsData = processorsResponse?.data || [];

  // Filter lab dips by search
  const filteredLabDips = (approvedLabDips || []).filter((ld: AnyLabDip) => {
    if (!labDipSearch) return true;
    const search = labDipSearch.toLowerCase();
    return (
      ld.labDipNumber.toLowerCase().includes(search) ||
      ld.style?.styleCode?.toLowerCase().includes(search) ||
      ld.style?.styleName?.toLowerCase().includes(search) ||
      ld.style?.buyerStyleRef?.toLowerCase().includes(search)
    );
  });

  // Fetch available greige stock
  // Note: Greige stock is filtered by greigeId (not fabricId) - the fabric in lab dip is the finished spec
  const shouldShowGreigeStock =
    createMode === 'lab-dip' ? !!selectedLabDip : !!selectedStyle && hasFabricSelected && !!selectedProcessor;

  const { data: greigeStockData, isLoading: greigeStockLoading } = useQuery({
    queryKey: ['available-greige-stock'],
    queryFn: () => greigeStockService.listAvailableStock({ excludeTransferred: true }),
    enabled: shouldShowGreigeStock,
  });

  // Fetch style with style_fabrics to get cutableWidth (expected finished width from CAD)
  const styleIdForFetch = createMode === 'lab-dip' ? selectedLabDip?.styleId : selectedStyle?.id;
  const { data: styleData } = useQuery({
    queryKey: ['style-with-fabrics', styleIdForFetch],
    queryFn: () => styleService.getStyleById(styleIdForFetch!),
    enabled: !!styleIdForFetch,
  });

  // Extract all style fabrics when style is selected (unified view)
  useEffect(() => {
    if (selectedStyle && createMode === 'style-based') {
      setIsLoadingStyleFabrics(true);
      styleService
        .getStyleById(selectedStyle.id)
        .then((fullStyle: any) => {
          const rows: any[] = [];
          const components = fullStyle.components || []; // serializer converts style_components → components

          for (const comp of components) {
            const compFabrics = comp.fabrics || []; // serializer converts style_fabrics → fabrics
            for (const sf of compFabrics) {
              const finishType = sf.fabricFinishType as 'DYED' | 'PRINTED';
              if (finishType === 'DYED' || finishType === 'PRINTED') {
                rows.push({
                  ...sf,
                  _componentType: comp.componentType,
                  _componentName: comp.componentMaster?.name || comp.componentType,
                  _processType: finishType === 'DYED' ? 'DYEING' : 'PRINTING',
                });
              }
            }
          }
          setStyleFabrics(rows);
        })
        .finally(() => setIsLoadingStyleFabrics(false));
    } else {
      setStyleFabrics([]);
      setSelectedStyleFabric(null);
    }
  }, [selectedStyle, createMode]);

  // When a style fabric is selected, set the fabric and derive process type
  useEffect(() => {
    if (selectedStyleFabric) {
      // Set the fabric for compatibility with existing form logic
      if (selectedStyleFabric.fabric) {
        setSelectedFabric(selectedStyleFabric.fabric);
      } else if (selectedStyleFabric.fabricId) {
        setSelectedFabric({
          id: selectedStyleFabric.fabricId,
          fabricCode: selectedStyleFabric.fabricName || 'Unknown',
          fabricName: selectedStyleFabric.fabricName || 'Unknown',
        });
      }
      // Asked finished width = CAD cutable width + selvedge deduction (NOT bare cutable —
      // finishing at the cutable width would leave too little after selvedge trim).
      // Wait for the deduction to load rather than prefilling with a guessed number —
      // this width is sent to the processor and persisted.
      if (selectedStyleFabric.cutableWidth && cutableWidthDeduction != null) {
        setExpectedFinishedWidth(Number(selectedStyleFabric.cutableWidth) + cutableWidthDeduction);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStyleFabric]);

  // When lab dip or style+fabric is selected, try to get expected width from CAD
  useEffect(() => {
    // The selvedge deduction is a persisted input, so hold off until it has loaded.
    if (cutableWidthDeduction == null) return;

    // For style-based mode, prefer styleFabric (already has cutableWidth) over searched fabric
    if (createMode === 'style-based' && selectedStyleFabric?.cutableWidth) {
      setExpectedFinishedWidth(Number(selectedStyleFabric.cutableWidth) + cutableWidthDeduction);
      return;
    }

    const fabricIdToMatch = createMode === 'lab-dip' ? selectedLabDip?.fabricId : selectedFabric?.id;
    if (styleData && fabricIdToMatch) {
      // Find the style_fabric entry that matches the selected fabric
      // Serializer maps style_fabrics → fabrics
      const fabrics = (styleData as any).fabrics || (styleData as any).components || [];
      const matchingFabric = fabrics.find((sf: any) => sf.fabricId === fabricIdToMatch);

      if (matchingFabric?.cutableWidth) {
        setExpectedFinishedWidth(Number(matchingFabric.cutableWidth) + cutableWidthDeduction);
      }
    }
  }, [styleData, selectedLabDip, selectedFabric, selectedStyleFabric, createMode, cutableWidthDeduction]);

  // When greige stock is selected, update greige width
  useEffect(() => {
    if (selectedGreigeStock) {
      setGreigeWidth(Number(selectedGreigeStock.greigeWidth || 0));
    }
  }, [selectedGreigeStock]);

  // Shrinkage comes ONLY from the processor's rate card (single source of truth) or a
  // deliberate manual entry. The old width-delta formula ((greige−finished)/greige, e.g.
  // 14.3% for a 63"→54" job whose real rate-card shrinkage is 8%) measured WIDTH change
  // and had nothing to do with length shrinkage — removed 2026-08-18.

  const greigeStockItems = greigeStockData || [];

  // Derive effective process type from selected style fabric or prop
  const effectiveProcessType =
    createMode === 'style-based' && selectedStyleFabric?._processType ? selectedStyleFabric._processType : processType;

  // MRP-48g: the processor's rate card is the source of truth for shrinkage — it is what the
  // job work order holds them to and what MRP buys against. No card → the field stays at the
  // user's manual entry (0 by default) with a visible warning; nothing is invented.
  useEffect(() => {
    let cancelled = false;
    const greigeId = selectedGreigeStock?.greigeId;
    const processorId = selectedProcessor?.id;
    if (!greigeId || !processorId) return;
    (async () => {
      try {
        const rate = await processorRateCardV2Service.lookupRate(
          processorId,
          effectiveProcessType as 'DYEING' | 'PRINTING',
          greigeId,
          qtySentMeters || 1
        );
        if (!cancelled && rate?.shrinkagePercent != null) {
          setExpectedShrinkage(rate.shrinkagePercent);
          setShrinkageFromRateCard(true);
        } else if (!cancelled) {
          setShrinkageFromRateCard(false);
        }
      } catch {
        if (!cancelled) setShrinkageFromRateCard(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedGreigeStock, selectedProcessor, effectiveProcessType, qtySentMeters]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateProcessPORequest) => {
      if (effectiveProcessType === 'DYEING') {
        return dyeProcessPOService.create(data);
      } else {
        return printProcessPOService.create(data);
      }
    },
    onSuccess: (created) => {
      handleApiSuccess(
        created?.poNumber
          ? `Job work order ${created.poNumber} created successfully`
          : 'Job work order created successfully'
      );
      navigate(backPath);
    },
    onError: (err) => handleApiError(err, 'Failed to create job work order'),
  });

  const handleSubmit = (autoSend = false) => {
    // Track which action was clicked
    setSubmitAction(autoSend ? 'create-send' : 'create');

    // Validate based on mode
    if (createMode === 'lab-dip') {
      if (!selectedLabDip) {
        handleApiError(new Error('No lab dip'), 'Please select an approved lab dip');
        return;
      }
    } else {
      if (!selectedStyle) {
        handleApiError(new Error('No style'), 'Please select a style');
        return;
      }
      if (!selectedStyleFabric && !selectedFabric) {
        handleApiError(new Error('No fabric'), 'Please select a fabric from the table');
        return;
      }
      if (!selectedProcessor) {
        handleApiError(new Error('No processor'), 'Please select a processor/mill');
        return;
      }
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

    const request: CreateProcessPORequest =
      createMode === 'lab-dip'
        ? {
            labDipId: selectedLabDip!.id,
            greigeStockLotId: selectedGreigeStock.id,
            qtySentMeters,
            sentWidthInches: expectedFinishedWidth,
            agreedRatePerMeter,
            isRateTbd,
            expectedReturnDate: expectedReturnDate || undefined,
            expectedShrinkage: expectedShrinkage || undefined,
            remarks: remarks || undefined,
            autoSend,
          }
        : {
            // Style-based PO (no lab dip)
            styleId: selectedStyle!.id,
            fabricId: selectedStyleFabric?.fabricId || selectedFabric!.id,
            processorId: selectedProcessor!.id,
            greigeStockLotId: selectedGreigeStock.id,
            qtySentMeters,
            sentWidthInches: expectedFinishedWidth,
            agreedRatePerMeter,
            isRateTbd,
            expectedReturnDate: expectedReturnDate || undefined,
            expectedShrinkage: expectedShrinkage || undefined,
            remarks: remarks || undefined,
            autoSend,
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
          <p className="text-sm text-muted-foreground mt-1">
            {createMode === 'lab-dip'
              ? 'Create a job work order from an approved lab dip'
              : 'Create a job work order directly from style, fabric, and processor'}
          </p>
        </div>
      </div>

      {/* Mode Toggle */}
      <Card>
        <CardHeader>
          <CardTitle>Creation Mode</CardTitle>
          <CardDescription>
            Choose whether to create from an approved lab dip or directly from style selection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={createMode} onValueChange={(v) => handleModeChange(v as CreateMode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="lab-dip">From Approved Lab Dip</TabsTrigger>
              <TabsTrigger value="style-based">Direct (Style-Based)</TabsTrigger>
            </TabsList>
          </Tabs>
          {createMode === 'style-based' && (
            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Style-based job work creation bypasses the lab dip approval process. Use this when you need to proceed
                without waiting for buyer approval.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Lab Dip Selection (lab-dip mode) */}
      {createMode === 'lab-dip' && (
        <Card>
          <CardHeader>
            <CardTitle>Approved Lab Dip</CardTitle>
            <CardDescription>Select an approved lab dip to create a job work order</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Popover open={labDipOpen} onOpenChange={setLabDipOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={labDipOpen}
                    className="w-full justify-between"
                  >
                    {selectedLabDip ? (
                      <span className="truncate">
                        {selectedLabDip.labDipNumber} -{' '}
                        {formatStyleCodeWithRef(
                          selectedLabDip.style?.styleCode || '',
                          selectedLabDip.style?.buyerStyleRef
                        )}
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
                                {formatStyleCodeWithRef(ld.style?.styleCode || '', ld.style?.buyerStyleRef)} -{' '}
                                {ld.style?.styleName} | {ld.processor?.name}
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
                    <p className="text-sm font-medium">
                      {formatStyleCodeWithRef(
                        selectedLabDip.style?.styleCode || '',
                        selectedLabDip.style?.buyerStyleRef
                      )}
                    </p>
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
      )}

      {/* Style-Based Selection (style-based mode) */}
      {createMode === 'style-based' && (
        <Card>
          <CardHeader>
            <CardTitle>Style, Fabric & Processor</CardTitle>
            <CardDescription>Select style, fabric, and processor to create a direct job work order</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                        {formatStyleCodeWithRef(selectedStyle.styleCode, selectedStyle.buyerStyleRef)} -{' '}
                        {selectedStyle.styleName}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Select style...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="Search styles..." value={styleSearch} onValueChange={setStyleSearch} />
                    <CommandList>
                      {stylesLoading && (
                        <div className="p-4 flex items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      )}
                      <CommandEmpty>No styles found</CommandEmpty>
                      <CommandGroup>
                        {(stylesData || []).map((style: any) => (
                          <CommandItem
                            key={style.id}
                            value={style.id}
                            onSelect={() => {
                              setSelectedStyle(style);
                              setSelectedFabric(null);
                              setSelectedProcessor(null);
                              setSelectedGreigeStock(null);
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
                              <span className="font-medium">
                                {formatStyleCodeWithRef(style.styleCode, style.buyerStyleRef)}
                              </span>
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

            {/* Fabric Table - Unified view showing all fabrics from style */}
            {selectedStyle && (
              <div className="space-y-2 col-span-2">
                <Label>Select Fabric *</Label>
                {isLoadingStyleFabrics ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : styleFabrics.length === 0 || useOtherFabric ? (
                  // No style fabrics OR user chose to search other fabrics
                  <div className="space-y-2">
                    {useOtherFabric && styleFabrics.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setUseOtherFabric(false);
                          setSelectedFabric(null);
                        }}
                        className="text-xs text-muted-foreground"
                      >
                        ← Back to style fabrics
                      </Button>
                    )}
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
                      <PopoverContent className="w-[500px] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Search fabrics..."
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
                              {(fabricsData?.data || []).map((fabric: any) => (
                                <CommandItem
                                  key={fabric.id}
                                  value={fabric.id}
                                  onSelect={() => {
                                    setSelectedFabric(fabric);
                                    setSelectedStyleFabric(null);
                                    setSelectedProcessor(null);
                                    setSelectedGreigeStock(null);
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
                    {styleFabrics.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No fabrics defined in style. Search all fabrics above.
                      </p>
                    )}
                  </div>
                ) : (
                  // Show style fabrics table with "Search other..." option
                  <div className="space-y-2">
                    <div className="border rounded overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10"></TableHead>
                            <TableHead>Component</TableHead>
                            <TableHead>Process</TableHead>
                            <TableHead>Fabric</TableHead>
                            <TableHead>Greige</TableHead>
                            <TableHead>Color/Design</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {styleFabrics.map((sf) => (
                            <TableRow
                              key={sf.id}
                              className={cn(
                                'cursor-pointer hover:bg-muted/50',
                                selectedStyleFabric?.id === sf.id && 'bg-primary/10'
                              )}
                              onClick={() => {
                                setSelectedStyleFabric(sf);
                                setSelectedFabric(null);
                                setUseOtherFabric(false);
                                setSelectedProcessor(null);
                                setSelectedGreigeStock(null);
                              }}
                            >
                              <TableCell>
                                <div
                                  className={cn(
                                    'w-4 h-4 rounded-full border-2',
                                    selectedStyleFabric?.id === sf.id
                                      ? 'border-primary bg-primary'
                                      : 'border-muted-foreground'
                                  )}
                                >
                                  {selectedStyleFabric?.id === sf.id && (
                                    <Check className="w-3 h-3 text-primary-foreground" />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">{sf._componentName}</TableCell>
                              <TableCell>
                                <Badge variant={sf._processType === 'DYEING' ? 'default' : 'secondary'}>
                                  {sf._processType === 'DYEING' ? '🎨 Dyed' : '🖨 Printed'}
                                </Badge>
                              </TableCell>
                              <TableCell>{sf.fabricName || sf.fabric?.fabricName || 'No fabric'}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {sf.selectedGreige?.greigeName ||
                                  sf.cadRows?.[0]?.greige?.greigeName ||
                                  sf.greigeName ||
                                  '-'}
                              </TableCell>
                              <TableCell>
                                {sf._processType === 'DYEING'
                                  ? sf.colorMaster?.colorName ||
                                    sf.cadRows?.[0]?.batchGroupColor?.colorName ||
                                    'No color'
                                  : sf.printDesign || 'No design'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setUseOtherFabric(true)}
                      className="text-xs text-muted-foreground"
                    >
                      Search other fabrics...
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Processor Selector */}
            {selectedStyle && (selectedStyleFabric || selectedFabric) && (
              <div className="space-y-2">
                <Label>Processor/Mill *</Label>
                <Popover open={processorOpen} onOpenChange={setProcessorOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={processorOpen}
                      className="w-full justify-between"
                    >
                      {selectedProcessor ? (
                        <span className="truncate">{selectedProcessor.name}</span>
                      ) : (
                        <span className="text-muted-foreground">Select processor/mill...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[500px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search processors..."
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
                          {(processorsData || []).map((processor: any) => (
                            <CommandItem
                              key={processor.id}
                              value={processor.id}
                              onSelect={() => {
                                setSelectedProcessor(processor);
                                setSelectedGreigeStock(null);
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
                                <span className="font-medium">{processor.name}</span>
                                <span className="text-sm text-muted-foreground">{processor.code}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Summary of selection */}
            {selectedStyle && selectedFabric && selectedProcessor && (
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Style</p>
                  <p className="text-sm font-medium">
                    {formatStyleCodeWithRef(selectedStyle.styleCode, selectedStyle.buyerStyleRef)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fabric</p>
                  <p className="text-sm font-medium">{selectedFabric.fabricCode}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Processor</p>
                  <p className="text-sm font-medium">{selectedProcessor.name}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Greige Stock Selection */}
      {shouldShowGreigeStock && (
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
                  {cutableWidthDeduction == null
                    ? 'Loading selvedge deduction…'
                    : expectedFinishedWidth > 0
                      ? `Gives ${(expectedFinishedWidth - cutableWidthDeduction).toFixed(1)}" cutable after ${cutableWidthDeduction}" selvedge`
                      : `Pre-filled as CAD cutable width + ${cutableWidthDeduction}" selvedge`}
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
                placeholder="From processor rate card"
              />
              {shrinkageFromRateCard ? (
                <p className="text-xs text-muted-foreground">From processor rate card: {expectedShrinkage}%</p>
              ) : (
                <p className="text-xs text-amber-600">
                  No rate-card shrinkage for this processor + greige — enter the contracted % or add a rate card. At 0,
                  the order expects 100% of the greige back.
                </p>
              )}
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
                  disabled={isRateTbd}
                />
                <div className="flex items-center space-x-2 mt-2">
                  <Checkbox
                    id="isRateTbd"
                    checked={isRateTbd}
                    onCheckedChange={(checked) => {
                      setIsRateTbd(checked === true);
                      if (checked) setAgreedRatePerMeter(0);
                    }}
                  />
                  <Label htmlFor="isRateTbd" className="text-sm font-normal cursor-pointer text-muted-foreground">
                    Rate to be decided (TBD)
                  </Label>
                </div>
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
      {shouldShowGreigeStock && selectedGreigeStock && qtySentMeters > 0 && (
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
                {isRateTbd ? (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    TBD
                  </Badge>
                ) : (
                  <p className="font-medium">₹{agreedRatePerMeter.toFixed(2)}/m</p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Estimated Cost</p>
                {isRateTbd ? (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    TBD
                  </Badge>
                ) : (
                  <p className="font-medium">₹{(qtySentMeters * agreedRatePerMeter).toFixed(2)}</p>
                )}
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
          variant="outline"
          onClick={() => handleSubmit(false)}
          disabled={
            createMutation.isPending ||
            (createMode === 'lab-dip'
              ? !selectedLabDip
              : !selectedStyle || (!selectedStyleFabric && !selectedFabric) || !selectedProcessor) ||
            !selectedGreigeStock ||
            qtySentMeters <= 0 ||
            expectedFinishedWidth <= 0
          }
        >
          {createMutation.isPending && submitAction === 'create' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Create as Draft
        </Button>
        <Button
          onClick={() => handleSubmit(true)}
          disabled={
            createMutation.isPending ||
            (createMode === 'lab-dip'
              ? !selectedLabDip
              : !selectedStyle || (!selectedStyleFabric && !selectedFabric) || !selectedProcessor) ||
            !selectedGreigeStock ||
            qtySentMeters <= 0 ||
            expectedFinishedWidth <= 0
          }
        >
          {createMutation.isPending && submitAction === 'create-send' && (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          )}
          <Send className="h-4 w-4 mr-2" />
          Create & Send to Mill
        </Button>
      </div>
    </div>
  );
}
