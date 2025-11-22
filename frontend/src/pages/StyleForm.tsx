import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { styleService } from '@/services/style.service';
import { customerService } from '@/services/customer.service';
import { getAllMaterials } from '@/services/material.service';
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
import { CadAverageInput } from '@/components/CadAverageInput';
import type { Style } from '@/types/style.types';
import type { Customer } from '@/types/customer.types';
import type { Material } from '@/types/material.types';
import { logDebug, logError } from '@/lib/logger';

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

  // Customer/Buyer data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);

  // Materials data for dropdowns
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);
  const [fabricMaterials, setFabricMaterials] = useState<Material[]>([]);
  const [trimMaterials, setTrimMaterials] = useState<Material[]>([]);

  // Basic Information (in order of appearance)
  const [buyerName, setBuyerName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [styleCode, setStyleCode] = useState('');
  const [styleName, setStyleName] = useState(''); // Optional
  const [category, setCategory] = useState('');
  const [numberOfComponents, setNumberOfComponents] = useState('1');

  // Category options
  const categoryOptions = [
    { value: 'MENS_WEAR', label: "Men's Wear" },
    { value: 'WOMENS_WEAR', label: "Women's Wear" },
    { value: 'KIDS_WEAR', label: "Kids Wear" },
    { value: 'WESTERN_WEAR', label: 'Western Wear' },
    { value: 'ETHNIC_WEAR', label: 'Ethnic Wear' },
    { value: 'CASUAL_WEAR', label: 'Casual Wear' },
    { value: 'FORMAL_WEAR', label: 'Formal Wear' },
    { value: 'SPORTS_WEAR', label: 'Sports Wear' },
  ];

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

  // Garment Trims
  const [garmentTrims, setGarmentTrims] = useState<Array<{
    trimName: string;
    trimType: string;
    quantityPerPiece: string;
    unit: string;
    supplier: string;
  }>>([]);

  // Value Addition
  const [valueAdditions, setValueAdditions] = useState<{
    embroidery: boolean;
    handwork: boolean;
    dyeing: boolean;
    washing: boolean;
  }>({
    embroidery: false,
    handwork: false,
    dyeing: false,
    washing: false,
  });
  const [valueAdditionDetails, setValueAdditionDetails] = useState<Record<string, {
    description: string;
    type?: string;       // For handwork type
    numberOfItems?: string;  // For handwork number of items
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

  // Fetch customers and materials on mount
  useEffect(() => {
    fetchCustomers();
    fetchMaterials();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await customerService.getAllCustomers({ limit: 1000 });
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

  // Handle customer selection and populate brands
  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const selectedCustomer = customers.find(c => c.id === customerId);
    if (selectedCustomer) {
      setBuyerName(selectedCustomer.name);

      // Parse brandNames (comma-separated string) into array
      if (selectedCustomer.brandNames) {
        const brands = selectedCustomer.brandNames.split(',').map(b => b.trim()).filter(b => b);
        setAvailableBrands(brands);
      } else {
        setAvailableBrands([]);
      }

      // Reset brand selection when customer changes
      setBrandName('');
    }
  };

  // Auto-save functionality (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (buyerName || brandName || styleCode) {
        handleAutoSave();
      }
    }, 2000); // Auto-save after 2 seconds of inactivity

    return () => clearTimeout(timer);
  }, [buyerName, brandName, styleCode, styleName, category, numberOfComponents,
    hasOrder, orderQuantity, costPerPiece, orderDate, deliveryDate, fabrics, description]);

  // Load style data in edit mode
  useEffect(() => {
    if (mode === 'edit' && id) {
      loadStyleData(id);
    }
  }, [mode, id]);

  const loadStyleData = async (styleId: string) => {
    try {
      setLoadingStyle(true);
      const style: Style = await styleService.getStyleById(styleId);

      // Populate basic info
      setBuyerName(style.buyerName);
      setBrandName(style.brandName);
      setStyleCode(style.styleCode);
      setStyleName(style.styleName || '');
      setCategory(style.specifications || ''); // specifications field stores category
      setDescription(style.description || '');


      // Populate fabrics
      if (style.components && style.components.length > 0) {
        setNumberOfComponents(style.components.length.toString());
        const allFabrics = style.components.flatMap(comp =>
          comp.fabrics?.map(fab => ({
            fabricName: fab.fabricName,
            greigeName: fab.greigeName || ''
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

    } catch (err: any) {
      logError('Error loading style:', err);
      alert(err.response?.data?.message || 'Failed to load style');
      navigate('/styles');
    } finally {
      setLoadingStyle(false);
    }
  };

  const handleAutoSave = () => {
    // For now, just show saving status
    // In future, this can save draft to localStorage or backend
    setSaveStatus('saving');
    setTimeout(() => setSaveStatus('saved'), 500);
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  // Add fabric field
  const addFabric = () => {
    setFabrics([...fabrics, { fabricName: '', greigeName: '', cadAverages: [] }]);
  };

  // Remove fabric field
  const removeFabric = (index: number) => {
    if (fabrics.length > 1) {
      const updated = fabrics.filter((_, i) => i !== index);
      setFabrics(updated);
    }
  };

  // Update fabric field
  const updateFabric = (index: number, field: 'fabricName' | 'greigeName', value: string) => {
    const updated = [...fabrics];

    // If fabric name is being updated, auto-populate greige name from material's categoryData
    if (field === 'fabricName') {
      const selectedMaterial = fabricMaterials.find(m => m.name === value);
      if (selectedMaterial && selectedMaterial.categoryData) {
        const { count, construction } = selectedMaterial.categoryData as any;
        if (count && construction) {
          // Auto-populate greige name with count and construction
          updated[index] = {
            ...updated[index],
            fabricName: value,
            greigeName: `${count} / ${construction}`
          };
        } else {
          updated[index] = { ...updated[index], [field]: value };
        }
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }

    setFabrics(updated);
  };

  // Update CAD averages for a fabric
  const updateFabricCadAverages = (index: number, cadAverages: any[]) => {
    const updated = [...fabrics];
    updated[index] = { ...updated[index], cadAverages };
    setFabrics(updated);
  };



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
    if (!buyerName.trim()) {
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
          .filter(f => f.fabricName.trim() || f.greigeName.trim()) // Only include if at least one field has value
          .map(f => ({
            fabricName: f.fabricName.trim() || 'Not specified',
            fabricType: f.fabricName.trim() || 'Cotton', // Default to Cotton if not specified
            greigeName: f.greigeName.trim() || null,
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
        buyerName: buyerName.trim(),
        brandName: brandName.trim(),
        category: category.trim(),
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

        // Upload image if one was selected
        if (imageFile && createdStyle.data.id) {
          try {
            await styleService.uploadStyleImage(createdStyle.data.id, imageFile);
            alert('Style and image uploaded successfully!');
          } catch (imgErr) {
            logError('Image upload failed:', imgErr);
            alert('Style created but image upload failed. You can upload it later from the edit page.');
          }
        } else {
          alert('Style created successfully!');
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
                {/* Section 1: Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Basic Information</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Buyer Name - DROPDOWN */}
                    <div>
                      <Label htmlFor="buyerName">
                        Buyer Name <span className="text-red-500">*</span>
                      </Label>
                      <Select value={selectedCustomerId} onValueChange={handleCustomerChange} required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select buyer" />
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
                          Select buyer first
                        </div>
                      ) : availableBrands.length > 0 ? (
                        <Select value={brandName} onValueChange={setBrandName} required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select brand" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableBrands.map((brand) => (
                              <SelectItem key={brand} value={brand}>
                                {brand}
                              </SelectItem>
                            ))}
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

                    {/* Style Code - MANUAL ENTRY (Buyer's Style Number) */}
                    <div>
                      <Label htmlFor="styleCode">
                        Buyer Style Number <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="styleCode"
                        value={styleCode}
                        onChange={(e) => setStyleCode(e.target.value)}
                        placeholder="Enter buyer's style number (e.g., ABC-123)"
                        required
                        maxLength={50}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Enter the style number provided by the buyer
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

                    {/* Category - DROPDOWN */}
                    <div>
                      <Label htmlFor="category">
                        Category <span className="text-red-500">*</span>
                      </Label>
                      <Select value={category} onValueChange={setCategory} required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categoryOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

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
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Fabric Name - SELECT dropdown with search */}
                            <div>
                              <Label htmlFor={`fabricName-${index}`}>
                                Fabric Name {index + 1} *
                              </Label>
                              <select
                                id={`fabricName-${index}`}
                                value={fabric.fabricName}
                                onChange={(e) => updateFabric(index, 'fabricName', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                              >
                                <option value="">-- Select Fabric --</option>
                                {fabricMaterials.map((material) => (
                                  <option key={material.id} value={material.name}>
                                    {material.name} ({material.code})
                                  </option>
                                ))}
                              </select>
                              {fabricMaterials.length === 0 && (
                                <p className="text-xs text-red-500 mt-1">
                                  No fabric materials available. Please create fabric materials first.
                                </p>
                              )}
                              {fabricMaterials.length > 0 && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {fabricMaterials.length} fabric(s) available
                                </p>
                              )}
                            </div>

                            {/* Greige Name - INPUT with suggestions */}
                            <div>
                              <Label htmlFor={`greigeName-${index}`}>
                                Greige Name (Count & Construction)
                              </Label>
                              <Input
                                id={`greigeName-${index}`}
                                value={fabric.greigeName}
                                onChange={(e) => updateFabric(index, 'greigeName', e.target.value)}
                                placeholder="e.g., 40x40/133x72, 30s Combed"
                                list={`greige-suggestions-${index}`}
                              />
                              <datalist id={`greige-suggestions-${index}`}>
                                <option value="40x40/133x72" />
                                <option value="30s Combed" />
                                <option value="40s Combed" />
                                <option value="60x60/90x88" />
                              </datalist>
                              <p className="text-xs text-gray-500 mt-1">
                                Specify count, construction, and other technical details
                              </p>
                            </div>
                          </div>

                          {/* CAD Averages Section */}
                          {fabric.fabricName && (
                            <div className="mt-4 pt-4 border-t">
                              <CadAverageInput
                                value={fabric.cadAverages}
                                onChange={(cadAverages) => updateFabricCadAverages(index, cadAverages)}
                                fabricName={fabric.fabricName}
                              />
                            </div>
                          )}

                          {fabrics.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeFabric(index)}
                              className="mt-6 text-red-600 hover:text-red-700"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
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

                {/* Section 6: Value Addition */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Value Addition</h3>

                  <div className="space-y-4">
                    {/* Checkboxes for value additions */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={valueAdditions.embroidery}
                          onChange={() => toggleValueAddition('embroidery')}
                          className="rounded"
                        />
                        <span>Embroidery</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={valueAdditions.handwork}
                          onChange={() => toggleValueAddition('handwork')}
                          className="rounded"
                        />
                        <span>Handwork</span>
                      </label>
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
                          checked={valueAdditions.washing}
                          onChange={() => toggleValueAddition('washing')}
                          className="rounded"
                        />
                        <span>Washing/Finishing</span>
                      </label>
                    </div>

                    {/* Details for selected value additions */}
                    {Object.entries(valueAdditions).map(([type, isSelected]) => (
                      isSelected && (
                        <div key={type} className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                          <h4 className="font-semibold text-gray-700 mb-3 capitalize">{type} Details</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <Label>Description</Label>
                              <Input
                                value={valueAdditionDetails[type]?.description || ''}
                                onChange={(e) => updateValueAdditionDetail(type, 'description', e.target.value)}
                                placeholder="e.g., Location, color count, stitch count"
                              />
                            </div>
                            {type === 'handwork' && (
                              <>
                                <div>
                                  <Label>Type</Label>
                                  <Input
                                    value={valueAdditionDetails[type]?.type || ''}
                                    onChange={(e) => updateValueAdditionDetail(type, 'type', e.target.value)}
                                    placeholder="e.g., Beading, Sequins, Smocking"
                                  />
                                </div>
                                <div>
                                  <Label>Number of Items</Label>
                                  <Input
                                    type="number"
                                    value={valueAdditionDetails[type]?.numberOfItems || ''}
                                    onChange={(e) => updateValueAdditionDetail(type, 'numberOfItems', e.target.value)}
                                    placeholder="e.g., 50 beads, 100 sequins"
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </div>

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
