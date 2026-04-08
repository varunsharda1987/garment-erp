/**
 * Embroidery Stock Receive Page
 * Form to receive embroidered fabric back from vendor
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Alert, AlertDescription } from '../components/ui/alert';
import { embroideryService } from '../services/embroidery.service';
import { CheckCircle, XCircle, Package2, ArrowLeft, Sparkles, Clock, AlertTriangle } from 'lucide-react';
import type { EmbroiderySendOut, EmbroideryReceiveRequest } from '../types/embroidery.types';
import { logError } from '../lib/logger';
import { formatCurrency } from '../lib/currency';

export default function EmbroideryStockReceive() {
  const navigate = useNavigate();
  const { id: sendOutId } = useParams<{ id: string }>();

  // Data
  const [sendOut, setSendOut] = useState<EmbroiderySendOut | null>(null);
  const [pendingSendOuts, setPendingSendOuts] = useState<EmbroiderySendOut[]>([]);

  // Selected send-out (for list mode)
  const [selectedSendOutId, setSelectedSendOutId] = useState<string>(sendOutId || '');

  // Navigation timeout ref for cleanup
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
    },
    []
  );

  // Form data
  const [formData, setFormData] = useState({
    quantityReceived: '',
    quantityDamaged: '',
    receivedWidth: '',
    actualReturnDate: new Date().toISOString().split('T')[0],
    actualCost: '',
    invoiceNumber: '',
    invoiceDate: '',
    qualityGrade: 'A' as 'A' | 'B' | 'DEFECT',
    warehouseLocation: '',
    remarks: '',
  });

  // States
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (sendOutId) {
      loadSendOut(sendOutId);
    } else {
      loadPendingSendOuts();
    }
  }, [sendOutId]);

  const loadSendOut = async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await embroideryService.getSendOutById(id);
      setSendOut(data);

      // Pre-fill form with expected values
      setFormData((prev) => ({
        ...prev,
        quantityReceived: data.quantitySent.toString(),
        receivedWidth: data.embroidery?.usableWidthAfter?.toString() || data.sentWidth.toString(),
        actualCost: (data.quantitySent * data.agreedRate).toString(),
      }));
    } catch (err) {
      logError('Failed to load send-out:', err);
      setError('Failed to load send-out details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPendingSendOuts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Get all sent/in-progress send-outs
      const data = await embroideryService.getSendOuts({ status: 'SENT' });
      setPendingSendOuts(data);
    } catch (err) {
      logError('Failed to load pending send-outs:', err);
      setError('Failed to load pending send-outs. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOutSelect = async (id: string) => {
    setSelectedSendOutId(id);
    await loadSendOut(id);
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

      const activeSendOutId = sendOutId || selectedSendOutId;

      // Validation
      if (!activeSendOutId) {
        setError('Please select a send-out to receive');
        return;
      }
      if (!formData.quantityReceived || parseFloat(formData.quantityReceived) <= 0) {
        setError('Please enter a valid received quantity');
        return;
      }
      if (!formData.receivedWidth || parseFloat(formData.receivedWidth) <= 0) {
        setError('Please enter a valid received width');
        return;
      }

      // Validate against sent quantity
      if (sendOut) {
        const totalReceived = parseFloat(formData.quantityReceived) + parseFloat(formData.quantityDamaged || '0');
        if (totalReceived > sendOut.quantitySent) {
          setError(`Total received (${totalReceived}m) cannot exceed sent quantity (${sendOut.quantitySent}m)`);
          return;
        }
      }

      const receiveData: EmbroideryReceiveRequest = {
        sendOutId: activeSendOutId,
        quantityReceived: parseFloat(formData.quantityReceived),
        quantityDamaged: formData.quantityDamaged ? parseFloat(formData.quantityDamaged) : undefined,
        receivedWidth: parseFloat(formData.receivedWidth),
        actualReturnDate: formData.actualReturnDate,
        actualCost: formData.actualCost ? parseFloat(formData.actualCost) : undefined,
        invoiceNumber: formData.invoiceNumber || undefined,
        invoiceDate: formData.invoiceDate || undefined,
        qualityGrade: formData.qualityGrade,
        warehouseLocation: formData.warehouseLocation || undefined,
        remarks: formData.remarks || undefined,
      };

      await embroideryService.receive(receiveData);

      setSuccess(true);

      // Navigate to stock view after 2 seconds
      navTimeoutRef.current = setTimeout(() => {
        navigate('/embroidery-stock');
      }, 2000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to receive embroidered fabric';
      setError(errorMessage);
      logError('Failed to receive embroidered fabric:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, React.ReactNode> = {
      SENT: <span className="px-2 py-1 bg-info-muted text-info rounded text-xs font-medium">Sent</span>,
      IN_PROGRESS: (
        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">In Progress</span>
      ),
      RECEIVED: <span className="px-2 py-1 bg-success-muted text-success rounded text-xs font-medium">Received</span>,
      PARTIALLY_RECEIVED: (
        <span className="px-2 py-1 bg-orange-100 text-primary rounded text-xs font-medium">Partial</span>
      ),
      CANCELLED: (
        <span className="px-2 py-1 bg-destructive/10 text-destructive rounded text-xs font-medium">Cancelled</span>
      ),
    };
    return badges[status] || status;
  };

  const isOverdue = (expectedDate?: string | null) => {
    if (!expectedDate) return false;
    return new Date(expectedDate) < new Date();
  };

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
        <span className="font-medium text-foreground">Receive</span>
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
            <Package2 className="h-6 w-6 text-success" />
            Receive Embroidered Fabric
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Receive embroidered fabric back from vendor. This will create new embroidered fabric stock.
          </p>
        </CardHeader>
        <CardContent>
          {/* Success Alert */}
          {success && (
            <Alert className="mb-6 bg-success-muted border-success/20">
              <CheckCircle className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">
                Embroidered fabric received successfully! New stock entry created. Redirecting...
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-success mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading data...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Send-Out Selection (if not pre-selected) */}
              {!sendOutId && (
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                    <span className="bg-success-muted text-success px-2 py-1 rounded text-sm">Step 1</span>
                    Select Send-Out to Receive
                  </h3>
                  <div>
                    <Label>
                      Pending Send-Out <span className="text-destructive">*</span>
                    </Label>
                    <Select value={selectedSendOutId} onValueChange={handleSendOutSelect}>
                      <SelectTrigger className="w-full mt-1">
                        <SelectValue placeholder="Select a pending send-out..." />
                      </SelectTrigger>
                      <SelectContent>
                        {pendingSendOuts.map((so) => (
                          <SelectItem key={so.id} value={so.id}>
                            {so.sourceFabricStock?.fabricMaster?.fabricCode} → {so.embroidery?.designName} |{' '}
                            {so.quantitySent}m | Sent: {new Date(so.sendDate).toLocaleDateString()}
                            {isOverdue(so.expectedReturnDate) && ' ⚠️ OVERDUE'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Send-Out Details */}
              {sendOut && (
                <Card className="bg-info-muted border-info/20">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-medium text-foreground">Send-Out Details</h4>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(sendOut.status)}
                        {isOverdue(sendOut.expectedReturnDate) && (
                          <span className="px-2 py-1 bg-destructive/10 text-destructive rounded text-xs font-medium flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Overdue
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Source Fabric:</span>
                        <p className="font-medium">
                          {sendOut.sourceFabricStock?.fabricMaster?.fabricCode} -{' '}
                          {sendOut.sourceFabricStock?.fabricMaster?.fabricName}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Embroidery Design:</span>
                        <p className="font-medium flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-accent" />
                          {sendOut.embroidery?.designName}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Supplier:</span>
                        <p className="font-medium">{sendOut.supplier?.name}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Quantity Sent:</span>
                        <p className="font-medium text-info">{sendOut.quantitySent} m</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Sent Width:</span>
                        <p className="font-medium">{sendOut.sentWidth}"</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Expected Width After:</span>
                        <p className="font-medium text-primary">{sendOut.embroidery?.usableWidthAfter}"</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Agreed Rate:</span>
                        <p className="font-medium">{formatCurrency(sendOut.agreedRate)}/m</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Send Date:</span>
                        <p className="font-medium">{new Date(sendOut.sendDate).toLocaleDateString()}</p>
                      </div>
                      {sendOut.expectedReturnDate && (
                        <div>
                          <span className="text-muted-foreground">Expected Return:</span>
                          <p
                            className={`font-medium ${isOverdue(sendOut.expectedReturnDate) ? 'text-destructive' : 'text-foreground'}`}
                          >
                            <Clock className="h-3 w-3 inline mr-1" />
                            {new Date(sendOut.expectedReturnDate).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                      {sendOut.forStyle && (
                        <div>
                          <span className="text-muted-foreground">For Style:</span>
                          <p className="font-medium">{sendOut.forStyle.styleCode}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Receive Form */}
              {sendOut && (
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
                    <span className="bg-success-muted text-success px-2 py-1 rounded text-sm">
                      {sendOutId ? 'Step 1' : 'Step 2'}
                    </span>
                    Receive Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="quantityReceived">
                        Quantity Received (meters) <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="quantityReceived"
                        type="number"
                        step="0.01"
                        value={formData.quantityReceived}
                        onChange={(e) => handleFieldChange('quantityReceived', e.target.value)}
                        placeholder="e.g., 100"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Sent: {sendOut.quantitySent} m</p>
                    </div>

                    <div>
                      <Label htmlFor="quantityDamaged">Quantity Damaged (meters)</Label>
                      <Input
                        id="quantityDamaged"
                        type="number"
                        step="0.01"
                        value={formData.quantityDamaged}
                        onChange={(e) => handleFieldChange('quantityDamaged', e.target.value)}
                        placeholder="e.g., 5"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="receivedWidth">
                        Received/Usable Width (inches) <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="receivedWidth"
                        type="number"
                        step="0.1"
                        value={formData.receivedWidth}
                        onChange={(e) => handleFieldChange('receivedWidth', e.target.value)}
                        placeholder="e.g., 50"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Sent: {sendOut.sentWidth}" | Expected: {sendOut.embroidery?.usableWidthAfter}"
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="actualReturnDate">
                        Actual Return Date <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="actualReturnDate"
                        type="date"
                        value={formData.actualReturnDate}
                        onChange={(e) => handleFieldChange('actualReturnDate', e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="qualityGrade">
                        Quality Grade <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={formData.qualityGrade}
                        onValueChange={(value: 'A' | 'B' | 'DEFECT') => handleFieldChange('qualityGrade', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">Grade A (Premium)</SelectItem>
                          <SelectItem value="B">Grade B (Standard)</SelectItem>
                          <SelectItem value="DEFECT">Defect (Rejected)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="warehouseLocation">Warehouse Location</Label>
                      <Input
                        id="warehouseLocation"
                        value={formData.warehouseLocation}
                        onChange={(e) => handleFieldChange('warehouseLocation', e.target.value)}
                        placeholder="e.g., Warehouse A"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="actualCost">Actual Total Cost</Label>
                      <Input
                        id="actualCost"
                        type="number"
                        step="0.01"
                        value={formData.actualCost}
                        onChange={(e) => handleFieldChange('actualCost', e.target.value)}
                        placeholder="e.g., 2500.00"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Expected: {formatCurrency(sendOut.quantitySent * sendOut.agreedRate)}
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="invoiceNumber">Invoice Number</Label>
                      <Input
                        id="invoiceNumber"
                        value={formData.invoiceNumber}
                        onChange={(e) => handleFieldChange('invoiceNumber', e.target.value)}
                        placeholder="e.g., INV-2024-001"
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="invoiceDate">Invoice Date</Label>
                      <Input
                        id="invoiceDate"
                        type="date"
                        value={formData.invoiceDate}
                        onChange={(e) => handleFieldChange('invoiceDate', e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label htmlFor="remarks">Remarks / Quality Notes</Label>
                      <textarea
                        id="remarks"
                        value={formData.remarks}
                        onChange={(e) => handleFieldChange('remarks', e.target.value)}
                        placeholder="Any quality issues, notes, or observations..."
                        className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Cost Summary */}
              {sendOut && formData.quantityReceived && (
                <Card className="bg-muted">
                  <CardContent className="pt-4">
                    <h4 className="font-medium text-foreground mb-3">Cost Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Original Fabric Cost:</span>
                        <span className="font-medium">
                          {formatCurrency(
                            parseFloat(formData.quantityReceived) * (sendOut.sourceFabricStock?.weightedAvgCost || 0)
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Embroidery Cost:</span>
                        <span className="font-medium">
                          {formatCurrency(
                            formData.actualCost
                              ? parseFloat(formData.actualCost)
                              : parseFloat(formData.quantityReceived) * sendOut.agreedRate
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t text-base">
                        <span className="font-medium text-foreground">Combined Cost per Meter:</span>
                        <span className="font-bold text-success">
                          {formatCurrency(
                            (sendOut.sourceFabricStock?.weightedAvgCost || 0) +
                              (formData.actualCost
                                ? parseFloat(formData.actualCost) / parseFloat(formData.quantityReceived)
                                : sendOut.agreedRate)
                          )}
                          /m
                        </span>
                      </div>
                    </div>
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
                    (!sendOutId && !selectedSendOutId) ||
                    !formData.quantityReceived ||
                    !formData.receivedWidth
                  }
                  className="bg-success hover:bg-success"
                >
                  {isSaving ? 'Processing...' : 'Receive & Create Stock'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
