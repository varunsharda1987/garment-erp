/**
 * Embroidery Stock Send-Out Page
 * Form to send fabric out for embroidery processing
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Alert, AlertDescription } from '../components/ui/alert';
import { embroideryService } from '../services/embroidery.service';
import { getAllSuppliers } from '../services/supplier.service';
import { styleService } from '../services/style.service';
import { getAllOrders } from '../services/order.service';
import { CheckCircle, XCircle, ArrowLeft, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import type { Embroidery, EmbroiderySendOutRequest } from '../types/embroidery.types';
import type { Supplier } from '../types/supplier.types';
import type { Style } from '../types/style.types';
import type { Order } from '../types/order.types';
import { logError } from '../lib/logger';
import api from '@/lib/api';
import { formatCurrency } from '../lib/currency';
import { formatStyleCodeWithRef } from '../utils/style-ref-format';

interface FabricStock {
  id: string;
  fabricId: string;
  width: number;
  quantityAvailable: number;
  weightedAvgCost: number;
  qualityGrade: string;
  warehouseLocation?: string;
  fabricMaster?: {
    fabricCode: string;
    fabricName: string;
    colorName?: string;
    finishType?: string;
  };
}

export default function EmbroideryStockSendOut() {
  const navigate = useNavigate();

  // Navigation timeout ref for cleanup
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
    },
    []
  );

  // Data lists
  const [fabricStockList, setFabricStockList] = useState<FabricStock[]>([]);
  const [embroideryList, setEmbroideryList] = useState<Embroidery[]>([]);
  const [supplierList, setSupplierList] = useState<Supplier[]>([]);
  const [styleList, setStyleList] = useState<Style[]>([]);
  const [orderList, setOrderList] = useState<Order[]>([]);

  // Selected items
  const [selectedStockId, setSelectedStockId] = useState<string>('');
  const [selectedEmbroideryId, setSelectedEmbroideryId] = useState<string>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  // Collapsible sections
  const [showStockDetails, setShowStockDetails] = useState(true);
  const [showEmbroideryDetails, setShowEmbroideryDetails] = useState(true);

  // Form data
  const [formData, setFormData] = useState({
    quantitySent: '',
    sentWidth: '',
    sendDate: new Date().toISOString().split('T')[0],
    expectedReturnDate: '',
    agreedRate: '',
    forStyleId: '',
    forOrderId: '',
    remarks: '',
  });

  // States
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load fabric stock (available, non-embroidered)
      try {
        const stockResponse = await api.get<{ data: FabricStock[] } | FabricStock[]>(
          '/stock?status=AVAILABLE&stockType=GENERIC'
        );
        const stockData = stockResponse.data;
        const stockArray = (stockData as { data: FabricStock[] }).data || (stockData as FabricStock[]) || [];
        const plainStock = stockArray.filter((s: FabricStock & { embroideryId?: string }) => !s.embroideryId);
        setFabricStockList(plainStock);
      } catch {
        toast.error('Failed to load fabric stock');
        setFabricStockList([]);
      }

      // Load embroidery designs
      const embroideryData = await embroideryService.getAllEmbroidery({ limit: 200, isActive: true });
      setEmbroideryList(embroideryData.data || []);

      // Load suppliers (embroidery category)
      const supplierData = await getAllSuppliers({ limit: 200, category: 'EMBROIDERY' });
      // If no embroidery-specific suppliers, load all
      if (!supplierData.data?.length) {
        const allSuppliers = await getAllSuppliers({ limit: 200 });
        setSupplierList(allSuppliers.data || []);
      } else {
        setSupplierList(supplierData.data || []);
      }

      // Load styles and orders for optional earmarking (non-blocking)
      try {
        const [styleData, orderData] = await Promise.all([
          styleService.getAllStyles(1, 200),
          getAllOrders({ limit: 200 }),
        ]);
        setStyleList(styleData.data || []);
        setOrderList(orderData.data || []);
      } catch {
        toast.warning('Could not load styles/orders for earmarking');
        setStyleList([]);
        setOrderList([]);
      }
    } catch (err) {
      logError('Failed to load initial data:', err);
      setError('Failed to load required data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStockChange = (stockId: string) => {
    setSelectedStockId(stockId);
    const selectedStock = fabricStockList.find((s) => s.id === stockId);
    if (selectedStock) {
      setFormData((prev) => ({
        ...prev,
        sentWidth: selectedStock.width.toString(),
      }));
    }
  };

  const handleEmbroideryChange = (embroideryId: string) => {
    setSelectedEmbroideryId(embroideryId);
    const selectedEmbroidery = embroideryList.find((e) => e.id === embroideryId);
    if (selectedEmbroidery) {
      setFormData((prev) => ({
        ...prev,
        agreedRate: selectedEmbroidery.costPerMeter?.toString() || '',
      }));
      // Auto-select supplier if embroidery has one
      if (selectedEmbroidery.supplierId) {
        setSelectedSupplierId(selectedEmbroidery.supplierId);
      }
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(false);

      // BUG-EMB12 fix: comprehensive validation with BUG-EMB10 NaN guards
      if (!selectedStockId) {
        setError('Please select a fabric stock');
        return;
      }
      if (!selectedEmbroideryId) {
        setError('Please select an embroidery design');
        return;
      }
      if (!selectedSupplierId) {
        setError('Please select a supplier');
        return;
      }

      // BUG-EMB10 fix: guard against NaN values
      const parsedQuantitySent = parseFloat(formData.quantitySent);
      const parsedAgreedRate = parseFloat(formData.agreedRate);
      const parsedSentWidth = parseFloat(formData.sentWidth);

      if (!formData.quantitySent || !Number.isFinite(parsedQuantitySent) || parsedQuantitySent <= 0) {
        setError('Please enter a valid quantity');
        return;
      }
      if (!formData.agreedRate || !Number.isFinite(parsedAgreedRate) || parsedAgreedRate <= 0) {
        setError('Please enter a valid agreed rate');
        return;
      }
      if (!formData.sentWidth || !Number.isFinite(parsedSentWidth) || parsedSentWidth <= 0) {
        setError('Please enter a valid width');
        return;
      }

      // Check available quantity
      const selectedStock = fabricStockList.find((s) => s.id === selectedStockId);
      if (selectedStock && parsedQuantitySent > selectedStock.quantityAvailable) {
        setError(`Quantity exceeds available stock (${selectedStock.quantityAvailable} meters)`);
        return;
      }

      // BUG-EMB10 fix: use pre-validated parsed values
      const sendOutData: EmbroiderySendOutRequest = {
        sourceFabricStockId: selectedStockId,
        embroideryId: selectedEmbroideryId,
        supplierId: selectedSupplierId,
        quantitySent: parsedQuantitySent,
        sentWidth: parsedSentWidth,
        sendDate: formData.sendDate,
        expectedReturnDate: formData.expectedReturnDate || undefined,
        agreedRate: parsedAgreedRate,
        forStyleId: formData.forStyleId || undefined,
        forOrderId: formData.forOrderId || undefined,
        remarks: formData.remarks || undefined,
      };

      await embroideryService.sendOut(sendOutData);

      setSuccess(true);

      // Navigate to send-outs list after 2 seconds
      navTimeoutRef.current = setTimeout(() => {
        navigate('/embroidery-stock');
      }, 2000);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || 'Failed to send fabric for embroidery';
      setError(errorMessage);
      logError('Failed to send fabric for embroidery:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedStock = fabricStockList.find((s) => s.id === selectedStockId);
  const selectedEmbroidery = embroideryList.find((e) => e.id === selectedEmbroideryId);
  const selectedSupplier = supplierList.find((s) => s.id === selectedSupplierId);

  const estimatedCost =
    formData.quantitySent && formData.agreedRate
      ? parseFloat(formData.quantitySent) * parseFloat(formData.agreedRate)
      : 0;

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-info">
          Home
        </Link>
        {' > '}
        <Link to="/fabric" className="hover:text-info">
          Fabric
        </Link>
        {' > '}
        <Link to="/embroidery-stock" className="hover:text-info">
          Embroidery Stock
        </Link>
        {' > '}
        <span className="font-medium text-foreground">Send Out</span>
      </div>

      {/* Back Button */}
      <div className="mb-4">
        <Button variant="ghost" onClick={() => navigate('/embroidery-stock')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Embroidery Stock
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-accent" />
            Send Fabric for Embroidery
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Send plain fabric out to embroidery vendor. When received back, it will be tracked as embroidered fabric
            stock.
          </p>
        </CardHeader>
        <CardContent>
          {/* Success Alert */}
          {success && (
            <Alert className="mb-6 bg-success-muted border-success/20">
              <CheckCircle className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">
                Fabric sent for embroidery successfully! Redirecting...
              </AlertDescription>
            </Alert>
          )}

          {/* Error Alert */}
          {error && (
            <Alert className="mb-6 bg-destructive/10 border-destructive/20">
              <XCircle className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-destructive">{error}</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading data...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Step 1: Select Fabric Stock */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  <span className="bg-accent/10 text-accent px-2 py-1 rounded text-sm">Step 1</span>
                  Select Fabric Stock
                </h3>
                <div>
                  <Label>
                    Plain Fabric Stock <span className="text-destructive">*</span>
                  </Label>
                  <Select value={selectedStockId} onValueChange={handleStockChange}>
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Select fabric stock to send for embroidery..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fabricStockList.map((stock) => (
                        <SelectItem key={stock.id} value={stock.id}>
                          {stock.fabricMaster?.fabricCode} - {stock.fabricMaster?.fabricName}
                          {stock.fabricMaster?.colorName && ` (${stock.fabricMaster.colorName})`} |{' '}
                          {stock.quantityAvailable.toFixed(2)}m @ {stock.width}"
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Stock Details Panel */}
                {selectedStock && (
                  <Card className="bg-info-muted border-info/20 mt-4">
                    <CardContent className="pt-4">
                      <button
                        onClick={() => setShowStockDetails(!showStockDetails)}
                        className="flex items-center gap-2 text-sm font-medium text-info hover:text-info w-full justify-between"
                      >
                        <span>Selected Fabric Details</span>
                        {showStockDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      {showStockDetails && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mt-3">
                          <div>
                            <span className="text-muted-foreground">Fabric Code:</span>
                            <p className="font-medium">{selectedStock.fabricMaster?.fabricCode}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Fabric Name:</span>
                            <p className="font-medium">{selectedStock.fabricMaster?.fabricName}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Color:</span>
                            <p className="font-medium">{selectedStock.fabricMaster?.colorName || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Available Qty:</span>
                            <p className="font-medium text-success">{selectedStock.quantityAvailable.toFixed(2)} m</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Width:</span>
                            <p className="font-medium">{selectedStock.width}"</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Cost/m:</span>
                            <p className="font-medium">{formatCurrency(selectedStock.weightedAvgCost)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Quality:</span>
                            <p className="font-medium">{selectedStock.qualityGrade}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Location:</span>
                            <p className="font-medium">{selectedStock.warehouseLocation || 'N/A'}</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Step 2: Select Embroidery Design */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  <span className="bg-accent/10 text-accent px-2 py-1 rounded text-sm">Step 2</span>
                  Select Embroidery Design
                </h3>
                <div>
                  <Label>
                    Embroidery Design <span className="text-destructive">*</span>
                  </Label>
                  <Select value={selectedEmbroideryId} onValueChange={handleEmbroideryChange}>
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Select embroidery design..." />
                    </SelectTrigger>
                    <SelectContent>
                      {embroideryList.map((emb) => (
                        <SelectItem key={emb.id} value={emb.id}>
                          {emb.embroideryCode} - {emb.designName} | {formatCurrency(emb.costPerMeter)}/m
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Embroidery Details Panel */}
                {selectedEmbroidery && (
                  <Card className="bg-accent/10 border-accent/20 mt-4">
                    <CardContent className="pt-4">
                      <button
                        onClick={() => setShowEmbroideryDetails(!showEmbroideryDetails)}
                        className="flex items-center gap-2 text-sm font-medium text-accent hover:text-accent w-full justify-between"
                      >
                        <span>Embroidery Design Details</span>
                        {showEmbroideryDetails ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                      {showEmbroideryDetails && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mt-3">
                          <div>
                            <span className="text-muted-foreground">Code:</span>
                            <p className="font-medium">{selectedEmbroidery.embroideryCode}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Design Name:</span>
                            <p className="font-medium">{selectedEmbroidery.designName}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Stitch Count:</span>
                            <p className="font-medium">{selectedEmbroidery.stitchCount?.toLocaleString() || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Thread Colors:</span>
                            <p className="font-medium">{selectedEmbroidery.threadColors || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Min Fabric Width:</span>
                            <p className="font-medium">{selectedEmbroidery.minFabricWidth || 'N/A'}"</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Usable Width After:</span>
                            <p className="font-medium text-primary">{selectedEmbroidery.usableWidthAfter}"</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Cost/meter:</span>
                            <p className="font-medium text-success">
                              {formatCurrency(selectedEmbroidery.costPerMeter)}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Lead Time:</span>
                            <p className="font-medium">{selectedEmbroidery.leadTimeDays || 'N/A'} days</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Step 3: Select Supplier */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  <span className="bg-accent/10 text-accent px-2 py-1 rounded text-sm">Step 3</span>
                  Select Embroidery Supplier
                </h3>
                <div>
                  <Label>
                    Supplier <span className="text-destructive">*</span>
                  </Label>
                  <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Select embroidery supplier..." />
                    </SelectTrigger>
                    <SelectContent>
                      {supplierList.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.code} - {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedSupplier && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Contact: {selectedSupplier.contactPerson || 'N/A'} | Phone: {selectedSupplier.phone || 'N/A'}
                  </p>
                )}
              </div>

              {/* Step 4: Send-Out Details */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  <span className="bg-accent/10 text-accent px-2 py-1 rounded text-sm">Step 4</span>
                  Send-Out Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="quantitySent">
                      Quantity to Send (meters) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="quantitySent"
                      type="number"
                      step="0.01"
                      value={formData.quantitySent}
                      onChange={(e) => handleFieldChange('quantitySent', e.target.value)}
                      placeholder="e.g., 100"
                      className="mt-1"
                    />
                    {selectedStock && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Available: {selectedStock.quantityAvailable.toFixed(2)} m
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="sentWidth">
                      Sent Width (inches) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="sentWidth"
                      type="number"
                      step="0.1"
                      value={formData.sentWidth}
                      onChange={(e) => handleFieldChange('sentWidth', e.target.value)}
                      placeholder="Auto-filled from stock"
                      className="mt-1 bg-muted"
                    />
                  </div>

                  <div>
                    <Label htmlFor="agreedRate">
                      Agreed Rate (per meter) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="agreedRate"
                      type="number"
                      step="0.01"
                      value={formData.agreedRate}
                      onChange={(e) => handleFieldChange('agreedRate', e.target.value)}
                      placeholder="e.g., 25.50"
                      className="mt-1"
                    />
                    {selectedEmbroidery && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Standard rate: {formatCurrency(selectedEmbroidery.costPerMeter)}/m
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="sendDate">
                      Send Date <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="sendDate"
                      type="date"
                      value={formData.sendDate}
                      onChange={(e) => handleFieldChange('sendDate', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="expectedReturnDate">Expected Return Date</Label>
                    <Input
                      id="expectedReturnDate"
                      type="date"
                      value={formData.expectedReturnDate}
                      onChange={(e) => handleFieldChange('expectedReturnDate', e.target.value)}
                      className="mt-1"
                    />
                    {selectedEmbroidery?.leadTimeDays && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Lead time: {selectedEmbroidery.leadTimeDays} days
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="forStyleId">For Style (optional)</Label>
                    <Select
                      value={formData.forStyleId}
                      onValueChange={(v) => handleFieldChange('forStyleId', v === '__none__' ? '' : v)}
                    >
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue placeholder="Earmark for a style..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {styleList.map((style) => (
                          <SelectItem key={style.id} value={style.id}>
                            {formatStyleCodeWithRef(style.styleCode, style.buyerStyleRef)} - {style.styleName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="forOrderId">For Order (optional)</Label>
                    <Select
                      value={formData.forOrderId}
                      onValueChange={(v) => handleFieldChange('forOrderId', v === '__none__' ? '' : v)}
                    >
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue placeholder="Earmark for an order..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {orderList.map((order) => (
                          <SelectItem key={order.id} value={order.id}>
                            {order.orderNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="remarks">Remarks / Special Instructions</Label>
                    <textarea
                      id="remarks"
                      value={formData.remarks}
                      onChange={(e) => handleFieldChange('remarks', e.target.value)}
                      placeholder="Any special instructions for the embroidery vendor..."
                      className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 mt-1"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Cost Summary */}
              {estimatedCost > 0 && (
                <Card className="bg-muted">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium text-foreground">Estimated Embroidery Cost:</span>
                        <p className="text-sm text-muted-foreground">
                          {formData.quantitySent} m x {formatCurrency(parseFloat(formData.agreedRate))}/m
                        </p>
                      </div>
                      <span className="text-2xl font-bold text-accent">{formatCurrency(estimatedCost)}</span>
                    </div>
                    {selectedStock && (
                      <div className="mt-3 pt-3 border-t flex justify-between items-center">
                        <span className="text-muted-foreground">Combined Cost (Fabric + Embroidery):</span>
                        <span className="font-bold text-info">
                          {formatCurrency(
                            parseFloat(formData.quantitySent || '0') * selectedStock.weightedAvgCost + estimatedCost
                          )}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4 justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => navigate('/embroidery-stock')} disabled={isSaving}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={
                    isSaving ||
                    !selectedStockId ||
                    !selectedEmbroideryId ||
                    !selectedSupplierId ||
                    !formData.quantitySent ||
                    !formData.agreedRate
                  }
                  className="bg-accent hover:bg-accent"
                >
                  {isSaving ? 'Sending...' : 'Send for Embroidery'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
