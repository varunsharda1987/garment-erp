/**
 * Fabric Costing Page - Redesigned
 * Focus on greige processing workflow with transportation costs and processor rate card integration
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, X, Eye, ArrowLeft, Save, Loader2, Info, RefreshCw, FileText, AlertCircle, Clock } from 'lucide-react';
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
import { colorService } from '../services/colorService';
import type { ColorSearchResult } from '../types/color.types';
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
  const [orderQuantity, setOrderQuantity] = useState<number>(0);
  const [previousQuantity, setPreviousQuantity] = useState<number | null>(null);
  const [purpose, setPurpose] = useState<CostingPurpose>('COSTING');

  // Fabric rows
  const [fabricRows, setFabricRows] = useState<FabricCostingRow[]>([]);

  // Global colors for processing batch grouping
  const [globalColors, setGlobalColors] = useState<ColorSearchResult[]>([]);

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
  const [showStyleOptionsButton, setShowStyleOptionsButton] = useState(false); // Show "View Style Options" button after save
  const [styleCostingStatus, setStyleCostingStatus] = useState<Record<string, StyleCostingStatus>>({}); // Costing status for search results

  // CAD validation state
  const [hasCADData, setHasCADData] = useState(true);
  const [isValidatingCAD, setIsValidatingCAD] = useState(false);

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

  // Fetch global colors for batch grouping on mount
  useEffect(() => {
    const fetchColors = async () => {
      try {
        const colors = await colorService.search({ limit: 500 });
        console.log('[FabricCosting] Global colors loaded:', colors?.length, colors);
        setGlobalColors(colors || []);
      } catch (error) {
        console.error('Failed to load global colors:', error);
      }
    };
    fetchColors();
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
    setPreviousQuantity(null); // Reset previous quantity indicator
    setOrderQuantity(0); // Reset order quantity for new style (will be loaded from saved data)

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
    setPreviousQuantity(null); // Reset previous quantity indicator
    setOrderQuantity(0); // Reset order quantity
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
      const response = await fabricCostingService.getStyleFabrics(selectedStyleId, purpose);

      // If preserveUserEdits is true, merge new IDs with existing row data
      // This preserves user's edits while updating fabricWidthCadId from saved records
      if (preserveUserEdits && fabricRows.length > 0) {
        const updatedRows = fabricRows.map(existingRow => {
          // Find matching fabric from response by id (the cadRow.id which becomes fabricWidthCadId)
          // The backend returns data directly on fabric objects, not in widthOptions
          const matchingFabric = response.fabrics.find(
            (f: FabricForCosting) => f.id === existingRow.id
          );
          if (matchingFabric) {
            return {
              ...existingRow,
              fabricWidthCadId: matchingFabric.id, // Update with the saved ID from database
            };
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
              savedOrderQuantityPcs: fabric.orderQuantityPcs || null, // Track saved quantity for clone detection
              rowQuantity: fabric.orderQuantityPcs || undefined, // Pre-populate Qty column with saved quantity
              createdAt: fabric.createdAt || null, // Timestamp for date-based grouping
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

              // Processing batch group (from saved data)
              processingBatchGroupColorId: (fabric as any).processingBatchGroupColorId || null,
              processingBatchGroupColorName: null, // Will be resolved from colorOptions
              batchRate: null,
              individualRate: null,
              batchSavings: null,
              batchGroupTotalQuantity: null,

              // UI state
              isExpanded: false,
              isLoading: false,
              error: null,
            };
          }

          // No existing costing, create default row
          // CAD rows have id (cadRow.id) ≠ styleFabricId, legacy rows have id = styleFabricId
          const isCadRow = fabric.id !== (fabric.styleFabricId || fabric.id);
          return {
          id: fabric.id,
          styleFabricId: fabric.styleFabricId || fabric.id, // For unique key grouping
          fabricId: fabric.fabricId,
          fabricWidthCadId: isCadRow ? fabric.id : null, // Use fabric.id for CAD rows (it's the cadRow.id)
          savedOrderQuantityPcs: null, // No saved quantity for new rows
          rowQuantity: undefined, // Will use global orderQuantity
          createdAt: null, // New row, not yet saved
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

          // Processing batch group
          processingBatchGroupColorId: (fabric as any).processingBatchGroupColorId || null,
          processingBatchGroupColorName: null,
          batchRate: null,
          individualRate: null,
          batchSavings: null,
          batchGroupTotalQuantity: null,

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

        // Extract orderQuantityPcs from loaded fabrics - use MOST RECENT by createdAt
        const fabricsWithQuantity = response.fabrics
          .filter((f: FabricForCosting) => f.orderQuantityPcs != null && f.orderQuantityPcs > 0)
          .sort((a: FabricForCosting, b: FabricForCosting) => {
            // Sort by createdAt descending (most recent first)
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });

        if (fabricsWithQuantity.length > 0) {
          const mostRecentQuantity = fabricsWithQuantity[0].orderQuantityPcs!;
          setPreviousQuantity(mostRecentQuantity);

          // Only set if current orderQuantity is 0 (not already entered by user)
          if (orderQuantity === 0) {
            setOrderQuantity(mostRecentQuantity);
          }

          // Info if different quantities exist (e.g., 500 pcs and 1000 pcs options)
          const uniqueQuantities = [...new Set(fabricsWithQuantity.map(f => f.orderQuantityPcs))];
          if (uniqueQuantities.length > 1) {
            notify.info(
              `Multiple quantity options found: ${uniqueQuantities.join(', ')} pcs. ` +
              `Loading most recent: ${mostRecentQuantity} pcs.`
            );
          }
        } else {
          setPreviousQuantity(null);
        }

        notify.success(`Loaded ${rowsWithTotals.length} fabrics from style`);
      } catch (error) {
        notify.error('Failed to load style fabrics');
      } finally {
        setIsLoadingFabrics(false);
      }
  }, [selectedStyleId, fabricRows.length, purpose]); // eslint-disable-line react-hooks/exhaustive-deps

  // Validate if style has CAD data from CAD Planning
  const validateCADData = useCallback(async () => {
    if (!selectedStyleId) {
      setHasCADData(true);
      return;
    }

    setIsValidatingCAD(true);
    try {
      const validation = await fabricCostingService.validateStyleCADData(selectedStyleId, purpose);
      setHasCADData(validation.hasCADData);

      if (!validation.hasCADData) {
        notify.warning('This style has no CAD data. Please create CAD data in CAD Planning first.');
      }
    } catch (error) {
      console.error('Failed to validate CAD data:', error);
      // Assume CAD data exists if validation fails (don't block user)
      setHasCADData(true);
    } finally {
      setIsValidatingCAD(false);
    }
  }, [selectedStyleId, purpose]);

  // Call fetchStyleFabrics and validate CAD when selectedStyleId or purpose changes
  useEffect(() => {
    // Reset the "View Style Options" button when style/purpose changes
    setShowStyleOptionsButton(false);
    if (selectedStyleId) {
      validateCADData();
      fetchStyleFabrics(false);
    }
  }, [selectedStyleId, purpose]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const rowQuantityMeters = row.cadMeters * rowQty;
    if (rowQuantityMeters <= 0) {
      notify.warning('Order quantity must be greater than 0');
      return;
    }

    // Check if this row is part of a processing batch group
    const hasBatchGroup = row.processingBatchGroupColorId != null;
    let batchQuantityMeters = rowQuantityMeters;

    if (hasBatchGroup) {
      // Calculate combined quantity for all rows in this batch group
      // Batch key: same greigeId + same processorId + same batch color
      batchQuantityMeters = fabricRows.reduce((sum, r) => {
        if (
          r.greigeId === row.greigeId &&
          r.processorId === row.processorId &&
          r.processingBatchGroupColorId === row.processingBatchGroupColorId
        ) {
          const rQty = (r as any).rowQuantity || orderQuantity;
          return sum + (r.cadMeters * rQty);
        }
        return sum;
      }, 0);
    }

    updateRow(index, { isLoading: true, error: null });

    try {
      // Lookup rate using batch (combined) quantity if in a batch group, else individual
      const result = await fabricCostingService.lookupRate({
        processorId: row.processorId,
        processingType: row.processingType,
        printingType: row.printingType || undefined,
        greigeId: row.greigeId,
        quantityMeters: hasBatchGroup ? batchQuantityMeters : rowQuantityMeters,
      });

      // Also lookup individual rate for comparison when in a batch group
      let individualResult: ProcessorRateLookup | null = null;
      if (hasBatchGroup && batchQuantityMeters !== rowQuantityMeters) {
        try {
          individualResult = await fabricCostingService.lookupRate({
            processorId: row.processorId,
            processingType: row.processingType,
            printingType: row.printingType || undefined,
            greigeId: row.greigeId,
            quantityMeters: rowQuantityMeters,
          });
        } catch {
          // Individual lookup failure is not critical
        }
      }

      if (result) {
        const batchRate = result.ratePerMeter;
        const indivRate = individualResult?.ratePerMeter ?? null;
        const savings = indivRate != null ? indivRate - batchRate : null;

        // Update THIS row
        updateRow(index, {
          processingCostPerMeter: batchRate,
          slabLabel: result.slabLabel,
          rateCardId: result.id,
          processorName: result.processorName,
          shrinkagePercent: result.shrinkagePercent,
          screenCostPerScreen: result.screenCostPerScreen,
          batchRate: hasBatchGroup ? batchRate : null,
          individualRate: indivRate,
          batchSavings: savings,
          batchGroupTotalQuantity: hasBatchGroup ? batchQuantityMeters : null,
          isLoading: false,
        });

        // If batch group, also update ALL OTHER rows in the same batch
        if (hasBatchGroup) {
          fabricRows.forEach((r, i) => {
            if (
              i !== index &&
              r.greigeId === row.greigeId &&
              r.processorId === row.processorId &&
              r.processingBatchGroupColorId === row.processingBatchGroupColorId
            ) {
              // Calculate this row's individual quantity for comparison
              const otherRowQty = (r as any).rowQuantity || orderQuantity;
              const otherRowMeters = r.cadMeters * otherRowQty;

              // Lookup individual rate for this row asynchronously
              fabricCostingService.lookupRate({
                processorId: r.processorId!,
                processingType: r.processingType!,
                printingType: r.printingType || undefined,
                greigeId: r.greigeId!,
                quantityMeters: otherRowMeters,
              }).then(otherIndivResult => {
                const otherIndivRate = otherIndivResult?.ratePerMeter ?? null;
                const otherSavings = otherIndivRate != null ? otherIndivRate - batchRate : null;
                updateRow(i, {
                  processingCostPerMeter: batchRate,
                  slabLabel: result.slabLabel,
                  shrinkagePercent: result.shrinkagePercent,
                  screenCostPerScreen: result.screenCostPerScreen,
                  batchRate: batchRate,
                  individualRate: otherIndivRate,
                  batchSavings: otherSavings,
                  batchGroupTotalQuantity: batchQuantityMeters,
                });
              }).catch(() => {
                // Still apply batch rate even if individual lookup fails
                updateRow(i, {
                  processingCostPerMeter: batchRate,
                  slabLabel: result.slabLabel,
                  shrinkagePercent: result.shrinkagePercent,
                  batchRate: batchRate,
                  individualRate: null,
                  batchSavings: null,
                  batchGroupTotalQuantity: batchQuantityMeters,
                });
              });
            }
          });

          notify.success(`Batch rate loaded: ₹${batchRate}/m for ${batchQuantityMeters.toFixed(0)}m combined (${result.slabLabel})`);
        } else {
          notify.success(`Rate loaded: ₹${result.ratePerMeter}/m (${result.slabLabel})`);
        }
      } else {
        updateRow(index, {
          processingCostPerMeter: null,
          slabLabel: null,
          rateCardId: null,
          shrinkagePercent: null,
          screenCostPerScreen: null,
          batchRate: null,
          individualRate: null,
          batchSavings: null,
          batchGroupTotalQuantity: null,
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
        fabricCostings: rowsToSave.map(row => {
          // Detect quantity change: if saved quantity exists and current quantity is different, clone instead of update
          const currentQty = (row as any).rowQuantity ?? orderQuantity ?? 0;
          const savedQty = row.savedOrderQuantityPcs;
          const quantityChanged = savedQty != null && savedQty > 0 && currentQty !== savedQty && currentQty > 0;

          return {
          // fabric_width_cad identification - clone mode if quantity changed
          fabricWidthCadId: quantityChanged ? null : row.fabricWidthCadId,
          cloneFromCadId: quantityChanged ? row.fabricWidthCadId : undefined,
          styleFabricId: row.styleFabricId, // For unique key (multi-fabric same-component support)
          fabricId: row.fabricId,
          // NOTE: cutableWidth and componentName are CAD-owned fields - don't send them
          // They are managed by CAD Planning module only
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
          // Use nullish coalescing (??) to preserve 0 as a valid value
          orderQuantityPcs: (row as any).rowQuantity ?? orderQuantity ?? 0,
          // NOTE: cadMeters is CAD-owned - don't send it (managed by CAD Planning)
          // Workflow purpose mode
          purpose: purpose,
          // Processing batch group
          processingBatchGroupColorId: row.processingBatchGroupColorId || null,
        };
        }),
      });

      // Update repeat order status from backend response
      if (response.isRepeatOrder) {
        setIsRepeatOrder(true);
        notify.info('Repeat Order: Costings saved directly to PRODUCTION mode');
      }

      notify.success(`Saved costing for ${rowsToSave.length} fabric(s) to fabric_width_cad`);
      // Show the "View Style Options" button after successful save
      setShowStyleOptionsButton(true);
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

  // Nested grouping: Date → Quantity → Greige (for visual organization)
  const nestedGroups = React.useMemo(() => {
    // Step 1: Group by createdAt date
    const byDate: Record<string, FabricCostingRow[]> = {};
    fabricRows.forEach((row, index) => {
      const dateKey = row.createdAt
        ? new Date(row.createdAt).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }) + ' ' + new Date(row.createdAt).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'New (Unsaved)';

      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push({ ...row, _originalIndex: index } as FabricCostingRow & { _originalIndex: number });
    });

    // Step 2: Within each date, group by quantity
    const result = Object.entries(byDate).map(([dateKey, dateRows]) => {
      const byQty: Record<string, (FabricCostingRow & { _originalIndex: number })[]> = {};
      dateRows.forEach((row) => {
        const qty = row.rowQuantity ?? row.savedOrderQuantityPcs ?? 0;
        const qtyKey = qty > 0 ? qty.toString() : 'No Qty';
        if (!byQty[qtyKey]) byQty[qtyKey] = [];
        byQty[qtyKey].push(row);
      });

      // Step 3: Within each quantity, group by greige (for subtotals)
      const quantityGroups = Object.entries(byQty).map(([qtyKey, qtyRows]) => {
        const byGreige: Record<string, { rows: (FabricCostingRow & { _originalIndex: number })[]; greigeId: string; greigeName: string }> = {};
        qtyRows.forEach((row) => {
          const greigeId = row.greigeId || 'no-greige';
          if (!byGreige[greigeId]) {
            byGreige[greigeId] = {
              rows: [],
              greigeId,
              greigeName: row.greigeName || row.fabricName || 'Unknown',
            };
          }
          byGreige[greigeId].rows.push(row);
        });
        return { qtyKey, qtyValue: qtyKey === 'No Qty' ? 0 : Number(qtyKey), greigeGroups: byGreige, totalRows: qtyRows.length };
      });

      // Sort quantities descending (largest first, "No Qty" last)
      quantityGroups.sort((a, b) => {
        if (a.qtyKey === 'No Qty') return 1;
        if (b.qtyKey === 'No Qty') return -1;
        return b.qtyValue - a.qtyValue;
      });

      return { dateKey, quantityGroups, totalRows: dateRows.length };
    });

    // Sort dates: "New (Unsaved)" first, then most recent first
    result.sort((a, b) => {
      if (a.dateKey === 'New (Unsaved)') return -1;
      if (b.dateKey === 'New (Unsaved)') return 1;
      // Parse back to compare timestamps
      const parseDate = (str: string) => {
        try {
          const [datePart, timePart] = str.split(' ');
          return new Date(`${datePart} ${timePart}`).getTime();
        } catch {
          return 0;
        }
      };
      return parseDate(b.dateKey) - parseDate(a.dateKey);
    });

    return result;
  }, [fabricRows]);

  // Check if we need to show nested grouping headers (only when multiple dates or quantities exist)
  const hasMultipleDateGroups = nestedGroups.length > 1;
  const hasMultipleQtyGroups = nestedGroups.some(dg => dg.quantityGroups.length > 1);
  const showNestedGrouping = hasMultipleDateGroups || hasMultipleQtyGroups;

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
          <Button variant="outline" onClick={() => navigate(selectedStyleId ? `/fabric-costing/options?styleId=${selectedStyleId}` : '/fabric-costing/options')}>
            <Eye className="w-4 h-4 mr-2" />
            View All Options
          </Button>
          <Button variant="outline" onClick={() => {
            // Fallback to fabric-costing page if history is empty
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/fabric-costing');
            }
          }}>
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

          <div>
            <Label className="text-sm font-medium mb-2 block">
              Order Quantity (pcs)
              {previousQuantity && previousQuantity !== orderQuantity && (
                <span className="ml-2 text-xs text-gray-500 font-normal">
                  (Previous: {previousQuantity.toLocaleString()})
                </span>
              )}
            </Label>
            <Input
              type="number"
              min="1"
              value={orderQuantity || ''}
              onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 0)}
              placeholder="e.g., 1000"
              className="w-full"
            />
            {previousQuantity && previousQuantity !== orderQuantity && (
              <p className="text-xs text-amber-600 mt-1">
                Quantity changed from previous costing ({previousQuantity.toLocaleString()} pcs)
              </p>
            )}
            {previousQuantity && previousQuantity !== orderQuantity && previousQuantity > 0 && orderQuantity > 0 && (
              <p className="text-xs text-blue-600 mt-1">
                💡 This will create a NEW costing option. Original ({previousQuantity.toLocaleString()} pcs) will be preserved.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
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
            {showStyleOptionsButton && selectedStyleId && (
              <Button
                variant="default"
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() => navigate(`/fabric-costing/options?styleId=${selectedStyleId}`)}
                title="View saved costing options for this style"
              >
                <Eye className="w-4 h-4 mr-1" />
                View Saved Options
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* CAD Data Warning Banner */}
      {selectedStyleId && !hasCADData && !isValidatingCAD && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900 mb-1">No CAD Data Found</h3>
              <p className="text-sm text-amber-800 mb-3">
                This style has no CAD data from CAD Planning. Fabric costing requires CAD consumption data (meters per piece) to calculate costs accurately.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/cad-planning?style=${selectedStyleId}`)}
                className="border-amber-600 text-amber-900 hover:bg-amber-100"
              >
                <FileText className="w-4 h-4 mr-2" />
                Create CAD Data in CAD Planning
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Fabric Costing Table */}
      {isLoadingFabrics ? (
        <Card className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span>Loading fabrics...</span>
        </Card>
      ) : fabricRows.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          {selectedStyleId
            ? `No fabrics found for ${purpose === 'COSTING' ? 'Costing' : purpose === 'RAW_MATERIAL_CALCULATION' ? 'Raw Material Calculation' : 'Production'} mode.${purpose !== 'COSTING' ? ' Try switching to Costing mode to see available data.' : ''}`
            : 'Select a customer and style to load fabrics'}
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-[130px] px-1 text-xs">Greige</TableHead>
                <TableHead className="w-[90px] px-1 text-center text-xs whitespace-normal leading-tight" title="Processing batch color - rows with same color are dyed together for combined rate">Batch Color</TableHead>
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
              {/* Conditional rendering based on whether nested grouping is needed */}
              {showNestedGrouping ? (
                /* Nested grouping: Date → Quantity → Greige */
                nestedGroups.map((dateGroup) => (
                  <React.Fragment key={dateGroup.dateKey}>
                    {/* Date Group Header */}
                    <TableRow className="bg-amber-50 border-t-2 border-amber-200">
                      <TableCell colSpan={17} className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-amber-600" />
                          <span className="font-semibold text-amber-800">
                            {dateGroup.dateKey === 'New (Unsaved)' ? 'New (Unsaved)' : `Created: ${dateGroup.dateKey}`}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {dateGroup.totalRows} row{dateGroup.totalRows !== 1 ? 's' : ''}
                          </Badge>
                          {dateGroup.dateKey === 'New (Unsaved)' && (
                            <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">
                              Not yet saved
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Quantity Sub-Groups */}
                    {dateGroup.quantityGroups.map((qtyGroup) => (
                      <React.Fragment key={qtyGroup.qtyKey}>
                        {/* Quantity Sub-Header (only if multiple qty groups in this date) */}
                        {dateGroup.quantityGroups.length > 1 && (
                          <TableRow className="bg-blue-50 border-t border-blue-200">
                            <TableCell colSpan={17} className="py-1.5 px-3">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-blue-800">
                                  Order Qty: {qtyGroup.qtyKey === 'No Qty' ? 'Not specified' : `${Number(qtyGroup.qtyKey).toLocaleString()} pcs`}
                                </span>
                                <Badge variant="secondary" className="text-xs">
                                  {qtyGroup.totalRows} row{qtyGroup.totalRows !== 1 ? 's' : ''}
                                </Badge>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}

                        {/* Greige Groups within this Quantity */}
                        {Object.entries(qtyGroup.greigeGroups).map(([greigeKey, greigeGroup]) => {
                          const subtotals = calculateGroupSubtotals(greigeGroup.rows);
                          const showSubtotal = greigeGroup.rows.length > 1 || Object.keys(qtyGroup.greigeGroups).length > 1;

                          return (
                            <React.Fragment key={greigeKey}>
                              {greigeGroup.rows.map((row) => {
                                const index = (row as any)._originalIndex;
                                return (
                                  <React.Fragment key={row.id}>
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

                    {/* Batch Color */}
                    <TableCell className="px-1 text-center">
                      <select
                        className="w-full h-7 text-[10px] border rounded px-1 bg-white"
                        value={row.processingBatchGroupColorId || ''}
                        onChange={(e) => {
                          const colorId = e.target.value || null;
                          const color = globalColors.find(c => c.id === e.target.value);
                          updateRow(index, {
                            processingBatchGroupColorId: colorId,
                            processingBatchGroupColorName: color?.colorName || null,
                            // Reset batch comparison when color changes
                            batchRate: null,
                            individualRate: null,
                            batchSavings: null,
                            batchGroupTotalQuantity: null,
                          });
                        }}
                      >
                        <option value="">-</option>
                        {globalColors.map(color => (
                          <option key={color.id} value={color.id}>
                            {color.colorName}{color.colorCode ? ` (${color.colorCode})` : ''}
                          </option>
                        ))}
                      </select>
                      {row.batchGroupTotalQuantity != null && (
                        <div className="text-[9px] text-blue-600 mt-0.5" title="Combined batch quantity for rate slab">
                          {row.batchGroupTotalQuantity.toFixed(0)}m batch
                        </div>
                      )}
                      {row.batchSavings != null && row.batchSavings > 0 && (
                        <div className="text-[9px] text-green-600 font-medium" title={`Individual rate: ₹${row.individualRate?.toFixed(2)}/m`}>
                          save ₹{row.batchSavings.toFixed(2)}/m
                        </div>
                      )}
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
                            title="No CAD data - set consumption in CAD Planning first"
                          >
                            !
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Qty (pcs) */}
                    <TableCell className="px-1 text-center">
                      <Input
                        type="number"
                        className="h-7 w-full text-xs text-center px-1"
                        value={row.rowQuantity ?? row.savedOrderQuantityPcs ?? orderQuantity ?? ''}
                        onChange={(e) => {
                          const newQty = parseInt(e.target.value) || undefined;
                          updateRow(index, { rowQuantity: newQty });
                        }}
                        placeholder={orderQuantity?.toString() || '-'}
                        title="Order quantity for this row (leave empty to use global quantity)"
                      />
                    </TableCell>

                    {/* Width */}
                    <TableCell className="px-1 text-center text-xs">
                      {row.width}"
                    </TableCell>

                    {/* Finish */}
                    <TableCell className="px-1 text-center">
                      {getFinishTypeBadge(row.finishType)}
                    </TableCell>

                    {/* Mode Toggle (Build-up vs Landed) */}
                    <TableCell className="px-1 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <span className={`text-[9px] ${row.costInputMode === 'BUILD_UP' ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>B</span>
                        <Switch
                          checked={row.costInputMode === 'LANDED_PRICE'}
                          onCheckedChange={(checked) => {
                            updateRow(index, {
                              costInputMode: checked ? 'LANDED_PRICE' : 'BUILD_UP',
                              // When switching to landed price, default to ready fabric cost if available
                              landedPricePerMeter: checked ? (row.readyFabricCost || null) : null,
                            });
                          }}
                          className="scale-75"
                        />
                        <span className={`text-[9px] ${row.costInputMode === 'LANDED_PRICE' ? 'text-green-600 font-semibold' : 'text-gray-400'}`}>L</span>
                      </div>
                    </TableCell>

                    {/* Greige + Transport Cost */}
                    <TableCell className="px-1 text-center">
                      {row.costInputMode === 'BUILD_UP' ? (
                        <div className="flex items-center gap-0.5 justify-center">
                          <Input
                            type="number"
                            step="0.01"
                            className="h-7 w-12 text-xs text-center px-0.5"
                            value={row.greigeCostPerMeter || ''}
                            onChange={(e) => {
                              const greigeCost = parseFloat(e.target.value) || 0;
                              const shrinkage = row.shrinkagePercent || 0;
                              const shrinkageValue = greigeCost * (shrinkage / 100);
                              const transportCost = row.transportCostPerMeter || 2;
                              const processingCost = row.processingCostPerMeter || 0;
                              const screenCost = row.screenCostPerMeter || 0;
                              const total = greigeCost + transportCost + shrinkageValue + processingCost + screenCost;
                              updateRow(index, {
                                greigeCostPerMeter: greigeCost,
                                greigeCostSource: 'MANUAL',
                                shrinkageValue,
                                totalCostPerMeter: total,
                              });
                            }}
                            placeholder="Greige"
                            title={`Greige cost (source: ${row.greigeCostSource || 'MANUAL'})`}
                          />
                          <span className="text-[10px] text-gray-400">+</span>
                          <Input
                            type="number"
                            step="0.1"
                            className="h-7 w-10 text-xs text-center px-0.5"
                            value={row.transportCostPerMeter || ''}
                            onChange={(e) => {
                              const transportCost = parseFloat(e.target.value) || 0;
                              const greigeCost = row.greigeCostPerMeter || 0;
                              const shrinkageValue = row.shrinkageValue || 0;
                              const processingCost = row.processingCostPerMeter || 0;
                              const screenCost = row.screenCostPerMeter || 0;
                              const total = greigeCost + transportCost + shrinkageValue + processingCost + screenCost;
                              updateRow(index, {
                                transportCostPerMeter: transportCost,
                                totalCostPerMeter: total,
                              });
                            }}
                            placeholder="Trp"
                            title="Transport cost per meter"
                          />
                        </div>
                      ) : (
                        <Input
                          type="number"
                          step="0.01"
                          className="h-7 w-full text-xs text-center"
                          value={row.landedPricePerMeter || ''}
                          onChange={(e) => {
                            const landedPrice = parseFloat(e.target.value) || 0;
                            updateRow(index, {
                              landedPricePerMeter: landedPrice,
                              totalCostPerMeter: landedPrice,
                            });
                          }}
                          placeholder="Landed ₹/m"
                          title="Landed price per meter (includes all costs)"
                        />
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
                              if (row.processingType === 'DYEING' && value && row.greigeId) {
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

                    {/* Colors */}
                    <TableCell className="px-1 text-center">
                      {row.finishType === 'PRINTED' ? (
                        <Input
                          type="number"
                          min="1"
                          max="12"
                          className="h-7 w-full text-xs text-center px-0.5"
                          value={row.numberOfColors || ''}
                          onChange={(e) => {
                            const numColors = parseInt(e.target.value) || null;
                            // Recalculate screen cost
                            const screenType = row.screenType;
                            const defaultCost = screenType ? DEFAULT_SCREEN_COSTS[screenType] : 0;
                            const costPerScreen = row.screenCostPerScreen || defaultCost;
                            const totalScreenCost = numColors && costPerScreen ? numColors * costPerScreen : null;
                            const qty = row.rowQuantity ?? orderQuantity;
                            const fabricMeters = row.cadMeters * (qty || 0);
                            const screenCostPerMeter = totalScreenCost && fabricMeters > 0 ? totalScreenCost / fabricMeters : null;
                            // Recalc total
                            const greigeCost = row.greigeCostPerMeter || 0;
                            const transportCost = row.transportCostPerMeter || 0;
                            const shrinkageValue = row.shrinkageValue || 0;
                            const processingCost = row.processingCostPerMeter || 0;
                            const total = greigeCost + transportCost + shrinkageValue + processingCost + (screenCostPerMeter || 0);
                            updateRow(index, {
                              numberOfColors: numColors,
                              screenCostTotal: totalScreenCost,
                              screenCostPerMeter,
                              totalCostPerMeter: row.costInputMode === 'BUILD_UP' ? total : row.totalCostPerMeter,
                            });
                          }}
                          placeholder="#"
                          title="Number of colors/screens"
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </TableCell>

                    {/* Print Type */}
                    <TableCell className="px-1 text-center">
                      {row.finishType === 'PRINTED' ? (
                        <select
                          className="h-7 w-full text-[10px] border rounded px-0.5 bg-white"
                          value={row.screenType || ''}
                          onChange={(e) => {
                            const screenType = (e.target.value || null) as ScreenType | null;
                            const defaultCost = screenType ? DEFAULT_SCREEN_COSTS[screenType] : 0;
                            const costPerScreen = defaultCost;
                            const numColors = row.numberOfColors || 0;
                            const totalScreenCost = numColors && costPerScreen ? numColors * costPerScreen : null;
                            const qty = row.rowQuantity ?? orderQuantity;
                            const fabricMeters = row.cadMeters * (qty || 0);
                            const screenCostPerMeter = totalScreenCost && fabricMeters > 0 ? totalScreenCost / fabricMeters : null;
                            // Recalc total
                            const greigeCost = row.greigeCostPerMeter || 0;
                            const transportCost = row.transportCostPerMeter || 0;
                            const shrinkageValue = row.shrinkageValue || 0;
                            const processingCost = row.processingCostPerMeter || 0;
                            const total = greigeCost + transportCost + shrinkageValue + processingCost + (screenCostPerMeter || 0);
                            updateRow(index, {
                              screenType,
                              screenCostPerScreen: costPerScreen,
                              screenCostTotal: totalScreenCost,
                              screenCostPerMeter,
                              totalCostPerMeter: row.costInputMode === 'BUILD_UP' ? total : row.totalCostPerMeter,
                            });
                          }}
                        >
                          <option value="">-</option>
                          {Object.entries(SCREEN_TYPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </TableCell>

                    {/* Screen Cost */}
                    <TableCell className="px-1 text-center">
                      {row.finishType === 'PRINTED' && row.screenCostPerMeter ? (
                        <span className="text-xs" title={`Total screen cost: ₹${row.screenCostTotal?.toLocaleString() || 0}`}>
                          ₹{row.screenCostPerMeter.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </TableCell>

                    {/* Processing Cost */}
                    <TableCell className="px-1 text-center">
                      {row.processingCostPerMeter != null ? (
                        <div>
                          <span className="text-xs">₹{row.processingCostPerMeter.toFixed(2)}</span>
                          {row.slabLabel && (
                            <div className="text-[9px] text-gray-500 truncate" title={row.slabLabel}>{row.slabLabel}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </TableCell>

                    {/* Total Cost */}
                    <TableCell className="px-1 text-center">
                      {row.totalCostPerMeter ? (
                        <span className="text-xs font-semibold text-green-700">
                          ₹{row.totalCostPerMeter.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </TableCell>

                    {/* Part Cost (CAD × Total) */}
                    <TableCell className="px-1 text-center">
                      {row.totalCostPerMeter && row.cadMeters > 0 ? (
                        <span className="text-xs font-medium">
                          ₹{(row.cadMeters * row.totalCostPerMeter).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </TableCell>

                    {/* Fabric Req (CAD × Qty) */}
                    <TableCell className="px-1 text-center">
                      {row.cadMeters > 0 && (row.rowQuantity || orderQuantity) > 0 ? (
                        <span className="text-xs">
                          {((row.rowQuantity ?? orderQuantity) * row.cadMeters).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </TableCell>

                    {/* Greige Req (adjusted for shrinkage) */}
                    <TableCell className="px-1 text-center">
                      {row.cadMeters > 0 && (row.rowQuantity || orderQuantity) > 0 ? (
                        (() => {
                          const qty = row.rowQuantity ?? orderQuantity;
                          const fabricReq = row.cadMeters * qty;
                          const shrinkage = row.shrinkagePercent || 0;
                          const greigeReq = shrinkage > 0 ? fabricReq / (1 - shrinkage / 100) : fabricReq;
                          return (
                            <span className="text-xs" title={shrinkage > 0 ? `Fabric req ÷ (1 - ${shrinkage}% shrinkage)` : 'No shrinkage applied'}>
                              {greigeReq.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          );
                        })()
                      ) : (
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
                                  <TableCell className="px-1" colSpan={3}>
                                    <span className="text-xs font-semibold text-blue-800">
                                      Subtotal: {greigeGroup.greigeName}
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
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                /* Simple grouping: Just Greige (no date/qty headers) */
                Object.entries(groupedRows).map(([groupKey, group]) => {
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

                    {/* Batch Color */}
                    <TableCell className="px-1 text-center">
                      <select
                        className="w-full h-7 text-[10px] border rounded px-1 bg-white"
                        value={row.processingBatchGroupColorId || ''}
                        onChange={(e) => {
                          const colorId = e.target.value || null;
                          const color = globalColors.find(c => c.id === e.target.value);
                          updateRow(index, {
                            processingBatchGroupColorId: colorId,
                            processingBatchGroupColorName: color?.colorName || null,
                            // Reset batch comparison when color changes
                            batchRate: null,
                            individualRate: null,
                            batchSavings: null,
                            batchGroupTotalQuantity: null,
                          });
                        }}
                      >
                        <option value="">-</option>
                        {globalColors.map(color => (
                          <option key={color.id} value={color.id}>
                            {color.colorName}{color.colorCode ? ` (${color.colorCode})` : ''}
                          </option>
                        ))}
                      </select>
                      {row.batchGroupTotalQuantity != null && (
                        <div className="text-[9px] text-blue-600 mt-0.5" title="Combined batch quantity for rate slab">
                          {row.batchGroupTotalQuantity.toFixed(0)}m batch
                        </div>
                      )}
                      {row.batchSavings != null && row.batchSavings > 0 && (
                        <div className="text-[9px] text-green-600 font-medium" title={`Individual rate: ₹${row.individualRate?.toFixed(2)}/m`}>
                          save ₹{row.batchSavings.toFixed(2)}/m
                        </div>
                      )}
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
                          {/* Show individual rate comparison when in a batch group */}
                          {row.individualRate != null && row.batchRate != null && row.individualRate !== row.batchRate && (
                            <p className="text-[9px] text-gray-400 line-through" title="Individual rate (without batch grouping)">
                              ₹{row.individualRate.toFixed(2)}
                            </p>
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
                        <TableCell className="px-1" colSpan={3}>
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
              })
              )}
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
