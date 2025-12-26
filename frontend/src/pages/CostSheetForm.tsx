import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { createCostSheet, getCostSheetById, updateCostSheet, generateCostSheetFromStyle } from '../services/costSheet.service';
import { styleService } from '../services/style.service';
import { customerService } from '../services/customer.service';
import { getActiveBOMByStyle } from '../services/bom.service';
import { fabricStockService } from '../services/fabricStock.service';
import type { Style } from '../types/style.types';
import type { Customer } from '../types/customer.types';
import type {
  FabricDetail,
  TrimDetail,
  EmbroideryDetail,
  AccessoryDetail,
  CMTCosts
} from '../types/costSheet.types';
import { notify } from '../lib/notify';
import { formatCurrency } from '../lib/currency';
import { Trash2, Plus, Download, Sparkles, AlertCircle } from 'lucide-react';
import { FabricWidthComparison } from '../components/FabricWidthComparison';
import { CADStatusBadge, getCADWorkflowMessage, isCADApproved } from '../components/CADStatusBadge';
import FabricCostingRow from '../components/cost-sheet/FabricCostingRow';
import CostComparisonTable from '../components/cost-sheet/CostComparisonTable';
import type { FabricCostCalculationResult } from '../types/fabricCosting.types';

const CostSheetForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [styles, setStyles] = useState<Style[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<Style | null>(null);
  const [fabricWidthComparisons, setFabricWidthComparisons] = useState<Map<string, any>>(new Map());
  const [fabricCostResults, setFabricCostResults] = useState<FabricCostCalculationResult[]>([]);

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

  // Fetch customers on mount
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await customerService.getAllCustomers({ page: 1, limit: 1000 });
        setCustomers(response.data);
      } catch (error: unknown) {
        notify.error('Failed to load customers');
      }
    };
    fetchCustomers();
  }, []);

  // Fetch styles when customer is selected
  useEffect(() => {
    const fetchStyles = async () => {
      if (!selectedCustomerId) {
        setStyles([]);
        setSelectedStyleId('');
        return;
      }

      try {
        // Get the selected customer's name
        const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
        if (!selectedCustomer) {
          setStyles([]);
          return;
        }

        // Fetch styles filtered by customer name using API parameter
        const response = await styleService.getAllStyles(
          1,
          1000,
          undefined, // search
          undefined, // stage
          undefined, // cadStatus
          selectedCustomer.name // customerName
        );
        setStyles(response.data);

        console.log('Loaded styles for customer:', selectedCustomer.name, response.data.length);
      } catch (error: unknown) {
        console.error('Failed to load styles:', error);
        notify.error('Failed to load styles');
      }
    };
    fetchStyles();
  }, [selectedCustomerId, customers]);

  // Fetch style details when style is selected and auto-populate data
  useEffect(() => {
    const fetchStyleDetails = async () => {
      if (selectedStyleId && !isEditMode) {
        try {
          const styleDetails = await styleService.getStyleById(selectedStyleId);
          setSelectedStyle(styleDetails);

          // Track what was populated
          const populated: string[] = [];
          let fabricsWithoutRate = 0;
          let fabricsWithFetchedRates = 0;

          // Auto-populate basic information from style
          if (styleDetails.numberOfComponents) {
            setNumberOfComponents(styleDetails.numberOfComponents);
            populated.push(`${styleDetails.numberOfComponents} components`);
          }

          // Auto-populate category information
          if (styleDetails.brandCategories) {
            setCategory(styleDetails.brandCategories.category || '');
            setSubCategory(styleDetails.brandCategories.subCategory || '');
            populated.push('category info');
          } else if (styleDetails.specifications) {
            setCategory(styleDetails.specifications);
            populated.push('category info');
          }

          // Auto-populate fabric details from style components
          if (styleDetails.components && styleDetails.components.length > 0) {
            const fabricDetailsFromStyle: FabricDetail[] = [];
            const widthComparisonsMap = new Map<string, any>();

            // Collect all fabric IDs to fetch rates in parallel
            const fabricRateFetchPromises: Promise<void>[] = [];

            for (const component of styleDetails.components) {
              if (component.fabrics && component.fabrics.length > 0) {
                for (const fabric of component.fabrics) {
                  let fabricRate = fabric.unitPrice || 0;

                  // If no rate in style and fabricId is available, try to fetch from stock
                  if (!fabricRate && fabric.fabricId) {
                    const fabricId = fabric.fabricId;
                    const fabricIndex = fabricDetailsFromStyle.length; // Track index for updating later

                    // Create placeholder entry
                    fabricDetailsFromStyle.push({
                      fabricName: fabric.genericFabricName || fabric.fabricName || '',
                      fabricWidth: fabric.fabricWidth || 0,
                      fabricAverage: fabric.cadAverageMeters || fabric.quantityNeeded || 0,
                      fabricRate: 0, // Placeholder, will be updated
                      fabricTotal: 0,
                      fabricId: fabric.fabricId, // Include fabricId for sourcing strategy
                    });

                    // Fetch rate asynchronously
                    const fetchPromise = fabricStockService.getStockByFabricId(fabricId)
                      .then((stockEntries) => {
                        if (stockEntries && stockEntries.length > 0) {
                          // Use weighted average cost from the first (most recent) stock entry
                          const latestStock = stockEntries[0];
                          const rate = latestStock.weightedAvgCost || latestStock.purchaseCost || 0;
                          if (rate > 0) {
                            fabricDetailsFromStyle[fabricIndex].fabricRate = rate;
                            fabricDetailsFromStyle[fabricIndex].fabricTotal =
                              (fabric.cadAverageMeters || fabric.quantityNeeded || 0) * rate;
                            fabricsWithFetchedRates++;
                          } else {
                            fabricsWithoutRate++;
                          }
                        } else {
                          fabricsWithoutRate++;
                        }
                      })
                      .catch((error) => {
                        console.error(`Failed to fetch rate for fabric ${fabricId}:`, error);
                        fabricsWithoutRate++;
                      });

                    fabricRateFetchPromises.push(fetchPromise);
                  } else {
                    // Use existing rate or mark as needing rate
                    if (!fabricRate) {
                      fabricsWithoutRate++;
                    }

                    fabricDetailsFromStyle.push({
                      fabricName: fabric.genericFabricName || fabric.fabricName || '',
                      fabricWidth: fabric.fabricWidth || 0,
                      fabricAverage: fabric.cadAverageMeters || fabric.quantityNeeded || 0,
                      fabricRate: fabricRate,
                      fabricTotal: (fabric.cadAverageMeters || fabric.quantityNeeded || 0) * fabricRate,
                      fabricId: fabric.fabricId, // Include fabricId for sourcing strategy
                    });
                  }

                  // Build fabric width comparisons if CAD averages exist
                  if (fabric.cadAverages && fabric.cadAverages.length > 0) {
                    widthComparisonsMap.set(fabric.fabricName, {
                      fabricName: fabric.fabricName,
                      cadAverages: fabric.cadAverages,
                    });
                  }
                }
              }
            }

            // Wait for all rate fetches to complete
            await Promise.all(fabricRateFetchPromises);

            if (fabricDetailsFromStyle.length > 0) {
              setFabricDetails(fabricDetailsFromStyle);
              setFabricWidthComparisons(widthComparisonsMap);

              const ratesMessage = [];
              if (fabricsWithFetchedRates > 0) {
                ratesMessage.push(`${fabricsWithFetchedRates} rates from stock`);
              }
              if (fabricsWithoutRate > 0) {
                ratesMessage.push(`${fabricsWithoutRate} need rate`);
              }

              if (ratesMessage.length > 0) {
                populated.push(`${fabricDetailsFromStyle.length} fabrics (${ratesMessage.join(', ')})`);
              } else {
                populated.push(`${fabricDetailsFromStyle.length} fabrics with rates`);
              }
            }
          }

          // Show success notification
          if (populated.length > 0) {
            notify.success(`Auto-populated: ${populated.join(', ')}`, { duration: 4000 });

            // Show additional info about rate fetching
            if (fabricsWithFetchedRates > 0) {
              notify.success(`Fetched ${fabricsWithFetchedRates} fabric rate(s) from stock`, {
                duration: 4000
              });
            }

            // Warn user if rates are missing
            if (fabricsWithoutRate > 0) {
              notify.warning(`Please enter fabric rates for ${fabricsWithoutRate} fabric(s)`, {
                duration: 5000
              });
            }
          } else {
            notify.info('Style loaded. Please fill in cost details manually.');
          }

        } catch (error: unknown) {
          console.error('Failed to fetch style details:', error);
          notify.error('Failed to load style details');
        }
      }
    };
    fetchStyleDetails();
  }, [selectedStyleId, isEditMode]);

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
  const updateFabricRow = (index: number, field: keyof FabricDetail, value: FabricDetail[keyof FabricDetail]) => {
    const updated = [...fabricDetails];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-calculate fabric total
    if (field === 'fabricWidth' || field === 'fabricAverage' || field === 'fabricRate') {
      const fabric = updated[index];
      fabric.fabricTotal = fabric.fabricAverage * fabric.fabricRate;
    }

    setFabricDetails(updated);
  };

  // Update fabric sourcing strategy
  const updateFabricSourcingStrategy = (
    index: number,
    strategy: {
      sourcingStrategy: 'STOCK_REUSE' | 'READY_FABRIC' | 'GREIGE_PROCESSED';
      cost: number;
      stockLotId?: string;
      processorId?: string;
      rateCardId?: string;
      procurementId?: string;
      greigeCost?: number;
      processingCost?: number;
      isManualOverride?: boolean;
      overrideReason?: string;
    }
  ) => {
    const updated = [...fabricDetails];
    const costPerMeter = updated[index].fabricAverage > 0
      ? strategy.cost / updated[index].fabricAverage
      : 0;

    updated[index] = {
      ...updated[index],
      sourcingStrategy: strategy.sourcingStrategy,
      fabricRate: costPerMeter,
      fabricTotal: strategy.cost,
      stockLotId: strategy.stockLotId,
      processorId: strategy.processorId,
      rateCardId: strategy.rateCardId,
      procurementId: strategy.procurementId,
      greigeCost: strategy.greigeCost,
      processingCost: strategy.processingCost,
      isManualOverride: strategy.isManualOverride,
      overrideReason: strategy.overrideReason,
    };
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
  const updateTrimRow = (index: number, field: keyof TrimDetail, value: TrimDetail[keyof TrimDetail]) => {
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
  const updateEmbroideryRow = (index: number, field: keyof EmbroideryDetail, value: EmbroideryDetail[keyof EmbroideryDetail]) => {
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
  const updateAccessoryRow = (index: number, field: keyof AccessoryDetail, value: AccessoryDetail[keyof AccessoryDetail]) => {
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
    notify.success(`Updated to ${width}" width (${cadAverage.toFixed(3)}m)`);
  };

  // Load data from BOM
  const handleLoadFromBOM = async () => {
    if (!selectedStyleId) {
      notify.error('Please select a style first');
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
        notify.error('No approved BOM found for this style');
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

      notify.success(`Loaded ${newFabricDetails.length + newTrimsDetails.length} materials from BOM (Version ${bom.version})`);
    } catch (error: unknown) {
      notify.error(error.response?.data?.message || 'Failed to load BOM data');
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate cost sheet from approved CAD
  const handleAutoGenerate = async () => {
    if (!selectedStyleId) {
      notify.error('Please select a style first');
      return;
    }

    try {
      setLoading(true);

      // Fetch style details to check CAD status
      const styleDetails = await styleService.getStyleById(selectedStyleId);
      setSelectedStyle(styleDetails);

      // Check if CAD is approved
      if (styleDetails.cadStatus !== 'APPROVED') {
        notify.error('CAD planning must be approved before generating cost sheet', {
          duration: 5000,
        });
        return;
      }

      // Generate cost sheet from style
      const generatedCostSheet = await generateCostSheetFromStyle(selectedStyleId);

      // Pre-fill fabric details from generated data
      if (generatedCostSheet.fabricDetails && generatedCostSheet.fabricDetails.length > 0) {
        setFabricDetails(generatedCostSheet.fabricDetails);
      }

      // Pre-fill trims details from generated data
      if (generatedCostSheet.trimsDetails && generatedCostSheet.trimsDetails.length > 0) {
        setTrimsDetails(generatedCostSheet.trimsDetails);
      }

      // Pre-fill embroidery details from generated data (VALUE_ADDITION materials)
      if (generatedCostSheet.embroideryDetails && generatedCostSheet.embroideryDetails.length > 0) {
        setEmbroideryDetails(generatedCostSheet.embroideryDetails);
      }

      // Pre-fill accessories details from generated data (PACKAGING materials)
      if (generatedCostSheet.accessoriesDetails && generatedCostSheet.accessoriesDetails.length > 0) {
        setAccessoriesDetails(generatedCostSheet.accessoriesDetails);
      }

      // Pre-fill basic information
      if (generatedCostSheet.numberOfComponents) {
        setNumberOfComponents(generatedCostSheet.numberOfComponents);
      }
      if (generatedCostSheet.category) {
        setCategory(generatedCostSheet.category);
      }
      if (generatedCostSheet.subCategory) {
        setSubCategory(generatedCostSheet.subCategory);
      }

      // Show success message with what was pre-filled
      const preFilled: string[] = [];
      if (generatedCostSheet.fabricDetails?.length) preFilled.push(`${generatedCostSheet.fabricDetails.length} fabrics`);
      if (generatedCostSheet.trimsDetails?.length) preFilled.push(`${generatedCostSheet.trimsDetails.length} trims`);
      if (generatedCostSheet.embroideryDetails?.length) preFilled.push(`${generatedCostSheet.embroideryDetails.length} embroidery items`);
      if (generatedCostSheet.accessoriesDetails?.length) preFilled.push(`${generatedCostSheet.accessoriesDetails.length} accessories`);

      notify.success(
        `Cost sheet auto-generated! Pre-filled: ${preFilled.length > 0 ? preFilled.join(', ') : 'No materials found'}. Please add CMT costs and finalize.`,
        { duration: 6000 }
      );
    } catch (error: unknown) {
      const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Failed to auto-generate cost sheet';
      notify.error(errorMsg, { duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStyleId) {
      notify.error('Please select a style');
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
        notify.success('Cost sheet updated successfully');
      } else {
        await createCostSheet(data);
        notify.success('Cost sheet created successfully');
      }

      navigate('/cost-sheets');
    } catch (error: unknown) {
      notify.error(error.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'create'} cost sheet`);
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
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleAutoGenerate}
                  disabled={loading || !selectedStyle || !isCADApproved(selectedStyle.cadStatus)}
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    !selectedStyle || !isCADApproved(selectedStyle.cadStatus)
                      ? 'CAD must be approved before auto-generation'
                      : 'Generate cost sheet from approved CAD data'
                  }
                >
                  <Sparkles className="h-4 w-4" />
                  Auto-Generate from CAD
                </Button>
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
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Select Customer *</label>
              <Select
                value={selectedCustomerId}
                onValueChange={(value) => {
                  setSelectedCustomerId(value);
                  setSelectedStyleId(''); // Reset style when customer changes
                }}
                disabled={isEditMode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a customer..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.code} - {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Select Style *</label>
              <Select
                value={selectedStyleId}
                onValueChange={setSelectedStyleId}
                disabled={isEditMode || !selectedCustomerId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedCustomerId ? "Choose a style..." : "Select customer first"} />
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
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
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

          {/* CAD Status Info Banner */}
          {selectedStyle && (
            <div className={`mt-4 p-4 rounded-lg border ${
              isCADApproved(selectedStyle.cadStatus)
                ? 'bg-green-50 border-green-300'
                : 'bg-yellow-50 border-yellow-300'
            }`}>
              <div className="flex items-start gap-3">
                <AlertCircle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                  isCADApproved(selectedStyle.cadStatus) ? 'text-green-600' : 'text-yellow-600'
                }`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold">CAD Planning Workflow:</span>
                    <CADStatusBadge status={selectedStyle.cadStatus} size="sm" />
                  </div>
                  <p className={`text-sm ${
                    isCADApproved(selectedStyle.cadStatus) ? 'text-green-800' : 'text-yellow-800'
                  }`}>
                    {getCADWorkflowMessage(selectedStyle.cadStatus)}
                  </p>
                  {!isCADApproved(selectedStyle.cadStatus) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => navigate(`/styles/${selectedStyleId}/cad-planning`)}
                    >
                      Go to CAD Planning
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fabric Details */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Fabric Details</h2>
            <Button type="button" onClick={addFabricRow} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Add Fabric
            </Button>
          </div>

          {/* Fabric Table with Sourcing Strategy */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fabric</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">CAD (m)</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Width</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sourcing</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {fabricDetails.map((fabric, index) => (
                  <FabricCostingRow
                    key={index}
                    index={index}
                    fabricId={fabric.fabricId || ''}
                    fabricName={fabric.fabricName}
                    cadMeters={fabric.fabricAverage}
                    width={fabric.fabricWidth}
                    orderQuantity={selectedStyle?.estimatedQuantity}
                    styleId={selectedStyleId}
                    currentStrategy={fabric.sourcingStrategy}
                    currentCost={fabric.fabricTotal}
                    onStrategyChange={(strategy) => updateFabricSourcingStrategy(index, strategy)}
                    onRemove={fabricDetails.length > 1 ? () => removeFabricRow(index) : undefined}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 pt-4 border-t">
            <p className="text-lg font-semibold text-right">
              Fabric Total: {formatCurrency(calculateFabricTotal())}
            </p>
          </div>
        </div>

        {/* Fabric Cost Comparison Table */}
        {fabricDetails.length > 0 && fabricDetails.some(f => f.fabricId) && fabricCostResults.length > 0 && (
          <CostComparisonTable
            fabricResults={fabricCostResults}
            className="bg-white"
          />
        )}

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
              Trims Total: {formatCurrency(calculateTrimsTotal())}
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
              CMT Total: {formatCurrency(calculateCMTTotal())}
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
                Embroidery Total: {formatCurrency(calculateEmbroideryTotal())}
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
                Accessories Total: {formatCurrency(calculateAccessoriesTotal())}
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
              <span className="font-semibold">{formatCurrency(calculateFabricTotal())}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Trims Total:</span>
              <span className="font-semibold">{formatCurrency(calculateTrimsTotal())}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">CMT Total:</span>
              <span className="font-semibold">{formatCurrency(calculateCMTTotal())}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Embroidery Total:</span>
              <span className="font-semibold">{formatCurrency(calculateEmbroideryTotal())}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Accessories Total:</span>
              <span className="font-semibold">{formatCurrency(calculateAccessoriesTotal())}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-gray-300">
              <span className="font-semibold">Subtotal:</span>
              <span className="font-semibold text-lg">{formatCurrency(calculateSubtotal())}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Value Loss ({valueLossPercent}%):</span>
              <span className="font-semibold text-orange-600">+ {formatCurrency(calculateValueLossAmount())}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-gray-300">
              <span className="font-semibold">Total After Value Loss:</span>
              <span className="font-semibold text-lg">{formatCurrency(calculateTotalAfterValueLoss())}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Markup ({markupPercent}%):</span>
              <span className="font-semibold text-green-600">+ {formatCurrency(calculateMarkupAmount())}</span>
            </div>
            <div className="flex justify-between pt-3 border-t-2 border-gray-400">
              <span className="font-bold text-lg">Total Product Cost:</span>
              <span className="font-bold text-2xl text-green-600">{formatCurrency(calculateTotalProductCost())}</span>
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
