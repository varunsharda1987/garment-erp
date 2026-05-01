import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Combobox, type ComboboxOption } from '../components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { createGreigeStock } from '../services/style-stock.service';
import { greigeService } from '../services/fabricGreigeService';
import { warehouseService } from '../services/warehouse.service';
import api from '../lib/api';
import { CheckCircle, XCircle, Package2, ArrowLeft } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';

interface GreigeMaster {
  id: string;
  greigeCode: string;
  greigeName: string;
  composition: string;
  yarnCount?: string;
  construction?: string;
  weaveType?: string;
  greigeQuality?: string;
  weaver?: string;
  greigeWidth: number;
}

export default function GreigeStockEntry() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedGreigeId = searchParams.get('greigeId') || '';

  const [greigeList, setGreigeList] = useState<GreigeMaster[]>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; warehouseCode: string; warehouseName: string }>>([]);
  const [selectedGreigeId, setSelectedGreigeId] = useState<string>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [formData, setFormData] = useState({
    quantity: '',
    width: '',
    rollNumbers: '',
    warehouseLocation: '',
    purchaseCost: '',
    receivedDate: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
    invoiceDate: '',
    foldLengthCm: '',
    thanCount: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    loadGreigeList();
  }, []);

  const loadGreigeList = async () => {
    try {
      setIsLoading(true);
      const [greigeResponse, warehouseData, suppliersResponse] = await Promise.all([
        greigeService.getAll({ limit: 100 }),
        warehouseService.getAll({ isActive: true }),
        api.get('/suppliers', { params: { limit: 200, category: 'GREIGE_SUPPLIER' } }),
      ]);
      const loadedList = greigeResponse.data || [];
      setGreigeList(loadedList);
      setWarehouses(warehouseData);
      setSuppliers(suppliersResponse.data?.data || []);

      // Auto-select greige if passed via URL query param
      if (preselectedGreigeId && loadedList.length > 0) {
        const match = loadedList.find((g: GreigeMaster) => g.id === preselectedGreigeId);
        if (match) {
          setSelectedGreigeId(preselectedGreigeId);
          setFormData((prev) => ({ ...prev, width: match.greigeWidth.toString() }));
        }
      }
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGreigeChange = (greigeId: string) => {
    setSelectedGreigeId(greigeId);
    const selectedGreige = greigeList.find((g) => g.id === greigeId);
    if (selectedGreige) {
      setFormData((prev) => ({
        ...prev,
        width: selectedGreige.greigeWidth.toString(),
      }));
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleReview = () => {
    setError(null);
    if (!selectedGreigeId) {
      setError('Please select a greige fabric');
      return;
    }
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      setError('Please enter a valid quantity');
      return;
    }
    setShowConfirm(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(false);

      await createGreigeStock({
        greigeId: selectedGreigeId,
        quantity: parseFloat(formData.quantity),
        width: parseFloat(formData.width),
        rollNumbers: formData.rollNumbers || undefined,
        warehouseLocation: formData.warehouseLocation || undefined,
        purchaseCost: formData.purchaseCost ? parseFloat(formData.purchaseCost) : undefined,
        receivedDate: formData.receivedDate ? new Date(formData.receivedDate) : undefined,
        supplierId: selectedSupplierId || undefined,
        invoiceNumber: formData.invoiceNumber || undefined,
        invoiceDate: formData.invoiceDate ? new Date(formData.invoiceDate) : undefined,
        foldLengthCm: formData.foldLengthCm ? parseFloat(formData.foldLengthCm) : undefined,
        thanCount: formData.thanCount ? parseInt(formData.thanCount, 10) : undefined,
      });

      setSuccess(true);

      // Reset form after 2 seconds or navigate
      setTimeout(() => {
        navigate('/greige-stock');
      }, 2000);
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to save greige stock entry');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedGreige = greigeList.find((g) => g.id === selectedGreigeId);

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-info">
          Home
        </Link>
        {' > '}
        <Link to="/greige" className="hover:text-info">
          Greige Master
        </Link>
        {' > '}
        <span className="font-medium text-foreground">Stock Entry</span>
      </div>

      {/* Back Button */}
      <div className="mb-4">
        <Button variant="ghost" onClick={() => navigate('/greige')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Greige Master
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package2 className="h-6 w-6 text-info" />
            Generic Greige Stock Entry
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Add generic greige fabric stock that can be allocated to any future style
          </p>
        </CardHeader>
        <CardContent>
          {/* Success Alert */}
          {success && (
            <Alert className="mb-6 bg-success-muted border-success/20">
              <CheckCircle className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">
                Greige stock entry saved successfully! Redirecting...
              </AlertDescription>
            </Alert>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Info Panel */}
          <div className="mb-6 p-4 bg-info-muted rounded-lg border border-info/20">
            <h3 className="font-medium text-info mb-2">About Generic Greige Stock</h3>
            <ul className="text-sm text-info space-y-1">
              <li>• Generic greige is NOT tied to any specific style</li>
              <li>• Can be allocated to any future style when an order comes</li>
              <li>• Will be processed (dyed/printed) based on style requirements</li>
              <li>• Remaining greige after allocation stays generic</li>
            </ul>
          </div>

          {/* Greige Selection */}
          <div className="space-y-6">
            <div>
              <Label htmlFor="greige">Select Greige Fabric *</Label>
              <Combobox
                options={greigeList.map(
                  (greige): ComboboxOption => ({
                    value: greige.id,
                    label: `${greige.greigeCode} - ${greige.greigeName} (${greige.composition})`,
                    searchText: `${greige.greigeCode} ${greige.greigeName} ${greige.composition} ${greige.yarnCount || ''} ${greige.construction || ''} ${greige.weaveType || ''}`,
                  })
                )}
                value={selectedGreigeId}
                onValueChange={handleGreigeChange}
                placeholder={isLoading ? 'Loading greige list...' : 'Search or select greige fabric...'}
                searchPlaceholder="Type to search by code, name, composition..."
                emptyText="No greige fabric found."
                disabled={isLoading}
              />
            </div>

            {/* Greige Details */}
            {selectedGreige && (
              <div className="p-4 bg-muted rounded-lg border border-border">
                <h3 className="font-medium text-foreground mb-3">Greige Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Code:</span>
                    <span className="ml-2 font-medium">{selectedGreige.greigeCode}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Composition:</span>
                    <span className="ml-2 font-medium">{selectedGreige.composition}</span>
                  </div>
                  {selectedGreige.yarnCount && (
                    <div>
                      <span className="text-muted-foreground">Yarn Count:</span>
                      <span className="ml-2 font-medium">{selectedGreige.yarnCount}</span>
                    </div>
                  )}
                  {selectedGreige.construction && (
                    <div>
                      <span className="text-muted-foreground">Construction:</span>
                      <span className="ml-2 font-medium">{selectedGreige.construction}</span>
                    </div>
                  )}
                  {selectedGreige.weaveType && (
                    <div>
                      <span className="text-muted-foreground">Weave:</span>
                      <span className="ml-2 font-medium">{selectedGreige.weaveType}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Width:</span>
                    <span className="ml-2 font-medium">{Number(selectedGreige.greigeWidth)}"</span>
                  </div>
                  {selectedGreige.greigeQuality && (
                    <div>
                      <span className="text-muted-foreground">Greige Quality:</span>
                      <span className="ml-2 font-medium">
                        {selectedGreige.greigeQuality === 'SUPER_DYEING'
                          ? 'Super Dyeing'
                          : selectedGreige.greigeQuality === 'DYEING'
                            ? 'Dyeing'
                            : 'Printing'}
                      </span>
                    </div>
                  )}
                  {selectedGreige.weaver && (
                    <div>
                      <span className="text-muted-foreground">Weaver:</span>
                      <span className="ml-2 font-medium">{selectedGreige.weaver}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stock Entry Form */}
            {selectedGreigeId && (
              <div className="border border-border rounded-lg p-6 bg-card">
                <h3 className="font-medium text-foreground mb-4">Stock Entry Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Quantity (meters) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.quantity}
                      onChange={(e) => handleFieldChange('quantity', e.target.value)}
                      placeholder="Enter meters"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>
                      Width (inches)
                      <span className="ml-2 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        Auto-filled from Greige Master
                      </span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.width}
                      readOnly
                      disabled
                      className="mt-1 bg-muted cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <Label>Purchase Cost (per meter)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.purchaseCost}
                      onChange={(e) => handleFieldChange('purchaseCost', e.target.value)}
                      placeholder="Cost per meter"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>Received Date</Label>
                    <Input
                      type="date"
                      value={formData.receivedDate}
                      onChange={(e) => handleFieldChange('receivedDate', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>Invoice Number</Label>
                    <Input
                      type="text"
                      value={formData.invoiceNumber}
                      onChange={(e) => handleFieldChange('invoiceNumber', e.target.value)}
                      placeholder="Supplier invoice number"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>Invoice Date</Label>
                    <Input
                      type="date"
                      value={formData.invoiceDate}
                      onChange={(e) => handleFieldChange('invoiceDate', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>
                      Fold Length (L)
                      <span className="ml-2 text-xs text-muted-foreground">cm</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="1"
                      max="100"
                      value={formData.foldLengthCm}
                      onChange={(e) => handleFieldChange('foldLengthCm', e.target.value)}
                      placeholder="e.g., 97"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">If L &lt; 100, actual meters = nominal × L/100</p>
                  </div>

                  <div>
                    <Label>Than Count</Label>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      value={formData.thanCount}
                      onChange={(e) => handleFieldChange('thanCount', e.target.value)}
                      placeholder="Number of thans"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>Supplier</Label>
                    <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select supplier (optional)" />
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

                  <div>
                    <Label>Warehouse Location</Label>
                    <Select
                      value={formData.warehouseLocation}
                      onValueChange={(v) => handleFieldChange('warehouseLocation', v)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select warehouse (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map((wh) => (
                          <SelectItem key={wh.id} value={wh.warehouseName}>
                            {wh.warehouseCode} - {wh.warehouseName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Roll Numbers (comma-separated)</Label>
                    <Input
                      type="text"
                      value={formData.rollNumbers}
                      onChange={(e) => handleFieldChange('rollNumbers', e.target.value)}
                      placeholder="e.g., R001, R002, R003"
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Stock Value Calculation with Fold Length */}
                {formData.quantity && formData.purchaseCost && (
                  <div className="mt-6 p-4 bg-accent/10 rounded-lg border border-accent/20">
                    {formData.foldLengthCm &&
                    parseFloat(formData.foldLengthCm) > 0 &&
                    parseFloat(formData.foldLengthCm) < 100 ? (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Nominal Quantity:</span>
                          <span className="font-medium">{parseFloat(formData.quantity).toLocaleString()} MTR</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Fold Length:</span>
                          <span className="font-medium">L = {formData.foldLengthCm} cm</span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-t pt-2">
                          <span className="text-accent font-medium">Actual Quantity:</span>
                          <span className="font-bold text-accent">
                            {((parseFloat(formData.quantity) * parseFloat(formData.foldLengthCm)) / 100).toLocaleString(
                              undefined,
                              { maximumFractionDigits: 2 }
                            )}{' '}
                            MTR
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-accent font-medium">Total Value (Actual × Rate):</span>
                          <span className="text-2xl font-bold text-accent">
                            {formatCurrency(
                              ((parseFloat(formData.quantity) * parseFloat(formData.foldLengthCm)) / 100) *
                                parseFloat(formData.purchaseCost)
                            )}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="text-accent font-medium">Total Stock Value:</span>
                        <span className="text-2xl font-bold text-accent">
                          {formatCurrency(parseFloat(formData.quantity) * parseFloat(formData.purchaseCost))}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-end pt-6 mt-6 border-t">
            <Button variant="outline" onClick={() => navigate('/greige-stock')} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleReview} disabled={isSaving || !selectedGreigeId}>
              Review & Save
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Stock Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <p className="text-sm text-muted-foreground">Please review the details before saving:</p>
            <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Greige:</span>
                <span className="font-medium">{selectedGreige?.greigeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nominal Quantity:</span>
                <span className="font-medium">{formData.quantity} meters</span>
              </div>
              {formData.foldLengthCm &&
                parseFloat(formData.foldLengthCm) > 0 &&
                parseFloat(formData.foldLengthCm) < 100 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fold Length:</span>
                      <span className="font-medium">L = {formData.foldLengthCm} cm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Actual Quantity:</span>
                      <span className="font-medium text-accent">
                        {((parseFloat(formData.quantity) * parseFloat(formData.foldLengthCm)) / 100).toFixed(2)} meters
                      </span>
                    </div>
                  </>
                )}
              {formData.thanCount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Than Count:</span>
                  <span className="font-medium">{formData.thanCount}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Width:</span>
                <span className="font-medium">{formData.width}"</span>
              </div>
              {formData.purchaseCost && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cost/meter:</span>
                  <span className="font-medium">{formatCurrency(parseFloat(formData.purchaseCost))}</span>
                </div>
              )}
              {formData.purchaseCost && formData.quantity && (
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="text-muted-foreground font-medium">Total Value:</span>
                  <span className="font-bold text-accent">
                    {formData.foldLengthCm &&
                    parseFloat(formData.foldLengthCm) > 0 &&
                    parseFloat(formData.foldLengthCm) < 100
                      ? formatCurrency(
                          ((parseFloat(formData.quantity) * parseFloat(formData.foldLengthCm)) / 100) *
                            parseFloat(formData.purchaseCost)
                        )
                      : formatCurrency(parseFloat(formData.quantity) * parseFloat(formData.purchaseCost))}
                  </span>
                </div>
              )}
              {formData.warehouseLocation && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Warehouse:</span>
                  <span className="font-medium">{formData.warehouseLocation}</span>
                </div>
              )}
              {selectedSupplierId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Supplier:</span>
                  <span className="font-medium">{suppliers.find((s) => s.id === selectedSupplierId)?.name || '-'}</span>
                </div>
              )}
              {formData.receivedDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Received Date:</span>
                  <span className="font-medium">{new Date(formData.receivedDate).toLocaleDateString('en-IN')}</span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Go Back
            </Button>
            <Button
              onClick={() => {
                setShowConfirm(false);
                handleSave();
              }}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Confirm & Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
