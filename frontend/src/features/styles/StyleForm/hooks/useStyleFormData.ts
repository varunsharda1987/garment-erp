/**
 * useStyleFormData Hook
 * Handles data loading and saving for the StyleForm
 */

import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { notify } from '../../../../lib/notify';
import { generateId } from '../../../../lib/utils';
import { useStyleForm } from '../StyleFormContext';
import { styleService } from '../../../../services/style.service';
import { customerService } from '../../../../services/customer.service';
import { getAllComponentMasters, getCategories } from '../../../../services/componentMaster.service';
import type { CADStatus, FabricEntry, ProcessType } from '../types';
import type { BrandCategory } from '../../../../types/customer.types';
import type { StyleFormState } from '../StyleFormContext';
import type { MaterialType, MaterialUsageCategory } from '../../../../types/style-material-bom.types';

export function useStyleFormData() {
  const navigate = useNavigate();
  const { state, dispatch, setLoading } = useStyleForm();

  const {
    isEditMode,
    styleId,
    customers,
    componentMasters,
    selectedCustomerId,
    brandName,
    styleCode,
    styleName,
    customerName,
    brandCategoryId,
    category,
    season,
    description,
    numberOfComponents,
    costPrice,
    sellingPrice,
    expectedOrderQty,
    remarks,
    hsnCode,
    productTaxRule,
    bulletPoints,
    accountingSKU,
    accountingUnit,
    imageUrl,
    selectedComponents,
    skuVariants,
    fabrics,
    materialBOM,
    accessories,
    processes,
    selectedAccessoryPresetId,
    loading,
  } = state;

  // Load customers on mount
  const loadCustomers = useCallback(async () => {
    try {
      // Reduced from 1000 to 100 for performance
      const response = await customerService.getAllCustomers({ limit: 100 });
      dispatch({ type: 'SET_CUSTOMERS', payload: response.data });
    } catch (error) {
      console.error('Failed to load customers:', error);
      notify.error('Failed to load customers');
    }
  }, [dispatch]);

  // Load component masters on mount
  const loadComponentMasters = useCallback(async () => {
    try {
      const [mastersResponse, categoriesResponse] = await Promise.all([
        // Reduced from 1000 to 100 for performance
        getAllComponentMasters({ activeOnly: true, limit: 100 }),
        getCategories()
      ]);
      dispatch({
        type: 'SET_COMPONENT_MASTERS',
        payload: { masters: mastersResponse.data, categories: categoriesResponse }
      });
    } catch (error) {
      console.error('Failed to load component masters:', error);
      notify.error('Failed to load component masters');
    }
  }, [dispatch]);

  // Load style data in edit mode
  const loadStyleData = useCallback(async (id: string) => {
    try {
      setLoading(true);
      // Style API response may include additional fields not in the base type
      const styleBase = await styleService.getStyleById(id);
      // Use type assertion for extended API response fields
      const style = styleBase as typeof styleBase & {
        category?: string;
        costPrice?: string;
        sellingPrice?: string;
        expectedOrderQty?: string;
        hsnCode?: string;
        productTaxRule?: string;
        bulletPoints?: string;
        accountingSKU?: string;
        accountingUnit?: string;
        styleVariants?: unknown[];
        styleSkuVariants?: unknown[];
        skuVariants?: unknown[];
        styleFabricsFlat?: unknown[];
        fabrics?: unknown[];
        accessories?: unknown[];
        styleProcesses?: unknown[];
      };

      // Prepare state update payload
      const payload: Partial<StyleFormState> = {
        styleCode: style.styleCode,
        styleName: style.styleName || '',
        description: style.description || '',
        category: style.category || style.brandCategories?.category || '',
        brandCategoryId: style.brandCategoryId || '',
        season: style.season || '',
        costPrice: style.costPrice ? Number(style.costPrice) : '',
        sellingPrice: style.sellingPrice ? Number(style.sellingPrice) : '',
        expectedOrderQty: style.expectedOrderQty ? Number(style.expectedOrderQty) : '',
        remarks: style.specifications || '',
        hsnCode: style.hsnCode || '',
        productTaxRule: style.productTaxRule || '',
        bulletPoints: style.bulletPoints || '',
        accountingSKU: style.accountingSKU || '',
        accountingUnit: style.accountingUnit || '',
        imageUrl: style.imageUrl || '',
        numberOfComponents: style.numberOfComponents || 1,
      };

      // Find and set customer
      const matchingCustomer = customers.find(c => c.name === style.customerName);
      if (matchingCustomer) {
        payload.selectedCustomerId = matchingCustomer.id;
        payload.customerName = matchingCustomer.name;
        payload.brandName = style.brandName || '';

        // Set available brands
        if (matchingCustomer.brandCategories && matchingCustomer.brandCategories.length > 0) {
          const uniqueBrands = [...new Set(matchingCustomer.brandCategories.map((bc: BrandCategory) => bc.brandName))];
          payload.availableBrands = uniqueBrands;

          // Set available categories for brand
          if (style.brandName && matchingCustomer.brandCategories) {
            const brandCategories = matchingCustomer.brandCategories.filter(
              (bc: BrandCategory) => bc.brandName === style.brandName
            );
            payload.availableCategories = brandCategories;
          }
        }
      }

      // Load SKU variants
      const skuVariantsData = style.styleVariants || style.styleSkuVariants || style.skuVariants || [];
      if (skuVariantsData.length > 0) {
        payload.skuVariants = (skuVariantsData as Array<{ sizeName?: string; size?: string; sku: string; barcode?: string; accountingSKU?: string; isActive?: boolean }>).map((sku) => ({
          size: sku.sizeName || sku.size || '',
          sku: sku.sku,
          barcode: sku.barcode || '',
          accountingSKU: sku.accountingSKU || '',
          isActive: sku.isActive !== false
        }));
      }

      // Load fabrics
      const fabricsData = style.styleFabricsFlat || style.fabrics || [];
      if (fabricsData.length > 0) {
        payload.fabrics = (fabricsData as Array<{ id?: string; componentName?: string; genericGreigeName?: string; fabricFinishType?: string; estimatedConsumption?: number; unit?: string; notes?: string }>).map((sf) => ({
          id: sf.id || generateId(),
          componentName: sf.componentName || '',
          genericGreigeName: sf.genericGreigeName || '',
          fabricFinishType: (sf.fabricFinishType || '') as FabricEntry['fabricFinishType'],
          estimatedConsumption: sf.estimatedConsumption || 0,
          unit: (sf.unit || 'METER') as FabricEntry['unit'],
          notes: sf.notes || ''
        }));
      }

      // Load material BOM (trims)
      const styleMaterialBomData = style.styleMaterialBom || [];
      if (styleMaterialBomData.length > 0) {
        type BOMItem = { materialId: string; material?: { name?: string; code?: string; type?: string }; estimatedConsumption?: number; unit?: string; notes?: string; usageCategory?: string };
        payload.materialBOM = (styleMaterialBomData as BOMItem[])
          .filter((bom) => bom.usageCategory === 'GARMENT_TRIM')
          .map((bom) => ({
            materialId: bom.materialId,
            materialName: bom.material?.name || '',
            materialCode: bom.material?.code || '',
            materialType: (bom.material?.type || 'THREAD') as MaterialType,
            quantityPerGarment: bom.estimatedConsumption || 0,
            unit: bom.unit || 'PCS',
            unitPrice: 0,
            usageCategory: 'GARMENT_TRIM' as MaterialUsageCategory,
            componentName: ''
          }));

        // Load accessories
        payload.accessories = (styleMaterialBomData as BOMItem[])
          .filter((bom) => bom.usageCategory === 'PACKAGING')
          .map((bom) => ({
            materialId: bom.materialId,
            materialName: bom.material?.name || '',
            materialCode: bom.material?.code || '',
            materialType: (bom.material?.type || 'PACKAGING') as MaterialType,
            quantityPerGarment: bom.estimatedConsumption || 0,
            unit: bom.unit || 'PCS',
            unitPrice: 0,
            usageCategory: 'PACKAGING' as MaterialUsageCategory,
            componentName: ''
          }));
      }

      // Load processes
      const processesData = style.processes || [];
      if (processesData.length > 0) {
        type ProcessItem = { processType: string; description?: string; vendor?: string; estimatedCost?: number; isRequired: boolean };
        payload.processes = (processesData as ProcessItem[]).map((sp) => ({
          processType: sp.processType as ProcessType,
          description: sp.description || '',
          vendor: sp.vendor || '',
          estimatedCost: sp.estimatedCost || 0,
          isRequired: sp.isRequired
        }));
      }

      // Load components
      if (style.components?.length > 0) {
        payload.selectedComponents = style.components.map((sc: { componentName?: string; componentType?: string }) => {
          const matchingMaster = componentMasters.find(cm => cm.name === sc.componentName);
          return {
            category: sc.componentType || '',
            componentId: matchingMaster?.id || ''
          };
        });
      }

      dispatch({ type: 'LOAD_STYLE_DATA', payload });
      notify.success('Style loaded successfully');
    } catch (error) {
      console.error('Failed to load style:', error);
      notify.error('Failed to load style data');
    } finally {
      setLoading(false);
    }
  }, [customers, componentMasters, dispatch, setLoading]);

  // Load accessory presets when customer selected
  const loadAccessoryPresets = useCallback(async (_customerId: string) => {
    try {
      // TODO: Implement when API is available
      dispatch({ type: 'SET_ACCESSORY_PRESETS', payload: [] });
    } catch (error) {
      console.error('Failed to load accessory presets:', error);
    }
  }, [dispatch]);

  // Handle customer selection
  useEffect(() => {
    if (selectedCustomerId) {
      const customer = customers.find(c => c.id === selectedCustomerId);
      if (customer) {
        dispatch({ type: 'SET_BASIC_INFO', payload: { customerName: customer.name } });

        // Extract brands
        if (customer.brandCategories && customer.brandCategories.length > 0) {
          const uniqueBrands = [...new Set(customer.brandCategories.map((bc: BrandCategory) => bc.brandName))];
          dispatch({ type: 'SET_AVAILABLE_BRANDS', payload: uniqueBrands });
        } else if (customer.brandNames) {
          const brands = customer.brandNames.split('\n').map((b: string) => b.trim()).filter((b: string) => b);
          dispatch({ type: 'SET_AVAILABLE_BRANDS', payload: brands });
        } else {
          dispatch({ type: 'SET_AVAILABLE_BRANDS', payload: [] });
        }

        // Reset brand selection
        dispatch({
          type: 'SET_BASIC_INFO',
          payload: { brandName: '', category: '', availableCategories: [] }
        });
        loadAccessoryPresets(selectedCustomerId);
      }
    }
  }, [selectedCustomerId, customers, dispatch, loadAccessoryPresets]);

  // Handle brand selection - load categories
  useEffect(() => {
    if (selectedCustomerId && brandName) {
      const customer = customers.find(c => c.id === selectedCustomerId);
      if (customer?.brandCategories) {
        const brandCategories = customer.brandCategories.filter(
          (bc: BrandCategory) => bc.brandName === brandName
        );
        dispatch({ type: 'SET_AVAILABLE_CATEGORIES', payload: brandCategories });
      }
    } else {
      dispatch({ type: 'SET_AVAILABLE_CATEGORIES', payload: [] });
    }
  }, [brandName, selectedCustomerId, customers, dispatch]);

  // Initial data load
  useEffect(() => {
    loadCustomers();
    loadComponentMasters();
  }, [loadCustomers, loadComponentMasters]);

  // Load style data when in edit mode and data is ready
  useEffect(() => {
    if (isEditMode && styleId && customers.length > 0 && componentMasters.length > 0) {
      loadStyleData(styleId);
    }
  }, [isEditMode, styleId, customers.length, componentMasters.length, loadStyleData]);

  // Save style
  const saveStyle = useCallback(async (isDraft: boolean) => {
    // Validation
    if (isDraft) {
      if (!styleCode) {
        notify.error('Style code is required to save as draft');
        return;
      }
    } else {
      if (!styleCode || !customerName) {
        notify.error('Style code and customer are required');
        return;
      }
      if (fabrics.length === 0 || fabrics.some(f => !f.genericGreigeName)) {
        notify.error('At least one fabric with generic name is required');
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
              materialType: 'THREAD' as MaterialType,
              materialId: 'auto-thread',
              materialCode: 'THREAD-AUTO',
              materialName: 'Thread (Auto-added)',
              quantityPerGarment: 0,
              unit: 'cone',
              unitPrice: 0,
              usageCategory: 'GARMENT_TRIM' as MaterialUsageCategory,
              componentName: 'Default Thread'
            }
          ];

      // Build components array
      const components = selectedComponents
        .filter(sc => sc.componentId)
        .map(sc => {
          const componentMaster = componentMasters.find(cm => cm.id === sc.componentId);
          if (!componentMaster) return null;

          const componentFabrics = fabrics
            .filter(f => f.componentName === componentMaster.name)
            .map(f => ({
              fabricName: f.genericGreigeName,
              fabricType: 'GENERIC',
              fabricFinishType: f.fabricFinishType || null,
              quantityNeeded: f.estimatedConsumption,
              unit: f.unit,
              notes: f.notes || null,
            }));

          return {
            componentName: componentMaster.name,
            componentType: sc.category || 'OTHER',
            fabrics: componentFabrics,
          };
        })
        .filter(c => c !== null);

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
        components,
        expectedOrderQuantity: expectedOrderQty,
        costPrice: costPrice || null,
        sellingPrice: sellingPrice || null,
        hsnCode: hsnCode || null,
        productTaxRule: productTaxRule || null,
        accountingSKU: accountingSKU || null,
        accountingUnit: accountingUnit || null,
        bulletPoints: bulletPoints || null,
        imageUrl: imageUrl || null,
        specifications: remarks || null,
        fabrics: fabrics
          .filter(f => isDraft || f.genericGreigeName)
          .map(f => ({
            componentName: f.componentName,
            genericGreigeName: f.genericGreigeName || (isDraft ? '' : f.genericGreigeName),
            fabricFinishType: f.fabricFinishType || null,
            estimatedConsumption: f.estimatedConsumption || 0,
            unit: f.unit,
            notes: f.notes
          })),
        materialBOM: finalMaterialBOM,
        skuVariants: skuVariants.filter(v => v.isActive),
        processes: processes.filter(p => p.isRequired).map(p => ({
          processType: p.processType,
          description: p.description,
          vendor: p.vendor,
          estimatedCost: p.estimatedCost
        })),
        customerAccessoriesPresetId: selectedAccessoryPresetId || undefined,
        cadStatus: 'PENDING' as CADStatus,
        status: isDraft ? 'DRAFT' : 'DRAFT'
      };

      if (isEditMode && styleId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await styleService.updateStyle(styleId, styleData as any);
        notify.success(isDraft ? 'Draft saved successfully!' : 'Style updated successfully!');
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await styleService.createStyle(styleData as any);
        notify.success(isDraft ? 'Draft saved successfully!' : 'Style created successfully! Proceed to CAD Planning.');
      }

      navigate('/styles');
    } catch (error: unknown) {
      console.error('Failed to save style:', error);
      const axiosError = error as { response?: { data?: { message?: string } } };
      notify.error(axiosError.response?.data?.message || 'Failed to save style');
    } finally {
      setLoading(false);
    }
  }, [
    styleCode, styleName, customerName, brandName, category, brandCategoryId,
    season, description, numberOfComponents, costPrice, sellingPrice,
    expectedOrderQty, remarks, hsnCode, productTaxRule, bulletPoints,
    accountingSKU, accountingUnit, imageUrl, selectedComponents, componentMasters,
    fabrics, materialBOM, accessories, skuVariants, processes,
    selectedAccessoryPresetId, isEditMode, styleId, navigate, setLoading
  ]);

  // Image handlers
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!styleId) {
      notify.error('Please save the style first before uploading an image');
      return;
    }

    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      notify.error('Only JPG and PNG images are allowed');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      notify.error('Image size must be less than 5MB');
      return;
    }

    try {
      dispatch({ type: 'SET_UPLOADING_IMAGE', payload: true });
      const uploadedImageUrl = await styleService.uploadStyleImage(styleId, file);
      dispatch({ type: 'SET_IMAGE_URL', payload: uploadedImageUrl });
      notify.success('Image uploaded successfully');
    } catch (error: unknown) {
      console.error('Image upload error:', error);
      const axiosError = error as { response?: { data?: { message?: string } } };
      notify.error(axiosError.response?.data?.message || 'Failed to upload image');
    } finally {
      dispatch({ type: 'SET_UPLOADING_IMAGE', payload: false });
      e.target.value = '';
    }
  }, [styleId, dispatch]);

  const handleDeleteImage = useCallback(async () => {
    if (!styleId) return;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await styleService.updateStyle(styleId, { imageUrl: null } as any);
      dispatch({ type: 'SET_IMAGE_URL', payload: '' });
      notify.success('Image removed successfully');
    } catch (error: unknown) {
      console.error('Delete image error:', error);
      notify.error('Failed to remove image');
    }
  }, [styleId, dispatch]);

  // Generate SKUs
  const generateSKUs = useCallback(() => {
    const base = styleCode || 'STYLE';
    const newVariants = skuVariants.map(v => ({
      ...v,
      sku: v.isActive ? `${base}${v.size}` : v.sku
    }));
    dispatch({ type: 'SET_SKU_VARIANTS', payload: newVariants });
    notify.success('SKUs generated!');
  }, [styleCode, skuVariants, dispatch]);

  return {
    loading,
    saveStyle,
    handleImageUpload,
    handleDeleteImage,
    generateSKUs,
  };
}
