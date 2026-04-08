/**
 * Cost Sheet PO Generation Page
 * Generate Purchase Orders (Fabric/Greige, Processing, Trims) from approved Cost Sheets
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calculator, FileText, Package, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { handleApiError } from '@/lib/api-error-handler';
import {
  calculateRequirements,
  generateFabricPO,
  generateGreigePO,
  generateProcessingPO,
  generateTrimsPO,
  getGenerationStatus,
} from '@/services/costSheetPOGeneration.service';
import { getStyleCostingById } from '@/services/styleCosting.service';
import { getAllSuppliers } from '@/services/supplier.service';
import type {
  CalculatedRequirements,
  OrderQuantityResult,
  POGenerationStatus,
  GeneratedPO,
  POType,
} from '@/types/costSheetPOGeneration.types';

// ============================================
// COMPONENT
// ============================================

export default function CostSheetPOGenerationPage() {
  const { costSheetId } = useParams<{ costSheetId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Page State
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Cost Sheet Info
  const [costSheetInfo, setCostSheetInfo] = useState<{
    styleId: string;
    styleCode: string;
    styleName: string;
    version: number;
    approvalStatus: string;
  } | null>(null);

  // Form State
  const [totalOrderQty, setTotalOrderQty] = useState<number>(Number(searchParams.get('qty')) || 0);
  const [requirements, setRequirements] = useState<CalculatedRequirements | null>(null);

  // PO Type Selection (Fabric vs Greige - Mutually Exclusive)
  const [poType, setPOType] = useState<POType>('FABRIC');

  // Supplier Selections
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [fabricSupplierId, setFabricSupplierId] = useState<string>('');
  const [greigeSupplierId, setGreigeSupplierId] = useState<string>('');
  const [processorId, setProcessorId] = useState<string>('');
  const [trimsSupplierId, setTrimsSupplierId] = useState<string>('');

  // Item Selections and Allowances
  const [fabricItems, setFabricItems] = useState<
    Array<OrderQuantityResult & { selected: boolean; adjustedAllowance: number }>
  >([]);
  const [greigeItems, setGreigeItems] = useState<
    Array<OrderQuantityResult & { selected: boolean; adjustedAllowance: number }>
  >([]);
  const [trimsItems, setTrimsItems] = useState<
    Array<OrderQuantityResult & { selected: boolean; adjustedAllowance: number }>
  >([]);
  const [createProcessingPO, setCreateProcessingPO] = useState(false);

  // Generated POs
  const [generatedPOs, setGeneratedPOs] = useState<GeneratedPO[]>([]);
  const [generationHistory, setGenerationHistory] = useState<POGenerationStatus[]>([]);

  // ============================================
  // EFFECTS
  // ============================================

  // Load initial data
  useEffect(() => {
    if (costSheetId) {
      loadInitialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costSheetId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);

      // Load cost sheet info
      const cs = await getStyleCostingById(costSheetId!);
      if (cs) {
        setCostSheetInfo({
          styleId: cs.styleId,
          styleCode: cs.style?.styleCode || 'N/A',
          styleName: cs.style?.styleName || 'N/A',
          version: cs.version,
          approvalStatus: cs.approvalStatus,
        });

        // Check if approved
        if (cs.approvalStatus !== 'APPROVED') {
          toast({
            title: 'Warning',
            description: 'Cost sheet must be approved before generating POs',
            variant: 'destructive',
          });
        }
      }

      // Load suppliers
      const suppliersResponse = await getAllSuppliers();
      setSuppliers(suppliersResponse.data || []);

      // Load existing generation history
      const historyResponse = await getGenerationStatus(costSheetId!);
      if (historyResponse.success) {
        setGenerationHistory(historyResponse.data || []);
      }
    } catch (error) {
      handleApiError(error, 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // HANDLERS
  // ============================================

  const handleCalculate = async () => {
    if (!costSheetId || totalOrderQty <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid total order quantity',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCalculating(true);
      const response = await calculateRequirements(costSheetId, totalOrderQty);

      if (response.success && response.data) {
        setRequirements(response.data);

        // Initialize items with selection state
        setFabricItems(
          (response.data.fabricOrderQtys || []).map((item) => ({
            ...item,
            selected: item.shortfall > 0,
            adjustedAllowance: 3,
          }))
        );
        setGreigeItems(
          (response.data.greigeOrderQtys || []).map((item) => ({
            ...item,
            selected: item.shortfall > 0,
            adjustedAllowance: 3,
          }))
        );
        setTrimsItems(
          (response.data.trimsOrderQtys || []).map((item) => ({
            ...item,
            selected: item.shortfall > 0,
            adjustedAllowance: 3,
          }))
        );

        toast({
          title: 'Calculation Complete',
          description: 'Material requirements have been calculated',
        });
      }
    } catch (error) {
      handleApiError(error, 'Failed to calculate requirements');
    } finally {
      setCalculating(false);
    }
  };

  const handleGenerateFabricPO = async () => {
    const selectedItems = fabricItems.filter((item) => item.selected && item.shortfall > 0);
    if (selectedItems.length === 0) {
      toast({
        title: 'No Items Selected',
        description: 'Please select at least one item to order',
        variant: 'destructive',
      });
      return;
    }

    if (!fabricSupplierId) {
      toast({
        title: 'Supplier Required',
        description: 'Please select a supplier',
        variant: 'destructive',
      });
      return;
    }

    try {
      setGenerating(true);
      const response = await generateFabricPO({
        costSheetId: costSheetId!,
        totalOrderQty,
        supplierId: fabricSupplierId,
        items: selectedItems.map((item) => ({
          materialId: item.materialId,
          orderQty: calculateAdjustedOrderQty(item),
          unit: item.unit,
          unitPrice: item.unitPrice,
          allowancePercent: item.adjustedAllowance,
        })),
      });

      if (response.success && response.data) {
        setGeneratedPOs((prev) => [...prev, response.data]);
        toast({
          title: 'Fabric PO Generated',
          description: `PO ${response.data.poNumber} created successfully`,
        });
        // Refresh history
        loadInitialData();
      }
    } catch (error) {
      handleApiError(error, 'Failed to generate Fabric PO');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateGreigePO = async () => {
    const selectedItems = greigeItems.filter((item) => item.selected && item.shortfall > 0);
    if (selectedItems.length === 0) {
      toast({
        title: 'No Items Selected',
        description: 'Please select at least one greige item to order',
        variant: 'destructive',
      });
      return;
    }

    if (!greigeSupplierId) {
      toast({
        title: 'Supplier Required',
        description: 'Please select a greige supplier',
        variant: 'destructive',
      });
      return;
    }

    try {
      setGenerating(true);
      const response = await generateGreigePO({
        costSheetId: costSheetId!,
        totalOrderQty,
        supplierId: greigeSupplierId,
        items: selectedItems.map((item) => ({
          materialId: item.materialId,
          orderQty: calculateAdjustedOrderQty(item),
          unit: item.unit,
          unitPrice: item.unitPrice,
          allowancePercent: item.adjustedAllowance,
        })),
      });

      if (response.success && response.data) {
        setGeneratedPOs((prev) => [...prev, response.data]);
        toast({
          title: 'Greige PO Generated',
          description: `PO ${response.data.poNumber} created successfully`,
        });

        // Generate Processing PO if selected
        if (createProcessingPO && processorId) {
          await handleGenerateProcessingPO(response.data.id);
        }

        loadInitialData();
      }
    } catch (error) {
      handleApiError(error, 'Failed to generate Greige PO');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateProcessingPO = async (linkedGreigePOId?: string) => {
    if (!processorId) {
      toast({
        title: 'Processor Required',
        description: 'Please select a processor',
        variant: 'destructive',
      });
      return;
    }

    const processingItems = requirements?.processingItems || [];
    if (processingItems.length === 0) {
      toast({
        title: 'No Processing Items',
        description: 'No items require processing',
        variant: 'destructive',
      });
      return;
    }

    try {
      setGenerating(true);
      const response = await generateProcessingPO({
        costSheetId: costSheetId!,
        totalOrderQty,
        processorId,
        linkedGreigePOId,
        items: processingItems.map((item) => ({
          materialId: item.materialId,
          orderQty: item.requiredQty,
          unit: item.unit,
          unitPrice: item.unitPrice,
          allowancePercent: 3,
          processType: 'DYEING',
          greigeMaterialId: item.materialId,
        })),
      });

      if (response.success && response.data) {
        setGeneratedPOs((prev) => [...prev, response.data]);
        toast({
          title: 'Processing PO Generated',
          description: `PO ${response.data.poNumber} created with status ${linkedGreigePOId ? 'PENDING_GREIGE' : 'DRAFT'}`,
        });
        loadInitialData();
      }
    } catch (error) {
      handleApiError(error, 'Failed to generate Processing PO');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateTrimsPO = async () => {
    const selectedItems = trimsItems.filter((item) => item.selected && item.shortfall > 0);
    if (selectedItems.length === 0) {
      toast({
        title: 'No Items Selected',
        description: 'Please select at least one trim item to order',
        variant: 'destructive',
      });
      return;
    }

    if (!trimsSupplierId) {
      toast({
        title: 'Supplier Required',
        description: 'Please select a supplier',
        variant: 'destructive',
      });
      return;
    }

    try {
      setGenerating(true);
      const response = await generateTrimsPO({
        costSheetId: costSheetId!,
        totalOrderQty,
        supplierId: trimsSupplierId,
        items: selectedItems.map((item) => ({
          materialId: item.materialId,
          orderQty: calculateAdjustedOrderQty(item),
          unit: item.unit,
          unitPrice: item.unitPrice,
          allowancePercent: item.adjustedAllowance,
        })),
      });

      if (response.success && response.data) {
        setGeneratedPOs((prev) => [...prev, response.data]);
        toast({
          title: 'Trims PO Generated',
          description: `PO ${response.data.poNumber} created successfully`,
        });
        loadInitialData();
      }
    } catch (error) {
      handleApiError(error, 'Failed to generate Trims PO');
    } finally {
      setGenerating(false);
    }
  };

  // ============================================
  // HELPERS
  // ============================================

  const calculateAdjustedOrderQty = (item: OrderQuantityResult & { adjustedAllowance: number }): number => {
    const allowanceQty = item.shortfall * (item.adjustedAllowance / 100);
    return item.shortfall + allowanceQty;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Computed values
  const hasFabricItems = useMemo(() => (requirements?.fabricItems?.length || 0) > 0, [requirements]);
  const hasGreigeItems = useMemo(() => (requirements?.greigeItems?.length || 0) > 0, [requirements]);
  const hasTrimsItems = useMemo(() => (requirements?.trimsItems?.length || 0) > 0, [requirements]);

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-medium">Generate Purchase Orders</h1>
            <p className="text-muted-foreground">Generate POs from Cost Sheet for early procurement</p>
          </div>
        </div>
      </div>

      {/* Cost Sheet Info */}
      {costSheetInfo && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Cost Sheet Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label className="text-muted-foreground">Style Code</Label>
                <p className="font-medium">{costSheetInfo.styleCode}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Style Name</Label>
                <p className="font-medium">{costSheetInfo.styleName}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Version</Label>
                <p className="font-medium">v{costSheetInfo.version}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <Badge variant={costSheetInfo.approvalStatus === 'APPROVED' ? 'default' : 'secondary'}>
                  {costSheetInfo.approvalStatus}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Total Order Quantity Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calculate Requirements
          </CardTitle>
          <CardDescription>Enter the total order quantity to calculate material requirements</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-xs">
              <Label htmlFor="totalOrderQty">Total Order Quantity (pieces)</Label>
              <Input
                id="totalOrderQty"
                type="number"
                min="1"
                value={totalOrderQty || ''}
                onChange={(e) => setTotalOrderQty(Number(e.target.value))}
                placeholder="Enter quantity..."
              />
            </div>
            <Button onClick={handleCalculate} disabled={calculating || totalOrderQty <= 0}>
              {calculating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Calculating...
                </>
              ) : (
                'Calculate'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Requirements & PO Generation */}
      {requirements && (
        <>
          {/* Zero-price warning */}
          {requirements.hasZeroPriceItems && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Missing Prices</AlertTitle>
              <AlertDescription>
                Some items have ₹0 unit price. Review highlighted items below and update prices in the Cost Sheet or
                Material Master before generating POs.
              </AlertDescription>
            </Alert>
          )}

          {/* Fabric/Greige Selection */}
          {(hasFabricItems || hasGreigeItems) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Fabric / Greige PO
                </CardTitle>
                <CardDescription>Choose between ordering ready fabric or greige for processing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Mutual Exclusion Selection */}
                <RadioGroup value={poType} onValueChange={(v) => setPOType(v as POType)} className="flex gap-6">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="FABRIC" id="fabric" disabled={!hasFabricItems} />
                    <Label htmlFor="fabric" className={!hasFabricItems ? 'text-muted-foreground' : ''}>
                      Fabric PO (Ready/Processed)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="GREIGE" id="greige" disabled={!hasGreigeItems} />
                    <Label htmlFor="greige" className={!hasGreigeItems ? 'text-muted-foreground' : ''}>
                      Greige + Processing PO
                    </Label>
                  </div>
                </RadioGroup>

                <Separator />

                {/* Fabric Items Table */}
                {poType === 'FABRIC' && hasFabricItems && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Fabric Items</h4>
                      <Select value={fabricSupplierId} onValueChange={setFabricSupplierId}>
                        <SelectTrigger className="w-[250px]">
                          <SelectValue placeholder="Select Supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.code} - {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Material</TableHead>
                          <TableHead className="text-right">Required</TableHead>
                          <TableHead className="text-right">In Stock</TableHead>
                          <TableHead className="text-right">Shortfall</TableHead>
                          <TableHead className="text-right">Allow %</TableHead>
                          <TableHead className="text-right">Order Qty</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fabricItems.map((item, idx) => (
                          <TableRow key={item.materialId}>
                            <TableCell>
                              <Checkbox
                                checked={item.selected}
                                onCheckedChange={(checked) => {
                                  setFabricItems((prev) =>
                                    prev.map((i, j) => (j === idx ? { ...i, selected: !!checked } : i))
                                  );
                                }}
                                disabled={item.shortfall <= 0}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{item.materialName}</TableCell>
                            <TableCell className="text-right">
                              {item.requiredQty.toFixed(2)} {item.unit}
                            </TableCell>
                            <TableCell className="text-right">{item.availableStock.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{item.shortfall.toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min="0"
                                max="5"
                                step="0.5"
                                value={item.adjustedAllowance}
                                onChange={(e) => {
                                  setFabricItems((prev) =>
                                    prev.map((i, j) =>
                                      j === idx ? { ...i, adjustedAllowance: Number(e.target.value) } : i
                                    )
                                  );
                                }}
                                className="w-16 text-right"
                                disabled={!item.selected}
                              />
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {calculateAdjustedOrderQty(item).toFixed(2)}
                            </TableCell>
                            <TableCell
                              className={`text-right ${item.unitPrice === 0 ? 'text-destructive font-semibold' : ''}`}
                            >
                              {item.unitPrice === 0 ? '₹0 ⚠' : formatCurrency(item.unitPrice)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(calculateAdjustedOrderQty(item) * item.unitPrice)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <div className="flex justify-end">
                      <Button
                        onClick={handleGenerateFabricPO}
                        disabled={generating || !fabricSupplierId || fabricItems.every((i) => !i.selected)}
                      >
                        {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Generate Fabric PO
                      </Button>
                    </div>
                  </div>
                )}

                {/* Greige Items Table */}
                {poType === 'GREIGE' && hasGreigeItems && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Greige Items</h4>
                      <Select value={greigeSupplierId} onValueChange={setGreigeSupplierId}>
                        <SelectTrigger className="w-[250px]">
                          <SelectValue placeholder="Select Greige Supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.code} - {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12"></TableHead>
                          <TableHead>Material</TableHead>
                          <TableHead className="text-right">Required</TableHead>
                          <TableHead className="text-right">In Stock</TableHead>
                          <TableHead className="text-right">Shortfall</TableHead>
                          <TableHead className="text-right">Allow %</TableHead>
                          <TableHead className="text-right">Order Qty</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {greigeItems.map((item, idx) => (
                          <TableRow key={item.materialId}>
                            <TableCell>
                              <Checkbox
                                checked={item.selected}
                                onCheckedChange={(checked) => {
                                  setGreigeItems((prev) =>
                                    prev.map((i, j) => (j === idx ? { ...i, selected: !!checked } : i))
                                  );
                                }}
                                disabled={item.shortfall <= 0}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{item.materialName}</TableCell>
                            <TableCell className="text-right">
                              {item.requiredQty.toFixed(2)} {item.unit}
                            </TableCell>
                            <TableCell className="text-right">{item.availableStock.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{item.shortfall.toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min="0"
                                max="5"
                                step="0.5"
                                value={item.adjustedAllowance}
                                onChange={(e) => {
                                  setGreigeItems((prev) =>
                                    prev.map((i, j) =>
                                      j === idx ? { ...i, adjustedAllowance: Number(e.target.value) } : i
                                    )
                                  );
                                }}
                                className="w-16 text-right"
                                disabled={!item.selected}
                              />
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {calculateAdjustedOrderQty(item).toFixed(2)}
                            </TableCell>
                            <TableCell
                              className={`text-right ${item.unitPrice === 0 ? 'text-destructive font-semibold' : ''}`}
                            >
                              {item.unitPrice === 0 ? '₹0 ⚠' : formatCurrency(item.unitPrice)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(calculateAdjustedOrderQty(item) * item.unitPrice)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Processing PO Option */}
                    <div className="p-4 border rounded-lg bg-muted/50">
                      <div className="flex items-center gap-4 mb-4">
                        <Checkbox
                          id="createProcessingPO"
                          checked={createProcessingPO}
                          onCheckedChange={(checked) => setCreateProcessingPO(!!checked)}
                        />
                        <Label htmlFor="createProcessingPO">
                          Also create Processing PO (will be "PENDING_GREIGE" until greige is received)
                        </Label>
                      </div>

                      {createProcessingPO && (
                        <div className="flex items-center gap-4">
                          <Label>Processor:</Label>
                          <Select value={processorId} onValueChange={setProcessorId}>
                            <SelectTrigger className="w-[250px]">
                              <SelectValue placeholder="Select Processor" />
                            </SelectTrigger>
                            <SelectContent>
                              {suppliers.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.code} - {s.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <Button
                        onClick={handleGenerateGreigePO}
                        disabled={generating || !greigeSupplierId || greigeItems.every((i) => !i.selected)}
                      >
                        {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Generate Greige PO{createProcessingPO ? ' + Processing PO' : ''}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Trims PO */}
          {hasTrimsItems && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Trims PO (Size-Independent Only)
                </CardTitle>
                <CardDescription>
                  <Alert className="mt-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Note</AlertTitle>
                    <AlertDescription>
                      Size Labels are excluded - they will be ordered after size-wise breakdown is complete.
                    </AlertDescription>
                  </Alert>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Trim Items</h4>
                  <Select value={trimsSupplierId} onValueChange={setTrimsSupplierId}>
                    <SelectTrigger className="w-[250px]">
                      <SelectValue placeholder="Select Supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.code} - {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-right">Required</TableHead>
                      <TableHead className="text-right">In Stock</TableHead>
                      <TableHead className="text-right">Shortfall</TableHead>
                      <TableHead className="text-right">Allow %</TableHead>
                      <TableHead className="text-right">Order Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trimsItems.map((item, idx) => (
                      <TableRow key={item.materialId}>
                        <TableCell>
                          <Checkbox
                            checked={item.selected}
                            onCheckedChange={(checked) => {
                              setTrimsItems((prev) =>
                                prev.map((i, j) => (j === idx ? { ...i, selected: !!checked } : i))
                              );
                            }}
                            disabled={item.shortfall <= 0}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{item.materialName}</TableCell>
                        <TableCell className="text-right">
                          {item.requiredQty.toFixed(2)} {item.unit}
                        </TableCell>
                        <TableCell className="text-right">{item.availableStock.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{item.shortfall.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            max="5"
                            step="0.5"
                            value={item.adjustedAllowance}
                            onChange={(e) => {
                              setTrimsItems((prev) =>
                                prev.map((i, j) =>
                                  j === idx ? { ...i, adjustedAllowance: Number(e.target.value) } : i
                                )
                              );
                            }}
                            className="w-16 text-right"
                            disabled={!item.selected}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {calculateAdjustedOrderQty(item).toFixed(2)}
                        </TableCell>
                        <TableCell
                          className={`text-right ${item.unitPrice === 0 ? 'text-destructive font-semibold' : ''}`}
                        >
                          {item.unitPrice === 0 ? '₹0 ⚠' : formatCurrency(item.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(calculateAdjustedOrderQty(item) * item.unitPrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex justify-end">
                  <Button
                    onClick={handleGenerateTrimsPO}
                    disabled={generating || !trimsSupplierId || trimsItems.every((i) => !i.selected)}
                  >
                    {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Generate Trims PO
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Generated POs Summary */}
      {(generatedPOs.length > 0 || generationHistory.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              Generated Purchase Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generatedPOs.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-medium">{po.poNumber}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{po.poCategory}</Badge>
                    </TableCell>
                    <TableCell>{po.supplierName}</TableCell>
                    <TableCell>
                      <Badge variant={po.status === 'DRAFT' ? 'secondary' : 'default'}>{po.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(po.totalAmount)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/purchase-orders/${po.id}`)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {generationHistory.flatMap((gen) =>
                  gen.purchaseOrders.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-medium">{po.poNumber}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{po.poCategory}</Badge>
                      </TableCell>
                      <TableCell>{po.supplierName}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            po.status === 'DRAFT' ? 'secondary' : po.status === 'PENDING_GREIGE' ? 'outline' : 'default'
                          }
                        >
                          {po.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(po.totalAmount)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/purchase-orders/${po.id}`)}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
