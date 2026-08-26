// Stock IN Form - Create stock receipt with material-type-specific fields
// Supports multi-item receipt from a single supplier/processor
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Save, X, Info, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { ButtonSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import stockMovementService from '../services/stockMovement.service';
import warehouseService from '../services/warehouse.service';
import { getAllMaterials } from '../services/material.service';
import { greigeService, fabricService } from '../services/fabricGreigeService';

// Source type for stock in
type SourceType = 'FRESH_STOCK' | 'PROCESSOR_RETURN';

// Processor with greige stock
interface ProcessorWithStock {
  processorId: string;
  processorName: string;
  processorCode: string;
  warehouseName: string | null;
  totalQuantity: number;
  stockEntries: number;
}

// Processor greige stock item
interface ProcessorGreigeStock {
  id: string;
  greigeId: string;
  greige: {
    id: string;
    greigeCode: string;
    greigeName: string;
    composition: string;
  };
  quantityAvailable: number;
  greigeWidth: number;
  warehouseLocation: string | null;
  qualityGrade: string;
  receivedDate: string;
}
import { getAllLace } from '../services/lace.service';
import { getAllButtons } from '../services/button.service';
import { getAllThreads } from '../services/thread.service';
import { getAllZippers } from '../services/zipper.service';
import { getAllElastics } from '../services/elastic.service';
import { getAllLabels } from '../services/label.service';
import { getAllPackaging } from '../services/packaging.service';
import { getSupplierById } from '../services/supplier.service';
import { Combobox } from '@/components/ui/combobox';
import type { ComboboxOption } from '@/components/ui/combobox';
import { SupplierCombobox } from '@/components/SupplierCombobox';
import { SupplierCategoryLabels, SupplierCategory } from '../types/supplier.types';
import {
  getAllowedMaterialTypes,
  MATERIAL_SUPPLIER_CATEGORIES,
  getSupplierMaterialLabel,
} from '../lib/supplier-material-mapping';
import { Unit } from '../types/inventory.types';
import type { Warehouse } from '../types/inventory.types';
import type { Material } from '../types/material.types';
import type { GreigeMaster, FabricMaster } from '../types/fabric-greige.types';
import type { Lace } from '../types/lace.types';
import type { Button as ButtonType } from '../types/button.types';
import type { Thread } from '../types/thread.types';
import type { Zipper } from '../types/zipper.types';
import type { Elastic } from '../types/elastic.types';
import type { Label as LabelType } from '../types/label.types';
import type { Packaging } from '../types/packaging.types';
import { logError } from '../lib/logger';

// Material type for unified dropdown
type MaterialType =
  | 'MATERIAL'
  | 'GREIGE'
  | 'FABRIC'
  | 'LACE'
  | 'BUTTON'
  | 'THREAD'
  | 'ZIPPER'
  | 'ELASTIC'
  | 'LABEL'
  | 'PACKAGING'
  | 'LABEL_VARIANT';

// Material type labels for display
const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  GREIGE: 'Greige Fabric',
  FABRIC: 'Finished Fabric',
  LACE: 'Lace',
  BUTTON: 'Buttons',
  THREAD: 'Threads',
  ZIPPER: 'Zippers',
  ELASTIC: 'Elastics',
  LABEL: 'Labels',
  LABEL_VARIANT: 'Label Size Variants',
  PACKAGING: 'Packaging',
  MATERIAL: 'Other Materials',
};

// Default units for each material type
const MATERIAL_TYPE_UNITS: Record<MaterialType, string> = {
  GREIGE: 'METER',
  FABRIC: 'METER',
  LACE: 'METER',
  BUTTON: 'GROSS',
  THREAD: 'CONE',
  ZIPPER: 'PIECE',
  ELASTIC: 'METER',
  LABEL: 'PIECE',
  LABEL_VARIANT: 'PIECE',
  PACKAGING: 'PIECE',
  MATERIAL: '',
};

// Extended material item with full details
interface ExtendedMaterialItem {
  id: string;
  code: string;
  name: string;
  type: MaterialType;
  unit?: string;
  rawData?:
    | GreigeMaster
    | FabricMaster
    | Lace
    | ButtonType
    | Thread
    | Zipper
    | Elastic
    | LabelType
    | Packaging
    | Material
    | (LabelType & { sizeVariant: unknown });
}

// Line item for multi-item stock in
interface StockInLineItem {
  tempId: string;
  materialType: MaterialType | '';
  materialId: string; // format: TYPE:ID or just ID for LABEL_VARIANT
  selectedItem: ExtendedMaterialItem | null;
  quantity: string;
  unit: string;
  rate: string;
  // Type-specific fields (simplified for multi-item)
  foldLengthCm: string;
  thanCount: string;
  rollNumbers: string; // Comma-separated roll numbers (Greige only)
  lotNumber: string;
  remarks: string;
}

// Create empty line item
function createEmptyLineItem(): StockInLineItem {
  return {
    tempId: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    materialType: '',
    materialId: '',
    selectedItem: null,
    quantity: '',
    unit: '',
    rate: '',
    foldLengthCm: '',
    thanCount: '',
    rollNumbers: '',
    lotNumber: '',
    remarks: '',
  };
}

export default function StockInForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL query param for pre-selecting material type (e.g., ?materialType=GREIGE)
  const preselectedMaterialType = searchParams.get('materialType') as MaterialType | null;

  // Navigation timeout ref for cleanup
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
    },
    []
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Source type: Fresh stock or Processor return
  const [sourceType, setSourceType] = useState<SourceType>('FRESH_STOCK');

  // Processor return state
  const [processorsWithStock, setProcessorsWithStock] = useState<ProcessorWithStock[]>([]);
  const [selectedProcessorId, setSelectedProcessorId] = useState<string>('');
  const [processorGreigeStock, setProcessorGreigeStock] = useState<ProcessorGreigeStock[]>([]);
  const [selectedProcessorStock, setSelectedProcessorStock] = useState<ProcessorGreigeStock | null>(null);
  const [receivedQuantity, setReceivedQuantity] = useState<string>('');

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [unifiedMaterials, setUnifiedMaterials] = useState<ExtendedMaterialItem[]>([]);

  const [formData, setFormData] = useState({
    materialId: '',
    warehouseId: '',
    quantity: '',
    unit: '' as Unit | '',
    rate: '',
    referenceType: '',
    referenceNumber: '',
    remarks: '',
    // Type-specific fields
    width: '',
    color: '',
    lotNumber: '',
    rollNumber: '',
    challanNumber: '',
    supplierInvoice: '',
    foldLengthCm: '',
    thanCount: '',
    // New fields for backdating support
    receivedDate: '', // YYYY-MM-DD format, defaults to today
    invoiceDate: '', // YYYY-MM-DD format
  });

  // Supplier selection for Fresh Stock (multi-item mode)
  const [supplierCategory, setSupplierCategory] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierCategories, setSupplierCategories] = useState<SupplierCategory[]>([]);

  // Derived: allowed material types based on selected supplier's categories
  const allowedMaterialTypes = getAllowedMaterialTypes(supplierCategories);
  const hasSingleMaterialType = allowedMaterialTypes.length === 1;

  // Warehouse options for combobox
  const warehouseOptions: ComboboxOption[] = warehouses.map((wh) => ({
    value: wh.id,
    label: `${wh.warehouseCode} - ${wh.warehouseName}`,
    searchText: `${wh.warehouseCode} ${wh.warehouseName}`,
  }));

  // Multi-item line items for Fresh Stock
  const [lineItems, setLineItems] = useState<StockInLineItem[]>([createEmptyLineItem()]);

  useEffect(() => {
    loadData();
  }, []);

  // Handle preselected material type from URL query param
  // Auto-set the first line item's material type when supplier allows it
  useEffect(() => {
    if (
      preselectedMaterialType &&
      supplierId &&
      allowedMaterialTypes.includes(preselectedMaterialType) &&
      lineItems.length > 0 &&
      !lineItems[0].materialType
    ) {
      setLineItems((prev) =>
        prev.map((item, idx) =>
          idx === 0
            ? {
                ...item,
                materialType: preselectedMaterialType,
                unit: MATERIAL_TYPE_UNITS[preselectedMaterialType] || '',
              }
            : item
        )
      );
    }
  }, [preselectedMaterialType, supplierId, allowedMaterialTypes, lineItems]);

  const loadData = async () => {
    try {
      const [
        warehousesData,
        materialsResponse,
        greigeResponse,
        fabricResponse,
        laceResponse,
        buttonResponse,
        threadResponse,
        zipperResponse,
        elasticResponse,
        labelResponse,
        packagingResponse,
        processorsData,
      ] = await Promise.all([
        warehouseService.getAll({ isActive: true }),
        getAllMaterials({ limit: 100 }),
        greigeService.getAll({ limit: 100, isActive: 'true' }),
        fabricService.getAll({ limit: 100, isActive: 'true' }),
        getAllLace({ limit: 100 }),
        getAllButtons({ limit: 100 }),
        getAllThreads({ limit: 100 }),
        getAllZippers({ limit: 100 }),
        getAllElastics({ limit: 100 }),
        getAllLabels({ limit: 100 }),
        getAllPackaging({ limit: 100 }),
        greigeService.getProcessorsWithStock().catch(() => []),
      ]);
      setWarehouses(warehousesData);
      setProcessorsWithStock(processorsData);

      // Build unified materials list with full data
      const unified: ExtendedMaterialItem[] = [];

      greigeResponse.data.forEach((greige: GreigeMaster) => {
        unified.push({
          id: greige.id,
          code: greige.greigeCode,
          name: greige.greigeName,
          type: 'GREIGE',
          unit: 'METER',
          rawData: greige,
        });
      });

      fabricResponse.data.forEach((fabric: FabricMaster) => {
        unified.push({
          id: fabric.id,
          code: fabric.fabricCode,
          name: fabric.fabricName,
          type: 'FABRIC',
          unit: 'METER',
          rawData: fabric,
        });
      });

      laceResponse.data.forEach((lace: Lace) => {
        unified.push({
          id: lace.id,
          code: lace.laceCode,
          name: lace.laceName,
          type: 'LACE',
          unit: 'METER',
          rawData: lace,
        });
      });

      buttonResponse.data.forEach((button: ButtonType) => {
        unified.push({
          id: button.id,
          code: button.buttonCode,
          name: button.buttonName,
          type: 'BUTTON',
          unit: 'GROSS',
          rawData: button,
        });
      });

      threadResponse.data.forEach((thread: Thread) => {
        unified.push({
          id: thread.id,
          code: thread.threadCode,
          name: thread.threadName,
          type: 'THREAD',
          unit: 'CONE',
          rawData: thread,
        });
      });

      zipperResponse.data.forEach((zipper: Zipper) => {
        unified.push({
          id: zipper.id,
          code: zipper.zipperCode,
          name: zipper.zipperName,
          type: 'ZIPPER',
          unit: 'PIECE',
          rawData: zipper,
        });
      });

      elasticResponse.data.forEach((elastic: Elastic) => {
        unified.push({
          id: elastic.id,
          code: elastic.elasticCode,
          name: elastic.elasticName,
          type: 'ELASTIC',
          unit: 'METER',
          rawData: elastic,
        });
      });

      labelResponse.data.forEach((label: LabelType) => {
        // If label has size variants with materials, add each variant's material
        if (label.sizeVariants && label.sizeVariants.length > 0) {
          label.sizeVariants.forEach((variant: NonNullable<LabelType['sizeVariants']>[number]) => {
            if (variant.material) {
              // Add as material entry (not polymorphic) since they have material records
              unified.push({
                id: variant.material.id, // Material ID
                code: variant.material.code,
                name: variant.material.name,
                type: 'LABEL_VARIANT', // Special type to indicate it's a size variant material
                unit: 'PIECE',
                rawData: { ...label, sizeVariant: variant } as LabelType & { sizeVariant: typeof variant },
              });
            }
          });
        } else {
          // No size variants - add label as polymorphic type
          unified.push({
            id: label.id,
            code: label.labelCode,
            name: label.labelName,
            type: 'LABEL',
            unit: 'PIECE',
            rawData: label,
          });
        }
      });

      packagingResponse.data.forEach((pkg: Packaging) => {
        unified.push({
          id: pkg.id,
          code: pkg.packagingCode,
          name: pkg.packagingName,
          type: 'PACKAGING',
          unit: 'PIECE',
          rawData: pkg,
        });
      });

      materialsResponse.data.forEach((mat: Material) => {
        unified.push({
          id: mat.id,
          code: mat.code,
          name: mat.name,
          type: 'MATERIAL',
          unit: mat.unit,
          rawData: mat,
        });
      });

      setUnifiedMaterials(unified);
    } catch (err) {
      logError('Failed to load data:', err);
    }
  };

  // Handle supplier selection - fetch supplier details and auto-set material type if single category
  const handleSupplierChange = async (supId: string) => {
    if (!supId) {
      // Clear selection
      setSupplierId('');
      setSupplierName('');
      setSupplierCategories([]);
      setLineItems([createEmptyLineItem()]);
      return;
    }

    setSupplierId(supId);

    try {
      // Fetch full supplier details including categories
      const supplier = await getSupplierById(supId);
      setSupplierName(supplier.name || '');
      const categories = Array.isArray(supplier.supplierCategories) ? supplier.supplierCategories : [];
      setSupplierCategories(categories as SupplierCategory[]);

      // Reset line items when supplier changes
      const newLineItem = createEmptyLineItem();
      const allowed = getAllowedMaterialTypes(categories);

      // If supplier has only one material type, auto-select it for the first line item
      if (allowed.length === 1) {
        newLineItem.materialType = allowed[0];
        newLineItem.unit = MATERIAL_TYPE_UNITS[allowed[0]] || '';
      }

      setLineItems([newLineItem]);
    } catch (err) {
      logError('Failed to load supplier details:', err);
      setSupplierName('');
      setSupplierCategories([]);
    }
  };

  // --- Line Item Management Functions ---
  const addLineItem = () => {
    const newItem = createEmptyLineItem();
    // If supplier has only one material type, auto-select it
    if (allowedMaterialTypes.length === 1) {
      newItem.materialType = allowedMaterialTypes[0];
      newItem.unit = MATERIAL_TYPE_UNITS[allowedMaterialTypes[0]] || '';
    }
    setLineItems((prev) => [...prev, newItem]);
  };

  const removeLineItem = (tempId: string) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((item) => item.tempId !== tempId));
  };

  const updateLineItem = (tempId: string, field: keyof StockInLineItem, value: any) => {
    setLineItems((prev) => prev.map((item) => (item.tempId === tempId ? { ...item, [field]: value } : item)));
  };

  // Handle material type change for a line item
  const handleLineItemMaterialTypeChange = (tempId: string, materialType: MaterialType) => {
    setLineItems((prev) =>
      prev.map((item) =>
        item.tempId === tempId
          ? {
              ...item,
              materialType,
              materialId: '',
              selectedItem: null,
              quantity: '',
              unit: MATERIAL_TYPE_UNITS[materialType] || '',
              rate: '',
              foldLengthCm: '',
              thanCount: '',
              lotNumber: '',
            }
          : item
      )
    );
  };

  // Handle material selection for a line item
  const handleLineItemMaterialSelect = (tempId: string, value: string, materialType: MaterialType | '') => {
    // Find the material item
    const item = unifiedMaterials.find((m) =>
      m.type === 'LABEL_VARIANT' ? m.id === value : `${m.type}:${m.id}` === value
    );

    setLineItems((prev) =>
      prev.map((lineItem) =>
        lineItem.tempId === tempId
          ? {
              ...lineItem,
              materialId: value,
              selectedItem: item || null,
              unit: item?.unit || MATERIAL_TYPE_UNITS[materialType as MaterialType] || '',
            }
          : lineItem
      )
    );
  };

  // Validate a single line item
  const isLineItemValid = (item: StockInLineItem): boolean => {
    if (!item.materialType) return false;
    if (!item.materialId) return false;
    if (!item.quantity || Number(item.quantity) <= 0) return false;
    if (!item.unit) return false;
    return true;
  };

  // Get count of valid items
  const validItemCount = lineItems.filter(isLineItemValid).length;
  const totalQuantity = lineItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  // Load greige stock when processor is selected
  const handleProcessorSelect = async (processorId: string) => {
    setSelectedProcessorId(processorId);
    setSelectedProcessorStock(null);
    setReceivedQuantity('');

    if (processorId) {
      try {
        const stock = await greigeService.getProcessorStock(processorId);
        setProcessorGreigeStock(stock);
      } catch (err) {
        logError('Failed to load processor stock:', err);
        setProcessorGreigeStock([]);
      }
    } else {
      setProcessorGreigeStock([]);
    }
  };

  // Handle processor greige stock selection
  const handleProcessorStockSelect = (stockId: string) => {
    const stock = processorGreigeStock.find((s) => s.id === stockId);
    setSelectedProcessorStock(stock || null);
    if (stock) {
      setReceivedQuantity(stock.quantityAvailable.toString());
    }
  };

  // Reset source type selection
  const handleSourceTypeChange = (type: SourceType) => {
    setSourceType(type);
    // Reset processor return state
    setSelectedProcessorId('');
    setProcessorGreigeStock([]);
    setSelectedProcessorStock(null);
    setReceivedQuantity('');
    // Reset fresh stock state
    setFormData((prev) => ({ ...prev, materialId: '' }));
    // Reset supplier and line items
    setSupplierId('');
    setSupplierName('');
    setSupplierCategory('');
    setSupplierCategories([]);
    setLineItems([createEmptyLineItem()]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validate based on source type
    if (sourceType === 'PROCESSOR_RETURN') {
      if (!selectedProcessorStock || !receivedQuantity || !formData.warehouseId) {
        setError('Please fill in all required fields for processor return');
        return;
      }
      const qty = Number(receivedQuantity);
      if (qty <= 0) {
        setError('Received quantity must be greater than 0');
        return;
      }
      if (qty > selectedProcessorStock.quantityAvailable) {
        setError('Received quantity cannot exceed sent quantity');
        return;
      }
    } else {
      // Fresh Stock validation - multi-item mode
      if (!supplierId) {
        setError('Please select a supplier');
        return;
      }
      if (!formData.warehouseId) {
        setError('Please select a warehouse');
        return;
      }
      if (validItemCount === 0) {
        setError('Please add at least one valid item (material type, material, quantity, and unit are required)');
        return;
      }
    }

    try {
      setLoading(true);

      // Handle processor return (partial receipt - no shrinkage calculation)
      if (sourceType === 'PROCESSOR_RETURN' && selectedProcessorStock) {
        await stockMovementService.createStockInFromProcessor({
          greigeStockId: selectedProcessorStock.id,
          receivedQuantity: Number(receivedQuantity),
          warehouseId: formData.warehouseId,
          remarks: formData.remarks || undefined,
        });

        setSuccess(true);
        navTimeoutRef.current = setTimeout(() => navigate('/inventory/movements'), 2000);
        return;
      }

      // Handle fresh stock - multi-item mode
      const validItems = lineItems.filter(isLineItemValid);

      // Build items array for bulk stock-in
      const bulkItems = validItems.map((item) => {
        let itemType: string | undefined;
        let itemId: string | undefined;
        let materialId: string | undefined;

        if (item.materialId.includes(':')) {
          const [type, id] = item.materialId.split(':');
          itemType = type;
          itemId = id;
        } else {
          materialId = item.materialId;
        }

        // Build remarks with type-specific fields
        const additionalInfo: string[] = [];
        if (item.thanCount) additionalInfo.push(`Thans: ${item.thanCount}`);
        if (item.foldLengthCm) additionalInfo.push(`L: ${item.foldLengthCm}cm`);
        if (item.lotNumber) additionalInfo.push(`Lot: ${item.lotNumber}`);
        const itemRemarks =
          additionalInfo.length > 0
            ? additionalInfo.join(' | ') + (item.remarks ? ` | ${item.remarks}` : '')
            : item.remarks || undefined;

        return {
          materialId,
          itemType,
          itemId,
          quantity: Number(item.quantity),
          unit: item.unit,
          rate: item.rate ? Number(item.rate) : undefined,
          foldLengthCm: item.foldLengthCm ? Number(item.foldLengthCm) : undefined,
          thanCount: item.thanCount ? Number(item.thanCount) : undefined,
          rollNumbers: item.rollNumbers || undefined,
          remarks: itemRemarks,
        };
      });

      // Use bulk endpoint for multiple items, single endpoint for one item
      if (bulkItems.length > 1) {
        await stockMovementService.createBulkStockIn({
          warehouseId: formData.warehouseId,
          supplierId: supplierId, // Direct supplier reference
          referenceType: 'STOCK_IN',
          referenceNumber: formData.challanNumber || formData.supplierInvoice || undefined,
          remarks: `From: ${supplierName}${formData.remarks ? ' | ' + formData.remarks : ''}`,
          items: bulkItems,
          invoiceNumber: formData.supplierInvoice || undefined,
          invoiceDate: formData.invoiceDate || undefined,
          receivedDate: formData.receivedDate || undefined,
        });
      } else if (bulkItems.length === 1) {
        // Single item - use existing endpoint
        const item = bulkItems[0];
        await stockMovementService.createStockIn({
          materialId: item.materialId,
          itemType: item.itemType,
          itemId: item.itemId,
          warehouseId: formData.warehouseId,
          supplierId: supplierId, // Direct supplier reference
          quantity: item.quantity,
          unit: item.unit as Unit,
          rate: item.rate,
          referenceType: 'STOCK_IN',
          referenceNumber: formData.challanNumber || formData.supplierInvoice || undefined,
          remarks: `From: ${supplierName}${item.remarks ? ' | ' + item.remarks : ''}${formData.remarks ? ' | ' + formData.remarks : ''}`,
          foldLengthCm: item.foldLengthCm,
          thanCount: item.thanCount,
          rollNumbers: item.rollNumbers,
          invoiceNumber: formData.supplierInvoice || undefined,
          invoiceDate: formData.invoiceDate || undefined,
          receivedDate: formData.receivedDate || undefined,
        });
      }

      setSuccess(true);
      navTimeoutRef.current = setTimeout(() => navigate('/inventory/movements'), 2000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to create stock in');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string | number | boolean | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Get units available for selected material type
  const getUnitsForType = (type: MaterialType): { value: string; label: string }[] => {
    switch (type) {
      case 'GREIGE':
      case 'FABRIC':
      case 'LACE':
      case 'ELASTIC':
        return [
          { value: 'METER', label: 'Meter' },
          { value: 'YARD', label: 'Yard' },
          { value: 'ROLL', label: 'Roll' },
        ];
      case 'BUTTON':
        return [
          { value: 'GROSS', label: 'Gross (144 pcs)' },
          { value: 'DOZEN', label: 'Dozen' },
          { value: 'PIECE', label: 'Piece' },
        ];
      case 'THREAD':
        return [
          { value: 'CONE', label: 'Cone' },
          { value: 'SPOOL', label: 'Spool' },
          { value: 'BOX', label: 'Box' },
        ];
      case 'ZIPPER':
        return [
          { value: 'PIECE', label: 'Piece' },
          { value: 'DOZEN', label: 'Dozen' },
          { value: 'GROSS', label: 'Gross' },
        ];
      case 'LABEL':
      case 'LABEL_VARIANT':
      case 'PACKAGING':
        return [
          { value: 'PIECE', label: 'Piece' },
          { value: 'DOZEN', label: 'Dozen' },
          { value: 'BOX', label: 'Box' },
          { value: 'SET', label: 'Set' },
        ];
      default:
        return [
          { value: 'PIECE', label: 'Piece' },
          { value: 'METER', label: 'Meter' },
          { value: 'YARD', label: 'Yard' },
          { value: 'KILOGRAM', label: 'Kilogram' },
          { value: 'GRAM', label: 'Gram' },
          { value: 'CONE', label: 'Cone' },
          { value: 'ROLL', label: 'Roll' },
          { value: 'BOX', label: 'Box' },
          { value: 'SET', label: 'Set' },
          { value: 'DOZEN', label: 'Dozen' },
          { value: 'GROSS', label: 'Gross' },
        ];
    }
  };

  return (
    <div className="container mx-auto py-6">
      <PageHeader title="Stock IN (Receipt)" />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 bg-success-muted text-success border-success/20">
          <AlertDescription>Stock IN created successfully! Redirecting...</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        {/* Source Type Selection */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Source Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Button
                type="button"
                variant={sourceType === 'FRESH_STOCK' ? 'default' : 'outline'}
                className={`h-auto py-4 flex flex-col items-center justify-center ${sourceType === 'FRESH_STOCK' ? 'ring-2 ring-offset-2' : ''}`}
                onClick={() => handleSourceTypeChange('FRESH_STOCK')}
              >
                <span className="font-medium">Fresh Stock</span>
                <span className="text-xs opacity-70">New purchase / Direct receipt</span>
              </Button>
              <Button
                type="button"
                variant={sourceType === 'PROCESSOR_RETURN' ? 'default' : 'outline'}
                className={`h-auto py-4 flex flex-col items-center justify-center ${sourceType === 'PROCESSOR_RETURN' ? 'ring-2 ring-offset-2' : ''}`}
                onClick={() => handleSourceTypeChange('PROCESSOR_RETURN')}
                disabled={processorsWithStock.length === 0}
              >
                <span className="font-medium">Processor Return</span>
                <span className="text-xs opacity-70">
                  {processorsWithStock.length > 0
                    ? `${processorsWithStock.length} processor(s) with stock`
                    : 'No processors with stock'}
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Processor Return Flow */}
        {sourceType === 'PROCESSOR_RETURN' && (
          <>
            {/* Step 1: Select Processor */}
            <Card className="mb-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Step 1: Select Processor</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedProcessorId} onValueChange={handleProcessorSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select processor with pending stock" />
                  </SelectTrigger>
                  <SelectContent>
                    {processorsWithStock.map((p) => (
                      <SelectItem key={p.processorId} value={p.processorId}>
                        <span className="font-medium">{p.processorCode}</span>
                        <span className="text-muted-foreground"> - {p.processorName}</span>
                        <span className="text-xs ml-2 text-primary">
                          ({p.totalQuantity.toLocaleString()} MTR available)
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Step 2: Select Greige Stock */}
            {selectedProcessorId && (
              <Card className="mb-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Step 2: Select Greige to Receive</CardTitle>
                </CardHeader>
                <CardContent>
                  {processorGreigeStock.length === 0 ? (
                    <Alert>
                      <AlertDescription>No greige stock found at this processor.</AlertDescription>
                    </Alert>
                  ) : (
                    <Select value={selectedProcessorStock?.id || ''} onValueChange={handleProcessorStockSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select greige stock entry" />
                      </SelectTrigger>
                      <SelectContent>
                        {processorGreigeStock.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <span className="font-medium">{s.greige.greigeCode}</span>
                            <span className="text-muted-foreground"> - {s.greige.greigeName}</span>
                            <span className="text-xs ml-2 text-primary">
                              ({s.quantityAvailable.toLocaleString()} MTR)
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 3: Receive Details with Shrinkage */}
            {selectedProcessorStock && (
              <Card className="mb-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Step 3: Receive Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Greige Info */}
                    <div className="col-span-full p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Info className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">Greige Details</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Code:</span>{' '}
                          {selectedProcessorStock.greige.greigeCode}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Name:</span>{' '}
                          {selectedProcessorStock.greige.greigeName}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Composition:</span>{' '}
                          {selectedProcessorStock.greige.composition}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Width:</span> {selectedProcessorStock.greigeWidth}"
                        </div>
                      </div>
                    </div>

                    {/* Available at Processor (read-only) */}
                    <div className="space-y-2">
                      <Label>Available at Processor (MTR)</Label>
                      <Input
                        value={selectedProcessorStock.quantityAvailable.toLocaleString()}
                        disabled
                        className="bg-muted"
                      />
                    </div>

                    {/* Received Quantity */}
                    <div className="space-y-2">
                      <Label htmlFor="receivedQty">
                        Receiving Now (MTR) <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="receivedQty"
                        type="number"
                        value={receivedQuantity}
                        onChange={(e) => setReceivedQuantity(e.target.value)}
                        min="0.01"
                        max={selectedProcessorStock.quantityAvailable}
                        step="0.01"
                        placeholder="Enter quantity to receive"
                      />
                    </div>

                    {/* Balance After Receipt */}
                    <div className="space-y-2">
                      <Label>Balance at Processor After</Label>
                      {(() => {
                        const qty = Number(receivedQuantity) || 0;
                        const available = selectedProcessorStock.quantityAvailable;
                        const balance = available - qty;
                        if (qty <= 0) return <Input value="-" disabled className="bg-muted" />;
                        return (
                          <div
                            className={`p-2 rounded-md text-center ${balance > 0 ? 'bg-muted' : 'bg-success-muted text-success'}`}
                          >
                            <span className="font-medium">{balance.toFixed(2)} MTR</span>
                            {balance === 0 && <div className="text-xs mt-1">Full receipt - no balance</div>}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Warehouse Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="warehouseId">
                        Receive to Warehouse <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={formData.warehouseId}
                        onValueChange={(value) => handleChange('warehouseId', value)}
                      >
                        <SelectTrigger id="warehouseId">
                          <SelectValue placeholder="Select warehouse" />
                        </SelectTrigger>
                        <SelectContent>
                          {warehouses
                            .filter((wh) => wh.warehouseType !== 'JOB_WORK')
                            .map((wh) => (
                              <SelectItem key={wh.id} value={wh.id}>
                                {wh.warehouseCode} - {wh.warehouseName}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Remarks */}
                    <div className="col-span-full space-y-2">
                      <Label htmlFor="remarks">Remarks</Label>
                      <Textarea
                        id="remarks"
                        value={formData.remarks}
                        onChange={(e) => handleChange('remarks', e.target.value)}
                        placeholder="Any additional notes..."
                        rows={2}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Fresh Stock Flow - Step 1: Select Supplier */}
        {sourceType === 'FRESH_STOCK' && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Step 1: Select Supplier</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Supplier Search (Primary) */}
                <div className="space-y-2 md:col-span-2">
                  <Label>
                    Supplier <span className="text-destructive">*</span>
                  </Label>
                  <SupplierCombobox
                    value={supplierId}
                    onValueChange={handleSupplierChange}
                    placeholder="Search by name or code..."
                    categoryFilter={supplierCategory || undefined}
                  />
                </div>
                {/* Category Filter (Optional) */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Filter by Category</Label>
                  <Select
                    value={supplierCategory}
                    onValueChange={(v) => {
                      setSupplierCategory(v === 'ALL' ? '' : v);
                      setSupplierId('');
                      setSupplierName('');
                      setSupplierCategories([]);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Categories</SelectItem>
                      {/* Only show material supplier categories, not processors */}
                      {MATERIAL_SUPPLIER_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {SupplierCategoryLabels[cat]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Selected Supplier Info - Category Badge */}
              {supplierId && supplierCategories.length > 0 && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{supplierName}</span>
                    <span className="text-muted-foreground">•</span>
                    {supplierCategories.map((cat) => (
                      <span
                        key={cat}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary"
                      >
                        {SupplierCategoryLabels[cat]}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Materials: {getSupplierMaterialLabel(supplierCategories)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Fresh Stock Flow - Step 2: Warehouse & Reference (shown after supplier selected) */}
        {sourceType === 'FRESH_STOCK' && supplierId && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Step 2: Warehouse & Reference</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="warehouseId">
                    Warehouse <span className="text-destructive">*</span>
                  </Label>
                  <Combobox
                    options={warehouseOptions}
                    value={formData.warehouseId}
                    onValueChange={(value) => handleChange('warehouseId', value)}
                    placeholder="Search warehouse..."
                    searchPlaceholder="Type to search warehouses..."
                    emptyText="No warehouses found"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="challanNumber">Challan/DC Number</Label>
                  <Input
                    id="challanNumber"
                    value={formData.challanNumber}
                    onChange={(e) => handleChange('challanNumber', e.target.value)}
                    placeholder="Delivery challan number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplierInvoice">Supplier Invoice</Label>
                  <Input
                    id="supplierInvoice"
                    value={formData.supplierInvoice}
                    onChange={(e) => handleChange('supplierInvoice', e.target.value)}
                    placeholder="Invoice number"
                  />
                </div>
              </div>
              {/* Date fields for backdating support */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="receivedDate">Received Date</Label>
                  <Input
                    id="receivedDate"
                    type="date"
                    value={formData.receivedDate}
                    onChange={(e) => handleChange('receivedDate', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Leave blank for today</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoiceDate">Invoice Date</Label>
                  <Input
                    id="invoiceDate"
                    type="date"
                    value={formData.invoiceDate}
                    onChange={(e) => handleChange('invoiceDate', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fresh Stock Flow - Step 3: Add Items (multi-item) */}
        {sourceType === 'FRESH_STOCK' && supplierId && formData.warehouseId && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Step 3: Add Items</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add {hasSingleMaterialType ? MATERIAL_TYPE_LABELS[allowedMaterialTypes[0]] : 'Item'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Info message about allowed material types */}
              {allowedMaterialTypes.length > 0 && (
                <Alert className="bg-muted/50 border-muted">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {hasSingleMaterialType ? (
                      <>
                        Showing <strong>{MATERIAL_TYPE_LABELS[allowedMaterialTypes[0]]}</strong> materials (based on
                        supplier type)
                      </>
                    ) : (
                      <>
                        This supplier provides:{' '}
                        <strong>{allowedMaterialTypes.map((t) => MATERIAL_TYPE_LABELS[t]).join(', ')}</strong>
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {lineItems.map((item, index) => {
                const isFabricOrGreige = item.materialType === 'FABRIC' || item.materialType === 'GREIGE';
                // Build material options for combobox
                const materialOptions: ComboboxOption[] = unifiedMaterials
                  .filter((m) => {
                    if (item.materialType === 'LABEL') {
                      return m.type === 'LABEL' || m.type === 'LABEL_VARIANT';
                    }
                    return m.type === item.materialType;
                  })
                  .map((mat) => ({
                    value: mat.type === 'LABEL_VARIANT' ? mat.id : `${mat.type}:${mat.id}`,
                    label: `${mat.code} - ${mat.name}`,
                    searchText: `${mat.code} ${mat.name}`,
                  }));

                return (
                  <div key={item.tempId} className="border rounded-lg p-4 space-y-4">
                    {/* Item Header */}
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-muted-foreground">Item {index + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLineItem(item.tempId)}
                        disabled={lineItems.length <= 1}
                        className="text-destructive hover:text-destructive h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Material Type Tiles - Only show if multiple allowed types */}
                    {!hasSingleMaterialType && allowedMaterialTypes.length > 0 && (
                      <div className="space-y-2">
                        <Label>
                          Material Type <span className="text-destructive">*</span>
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {allowedMaterialTypes.map((type) => {
                            const count = unifiedMaterials.filter((m) => m.type === type).length;
                            const isSelected = item.materialType === type;
                            return (
                              <Button
                                key={type}
                                type="button"
                                variant={isSelected ? 'default' : 'outline'}
                                size="sm"
                                className={`h-auto py-2 px-3 flex flex-col ${isSelected ? 'ring-2 ring-offset-1' : ''}`}
                                onClick={() => handleLineItemMaterialTypeChange(item.tempId, type)}
                              >
                                <span className="text-xs font-medium">{MATERIAL_TYPE_LABELS[type]}</span>
                                <span className="text-[10px] opacity-70">{count}</span>
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Material Selection & Quantity (shown after material type selected or auto-selected) */}
                    {item.materialType && (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Material Selection - Combobox */}
                        <div className="space-y-2 md:col-span-2">
                          <Label>
                            {MATERIAL_TYPE_LABELS[item.materialType]} <span className="text-destructive">*</span>
                          </Label>
                          <Combobox
                            options={materialOptions}
                            value={item.materialId}
                            onValueChange={(v) => handleLineItemMaterialSelect(item.tempId, v, item.materialType)}
                            placeholder={`Search ${MATERIAL_TYPE_LABELS[item.materialType].toLowerCase()}...`}
                            searchPlaceholder="Type to search..."
                            emptyText="No materials found"
                          />
                        </div>

                        {/* Quantity */}
                        <div className="space-y-2">
                          <Label>
                            Quantity <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(item.tempId, 'quantity', e.target.value)}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                          />
                        </div>

                        {/* Unit */}
                        <div className="space-y-2">
                          <Label>
                            Unit <span className="text-destructive">*</span>
                          </Label>
                          <Select value={item.unit} onValueChange={(v) => updateLineItem(item.tempId, 'unit', v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Unit" />
                            </SelectTrigger>
                            <SelectContent>
                              {getUnitsForType(item.materialType).map((unit) => (
                                <SelectItem key={unit.value} value={unit.value}>
                                  {unit.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Rate */}
                        <div className="space-y-2">
                          <Label>Rate (₹)</Label>
                          <Input
                            type="number"
                            value={item.rate}
                            onChange={(e) => updateLineItem(item.tempId, 'rate', e.target.value)}
                            min="0"
                            step="0.01"
                            placeholder="Rate per unit"
                          />
                        </div>

                        {/* Lot Number */}
                        <div className="space-y-2">
                          <Label>Lot/Batch Number</Label>
                          <Input
                            value={item.lotNumber}
                            onChange={(e) => updateLineItem(item.tempId, 'lotNumber', e.target.value)}
                            placeholder="Lot number"
                          />
                        </div>

                        {/* Than Count & Fold Length (fabric/greige only) */}
                        {isFabricOrGreige && (
                          <>
                            <div className="space-y-2">
                              <Label>Than Count</Label>
                              <Input
                                type="number"
                                value={item.thanCount}
                                onChange={(e) => updateLineItem(item.tempId, 'thanCount', e.target.value)}
                                placeholder="Thans"
                                min="0"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Fold Length (cm)</Label>
                              <Input
                                type="number"
                                value={item.foldLengthCm}
                                onChange={(e) => updateLineItem(item.tempId, 'foldLengthCm', e.target.value)}
                                placeholder="e.g. 97"
                                step="0.01"
                                min="0"
                              />
                            </div>
                            {/* Show calculated actual when fold length is entered */}
                            {item.foldLengthCm &&
                              Number(item.foldLengthCm) > 0 &&
                              Number(item.foldLengthCm) < 100 &&
                              item.quantity && (
                                <div className="col-span-full bg-amber-50 border border-amber-200 rounded-md p-2 text-sm">
                                  <div className="font-medium text-amber-800">Fold Length Adjustment:</div>
                                  <div className="text-amber-700">
                                    Nominal: {Number(item.quantity).toLocaleString()} {item.unit} × L=
                                    {item.foldLengthCm}cm ={' '}
                                    <strong>
                                      Actual:{' '}
                                      {((Number(item.quantity) * Number(item.foldLengthCm)) / 100).toLocaleString(
                                        undefined,
                                        { maximumFractionDigits: 2 }
                                      )}{' '}
                                      {item.unit}
                                    </strong>
                                    {item.rate && (
                                      <span className="ml-2">
                                        (Value: ₹
                                        {(
                                          ((Number(item.quantity) * Number(item.foldLengthCm)) / 100) *
                                          Number(item.rate)
                                        ).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                        )
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                          </>
                        )}

                        {/* Roll Numbers (greige only) */}
                        {item.materialType === 'GREIGE' && (
                          <div className="space-y-2 col-span-full">
                            <Label>Roll Numbers</Label>
                            <Input
                              value={item.rollNumbers}
                              onChange={(e) => updateLineItem(item.tempId, 'rollNumbers', e.target.value)}
                              placeholder="Comma-separated roll numbers (e.g., R001, R002, R003)"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Item validation indicator */}
                    {item.materialType && (
                      <div className="text-xs">
                        {isLineItemValid(item) ? (
                          <span className="text-green-600">Item valid</span>
                        ) : (
                          <span className="text-muted-foreground">Select material and enter quantity/unit</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Summary */}
              <div className="border-t pt-4 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {validItemCount} of {lineItems.length} item(s) valid | Total Qty: {totalQuantity.toFixed(2)}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Another {hasSingleMaterialType ? MATERIAL_TYPE_LABELS[allowedMaterialTypes[0]] : 'Item'}
                </Button>
              </div>

              {/* Remarks */}
              <div className="space-y-2 pt-2">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={formData.remarks}
                  onChange={(e) => handleChange('remarks', e.target.value)}
                  rows={2}
                  placeholder="Any additional notes..."
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate('/inventory/movements')}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              loading ||
              (sourceType === 'FRESH_STOCK' && (validItemCount === 0 || !formData.warehouseId || !supplierId)) ||
              (sourceType === 'PROCESSOR_RETURN' &&
                (!selectedProcessorStock || !receivedQuantity || !formData.warehouseId))
            }
          >
            {loading ? <ButtonSpinner className="mr-2" /> : <Save className="mr-2 h-4 w-4" />}
            {sourceType === 'PROCESSOR_RETURN'
              ? 'Receive from Processor'
              : `Create Stock IN (${validItemCount} item${validItemCount !== 1 ? 's' : ''})`}
          </Button>
        </div>
      </form>
    </div>
  );
}
