/**
 * Lace Defect Form Page
 * Log new defects and view defect details
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { laceDefectService } from '../services/laceDefect.service';
import { laceStockService } from '../services/laceStock.service';
import type { LaceDefect, DefectType, DiscoveredAt, LogDefectInput } from '../types/laceDefect.types';
import type { LaceStock } from '../types/laceStock.types';
import {
  DEFECT_TYPE_LABELS,
  DEFECT_TYPE_COLORS,
  CLAIM_STATUS_LABELS,
  CLAIM_STATUS_COLORS,
  DISCOVERED_AT_LABELS,
} from '../types/laceDefect.types';
import { notify } from '../lib/notify';
import { ArrowLeft, Save, AlertTriangle, Info } from 'lucide-react';

export default function LaceDefectForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isViewMode = !!id;

  // Form state
  const [form, setForm] = useState<LogDefectInput>({
    stockId: '',
    laceId: '',
    orderId: '',
    styleId: '',
    defectType: 'WEAVE_DEFECT',
    defectQuantity: 0,
    defectDescription: '',
    discoveredAt: 'RECEIVING',
    photos: [],
  });

  // View mode state
  const [defect, setDefect] = useState<LaceDefect | null>(null);

  // Stock lookup
  const [stocks, setStocks] = useState<LaceStock[]>([]);
  const [selectedStock, setSelectedStock] = useState<LaceStock | null>(null);
  const [loadingStocks, setLoadingStocks] = useState(false);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch stocks on mount
  useEffect(() => {
    const fetchStocks = async () => {
      setLoadingStocks(true);
      try {
        const response = await laceStockService.getAllLaceStock({ limit: 100 });
        setStocks(response.data);
      } catch (error) {
        console.error('Failed to fetch stocks:', error);
      } finally {
        setLoadingStocks(false);
      }
    };

    if (!isViewMode) {
      fetchStocks();
    }
  }, [isViewMode]);

  // Fetch defect details in view mode
  useEffect(() => {
    const fetchDefect = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const data = await laceDefectService.getDefectById(id);
        setDefect(data);
      } catch (error) {
        console.error('Failed to fetch defect:', error);
        notify.error('Failed to load defect details');
      } finally {
        setLoading(false);
      }
    };

    if (isViewMode) {
      fetchDefect();
    }
  }, [id, isViewMode]);

  const handleStockSelect = (stockId: string) => {
    const stock = stocks.find((s) => s.id === stockId);
    setSelectedStock(stock || null);
    if (stock) {
      setForm({
        ...form,
        stockId: stock.id,
        laceId: stock.laceId,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.stockId) {
      notify.error('Please select a stock lot');
      return;
    }
    if (form.defectQuantity <= 0) {
      notify.error('Please enter defect quantity');
      return;
    }

    setSubmitting(true);
    try {
      // Strip empty-string optional references — the backend validates orderId/styleId
      // as UUIDs and rejects '' (they must be omitted when blank).
      const payload: LogDefectInput = {
        ...form,
        orderId: form.orderId?.trim() ? form.orderId.trim() : undefined,
        styleId: form.styleId?.trim() ? form.styleId.trim() : undefined,
      };
      await laceDefectService.logDefect(payload);
      notify.success('Defect logged successfully');
      navigate('/lace-defects');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      notify.error(err.response?.data?.error || 'Failed to log defect');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(value);
  };

  if (isViewMode && loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-12">Loading...</div>
      </div>
    );
  }

  if (isViewMode && !defect) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-12 text-muted-foreground">Defect not found</div>
      </div>
    );
  }

  // View Mode
  if (isViewMode && defect) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate('/lace-defects')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-display font-medium">Defect Details</h1>
            <p className="text-muted-foreground">Logged on {formatDate(defect.discoveredDate)}</p>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex gap-2 mb-6">
          <Badge className={`${DEFECT_TYPE_COLORS[defect.defectType]} border text-sm`}>
            {DEFECT_TYPE_LABELS[defect.defectType]}
          </Badge>
          <Badge className={`${CLAIM_STATUS_COLORS[defect.claimStatus]} border text-sm`}>
            {CLAIM_STATUS_LABELS[defect.claimStatus]}
          </Badge>
          <Badge className="bg-muted text-foreground border-border text-sm">
            Discovered at {DISCOVERED_AT_LABELS[defect.discoveredAt]}
          </Badge>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Defect Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{DEFECT_TYPE_LABELS[defect.defectType]}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Quantity</span>
                <span className="font-bold text-destructive">{defect.defectQuantity.toLocaleString()}m</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Discovered At</span>
                <span>{DISCOVERED_AT_LABELS[defect.discoveredAt]}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Discovered Date</span>
                <span>{formatDate(defect.discoveredDate)}</span>
              </div>
              {defect.discoveredBy && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Discovered By</span>
                  <span>
                    {defect.discoveredBy.firstName} {defect.discoveredBy.lastName}
                  </span>
                </div>
              )}
              {defect.defectDescription && (
                <div className="py-2">
                  <span className="text-muted-foreground block mb-1">Description</span>
                  <p className="text-sm">{defect.defectDescription}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-4 w-4" />
                Claim Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-muted-foreground">Status</span>
                <Badge className={`${CLAIM_STATUS_COLORS[defect.claimStatus]} border`}>
                  {CLAIM_STATUS_LABELS[defect.claimStatus]}
                </Badge>
              </div>
              {defect.claimReference && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-mono">{defect.claimReference}</span>
                </div>
              )}
              {defect.claimAmount !== null && defect.claimAmount !== undefined && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold">{formatCurrency(defect.claimAmount)}</span>
                </div>
              )}
              {defect.claimSubmittedDate && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Submitted Date</span>
                  <span>{formatDate(defect.claimSubmittedDate)}</span>
                </div>
              )}
              {defect.claimResolvedDate && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Resolved Date</span>
                  <span>{formatDate(defect.claimResolvedDate)}</span>
                </div>
              )}
              {defect.claimResolution && (
                <div className="py-2">
                  <span className="text-muted-foreground block mb-1">Resolution</span>
                  <p className="text-sm">{defect.claimResolution}</p>
                </div>
              )}
              {defect.replacementRequired && (
                <div className="py-2 border-t">
                  <div className="flex items-center gap-2 text-success">
                    <span>Replacement Required</span>
                    {defect.replacementQuantity && (
                      <span className="font-bold">{defect.replacementQuantity.toLocaleString()}m</span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Create Mode
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate('/lace-defects')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-medium">Log Defect</h1>
          <p className="text-muted-foreground">Record a lace defect discovered during production</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Stock Selection */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Stock Lot</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>Select Stock Lot *</Label>
                  <Select value={form.stockId} onValueChange={handleStockSelect} disabled={loadingStocks}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a stock lot..." />
                    </SelectTrigger>
                    <SelectContent>
                      {stocks.map((stock) => (
                        <SelectItem key={stock.id} value={stock.id}>
                          {stock.laceMaster?.laceName || 'Unknown'} - {stock.lotNumber || stock.id.slice(0, 8)} (
                          {stock.quantityAvailable.toLocaleString()}m available)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedStock && (
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    <p>
                      <strong>Lace:</strong> {selectedStock.laceMaster?.laceName}
                    </p>
                    <p>
                      <strong>Available:</strong> {selectedStock.quantityAvailable.toLocaleString()}m
                    </p>
                    {selectedStock.dyeLotNumber && (
                      <p>
                        <strong>Dye Lot:</strong> {selectedStock.dyeLotNumber}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Defect Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Defect Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Defect Type *</Label>
                <Select
                  value={form.defectType}
                  onValueChange={(value) => setForm({ ...form, defectType: value as DefectType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DEFECT_TYPE_LABELS).map(([type, label]) => (
                      <SelectItem key={type} value={type}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Defect Quantity (meters) *</Label>
                <Input
                  type="number"
                  value={form.defectQuantity || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      defectQuantity: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="Enter quantity"
                  min={0}
                  max={selectedStock?.quantityAvailable || undefined}
                />
              </div>

              <div>
                <Label>Discovered At *</Label>
                <Select
                  value={form.discoveredAt}
                  onValueChange={(value) => setForm({ ...form, discoveredAt: value as DiscoveredAt })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DISCOVERED_AT_LABELS).map(([stage, label]) => (
                      <SelectItem key={stage} value={stage}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Description (Optional)</Label>
                <Textarea
                  value={form.defectDescription}
                  onChange={(e) => setForm({ ...form, defectDescription: e.target.value })}
                  placeholder="Describe the defect in detail..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Optional References */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">References (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Order ID</Label>
                <Input
                  value={form.orderId || ''}
                  onChange={(e) => setForm({ ...form, orderId: e.target.value })}
                  placeholder="Related order ID"
                />
              </div>
              <div>
                <Label>Style ID</Label>
                <Input
                  value={form.styleId || ''}
                  onChange={(e) => setForm({ ...form, styleId: e.target.value })}
                  placeholder="Related style ID"
                />
              </div>
              <div className="p-3 bg-warning-muted border border-warning/20 rounded-lg text-sm text-warning">
                <p>After logging the defect, you can submit a claim from the defects list page.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4 mt-6">
          <Button type="button" variant="outline" onClick={() => navigate('/lace-defects')}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            <Save className="h-4 w-4 mr-2" />
            {submitting ? 'Logging...' : 'Log Defect'}
          </Button>
        </div>
      </form>
    </div>
  );
}
