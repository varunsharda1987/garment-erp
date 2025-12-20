import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { customerService } from '@/services/customer.service';
import { testingLabsService, testTemplatesService } from '@/services/testing.service';
import { productCategoryService } from '@/services/productCategory.service';
import { CustomerType, CustomerCategory, BusinessType, MarketType } from '@/types/customer.types';
import type { ProductCategory } from '@/types/productCategory.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { validators } from '@/lib/validators';
import { notify } from '@/lib/notify';
import { ChevronRight, ChevronDown, Package, Info } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CustomerAccessoryPresets } from '@/components/CustomerAccessoryPresets';
import { CustomerSizeCategoryPresets } from '@/components/CustomerSizeCategoryPresets';

const customerFormSchema = z.object({
  code: validators.required('Customer code'),
  name: validators.required('Company name'),
  brandNames: z.string().optional(),
  categories: z.string().optional(),
  type: z.enum(['BUYER']),
  category: z.enum(['DOMESTIC', 'EXPORT', 'LOCAL']),
  businessType: z.enum(['B2B', 'B2C']),
  market: z.enum(['INTERNATIONAL', 'DOMESTIC']),
  contactPerson: z.string().optional(),
  email: validators.email,
  phone: validators.phone,
  billingAddress: z.string().optional(),
  shippingAddress: z.string().optional(),
  gstNumber: validators.gst,
  creditLimit: z.string().optional(),
  creditDays: z.string().optional(),
  // Testing Requirements
  requiresFPT: z.boolean().optional(),
  requiresGPT: z.boolean().optional(),
  fptBlocksProduction: z.boolean().optional(),
  gptBlocksShipment: z.boolean().optional(),
  fptTemplateId: z.string().optional(),
  gptTemplateId: z.string().optional(),
  buyerApprovesGPT: z.boolean().optional(),
  defaultTestingLabId: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerFormSchema>;

interface CustomerFormProps {
  mode?: 'create' | 'edit';
}

export default function CustomerForm({ mode = 'create' }: CustomerFormProps) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isNewCustomer = mode === 'create' || !id;
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false); // Collapsible state for presets section
  const [sizePresetsExpanded, setSizePresetsExpanded] = useState(false); // Collapsible state for size category presets

  // Testing labs and templates
  const [testingLabs, setTestingLabs] = useState<Array<{ id: string; labCode: string; labName: string }>>([]);
  const [fptTemplates, setFptTemplates] = useState<Array<{ id: string; templateCode: string; templateName: string }>>([]);
  const [gptTemplates, setGptTemplates] = useState<Array<{ id: string; templateCode: string; templateName: string }>>([]);

  // Product category data
  const [mainCategories, setMainCategories] = useState<ProductCategory[]>([]);
  const [subCategoriesMap, setSubCategoriesMap] = useState<Record<string, ProductCategory[]>>({});
  const [subSubCategoriesMap, setSubSubCategoriesMap] = useState<Record<string, ProductCategory[]>>({});

  // New structure: array of {brandName, categories with cascading selection}
  interface BrandCategorySelection {
    level1Id: string;
    level2Id: string;
    level3Id: string;
    categoryName: string; // Full path like "Western Wear > T-Shirts"
    productCategoryId: string; // The final selected category ID
  }

  const [brandData, setBrandData] = useState<Array<{
    brandName: string;
    categories: BrandCategorySelection[];
  }>>([
    { brandName: '', categories: [{ level1Id: '', level2Id: '', level3Id: '', categoryName: '', productCategoryId: '' }] }
  ]);

  // GST Numbers structure
  const [gstNumbers, setGstNumbers] = useState<Array<{
    stateName: string;
    stateCode: string;
    gstNumber: string;
    billingAddress: string;
    isPrimary: boolean;
  }>>([{ stateName: '', stateCode: '', gstNumber: '', billingAddress: '', isPrimary: false }]);

  // Keep old format for backward compatibility
  const [brandNames, setBrandNames] = useState<string[]>(['']);
  const [brandCategories, setBrandCategories] = useState<string[]>(['']);
  const [categories, setCategories] = useState<string[]>(['']);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      type: CustomerType.BUYER,
      category: CustomerCategory.DOMESTIC,
      businessType: BusinessType.B2B,
      market: MarketType.DOMESTIC,
      // Testing defaults
      requiresFPT: false,
      requiresGPT: false,
      fptBlocksProduction: false,
      gptBlocksShipment: true,
      buyerApprovesGPT: false,
    },
  });

  // Watch testing requirement toggles
  const watchRequiresFPT = watch('requiresFPT', false);
  const watchRequiresGPT = watch('requiresGPT', false);

  // Watch businessType and market for code generation
  const watchBusinessType = watch('businessType', BusinessType.B2B);
  const watchMarket = watch('market', MarketType.DOMESTIC);

  // Load testing labs, templates, and product categories
  useEffect(() => {
    const loadTestingData = async () => {
      try {
        const [labsResponse, templatesResponse] = await Promise.all([
          testingLabsService.getAll({ isActive: true, limit: 100 }),
          testTemplatesService.getAll({ isActive: true, limit: 100 }),
        ]);

        setTestingLabs(labsResponse.data || []);

        // Separate FPT and GPT templates
        const templates = templatesResponse.data || [];
        setFptTemplates(templates.filter((t: any) => t.templateType === 'FPT'));
        setGptTemplates(templates.filter((t: any) => t.templateType === 'GPT'));
      } catch (error) {
        console.error('Failed to load testing data:', error);
      }
    };

    const loadProductCategories = async () => {
      try {
        const categories = await productCategoryService.getMainCategories();
        setMainCategories(categories);
      } catch (error) {
        console.error('Failed to load product categories:', error);
      }
    };

    loadTestingData();
    loadProductCategories();
  }, []);

  // Load sub-categories when level 1 is selected
  const loadSubCategories = async (parentId: string) => {
    if (!parentId || subCategoriesMap[parentId]) return;
    try {
      const children = await productCategoryService.getChildren(parentId);
      setSubCategoriesMap(prev => ({ ...prev, [parentId]: children }));
    } catch (error) {
      console.error('Failed to load sub-categories:', error);
    }
  };

  // Load sub-sub-categories when level 2 is selected
  const loadSubSubCategories = async (parentId: string) => {
    if (!parentId || subSubCategoriesMap[parentId]) return;
    try {
      const children = await productCategoryService.getChildren(parentId);
      setSubSubCategoriesMap(prev => ({ ...prev, [parentId]: children }));
    } catch (error) {
      console.error('Failed to load sub-sub-categories:', error);
    }
  };

  // Auto-generate customer code for new customers with format: CUST-{B2B/B2C}-{INT/DOM}-XXX
  useEffect(() => {
    if (isNewCustomer) {
      const generateCode = async () => {
        try {
          // Fetch all customers to get the next number
          const response = await customerService.getAllCustomers({ page: 1, limit: 1000 });
          const customers = response.data;

          // Filter customers with the same businessType and market
          const businessTypeCode = watchBusinessType;
          const marketCode = watchMarket === MarketType.INTERNATIONAL ? 'INT' : 'DOM';

          const prefix = `CUST-${businessTypeCode}-${marketCode}-`;
          const matchingCustomers = customers.filter(c => c.code.startsWith(prefix));

          let nextNumber = 1;
          if (matchingCustomers.length > 0) {
            // Extract numbers from existing codes and find the max
            const numbers = matchingCustomers
              .map(c => {
                const match = c.code.match(/CUST-[^-]+-[^-]+-(\d+)/);
                return match ? parseInt(match[1], 10) : 0;
              })
              .filter(n => !isNaN(n));

            nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
          }

          const formattedNumber = nextNumber.toString().padStart(3, '0');
          return `${prefix}${formattedNumber}`;
        } catch (error) {
          // Fallback to simple numbering
          const businessTypeCode = watchBusinessType;
          const marketCode = watchMarket === MarketType.INTERNATIONAL ? 'INT' : 'DOM';
          const randomNum = Math.floor(Math.random() * 999) + 1;
          const formattedNumber = randomNum.toString().padStart(3, '0');
          return `CUST-${businessTypeCode}-${marketCode}-${formattedNumber}`;
        }
      };

      generateCode().then(code => setValue('code', code));
    }
  }, [isNewCustomer, setValue, watchBusinessType, watchMarket]);

  // Load existing customer data for edit mode
  useEffect(() => {
    if (id && !isNewCustomer) {
      customerService.getCustomerById(id).then((customer: { code: string; name: string; brand_categories?: { brandName: string; category: string }[]; brandNames?: string; categories?: string; customer_gst_numbers?: { stateName?: string; stateCode?: string; gstNumber?: string; billingAddress?: string; isPrimary?: boolean }[]; gstNumber?: string; billingAddress?: string; shippingAddress?: string; contactPerson?: string; email?: string; phone?: string; creditLimit?: number; creditDays?: number; type?: string; category?: string; businessType?: string; market?: string; requiresFPT?: boolean; requiresGPT?: boolean; fptBlocksProduction?: boolean; gptBlocksShipment?: boolean; fptTemplateId?: string; gptTemplateId?: string; buyerApprovesGPT?: boolean; defaultTestingLabId?: string }) => {
        setValue('code', customer.code);
        setValue('name', customer.name);

        // Parse brand categories from new structure
        // Note: For existing customers with old format, categories are stored as text
        // For new selections, we use the cascading dropdown with productCategoryId
        if (customer.brand_categories && customer.brand_categories.length > 0) {
          // Group by brand name
          const grouped = customer.brand_categories.reduce((acc: Record<string, Array<{ category: string; productCategoryId?: string }>>, bc: { brandName: string; category: string; productCategoryId?: string }) => {
            if (!acc[bc.brandName]) {
              acc[bc.brandName] = [];
            }
            acc[bc.brandName].push({ category: bc.category, productCategoryId: bc.productCategoryId });
            return acc;
          }, {});

          const parsedBrandData = Object.keys(grouped).map(brandName => ({
            brandName,
            categories: grouped[brandName].map(c => ({
              level1Id: '',
              level2Id: '',
              level3Id: '',
              categoryName: c.category,
              productCategoryId: c.productCategoryId || ''
            }))
          }));

          setBrandData(parsedBrandData.length > 0 ? parsedBrandData : [{
            brandName: '',
            categories: [{ level1Id: '', level2Id: '', level3Id: '', categoryName: '', productCategoryId: '' }]
          }]);
        } else if (customer.brandNames) {
          // Fallback to old format (text-based categories)
          const brands = customer.brandNames.split('\n').filter((b: string) => b.trim());
          const cats = customer.categories ? customer.categories.split('\n').filter((c: string) => c.trim()) : [];

          const parsedBrandData = brands.map((brand: string, index: number) => ({
            brandName: brand,
            categories: cats[index] ?
              cats[index].split(',').map((c: string) => ({
                level1Id: '',
                level2Id: '',
                level3Id: '',
                categoryName: c.trim(),
                productCategoryId: ''
              })) :
              [{ level1Id: '', level2Id: '', level3Id: '', categoryName: '', productCategoryId: '' }]
          }));

          setBrandData(parsedBrandData.length > 0 ? parsedBrandData : [{
            brandName: '',
            categories: [{ level1Id: '', level2Id: '', level3Id: '', categoryName: '', productCategoryId: '' }]
          }]);
        }

        // Parse GST numbers from new structure
        if (customer.customer_gst_numbers && customer.customer_gst_numbers.length > 0) {
          const parsedGstNumbers = customer.customer_gst_numbers.map((gst: { stateName?: string; stateCode?: string; gstNumber?: string; billingAddress?: string; isPrimary?: boolean }) => ({
            stateName: gst.stateName || '',
            stateCode: gst.stateCode || '',
            gstNumber: gst.gstNumber || '',
            billingAddress: gst.billingAddress || '',
            isPrimary: gst.isPrimary || false
          }));
          setGstNumbers(parsedGstNumbers);
        } else if (customer.gstNumber) {
          // Fallback to old single GST format
          setGstNumbers([{
            stateName: '',
            stateCode: '',
            gstNumber: customer.gstNumber,
            billingAddress: customer.billingAddress || '',
            isPrimary: true
          }]);
        }

        setValue('type', customer.type);
        setValue('category', customer.category);
        setValue('businessType', customer.businessType || BusinessType.B2B);
        setValue('market', customer.market || MarketType.DOMESTIC);
        setValue('contactPerson', customer.contactPerson || '');
        setValue('email', customer.email || '');
        setValue('phone', customer.phone || '');
        setValue('billingAddress', customer.billingAddress || '');
        setValue('shippingAddress', customer.shippingAddress || '');
        setValue('gstNumber', customer.gstNumber || '');
        setValue('creditLimit', customer.creditLimit?.toString() || '');
        setValue('creditDays', customer.creditDays?.toString() || '');

        // Testing requirements
        setValue('requiresFPT', customer.requiresFPT || false);
        setValue('requiresGPT', customer.requiresGPT || false);
        setValue('fptBlocksProduction', customer.fptBlocksProduction || false);
        setValue('gptBlocksShipment', customer.gptBlocksShipment !== false); // Default true
        setValue('buyerApprovesGPT', customer.buyerApprovesGPT || false);
        setValue('fptTemplateId', customer.fptTemplateId || '');
        setValue('gptTemplateId', customer.gptTemplateId || '');
        setValue('defaultTestingLabId', customer.defaultTestingLabId || '');
      }).catch(err => {
        setSubmitError('Failed to load customer data');
      });
    }
  }, [id, isNewCustomer, setValue]);

  // New handlers for brand-category structure with cascading dropdowns
  const handleBrandNameChange = (brandIndex: number, value: string) => {
    const newBrandData = [...brandData];
    newBrandData[brandIndex].brandName = value;
    setBrandData(newBrandData);
  };

  // Build category name from selections
  const buildCategoryName = (level1Id: string, level2Id: string, level3Id: string): string => {
    const parts: string[] = [];
    const level1 = mainCategories.find(c => c.id === level1Id);
    if (level1) parts.push(level1.name);

    const level2 = subCategoriesMap[level1Id]?.find(c => c.id === level2Id);
    if (level2) parts.push(level2.name);

    const level3 = subSubCategoriesMap[level2Id]?.find(c => c.id === level3Id);
    if (level3) parts.push(level3.name);

    return parts.join(' > ');
  };

  // Determine the final category ID (deepest selected level)
  const getFinalCategoryId = (level1Id: string, level2Id: string, level3Id: string): string => {
    if (level3Id) return level3Id;
    if (level2Id) return level2Id;
    return level1Id;
  };

  const handleLevel1Change = async (brandIndex: number, categoryIndex: number, level1Id: string) => {
    const newBrandData = [...brandData];
    newBrandData[brandIndex].categories[categoryIndex] = {
      level1Id,
      level2Id: '',
      level3Id: '',
      categoryName: buildCategoryName(level1Id, '', ''),
      productCategoryId: getFinalCategoryId(level1Id, '', ''),
    };
    setBrandData(newBrandData);

    if (level1Id) {
      await loadSubCategories(level1Id);
    }
  };

  const handleLevel2Change = async (brandIndex: number, categoryIndex: number, level2Id: string) => {
    const newBrandData = [...brandData];
    const cat = newBrandData[brandIndex].categories[categoryIndex];
    newBrandData[brandIndex].categories[categoryIndex] = {
      ...cat,
      level2Id,
      level3Id: '',
      categoryName: buildCategoryName(cat.level1Id, level2Id, ''),
      productCategoryId: getFinalCategoryId(cat.level1Id, level2Id, ''),
    };
    setBrandData(newBrandData);

    if (level2Id) {
      await loadSubSubCategories(level2Id);
    }
  };

  const handleLevel3Change = (brandIndex: number, categoryIndex: number, level3Id: string) => {
    const newBrandData = [...brandData];
    const cat = newBrandData[brandIndex].categories[categoryIndex];
    newBrandData[brandIndex].categories[categoryIndex] = {
      ...cat,
      level3Id,
      categoryName: buildCategoryName(cat.level1Id, cat.level2Id, level3Id),
      productCategoryId: getFinalCategoryId(cat.level1Id, cat.level2Id, level3Id),
    };
    setBrandData(newBrandData);
  };

  const addBrand = () => {
    setBrandData([...brandData, {
      brandName: '',
      categories: [{ level1Id: '', level2Id: '', level3Id: '', categoryName: '', productCategoryId: '' }]
    }]);
  };

  const removeBrand = (brandIndex: number) => {
    if (brandData.length > 1) {
      setBrandData(brandData.filter((_, i) => i !== brandIndex));
    }
  };

  const addCategory = (brandIndex: number) => {
    const newBrandData = [...brandData];
    newBrandData[brandIndex].categories.push({ level1Id: '', level2Id: '', level3Id: '', categoryName: '', productCategoryId: '' });
    setBrandData(newBrandData);
  };

  const removeCategory = (brandIndex: number, categoryIndex: number) => {
    const newBrandData = [...brandData];
    if (newBrandData[brandIndex].categories.length > 1) {
      newBrandData[brandIndex].categories = newBrandData[brandIndex].categories.filter((_, i) => i !== categoryIndex);
      setBrandData(newBrandData);
    }
  };

  // GST Number handlers
  const handleGstChange = (index: number, field: keyof typeof gstNumbers[0], value: string | boolean) => {
    const newGstNumbers = [...gstNumbers];
    newGstNumbers[index] = { ...newGstNumbers[index], [field]: value };
    setGstNumbers(newGstNumbers);
  };

  const addGstNumber = () => {
    setGstNumbers([...gstNumbers, {
      stateName: '',
      stateCode: '',
      gstNumber: '',
      billingAddress: '',
      isPrimary: false
    }]);
  };

  const removeGstNumber = (index: number) => {
    if (gstNumbers.length > 1) {
      setGstNumbers(gstNumbers.filter((_, i) => i !== index));
    }
  };

  const onSubmit = async (data: CustomerFormData) => {
    try {
      setLoading(true);
      setSubmitError(null);

      // Prepare brand categories in new format with product category IDs
      const brandCategories = brandData
        .filter(bd => bd.brandName.trim())
        .map(bd => ({
          brandName: bd.brandName.trim(),
          categories: bd.categories
            .filter(c => c.productCategoryId)
            .map(c => c.categoryName),
          productCategoryIds: bd.categories
            .filter(c => c.productCategoryId)
            .map(c => c.productCategoryId)
        }))
        .filter(bd => bd.categories.length > 0);

      // Also prepare old format for backward compatibility
      const brandNamesString = brandData.map(bd => bd.brandName.trim()).filter(b => b).join('\n');
      const categoriesString = brandData
        .map(bd => bd.categories.map(c => c.categoryName).filter(n => n).join(', '))
        .join('\n');

      // Prepare GST numbers (filter out empty ones)
      const validGstNumbers = gstNumbers
        .filter(gst => gst.gstNumber.trim())
        .map(gst => ({
          stateName: gst.stateName.trim(),
          stateCode: gst.stateCode.trim(),
          gstNumber: gst.gstNumber.trim(),
          billingAddress: gst.billingAddress.trim() || undefined,
          isPrimary: gst.isPrimary
        }));

      const payload = {
        ...data,
        brandNames: brandNamesString,  // Old format
        categories: categoriesString,   // Old format
        brandCategories,                 // New format
        gstNumbers: validGstNumbers,     // New format for multiple GST
        creditLimit: data.creditLimit ? parseFloat(data.creditLimit) : undefined,
        creditDays: data.creditDays ? parseInt(data.creditDays) : undefined,
        // Testing requirements
        requiresFPT: data.requiresFPT || false,
        requiresGPT: data.requiresGPT || false,
        fptBlocksProduction: data.fptBlocksProduction || false,
        gptBlocksShipment: data.gptBlocksShipment !== false, // Default true
        buyerApprovesGPT: data.buyerApprovesGPT || false,
        fptTemplateId: data.fptTemplateId || undefined,
        gptTemplateId: data.gptTemplateId || undefined,
        defaultTestingLabId: data.defaultTestingLabId || undefined,
      };

      if (isNewCustomer) {
        await customerService.createCustomer(payload);
        notify.success('Customer created', {
          description: `${data.name} has been successfully created.`
        });
      } else if (id) {
        await customerService.updateCustomer(id, payload);
        notify.success('Customer updated', {
          description: `${data.name} has been successfully updated.`
        });
      }

      navigate('/customers', { replace: true });
    } catch (error: unknown) {
      const errorMessage = error.response?.data?.message || 'Failed to save customer';
      setSubmitError(errorMessage);
      notify.error('Error', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/customers')}>← Back to Customers</Button>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>{isNewCustomer ? 'Create New Customer' : 'Edit Customer'}</CardTitle>
          </CardHeader>
          <CardContent>
            {submitError && (
              <div className="p-4 mb-4 bg-red-50 text-red-800 rounded-md border border-red-200">
                {submitError}
              </div>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Company Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Company Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="code">Customer Code *</Label>
                    <Input id="code" {...register('code')} readOnly className="bg-gray-50" />
                    {errors.code && <p className="text-sm text-red-600 mt-1">{errors.code.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="businessType">Business Type *</Label>
                    <select
                      id="businessType"
                      {...register('businessType')}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="B2B">B2B (Business to Business)</option>
                      <option value="B2C">B2C (Business to Consumer)</option>
                    </select>
                    {errors.businessType && <p className="text-sm text-red-600 mt-1">{errors.businessType.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="market">Market *</Label>
                    <select
                      id="market"
                      {...register('market')}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="DOMESTIC">Domestic (DOM)</option>
                      <option value="INTERNATIONAL">International (INT)</option>
                    </select>
                    {errors.market && <p className="text-sm text-red-600 mt-1">{errors.market.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="category">Customer Category *</Label>
                    <select
                      id="category"
                      {...register('category')}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="DOMESTIC">Domestic</option>
                      <option value="EXPORT">Export</option>
                      <option value="LOCAL">Local</option>
                    </select>
                    {errors.category && <p className="text-sm text-red-600 mt-1">{errors.category.message}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="name">Company Name *</Label>
                    <Input id="name" {...register('name')} placeholder="Enter company name" />
                    {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <Label>Brand Names & Brand Categories</Label>
                    <div className="space-y-4">
                      {brandData.map((brand, brandIndex) => (
                        <div key={brandIndex} className="p-4 bg-gray-50 rounded-lg border border-gray-300">
                          {/* Brand Name */}
                          <div className="mb-3">
                            <div className="flex gap-2 items-center">
                              <div className="flex-1">
                                <Label className="text-sm font-semibold text-gray-700 mb-1">
                                  Brand Name {brandIndex + 1}
                                </Label>
                                <Input
                                  value={brand.brandName}
                                  onChange={(e) => handleBrandNameChange(brandIndex, e.target.value)}
                                  placeholder="e.g., Kasya"
                                  className="bg-white"
                                />
                              </div>
                              {brandData.length > 1 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => removeBrand(brandIndex)}
                                  className="px-3 text-red-600 hover:text-red-700 mt-6"
                                  title="Remove brand"
                                >
                                  ×
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Categories for this brand - Cascading Dropdowns */}
                          <div className="ml-4 space-y-3">
                            <Label className="text-xs font-medium text-gray-600">
                              Product Categories for {brand.brandName || 'this brand'}
                            </Label>
                            {brand.categories.map((category, catIndex) => (
                              <div key={catIndex} className="p-3 bg-white rounded border border-gray-200">
                                <div className="flex flex-wrap gap-2 items-center">
                                  {/* Level 1 - Main Category */}
                                  <select
                                    value={category.level1Id}
                                    onChange={(e) => handleLevel1Change(brandIndex, catIndex, e.target.value)}
                                    className="flex-1 min-w-[140px] border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  >
                                    <option value="">Select Main Category</option>
                                    {mainCategories.map((cat) => (
                                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                  </select>

                                  {/* Level 2 - Sub Category */}
                                  {category.level1Id && subCategoriesMap[category.level1Id]?.length > 0 && (
                                    <>
                                      <ChevronRight className="h-4 w-4 text-gray-400" />
                                      <select
                                        value={category.level2Id}
                                        onChange={(e) => handleLevel2Change(brandIndex, catIndex, e.target.value)}
                                        className="flex-1 min-w-[140px] border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      >
                                        <option value="">Select Sub-Category</option>
                                        {subCategoriesMap[category.level1Id]?.map((cat) => (
                                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                      </select>
                                    </>
                                  )}

                                  {/* Level 3 - Sub-Sub Category (for Kids Wear) */}
                                  {category.level2Id && subSubCategoriesMap[category.level2Id]?.length > 0 && (
                                    <>
                                      <ChevronRight className="h-4 w-4 text-gray-400" />
                                      <select
                                        value={category.level3Id}
                                        onChange={(e) => handleLevel3Change(brandIndex, catIndex, e.target.value)}
                                        className="flex-1 min-w-[140px] border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      >
                                        <option value="">Select Type</option>
                                        {subSubCategoriesMap[category.level2Id]?.map((cat) => (
                                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                      </select>
                                    </>
                                  )}

                                  {/* Action buttons */}
                                  <div className="flex gap-1 ml-auto">
                                    {brand.categories.length > 1 && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => removeCategory(brandIndex, catIndex)}
                                        className="px-2 py-1 h-8 text-red-600 hover:text-red-700"
                                        title="Remove category"
                                      >
                                        ×
                                      </Button>
                                    )}
                                    {catIndex === brand.categories.length - 1 && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => addCategory(brandIndex)}
                                        className="px-2 py-1 h-8 text-blue-600 hover:text-blue-700"
                                        title="Add another category"
                                      >
                                        +
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {/* Show selected path */}
                                {category.categoryName && (
                                  <div className="mt-2 text-xs text-gray-500">
                                    Selected: <span className="font-medium text-gray-700">{category.categoryName}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Add brand button at the end of last brand */}
                          {brandIndex === brandData.length - 1 && (
                            <div className="mt-3">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={addBrand}
                                className="w-full text-blue-600 hover:text-blue-700 border-dashed"
                              >
                                + Add Another Brand
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Add brands and their product categories. Use the cascading dropdowns to select categories at different levels (e.g., Western Wear → T-Shirts, or Kids Wear → Boys → Shirts).
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <Label>GST Numbers (State-wise)</Label>
                    <div className="space-y-3">
                      {gstNumbers.map((gst, index) => (
                        <div key={index} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-gray-600">State Name</Label>
                              <Input
                                value={gst.stateName}
                                onChange={(e) => handleGstChange(index, 'stateName', e.target.value)}
                                placeholder="e.g., Maharashtra, Gujarat"
                                className="bg-white"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-600">State Code (2 digits)</Label>
                              <Input
                                value={gst.stateCode}
                                onChange={(e) => handleGstChange(index, 'stateCode', e.target.value)}
                                placeholder="e.g., 27, 24"
                                maxLength={2}
                                className="bg-white"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-600">GST Number (15 characters)</Label>
                              <Input
                                value={gst.gstNumber}
                                onChange={(e) => handleGstChange(index, 'gstNumber', e.target.value)}
                                placeholder="e.g., 27AAAAA0000A1Z5"
                                maxLength={15}
                                className="bg-white"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-600">Billing Address (Optional)</Label>
                              <Input
                                value={gst.billingAddress}
                                onChange={(e) => handleGstChange(index, 'billingAddress', e.target.value)}
                                placeholder="State-specific billing address"
                                className="bg-white"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={gst.isPrimary}
                                onChange={(e) => handleGstChange(index, 'isPrimary', e.target.checked)}
                                className="rounded"
                              />
                              <span className="text-sm text-gray-700">Primary GST</span>
                            </label>
                            <div className="flex gap-2">
                              {gstNumbers.length > 1 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => removeGstNumber(index)}
                                  className="px-3 text-red-600 hover:text-red-700"
                                >
                                  × Remove
                                </Button>
                              )}
                              {index === gstNumbers.length - 1 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={addGstNumber}
                                  className="px-3 text-blue-600 hover:text-blue-700"
                                >
                                  + Add GST
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Add GST numbers for each state where the customer operates. Mark one as primary.
                    </p>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contactPerson">Contact Person</Label>
                    <Input id="contactPerson" {...register('contactPerson')} placeholder="Enter contact person name" />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone <span className="text-gray-500 text-sm">(Max 10 digits)</span></Label>
                    <Input id="phone" {...register('phone')} placeholder="Enter phone number" maxLength={10} />
                    {errors.phone && <p className="text-sm text-red-600 mt-1">{errors.phone.message}</p>}
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" {...register('email')} placeholder="Enter email address" />
                    {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>}
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Address Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="billingAddress">Billing Address</Label>
                    <Textarea
                      id="billingAddress"
                      {...register('billingAddress')}
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shippingAddress">Shipping Address</Label>
                    <Textarea
                      id="shippingAddress"
                      {...register('shippingAddress')}
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Credit Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Credit Terms</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="creditLimit">Credit Limit (₹)</Label>
                    <Input
                      id="creditLimit"
                      type="number"
                      step="0.01"
                      {...register('creditLimit')}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="creditDays">Credit Days</Label>
                    <Input
                      id="creditDays"
                      type="number"
                      {...register('creditDays')}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Testing Requirements (FPT/GPT) */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Testing Requirements (FPT/GPT)</h3>
                <p className="text-sm text-gray-500">Configure fabric and garment testing requirements for this customer.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* FPT Section */}
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <Label className="text-base font-medium">Fabric Physical Testing (FPT)</Label>
                        <p className="text-xs text-gray-500 mt-1">Enable FPT requirement for this customer</p>
                      </div>
                      <Switch
                        checked={watchRequiresFPT}
                        onCheckedChange={(checked) => setValue('requiresFPT', checked)}
                      />
                    </div>

                    {watchRequiresFPT && (
                      <div className="space-y-4 pt-2 border-t border-blue-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm">FPT Blocks Production</Label>
                            <p className="text-xs text-gray-500">Block production if FPT fails</p>
                          </div>
                          <Switch
                            checked={watch('fptBlocksProduction')}
                            onCheckedChange={(checked) => setValue('fptBlocksProduction', checked)}
                          />
                        </div>

                        <div>
                          <Label className="text-sm">FPT Template</Label>
                          <select
                            {...register('fptTemplateId')}
                            className="w-full mt-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select FPT Template</option>
                            {fptTemplates.map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.templateCode} - {template.templateName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* GPT Section */}
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <Label className="text-base font-medium">Garment Physical Testing (GPT)</Label>
                        <p className="text-xs text-gray-500 mt-1">Enable GPT requirement for this customer</p>
                      </div>
                      <Switch
                        checked={watchRequiresGPT}
                        onCheckedChange={(checked) => setValue('requiresGPT', checked)}
                      />
                    </div>

                    {watchRequiresGPT && (
                      <div className="space-y-4 pt-2 border-t border-green-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm">GPT Blocks Shipment</Label>
                            <p className="text-xs text-gray-500">Block shipment if GPT fails</p>
                          </div>
                          <Switch
                            checked={watch('gptBlocksShipment') !== false}
                            onCheckedChange={(checked) => setValue('gptBlocksShipment', checked)}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm">Buyer Approves GPT</Label>
                            <p className="text-xs text-gray-500">Require buyer approval for GPT</p>
                          </div>
                          <Switch
                            checked={watch('buyerApprovesGPT')}
                            onCheckedChange={(checked) => setValue('buyerApprovesGPT', checked)}
                          />
                        </div>

                        <div>
                          <Label className="text-sm">GPT Template</Label>
                          <select
                            {...register('gptTemplateId')}
                            className="w-full mt-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          >
                            <option value="">Select GPT Template</option>
                            {gptTemplates.map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.templateCode} - {template.templateName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Default Testing Lab */}
                {(watchRequiresFPT || watchRequiresGPT) && (
                  <div className="mt-4">
                    <Label htmlFor="defaultTestingLabId">Default Testing Lab</Label>
                    <select
                      {...register('defaultTestingLabId')}
                      className="w-full mt-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Default Testing Lab</option>
                      {testingLabs.map((lab) => (
                        <option key={lab.id} value={lab.id}>
                          {lab.labCode} - {lab.labName}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Default lab to be used for testing samples from this customer.
                    </p>
                  </div>
                )}
              </div>

              {/* Accessory Presets Section - Only in Edit Mode */}
              <div className="space-y-4">
                <Collapsible open={presetsOpen} onOpenChange={setPresetsOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center justify-between w-full p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-gray-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Accessory Presets</h3>
                      </div>
                      <ChevronDown className={`h-5 w-5 text-gray-500 transition-transform ${presetsOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    {isNewCustomer ? (
                      <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-3">
                          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                          <div>
                            <p className="font-medium text-blue-900">Save customer first</p>
                            <p className="text-sm text-blue-700 mt-1">
                              Accessory presets can be configured after the customer is created.
                              These presets define standard labels, packaging, and other accessories
                              that will be auto-populated when creating styles for this customer.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <CustomerAccessoryPresets
                        customerId={id!}
                        customerName={watch('name') || 'this customer'}
                      />
                    )}
                  </CollapsibleContent>
                </Collapsible>

                {/* Size Category Presets Section (Edit Mode Only) */}
                <Collapsible
                  open={sizePresetsExpanded}
                  onOpenChange={setSizePresetsExpanded}
                  className="border rounded-lg"
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-gray-50">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-blue-600" />
                      <div className="text-left">
                        <h3 className="font-semibold">Size Category Presets</h3>
                        <p className="text-sm text-gray-500">
                          Define reusable size templates for this customer
                        </p>
                      </div>
                    </div>
                    {sizePresetsExpanded ? (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-500" />
                    )}
                  </CollapsibleTrigger>

                  <CollapsibleContent className="p-4 pt-0">
                    {!id ? (
                      <div className="text-center py-8 text-gray-500">
                        <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p className="font-medium">Save customer first</p>
                        <p className="text-sm mt-1">
                          Size category presets can be managed after creating the customer
                        </p>
                      </div>
                    ) : (
                      <CustomerSizeCategoryPresets
                        customerId={id!}
                        customerName={watch('name') || 'this customer'}
                      />
                    )}
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Form Actions */}
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate('/customers')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : isNewCustomer ? 'Create Customer' : 'Update Customer'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
