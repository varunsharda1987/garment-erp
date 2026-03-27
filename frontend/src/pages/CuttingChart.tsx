import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cuttingBatchService, cuttingSummaryService } from '@/services/cutting.service';
import type { CuttingChartData, CuttingChartFabric, CreateCuttingBatchRequest } from '@/types/cutting.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { getUploadUrl } from '@/config/api.config';
import { Scissors, ArrowLeft, Save, Loader2, FileText, Image as ImageIcon } from 'lucide-react';

interface AvailableWorkOrder {
  id: string;
  workOrderNumber: string;
  styleCode: string;
  styleName: string;
  styleId: string;
  orderQty: number;
  cutQty: number;
  pendingQty: number;
  fabricIds: string[];
  colors: Array<{ id: string; colorName: string }>;
  components: Array<{ id: string; componentName: string; componentCode: string }>;
}

export default function CuttingChart() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preSelectedWorkOrderId = searchParams.get('workOrderId');
  const preSelectedColorId = searchParams.get('colorId');

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [availableWorkOrders, setAvailableWorkOrders] = useState<AvailableWorkOrder[]>([]);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState(preSelectedWorkOrderId || '');
  const [selectedColorId, setSelectedColorId] = useState(preSelectedColorId || '');
  const [chartData, setChartData] = useState<CuttingChartData | null>(null);
  const [imageError, setImageError] = useState(false);

  // Cutting parameters (editable)
  const [extraPercent, setExtraPercent] = useState(1);
  const [cuttingDate, setCuttingDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedLots, setSelectedLots] = useState<Record<string, string>>({});
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  // Load available work orders
  useEffect(() => {
    cuttingSummaryService
      .getAvailableWorkOrders()
      .then(setAvailableWorkOrders)
      .catch((err) => console.error('Failed to fetch work orders:', err));
  }, []);

  // Load chart data when WO or color changes
  useEffect(() => {
    if (selectedWorkOrderId) {
      loadChartData();
    } else {
      setChartData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkOrderId, selectedColorId]);

  const loadChartData = async () => {
    try {
      setIsLoading(true);
      setImageError(false);
      const data = await cuttingSummaryService.getChartData(selectedWorkOrderId, selectedColorId || undefined);
      setChartData(data);
      setCuttingDate(data.cuttingDate);
    } catch (err) {
      handleApiError(err, 'Failed to load cutting chart data');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate cut quantities with extra %
  const sizesWithCutQty = useMemo(() => {
    if (!chartData) return [];
    return chartData.sizes.map((s) => ({
      ...s,
      cutQty: Math.ceil(s.orderQty * (1 + extraPercent / 100)),
    }));
  }, [chartData, extraPercent]);

  const totalCutQty = sizesWithCutQty.reduce((sum, s) => sum + s.cutQty, 0);

  // Check if all fabrics have PRODUCTION CAD (width + average)
  const fabricsMissingCAD = useMemo(() => {
    if (!chartData?.fabrics) return [];
    return chartData.fabrics.filter((f) => !f.productionAverage || !f.productionWidth);
  }, [chartData]);
  const hasProductionCAD = fabricsMissingCAD.length === 0;

  // Handle batch creation — one batch per selected fabric lot
  const handleCreateBatch = async () => {
    if (!chartData) return;

    const fabricsWithLots = chartData.fabrics.filter((f) => f.lots.length > 0);
    const getFabricKey = (f: CuttingChartFabric) => f.fabricId || f.part;

    // Validate all fabrics with lots have a selection
    const missing = fabricsWithLots.filter((f) => !selectedLots[getFabricKey(f)]);
    if (fabricsWithLots.length > 0 && missing.length > 0) {
      handleApiError(null, `Please select a lot for: ${missing.map((f) => f.part).join(', ')}`);
      return;
    }
    if (fabricsWithLots.length === 0) {
      handleApiError(null, 'Please select a fabric lot');
      return;
    }

    // Resolve colorId — null is valid for size-only orders
    const colorId = chartData.colorId || chartData.availableColors[0]?.id || null;

    try {
      setIsSaving(true);

      // Primary fabric (first one) drives the main batch fields
      const primaryFabric = fabricsWithLots[0];
      const primaryLotId = selectedLots[getFabricKey(primaryFabric)];
      const primaryLot = primaryFabric.lots.find((l) => l.lotId === primaryLotId);
      const primaryCadAvg =
        primaryFabric.productionAverage || primaryFabric.rawMatCalcAverage || primaryFabric.costingAverage || 0;
      const primaryCadWidth =
        primaryFabric.productionWidth || primaryFabric.rawMatCalcWidth || primaryFabric.costingWidth || 0;

      const requestData: CreateCuttingBatchRequest = {
        workOrderId: chartData.workOrderId,
        cuttingDate,
        fabricStockId: primaryLotId,
        actualFabricWidth: primaryLot?.actualWidth || 0,
        cadAverageUsed: primaryCadAvg,
        cadWidthUsed: primaryCadWidth,
        layersPerLay: 0,
        numberOfLays: 0,
        skuOutputs: sizesWithCutQty
          .filter((s) => s.cutQty > 0)
          .map((s) => ({
            colorId,
            sizeId: s.sizeId,
            plannedQty: s.cutQty,
          })),
        // All fabrics (including primary) stored in junction table
        fabricStocks: fabricsWithLots.map((fabric) => {
          const lotId = selectedLots[getFabricKey(fabric)];
          const lot = fabric.lots.find((l) => l.lotId === lotId);
          return {
            fabricStockId: lotId,
            cadAvgUsed: fabric.productionAverage || fabric.rawMatCalcAverage || fabric.costingAverage || 0,
            cadWidthUsed: fabric.productionWidth || fabric.rawMatCalcWidth || fabric.costingWidth || 0,
            actualWidth: lot?.actualWidth || 0,
          };
        }),
      };

      const batch = await cuttingBatchService.create(requestData);

      handleApiSuccess('Batch Created', 'Cutting batch created successfully.');
      navigate(`/manufacturing/cutting/${batch.id}`);
    } catch (err) {
      handleApiError(err, 'Failed to create cutting batch');
    } finally {
      setIsSaving(false);
    }
  };

  // PDF preview URL
  const pdfPreviewUrl = useMemo(() => {
    if (!chartData) return '';
    const params = new URLSearchParams({
      ...(selectedColorId ? { colorId: selectedColorId } : {}),
      extraPercent: String(extraPercent),
    });
    return `/api/documents/cutting-chart/${chartData.workOrderId}/pdf?${params}`;
  }, [chartData, selectedColorId, extraPercent]);

  if (isLoading && !chartData) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/manufacturing/cutting')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <Scissors className="h-8 w-8 text-orange-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Cutting Chart</h1>
              <p className="text-gray-500">Issue cutting instructions for production</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {chartData && (
            <Button variant="outline" onClick={() => setShowPdfPreview(true)}>
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          )}
          {chartData && !hasProductionCAD && (
            <span className="text-xs text-red-600 max-w-[300px] text-right">
              Production CAD missing for: {fabricsMissingCAD.map((f) => f.part || f.fabricName).join(', ')}. Complete
              PRODUCTION CAD planning first.
            </span>
          )}
          {chartData && (
            <Button onClick={handleCreateBatch} disabled={isSaving || !hasProductionCAD}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Creating...' : 'Create Batch'}
            </Button>
          )}
        </div>
      </div>

      {/* Work Order & Color Selection */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <Label>Production Run</Label>
              <Select
                value={selectedWorkOrderId}
                onValueChange={(v) => {
                  setSelectedWorkOrderId(v);
                  setSelectedColorId('');
                  setSelectedLots({});
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a production run" />
                </SelectTrigger>
                <SelectContent>
                  {availableWorkOrders.map((wo) => (
                    <SelectItem key={wo.id} value={wo.id}>
                      {wo.workOrderNumber} - {wo.styleCode} ({wo.pendingQty} pcs pending)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {chartData && chartData.availableColors.length > 1 && (
              <div className="w-64 space-y-2">
                <Label>Color</Label>
                <Select
                  value={selectedColorId || 'all'}
                  onValueChange={(v) => setSelectedColorId(v === 'all' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Colors</SelectItem>
                    {chartData.availableColors.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.colorName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chart Content */}
      {chartData && (
        <>
          {/* Header Info — Style Image + Order Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Style Image */}
            <Card className="lg:col-span-1">
              <CardContent className="pt-6 flex items-center justify-center min-h-[240px]">
                {chartData.styleImage && !imageError ? (
                  <img
                    src={getUploadUrl(chartData.styleImage)}
                    alt={chartData.styleName}
                    className="max-h-56 object-contain rounded-lg"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <ImageIcon className="h-16 w-16" />
                    <span className="text-sm">No style image</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Details */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Order Details</CardTitle>
                  <span className="text-lg font-bold text-orange-700 tracking-wide">KASHAYA FABS</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-8">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Buyer</p>
                    <p className="font-semibold text-gray-900">{chartData.buyer}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Brand</p>
                    <p className="font-semibold text-gray-900">{chartData.brand || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Style</p>
                    <p className="font-semibold text-gray-900">{chartData.style}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Style Name</p>
                    <p className="font-semibold text-gray-900">{chartData.styleName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Color</p>
                    <p className="font-semibold text-gray-900">{chartData.color}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Work Order</p>
                    <p className="font-semibold text-gray-900">{chartData.workOrderNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Order Qty</p>
                    <p className="font-semibold text-gray-900">{chartData.orderQty.toLocaleString()} pcs</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Cut Qty</p>
                    <p className="font-semibold text-orange-600">{totalCutQty.toLocaleString()} pcs</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Cutting Date</p>
                    <Input
                      type="date"
                      className="mt-1 h-8 w-40"
                      value={cuttingDate}
                      onChange={(e) => setCuttingDate(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Size Breakup */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Size Breakup</CardTitle>
              <div className="flex items-center gap-2">
                <Label className="text-sm font-normal text-gray-500">Extra %:</Label>
                <Input
                  type="number"
                  className="w-20 h-8"
                  step="0.5"
                  value={extraPercent}
                  onChange={(e) => setExtraPercent(parseFloat(e.target.value) || 0)}
                />
              </div>
            </CardHeader>
            <CardContent>
              {sizesWithCutQty.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  No size breakup data found. Enter size/color breakdown in the Order page first.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Size</TableHead>
                        {sizesWithCutQty.map((s) => (
                          <TableHead key={s.sizeId} className="text-center min-w-[80px]">
                            {s.sizeName}
                          </TableHead>
                        ))}
                        <TableHead className="text-center font-bold">TOTAL</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium text-gray-500">Ratio</TableCell>
                        {sizesWithCutQty.map((s) => (
                          <TableCell key={s.sizeId} className="text-center text-gray-600">
                            {s.ratio}%
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-semibold">100%</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium text-gray-500">Order Qty</TableCell>
                        {sizesWithCutQty.map((s) => (
                          <TableCell key={s.sizeId} className="text-center">
                            {s.orderQty}
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-semibold">
                          {chartData.totalOrderQty.toLocaleString()}
                        </TableCell>
                      </TableRow>
                      <TableRow className="bg-orange-50">
                        <TableCell className="font-semibold text-orange-700">Cut Qty</TableCell>
                        {sizesWithCutQty.map((s) => (
                          <TableCell key={s.sizeId} className="text-center font-semibold text-orange-700">
                            {s.cutQty}
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-bold text-orange-700">
                          {totalCutQty.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fabric Details */}
          {chartData.fabricDetails.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Fabric Details</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Part</TableHead>
                      <TableHead>Fabric</TableHead>
                      <TableHead className="text-right">Ordered (m)</TableHead>
                      <TableHead className="text-right">Received (m)</TableHead>
                      <TableHead className="text-right">Available (m)</TableHead>
                      <TableHead className="text-right">Extra / Shortage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chartData.fabricDetails.map((fd, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{fd.part}</TableCell>
                        <TableCell className="max-w-[240px] truncate" title={fd.fabric}>
                          {fd.fabric}
                        </TableCell>
                        <TableCell className="text-right">{fd.fabricOrdered.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{fd.fabricReceived.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{fd.cutableQty.toFixed(1)}</TableCell>
                        <TableCell
                          className={`text-right font-medium ${fd.extraShortage >= 0 ? 'text-green-600' : 'text-red-600'}`}
                        >
                          {fd.extraShortage >= 0 ? '+' : ''}
                          {fd.extraShortage.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Fabric Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6 text-muted-foreground">
                  No fabric data available. Ensure CAD planning is completed for this style.
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fabrics & CAD */}
          {chartData.fabrics.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Fabrics & CAD</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead rowSpan={2}>Part</TableHead>
                        <TableHead rowSpan={2}>Fabric</TableHead>
                        <TableHead rowSpan={2}>Color</TableHead>
                        <TableHead colSpan={2} className="text-center border-l">
                          Costing
                        </TableHead>
                        <TableHead colSpan={2} className="text-center border-l">
                          Raw Mat Calc
                        </TableHead>
                        <TableHead colSpan={2} className="text-center border-l">
                          Production
                        </TableHead>
                      </TableRow>
                      <TableRow>
                        <TableHead className="text-center border-l">Width</TableHead>
                        <TableHead className="text-center">Avg</TableHead>
                        <TableHead className="text-center border-l">Width</TableHead>
                        <TableHead className="text-center">Avg</TableHead>
                        <TableHead className="text-center border-l">Width</TableHead>
                        <TableHead className="text-center">Avg</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {chartData.fabrics.map((f, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{f.part}</TableCell>
                          <TableCell className="max-w-[180px] truncate" title={f.fabricName}>
                            {f.fabricName}
                          </TableCell>
                          <TableCell>{f.fabricColor || '-'}</TableCell>
                          <TableCell className="text-center border-l">
                            {f.costingWidth ? `${f.costingWidth}"` : '-'}
                          </TableCell>
                          <TableCell className="text-center">{f.costingAverage?.toFixed(2) || '-'}</TableCell>
                          <TableCell className="text-center border-l">
                            {f.rawMatCalcWidth ? `${f.rawMatCalcWidth}"` : '-'}
                          </TableCell>
                          <TableCell className="text-center">{f.rawMatCalcAverage?.toFixed(2) || '-'}</TableCell>
                          <TableCell className="text-center border-l font-semibold">
                            {f.productionWidth ? `${f.productionWidth}"` : '-'}
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            {f.productionAverage?.toFixed(2) || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lot Details */}
          {chartData.fabrics.some((f) => f.lots.length > 0) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Lot Details</CardTitle>
                <p className="text-sm text-gray-500">Select fabric lots to use for this cutting batch</p>
              </CardHeader>
              <CardContent>
                {chartData.fabrics
                  .filter((f) => f.lots.length > 0)
                  .map((fabric, fIdx) => {
                    const fabricKey = fabric.fabricId || fabric.part;
                    return (
                      <div key={fIdx} className={fIdx > 0 ? 'mt-6' : ''}>
                        {chartData.fabrics.filter((f) => f.lots.length > 0).length > 1 && (
                          <>
                            <p className="text-sm font-semibold text-gray-700 mb-2">
                              {fabric.part} — {fabric.fabricName}
                            </p>
                            <Separator className="mb-3" />
                          </>
                        )}
                        <RadioGroup
                          value={selectedLots[fabricKey] || ''}
                          onValueChange={(lotId) => setSelectedLots((prev) => ({ ...prev, [fabricKey]: lotId }))}
                        >
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-10"></TableHead>
                                <TableHead>Lot #</TableHead>
                                <TableHead>Roll Numbers</TableHead>
                                <TableHead className="text-center">Prod Width</TableHead>
                                <TableHead className="text-right">Available (m)</TableHead>
                                <TableHead>Grade</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {fabric.lots.map((lot) => (
                                <TableRow
                                  key={lot.lotId}
                                  className={`cursor-pointer ${selectedLots[fabricKey] === lot.lotId ? 'bg-orange-50' : ''}`}
                                  onClick={() => setSelectedLots((prev) => ({ ...prev, [fabricKey]: lot.lotId }))}
                                >
                                  <TableCell>
                                    <RadioGroupItem value={lot.lotId} />
                                  </TableCell>
                                  <TableCell className="font-medium">Lot {lot.lotNumber}</TableCell>
                                  <TableCell>{lot.rollNumbers || '-'}</TableCell>
                                  <TableCell className="text-center">{lot.actualWidth}"</TableCell>
                                  <TableCell className="text-right font-medium">
                                    {lot.quantityAvailable.toFixed(1)}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={lot.qualityGrade === 'A' ? 'default' : 'secondary'}>
                                      {lot.qualityGrade}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </RadioGroup>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          )}

          {/* Existing Batches */}
          {chartData.existingBatches.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-gray-600">Existing Batches</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {chartData.existingBatches.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer hover:bg-gray-50"
                      onClick={() => navigate(`/manufacturing/cutting/${b.id}`)}
                    >
                      <span className="font-medium text-sm">{b.batchNumber}</span>
                      <Badge variant={b.status === 'COMPLETED' ? 'default' : 'secondary'} className="text-xs">
                        {b.status}
                      </Badge>
                      <span className="text-sm text-gray-500">{b.totalCut} pcs</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
      {/* PDF Preview Dialog */}
      <Dialog open={showPdfPreview} onOpenChange={setShowPdfPreview}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle>Cutting Chart Preview</DialogTitle>
          </DialogHeader>
          <iframe src={pdfPreviewUrl} className="w-full flex-1 border-0 rounded-b-lg" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
