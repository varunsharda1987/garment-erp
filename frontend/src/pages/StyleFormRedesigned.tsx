/**
 * StyleForm - Redesigned (Phase 4)
 *
 * 4-tab workflow:
 * 1. Basic Info + Additional Details (expandable)
 * 2. Fabrics (uses GenericGreigeSelector)
 * 3. Trims & Materials (Buttons, Zippers, Lace, Thread, etc.)
 * 4. Accessories (Garment & Packaging Accessories)
 *
 * Key Changes:
 * - Generic Greige Name (user selects specific greige later in CAD planning)
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
import { styleService } from '../services/style.service';
import { customerService, type AccessoryPreset } from '../services/customer.service';
import { getAllPresetsForCustomer } from '../services/customerSizePreset.service';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../components/ui/command';
import { toast } from 'sonner';
import { GenericGreigeSelector } from '../components/GenericGreigeSelector';
// MaterialBOMPicker removed - using TrimSelector and AccessorySelector instead
import { EmbroiderySelector } from '../components/EmbroiderySelector';
import ColorPicker from '../components/ColorPicker';
import SeasonSelector from '../components/SeasonSelector';
import type { SeasonSearchResult } from '../types/season.types';
import { TrimSelector } from '../components/TrimSelector';
import type { StyleTrim, TrimType } from '../components/TrimSelector';
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
  RotateCcw,
  Loader2,
  Package,
  X,
} from 'lucide-react';
import { notify } from '../lib/notify';
import { handleApiError, handleApiSuccess } from '../lib/api-error-handler';
import ConfirmDialog from '../components/ConfirmDialog';
import { cn, generateId } from '../lib/utils';
import { getUploadUrl } from '../config/api.config';
import api from '../lib/api';
import { FABRIC_FINISH_TYPES, type FabricFinishType } from '../constants/fabric-finish-types';

// Enums
type CADStatus = 'PENDING' | 'IN_PROGRESS' | 'APPROVED';

interface FabricEntry {
  id: string;
  componentIndex: number; // Index into selectedComponents array
  componentName: string; // Derived from selectedComponents for display/saving
  // Sourcing mode: GREIGE = generic greige name text, READY_FABRIC = direct fabric_master link
  sourcingMode: 'GREIGE' | 'READY_FABRIC';
  genericGreigeName: string;
  // Ready Fabric fields (fabricId is stored in style_fabrics.fabricId)
  fabricId?: string | null;
  fabricCode?: string | null;
  fabricName?: string | null;
  fabricFinishType: FabricFinishType | '';
  // Embroidery support
  hasEmbroidery?: boolean;
  embroideryId?: string | null;
  embroideryName?: string | null;
  embroideryCode?: string | null;
  // Design/Color identification
  printDesign?: string | null; // For PRINTED/YARN_DYED fabrics (mandatory)
  colorMasterId?: string | null; // For SOLID/DYED fabrics (mandatory)
  colorName?: string | null; // Display only, from colorMaster lookup
  // Pattern parts (read-only, set via Fabric Master allocation or CAD Planning)
  patternParts?: Array<{
    id: string;
    patternPartId: string;
    quantity: number;
    goesToEmbroidery?: boolean;
    patternPart: { id: string; code: string; name: string };
  }>;
  // REMOVED: estimatedConsumption, unit, notes, usableWidth, allowCombinedCutting
  // These are now handled in CAD Planning stage
}

interface SKUVariant {
  size: string;
  sku: string;
  barcode?: string;
  isActive: boolean;
}

// Inline component: search fabric_master and return a selected fabric
interface FabricMasterSelectorProps {
  fabricId: string | null;
  fabricCode: string | null;
  fabricName: string | null;
  onSelect: (
    id: string,
    code: string,
    name: string,
    finishType?: string,
    printDesign?: string | null,
    colorMasterId?: string | null,
    colorName?: string | null
  ) => void;
  onClear: () => void;
  // Context for "Create New Fabric" link
  styleId?: string;
  styleCode?: string;
  componentName?: string;
  finishType?: string;
}

function FabricMasterSelector({
  fabricId,
  fabricCode,
  fabricName,
  onSelect,
  onClear,
  styleId,
  styleCode,
  componentName,
  finishType,
}: FabricMasterSelectorProps) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<
    Array<{
      id: string;
      fabricCode: string;
      fabricName: string;
      colorName?: string;
      finishType?: string;
      printDesign?: string | null;
      colorMasterId?: string | null;
    }>
  >([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  React.useEffect(() => {
    if (!query || query.length < 1) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get('/fabric-management/fabric', { params: { search: query, limit: 20 } });
        setResults(res.data?.data || res.data?.fabrics || []);
      } catch (err) {
        console.error('Failed to search fabrics:', err);
        toast.error('Failed to search fabrics');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  if (fabricId) {
    return (
      <div className="space-y-1">
        <Label>Ready Fabric *</Label>
        <div className="flex items-center gap-2 p-2 border rounded-md bg-success-muted border-success/20">
          <Package className="h-4 w-4 text-success shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-mono text-muted-foreground">{fabricCode}</span>
            <span className="text-sm ml-2 truncate">{fabricName}</span>
          </div>
          <button type="button" onClick={onClear} className="text-muted-foreground hover:text-destructive shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1" ref={dropdownRef}>
      <Label>Ready Fabric *</Label>
      <div className="relative">
        <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search fabric master..."
          className="pl-10 pr-10"
        />
        {open && query.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-card border rounded-md shadow-lg max-h-52 overflow-auto">
            {results.length > 0 ? (
              results.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    onSelect(
                      f.id,
                      f.fabricCode,
                      f.fabricName,
                      f.finishType,
                      f.printDesign,
                      f.colorMasterId,
                      f.colorName
                    );
                    setOpen(false);
                    setQuery('');
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                >
                  <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-mono text-xs text-muted-foreground">{f.fabricCode}</span>
                  <span className="truncate">{f.fabricName}</span>
                  {f.colorName && <span className="text-xs text-muted-foreground ml-auto shrink-0">{f.colorName}</span>}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                {loading ? 'Searching...' : 'No fabrics found'}
              </div>
            )}
          </div>
        )}
      </div>
      {/* Create New Fabric link */}
      <a
        href={`/fabric/new?source=style_linked&styleId=${encodeURIComponent(styleId || '')}&styleCode=${encodeURIComponent(styleCode || '')}&componentName=${encodeURIComponent(componentName || '')}&finishType=${encodeURIComponent(finishType || '')}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
      >
        <Plus className="h-3 w-3" />
        Create New Fabric
      </a>
    </div>
  );
}

const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export default function StyleFormRedesigned() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  // Track the style ID after first draft save (for new styles that haven't navigated to edit URL)
  const [savedStyleId, setSavedStyleId] = useState<string | null>(null);
  const effectiveId = id || savedStyleId;
  const isEditMode = !!effectiveId;

  // Style status tracking (DRAFT/ACTIVE)
  const [styleStatus, setStyleStatus] = useState<string>('DRAFT');
  const [publishing, setPublishing] = useState(false);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);

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

  const [styleCode, setStyleCode] = useState('');
  const [buyerStyleRef, setBuyerStyleRef] = useState(''); // Buyer's own reference number
  const [styleName, setStyleName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [category, setCategory] = useState('');
  const [brandCategoryId, setBrandCategoryId] = useState('');
  const [season, setSeason] = useState('');
  const [seasonId, setSeasonId] = useState<string | null>(null);
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
  const [costPrice, setCostPrice] = useState<number | ''>(''); // COST in template
  const [sellingPrice, setSellingPrice] = useState<number | ''>(''); // MRP in template
  const [expectedOrderQty, setExpectedOrderQty] = useState<number | ''>('');
  const [remarks, setRemarks] = useState(''); // Changed from specifications
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
  const [, setComponentCategories] = useState<string[]>([]);
  const [selectedComponents, setSelectedComponents] = useState<
    Array<{ category: string; componentId: string; _originalName?: string }>
  >([]);
  const [openComponentPopovers, setOpenComponentPopovers] = useState<Record<number, boolean>>({});
  const [categoryComponentIds, setCategoryComponentIds] = useState<Set<string>>(new Set()); // Components allowed for selected category

  // Ensure selectedComponents array has enough elements when numberOfComponents changes
  useEffect(() => {
    if (selectedComponents.length < numberOfComponents) {
      const padded = [...selectedComponents];
      while (padded.length < numberOfComponents) {
        padded.push({ category: '', componentId: '' });
      }
      setSelectedComponents(padded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numberOfComponents, selectedComponents.length]);

  // Tab 2: Size & SKU
  const [skuVariants, setSkuVariants] = useState<SKUVariant[]>(
    DEFAULT_SIZES.map((size) => ({
      size,
      sku: '',
      barcode: '',
      isActive: true,
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

  // localStorage Auto-Save State
  const DRAFT_STORAGE_KEY = `style-draft-${id || 'new'}`;
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null);
  const [showLocalRestoreDialog, setShowLocalRestoreDialog] = useState(false);
  const [pendingLocalRestore, setPendingLocalRestore] = useState<{
    data: LocalStorageFormData;
    timestamp: string;
  } | null>(null);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [skipAutoSave, setSkipAutoSave] = useState(false); // Skip auto-save during initial load

  // Interface for localStorage data
  interface LocalStorageFormData {
    styleCode: string;
    styleName: string;
    customerName: string;
    selectedCustomerId: string;
    brandName: string;
    category: string;
    brandCategoryId: string;
    season: string;
    seasonId: string | null;
    description: string;
    selectedProductCategoryL1: string;
    selectedProductCategoryL2: string;
    selectedProductCategoryL3: string;
    productCategoryId: string;
    numberOfComponents: number;
    costPrice: number | '';
    sellingPrice: number | '';
    expectedOrderQty: number | '';
    remarks: string;
    hsnCode: string;
    productTaxRule: string;
    bulletPoints: string;
    accountingUnit: string;
    selectedComponents: Array<{ category: string; componentId: string }>;
    fabrics: FabricEntry[];
    selectedTrims: StyleTrim[];
    selectedAccessories: StyleAccessory[];
    selectedAccessoryPresetId: string;
    skuVariants: SKUVariant[];
    selectedSizePresetId: string;
  }

  // Collect current form data for localStorage
  const collectFormData = (): LocalStorageFormData => ({
    styleCode,
    styleName,
    customerName,
    selectedCustomerId,
    brandName,
    category,
    brandCategoryId,
    season,
    seasonId,
    description,
    selectedProductCategoryL1,
    selectedProductCategoryL2,
    selectedProductCategoryL3,
    productCategoryId,
    numberOfComponents,
    costPrice,
    sellingPrice,
    expectedOrderQty,
    remarks,
    hsnCode,
    productTaxRule,
    bulletPoints,
    accountingUnit,
    selectedComponents,
    fabrics,
    selectedTrims,
    selectedAccessories,
    selectedAccessoryPresetId,
    skuVariants,
    selectedSizePresetId,
  });

  // Restore form data from localStorage
  const restoreFormData = (data: LocalStorageFormData) => {
    setStyleCode(data.styleCode || '');
    setStyleName(data.styleName || '');
    setCustomerName(data.customerName || '');
    setSelectedCustomerId(data.selectedCustomerId || '');
    setBrandName(data.brandName || '');
    setCategory(data.category || '');
    setBrandCategoryId(data.brandCategoryId || '');
    setSeason(data.season || '');
    setSeasonId(data.seasonId || null);
    setDescription(data.description || '');
    setSelectedProductCategoryL1(data.selectedProductCategoryL1 || '');
    setSelectedProductCategoryL2(data.selectedProductCategoryL2 || '');
    setSelectedProductCategoryL3(data.selectedProductCategoryL3 || '');
    setProductCategoryId(data.productCategoryId || '');
    setNumberOfComponents(data.numberOfComponents || 1);
    setCostPrice(data.costPrice ?? '');
    setSellingPrice(data.sellingPrice ?? '');
    setExpectedOrderQty(data.expectedOrderQty ?? '');
    setRemarks(data.remarks || '');
    setHsnCode(data.hsnCode || '');
    setProductTaxRule(data.productTaxRule || '');
    setBulletPoints(data.bulletPoints || '');
    setAccountingUnit(data.accountingUnit || 'Units');
    if (data.selectedComponents?.length > 0) {
      setSelectedComponents(data.selectedComponents);
    }
    if (data.fabrics?.length > 0) {
      setFabrics(data.fabrics);
    }
    if (data.selectedTrims?.length > 0) {
      setSelectedTrims(data.selectedTrims);
    }
    if (data.selectedAccessories?.length > 0) {
      setSelectedAccessories(data.selectedAccessories);
    }
    setSelectedAccessoryPresetId(data.selectedAccessoryPresetId || '');
    if (data.skuVariants?.length > 0) {
      setSkuVariants(data.skuVariants);
    }
    setSelectedSizePresetId(data.selectedSizePresetId || '');
  };

  // Clear localStorage draft
  const clearLocalDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setLastAutoSaved(null);
    setIsFormDirty(false);
  };

  // Compute selected product category with min/max component constraints
  const selectedProductCategory = useMemo(() => {
    if (!productCategoryId) return null;

    // Search in all levels
    const findCategory = (id: string): ProductCategory | null => {
      // Check L1
      const l1 = productCategories.find((c) => c.id === id);
      if (l1) return l1;

      // Check L2
      for (const l2List of Object.values(productSubCategories)) {
        const l2 = l2List.find((c) => c.id === id);
        if (l2) return l2;
      }

      // Check L3
      for (const l3List of Object.values(productSubSubCategories)) {
        const l3 = l3List.find((c) => c.id === id);
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

  // Check for saved draft in localStorage on mount (for new styles or before loading existing style)
  useEffect(() => {
    // Skip for edit mode - we load from DB instead
    if (isEditMode) {
      setSkipAutoSave(true);
      return;
    }

    const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.data && parsed.timestamp) {
          // Check if saved data has any meaningful content
          const data = parsed.data as LocalStorageFormData;
          const hasContent =
            data.styleCode ||
            data.styleName ||
            data.customerName ||
            data.fabrics?.length > 0 ||
            data.selectedTrims?.length > 0;
          if (hasContent) {
            setPendingLocalRestore({ data, timestamp: parsed.timestamp });
            setShowLocalRestoreDialog(true);
          }
        }
      } catch (e) {
        console.error('Failed to parse saved draft:', e);
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    }
    // Allow auto-save after initial check
    const autoSaveTimer = setTimeout(() => setSkipAutoSave(false), 1000);
    return () => clearTimeout(autoSaveTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save to localStorage (debounced)
  useEffect(() => {
    // Skip during initial load or in edit mode when loading from DB
    if (skipAutoSave || loading) return;

    // Skip if no meaningful data entered
    if (!styleCode && !styleName && !customerName && fabrics.length === 0) return;

    const timeout = setTimeout(() => {
      const formData = collectFormData();
      localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          data: formData,
          timestamp: new Date().toISOString(),
        })
      );
      setLastAutoSaved(new Date());
      setIsFormDirty(false);
    }, 3000); // 3 second debounce

    // Mark form as dirty immediately
    setIsFormDirty(true);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    styleCode,
    styleName,
    customerName,
    brandName,
    category,
    season,
    description,
    productCategoryId,
    numberOfComponents,
    costPrice,
    sellingPrice,
    expectedOrderQty,
    remarks,
    hsnCode,
    selectedComponents,
    fabrics,
    selectedTrims,
    selectedAccessories,
    selectedAccessoryPresetId,
    skuVariants,
    skipAutoSave,
    loading,
  ]);

  // Re-fetch suggested components when componentMasters loads and a product category is already selected
  useEffect(() => {
    if (componentMasters.length > 0 && productCategoryId && categoryComponentIds.size === 0) {
      // Component masters just loaded, but we have a product category selected and no filter set yet
      // This handles the race condition where category was selected before components loaded
      updateProductCategoryId(selectedProductCategoryL1, selectedProductCategoryL2, selectedProductCategoryL3, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setProductSubCategories((prev) => ({ ...prev, [parentId]: children }));
    } catch (error) {
      console.error('Failed to load product sub-categories:', error);
    }
  };

  // Load product sub-sub-categories when L2 is selected
  const loadProductSubSubCategories = async (parentId: string) => {
    if (!parentId || productSubSubCategories[parentId]) return;
    try {
      const children = await productCategoryService.getChildren(parentId);
      setProductSubSubCategories((prev) => ({ ...prev, [parentId]: children }));
    } catch (error) {
      console.error('Failed to load product sub-sub-categories:', error);
    }
  };

  // Determine final product category ID from selections and auto-populate components
  const updateProductCategoryId = async (
    l1: string,
    l2: string,
    l3: string,
    autoPopulateComponents: boolean = true
  ) => {
    const finalCategoryId = l3 || l2 || l1;
    setProductCategoryId(finalCategoryId);

    // Fetch suggested components for this category (for filtering the dropdown)
    if (finalCategoryId && componentMasters.length > 0) {
      try {
        const suggestions = await productCategoryService.getSuggestedComponents(finalCategoryId);

        // Store the allowed component IDs for this category
        const allowedIds = new Set(suggestions.map((s) => s.componentMasterId));
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
    const newComponents = suggestions.map((suggestion) => {
      // Find the component master to get its category
      const componentMaster = componentMasters.find((cm) => cm.id === suggestion.componentMasterId);
      return {
        category: componentMaster?.componentCategory || suggestion.componentMaster.componentCategory || '',
        componentId: suggestion.componentMasterId,
      };
    });

    setSelectedComponents(newComponents);

    // Clear existing fabrics and create new ones for each component
    const newFabrics = newComponents.map((comp, index) => {
      const componentMaster = componentMasters.find((cm) => cm.id === comp.componentId);
      return {
        id: `temp-${Date.now()}-${index}`,
        componentIndex: index,
        componentName: componentMaster?.name || '',
        sourcingMode: 'GREIGE' as const,
        genericGreigeName: '',
        fabricId: null,
        fabricCode: null,
        fabricName: null,
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
  // Track if fabrics have been modified during edit (for validation purposes)
  const fabricsModifiedRef = React.useRef(false);
  // Track if LNG auto-fill has been applied (to prevent re-triggering)
  const lngAutoFillAppliedRef = React.useRef(false);

  // Load style data in edit mode - wait for both customers AND componentMasters to be loaded
  useEffect(() => {
    let loadTimer: ReturnType<typeof setTimeout>;
    if (isEditMode && id && customers.length > 0 && componentMasters.length > 0 && !styleLoadedRef.current) {
      styleLoadedRef.current = true;
      loadStyleData(id).then(() => {
        // Mark initial load as complete after a short delay to allow state to settle
        loadTimer = setTimeout(() => {
          initialLoadCompleteRef.current = true;
          // Reset fabric modification tracking - loaded fabrics are not "modified"
          fabricsModifiedRef.current = false;
        }, 100);
      });
    }
    return () => {
      if (loadTimer) clearTimeout(loadTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, id, customers.length, componentMasters.length]);

  // Load customer brands when customer selected - MATCHES OLD STYLEFORM
  // NOTE: This effect only populates availableBrands - it does NOT reset brandName
  // The reset is handled by handleCustomerChange when user manually changes customer
  useEffect(() => {
    // Skip this effect during initial edit mode load - loadStyleData handles it
    // Use URL id (not isEditMode) to avoid skipping for saved-draft new styles
    if (id && !initialLoadCompleteRef.current) {
      return;
    }

    if (selectedCustomerId) {
      const customer = customers.find((c) => c.id === selectedCustomerId);
      if (customer) {
        // Use customer.name directly (same as old StyleForm)
        setCustomerName(customer.name);

        // Extract brands from brandCategories (same as old StyleForm)
        if (
          customer.brandCategories &&
          Array.isArray(customer.brandCategories) &&
          customer.brandCategories.length > 0
        ) {
          const uniqueBrands = [...new Set(customer.brandCategories.map((bc: BrandCategory) => bc.brandName))];
          setAvailableBrands(uniqueBrands);

          // In edit mode, if brandName is already set but availableCategories is empty, populate them
          if (isEditMode && brandName && availableCategories.length === 0) {
            const brandCategories = customer.brandCategories.filter((bc: BrandCategory) => bc.brandName === brandName);
            setAvailableCategories(brandCategories);
          }
        } else if (customer.brandNames) {
          // Fallback to old format (same as old StyleForm)
          const brands = customer.brandNames
            .split('\n')
            .map((b: string) => b.trim())
            .filter((b: string) => b);
          setAvailableBrands(brands);
        } else {
          setAvailableBrands([]);
        }

        loadAccessoryPresets(selectedCustomerId);
        loadSizePresets(selectedCustomerId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Use URL id (not isEditMode) to avoid skipping for saved-draft new styles
    if (id && !initialLoadCompleteRef.current) {
      return;
    }

    if (selectedCustomerId && brandName) {
      const customer = customers.find((c) => c.id === selectedCustomerId);
      if (customer?.brandCategories) {
        // Filter brand categories for the selected brand
        const brandCategories = customer.brandCategories.filter((bc: BrandCategory) => bc.brandName === brandName);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandName, selectedCustomerId, customers]);

  // Auto-generate style code when brand category + product category are selected (create mode only)
  useEffect(() => {
    // Only auto-generate in create mode, not edit mode
    if (isEditMode) return;
    // Skip during initial load
    if (!initialLoadCompleteRef.current && !brandCategoryId) return;

    // Need both brand category and product category to generate code
    // Brand category determines the brand prefix (e.g., "EBW" for Easybuy Westernwear)
    if (brandCategoryId && productCategoryId) {
      const generateCode = async () => {
        try {
          const result = await styleService.getNextStyleCode(brandCategoryId, productCategoryId);
          setStyleCode(result.nextCode);
        } catch (error) {
          console.error('Failed to generate style code:', error);
        }
      };
      generateCode();
    } else if (!brandCategoryId && !productCategoryId) {
      // Reset if both are cleared
      setStyleCode('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandCategoryId, productCategoryId, isEditMode]);

  const loadCustomers = async () => {
    try {
      const response = await customerService.getAllCustomers({ limit: 100 });
      setCustomers(response.data);
    } catch (error) {
      console.error('Failed to load customers:', error);
      notify.error('Failed to load customers');
    }
  };

  const loadComponentMasters = async () => {
    try {
      const [mastersResponse, categoriesResponse, groupsResponse] = await Promise.all([
        getAllComponentMasters({ activeOnly: true, limit: 100 }),
        getCategories(),
        componentGroupService.getAll({ page: 1, limit: 100, isActive: true }),
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

      // Track style status for Publish button
      setStyleStatus((style as unknown as { status?: string }).status || 'DRAFT');

      // Populate basic info
      setStyleCode(style.styleCode);
      setStyleName(style.styleName || '');
      setDescription(style.description || '');
      // Note: category is set from brand_categories relation, not from style.category
      // brandCategoryId is set later after customer matching
      // setBrandCategoryId is set after customer/brand matching to ensure availableCategories is populated first
      setSeason(style.season || '');
      setSeasonId(style.seasonId || null);

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
      // These fields may exist on the API response but aren't in the Style type
      const styleData = style as unknown as Record<string, unknown>;
      // BUG-S10: ?? keeps a legitimate 0 (|| blanked ₹0 prices on load)
      setCostPrice((styleData.costPrice as number) ?? '');
      setSellingPrice((styleData.sellingPrice as number) ?? '');
      // BUG-S6: serialized key is expectedOrderQuantity (the column name), not expectedOrderQty
      setExpectedOrderQty((styleData.expectedOrderQuantity as number) ?? '');
      setRemarks(style.specifications || ''); // Using specifications field for remarks
      setHsnCode((styleData.hsnCode as string) || '');
      setProductTaxRule((styleData.productTaxRule as string) || '');
      setBulletPoints((styleData.bulletPoints as string) || '');
      setBuyerStyleRef((styleData.buyerStyleRef as string) || '');
      setAccountingUnit((styleData.accountingUnit as string) || 'Units');
      setImageUrl(style.imageUrl || '');

      // Save brand/category info from style (will set state later after populating options)
      const savedBrandName = style.brandName || '';
      const savedBrandCategoryId = style.brandCategoryId || '';
      // Note: backend serializer converts brand_categories to brandCategories (camelCase)
      const savedCategoryName = style.brandCategories?.category || '';

      // Don't set brandName/brandCategoryId yet - wait until availableBrands is populated
      // to avoid React Select validation issues

      // Hoist preset data for use in BOM loading below
      let loadedPresets: AccessoryPreset[] | null = null;

      // Find and set customer by name
      const matchingCustomer = customers.find((c) => c.name === style.customerName);
      // If customer found but brandCategories not populated, fetch customer details
      let customerWithBrands = matchingCustomer;
      if (matchingCustomer && (!matchingCustomer.brandCategories || matchingCustomer.brandCategories.length === 0)) {
        try {
          const customerDetails = await customerService.getCustomerById(matchingCustomer.id);
          customerWithBrands = customerDetails;
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
        loadedPresets = presets;

        // Restore preset ID selection (actual merge happens below in BOM loading)
        const customerAccessoriesPresetId = styleData.customerAccessoriesPresetId as string | undefined;
        if (customerAccessoriesPresetId && presets) {
          setSelectedAccessoryPresetId(customerAccessoriesPresetId);
        }

        // Populate available brands from customer's brandCategories
        if (
          customerWithBrands.brandCategories &&
          Array.isArray(customerWithBrands.brandCategories) &&
          customerWithBrands.brandCategories.length > 0
        ) {
          const uniqueBrands = [
            ...new Set(customerWithBrands.brandCategories.map((bc: BrandCategory) => bc.brandName)),
          ];
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
              const matchingBrandCategory = brandCategories.find((bc: BrandCategory) => bc.id === savedBrandCategoryId);
              if (matchingBrandCategory) {
                // Update category name from customer's current data
                setCategory(matchingBrandCategory.category);
                // NOW set the brand category ID after options are available
                setBrandCategoryId(savedBrandCategoryId);
              } else {
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
      }

      // Load SKU variants if available (from style_variants table).
      // Serializer emits the key `styleVariants` (styleVariants->styleVariants), NOT `variants`.
      // Reading the wrong key left the form on default blank rows and the save then
      // deleted+recreated auto-generated SKUs, destroying the saved variants (B05-02).
      const skuVariantsData = (styleData.styleVariants || []) as Array<{
        sizeName?: string;
        size?: string;
        sku: string;
        barcode?: string;
        isActive?: boolean;
      }>;
      if (skuVariantsData.length > 0) {
        setSkuVariants(
          skuVariantsData.map((sku) => ({
            size: sku.sizeName || sku.size || '',
            sku: sku.sku,
            barcode: sku.barcode || '',
            isActive: sku.isActive !== false,
          }))
        );
      }

      // Load fabrics if available (serializer converts style_fabrics → fabrics)
      const fabricsData = ((styleData.fabrics as unknown[]) || []) as Array<{
        id?: string;
        componentName?: string;
        componentIndex?: number;
        genericGreigeName?: string;
        fabricFinishType?: string;
        hasEmbroidery?: boolean;
        embroideryId?: string;
        embroidery?: { designName?: string; embroideryCode?: string };
        fabricId?: string;
        fabric?: {
          id?: string;
          fabricCode?: string;
          fabricName?: string;
          finishType?: string;
          printDesign?: string | null;
          colorMasterId?: string | null;
          colorName?: string | null;
        };
        // Design/Color identification
        printDesign?: string | null;
        colorMasterId?: string | null;
        colorMaster?: { colorName?: string | null };
      }>;
      if (fabricsData.length > 0) {
        // Map component names to indices based on loaded components
        const loadedComponents = style.components || [];

        // ID validation helpers - prevents invalid data from entering state
        // UUID format (used by fabric_master)
        const isValidUUID = (id: string | null | undefined): id is string =>
          !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        // CUID format (used by color_master, embroidery_master)
        const isValidCUID = (id: string | null | undefined): id is string => !!id && /^c[a-z0-9]{20,}$/i.test(id);
        // Combined validator for fields that might be UUID or CUID
        const isValidId = (id: string | null | undefined): id is string => isValidUUID(id) || isValidCUID(id);

        setFabrics(
          fabricsData.map((sf) => {
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
            // Determine sourcing mode from fabricId presence - validate UUIDs
            const rawFabricId = sf.fabricId || sf.fabric?.id;
            const fabricId = isValidUUID(rawFabricId) ? rawFabricId : null;
            const sourcingMode: 'GREIGE' | 'READY_FABRIC' = fabricId ? 'READY_FABRIC' : 'GREIGE';

            // Validate ID fields to prevent corrupt data from entering state
            const rawColorMasterId = sf.colorMasterId || sf.fabric?.colorMasterId;
            const rawEmbroideryId = sf.embroideryId;

            return {
              id: sf.id || generateId(),
              componentIndex,
              componentName: sf.componentName || '',
              sourcingMode,
              genericGreigeName: sf.genericGreigeName || '',
              fabricId,
              fabricCode: sf.fabric?.fabricCode || null,
              fabricName: sf.fabric?.fabricName || null,
              fabricFinishType: (sf.fabricFinishType || sf.fabric?.finishType || '') as FabricFinishType | '',
              // Design/Color identification - use isValidId for CUID fields
              printDesign: sf.printDesign || sf.fabric?.printDesign || null,
              colorMasterId: isValidId(rawColorMasterId) ? rawColorMasterId : null,
              colorName: sf.colorMaster?.colorName || sf.fabric?.colorName || null,
              // Embroidery support - use isValidId for CUID fields
              hasEmbroidery: sf.hasEmbroidery || false,
              embroideryId: isValidId(rawEmbroideryId) ? rawEmbroideryId : null,
              embroideryName: sf.embroidery?.designName || null,
              embroideryCode: sf.embroidery?.embroideryCode || null,
              // Pattern parts (read-only display)
              patternParts: (sf as typeof sf & { patternParts?: FabricEntry['patternParts'] }).patternParts || [],
            } as FabricEntry;
          })
        );
      }

      // Load material BOM (trims) if available
      // The backend includes specific material masters (laceMaster, buttonMaster, etc.)
      // We need to extract the name and code from the appropriate master based on materialType
      if (style.styleMaterialBom && style.styleMaterialBom.length > 0) {
        const getMaterialDetails = (bom: Record<string, unknown>) => {
          // Try to get details from specific material masters
          const masters = [
            { key: 'laceMaster', nameField: 'laceName', codeField: 'laceCode' },
            { key: 'buttonMaster', nameField: 'buttonName', codeField: 'buttonCode' },
            { key: 'threadMaster', nameField: 'threadName', codeField: 'threadCode' },
            { key: 'zipperMaster', nameField: 'zipperName', codeField: 'zipperCode' },
            { key: 'elasticMaster', nameField: 'elasticName', codeField: 'elasticCode' },
            { key: 'labelMaster', nameField: 'labelName', codeField: 'labelCode' },
            { key: 'packagingMaster', nameField: 'packagingName', codeField: 'packagingCode' },
            // Generic trim masters
            { key: 'hookEyeMaster', nameField: 'hookEyeName', codeField: 'hookEyeCode' },
            { key: 'snapButtonMaster', nameField: 'snapButtonName', codeField: 'snapButtonCode' },
            { key: 'buckleMaster', nameField: 'buckleName', codeField: 'buckleCode' },
            { key: 'beltMaster', nameField: 'beltName', codeField: 'beltCode' },
            { key: 'velcroMaster', nameField: 'velcroName', codeField: 'velcroCode' },
            { key: 'drawstringMaster', nameField: 'drawstringName', codeField: 'drawstringCode' },
            { key: 'ribbonMaster', nameField: 'ribbonName', codeField: 'ribbonCode' },
            { key: 'sequinMaster', nameField: 'sequinName', codeField: 'sequinCode' },
            { key: 'beadMaster', nameField: 'beadName', codeField: 'beadCode' },
            { key: 'motifMaster', nameField: 'motifName', codeField: 'motifCode' },
            { key: 'interliningMaster', nameField: 'interliningName', codeField: 'interliningCode' },
            { key: 'paddingMaster', nameField: 'paddingName', codeField: 'paddingCode' },
            { key: 'otherFastenerMaster', nameField: 'otherFastenerName', codeField: 'otherFastenerCode' },
            { key: 'otherTapeMaster', nameField: 'otherTapeName', codeField: 'otherTapeCode' },
            { key: 'otherDecorativeMaster', nameField: 'otherDecorativeName', codeField: 'otherDecorativeCode' },
            { key: 'otherFunctionalMaster', nameField: 'otherFunctionalName', codeField: 'otherFunctionalCode' },
          ];

          for (const master of masters) {
            const masterObj = bom[master.key] as Record<string, string> | undefined;
            if (masterObj) {
              return {
                name: masterObj[master.nameField] || masterObj.name || '',
                code: masterObj[master.codeField] || masterObj.code || '',
              };
            }
          }

          // Fallback to generic material if available
          const material = bom.material as { name?: string; code?: string } | undefined;
          if (material) {
            return {
              name: material.name || '',
              code: material.code || '',
            };
          }

          return { name: '', code: '' };
        };

        // Load accessories (LABEL and PACKAGING types) from BOM
        const bomAccessories: StyleAccessory[] = style.styleMaterialBom
          .filter(
            (bom: { usageCategory?: string; materialType?: string }) =>
              bom.usageCategory === 'PACKAGING' || bom.materialType === 'LABEL' || bom.materialType === 'PACKAGING'
          )
          .map((bom) => {
            const bomRecord = bom as unknown as Record<string, unknown>;
            const materialDetails = getMaterialDetails(bomRecord);
            const masterId = bom.materialType === 'LABEL' ? bom.labelId || '' : bom.packagingId || '';
            return {
              accessoryType: (bom.materialType === 'LABEL' ? 'LABEL' : 'PACKAGING') as 'LABEL' | 'PACKAGING',
              masterId,
              masterCode: materialDetails.code,
              masterName: materialDetails.name,
              subType: (bomRecord.labelType as string) || (bomRecord.packagingType as string) || null,
            };
          });

        // Merge with preset items that may be missing from BOM (e.g., labels lost during migration)
        let allAccessories: StyleAccessory[] = bomAccessories;
        const presetId = styleData.customerAccessoriesPresetId as string | undefined;
        if (presetId && loadedPresets) {
          const savedPreset = loadedPresets.find((p: AccessoryPreset) => p.id === presetId);
          if (savedPreset?.items) {
            // Use material CODES for comparison (BOM uses packagingId, preset uses materialId - different ID systems)
            const bomMasterCodes = new Set(bomAccessories.map((a) => a.masterCode).filter(Boolean));
            const missingFromPreset: StyleAccessory[] = savedPreset.items
              .filter((item) => {
                const code = item.materialType === 'LABEL' ? item.label?.labelCode || '' : item.material?.code || '';
                return code && !bomMasterCodes.has(code);
              })
              .map((item) => ({
                accessoryType: (item.materialType === 'LABEL' ? 'LABEL' : 'PACKAGING') as 'LABEL' | 'PACKAGING',
                masterId: item.materialType === 'LABEL' ? item.labelId || '' : item.materialId || '',
                masterCode: item.materialType === 'LABEL' ? item.label?.labelCode || '' : item.material?.code || '',
                masterName:
                  item.materialType === 'LABEL'
                    ? item.label?.labelName || item.label?.labelCode || ''
                    : item.material?.name || '',
                subType: null,
              }));
            allAccessories = [...bomAccessories, ...missingFromPreset];

            // Track BOM items that match preset items by CODE (not ID) for correct badge display
            // BOM uses packagingId, preset uses materialId - different ID systems, same masterCode

            const presetCodes = new Set(
              savedPreset.items
                .map((item) =>
                  item.materialType === 'LABEL' ? item.label?.labelCode || '' : item.material?.code || ''
                )
                .filter(Boolean)
            );
            // Use BOM's masterId for items that exist in preset (by code match)
            const presetIds = new Set(
              bomAccessories
                .filter((acc) => presetCodes.has(acc.masterCode))
                .map((acc) => acc.masterId)
                .filter(Boolean)
            );
            setPresetItemIds(presetIds);
          }
        }
        // Deduplicate accessories by masterCode + accessoryType (code is consistent across ID systems)
        const uniqueAccessories = allAccessories.filter(
          (acc, index, self) =>
            index === self.findIndex((a) => a.masterCode === acc.masterCode && a.accessoryType === acc.accessoryType)
        );
        setSelectedAccessories(uniqueAccessories);

        // Load trims (all 21 trim types with GARMENT_TRIM usage)
        const ALL_TRIM_TYPES = [
          'BUTTON',
          'THREAD',
          'ZIPPER',
          'ELASTIC',
          'LACE',
          'HOOK_EYE',
          'SNAP_BUTTON',
          'BUCKLE',
          'BELT',
          'VELCRO',
          'OTHER_FASTENER',
          'DRAWSTRING',
          'RIBBON',
          'OTHER_TAPE',
          'SEQUIN',
          'BEAD',
          'MOTIF',
          'OTHER_DECORATIVE',
          'INTERLINING',
          'PADDING',
          'OTHER_FUNCTIONAL',
        ];
        const loadedTrims = style.styleMaterialBom
          .filter(
            (bom: { usageCategory?: string; materialType?: string }) =>
              bom.usageCategory === 'GARMENT_TRIM' && ALL_TRIM_TYPES.includes(bom.materialType || '')
          )
          .map((bom) => {
            const bomRecord = bom as unknown as Record<string, unknown>;
            const materialDetails = getMaterialDetails(bomRecord);
            // Get the masterId from the appropriate FK field (legacy + generic trims)
            const masterId = (bomRecord.buttonId ||
              bomRecord.threadId ||
              bomRecord.zipperId ||
              bomRecord.elasticId ||
              bomRecord.laceId ||
              bomRecord.hookEyeId ||
              bomRecord.snapButtonId ||
              bomRecord.buckleId ||
              bomRecord.beltId ||
              bomRecord.velcroId ||
              bomRecord.drawstringId ||
              bomRecord.ribbonId ||
              bomRecord.sequinId ||
              bomRecord.beadId ||
              bomRecord.motifId ||
              bomRecord.interliningId ||
              bomRecord.paddingId ||
              bomRecord.otherFastenerId ||
              bomRecord.otherTapeId ||
              bomRecord.otherDecorativeId ||
              bomRecord.otherFunctionalId ||
              '') as string;
            return {
              trimType: bom.materialType as TrimType,
              masterId: masterId,
              masterCode: materialDetails.code,
              masterName: materialDetails.name || (bomRecord.componentName as string) || '',
              color: null,
            };
          });

        if (loadedTrims.length > 0) {
          setSelectedTrims(loadedTrims);
        }
      } else {
        // BOM is empty but style has a preset configured - load preset items directly
        const presetId = styleData.customerAccessoriesPresetId as string | undefined;
        if (presetId && loadedPresets) {
          const savedPreset = loadedPresets.find((p: AccessoryPreset) => p.id === presetId);
          if (savedPreset?.items && savedPreset.items.length > 0) {
            const presetAccessories: StyleAccessory[] = savedPreset.items
              .filter(
                (item) =>
                  (item.materialType === 'LABEL' && item.labelId) ||
                  (item.materialType === 'PACKAGING' && item.materialId)
              )
              .map((item) => ({
                accessoryType: (item.materialType === 'LABEL' ? 'LABEL' : 'PACKAGING') as 'LABEL' | 'PACKAGING',
                masterId: item.materialType === 'LABEL' ? item.labelId || '' : item.materialId || '',
                masterCode: item.materialType === 'LABEL' ? item.label?.labelCode || '' : item.material?.code || '',
                masterName:
                  item.materialType === 'LABEL'
                    ? item.label?.labelName || item.label?.labelCode || ''
                    : item.material?.name || '',
                subType: null,
              }));
            setSelectedAccessories(presetAccessories);
            // Track all as preset items for badge display
            setPresetItemIds(new Set(presetAccessories.map((a) => a.masterId).filter(Boolean)));
          }
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
          // Find the component master by name (case-insensitive, trimmed)
          const normalizedName = sc.componentName?.trim().toLowerCase();
          const matchingMaster = componentMasters.find((cm) => cm.name?.trim().toLowerCase() === normalizedName);
          if (!matchingMaster && sc.componentName) {
            console.warn(
              `[Style Load] Component "${sc.componentName}" not found in masters. Available:`,
              componentMasters.map((cm) => cm.name)
            );
          }
          return {
            category: sc.componentType || '',
            componentId: matchingMaster?.id || '',
            // Preserve original name for debugging
            _originalName: sc.componentName,
          };
        });

        // If saved components exist but numberOfComponents is different,
        // pad or trim the components array to match numberOfComponents
        if (loadedComponents.length < savedNumComponents) {
          // Pad with empty components
          while (loadedComponents.length < savedNumComponents) {
            loadedComponents.push({ category: '', componentId: '', _originalName: undefined });
          }
        } else if (loadedComponents.length > savedNumComponents) {
          // Trim to numberOfComponents (keep first N)
          loadedComponents.length = savedNumComponents;
        }

        setSelectedComponents(loadedComponents);
      } else {
        // No saved components - initialize with numberOfComponents empty slots
        setSelectedComponents(
          Array.from({ length: savedNumComponents }, () => ({
            category: '',
            componentId: '',
            _originalName: undefined,
          }))
        );
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
      const presets = await customerService.getAccessoryPresets(customerId);
      setCustomerAccessoryPresets(presets);

      // Auto-apply default preset if exists and not in edit mode
      if (!isEditMode && presets.length > 0) {
        const defaultPreset = presets.find((p) => p.isDefault);
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
   * Both LABEL and PACKAGING items are added to selectedAccessories and saved to style_material_bom.
   */
  const applyPresetToAccessories = (preset: AccessoryPreset) => {
    if (!preset?.items || preset.items.length === 0) return;

    // Map ALL preset items (LABEL + PACKAGING) to StyleAccessory format
    const presetAccessories: StyleAccessory[] = preset.items
      .filter(
        (item) =>
          (item.materialType === 'LABEL' && item.labelId) || (item.materialType === 'PACKAGING' && item.materialId)
      )
      .map((item) => {
        if (item.materialType === 'LABEL') {
          return {
            accessoryType: 'LABEL' as const,
            masterId: item.labelId!,
            masterCode: item.label?.labelCode || '',
            masterName: item.label?.labelName || item.label?.labelCode || '',
            subType: null,
          };
        } else {
          return {
            accessoryType: 'PACKAGING' as const,
            masterId: item.materialId!,
            masterCode: item.material?.code || '',
            masterName: item.material?.name || '',
            subType: null,
          };
        }
      });

    // Track which IDs came from preset
    const newPresetIds = new Set(presetAccessories.map((a) => a.masterId));
    setPresetItemIds(newPresetIds);

    // Merge accessories: keep manual items (not from preset), add preset items (avoiding duplicates)
    setSelectedAccessories((prev) => {
      // Use newPresetIds (local variable) instead of presetItemIds (state) to avoid stale closure
      const manualItems = prev.filter((item) => !newPresetIds.has(item.masterId));
      const manualIds = new Set(manualItems.map((i) => i.masterId));
      const newPresetItems = presetAccessories.filter((i) => !manualIds.has(i.masterId));
      return [...manualItems, ...newPresetItems];
    });

    setSelectedAccessoryPresetId(preset.id);

    // Show notification with counts
    const labelCount = presetAccessories.filter((a) => a.accessoryType === 'LABEL').length;
    const packagingCount = presetAccessories.filter((a) => a.accessoryType === 'PACKAGING').length;
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
      setSelectedAccessories((prev) => prev.filter((item) => !presetItemIds.has(item.masterId)));
      setPresetItemIds(new Set());
      return;
    }

    const preset = customerAccessoryPresets.find((p) => p.id === presetId);
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
        const defaultPreset = presets.find((p) => p.isDefault);
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
    const presetVariants: SKUVariant[] = preset.sizeCategory.sizes.map((size) => ({
      size,
      sku: '',
      barcode: '',
      isActive: true,
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
      setSkuVariants(
        DEFAULT_SIZES.map((size) => ({
          size,
          sku: '',
          barcode: '',
          isActive: true,
        }))
      );
      return;
    }

    const preset = customerSizePresets.find((p) => p.id === presetId);
    if (preset) {
      applyPresetToSizes(preset);
    }
  };

  // LNG Prefix Auto-Fill: Auto-populate Nightgown component for new LNG styles
  useEffect(() => {
    if (isEditMode) return;
    const isLNG = styleCode.toUpperCase().startsWith('LNG');

    if (!isLNG) {
      lngAutoFillAppliedRef.current = false;
      return;
    }
    if (lngAutoFillAppliedRef.current) return;
    if (componentMasters.length === 0) return;

    const nightgownMaster = componentMasters.find((cm) => cm.name.toLowerCase() === 'nightgown');
    if (!nightgownMaster) return;

    lngAutoFillAppliedRef.current = true;

    setNumberOfComponents(1);
    setSelectedComponents([
      {
        category: nightgownMaster.componentGroup?.code || 'FULL',
        componentId: nightgownMaster.id,
        _originalName: nightgownMaster.name,
      },
    ]);

    setFabrics([
      {
        id: `temp-${Date.now()}-0`,
        componentIndex: 0,
        componentName: 'Nightgown',
        sourcingMode: 'GREIGE' as const,
        genericGreigeName: '',
        fabricId: null,
        fabricCode: null,
        fabricName: null,
        fabricFinishType: '' as FabricFinishType | '',
        hasEmbroidery: false,
        embroideryId: null,
        embroideryName: null,
        embroideryCode: null,
      },
    ]);

    notify.success('LNG style detected: Auto-populated Nightgown component');
  }, [styleCode, isEditMode, componentMasters]);

  // LNG Prefix: Apply Nihsamah size preset when presets load after customer selection
  useEffect(() => {
    if (isEditMode) return;
    if (!styleCode.toUpperCase().startsWith('LNG')) return;
    if (!lngAutoFillAppliedRef.current) return;
    if (selectedSizePresetId) return;
    if (customerSizePresets.length === 0) return;

    const nihsamahPreset = customerSizePresets.find((p) => p.presetName.toLowerCase() === 'nihsamah');
    if (nihsamahPreset) {
      applyPresetToSizes(nihsamahPreset);
    }
  }, [customerSizePresets, styleCode, isEditMode, selectedSizePresetId]);

  // LNG Prefix: Apply Nihsamah accessory preset when accessory presets load
  useEffect(() => {
    if (isEditMode) return;
    if (!styleCode.toUpperCase().startsWith('LNG')) return;
    if (!lngAutoFillAppliedRef.current) return;
    if (selectedAccessoryPresetId) return;
    if (customerAccessoryPresets.length === 0) return;

    const nihsamahPreset = customerAccessoryPresets.find((p) => p.presetName.toLowerCase().includes('nihsamah'));
    if (nihsamahPreset) {
      applyPresetToAccessories(nihsamahPreset);
    }
  }, [customerAccessoryPresets, styleCode, isEditMode, selectedAccessoryPresetId]);

  // Helper to get component name from index
  const getComponentName = (componentIndex: number): string => {
    const component = selectedComponents[componentIndex];
    if (component?.componentId) {
      const master = componentMasters.find((cm) => cm.id === component.componentId);
      return master?.name || `Component ${componentIndex + 1}`;
    }
    return `Component ${componentIndex + 1}`;
  };

  // Add fabric to specific component
  const handleAddFabricToComponent = (componentIndex: number) => {
    fabricsModifiedRef.current = true; // Track modification for validation
    const componentName = getComponentName(componentIndex);
    const newFabricId = generateId();

    const newFabric = {
      id: newFabricId,
      componentIndex,
      componentName,
      sourcingMode: 'GREIGE' as const,
      genericGreigeName: '',
      fabricId: null,
      fabricCode: null,
      fabricName: null,
      fabricFinishType: '' as FabricFinishType | '',
      hasEmbroidery: false,
      embroideryId: null,
      embroideryName: null,
      embroideryCode: null,
    };

    setFabrics((prevFabrics) => [...prevFabrics, newFabric]);

    // Expand this component section if not already expanded
    if (!expandedComponents.includes(componentIndex)) {
      setExpandedComponents([...expandedComponents, componentIndex]);
    }

    // Visual feedback
    notify.success(`Fabric added to ${componentName}`);

    // Auto-scroll to the new fabric entry after render
    setTimeout(() => {
      document.getElementById(`fabric-${newFabricId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  // Toggle component section expansion
  const toggleComponentExpanded = (componentIndex: number) => {
    setExpandedComponents((prev) =>
      prev.includes(componentIndex) ? prev.filter((i) => i !== componentIndex) : [...prev, componentIndex]
    );
  };

  const handleRemoveFabric = (id: string) => {
    fabricsModifiedRef.current = true; // Track modification for validation
    setFabrics(fabrics.filter((f) => f.id !== id));
  };

  const handleUpdateFabric = (id: string, field: keyof FabricEntry, value: FabricEntry[keyof FabricEntry]) => {
    fabricsModifiedRef.current = true; // Track modification for validation
    // Use functional update to avoid stale closure when multiple calls happen in same event
    setFabrics((prevFabrics) => prevFabrics.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  };

  const handleEmbroiderySelect = (fabricId: string, embroidery: EmbroiderySearchResult) => {
    fabricsModifiedRef.current = true; // Track modification for validation
    setFabrics((prevFabrics) =>
      prevFabrics.map((f) =>
        f.id === fabricId
          ? {
              ...f,
              embroideryId: embroidery.id,
              embroideryName: embroidery.designName,
              embroideryCode: embroidery.embroideryCode,
              // Note: usableWidth is now handled in CAD Planning stage
            }
          : f
      )
    );
  };

  const handleOpenEmbroideryPicker = (fabricId: string) => {
    setEmbroideryPickerFabricId(fabricId);
    setEmbroideryPickerOpen(true);
  };

  const handleClearEmbroidery = (fabricId: string) => {
    fabricsModifiedRef.current = true; // Track modification for validation
    setFabrics((prevFabrics) =>
      prevFabrics.map((f) =>
        f.id === fabricId
          ? {
              ...f,
              hasEmbroidery: false,
              embroideryId: null,
              embroideryName: null,
              embroideryCode: null,
            }
          : f
      )
    );
  };

  const generateSKUs = () => {
    const base = styleCode || 'STYLE';
    setSkuVariants(
      skuVariants.map((v) => ({
        ...v,
        sku: v.isActive ? `${base}${v.size}` : v.sku,
      }))
    );
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

    // BUG-S11: use effectiveId, not the route param — after a first draft save the URL is
    // rewritten via history.replaceState without remounting, so `id` stays undefined and a
    // picked image went to pendingImageFile which the update branch never uploaded.
    if (!effectiveId) {
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
      const uploadedImageUrl = await styleService.uploadStyleImage(effectiveId, file);
      setImageUrl(uploadedImageUrl);
      notify.success('Image uploaded successfully');
    } catch (error: unknown) {
      console.error('Image upload error:', error);
      const axiosError = error as { response?: { data?: { message?: string } } };
      notify.error(axiosError.response?.data?.message || 'Failed to upload image');
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

    if (!effectiveId) return; // BUG-S11: effectiveId covers the saved-draft case too

    try {
      // Update the style to remove the image URL
      // imageUrl is accepted by the API but not in CreateStyleFormData type
      await styleService.updateStyle(effectiveId, { imageUrl: null } as unknown as Parameters<
        typeof styleService.updateStyle
      >[1]);
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

  const handlePublishClick = () => {
    if (!effectiveId) return;
    setPublishDialogOpen(true);
  };

  const confirmPublish = async () => {
    if (!effectiveId) return;
    setPublishDialogOpen(false);
    setPublishing(true);
    try {
      await styleService.publishDraft(effectiveId);
      setStyleStatus('ACTIVE');
      handleApiSuccess('Style published', 'Style published successfully! It can now be used for orders.');
    } catch (error: unknown) {
      handleApiError(error, 'Failed to publish style');
    } finally {
      setPublishing(false);
    }
  };

  // Auto-save draft when navigating between tabs
  const handleTabNavigation = async (targetTab: string) => {
    // Switch tab IMMEDIATELY for responsive UX
    setActiveTab(targetTab);

    // Then auto-save in the background (non-blocking for tab switch)
    if (styleCode) {
      try {
        await saveStyle(true);
      } catch (error) {
        // allow-silent-catch: Tab-switch auto-save is background/non-critical - user didn't click save
        console.warn('Auto-save failed:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Save with validation
    await saveStyle(false);
  };

  const saveStyle = async (isDraft: boolean) => {
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
      // For updates: skip validation if fabrics weren't modified (allows saving other fields without touching fabrics)
      const shouldValidateFabrics = !isEditMode || fabricsModifiedRef.current;
      if (shouldValidateFabrics && (fabrics.length === 0 || fabrics.some((f) => !f.genericGreigeName && !f.fabricId))) {
        notify.error('At least one fabric with a greige name or ready fabric selection is required');
        return;
      }

      // Validate Design/Color fields based on finish type
      if (shouldValidateFabrics) {
        for (const fabric of fabrics) {
          const finishType = fabric.fabricFinishType;
          const componentName = fabric.componentName || `Component ${fabric.componentIndex + 1}`;

          // PRINTED/YARN_DYED: Design is mandatory
          if ((finishType === 'PRINTED' || finishType === 'YARN_DYED') && !fabric.printDesign?.trim()) {
            notify.error(`Design name is required for ${finishType} fabric in ${componentName}`);
            return;
          }

          // DYED (Solid/Dyed): Color is mandatory
          if (finishType === 'DYED' && !fabric.colorMasterId) {
            notify.error(`Color is required for Solid/Dyed fabric in ${componentName}`);
            return;
          }
        }
      }
    }

    try {
      setLoading(true);

      // Auto-generate SKUs for active variants that don't have them
      const skuVariantsWithGenerated = skuVariants.map((v) => ({
        ...v,
        sku: v.sku || (styleCode ? `${styleCode}${v.size}` : `STYLE${v.size}`),
      }));

      // Filter out trims with empty masterId (invalid/incomplete records from legacy data)
      const validTrims = selectedTrims.filter((trim) => trim.masterId && trim.masterId.trim() !== '');

      // Auto-add Thread if not present in selectedTrims
      const hasThread = validTrims.some((t) => t.trimType === 'THREAD');

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
            },
          ];

      // Accessories - transform to backend format (accessoryType -> materialType, masterId -> materialId)
      // Deduplicate by masterCode to prevent duplicate accessories from being saved (code is consistent across ID systems)
      const uniqueAccessories = selectedAccessories.filter(
        (acc, index, self) =>
          index === self.findIndex((a) => a.masterCode === acc.masterCode && a.accessoryType === acc.accessoryType)
      );
      const finalAccessories = uniqueAccessories.map((acc) => ({
        materialType: acc.accessoryType, // Backend expects materialType, not accessoryType
        materialId: acc.masterId, // Backend expects materialId, not masterId
        usageCategory: 'PACKAGING' as const, // All accessories (labels, packaging) go to PACKAGING category
        componentName: acc.masterName, // Use masterName as componentName for display
        quantityPerGarment: 1, // Labels and packaging default to 1 per garment
        unit: 'pcs',
      }));

      // Build components array from selectedComponents
      // Use map with index to preserve original component positions for fabric matching
      const components = selectedComponents
        .map((sc, componentIndex) => {
          // Find the component master to get the name
          const componentMaster = componentMasters.find((cm) => cm.id === sc.componentId);

          // Get component name: prefer master name, fall back to original loaded name
          const componentName = componentMaster?.name || (sc as { _originalName?: string })._originalName;

          // Skip only if we have no component name AND no fabrics for this index
          const componentFabricsForIndex = fabrics.filter((f) => f.componentIndex === componentIndex);
          if (!componentName && componentFabricsForIndex.length === 0) {
            return null;
          }

          // If no component name but has fabrics, use the fabric's componentName
          const finalComponentName =
            componentName || componentFabricsForIndex[0]?.componentName || `Component ${componentIndex + 1}`;

          // Find fabrics for this component using componentIndex (not name)
          // This ensures fabrics stay matched even if component selection changes
          // UUID validation helper (for fabric_master which uses UUID)
          const isValidUUID = (id: string | null | undefined): boolean =>
            !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
          // CUID validation helper (for color_master and embroidery_master which use CUID)
          const isValidCUID = (id: string | null | undefined): boolean => !!id && /^c[a-z0-9]{20,}$/i.test(id);
          // Combined validator for IDs that could be either UUID or CUID
          const isValidId = (id: string | null | undefined): boolean => isValidUUID(id) || isValidCUID(id);

          const componentFabrics = componentFabricsForIndex.map((f) => ({
            fabricName: f.sourcingMode === 'READY_FABRIC' ? f.fabricName || '' : f.genericGreigeName,
            fabricId: f.sourcingMode === 'READY_FABRIC' && isValidUUID(f.fabricId) ? f.fabricId : null,
            genericGreigeName: f.sourcingMode === 'READY_FABRIC' ? null : f.genericGreigeName || null,
            fabricType: f.sourcingMode === 'READY_FABRIC' ? 'FABRIC' : 'GENERIC',
            fabricFinishType: f.fabricFinishType || null,
            // Design/Color identification
            printDesign: f.printDesign || null,
            // Use isValidId for colorMasterId (CUID format from color_master)
            colorMasterId: isValidId(f.colorMasterId) ? f.colorMasterId : null,
            hasEmbroidery: f.hasEmbroidery || false,
            // Use isValidId for embroideryId (CUID format from embroidery_master)
            embroideryId: isValidId(f.embroideryId) ? f.embroideryId : null,
            // Pass pattern part IDs so style_pattern_parts are created
            patternPartIds: f.patternParts?.map((pp) => pp.patternPartId).filter(Boolean) || [],
          }));

          return {
            componentName: finalComponentName,
            componentType: sc.category || 'OTHER', // Use category as componentType
            fabrics: componentFabrics,
          };
        })
        .filter((c) => c !== null); // Remove any null entries

      // BUG-S9: sending an empty skuVariants array made the backend delete ALL SKU rows
      // (and their barcodes) with no confirmation. Omit the key instead — existing rows stay.
      const activeSkuVariants = skuVariantsWithGenerated.filter((v) => v.isActive);
      if (activeSkuVariants.length === 0 && skuVariantsWithGenerated.length > 0) {
        notify.warning('All sizes are unchecked — existing SKU variants were kept, not deleted.');
      }

      const styleData = {
        styleCode,
        styleName: styleName || styleCode,
        customerName: customerName || (isDraft ? 'Draft' : ''),
        brandName,
        category,
        brandCategoryId: brandCategoryId || null,
        productCategoryId: productCategoryId || null, // Global product category
        season,
        seasonId: seasonId || null,
        description,
        numberOfComponents,
        // BUG-S8: an empty components array made the backend delete-and-recreate wipe ALL
        // style_components + style_fabrics (same class as the processes bug below). Omit
        // the key when there is nothing to send — backend treats absent key as "no change".
        ...(components.length > 0 ? { components } : {}),
        // Standard processes are assumed for all styles (Cutting, Stitching, Finishing, Transportation).
        // Deliberately NOT sent: the form does not manage processes, and sending [] made the backend
        // delete-and-recreate wipe all existing process rows on every save (bug-hunt BH-0275/BH-0373).
        // BUG-S10: === '' check preserves a legitimate 0 (|| turned 0 into null)
        expectedOrderQuantity: expectedOrderQty === '' ? null : expectedOrderQty,
        // Template fields - Pricing
        costPrice: costPrice === '' ? null : costPrice,
        sellingPrice: sellingPrice === '' ? null : sellingPrice,
        // Template fields - Tax & Accounting
        hsnCode: hsnCode || null,
        productTaxRule: productTaxRule || null,
        // BUG-S13: only default accountingSKU on CREATE — updates previously overwrote any
        // externally-set accounting SKU with the style code on every save
        ...(effectiveId ? {} : { accountingSKU: styleCode || null }),
        accountingUnit: accountingUnit || 'Units',
        // Template fields - Marketing & Other
        bulletPoints: bulletPoints || null,
        buyerStyleRef: buyerStyleRef || null, // Buyer's own reference number
        imageUrl: imageUrl || null,
        specifications: remarks || null, // Storing remarks in specifications field
        // NOTE: fabrics are now ONLY sent via components[].fabrics[] (nested)
        // The standalone fabrics[] array was removed to prevent duplicate data paths
        // Trims - simplified (just references to master records)
        trims: finalTrims,
        // Accessories - simplified (just references to master records)
        accessories: finalAccessories,
        // SKU variants (with auto-generated SKUs for empty ones) — see BUG-S9 note above
        ...(activeSkuVariants.length > 0 ? { skuVariants: activeSkuVariants } : {}),
        // Customer preset: send null (not undefined) when cleared, so the FK is actually nulled.
        // undefined is dropped by JSON.stringify and Prisma then leaves the old preset FK intact,
        // resurrecting the removed accessories on the next edit (bug-hunt BH-0143). The backend
        // service is built for this: it writes `value || null` whenever the key is present.
        customerAccessoriesPresetId: selectedAccessoryPresetId || null,
        // CAD status starts as PENDING
        cadStatus: 'PENDING' as CADStatus,
        // Status - DRAFT stays DRAFT until explicitly published, ACTIVE stays ACTIVE
        status: (isDraft || styleStatus === 'DRAFT' ? 'DRAFT' : 'ACTIVE') as 'DRAFT' | 'ACTIVE',
      };

      if (effectiveId) {
        // Update existing style (edit mode or already-saved draft)
        await styleService.updateStyle(effectiveId, styleData);
        notify.success(isDraft ? 'Draft saved successfully!' : 'Style updated successfully!');
        clearLocalDraft(); // Clear localStorage after successful DB save

        // BUG-S11: upload any pending image in the update branch too (previously only the
        // create branch uploaded it, so an image picked after the first draft save was lost)
        if (pendingImageFile) {
          try {
            await styleService.uploadStyleImage(effectiveId, pendingImageFile);
            if (pendingImagePreview) {
              URL.revokeObjectURL(pendingImagePreview);
            }
            setPendingImageFile(null);
            setPendingImagePreview('');
          } catch (imgError) {
            console.error('Failed to upload image:', imgError);
            notify.error('Style saved but image upload failed. You can upload it later.');
          }
        }

        // Only navigate away for published (ACTIVE) styles, stay on page for drafts
        if (!isDraft && styleStatus !== 'DRAFT') {
          navigate('/styles');
        }
      } else {
        // Create new style
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

        notify.success(isDraft ? 'Draft saved successfully!' : 'Style created successfully! Proceed to CAD Planning.');
        clearLocalDraft(); // Clear localStorage after successful DB save

        if (isDraft && newStyleId) {
          // Track the saved ID so subsequent saves use updateStyle
          // Update URL silently without remounting the component
          setSavedStyleId(newStyleId);
          window.history.replaceState(null, '', `/styles/${newStyleId}/edit`);
        } else if (!isDraft) {
          navigate('/styles');
        }
      }
    } catch (error: unknown) {
      console.error('Failed to save style:', error);

      // Check if this is a deleted style conflict (409 with deletedStyleId)
      const axiosError = error as {
        response?: {
          status?: number;
          data?: { message?: string; details?: { deletedStyleId?: string; styleName?: string } };
        };
      };
      if (axiosError.response?.status === 409 && axiosError.response?.data?.details?.deletedStyleId) {
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
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/styles')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-display font-medium">
                {isEditMode ? (
                  <>
                    Edit Style
                    {styleCode && (
                      <span className="ml-3 text-xl font-mono text-primary">
                        {styleCode}
                        {styleName && <span className="text-muted-foreground font-normal"> - {styleName}</span>}
                      </span>
                    )}
                  </>
                ) : (
                  'Create New Style'
                )}
              </h1>
              {/* Status Badge */}
              {(!isEditMode || styleStatus === 'DRAFT') && (
                <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/25">
                  DRAFT
                </Badge>
              )}
              {isEditMode && styleStatus === 'ACTIVE' && (
                <Badge variant="secondary" className="bg-success-muted text-success border-success/25">
                  ACTIVE
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Define style details, fabrics, and materials. CAD planning comes after creation.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Auto-save Status Indicator */}
          {!isEditMode && (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              {isFormDirty ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-warning-muted animate-pulse" />
                  <span>Unsaved changes</span>
                </>
              ) : lastAutoSaved ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-success-muted" />
                  <span>Auto-saved {lastAutoSaved.toLocaleTimeString()}</span>
                </>
              ) : null}
            </div>
          )}
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
          <Button type="button" onClick={() => saveStyle(false)} disabled={loading} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            {loading ? 'Saving...' : isEditMode ? 'Update Style' : 'Create Style'}
          </Button>
          {isEditMode && styleStatus === 'DRAFT' && (
            <Button
              type="button"
              onClick={handlePublishClick}
              disabled={publishing || loading}
              className="flex items-center gap-2 bg-success hover:bg-success text-white"
            >
              {publishing ? 'Publishing...' : 'Publish Style'}
            </Button>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-info-muted border border-info/20 rounded-lg flex items-start gap-3">
        <Info className="h-5 w-5 text-info flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <p className="font-medium text-info mb-1">New Workflow</p>
          <p className="text-info">
            Use <strong>Generic Greige Name</strong> (e.g., "Cambric") instead of specific greige. You'll select the
            actual greige width during <strong>CAD Planning</strong> after style creation.
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
          <TabsContent value="basic" forceMount className="space-y-6 data-[state=inactive]:hidden">
            <Card className="p-6">
              <h2 className="text-xl font-display font-semibold mb-4">Basic Information</h2>

              {/* Main layout: Image on left, Form fields on right */}
              <div className="grid grid-cols-[280px_1fr] gap-6">
                {/* Left Column: Style Image */}
                <div>
                  <Label className="text-sm mb-1.5 block">Style Image</Label>
                  {imageUrl || pendingImagePreview ? (
                    <div className="relative group">
                      <img
                        src={pendingImagePreview || getUploadUrl(imageUrl)}
                        alt="Style preview"
                        className="w-full h-[280px] object-cover rounded-lg border-2 border-border"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjgwIiBoZWlnaHQ9IjI4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjgwIiBoZWlnaHQ9IjI4MCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
                        }}
                      />
                      {pendingImagePreview && (
                        <span className="absolute bottom-2 left-2 bg-warning-muted text-white text-xs px-2 py-1 rounded">
                          Pending upload
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleDeleteImage}
                        disabled={uploadingImage}
                        className="absolute top-2 right-2 bg-destructive/100 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
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
                        'flex flex-col items-center justify-center w-full h-[280px] border-2 border-dashed border-border rounded-lg transition-colors',
                        !uploadingImage
                          ? 'cursor-pointer hover:border-info/50 hover:bg-info-muted'
                          : 'cursor-not-allowed opacity-60'
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
                        <span className="text-sm text-muted-foreground">Uploading...</span>
                      ) : (
                        <>
                          <Plus className="h-12 w-12 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground mt-2">Click to add image</span>
                          <span className="text-xs text-muted-foreground mt-1">JPG, PNG (max 5MB)</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Column: Form Fields */}
                <div className="grid grid-cols-2 gap-4 content-start">
                  {/* Row 1: Customer/Buyer, Brand - MUST BE SELECTED FIRST for style code generation */}
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
                        <SelectValue
                          placeholder={availableBrands.length > 0 ? 'Select brand...' : 'No brands available'}
                        />
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
                      <p className="text-xs text-muted-foreground mt-1">Select a customer with configured brands</p>
                    )}
                  </div>

                  {/* Row 2: Brand Category, Product Category - Brand Category determines style code prefix */}
                  <div>
                    <Label>Brand Category</Label>
                    <Select
                      key={`brand-category-select-${availableCategories.map((c) => c.id).join('-')}`}
                      value={brandCategoryId}
                      onValueChange={(value) => {
                        setBrandCategoryId(value);
                        // Also set the category name for display/backward compatibility
                        const selectedBrandCategory = availableCategories.find((bc) => bc.id === value);
                        if (selectedBrandCategory) {
                          setCategory(selectedBrandCategory.category);

                          // Auto-match Product Category L1 if brand category matches (only when user manually changes, not in edit mode initial load)
                          if (!isEditMode || productCategoryId === '') {
                            // Extract base category name from hierarchical category (e.g., "Fusion Wear > Fusion Wear Top" → "Fusion Wear")
                            const baseCategoryName = selectedBrandCategory.category.split('>')[0].trim();
                            const matchingProductCategory = productCategories.find(
                              (pc) => pc.name.toLowerCase() === baseCategoryName.toLowerCase()
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
                        <SelectValue
                          placeholder={availableCategories.length > 0 ? 'Select category...' : 'Select brand first'}
                        />
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
                      <p className="text-xs text-muted-foreground mt-1">No categories available for this brand</p>
                    )}
                  </div>
                  <div>
                    <Label>Product Category</Label>
                    {/* Check if brand category matches a product category L1 */}
                    {(() => {
                      // Extract the first part of hierarchical category (e.g., "Fusion Wear > Fusion Wear Top" → "Fusion Wear")
                      const baseCategoryName = category ? category.split('>')[0].trim() : '';
                      const matchingL1 = baseCategoryName
                        ? productCategories.find((pc) => pc.name.toLowerCase() === baseCategoryName.toLowerCase())
                        : null;
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
                            const isL1 = productCategories.some((cat) => cat.id === value);
                            if (isL1) {
                              setSelectedProductCategoryL1(value);
                              setSelectedProductCategoryL2('');
                              setSelectedProductCategoryL3('');
                              await loadProductSubCategories(value);
                              updateProductCategoryId(value, '', '');
                            } else {
                              // It's an L2 - find the parent L1
                              const parentL1 = productCategories.find((cat) =>
                                productSubCategories[cat.id]?.some((sub) => sub.id === value)
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
                                  <SelectItem key={subCat.id} value={subCat.id} className="pl-6 text-muted-foreground">
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

                  {/* Row 3: Style Code (Auto-generated), Style Name */}
                  <div>
                    <Label>Style Code {isEditMode ? '' : '(Auto-generated)'}</Label>
                    <Input
                      value={styleCode}
                      onChange={(e) => isEditMode && setStyleCode(e.target.value)}
                      placeholder="Select brand + category above"
                      readOnly={!isEditMode}
                      className={!isEditMode ? 'bg-muted' : ''}
                    />
                    {!isEditMode && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Generated from brand prefix + category prefix
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Style Name</Label>
                    <Input
                      value={styleName}
                      onChange={(e) => setStyleName(e.target.value)}
                      placeholder="Summer Dress (optional)"
                    />
                  </div>

                  {/* Row 4: Buyer Reference (full row for clarity) */}
                  <div className="col-span-2">
                    <Label>Buyer Reference *</Label>
                    <Input
                      value={buyerStyleRef}
                      onChange={(e) => setBuyerStyleRef(e.target.value)}
                      placeholder="Buyer's style number"
                      className="max-w-md"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Buyer's own reference number (shows on all documents)
                    </p>
                  </div>

                  {/* Row 5: Season, Number of Components */}
                  <div>
                    <SeasonSelector
                      value={seasonId}
                      onChange={(newSeasonId: string | null, selectedSeason?: SeasonSearchResult) => {
                        setSeasonId(newSeasonId);
                        setSeason(selectedSeason ? selectedSeason.name : '');
                      }}
                      label="Season"
                      placeholder="Select a season"
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
                          ? 'border-destructive'
                          : ''
                      }
                    />
                    {selectedProductCategory &&
                      (selectedProductCategory.minComponents || selectedProductCategory.maxComponents) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {selectedProductCategory.minComponents === selectedProductCategory.maxComponents
                            ? `This category requires exactly ${selectedProductCategory.minComponents} component${(selectedProductCategory.minComponents ?? 0) > 1 ? 's' : ''}`
                            : `This category supports ${selectedProductCategory.minComponents || 1} to ${selectedProductCategory.maxComponents || '∞'} components`}
                        </p>
                      )}
                    {selectedProductCategory &&
                      (numberOfComponents < (selectedProductCategory.minComponents || 1) ||
                        numberOfComponents > (selectedProductCategory.maxComponents || 999)) && (
                        <p className="text-xs text-destructive mt-1">
                          Component count must be between {selectedProductCategory.minComponents || 1} and{' '}
                          {selectedProductCategory.maxComponents || '∞'}
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
                    <div className="col-span-2 text-sm text-accent">
                      Product:{' '}
                      {[
                        productCategories.find((c) => c.id === selectedProductCategoryL1)?.name,
                        productSubCategories[selectedProductCategoryL1]?.find((c) => c.id === selectedProductCategoryL2)
                          ?.name,
                        productSubSubCategories[selectedProductCategoryL2]?.find(
                          (c) => c.id === selectedProductCategoryL3
                        )?.name,
                      ]
                        .filter(Boolean)
                        .join(' → ')}
                    </div>
                  )}
                </div>
              </div>

              {/* Component Names Section */}
              {numberOfComponents > 0 && (
                <div className="mt-4 p-4 bg-info-muted rounded-lg border border-info/20">
                  <Label className="text-base font-semibold mb-3 block">Component Selection</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Select the component for each part of the garment. Manage components in{' '}
                    <a href="/component-masters" className="text-info hover:underline">
                      Component Masters
                    </a>
                    .
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Array.from({ length: numberOfComponents }, (_, index) => {
                      const selectedComponentId = selectedComponents[index]?.componentId || '';
                      const selectedComponent = componentMasters.find((c) => c.id === selectedComponentId);

                      return (
                        <div key={index} className="p-3 bg-card rounded-md border">
                          <Label className="text-sm">Component {index + 1}</Label>
                          <Popover
                            open={openComponentPopovers[index] || false}
                            onOpenChange={(open) => {
                              setOpenComponentPopovers((prev) => ({ ...prev, [index]: open }));
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
                                      <span className="text-muted-foreground ml-1">
                                        ({selectedComponent.componentCategory})
                                      </span>
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
                                      (component) =>
                                        categoryComponentIds.size === 0 || categoryComponentIds.has(component.id)
                                    );

                                    // Group by component group
                                    const grouped = new Map<string, ComponentMaster[]>();
                                    const ungrouped: ComponentMaster[] = [];

                                    filteredComponents.forEach((component) => {
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
                                      const groupA = componentGroups.find((g) => g.id === a[0]);
                                      const groupB = componentGroups.find((g) => g.id === b[0]);
                                      return (groupA?.sortOrder || 0) - (groupB?.sortOrder || 0);
                                    });

                                    return (
                                      <>
                                        {sortedGroups.map(([groupId, components]) => {
                                          const group = componentGroups.find((g) => g.id === groupId);
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
                                                      componentId: component.id,
                                                    };
                                                    setSelectedComponents(newComponents);
                                                    setOpenComponentPopovers((prev) => ({ ...prev, [index]: false }));
                                                  }}
                                                >
                                                  <Check
                                                    className={cn(
                                                      'mr-2 h-4 w-4',
                                                      selectedComponentId === component.id ? 'opacity-100' : 'opacity-0'
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
                                                    componentId: component.id,
                                                  };
                                                  setSelectedComponents(newComponents);
                                                  setOpenComponentPopovers((prev) => ({ ...prev, [index]: false }));
                                                }}
                                              >
                                                <Check
                                                  className={cn(
                                                    'mr-2 h-4 w-4',
                                                    selectedComponentId === component.id ? 'opacity-100' : 'opacity-0'
                                                  )}
                                                />
                                                <span className="flex-1">
                                                  {component.name}
                                                  {component.componentCategory && (
                                                    <span className="text-muted-foreground ml-1">
                                                      ({component.componentCategory})
                                                    </span>
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
                className="flex items-center gap-2 text-sm text-info hover:text-info mt-4"
              >
                {showAdditionalDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Additional Details (Optional)
              </button>

              {showAdditionalDetails && (
                <div className="mt-4 p-4 bg-muted rounded-lg space-y-6">
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
                          <p className="text-xs text-destructive mt-1">HSN code must be 6-8 digits</p>
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
                          <p className="text-xs text-destructive mt-1">Tax rate must be 2 digits</p>
                        )}
                      </div>
                      <div>
                        <Label>Accounting Unit</Label>
                        <Input
                          value={accountingUnit}
                          onChange={(e) => setAccountingUnit(e.target.value)}
                          placeholder="e.g., Units, PCS, DOZEN"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Default: Units</p>
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
                <div className="mt-6 p-4 bg-accent/10 rounded-lg border border-accent/20">
                  <Label className="text-sm font-medium mb-2 block">Size Category Preset (Optional)</Label>
                  <Select value={selectedSizePresetId || 'none'} onValueChange={handleSizePresetChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Use customer's size preset or add sizes manually below" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Manual Sizes)</SelectItem>
                      {customerSizePresets.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.presetName} - {preset.sizeCategory.name} ({preset.sizeCategory.sizes.length} sizes)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedSizePresetId && (
                    <p className="text-xs text-accent mt-2">
                      <span className="inline-block px-1.5 py-0.5 bg-accent/15 text-accent rounded-full mr-1">
                        Preset
                      </span>
                      {presetSizeIds.size} size(s) from preset - you can add more sizes manually
                    </p>
                  )}
                </div>
              )}

              {/* Size Variants & SKUs - Main Section (not in Additional Details) */}
              <div className="mt-6 p-4 bg-success-muted rounded-lg border border-success/20">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-semibold">Size Variants & SKUs</Label>
                  <Button type="button" variant="outline" size="sm" onClick={generateSKUs}>
                    Auto-Generate SKUs
                  </Button>
                </div>

                <div className="space-y-3">
                  {skuVariants.map((variant, index) => (
                    <div key={variant.size} className="grid grid-cols-12 gap-3 items-center p-3 border rounded bg-card">
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
                          <span className="text-xs text-accent" title="From preset">
                            *
                          </span>
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

                <p className="text-xs text-muted-foreground mt-3">
                  Uncheck sizes you don't need. SKUs are required for active sizes. Accounting SKU will default to SKU
                  Code.
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
          <TabsContent value="fabrics" forceMount className="space-y-6 data-[state=inactive]:hidden">
            {/* Fabrics Section - Grouped by Component */}
            <Card className="p-6">
              <div className="mb-4">
                <h2 className="text-xl font-display font-semibold">Fabrics by Component</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Add fabrics to each component. Same fabric + finish + width can be combined for cutting.
                </p>
              </div>

              {/* Component warning if none selected */}
              {numberOfComponents < 1 || selectedComponents.filter((c) => c.componentId).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  <AlertCircle className="h-12 w-12 mx-auto mb-3 text-warning" />
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
                      ? componentMasters.find((cm) => cm.id === component.componentId)
                      : null;
                    const componentName = componentMaster?.name || `Component ${componentIndex + 1}`;
                    const componentFabrics = fabrics.filter((f) => f.componentIndex === componentIndex);
                    const isExpanded = expandedComponents.includes(componentIndex);

                    return (
                      <div key={componentIndex} className="border rounded-lg">
                        {/* Component Header - Collapsible */}
                        <div
                          className={cn(
                            'w-full flex items-center justify-between p-4 text-left transition-colors',
                            isExpanded ? 'bg-info-muted border-b' : 'bg-muted hover:bg-muted'
                          )}
                        >
                          <div
                            className="flex items-center gap-3 cursor-pointer flex-1"
                            onClick={() => toggleComponentExpanded(componentIndex)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )}
                            <span className="font-semibold text-foreground">{componentName.toUpperCase()}</span>
                            <Badge variant="outline" className="text-xs">
                              Component {componentIndex + 1}
                            </Badge>
                            <Badge className="text-xs bg-info-muted text-info">
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
                              <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg bg-muted">
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
                                <div
                                  key={fabric.id}
                                  id={`fabric-${fabric.id}`}
                                  className="p-4 border rounded-lg bg-card space-y-3"
                                >
                                  {/* Fabric Header */}
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-foreground">Fabric {fabricIdx + 1}</span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRemoveFabric(fabric.id)}
                                      className="text-muted-foreground hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  {/* Sourcing Mode Toggle */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Source:</span>
                                    <div className="flex rounded-md border overflow-hidden">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateFabric(fabric.id, 'sourcingMode', 'GREIGE')}
                                        className={`px-3 py-1 text-xs font-medium transition-colors ${
                                          (fabric.sourcingMode || 'GREIGE') === 'GREIGE'
                                            ? 'bg-info text-white'
                                            : 'bg-card text-muted-foreground hover:bg-muted'
                                        }`}
                                      >
                                        Greige / Process
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateFabric(fabric.id, 'sourcingMode', 'READY_FABRIC')}
                                        className={`px-3 py-1 text-xs font-medium transition-colors border-l ${
                                          fabric.sourcingMode === 'READY_FABRIC'
                                            ? 'bg-success text-white'
                                            : 'bg-card text-muted-foreground hover:bg-muted'
                                        }`}
                                      >
                                        Ready Fabric
                                      </button>
                                    </div>
                                  </div>

                                  {/* Fabric Fields - Row 1 */}
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      {(fabric.sourcingMode || 'GREIGE') === 'GREIGE' ? (
                                        <GenericGreigeSelector
                                          value={fabric.genericGreigeName}
                                          onChange={(name) => handleUpdateFabric(fabric.id, 'genericGreigeName', name)}
                                          required
                                        />
                                      ) : (
                                        <FabricMasterSelector
                                          fabricId={fabric.fabricId || null}
                                          fabricCode={fabric.fabricCode || null}
                                          fabricName={fabric.fabricName || null}
                                          onSelect={(
                                            id,
                                            code,
                                            name,
                                            finishType,
                                            printDesign,
                                            colorMasterId,
                                            colorName
                                          ) => {
                                            handleUpdateFabric(fabric.id, 'fabricId', id);
                                            handleUpdateFabric(fabric.id, 'fabricCode', code);
                                            handleUpdateFabric(fabric.id, 'fabricName', name);
                                            if (finishType)
                                              handleUpdateFabric(fabric.id, 'fabricFinishType', finishType);
                                            // Auto-populate design/color from fabric_master
                                            if (printDesign !== undefined)
                                              handleUpdateFabric(fabric.id, 'printDesign', printDesign);
                                            if (colorMasterId !== undefined)
                                              handleUpdateFabric(fabric.id, 'colorMasterId', colorMasterId);
                                            if (colorName !== undefined)
                                              handleUpdateFabric(fabric.id, 'colorName', colorName);
                                          }}
                                          onClear={() => {
                                            handleUpdateFabric(fabric.id, 'fabricId', null);
                                            handleUpdateFabric(fabric.id, 'fabricCode', null);
                                            handleUpdateFabric(fabric.id, 'fabricName', null);
                                            // Clear design/color when fabric is cleared
                                            handleUpdateFabric(fabric.id, 'printDesign', null);
                                            handleUpdateFabric(fabric.id, 'colorMasterId', null);
                                            handleUpdateFabric(fabric.id, 'colorName', null);
                                          }}
                                          styleId={effectiveId ?? undefined}
                                          styleCode={styleCode}
                                          componentName={fabric.componentName}
                                          finishType={fabric.fabricFinishType}
                                        />
                                      )}
                                    </div>
                                    <div className="space-y-1">
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

                                  {/* Design/Color Identification Fields */}
                                  {(fabric.fabricFinishType === 'PRINTED' ||
                                    fabric.fabricFinishType === 'YARN_DYED') && (
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-1">
                                        <Label>Design Name *</Label>
                                        <Input
                                          placeholder="e.g., Floral, Geometric, Stripes..."
                                          value={fabric.printDesign || ''}
                                          onChange={(e) =>
                                            handleUpdateFabric(fabric.id, 'printDesign', e.target.value || null)
                                          }
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label>Color (Optional)</Label>
                                        <ColorPicker
                                          value={fabric.colorMasterId || ''}
                                          onChange={(colorId, color) => {
                                            handleUpdateFabric(fabric.id, 'colorMasterId', colorId || null);
                                            handleUpdateFabric(fabric.id, 'colorName', color?.colorName || null);
                                          }}
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {fabric.fabricFinishType === 'DYED' && (
                                    <div className="space-y-1">
                                      <Label>Color *</Label>
                                      <ColorPicker
                                        value={fabric.colorMasterId || ''}
                                        onChange={(colorId, color) => {
                                          handleUpdateFabric(fabric.id, 'colorMasterId', colorId || null);
                                          handleUpdateFabric(fabric.id, 'colorName', color?.colorName || null);
                                        }}
                                      />
                                    </div>
                                  )}

                                  {/* Pattern Parts (read-only) */}
                                  {fabric.patternParts && fabric.patternParts.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 rounded-md border border-slate-200">
                                      <span className="text-xs text-muted-foreground mr-1">Pattern Parts:</span>
                                      {fabric.patternParts.map((pp) => (
                                        <Badge key={pp.id} variant="secondary" className="text-xs">
                                          {pp.patternPart.name}
                                          {pp.quantity > 1 ? ` ×${pp.quantity}` : ''}
                                          {pp.goesToEmbroidery && ' ✦'}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}

                                  {/* Embroidery Section */}
                                  <div className="flex items-center gap-6 p-3 bg-accent/10 rounded-lg border border-accent/15">
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
                                        <Sparkles className="h-4 w-4 text-accent" />
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
                                              className="text-xs h-6 text-destructive"
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
          <TabsContent value="trims" forceMount className="space-y-6 data-[state=inactive]:hidden">
            <Card className="p-6">
              <div className="mb-4">
                <h2 className="text-xl font-display font-semibold">Trims & Materials</h2>
                <p className="text-sm text-muted-foreground">
                  Select trims required for this style. Use "Add New" to create master records inline.
                </p>
              </div>

              <TrimSelector selectedTrims={selectedTrims} onChange={setSelectedTrims} styleCode={styleCode} />
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
          <TabsContent value="accessories" forceMount className="space-y-6 data-[state=inactive]:hidden">
            {/* Customer Preset Section */}
            {customerAccessoryPresets.length > 0 && (
              <Card className="p-6 bg-accent/10/50 border-accent/20">
                <div className="mb-4">
                  <h2 className="text-lg font-display font-semibold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-accent" />
                    Customer Accessory Preset
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Default preset is auto-applied when customer is selected. You can switch presets or modify items
                    below.
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Select value={selectedAccessoryPresetId} onValueChange={handlePresetChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select preset (optional)..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-muted-foreground">None (Clear Preset)</span>
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
                      const preset = customerAccessoryPresets.find((p) => p.id === selectedAccessoryPresetId);
                      if (preset) applyPresetToAccessories(preset);
                    }}
                    disabled={!selectedAccessoryPresetId}
                    className="shrink-0"
                  >
                    Re-apply Preset
                  </Button>
                </div>
                {(presetItemIds.size > 0 || styleSpecificIds.size > 0) && (
                  <div className="mt-4 space-y-3">
                    {/* Packaging from Preset */}
                    {presetItemIds.size > 0 && (
                      <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg">
                        <p className="text-xs font-semibold text-accent mb-2 flex items-center gap-1">
                          <span className="inline-block px-1.5 py-0.5 bg-accent/15 rounded-full">Packaging</span>
                          {presetItemIds.size} packaging item(s) from preset
                        </p>
                        <div className="space-y-1">
                          {selectedAccessories
                            .filter((acc) => presetItemIds.has(acc.masterId))
                            .map((acc, idx) => (
                              <div key={idx} className="text-xs text-accent flex items-center gap-2">
                                <span className="w-1 h-1 bg-accent rounded-full"></span>
                                <span className="font-medium">{acc.masterName}</span>
                                <span className="text-accent">{acc.subType || acc.accessoryType}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Style-specific items */}
                    {styleSpecificIds.size > 0 && (
                      <div className="p-3 bg-success-muted border border-success/20 rounded-lg">
                        <p className="text-xs font-semibold text-success mb-2 flex items-center gap-1">
                          <span className="inline-block px-1.5 py-0.5 bg-success/15 rounded-full">Style-specific</span>
                          {styleSpecificIds.size} item(s) added manually
                        </p>
                        <div className="space-y-1">
                          {selectedAccessories
                            .filter((acc) => styleSpecificIds.has(acc.masterId))
                            .map((acc, idx) => (
                              <div key={idx} className="text-xs text-success flex items-center gap-2">
                                <span className="w-1 h-1 bg-success rounded-full"></span>
                                <span className="font-medium">{acc.masterName}</span>
                                <span className="text-success">{acc.subType || acc.accessoryType}</span>
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
                <h2 className="text-xl font-display font-semibold">Garment Accessories</h2>
                <p className="text-sm text-muted-foreground">
                  Select labels, polybags, hangtags, cartons, and other packaging materials
                </p>
              </div>
              <AccessorySelector
                selectedAccessories={selectedAccessories}
                onChange={(newAccessories) => {
                  // Track newly added items that aren't from preset as style-specific
                  const newIds = new Set(newAccessories.map((a) => a.masterId));
                  const prevIds = new Set(selectedAccessories.map((a) => a.masterId));

                  // Find newly added items
                  const addedIds = [...newIds].filter((id) => !prevIds.has(id) && !presetItemIds.has(id));
                  if (addedIds.length > 0) {
                    setStyleSpecificIds((prev) => {
                      const updated = new Set(prev);
                      addedIds.forEach((id) => updated.add(id));
                      return updated;
                    });
                  }

                  // Remove from styleSpecificIds if item was removed
                  const removedIds = [...prevIds].filter((id) => !newIds.has(id));
                  if (removedIds.length > 0) {
                    setStyleSpecificIds((prev) => {
                      const updated = new Set(prev);
                      removedIds.forEach((id) => updated.delete(id));
                      return updated;
                    });
                  }

                  setSelectedAccessories(newAccessories);
                }}
                customerId={selectedCustomerId}
                presetItemIds={presetItemIds}
                styleSpecificIds={styleSpecificIds}
                styleCode={styleCode}
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
                <Button type="submit" disabled={loading} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {loading ? 'Saving...' : isEditMode ? 'Update Style' : 'Create Style'}
                </Button>
                {isEditMode && styleStatus === 'DRAFT' && (
                  <Button
                    type="button"
                    onClick={handlePublishClick}
                    disabled={publishing || loading}
                    className="flex items-center gap-2 bg-success hover:bg-success text-white"
                  >
                    {publishing ? 'Publishing...' : 'Publish Style'}
                  </Button>
                )}
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
          embroideryPickerFabricId ? fabrics.find((f) => f.id === embroideryPickerFabricId)?.embroideryId : null
        }
      />

      {/* Publish Confirmation Dialog */}
      <ConfirmDialog
        open={publishDialogOpen}
        onOpenChange={setPublishDialogOpen}
        title="Publish Style"
        description="Are you sure you want to publish this style? Once published, it will be available for orders and production planning. Make sure customer, brand, and fabrics are filled in."
        confirmText={publishing ? 'Publishing...' : 'Publish'}
        cancelText="Cancel"
        onConfirm={confirmPublish}
        variant="default"
      />

      {/* Restore Deleted Style Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Style Code Already Exists
            </DialogTitle>
            <DialogDescription className="pt-2">
              The style code <span className="font-semibold text-foreground">"{deletedStyleInfo?.styleCode}"</span> was
              previously used for a style that has been deleted/archived.
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
            <Button type="button" onClick={handleRestoreStyle} disabled={restoring} className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              {restoring ? 'Restoring...' : 'Restore Style'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore from localStorage Dialog */}
      <Dialog
        open={showLocalRestoreDialog}
        onOpenChange={(open) => {
          if (!open) {
            // User closed dialog without choosing - discard the saved draft
            clearLocalDraft();
            setPendingLocalRestore(null);
          }
          setShowLocalRestoreDialog(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-info" />
              Restore Unsaved Changes?
            </DialogTitle>
            <DialogDescription className="pt-2">
              You have unsaved changes from a previous session.
              {pendingLocalRestore?.timestamp && (
                <span className="block mt-1 text-xs">
                  Last edited: {new Date(pendingLocalRestore.timestamp).toLocaleString()}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-muted/50 rounded-lg p-4 border">
              <div className="text-sm space-y-1">
                {pendingLocalRestore?.data.styleCode && (
                  <div>
                    <span className="text-muted-foreground">Style Code:</span>
                    <span className="ml-2 font-medium">{pendingLocalRestore.data.styleCode}</span>
                  </div>
                )}
                {pendingLocalRestore?.data.styleName && (
                  <div>
                    <span className="text-muted-foreground">Style Name:</span>
                    <span className="ml-2 font-medium">{pendingLocalRestore.data.styleName}</span>
                  </div>
                )}
                {pendingLocalRestore?.data.customerName && (
                  <div>
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="ml-2 font-medium">{pendingLocalRestore.data.customerName}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowLocalRestoreDialog(false);
                clearLocalDraft();
                setPendingLocalRestore(null);
              }}
            >
              Discard
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (pendingLocalRestore?.data) {
                  restoreFormData(pendingLocalRestore.data);
                  setLastAutoSaved(new Date(pendingLocalRestore.timestamp));
                  notify.success('Restored unsaved changes');
                }
                setShowLocalRestoreDialog(false);
                setPendingLocalRestore(null);
              }}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Restore Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
