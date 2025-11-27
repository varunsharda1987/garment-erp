/**
 * StyleForm - Redesigned (Phase 3)
 *
 * New 5-tab workflow:
 * 1. Basic Info + Additional Details (expandable)
 * 2. Size & SKU Variants
 * 3. Fabrics & Trims (merged, uses GenericFabricSelector)
 * 4. Value Addition & Processes
 * 5. Garment & Packaging Accessories (uses MaterialBOMPicker)
 *
 * Key Changes:
 * - Generic Fabric Name instead of Greige Name (user selects greige later in CAD planning)
 * - Fabric Finish Type selector (DYED, PRINTED, YARN_DYED, RAW)
 * - Customer Accessory Presets auto-populate
 * - Unified Material BOM system
 * - CAD status tracking (PENDING by default)
 * - Thread auto-added
 * - Pre-checked production processes (Cutting, Stitching, Finishing, Transportation)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import { styleService } from '../services/style.service';
import { customerService } from '../services/customer.service';
import { getAllComponentMasters, getCategories } from '../services/componentMaster.service';
import type { ComponentMaster } from '../types/componentMaster.types';
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
import { GenericFabricSelector } from '../components/GenericFabricSelector';
import { MaterialBOMPicker } from '../components/MaterialBOMPicker';
import type { MaterialBOMEntry } from '../components/MaterialBOMPicker';
import type { Customer, BrandCategory } from '../types/customer.types';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Info,
  AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '../lib/utils';

// Enums
type FabricFinishType = 'DYED' | 'PRINTED' | 'YARN_DYED' | 'RAW';
type CADStatus = 'PENDING' | 'IN_PROGRESS' | 'APPROVED';
type ProcessType =
  | 'CUTTING'
  | 'STITCHING'
  | 'FINISHING'
  | 'TRANSPORTATION'
  | 'EMBROIDERY'
  | 'HANDWORK'
  | 'SMOCKING'
  | 'WASHING';

interface FabricEntry {
  id: string;
  componentName: string;
  genericFabricName: string;
  fabricFinishType: FabricFinishType | '';
  estimatedConsumption: number;
  unit: 'METER' | 'YARD';
  notes?: string;
}

interface SKUVariant {
  size: string;
  sku: string;
  barcode?: string;
  accountingSKU?: string;
  isActive: boolean;
}

interface ProcessEntry {
  processType: ProcessType;
  description?: string;
  vendor?: string;
  estimatedCost?: number;
  isRequired: boolean;
}

const FABRIC_FINISH_TYPES: { value: FabricFinishType; label: string }[] = [
  { value: 'DYED', label: 'Solid Dyed' },
  { value: 'PRINTED', label: 'Printed' },
  { value: 'YARN_DYED', label: 'Yarn Dyed (Checks/Stripes)' },
  { value: 'RAW', label: 'Raw/Unfinished' },
];

const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

const PRODUCTION_PROCESSES: { type: ProcessType; label: string; preChecked: boolean }[] = [
  { type: 'CUTTING', label: 'Cutting', preChecked: true },
  { type: 'STITCHING', label: 'Stitching', preChecked: true },
  { type: 'FINISHING', label: 'Finishing', preChecked: true },
  { type: 'TRANSPORTATION', label: 'Transportation', preChecked: true },
  { type: 'EMBROIDERY', label: 'Embroidery', preChecked: false },
  { type: 'HANDWORK', label: 'Handwork', preChecked: false },
  { type: 'SMOCKING', label: 'Smocking', preChecked: false },
  { type: 'WASHING', label: 'Washing', preChecked: false },
];

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
  const [customerAccessoryPresets, setCustomerAccessoryPresets] = useState<any[]>([]);

  const [styleCode, setStyleCode] = useState('');
  const [styleName, setStyleName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [category, setCategory] = useState('');
  const [brandCategoryId, setBrandCategoryId] = useState('');
  const [season, setSeason] = useState('');
  const [description, setDescription] = useState('');

  // Additional Details (Template Fields)
  const [numberOfComponents, setNumberOfComponents] = useState(1);
  const [costPrice, setCostPrice] = useState<number | ''>('');  // COST in template
  const [sellingPrice, setSellingPrice] = useState<number | ''>('');  // MRP in template
  const [expectedOrderQty, setExpectedOrderQty] = useState<number | ''>('');
  const [remarks, setRemarks] = useState('');  // Changed from specifications
  const [hsnCode, setHsnCode] = useState('');
  const [productTaxRule, setProductTaxRule] = useState('');
  const [bulletPoints, setBulletPoints] = useState('');
  const [accountingSKU, setAccountingSKU] = useState('');
  const [accountingUnit, setAccountingUnit] = useState('PCS');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Component Masters
  const [componentMasters, setComponentMasters] = useState<ComponentMaster[]>([]);
  const [componentCategories, setComponentCategories] = useState<string[]>([]);
  const [selectedComponents, setSelectedComponents] = useState<Array<{ category: string; componentId: string }>>([]);

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
  const [fabrics, setFabrics] = useState<FabricEntry[]>([
    {
      id: crypto.randomUUID(),
      componentName: 'Component 1',
      genericFabricName: '',
      fabricFinishType: '',
      estimatedConsumption: 0,
      unit: 'METER',
      notes: ''
    }
  ]);
  const [materialBOM, setMaterialBOM] = useState<MaterialBOMEntry[]>([]);

  // Tab 4: Value Addition & Processes
  const [processes, setProcesses] = useState<ProcessEntry[]>(
    PRODUCTION_PROCESSES.map(p => ({
      processType: p.type,
      isRequired: p.preChecked,
      description: '',
      vendor: '',
      estimatedCost: undefined
    }))
  );

  // Tab 5: Accessories
  const [selectedAccessoryPresetId, setSelectedAccessoryPresetId] = useState('');
  const [accessories, setAccessories] = useState<MaterialBOMEntry[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Load customers and component masters on mount
  useEffect(() => {
    loadCustomers();
    loadComponentMasters();
  }, []);

  // Load style data in edit mode - wait for both customers AND componentMasters to be loaded
  useEffect(() => {
    if (isEditMode && id && customers.length > 0 && componentMasters.length > 0) {
      loadStyleData(id);
    }
  }, [isEditMode, id, customers.length, componentMasters.length]);

  // Load customer brands when customer selected - MATCHES OLD STYLEFORM
  useEffect(() => {
    if (selectedCustomerId) {
      const customer = customers.find(c => c.id === selectedCustomerId);
      if (customer) {
        // Use customer.name directly (same as old StyleForm)
        setCustomerName(customer.name);

        // Extract brands from brandCategories (same as old StyleForm)
        if (customer.brandCategories && Array.isArray(customer.brandCategories) && customer.brandCategories.length > 0) {
          const uniqueBrands = [...new Set(customer.brandCategories.map((bc: any) => bc.brandName))];
          setAvailableBrands(uniqueBrands);
        } else if (customer.brandNames) {
          // Fallback to old format (same as old StyleForm)
          const brands = customer.brandNames.split('\n').map((b: string) => b.trim()).filter((b: string) => b);
          setAvailableBrands(brands);
        } else {
          setAvailableBrands([]);
        }

        // Reset brand selection when customer changes
        setBrandName('');
        setCategory('');
        setAvailableCategories([]);
        loadAccessoryPresets(selectedCustomerId);
      }
    }
  }, [selectedCustomerId, customers]);

  // Load brand categories when brand is selected
  useEffect(() => {
    if (selectedCustomerId && brandName) {
      const customer = customers.find(c => c.id === selectedCustomerId);
      if (customer?.brandCategories) {
        // Filter brand categories for the selected brand
        const brandCategories = customer.brandCategories
          .filter((bc: any) => bc.brandName === brandName);

        // Store full BrandCategory objects (no need to extract just names)
        setAvailableCategories(brandCategories);

        // Reset category if it's not in the new list
        const categoryStillValid = brandCategories.some((bc: any) => bc.category === category);
        if (category && !categoryStillValid) {
          setCategory('');
          setBrandCategoryId('');
        }
      } else {
        setAvailableCategories([]);
      }
    } else {
      setAvailableCategories([]);
      if (!brandName) {
        setCategory('');
      }
    }
  }, [brandName, selectedCustomerId, customers]);

  const loadCustomers = async () => {
    try {
      const response = await customerService.getAllCustomers({ limit: 1000 });
      setCustomers(response.data);
    } catch (error) {
      console.error('Failed to load customers:', error);
      toast.error('Failed to load customers');
    }
  };

  const loadComponentMasters = async () => {
    try {
      const [mastersResponse, categoriesResponse] = await Promise.all([
        getAllComponentMasters({ activeOnly: true, limit: 1000 }),
        getCategories()
      ]);
      setComponentMasters(mastersResponse.data);
      setComponentCategories(categoriesResponse);
    } catch (error) {
      console.error('Failed to load component masters:', error);
      toast.error('Failed to load component masters');
    }
  };

  const loadStyleData = async (styleId: string) => {
    try {
      setLoading(true);
      const style = await styleService.getStyleById(styleId);

      // Populate basic info
      setStyleCode(style.styleCode);
      setStyleName(style.styleName || '');
      setDescription(style.description || '');
      setCategory(style.category || '');
      setBrandCategoryId(style.brandCategoryId || '');
      setSeason(style.season || '');

      // Template fields (Additional Details)
      setCostPrice(style.costPrice || '');
      setSellingPrice(style.sellingPrice || '');
      setExpectedOrderQty(style.expectedOrderQty || '');
      setRemarks(style.specifications || '');  // Using specifications field for remarks
      setHsnCode(style.hsnCode || '');
      setProductTaxRule(style.productTaxRule || '');
      setBulletPoints(style.bulletPoints || '');
      setAccountingSKU(style.accountingSKU || '');
      setAccountingUnit(style.accountingUnit || '');
      setImageUrl(style.imageUrl || '');

      // Find and set customer by name
      const matchingCustomer = customers.find(c => c.name === style.customerName);
      if (matchingCustomer) {
        setSelectedCustomerId(matchingCustomer.id);
        setCustomerName(matchingCustomer.name);

        // Populate available brands from customer's brandCategories
        if (matchingCustomer.brandCategories && Array.isArray(matchingCustomer.brandCategories) && matchingCustomer.brandCategories.length > 0) {
          const uniqueBrands = [...new Set(matchingCustomer.brandCategories.map((bc: any) => bc.brandName))];
          setAvailableBrands(uniqueBrands);

          // Set brand and category
          setBrandName(style.brandName || '');

          // If brandCategoryId is present, find and set the matching category
          if (style.brandCategoryId) {
            const matchingBrandCategory = matchingCustomer.brandCategories.find(
              (bc: any) => bc.id === style.brandCategoryId
            );
            if (matchingBrandCategory) {
              setCategory(matchingBrandCategory.category);
              setBrandCategoryId(matchingBrandCategory.id);

              // Populate available categories for this brand
              const brandCategories = matchingCustomer.brandCategories.filter(
                (bc: any) => bc.brandName === style.brandName
              );
              setAvailableCategories(brandCategories);
            }
          }
        }
      }

      // Load SKU variants if available (from style_variants table)
      const skuVariantsData = style.styleVariants || style.styleSkuVariants || style.skuVariants || [];
      if (skuVariantsData.length > 0) {
        setSkuVariants(skuVariantsData.map((sku: any) => ({
          size: sku.sizeName || sku.size,
          sku: sku.sku,
          barcode: sku.barcode || '',
          accountingSKU: sku.accountingSKU || '',
          isActive: sku.isActive !== false
        })));
      }

      // Load fabrics if available (check both old 'fabrics' and new 'styleFabricsFlat')
      const fabricsData = style.styleFabricsFlat || style.fabrics || [];
      if (fabricsData.length > 0) {
        setFabrics(fabricsData.map((sf: any) => ({
          id: sf.id || crypto.randomUUID(),
          componentName: sf.componentName || '',
          genericFabricName: sf.genericFabricName || '',
          fabricFinishType: sf.fabricFinishType || '',
          estimatedConsumption: sf.estimatedConsumption || 0,
          unit: sf.unit || 'METER',
          notes: sf.notes || ''
        })));
      }

      // Load material BOM (trims) if available
      if (style.styleMaterialBom && style.styleMaterialBom.length > 0) {
        setMaterialBOM(style.styleMaterialBom
          .filter((bom: any) => bom.usageCategory === 'GARMENT_TRIM')
          .map((bom: any) => ({
            materialId: bom.materialId,
            materialName: bom.material?.name || '',
            materialCode: bom.material?.code || '',
            materialType: bom.material?.type || '',
            estimatedConsumption: bom.estimatedConsumption || 0,
            unit: bom.unit || 'PCS',
            notes: bom.notes || '',
            usageCategory: 'GARMENT_TRIM'
          })));
      }

      // Load accessories if available
      if (style.styleMaterialBom && style.styleMaterialBom.length > 0) {
        setAccessories(style.styleMaterialBom
          .filter((bom: any) => bom.usageCategory === 'PACKAGING')
          .map((bom: any) => ({
            materialId: bom.materialId,
            materialName: bom.material?.name || '',
            materialCode: bom.material?.code || '',
            materialType: bom.material?.type || '',
            estimatedConsumption: bom.estimatedConsumption || 0,
            unit: bom.unit || 'PCS',
            notes: bom.notes || '',
            usageCategory: 'PACKAGING'
          })));
      }

      // Load processes if available
      if (style.processes && style.processes.length > 0) {
        setProcesses(style.processes.map((sp: any) => ({
          processType: sp.processType,
          description: sp.description || '',
          vendor: sp.vendor || '',
          estimatedCost: sp.estimatedCost || 0,
          isRequired: sp.isRequired
        })));
      }

      // Load components if available
      if (style.components && style.components.length > 0) {
        setNumberOfComponents(style.components.length);

        // Map style components to selectedComponents format
        // Need to find the matching component master for each to get the componentId
        const loadedComponents = style.components.map((sc: any) => {
          // Find the component master by name
          const matchingMaster = componentMasters.find(cm => cm.name === sc.componentName);
          return {
            category: sc.componentType || '',
            componentId: matchingMaster?.id || ''
          };
        });
        setSelectedComponents(loadedComponents);
      } else {
        setNumberOfComponents(style.numberOfComponents || 1);
      }

      toast.success('Style loaded successfully');
    } catch (error) {
      console.error('Failed to load style:', error);
      toast.error('Failed to load style data');
    } finally {
      setLoading(false);
    }
  };

  const loadAccessoryPresets = async (customerId: string) => {
    try {
      // TODO: Call GET /api/customers/:id/accessory-presets
      // const presets = await customerService.getAccessoryPresets(customerId);
      // setCustomerAccessoryPresets(presets);
      setCustomerAccessoryPresets([]); // Placeholder
    } catch (error) {
      console.error('Failed to load accessory presets:', error);
    }
  };

  const handleAddFabric = () => {
    setFabrics([
      ...fabrics,
      {
        id: crypto.randomUUID(),
        componentName: `Component ${fabrics.length + 1}`,
        genericFabricName: '',
        fabricFinishType: '',
        estimatedConsumption: 0,
        unit: 'METER',
        notes: ''
      }
    ]);
  };

  const handleRemoveFabric = (id: string) => {
    if (fabrics.length > 1) {
      setFabrics(fabrics.filter(f => f.id !== id));
    }
  };

  const handleUpdateFabric = (id: string, field: keyof FabricEntry, value: any) => {
    setFabrics(fabrics.map(f =>
      f.id === id ? { ...f, [field]: value } : f
    ));
  };

  const handleAddMaterial = (entry: MaterialBOMEntry) => {
    setMaterialBOM([...materialBOM, entry]);
    toast.success(`Added ${entry.materialName} to BOM`);
  };

  const handleRemoveMaterial = (index: number) => {
    setMaterialBOM(materialBOM.filter((_, i) => i !== index));
  };

  const handleAddAccessory = (entry: MaterialBOMEntry) => {
    setAccessories([...accessories, entry]);
    toast.success(`Added ${entry.materialName} to accessories`);
  };

  const handleRemoveAccessory = (index: number) => {
    setAccessories(accessories.filter((_, i) => i !== index));
  };

  const handleProcessToggle = (processType: ProcessType) => {
    setProcesses(processes.map(p =>
      p.processType === processType
        ? { ...p, isRequired: !p.isRequired }
        : p
    ));
  };

  const handleProcessUpdate = (processType: ProcessType, field: 'description' | 'vendor' | 'estimatedCost', value: any) => {
    setProcesses(processes.map(p =>
      p.processType === processType
        ? { ...p, [field]: value }
        : p
    ));
  };

  const generateSKUs = () => {
    const base = styleCode || 'STYLE';
    setSkuVariants(skuVariants.map(v => ({
      ...v,
      sku: v.isActive ? `${base}${v.size}` : v.sku
    })));
    toast.success('SKUs generated!');
  };

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!id) {
      toast.error('Please save the style first before uploading an image');
      return;
    }

    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      toast.error('Only JPG and PNG images are allowed');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    try {
      setUploadingImage(true);
      const uploadedImageUrl = await styleService.uploadStyleImage(id, file);
      setImageUrl(uploadedImageUrl);
      toast.success('Image uploaded successfully');
    } catch (error: any) {
      console.error('Image upload error:', error);
      toast.error(error.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
      // Reset file input
      e.target.value = '';
    }
  };

  // Handle image delete
  const handleDeleteImage = async () => {
    if (!id) return;

    try {
      // Update the style to remove the image URL
      await styleService.updateStyle(id, { imageUrl: null });
      setImageUrl('');
      toast.success('Image removed successfully');
    } catch (error: any) {
      console.error('Delete image error:', error);
      toast.error('Failed to remove image');
    }
  };

  const handleSaveAsDraft = async () => {
    // Save as draft without validation
    await saveStyle(true);
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
        toast.error('Style code is required to save as draft');
        return;
      }
      // For drafts, we don't require customer or fabrics
    } else {
      // Full validation for final save
      if (!styleCode || !customerName) {
        toast.error('Style code and customer are required');
        return;
      }

      // Only validate fabrics for non-draft saves
      if (fabrics.length === 0 || fabrics.some(f => !f.genericFabricName)) {
        toast.error('At least one fabric with generic name is required');
        return;
      }
    }

    try {
      setLoading(true);

      // Auto-add Thread if not present
      const hasThread = [...materialBOM, ...accessories].some(
        m => m.materialType === 'THREAD'
      );

      const finalMaterialBOM = hasThread
        ? [...materialBOM, ...accessories]
        : [
            ...materialBOM,
            ...accessories,
            {
              materialType: 'THREAD' as any,
              materialId: 'auto-thread',
              materialCode: 'THREAD-AUTO',
              materialName: 'Thread (Auto-added)',
              quantityPerGarment: 0,
              unit: 'cone',
              unitPrice: 0,
              usageCategory: 'GARMENT_TRIM' as any,
              componentName: 'Default Thread'
            }
          ];

      // Build components array from selectedComponents
      console.log('🔍 COMPONENT DEBUG - selectedComponents:', selectedComponents);
      console.log('🔍 COMPONENT DEBUG - componentMasters:', componentMasters);

      const components = selectedComponents
        .filter(sc => sc.componentId) // Only include components that have been selected
        .map(sc => {
          // Find the component master to get the name
          const componentMaster = componentMasters.find(cm => cm.id === sc.componentId);
          if (!componentMaster) {
            console.warn('⚠️  Component master not found for id:', sc.componentId);
            return null;
          }

          // Find fabrics for this component
          const componentFabrics = fabrics
            .filter(f => f.componentName === componentMaster.name)
            .map(f => ({
              fabricName: f.genericFabricName,
              fabricType: 'GENERIC', // Type for new system
              fabricFinishType: f.fabricFinishType || null,
              quantityNeeded: f.estimatedConsumption,
              unit: f.unit,
              notes: f.notes || null,
            }));

          return {
            componentName: componentMaster.name,
            componentType: sc.category || 'OTHER', // Use category as componentType
            fabrics: componentFabrics,
          };
        })
        .filter(c => c !== null); // Remove any null entries

      console.log('🔍 COMPONENT DEBUG - Final components array:', components);

      const styleData = {
        styleCode,
        styleName: styleName || styleCode,
        customerName: customerName || (isDraft ? 'Draft' : ''),
        brandName,
        category,
        brandCategoryId: brandCategoryId || null,
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
        accountingSKU: accountingSKU || null,
        accountingUnit: accountingUnit || null,
        // Template fields - Marketing & Other
        bulletPoints: bulletPoints || null,
        imageUrl: imageUrl || null,
        specifications: remarks || null,  // Storing remarks in specifications field
        // Fabrics with new fields - only include valid fabrics
        fabrics: fabrics
          .filter(f => isDraft || f.genericFabricName) // For drafts, include all; for final, only with names
          .map(f => ({
            componentName: f.componentName,
            genericFabricName: f.genericFabricName || (isDraft ? '' : f.genericFabricName),
            fabricFinishType: f.fabricFinishType || null,
            estimatedConsumption: f.estimatedConsumption || 0,
            unit: f.unit,
            notes: f.notes
          })),
        // Unified material BOM
        materialBOM: finalMaterialBOM,
        // SKU variants
        skuVariants: skuVariants.filter(v => v.isActive),
        // Processes
        processes: processes.filter(p => p.isRequired).map(p => ({
          processType: p.processType,
          description: p.description,
          vendor: p.vendor,
          estimatedCost: p.estimatedCost
        })),
        // Customer preset if selected
        customerAccessoriesPresetId: selectedAccessoryPresetId || undefined,
        // CAD status starts as PENDING
        cadStatus: 'PENDING' as CADStatus,
        // Status - DRAFT if saving as draft, otherwise ACTIVE
        status: isDraft ? 'DRAFT' : 'DRAFT'  // Can change to 'ACTIVE' if needed
      };

      console.log('📤 ABOUT TO SEND - styleData.components:', styleData.components);
      console.log('📤 ABOUT TO SEND - styleData.brandCategoryId:', styleData.brandCategoryId);

      if (isEditMode && id) {
        await styleService.updateStyle(id, styleData);
        toast.success(isDraft ? 'Draft saved successfully!' : 'Style updated successfully!');
      } else {
        await styleService.createStyle(styleData);
        toast.success(isDraft ? 'Draft saved successfully!' : 'Style created successfully! Proceed to CAD Planning.');
      }

      navigate('/styles');
    } catch (error: any) {
      console.error('Failed to save style:', error);
      toast.error(error.response?.data?.message || 'Failed to save style');
    } finally {
      setLoading(false);
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
            <TabsTrigger value="fabrics">2. Fabrics & Trims</TabsTrigger>
            <TabsTrigger value="processes">3. Processes</TabsTrigger>
            <TabsTrigger value="accessories">4. Accessories</TabsTrigger>
          </TabsList>

          {/* TAB 1: BASIC INFO */}
          <TabsContent value="basic" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <Label>Customer/Buyer *</Label>
                  <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select customer..." />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Brand</Label>
                  <Select value={brandName} onValueChange={setBrandName} disabled={!availableBrands.length}>
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
                <div>
                  <Label>Brand Category</Label>
                  <Select
                    value={brandCategoryId}
                    onValueChange={(value) => {
                      setBrandCategoryId(value);
                      // Also set the category name for display/backward compatibility
                      const selectedBrandCategory = availableCategories.find(bc => bc.id === value);
                      if (selectedBrandCategory) {
                        setCategory(selectedBrandCategory.category);
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
                    min="1"
                    value={numberOfComponents}
                    onChange={(e) => setNumberOfComponents(parseInt(e.target.value) || 1)}
                    placeholder="1"
                  />
                </div>
              </div>

              {/* Component Names Section */}
              {numberOfComponents > 0 && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <Label className="text-base font-semibold mb-3 block">Component Selection</Label>
                  <p className="text-xs text-gray-600 mb-3">
                    Select component category and specific component for each part of the garment.
                    Manage components in <a href="/component-masters" className="text-blue-600 hover:underline">Component Masters</a>.
                  </p>
                  <div className="grid grid-cols-1 gap-4">
                    {Array.from({ length: numberOfComponents }, (_, index) => {
                      // Ensure selectedComponents array has enough elements
                      if (!selectedComponents[index]) {
                        const newComponents = [...selectedComponents];
                        newComponents[index] = { category: '', componentId: '' };
                        setSelectedComponents(newComponents);
                      }

                      const selectedCategory = selectedComponents[index]?.category || '';
                      const selectedComponentId = selectedComponents[index]?.componentId || '';
                      const filteredComponents = selectedCategory
                        ? componentMasters.filter(c => c.componentCategory === selectedCategory)
                        : componentMasters;

                      return (
                        <div key={index} className="grid grid-cols-2 gap-3 p-3 bg-white rounded-md border">
                          <div>
                            <Label className="text-sm">Component {index + 1} - Category</Label>
                            <Select
                              value={selectedCategory}
                              onValueChange={(value) => {
                                const newComponents = [...selectedComponents];
                                // Ensure array is long enough
                                while (newComponents.length <= index) {
                                  newComponents.push({ category: '', componentId: '' });
                                }
                                newComponents[index] = { category: value, componentId: '' };
                                setSelectedComponents(newComponents);
                              }}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select category..." />
                              </SelectTrigger>
                              <SelectContent>
                                {componentCategories.map((cat) => (
                                  <SelectItem key={cat} value={cat}>
                                    {cat}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm">Component Name</Label>
                            <Select
                              value={selectedComponentId}
                              onValueChange={(value) => {
                                const newComponents = [...selectedComponents];
                                // Ensure array is long enough
                                while (newComponents.length <= index) {
                                  newComponents.push({ category: '', componentId: '' });
                                }
                                newComponents[index] = {
                                  category: selectedCategory,
                                  componentId: value
                                };
                                setSelectedComponents(newComponents);
                              }}
                              disabled={!selectedCategory}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder={selectedCategory ? "Select component..." : "Select category first"} />
                              </SelectTrigger>
                              <SelectContent>
                                {filteredComponents.map((component) => (
                                  <SelectItem key={component.id} value={component.id}>
                                    {component.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
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
                  {/* Image Upload */}
                  <div>
                    <Label className="text-base font-semibold">Product Image</Label>
                    <div className="mt-2 space-y-3">
                      {/* Image Preview */}
                      {imageUrl && (
                        <div className="relative inline-block">
                          <div className="border-2 border-gray-300 rounded-lg p-4 bg-white">
                            <img
                              src={imageUrl.startsWith('http') ? imageUrl : `http://localhost:5000${imageUrl}`}
                              alt="Style preview"
                              className="max-w-md max-h-64 object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBOb3QgRm91bmQ8L3RleHQ+PC9zdmc+';
                              }}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute top-2 right-2"
                            onClick={handleDeleteImage}
                            disabled={uploadingImage}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        </div>
                      )}

                      {/* Image URL Input */}
                      <Input
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://example.com/image.jpg or paste image URL"
                        disabled={uploadingImage}
                      />

                      {/* File Upload */}
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png"
                          onChange={handleImageUpload}
                          disabled={uploadingImage || !id}
                          className="flex-1"
                        />
                        {uploadingImage && (
                          <span className="text-sm text-gray-500">Uploading...</span>
                        )}
                      </div>

                      {!id && (
                        <p className="text-xs text-amber-600">
                          Note: Image upload is available after creating the style
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        Supported formats: JPG, PNG (Max size: 5MB)
                      </p>
                    </div>
                  </div>

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
                    <div className="grid grid-cols-2 gap-4 mb-4">
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
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Accounting Style Code</Label>
                        <Input
                          value={accountingSKU}
                          onChange={(e) => setAccountingSKU(e.target.value)}
                          placeholder="Style code for accounting"
                        />
                      </div>
                      <div>
                        <Label>Accounting Unit</Label>
                        <Input
                          value={accountingUnit}
                          onChange={(e) => setAccountingUnit(e.target.value)}
                          placeholder="e.g., PCS, DOZEN"
                        />
                      </div>
                      <div className="flex items-end">
                        <p className="text-xs text-gray-500">
                          Accounting SKU will be mapped to each size variant below
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Size Variants & SKUs */}
                  <div>
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
                          <div className="col-span-1">
                            <Badge variant="outline">{variant.size}</Badge>
                          </div>
                          <div className="col-span-3">
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
                          <div className="col-span-3">
                            <Input
                              placeholder="Accounting SKU"
                              value={variant.accountingSKU || ''}
                              onChange={(e) => {
                                const updated = [...skuVariants];
                                updated[index].accountingSKU = e.target.value;
                                setSkuVariants(updated);
                              }}
                              disabled={!variant.isActive}
                            />
                          </div>
                          <div className="col-span-4">
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
                      Uncheck sizes you don't need. SKUs are required for active sizes.
                    </p>
                  </div>

                  {/* Marketing & Remarks */}
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
            </Card>

            <div className="flex justify-end">
              <Button type="button" onClick={() => setActiveTab('fabrics')}>
                Next: Fabrics & Trims
              </Button>
            </div>
          </TabsContent>

          {/* TAB 2: FABRICS & TRIMS */}
          <TabsContent value="fabrics" className="space-y-6">
            {/* Fabrics Section */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Fabrics</h2>
                <Button type="button" variant="outline" size="sm" onClick={handleAddFabric}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Fabric
                </Button>
              </div>

              <div className="space-y-4">
                {fabrics.map((fabric, index) => (
                  <div key={fabric.id} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">Fabric {index + 1}</span>
                      {fabrics.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFabric(fabric.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Component Name</Label>
                        <Input
                          value={fabric.componentName}
                          onChange={(e) => handleUpdateFabric(fabric.id, 'componentName', e.target.value)}
                          placeholder="e.g., Front Panel, Sleeve"
                        />
                      </div>
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
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>Est. Consumption</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={fabric.estimatedConsumption}
                            onChange={(e) => handleUpdateFabric(fabric.id, 'estimatedConsumption', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <Label>Unit</Label>
                          <Select
                            value={fabric.unit}
                            onValueChange={(v: any) => handleUpdateFabric(fabric.id, 'unit', v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="METER">Meter</SelectItem>
                              <SelectItem value="YARD">Yard</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label>Notes</Label>
                      <Input
                        value={fabric.notes || ''}
                        onChange={(e) => handleUpdateFabric(fabric.id, 'notes', e.target.value)}
                        placeholder="Additional notes..."
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Trims/Materials Section */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Trims & Materials</h2>
                  <p className="text-sm text-gray-600">Buttons, Zippers, Lace, Thread, etc.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setIsPickerOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Material
                </Button>
              </div>

              {materialBOM.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No materials added yet</p>
                  <p className="text-sm mt-1">Click "Add Material" to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {materialBOM.map((material, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{material.materialCode}</Badge>
                          <span className="font-medium text-sm">{material.materialName}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          Qty: {material.quantityPerGarment} {material.unit} ·
                          Category: {material.usageCategory.replace('_', ' ')}
                          {material.componentName && ` · Component: ${material.componentName}`}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMaterial(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setActiveTab('sizes')}>
                Previous
              </Button>
              <Button type="button" onClick={() => setActiveTab('processes')}>
                Next: Processes
              </Button>
            </div>
          </TabsContent>

          {/* TAB 3: PROCESSES */}
          <TabsContent value="processes" className="space-y-6">
            <Card className="p-6">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">Production Processes</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Cutting, Stitching, Finishing, and Transportation are pre-selected
                </p>
              </div>

              <div className="space-y-3">
                {processes.map((process) => (
                  <div
                    key={process.processType}
                    className={cn(
                      'p-4 border rounded-lg transition-all',
                      process.isRequired ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={process.isRequired}
                        onCheckedChange={() => handleProcessToggle(process.processType)}
                      />
                      <div className="flex-1">
                        <div className="font-medium">
                          {PRODUCTION_PROCESSES.find(p => p.type === process.processType)?.label}
                        </div>
                        {process.isRequired && (
                          <div className="mt-3 grid grid-cols-3 gap-3">
                            <div>
                              <Label className="text-xs">Description</Label>
                              <Input
                                value={process.description || ''}
                                onChange={(e) => handleProcessUpdate(process.processType, 'description', e.target.value)}
                                placeholder="Optional"
                                size={1}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Vendor</Label>
                              <Input
                                value={process.vendor || ''}
                                onChange={(e) => handleProcessUpdate(process.processType, 'vendor', e.target.value)}
                                placeholder="Optional"
                                size={1}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Est. Cost (₹)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={process.estimatedCost || ''}
                                onChange={(e) => handleProcessUpdate(process.processType, 'estimatedCost', parseFloat(e.target.value) || undefined)}
                                placeholder="0.00"
                                size={1}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setActiveTab('fabrics')}>
                Previous
              </Button>
              <Button type="button" onClick={() => setActiveTab('accessories')}>
                Next: Accessories
              </Button>
            </div>
          </TabsContent>

          {/* TAB 4: ACCESSORIES */}
          <TabsContent value="accessories" className="space-y-6">
            {/* Customer Preset Section */}
            {customerAccessoryPresets.length > 0 && (
              <Card className="p-6">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">Customer Accessory Preset</h2>
                  <p className="text-sm text-gray-600">Auto-populate standard accessories for this customer</p>
                </div>
                <Select value={selectedAccessoryPresetId} onValueChange={setSelectedAccessoryPresetId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select preset (optional)..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customerAccessoryPresets.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.presetName} {preset.isDefault && '(Default)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Card>
            )}

            {/* Manual Accessories */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">Garment & Packaging Accessories</h2>
                  <p className="text-sm text-gray-600">Labels, Polybags, Hangtags, Cartons, etc.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setIsPickerOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Accessory
                </Button>
              </div>

              {accessories.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No accessories added yet</p>
                  <p className="text-sm mt-1">Add manually or select a customer preset above</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {accessories.map((accessory, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{accessory.materialCode}</Badge>
                          <span className="font-medium text-sm">{accessory.materialName}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          Qty: {accessory.quantityPerGarment} {accessory.unit} ·
                          Category: {accessory.usageCategory.replace('_', ' ')}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAccessory(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={() => setActiveTab('processes')}>
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

      {/* Material BOM Picker Modal */}
      <MaterialBOMPicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={(entry) => {
          if (activeTab === 'fabrics') {
            handleAddMaterial(entry);
          } else {
            handleAddAccessory(entry);
          }
        }}
        defaultUsageCategory={activeTab === 'accessories' ? 'PACKAGING' : 'GARMENT_TRIM'}
      />
    </div>
  );
}
