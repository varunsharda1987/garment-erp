import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { styleService } from '@/services/style.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function StyleForm() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Basic Information (in order of appearance)
  const [buyerName, setBuyerName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [styleCode, setStyleCode] = useState('');
  const [styleName, setStyleName] = useState(''); // Optional
  const [category, setCategory] = useState('');
  const [numberOfComponents, setNumberOfComponents] = useState('1');

  // Order Information (optional)
  const [hasOrder, setHasOrder] = useState(false);
  const [orderQuantity, setOrderQuantity] = useState('');
  const [costPerPiece, setCostPerPiece] = useState('');
  const [orderValue, setOrderValue] = useState('0');
  const [orderDate, setOrderDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');

  // Fabrics (with Fabric Name and Greige Name)
  const [fabrics, setFabrics] = useState<Array<{ fabricName: string; greigeName: string }>>([
    { fabricName: '', greigeName: '' }
  ]);

  // Size Breakdown
  const [hasSizeBreakdown, setHasSizeBreakdown] = useState(false);
  const [sizeInputMethod, setSizeInputMethod] = useState<'ratio' | 'percentage' | 'absolute'>('ratio');
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [sizeBreakdown, setSizeBreakdown] = useState<Record<string, string>>({});
  const availableSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  // Garment Trims
  const [garmentTrims, setGarmentTrims] = useState<Array<{
    trimName: string;
    trimType: string;
    quantityPerPiece: string;
    unit: string;
    supplier: string;
  }>>([]);

  // Value Addition
  const [valueAdditions, setValueAdditions] = useState<{
    embroidery: boolean;
    handwork: boolean;
    printing: boolean;
    washing: boolean;
  }>({
    embroidery: false,
    handwork: false,
    printing: false,
    washing: false,
  });
  const [valueAdditionDetails, setValueAdditionDetails] = useState<Record<string, {
    description: string;
    estimatedCost: string;
    vendor: string;
  }>>({});

  // Packaging Trims
  const [packagingTrims, setPackagingTrims] = useState<Array<{
    itemName: string;
    itemType: string;
    specification: string;
    quantityPerPack: string;
  }>>([]);

  // Description/Remarks (at the end)
  const [description, setDescription] = useState('');

  // Auto-calculate order value when quantity or cost changes
  useEffect(() => {
    if (hasOrder && orderQuantity && costPerPiece) {
      const quantity = parseFloat(orderQuantity) || 0;
      const cost = parseFloat(costPerPiece) || 0;
      const calculatedValue = (quantity * cost).toFixed(2);
      setOrderValue(calculatedValue);
    } else {
      setOrderValue('0');
    }
  }, [hasOrder, orderQuantity, costPerPiece]);

  // Auto-save functionality (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (buyerName || brandName || styleCode) {
        handleAutoSave();
      }
    }, 2000); // Auto-save after 2 seconds of inactivity

    return () => clearTimeout(timer);
  }, [buyerName, brandName, styleCode, styleName, category, numberOfComponents,
      hasOrder, orderQuantity, costPerPiece, orderDate, deliveryDate, fabrics, description]);

  const handleAutoSave = () => {
    // For now, just show saving status
    // In future, this can save draft to localStorage or backend
    setSaveStatus('saving');
    setTimeout(() => setSaveStatus('saved'), 500);
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  // Add fabric field
  const addFabric = () => {
    setFabrics([...fabrics, { fabricName: '', greigeName: '' }]);
  };

  // Remove fabric field
  const removeFabric = (index: number) => {
    if (fabrics.length > 1) {
      const updated = fabrics.filter((_, i) => i !== index);
      setFabrics(updated);
    }
  };

  // Update fabric field
  const updateFabric = (index: number, field: 'fabricName' | 'greigeName', value: string) => {
    const updated = [...fabrics];
    updated[index] = { ...updated[index], [field]: value };
    setFabrics(updated);
  };

  // Size selection handlers
  const toggleSizeSelection = (size: string) => {
    if (selectedSizes.includes(size)) {
      setSelectedSizes(selectedSizes.filter(s => s !== size));
      const updated = { ...sizeBreakdown };
      delete updated[size];
      setSizeBreakdown(updated);
    } else {
      setSelectedSizes([...selectedSizes, size]);
      setSizeBreakdown({ ...sizeBreakdown, [size]: '' });
    }
  };

  const updateSizeBreakdown = (size: string, value: string) => {
    setSizeBreakdown({ ...sizeBreakdown, [size]: value });
  };

  // Garment Trims handlers
  const addGarmentTrim = () => {
    setGarmentTrims([...garmentTrims, {
      trimName: '',
      trimType: '',
      quantityPerPiece: '',
      unit: 'pcs',
      supplier: ''
    }]);
  };

  const removeGarmentTrim = (index: number) => {
    setGarmentTrims(garmentTrims.filter((_, i) => i !== index));
  };

  const updateGarmentTrim = (index: number, field: string, value: string) => {
    const updated = [...garmentTrims];
    updated[index] = { ...updated[index], [field]: value };
    setGarmentTrims(updated);
  };

  // Value Addition handlers
  const toggleValueAddition = (type: keyof typeof valueAdditions) => {
    setValueAdditions({ ...valueAdditions, [type]: !valueAdditions[type] });
    if (!valueAdditions[type]) {
      setValueAdditionDetails({
        ...valueAdditionDetails,
        [type]: { description: '', estimatedCost: '', vendor: '' }
      });
    }
  };

  const updateValueAdditionDetail = (type: string, field: string, value: string) => {
    setValueAdditionDetails({
      ...valueAdditionDetails,
      [type]: { ...valueAdditionDetails[type], [field]: value }
    });
  };

  // Packaging Trims handlers
  const addPackagingTrim = () => {
    setPackagingTrims([...packagingTrims, {
      itemName: '',
      itemType: '',
      specification: '',
      quantityPerPack: ''
    }]);
  };

  const removePackagingTrim = (index: number) => {
    setPackagingTrims(packagingTrims.filter((_, i) => i !== index));
  };

  const updatePackagingTrim = (index: number, field: string, value: string) => {
    const updated = [...packagingTrims];
    updated[index] = { ...updated[index], [field]: value };
    setPackagingTrims(updated);
  };

  // Handle logout
  const handleLogout = () => {
    useAuthStore.getState().clearAuth();
    navigate('/login');
  };

  // Validate and submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!buyerName.trim()) {
      alert('Buyer Name is required');
      return;
    }
    if (!brandName.trim()) {
      alert('Brand Name is required');
      return;
    }
    if (!styleCode.trim()) {
      alert('Style Code is required');
      return;
    }
    if (!category.trim()) {
      alert('Category is required');
      return;
    }

    // If has order, validate order fields
    if (hasOrder) {
      if (!orderQuantity || parseFloat(orderQuantity) <= 0) {
        alert('Order Quantity is required and must be greater than 0');
        return;
      }
      // Cost is optional - can be added later
    }

    try {
      setLoading(true);

      // Prepare components data with fabrics
      const numComponents = parseInt(numberOfComponents) || 1;
      const componentsData = [];

      // Distribute fabrics across components evenly
      const fabricsPerComponent = Math.ceil(fabrics.length / numComponents);

      for (let i = 0; i < numComponents; i++) {
        const componentFabrics = fabrics
          .slice(i * fabricsPerComponent, (i + 1) * fabricsPerComponent)
          .filter(f => f.fabricName.trim() || f.greigeName.trim()) // Only include if at least one field has value
          .map(f => ({
            fabricName: f.fabricName.trim() || 'Not specified',
            fabricType: f.fabricName.trim() || 'Cotton', // Default to Cotton if not specified
            greigeName: f.greigeName.trim() || null,
          }));

        componentsData.push({
          componentName: `Component ${i + 1}`,
          componentType: 'Main',
          sortOrder: i,
          fabrics: componentFabrics,
        });
      }

      // Prepare garment trims data
      const garmentTrimsData = garmentTrims
        .filter(trim => trim.trimName.trim())
        .map(trim => ({
          trimName: trim.trimName.trim(),
          trimType: trim.trimType.trim() || 'Not specified',
          quantityPerPiece: trim.quantityPerPiece || '0',
          unit: trim.unit.trim() || 'pcs',
          supplier: trim.supplier.trim() || null,
        }));

      // Prepare value additions data
      const valueAdditionsData = [];
      if (valueAdditions.embroidery && valueAdditionDetails.embroidery.trim()) {
        valueAdditionsData.push({
          additionType: 'Embroidery',
          description: valueAdditionDetails.embroidery.trim(),
          estimatedCost: null,
          vendor: null,
        });
      }
      if (valueAdditions.handwork && valueAdditionDetails.handwork.trim()) {
        valueAdditionsData.push({
          additionType: 'Handwork',
          description: valueAdditionDetails.handwork.trim(),
          estimatedCost: null,
          vendor: null,
        });
      }
      if (valueAdditions.printing && valueAdditionDetails.printing.trim()) {
        valueAdditionsData.push({
          additionType: 'Printing',
          description: valueAdditionDetails.printing.trim(),
          estimatedCost: null,
          vendor: null,
        });
      }
      if (valueAdditions.washing && valueAdditionDetails.washing.trim()) {
        valueAdditionsData.push({
          additionType: 'Washing',
          description: valueAdditionDetails.washing.trim(),
          estimatedCost: null,
          vendor: null,
        });
      }

      // Prepare packaging data
      const packagingData = packagingTrims
        .filter(pkg => pkg.itemName.trim())
        .map(pkg => ({
          itemName: pkg.itemName.trim(),
          itemType: pkg.itemType || 'polybag',
          specification: pkg.specification.trim() || null,
          quantityPerPack: pkg.quantityPerPack || '1',
        }));

      // Prepare data for submission
      const styleData = {
        styleCode: styleCode.trim(),
        styleName: styleName.trim() || styleCode.trim(), // Use styleCode if styleName is empty
        buyerName: buyerName.trim(),
        brandName: brandName.trim(),
        category: category.trim(),
        description: description.trim() || null,
        season: null, // Can be added later if needed
        orderQuantity: hasOrder && orderQuantity ? parseInt(orderQuantity) : null,
        orderDate: hasOrder && orderDate ? orderDate : null,
        deliveryDate: hasOrder && deliveryDate ? deliveryDate : null,
        orderValue: hasOrder && orderValue ? parseFloat(orderValue) : null,
        components: componentsData,
        processes: [], // Can be added later via edit
        garmentTrims: garmentTrimsData,
        valueAdditions: valueAdditionsData,
        packagingTrims: packagingData,
        // Note: sizeBreakdown will be handled later when we add it to the backend
      };

      console.log('Submitting style data:', styleData);

      await styleService.createStyle(styleData);

      alert('Style created successfully!');
      navigate('/styles');
    } catch (err: any) {
      console.error('Error creating style:', err);
      alert(err.response?.data?.message || 'Failed to create style');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Top Navigation Bar */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="text-2xl cursor-pointer" onClick={() => navigate('/dashboard')}>🏭</div>
              <h1 className="text-xl font-bold text-gray-800">Kashaya Fabs ERP</h1>
              <span className="text-gray-400">|</span>
              <h2 className="text-lg text-gray-600">Create Style</h2>
            </div>
            <div className="flex items-center space-x-4">
              {saveStatus === 'saving' && (
                <span className="text-sm text-blue-600">Saving...</span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-sm text-green-600">✓ Saved</span>
              )}
              <div className="text-sm text-gray-600">
                <span className="font-medium">{currentUser?.firstName} {currentUser?.lastName}</span>
                <span className="mx-2">•</span>
                <span className="text-gray-500">{currentUser?.role}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/styles')}>
                Cancel
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Style Information</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Section 1: Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Basic Information</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Buyer Name - FIRST FIELD */}
                  <div>
                    <Label htmlFor="buyerName">
                      Buyer Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="buyerName"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      placeholder="Enter buyer name"
                      required
                    />
                  </div>

                  {/* Brand Name */}
                  <div>
                    <Label htmlFor="brandName">
                      Brand Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="brandName"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="Enter brand name"
                      required
                    />
                  </div>

                  {/* Style Code */}
                  <div>
                    <Label htmlFor="styleCode">
                      Style Code <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="styleCode"
                      value={styleCode}
                      onChange={(e) => setStyleCode(e.target.value)}
                      placeholder="Enter style code"
                      required
                    />
                  </div>

                  {/* Style Name - OPTIONAL */}
                  <div>
                    <Label htmlFor="styleName">
                      Style Name <span className="text-gray-400 text-sm">(Optional)</span>
                    </Label>
                    <Input
                      id="styleName"
                      value={styleName}
                      onChange={(e) => setStyleName(e.target.value)}
                      placeholder="Enter style name (optional)"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <Label htmlFor="category">
                      Category <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g., Shirt, Dress, Pants"
                      required
                    />
                  </div>

                  {/* Number of Components */}
                  <div>
                    <Label htmlFor="numberOfComponents">
                      Number of Components <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="numberOfComponents"
                      type="number"
                      min="1"
                      max="10"
                      value={numberOfComponents}
                      onChange={(e) => setNumberOfComponents(e.target.value)}
                      placeholder="Enter number of components"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      E.g., 1 for single piece, 2 for 2-pc set, 3 for 3-pc set
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 2: Order Information (Optional) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-lg font-semibold text-gray-700">Order Information</h3>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="hasOrder"
                      checked={hasOrder}
                      onChange={(e) => setHasOrder(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="hasOrder" className="cursor-pointer">
                      This style has an order
                    </Label>
                  </div>
                </div>

                {hasOrder && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50 p-4 rounded-lg">
                    {/* Order Quantity */}
                    <div>
                      <Label htmlFor="orderQuantity">
                        Order Quantity (Pieces) <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="orderQuantity"
                        type="number"
                        min="1"
                        value={orderQuantity}
                        onChange={(e) => setOrderQuantity(e.target.value)}
                        placeholder="Enter quantity"
                        required={hasOrder}
                      />
                    </div>

                    {/* Cost Per Piece */}
                    <div>
                      <Label htmlFor="costPerPiece">
                        Cost Per Piece <span className="text-gray-400 text-sm">(Optional)</span>
                      </Label>
                      <Input
                        id="costPerPiece"
                        type="number"
                        step="0.01"
                        min="0"
                        value={costPerPiece}
                        onChange={(e) => setCostPerPiece(e.target.value)}
                        placeholder="Enter cost per piece"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Can be added later if cost is not finalized
                      </p>
                    </div>

                    {/* Order Value (Auto-calculated) */}
                    <div>
                      <Label htmlFor="orderValue">
                        Order Value <span className="text-gray-400 text-sm">(Auto-calculated)</span>
                      </Label>
                      <Input
                        id="orderValue"
                        type="text"
                        value={orderValue}
                        disabled
                        className="bg-gray-100"
                      />
                    </div>

                    {/* Order Date */}
                    <div>
                      <Label htmlFor="orderDate">
                        Order Date
                      </Label>
                      <Input
                        id="orderDate"
                        type="date"
                        value={orderDate}
                        onChange={(e) => setOrderDate(e.target.value)}
                      />
                    </div>

                    {/* Delivery Date */}
                    <div>
                      <Label htmlFor="deliveryDate">
                        Delivery Date
                      </Label>
                      <Input
                        id="deliveryDate"
                        type="date"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section 3: Fabrics */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-lg font-semibold text-gray-700">Fabrics</h3>
                  <Button
                    type="button"
                    size="sm"
                    onClick={addFabric}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    + Add Fabric
                  </Button>
                </div>

                <div className="space-y-4">
                  {fabrics.map((fabric, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Fabric Name */}
                          <div>
                            <Label htmlFor={`fabricName-${index}`}>
                              Fabric Name {index + 1}
                            </Label>
                            <Input
                              id={`fabricName-${index}`}
                              value={fabric.fabricName}
                              onChange={(e) => updateFabric(index, 'fabricName', e.target.value)}
                              placeholder="e.g., Cotton, Polyester, Linen"
                            />
                          </div>

                          {/* Greige Name */}
                          <div>
                            <Label htmlFor={`greigeName-${index}`}>
                              Greige Name (Count & Construction)
                            </Label>
                            <Input
                              id={`greigeName-${index}`}
                              value={fabric.greigeName}
                              onChange={(e) => updateFabric(index, 'greigeName', e.target.value)}
                              placeholder="e.g., 40x40/133x72, 30s Combed"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Specify count, construction, and other technical details
                            </p>
                          </div>
                        </div>

                        {fabrics.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeFabric(index)}
                            className="mt-6 text-red-600 hover:text-red-700"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 4: Size Breakdown */}
              {hasOrder && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-lg font-semibold text-gray-700">Size Breakdown</h3>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="hasSizeBreakdown"
                        checked={hasSizeBreakdown}
                        onChange={(e) => setHasSizeBreakdown(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="hasSizeBreakdown" className="cursor-pointer">
                        Add size-wise quantity breakdown
                      </Label>
                    </div>
                  </div>

                  {hasSizeBreakdown && (
                    <div className="space-y-4 bg-purple-50 p-4 rounded-lg">
                      {/* Size Selection */}
                      <div>
                        <Label>Select Sizes</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {availableSizes.map(size => (
                            <button
                              key={size}
                              type="button"
                              onClick={() => toggleSizeSelection(size)}
                              className={`px-4 py-2 rounded ${
                                selectedSizes.includes(size)
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-white border border-gray-300 text-gray-700'
                              }`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Input Method Selection */}
                      {selectedSizes.length > 0 && (
                        <div>
                          <Label>Input Method</Label>
                          <div className="flex gap-4 mt-2">
                            <label className="flex items-center space-x-2">
                              <input
                                type="radio"
                                value="ratio"
                                checked={sizeInputMethod === 'ratio'}
                                onChange={(e) => setSizeInputMethod(e.target.value as any)}
                              />
                              <span>Ratio (e.g., 1:2:3:2:1)</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="radio"
                                value="percentage"
                                checked={sizeInputMethod === 'percentage'}
                                onChange={(e) => setSizeInputMethod(e.target.value as any)}
                              />
                              <span>Percentage (%)</span>
                            </label>
                            <label className="flex items-center space-x-2">
                              <input
                                type="radio"
                                value="absolute"
                                checked={sizeInputMethod === 'absolute'}
                                onChange={(e) => setSizeInputMethod(e.target.value as any)}
                              />
                              <span>Absolute Numbers</span>
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Size Breakdown Input */}
                      {selectedSizes.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {selectedSizes.map(size => (
                            <div key={size}>
                              <Label htmlFor={`size-${size}`}>
                                {size} {sizeInputMethod === 'percentage' ? '(%)' : sizeInputMethod === 'ratio' ? '(ratio)' : '(pcs)'}
                              </Label>
                              <Input
                                id={`size-${size}`}
                                type="number"
                                value={sizeBreakdown[size] || ''}
                                onChange={(e) => updateSizeBreakdown(size, e.target.value)}
                                placeholder={sizeInputMethod === 'ratio' ? '1' : sizeInputMethod === 'percentage' ? '20' : '100'}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Section 5: Garment Trims */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-lg font-semibold text-gray-700">Garment Trims</h3>
                  <Button
                    type="button"
                    size="sm"
                    onClick={addGarmentTrim}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    + Add Trim
                  </Button>
                </div>

                {garmentTrims.length > 0 ? (
                  <div className="space-y-3">
                    {garmentTrims.map((trim, index) => (
                      <div key={index} className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                          <div>
                            <Label>Trim Name</Label>
                            <Input
                              value={trim.trimName}
                              onChange={(e) => updateGarmentTrim(index, 'trimName', e.target.value)}
                              placeholder="e.g., Button, Zipper"
                            />
                          </div>
                          <div>
                            <Label>Type</Label>
                            <Input
                              value={trim.trimType}
                              onChange={(e) => updateGarmentTrim(index, 'trimType', e.target.value)}
                              placeholder="e.g., Metal, Plastic"
                            />
                          </div>
                          <div>
                            <Label>Qty per Piece</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={trim.quantityPerPiece}
                              onChange={(e) => updateGarmentTrim(index, 'quantityPerPiece', e.target.value)}
                              placeholder="e.g., 5"
                            />
                          </div>
                          <div>
                            <Label>Unit</Label>
                            <select
                              value={trim.unit}
                              onChange={(e) => updateGarmentTrim(index, 'unit', e.target.value)}
                              className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                            >
                              <option value="pcs">Pieces</option>
                              <option value="meters">Meters</option>
                              <option value="yards">Yards</option>
                              <option value="sets">Sets</option>
                              <option value="dozen">Dozen</option>
                            </select>
                          </div>
                          <div className="flex items-end gap-2">
                            <div className="flex-1">
                              <Label>Supplier</Label>
                              <Input
                                value={trim.supplier}
                                onChange={(e) => updateGarmentTrim(index, 'supplier', e.target.value)}
                                placeholder="Supplier name"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeGarmentTrim(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No garment trims added yet. Click "+ Add Trim" to add.</p>
                )}
              </div>

              {/* Section 6: Value Addition */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Value Addition</h3>

                <div className="space-y-4">
                  {/* Checkboxes for value additions */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={valueAdditions.embroidery}
                        onChange={() => toggleValueAddition('embroidery')}
                        className="rounded"
                      />
                      <span>Embroidery</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={valueAdditions.handwork}
                        onChange={() => toggleValueAddition('handwork')}
                        className="rounded"
                      />
                      <span>Handwork</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={valueAdditions.printing}
                        onChange={() => toggleValueAddition('printing')}
                        className="rounded"
                      />
                      <span>Printing</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={valueAdditions.washing}
                        onChange={() => toggleValueAddition('washing')}
                        className="rounded"
                      />
                      <span>Washing/Finishing</span>
                    </label>
                  </div>

                  {/* Details for selected value additions */}
                  {Object.entries(valueAdditions).map(([type, isSelected]) => (
                    isSelected && (
                      <div key={type} className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                        <h4 className="font-semibold text-gray-700 mb-3 capitalize">{type} Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label>Description</Label>
                            <Input
                              value={valueAdditionDetails[type]?.description || ''}
                              onChange={(e) => updateValueAdditionDetail(type, 'description', e.target.value)}
                              placeholder="e.g., Location, color count, stitch count"
                            />
                          </div>
                          <div>
                            <Label>Estimated Cost</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={valueAdditionDetails[type]?.estimatedCost || ''}
                              onChange={(e) => updateValueAdditionDetail(type, 'estimatedCost', e.target.value)}
                              placeholder="Cost per piece"
                            />
                          </div>
                          <div>
                            <Label>Vendor</Label>
                            <Input
                              value={valueAdditionDetails[type]?.vendor || ''}
                              onChange={(e) => updateValueAdditionDetail(type, 'vendor', e.target.value)}
                              placeholder="Vendor name"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>

              {/* Section 7: Packaging Trims */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-lg font-semibold text-gray-700">Packaging Requirements</h3>
                  <Button
                    type="button"
                    size="sm"
                    onClick={addPackagingTrim}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    + Add Packaging Item
                  </Button>
                </div>

                {packagingTrims.length > 0 ? (
                  <div className="space-y-3">
                    {packagingTrims.map((item, index) => (
                      <div key={index} className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <Label>Item Name</Label>
                            <Input
                              value={item.itemName}
                              onChange={(e) => updatePackagingTrim(index, 'itemName', e.target.value)}
                              placeholder="e.g., Polybag, Hangtag"
                            />
                          </div>
                          <div>
                            <Label>Type</Label>
                            <select
                              value={item.itemType}
                              onChange={(e) => updatePackagingTrim(index, 'itemType', e.target.value)}
                              className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                            >
                              <option value="">Select type</option>
                              <option value="polybag">Polybag</option>
                              <option value="hangtag">Hangtag</option>
                              <option value="pricetag">Price Tag</option>
                              <option value="sticker">Sticker/Label</option>
                              <option value="innerbox">Inner Box</option>
                              <option value="carton">Master Carton</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          <div>
                            <Label>Specification</Label>
                            <Input
                              value={item.specification}
                              onChange={(e) => updatePackagingTrim(index, 'specification', e.target.value)}
                              placeholder="Size, material, etc."
                            />
                          </div>
                          <div className="flex items-end gap-2">
                            <div className="flex-1">
                              <Label>Qty per Pack</Label>
                              <Input
                                type="number"
                                value={item.quantityPerPack}
                                onChange={(e) => updatePackagingTrim(index, 'quantityPerPack', e.target.value)}
                                placeholder="e.g., 1, 5, 10"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removePackagingTrim(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No packaging items added yet. Click "+ Add Packaging Item" to add.</p>
                )}
              </div>

              {/* Section 8: Description/Remarks (at the end) */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Description / Remarks</h3>

                <div>
                  <Label htmlFor="description">
                    Additional Notes <span className="text-gray-400 text-sm">(Optional)</span>
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter any additional notes, remarks, or special instructions..."
                    rows={4}
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-4 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/styles')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? 'Creating...' : 'Create Style'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
