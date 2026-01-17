/**
 * StyleForm - Redesigned (Phase 4)
 *
 * 4-tab workflow:
 * 1. Basic Info + Additional Details (expandable)
 * 2. Fabrics (uses GenericFabricSelector)
 * 3. Trims & Materials (Buttons, Zippers, Lace, Thread, etc.)
 * 4. Accessories (Garment & Packaging Accessories)
 *
 * Key Changes:
 * - Generic Fabric Name instead of Greige Name (user selects greige later in CAD planning)
 * - Fabric Finish Type selector (DYED, PRINTED, YARN_DYED, RAW)
 * - Customer Accessory Presets auto-populate
 * - Unified Material BOM system
 * - CAD status tracking (PENDING by default)
 * - Thread auto-added
 * - Standard processes (Cutting, Stitching, Finishing, Transportation) assumed for all styles
 * - Embroidery captured in Fabrics tab
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import { styleService } from '../services/style.service';
import { customerService, type AccessoryPreset, type AccessoryPresetItem } from '../services/customer.service';
import { bulkAddLabelsToStyle } from '../services/styleLabel.service';
import type { CreateStyleLabelInput } from '../types/styleLabel.types';
import { getAllPresetsForCustomer, getDefaultPreset } from '../services/customerSizePreset.service';
import type { CustomerSizePreset } from '../types/customerSizePreset.types';
import { getAllComponentMasters, getCategories } from '../services/componentMaster.service';
import { productCategoryService } from '../services/productCategory.service';
import { componentGroupService } from '../services/componentGroup.service';
import type { ComponentMaster } from '../types/componentMaster.types';
import type { ProductCategory, ComponentSuggestion } from '../types/productCategory.types';
import type { ComponentGroup } from '../types/componentGroup.types';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
import { Badge } from '../components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../components/ui/command';
import { GenericFabricSelector } from '../components/GenericFabricSelector';
// MaterialBOMPicker removed - using TrimSelector and AccessorySelector instead
import { EmbroiderySelector } from '../components/EmbroiderySelector';
import { TrimSelector } from '../components/TrimSelector';
import type { StyleTrim } from '../components/TrimSelector';
import { AccessorySelector } from '../components/AccessorySelector';
import type { StyleAccessory } from '../components/AccessorySelector';
import { CADGroupPreview } from '../components/CADGroupPreview';
import type { EmbroiderySearchResult } from '../types/embroidery.types';
import type { Customer, BrandCategory } from '../types/customer.types';
// MaterialType and MaterialUsageCategory imports removed - using simplified data structures
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Info,
  AlertCircle,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { notify } from '../lib/notify';
import { cn } from '../lib/utils';
import { getUploadUrl } from '../config/api.config';

// Enums
type FabricFinishType = 'DYED' | 'PRINTED' | 'YARN_DYED' | 'RAW';
type CADStatus = 'PENDING' | 'IN_PROGRESS' | 'APPROVED';

interface FabricEntry {
  id: string;
  componentIndex: number; // Index into selectedComponents array
  componentName: string; // Derived from selectedComponents for display/saving
  genericFabricName: string;
  fabricFinishType: FabricFinishType | '';
  // Embroidery support
  hasEmbroidery?: boolean;
  embroideryId?: string | null;
  embroideryName?: string | null;
  embroideryCode?: string | null;
  // REMOVED: estimatedConsumption, unit, notes, usableWidth, allowCombinedCutting
  // These are now handled in CAD Planning stage
}

interface SKUVariant {
  size: string;
  sku: string;
  barcode?: string;
  isActive: boolean;
}

const FABRIC_FINISH_TYPES: { value: FabricFinishType; label: string }[] = [
  { value: 'DYED', label: 'Solid Dyed' },
  { value: 'PRINTED', label: 'Printed' },
  { value: 'YARN_DYED', label: 'Yarn Dyed (Checks/Stripes)' },
  { value: 'RAW', label: 'Raw/Unfinished' },
];

const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export default function StyleFormRedesigned() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const currentUser = useAuthStore((state) => state.user);
  const isEditMode = !!id;

  // State
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);

  // Tab 1: Basic Info
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<BrandCategory[]>([]);
  const [customerAccessoryPresets, setCustomerAccessoryPresets] = useState<AccessoryPreset[]>([]);
  const [presetItemIds, setPresetItemIds] = useState<Set<string>>(new Set()); // Track which accessories came from preset
  const [styleSpecificIds, setStyleSpecificIds] = useState<Set<string>>(new Set()); // Track manually added accessories

  // Size Category Presets
  const [customerSizePresets, setCustomerSizePresets] = useState<CustomerSizePreset[]>([]);
  const [selectedSizePresetId, setSelectedSizePresetId] = useState('');
  const [presetSizeIds, setPresetSizeIds] = useState<Set<string>>(new Set()); // Track which sizes came from preset

  // Label configs from preset (to be saved after style creation)
  const [pendingLabelConfigs, setPendingLabelConfigs] = useState<CreateStyleLabelInput[]>([]);
  const [presetLabelIds, setPresetLabelIds] = useState<Set<string>>(new Set()); // Track which labels came from preset

  const [styleCode, setStyleCode] = useState('');
  const [styleName, setStyleName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [category, setCategory] = useState('');
  const [brandCategoryId, setBrandCategoryId] = useState('');
  const [season, setSeason] = useState('');
  const [description, setDescription] = useState('');

  // Product Category (global category master)
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [productSubCategories, setProductSubCategories] = useState<Record<string, ProductCategory[]>>({});
  const [productSubSubCategories, setProductSubSubCategories] = useState<Record<string, ProductCategory[]>>({});
  const [selectedProductCategoryL1, setSelectedProductCategoryL1] = useState('');
  const [selectedProductCategoryL2, setSelectedProductCategoryL2] = useState('');
  const [selectedProductCategoryL3, setSelectedProductCategoryL3] = useState('');
  const [productCategoryId, setProductCategoryId] = useState(''); // Final selected category ID

  // Additional Details (Template Fields)
  const [numberOfComponents, setNumberOfComponents] = useState(1);
  const [costPrice, setCostPrice] = useState<number | ''>('');  // COST in template
  const [sellingPrice, setSellingPrice] = useState<number | ''>('');  // MRP in template
  const [expectedOrderQty, setExpectedOrderQty] = useState<number | ''>('');
  const [remarks, setRemarks] = useState('');  // Changed from specifications
  const [hsnCode, setHsnCode] = useState('');
  const [productTaxRule, setProductTaxRule] = useState('');
  const [bulletPoints, setBulletPoints] = useState('');
  const [accountingUnit, setAccountingUnit] = useState('Units');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null); // For new styles before save
  const [pendingImagePreview, setPendingImagePreview] = useState<string>(''); // Preview URL for pending image

  // Component Masters
  const [componentMasters, setComponentMasters] = useState<ComponentMaster[]>([]);
  const [componentGroups, setComponentGroups] = useState<ComponentGroup[]>([]);
  const [componentCategories, setComponentCategories] = useState<string[]>([]);
  const [selectedComponents, setSelectedComponents] = useState<Array<{ category: string; componentId: string }>>([]);
  const [openComponentPopovers, setOpenComponentPopovers] = useState<Record<number, boolean>>({});
  const [categoryComponentIds, setCategoryComponentIds] = useState<Set<string>>(new Set()); // Components allowed for selected category

  // Tab 2: Size & SKU
  const [skuVariants, setSkuVariants] = useState<SKUVariant[]>(
    DEFAULT_SIZES.map(size => ({
      size,
      sku: '',
      barcode: '',
      isActive: true
    }))
  );

  // Tab 3: Fabrics & Trims
  // Start with empty fabrics - will be populated per component
  const [fabrics, setFabrics] = useState<FabricEntry[]>([]);
  const [expandedComponents, setExpandedComponents] = useState<number[]>([0]); // Track which component sections are expanded
  const [selectedTrims, setSelectedTrims] = useState<StyleTrim[]>([]); // New simplified trim selection
  const [embroideryPickerOpen, setEmbroideryPickerOpen] = useState(false);
  const [embroideryPickerFabricId, setEmbroideryPickerFabricId] = useState<string | null>(null);

  // Tab 4: Accessories
  const [selectedAccessoryPresetId, setSelectedAccessoryPresetId] = useState('');
  const [selectedAccessories, setSelectedAccessories] = useState<StyleAccessory[]>([]);

  // Restore Dialog State (for handling deleted style code conflicts)
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [deletedStyleInfo, setDeletedStyleInfo] = useState<{
    id: string;
    styleName: string;
    styleCode: string;
  } | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Compute selected product category with min/max component constraints
  const selectedProductCategory = useMemo(() => {
    if (!productCategoryId) return null;

    // Search in all levels
    const findCategory = (id: string): ProductCategory | null => {
      // Check L1
      const l1 = productCategories.find(c => c.id === id);
      if (l1) return l1;

      // Check L2
      for (const l2List of Object.values(productSubCategories)) {
        const l2 = l2List.find(c => c.id === id);
        if (l2) return l2;
      }

      // Check L3
      for (const l3List of Object.values(productSubSubCategories)) {
        const l3 = l3List.find(c => c.id === id);
        if (l3) return l3;
      }

      return null;
    };

    return findCategory(productCategoryId);
  }, [productCategoryId, productCategories, productSubCategories, productSubSubCategories]);

  // Load customers, component masters, and product categories on mount
  useEffect(() => {
    loadCustomers();
    loadComponentMasters();
    loadProductCategories();
  }, []);

  // Re-fetch suggested components when componentMasters loads and a product category is already selected
  useEffect(() => {
    if (componentMasters.length > 0 && productCategoryId && categoryComponentIds.size === 0) {
      // Component masters just loaded, but we have a product category selected and no filter set yet
      // This handles the race condition where category was selected before components loaded
      updateProductCategoryId(selectedProductCategoryL1, selectedProductCategoryL2, selectedProductCategoryL3, false);
    }
  }, [componentMasters.length]);

  // Load main product categories
  const loadProductCategories = async () => {
    try {
      const categories = await productCategoryService.getMainCategories();
      setProductCategories(categories);

      // Preload all L2 sub-categories for each main category
      const subCategoriesMap: Record<string, ProductCategory[]> = {};
      await Promise.all(
        categories.map(async (cat) => {
          try {
            const children = await productCategoryService.getChildren(cat.id);
            if (children.length > 0) {
              subCategoriesMap[cat.id] = children;
            }
          } catch (error) {
            console.error(`Failed to load sub-categories for ${cat.name}:`, error);
          }
        })
      );
      setProductSubCategories(subCategoriesMap);
    } catch (error) {
      console.error('Failed to load product categories:', error);
    }
  };

  // Load product sub-categories when L1 is selected
  const loadProductSubCategories = async (parentId: string) => {
    if (!parentId || productSubCategories[parentId]) return;
    try {
      const children = await productCategoryService.getChildren(parentId);
      setProductSubCategories(prev => ({ ...prev, [parentId]: children }));
    } catch (error) {
      console.error('Failed to load product sub-categories:', error);
    }
  };

  // Load product sub-sub-categories when L2 is selected
  const loadProductSubSubCategories = async (parentId: string) => {
    if (!parentId || productSubSubCategories[parentId]) return;
    try {
      const children = await productCategoryService.getChildren(parentId);
      setProductSubSubCategories(prev => ({ ...prev, [parentId]: children }));
    } catch (error) {
      console.error('Failed to load product sub-sub-categories:', error);
    }
  };

  // Determine final product category ID from selections and auto-populate components
  const updateProductCategoryId = async (l1: string, l2: string, l3: string, autoPopulateComponents: boolean = true) => {
    const finalCategoryId = l3 || l2 || l1;
    setProductCategoryId(finalCategoryId);

    // Fetch suggested components for this category (for filtering the dropdown)
    if (finalCategoryId && componentMasters.length > 0) {
      try {
        const suggestions = await productCategoryService.getSuggestedComponents(finalCategoryId);

        // Store the allowed component IDs for this category
        const allowedIds = new Set(suggestions.map(s => s.componentMasterId));
        setCategoryComponentIds(allowedIds);

        // Auto-populate components (only for new styles, not edit mode)
        if (autoPopulateComponents && !isEditMode && suggestions.length > 0) {
          applyComponentSuggestions(suggestions);
        }
      } catch (error) {
        console.error('Failed to fetch component suggestions:', error);
        // Clear the filter if we can't get suggestions
        setCategoryComponentIds(new Set());
      }
    } else {
      // No category selected - clear the filter
      setCategoryComponentIds(new Set());
    }
  };

  // Apply component suggestions from product category defaults
  const applyComponentSuggestions = (suggestions: ComponentSuggestion[]) => {
    // Set the number of components
    setNumberOfComponents(suggestions.length);

    // Map suggestions to selectedComponents format
    const newComponents = suggestions.map(suggestion => {
      // Find the component master to get its category
      const componentMaster = componentMasters.find(cm => cm.id === suggestion.componentMasterId);
      return {
        category: componentMaster?.componentCategory || suggestion.componentMaster.componentCategory || '',
        componentId: suggestion.componentMasterId,
      };
    });

    setSelectedComponents(newComponents);

    // Clear existing fabrics and create new ones for each component
    const newFabrics = newComponents.map((comp, index) => {
      const componentMaster = componentMasters.find(cm => cm.id === comp.componentId);
      return {
        id: `temp-${Date.now()}-${index}`,
        componentIndex: index,
        componentName: componentMaster?.name || '',
        genericFabricName: '',
        fabricFinishType: '' as FabricFinishType | '',
        hasEmbroidery: false,
        embroideryId: null,
        embroideryName: null,
        embroideryCode: null,
      };
    });
    setFabrics(newFabrics);

    // Show notification about auto-population
    const inheritedNote = suggestions[0]?.sourceCategory?.isInherited
      ? ` (inherited from ${suggestions[0].sourceCategory.name})`
      : '';
    notify.success(`Auto-populated ${suggestions.length} component(s) for this category${inheritedNote}`);
  };

  // Track if style has been loaded to prevent double-loading in React Strict Mode
  const styleLoadedRef = React.useRef(false);
  // Track if initial load is complete to prevent useEffects from overwriting loaded data
  const initialLoadCompleteRef = React.useRef(false);

  // Load style data in edit mode - wait for both customers AND componentMasters to be loaded
  useEffect(() => {
    if (isEditMode && id && customers.length > 0 && componentMasters.length > 0 && !styleLoadedRef.current) {
      styleLoadedRef.current = true;
      loadStyleData(id).then(() => {
        // Mark initial load as complete after a short delay to allow state to settle
        setTimeout(() => {
          initialLoadCompleteRef.current = true;
        }, 100);
      });
    }
  }, [isEditMode, id, customers.length, componentMasters.length]);

  // Load customer brands when customer selected - MATCHES OLD STYLEFORM
  // NOTE: This effect only populates availableBrands - it does NOT reset brandName
  // The reset is handled by handleCustomerChange when user manually changes customer
  useEffect(() => {
    // Skip this effect during initial edit mode load - loadStyleData handles it
    if (isEditMode && !initialLoadCompleteRef.current) {
      return;
    }

    if (selectedCustomerId) {
      const customer = customers.find(c => c.id === selectedCustomerId);
      if (customer) {
        // Use customer.name directly (same as old StyleForm)
        setCustomerName(customer.name);

        // Extract brands from brandCategories (same as old StyleForm)
        if (customer.brandCategories && Array.isArray(customer.brandCategories) && customer.brandCategories.length > 0) {
          const uniqueBrands = [...new Set(customer.brandCategories.map((bc: BrandCategory) => bc.brandName))];
          setAvailableBrands(uniqueBrands);

          // In edit mode, if brandName is already set but availableCategories is empty, populate them
          if (isEditMode && brandName && availableCategories.length === 0) {
            const brandCategories = customer.brandCategories
              .filter((bc: BrandCategory) => bc.brandName === brandName);
            setAvailableCategories(brandCategories);
          }
        } else if (customer.brandNames) {
          // Fallback to old format (same as old StyleForm)
          const brands = customer.brandNames.split('\n').map((b: string) => b.trim()).filter((b: string) => b);
          setAvailableBrands(brands);
        } else {
          setAvailableBrands([]);
        }

        loadAccessoryPresets(selectedCustomerId);
        loadSizePresets(selectedCustomerId);
      }
    }
  }, [selectedCustomerId, customers]);

  // Handler for when user manually changes customer - resets brand and category
  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    // Reset brand-related fields when user changes customer
    setBrandName('');
    setCategory('');
    setBrandCategoryId('');
    setAvailableCategories([]);
  };

  // Load brand categories when brand is selected
  useEffect(() => {
    // Skip this effect during initial edit mode load - loadStyleData handles it
    if (isEditMode && !initialLoadCompleteRef.current) {
      return;
    }

    if (selectedCustomerId && brandName) {
      const customer = customers.find(c => c.id === selectedCustomerId);
      if (customer?.brandCategories) {
        // Filter brand categories for the selected brand
        const brandCategories = customer.brandCategories
          .filter((bc: BrandCategory) => bc.brandName === brandName);

        // Store full BrandCategory objects (no need to extract just names)
        setAvailableCategories(brandCategories);

        // Only reset category if user manually changed brand (not during edit mode initial load)
        // Check if current brandCategoryId is still valid for this brand
        if (!isEditMode) {
          const categoryStillValid = brandCategories.some((bc: BrandCategory) => bc.id === brandCategoryId);
          if (brandCategoryId && !categoryStillValid) {
            setCategory('');
            setBrandCategoryId('');
          }
        }
      } else {
        setAvailableCategories([]);
      }
    } else {
      setAvailableCategories([]);
      if (!brandName && !isEditMode) {
        setCategory('');
        setBrandCategoryId('');
      }
    }
  }, [brandName, selectedCustomerId, customers]);

  const loadCustomers = async () => {
    try {
      const response = await customerService.getAllCustomers({ limit: 1000 });
      setCustomers(response.data);
    } catch (error) {
      console.error('Failed to load customers:', error);
      notify.error('Failed to load customers');
    }
  };

  const loadComponentMasters = async () => {
    try {
      const [mastersResponse, categoriesResponse, groupsResponse] = await Promise.all([
        getAllComponentMasters({ activeOnly: true, limit: 1000 }),
        getCategories(),
        componentGroupService.getAll({ page: 1, limit: 100, isActive: true })
      ]);
      setComponentMasters(mastersResponse.data);
      setComponentCategories(categoriesResponse);
      setComponentGroups(groupsResponse.data);
    } catch (error) {
      console.error('Failed to load component masters:', error);
      notify.error('Failed to load component masters');
    }
  };

  const loadStyleData = async (styleId: string) => {
    try {
      setLoading(true);
      const style = await styleService.getStyleById(styleId);

      // DEBUG: Log what backend returned for brand fields
      console.log('=== STYLE LOADED FROM BACKEND ===');
      console.log('brandName:', style.brandName);
      console.log('brandCategoryId:', style.brandCategoryId);
      // Note: backend serializer converts brand_categories to brandCategories (camelCase)
      console.log('brandCategories:', style.brandCategories);
      console.log('customerName:', style.customerName);
      console.log('numberOfComponents:', style.numberOfComponents);

      // Populate basic info
      setStyleCode(style.styleCode);
      setStyleName(style.styleName || '');
      setDescription(style.description || '');
      // Note: category is set from brand_categories relation, not from style.category
      // brandCategoryId is set later after customer matching
      // setBrandCategoryId is set after customer/brand matching to ensure availableCategories is populated first
      setSeason(style.season || '');

      // Product Category
      if (style.productCategoryId) {
        // Load the category path to populate cascading selectors
        try {
          const path = await productCategoryService.getCategoryPath(style.productCategoryId);
          if (path.length > 0) {
            setSelectedProductCategoryL1(path[0]?.id || '');
            if (path[0]?.id) await loadProductSubCategories(path[0].id);
            if (path.length > 1) {
              setSelectedProductCategoryL2(path[1]?.id || '');
              if (path[1]?.id) await loadProductSubSubCategories(path[1].id);
            }
            if (path.length > 2) {
              setSelectedProductCategoryL3(path[2]?.id || '');
            }

            // Fetch suggested components for filtering the dropdown (don't auto-populate in edit mode)
            await updateProductCategoryId(
              path[0]?.id || '',
              path[1]?.id || '',
              path[2]?.id || '',
              false // Don't auto-populate components in edit mode
            );
          }
        } catch (error) {
          console.error('Failed to load product category path:', error);
        }
      }

      // Template fields (Additional Details)
      setCostPrice(style.costPrice || '');
      setSellingPrice(style.sellingPrice || '');
      setExpectedOrderQty(style.expectedOrderQty || '');
      setRemarks(style.specifications || '');  // Using specifications field for remarks
      setHsnCode(style.hsnCode || '');
      setProductTaxRule(style.productTaxRule || '');
      setBulletPoints(style.bulletPoints || '');
      setAccountingUnit(style.accountingUnit || 'Units');
      setImageUrl(style.imageUrl || '');

      // Save brand/category info from style (will set state later after populating options)
      const savedBrandName = style.brandName || '';
      const savedBrandCategoryId = style.brandCategoryId || '';
      // Note: backend serializer converts brand_categories to brandCategories (camelCase)
      const savedCategoryName = style.brandCategories?.category || '';

      // Don't set brandName/brandCategoryId yet - wait until availableBrands is populated
      // to avoid React Select validation issues

      // Find and set customer by name
      const matchingCustomer = customers.find(c => c.name === style.customerName);
      console.log('=== CUSTOMER LOOKUP ===');
      console.log('Looking for customer:', style.customerName);
      console.log('Found customer:', matchingCustomer?.name);
      console.log('Customer brandCategories:', matchingCustomer?.brandCategories);

      // If customer found but brandCategories not populated, fetch customer details
      let customerWithBrands = matchingCustomer;
      if (matchingCustomer && (!matchingCustomer.brandCategories || matchingCustomer.brandCategories.length === 0)) {
        console.log('Customer found but brandCategories not populated, fetching customer details...');
        try {
          const customerDetails = await customerService.getCustomerById(matchingCustomer.id);
          customerWithBrands = customerDetails;
          console.log('Fetched customer details, brandCategories:', customerDetails.brandCategories);
        } catch (error) {
          console.error('Failed to fetch customer details:', error);
        }
      }

      if (customerWithBrands) {
        // Set customer ID and name
        setSelectedCustomerId(customerWithBrands.id);
        setCustomerName(customerWithBrands.name);

        // Load accessory and size presets for this customer
        const presets = await loadAccessoryPresets(customerWithBrands.id);
        loadSizePresets(customerWithBrands.id);

        // If style has a saved preset ID, restore it and apply the preset
        console.log('[loadStyleData] customerAccessoriesPresetId:', style.customerAccessoriesPresetId);
        console.log('[loadStyleData] Available presets:', presets);
        if (style.customerAccessoriesPresetId && presets) {
          setSelectedAccessoryPresetId(style.customerAccessoriesPresetId);
          // Find and apply the preset
          const savedPreset = presets.find((p: AccessoryPreset) => p.id === style.customerAccessoriesPresetId);
          console.log('[loadStyleData] Found saved preset:', savedPreset);
          if (savedPreset) {
            applyPresetToAccessories(savedPreset);
          }
        }

        // Populate available brands from customer's brandCategories
        if (customerWithBrands.brandCategories && Array.isArray(customerWithBrands.brandCategories) && customerWithBrands.brandCategories.length > 0) {
          const uniqueBrands = [...new Set(customerWithBrands.brandCategories.map((bc: BrandCategory) => bc.brandName))];
          console.log('Setting availableBrands to:', uniqueBrands);
          setAvailableBrands(uniqueBrands);

          // NOW set the brand name after options are available
          if (savedBrandName) {
            setBrandName(savedBrandName);
          }

          // Populate available categories for the saved brand
          if (savedBrandName) {
            const brandCategories = customerWithBrands.brandCategories.filter(
              (bc: BrandCategory) => bc.brandName === savedBrandName
            );
            setAvailableCategories(brandCategories);

            // If brandCategoryId is present, verify it exists in availableCategories
            // and update category name from customer data (in case it was renamed)
            if (savedBrandCategoryId) {
              const matchingBrandCategory = brandCategories.find(
                (bc: BrandCategory) => bc.id === savedBrandCategoryId
              );
              if (matchingBrandCategory) {
                // Update category name from customer's current data
                setCategory(matchingBrandCategory.category);
                // NOW set the brand category ID after options are available
                setBrandCategoryId(savedBrandCategoryId);
                console.log('Style loaded - Brand:', savedBrandName, 'Category ID:', savedBrandCategoryId, 'Category:', matchingBrandCategory.category);
              } else {
                console.log('Style loaded - BrandCategoryId not found in customer data, using saved values');
                // Fallback: still set the values even if not found in current data
                setBrandCategoryId(savedBrandCategoryId);
                setCategory(savedCategoryName);
              }
            }
          }
        } else {
          // Customer exists but has no brandCategories - create single-item list from saved brand
          if (savedBrandName) {
            setAvailableBrands([savedBrandName]);
            setBrandName(savedBrandName);
            setBrandCategoryId(savedBrandCategoryId);
            setCategory(savedCategoryName);
          }
        }
      } else {
        // No matching customer found - still try to show the saved brand
        setCustomerName(style.customerName || '');
        if (savedBrandName) {
          setAvailableBrands([savedBrandName]);
          setBrandName(savedBrandName);
          setBrandCategoryId(savedBrandCategoryId);
          setCategory(savedCategoryName);
        }
        console.log('Style loaded - Customer not found, using saved values:', savedBrandName, savedBrandCategoryId, savedCategoryName);
      }

      // Load SKU variants if available (from style_variants table)
      const skuVariantsData = style.styleVariants || style.styleSkuVariants || style.skuVariants || [];
      if (skuVariantsData.length > 0) {
        setSkuVariants(skuVariantsData.map((sku: { sizeName?: string; size?: string; sku: string; barcode?: string; isActive?: boolean }) => ({
          size: sku.sizeName || sku.size,
          sku: sku.sku,
          barcode: sku.barcode || '',
          isActive: sku.isActive !== false
        })));
      }

      // Load fabrics if available (check both old 'fabrics' and new 'styleFabricsFlat')
      const fabricsData = style.styleFabricsFlat || style.fabrics || [];
      if (fabricsData.length > 0) {
        // Map component names to indices based on loaded components
        const loadedComponents = style.components || [];
        setFabrics(fabricsData.map((sf: {
          id?: string;
          componentName?: string;
          componentIndex?: number;
          genericFabricName?: string;
          fabricFinishType?: string;
          hasEmbroidery?: boolean;
          embroideryId?: string;
          embroidery?: { designName?: string; embroideryCode?: string };
        }) => {
          // Try to find component index from name
          let componentIndex = sf.componentIndex ?? 0;
          if (sf.componentName && loadedComponents.length > 0) {
            const foundIndex = loadedComponents.findIndex(
              (c: { componentName?: string }) => c.componentName === sf.componentName
            );
            if (foundIndex >= 0) {
              componentIndex = foundIndex;
            }
          }
          return {
            id: sf.id || crypto.randomUUID(),
            componentIndex,
            componentName: sf.componentName || '',
            genericFabricName: sf.genericFabricName || '',
            fabricFinishType: sf.fabricFinishType || '',
            // Embroidery support
            hasEmbroidery: sf.hasEmbroidery || false,
            embroideryId: sf.embroideryId || null,
            embroideryName: sf.embroidery?.designName || null,
            embroideryCode: sf.embroidery?.embroideryCode || null,
          };
        }));
      }

      // Load material BOM (trims) if available
      // The backend includes specific material masters (laceMaster, buttonMaster, etc.)
      // We need to extract the name and code from the appropriate master based on materialType
      if (style.styleMaterialBom && style.styleMaterialBom.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const getMaterialDetails = (bom: any) => {
          // Try to get details from specific material masters
          const masters = [
            { key: 'laceMaster', nameField: 'laceName', codeField: 'laceCode' },
            { key: 'buttonMaster', nameField: 'buttonName', codeField: 'buttonCode' },
            { key: 'threadMaster', nameField: 'threadName', codeField: 'threadCode' },
            { key: 'zipperMaster', nameField: 'zipperName', codeField: 'zipperCode' },
            { key: 'elasticMaster', nameField: 'elasticName', codeField: 'elasticCode' },
            { key: 'labelMaster', nameField: 'labelName', codeField: 'labelCode' },
            { key: 'packagingMaster', nameField: 'packagingName', codeField: 'packagingCode' },
          ];

          for (const master of masters) {
            if (bom[master.key]) {
              return {
                name: bom[master.key][master.nameField] || bom[master.key].name || '',
                code: bom[master.key][master.codeField] || bom[master.key].code || ''
              };
            }
          }

          // Fallback to generic material if available
          if (bom.material) {
            return {
              name: bom.material.name || '',
              code: bom.material.code || ''
            };
          }

          return { name: '', code: '' };
        };

        // Load accessories (LABEL and PACKAGING types)
        setSelectedAccessories(style.styleMaterialBom
          .filter((bom: { usageCategory?: string; materialType?: string }) =>
            bom.usageCategory === 'PACKAGING' || bom.materialType === 'LABEL' || bom.materialType === 'PACKAGING')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((bom: any) => {
            const materialDetails = getMaterialDetails(bom);
            // Get masterId from the correct FK field based on materialType
            // LABEL uses labelId, PACKAGING uses packagingId
            const masterId = bom.materialType === 'LABEL'
              ? (bom.labelId || '')
              : (bom.packagingId || '');
            return {
              accessoryType: (bom.materialType === 'LABEL' ? 'LABEL' : 'PACKAGING') as 'LABEL' | 'PACKAGING',
              masterId,
              masterCode: materialDetails.code,
              masterName: materialDetails.name,
              subType: bom.labelType || bom.packagingType || null
            };
          }));

        // Load trims (BUTTON, THREAD, ZIPPER, ELASTIC, LACE types with GARMENT_TRIM usage)
        const trimTypes = ['BUTTON', 'THREAD', 'ZIPPER', 'ELASTIC', 'LACE'];
        const loadedTrims = style.styleMaterialBom
          .filter((bom: { usageCategory?: string; materialType?: string }) =>
            bom.usageCategory === 'GARMENT_TRIM' && trimTypes.includes(bom.materialType || ''))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((bom: any) => {
            const materialDetails = getMaterialDetails(bom);
            // Get the masterId from the appropriate FK field
            const masterId = bom.buttonId || bom.threadId || bom.zipperId || bom.elasticId || bom.laceId || '';
            return {
              trimType: bom.materialType as 'BUTTON' | 'THREAD' | 'ZIPPER' | 'ELASTIC' | 'LACE',
              masterId: masterId,
              masterCode: materialDetails.code,
              masterName: materialDetails.name,
              color: null
            };
          });

        if (loadedTrims.length > 0) {
          setSelectedTrims(loadedTrims);
        }
      }

      // Load numberOfComponents - prioritize the saved field value
      // This ensures user's intended number is preserved even if components array differs
      const savedNumComponents = style.numberOfComponents || 1;
      setNumberOfComponents(savedNumComponents);

      // Load components if available
      if (style.components && style.components.length > 0) {
        // Map style components to selectedComponents format
        // Need to find the matching component master for each to get the componentId
        const loadedComponents = style.components.map((sc: { componentName?: string; componentType?: string }) => {
          // Find the component master by name
          const matchingMaster = componentMasters.find(cm => cm.name === sc.componentName);
          return {
            category: sc.componentType || '',
            componentId: matchingMaster?.id || ''
          };
        });

        // If saved components exist but numberOfComponents is different,
        // pad or trim the components array to match numberOfComponents
        if (loadedComponents.length < savedNumComponents) {
          // Pad with empty components
          while (loadedComponents.length < savedNumComponents) {
            loadedComponents.push({ category: '', componentId: '' });
          }
        } else if (loadedComponents.length > savedNumComponents) {
          // Trim to numberOfComponents (keep first N)
          loadedComponents.length = savedNumComponents;
        }

        setSelectedComponents(loadedComponents);
      } else {
        // No saved components - initialize with numberOfComponents empty slots
        setSelectedComponents(Array.from({ length: savedNumComponents }, () => ({ category: '', componentId: '' })));
      }

      notify.success('Style loaded successfully');
    } catch (error) {
      console.error('Failed to load style:', error);
      notify.error('Failed to load style data');
    } finally {
      setLoading(false);
    }
  };

  const loadAccessoryPresets = async (customerId: string) => {
    try {
      console.log('[StyleForm] Loading accessory presets for customer:', customerId);
      const presets = await customerService.getAccessoryPresets(customerId);
      console.log('[StyleForm] Loaded accessory presets:', presets);
      setCustomerAccessoryPresets(presets);

      // Auto-apply default preset if exists and not in edit mode
      if (!isEditMode && presets.length > 0) {
        const defaultPreset = presets.find(p => p.isDefault);
        if (defaultPreset) {
          applyPresetToAccessories(defaultPreset);
        }
      }

      return presets;
    } catch (error) {
      console.error('Failed to load accessory presets:', error);
      setCustomerAccessoryPresets([]);
      return [];
    }
  };

  /**
   * Apply accessory preset items to the selected accessories list.
   * - LABEL items: Create pending style_label_config entries (saved after style creation)
   * - PACKAGING items: Add to StyleAccessory format for accessories
   */
  const applyPresetToAccessories = (preset: AccessoryPreset) => {
    if (!preset?.items || preset.items.length === 0) return;

    // Separate LABEL items from PACKAGING items
    const labelItems = preset.items.filter(item => item.materialType === 'LABEL' && item.labelId);
    const packagingItems = preset.items.filter(item => item.materialType === 'PACKAGING' && item.materialId);

    // Create pending label configs from LABEL items
    const newLabelConfigs: CreateStyleLabelInput[] = labelItems.map(item => ({
      labelId: item.labelId!,
      labelName: item.label?.labelName || item.label?.labelCode || undefined, // For display
      componentName: item.componentName || null,
      extraPercentage: item.extraPercentage ? Number(item.extraPercentage) : 5,
      notes: null,
      sizeConfigs: [], // User can add barcodes/MRP later
    }));

    // Track which label IDs came from preset
    const newLabelIds = new Set(labelItems.map(item => item.labelId!));
    setPresetLabelIds(newLabelIds);

    // Merge labels: keep manual labels (not from old preset), add new preset labels
    setPendingLabelConfigs(prev => {
      const manualLabels = prev.filter(lbl => !presetLabelIds.has(lbl.labelId));
      const manualLabelIds = new Set(manualLabels.map(l => l.labelId));
      const newPresetLabels = newLabelConfigs.filter(l => !manualLabelIds.has(l.labelId));
      return [...manualLabels, ...newPresetLabels];
    });

    // Map PACKAGING items to StyleAccessory format
    const presetAccessories: StyleAccessory[] = packagingItems.map(item => ({
      accessoryType: 'PACKAGING' as const,
      masterId: item.materialId!,
      masterCode: item.material?.code || '',
      masterName: item.material?.name || '',
      itemName: item.material?.name || '',
      quantity: item.quantity ? Number(item.quantity) : 0,
      unit: item.material?.unit || '',
      subType: null,
    }));

    // Track which PACKAGING IDs came from preset
    const newPresetIds = new Set(presetAccessories.map(a => a.masterId));
    setPresetItemIds(newPresetIds);

    // Merge accessories: keep manual items (not from preset), add preset items (avoiding duplicates)
    setSelectedAccessories(prev => {
      // Keep items that were manually added (not in old preset)
      const manualItems = prev.filter(item => !presetItemIds.has(item.masterId));
      // Get IDs of manual items to avoid duplicates
      const manualIds = new Set(manualItems.map(i => i.masterId));
      // Add preset items that aren't already manually added
      const newPresetItems = presetAccessories.filter(i => !manualIds.has(i.masterId));
      return [...manualItems, ...newPresetItems];
    });

    setSelectedAccessoryPresetId(preset.id);

    // Show notification with counts
    const labelCount = newLabelConfigs.length;
    const packagingCount = presetAccessories.length;
    const parts = [];
    if (labelCount > 0) parts.push(`${labelCount} label(s)`);
    if (packagingCount > 0) parts.push(`${packagingCount} packaging item(s)`);
    notify.success(`Applied preset: ${preset.presetName} - ${parts.join(', ')}`);
  };

  /**
   * Handle preset dropdown change - apply the selected preset
   */
  const handlePresetChange = (presetId: string) => {
    if (!presetId || presetId === '__none__') {
      // Clear preset selection but keep manual items
      setSelectedAccessoryPresetId('');
      // Clear preset packaging items, keep manual ones
      setSelectedAccessories(prev => prev.filter(item => !presetItemIds.has(item.masterId)));
      setPresetItemIds(new Set());
      // Clear preset labels, keep manual ones
      setPendingLabelConfigs(prev => prev.filter(lbl => !presetLabelIds.has(lbl.labelId)));
      setPresetLabelIds(new Set());
      return;
    }

    const preset = customerAccessoryPresets.find(p => p.id === presetId);
    if (preset) {
      applyPresetToAccessories(preset);
    }
  };

  /**
   * Load size category presets for the selected customer
   */
  const loadSizePresets = async (customerId: string) => {
    try {
      const presets = await getAllPresetsForCustomer(customerId);
      setCustomerSizePresets(presets);

      // Auto-apply default preset if exists and not in edit mode
      if (!isEditMode && presets.length > 0) {
        const defaultPreset = presets.find(p => p.isDefault);
        if (defaultPreset) {
          applyPresetToSizes(defaultPreset);
        }
      }
    } catch (error) {
      console.error('Failed to load size presets:', error);
      setCustomerSizePresets([]);
    }
  };

  /**
   * Apply size preset to SKU variants.
   * Replaces entire size list with preset sizes (no merge).
   */
  const applyPresetToSizes = (preset: CustomerSizePreset) => {
    if (!preset?.sizeCategory?.sizes || preset.sizeCategory.sizes.length === 0) return;

    // Replace ALL sizes with preset sizes
    const presetVariants: SKUVariant[] = preset.sizeCategory.sizes.map(size => ({
      size,
      sku: '',
      barcode: '',
      isActive: true
    }));

    setSkuVariants(presetVariants);
    setPresetSizeIds(new Set(preset.sizeCategory.sizes));
    setSelectedSizePresetId(preset.id);
    notify.success(`Applied size preset: ${preset.presetName}`);
  };

  /**
   * Handle size preset dropdown change
   */
  const handleSizePresetChange = (presetId: string) => {
    if (!presetId || presetId === 'none') {
      // Revert to default adult sizes
      setSelectedSizePresetId('');
      setPresetSizeIds(new Set());
      setSkuVariants(DEFAULT_SIZES.map(size => ({
        size,
        sku: '',
        barcode: '',
        isActive: true
      })));
      return;
    }

    const preset = customerSizePresets.find(p => p.id === presetId);
    if (preset) {
      applyPresetToSizes(preset);
    }
  };

  // Helper to get component name from index
  const getComponentName = (componentIndex: number): string => {
    const component = selectedComponents[componentIndex];
    if (component?.componentId) {
      const master = componentMasters.find(cm => cm.id === component.componentId);
      return master?.name || `Component ${componentIndex + 1}`;
    }
    return `Component ${componentIndex + 1}`;
  };

  // Add fabric to specific component
  const handleAddFabricToComponent = (componentIndex: number) => {
    const componentName = getComponentName(componentIndex);
    setFabrics([
      ...fabrics,
      {
        id: crypto.randomUUID(),
        componentIndex,
        componentName,
        genericFabricName: '',
        fabricFinishType: '',
        hasEmbroidery: false,
        embroideryId: null,
        embroideryName: null,
        embroideryCode: null,
      }
    ]);
    // Expand this component section if not already expanded
    if (!expandedComponents.includes(componentIndex)) {
      setExpandedComponents([...expandedComponents, componentIndex]);
    }
  };

  // Toggle component section expansion
  const toggleComponentExpanded = (componentIndex: number) => {
    setExpandedComponents(prev =>
      prev.includes(componentIndex)
        ? prev.filter(i => i !== componentIndex)
        : [...prev, componentIndex]
    );
  };

  const handleRemoveFabric = (id: string) => {
    setFabrics(fabrics.filter(f => f.id !== id));
  };

  const handleUpdateFabric = (id: string, field: keyof FabricEntry, value: FabricEntry[keyof FabricEntry]) => {
    setFabrics(fabrics.map(f =>
      f.id === id ? { ...f, [field]: value } : f
    ));
  };

  const handleEmbroiderySelect = (fabricId: string, embroidery: EmbroiderySearchResult) => {
    setFabrics(fabrics.map(f =>
      f.id === fabricId ? {
        ...f,
        embroideryId: embroidery.id,
        embroideryName: embroidery.designName,
        embroideryCode: embroidery.embroideryCode,
        usableWidth: embroidery.usableWidthAfter ?? f.usableWidth
      } : f
    ));
  };

  const handleOpenEmbroideryPicker = (fabricId: string) => {
    setEmbroideryPickerFabricId(fabricId);
    setEmbroideryPickerOpen(true);
  };

  const handleClearEmbroidery = (fabricId: string) => {
    setFabrics(fabrics.map(f =>
      f.id === fabricId ? {
        ...f,
        hasEmbroidery: false,
        embroideryId: null,
        embroideryName: null,
        embroideryCode: null
      } : f
    ));
  };

  const generateSKUs = () => {
    const base = styleCode || 'STYLE';
    setSkuVariants(skuVariants.map(v => ({
      ...v,
      sku: v.isActive ? `${base}${v.size}` : v.sku
    })));
    notify.success('SKUs generated!');
  };

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      notify.error('Only JPG and PNG images are allowed');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      notify.error('Image size must be less than 5MB');
      return;
    }

    if (!id) {
      // For new styles, store file locally and show preview
      setPendingImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setPendingImagePreview(previewUrl);
      notify.success('Image selected. It will be uploaded when you save the style.');
      e.target.value = '';
      return;
    }

    // For existing styles, upload immediately
    try {
      setUploadingImage(true);
      const uploadedImageUrl = await styleService.uploadStyleImage(id, file);
      setImageUrl(uploadedImageUrl);
      notify.success('Image uploaded successfully');
    } catch (error: unknown) {
      console.error('Image upload error:', error);
      notify.error(error.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
      // Reset file input
      e.target.value = '';
    }
  };

  // Handle image delete
  const handleDeleteImage = async () => {
    // Clear pending image if exists
    if (pendingImagePreview) {
      URL.revokeObjectURL(pendingImagePreview);
      setPendingImageFile(null);
      setPendingImagePreview('');
      return;
    }

    if (!id) return;

    try {
      // Update the style to remove the image URL
      await styleService.updateStyle(id, { imageUrl: null });
      setImageUrl('');
      notify.success('Image removed successfully');
    } catch (error: unknown) {
      console.error('Delete image error:', error);
      notify.error('Failed to remove image');
    }
  };

  const handleSaveAsDraft = async () => {
    // Save as draft without validation
    await saveStyle(true);
  };

  // Auto-save draft when navigating between tabs
  const handleTabNavigation = async (targetTab: string) => {
    // Only auto-save if we have at least a style code
    if (styleCode) {
      try {
        await saveStyle(true);
        notify.success('Draft auto-saved');
      } catch (error) {
        // Continue to tab even if save fails - just log the error
        console.warn('Auto-save failed:', error);
      }
    }
    setActiveTab(targetTab);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Save with validation
    await saveStyle(false);
  };

  const saveStyle = async (isDraft: boolean) => {
    // DEBUG: Log all state values at start of save
    console.log('=== SAVE STYLE CALLED ===');
    console.log('isDraft:', isDraft);
    console.log('styleCode:', styleCode);
    console.log('brandName state:', brandName);
    console.log('brandCategoryId state:', brandCategoryId);
    console.log('category state:', category);
    console.log('availableBrands:', availableBrands);
    console.log('availableCategories:', availableCategories);
    console.log('numberOfComponents state:', numberOfComponents);

    // Minimal validation for draft
    if (isDraft) {
      if (!styleCode) {
        notify.error('Style code is required to save as draft');
        return;
      }
      // For drafts, we don't require customer or fabrics
    } else {
      // Full validation for final save
      if (!styleCode || !customerName) {
        notify.error('Style code and customer are required');
        return;
      }

      // Only validate fabrics for non-draft saves
      if (fabrics.length === 0 || fabrics.some(f => !f.genericFabricName)) {
        notify.error('At least one fabric with generic name is required');
        return;
      }
    }

    try {
      setLoading(true);

      // Auto-generate SKUs for active variants that don't have them
      const skuVariantsWithGenerated = skuVariants.map(v => ({
        ...v,
        sku: v.sku || (styleCode ? `${styleCode}${v.size}` : `STYLE${v.size}`)
      }));

      // Filter out trims with empty masterId (invalid/incomplete records from legacy data)
      const validTrims = selectedTrims.filter(trim => trim.masterId && trim.masterId.trim() !== '');

      // Auto-add Thread if not present in selectedTrims
      const hasThread = validTrims.some(t => t.trimType === 'THREAD');

      // Build final trims array (auto-add thread if missing)
      const finalTrims = hasThread
        ? validTrims
        : [
            ...validTrims,
            {
              trimType: 'THREAD' as const,
              masterId: 'auto-thread',
              masterCode: 'THREAD-AUTO',
              masterName: 'Thread (Auto-added)',
              color: null,
            }
          ];

      // Accessories - transform to backend format (accessoryType -> materialType, masterId -> materialId)
      const finalAccessories = selectedAccessories.map(acc => ({
        materialType: acc.accessoryType, // Backend expects materialType, not accessoryType
        materialId: acc.masterId, // Backend expects materialId, not masterId
        usageCategory: 'PACKAGING' as const, // All accessories (labels, packaging) go to PACKAGING category
        componentName: acc.masterName, // Use masterName as componentName for display
        quantityPerGarment: 0, // Will be set at order/costing level
        unit: 'pcs',
      }));

      // Build components array from selectedComponents
      const components = selectedComponents
        .filter(sc => sc.componentId) // Only include components that have been selected
        .map(sc => {
          // Find the component master to get the name
          const componentMaster = componentMasters.find(cm => cm.id === sc.componentId);
          if (!componentMaster) {
            // Component master not found - skip this component
            return null;
          }

          // Find fabrics for this component
          const componentFabrics = fabrics
            .filter(f => f.componentName === componentMaster.name)
            .map(f => ({
              fabricName: f.genericFabricName,
              fabricType: 'GENERIC', // Type for new system
              fabricFinishType: f.fabricFinishType || null,
              hasEmbroidery: f.hasEmbroidery || false,
              embroideryId: f.embroideryId || null,
            }));

          return {
            componentName: componentMaster.name,
            componentType: sc.category || 'OTHER', // Use category as componentType
            fabrics: componentFabrics,
          };
        })
        .filter(c => c !== null); // Remove any null entries

      // DEBUG: Log what we're about to save
      console.log('=== SAVING STYLE ===');
      console.log('brandName:', brandName);
      console.log('brandCategoryId:', brandCategoryId);
      console.log('category:', category);
      console.log('numberOfComponents:', numberOfComponents);
      console.log('=== FABRICS STATE ===');
      console.log('fabrics:', JSON.stringify(fabrics, null, 2));
      console.log('=== COMPONENTS WITH FABRICS ===');
      console.log('components:', JSON.stringify(components, null, 2));

      const styleData = {
        styleCode,
        styleName: styleName || styleCode,
        customerName: customerName || (isDraft ? 'Draft' : ''),
        brandName,
        category,
        brandCategoryId: brandCategoryId || null,
        productCategoryId: productCategoryId || null,  // Global product category
        season,
        description,
        numberOfComponents,
        components, // Add the components array
        expectedOrderQuantity: expectedOrderQty,
        // Template fields - Pricing
        costPrice: costPrice || null,
        sellingPrice: sellingPrice || null,
        // Template fields - Tax & Accounting
        hsnCode: hsnCode || null,
        productTaxRule: productTaxRule || null,
        accountingSKU: styleCode || null, // Default to Style Code
        accountingUnit: accountingUnit || 'Units',
        // Template fields - Marketing & Other
        bulletPoints: bulletPoints || null,
        imageUrl: imageUrl || null,
        specifications: remarks || null,  // Storing remarks in specifications field
        // Fabrics - simplified to only capture type and embroidery
        // Consumption and width are handled in CAD Planning stage
        fabrics: fabrics
          .filter(f => isDraft || f.genericFabricName) // For drafts, include all; for final, only with names
          .map(f => ({
            componentName: f.componentName,
            genericFabricName: f.genericFabricName || (isDraft ? '' : f.genericFabricName),
            fabricFinishType: f.fabricFinishType || null,
            // Embroidery support
            hasEmbroidery: f.hasEmbroidery || false,
            embroideryId: f.embroideryId || null,
          })),
        // Trims - simplified (just references to master records)
        trims: finalTrims,
        // Accessories - simplified (just references to master records)
        accessories: finalAccessories,
        // SKU variants (with auto-generated SKUs for empty ones)
        skuVariants: skuVariantsWithGenerated.filter(v => v.isActive),
        // Customer preset if selected
        customerAccessoriesPresetId: selectedAccessoryPresetId || undefined,
        // CAD status starts as PENDING
        cadStatus: 'PENDING' as CADStatus,
        // Status - DRAFT if saving as draft, otherwise ACTIVE
        status: isDraft ? 'DRAFT' : 'DRAFT'  // Can change to 'ACTIVE' if needed
      };

      if (isEditMode && id) {
        await styleService.updateStyle(id, styleData);
        notify.success(isDraft ? 'Draft saved successfully!' : 'Style updated successfully!');

        // Only navigate away on full submit, stay on page for draft
        if (!isDraft) {
          navigate('/styles');
        }
      } else {
        const response = await styleService.createStyle(styleData);
        const newStyleId = response?.data?.id;

        // Upload pending image if exists
        if (pendingImageFile && newStyleId) {
          try {
            await styleService.uploadStyleImage(newStyleId, pendingImageFile);
            // Clear pending image
            if (pendingImagePreview) {
              URL.revokeObjectURL(pendingImagePreview);
            }
            setPendingImageFile(null);
            setPendingImagePreview('');
          } catch (imgError) {
            console.error('Failed to upload image:', imgError);
            notify.error('Style created but image upload failed. You can upload it later.');
          }
        }

        // Create label configs from preset if any pending
        if (pendingLabelConfigs.length > 0 && newStyleId) {
          try {
            await bulkAddLabelsToStyle(newStyleId, pendingLabelConfigs);
            // Clear pending labels after successful save
            setPendingLabelConfigs([]);
            setPresetLabelIds(new Set());
          } catch (labelError) {
            console.error('Failed to add labels to style:', labelError);
            notify.error('Style created but label configuration failed. You can add labels later in style details.');
          }
        }

        notify.success(isDraft ? 'Draft saved successfully!' : 'Style created successfully! Proceed to CAD Planning.');

        if (isDraft && response?.data?.id) {
          // For new drafts, navigate to edit mode so subsequent saves work
          navigate(`/styles/${response.data.id}/edit`, { replace: true });
        } else if (!isDraft) {
          navigate('/styles');
        }
      }
    } catch (error: unknown) {
      console.error('Failed to save style:', error);

      // Check if this is a deleted style conflict (409 with deletedStyleId)
      const axiosError = error as { response?: { status?: number; data?: { message?: string; details?: { deletedStyleId?: string; styleName?: string } } } };
      if (
        axiosError.response?.status === 409 &&
        axiosError.response?.data?.details?.deletedStyleId
      ) {
        // Show restore dialog instead of error
        setDeletedStyleInfo({
          id: axiosError.response.data.details.deletedStyleId,
          styleName: axiosError.response.data.details.styleName || styleCode,
          styleCode: styleCode,
        });
        setShowRestoreDialog(true);
      } else {
        notify.error(axiosError.response?.data?.message || 'Failed to save style');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle restoring a deleted style
  const handleRestoreStyle = async () => {
    if (!deletedStyleInfo?.id) return;

    try {
      setRestoring(true);
      await styleService.restoreStyle(deletedStyleInfo.id);
      notify.success(`Style "${deletedStyleInfo.styleCode}" has been restored!`);
      setShowRestoreDialog(false);
      setDeletedStyleInfo(null);
      // Navigate to edit the restored style
      navigate(`/styles/${deletedStyleInfo.id}/edit`);
    } catch (error) {
      console.error('Failed to restore style:', error);
      notify.error('Failed to restore style. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate('/styles')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {isEditMode ? 'Edit Style' : 'Create New Style'}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Define style details, fabrics, and materials. CAD planning comes after creation.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleSaveAsDraft}
          disabled={loading}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          Save as Draft
        </Button>
      </div>

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <p className="font-medium text-blue-900 mb-1">New Workflow</p>
          <p className="text-blue-700">
            Use <strong>Generic Fabric Name</strong> (e.g., "Cambric") instead of specific greige.
            You'll select the actual greige width during <strong>CAD Planning</strong> after style creation.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Tab Navigation */}
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="basic">1. Basic Info</TabsTrigger>
            <TabsTrigger value="fabrics">2. Fabrics</TabsTrigger>
            <TabsTrigger value="trims">3. Trims & Materials</TabsTrigger>
            <TabsTrigger value="accessories">4. Accessories</TabsTrigger>
          </TabsList>

          {/* TAB 1: BASIC INFO */}
          <TabsContent value="basic" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Basic Information</h2>

              {/* Main layout: Image on left, Form fields on right */}
              <div className="grid grid-cols-[280px_1fr] gap-6">
                {/* Left Column: Style Image */}
                <div>
                  <Label className="text-sm mb-1.5 block">Style Image</Label>
                  {(imageUrl || pendingImagePreview) ? (
                    <div className="relative group">
                      <img
                        src={pendingImagePreview || getUploadUrl(imageUrl)}
                        alt="Style preview"
                        className="w-full h-[280px] object-cover rounded-lg border-2 border-gray-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgwIiBoZWlnaHQ9IjI4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjgwIiBoZWlnaHQ9IjI4MCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
                        }}
                      />
                      {pendingImagePreview && (
                        <span className="absolute bottom-2 left-2 bg-amber-500 text-white text-xs px-2 py-1 rounded">
                          Pending upload
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleDeleteImage}
                        disabled={uploadingImage}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => {
                        if (!uploadingImage) {
                          document.getElementById('style-image-input')?.click();
                        }
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center w-full h-[280px] border-2 border-dashed border-gray-300 rounded-lg transition-colors",
                        !uploadingImage ? "cursor-pointer hover:border-blue-400 hover:bg-blue-50" : "cursor-not-allowed opacity-60"
                      )}
                    >
                      <input
                        id="style-image-input"
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                      {uploadingImage ? (
                        <span className="text-sm text-gray-500">Uploading...</span>
                      ) : (
                        <>
                          <Plus className="h-12 w-12 text-gray-400" />
                          <span className="text-sm text-gray-500 mt-2">Click to add image</span>
                          <span className="text-xs text-gray-400 mt-1">JPG, PNG (max 5MB)</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Column: Form Fields */}
                <div className="grid grid-cols-2 gap-4 content-start">
                  {/* Row 1: Style Code, Style Name */}
                  <div>
                    <Label>Style Code *</Label>
                    <Input
                      value={styleCode}
                      onChange={(e) => setStyleCode(e.target.value)}
                      placeholder="ST-001"
                      required
                    />
                  </div>
                  <div>
                    <Label>Style Name</Label>
                    <Input
                      value={styleName}
                      onChange={(e) => setStyleName(e.target.value)}
                      placeholder="Summer Dress"
                    />
                  </div>

                  {/* Row 2: Customer/Buyer, Brand */}
                  <div>
                    <Label>Customer/Buyer *</Label>
                    <Select value={selectedCustomerId} onValueChange={handleCustomerChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select customer..." />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((c: Customer) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Brand</Label>
                    <Select
                      key={`brand-select-${availableBrands.join('-')}`}
                      value={brandName}
                      onValueChange={setBrandName}
                      disabled={!availableBrands.length}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={availableBrands.length > 0 ? "Select brand..." : "No brands available"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBrands.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {brand}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!availableBrands.length && selectedCustomerId && (
                      <p className="text-xs text-gray-500 mt-1">Select a customer with configured brands</p>
                    )}
                  </div>

                  {/* Row 3: Brand Category, Product Category */}
                  <div>
                    <Label>Brand Category</Label>
                    <Select
                      key={`brand-category-select-${availableCategories.map(c => c.id).join('-')}`}
                      value={brandCategoryId}
                      onValueChange={(value) => {
                        setBrandCategoryId(value);
                        // Also set the category name for display/backward compatibility
                        const selectedBrandCategory = availableCategories.find(bc => bc.id === value);
                        if (selectedBrandCategory) {
                          setCategory(selectedBrandCategory.category);

                          // Auto-match Product Category L1 if brand category matches (only when user manually changes, not in edit mode initial load)
                          if (!isEditMode || productCategoryId === '') {
                            // Extract base category name from hierarchical category (e.g., "Fusion Wear > Fusion Wear Top" → "Fusion Wear")
                            const baseCategoryName = selectedBrandCategory.category.split('>')[0].trim();
                            const matchingProductCategory = productCategories.find(
                              pc => pc.name.toLowerCase() === baseCategoryName.toLowerCase()
                            );
                            if (matchingProductCategory) {
                              setSelectedProductCategoryL1(matchingProductCategory.id);
                              setSelectedProductCategoryL2('');
                              setSelectedProductCategoryL3('');
                              updateProductCategoryId(matchingProductCategory.id, '', '');
                            }
                          }
                        }
                      }}
                      disabled={!availableCategories.length}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={availableCategories.length > 0 ? "Select category..." : "Select brand first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCategories.map((bc) => (
                          <SelectItem key={bc.id} value={bc.id}>
                            {bc.category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!availableCategories.length && brandName && (
                      <p className="text-xs text-gray-500 mt-1">No categories available for this brand</p>
                    )}
                  </div>
                  <div>
                    <Label>Product Category</Label>
                    {/* Check if brand category matches a product category L1 */}
                    {(() => {
                      // Extract the first part of hierarchical category (e.g., "Fusion Wear > Fusion Wear Top" → "Fusion Wear")
                      const baseCategoryName = category ? category.split('>')[0].trim() : '';
                      const matchingL1 = baseCategoryName ? productCategories.find(
                        pc => pc.name.toLowerCase() === baseCategoryName.toLowerCase()
                      ) : null;
                      const hasSubCategories = matchingL1 && productSubCategories[matchingL1.id]?.length > 0;

                      // If brand category matches L1 and has sub-categories, show only sub-categories
                      if (matchingL1 && hasSubCategories) {
                        return (
                          <Select
                            value={selectedProductCategoryL2}
                            onValueChange={async (value) => {
                              setSelectedProductCategoryL2(value);
                              setSelectedProductCategoryL3('');
                              await loadProductSubSubCategories(value);
                              updateProductCategoryId(matchingL1.id, value, '');
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={`Select ${baseCategoryName} type...`} />
                            </SelectTrigger>
                            <SelectContent>
                              {productSubCategories[matchingL1.id]?.map((subCat) => (
                                <SelectItem key={subCat.id} value={subCat.id}>
                                  {subCat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      }

                      // Otherwise show full dropdown with L1 and L2
                      return (
                        <Select
                          value={selectedProductCategoryL2 || selectedProductCategoryL1}
                          onValueChange={async (value) => {
                            // Check if selected value is L1 or L2
                            const isL1 = productCategories.some(cat => cat.id === value);
                            if (isL1) {
                              setSelectedProductCategoryL1(value);
                              setSelectedProductCategoryL2('');
                              setSelectedProductCategoryL3('');
                              await loadProductSubCategories(value);
                              updateProductCategoryId(value, '', '');
                            } else {
                              // It's an L2 - find the parent L1
                              const parentL1 = productCategories.find(cat =>
                                productSubCategories[cat.id]?.some(sub => sub.id === value)
                              );
                              if (parentL1) {
                                setSelectedProductCategoryL1(parentL1.id);
                              }
                              setSelectedProductCategoryL2(value);
                              setSelectedProductCategoryL3('');
                              await loadProductSubSubCategories(value);
                              updateProductCategoryId(parentL1?.id || selectedProductCategoryL1, value, '');
                            }
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select category..." />
                          </SelectTrigger>
                          <SelectContent>
                            {productCategories.map((cat) => (
                              <React.Fragment key={cat.id}>
                                <SelectItem value={cat.id} className="font-semibold">
                                  {cat.name}
                                </SelectItem>
                                {productSubCategories[cat.id]?.map((subCat) => (
                                  <SelectItem key={subCat.id} value={subCat.id} className="pl-6 text-gray-600">
                                    └ {subCat.name}
                                  </SelectItem>
                                ))}
                              </React.Fragment>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    })()}
                  </div>

                  {/* Row 4: Season, Number of Components */}
                  <div>
                    <Label>Season</Label>
                    <Input
                      value={season}
                      onChange={(e) => setSeason(e.target.value)}
                      placeholder="e.g., Summer 2025"
                    />
                  </div>
                  <div>
                    <Label>Number of Components</Label>
                    <Input
                      type="number"
                      min={selectedProductCategory?.minComponents || 1}
                      max={selectedProductCategory?.maxComponents}
                      value={numberOfComponents}
                      onChange={(e) => setNumberOfComponents(parseInt(e.target.value) || 1)}
                      placeholder="1"
                      className={
                        selectedProductCategory &&
                        (numberOfComponents < (selectedProductCategory.minComponents || 1) ||
                         numberOfComponents > (selectedProductCategory.maxComponents || 999))
                          ? 'border-red-500'
                          : ''
                      }
                    />
                    {selectedProductCategory && (selectedProductCategory.minComponents || selectedProductCategory.maxComponents) && (
                      <p className="text-xs text-gray-600 mt-1">
                        {selectedProductCategory.minComponents === selectedProductCategory.maxComponents
                          ? `This category requires exactly ${selectedProductCategory.minComponents} component${selectedProductCategory.minComponents > 1 ? 's' : ''}`
                          : `This category supports ${selectedProductCategory.minComponents || 1} to ${selectedProductCategory.maxComponents || '∞'} components`
                        }
                      </p>
                    )}
                    {selectedProductCategory &&
                     (numberOfComponents < (selectedProductCategory.minComponents || 1) ||
                      numberOfComponents > (selectedProductCategory.maxComponents || 999)) && (
                      <p className="text-xs text-red-600 mt-1">
                        Component count must be between {selectedProductCategory.minComponents || 1} and {selectedProductCategory.maxComponents || '∞'}
                      </p>
                    )}
                  </div>

                  {/* Row 5: Product Sub-Sub-Categories (L3 - conditional, for Kids Wear etc.) */}
                  {selectedProductCategoryL2 && productSubSubCategories[selectedProductCategoryL2]?.length > 0 && (
                    <>
                      <div>
                        <Label>Type</Label>
                        <Select
                          value={selectedProductCategoryL3}
                          onValueChange={(value) => {
                            setSelectedProductCategoryL3(value);
                            updateProductCategoryId(selectedProductCategoryL1, selectedProductCategoryL2, value);
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                          <SelectContent>
                            {productSubSubCategories[selectedProductCategoryL2]?.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div /> {/* Empty div to maintain grid alignment */}
                    </>
                  )}

                  {/* Selected Product Category Path (spans both columns) */}
                  {productCategoryId && (
                    <div className="col-span-2 text-sm text-purple-600">
                      Product: {[
                        productCategories.find(c => c.id === selectedProductCategoryL1)?.name,
                        productSubCategories[selectedProductCategoryL1]?.find(c => c.id === selectedProductCategoryL2)?.name,
                        productSubSubCategories[selectedProductCategoryL2]?.find(c => c.id === selectedProductCategoryL3)?.name
                      ].filter(Boolean).join(' → ')}
                    </div>
                  )}
                </div>
              </div>

              {/* Component Names Section */}
              {numberOfComponents > 0 && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <Label className="text-base font-semibold mb-3 block">Component Selection</Label>
                  <p className="text-xs text-gray-600 mb-3">
                    Select the component for each part of the garment.
                    Manage components in <a href="/component-masters" className="text-blue-600 hover:underline">Component Masters</a>.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Array.from({ length: numberOfComponents }, (_, index) => {
                      // Ensure selectedComponents array has enough elements
                      if (!selectedComponents[index]) {
                        const newComponents = [...selectedComponents];
                        newComponents[index] = { category: '', componentId: '' };
                        setSelectedComponents(newComponents);
                      }

                      const selectedComponentId = selectedComponents[index]?.componentId || '';
                      const selectedComponent = componentMasters.find(c => c.id === selectedComponentId);

                      return (
                        <div key={index} className="p-3 bg-white rounded-md border">
                          <Label className="text-sm">Component {index + 1}</Label>
                          <Popover
                            open={openComponentPopovers[index] || false}
                            onOpenChange={(open) => {
                              setOpenComponentPopovers(prev => ({ ...prev, [index]: open }));
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={openComponentPopovers[index] || false}
                                className="w-full mt-1 justify-between font-normal"
                              >
                                {selectedComponent ? (
                                  <span className="truncate">
                                    {selectedComponent.name}
                                    {selectedComponent.componentCategory && (
                                      <span className="text-gray-500 ml-1">({selectedComponent.componentCategory})</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">Search component...</span>
                                )}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Search components..." />
                                <CommandList>
                                  <CommandEmpty>No component found.</CommandEmpty>
                                  {/* Group components by Component Group */}
                                  {(() => {
                                    const filteredComponents = componentMasters.filter(
                                      component => categoryComponentIds.size === 0 || categoryComponentIds.has(component.id)
                                    );

                                    // Group by component group
                                    const grouped = new Map<string, ComponentMaster[]>();
                                    const ungrouped: ComponentMaster[] = [];

                                    filteredComponents.forEach(component => {
                                      if (component.componentGroup) {
                                        const groupId = component.componentGroup.id;
                                        if (!grouped.has(groupId)) {
                                          grouped.set(groupId, []);
                                        }
                                        grouped.get(groupId)!.push(component);
                                      } else {
                                        ungrouped.push(component);
                                      }
                                    });

                                    // Sort groups by sortOrder
                                    const sortedGroups = Array.from(grouped.entries()).sort((a, b) => {
                                      const groupA = componentGroups.find(g => g.id === a[0]);
                                      const groupB = componentGroups.find(g => g.id === b[0]);
                                      return (groupA?.sortOrder || 0) - (groupB?.sortOrder || 0);
                                    });

                                    return (
                                      <>
                                        {sortedGroups.map(([groupId, components]) => {
                                          const group = componentGroups.find(g => g.id === groupId);
                                          return (
                                            <CommandGroup key={groupId} heading={group?.name || 'Unknown'}>
                                              {components.map((component) => (
                                                <CommandItem
                                                  key={component.id}
                                                  value={`${component.name} ${component.componentGroup?.name || component.componentCategory || ''}`}
                                                  onSelect={() => {
                                                    const newComponents = [...selectedComponents];
                                                    while (newComponents.length <= index) {
                                                      newComponents.push({ category: '', componentId: '' });
                                                    }
                                                    newComponents[index] = {
                                                      category: component.componentCategory || '',
                                                      componentId: component.id
                                                    };
                                                    setSelectedComponents(newComponents);
                                                    setOpenComponentPopovers(prev => ({ ...prev, [index]: false }));
                                                  }}
                                                >
                                                  <Check
                                                    className={cn(
                                                      "mr-2 h-4 w-4",
                                                      selectedComponentId === component.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                  />
                                                  <span className="flex-1">{component.name}</span>
                                                </CommandItem>
                                              ))}
                                            </CommandGroup>
                                          );
                                        })}
                                        {ungrouped.length > 0 && (
                                          <CommandGroup heading="Other">
                                            {ungrouped.map((component) => (
                                              <CommandItem
                                                key={component.id}
                                                value={`${component.name} ${component.componentCategory || ''}`}
                                                onSelect={() => {
                                                  const newComponents = [...selectedComponents];
                                                  while (newComponents.length <= index) {
                                                    newComponents.push({ category: '', componentId: '' });
                                                  }
                                                  newComponents[index] = {
                                                    category: component.componentCategory || '',
                                                    componentId: component.id
                                                  };
                                                  setSelectedComponents(newComponents);
                                                  setOpenComponentPopovers(prev => ({ ...prev, [index]: false }));
                                                }}
                                              >
                                                <Check
                                                  className={cn(
                                                    "mr-2 h-4 w-4",
                                                    selectedComponentId === component.id ? "opacity-100" : "opacity-0"
                                                  )}
                                                />
                                                <span className="flex-1">
                                                  {component.name}
                                                  {component.componentCategory && (
                                                    <span className="text-gray-500 ml-1">({component.componentCategory})</span>
                                                  )}
                                                </span>
                                              </CommandItem>
                                            ))}
                                          </CommandGroup>
                                        )}
                                      </>
                                    );
                                  })()}
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Expandable Additional Details */}
              <button
                type="button"
                onClick={() => setShowAdditionalDetails(!showAdditionalDetails)}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 mt-4"
              >
                {showAdditionalDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Additional Details (Optional)
              </button>

              {showAdditionalDetails && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-6">
                  {/* Pricing */}
                  <div>
                    <Label className="text-base font-semibold mb-3 block">Pricing</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Cost (₹)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={costPrice}
                          onChange={(e) => setCostPrice(parseFloat(e.target.value) || '')}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>MRP (₹)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={sellingPrice}
                          onChange={(e) => setSellingPrice(parseFloat(e.target.value) || '')}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Accounting Information */}
                  <div>
                    <Label className="text-base font-semibold mb-3 block">Accounting Information</Label>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>HSN Code (6-8 digits)</Label>
                        <Input
                          value={hsnCode}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, ''); // Only digits
                            if (value.length <= 8) {
                              setHsnCode(value);
                            }
                          }}
                          placeholder="6-8 digit HSN/SAC code"
                          maxLength={8}
                        />
                        {hsnCode && (hsnCode.length < 6 || hsnCode.length > 8) && (
                          <p className="text-xs text-red-600 mt-1">HSN code must be 6-8 digits</p>
                        )}
                      </div>
                      <div>
                        <Label>Tax Rate (2 digits %)</Label>
                        <Input
                          value={productTaxRule}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, ''); // Only digits
                            if (value.length <= 2) {
                              setProductTaxRule(value);
                            }
                          }}
                          placeholder="e.g., 12 (for 12%)"
                          maxLength={2}
                        />
                        {productTaxRule && productTaxRule.length !== 2 && (
                          <p className="text-xs text-red-600 mt-1">Tax rate must be 2 digits</p>
                        )}
                      </div>
                      <div>
                        <Label>Accounting Unit</Label>
                        <Input
                          value={accountingUnit}
                          onChange={(e) => setAccountingUnit(e.target.value)}
                          placeholder="e.g., Units, PCS, DOZEN"
                        />
                        <p className="text-xs text-gray-500 mt-1">Default: Units</p>
                      </div>
                    </div>
                  </div>

                  {/* Marketing & Remarks - Moved from below */}
                  <div>
                    <Label className="text-base font-semibold mb-3 block">Marketing & Remarks</Label>
                    <div className="space-y-4">
                      {/* Description - Full width */}
                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Style description..."
                          rows={3}
                        />
                      </div>

                      {/* Bullet Points and Remarks - Side by side */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Bullet Points</Label>
                          <Textarea
                            value={bulletPoints}
                            onChange={(e) => setBulletPoints(e.target.value)}
                            placeholder="Marketing bullet points (one per line)..."
                            rows={3}
                          />
                        </div>
                        <div>
                          <Label>Remarks</Label>
                          <Textarea
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="Additional remarks or notes..."
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Size Category Preset Selector */}
              {selectedCustomerId && customerSizePresets.length > 0 && (
                <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <Label className="text-sm font-medium mb-2 block">Size Category Preset (Optional)</Label>
                  <Select value={selectedSizePresetId || 'none'} onValueChange={handleSizePresetChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Use customer's size preset or add sizes manually below" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Manual Sizes)</SelectItem>
                      {customerSizePresets.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.presetName} - {preset.sizeCategory.categoryName} ({preset.sizeCategory.sizes.length} sizes)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedSizePresetId && (
                    <p className="text-xs text-purple-600 mt-2">
                      <span className="inline-block px-1.5 py-0.5 bg-purple-200 text-purple-700 rounded-full mr-1">Preset</span>
                      {presetSizeIds.size} size(s) from preset - you can add more sizes manually
                    </p>
                  )}
                </div>
              )}

              {/* Size Variants & SKUs - Main Section (not in Additional Details) */}
              <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">Size Variants & SKUs</Label>
                  <Button type="button" variant="outline" size="sm" onClick={generateSKUs}>
                    Auto-Generate SKUs
                  </Button>
                </div>

                <div className="space-y-3">
                  {skuVariants.map((variant, index) => (
                    <div key={variant.size} className="grid grid-cols-12 gap-3 items-center p-3 border rounded bg-white">
                      <div className="col-span-1 flex items-center">
                        <Checkbox
                          checked={variant.isActive}
                          onCheckedChange={(checked) => {
                            const updated = [...skuVariants];
                            updated[index].isActive = !!checked;
                            setSkuVariants(updated);
                          }}
                        />
                      </div>
                      <div className="col-span-2 flex items-center gap-1">
                        <Badge variant="outline">{variant.size}</Badge>
                        {presetSizeIds.has(variant.size) && (
                          <span className="text-xs text-purple-500" title="From preset">*</span>
                        )}
                      </div>
                      <div className="col-span-4">
                        <Input
                          placeholder="SKU Code"
                          value={variant.sku}
                          onChange={(e) => {
                            const updated = [...skuVariants];
                            updated[index].sku = e.target.value;
                            setSkuVariants(updated);
                          }}
                          disabled={!variant.isActive}
                        />
                      </div>
                      <div className="col-span-5">
                        <Input
                          placeholder="Barcode (Optional)"
                          value={variant.barcode || ''}
                          onChange={(e) => {
                            const updated = [...skuVariants];
                            updated[index].barcode = e.target.value;
                            setSkuVariants(updated);
                          }}
                          disabled={!variant.isActive}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-gray-500 mt-3">
                  Uncheck sizes you don't need. SKUs are required for active sizes. Accounting SKU will default to SKU Code.
                </p>
              </div>
            </Card>

            <div className="flex justify-end">
              <Button type="button" onClick={() => handleTabNavigation('fabrics')}>
                Next: Fabrics & Trims
              </Button>
            </div>
          </TabsContent>

          {/* TAB 2: FABRICS & TRIMS */}
          <TabsContent value="fabrics" className="space-y-6">
            {/* Fabrics Section - Grouped by Component */}
            <Card className="p-6">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">Fabrics by Component</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Add fabrics to each component. Same fabric + finish + width can be combined for cutting.
                </p>
              </div>

              {/* Component warning if none selected */}
              {numberOfComponents < 1 || selectedComponents.filter(c => c.componentId).length === 0 ? (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
                  <AlertCircle className="h-12 w-12 mx-auto mb-3 text-amber-400" />
                  <p className="font-medium">No components defined</p>
                  <p className="text-sm mt-1">Please go to Basic Info and select components first</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setActiveTab('basic')}
                  >
                    Go to Basic Info
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Render each component section */}
                  {Array.from({ length: numberOfComponents }, (_, componentIndex) => {
                    const component = selectedComponents[componentIndex];
                    const componentMaster = component?.componentId
                      ? componentMasters.find(cm => cm.id === component.componentId)
                      : null;
                    const componentName = componentMaster?.name || `Component ${componentIndex + 1}`;
                    const componentFabrics = fabrics.filter(f => f.componentIndex === componentIndex);
                    const isExpanded = expandedComponents.includes(componentIndex);

                    return (
                      <div key={componentIndex} className="border rounded-lg">
                        {/* Component Header - Collapsible */}
                        <div
                          className={cn(
                            "w-full flex items-center justify-between p-4 text-left transition-colors",
                            isExpanded ? "bg-blue-50 border-b" : "bg-gray-50 hover:bg-gray-100"
                          )}
                        >
                          <div
                            className="flex items-center gap-3 cursor-pointer flex-1"
                            onClick={() => toggleComponentExpanded(componentIndex)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-gray-500" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-gray-500" />
                            )}
                            <span className="font-semibold text-gray-900">
                              {componentName.toUpperCase()}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              Component {componentIndex + 1}
                            </Badge>
                            <Badge className="text-xs bg-blue-100 text-blue-700">
                              {componentFabrics.length} fabric{componentFabrics.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddFabricToComponent(componentIndex)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Fabric
                          </Button>
                        </div>

                        {/* Component Fabrics */}
                        {isExpanded && (
                          <div className="p-4 space-y-3">
                            {componentFabrics.length === 0 ? (
                              <div className="text-center py-6 text-gray-500 border-2 border-dashed rounded-lg bg-gray-50">
                                <p className="text-sm">No fabrics added to this component</p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="mt-2"
                                  onClick={() => handleAddFabricToComponent(componentIndex)}
                                >
                                  <Plus className="h-4 w-4 mr-1" />
                                  Add First Fabric
                                </Button>
                              </div>
                            ) : (
                              componentFabrics.map((fabric, fabricIdx) => (
                                <div key={fabric.id} className="p-4 border rounded-lg bg-white space-y-3">
                                  {/* Fabric Header */}
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700">
                                      Fabric {fabricIdx + 1}
                                    </span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRemoveFabric(fabric.id)}
                                      className="text-gray-400 hover:text-red-500"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  {/* Fabric Fields - Row 1 */}
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <GenericFabricSelector
                                        value={fabric.genericFabricName}
                                        onChange={(name) => handleUpdateFabric(fabric.id, 'genericFabricName', name)}
                                        required
                                      />
                                    </div>
                                    <div>
                                      <Label>Fabric Finish Type *</Label>
                                      <Select
                                        key={`finish-${fabric.id}-${fabric.fabricFinishType}`}
                                        value={fabric.fabricFinishType}
                                        onValueChange={(v) => handleUpdateFabric(fabric.id, 'fabricFinishType', v)}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Select finish..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {FABRIC_FINISH_TYPES.map((ft) => (
                                            <SelectItem key={ft.value} value={ft.value}>
                                              {ft.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  {/* Embroidery Section */}
                                  <div className="flex items-center gap-6 p-3 bg-purple-50 rounded-lg border border-purple-100">
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        checked={fabric.hasEmbroidery || false}
                                        onCheckedChange={(checked) => {
                                          handleUpdateFabric(fabric.id, 'hasEmbroidery', !!checked);
                                          if (!checked) {
                                            handleClearEmbroidery(fabric.id);
                                          }
                                        }}
                                      />
                                      <Label className="cursor-pointer flex items-center gap-1 text-sm">
                                        <Sparkles className="h-4 w-4 text-purple-600" />
                                        Has Embroidery
                                      </Label>
                                    </div>

                                    {fabric.hasEmbroidery && (
                                      <div className="flex-1">
                                        {fabric.embroideryId ? (
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="font-mono text-xs">
                                              {fabric.embroideryCode}
                                            </Badge>
                                            <span className="text-sm">{fabric.embroideryName}</span>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handleOpenEmbroideryPicker(fabric.id)}
                                              className="text-xs h-6"
                                            >
                                              Change
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => handleClearEmbroidery(fabric.id)}
                                              className="text-xs h-6 text-red-500"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        ) : (
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleOpenEmbroideryPicker(fabric.id)}
                                            className="h-7 text-xs"
                                          >
                                            Select Design
                                          </Button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* CAD Groups Preview */}
              {fabrics.length > 0 && (
                <div className="mt-6">
                  <CADGroupPreview fabrics={fabrics} />
                </div>
              )}
            </Card>

            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setActiveTab('basic')}>
                Previous
              </Button>
              <Button type="button" onClick={() => handleTabNavigation('trims')}>
                Next: Trims & Materials
              </Button>
            </div>
          </TabsContent>

          {/* TAB 3: TRIMS & MATERIALS */}
          <TabsContent value="trims" className="space-y-6">
            <Card className="p-6">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">Trims & Materials</h2>
                <p className="text-sm text-gray-600">Select trims required for this style. Use "Add New" to create master records inline.</p>
              </div>

              <TrimSelector
                selectedTrims={selectedTrims}
                onChange={setSelectedTrims}
              />
            </Card>

            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setActiveTab('fabrics')}>
                Previous
              </Button>
              <Button type="button" onClick={() => handleTabNavigation('accessories')}>
                Next: Accessories
              </Button>
            </div>
          </TabsContent>

          {/* TAB 4: ACCESSORIES */}
          <TabsContent value="accessories" className="space-y-6">
            {/* Customer Preset Section */}
            {customerAccessoryPresets.length > 0 && (
              <Card className="p-6 bg-purple-50/50 border-purple-200">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    Customer Accessory Preset
                  </h2>
                  <p className="text-sm text-gray-600">Default preset is auto-applied when customer is selected. You can switch presets or modify items below.</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Select value={selectedAccessoryPresetId} onValueChange={handlePresetChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select preset (optional)..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-gray-500">None (Clear Preset)</span>
                        </SelectItem>
                        {customerAccessoryPresets.map((preset) => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {preset.presetName} {preset.isDefault && '(Default)'} ({preset.items?.length || 0} items)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const preset = customerAccessoryPresets.find(p => p.id === selectedAccessoryPresetId);
                      if (preset) applyPresetToAccessories(preset);
                    }}
                    disabled={!selectedAccessoryPresetId}
                    className="shrink-0"
                  >
                    Re-apply Preset
                  </Button>
                </div>
                {(presetItemIds.size > 0 || styleSpecificIds.size > 0 || pendingLabelConfigs.length > 0) && (
                  <div className="mt-4 space-y-3">
                    {/* Labels from Preset */}
                    {pendingLabelConfigs.length > 0 && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
                          <span className="inline-block px-1.5 py-0.5 bg-blue-200 rounded-full">Labels</span>
                          {pendingLabelConfigs.length} label(s) from preset
                        </p>
                        <div className="space-y-1">
                          {pendingLabelConfigs.map((lbl, idx) => (
                            <div key={idx} className="text-xs text-blue-800 flex items-center gap-2">
                              <span className="w-1 h-1 bg-blue-400 rounded-full"></span>
                              <span className="font-medium">{lbl.labelName || lbl.labelId}</span>
                              {lbl.componentName && <span className="text-blue-600">→ {lbl.componentName}</span>}
                              {lbl.extraPercentage != null && <span className="text-blue-600">(+{lbl.extraPercentage}%)</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Packaging from Preset */}
                    {presetItemIds.size > 0 && (
                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <p className="text-xs font-semibold text-purple-700 mb-2 flex items-center gap-1">
                          <span className="inline-block px-1.5 py-0.5 bg-purple-200 rounded-full">Packaging</span>
                          {presetItemIds.size} packaging item(s) from preset
                        </p>
                        <div className="space-y-1">
                          {selectedAccessories
                            .filter(acc => presetItemIds.has(acc.masterId))
                            .map((acc, idx) => (
                              <div key={idx} className="text-xs text-purple-800 flex items-center gap-2">
                                <span className="w-1 h-1 bg-purple-400 rounded-full"></span>
                                <span className="font-medium">{acc.itemName}</span>
                                <span className="text-purple-600">Qty: {acc.quantity} {acc.unit}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Style-specific items */}
                    {styleSpecificIds.size > 0 && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
                          <span className="inline-block px-1.5 py-0.5 bg-green-200 rounded-full">Style-specific</span>
                          {styleSpecificIds.size} item(s) added manually
                        </p>
                        <div className="space-y-1">
                          {selectedAccessories
                            .filter(acc => styleSpecificIds.has(acc.masterId))
                            .map((acc, idx) => (
                              <div key={idx} className="text-xs text-green-800 flex items-center gap-2">
                                <span className="w-1 h-1 bg-green-400 rounded-full"></span>
                                <span className="font-medium">{acc.itemName}</span>
                                <span className="text-green-600">Qty: {acc.quantity} {acc.unit}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}

            {/* Accessories Selector */}
            <Card className="p-6">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">Garment Accessories</h2>
                <p className="text-sm text-gray-600">Select labels, polybags, hangtags, cartons, and other packaging materials</p>
              </div>
              <AccessorySelector
                selectedAccessories={selectedAccessories}
                onChange={(newAccessories) => {
                  // Track newly added items that aren't from preset as style-specific
                  const newIds = new Set(newAccessories.map(a => a.masterId));
                  const prevIds = new Set(selectedAccessories.map(a => a.masterId));

                  // Find newly added items
                  const addedIds = [...newIds].filter(id => !prevIds.has(id) && !presetItemIds.has(id));
                  if (addedIds.length > 0) {
                    setStyleSpecificIds(prev => {
                      const updated = new Set(prev);
                      addedIds.forEach(id => updated.add(id));
                      return updated;
                    });
                  }

                  // Remove from styleSpecificIds if item was removed
                  const removedIds = [...prevIds].filter(id => !newIds.has(id));
                  if (removedIds.length > 0) {
                    setStyleSpecificIds(prev => {
                      const updated = new Set(prev);
                      removedIds.forEach(id => updated.delete(id));
                      return updated;
                    });
                  }

                  setSelectedAccessories(newAccessories);
                }}
                customerId={selectedCustomerId}
                presetItemIds={presetItemIds}
                styleSpecificIds={styleSpecificIds}
              />
            </Card>

            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setActiveTab('trims')}>
                Previous
              </Button>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveAsDraft}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save as Draft
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {loading ? 'Saving...' : isEditMode ? 'Update Style' : 'Create Style'}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </form>

      {/* Embroidery Selector Modal */}
      <EmbroiderySelector
        isOpen={embroideryPickerOpen}
        onClose={() => {
          setEmbroideryPickerOpen(false);
          setEmbroideryPickerFabricId(null);
        }}
        onSelect={(embroidery) => {
          if (embroideryPickerFabricId) {
            handleEmbroiderySelect(embroideryPickerFabricId, embroidery);
          }
        }}
        currentEmbroideryId={
          embroideryPickerFabricId
            ? fabrics.find(f => f.id === embroideryPickerFabricId)?.embroideryId
            : null
        }
      />

      {/* Restore Deleted Style Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Style Code Already Exists
            </DialogTitle>
            <DialogDescription className="pt-2">
              The style code <span className="font-semibold text-foreground">"{deletedStyleInfo?.styleCode}"</span> was previously used for a style that has been deleted/archived.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Would you like to restore the deleted style, or use a different style code?
            </p>
            <div className="bg-muted/50 rounded-lg p-4 border">
              <div className="text-sm">
                <span className="text-muted-foreground">Deleted Style:</span>
                <span className="ml-2 font-medium">{deletedStyleInfo?.styleName || deletedStyleInfo?.styleCode}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowRestoreDialog(false);
                setDeletedStyleInfo(null);
              }}
              disabled={restoring}
            >
              Use Different Code
            </Button>
            <Button
              type="button"
              onClick={handleRestoreStyle}
              disabled={restoring}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              {restoring ? 'Restoring...' : 'Restore Style'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
