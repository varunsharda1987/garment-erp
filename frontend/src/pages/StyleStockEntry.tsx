import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Alert, AlertDescription } from '../components/ui/alert';
import { getStyleFabrics, createStyleStock } from '../services/style-stock.service';
import type { StyleStockEntry as StockEntry, ComponentWithFabrics } from '../types/style-stock.types';
import type { Style } from '../types/style.types';
import { getStyleById } from '../services/style.service';
import { CheckCircle, XCircle, Package } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';

interface StockFormData {
  fabricId: string;
  quantity: string;
  width: string;
  rollNumbers: string;
  warehouseLocation: string;
  qualityGrade: 'A' | 'B' | 'DEFECT';
  purchaseCost: string;
  receivedDate: string;
}

export default function StyleStockEntry() {
  const { styleId } = useParams<{ styleId: string }>();
  const navigate = useNavigate();

  const [style, setStyle] = useState<Style | null>(null);
  const [components, setComponents] = useState<ComponentWithFabrics[]>([]);
  const [stockEntries, setStockEntries] = useState<Record<string, StockFormData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (styleId) {
      loadStyleData();
    }
  }, [styleId]);

  const loadStyleData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [styleData, fabricsData] = await Promise.all([
        getStyleById(styleId!),
        getStyleFabrics(styleId!),
      ]);

      setStyle(styleData);
      setComponents(fabricsData);

      // Initialize stock entries for all fabrics
      const initialEntries: Record<string, StockFormData> = {};
      fabricsData.forEach((component) => {
        component.fabrics.forEach((fabric) => {
          initialEntries[fabric.fabricId] = {
            fabricId: fabric.fabricId,
            quantity: '',
            width: fabric.widthCADs?.[0]?.availableWidth?.toString() || '',
            rollNumbers: '',
            warehouseLocation: '',
            qualityGrade: 'A',
            purchaseCost: '',
            receivedDate: new Date().toISOString().split('T')[0],
          };
        });
      });

      setStockEntries(initialEntries);
    } catch (err: unknown) {
      setError(err.response?.data?.message || 'Failed to load style data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldChange = (fabricId: string, field: keyof StockFormData, value: StockFormData[keyof StockFormData]) => {
    setStockEntries((prev) => ({
      ...prev,
      [fabricId]: {
        ...prev[fabricId],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(false);

      // Filter out empty entries (where quantity is not entered)
      const entries: StockEntry[] = Object.values(stockEntries)
        .filter((entry) => entry.quantity && parseFloat(entry.quantity) > 0)
        .map((entry) => ({
          fabricId: entry.fabricId,
          quantity: parseFloat(entry.quantity),
          width: parseFloat(entry.width),
          rollNumbers: entry.rollNumbers || undefined,
          warehouseLocation: entry.warehouseLocation || undefined,
          qualityGrade: entry.qualityGrade,
          purchaseCost: entry.purchaseCost ? parseFloat(entry.purchaseCost) : undefined,
          receivedDate: entry.receivedDate ? new Date(entry.receivedDate) : undefined,
        }));

      if (entries.length === 0) {
        setError('Please enter quantity for at least one fabric');
        return;
      }

      await createStyleStock(styleId!, entries);
      setSuccess(true);

      // Show success message for 2 seconds then navigate
      setTimeout(() => {
        navigate(`/styles/${styleId}`);
      }, 2000);
    } catch (err: unknown) {
      setError(err.response?.data?.message || 'Failed to save stock entries');
    } finally {
      setIsSaving(false);
    }
  };

  const getTotalMeters = () => {
    return Object.values(stockEntries).reduce((sum, entry) => {
      const quantity = parseFloat(entry.quantity) || 0;
      return sum + quantity;
    }, 0);
  };

  const getTotalValue = () => {
    return Object.values(stockEntries).reduce((sum, entry) => {
      const quantity = parseFloat(entry.quantity) || 0;
      const cost = parseFloat(entry.purchaseCost) || 0;
      return sum + quantity * cost;
    }, 0);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading style data...</div>
      </div>
    );
  }

  if (!style) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-red-600">Style not found</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Stock Entry for Style: {style.styleCode}</CardTitle>
          <div className="text-sm text-gray-500 mt-2 space-y-1">
            <p>Style Name: {style.styleName}</p>
            {style.customerName && <p>Buyer: {style.customerName}</p>}
            {style.projectGroup && <p>Project: {style.projectGroup}</p>}
            {style.season && <p>Season: {style.season}</p>}
          </div>
        </CardHeader>
        <CardContent>
          {/* Success Alert */}
          {success && (
            <Alert className="mb-6 bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Stock entries saved successfully! Redirecting...
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

          {/* Summary Panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-600 font-medium">Total Fabrics</div>
              <div className="text-2xl font-bold text-blue-900">
                {components.reduce((sum, c) => sum + c.fabrics.length, 0)}
              </div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-sm text-green-600 font-medium">Total Meters</div>
              <div className="text-2xl font-bold text-green-900">
                {getTotalMeters().toFixed(2)}
              </div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="text-sm text-purple-600 font-medium">Total Value</div>
              <div className="text-2xl font-bold text-purple-900">
                {formatCurrency(getTotalValue())}
              </div>
            </div>
          </div>

          {/* Stock Entry Form */}
          <div className="space-y-6">
            {components.map((component) => (
              <div key={component.componentName} className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  {component.componentName} ({component.componentType})
                </h3>

                <div className="space-y-6">
                  {component.fabrics.map((fabric) => {
                    const entry = stockEntries[fabric.fabricId];
                    if (!entry) return null;

                    return (
                      <div
                        key={fabric.fabricId}
                        className="border border-gray-300 rounded-lg p-4 bg-gray-50"
                      >
                        <div className="mb-3">
                          <h4 className="font-medium text-gray-900">{fabric.fabricCode}</h4>
                          <p className="text-sm text-gray-600">{fabric.fabricName}</p>
                          {fabric.widthCADs && fabric.widthCADs.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              CAD: {fabric.widthCADs[0].cadMeters?.toFixed(2)} meters @{' '}
                              {fabric.widthCADs[0].availableWidth}" width
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div>
                            <Label>Quantity (meters) *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={entry.quantity}
                              onChange={(e) =>
                                handleFieldChange(fabric.fabricId, 'quantity', e.target.value)
                              }
                              placeholder="Enter meters"
                            />
                          </div>

                          <div>
                            <Label>Width (inches)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={entry.width}
                              onChange={(e) =>
                                handleFieldChange(fabric.fabricId, 'width', e.target.value)
                              }
                              placeholder="Fabric width"
                            />
                          </div>

                          <div>
                            <Label>Quality Grade</Label>
                            <Select
                              value={entry.qualityGrade}
                              onValueChange={(value) =>
                                handleFieldChange(fabric.fabricId, 'qualityGrade', value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="A">Grade A</SelectItem>
                                <SelectItem value="B">Grade B</SelectItem>
                                <SelectItem value="DEFECT">Defect</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label>Purchase Cost (per meter)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={entry.purchaseCost}
                              onChange={(e) =>
                                handleFieldChange(fabric.fabricId, 'purchaseCost', e.target.value)
                              }
                              placeholder="Cost per meter"
                            />
                          </div>

                          <div>
                            <Label>Received Date</Label>
                            <Input
                              type="date"
                              value={entry.receivedDate}
                              onChange={(e) =>
                                handleFieldChange(fabric.fabricId, 'receivedDate', e.target.value)
                              }
                            />
                          </div>

                          <div>
                            <Label>Warehouse Location</Label>
                            <Input
                              type="text"
                              value={entry.warehouseLocation}
                              onChange={(e) =>
                                handleFieldChange(
                                  fabric.fabricId,
                                  'warehouseLocation',
                                  e.target.value
                                )
                              }
                              placeholder="e.g., A-15-B"
                            />
                          </div>

                          <div className="md:col-span-2 lg:col-span-3">
                            <Label>Roll Numbers (comma-separated)</Label>
                            <Input
                              type="text"
                              value={entry.rollNumbers}
                              onChange={(e) =>
                                handleFieldChange(fabric.fabricId, 'rollNumbers', e.target.value)
                              }
                              placeholder="e.g., R001, R002, R003"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-end pt-6 mt-6 border-t">
            <Button variant="outline" onClick={() => navigate('/styles')} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Stock Entries'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
