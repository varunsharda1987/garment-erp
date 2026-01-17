/**
 * Fabric Costing Page - Redesigned
 * Focus on greige processing workflow with transportation costs and processor rate card integration
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, X, Eye, ArrowLeft, Save, Loader2, Info, RefreshCw, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Combobox } from '../components/ui/combobox';
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
import type { StyleCostingStatus } from '../services/fabricCosting.service';
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
  CostingPurpose,
} from '../types/fabricCosting.types';
import { SCREEN_TYPE_LABELS, DEFAULT_SCREEN_COSTS } from '../types/fabricCosting.types';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import type { Style } from '../types/style.types';
import type { Customer } from '../types/customer.types';
import { notify } from '../lib/notify';

// Helper to validate UUID format
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

export default function FabricCostingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedStyleId = searchParams.get('styleId');

  // Selection state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [processors, setProcessors] = useState<ProcessorInfo[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedStyleId, setSelectedStyleId] = useState('');
  const [orderQuantity, setOrderQuantity] = useState<number>(1000);
  const [purpose, setPurpose] = useState<CostingPurpose>('COSTING');

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
  const [approvingRowId, setApprovingRowId] = useState<string | null>(null);
  const [isRepeatOrder, setIsRepeatOrder] = useState(false); // Track if style is repeat order
  const [styleCostingStatus, setStyleCostingStatus] = useState<Record<string, StyleCostingStatus>>({}); // Costing status for search results

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

  // Handle preselected style from URL query param (e.g., from CAD Planning page)
  useEffect(() => {
    if (preselectedStyleId && customers.length > 0) {
      // Validate UUID format before making API call
      if (!isValidUUID(preselectedStyleId)) {
        notify.warning('Invalid style ID format in URL. Please search for the style manually.');
        return;
      }

      const loadPreselectedStyle = async () => {
        try {
          const response = await styleService.getStyleById(preselectedStyleId);
          if (response) {
            setSelectedStyleId(preselectedStyleId);
            setStyleSearchQuery(
              response.styleCode + (response.styleName ? ` - ${response.styleName}` : '')
            );
            // Set customer if available
            if (response.customerName) {
              const customer = customers.find((c) => c.name === response.customerName);
              if (customer) {
                setSelectedCustomerId(customer.id);
              }
            }
          }
        } catch (error) {
          notify.error('Failed to load preselected style. It may have been deleted.');
        }
      };
      loadPreselectedStyle();
    }
  }, [preselectedStyleId, customers]);

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

        // Fetch costing status for search results
        if (response.data.length > 0) {
          const styleIds = response.data.map((s: Style) => s.id);
          const statusMap = await fabricCostingService.getStylesCostingStatus(styleIds);
          setStyleCostingStatus(statusMap);
        }
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
    setIsRepeatOrder(false); // Reset repeat order status when selecting new style

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
    setIsRepeatOrder(false); // Reset repeat order status
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

  // Fetch fabrics for selected style - extracted to useCallback so it can be called after save
  const fetchStyleFabrics = useCallback(async (preserveUserEdits = false) => {
    if (!selectedStyleId) {
      setFabricRows([]);
      return;
    }

    setIsLoadingFabrics(true);
    try {
      const response = await fabricCostingService.getStyleFabrics(selectedStyleId);

      // If preserveUserEdits is true, merge new IDs with existing row data
      if (preserveUserEdits && fabricRows.length > 0) {
        const updatedRows = fabricRows.map(existingRow => {
          // Find matching fabric from response by fabricId and width
          const matchingFabric = response.fabrics.find(
            (f: FabricForCosting) => f.fabricId === existingRow.fabricId && f.width === existingRow.width
          );
          if (matchingFabric) {
            // Find the width option that was just saved
            const savedOption = matchingFabric.widthOptions?.find(
              (opt) => opt.costingStyleId === selectedStyleId && opt.cutableWidth === existingRow.width
            );
            if (savedOption) {
              return {
                ...existingRow,
                fabricWidthCadId: savedOption.id, // Update with the new/existing ID from database
              };
            }
          }
          return existingRow;
        });
        setFabricRows(updatedRows);
        setIsLoadingFabrics(false);
        return;
      }

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

          // If we have existing costing data (from widthOptions OR directly on fabric), use it
          // The redesigned backend returns costing data directly on fabric object
          if ((existingCosting && existingCosting.totalCostPerMeter != null) || fabric.totalCostPerMeter != null) {
            // Use existingCosting from widthOptions if available, otherwise use fabric directly
            // The redesigned backend returns costing data directly on fabric object
            const cs = existingCosting || {} as any; // Costing source from widthOptions
            return {
              id: fabric.id,
              styleFabricId: fabric.styleFabricId || fabric.id, // For unique key grouping
              fabricId: fabric.fabricId,
              fabricWidthCadId: cs.id || fabric.id,
              fabricName: fabric.fabricName,
              genericFabricName: fabric.genericFabricName,
              componentName: fabric.componentName,
              cadMeters: fabric.cadMeters || 0,
              width: fabric.width || 0,
              finishType: fabric.finishType,

              // Greige reference - from saved data
              greigeId: cs.greigeId || fabric.greigeId,
              greigeName: cs.greigeName || fabric.greigeName,
              greigeCode: cs.greigeCode || fabric.greigeCode,
              greigeDefaultCost: fabric.greigeDefaultCost,

              // Ready fabric cost from fabric_master
              readyFabricCost: fabric.readyFabricCost,

              // Cost input mode from saved data
              costInputMode: ((cs.costInputMode || (fabric as any).costInputMode) as CostInputMode) || 'BUILD_UP',

              // Landed price mode
              landedPricePerMeter: (cs.costInputMode || (fabric as any).costInputMode) === 'LANDED_PRICE'
                ? (cs.totalCostPerMeter || fabric.totalCostPerMeter)
                : null,

              // Build-up mode - Greige & Transport (from saved data)
              greigeCostPerMeter: cs.greigeCostPerMeter || fabric.greigeCostPerMeterSaved || fabric.greigeCostPerMeter || fabric.greigeDefaultCost,
              greigeCostSource: (cs.greigeCostPerMeter || fabric.greigeCostPerMeterSaved) ? 'MANUAL' : (fabric.greigeDefaultCost ? 'GREIGE_MASTER' : 'MANUAL'),
              transportCostMode: 'PER_METER' as TransportCostMode,
              transportCostPerMeter: cs.transportCostPerMeter ?? fabric.transportCostPerMeter ?? 2, // Default ₹2/m
              transportFixedAmount: null,

              // Shrinkage (from saved data, fallback to API which includes greige master default)
              shrinkagePercent: cs.shrinkagePercent ?? fabric.shrinkagePercent,
              shrinkageValue: cs.shrinkageCostPerMeter,

              // Processor selection (from saved data or fabric directly)
              processorId: cs.processorId || fabric.processorId,
              processorName: cs.processorName || fabric.processorName,
              processingType: fabric.finishType === 'PRINTED' ? 'PRINTING' :
                              (fabric.finishType === 'DYED' || fabric.finishType === 'YARN_DYED') ? 'DYEING' : null,
              printingType: null,
              processingCostPerMeter: cs.processingPricePerMeter || fabric.processingPricePerMeter,
              slabLabel: null,
              rateCardId: null,

              // Screen cost (from saved data or fabric directly)
              numberOfColors: cs.numberOfColors || fabric.numberOfColors,
              screenType: (cs.screenType || fabric.screenType) as ScreenType | null,
              screenCostPerScreen: null,
              screenCostTotal: null,
              screenCostPerMeter: cs.screenCostPerMeter,

              // Calculated totals (from saved data or fabric directly)
              totalCostPerMeter: cs.totalCostPerMeter || fabric.totalCostPerMeter,
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
          styleFabricId: fabric.styleFabricId || fabric.id, // For unique key grouping
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
          // Use saved greigeCostPerMeter, then stock cost, then default cost
          greigeCostPerMeter: fabric.greigeCostPerMeterSaved || fabric.greigeCostPerMeter || fabric.greigeDefaultCost,
          greigeCostSource: fabric.greigeCostPerMeterSaved ? 'MANUAL' : (fabric.greigeCostSource || (fabric.greigeDefaultCost ? 'GREIGE_MASTER' : 'MANUAL')),
          transportCostMode: 'PER_METER' as TransportCostMode,
          transportCostPerMeter: fabric.transportCostPerMeter ?? 2, // Use saved or default ₹2/m
          transportFixedAmount: null,

          // Shrinkage - use API response which includes greige master fallback
          shrinkagePercent: fabric.shrinkagePercent || null,
          shrinkageValue: null,

          // Processor selection - use API response if available (from saved CAD data)
          processorId: fabric.processorId || null,
          processorName: fabric.processorName || null,
          processingType: fabric.finishType === 'PRINTED' ? 'PRINTING' :
                          (fabric.finishType === 'DYED' || fabric.finishType === 'YARN_DYED') ? 'DYEING' : null,
          printingType: null,
          processingCostPerMeter: fabric.processingPricePerMeter || null,
          slabLabel: null,
          rateCardId: null,

          // Screen cost - use API response if available
          numberOfColors: fabric.numberOfColors,
          screenType: (fabric.screenType as ScreenType) || null,
          screenCostPerScreen: null,
          screenCostTotal: null,
          screenCostPerMeter: null,

          // Calculated totals - use API response if available
          totalCostPerMeter: fabric.totalCostPerMeter || null,
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
  }, [selectedStyleId, fabricRows.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Call fetchStyleFabrics when selectedStyleId changes
  useEffect(() => {
    fetchStyleFabrics(false);
  }, [selectedStyleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate cost per meter for a row
  // Note: totalCostForQuantity is kept for internal calculations (screen cost amortization)
  // but is NOT displayed to users - this page only shows ₹/m
  const calculateRowTotals = useCallback((row: FabricCostingRow): FabricCostingRow => {
    // Use row-level quantity if set, otherwise fall back to global orderQuantity
    const rowQty = (row as any).rowQuantity || orderQuantity;
    const totalQuantity = row.cadMeters * rowQty;

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
  // overrides: optional partial row data for values not yet committed to state
  const lookupRate = async (index: number, overrides?: Partial<FabricCostingRow>) => {
    const baseRow = fabricRows[index];
    const row = overrides ? { ...baseRow, ...overrides } : baseRow;

    if (!row.processorId || !row.processingType || !row.greigeId) {
      notify.warning('Please select a processor and ensure greige is set');
      return;
    }

    // For PRINTING, we need printingType
    if (row.processingType === 'PRINTING' && !row.printingType) {
      notify.warning('Please select a printing type');
      return;
    }

    // Use row-level quantity if set, otherwise fall back to global orderQuantity
    const rowQty = (row as any).rowQuantity || orderQuantity;
    const totalQuantity = row.cadMeters * rowQty;
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
      // Extract error message and debug info from backend response
      const errorMessage = error.response?.data?.error || error.message || 'Failed to lookup rate';
      const debugInfo = error.response?.data?.debug;

      updateRow(index, {
        isLoading: false,
        error: errorMessage,
      });

      // Show detailed error
      notify.error(errorMessage || 'Failed to lookup rate');
    }
  };

  // Save fabric costing - saves to fabric_width_cad
  const handleSave = async () => {
    if (!selectedStyleId) {
      notify.error('Please select a style first');
      return;
    }

    // Save rows that have a calculated cost (fabricId is optional - supports generic fabrics)
    const rowsToSave = fabricRows.filter(row => row.totalCostPerMeter != null);

    if (rowsToSave.length === 0) {
      notify.warning('No fabrics with calculated costs to save');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fabricCostingService.saveFabricCosting({
        styleId: selectedStyleId,
        fabricCostings: rowsToSave.map(row => ({
          // fabric_width_cad identification
          fabricWidthCadId: row.fabricWidthCadId,
          styleFabricId: row.styleFabricId, // For unique key (multi-fabric same-component support)
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
          // Order quantity used for slab rate lookup (use row-level if set)
          orderQuantityPcs: (row as any).rowQuantity || orderQuantity,
          // CAD consumption per piece (for fabric quantity calculation)
          cadMeters: row.cadMeters,
          // Workflow purpose mode
          purpose: purpose,
        })),
      });

      // Update repeat order status from backend response
      if (response.isRepeatOrder) {
        setIsRepeatOrder(true);
        notify.info('Repeat Order: Costings saved directly to PRODUCTION mode');
      }

      notify.success(`Saved costing for ${rowsToSave.length} fabric(s) to fabric_width_cad`);
      // Re-fetch with preserveUserEdits to get the new fabricWidthCadIds from database
      // This enables the Approve button which requires fabricWidthCadId
      await fetchStyleFabrics(true);
    } catch (error: any) {
      notify.error(error.response?.data?.error || 'Failed to save fabric costing');
    } finally {
      setIsSaving(false);
    }
  };

  // Approve a single row's costing option
  const handleApproveRow = async (row: FabricCostingRow) => {
    if (!row.fabricWidthCadId) {
      notify.warning('Save the costing first before approving');
      return;
    }

    setApprovingRowId(row.id);
    try {
      await fabricCostingService.approveCostingOption(row.fabricWidthCadId);
      notify.success('Costing option approved');
    } catch (error: any) {
      notify.error(error.response?.data?.error || 'Failed to approve');
    } finally {
      setApprovingRowId(null);
    }
  };

  // Count fabrics with calculated costs
  const fabricsWithCosts = fabricRows.filter(row => row.totalCostPerMeter != null).length;

  // Group rows by greigeId only for subtotals (all widths of same greige grouped together)
  const groupedRows = React.useMemo(() => {
    const groups: Record<string, { rows: FabricCostingRow[]; greigeId: string; greigeName: string }> = {};

    fabricRows.forEach((row, index) => {
      // Group by greigeId only (not width) so same greige at different widths are grouped together
      const greigeId = row.greigeId || 'no-greige';
      const key = greigeId;

      if (!groups[key]) {
        groups[key] = {
          rows: [],
          greigeId,
          greigeName: row.greigeName || row.fabricName || 'Unknown',
        };
      }
      groups[key].rows.push({ ...row, _originalIndex: index } as FabricCostingRow & { _originalIndex: number });
    });

    return groups;
  }, [fabricRows]);

  // Calculate subtotals for a group of rows
  const calculateGroupSubtotals = (rows: FabricCostingRow[]) => {
    let totalCadMeters = 0;
    let totalRowCost = 0;
    let totalFabricReq = 0;
    let totalGreigeReq = 0;
    let hasAnyCost = false;

    rows.forEach((row) => {
      totalCadMeters += row.cadMeters || 0;

      const qty = (row as any).rowQuantity || orderQuantity;
      const fabricReq = row.cadMeters * qty;
      totalFabricReq += fabricReq;

      const shrinkage = row.shrinkagePercent || 0;
      const greigeReq = shrinkage > 0 ? fabricReq / (1 - shrinkage / 100) : fabricReq;
      totalGreigeReq += greigeReq;

      if (row.totalCostPerMeter && row.cadMeters > 0) {
        totalRowCost += row.cadMeters * row.totalCostPerMeter;
        hasAnyCost = true;
      }
    });

    return {
      totalCadMeters,
      totalRowCost: hasAnyCost ? totalRowCost : null,
      totalFabricReq,
      totalGreigeReq,
    };
  };

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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/fabric-costing/options')}>
            <Eye className="w-4 h-4 mr-2" />
            View All Options
          </Button>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </div>

      {/* Purpose Mode Tabs */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm font-medium text-gray-700">Mode:</span>
        <Tabs value={purpose} onValueChange={(val) => setPurpose(val as CostingPurpose)}>
          <TabsList>
            <TabsTrigger value="COSTING" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700">
              Costing
            </TabsTrigger>
            <TabsTrigger value="RAW_MATERIAL_CALCULATION" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-700">
              Raw Mat Calculation
            </TabsTrigger>
            <TabsTrigger value="PRODUCTION" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-700">
              Production
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="text-xs text-gray-500">
          {purpose === 'COSTING' && 'Style costing for quotations'}
          {purpose === 'RAW_MATERIAL_CALCULATION' && 'MRP for confirmed orders'}
          {purpose === 'PRODUCTION' && 'Final costings locked for production'}
        </span>
        {isRepeatOrder && (
          <Badge variant="outline" className="ml-2 bg-amber-50 text-amber-700 border-amber-300">
            Repeat Order
          </Badge>
        )}
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
                {styleSearchResults.map((style) => {
                  const status = styleCostingStatus[style.id];
                  return (
                    <div
                      key={style.id}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                      onClick={() => handleSearchResultSelect(style)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">{style.styleCode}</div>
                        {/* Costing Status Badge */}
                        {status && (
                          <div className="flex items-center gap-1">
                            {status.hasProduction && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-300">
                                Costed
                              </Badge>
                            )}
                            {!status.hasProduction && status.hasApproved && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-300">
                                Approved
                              </Badge>
                            )}
                            {!status.hasProduction && !status.hasApproved && status.hasPending && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-300">
                                Pending
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {style.styleName && <span>{style.styleName} • </span>}
                        {style.customerName || 'No Customer'}
                        {status?.costingCount ? ` • ${status.costingCount} option(s)` : ''}
                      </div>
                    </div>
                  );
                })}
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

          <div className="flex items-end gap-2">
            <Button
              onClick={handleSave}
              disabled={isSaving || fabricRows.length === 0}
              className="flex-1"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Costing
            </Button>
            {selectedStyleId && (
              <Button
                variant="outline"
                onClick={() => navigate(`/fabric-costing/style/${selectedStyleId}`)}
                title="View all costing options for this style"
              >
                <Eye className="w-4 h-4 mr-1" />
                Options
              </Button>
            )}
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
                <TableHead className="w-[60px] px-1 text-center text-xs">Qty (pcs)</TableHead>
                <TableHead className="w-[55px] px-1 text-center text-xs whitespace-nowrap">Cutable Width</TableHead>
                <TableHead className="w-[42px] px-1 text-center text-xs">Finish</TableHead>
                <TableHead className="w-[48px] px-1 text-center text-xs">Mode</TableHead>
                <TableHead className="w-[75px] px-1 text-center text-xs whitespace-normal leading-tight">Greige +Trp (₹/m)</TableHead>
                <TableHead className="w-[170px] px-1 text-center text-xs">Processor</TableHead>
                <TableHead className="w-[55px] px-1 text-center text-xs">Colors</TableHead>
                <TableHead className="w-[85px] px-1 text-center text-xs">Print Type</TableHead>
                <TableHead className="w-[80px] px-1 text-center text-xs">Screen</TableHead>
                <TableHead className="w-[85px] px-1 text-center text-xs whitespace-normal leading-tight">Process (₹/m)</TableHead>
                <TableHead className="w-[70px] px-1 text-center text-xs font-semibold whitespace-normal leading-tight">Total (₹/m)</TableHead>
                <TableHead className="w-[70px] px-1 text-center text-xs whitespace-normal leading-tight">Part Cost (₹)</TableHead>
                <TableHead className="w-[70px] px-1 text-center text-xs whitespace-normal leading-tight">Fabric Req (m)</TableHead>
                <TableHead className="w-[70px] px-1 text-center text-xs whitespace-normal leading-tight">Greige Req (m)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(groupedRows).map(([groupKey, group]) => {
                const subtotals = calculateGroupSubtotals(group.rows);
                const showSubtotal = group.rows.length > 1 || Object.keys(groupedRows).length > 1;

                return (
                  <React.Fragment key={groupKey}>
                    {/* Render rows in this group */}
                    {group.rows.map((row) => {
                      const index = (row as any)._originalIndex;
                      return (
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
                        {/* Show greige code for reference - helps verify correct greige is selected */}
                        {row.greigeCode && (
                          <p className="text-[9px] text-gray-400 truncate" title={`Greige Code: ${row.greigeCode}`}>
                            {row.greigeCode}
                          </p>
                        )}
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

                    {/* Row Quantity */}
                    <TableCell className="px-1 text-center">
                      <Input
                        type="number"
                        min="1"
                        className="w-20 text-center text-xs h-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={(row as any).rowQuantity || orderQuantity}
                        onChange={(e) =>
                          updateRow(index, {
                            rowQuantity: parseInt(e.target.value) || 1,
                          } as any)
                        }
                      />
                    </TableCell>

                    {/* Cutable Width */}
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
                            className="w-16 text-center text-xs h-7 px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                              className={`w-14 text-center text-xs h-6 px-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${row.greigeCostSource === 'MANUAL' ? 'border-amber-400 bg-amber-50' : ''}`}
                              value={row.greigeCostPerMeter || ''}
                              onChange={(e) =>
                                updateRow(index, {
                                  greigeCostPerMeter: parseFloat(e.target.value) || null,
                                  greigeCostSource: 'MANUAL',
                                })
                              }
                              title={
                                row.greigeCostSource === 'MANUAL' ? 'Manual price - click (R) to reset to default' :
                                row.greigeCostSource === 'GREIGE_PROCUREMENT' ? `Stock price ₹${row.greigeDefaultCost}/m` :
                                `Default price ₹${row.greigeDefaultCost}/m`
                              }
                            />
                            {row.greigeCostSource === 'GREIGE_PROCUREMENT' && (
                              <span className="text-[9px] text-green-600 font-medium" title="Using greige stock cost from latest procurement">S</span>
                            )}
                            {row.greigeCostSource === 'GREIGE_MASTER' && (
                              <span className="text-[9px] text-blue-600" title="Using default greige cost from greige master">D</span>
                            )}
                            {row.greigeCostSource === 'MANUAL' && (
                              <span
                                className="text-[9px] text-amber-600 font-medium cursor-pointer hover:text-amber-800"
                                title={`Manual price - Click to reset to ${row.greigeDefaultCost ? `₹${row.greigeDefaultCost}/m` : 'default'}`}
                                onClick={() => updateRow(index, {
                                  greigeCostPerMeter: row.greigeDefaultCost,
                                  greigeCostSource: row.greigeDefaultCost ? 'GREIGE_MASTER' : 'MANUAL',
                                })}
                              >
                                M
                              </span>
                            )}
                          </div>
                          {/* Transport Cost */}
                          <div className="flex items-center gap-0.5">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="+Trp"
                              className="w-14 text-center text-xs h-6 px-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                          <Combobox
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

                              // Auto-lookup rates for DYEING (no printing type needed)
                              // For PRINTING, wait until printing type is selected
                              if (row.processingType === 'DYEING' && value && row.greigeId) {
                                // Pass the new processorId as override since state hasn't updated yet
                                lookupRate(index, { processorId: value });
                              }
                            }}
                            options={processors.map((p) => ({ value: p.id, label: p.name }))}
                            placeholder="Select"
                            searchPlaceholder="Search processor..."
                            emptyText="No processors found"
                            className="w-[150px] h-7 text-[10px]"
                            hideChevron
                          />
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
                          className="w-9 text-center text-xs h-7 px-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                            const newPrintingType = value as 'PIGMENT' | 'PROCIAN' | 'DISCHARGE' | 'PIGMENT_DISCHARGE';
                            updateRow(index, {
                              printingType: newPrintingType,
                              processingCostPerMeter: null,
                              slabLabel: null,
                            });
                            // Auto-lookup after printing type is selected
                            if (value && row.processorId && row.greigeId) {
                              // Pass the new printingType as override since state hasn't updated yet
                              lookupRate(index, { printingType: newPrintingType });
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

                    {/* Part Cost (CAD × Total ₹/m) */}
                    <TableCell className="px-1 text-center">
                      {row.totalCostPerMeter && row.cadMeters > 0 ? (
                        <span className="text-xs">₹{(row.cadMeters * row.totalCostPerMeter).toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </TableCell>

                    {/* Fabric Requirement (CAD × Qty) */}
                    <TableCell className="px-1 text-center">
                      {row.cadMeters > 0 ? (
                        <span className="text-xs">
                          {(((row as any).rowQuantity || orderQuantity) * row.cadMeters).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </TableCell>

                    {/* Greige Requirement (Fabric Req ÷ (1 - Shrinkage%)) */}
                    <TableCell className="px-1 text-center">
                      {row.cadMeters > 0 ? (() => {
                        const qty = (row as any).rowQuantity || orderQuantity;
                        const fabricReq = row.cadMeters * qty;
                        const shrinkage = row.shrinkagePercent || 0;
                        const greigeReq = shrinkage > 0 ? fabricReq / (1 - shrinkage / 100) : fabricReq;
                        return <span className="text-xs">{greigeReq.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>;
                      })() : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </TableCell>

                    </TableRow>
                  </React.Fragment>
                );
              })}

                    {/* Subtotal Row for this greige group */}
                    {showSubtotal && (
                      <TableRow className="bg-blue-50 font-medium border-t-2 border-blue-200">
                        <TableCell className="px-1" colSpan={2}>
                          <span className="text-xs font-semibold text-blue-800">
                            Subtotal: {group.greigeName}
                          </span>
                        </TableCell>
                        <TableCell className="px-1 text-center">
                          <span className="text-xs font-semibold text-blue-800">
                            {subtotals.totalCadMeters.toFixed(3)}
                          </span>
                        </TableCell>
                        <TableCell colSpan={9} className="px-1"></TableCell>
                        <TableCell className="px-1 text-center">
                          {subtotals.totalRowCost !== null ? (
                            <span className="text-xs font-bold text-blue-800">
                              ₹{subtotals.totalRowCost.toFixed(2)}/pc
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="px-1 text-center">
                          <span className="text-xs font-semibold text-blue-800">
                            {subtotals.totalFabricReq.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </TableCell>
                        <TableCell className="px-1 text-center">
                          <span className="text-xs font-semibold text-blue-800">
                            {subtotals.totalGreigeReq.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>

          {/* Summary Footer */}
          <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {fabricRows.length} fabric{fabricRows.length !== 1 ? 's' : ''} •
              {fabricsWithCosts} with cost calculated
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-sm text-gray-500">
                <Info className="w-4 h-4" />
                Cost per meter will be used in Cost Sheet calculation
              </span>
              {selectedStyleId && fabricsWithCosts > 0 && purpose === 'COSTING' && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate(`/cost-sheets/new?styleId=${selectedStyleId}`)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Create Cost Sheet
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
