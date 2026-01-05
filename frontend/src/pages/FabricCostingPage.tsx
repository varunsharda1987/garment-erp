/**
 * Fabric Costing Page - Redesigned
 * Focus on greige processing workflow with transportation costs and processor rate card integration
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
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

  // Style search state
  const [styleSearchQuery, setStyleSearchQuery] = useState('');
  const [styleSearchResults, setStyleSearchResults] = useState<Style[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

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

  // Style search with debounce
  const handleStyleSearch = useCallback((query: string) => {
    setStyleSearchQuery(query);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length < 2) {
      setStyleSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await styleService.getAllStyles(1, 20, query);
        setStyleSearchResults(response.data);
        setShowSearchResults(true);
      } catch (error) {
        notify.error('Failed to search styles');
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  // Handle style selection from search
  const handleSearchResultSelect = (style: Style) => {
    setSelectedStyleId(style.id);
    setStyleSearchQuery(style.styleCode + (style.styleName ? ` - ${style.styleName}` : ''));
    setShowSearchResults(false);
    setStyleSearchResults([]);

    // Find and set the customer from the style
    if (style.customerName) {
      const customer = customers.find(c => c.name === style.customerName);
      if (customer) {
        setSelectedCustomerId(customer.id);
      }
    }
  };

  // Clear search
  const clearSearch = () => {
    setStyleSearchQuery('');
    setStyleSearchResults([]);
    setShowSearchResults(false);
    setSelectedStyleId('');
    setSelectedCustomerId('');
    setFabricRows([]);
  };

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
        {/* Quick Search Bar */}
        <div className="mb-4" ref={searchContainerRef}>
          <Label className="text-sm font-medium mb-2 block">Quick Search</Label>
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by style code or name..."
                value={styleSearchQuery}
                onChange={(e) => handleStyleSearch(e.target.value)}
                onFocus={() => styleSearchResults.length > 0 && setShowSearchResults(true)}
                className="pl-10 pr-10"
              />
              {styleSearchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
                  onClick={clearSearch}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
              {isSearching && (
                <Loader2 className="absolute right-10 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
              )}
            </div>
            {/* Search Results Dropdown */}
            {showSearchResults && styleSearchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                {styleSearchResults.map((style) => (
                  <div
                    key={style.id}
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                    onClick={() => handleSearchResultSelect(style)}
                  >
                    <div className="font-medium text-sm">{style.styleCode}</div>
                    <div className="text-xs text-gray-500">
                      {style.styleName && <span>{style.styleName} • </span>}
                      {style.customerName || 'No Customer'}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {showSearchResults && styleSearchResults.length === 0 && styleSearchQuery.length >= 2 && !isSearching && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-4 text-center text-gray-500 text-sm">
                No styles found
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">Or select customer below to filter styles</p>
        </div>

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
        <Card className="overflow-x-auto">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-[130px] px-1 text-xs">Greige</TableHead>
                <TableHead className="w-[50px] px-1 text-center text-xs whitespace-normal leading-tight" title="Fabric consumption per piece (from CAD Planning)">CAD (m/pc)</TableHead>
                <TableHead className="w-[38px] px-1 text-center text-xs">Width</TableHead>
                <TableHead className="w-[42px] px-1 text-center text-xs">Finish</TableHead>
                <TableHead className="w-[48px] px-1 text-center text-xs">Mode</TableHead>
                <TableHead className="w-[75px] px-1 text-center text-xs whitespace-normal leading-tight">Greige +Trp (₹/m)</TableHead>
                <TableHead className="w-[110px] px-1 text-center text-xs">Processor</TableHead>
                <TableHead className="w-[55px] px-1 text-center text-xs">Colors</TableHead>
                <TableHead className="w-[85px] px-1 text-center text-xs">Print Type</TableHead>
                <TableHead className="w-[80px] px-1 text-center text-xs">Screen</TableHead>
                <TableHead className="w-[85px] px-1 text-center text-xs whitespace-normal leading-tight">Process (₹/m)</TableHead>
                <TableHead className="w-[80px] px-1 text-center text-xs font-semibold whitespace-normal leading-tight">Total (₹/m)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fabricRows.map((row, index) => (
                <React.Fragment key={row.id}>
                  {/* Main Row */}
                  <TableRow>
                    {/* Fabric Info */}
                    <TableCell className="px-1 overflow-hidden">
                      <div className="truncate">
                        <div className="flex items-center gap-1">
                          {/* Show Greige name as primary (from CAD Planning), fallback to fabric name */}
                          <p className="font-medium text-xs truncate" title={row.greigeName || row.fabricName}>{row.greigeName || row.fabricName}</p>
                          {row.readyFabricCost && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-green-50 text-green-700 border-green-200 flex-shrink-0">
                              ₹{row.readyFabricCost}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500 truncate">{row.componentName}</p>
                        {/* Show fabric name as secondary if greige is different */}
                        {row.greigeName && row.fabricName && row.greigeName !== row.fabricName && (
                          <p className="text-[10px] text-gray-400 truncate" title={row.fabricName}>Fabric: {row.fabricName}</p>
                        )}
                      </div>
                    </TableCell>

                    {/* CAD */}
                    <TableCell className="px-1 text-center text-xs">
                      <div className="flex items-center justify-center gap-0.5">
                        <span
                          className={row.cadMeters === 0 ? 'text-red-600 font-medium' : ''}
                          title="Per-piece fabric consumption (calculated from CAD Planning)"
                        >
                          {row.cadMeters.toFixed(3)}
                        </span>
                        {row.cadMeters === 0 && (
                          <span
                            className="text-red-600 cursor-help text-[10px]"
                            title="CAD consumption not set. Complete CAD Planning for this style first."
                          >
                            ⚠️
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Width */}
                    <TableCell className="px-1 text-center text-xs">
                      {row.width ? `${row.width}"` : '-'}
                    </TableCell>

                    {/* Finish Type */}
                    <TableCell className="px-1 text-center">
                      {getFinishTypeBadge(row.finishType)}
                    </TableCell>

                    {/* Cost Mode Toggle */}
                    <TableCell className="px-1">
                      <div className="flex items-center gap-1 justify-center">
                        <span className={`text-[10px] ${row.costInputMode === 'BUILD_UP' ? 'font-medium' : 'text-gray-400'}`}>
                          B
                        </span>
                        <Switch
                          checked={row.costInputMode === 'LANDED_PRICE'}
                          onCheckedChange={(checked) =>
                            updateRow(index, {
                              costInputMode: checked ? 'LANDED_PRICE' : 'BUILD_UP',
                            })
                          }
                          className="scale-75"
                        />
                        <span className={`text-[10px] ${row.costInputMode === 'LANDED_PRICE' ? 'font-medium' : 'text-gray-400'}`}>
                          L
                        </span>
                      </div>
                    </TableCell>

                    {/* Greige + Transport Combined */}
                    <TableCell className="px-1">
                      {row.costInputMode === 'LANDED_PRICE' ? (
                        <div className="flex items-center justify-center gap-0.5">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Landed ₹"
                            className="w-16 text-right text-xs h-7 px-1"
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
                              className="h-5 w-5 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() =>
                                updateRow(index, {
                                  landedPricePerMeter: row.readyFabricCost,
                                })
                              }
                              title={`Use fabric master price: ₹${row.readyFabricCost}/m`}
                            >
                              <RefreshCw className="w-2.5 h-2.5" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-0.5">
                          {/* Greige Cost */}
                          <div className="flex items-center gap-0.5">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Greige"
                              className="w-14 text-right text-xs h-6 px-0.5"
                              value={row.greigeCostPerMeter || ''}
                              onChange={(e) =>
                                updateRow(index, {
                                  greigeCostPerMeter: parseFloat(e.target.value) || null,
                                  greigeCostSource: 'MANUAL',
                                })
                              }
                            />
                            {row.greigeDefaultCost && row.greigeCostSource === 'GREIGE_PROCUREMENT' && (
                              <span className="text-[9px] text-green-600 font-medium" title="Using greige stock cost from latest procurement">S</span>
                            )}
                            {row.greigeDefaultCost && row.greigeCostSource === 'GREIGE_MASTER' && (
                              <span className="text-[9px] text-blue-600" title="Using default greige cost from greige master">D</span>
                            )}
                          </div>
                          {/* Transport Cost */}
                          <div className="flex items-center gap-0.5">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="+Trp"
                              className="w-14 text-right text-xs h-6 px-0.5"
                              value={row.transportCostPerMeter || ''}
                              onChange={(e) =>
                                updateRow(index, { transportCostPerMeter: parseFloat(e.target.value) || null })
                              }
                            />
                          </div>
                        </div>
                      )}
                    </TableCell>

                    {/* Processor Selection */}
                    <TableCell className="px-1 text-center">
                      {row.costInputMode === 'LANDED_PRICE' || row.finishType === 'RAW' ? (
                        <span className="text-gray-400 text-xs">-</span>
                      ) : (
                        <div className="flex items-center justify-center gap-0.5">
                          <Select
                            value={row.processorId || ''}
                            onValueChange={async (value) => {
                              const processor = processors.find(p => p.id === value);
                              updateRow(index, {
                                processorId: value,
                                processorName: processor?.name || null,
                                processingCostPerMeter: null,
                                slabLabel: null,
                                shrinkagePercent: null,
                                screenCostPerScreen: null,
                              });

                              // Auto-lookup rates for DYEING (no printing type needed)
                              // For PRINTING, wait until printing type is selected
                              if (row.processingType === 'DYEING' && value && row.greigeId) {
                                // Small delay to let state update
                                setTimeout(() => lookupRate(index), 100);
                              }
                            }}
                          >
                            <SelectTrigger className="w-[85px] h-7 text-[10px]">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              {processors.map((p) => (
                                <SelectItem key={p.id} value={p.id} className="text-xs">
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
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

                    {/* Number of Colors */}
                    <TableCell className="px-1 text-center">
                      {row.processingType === 'PRINTING' && row.costInputMode !== 'LANDED_PRICE' ? (
                        <Input
                          type="number"
                          min="1"
                          max="20"
                          className="w-9 text-center text-xs h-7 px-0.5"
                          value={row.numberOfColors || ''}
                          onChange={(e) =>
                            updateRow(index, {
                              numberOfColors: parseInt(e.target.value) || null,
                            })
                          }
                          placeholder="#"
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </TableCell>

                    {/* Printing Type */}
                    <TableCell className="px-1 text-center">
                      {row.processingType === 'PRINTING' && row.costInputMode !== 'LANDED_PRICE' ? (
                        <Select
                          value={row.printingType || ''}
                          onValueChange={(value) => {
                            updateRow(index, {
                              printingType: value as 'PIGMENT' | 'PROCIAN' | 'DISCHARGE' | 'PIGMENT_DISCHARGE',
                              processingCostPerMeter: null,
                              slabLabel: null,
                            });
                            // Auto-lookup after printing type is selected
                            if (value && row.processorId && row.greigeId) {
                              setTimeout(() => lookupRate(index), 100);
                            }
                          }}
                        >
                          <SelectTrigger className="w-[70px] h-7 text-[10px]">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PIGMENT" className="text-xs">Pigment</SelectItem>
                            <SelectItem value="PROCIAN" className="text-xs">Procian</SelectItem>
                            <SelectItem value="DISCHARGE" className="text-xs">Discharge</SelectItem>
                            <SelectItem value="PIGMENT_DISCHARGE" className="text-xs">Pig+Dis</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </TableCell>

                    {/* Screen Type */}
                    <TableCell className="px-1 text-center">
                      {row.processingType === 'PRINTING' && row.costInputMode !== 'LANDED_PRICE' ? (
                        <Select
                          value={row.screenType || ''}
                          onValueChange={(value) =>
                            updateRow(index, {
                              screenType: value as 'ROTARY' | 'FLATBELT' | 'TABLE',
                            })
                          }
                        >
                          <SelectTrigger className="w-[65px] h-7 text-[10px]">
                            <SelectValue placeholder="Screen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ROTARY" className="text-xs">Rotary</SelectItem>
                            <SelectItem value="FLATBELT" className="text-xs">Flat Belt</SelectItem>
                            <SelectItem value="TABLE" className="text-xs">Table</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </TableCell>

                    {/* Processing Cost */}
                    <TableCell className="px-1 text-center">
                      {row.processingCostPerMeter ? (
                        <div>
                          <span className="font-medium text-xs">₹{row.processingCostPerMeter.toFixed(2)}</span>
                          {row.slabLabel && (
                            <p className="text-[9px] text-gray-500 truncate" title={row.slabLabel}>{row.slabLabel}</p>
                          )}
                        </div>
                      ) : row.costInputMode === 'LANDED_PRICE' || row.finishType === 'RAW' ? (
                        <span className="text-gray-400 text-xs">-</span>
                      ) : (
                        <span className="text-gray-400 text-[10px]">Select</span>
                      )}
                    </TableCell>

                    {/* Total Cost */}
                    <TableCell className="px-1 text-center">
                      {row.totalCostPerMeter ? (
                        <span className="font-bold text-xs">₹{row.totalCostPerMeter.toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </TableCell>
                  </TableRow>
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
