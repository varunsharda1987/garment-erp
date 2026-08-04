// Unified Lab Dip Batch Create Form - handles both Dyeing and Printing in one table
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Beaker, Loader2, Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { styleService } from '@/services/style.service';
import { getAllSuppliers } from '@/services/supplier.service';
import { dyeLabDipService } from '@/services/dyeing.service';
import type { Style } from '@/types/style.types';
import type { Supplier } from '@/types/supplier.types';
import type { PrintMethod, PrintChemistry } from '@/types/printing.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { cn } from '@/lib/utils';
import { formatStyleCodeWithRef } from '@/utils/style-ref-format';

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

interface FabricRow {
  id: string; // style_fabrics.id
  componentType: string;
  componentName: string;
  fabricFinishType: 'DYED' | 'PRINTED';
  fabricId: string | null;
  fabricName: string;
  fabricCode: string | null;
  greigeName: string | null;
  colorMasterId: string | null;
  colorName: string | null;
  printDesign: string | null;
  // Editable per row
  processorId: string;
  printMethod: PrintMethod | '';
  printChemistry: PrintChemistry | '';
  expectedDate: string;
  remarks: string;
  isIncluded: boolean;
}

interface LabDipBatchCreateFormProps {
  backPath: string;
}

export default function LabDipBatchCreateForm({ backPath }: LabDipBatchCreateFormProps) {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  // Style selection
  const [styleSearch, setStyleSearch] = useState('');
  const [styleOpen, setStyleOpen] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<Style | null>(null);

  // Common form fields
  const [submissionDate, setSubmissionDate] = useState(today);

  // Fabric rows extracted from style
  const [fabricRows, setFabricRows] = useState<FabricRow[]>([]);
  const [isLoadingFabrics, setIsLoadingFabrics] = useState(false);

  // Processors
  const [processors, setProcessors] = useState<Supplier[]>([]);

  // Style search query
  const { data: stylesData, isLoading: stylesLoading } = useQuery({
    queryKey: ['styles-search', styleSearch],
    queryFn: () => styleService.getAllStyles(1, 20, styleSearch),
    enabled: styleOpen || styleSearch.length >= 2,
  });

  // Fetch processors on mount
  useEffect(() => {
    getAllSuppliers({ category: 'DYEING_PRINTING', limit: 100 }).then((res) => {
      setProcessors(res.data || []);
    });
  }, []);

  const styles = stylesData?.data || [];

  // Fetch full style details when style is selected
  useEffect(() => {
    if (selectedStyle) {
      setIsLoadingFabrics(true);
      styleService
        .getStyleById(selectedStyle.id)
        .then((fullStyle: any) => {
          // Extract ALL fabrics from components → fabrics (serializer converts style_components/style_fabrics)
          const rows: FabricRow[] = [];
          const components = fullStyle.components || [];

          for (const comp of components) {
            const compFabrics = comp.fabrics || [];
            for (const sf of compFabrics) {
              // Include both DYED and PRINTED
              const finishType = sf.fabricFinishType as 'DYED' | 'PRINTED';
              if (finishType === 'DYED' || finishType === 'PRINTED') {
                rows.push({
                  id: sf.id,
                  componentType: comp.componentType,
                  componentName: comp.componentMaster?.name || comp.componentType,
                  fabricFinishType: finishType,
                  fabricId: sf.fabricId || null,
                  fabricName: sf.fabricName || sf.fabric?.fabricName || 'No fabric',
                  fabricCode: sf.fabric?.fabricCode || null,
                  greigeName:
                    sf.selectedGreige?.greigeName || sf.cadRows?.[0]?.greige?.greigeName || sf.greigeName || null,
                  colorMasterId: sf.colorMasterId || sf.colorMaster?.id || sf.cadRows?.[0]?.batchGroupColor?.id || null,
                  colorName: sf.colorMaster?.colorName || sf.cadRows?.[0]?.batchGroupColor?.colorName || null,
                  printDesign: sf.printDesign || null,
                  // Defaults for editable fields
                  processorId: '',
                  printMethod: '',
                  printChemistry: '',
                  expectedDate: '',
                  remarks: '',
                  isIncluded: true,
                });
              }
            }
          }

          setFabricRows(rows);
        })
        .finally(() => setIsLoadingFabrics(false));
    } else {
      setFabricRows([]);
    }
  }, [selectedStyle]);

  // Update a single row
  const updateRow = (index: number, updates: Partial<FabricRow>) => {
    setFabricRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...updates } : row)));
  };

  // Toggle all rows
  const toggleAll = (checked: boolean) => {
    setFabricRows((prev) => prev.map((row) => ({ ...row, isIncluded: checked })));
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const includedRows = fabricRows.filter((r) => r.isIncluded);

      // Validate
      for (const row of includedRows) {
        if (!row.processorId) {
          throw new Error(`Please select a processor for ${row.componentName} - ${row.fabricName}`);
        }
        if (row.fabricFinishType === 'PRINTED' && !row.printMethod) {
          throw new Error(`Please select a print method for ${row.componentName} - ${row.fabricName}`);
        }
        if (row.fabricFinishType === 'PRINTED' && !row.printChemistry) {
          throw new Error(`Please select a print chemistry for ${row.componentName} - ${row.fabricName}`);
        }
      }

      return dyeLabDipService.bulkCreateLabDips({
        styleId: selectedStyle!.id,
        submissionDate,
        labDips: includedRows.map((row) => ({
          styleFabricId: row.id,
          processType: row.fabricFinishType === 'DYED' ? 'DYEING' : 'PRINTING',
          processorId: row.processorId,
          targetColorId: row.colorMasterId || undefined,
          designArtwork: row.printDesign || undefined,
          printMethod: row.printMethod || undefined,
          printChemistry: row.printChemistry || undefined,
          expectedDate: row.expectedDate || undefined,
          remarks: row.remarks || undefined,
        })),
      });
    },
    onSuccess: (result) => {
      handleApiSuccess(result.message);
      navigate(backPath);
    },
    onError: (error: any) => {
      handleApiError(error, 'Failed to create lab dips');
    },
  });

  const includedCount = fabricRows.filter((r) => r.isIncluded).length;
  const dyeingCount = fabricRows.filter((r) => r.isIncluded && r.fabricFinishType === 'DYED').length;
  const printingCount = fabricRows.filter((r) => r.isIncluded && r.fabricFinishType === 'PRINTED').length;

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
            <Beaker className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-display font-medium">Create Lab Dips</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Create lab dip requests for all fabrics in a style</p>
        </div>
      </div>

      {/* Style Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Style & Submission</CardTitle>
          <CardDescription>Select a style to see all its fabrics</CardDescription>
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
                      <span>
                        {formatStyleCodeWithRef(selectedStyle.styleCode, selectedStyle.buyerStyleRef)} -{' '}
                        {selectedStyle.styleName}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Search styles...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="Search styles..." value={styleSearch} onValueChange={setStyleSearch} />
                    <CommandList>
                      {stylesLoading && (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      )}
                      <CommandEmpty>No styles found</CommandEmpty>
                      <CommandGroup>
                        {styles.map((style) => (
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

            {/* Submission Date */}
            <div className="space-y-2">
              <Label>Submission Date *</Label>
              <Input type="date" value={submissionDate} onChange={(e) => setSubmissionDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fabrics Table */}
      {selectedStyle && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Fabrics</CardTitle>
                <CardDescription>
                  {fabricRows.length} fabric(s) found - {dyeingCount} for dyeing, {printingCount} for printing
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={fabricRows.length > 0 && fabricRows.every((r) => r.isIncluded)}
                  onCheckedChange={(checked) => toggleAll(!!checked)}
                />
                <Label className="text-sm">Select All</Label>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingFabrics ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : fabricRows.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No fabrics found for this style. Please add fabrics in the Style page first.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Include</TableHead>
                      <TableHead>Component</TableHead>
                      <TableHead>Process</TableHead>
                      <TableHead>Fabric</TableHead>
                      <TableHead>Greige</TableHead>
                      <TableHead>Color/Design</TableHead>
                      <TableHead>Print Method</TableHead>
                      <TableHead>Chemistry</TableHead>
                      <TableHead>Processor *</TableHead>
                      <TableHead>Expected Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fabricRows.map((row, index) => (
                      <TableRow key={row.id} className={cn(!row.isIncluded && 'opacity-50')}>
                        <TableCell>
                          <Checkbox
                            checked={row.isIncluded}
                            onCheckedChange={(checked) => updateRow(index, { isIncluded: !!checked })}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{row.componentName}</TableCell>
                        <TableCell>
                          <Badge variant={row.fabricFinishType === 'DYED' ? 'default' : 'secondary'}>
                            {row.fabricFinishType === 'DYED' ? '🎨 Dyed' : '🖨 Printed'}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.fabricName}</TableCell>
                        <TableCell className="text-muted-foreground">{row.greigeName || '-'}</TableCell>
                        <TableCell>
                          {row.fabricFinishType === 'DYED'
                            ? row.colorName || 'No color'
                            : row.printDesign || 'No design'}
                        </TableCell>
                        <TableCell>
                          {row.fabricFinishType === 'PRINTED' ? (
                            <Select
                              value={row.printMethod}
                              onValueChange={(v) => updateRow(index, { printMethod: v as PrintMethod })}
                              disabled={!row.isIncluded}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                {PRINT_METHODS.map((m) => (
                                  <SelectItem key={m.value} value={m.value}>
                                    {m.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.fabricFinishType === 'PRINTED' ? (
                            <Select
                              value={row.printChemistry}
                              onValueChange={(v) => updateRow(index, { printChemistry: v as PrintChemistry })}
                              disabled={!row.isIncluded}
                            >
                              <SelectTrigger className="w-28">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                {PRINT_CHEMISTRIES.map((c) => (
                                  <SelectItem key={c.value} value={c.value}>
                                    {c.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={row.processorId}
                            onValueChange={(v) => updateRow(index, { processorId: v })}
                            disabled={!row.isIncluded}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Select processor..." />
                            </SelectTrigger>
                            <SelectContent>
                              {processors.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={row.expectedDate}
                            onChange={(e) => updateRow(index, { expectedDate: e.target.value })}
                            disabled={!row.isIncluded}
                            className="w-36"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submit Button */}
      {selectedStyle && fabricRows.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {includedCount} fabric(s) selected ({dyeingCount} dyeing, {printingCount} printing)
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={includedCount === 0 || createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              `Create ${includedCount} Lab Dip(s)`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
