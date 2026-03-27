import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { CustomerCombobox } from '../components/CustomerCombobox';
import { customerService } from '../services/customer.service';
import { createOrder, getOrderById, updateOrder } from '../services/order.service';
import { styleService } from '../services/style.service';
import { getAllPresetsForCustomer } from '../services/customerSizePreset.service';
import { getCostSheetVersionsByStyle } from '../services/costSheet.service';
import type { CustomerSizePreset } from '../types/customerSizePreset.types';
import type { Customer } from '../types/customer.types';
import type { Style } from '../types/style.types';
import type { Priority, CreateOrderItemBreakup } from '../types/order.types';
import type { CostSheet } from '../types/costSheet.types';
import { PriorityLabels } from '../types/order.types';
import { logError } from '../lib/logger';
import { formatCurrency } from '../lib/currency';
import CostSheetComparisonModal from '../components/cost-sheet/CostSheetComparisonModal';
import {
  Search,
  Package,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Hash,
  FileText,
  Sparkles,
  Calculator,
} from 'lucide-react';

// Extended Style type with color and size options from API
// Note: Serializer automatically converts snake_case to camelCase
// size_options → sizeOptions, color_options → colorOptions
interface StyleWithOptions extends Style {
  colorOptions?: ColorOption[];
  sizeOptions?: SizeOption[];
  image?: string;
  customerId?: string;
}

interface ColorOption {
  id: string;
  colorName: string;
  colorCode?: string;
}

interface SizeOption {
  id: string;
  sizeName: string;
  sizeCode: string;
}

export default function OrderForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditMode = Boolean(id);

  // Track if we've processed the cost sheet pre-fill from query params
  const [costSheetPrefillProcessed, setCostSheetPrefillProcessed] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [customerId, setCustomerId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [remarks, setRemarks] = useState('');

  // Single style selection (1 style per order)
  const [selectedStyleId, setSelectedStyleId] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<StyleWithOptions | null>(null);
  const [unitPrice, setUnitPrice] = useState('');

  // Display field for brand name (auto-populated from style selection)
  const [displayBrandName, setDisplayBrandName] = useState('');
  const [breakup, setBreakup] = useState<CreateOrderItemBreakup[]>([]);
  const [colors, setColors] = useState<ColorOption[]>([]);
  const [sizes, setSizes] = useState<SizeOption[]>([]);

  // Size preset override
  const [customerSizePresets, setCustomerSizePresets] = useState<CustomerSizePreset[]>([]);
  const [selectedSizePresetId, setSelectedSizePresetId] = useState('');
  const [sizeOverrideActive, setSizeOverrideActive] = useState(false);

  // Style search (with server-side search for large catalogs)
  const [styleSearch, setStyleSearch] = useState('');
  const [searchingStyles, setSearchingStyles] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingOrderRef = useRef(false); // Prevents handleStyleSelect from resetting state during fetchOrder

  // Cost sheet selection for pricing
  const [costSheetDialogOpen, setCostSheetDialogOpen] = useState(false);
  const [costSheets, setCostSheets] = useState<CostSheet[]>([]);
  const [loadingCostSheets, setLoadingCostSheets] = useState(false);
  const [selectedCostSheetId, setSelectedCostSheetId] = useState<string | null>(null);

  // Cost sheet validation state
  const [hasApprovedCostSheet, setHasApprovedCostSheet] = useState<boolean | null>(null);
  const [costSheetValidationLoading, setCostSheetValidationLoading] = useState(false);

  // Quantity input mode: 'absolute' | 'percentage' | 'ratio'
  const [quantityMode, setQuantityMode] = useState<'absolute' | 'percentage' | 'ratio'>('absolute');
  const [totalForDistribution, setTotalForDistribution] = useState('');
  // Store percentage/ratio values separately so they persist when calculating
  const [distributionValues, setDistributionValues] = useState<Record<string, number>>({});

  // Section expansion state
  const [expandedSections, setExpandedSections] = useState({
    basics: true,
    style: true,
    quantity: true,
    additionalDetails: false,
  });

  // Get today's date for default
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const loadData = async () => {
      // Load customers and styles first
      await Promise.all([fetchCustomers(), fetchStyles()]);
      // Then load order data if in edit mode (after customers/styles are available)
      if (isEditMode && id) {
        await fetchOrder(id);
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEditMode]);

  // Handle pre-fill from Cost Sheet page (query params: styleId, costSheetId, fromCostSheet)
  useEffect(() => {
    const handleCostSheetPrefill = async () => {
      // Only process once and not in edit mode
      if (costSheetPrefillProcessed || isEditMode) return;

      const fromCostSheet = searchParams.get('fromCostSheet') === 'true';
      const styleIdParam = searchParams.get('styleId');
      const costSheetIdParam = searchParams.get('costSheetId');

      // Only proceed if we're coming from cost sheet with both IDs
      if (!fromCostSheet || !styleIdParam || !costSheetIdParam) return;

      // Wait for styles to be loaded
      if (styles.length === 0) return;

      setCostSheetPrefillProcessed(true);

      try {
        // Auto-select the style - this will trigger handleStyleSelect behavior
        setSelectedStyleId(styleIdParam);

        // Load full style details
        const fullStyle = (await styleService.getStyleById(styleIdParam)) as StyleWithOptions;
        setSelectedStyle(fullStyle);

        // Set brand name
        setDisplayBrandName(fullStyle.brandName || fullStyle.brandCategories?.brandName || '');

        // Auto-populate customer from style if available
        if (fullStyle.customerName && customers.length > 0) {
          const matchedCustomer = customers.find((c) => c.name.toLowerCase() === fullStyle.customerName?.toLowerCase());
          if (matchedCustomer) {
            setCustomerId(matchedCustomer.id);
            if (matchedCustomer.creditDays) {
              setPaymentTerms(`Net ${matchedCustomer.creditDays} Days`);
            }
          }
        }

        // Serializer converts color_options → colorOptions, size_options → sizeOptions
        setColors(fullStyle.colorOptions ?? []);
        setSizes(fullStyle.sizeOptions ?? []);

        // Load cost sheets for this style and pre-select the one from params
        // Filter to only approved cost sheets with valid purpose for orders
        const costSheetsData = await getCostSheetVersionsByStyle(styleIdParam);
        const filteredSheets = costSheetsData.filter(
          (cs: CostSheet) =>
            (cs.approvalStatus === 'APPROVED' || cs.isApproved) &&
            (cs.purpose === 'RAW_MATERIAL_CALCULATION' || cs.purpose === 'PRODUCTION')
        );
        setCostSheets(filteredSheets);

        // Find and select the cost sheet from params
        const targetCostSheet = costSheetsData.find((cs) => cs.id === costSheetIdParam);
        if (targetCostSheet) {
          setSelectedCostSheetId(targetCostSheet.id);
          setUnitPrice(targetCostSheet.sellingPricePerPiece?.toString() || '');
          setHasApprovedCostSheet(true);
        }
      } catch (err) {
        logError('Failed to pre-fill from cost sheet:', err);
      }
    };

    handleCostSheetPrefill();
  }, [searchParams, styles, customers, costSheetPrefillProcessed, isEditMode]);

  const fetchCustomers = async () => {
    try {
      // Reduced from 1000 to 200 for performance
      const response = await customerService.getAllCustomers({ limit: 200 });
      setCustomers(response.data);
    } catch (err) {
      logError('Failed to fetch customers:', err);
    }
  };

  const fetchStyles = async () => {
    try {
      // Load initial batch of ACTIVE styles only (DRAFT styles must be published first)
      const response = await styleService.getAllStyles(1, 200, undefined, undefined, undefined, undefined, 'ACTIVE');
      setStyles(response.data);
    } catch (err) {
      logError('Failed to fetch styles:', err);
    }
  };

  // Server-side search: when user types 2+ chars, fetch matching styles from API
  useEffect(() => {
    if (!styleSearch || styleSearch.length < 2) {
      setSearchingStyles(false);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    setSearchingStyles(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await styleService.getAllStyles(1, 20, styleSearch, undefined, undefined, undefined, 'ACTIVE');
        // Merge server results with existing styles (deduplicate by id)
        setStyles((prev) => {
          const existingIds = new Set(prev.map((s) => s.id));
          const newStyles = response.data.filter((s) => !existingIds.has(s.id));
          if (newStyles.length === 0) return prev;
          return [...prev, ...newStyles];
        });
      } catch (err) {
        logError('Style search failed:', err);
      } finally {
        setSearchingStyles(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [styleSearch]);

  const fetchOrder = async (orderId: string) => {
    try {
      setIsLoading(true);
      isLoadingOrderRef.current = true;
      const order = await getOrderById(orderId);

      setCustomerId(order.customerId);
      setOrderDate(order.orderDate?.split('T')[0] || today);
      setExpectedDeliveryDate(order.expectedDeliveryDate.split('T')[0]);
      setPriority(order.priority);
      setPaymentTerms(order.paymentTerms || '');
      setShippingAddress(order.shippingAddress || '');
      setRemarks(order.remarks || '');

      // Set total quantity from order even if no items (for orders created without items)
      if (order.totalQuantity) {
        setTotalForDistribution(order.totalQuantity.toString());
      }

      // Load the first (and only) order item
      if (order.orderItems && order.orderItems.length > 0) {
        const item = order.orderItems[0];
        setSelectedStyleId(item.styleId);
        setUnitPrice(item.unitPrice.toString());

        // Load style details
        const fullStyle = (await styleService.getStyleById(item.styleId)) as StyleWithOptions;
        setSelectedStyle(fullStyle);

        // Always move selected style to front so it's in filteredStyles (first 20)
        setStyles((prev) => {
          const withoutStyle = prev.filter((s) => s.id !== fullStyle.id);
          return [fullStyle as Style, ...withoutStyle];
        });

        // Serializer converts color_options → colorOptions, size_options → sizeOptions
        const styleColors = fullStyle.colorOptions ?? [];
        const styleSizes = fullStyle.sizeOptions ?? [];
        setColors(styleColors);
        setSizes(styleSizes);

        // Load breakup from order - map existing quantities to size grid
        // Build maps: sizeId -> quantity AND sizeName -> quantity (for fallback matching)
        const breakupByIdMap = new Map<string, number>();
        const breakupByNameMap = new Map<string, number>();

        if (item.breakup && item.breakup.length > 0) {
          item.breakup.forEach((b) => {
            // Map by ID
            const idKey = b.colorId ? `${b.colorId}-${b.sizeId}` : b.sizeId;
            breakupByIdMap.set(idKey, b.quantity);

            // Map by size name (for fallback when IDs don't match)
            const sizeName = b.sizes?.sizeName || '';
            const colorName = b.colors?.colorName || '';
            if (sizeName) {
              const nameKey = colorName ? `${colorName}-${sizeName}` : sizeName;
              breakupByNameMap.set(nameKey, b.quantity);
            }
          });
        }

        // Create breakup array matching the style's color/size structure
        let newBreakup: CreateOrderItemBreakup[];
        if (styleColors.length > 0) {
          newBreakup = styleColors.flatMap((color: ColorOption) =>
            styleSizes.map((size: SizeOption) => {
              // Try matching by ID first, then by name
              const idKey = `${color.id}-${size.id}`;
              const nameKey = `${color.colorName}-${size.sizeName}`;
              const quantity = breakupByIdMap.get(idKey) || breakupByNameMap.get(nameKey) || 0;
              return {
                colorId: color.id,
                sizeId: size.id,
                quantity,
              };
            })
          );
        } else {
          newBreakup = styleSizes.map((size: SizeOption) => {
            // Try matching by ID first, then by name
            const quantity = breakupByIdMap.get(size.id) || breakupByNameMap.get(size.sizeName) || 0;
            return {
              colorId: '',
              sizeId: size.id,
              quantity,
            };
          });
        }
        setBreakup(newBreakup);

        // Set total quantity from order
        setTotalForDistribution(item.totalQuantity.toString());

        // Validate cost sheet for this style (needed for form validation)
        try {
          const sheets = await getCostSheetVersionsByStyle(item.styleId);
          const sheetsArray = Array.isArray(sheets) ? sheets : [];
          const approvedSheets = sheetsArray.filter(
            (s: CostSheet) =>
              (s.approvalStatus === 'APPROVED' || s.isApproved) &&
              (s.purpose === 'RAW_MATERIAL_CALCULATION' || s.purpose === 'PRODUCTION')
          );
          setHasApprovedCostSheet(approvedSheets.length > 0);
          setCostSheets(approvedSheets);
        } catch {
          setHasApprovedCostSheet(false);
        }
      }

      // Show additional details if any are filled
      if (order.paymentTerms || order.shippingAddress || order.remarks) {
        setExpandedSections((prev) => ({ ...prev, additionalDetails: true }));
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setError(errorObj.response?.data?.message || 'Failed to fetch order');
    } finally {
      setIsLoading(false);
      isLoadingOrderRef.current = false;
    }
  };

  // Filter styles based on search — always include selected style for Radix Select display
  const filteredStyles = useMemo(() => {
    let list: Style[];
    if (!styleSearch) {
      list = styles.slice(0, 20);
    } else {
      const search = styleSearch.toLowerCase();
      list = styles
        .filter(
          (style) => style.styleCode.toLowerCase().includes(search) || style.styleName.toLowerCase().includes(search)
        )
        .slice(0, 20);
    }
    // Always include selected style so Radix Select can resolve display text
    if (selectedStyleId && !list.some((s) => s.id === selectedStyleId)) {
      const selected = styles.find((s) => s.id === selectedStyleId);
      if (selected) list = [selected, ...list];
    }
    return list;
  }, [styles, styleSearch, selectedStyleId]);

  // Handle style selection
  const handleStyleSelect = async (styleId: string) => {
    if (isLoadingOrderRef.current) return; // Skip during fetchOrder — it handles its own state
    if (styleId === selectedStyleId) return;

    setSelectedStyleId(styleId);
    setBreakup([]);
    setColors([]);
    setSizes([]);
    setHasApprovedCostSheet(null);
    setSelectedCostSheetId(null);
    setCostSheets([]);

    try {
      const fullStyle = (await styleService.getStyleById(styleId)) as StyleWithOptions;
      setSelectedStyle(fullStyle);

      // Set brand name from style (brandName or brandCategories.brandName)
      setDisplayBrandName(
        fullStyle.brandName ||
          (fullStyle as unknown as { brandCategories?: { brandName?: string } }).brandCategories?.brandName ||
          ''
      );

      // Auto-populate customer if not already selected (match style's customerName to customers list)
      if (!customerId && fullStyle.customerName) {
        const matchedCustomer = customers.find((c) => c.name.toLowerCase() === fullStyle.customerName?.toLowerCase());
        if (matchedCustomer) {
          setCustomerId(matchedCustomer.id);
          // Also set payment terms if customer has credit days
          if (matchedCustomer.creditDays) {
            setPaymentTerms(`Net ${matchedCustomer.creditDays} Days`);
          }
        }
      }

      // Check for approved cost sheets (for order validation)
      // Only count cost sheets with RAW_MATERIAL_CALCULATION or PRODUCTION purpose
      // COSTING mode cost sheets cannot be used for order creation
      setCostSheetValidationLoading(true);
      try {
        const sheets = await getCostSheetVersionsByStyle(styleId);
        // Defensive check: ensure sheets is an array
        const sheetsArray = Array.isArray(sheets) ? sheets : [];
        const approvedSheets = sheetsArray.filter(
          (s: CostSheet) =>
            (s.approvalStatus === 'APPROVED' || s.isApproved) &&
            (s.purpose === 'RAW_MATERIAL_CALCULATION' || s.purpose === 'PRODUCTION')
        );
        setHasApprovedCostSheet(approvedSheets.length > 0);
        setCostSheets(approvedSheets);
      } catch (costErr) {
        console.error('Failed to check cost sheets:', costErr);
        setHasApprovedCostSheet(false);
        setCostSheets([]);
      } finally {
        setCostSheetValidationLoading(false);
      }

      // Serializer converts color_options → colorOptions, size_options → sizeOptions
      const styleColors = fullStyle.colorOptions ?? [];
      const styleSizes = fullStyle.sizeOptions ?? [];

      setColors(styleColors);
      setSizes(styleSizes);

      // Initialize breakup matrix with zeros
      let newBreakup: CreateOrderItemBreakup[];

      if (styleColors.length > 0) {
        newBreakup = styleColors.flatMap((color: ColorOption) =>
          styleSizes.map((size: SizeOption) => ({
            colorId: color.id,
            sizeId: size.id,
            quantity: 0,
          }))
        );
      } else {
        newBreakup = styleSizes.map((size: SizeOption) => ({
          colorId: '',
          sizeId: size.id,
          quantity: 0,
        }));
      }
      setBreakup(newBreakup);

      // Load size presets for the style's customer
      if (fullStyle.customerId) {
        loadSizePresetsForCustomer(fullStyle.customerId);
      }
    } catch (err) {
      logError('Failed to fetch style details:', err);
    }
  };

  // Load size category presets for customer
  const loadSizePresetsForCustomer = async (customerId: string) => {
    try {
      const presets = await getAllPresetsForCustomer(customerId);
      setCustomerSizePresets(presets);
    } catch (error) {
      console.error('Failed to load size presets:', error);
      setCustomerSizePresets([]);
    }
  };

  // Load cost sheets for selected style
  // Filter to only approved cost sheets with valid purpose for orders
  const loadCostSheetsForStyle = async (styleId: string) => {
    try {
      setLoadingCostSheets(true);
      const sheets = await getCostSheetVersionsByStyle(styleId);
      // Filter: only approved + valid purpose (COSTING mode cannot be used for orders)
      const filteredSheets = sheets.filter(
        (cs: CostSheet) =>
          (cs.approvalStatus === 'APPROVED' || cs.isApproved) &&
          (cs.purpose === 'RAW_MATERIAL_CALCULATION' || cs.purpose === 'PRODUCTION')
      );
      setCostSheets(filteredSheets);
    } catch (error) {
      console.error('Failed to load cost sheets:', error);
      setCostSheets([]);
    } finally {
      setLoadingCostSheets(false);
    }
  };

  // Handle opening cost sheet selector
  const handleOpenCostSheetSelector = () => {
    if (selectedStyleId) {
      loadCostSheetsForStyle(selectedStyleId);
      setCostSheetDialogOpen(true);
    }
  };

  // Handle selecting a cost sheet for pricing
  const handleSelectCostSheet = (costSheet: CostSheet) => {
    setSelectedCostSheetId(costSheet.id);
    setUnitPrice(costSheet.sellingPricePerPiece.toString());
    setCostSheetDialogOpen(false);
  };

  // Apply size preset to override style's sizes
  const handleApplySizePreset = (presetId: string) => {
    if (!presetId || presetId === '__default__') {
      // Reset to style's original sizes
      setSelectedSizePresetId('');
      setSizeOverrideActive(false);
      if (selectedStyle) {
        const styleSizes = selectedStyle.sizeOptions ?? [];
        setSizes(styleSizes);
        regenerateBreakupWithNewSizes(styleSizes);
      }
      return;
    }

    const preset = customerSizePresets.find((p) => p.id === presetId);
    if (!preset || !preset.sizeCategory.sizes) return;

    // Convert preset sizes to SizeOption format
    // Match preset size names to style's existing size_options by name to preserve real DB IDs
    const styleSizes = selectedStyle?.sizeOptions ?? [];
    const presetSizes: SizeOption[] = preset.sizeCategory.sizes.map((size, idx) => {
      const matchedSize = styleSizes.find(
        (s) => s.sizeName.toUpperCase() === size.toUpperCase() || s.sizeCode?.toUpperCase() === size.toUpperCase()
      );
      return matchedSize ? { ...matchedSize } : { id: `preset-${idx}-${size}`, sizeName: size, sizeCode: size };
    });

    setSelectedSizePresetId(presetId);
    setSizeOverrideActive(true);
    setSizes(presetSizes);
    regenerateBreakupWithNewSizes(presetSizes);
  };

  // Regenerate breakup grid with new sizes
  const regenerateBreakupWithNewSizes = (newSizes: SizeOption[]) => {
    let newBreakup: CreateOrderItemBreakup[];

    if (colors.length > 0) {
      newBreakup = colors.flatMap((color: ColorOption) =>
        newSizes.map((size: SizeOption) => ({
          colorId: color.id,
          sizeId: size.id,
          quantity: 0,
        }))
      );
    } else {
      newBreakup = newSizes.map((size: SizeOption) => ({
        colorId: '',
        sizeId: size.id,
        quantity: 0,
      }));
    }

    setBreakup(newBreakup);
  };

  // Update breakup quantity
  const updateBreakupQuantity = (colorId: string, sizeId: string, quantity: number) => {
    setBreakup((prev) => {
      if (colorId === '') {
        return prev.map((b) => (b.sizeId === sizeId ? { ...b, quantity } : b));
      }
      return prev.map((b) => (b.colorId === colorId && b.sizeId === sizeId ? { ...b, quantity } : b));
    });
  };

  // Smart distribute - evenly distribute a total across sizes
  const handleSmartDistribute = () => {
    const total = totalForDistribution || prompt('Enter total quantity to distribute:');
    if (!total || isNaN(Number(total))) return;

    const totalQty = parseInt(String(total));
    if (sizes.length === 0) return;

    const perSize = Math.floor(totalQty / sizes.length);
    const remainder = totalQty % sizes.length;

    if (colors.length > 0) {
      // Distribute across first color only for simplicity
      const firstColor = colors[0];
      const newBreakup = breakup.map((b) => {
        if (b.colorId === firstColor.id) {
          const sizeIndex = sizes.findIndex((s) => s.id === b.sizeId);
          return { ...b, quantity: perSize + (sizeIndex < remainder ? 1 : 0) };
        }
        return b;
      });
      setBreakup(newBreakup);
    } else {
      const newBreakup = breakup.map((b, idx) => ({
        ...b,
        quantity: perSize + (idx < remainder ? 1 : 0),
      }));
      setBreakup(newBreakup);
    }
  };

  // Handle customer selection - auto-fill payment terms from customer credit days
  const handleCustomerSelect = (selectedCustomerId: string) => {
    setCustomerId(selectedCustomerId);

    // Find the selected customer and auto-fill payment terms
    const customer = customers.find((c) => c.id === selectedCustomerId);
    if (customer?.creditDays) {
      // Format credit days as payment terms (e.g., "Net 30 Days")
      setPaymentTerms(`Net ${customer.creditDays} Days`);
      // Auto-expand additional details section to show payment terms
      setExpandedSections((prev) => ({ ...prev, additionalDetails: true }));
    }
  };

  // Update distribution value for a size (used in percentage/ratio mode)
  const updateDistributionValue = (sizeId: string, colorId: string, value: number) => {
    const key = colorId ? `${colorId}-${sizeId}` : sizeId;
    setDistributionValues((prev) => ({ ...prev, [key]: value }));
  };

  // Get distribution value for a size
  const getDistributionValue = (sizeId: string, colorId: string): number => {
    const key = colorId ? `${colorId}-${sizeId}` : sizeId;
    return distributionValues[key] || 0;
  };

  // Calculate and apply distribution based on current mode and total
  // Uses "largest remainder" method to ensure sum matches total exactly
  const applyDistribution = (total: number, mode: 'percentage' | 'ratio', values: Record<string, number>) => {
    if (!total || isNaN(total) || sizes.length === 0) return;

    // Calculate proportions based on mode
    let totalProportion: number;
    if (mode === 'percentage') {
      totalProportion = 100; // Percentages sum to 100
    } else {
      // Ratios sum to total ratio value
      totalProportion = Object.values(values).reduce((sum, v) => sum + (v || 0), 0);
      if (totalProportion === 0) return;
    }

    // Calculate exact quantities with remainders
    const calculations: Array<{
      key: string;
      proportion: number;
      exactQty: number;
      floorQty: number;
      remainder: number;
    }> = [];

    breakup.forEach((b) => {
      const key = b.colorId ? `${b.colorId}-${b.sizeId}` : b.sizeId;
      const proportion = values[key] || 0;
      const exactQty = (proportion / totalProportion) * total;
      const floorQty = Math.floor(exactQty);
      const remainder = exactQty - floorQty;

      calculations.push({
        key,
        proportion,
        exactQty,
        floorQty,
        remainder,
      });
    });

    // Sum of floor quantities
    const sumFloor = calculations.reduce((sum, c) => sum + c.floorQty, 0);
    const remaining = total - sumFloor;

    // Sort by remainder descending to distribute remaining units fairly
    const sortedByRemainder = [...calculations].sort((a, b) => b.remainder - a.remainder);

    // Create a map for final quantities
    const finalQtyMap = new Map<string, number>();
    calculations.forEach((c) => {
      finalQtyMap.set(c.key, c.floorQty);
    });

    // Distribute remaining units to items with largest remainders
    for (let i = 0; i < remaining && i < sortedByRemainder.length; i++) {
      const key = sortedByRemainder[i].key;
      finalQtyMap.set(key, (finalQtyMap.get(key) || 0) + 1);
    }

    // Apply final quantities to breakup
    const newBreakup = breakup.map((b) => {
      const key = b.colorId ? `${b.colorId}-${b.sizeId}` : b.sizeId;
      return { ...b, quantity: finalQtyMap.get(key) || 0 };
    });

    setBreakup(newBreakup);
  };

  // Handle total quantity change - auto-distribute if in percentage/ratio mode
  const handleTotalQtyChange = (value: string) => {
    setTotalForDistribution(value);
    const total = parseInt(value);

    // Auto-apply distribution if we have values and a valid total
    if (total > 0 && (quantityMode === 'percentage' || quantityMode === 'ratio')) {
      const hasValues = Object.values(distributionValues).some((v) => v > 0);
      if (hasValues) {
        applyDistribution(total, quantityMode, distributionValues);
      }
    }
  };

  // Apply percentage distribution (manual button)
  const applyPercentageDistribution = () => {
    const total = parseInt(totalForDistribution);
    applyDistribution(total, 'percentage', distributionValues);
  };

  // Apply ratio distribution (manual button)
  const applyRatioDistribution = () => {
    const total = parseInt(totalForDistribution);
    applyDistribution(total, 'ratio', distributionValues);
  };

  // When switching modes, initialize distribution values from current breakup or reset
  const handleModeChange = (newMode: 'absolute' | 'percentage' | 'ratio') => {
    if (newMode === 'absolute') {
      // Clear distribution values when going back to absolute
      setDistributionValues({});
    } else if (quantityMode === 'absolute' && (newMode === 'percentage' || newMode === 'ratio')) {
      // Initialize with default values when switching from absolute
      const defaultValues: Record<string, number> = {};
      if (newMode === 'percentage') {
        // Default to equal percentage distribution
        const perSize = sizes.length > 0 ? Math.floor(100 / sizes.length) : 0;
        sizes.forEach((size) => {
          if (colors.length > 0) {
            colors.forEach((color) => {
              defaultValues[`${color.id}-${size.id}`] = perSize;
            });
          } else {
            defaultValues[size.id] = perSize;
          }
        });
      } else {
        // Default to ratio of 1 for each size
        sizes.forEach((size) => {
          if (colors.length > 0) {
            colors.forEach((color) => {
              defaultValues[`${color.id}-${size.id}`] = 1;
            });
          } else {
            defaultValues[size.id] = 1;
          }
        });
      }
      setDistributionValues(defaultValues);
    }
    setQuantityMode(newMode);
  };

  // Calculate totals
  const distributedQuantity = useMemo(() => {
    return breakup.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
  }, [breakup]);

  // Use user-entered total for amount calculation
  const enteredTotalQty = Number(totalForDistribution) || 0;

  const totalAmount = useMemo(() => {
    return enteredTotalQty * (Number(unitPrice) || 0);
  }, [enteredTotalQty, unitPrice]);

  // Check if distributed quantity matches entered total (informational, not blocking)
  const quantityMismatch = useMemo(() => {
    if (enteredTotalQty === 0) return null;
    if (distributedQuantity === 0) return 'not-distributed';
    if (distributedQuantity !== enteredTotalQty) return 'mismatch';
    return null;
  }, [enteredTotalQty, distributedQuantity]);

  // Size distribution is optional - this is just for display
  const sizeDistributionStatus = useMemo(() => {
    if (enteredTotalQty === 0) return 'no-qty';
    if (distributedQuantity === 0) return 'pending';
    if (distributedQuantity === enteredTotalQty) return 'complete';
    return 'partial';
  }, [enteredTotalQty, distributedQuantity]);

  // Get selected customer info
  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === customerId);
  }, [customers, customerId]);

  // Validation checks - Unit Price and Size Distribution are now OPTIONAL
  // Orders can be created with just total quantity (for early procurement workflow)
  const validation = useMemo(() => {
    const enteredQty = Number(totalForDistribution) || 0;
    // Quantity is valid if total qty > 0 (size distribution is now OPTIONAL)
    const quantityValid = enteredQty > 0;
    // Track if quantity is fully distributed (for display purposes, not validation)
    const isFullyDistributed = enteredQty > 0 && distributedQuantity === enteredQty;

    const checks = {
      customer: !!customerId,
      deliveryDate: !!expectedDeliveryDate,
      style: !!selectedStyleId,
      quantity: quantityValid,
      // unitPrice is now optional - orders can be saved without pricing
      // size distribution is now optional - can be added later
    };

    // Cost sheet validation (required for order creation)
    const costSheetValid = hasApprovedCostSheet === true;

    const completedCount = Object.values(checks).filter(Boolean).length + (costSheetValid ? 1 : 0);
    const totalChecks = Object.keys(checks).length + 1; // +1 for cost sheet

    // Track if pricing is set (for display purposes, not validation)
    const hasPricing = !!unitPrice && Number(unitPrice) > 0;

    return {
      ...checks,
      costSheet: costSheetValid,
      hasPricing,
      isFullyDistributed,
      completedCount,
      totalChecks,
      isComplete: completedCount === totalChecks,
    };
  }, [
    customerId,
    expectedDeliveryDate,
    selectedStyleId,
    totalForDistribution,
    distributedQuantity,
    unitPrice,
    hasApprovedCostSheet,
  ]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (!validation.isComplete) {
        // Provide specific error message
        if (hasApprovedCostSheet === false) {
          setError(
            'Cannot create order: No approved cost sheet exists for this style. Please create and approve a cost sheet first.'
          );
        } else {
          setError('Please complete all required fields');
        }
        setIsLoading(false);
        return;
      }

      // Size distribution is optional - filter to valid entries but allow empty array
      // Also filter out entries with synthetic preset IDs (no matching size_options in DB)
      const validBreakup = breakup.filter((b) => b.quantity > 0 && !b.sizeId.startsWith('preset-'));

      const orderData = {
        customerId,
        orderDate,
        expectedDeliveryDate,
        priority,
        totalQuantity: enteredTotalQty, // Pass total quantity even without size breakdown
        paymentTerms: paymentTerms || undefined,
        shippingAddress: shippingAddress || undefined,
        remarks: remarks || undefined,
        items: [
          {
            styleId: selectedStyleId,
            unitPrice,
            totalQuantity: enteredTotalQty, // Pass total quantity at item level too
            breakup: validBreakup, // Can be empty if no size distribution
          },
        ],
      };

      if (isEditMode && id) {
        await updateOrder(id, orderData);
        navigate('/orders');
      } else {
        await createOrder(orderData);
        navigate('/orders');
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setError(errorObj.response?.data?.message || 'Failed to save order');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="p-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{isEditMode ? 'Edit Order' : 'Create New Order'}</h1>
          <p className="text-sm text-gray-500">
            Fill in the details below to {isEditMode ? 'update' : 'create'} an order
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6">
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <form onSubmit={handleSubmit}>
        {/* Order Basics Card - All inline */}
        <div className="bg-white rounded-xl border shadow-sm mb-6">
          <div className="px-6 py-5">
            <div className="flex flex-wrap items-end gap-4">
              {/* Customer Name Selection */}
              <div className="w-[250px]">
                <Label className="text-sm font-medium text-gray-700">
                  Customer Name <span className="text-red-500">*</span>
                </Label>
                <CustomerCombobox
                  value={customerId}
                  onValueChange={handleCustomerSelect}
                  placeholder="Select customer"
                  className="mt-1.5"
                />
              </div>

              {/* Style Selection - Searchable dropdown */}
              <div className="flex-1 min-w-[250px] max-w-[350px]">
                <Label className="text-sm font-medium text-gray-700">
                  Style <span className="text-red-500">*</span>
                </Label>
                <div className="relative mt-1.5">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                  <Select value={selectedStyleId} onValueChange={(value) => handleStyleSelect(value)}>
                    <SelectTrigger className="pl-10">
                      <SelectValue placeholder="Search & select style..." />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 pb-2">
                        <Input
                          placeholder="Search styles..."
                          value={styleSearch}
                          onChange={(e) => setStyleSearch(e.target.value)}
                          className="h-8"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      {filteredStyles.map((style) => (
                        <SelectItem key={style.id} value={style.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{style.styleCode}</span>
                            <span className="text-gray-500 text-xs">{style.styleName}</span>
                          </div>
                        </SelectItem>
                      ))}
                      {filteredStyles.length === 0 && (
                        <div className="py-4 text-center text-sm text-gray-500">
                          {searchingStyles ? 'Searching...' : styleSearch ? 'No styles found' : 'Type to search styles'}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Total Quantity Input - Right next to Style */}
              <div className="w-[120px]">
                <Label className="text-sm font-medium text-gray-700">
                  Total Qty <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={totalForDistribution}
                  onChange={(e) => handleTotalQtyChange(e.target.value)}
                  placeholder="0"
                  className="mt-1.5 text-center font-semibold"
                />
              </div>

              {/* Order Date - Editable, allows past dates */}
              <div className="w-[140px]">
                <Label className="text-sm font-medium text-gray-700">Order Date</Label>
                <Input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              {/* Expected Delivery */}
              <div className="w-[140px]">
                <Label className="text-sm font-medium text-gray-700">
                  Delivery <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              {/* Customer Code - Auto populated */}
              {selectedCustomer && (
                <div className="w-[120px]">
                  <Label className="text-sm font-medium text-gray-500">Cust. Code</Label>
                  <div className="mt-1.5 h-10 px-3 bg-gray-100 border border-gray-200 rounded-md flex items-center text-sm font-mono text-gray-600">
                    {selectedCustomer.code}
                  </div>
                </div>
              )}

              {/* Brand Name - Auto populated from style */}
              {displayBrandName && (
                <div className="w-[150px]">
                  <Label className="text-sm font-medium text-gray-500">Brand</Label>
                  <div className="mt-1.5 h-10 px-3 bg-gray-100 border border-gray-200 rounded-md flex items-center text-sm text-gray-600 truncate">
                    {displayBrandName}
                  </div>
                </div>
              )}
            </div>

            {/* Cost Sheet Validation Warning */}
            {selectedStyleId && hasApprovedCostSheet === false && !costSheetValidationLoading && (
              <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-red-800">No Approved Cost Sheet</p>
                    <p className="text-sm text-red-700 mt-1">
                      This style requires an approved cost sheet before orders can be created. Please create and approve
                      a cost sheet first.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-3 text-red-700 border-red-300 hover:bg-red-100"
                      onClick={() => navigate(`/cost-sheets/new?styleId=${selectedStyleId}`)}
                    >
                      <Calculator className="h-4 w-4 mr-2" />
                      Create Cost Sheet
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Cost Sheet Validation Loading */}
            {selectedStyleId && costSheetValidationLoading && (
              <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 text-gray-600 text-sm">
                  <span className="animate-spin">⏳</span>
                  Checking cost sheet status...
                </div>
              </div>
            )}

            {/* Cost Sheet Available Success */}
            {selectedStyleId && hasApprovedCostSheet === true && !costSheetValidationLoading && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-700 text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      {costSheets.length} approved cost sheet{costSheets.length > 1 ? 's' : ''} available
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-green-700 border-green-300 hover:bg-green-100"
                    onClick={handleOpenCostSheetSelector}
                  >
                    <Calculator className="h-4 w-4 mr-1" />
                    Use Cost Sheet
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quantity & Pricing Section */}
        <div className="bg-white rounded-xl border shadow-sm mb-6 overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('quantity')}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  validation.quantity && validation.hasPricing
                    ? 'bg-green-100 text-green-600'
                    : 'bg-orange-100 text-orange-600'
                }`}
              >
                {validation.quantity && validation.hasPricing ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Hash className="h-5 w-5" />
                )}
              </div>
              <div className="text-left flex-1">
                <div className="flex items-center gap-4 flex-wrap">
                  <h3 className="font-semibold text-gray-900">Quantity & Pricing</h3>
                  {enteredTotalQty > 0 && (
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded font-medium">
                        {enteredTotalQty.toLocaleString()} pcs
                      </span>
                      {distributedQuantity > 0 && distributedQuantity !== enteredTotalQty && (
                        <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded text-xs">
                          Distributed: {distributedQuantity.toLocaleString()}
                        </span>
                      )}
                      {unitPrice && Number(unitPrice) > 0 && (
                        <>
                          <span className="text-gray-400">•</span>
                          <span>@ {formatCurrency(unitPrice, { decimals: 0 })}/pc</span>
                          <span className="text-gray-400">•</span>
                          <span className="font-semibold text-green-600">Total: {formatCurrency(totalAmount)}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {enteredTotalQty === 0 && (
                  <p className="text-sm text-gray-500">Enter total quantity above, then distribute per size</p>
                )}
              </div>
            </div>
            {expandedSections.quantity ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </button>

          {expandedSections.quantity && (
            <div className="px-6 pb-6 border-t">
              <div className="pt-6">
                {/* Size Preset Override (Optional) */}
                {selectedStyleId && customerSizePresets.length > 0 && (
                  <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <Label className="text-sm font-medium mb-2 block">Size Override (Optional)</Label>
                    <Select value={selectedSizePresetId} onValueChange={handleApplySizePreset}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Use style's default sizes or select a different size preset" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default__">Use Style's Default Sizes</SelectItem>
                        {customerSizePresets.map((preset) => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {preset.presetName} - {preset.sizeCategory.name} ({preset.sizeCategory.sizes.length} sizes)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {sizeOverrideActive && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-purple-600">
                        <AlertCircle className="h-4 w-4" />
                        <span>This order is using custom sizes different from the style's default sizes</span>
                      </div>
                    )}
                  </div>
                )}

                {!selectedStyleId ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>Please select a style first</p>
                  </div>
                ) : sizes.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-700">
                      <AlertCircle className="h-5 w-5" />
                      <p className="text-sm">
                        This style has no size options. Please add SKU variants in Style Master first.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Mode Toggle & Distribution Controls */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                      {/* Mode Toggle */}
                      <div className="flex items-center gap-1 p-1 bg-white rounded-lg border">
                        <button
                          type="button"
                          onClick={() => handleModeChange('absolute')}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                            quantityMode === 'absolute' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          Absolute
                        </button>
                        <button
                          type="button"
                          onClick={() => handleModeChange('percentage')}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                            quantityMode === 'percentage' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          Percentage
                        </button>
                        <button
                          type="button"
                          onClick={() => handleModeChange('ratio')}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                            quantityMode === 'ratio' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          Ratio
                        </button>
                      </div>

                      {/* Recalculate button for Percentage/Ratio modes */}
                      {(quantityMode === 'percentage' || quantityMode === 'ratio') && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={quantityMode === 'percentage' ? applyPercentageDistribution : applyRatioDistribution}
                          disabled={!totalForDistribution || enteredTotalQty === 0}
                          className="gap-2"
                        >
                          <Sparkles className="h-4 w-4" />
                          Recalculate
                        </Button>
                      )}

                      {/* Smart Distribute for Absolute mode */}
                      {quantityMode === 'absolute' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleSmartDistribute}
                          className="gap-2"
                        >
                          <Sparkles className="h-4 w-4" />
                          Smart Distribute
                        </Button>
                      )}
                    </div>

                    {/* Mode Help Text */}
                    {quantityMode !== 'absolute' && (
                      <p className="text-xs text-gray-500 mb-4 -mt-2">
                        {quantityMode === 'percentage'
                          ? 'Enter percentage for each size. Actual quantities will auto-calculate based on Total Qty.'
                          : 'Enter ratio values (e.g., 1:2:3). Actual quantities will auto-calculate based on Total Qty.'}
                      </p>
                    )}

                    {/* Section Label */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-700">
                        {colors.length > 0 ? 'Quantity by Color & Size' : 'Quantity by Size'}
                        {quantityMode !== 'absolute' && (
                          <span className="ml-2 text-xs text-blue-600">
                            ({quantityMode === 'percentage' ? 'Enter %' : 'Enter ratios'})
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Color x Size Matrix */}
                    {colors.length > 0 && sizes.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border">Color</th>
                              {sizes.map((size) => (
                                <th
                                  key={size.id}
                                  className="px-3 py-2 text-center text-xs font-semibold text-gray-600 border min-w-[80px]"
                                >
                                  {size.sizeName}
                                </th>
                              ))}
                              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 border bg-gray-100">
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {colors.map((color) => {
                              const rowTotal = breakup
                                .filter((b) => b.colorId === color.id)
                                .reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);

                              return (
                                <tr key={color.id} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 text-sm font-medium text-gray-900 border">
                                    {color.colorName}
                                  </td>
                                  {sizes.map((size) => {
                                    const breakupItem = breakup.find(
                                      (b) => b.colorId === color.id && b.sizeId === size.id
                                    );
                                    const distValue = getDistributionValue(size.id, color.id);
                                    return (
                                      <td key={size.id} className="px-1 py-1 border">
                                        {quantityMode === 'absolute' ? (
                                          <Input
                                            type="number"
                                            min="0"
                                            value={breakupItem?.quantity || 0}
                                            onChange={(e) =>
                                              updateBreakupQuantity(color.id, size.id, parseInt(e.target.value) || 0)
                                            }
                                            className="text-center h-9 text-sm"
                                          />
                                        ) : (
                                          <div className="space-y-0.5">
                                            <Input
                                              type="number"
                                              min="0"
                                              value={distValue || ''}
                                              onChange={(e) => {
                                                const val = parseInt(e.target.value) || 0;
                                                const key = `${color.id}-${size.id}`;
                                                updateDistributionValue(size.id, color.id, val);
                                                // Auto-recalculate
                                                const total = parseInt(totalForDistribution);
                                                if (total > 0) {
                                                  const newValues = { ...distributionValues, [key]: val };
                                                  applyDistribution(
                                                    total,
                                                    quantityMode as 'percentage' | 'ratio',
                                                    newValues
                                                  );
                                                }
                                              }}
                                              placeholder={quantityMode === 'percentage' ? '%' : '#'}
                                              className="text-center h-7 text-xs"
                                            />
                                            <div className="text-center text-xs font-medium text-green-700 bg-green-50 rounded">
                                              = {breakupItem?.quantity || 0}
                                            </div>
                                          </div>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className="px-3 py-2 text-center text-sm font-semibold text-gray-900 border bg-gray-50">
                                    {rowTotal}
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="bg-gray-100 font-semibold">
                              <td className="px-3 py-2 text-sm text-gray-900 border">Total</td>
                              {sizes.map((size) => {
                                const colTotal = breakup
                                  .filter((b) => b.sizeId === size.id)
                                  .reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
                                return (
                                  <td key={size.id} className="px-3 py-2 text-center text-sm text-gray-900 border">
                                    {colTotal}
                                  </td>
                                );
                              })}
                              <td className="px-3 py-2 text-center text-sm text-blue-600 border font-bold">
                                {distributedQuantity}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Size-only Grid - Single Row */}
                    {colors.length === 0 && sizes.length > 0 && (
                      <div className="overflow-x-auto">
                        <div className="flex gap-3 min-w-max pb-2">
                          {sizes.map((size) => {
                            const breakupItem = breakup.find((b) => b.sizeId === size.id);
                            const distValue = getDistributionValue(size.id, '');
                            return (
                              <div key={size.id} className="w-24 flex-shrink-0 space-y-1">
                                <label className="block text-center text-sm font-medium text-gray-700">
                                  {size.sizeName}
                                </label>
                                {quantityMode === 'absolute' ? (
                                  <Input
                                    type="number"
                                    min="0"
                                    value={breakupItem?.quantity || 0}
                                    onChange={(e) => updateBreakupQuantity('', size.id, parseInt(e.target.value) || 0)}
                                    className="text-center h-10"
                                  />
                                ) : (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1">
                                      <Input
                                        type="number"
                                        min="0"
                                        value={distValue || ''}
                                        onChange={(e) => {
                                          const val = parseInt(e.target.value) || 0;
                                          updateDistributionValue(size.id, '', val);
                                          // Auto-recalculate
                                          const total = parseInt(totalForDistribution);
                                          if (total > 0) {
                                            const newValues = { ...distributionValues, [size.id]: val };
                                            applyDistribution(total, quantityMode as 'percentage' | 'ratio', newValues);
                                          }
                                        }}
                                        placeholder={quantityMode === 'percentage' ? '%' : '#'}
                                        className="text-center h-8 text-sm"
                                      />
                                      <span className="text-xs text-gray-500">
                                        {quantityMode === 'percentage' ? '%' : ''}
                                      </span>
                                    </div>
                                    <div className="text-center text-xs font-medium text-green-700 bg-green-50 rounded px-1 py-0.5">
                                      = {breakupItem?.quantity || 0}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {/* Total Column */}
                          <div className="w-24 flex-shrink-0 space-y-1">
                            <label className="block text-center text-sm font-semibold text-gray-900">
                              {quantityMode === 'absolute' ? 'Distributed' : 'Total'}
                            </label>
                            {quantityMode !== 'absolute' && (
                              <div className="text-center text-xs text-gray-500">
                                {quantityMode === 'percentage'
                                  ? `${Object.values(distributionValues).reduce((s, v) => s + v, 0)}%`
                                  : `Ratio: ${Object.values(distributionValues).reduce((s, v) => s + v, 0)}`}
                              </div>
                            )}
                            <div
                              className={`h-10 flex items-center justify-center rounded-md font-bold ${
                                quantityMode === 'absolute'
                                  ? 'bg-blue-50 border border-blue-200 text-blue-700'
                                  : 'bg-green-50 border border-green-200 text-green-700'
                              }`}
                            >
                              {distributedQuantity.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Size Distribution Info (Optional - not blocking) */}
                    {sizeDistributionStatus === 'pending' && (
                      <div className="mt-4 p-4 rounded-lg border flex items-start gap-3 bg-blue-50 border-blue-200 text-blue-800">
                        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Size distribution optional</p>
                          <p className="text-sm mt-1">
                            Total Order Qty: <strong>{enteredTotalQty.toLocaleString()}</strong> pcs. You can distribute
                            quantities across sizes now, or add size breakdown later.
                          </p>
                          <p className="text-xs mt-2 opacity-75">
                            Size-independent POs (fabric, greige, processing, most trims) can be generated without size
                            breakdown.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Quantity Mismatch Warning (informational, not blocking) */}
                    {quantityMismatch === 'mismatch' && (
                      <div className="mt-4 p-4 rounded-lg border flex items-start gap-3 bg-amber-50 border-amber-200 text-amber-800">
                        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">Quantity mismatch detected</p>
                          <p className="text-sm mt-1">
                            Total Order Qty: <strong>{enteredTotalQty.toLocaleString()}</strong> pcs, but size
                            distribution totals: <strong>{distributedQuantity.toLocaleString()}</strong> pcs.
                            {distributedQuantity > enteredTotalQty ? (
                              <span className="text-red-700">
                                {' '}
                                (Exceeds by {(distributedQuantity - enteredTotalQty).toLocaleString()})
                              </span>
                            ) : (
                              <span className="text-amber-700">
                                {' '}
                                (Short by {(enteredTotalQty - distributedQuantity).toLocaleString()})
                              </span>
                            )}
                          </p>
                          <p className="text-xs mt-2 opacity-75">
                            Order will be saved with total quantity of {enteredTotalQty.toLocaleString()} pcs. Size
                            distribution can be corrected later.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Quantity Match Success */}
                    {!quantityMismatch && enteredTotalQty > 0 && distributedQuantity > 0 && (
                      <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200 flex items-center gap-2 text-green-700">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="text-sm font-medium">
                          Quantity distributed correctly: {distributedQuantity.toLocaleString()} pcs
                        </span>
                      </div>
                    )}

                    {/* Pricing Section - Dark Theme */}
                    <div className="mt-6 bg-gray-900 rounded-xl p-6 text-white">
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-400">Pricing Summary</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Unit Price (₹)</label>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={unitPrice}
                              onChange={(e) => {
                                setUnitPrice(e.target.value);
                                setSelectedCostSheetId(null); // Clear cost sheet selection when manually editing
                              }}
                              placeholder="0.00"
                              className="bg-gray-800 border-gray-700 text-white text-lg font-semibold flex-1"
                            />
                          </div>
                          {selectedCostSheetId && (
                            <p className="text-xs text-blue-400 mt-1">
                              <Calculator className="w-3 h-3 inline mr-1" />
                              From Cost Sheet
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Total Amount</label>
                          <div
                            className={`h-10 px-3 rounded-md flex items-center text-lg font-bold ${
                              validation.hasPricing
                                ? 'bg-green-900/50 border border-green-700 text-green-400'
                                : 'bg-amber-900/30 border border-amber-700 text-amber-400'
                            }`}
                          >
                            {validation.hasPricing ? formatCurrency(totalAmount) : 'Pending'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-20">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Validation Status */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {validation.isComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                )}
                <span className={`text-sm font-medium ${validation.isComplete ? 'text-green-700' : 'text-amber-700'}`}>
                  {validation.completedCount}/{validation.totalChecks} required fields
                </span>
              </div>

              {/* Mini validation pills */}
              <div className="hidden sm:flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    validation.customer ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  Customer
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    validation.style ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  Style
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    validation.quantity ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}
                  title={
                    enteredTotalQty > 0 ? `Total: ${enteredTotalQty.toLocaleString()} pcs` : 'Enter total quantity'
                  }
                >
                  Qty {validation.quantity ? '✓' : ''}
                </span>
                {/* Size distribution indicator (optional) */}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    validation.isFullyDistributed
                      ? 'bg-green-100 text-green-700'
                      : sizeDistributionStatus === 'partial'
                        ? 'bg-amber-50 text-amber-600 border border-amber-200'
                        : 'bg-blue-50 text-blue-600 border border-blue-200'
                  }`}
                  title={
                    validation.isFullyDistributed
                      ? 'Size distribution complete'
                      : sizeDistributionStatus === 'partial'
                        ? `Partial: ${distributedQuantity}/${enteredTotalQty}`
                        : 'Size breakdown optional'
                  }
                >
                  {validation.isFullyDistributed
                    ? 'Sizes ✓'
                    : sizeDistributionStatus === 'partial'
                      ? `Sizes ~`
                      : 'Sizes (opt)'}
                </span>
                {/* Cost Sheet pill - required indicator */}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    costSheetValidationLoading
                      ? 'bg-gray-100 text-gray-500'
                      : hasApprovedCostSheet === true
                        ? 'bg-green-100 text-green-700'
                        : hasApprovedCostSheet === false
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-500'
                  }`}
                  title={
                    costSheetValidationLoading
                      ? 'Checking for approved cost sheets...'
                      : hasApprovedCostSheet === true
                        ? 'Approved cost sheet available'
                        : hasApprovedCostSheet === false
                          ? 'No approved cost sheet - Required for order creation'
                          : 'Select a style to check cost sheets'
                  }
                >
                  {costSheetValidationLoading
                    ? 'Cost Sheet...'
                    : hasApprovedCostSheet === true
                      ? 'Cost Sheet ✓'
                      : hasApprovedCostSheet === false
                        ? 'Cost Sheet ✗'
                        : 'Cost Sheet'}
                </span>
                {/* Price pill - optional indicator */}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    validation.hasPricing
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-50 text-amber-600 border border-amber-200'
                  }`}
                  title={validation.hasPricing ? 'Price set' : 'Price pending (optional)'}
                >
                  {validation.hasPricing ? 'Price ✓' : 'Price TBD'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={() => navigate('/orders')} disabled={isLoading}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !validation.isComplete}
                onClick={handleSubmit}
                className="min-w-[140px]"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Saving...
                  </>
                ) : isEditMode ? (
                  'Update Order'
                ) : (
                  'Create Order'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Sheet Comparison Modal */}
      <CostSheetComparisonModal
        isOpen={costSheetDialogOpen}
        onClose={() => setCostSheetDialogOpen(false)}
        costSheets={costSheets}
        selectedStyleCode={selectedStyle?.styleCode}
        selectedStyleName={selectedStyle?.styleName}
        onSelectCostSheet={handleSelectCostSheet}
        loadingCostSheets={loadingCostSheets}
      />
    </div>
  );
}
