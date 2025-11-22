import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Alert, AlertDescription } from '../components/ui/alert';
import { fabricService } from '../services/fabricGreigeService';
import { CheckCircle, XCircle, Package2, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import type { FabricMaster } from '../types/fabric-greige.types';
import { logError } from '../lib/logger';

export default function FabricStockEntry() {
  const navigate = useNavigate();

  const [fabricList, setFabricList] = useState<FabricMaster[]>([]);
  const [selectedFabricId, setSelectedFabricId] = useState<string>('');
  const [showGreigeDetails, setShowGreigeDetails] = useState(false);
  const [formData, setFormData] = useState({
    quantity: '',
    width: '',
    rollNumbers: '',
    warehouseLocation: '',
    rackNumber: '',
    purchaseCost: '',
    qualityGrade: 'A' as 'A' | 'B' | 'DEFECT',
    stockType: 'GENERIC' as 'EXCESS' | 'PLANNED_STOCK' | 'GENERIC' | 'RETURNED' | 'VARIANCE_UNUSED',
    receivedDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadFabricList();
  }, []);

  const loadFabricList = async () => {
    try {
      setIsLoading(true);
      const response = await fabricService.getAll({ limit: 200, isActive: 'true' });
      setFabricList(response.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load fabric list');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFabricChange = (fabricId: string) => {
    setSelectedFabricId(fabricId);
    const selectedFabric = fabricList.find((f) => f.id === fabricId);
    if (selectedFabric) {
      // Auto-fill width with actual width
      setFormData((prev) => ({
        ...prev,
        width: selectedFabric.actualWidth.toString(),
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

      if (!selectedFabricId) {
        setError('Please select a finished fabric');
        return;
      }

      if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
        setError('Please enter a valid quantity');
        return;
      }

      // Get token from localStorage
      const authStorage = localStorage.getItem('auth-storage');
      let token = null;
      if (authStorage) {
        try {
          const parsed = JSON.parse(authStorage);
          token = parsed.state?.token;
        } catch (e) {
          logError('Error parsing auth storage:', e);
        }
      }

      if (!token) {
        setError('Authentication token not found. Please log in again.');
        return;
      }

      // Call the fabric stock API
      const response = await fetch('http://localhost:5000/api/stock/fabric', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fabricId: selectedFabricId,
          width: parseFloat(formData.width),
          quantityAvailable: parseFloat(formData.quantity),
          rollNumbers: formData.rollNumbers || undefined,
          warehouseLocation: formData.warehouseLocation || undefined,
          rackNumber: formData.rackNumber || undefined,
          purchaseCost: formData.purchaseCost ? parseFloat(formData.purchaseCost) : undefined,
          qualityGrade: formData.qualityGrade,
          stockType: formData.stockType,
          receivedDate: formData.receivedDate ? new Date(formData.receivedDate) : new Date(),
          status: 'AVAILABLE',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save stock entry');
      }

      setSuccess(true);

      // Navigate to stock view after 2 seconds
      setTimeout(() => {
        navigate('/fabric-stock');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to save fabric stock entry');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedFabric = fabricList.find((f) => f.id === selectedFabricId);
  const totalValue = formData.quantity && formData.purchaseCost
    ? parseFloat(formData.quantity) * parseFloat(formData.purchaseCost)
    : 0;

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-gray-600">
        <Link to="/" className="hover:text-blue-600">Home</Link>
        {' > '}
        <Link to="/fabric" className="hover:text-blue-600">Finished Fabric</Link>
        {' > '}
        <span className="font-medium text-gray-900">Stock Entry</span>
      </div>

      {/* Back Button */}
      <div className="mb-4">
        <Button variant="ghost" onClick={() => navigate('/fabric')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Fabric Master
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package2 className="h-6 w-6 text-blue-600" />
            Finished Fabric Stock Entry
          </CardTitle>
          <p className="text-sm text-gray-500 mt-2">
            Add finished fabric stock to inventory
          </p>
        </CardHeader>
        <CardContent>
          {/* Success Alert */}
          {success && (
            <Alert className="mb-6 bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Stock entry saved successfully! Redirecting to stock view...
              </AlertDescription>
            </Alert>
          )}

          {/* Error Alert */}
          {error && (
            <Alert className="mb-6 bg-red-50 border-red-200">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-6">
            {/* Fabric Selection */}
            <div>
              <Label>Select Finished Fabric <span className="text-red-500">*</span></Label>
              <Select value={selectedFabricId} onValueChange={handleFabricChange}>
                <SelectTrigger className="w-full mt-1">
                  <SelectValue placeholder="Select a finished fabric..." />
                </SelectTrigger>
                <SelectContent>
                  {fabricList.map((fabric) => (
                    <SelectItem key={fabric.id} value={fabric.id}>
                      {fabric.fabricCode} - {fabric.fabricName}
                      {fabric.colorName && ` - ${fabric.colorName}`}
                      {fabric.valueAddition && ` + ${fabric.valueAddition}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isLoading && <p className="text-sm text-gray-500 mt-1">Loading fabrics...</p>}
            </div>

            {/* Fabric Details Panel */}
            {selectedFabric && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                  <h4 className="font-medium text-gray-900 mb-3">Fabric Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Code:</span>
                      <p className="font-medium">{selectedFabric.fabricCode}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Name:</span>
                      <p className="font-medium">{selectedFabric.fabricName}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Finish Type:</span>
                      <p className="font-medium">{selectedFabric.finishType || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Color:</span>
                      <p className="font-medium">{selectedFabric.colorName || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Actual Width:</span>
                      <p className="font-medium">{selectedFabric.actualWidth}"</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Cutable Width:</span>
                      <p className="font-medium">{selectedFabric.cutableWidth || 'N/A'}"</p>
                    </div>
                    {selectedFabric.finishedConstruction && (
                      <div>
                        <span className="text-gray-600">Construction:</span>
                        <p className="font-medium">{selectedFabric.finishedConstruction}</p>
                      </div>
                    )}
                    {selectedFabric.valueAddition && (
                      <div>
                        <span className="text-gray-600">Value Addition:</span>
                        <p className="font-medium">{selectedFabric.valueAddition}</p>
                      </div>
                    )}
                    {selectedFabric.styleReference && (
                      <div>
                        <span className="text-gray-600">Style Reference:</span>
                        <p className="font-medium">{selectedFabric.styleReference}</p>
                      </div>
                    )}
                  </div>

                  {/* Collapsible Greige Details */}
                  {selectedFabric.greige && (
                    <div className="mt-4 pt-4 border-t border-blue-300">
                      <button
                        onClick={() => setShowGreigeDetails(!showGreigeDetails)}
                        className="flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900"
                      >
                        {showGreigeDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        Greige Base Details
                      </button>
                      {showGreigeDetails && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mt-3">
                          <div>
                            <span className="text-gray-600">Greige Code:</span>
                            <p className="font-medium">{selectedFabric.greige.greigeCode}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Greige Name:</span>
                            <p className="font-medium">{selectedFabric.greige.greigeName}</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Composition:</span>
                            <p className="font-medium">{selectedFabric.greige.composition}</p>
                          </div>
                          {selectedFabric.greige.yarnCount && (
                            <div>
                              <span className="text-gray-600">Yarn Count:</span>
                              <p className="font-medium">{selectedFabric.greige.yarnCount}</p>
                            </div>
                          )}
                          {selectedFabric.greige.construction && (
                            <div>
                              <span className="text-gray-600">Construction:</span>
                              <p className="font-medium">{selectedFabric.greige.construction}</p>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-600">Greige Width:</span>
                            <p className="font-medium">{Number(selectedFabric.greige.greigeWidth)}"</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Stock Entry Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="quantity">Quantity (meters) <span className="text-red-500">*</span></Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) => handleFieldChange('quantity', e.target.value)}
                  placeholder="e.g., 1000"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="width">Width (inches) <span className="text-red-500">*</span></Label>
                <Input
                  id="width"
                  type="number"
                  step="0.1"
                  value={formData.width}
                  onChange={(e) => handleFieldChange('width', e.target.value)}
                  placeholder="Auto-filled from fabric"
                  className="mt-1 bg-gray-50"
                  readOnly
                />
              </div>

              <div>
                <Label htmlFor="purchaseCost">Purchase Cost (per meter)</Label>
                <Input
                  id="purchaseCost"
                  type="number"
                  step="0.01"
                  value={formData.purchaseCost}
                  onChange={(e) => handleFieldChange('purchaseCost', e.target.value)}
                  placeholder="e.g., 25.50"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="receivedDate">Received Date</Label>
                <Input
                  id="receivedDate"
                  type="date"
                  value={formData.receivedDate}
                  onChange={(e) => handleFieldChange('receivedDate', e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="qualityGrade">Quality Grade <span className="text-red-500">*</span></Label>
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
                <Label htmlFor="stockType">Stock Type</Label>
                <Select
                  value={formData.stockType}
                  onValueChange={(value: any) => handleFieldChange('stockType', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GENERIC">Generic Stock</SelectItem>
                    <SelectItem value="PLANNED_STOCK">Planned Stock</SelectItem>
                    <SelectItem value="EXCESS">Excess Stock</SelectItem>
                    <SelectItem value="RETURNED">Returned Stock</SelectItem>
                    <SelectItem value="VARIANCE_UNUSED">Variance/Unused</SelectItem>
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
                <Label htmlFor="rackNumber">Rack Number</Label>
                <Input
                  id="rackNumber"
                  value={formData.rackNumber}
                  onChange={(e) => handleFieldChange('rackNumber', e.target.value)}
                  placeholder="e.g., R-12-B3"
                  className="mt-1"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="rollNumbers">Roll Numbers</Label>
                <Input
                  id="rollNumbers"
                  value={formData.rollNumbers}
                  onChange={(e) => handleFieldChange('rollNumbers', e.target.value)}
                  placeholder="e.g., R001, R002, R003 (comma-separated)"
                  className="mt-1"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleFieldChange('notes', e.target.value)}
                  placeholder="Additional notes..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                  rows={3}
                />
              </div>
            </div>

            {/* Summary */}
            {totalValue > 0 && (
              <Card className="bg-gray-50">
                <CardContent className="pt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-700">Total Stock Value:</span>
                    <span className="text-2xl font-bold text-blue-600">
                      ${totalValue.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 justify-end pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => navigate('/fabric')}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || !selectedFabricId || !formData.quantity}
              >
                {isSaving ? 'Saving...' : 'Save Stock Entry'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
