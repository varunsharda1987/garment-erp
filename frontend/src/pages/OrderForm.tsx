import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { customerService } from '../services/customer.service';
import { createOrder, getOrderById, updateOrder } from '../services/order.service';
import { styleService } from '../services/style.service';
import type { Customer } from '../types/customer.types';
import type { Style } from '../types/style.types';
import type { Priority, CreateOrderItemBreakup } from '../types/order.types';
import { PriorityLabels } from '../types/order.types';
import { logError } from '../lib/logger';
import {
  Search,
  Package,
  Check,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Building2,
  Palette,
  Hash,
  FileText,
  Sparkles
} from 'lucide-react';

// Extended Style type with color and size options from API
// Backend returns snake_case (color_options, size_options), we map to camelCase
interface StyleWithOptions extends Style {
  colors?: ColorOption[];
  sizes?: SizeOption[];
  styleVariants?: StyleVariantOption[];
  // Backend field names (snake_case)
  color_options?: ColorOption[];
  size_options?: SizeOption[];
  style_variants?: StyleVariantOption[];
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

interface StyleVariantOption {
  id: string;
  sizeName?: string;
  size?: string;
  sku: string;
  isActive: boolean;
}

// Step configuration
const STEPS = [
  { id: 1, name: 'Basics', icon: Building2 },
  { id: 2, name: 'Style', icon: Palette },
  { id: 3, name: 'Quantity', icon: Hash },
  { id: 4, name: 'Review', icon: FileText },
];

export default function OrderForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [customerId, setCustomerId] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [remarks, setRemarks] = useState('');

  // Single style selection (1 style per order)
  const [selectedStyleId, setSelectedStyleId] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<StyleWithOptions | null>(null);
  const [unitPrice, setUnitPrice] = useState('');
  const [breakup, setBreakup] = useState<CreateOrderItemBreakup[]>([]);
  const [colors, setColors] = useState<ColorOption[]>([]);
  const [sizes, setSizes] = useState<SizeOption[]>([]);

  // Style search
  const [styleSearch, setStyleSearch] = useState('');

  // Quantity input mode: 'absolute' | 'percentage' | 'ratio'
  const [quantityMode, setQuantityMode] = useState<'absolute' | 'percentage' | 'ratio'>('absolute');
  const [totalForDistribution, setTotalForDistribution] = useState('');

  // Section expansion state
  const [expandedSections, setExpandedSections] = useState({
    basics: true,
    style: true,
    quantity: true,
    additionalDetails: false,
  });

  // Get today's date for order date
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchCustomers();
    fetchStyles();
    if (isEditMode && id) {
      fetchOrder(id);
    }
  }, [id, isEditMode]);

  const fetchCustomers = async () => {
    try {
      const response = await customerService.getAllCustomers({ limit: 1000 });
      setCustomers(response.data);
    } catch (err) {
      logError('Failed to fetch customers:', err);
    }
  };

  const fetchStyles = async () => {
    try {
      const response = await styleService.getAllStyles(1, 1000);
      setStyles(response.data);
    } catch (err) {
      logError('Failed to fetch styles:', err);
    }
  };

  const fetchOrder = async (orderId: string) => {
    try {
      setIsLoading(true);
      const order = await getOrderById(orderId);

      setCustomerId(order.customerId);
      setExpectedDeliveryDate(order.expectedDeliveryDate.split('T')[0]);
      setPriority(order.priority);
      setPaymentTerms(order.paymentTerms || '');
      setShippingAddress(order.shippingAddress || '');
      setRemarks(order.remarks || '');

      // Load the first (and only) order item
      if (order.orderItems && order.orderItems.length > 0) {
        const item = order.orderItems[0];
        setSelectedStyleId(item.styleId);
        setUnitPrice(item.unitPrice.toString());

        // Load style details
        const fullStyle = await styleService.getStyleById(item.styleId) as StyleWithOptions;
        setSelectedStyle(fullStyle);

        // Get colors from style (handle both camelCase and snake_case from backend)
        const styleColors = fullStyle.colors || fullStyle.color_options || [];
        setColors(styleColors);

        // Get sizes - prefer size_options, fallback to variants
        let styleSizes = fullStyle.sizes || fullStyle.size_options || [];
        const variants = fullStyle.styleVariants || fullStyle.style_variants || [];
        if (styleSizes.length === 0 && variants.length > 0) {
          const uniqueSizes = new Map<string, SizeOption>();
          variants
            .filter(v => v.isActive)
            .forEach(variant => {
              const sizeName = variant.sizeName || variant.size || '';
              if (sizeName && !uniqueSizes.has(sizeName)) {
                uniqueSizes.set(sizeName, {
                  id: variant.id,
                  sizeName: sizeName,
                  sizeCode: sizeName,
                });
              }
            });
          const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL', '4XL', '5XL'];
          styleSizes = Array.from(uniqueSizes.values()).sort((a, b) => {
            const aIdx = sizeOrder.indexOf(a.sizeName);
            const bIdx = sizeOrder.indexOf(b.sizeName);
            if (aIdx === -1 && bIdx === -1) return a.sizeName.localeCompare(b.sizeName);
            if (aIdx === -1) return 1;
            if (bIdx === -1) return -1;
            return aIdx - bIdx;
          });
        }
        setSizes(styleSizes);

        // Load breakup from order - map existing quantities to size grid
        // Build a map of sizeId -> quantity from order breakup
        const breakupMap = new Map<string, number>();
        item.orderItemBreakup.forEach(b => {
          const key = b.colorId ? `${b.colorId}-${b.sizeId}` : b.sizeId;
          breakupMap.set(key, b.quantity);
        });

        // Create breakup array matching the style's color/size structure
        let newBreakup: CreateOrderItemBreakup[];
        if (styleColors.length > 0) {
          newBreakup = styleColors.flatMap((color: ColorOption) =>
            styleSizes.map((size: SizeOption) => ({
              colorId: color.id,
              sizeId: size.id,
              quantity: breakupMap.get(`${color.id}-${size.id}`) || 0,
            }))
          );
        } else {
          newBreakup = styleSizes.map((size: SizeOption) => ({
            colorId: '',
            sizeId: size.id,
            quantity: breakupMap.get(size.id) || 0,
          }));
        }
        setBreakup(newBreakup);
      }

      // Show additional details if any are filled
      if (order.paymentTerms || order.shippingAddress || order.remarks) {
        setExpandedSections(prev => ({ ...prev, additionalDetails: true }));
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setError(errorObj.response?.data?.message || 'Failed to fetch order');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter styles based on search
  const filteredStyles = useMemo(() => {
    if (!styleSearch) return styles.slice(0, 20); // Show first 20 by default
    const search = styleSearch.toLowerCase();
    return styles.filter(
      (style) =>
        style.styleCode.toLowerCase().includes(search) ||
        style.styleName.toLowerCase().includes(search)
    ).slice(0, 20);
  }, [styles, styleSearch]);

  // Handle style selection
  const handleStyleSelect = async (styleId: string) => {
    if (styleId === selectedStyleId) return;

    setSelectedStyleId(styleId);
    setBreakup([]);
    setColors([]);
    setSizes([]);

    try {
      const fullStyle = await styleService.getStyleById(styleId) as StyleWithOptions;
      setSelectedStyle(fullStyle);

      // Handle both camelCase and snake_case from backend
      const styleColors = fullStyle.colors || fullStyle.color_options || [];
      let styleSizes = fullStyle.sizes || fullStyle.size_options || [];
      const variants = fullStyle.styleVariants || fullStyle.style_variants || [];

      // Fallback: If no size_options, extract sizes from styleVariants
      if (styleSizes.length === 0 && variants.length > 0) {
        const uniqueSizes = new Map<string, SizeOption>();
        variants
          .filter(v => v.isActive)
          .forEach(variant => {
            const sizeName = variant.sizeName || variant.size || '';
            if (sizeName && !uniqueSizes.has(sizeName)) {
              uniqueSizes.set(sizeName, {
                id: variant.id,
                sizeName: sizeName,
                sizeCode: sizeName,
              });
            }
          });
        const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL', '4XL', '5XL'];
        styleSizes = Array.from(uniqueSizes.values()).sort((a, b) => {
          const aIdx = sizeOrder.indexOf(a.sizeName);
          const bIdx = sizeOrder.indexOf(b.sizeName);
          if (aIdx === -1 && bIdx === -1) return a.sizeName.localeCompare(b.sizeName);
          if (aIdx === -1) return 1;
          if (bIdx === -1) return -1;
          return aIdx - bIdx;
        });
      }

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
    } catch (err) {
      logError('Failed to fetch style details:', err);
    }
  };

  // Update breakup quantity
  const updateBreakupQuantity = (colorId: string, sizeId: string, quantity: number) => {
    setBreakup((prev) => {
      if (colorId === '') {
        return prev.map((b) => b.sizeId === sizeId ? { ...b, quantity } : b);
      }
      return prev.map((b) =>
        b.colorId === colorId && b.sizeId === sizeId ? { ...b, quantity } : b
      );
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
          const sizeIndex = sizes.findIndex(s => s.id === b.sizeId);
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

  // Apply percentage distribution
  const applyPercentageDistribution = () => {
    const total = parseInt(totalForDistribution);
    if (!total || isNaN(total) || sizes.length === 0) return;

    // Calculate quantities from percentages in breakup
    if (colors.length > 0) {
      const newBreakup = breakup.map((b) => {
        const percentage = Number(b.quantity) || 0;
        return { ...b, quantity: Math.round((percentage / 100) * total) };
      });
      setBreakup(newBreakup);
    } else {
      const newBreakup = breakup.map((b) => {
        const percentage = Number(b.quantity) || 0;
        return { ...b, quantity: Math.round((percentage / 100) * total) };
      });
      setBreakup(newBreakup);
    }
    setQuantityMode('absolute');
  };

  // Apply ratio distribution
  const applyRatioDistribution = () => {
    const total = parseInt(totalForDistribution);
    if (!total || isNaN(total) || sizes.length === 0) return;

    // Calculate total ratio
    const totalRatio = breakup.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
    if (totalRatio === 0) return;

    // Calculate quantities from ratios
    const newBreakup = breakup.map((b) => {
      const ratio = Number(b.quantity) || 0;
      return { ...b, quantity: Math.round((ratio / totalRatio) * total) };
    });
    setBreakup(newBreakup);
    setQuantityMode('absolute');
  };

  // Calculate totals
  const totalQuantity = useMemo(() => {
    return breakup.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
  }, [breakup]);

  const totalAmount = useMemo(() => {
    return totalQuantity * (Number(unitPrice) || 0);
  }, [totalQuantity, unitPrice]);

  // Get selected customer info
  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === customerId);
  }, [customers, customerId]);

  // Validation checks
  const validation = useMemo(() => {
    const checks = {
      customer: !!customerId,
      deliveryDate: !!expectedDeliveryDate,
      style: !!selectedStyleId,
      quantity: totalQuantity > 0,
      unitPrice: !!unitPrice && Number(unitPrice) > 0,
    };

    const completedCount = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;

    return {
      ...checks,
      completedCount,
      totalChecks,
      isComplete: completedCount === totalChecks,
    };
  }, [customerId, expectedDeliveryDate, selectedStyleId, totalQuantity, unitPrice]);

  // Get current step based on completion
  const currentStep = useMemo(() => {
    if (!validation.customer || !validation.deliveryDate) return 1;
    if (!validation.style) return 2;
    if (!validation.quantity || !validation.unitPrice) return 3;
    return 4;
  }, [validation]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (!validation.isComplete) {
        setError('Please complete all required fields');
        setIsLoading(false);
        return;
      }

      const validBreakup = breakup.filter((b) => b.quantity > 0);

      const orderData = {
        customerId,
        expectedDeliveryDate,
        priority,
        paymentTerms: paymentTerms || undefined,
        shippingAddress: shippingAddress || undefined,
        remarks: remarks || undefined,
        items: [
          {
            styleId: selectedStyleId,
            unitPrice,
            breakup: validBreakup,
          },
        ],
      };

      if (isEditMode && id) {
        await updateOrder(id, {
          expectedDeliveryDate,
          priority,
          paymentTerms: paymentTerms || undefined,
          shippingAddress: shippingAddress || undefined,
          remarks: remarks || undefined,
        });
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
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="p-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {isEditMode ? 'Edit Order' : 'Create New Order'}
          </h1>
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
              {/* Customer Selection */}
              <div className="w-[220px]">
                <Label className="text-sm font-medium text-gray-700">
                  Customer <span className="text-red-500">*</span>
                </Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        <span className="font-medium">{customer.code}</span>
                        <span className="text-gray-500 ml-2">{customer.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Style Selection - Searchable dropdown */}
              <div className="flex-1 min-w-[250px] max-w-[350px]">
                <Label className="text-sm font-medium text-gray-700">
                  Style <span className="text-red-500">*</span>
                </Label>
                <div className="relative mt-1.5">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                  <Select
                    value={selectedStyleId}
                    onValueChange={(value) => handleStyleSelect(value)}
                  >
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
                            {style.image ? (
                              <img
                                src={style.image.startsWith('http') ? style.image : `${import.meta.env.VITE_API_URL || ''}/${style.image}`}
                                alt={style.styleName}
                                className="w-6 h-6 object-cover rounded"
                              />
                            ) : (
                              <Package className="h-4 w-4 text-gray-400" />
                            )}
                            <span className="font-medium">{style.styleCode}</span>
                            <span className="text-gray-500 text-xs">{style.styleName}</span>
                          </div>
                        </SelectItem>
                      ))}
                      {filteredStyles.length === 0 && (
                        <div className="py-4 text-center text-sm text-gray-500">
                          No styles found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Order Date */}
              <div className="w-[140px]">
                <Label className="text-sm font-medium text-gray-700">Order Date</Label>
                <Input
                  type="date"
                  value={today}
                  disabled
                  className="mt-1.5 bg-gray-50"
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

              {/* Summary Badge */}
              {totalQuantity > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200 h-10">
                  <span className="text-sm font-semibold text-green-700">
                    {totalQuantity.toLocaleString()} pcs
                  </span>
                  {unitPrice && Number(unitPrice) > 0 && (
                    <>
                      <span className="text-green-300">|</span>
                      <span className="text-sm font-semibold text-green-700">
                        ₹{totalAmount.toLocaleString()}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Selected Style Info */}
            {selectedStyle && (
              <div className="mt-4 flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                {selectedStyle.image ? (
                  <img
                    src={selectedStyle.image.startsWith('http') ? selectedStyle.image : `${import.meta.env.VITE_API_URL || ''}/${selectedStyle.image}`}
                    alt={selectedStyle.styleName}
                    className="w-10 h-10 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Package className="h-5 w-5 text-blue-500" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm text-blue-900">{selectedStyle.styleCode}</p>
                  <p className="text-xs text-blue-700">{selectedStyle.styleName}</p>
                </div>
                {sizes.length > 0 && (
                  <div className="ml-auto text-xs text-blue-600">
                    {colors.length > 0 ? `${colors.length} colors × ` : ''}{sizes.length} sizes
                  </div>
                )}
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
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                validation.quantity && validation.unitPrice
                  ? 'bg-green-100 text-green-600'
                  : 'bg-orange-100 text-orange-600'
              }`}>
                {validation.quantity && validation.unitPrice ? (
                <Check className="h-5 w-5" />
              ) : (
                <Hash className="h-5 w-5" />
              )}
            </div>
            <div className="text-left flex-1">
              <div className="flex items-center gap-4 flex-wrap">
                <h3 className="font-semibold text-gray-900">Quantity & Pricing</h3>
                {totalQuantity > 0 && (
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded font-medium">
                      {totalQuantity.toLocaleString()} pcs
                    </span>
                    {unitPrice && Number(unitPrice) > 0 && (
                      <>
                        <span className="text-gray-400">•</span>
                        <span>@ ₹{Number(unitPrice).toLocaleString()}/pc</span>
                        <span className="text-gray-400">•</span>
                        <span className="font-semibold text-green-600">
                          Total: ₹{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
              {totalQuantity === 0 && (
                <p className="text-sm text-gray-500">Enter quantities per size</p>
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
                        onClick={() => setQuantityMode('absolute')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                          quantityMode === 'absolute'
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        Absolute
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuantityMode('percentage')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                          quantityMode === 'percentage'
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        Percentage
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuantityMode('ratio')}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                          quantityMode === 'ratio'
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        Ratio
                      </button>
                    </div>

                    {/* Total Input for Percentage/Ratio modes */}
                    {(quantityMode === 'percentage' || quantityMode === 'ratio') && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">Total Qty:</label>
                        <Input
                          type="number"
                          value={totalForDistribution}
                          onChange={(e) => setTotalForDistribution(e.target.value)}
                          placeholder="Enter total"
                          className="w-32 h-9"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={quantityMode === 'percentage' ? applyPercentageDistribution : applyRatioDistribution}
                          disabled={!totalForDistribution}
                        >
                          Apply
                        </Button>
                      </div>
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
                        ? 'Enter percentage for each size (should total 100%), then enter total quantity and click Apply.'
                        : 'Enter ratio values (e.g., 1:2:3), then enter total quantity and click Apply.'}
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
                            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border">
                              Color
                            </th>
                            {sizes.map((size) => (
                              <th key={size.id} className="px-3 py-2 text-center text-xs font-semibold text-gray-600 border min-w-[80px]">
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
                                  return (
                                    <td key={size.id} className="px-1 py-1 border">
                                      <Input
                                        type="number"
                                        min="0"
                                        value={breakupItem?.quantity || 0}
                                        onChange={(e) =>
                                          updateBreakupQuantity(
                                            color.id,
                                            size.id,
                                            parseInt(e.target.value) || 0
                                          )
                                        }
                                        className="text-center h-9 text-sm"
                                      />
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
                              {totalQuantity}
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
                          return (
                            <div key={size.id} className="w-20 flex-shrink-0 space-y-1.5">
                              <label className="block text-center text-sm font-medium text-gray-700">
                                {size.sizeName}
                              </label>
                              <Input
                                type="number"
                                min="0"
                                value={breakupItem?.quantity || 0}
                                onChange={(e) =>
                                  updateBreakupQuantity(
                                    '',
                                    size.id,
                                    parseInt(e.target.value) || 0
                                  )
                                }
                                className="text-center h-10"
                              />
                            </div>
                          );
                        })}
                        {/* Total Column */}
                        <div className="w-24 flex-shrink-0 space-y-1.5">
                          <label className="block text-center text-sm font-semibold text-gray-900">
                            Total
                          </label>
                          <div className="h-10 flex items-center justify-center bg-blue-50 border border-blue-200 rounded-md text-blue-700 font-bold">
                            {totalQuantity.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pricing Section - Dark Theme */}
                  <div className="mt-6 bg-gray-900 rounded-xl p-6 text-white">
                    <h4 className="text-sm font-medium text-gray-400 mb-4">Pricing Summary</h4>
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Unit Price (₹)</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={unitPrice}
                          onChange={(e) => setUnitPrice(e.target.value)}
                          placeholder="0.00"
                          className="bg-gray-800 border-gray-700 text-white text-lg font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Total Quantity</label>
                        <div className="h-10 px-3 bg-gray-800 border border-gray-700 rounded-md flex items-center text-lg font-semibold">
                          {totalQuantity.toLocaleString()} pcs
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Total Amount</label>
                        <div className="h-10 px-3 bg-green-900/50 border border-green-700 rounded-md flex items-center text-lg font-bold text-green-400">
                          ₹{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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

      {/* Additional Details Section */}
      <div className="bg-white rounded-xl border shadow-sm mb-6 overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('additionalDetails')}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 text-gray-600">
              <FileText className="h-5 w-5" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900">Additional Details</h3>
              <p className="text-sm text-gray-500">Optional information</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Optional</span>
            {expandedSections.additionalDetails ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </button>

        {expandedSections.additionalDetails && (
          <div className="px-6 pb-6 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
              <div>
                <Label className="text-sm font-medium text-gray-700">Payment Terms</Label>
                <Input
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="e.g., Net 30 Days"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">Priority</Label>
                <Select value={priority} onValueChange={(value) => setPriority(value as Priority)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PriorityLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label className="text-sm font-medium text-gray-700">Shipping Address</Label>
                <Textarea
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  rows={2}
                  className="mt-1.5"
                  placeholder="Enter shipping address..."
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-sm font-medium text-gray-700">Remarks</Label>
                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  className="mt-1.5"
                  placeholder="Any additional notes..."
                />
              </div>
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
                <span className={`text-sm font-medium ${
                  validation.isComplete ? 'text-green-700' : 'text-amber-700'
                }`}>
                  {validation.completedCount}/{validation.totalChecks} required fields
                </span>
              </div>

              {/* Mini validation pills */}
              <div className="hidden sm:flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  validation.customer ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  Customer
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  validation.style ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  Style
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  validation.quantity ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  Qty
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  validation.unitPrice ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  Price
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/orders')}
                disabled={isLoading}
              >
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
    </div>
  );
}
