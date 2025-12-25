import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Alert, AlertDescription } from '../components/ui/alert';
import { createGreigeStock } from '../services/style-stock.service';
import { greigeService } from '../services/fabricGreigeService';
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
  greigeWidth: number;
}

export default function GreigeStockEntry() {
  const navigate = useNavigate();

  const [greigeList, setGreigeList] = useState<GreigeMaster[]>([]);
  const [selectedGreigeId, setSelectedGreigeId] = useState<string>('');
  const [formData, setFormData] = useState({
    quantity: '',
    width: '',
    rollNumbers: '',
    warehouseLocation: '',
    purchaseCost: '',
    receivedDate: new Date().toISOString().split('T')[0],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadGreigeList();
  }, []);

  const loadGreigeList = async () => {
    try {
      setIsLoading(true);
      const response = await greigeService.getAll({ limit: 100 });
      setGreigeList(response.data || []);
    } catch (err: unknown) {
      setError(err.response?.data?.message || 'Failed to load greige list');
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

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(false);

      if (!selectedGreigeId) {
        setError('Please select a greige fabric');
        return;
      }

      if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
        setError('Please enter a valid quantity');
        return;
      }

      await createGreigeStock({
        greigeId: selectedGreigeId,
        quantity: parseFloat(formData.quantity),
        width: parseFloat(formData.width),
        rollNumbers: formData.rollNumbers || undefined,
        warehouseLocation: formData.warehouseLocation || undefined,
        purchaseCost: formData.purchaseCost ? parseFloat(formData.purchaseCost) : undefined,
        receivedDate: formData.receivedDate ? new Date(formData.receivedDate) : undefined,
      });

      setSuccess(true);

      // Reset form after 2 seconds or navigate
      setTimeout(() => {
        navigate('/greige-stock');
      }, 2000);
    } catch (err: unknown) {
      setError(err.response?.data?.message || 'Failed to save greige stock entry');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedGreige = greigeList.find((g) => g.id === selectedGreigeId);

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-gray-600">
        <Link to="/" className="hover:text-blue-600">Home</Link>
        {' > '}
        <Link to="/greige" className="hover:text-blue-600">Greige Master</Link>
        {' > '}
        <span className="font-medium text-gray-900">Stock Entry</span>
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
            <Package2 className="h-6 w-6 text-blue-600" />
            Generic Greige Stock Entry
          </CardTitle>
          <p className="text-sm text-gray-500 mt-2">
            Add generic greige fabric stock that can be allocated to any future style
          </p>
        </CardHeader>
        <CardContent>
          {/* Success Alert */}
          {success && (
            <Alert className="mb-6 bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
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
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-medium text-blue-900 mb-2">About Generic Greige Stock</h3>
            <ul className="text-sm text-blue-700 space-y-1">
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
              <Select value={selectedGreigeId} onValueChange={handleGreigeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose greige fabric..." />
                </SelectTrigger>
                <SelectContent>
                  {greigeList.map((greige) => (
                    <SelectItem key={greige.id} value={greige.id}>
                      {greige.greigeCode} - {greige.greigeName} ({greige.composition})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Greige Details */}
            {selectedGreige && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-medium text-gray-900 mb-3">Greige Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Code:</span>
                    <span className="ml-2 font-medium">{selectedGreige.greigeCode}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Composition:</span>
                    <span className="ml-2 font-medium">{selectedGreige.composition}</span>
                  </div>
                  {selectedGreige.yarnCount && (
                    <div>
                      <span className="text-gray-500">Yarn Count:</span>
                      <span className="ml-2 font-medium">{selectedGreige.yarnCount}</span>
                    </div>
                  )}
                  {selectedGreige.construction && (
                    <div>
                      <span className="text-gray-500">Construction:</span>
                      <span className="ml-2 font-medium">{selectedGreige.construction}</span>
                    </div>
                  )}
                  {selectedGreige.weaveType && (
                    <div>
                      <span className="text-gray-500">Weave:</span>
                      <span className="ml-2 font-medium">{selectedGreige.weaveType}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">Width:</span>
                    <span className="ml-2 font-medium">{Number(selectedGreige.greigeWidth)}"</span>
                  </div>
                </div>
              </div>
            )}

            {/* Stock Entry Form */}
            {selectedGreigeId && (
              <div className="border border-gray-300 rounded-lg p-6 bg-white">
                <h3 className="font-medium text-gray-900 mb-4">Stock Entry Details</h3>
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
                      <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        Auto-filled from Greige Master
                      </span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.width}
                      readOnly
                      disabled
                      className="mt-1 bg-gray-50 cursor-not-allowed"
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
                    <Label>Warehouse Location</Label>
                    <Input
                      type="text"
                      value={formData.warehouseLocation}
                      onChange={(e) => handleFieldChange('warehouseLocation', e.target.value)}
                      placeholder="e.g., A-15-B"
                      className="mt-1"
                    />
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

                {/* Stock Value Calculation */}
                {formData.quantity && formData.purchaseCost && (
                  <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex justify-between items-center">
                      <span className="text-purple-700 font-medium">Total Stock Value:</span>
                      <span className="text-2xl font-bold text-purple-900">
                        {formatCurrency(parseFloat(formData.quantity) * parseFloat(formData.purchaseCost))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-end pt-6 mt-6 border-t">
            <Button
              variant="outline"
              onClick={() => navigate('/greige-stock')}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !selectedGreigeId}>
              {isSaving ? 'Saving...' : 'Save Greige Stock Entry'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
