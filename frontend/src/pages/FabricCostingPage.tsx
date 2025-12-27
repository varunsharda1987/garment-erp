/**
 * Fabric Costing Page - Redesigned
 * Focus on greige processing workflow with transportation costs and processor rate card integration
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { fabricCostingService } from '../services/fabricCosting.service';
import { styleService } from '../services/style.service';
import { customerService } from '../services/customer.service';
import type {
  FabricCostingRow,
  FabricForCosting,
  ProcessorInfo,
  CostInputMode,
  TransportCostMode,
  ProcessorRateLookup,
  ScreenType,
} from '../types/fabricCosting.types';
import { SCREEN_TYPE_LABELS, DEFAULT_SCREEN_COSTS } from '../types/fabricCosting.types';
import type { Style } from '../types/style.types';
import type { Customer } from '../types/customer.types';
import { notify } from '../lib/notify';
import {
  ArrowLeft,
  Save,
  ChevronDown,
  ChevronRight,
  Loader2,
  Info,
  RefreshCw,
} from 'lucide-react';

export default function FabricCostingPage() {
  const navigate = useNavigate();

  // Selection state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [processors, setProcessors] = useState<ProcessorInfo[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedStyleId, setSelectedStyleId] = useState('');
  const [orderQuantity, setOrderQuantity] = useState<number>(1000);

  // Fabric rows
  const [fabricRows, setFabricRows] = useState<FabricCostingRow[]>([]);

  // Loading states
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isLoadingStyles, setIsLoadingStyles] = useState(false);
  const [isLoadingFabrics, setIsLoadingFabrics] = useState(false);
  const [isLoadingProcessors, setIsLoadingProcessors] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch customers on mount
  useEffect(() => {
    const fetchCustomers = async () => {
      setIsLoadingCustomers(true);
      try {
        const response = await customerService.getAllCustomers({ page: 1, limit: 1000 });
        setCustomers(response.data);
      } catch (error) {
        notify.error('Failed to load customers');
      } finally {
        setIsLoadingCustomers(false);
      }
    };
    fetchCustomers();
  }, []);

  // Fetch processors on mount
  useEffect(() => {
    const fetchProcessors = async () => {
      setIsLoadingProcessors(true);
      try {
        const data = await fabricCostingService.getProcessors();
        setProcessors(data);
      } catch (error) {
        notify.error('Failed to load processors');
      } finally {
        setIsLoadingProcessors(false);
      }
    };
    fetchProcessors();
  }, []);

  // Fetch styles when customer is selected
  useEffect(() => {
    const fetchStyles = async () => {
      if (!selectedCustomerId) {
        setStyles([]);
        setSelectedStyleId('');
        return;
      }

      setIsLoadingStyles(true);
      try {
        const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
        if (!selectedCustomer) {
          setStyles([]);
          return;
        }

        const response = await styleService.getAllStyles(
          1,
          1000,
          undefined,
          undefined,
          undefined,
          selectedCustomer.name
        );
        setStyles(response.data);
      } catch (error) {
        notify.error('Failed to load styles');
      } finally {
        setIsLoadingStyles(false);
      }
    };
    fetchStyles();
  }, [selectedCustomerId, customers]);

  // Fetch fabrics when style is selected
  useEffect(() => {
    const fetchStyleFabrics = async () => {
      if (!selectedStyleId) {
        setFabricRows([]);
        return;
      }

      setIsLoadingFabrics(true);
      try {
        const response = await fabricCostingService.getStyleFabrics(selectedStyleId);

        // Convert FabricForCosting to FabricCostingRow
        const rows: FabricCostingRow[] = response.fabrics.map((fabric: FabricForCosting) => {
          // Check if ready fabric cost is available from fabric_master
          const hasReadyFabricCost = fabric.readyFabricCost != null && fabric.readyFabricCost > 0;

          // Check for existing costing data in widthOptions (from fabric_width_cad)
          // Try to find a matching width option with costing data for this style
          const existingCosting = fabric.widthOptions?.find(
            (opt) => opt.costingStyleId === selectedStyleId && opt.cutableWidth === fabric.width
          ) || fabric.widthOptions?.find(
            (opt) => opt.totalCostPerMeter != null && opt.cutableWidth === fabric.width
          );

          // If we have existing costing data, use it
          if (existingCosting && existingCosting.totalCostPerMeter != null) {
            return {
              id: fabric.id,
              fabricId: fabric.fabricId,
              fabricWidthCadId: existingCosting.id,
              fabricName: fabric.fabricName,
              genericFabricName: fabric.genericFabricName,
              componentName: fabric.componentName,
              cadMeters: fabric.cadMeters || 0,
              width: fabric.width || 0,
              finishType: fabric.finishType,

              // Greige reference - from saved data
              greigeId: existingCosting.greigeId || fabric.greigeId,
              greigeName: existingCosting.greigeName || fabric.greigeName,
              greigeCode: existingCosting.greigeCode || fabric.greigeCode,
              greigeDefaultCost: fabric.greigeDefaultCost,

              // Ready fabric cost from fabric_master
              readyFabricCost: fabric.readyFabricCost,

              // Cost input mode from saved data
              costInputMode: (existingCosting.costInputMode as CostInputMode) || 'BUILD_UP',

              // Landed price mode
              landedPricePerMeter: existingCosting.costInputMode === 'LANDED_PRICE' ? existingCosting.totalCostPerMeter : null,

              // Build-up mode - Greige & Transport (from saved data)
              greigeCostPerMeter: existingCosting.greigeCostPerMeter || fabric.greigeDefaultCost,
              greigeCostSource: existingCosting.greigeCostPerMeter ? 'MANUAL' : (fabric.greigeDefaultCost ? 'GREIGE_MASTER' : 'MANUAL'),
              transportCostMode: 'PER_METER' as TransportCostMode,
              transportCostPerMeter: existingCosting.transportCostPerMeter ?? 2, // Default ₹2/m
              transportFixedAmount: null,

              // Shrinkage (from saved data)
              shrinkagePercent: existingCosting.shrinkagePercent,
              shrinkageValue: existingCosting.shrinkageCostPerMeter,

              // Processor selection (from saved data)
              processorId: existingCosting.processorId,
              processorName: existingCosting.processorName,
              processingType: fabric.finishType === 'PRINTED' ? 'PRINTING' :
                              (fabric.finishType === 'DYED' || fabric.finishType === 'YARN_DYED') ? 'DYEING' : null,
              printingType: null,
              processingCostPerMeter: existingCosting.processingPricePerMeter,
              slabLabel: null,
              rateCardId: null,

              // Screen cost (from saved data)
              numberOfColors: existingCosting.numberOfColors || fabric.numberOfColors,
              screenType: existingCosting.screenType as ScreenType | null,
              screenCostPerScreen: null,
              screenCostTotal: null,
              screenCostPerMeter: existingCosting.screenCostPerMeter,

              // Calculated totals (from saved data)
              totalCostPerMeter: existingCosting.totalCostPerMeter,
              totalCostForQuantity: null,

              // UI state
              isExpanded: false,
              isLoading: false,
              error: null,
            };
          }

          // No existing costing, create default row
          return {
          id: fabric.id,
          fabricId: fabric.fabricId,
          fabricWidthCadId: null,
          fabricName: fabric.fabricName,
          genericFabricName: fabric.genericFabricName,
          componentName: fabric.componentName,
          cadMeters: fabric.cadMeters || 0,
          width: fabric.width || 0,
          finishType: fabric.finishType,

          // Greige reference
          greigeId: fabric.greigeId,
          greigeName: fabric.greigeName,
          greigeCode: fabric.greigeCode,
          greigeDefaultCost: fabric.greigeDefaultCost,

          // Ready fabric cost from fabric_master
          readyFabricCost: fabric.readyFabricCost,

          // Default to Landed Price mode if ready fabric cost is available, otherwise Build-up
          costInputMode: hasReadyFabricCost ? 'LANDED_PRICE' as CostInputMode : 'BUILD_UP' as CostInputMode,

          // Landed price mode - default to ready fabric cost if available
          landedPricePerMeter: hasReadyFabricCost ? fabric.readyFabricCost : null,

          // Build-up mode - Greige & Transport
          // Use greigeCostPerMeter which prioritizes stock cost over default cost
          greigeCostPerMeter: fabric.greigeCostPerMeter || fabric.greigeDefaultCost,
          greigeCostSource: fabric.greigeCostSource || (fabric.greigeDefaultCost ? 'GREIGE_MASTER' : 'MANUAL'),
          transportCostMode: 'PER_METER' as TransportCostMode,
          transportCostPerMeter: 2, // Default ₹2/m transport cost
          transportFixedAmount: null,

          // Shrinkage
          shrinkagePercent: null,
          shrinkageValue: null,

          // Processor selection
          processorId: null,
          processorName: null,
          processingType: fabric.finishType === 'PRINTED' ? 'PRINTING' :
                          (fabric.finishType === 'DYED' || fabric.finishType === 'YARN_DYED') ? 'DYEING' : null,
          printingType: null,
          processingCostPerMeter: null,
          slabLabel: null,
          rateCardId: null,

          // Screen cost
          numberOfColors: fabric.numberOfColors,
          screenType: null,
          screenCostPerScreen: null,
          screenCostTotal: null,
          screenCostPerMeter: null,

          // Calculated totals
          totalCostPerMeter: null,
          totalCostForQuantity: null,

          // UI state
          isExpanded: false,
          isLoading: false,
          error: null,
        };
        });

        // Calculate initial totalCostPerMeter for rows that have landed price set
        const rowsWithTotals = rows.map(row => {
          if (row.costInputMode === 'LANDED_PRICE' && row.landedPricePerMeter) {
            return {
              ...row,
              totalCostPerMeter: row.landedPricePerMeter,
            };
          }
          return row;
        });

        setFabricRows(rowsWithTotals);
        notify.success(`Loaded ${rowsWithTotals.length} fabrics from style`);
      } catch (error) {
        notify.error('Failed to load style fabrics');
      } finally {
        setIsLoadingFabrics(false);
      }
    };
    fetchStyleFabrics();
  }, [selectedStyleId]);

  // Calculate cost per meter for a row
  // Note: totalCostForQuantity is kept for internal calculations (screen cost amortization)
  // but is NOT displayed to users - this page only shows ₹/m
  const calculateRowTotals = useCallback((row: FabricCostingRow): FabricCostingRow => {
    const totalQuantity = row.cadMeters * orderQuantity;

    // If landed price mode
    if (row.costInputMode === 'LANDED_PRICE') {
      const totalCostPerMeter = row.landedPricePerMeter;
      return {
        ...row,
        totalCostPerMeter,
        totalCostForQuantity: null, // Not used in this page
      };
    }

    // Build-up mode
    const greigeCost = row.greigeCostPerMeter || 0;

    // Transport cost per meter
    let transportPerMeter = 0;
    if (row.transportCostMode === 'PER_METER') {
      transportPerMeter = row.transportCostPerMeter || 0;
    } else if (row.transportFixedAmount && totalQuantity > 0) {
      transportPerMeter = row.transportFixedAmount / totalQuantity;
    }

    // Shrinkage value (per meter)
    const shrinkageValue = row.shrinkagePercent
      ? greigeCost * (row.shrinkagePercent / 100)
      : 0;

    // Processing cost
    const processingCost = row.processingCostPerMeter || 0;

    // Screen cost per meter (for PRINTING only - amortized over estimated quantity)
    let screenCostPerMeter = 0;
    let screenCostTotal = null;
    let effectiveScreenCostPerScreen = row.screenCostPerScreen;

    // If no screen cost from processor rate card, use default based on screenType
    if (!effectiveScreenCostPerScreen && row.screenType) {
      effectiveScreenCostPerScreen = DEFAULT_SCREEN_COSTS[row.screenType];
    }

    if (row.processingType === 'PRINTING' && effectiveScreenCostPerScreen && row.numberOfColors) {
      screenCostTotal = effectiveScreenCostPerScreen * row.numberOfColors;
      screenCostPerMeter = totalQuantity > 0 ? screenCostTotal / totalQuantity : 0;
    }

    // Total per meter
    const totalCostPerMeter = greigeCost + transportPerMeter + shrinkageValue + processingCost + screenCostPerMeter;

    return {
      ...row,
      shrinkageValue,
      screenCostTotal,
      screenCostPerMeter: screenCostPerMeter > 0 ? screenCostPerMeter : null,
      totalCostPerMeter,
      totalCostForQuantity: null, // Not used in this page
    };
  }, [orderQuantity]);

  // Recalculate all rows when orderQuantity changes
  useEffect(() => {
    if (fabricRows.length > 0) {
      setFabricRows(rows => rows.map(row => calculateRowTotals(row)));
    }
  }, [orderQuantity, calculateRowTotals]);

  // Update a single row
  const updateRow = (index: number, updates: Partial<FabricCostingRow>) => {
    setFabricRows(rows => {
      const newRows = [...rows];
      newRows[index] = calculateRowTotals({ ...newRows[index], ...updates });
      return newRows;
    });
  };

  // Lookup processor rate
  const lookupRate = async (index: number) => {
    const row = fabricRows[index];

    if (!row.processorId || !row.processingType || !row.greigeId) {
      notify.warning('Please select a processor and ensure greige is set');
      return;
    }

    // For PRINTING, we need printingType
    if (row.processingType === 'PRINTING' && !row.printingType) {
      notify.warning('Please select a printing type');
      return;
    }

    const totalQuantity = row.cadMeters * orderQuantity;
    if (totalQuantity <= 0) {
      notify.warning('Order quantity must be greater than 0');
      return;
    }

    updateRow(index, { isLoading: true, error: null });

    try {
      const result = await fabricCostingService.lookupRate({
        processorId: row.processorId,
        processingType: row.processingType,
        printingType: row.printingType || undefined,
        greigeId: row.greigeId,
        quantityMeters: totalQuantity,
      });

      if (result) {
        updateRow(index, {
          processingCostPerMeter: result.ratePerMeter,
          slabLabel: result.slabLabel,
          rateCardId: result.id,
          processorName: result.processorName,
          shrinkagePercent: result.shrinkagePercent,
          screenCostPerScreen: result.screenCostPerScreen,
          isLoading: false,
        });
        notify.success(`Rate loaded: ₹${result.ratePerMeter}/m (${result.slabLabel})`);
      } else {
        updateRow(index, {
          processingCostPerMeter: null,
          slabLabel: null,
          rateCardId: null,
          shrinkagePercent: null,
          screenCostPerScreen: null,
          isLoading: false,
          error: 'No rate found for this processor/greige/quantity',
        });
        notify.warning('No rate found for this combination');
      }
    } catch (error: any) {
      updateRow(index, {
        isLoading: false,
        error: error.message || 'Failed to lookup rate',
      });
      notify.error('Failed to lookup rate');
    }
  };

  // Toggle row expansion
  const toggleRowExpansion = (index: number) => {
    setFabricRows(rows => {
      const newRows = [...rows];
      newRows[index] = { ...newRows[index], isExpanded: !newRows[index].isExpanded };
      return newRows;
    });
  };

  // Save fabric costing - saves to fabric_width_cad
  const handleSave = async () => {
    if (!selectedStyleId) {
      notify.error('Please select a style first');
      return;
    }

    // Only save rows that have a calculated cost
    const rowsToSave = fabricRows.filter(row => row.totalCostPerMeter != null);

    if (rowsToSave.length === 0) {
      notify.warning('No fabrics with calculated costs to save');
      return;
    }

    setIsSaving(true);
    try {
      await fabricCostingService.saveFabricCosting({
        styleId: selectedStyleId,
        fabricCostings: rowsToSave.map(row => ({
          // fabric_width_cad identification
          fabricWidthCadId: row.fabricWidthCadId,
          fabricId: row.fabricId,
          cutableWidth: row.width,
          componentName: row.componentName || null,
          // Greige and Transport
          greigeId: row.greigeId,
          greigeCostPerMeter: row.costInputMode === 'BUILD_UP' ? row.greigeCostPerMeter : null,
          transportCostPerMeter: row.costInputMode === 'BUILD_UP' ? row.transportCostPerMeter : null,
          // Processing
          processorId: row.processorId,
          processingCostPerMeter: row.costInputMode === 'BUILD_UP' ? row.processingCostPerMeter : null,
          // Shrinkage
          shrinkagePercent: row.shrinkagePercent,
          shrinkageCostPerMeter: row.shrinkageValue,
          // Screen cost (for printing)
          screenCostPerMeter: row.screenCostPerMeter,
          screenType: row.screenType,
          numberOfColors: row.numberOfColors,
          // Total
          totalCostPerMeter: row.totalCostPerMeter,
          // Mode
          costInputMode: row.costInputMode,
        })),
      });
      notify.success(`Saved costing for ${rowsToSave.length} fabric(s) to fabric_width_cad`);
    } catch (error: any) {
      notify.error(error.response?.data?.error || 'Failed to save fabric costing');
    } finally {
      setIsSaving(false);
    }
  };

  // Count fabrics with calculated costs
  const fabricsWithCosts = fabricRows.filter(row => row.totalCostPerMeter != null).length;

  // Get finish type badge color
  const getFinishTypeBadge = (finishType: string | null) => {
    switch (finishType) {
      case 'DYED':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Dyed</Badge>;
      case 'PRINTED':
        return <Badge variant="secondary" className="bg-purple-100 text-purple-700">Printed</Badge>;
      case 'YARN_DYED':
        return <Badge variant="secondary" className="bg-green-100 text-green-700">Yarn Dyed</Badge>;
      case 'RAW':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-700">Raw</Badge>;
      default:
        return <Badge variant="secondary" className="bg-gray-100 text-gray-500">-</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-full mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Fabric Costing</h1>
          <p className="text-gray-600 mt-1">
            Calculate fabric cost per meter (₹/m) - consumption is calculated in CAD Planning
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>

      {/* Selection Card */}
      <Card className="p-4 mb-6">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">Customer</Label>
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingCustomers ? 'Loading...' : 'Select customer'} />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Style</Label>
            <Select
              value={selectedStyleId}
              onValueChange={setSelectedStyleId}
              disabled={!selectedCustomerId || isLoadingStyles}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoadingStyles ? 'Loading...' : 'Select style'} />
              </SelectTrigger>
              <SelectContent>
                {styles.map((style) => (
                  <SelectItem key={style.id} value={style.id}>
                    {style.styleCode} - {style.styleName || 'No Name'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium mb-2 block">Estimated Quantity (pcs)</Label>
            <Input
              type="number"
              min="1"
              value={orderQuantity}
              onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 1)}
              placeholder="For slab calculation"
            />
            <p className="text-xs text-gray-500 mt-1">Used for processor rate slab lookup</p>
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleSave}
              disabled={isSaving || fabricRows.length === 0}
              className="w-full"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Costing
            </Button>
          </div>
        </div>
      </Card>

      {/* Fabric Costing Table */}
      {isLoadingFabrics ? (
        <Card className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span>Loading fabrics...</span>
        </Card>
      ) : fabricRows.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          {selectedStyleId
            ? 'No fabrics found in this style'
            : 'Select a customer and style to load fabrics'}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-8"></TableHead>
                <TableHead className="min-w-[200px]">Fabric</TableHead>
                <TableHead className="w-24 text-center">CAD (m)</TableHead>
                <TableHead className="w-20 text-center">Width</TableHead>
                <TableHead className="w-24 text-center">Finish</TableHead>
                <TableHead className="w-28 text-center">Mode</TableHead>
                <TableHead className="w-32 text-right">Greige (₹/m)</TableHead>
                <TableHead className="w-32 text-right">Transport</TableHead>
                <TableHead className="min-w-[180px]">Processor</TableHead>
                <TableHead className="w-32 text-right">Processing</TableHead>
                <TableHead className="w-32 text-right font-semibold">Total (₹/m)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fabricRows.map((row, index) => (
                <React.Fragment key={row.id}>
                  {/* Main Row */}
                  <TableRow className={row.isExpanded ? 'bg-blue-50/50' : ''}>
                    {/* Expand Button */}
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-1 h-auto"
                        onClick={() => toggleRowExpansion(index)}
                      >
                        {row.isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </Button>
                    </TableCell>

                    {/* Fabric Info */}
                    <TableCell>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{row.fabricName}</p>
                          {row.readyFabricCost && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200">
                              ₹{row.readyFabricCost}/m
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">{row.componentName}</p>
                        {row.greigeName && (
                          <p className="text-xs text-gray-400">Greige: {row.greigeName}</p>
                        )}
                      </div>
                    </TableCell>

                    {/* CAD */}
                    <TableCell className="text-center text-sm">
                      {row.cadMeters.toFixed(2)}
                    </TableCell>

                    {/* Width */}
                    <TableCell className="text-center text-sm">
                      {row.width ? `${row.width}"` : '-'}
                    </TableCell>

                    {/* Finish Type */}
                    <TableCell className="text-center">
                      {getFinishTypeBadge(row.finishType)}
                    </TableCell>

                    {/* Cost Mode Toggle */}
                    <TableCell>
                      <div className="flex items-center gap-2 justify-center">
                        <span className={`text-xs ${row.costInputMode === 'BUILD_UP' ? 'font-medium' : 'text-gray-400'}`}>
                          Build
                        </span>
                        <Switch
                          checked={row.costInputMode === 'LANDED_PRICE'}
                          onCheckedChange={(checked) =>
                            updateRow(index, {
                              costInputMode: checked ? 'LANDED_PRICE' : 'BUILD_UP',
                            })
                          }
                        />
                        <span className={`text-xs ${row.costInputMode === 'LANDED_PRICE' ? 'font-medium' : 'text-gray-400'}`}>
                          Landed
                        </span>
                      </div>
                    </TableCell>

                    {/* Greige Cost / Landed Price */}
                    <TableCell>
                      {row.costInputMode === 'LANDED_PRICE' ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Landed price"
                            className="w-24 text-right text-sm h-8"
                            value={row.landedPricePerMeter || ''}
                            onChange={(e) =>
                              updateRow(index, {
                                landedPricePerMeter: parseFloat(e.target.value) || null,
                              })
                            }
                          />
                          {row.readyFabricCost && row.landedPricePerMeter !== row.readyFabricCost && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-1.5 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() =>
                                updateRow(index, {
                                  landedPricePerMeter: row.readyFabricCost,
                                })
                              }
                              title={`Use fabric master price: ₹${row.readyFabricCost}/m`}
                            >
                              <RefreshCw className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Greige cost"
                            className="w-24 text-right text-sm h-8"
                            value={row.greigeCostPerMeter || ''}
                            onChange={(e) =>
                              updateRow(index, {
                                greigeCostPerMeter: parseFloat(e.target.value) || null,
                                greigeCostSource: 'MANUAL',
                              })
                            }
                          />
                          {row.greigeDefaultCost && row.greigeCostSource === 'GREIGE_PROCUREMENT' && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-green-600 font-medium" title="Using greige stock cost from latest procurement">
                                Stock
                              </span>
                            </div>
                          )}
                          {row.greigeDefaultCost && row.greigeCostSource === 'GREIGE_MASTER' && (
                            <span className="text-xs text-blue-600" title="Using default greige cost from greige master">
                              Default
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>

                    {/* Transport Cost */}
                    <TableCell>
                      {row.costInputMode === 'LANDED_PRICE' ? (
                        <span className="text-gray-400 text-sm">-</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={row.transportCostMode === 'PER_METER' ? '₹/m' : 'Fixed'}
                            className="w-20 text-right text-sm h-8"
                            value={
                              row.transportCostMode === 'PER_METER'
                                ? row.transportCostPerMeter || ''
                                : row.transportFixedAmount || ''
                            }
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || null;
                              if (row.transportCostMode === 'PER_METER') {
                                updateRow(index, { transportCostPerMeter: value });
                              } else {
                                updateRow(index, { transportFixedAmount: value });
                              }
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() =>
                              updateRow(index, {
                                transportCostMode:
                                  row.transportCostMode === 'PER_METER' ? 'FIXED' : 'PER_METER',
                              })
                            }
                          >
                            {row.transportCostMode === 'PER_METER' ? '/m' : '₹'}
                          </Button>
                        </div>
                      )}
                    </TableCell>

                    {/* Processor Selection */}
                    <TableCell>
                      {row.costInputMode === 'LANDED_PRICE' || row.finishType === 'RAW' ? (
                        <span className="text-gray-400 text-sm">-</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Select
                            value={row.processorId || ''}
                            onValueChange={(value) => {
                              const processor = processors.find(p => p.id === value);
                              updateRow(index, {
                                processorId: value,
                                processorName: processor?.name || null,
                                processingCostPerMeter: null,
                                slabLabel: null,
                                shrinkagePercent: null,
                                screenCostPerScreen: null,
                              });
                            }}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue placeholder="Processor" />
                            </SelectTrigger>
                            <SelectContent>
                              {processors.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => lookupRate(index)}
                            disabled={row.isLoading || !row.processorId || !row.greigeId}
                          >
                            {row.isLoading ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      )}
                    </TableCell>

                    {/* Processing Cost */}
                    <TableCell className="text-right">
                      {row.processingCostPerMeter ? (
                        <div>
                          <span className="font-medium text-sm">₹{row.processingCostPerMeter.toFixed(2)}</span>
                          {row.slabLabel && (
                            <p className="text-xs text-gray-500">{row.slabLabel}</p>
                          )}
                        </div>
                      ) : row.costInputMode === 'LANDED_PRICE' || row.finishType === 'RAW' ? (
                        <span className="text-gray-400 text-sm">-</span>
                      ) : (
                        <span className="text-gray-400 text-sm">Select processor</span>
                      )}
                    </TableCell>

                    {/* Total Cost */}
                    <TableCell className="text-right">
                      {row.totalCostPerMeter ? (
                        <span className="font-bold text-sm">₹{row.totalCostPerMeter.toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Expanded Details Row */}
                  {row.isExpanded && (
                    <TableRow className="bg-blue-50/30">
                      <TableCell colSpan={11} className="p-0">
                        <div className="p-4 border-t border-blue-100">
                          <div className="grid grid-cols-4 gap-6">
                            {/* Cost Breakdown */}
                            <div className="col-span-2">
                              <h4 className="font-medium text-sm mb-3 text-gray-700">Cost Breakdown</h4>
                              <div className="bg-white rounded border p-3 space-y-2">
                                {row.costInputMode === 'LANDED_PRICE' ? (
                                  <>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-600">Landed Price:</span>
                                      <span className="font-medium">₹{(row.landedPricePerMeter || 0).toFixed(2)}/m</span>
                                    </div>
                                    {row.readyFabricCost && (
                                      <div className="flex justify-between text-sm text-green-600">
                                        <span className="flex items-center gap-1">
                                          <Info className="w-3 h-3" />
                                          Fabric Master Price:
                                        </span>
                                        <span>₹{row.readyFabricCost.toFixed(2)}/m</span>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-600">Greige Cost:</span>
                                      <span>₹{(row.greigeCostPerMeter || 0).toFixed(2)}/m</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-600">Transport:</span>
                                      <span>
                                        {row.transportCostMode === 'PER_METER'
                                          ? `₹${(row.transportCostPerMeter || 0).toFixed(2)}/m`
                                          : row.transportFixedAmount
                                            ? `₹${row.transportFixedAmount} fixed`
                                            : '-'}
                                      </span>
                                    </div>
                                    {row.shrinkagePercent && row.shrinkagePercent > 0 && (
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Shrinkage ({row.shrinkagePercent}%):</span>
                                        <span>₹{(row.shrinkageValue || 0).toFixed(2)}/m</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-600">Processing:</span>
                                      <span>₹{(row.processingCostPerMeter || 0).toFixed(2)}/m</span>
                                    </div>
                                    {row.processingType === 'PRINTING' && row.screenCostPerMeter && (
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Screen Cost:</span>
                                        <span>₹{row.screenCostPerMeter.toFixed(2)}/m</span>
                                      </div>
                                    )}
                                    {row.readyFabricCost && (
                                      <div className="flex justify-between text-sm text-green-600 pt-1 border-t border-dashed">
                                        <span className="flex items-center gap-1">
                                          <Info className="w-3 h-3" />
                                          Ready Fabric Price:
                                        </span>
                                        <span>₹{row.readyFabricCost.toFixed(2)}/m</span>
                                      </div>
                                    )}
                                  </>
                                )}
                                <div className="border-t pt-2 flex justify-between font-medium">
                                  <span>Total:</span>
                                  <span>₹{(row.totalCostPerMeter || 0).toFixed(2)}/m</span>
                                </div>
                              </div>
                            </div>

                            {/* Printing Options - Show for PRINTED fabrics in any mode */}
                            {row.finishType === 'PRINTED' && (
                              <div>
                                <h4 className="font-medium text-sm mb-3 text-gray-700">Printing Details</h4>
                                <div className="space-y-3">
                                  {/* Printing Type - Only needed in Build-up mode for rate lookup */}
                                  {row.costInputMode === 'BUILD_UP' && (
                                    <div>
                                      <Label className="text-xs">Printing Type</Label>
                                      <Select
                                        value={row.printingType || ''}
                                        onValueChange={(value) =>
                                          updateRow(index, {
                                            printingType: value as any,
                                            processingCostPerMeter: null,
                                            slabLabel: null,
                                          })
                                        }
                                      >
                                        <SelectTrigger className="h-8 text-sm">
                                          <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="PIGMENT">Pigment</SelectItem>
                                          <SelectItem value="PROCIAN">Procian</SelectItem>
                                          <SelectItem value="DISCHARGE">Discharge</SelectItem>
                                          <SelectItem value="PIGMENT_DISCHARGE">Pigment Discharge</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                  {/* Screen Type (Machine Type) - for screen cost calculation */}
                                  {row.costInputMode === 'BUILD_UP' && (
                                    <div>
                                      <Label className="text-xs">Screen Type</Label>
                                      <Select
                                        value={row.screenType || ''}
                                        onValueChange={(value) =>
                                          updateRow(index, {
                                            screenType: value as ScreenType,
                                          })
                                        }
                                      >
                                        <SelectTrigger className="h-8 text-sm">
                                          <SelectValue placeholder="Select screen" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="ROTARY">
                                            Rotary (₹{DEFAULT_SCREEN_COSTS.ROTARY}/screen)
                                          </SelectItem>
                                          <SelectItem value="FLATBELT">
                                            Flat Belt (₹{DEFAULT_SCREEN_COSTS.FLATBELT}/screen)
                                          </SelectItem>
                                          <SelectItem value="TABLE">
                                            Table (₹{DEFAULT_SCREEN_COSTS.TABLE}/screen)
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                  {/* Number of Colors - Always show for PRINTED fabrics */}
                                  <div>
                                    <Label className="text-xs">Number of Colors</Label>
                                    <Input
                                      type="number"
                                      min="1"
                                      className="h-8 text-sm"
                                      value={row.numberOfColors || ''}
                                      onChange={(e) =>
                                        updateRow(index, {
                                          numberOfColors: parseInt(e.target.value) || null,
                                        })
                                      }
                                    />
                                  </div>
                                  {/* Screen cost calculation - Only in Build-up mode */}
                                  {row.costInputMode === 'BUILD_UP' && (row.screenCostPerScreen || row.screenType) && row.numberOfColors && (
                                    <div className="text-xs text-gray-500">
                                      {row.screenCostPerScreen ? (
                                        <>Screen: ₹{row.screenCostPerScreen}/screen × {row.numberOfColors} colors = ₹{row.screenCostTotal?.toFixed(2)}</>
                                      ) : row.screenType ? (
                                        <>Screen ({SCREEN_TYPE_LABELS[row.screenType]}): ₹{DEFAULT_SCREEN_COSTS[row.screenType]}/screen × {row.numberOfColors} colors = ₹{(DEFAULT_SCREEN_COSTS[row.screenType] * row.numberOfColors).toFixed(2)}</>
                                      ) : null}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Processor Rate Info - Only show in Build-up mode */}
                            {row.costInputMode === 'BUILD_UP' && (
                              <div>
                                <h4 className="font-medium text-sm mb-3 text-gray-700">Rate Lookup Info</h4>
                                <div className="bg-white rounded border p-3 space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">CAD/pc:</span>
                                    <span>{row.cadMeters.toFixed(2)} m</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Est. Quantity:</span>
                                    <span>{orderQuantity.toLocaleString()} pcs</span>
                                  </div>
                                  <div className="flex justify-between text-gray-500 border-t pt-2">
                                    <span>Est. Total Meters:</span>
                                    <span>{(row.cadMeters * orderQuantity).toLocaleString()} m</span>
                                  </div>
                                  <p className="text-xs text-gray-400 pt-1">
                                    Used for processor rate slab lookup only
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Error Message */}
                          {row.error && (
                            <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                              {row.error}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>

          {/* Summary Footer */}
          <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {fabricRows.length} fabric{fabricRows.length !== 1 ? 's' : ''} •
              {fabricsWithCosts} with cost calculated
            </div>
            <div className="text-right text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Info className="w-4 h-4" />
                Cost per meter will be used in Cost Sheet calculation
              </span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
