import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { createCostSheet, getCostSheetById, updateCostSheet } from '../services/costSheet.service';
import { styleService } from '../services/style.service';
import { getActiveBOMByStyle } from '../services/bom.service';
import type { Style } from '../types/style.types';
import type {
  FabricDetail,
  TrimDetail,
  EmbroideryDetail,
  AccessoryDetail,
  CMTCosts
} from '../types/costSheet.types';
import { toast } from 'react-hot-toast';
import { Trash2, Plus, Download } from 'lucide-react';
import { FabricWidthComparison } from '../components/FabricWidthComparison';

const CostSheetForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [styles, setStyles] = useState<Style[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<Style | null>(null);
  const [fabricWidthComparisons, setFabricWidthComparisons] = useState<Map<string, any>>(new Map());

  // Basic Information
  const [numberOfComponents, setNumberOfComponents] = useState<number>(0);
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');

  // Fabric Details (Dynamic)
  const [fabricDetails, setFabricDetails] = useState<FabricDetail[]>([
    { fabricName: '', fabricWidth: 0, fabricAverage: 0, fabricRate: 0, fabricTotal: 0 }
  ]);

  // Trims Details (Dynamic - Thread is default)
  const [trimsDetails, setTrimsDetails] = useState<TrimDetail[]>([
    { trimName: 'Thread', trimQuantity: 0, trimRate: 0, trimTotal: 0 }
  ]);

  // CMT Costs
  const [cmtCosts, setCmtCosts] = useState<CMTCosts>({
    cuttingCost: 0,
    stitchingCost: 0,
    finishingCost: 0,
    buttonAttachmentCost: 0,
    handworkCost: 0
  });

  // Embroidery Details (Dynamic)
  const [embroideryDetails, setEmbroideryDetails] = useState<EmbroideryDetail[]>([]);

  // Accessories Details (Dynamic)
  const [accessoriesDetails, setAccessoriesDetails] = useState<AccessoryDetail[]>([]);

  // Value Loss & Markup
  const [valueLossPercent, setValueLossPercent] = useState(2);
  const [markupPercent, setMarkupPercent] = useState(15);

  const [notes, setNotes] = useState('');

  // Fetch styles on mount
  useEffect(() => {
    const fetchStyles = async () => {
      try {
        const response = await styleService.getAllStyles(1, 1000);
        setStyles(response.data);
      } catch (error: any) {
        toast.error('Failed to load styles');
      }
    };
    fetchStyles();
  }, []);

  // Calculate fabric total
  const calculateFabricTotal = () => {
    return fabricDetails.reduce((sum, fabric) => sum + (fabric.fabricTotal || 0), 0);
  };

  // Calculate trims total
  const calculateTrimsTotal = () => {
    return trimsDetails.reduce((sum, trim) => sum + (trim.trimTotal || 0), 0);
  };

  // Calculate CMT total
  const calculateCMTTotal = () => {
    return Object.values(cmtCosts).reduce((sum, cost) => sum + (cost || 0), 0);
  };

  // Calculate embroidery total
  const calculateEmbroideryTotal = () => {
    return embroideryDetails.reduce((sum, embr) => sum + (embr.embroideryTotal || 0), 0);
  };

  // Calculate accessories total
  const calculateAccessoriesTotal = () => {
    return accessoriesDetails.reduce((sum, acc) => sum + (acc.accessoryTotal || 0), 0);
  };

  // Calculate subtotal (before value loss and markup)
  const calculateSubtotal = () => {
    return (
      calculateFabricTotal() +
      calculateTrimsTotal() +
      calculateCMTTotal() +
      calculateEmbroideryTotal() +
      calculateAccessoriesTotal()
    );
  };

  // Calculate value loss amount
  const calculateValueLossAmount = () => {
    const subtotal = calculateSubtotal();
    return (subtotal * valueLossPercent) / 100;
  };

  // Calculate total after value loss
  const calculateTotalAfterValueLoss = () => {
    return calculateSubtotal() + calculateValueLossAmount();
  };

  // Calculate markup amount
  const calculateMarkupAmount = () => {
    const totalAfterValueLoss = calculateTotalAfterValueLoss();
    return (totalAfterValueLoss * markupPercent) / 100;
  };

  // Calculate total product cost
  const calculateTotalProductCost = () => {
    return calculateTotalAfterValueLoss() + calculateMarkupAmount();
  };

  // Add new fabric row
  const addFabricRow = () => {
    setFabricDetails([
      ...fabricDetails,
      { fabricName: '', fabricWidth: 0, fabricAverage: 0, fabricRate: 0, fabricTotal: 0 }
    ]);
  };

  // Remove fabric row
  const removeFabricRow = (index: number) => {
    if (fabricDetails.length > 1) {
      setFabricDetails(fabricDetails.filter((_, i) => i !== index));
    }
  };

  // Update fabric row
  const updateFabricRow = (index: number, field: keyof FabricDetail, value: any) => {
    const updated = [...fabricDetails];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-calculate fabric total
    if (field === 'fabricWidth' || field === 'fabricAverage' || field === 'fabricRate') {
      const fabric = updated[index];
      fabric.fabricTotal = fabric.fabricAverage * fabric.fabricRate;
    }

    setFabricDetails(updated);
  };

  // Add new trim row
  const addTrimRow = () => {
    setTrimsDetails([
      ...trimsDetails,
      { trimName: '', trimQuantity: 0, trimRate: 0, trimTotal: 0 }
    ]);
  };

  // Remove trim row
  const removeTrimRow = (index: number) => {
    setTrimsDetails(trimsDetails.filter((_, i) => i !== index));
  };

  // Update trim row
  const updateTrimRow = (index: number, field: keyof TrimDetail, value: any) => {
    const updated = [...trimsDetails];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-calculate trim total
    if (field === 'trimQuantity' || field === 'trimRate') {
      const trim = updated[index];
      trim.trimTotal = trim.trimQuantity * trim.trimRate;
    }

    setTrimsDetails(updated);
  };

  // Add new embroidery row
  const addEmbroideryRow = () => {
    setEmbroideryDetails([
      ...embroideryDetails,
      { embroideryName: '', embroideryAverage: 0, embroideryRate: 0, embroideryTotal: 0 }
    ]);
  };

  // Remove embroidery row
  const removeEmbroideryRow = (index: number) => {
    setEmbroideryDetails(embroideryDetails.filter((_, i) => i !== index));
  };

  // Update embroidery row
  const updateEmbroideryRow = (index: number, field: keyof EmbroideryDetail, value: any) => {
    const updated = [...embroideryDetails];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-calculate embroidery total
    if (field === 'embroideryAverage' || field === 'embroideryRate') {
      const embr = updated[index];
      embr.embroideryTotal = embr.embroideryAverage * embr.embroideryRate;
    }

    setEmbroideryDetails(updated);
  };

  // Add new accessory row
  const addAccessoryRow = () => {
    setAccessoriesDetails([
      ...accessoriesDetails,
      { accessoryName: '', accessoryQuantity: 0, accessoryRate: 0, accessoryTotal: 0 }
    ]);
  };

  // Remove accessory row
  const removeAccessoryRow = (index: number) => {
    setAccessoriesDetails(accessoriesDetails.filter((_, i) => i !== index));
  };

  // Update accessory row
  const updateAccessoryRow = (index: number, field: keyof AccessoryDetail, value: any) => {
    const updated = [...accessoriesDetails];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-calculate accessory total
    if (field === 'accessoryQuantity' || field === 'accessoryRate') {
      const acc = updated[index];
      acc.accessoryTotal = acc.accessoryQuantity * acc.accessoryRate;
    }

    setAccessoriesDetails(updated);
  };

  // Handle width selection from comparison
  const handleSelectWidth = (fabricIndex: number, width: number, cadAverage: number) => {
    const updated = [...fabricDetails];
    updated[fabricIndex] = {
      ...updated[fabricIndex],
      fabricWidth: width,
      fabricAverage: cadAverage,
      fabricTotal: cadAverage * updated[fabricIndex].fabricRate,
    };
    setFabricDetails(updated);
    toast.success(`Updated to ${width}" width (${cadAverage.toFixed(3)}m)`);
  };

  // Load data from BOM
  const handleLoadFromBOM = async () => {
    if (!selectedStyleId) {
      toast.error('Please select a style first');
      return;
    }

    try {
      setLoading(true);

      // Fetch BOM and Style details
      const [bom, styleDetails] = await Promise.all([
        getActiveBOMByStyle(selectedStyleId),
        styleService.getStyleById(selectedStyleId)
      ]);

      if (!bom || !bom.bomItems || bom.bomItems.length === 0) {
        toast.error('No approved BOM found for this style');
        return;
      }

      setSelectedStyle(styleDetails);

      // Build fabric width comparisons map
      const widthComparisonsMap = new Map<string, any>();

      if (styleDetails.components) {
        styleDetails.components.forEach((component) => {
          if (component.fabrics) {
            component.fabrics.forEach((fabric) => {
              if (fabric.cadAverages && fabric.cadAverages.length > 0) {
                widthComparisonsMap.set(fabric.fabricName, {
                  fabricName: fabric.fabricName,
                  cadAverages: fabric.cadAverages,
                });
              }
            });
          }
        });
      }

      setFabricWidthComparisons(widthComparisonsMap);

      // Separate materials into fabrics and trims based on material type
      const newFabricDetails: FabricDetail[] = [];
      const newTrimsDetails: TrimDetail[] = [];

      bom.bomItems.forEach((item) => {
        const materialName = item.material?.name || 'Unknown Material';
        const rate = item.costPerUnit || 0;
        const quantityPerUnit = item.quantityPerUnit || 0;
        const wastagePercent = item.wastagePercent || 0;

        // Calculate actual quantity including wastage
        const actualQuantity = quantityPerUnit * (1 + wastagePercent / 100);

        // Check if it's fabric (METER or YARD) or trim
        if (item.unit === 'METER' || item.unit === 'YARD') {
          // Extract width from notes if available (e.g., "Component 1 - Main Fabric (54" width)")
          const widthMatch = item.notes?.match(/\((\d+)" width\)/);
          const extractedWidth = widthMatch ? parseFloat(widthMatch[1]) : 0;

          newFabricDetails.push({
            fabricName: materialName,
            fabricWidth: extractedWidth,
            fabricAverage: actualQuantity,
            fabricRate: rate,
            fabricTotal: actualQuantity * rate,
          });
        } else {
          // It's a trim (PIECE, KILOGRAM, SET, DOZEN)
          newTrimsDetails.push({
            trimName: materialName,
            trimQuantity: actualQuantity,
            trimRate: rate,
            trimTotal: actualQuantity * rate,
          });
        }
      });

      // Update state
      if (newFabricDetails.length > 0) {
        setFabricDetails(newFabricDetails);
      }
      if (newTrimsDetails.length > 0) {
        setTrimsDetails(newTrimsDetails);
      }

      toast.success(`Loaded ${newFabricDetails.length + newTrimsDetails.length} materials from BOM (Version ${bom.version})`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load BOM data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStyleId) {
      toast.error('Please select a style');
      return;
    }

    try {
      setLoading(true);

      const data = {
        styleId: selectedStyleId,
        numberOfComponents: numberOfComponents || undefined,
        category: category || undefined,
        subCategory: subCategory || undefined,
        fabricDetails,
        trimsDetails,
        cmtCosts,
        embroideryDetails,
        accessoriesDetails,
        valueLossPercent,
        markupPercent,
        notes: notes || undefined,
      };

      if (isEditMode && id) {
        await updateCostSheet(id, data);
        toast.success('Cost sheet updated successfully');
      } else {
        await createCostSheet(data);
        toast.success('Cost sheet created successfully');
      }

      navigate('/cost-sheets');
    } catch (error: any) {
      toast.error(error.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'create'} cost sheet`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEditMode) {
    return <div className="p-6 text-center">Loading...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">
          {isEditMode ? 'Edit Cost Sheet' : 'Create Cost Sheet'}
        </h1>
        <Button variant="outline" onClick={() => navigate('/cost-sheets')}>
          Back to List
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Basic Information</h2>
            {selectedStyleId && !isEditMode && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLoadFromBOM}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Load from BOM
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Select Style *</label>
              <Select
                value={selectedStyleId}
                onValueChange={setSelectedStyleId}
                disabled={isEditMode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a style..." />
                </SelectTrigger>
                <SelectContent>
                  {styles.map((style) => (
                    <SelectItem key={style.id} value={style.id}>
                      {style.styleCode} - {style.styleName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Number of Components</label>
              <Input
                type="number"
                placeholder="0"
                value={numberOfComponents || ''}
                onChange={(e) => setNumberOfComponents(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <Input
                placeholder="e.g., Top Wear"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Sub Category</label>
              <Input
                placeholder="e.g., Kurta"
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Fabric Details */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Fabric Details</h2>
            <Button type="button" onClick={addFabricRow} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Add Fabric
            </Button>
          </div>
          <div className="space-y-4">
            {fabricDetails.map((fabric, index) => {
              // Find width comparison data for this fabric
              const comparisonData = fabricWidthComparisons.get(fabric.fabricName);

              return (
                <div key={index} className="space-y-2">
                  <div className="grid grid-cols-12 gap-4 items-end border-b pb-4">
                    <div className="col-span-3">
                      <label className="block text-sm font-medium mb-2">Fabric {index + 1} Name</label>
                      <Input
                        placeholder="Fabric name"
                        value={fabric.fabricName}
                        onChange={(e) => updateFabricRow(index, 'fabricName', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-2">Width (inches)</label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={fabric.fabricWidth || ''}
                        onChange={(e) => updateFabricRow(index, 'fabricWidth', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-2">Average</label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={fabric.fabricAverage || ''}
                        onChange={(e) => updateFabricRow(index, 'fabricAverage', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-2">Rate</label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={fabric.fabricRate || ''}
                        onChange={(e) => updateFabricRow(index, 'fabricRate', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-2">Total</label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={fabric.fabricTotal.toFixed(2)}
                        disabled
                        className="bg-gray-100"
                      />
                    </div>
                    <div className="col-span-1">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeFabricRow(index)}
                        disabled={fabricDetails.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Width Comparison Component */}
                  {comparisonData && comparisonData.cadAverages && (
                    <FabricWidthComparison
                      fabricName={fabric.fabricName}
                      cadAverages={comparisonData.cadAverages}
                      materialRate={fabric.fabricRate}
                      orderQuantity={1}
                      selectedWidth={fabric.fabricWidth}
                      onSelectWidth={(width, cadAverage) => handleSelectWidth(index, width, cadAverage)}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t">
            <p className="text-lg font-semibold text-right">
              Fabric Total: ₹{calculateFabricTotal().toFixed(2)}
            </p>
          </div>
        </div>

        {/* Trims Details */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Trims Details (Thread is Default)</h2>
            <Button type="button" onClick={addTrimRow} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Add Trim
            </Button>
          </div>
          <div className="space-y-4">
            {trimsDetails.map((trim, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 items-end border-b pb-4">
                <div className="col-span-4">
                  <label className="block text-sm font-medium mb-2">Trim Name</label>
                  <Input
                    placeholder="Trim name"
                    value={trim.trimName}
                    onChange={(e) => updateTrimRow(index, 'trimName', e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2">Quantity</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={trim.trimQuantity || ''}
                    onChange={(e) => updateTrimRow(index, 'trimQuantity', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-2">Rate</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={trim.trimRate || ''}
                    onChange={(e) => updateTrimRow(index, 'trimRate', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-sm font-medium mb-2">Total</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={trim.trimTotal.toFixed(2)}
                    disabled
                    className="bg-gray-100"
                  />
                </div>
                <div className="col-span-1">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeTrimRow(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t">
            <p className="text-lg font-semibold text-right">
              Trims Total: ₹{calculateTrimsTotal().toFixed(2)}
            </p>
          </div>
        </div>

        {/* CMT Costs */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">CMT (Cut, Make, Trim) Costs</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Cutting</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={cmtCosts.cuttingCost || ''}
                onChange={(e) => setCmtCosts({ ...cmtCosts, cuttingCost: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Stitching</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={cmtCosts.stitchingCost || ''}
                onChange={(e) => setCmtCosts({ ...cmtCosts, stitchingCost: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Finishing</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={cmtCosts.finishingCost || ''}
                onChange={(e) => setCmtCosts({ ...cmtCosts, finishingCost: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Button Attachment</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={cmtCosts.buttonAttachmentCost || ''}
                onChange={(e) => setCmtCosts({ ...cmtCosts, buttonAttachmentCost: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Handwork</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={cmtCosts.handworkCost || ''}
                onChange={(e) => setCmtCosts({ ...cmtCosts, handworkCost: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t">
            <p className="text-lg font-semibold text-right">
              CMT Total: ₹{calculateCMTTotal().toFixed(2)}
            </p>
          </div>
        </div>

        {/* Embroidery Details */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Embroidery Details</h2>
            <Button type="button" onClick={addEmbroideryRow} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Add Embroidery
            </Button>
          </div>
          {embroideryDetails.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No embroidery added. Click "Add Embroidery" to start.</p>
          ) : (
            <div className="space-y-4">
              {embroideryDetails.map((embr, index) => (
                <div key={index} className="grid grid-cols-12 gap-4 items-end border-b pb-4">
                  <div className="col-span-4">
                    <label className="block text-sm font-medium mb-2">Embroidery {index + 1} Name</label>
                    <Input
                      placeholder="Embroidery name"
                      value={embr.embroideryName}
                      onChange={(e) => updateEmbroideryRow(index, 'embroideryName', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-2">Average</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={embr.embroideryAverage || ''}
                      onChange={(e) => updateEmbroideryRow(index, 'embroideryAverage', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-2">Rate</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={embr.embroideryRate || ''}
                      onChange={(e) => updateEmbroideryRow(index, 'embroideryRate', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-sm font-medium mb-2">Total</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={embr.embroideryTotal.toFixed(2)}
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeEmbroideryRow(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {embroideryDetails.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-lg font-semibold text-right">
                Embroidery Total: ₹{calculateEmbroideryTotal().toFixed(2)}
              </p>
            </div>
          )}
        </div>

        {/* Accessories Details */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Accessories Details</h2>
            <Button type="button" onClick={addAccessoryRow} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Add Accessory
            </Button>
          </div>
          {accessoriesDetails.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No accessories added. Click "Add Accessory" to start.</p>
          ) : (
            <div className="space-y-4">
              {accessoriesDetails.map((acc, index) => (
                <div key={index} className="grid grid-cols-12 gap-4 items-end border-b pb-4">
                  <div className="col-span-4">
                    <label className="block text-sm font-medium mb-2">Accessory Name</label>
                    <Input
                      placeholder="Accessory name"
                      value={acc.accessoryName}
                      onChange={(e) => updateAccessoryRow(index, 'accessoryName', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-2">Quantity</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={acc.accessoryQuantity || ''}
                      onChange={(e) => updateAccessoryRow(index, 'accessoryQuantity', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-2">Rate</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={acc.accessoryRate || ''}
                      onChange={(e) => updateAccessoryRow(index, 'accessoryRate', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-sm font-medium mb-2">Total</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={acc.accessoryTotal.toFixed(2)}
                      disabled
                      className="bg-gray-100"
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeAccessoryRow(index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {accessoriesDetails.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-lg font-semibold text-right">
                Accessories Total: ₹{calculateAccessoriesTotal().toFixed(2)}
              </p>
            </div>
          )}
        </div>

        {/* Value Loss & Markup */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Value Loss & Markup</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Value Loss (%)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="2.00"
                value={valueLossPercent}
                onChange={(e) => setValueLossPercent(parseFloat(e.target.value) || 0)}
              />
              <p className="text-sm text-gray-500 mt-1">Default: 2%</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Markup (%)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="15.00"
                value={markupPercent}
                onChange={(e) => setMarkupPercent(parseFloat(e.target.value) || 0)}
              />
              <p className="text-sm text-gray-500 mt-1">Default: 15%</p>
            </div>
          </div>

          <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between">
              <span className="text-gray-600">Fabric Total:</span>
              <span className="font-semibold">₹{calculateFabricTotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Trims Total:</span>
              <span className="font-semibold">₹{calculateTrimsTotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">CMT Total:</span>
              <span className="font-semibold">₹{calculateCMTTotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Embroidery Total:</span>
              <span className="font-semibold">₹{calculateEmbroideryTotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Accessories Total:</span>
              <span className="font-semibold">₹{calculateAccessoriesTotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-gray-300">
              <span className="font-semibold">Subtotal:</span>
              <span className="font-semibold text-lg">₹{calculateSubtotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Value Loss ({valueLossPercent}%):</span>
              <span className="font-semibold text-orange-600">+ ₹{calculateValueLossAmount().toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-gray-300">
              <span className="font-semibold">Total After Value Loss:</span>
              <span className="font-semibold text-lg">₹{calculateTotalAfterValueLoss().toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Markup ({markupPercent}%):</span>
              <span className="font-semibold text-green-600">+ ₹{calculateMarkupAmount().toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-3 border-t-2 border-gray-400">
              <span className="font-bold text-lg">Total Product Cost:</span>
              <span className="font-bold text-2xl text-green-600">₹{calculateTotalProductCost().toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Notes</h2>
          <textarea
            className="w-full border rounded-md p-3 min-h-[100px]"
            placeholder="Add any additional notes or comments..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/cost-sheets')}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : isEditMode ? 'Update Cost Sheet' : 'Create Cost Sheet'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CostSheetForm;
