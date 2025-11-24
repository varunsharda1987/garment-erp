import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { styleService } from '@/services/style.service';
import { customerService } from '@/services/customer.service';
import { getAllMaterials } from '@/services/material.service';
import { greigeService } from '@/services/fabricGreigeService';
import type { GreigeMaster } from '@/types/fabric-greige.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { CadAverageInput } from '@/components/CadAverageInput';
import type { Style } from '@/types/style.types';
import type { Customer } from '@/types/customer.types';
import type { Material } from '@/types/material.types';
import { logDebug, logError } from '@/lib/logger';
import {
  generateSKUMatrix,
  DEFAULT_SIZES,
  validateSKUFormat,
  findDuplicateSKUs
} from '@/utils/sku-generator';
import type { SKUVariant } from '@/utils/sku-generator';
import { Checkbox } from '@/components/ui/checkbox';

interface StyleFormProps {
  mode?: 'create' | 'edit';
}

export default function StyleForm({ mode = 'create' }: StyleFormProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const currentUser = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [loadingStyle, setLoadingStyle] = useState(mode === 'edit');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [activeTab, setActiveTab] = useState('basic');

  // Customer/Buyer data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableSubCategories, setAvailableSubCategories] = useState<string[]>([]);
  const [availableSubSubCategories, setAvailableSubSubCategories] = useState<string[]>([]);

  // Materials data for dropdowns
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);
  const [fabricMaterials, setFabricMaterials] = useState<Material[]>([]);
  const [trimMaterials, setTrimMaterials] = useState<Material[]>([]);

  // Greige master data for autocomplete
  const [greigeOptions, setGreigeOptions] = useState<GreigeMaster[]>([]);

  // Basic Information (in order of appearance)
  const [customerName, setCustomerName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [styleCode, setStyleCode] = useState('');
  const [styleName, setStyleName] = useState(''); // Optional
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [subSubCategory, setSubSubCategory] = useState('');
  const [selectedBrandCategoryId, setSelectedBrandCategoryId] = useState(''); // To store the brandCategories.id
  const [numberOfComponents, setNumberOfComponents] = useState('1');

  // Order Information (optional)
  const [hasOrder, setHasOrder] = useState(false);
  const [orderQuantity, setOrderQuantity] = useState('');
  const [costPerPiece, setCostPerPiece] = useState('');
  const [orderValue, setOrderValue] = useState('0');
  const [orderDate, setOrderDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');

  // Fabrics (with Fabric Name, Greige Name, and CAD Averages)
  const [fabrics, setFabrics] = useState<Array<{
    fabricName: string;
    greigeName: string;
    cadAverages: Array<{
      fabricWidth: number;
      cadAverageMeters?: number;
      cadAverageYards?: number;
      cadWastagePercent?: number;
      markerEfficiency?: number;
      markerPlanFile?: string;
      isPreferred?: boolean;
      notes?: string;
    }>;
  }>>([
    { fabricName: '', greigeName: '', cadAverages: [] }
  ]);

  // Size Breakdown
  const [hasSizeBreakdown, setHasSizeBreakdown] = useState(false);
  const [sizeInputMethod, setSizeInputMethod] = useState<'ratio' | 'percentage' | 'absolute'>('ratio');
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [sizeBreakdown, setSizeBreakdown] = useState<Record<string, string>>({});
  const availableSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']; // Already in correct order

  // SKU Variants - Auto-select ALL sizes by default
  const [skuVariants, setSkuVariants] = useState<SKUVariant[]>(
    DEFAULT_SIZES.map(size => ({
      size,
      sku: '',
      barcode: '',
      isActive: true
    }))
  );

  // Garment Trims
  const [garmentTrims, setGarmentTrims] = useState<Array<{
    trimName: string;
    trimType: string;
    quantityPerPiece: string;
    unit: string;
    supplier: string;
  }>>([]);

  // Production Workflow Processes
  const [valueAdditions, setValueAdditions] = useState<{
    embroidery: boolean;
    dyeing: boolean;
    washing: boolean;
  }>({
    embroidery: false,
    dyeing: false,
    washing: false,
  });
  const [valueAdditionDetails, setValueAdditionDetails] = useState<Record<string, {
    description: string;
    vendor: string;
  }>>({});

  // Packaging Trims
  const [packagingTrims, setPackagingTrims] = useState<Array<{
    itemName: string;
    itemType: string;
    specification: string;
    quantityPerPack: string;
  }>>([]);

  // Description/Remarks (at the end)
  const [description, setDescription] = useState('');

  // Image Upload
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Fetch customers, materials, and greige options on mount
  useEffect(() => {
    fetchCustomers();
    fetchMaterials();
    fetchGreigeOptions();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await customerService.getAllCustomers({ limit: 1000 });
      console.log('🌐 API RESPONSE:', response);
      console.log('📦 Response data:', response.data);
      console.log('📊 First customer:', response.data[0]);
      console.log('🏷️  First customer brandCategories:', response.data[0]?.brandCategories);

      // Find Kasya customer specifically
      const kasyaCustomer = response.data.find((c: Customer) => c.name.includes('Kasya'));
      console.log('🔍 Kasya customer found:', kasyaCustomer);
      console.log('🔍 Kasya brandCategories:', kasyaCustomer?.brandCategories);

      setCustomers(response.data);
    } catch (error) {
      logError('Failed to fetch customers:', error);
    }
  };

  const fetchMaterials = async () => {
    try {
      const response = await getAllMaterials({ limit: 1000 });
      setAllMaterials(response.data);

      // Filter materials by category (check both child category and parent category)
      const fabrics = response.data.filter(m => {
        const categoryName = m.category?.name?.toLowerCase() || '';
        const parentCategoryName = m.category?.parent?.name?.toLowerCase() || '';
        return categoryName.includes('fabric') || parentCategoryName.includes('fabric');
      });

      const trims = response.data.filter(m => {
        const categoryName = m.category?.name?.toLowerCase() || '';
        const parentCategoryName = m.category?.parent?.name?.toLowerCase() || '';
        return categoryName.includes('button') ||
               categoryName.includes('zipper') ||
               categoryName.includes('thread') ||
               categoryName.includes('elastic') ||
               categoryName.includes('label') ||
               parentCategoryName.includes('trim');
      });

      setFabricMaterials(fabrics);
      setTrimMaterials(trims);
    } catch (error) {
      logError('Failed to fetch materials:', error);
    }
  };

  const fetchGreigeOptions = async () => {
    try {
      const response = await greigeService.getAll({ limit: 1000, isActive: 'true' });
      setGreigeOptions(response.data);
      logDebug(`Loaded ${response.data.length} greige options from greige_master`);
    } catch (error) {
      logError('Failed to fetch greige options:', error);
    }
  };

  // Handle customer selection and populate brands
  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const selectedCustomer = customers.find(c => c.id === customerId);
    if (selectedCustomer) {
      setCustomerName(selectedCustomer.name);

      // Try new brandCategories structure first
      if (selectedCustomer.brandCategories && Array.isArray(selectedCustomer.brandCategories) && selectedCustomer.brandCategories.length > 0) {
        const brandCategories = selectedCustomer.brandCategories;
        logDebug('Brand categories from customer (NEW FORMAT):', brandCategories);

        // Get unique brand names
        const uniqueBrands = [...new Set(brandCategories.map(bc => bc.brandName))];
        logDebug('Unique brands:', uniqueBrands);
        setAvailableBrands(uniqueBrands);
      } else if (selectedCustomer.brandNames) {
        // Fallback to old format
        logDebug('Using OLD FORMAT - Raw brandNames from customer:', selectedCustomer.brandNames);
        logDebug('Type of brandNames:', typeof selectedCustomer.brandNames);

        let brands: string[];
        if (Array.isArray(selectedCustomer.brandNames)) {
          brands = selectedCustomer.brandNames.filter(b => b && b.trim());
        } else {
          // Split by newline (brands are stored as newline-separated in the database)
          brands = selectedCustomer.brandNames.split('\n').map(b => b.trim()).filter(b => b);
        }

        logDebug('Parsed brands array:', brands);
        setAvailableBrands(brands);

        // Since we're using old format, categories won't be linked to brands
        // User will need to use fallback categories
      } else {
        logDebug('No brands found for customer');
        setAvailableBrands([]);
      }

      // Reset brand and category selection when customer changes
      setBrandName('');
      setCategory('');
      setAvailableCategories([]);
    }
  };

  // Handle brand selection and populate categories
  const handleBrandChange = (brand: string) => {
    console.log('==========================================');
    console.log('🔍 BRAND CHANGED TO:', brand);
    setBrandName(brand);

    // Find categories for the selected brand from brandCategories
    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
    console.log('📋 Selected customer:', selectedCustomer?.name);
    console.log('📦 Brand categories available:', selectedCustomer?.brandCategories);
    console.log('📊 Brand categories count:', selectedCustomer?.brandCategories?.length);

    if (selectedCustomer?.brandCategories && selectedCustomer.brandCategories.length > 0) {
      const brandCategories = selectedCustomer.brandCategories;
      logDebug('Loading categories for brand:', brand);

      // Filter categories for the selected brand
      const brandsCategories = brandCategories.filter(bc => bc.brandName === brand);

      // Get unique categories
      const uniqueCategories = [...new Set(brandsCategories.map(bc => bc.category))];
      logDebug('Available categories:', uniqueCategories);
      setAvailableCategories(uniqueCategories);

      // Reset category selections when brand changes
      setCategory('');
      setSubCategory('');
      setSubSubCategory('');
      setAvailableSubCategories([]);
      setAvailableSubSubCategories([]);
      setSelectedBrandCategoryId('');
    } else {
      // No brandCategories available
      logWarn('No brandCategories found for brand:', brand);
      setAvailableCategories([]);
      setCategory('');
      setSubCategory('');
      setSubSubCategory('');
      setAvailableSubCategories([]);
      setAvailableSubSubCategories([]);
      setSelectedBrandCategoryId('');
    }
  };

  // Handle category change - cascade to subcategories
  const handleCategoryChange = (selectedCategory: string) => {
    setCategory(selectedCategory);
    setSubCategory('');
    setSubSubCategory('');
    setSelectedBrandCategoryId('');

    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
    if (selectedCustomer?.brandCategories) {
      // Get brand categories matching brand and category
      const matchingCategories = selectedCustomer.brandCategories.filter(
        bc => bc.brandName === brandName && bc.category === selectedCategory
      );

      // Get unique subcategories (filter out null/undefined)
      const uniqueSubCategories = [
        ...new Set(
          matchingCategories
            .map(bc => bc.subCategory)
            .filter(sc => sc != null) as string[]
        )
      ];

      logDebug('Available subcategories for category', selectedCategory, ':', uniqueSubCategories);
      setAvailableSubCategories(uniqueSubCategories);
      setAvailableSubSubCategories([]);

      // If there's only one matching category with no subcategories, set the ID
      if (matchingCategories.length === 1 && !matchingCategories[0].subCategory) {
        setSelectedBrandCategoryId(matchingCategories[0].id);
        logDebug('Auto-selected brand category ID:', matchingCategories[0].id);
      }
    }
  };

  // Handle subcategory change - cascade to sub-subcategories
  const handleSubCategoryChange = (selectedSubCategory: string) => {
    setSubCategory(selectedSubCategory);
    setSubSubCategory('');
    setSelectedBrandCategoryId('');

    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
    if (selectedCustomer?.brandCategories) {
      // Get brand categories matching brand, category, and subcategory
      const matchingCategories = selectedCustomer.brandCategories.filter(
        bc =>
          bc.brandName === brandName &&
          bc.category === category &&
          bc.subCategory === selectedSubCategory
      );

      // Get unique sub-subcategories (filter out null/undefined)
      const uniqueSubSubCategories = [
        ...new Set(
          matchingCategories
            .map(bc => bc.subSubCategory)
            .filter(ssc => ssc != null) as string[]
        )
      ];

      logDebug('Available sub-subcategories:', uniqueSubSubCategories);
      setAvailableSubSubCategories(uniqueSubSubCategories);

      // If there's only one matching category with no sub-subcategories, set the ID
      if (matchingCategories.length === 1 && !matchingCategories[0].subSubCategory) {
        setSelectedBrandCategoryId(matchingCategories[0].id);
        logDebug('Auto-selected brand category ID:', matchingCategories[0].id);
      }
    }
  };

  // Handle sub-subcategory change - set the final brand category ID
  const handleSubSubCategoryChange = (selectedSubSubCategory: string) => {
    setSubSubCategory(selectedSubSubCategory);

    const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
    if (selectedCustomer?.brandCategories) {
      // Find the exact matching brand category
      const matchingCategory = selectedCustomer.brandCategories.find(
        bc =>
          bc.brandName === brandName &&
          bc.category === category &&
          bc.subCategory === subCategory &&
          bc.subSubCategory === selectedSubSubCategory
      );

      if (matchingCategory) {
        setSelectedBrandCategoryId(matchingCategory.id);
        logDebug('Selected brand category ID:', matchingCategory.id);
      }
    }
  };

  // Auto-save functionality (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerName || brandName || styleCode) {
        handleAutoSave();
      }
    }, 2000); // Auto-save after 2 seconds of inactivity

    return () => clearTimeout(timer);
  }, [customerName, brandName, styleCode, styleName, category, numberOfComponents,
    hasOrder, orderQuantity, costPerPiece, orderDate, deliveryDate, fabrics, description]);

  // Load style data in edit mode
  useEffect(() => {
    if (mode === 'edit' && id && customers.length > 0) {
      loadStyleData(id);
    }
  }, [mode, id, customers.length]);

  const loadStyleData = async (styleId: string) => {
    try {
      setLoadingStyle(true);
      const style: Style = await styleService.getStyleById(styleId);

      // Populate basic info
      setStyleCode(style.styleCode);
      setStyleName(style.styleName || '');
      setDescription(style.description || '');

      // Find and set customer/buyer by name
      const matchingCustomer = customers.find(c => c.name === style.customerName);
      if (matchingCustomer) {
        setSelectedCustomerId(matchingCustomer.id);
        setCustomerName(matchingCustomer.name);

        // Set available brands for this customer
        if (matchingCustomer.brandCategories && matchingCustomer.brandCategories.length > 0) {
          const uniqueBrands = [...new Set(matchingCustomer.brandCategories.map(bc => bc.brandName))];
          setAvailableBrands(uniqueBrands);
        }

        // Set brand name
        setBrandName(style.brandName);

        // Load brand category hierarchy from brandCategories
        if (style.brandCategoryId && matchingCustomer.brandCategories) {
          const brandCategory = matchingCustomer.brandCategories.find(bc => bc.id === style.brandCategoryId);
          if (brandCategory) {
            logDebug('Loading brand category hierarchy from ID:', style.brandCategoryId);

            // Set category
            setCategory(brandCategory.category);
            setSelectedBrandCategoryId(brandCategory.id);

            // Load categories for this brand
            const brandsCategories = matchingCustomer.brandCategories.filter(bc => bc.brandName === style.brandName);
            const uniqueCategories = [...new Set(brandsCategories.map(bc => bc.category))];
            setAvailableCategories(uniqueCategories);

            // Set subcategory if it exists
            if (brandCategory.subCategory) {
              setSubCategory(brandCategory.subCategory);

              // Load subcategories for this category
              const matchingCategories = matchingCustomer.brandCategories.filter(
                bc => bc.brandName === style.brandName && bc.category === brandCategory.category
              );
              const uniqueSubCategories = [
                ...new Set(matchingCategories.map(bc => bc.subCategory).filter(sc => sc != null) as string[])
              ];
              setAvailableSubCategories(uniqueSubCategories);
            }

            // Set sub-subcategory if it exists
            if (brandCategory.subSubCategory) {
              setSubSubCategory(brandCategory.subSubCategory);

              // Load sub-subcategories
              const matchingSubCategories = matchingCustomer.brandCategories.filter(
                bc =>
                  bc.brandName === style.brandName &&
                  bc.category === brandCategory.category &&
                  bc.subCategory === brandCategory.subCategory
              );
              const uniqueSubSubCategories = [
                ...new Set(matchingSubCategories.map(bc => bc.subSubCategory).filter(ssc => ssc != null) as string[])
              ];
              setAvailableSubSubCategories(uniqueSubSubCategories);
            }
          } else {
            // Fallback to old category field
            setCategory(style.specifications || '');
          }
        } else {
          // Fallback to old category field
          setCategory(style.specifications || '');
        }
      } else {
        // If customer not found, just set the names
        setCustomerName(style.customerName);
        setBrandName(style.brandName);
        setCategory(style.specifications || '');
      }

      // Populate order information
      if (style.orderQuantity && style.orderQuantity > 0) {
        setHasOrder(true);
        setOrderQuantity(style.orderQuantity.toString());
        setCostPerPiece(style.costPerPiece?.toString() || '');
        setOrderValue(style.orderValue?.toString() || '0');
        setOrderDate(style.orderDate || '');
        setDeliveryDate(style.deliveryDate || '');
      }

      // Populate fabrics
      if (style.components && style.components.length > 0) {
        setNumberOfComponents(style.components.length.toString());
        const allFabrics = style.components.flatMap(comp =>
          comp.fabrics?.map(fab => ({
            fabricName: fab.fabricName,
            greigeName: fab.greigeName || '',
            cadAverages: fab.cadData?.map(cad => ({
              fabricWidth: cad.availableWidth || 0,
              cadAverageMeters: cad.cadMeters,
              cadAverageYards: cad.cadYards,
              cadWastagePercent: cad.cadWastagePercent,
              markerEfficiency: cad.markerEfficiency,
              markerPlanFile: cad.markerPlanFile || '',
              isPreferred: cad.isPreferred || false,
              notes: cad.notes || ''
            })) || []
          })) || []
        );
        if (allFabrics.length > 0) {
          setFabrics(allFabrics);
        }
      }

      // Populate garment trims
      if (style.garmentTrims && style.garmentTrims.length > 0) {
        setGarmentTrims(style.garmentTrims.map(trim => ({
          trimName: trim.trimName,
          trimType: trim.trimType,
          quantityPerPiece: trim.quantityPerPiece.toString(),
          unit: trim.unit,
          supplier: trim.supplier || ''
        })));
      }

      // Populate value additions
      if (style.valueAdditions && style.valueAdditions.length > 0) {
        const additions: any = {
          embroidery: false,
          handwork: false,
          printing: false,
          washing: false
        };
        const details: any = {};

        style.valueAdditions.forEach(va => {
          const type = va.additionType.toLowerCase();
          additions[type] = true;
          details[type] = {
            description: va.description || '',
            estimatedCost: va.estimatedCost?.toString() || '',
            vendor: va.vendor || ''
          };
        });

        setValueAdditions(additions);
        setValueAdditionDetails(details);
      }

      // Populate packaging
      if (style.packaging && style.packaging.length > 0) {
        setPackagingTrims(style.packaging.map(pkg => ({
          itemName: pkg.itemName,
          itemType: pkg.itemType,
          specification: pkg.specification || '',
          quantityPerPack: pkg.quantityPerPack.toString()
        })));
      }

      // Populate size breakdown
      if (style.sizeBreakdown && style.sizeBreakdown.length > 0) {
        setHasSizeBreakdown(true);
        const sizes = style.sizeBreakdown.map(sb => sb.sizeName);
        setSelectedSizes(sizes);

        const breakdown: Record<string, string> = {};
        style.sizeBreakdown.forEach(sb => {
          breakdown[sb.sizeName] = sb.quantity.toString();
        });
        setSizeBreakdown(breakdown);
        setSizeInputMethod('absolute'); // In edit mode, show absolute values
      }

      // Populate SKU variants
      if (style.variants && style.variants.length > 0) {
        logDebug('Loading SKU variants:', style.variants.length);
        setSkuVariants(DEFAULT_SIZES.map(size => {
          const existingVariant = style.variants?.find(v => v.size === size);
          if (existingVariant) {
            return {
              size,
              sku: existingVariant.sku || '',
              barcode: existingVariant.barcode || '',
              isActive: true
            };
          }
          return {
            size,
            sku: '',
            barcode: '',
            isActive: false
          };
        }));
      }

    } catch (err: any) {
      logError('Error loading style:', err);
      alert(err.response?.data?.message || 'Failed to load style');
      navigate('/styles');
    } finally {
      setLoadingStyle(false);
    }
  };

  const handleAutoSave = async () => {
    try {
      // Only auto-save if we have minimum required data (styleCode)
      if (!styleCode || styleCode.trim() === '') {
        logDebug('Skipping auto-save: no style code yet');
        return;
      }

      setSaveStatus('saving');

      // Collect all form data
      const formData = {
        id: id, // Include ID if editing
        customerName: customerName || undefined,
        brandName: brandName || undefined,
        styleCode,
        styleName: styleName || undefined,
        category: category || undefined,
        numberOfComponents: parseInt(numberOfComponents) || 1,
        hasOrder,
        orderQuantity: hasOrder && orderQuantity ? parseInt(orderQuantity) : undefined,
        costPerPiece: hasOrder && costPerPiece ? parseFloat(costPerPiece) : undefined,
        orderValue: hasOrder && orderValue ? parseFloat(orderValue) : undefined,
        orderDate: hasOrder && orderDate ? orderDate : undefined,
        deliveryDate: hasOrder && deliveryDate ? deliveryDate : undefined,
        description: description || undefined,
        status: 'DRAFT', // Always save as draft
      };

      // Call the saveDraft service
      await styleService.saveDraft(formData);

      setSaveStatus('saved');
      logDebug('Draft auto-saved successfully');

      // Reset to idle after 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      logError('Failed to auto-save draft:', error);
      setSaveStatus('idle');
    }
  };

  // Add fabric field
  const addFabric = () => {
    logDebug('Adding new fabric. Current count:', fabrics.length);
    const newFabrics = [...fabrics, { fabricName: '', greigeName: '', cadAverages: [] }];
    setFabrics(newFabrics);
    logDebug('Fabrics after add:', newFabrics.length);
  };

  // Remove fabric field
  const removeFabric = (index: number) => {
    if (fabrics.length > 1) {
      const updated = fabrics.filter((_, i) => i !== index);
      setFabrics(updated);
    }
  };

  // Update fabric field (simplified - only greige name is user input)
  const updateFabric = (index: number, field: 'fabricName' | 'greigeName', value: string) => {
    const updated = [...fabrics];
    updated[index] = { ...updated[index], [field]: value };

    // If greige name is updated, use it as fabric name too
    if (field === 'greigeName') {
      updated[index].fabricName = value; // Auto-generate fabric name from greige name
    }

    setFabrics(updated);
  };

  // Update CAD averages for a fabric
  const updateFabricCadAverages = (index: number, cadAverages: any[]) => {
    const updated = [...fabrics];
    updated[index] = { ...updated[index], cadAverages };
    setFabrics(updated);
  };

  // SKU Variant handlers
  const handleGenerateSKUs = () => {
    if (!styleCode.trim()) {
      alert('Please enter a Style Code first');
      return;
    }

    const activeSizes = skuVariants.filter(v => v.isActive).map(v => v.size);
    if (activeSizes.length === 0) {
      alert('Please select at least one size');
      return;
    }

    const generatedMatrix = generateSKUMatrix(styleCode, activeSizes);

    // Update SKU variants, keeping isActive state and barcodes
    setSkuVariants(prevVariants =>
      prevVariants.map(variant => {
        const generated = generatedMatrix.find(g => g.size === variant.size);
        if (generated && variant.isActive) {
          return {
            ...variant,
            sku: generated.sku,
            // Keep existing barcode if user already entered one
            barcode: variant.barcode || ''
          };
        }
        return variant;
      })
    );
  };

  const handleToggleSize = (size: string) => {
    setSkuVariants(prev =>
      prev.map(v => v.size === size ? { ...v, isActive: !v.isActive, sku: !v.isActive ? '' : v.sku } : v)
    );
  };

  const handleUpdateSKU = (size: string, sku: string) => {
    setSkuVariants(prev =>
      prev.map(v => v.size === size ? { ...v, sku } : v)
    );
  };

  const handleUpdateBarcode = (size: string, barcode: string) => {
    setSkuVariants(prev =>
      prev.map(v => v.size === size ? { ...v, barcode } : v)
    );
  };

  // Auto-generate SKUs when style code changes
  useEffect(() => {
    if (styleCode.trim() && skuVariants.some(v => v.isActive)) {
      handleGenerateSKUs();
    }
  }, [styleCode]);

  // Garment Trims handlers
  const addGarmentTrim = () => {
    setGarmentTrims([...garmentTrims, {
      trimName: '',
      trimType: '',
      quantityPerPiece: '',
      unit: 'pcs',
      supplier: ''
    }]);
  };

  const removeGarmentTrim = (index: number) => {
    setGarmentTrims(garmentTrims.filter((_, i) => i !== index));
  };

  const updateGarmentTrim = (index: number, field: string, value: string) => {
    const updated = [...garmentTrims];
    updated[index] = { ...updated[index], [field]: value };
    setGarmentTrims(updated);
  };

  // Value Addition handlers
  const toggleValueAddition = (type: keyof typeof valueAdditions) => {
    setValueAdditions({ ...valueAdditions, [type]: !valueAdditions[type] });
    if (!valueAdditions[type]) {
      setValueAdditionDetails({
        ...valueAdditionDetails,
        [type]: { description: '', estimatedCost: '', vendor: '' }
      });
    }
  };

  const updateValueAdditionDetail = (type: string, field: string, value: string) => {
    setValueAdditionDetails({
      ...valueAdditionDetails,
      [type]: { ...valueAdditionDetails[type], [field]: value }
    });
  };

  // Packaging Trims handlers
  const addPackagingTrim = () => {
    setPackagingTrims([...packagingTrims, {
      itemName: '',
      itemType: '',
      specification: '',
      quantityPerPack: ''
    }]);
  };

  const removePackagingTrim = (index: number) => {
    setPackagingTrims(packagingTrims.filter((_, i) => i !== index));
  };

  const updatePackagingTrim = (index: number, field: string, value: string) => {
    const updated = [...packagingTrims];
    updated[index] = { ...updated[index], [field]: value };
    setPackagingTrims(updated);
  };

  // Image upload handlers
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.match(/^image\/(jpeg|jpg|png)$/)) {
        alert('Only JPG and PNG images are allowed');
        return;
      }
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
      }
      setImageFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  // Validate and submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!customerName.trim()) {
      alert('Buyer Name is required');
      return;
    }
    if (!brandName.trim()) {
      alert('Brand Name is required');
      return;
    }
    if (!styleCode.trim()) {
      alert('Style Code is required');
      return;
    }
    if (!category.trim()) {
      alert('Category is required');
      return;
    }



    try {
      setLoading(true);

      // Prepare components data with fabrics
      const numComponents = parseInt(numberOfComponents) || 1;
      const componentsData = [];

      // Distribute fabrics across components evenly
      const fabricsPerComponent = Math.ceil(fabrics.length / numComponents);

      for (let i = 0; i < numComponents; i++) {
        const componentFabrics = fabrics
          .slice(i * fabricsPerComponent, (i + 1) * fabricsPerComponent)
          .filter(f => f.greigeName.trim()) // Only include if greige name is provided
          .map(f => ({
            fabricName: f.greigeName.trim(), // Use greige name as fabric name
            fabricType: 'Greige', // Default fabric type
            greigeName: f.greigeName.trim(),
            cadAverages: f.cadAverages || [],
          }));

        componentsData.push({
          componentName: `Component ${i + 1}`,
          componentType: 'Main',
          sortOrder: i,
          fabrics: componentFabrics,
        });
      }

      // Prepare garment trims data
      const garmentTrimsData = garmentTrims
        .filter(trim => trim.trimName && trim.trimName.trim().length > 0)
        .map(trim => ({
          trimName: trim.trimName.trim(),
          trimType: trim.trimType?.trim() || 'Not specified',
          quantityPerPiece: parseFloat(trim.quantityPerPiece) || 0,
          unit: trim.unit?.trim() || 'pcs',
          supplier: trim.supplier?.trim() || null,
        }));

      // Prepare value additions data
      const valueAdditionsData = [];
      if (valueAdditions.embroidery) {
        valueAdditionsData.push({
          additionType: 'Embroidery',
          description: valueAdditionDetails.embroidery?.description?.trim() || null,
        });
      }
      if (valueAdditions.handwork) {
        valueAdditionsData.push({
          additionType: 'Handwork',
          description: valueAdditionDetails.handwork?.description?.trim() || null,
          type: valueAdditionDetails.handwork?.type?.trim() || null,
          numberOfItems: valueAdditionDetails.handwork?.numberOfItems || null,
        });
      }
      if (valueAdditions.dyeing) {
        valueAdditionsData.push({
          additionType: 'Dyeing',
          description: valueAdditionDetails.dyeing?.description?.trim() || null,
        });
      }
      if (valueAdditions.washing) {
        valueAdditionsData.push({
          additionType: 'Washing',
          description: valueAdditionDetails.washing?.description?.trim() || null,
        });
      }

      // Prepare packaging data
      const packagingData = packagingTrims
        .filter(pkg => pkg.itemName.trim())
        .map(pkg => ({
          itemName: pkg.itemName.trim(),
          itemType: pkg.itemType || 'polybag',
          specification: pkg.specification.trim() || null,
          quantityPerPack: pkg.quantityPerPack || '1',
        }));

      // Prepare size breakdown data
      const sizeBreakdownData = hasSizeBreakdown && selectedSizes.length > 0 ? {
        method: sizeInputMethod,
        sizes: selectedSizes.map(size => ({
          size: size,
          value: sizeBreakdown[size] || '0',
        })),
      } : undefined;

      // Prepare data for submission
      const styleData = {
        styleCode: styleCode.trim(),
        styleName: styleName.trim() || styleCode.trim(), // Use styleCode if styleName is empty
        customerName: customerName.trim(),
        brandName: brandName.trim(),
        brandCategoryId: selectedBrandCategoryId || undefined, // Save the brand category ID
        category: category.trim(), // Keep for backward compatibility
        description: description.trim() || undefined,
        season: undefined, // Can be added later if needed
        components: componentsData,
        processes: [], // Can be added later via edit
        garmentTrims: garmentTrimsData,
        valueAdditions: valueAdditionsData,
        packagingTrims: packagingData,
      };

      logDebug('FRONTEND: Submitting style data:', styleData);
      logDebug('FRONTEND: Components count:', componentsData.length);
      logDebug('FRONTEND: Garment trims count:', garmentTrimsData.length);
      logDebug('FRONTEND: Value additions count:', valueAdditionsData.length);
      logDebug('FRONTEND: Packaging count:', packagingData.length);

      let resultStyle;
      if (mode === 'edit' && id) {
        // Update existing style
        resultStyle = await styleService.updateStyle(id, styleData);

        // Upload image if one was selected
        if (imageFile) {
          try {
            await styleService.uploadStyleImage(id, imageFile);
            alert('Style and image updated successfully!');
          } catch (imgErr) {
            logError('Image upload failed:', imgErr);
            alert('Style updated but image upload failed.');
          }
        } else {
          alert('Style updated successfully!');
        }
      } else {
        // Create new style
        const createdStyle = await styleService.createStyle(styleData);
        resultStyle = createdStyle;
        const styleId = createdStyle.data.id;

        // Create SKU variants if any are active
        const activeVariants = skuVariants.filter(v => v.isActive && v.sku.trim());
        if (activeVariants.length > 0) {
          try {
            // Validate SKUs before sending
            const invalidSKUs = activeVariants.filter(v => !validateSKUFormat(v.sku));
            if (invalidSKUs.length > 0) {
              alert(`Invalid SKU format for sizes: ${invalidSKUs.map(v => v.size).join(', ')}`);
            } else {
              const duplicates = findDuplicateSKUs(activeVariants);
              if (duplicates.length > 0) {
                alert(`Duplicate SKUs found: ${duplicates.join(', ')}`);
              } else {
                await styleService.createStyleVariants(styleId, activeVariants);
                logDebug(`Created ${activeVariants.length} variants for style ${styleCode}`);
              }
            }
          } catch (variantErr) {
            logError('Variant creation failed:', variantErr);
            alert('Style created but variant creation failed. You can add variants later from the edit page.');
          }
        }

        // Upload image if one was selected
        if (imageFile && styleId) {
          try {
            await styleService.uploadStyleImage(styleId, imageFile);
            alert('Style, variants, and image uploaded successfully!');
          } catch (imgErr) {
            logError('Image upload failed:', imgErr);
            alert('Style and variants created but image upload failed. You can upload it later from the edit page.');
          }
        } else {
          alert(`Style created successfully with ${activeVariants.length} variant(s)!`);
        }
      }

      navigate('/styles');
    } catch (err: any) {
      logError('FRONTEND ERROR:', err);
      logError('Error response:', err.response);
      logError('Error message:', err.message);
      logError('Full error object:', JSON.stringify(err, null, 2));
      alert(err.response?.data?.message || `Failed to ${mode === 'edit' ? 'update' : 'create'} style`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
        {loadingStyle ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-gray-500">Loading style data...</div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Style Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="basic">Basic Info</TabsTrigger>
                    <TabsTrigger value="fabrics">Fabrics</TabsTrigger>
                    <TabsTrigger value="trims">Trims & Variants</TabsTrigger>
                    <TabsTrigger value="production">Production</TabsTrigger>
                    <TabsTrigger value="packaging">Packaging & Notes</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-6 mt-6">
                {/* Section 1: Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Basic Information</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Customer Name - DROPDOWN */}
                    <div>
                      <Label htmlFor="customerName">
                        Customer Name <span className="text-red-500">*</span>
                      </Label>
                      <Select value={selectedCustomerId} onValueChange={handleCustomerChange} required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name} ({customer.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {customers.length === 0 && (
                        <p className="text-xs text-gray-500 mt-1">Loading customers...</p>
                      )}
                    </div>

                    {/* Brand Name - DEPENDENT DROPDOWN */}
                    <div>
                      <Label htmlFor="brandName">
                        Brand Name <span className="text-red-500">*</span>
                      </Label>
                      {!selectedCustomerId ? (
                        <div className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                          Select customer first
                        </div>
                      ) : availableBrands.length > 0 ? (
                        <Select value={brandName} onValueChange={handleBrandChange} required>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select brand" />
                          </SelectTrigger>
                          <SelectContent
                            position="popper"
                            sideOffset={5}
                            className="max-h-[300px] overflow-y-auto z-50"
                          >
                            {availableBrands.map((brand, index) => {
                              logDebug(`Rendering brand ${index}:`, brand);
                              return (
                                <SelectItem
                                  key={`${brand}-${index}`}
                                  value={brand}
                                  className="cursor-pointer"
                                >
                                  {brand}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id="brandName"
                          value={brandName}
                          onChange={(e) => setBrandName(e.target.value)}
                          placeholder="Enter brand name (customer has no brands)"
                          required
                        />
                      )}
                      {selectedCustomerId && availableBrands.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">Customer has no brands. Manual entry allowed.</p>
                      )}
                    </div>

                    {/* Style Code - MANUAL ENTRY (Customer's Style Number) */}
                    <div>
                      <Label htmlFor="styleCode">
                        Customer Style Number <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="styleCode"
                        value={styleCode}
                        onChange={(e) => setStyleCode(e.target.value)}
                        placeholder="Enter customer's style number (e.g., ABC-123)"
                        required
                        maxLength={50}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter the style number provided by the customer
                      </p>
                    </div>

                    {/* Style Name - OPTIONAL */}
                    <div>
                      <Label htmlFor="styleName">
                        Style Name <span className="text-gray-400 text-sm">(Optional)</span>
                      </Label>
                      <Input
                        id="styleName"
                        value={styleName}
                        onChange={(e) => setStyleName(e.target.value)}
                        placeholder="Enter style name (optional)"
                      />
                    </div>

                    {/* Brand Category - DROPDOWN (Dynamic based on Brand) */}
                    <div>
                      <Label htmlFor="category">
                        Brand Category <span className="text-red-500">*</span>
                      </Label>
                      {!brandName ? (
                        <div className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                          Select brand first
                        </div>
                      ) : availableCategories.length > 0 ? (
                        <Select value={category} onValueChange={handleCategoryChange} required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCategories.map((cat, index) => (
                              <SelectItem key={`${cat}-${index}`} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-destructive">
                          No categories defined for this brand in Customer Master
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Brand categories are defined in Customer Master
                      </p>
                    </div>

                    {/* Sub Category - DROPDOWN (Dynamic based on Category) */}
                    {availableSubCategories.length > 0 && (
                      <div>
                        <Label htmlFor="subCategory">
                          Sub Category
                        </Label>
                        <Select value={subCategory} onValueChange={handleSubCategoryChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select sub category" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSubCategories.map((subCat, index) => (
                              <SelectItem key={`${subCat}-${index}`} value={subCat}>
                                {subCat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Sub Sub Category - DROPDOWN (Dynamic based on Sub Category) */}
                    {availableSubSubCategories.length > 0 && (
                      <div>
                        <Label htmlFor="subSubCategory">
                          Sub Sub Category
                        </Label>
                        <Select value={subSubCategory} onValueChange={handleSubSubCategoryChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select sub sub category" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSubSubCategories.map((ssCat, index) => (
                              <SelectItem key={`${ssCat}-${index}`} value={ssCat}>
                                {ssCat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Number of Components */}
                    <div>
                      <Label htmlFor="numberOfComponents">
                        Number of Components <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="numberOfComponents"
                        type="number"
                        min="1"
                        max="10"
                        value={numberOfComponents}
                        onChange={(e) => setNumberOfComponents(e.target.value)}
                        placeholder="Enter number of components"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        E.g., 1 for single piece, 2 for 2-pc set, 3 for 3-pc set
                      </p>
                    </div>
                  </div>

                  {/* Image Upload Section */}
                  <div className="mt-4">
                    <Label htmlFor="styleImage">
                      Style Image <span className="text-gray-400 text-sm">(Optional - JPG/PNG, max 5MB)</span>
                    </Label>
                    <div className="mt-2">
                      {!imagePreview ? (
                        <div className="flex items-center gap-4">
                          <Input
                            id="styleImage"
                            type="file"
                            accept="image/jpeg,image/jpg,image/png"
                            onChange={handleImageChange}
                            className="flex-1"
                          />
                        </div>
                      ) : (
                        <div className="flex items-start gap-4">
                          <div className="relative">
                            <img
                              src={imagePreview}
                              alt="Style preview"
                              className="w-32 h-32 object-cover rounded-lg border-2 border-gray-300"
                            />
                            <button
                              type="button"
                              onClick={removeImage}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                            >
                              ×
                            </button>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-gray-600">
                              <strong>File:</strong> {imageFile?.name}
                            </p>
                            <p className="text-sm text-gray-600">
                              <strong>Size:</strong> {((imageFile?.size || 0) / 1024).toFixed(2)} KB
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={removeImage}
                              className="mt-2 text-red-600 hover:text-red-700"
                            >
                              Remove Image
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                  </TabsContent>

                  <TabsContent value="fabrics" className="space-y-6 mt-6">
                {/* Section 3: Fabrics */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-lg font-semibold text-gray-700">Fabrics</h3>
                    <Button
                      type="button"
                      size="sm"
                      onClick={addFabric}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      + Add Fabric
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {fabrics.map((fabric, index) => (
                      <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-start gap-4">
                          <div className="flex-1">
                            {/* Greige Name - INPUT with suggestions (ONLY FIELD) */}
                            <div>
                              <Label htmlFor={`greigeName-${index}`}>
                                Greige Name (Count & Construction) {index + 1} <span className="text-red-500">*</span>
                              </Label>
                              <Input
                                id={`greigeName-${index}`}
                                value={fabric.greigeName}
                                onChange={(e) => updateFabric(index, 'greigeName', e.target.value)}
                                placeholder="e.g., 40x40/133x72, 30s Combed, 60x60 Cotton"
                                list={`greige-suggestions-${index}`}
                                required
                              />
                              <datalist id={`greige-suggestions-${index}`}>
                                {greigeOptions.map((greige) => (
                                  <option key={greige.id} value={greige.greigeName} />
                                ))}
                              </datalist>
                              <p className="text-xs text-gray-500 mt-1">
                                Specify count, construction, and fabric details. Fabric name will be auto-generated.
                              </p>
                            </div>

                            {/* CAD Averages Section - Show if greige name is filled */}
                            {fabric.greigeName && fabric.greigeName.trim() && (
                              <div className="mt-4 pt-4 border-t">
                                <CadAverageInput
                                  value={fabric.cadAverages}
                                  onChange={(cadAverages) => updateFabricCadAverages(index, cadAverages)}
                                  fabricName={fabric.greigeName}
                                />
                              </div>
                            )}
                          </div>

                          {fabrics.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeFabric(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                  </TabsContent>

                  <TabsContent value="trims" className="space-y-6 mt-6">
                {/* Section 4: Size & SKU Variants */}
                <div className="space-y-4">
                  <div className="border-b pb-2">
                    <h3 className="text-lg font-semibold text-gray-700">Size & SKU Variants</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Select sizes and auto-generate SKUs. Pattern: {styleCode || 'STYLE_CODE'}{'{'} SIZE{'}'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {/* Size selection with checkboxes - ALL pre-selected */}
                    <div>
                      <Label className="text-sm font-medium">Select Sizes</Label>
                      <div className="grid grid-cols-4 gap-3 mt-2">
                        {DEFAULT_SIZES.map((size) => {
                          const variant = skuVariants.find(v => v.size === size);
                          return (
                            <div key={size} className="flex items-center space-x-2">
                              <Checkbox
                                id={`size-${size}`}
                                checked={variant?.isActive ?? true}
                                onCheckedChange={() => handleToggleSize(size)}
                              />
                              <Label
                                htmlFor={`size-${size}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {size}
                              </Label>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Auto-generate button */}
                    <div>
                      <Button
                        type="button"
                        onClick={handleGenerateSKUs}
                        disabled={!styleCode.trim() || !skuVariants.some(v => v.isActive)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Generate SKUs
                      </Button>
                      <span className="ml-3 text-sm text-gray-500">
                        {skuVariants.filter(v => v.isActive).length} size(s) selected
                      </span>
                    </div>

                    {/* SKU Matrix Table */}
                    {skuVariants.some(v => v.isActive) && (
                      <div className="border rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Barcode (Optional)</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {skuVariants
                              .filter(v => v.isActive)
                              .map((variant) => (
                                <tr key={variant.size}>
                                  <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                    {variant.size}
                                  </td>
                                  <td className="px-4 py-2">
                                    <Input
                                      value={variant.sku}
                                      onChange={(e) => handleUpdateSKU(variant.size, e.target.value)}
                                      placeholder={`${styleCode || 'ABC123'}${variant.size}`}
                                      className="max-w-xs"
                                    />
                                  </td>
                                  <td className="px-4 py-2">
                                    <Input
                                      value={variant.barcode || ''}
                                      onChange={(e) => handleUpdateBarcode(variant.size, e.target.value)}
                                      placeholder="Optional"
                                      className="max-w-xs"
                                    />
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 5: Garment Trims */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-lg font-semibold text-gray-700">Garment Trims</h3>
                    <Button
                      type="button"
                      size="sm"
                      onClick={addGarmentTrim}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      + Add Trim
                    </Button>
                  </div>

                  {garmentTrims.length > 0 ? (
                    <div className="space-y-3">
                      {garmentTrims.map((trim, index) => (
                        <div key={index} className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Trim Name - INPUT with datalist */}
                            <div>
                              <Label>Trim Name *</Label>
                              <select
                                value={trim.trimName}
                                onChange={(e) => updateGarmentTrim(index, 'trimName', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                              >
                                <option value="">-- Select Trim --</option>
                                {trimMaterials.map((material) => (
                                  <option key={material.id} value={material.name}>
                                    {material.name} ({material.code})
                                  </option>
                                ))}
                              </select>
                              {trimMaterials.length === 0 && (
                                <p className="text-xs text-red-500 mt-1">
                                  No trim materials available. Please create trim materials first.
                                </p>
                              )}
                            </div>

                            {/* Trim Type */}
                            <div>
                              <Label>Trim Type</Label>
                              <Input
                                value={trim.trimType}
                                onChange={(e) => updateGarmentTrim(index, 'trimType', e.target.value)}
                                placeholder="e.g., Metal, Plastic, Shell"
                                list={`trim-type-suggestions-${index}`}
                              />
                              <datalist id={`trim-type-suggestions-${index}`}>
                                <option value="Metal" />
                                <option value="Plastic" />
                                <option value="Shell" />
                                <option value="Wooden" />
                                <option value="Resin" />
                              </datalist>
                            </div>

                            {/* Qty per Piece */}
                            <div>
                              <Label>Qty per Piece</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={trim.quantityPerPiece}
                                onChange={(e) => updateGarmentTrim(index, 'quantityPerPiece', e.target.value)}
                                placeholder="e.g., 5"
                              />
                            </div>

                            {/* Unit & Remove Button */}
                            <div className="flex items-end gap-2">
                              <div className="flex-1">
                                <Label>Unit</Label>
                                <select
                                  value={trim.unit}
                                  onChange={(e) => updateGarmentTrim(index, 'unit', e.target.value)}
                                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                                >
                                  <option value="pcs">Pieces</option>
                                  <option value="meters">Meters</option>
                                  <option value="yards">Yards</option>
                                  <option value="sets">Sets</option>
                                  <option value="dozen">Dozen</option>
                                </select>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeGarmentTrim(index)}
                                className="text-red-600 hover:text-red-700 h-9"
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No garment trims added yet. Click "+ Add Trim" to add.</p>
                  )}
                </div>
                  </TabsContent>

                  <TabsContent value="production" className="space-y-6 mt-6">
                {/* Section 6: Production Workflow */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Production Workflow</h3>

                  {/* Fabric Processing (Optional) */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-700">Fabric Processing (Optional)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={valueAdditions.dyeing}
                          onChange={() => toggleValueAddition('dyeing')}
                          className="rounded"
                        />
                        <span>Dyeing</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={valueAdditions.embroidery}
                          onChange={() => toggleValueAddition('embroidery')}
                          className="rounded"
                        />
                        <span>Embroidery on Fabric</span>
                      </label>
                    </div>

                    {/* Dyeing Details */}
                    {valueAdditions.dyeing && (
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h5 className="font-semibold text-gray-700 mb-3">Dyeing Details</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Color/Shade</Label>
                            <Input
                              value={valueAdditionDetails.dyeing?.description || ''}
                              onChange={(e) => updateValueAdditionDetail('dyeing', 'description', e.target.value)}
                              placeholder="e.g., Navy Blue, Custom Pantone 123C"
                            />
                          </div>
                          <div>
                            <Label>Vendor</Label>
                            <Input
                              value={valueAdditionDetails.dyeing?.vendor || ''}
                              onChange={(e) => updateValueAdditionDetail('dyeing', 'vendor', e.target.value)}
                              placeholder="Dyeing vendor name"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Embroidery Details */}
                    {valueAdditions.embroidery && (
                      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <h5 className="font-semibold text-gray-700 mb-3">Embroidery Details</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Location & Details</Label>
                            <Input
                              value={valueAdditionDetails.embroidery?.description || ''}
                              onChange={(e) => updateValueAdditionDetail('embroidery', 'description', e.target.value)}
                              placeholder="e.g., Front panel, 3-color logo"
                            />
                          </div>
                          <div>
                            <Label>Vendor</Label>
                            <Input
                              value={valueAdditionDetails.embroidery?.vendor || ''}
                              onChange={(e) => updateValueAdditionDetail('embroidery', 'vendor', e.target.value)}
                              placeholder="Embroidery vendor name"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Garment Construction (Mandatory) */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-700">Garment Construction</h4>
                    <p className="text-sm text-gray-500 italic">Cutting and Stitching are mandatory for all garments</p>
                  </div>

                  {/* Garment Finishing */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-700">Garment Finishing</h4>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={valueAdditions.washing}
                        onChange={() => toggleValueAddition('washing')}
                        className="rounded"
                      />
                      <span>Washing (Optional)</span>
                    </label>

                    {/* Washing Details */}
                    {valueAdditions.washing && (
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <h5 className="font-semibold text-gray-700 mb-3">Washing Details</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label>Wash Type</Label>
                            <Input
                              value={valueAdditionDetails.washing?.description || ''}
                              onChange={(e) => updateValueAdditionDetail('washing', 'description', e.target.value)}
                              placeholder="e.g., Stone wash, Enzyme wash, Acid wash"
                            />
                          </div>
                          <div>
                            <Label>Vendor</Label>
                            <Input
                              value={valueAdditionDetails.washing?.vendor || ''}
                              onChange={(e) => updateValueAdditionDetail('washing', 'vendor', e.target.value)}
                              placeholder="Washing vendor name"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                  </TabsContent>

                  <TabsContent value="packaging" className="space-y-6 mt-6">
                {/* Section 7: Packaging Trims */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-lg font-semibold text-gray-700">Packaging Requirements</h3>
                    <Button
                      type="button"
                      size="sm"
                      onClick={addPackagingTrim}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      + Add Packaging Item
                    </Button>
                  </div>

                  {packagingTrims.length > 0 ? (
                    <div className="space-y-3">
                      {packagingTrims.map((item, index) => (
                        <div key={index} className="p-4 bg-green-50 rounded-lg border border-green-200">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <Label>Item Name</Label>
                              <Input
                                value={item.itemName}
                                onChange={(e) => updatePackagingTrim(index, 'itemName', e.target.value)}
                                placeholder="Type or select item"
                                list={`packaging-list-${index}`}
                              />
                              <datalist id={`packaging-list-${index}`}>
                                <option value="Polybag" />
                                <option value="Hangtag" />
                                <option value="Price Tag" />
                                <option value="Barcode Sticker" />
                                <option value="Care Label Sticker" />
                                <option value="Inner Box" />
                                <option value="Master Carton" />
                                <option value="Tissue Paper" />
                                <option value="Ribbon/Band" />
                              </datalist>
                            </div>
                            <div>
                              <Label>Type</Label>
                              <select
                                value={item.itemType}
                                onChange={(e) => updatePackagingTrim(index, 'itemType', e.target.value)}
                                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                              >
                                <option value="">Select type</option>
                                <option value="polybag">Polybag</option>
                                <option value="hangtag">Hangtag</option>
                                <option value="pricetag">Price Tag</option>
                                <option value="sticker">Sticker/Label</option>
                                <option value="innerbox">Inner Box</option>
                                <option value="carton">Master Carton</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                            <div>
                              <Label>Specification</Label>
                              <Input
                                value={item.specification}
                                onChange={(e) => updatePackagingTrim(index, 'specification', e.target.value)}
                                placeholder="Size, material, etc."
                              />
                            </div>
                            <div className="flex items-end gap-2">
                              <div className="flex-1">
                                <Label>Qty per Pack</Label>
                                <Input
                                  type="number"
                                  value={item.quantityPerPack}
                                  onChange={(e) => updatePackagingTrim(index, 'quantityPerPack', e.target.value)}
                                  placeholder="e.g., 1, 5, 10"
                                />
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removePackagingTrim(index)}
                                className="text-red-600 hover:text-red-700"
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No packaging items added yet. Click "+ Add Packaging Item" to add.</p>
                  )}
                </div>

                {/* Section 8: Description/Remarks (at the end) */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Description / Remarks</h3>

                  <div>
                    <Label htmlFor="description">
                      Additional Notes <span className="text-gray-400 text-sm">(Optional)</span>
                    </Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Enter any additional notes, remarks, or special instructions..."
                      rows={4}
                    />
                  </div>
                </div>
                  </TabsContent>
                </Tabs>

                {/* Submit Buttons */}
                <div className="flex justify-end space-x-4 pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/styles')}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {loading ? (mode === 'edit' ? 'Updating...' : 'Creating...') : (mode === 'edit' ? 'Update Style' : 'Create Style')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
