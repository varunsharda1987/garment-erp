// Stock Out Form - Issue materials via challan (purpose-first flow)
// 3 purposes: Purchase Return (to supplier) | Internal Issue (dept to dept) | Send for Processing (redirects to Job Work Order)
// Processing is handled via Job Work Order for proper job work tracking - this form only handles returns and internal transfers
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  X,
  ArrowRightLeft,
  Info,
  Plus,
  Trash2,
  Undo2,
  Factory,
  Beaker,
  AlertTriangle,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/combobox';
import type { ComboboxOption } from '@/components/ui/combobox';
import { ButtonSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { challanService } from '../services/challan.service';
import stockLevelService from '../services/stockLevel.service';
import { WarehouseCombobox } from '@/components/WarehouseCombobox';
import { getAllSuppliers } from '../services/supplier.service';
import { fabricStockService } from '../services/fabricStock.service';
import { greigeStockService } from '../services/greigeStock.service';
import type { GreigeStockEntry } from '../services/greigeStock.service';
import { SupplierCategoryLabels, SupplierCategory } from '../types/supplier.types';
import type { Supplier } from '../types/supplier.types';
import type { CreateChallanInput, ChallanType } from '../types/challan.types';
import type { StockLevel } from '../types/inventory-exports';
import { logError } from '../lib/logger';
import {
  getAllowedMaterialTypes,
  MATERIAL_SUPPLIER_CATEGORIES,
  getSupplierMaterialLabel,
} from '../lib/supplier-material-mapping';

// --- Material type tile system (matching Stock In) ---

type MaterialType =
  | 'GREIGE'
  | 'FABRIC'
  | 'LACE'
  | 'BUTTON'
  | 'THREAD'
  | 'ZIPPER'
  | 'ELASTIC'
  | 'LABEL'
  | 'LABEL_VARIANT'
  | 'PACKAGING'
  | 'MATERIAL';

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

type StockType = 'GENERAL' | 'FABRIC' | 'GREIGE';

// Map tile type to underlying stock source
const MATERIAL_TO_STOCK_TYPE: Record<MaterialType, StockType> = {
  GREIGE: 'GREIGE',
  FABRIC: 'FABRIC',
  LACE: 'GENERAL',
  BUTTON: 'GENERAL',
  THREAD: 'GENERAL',
  ZIPPER: 'GENERAL',
  ELASTIC: 'GENERAL',
  LABEL: 'GENERAL',
  LABEL_VARIANT: 'GENERAL',
  PACKAGING: 'GENERAL',
  MATERIAL: 'GENERAL',
};

// Map tile type to DB materialType enum values for filtering stock_levels
const MATERIAL_TYPE_DB_FILTER: Record<string, string[]> = {
  LACE: ['LACE'],
  BUTTON: ['BUTTON', 'SNAP_BUTTON', 'HOOK_EYE'],
  THREAD: ['THREAD'],
  ZIPPER: ['ZIPPER'],
  ELASTIC: ['ELASTIC'],
  LABEL: ['LABEL'],
  LABEL_VARIANT: ['LABEL'],
  PACKAGING: ['PACKAGING'],
  // "Other Materials" = everything not in the above specific types
  MATERIAL: [
    'GENERIC',
    'TRIMS',
    'ACCESSORIES',
    'SERVICE',
    'MACHINE_PART',
    'OTHER',
    'BUCKLE',
    'BELT',
    'VELCRO',
    'DRAWSTRING',
    'RIBBON',
    'SEQUIN',
    'BEAD',
    'MOTIF',
    'INTERLINING',
    'PADDING',
    'OTHER_FASTENER',
    'OTHER_TAPE',
    'OTHER_DECORATIVE',
    'OTHER_FUNCTIONAL',
    'OTHER_MATERIAL',
  ],
};

const DEPARTMENTS = ['Cutting', 'Stitching', 'Finishing', 'Washing', 'Packing', 'Quality', 'Embroidery', 'Printing'];

interface FabricStockOption {
  id: string;
  fabricId: string;
  fabricCode: string;
  fabricName: string;
  colorName: string | null;
  quantityAvailable: number;
  purchaseCost: number;
}

// Line item interface for multi-item support
interface LineItem {
  tempId: string;
  materialType: MaterialType | '';
  stockType: StockType;
  // Stock IDs
  greigeStockId: string;
  fabricStockId: string;
  materialId: string;
  // Details
  materialDescription: string;
  quantity: string;
  unit: string;
  availableQty: number | null;
  rate: number | null;
  // Fabric/greige specific
  foldLengthCm: string;
  thanCount: string;
}

// Create empty line item with unique temp ID
function createEmptyLineItem(): LineItem {
  return {
    tempId: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    materialType: '',
    stockType: 'GENERAL',
    greigeStockId: '',
    fabricStockId: '',
    materialId: '',
    materialDescription: '',
    quantity: '',
    unit: '',
    availableQty: null,
    rate: null,
    foldLengthCm: '',
    thanCount: '',
  };
}

export default function StockOutForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Issue purpose (purpose-first flow)
  type IssuePurpose = 'PURCHASE_RETURN' | 'INTERNAL' | 'PROCESSING' | '';
  const [issuePurpose, setIssuePurpose] = useState<IssuePurpose>('');

  // Form state
  const [challanType, setChallanType] = useState<ChallanType>('OUTWARD');
  const [challanDate, setChallanDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [warehouseId, setWarehouseId] = useState('');
  const [remarks, setRemarks] = useState('');

  // Destination
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierCategory, setSupplierCategory] = useState('');
  const [supplierCategories, setSupplierCategories] = useState<SupplierCategory[]>([]);
  const [department, setDepartment] = useState('');
  const [customDepartment, setCustomDepartment] = useState('');

  // Multi-item support: array of line items
  const [lineItems, setLineItems] = useState<LineItem[]>([createEmptyLineItem()]);

  // Data lists
  const [allStockLevels, setAllStockLevels] = useState<StockLevel[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<ComboboxOption[]>([]);
  const [fabricStocks, setFabricStocks] = useState<FabricStockOption[]>([]);
  const [greigeStocks, setGreigeStocks] = useState<GreigeStockEntry[]>([]);
  const [suppliersRaw, setSuppliersRaw] = useState<Partial<Supplier>[]>([]);

  // Derived: allowed material types based on selected supplier's categories (for OUTWARD)
  const allowedMaterialTypes = challanType === 'OUTWARD' ? getAllowedMaterialTypes(supplierCategories) : [];
  const hasSingleMaterialType = allowedMaterialTypes.length === 1;

  // Compute tile counts for material type display
  const tileCounts: Record<string, number> = {};
  tileCounts['GREIGE'] = greigeStocks.length;
  tileCounts['FABRIC'] = fabricStocks.length;
  for (const sl of allStockLevels) {
    const matType = (sl.materials as any)?.materialType || 'GENERIC';
    for (const [tileType, dbTypes] of Object.entries(MATERIAL_TYPE_DB_FILTER)) {
      if (dbTypes.includes(matType)) {
        tileCounts[tileType] = (tileCounts[tileType] || 0) + 1;
        break;
      }
    }
  }

  // Get filtered stock levels for a given material type
  const getFilteredStockLevels = useCallback(
    (materialType: MaterialType | ''): StockLevel[] => {
      if (!materialType) return allStockLevels;
      const stockType = MATERIAL_TO_STOCK_TYPE[materialType];
      if (stockType !== 'GENERAL') return allStockLevels;
      const dbTypes = MATERIAL_TYPE_DB_FILTER[materialType] || [];
      return allStockLevels.filter((sl) => {
        const matType = (sl.materials as any)?.materialType || 'GENERIC';
        return dbTypes.includes(matType);
      });
    },
    [allStockLevels]
  );

  // --- Line Item Management Functions ---
  const addLineItem = () => {
    const newItem = createEmptyLineItem();
    // If OUTWARD mode with supplier that has only one material type, auto-select it
    if (challanType === 'OUTWARD' && allowedMaterialTypes.length === 1) {
      newItem.materialType = allowedMaterialTypes[0];
      newItem.stockType = MATERIAL_TO_STOCK_TYPE[allowedMaterialTypes[0]];
      newItem.unit = allowedMaterialTypes[0] === 'GREIGE' || allowedMaterialTypes[0] === 'FABRIC' ? 'METER' : '';
    }
    setLineItems((prev) => [...prev, newItem]);
  };

  const removeLineItem = (tempId: string) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((item) => item.tempId !== tempId));
  };

  const updateLineItem = (tempId: string, field: keyof LineItem, value: any) => {
    setLineItems((prev) => prev.map((item) => (item.tempId === tempId ? { ...item, [field]: value } : item)));
  };

  // Handle material type change for a line item
  const handleLineItemMaterialTypeChange = (tempId: string, materialType: MaterialType) => {
    const stockType = MATERIAL_TO_STOCK_TYPE[materialType];
    setLineItems((prev) =>
      prev.map((item) =>
        item.tempId === tempId
          ? {
              ...item,
              materialType,
              stockType,
              greigeStockId: '',
              fabricStockId: '',
              materialId: '',
              materialDescription: '',
              quantity: '',
              unit: stockType === 'GREIGE' || stockType === 'FABRIC' ? 'METER' : '',
              availableQty: null,
              rate: null,
              foldLengthCm: '',
              thanCount: '',
            }
          : item
      )
    );
  };

  // Handle greige stock selection for a line item
  const handleLineItemGreigeChange = (tempId: string, gsId: string) => {
    const gs = greigeStocks.find((g) => g.id === gsId);
    if (!gs) return;
    const widthStr = gs.greigeWidth ? ` / ${gs.greigeWidth}"` : '';
    const constructionStr = gs.greige.construction ? ` / ${gs.greige.construction}` : '';
    const description = `${gs.greige.greigeCode} - ${gs.greige.greigeName}${constructionStr}${widthStr} (${gs.greige.composition})`;
    setLineItems((prev) =>
      prev.map((item) =>
        item.tempId === tempId
          ? {
              ...item,
              greigeStockId: gsId,
              materialDescription: description,
              availableQty: Number(gs.quantityAvailable),
              rate: Number(gs.purchaseCost || gs.weightedAvgCost) || null,
              unit: 'METER',
            }
          : item
      )
    );
  };

  // Handle fabric stock selection for a line item
  const handleLineItemFabricChange = (tempId: string, fsId: string) => {
    const fs = fabricStocks.find((f) => f.id === fsId);
    if (!fs) return;
    const description = `${fs.fabricCode} - ${fs.fabricName}${fs.colorName ? ` (${fs.colorName})` : ''}`;
    setLineItems((prev) =>
      prev.map((item) =>
        item.tempId === tempId
          ? {
              ...item,
              fabricStockId: fsId,
              materialDescription: description,
              availableQty: fs.quantityAvailable,
              rate: fs.purchaseCost,
              unit: 'METER',
            }
          : item
      )
    );
  };

  // Handle general material selection for a line item
  const handleLineItemMaterialChange = (tempId: string, matId: string, materialType: MaterialType | '') => {
    const filteredLevels = getFilteredStockLevels(materialType);
    const stock = filteredLevels.find((s) => s.materialId === matId);
    if (!stock) return;
    const description = `${stock.materials?.code || ''} - ${stock.materials?.name || ''}`;
    setLineItems((prev) =>
      prev.map((item) =>
        item.tempId === tempId
          ? {
              ...item,
              materialId: matId,
              materialDescription: description,
              availableQty: Number(stock.quantity),
              rate: Number(stock.valuationRate) || null,
              unit: stock.unit,
            }
          : item
      )
    );
  };

  // Load fabric/greige stock on mount
  useEffect(() => {
    loadFabricStock();
    loadGreigeStock();
  }, []);

  // Load suppliers when OUTWARD selected or category changes
  useEffect(() => {
    if (challanType === 'OUTWARD') {
      loadSuppliers();
    }
  }, [challanType, supplierCategory]);

  // Load stock levels when warehouse changes
  useEffect(() => {
    if (warehouseId) {
      loadStockLevels(warehouseId);
    }
  }, [warehouseId]);

  // Note: Material type pre-selection is now handled in handleSupplierChange
  // based on supplier's categories, not just the filter category

  const loadSuppliers = async () => {
    try {
      const result = await getAllSuppliers({
        category: supplierCategory || undefined,
        limit: 200,
      });
      const data = (result as any).data || [];
      // Filter by selected category if one is chosen (show all suppliers including processors)
      const filtered = supplierCategory
        ? data.filter((s: Supplier) => s.supplierCategories?.includes(supplierCategory as SupplierCategory))
        : data;
      setSuppliersRaw(filtered);
      setSupplierOptions(
        filtered.map((s: Supplier) => ({
          value: s.id,
          label: `${s.code ? s.code + ' - ' : ''}${s.name}`,
          searchText: `${s.code || ''} ${s.name}`,
        }))
      );
    } catch (err) {
      logError('Failed to load suppliers:', err);
    }
  };

  const loadStockLevels = async (whId: string) => {
    try {
      const data = await stockLevelService.getByWarehouse(whId);
      setAllStockLevels(data.filter((s) => Number(s.quantity) > 0));
    } catch (err) {
      logError('Failed to load stock levels:', err);
    }
  };

  const loadFabricStock = async () => {
    try {
      const result = await fabricStockService.listStock({ status: 'AVAILABLE', limit: 200 });
      const data = result.data || [];
      setFabricStocks(
        data
          .filter((f: any) => Number(f.quantityAvailable) > 0)
          .map((f: any) => ({
            id: f.id,
            fabricId: f.fabricId,
            fabricCode: f.fabric?.fabricCode || f.fabricMaster?.fabricCode || '',
            fabricName: f.fabric?.fabricName || f.fabricMaster?.fabricName || '',
            colorName: f.fabric?.colorName || f.fabricMaster?.colorName || null,
            quantityAvailable: Number(f.quantityAvailable),
            purchaseCost: Number(f.purchaseCost || f.weightedAvgCost || 0),
          }))
      );
    } catch (err) {
      logError('Failed to load fabric stock:', err);
    }
  };

  const loadGreigeStock = async () => {
    try {
      // Exclude stock already transferred to processors (sourceType='TRANSFER')
      const data = await greigeStockService.listAvailableStock({
        excludeTransferred: true,
      });
      setGreigeStocks(data.filter((g) => Number(g.quantityAvailable) > 0));
    } catch (err) {
      logError('Failed to load greige stock:', err);
    }
  };

  const handleSupplierChange = (supId: string) => {
    setSupplierId(supId);
    const sup = suppliersRaw.find((s) => s.id === supId);
    setSupplierName(sup?.name || '');
    const categories = Array.isArray(sup?.supplierCategories) ? sup.supplierCategories : [];
    setSupplierCategories(categories as SupplierCategory[]);

    // Reset line items when supplier changes
    const newLineItem = createEmptyLineItem();
    const allowed = getAllowedMaterialTypes(categories);

    // If supplier has only one material type, auto-select it for the first line item
    if (allowed.length === 1) {
      newLineItem.materialType = allowed[0];
      newLineItem.stockType = MATERIAL_TO_STOCK_TYPE[allowed[0]];
      newLineItem.unit = allowed[0] === 'GREIGE' || allowed[0] === 'FABRIC' ? 'METER' : '';
    }

    setLineItems([newLineItem]);
  };

  const getDestinationName = (): string => {
    if (challanType === 'OUTWARD') return supplierName;
    return department === 'OTHER' ? customDepartment : department;
  };

  const getDestinationType = (): string => {
    return challanType === 'OUTWARD' ? 'SUPPLIER' : 'DEPARTMENT';
  };

  // Validate a single line item
  const isLineItemValid = (item: LineItem): boolean => {
    if (!item.materialType) return false;
    if (!item.quantity || Number(item.quantity) <= 0) return false;

    if (item.stockType === 'GENERAL' && !item.materialId) return false;
    if (item.stockType === 'FABRIC' && !item.fabricStockId) return false;
    if (item.stockType === 'GREIGE' && !item.greigeStockId) return false;

    if (item.availableQty !== null && Number(item.quantity) > item.availableQty) return false;

    return true;
  };

  // Form-level validation
  const isFormValid = (): boolean => {
    if (!getDestinationName()) return false;
    if (lineItems.length === 0) return false;
    return lineItems.every(isLineItemValid);
  };

  // Get count of valid items for display
  const validItemCount = lineItems.filter(isLineItemValid).length;
  const totalQuantity = lineItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isFormValid()) {
      setError('Please fill in all required fields and ensure quantity does not exceed available stock for each item');
      return;
    }

    const destinationName = getDestinationName();

    // Build challan items from all line items
    const challanItems = lineItems.map((item) => {
      const qty = Number(item.quantity);
      const itemFoldLengthCm = item.foldLengthCm ? Number(item.foldLengthCm) : undefined;
      const itemThanCount = item.thanCount ? parseInt(item.thanCount) : undefined;

      if (item.stockType === 'GREIGE') {
        return {
          itemType: 'GREIGE',
          greigeStockId: item.greigeStockId,
          description: item.materialDescription,
          quantity: qty,
          unit: 'METER',
          foldLengthCm: itemFoldLengthCm,
          thanCount: itemThanCount,
        };
      } else if (item.stockType === 'FABRIC') {
        const fs = fabricStocks.find((f) => f.id === item.fabricStockId);
        return {
          itemType: 'FABRIC',
          fabricStockId: item.fabricStockId,
          fabricId: fs?.fabricId,
          description: item.materialDescription,
          quantity: qty,
          unit: 'METER',
          foldLengthCm: itemFoldLengthCm,
          thanCount: itemThanCount,
        };
      } else {
        // GENERAL stock
        return {
          itemType: 'TRIM',
          materialId: item.materialId,
          description: item.materialDescription,
          quantity: qty,
          unit: item.unit || 'PIECE',
        };
      }
    });

    // Build challan input with all items
    // Derive header unit from items (use first item's unit, or PCS as fallback)
    const headerUnit = challanItems.length > 0 ? challanItems[0].unit : 'PIECE';

    const input: CreateChallanInput = {
      challanType,
      challanDate,
      fromType: 'WAREHOUSE',
      fromName: 'Main Store', // Backend infers warehouse from stock items
      toType: getDestinationType(),
      toId: challanType === 'OUTWARD' ? supplierId : undefined,
      toName: destinationName,
      unit: headerUnit,
      remarks: remarks || undefined,
      items: challanItems,
    };

    try {
      setLoading(true);
      const challan = await challanService.quickIssueChallan(input);
      setSuccess(`Challan ${challan.challanNumber} created with ${lineItems.length} item(s) and issued successfully!`);
      setTimeout(() => navigate(`/manufacturing/challans`), 2000);
    } catch (err) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to create and issue challan. Stock may be insufficient.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <PageHeader title="Stock Out" />
      <p className="text-muted-foreground -mt-4 mb-4">Return materials to suppliers or transfer to departments</p>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 bg-success-muted text-success border-success/20">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        {/* Step 1: What are you issuing for? (Purpose-First) */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Step 1: What are you issuing for?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              {/* Purchase Return */}
              <button
                type="button"
                onClick={() => {
                  setIssuePurpose('PURCHASE_RETURN');
                  setChallanType('OUTWARD');
                  setSupplierId('');
                  setSupplierName('');
                }}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  issuePurpose === 'PURCHASE_RETURN'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Undo2 className="h-8 w-8 mb-2 text-orange-600" />
                <h3 className="font-semibold">Purchase Return</h3>
                <p className="text-sm text-muted-foreground">
                  Return materials to your material suppliers (defective, excess, wrong shipment)
                </p>
              </button>

              {/* Internal Issue */}
              <button
                type="button"
                onClick={() => {
                  setIssuePurpose('INTERNAL');
                  setChallanType('INTERNAL');
                  setDepartment('');
                }}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  issuePurpose === 'INTERNAL' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                <ArrowRightLeft className="h-8 w-8 mb-2 text-blue-600" />
                <h3 className="font-semibold">Internal Issue</h3>
                <p className="text-sm text-muted-foreground">
                  Transfer materials between departments (Cutting, Stitching, etc.)
                </p>
              </button>

              {/* Send for Processing */}
              <button
                type="button"
                onClick={() => setIssuePurpose('PROCESSING')}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  issuePurpose === 'PROCESSING'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Beaker className="h-8 w-8 mb-2 text-purple-600" />
                <h3 className="font-semibold">Send for Processing</h3>
                <p className="text-sm text-muted-foreground">Send greige/fabric to dyeing or printing mills</p>
              </button>
            </div>

            {/* Processing redirect banner */}
            {issuePurpose === 'PROCESSING' && (
              <Alert className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
                <Factory className="h-4 w-4 text-purple-600" />
                <AlertDescription className="flex items-center justify-between">
                  <span>
                    Processing issuance uses the <strong>Job Work Order</strong> workflow for proper job work tracking.
                  </span>
                  <Button type="button" onClick={() => navigate('/manufacturing/processing')} className="ml-4">
                    <Beaker className="h-4 w-4 mr-2" />
                    Go to Dyeing & Printing
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Warehouse selector + Date (only for non-processing purposes) */}
            {issuePurpose && issuePurpose !== 'PROCESSING' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="warehouseId">
                    <WarehouseIcon className="h-4 w-4 inline mr-1" />
                    Issue From Warehouse <span className="text-destructive">*</span>
                  </Label>
                  <WarehouseCombobox
                    value={warehouseId}
                    onValueChange={setWarehouseId}
                    placeholder="Select warehouse..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="challanDate">
                    Challan Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="challanDate"
                    type="date"
                    value={challanDate}
                    onChange={(e) => setChallanDate(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Stock deduction warning */}
            {issuePurpose && issuePurpose !== 'PROCESSING' && (
              <Alert className="mt-4 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <strong>Stock deducts immediately</strong> when you submit. The challan is created and issued in one
                  step.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Select Destination (Supplier for Purchase Return, Department for Internal) */}
        {issuePurpose && issuePurpose !== 'PROCESSING' && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                Step 2: {issuePurpose === 'PURCHASE_RETURN' ? 'Select Supplier to Return To' : 'Select Department'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* PURCHASE_RETURN: Supplier selection */}
              {issuePurpose === 'PURCHASE_RETURN' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Supplier Search (Primary) */}
                    <div className="space-y-2 md:col-span-2">
                      <Label>
                        Supplier <span className="text-destructive">*</span>
                      </Label>
                      <Combobox
                        options={supplierOptions}
                        value={supplierId}
                        onValueChange={handleSupplierChange}
                        placeholder="Search by name or code..."
                        searchPlaceholder="Type to search suppliers..."
                        emptyText="No material suppliers found"
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
                </>
              )}

              {/* INTERNAL: Department selection */}
              {challanType === 'INTERNAL' && (
                <div className="space-y-2 max-w-md">
                  <Label>
                    Destination: Department <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Select value={department} onValueChange={setDepartment}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                        <SelectItem value="OTHER">Other (Custom)</SelectItem>
                      </SelectContent>
                    </Select>
                    {department === 'OTHER' && (
                      <Input
                        placeholder="Enter department name"
                        value={customDepartment}
                        onChange={(e) => setCustomDepartment(e.target.value)}
                        className="flex-1"
                      />
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Add Items (multi-item support) */}
        {((challanType === 'OUTWARD' && supplierId) ||
          (challanType === 'INTERNAL' && (department || customDepartment))) && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Step 3: Add Items</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add{' '}
                  {challanType === 'OUTWARD' && hasSingleMaterialType
                    ? MATERIAL_TYPE_LABELS[allowedMaterialTypes[0]]
                    : 'Item'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Info message about allowed material types (OUTWARD only) */}
              {challanType === 'OUTWARD' && allowedMaterialTypes.length > 0 && (
                <Alert className="bg-muted/50 border-muted">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {hasSingleMaterialType ? (
                      <>
                        Issuing <strong>{MATERIAL_TYPE_LABELS[allowedMaterialTypes[0]]}</strong> to this supplier
                      </>
                    ) : (
                      <>
                        This supplier accepts:{' '}
                        <strong>{allowedMaterialTypes.map((t) => MATERIAL_TYPE_LABELS[t]).join(', ')}</strong>
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {lineItems.map((item, index) => {
                const filteredLevels = getFilteredStockLevels(item.materialType);
                const isFabricOrGreige = item.materialType === 'FABRIC' || item.materialType === 'GREIGE';

                // Build combobox options for fabric and general materials
                const fabricStockOptions: ComboboxOption[] = fabricStocks.map((fs) => ({
                  value: fs.id,
                  label: `${fs.fabricCode} - ${fs.fabricName}${fs.colorName ? ` (${fs.colorName})` : ''} — ${fs.quantityAvailable.toFixed(2)} MTR`,
                  searchText: `${fs.fabricCode} ${fs.fabricName} ${fs.colorName || ''}`,
                }));

                const generalMaterialOptions: ComboboxOption[] = filteredLevels.map((stock) => ({
                  value: stock.materialId,
                  label: `${stock.materials?.code} - ${stock.materials?.name} (${Number(stock.quantity).toFixed(2)} ${stock.unit})`,
                  searchText: `${stock.materials?.code || ''} ${stock.materials?.name || ''}`,
                }));

                // Determine which material types to show (all for INTERNAL, filtered for OUTWARD)
                const typesToShow =
                  challanType === 'OUTWARD' && allowedMaterialTypes.length > 0
                    ? allowedMaterialTypes
                    : (Object.keys(MATERIAL_TYPE_LABELS) as MaterialType[]);

                // Should we show tiles? Hide if OUTWARD with single material type
                const showTiles = challanType === 'INTERNAL' || (challanType === 'OUTWARD' && !hasSingleMaterialType);

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

                    {/* Material Type Tiles - Only show if multiple types allowed */}
                    {showTiles && (
                      <div className="space-y-2">
                        <Label>
                          Material Type <span className="text-destructive">*</span>
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {typesToShow.map((type) => {
                            const count = tileCounts[type] || 0;
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

                    {/* Item Selection based on stock type */}
                    {item.materialType && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Greige Stock Selection - Combobox */}
                        {item.stockType === 'GREIGE' && (
                          <div className="space-y-2 md:col-span-2">
                            <Label>
                              Greige Stock <span className="text-destructive">*</span>
                            </Label>
                            <Combobox
                              options={greigeStocks.map((gs) => ({
                                value: gs.id,
                                label: `${gs.greige.greigeCode} - ${gs.greige.greigeName}${gs.greige.construction ? ' / ' + gs.greige.construction : ''}${gs.greigeWidth ? ' / ' + gs.greigeWidth + '"' : ''} (${gs.greige.composition}) — ${Number(gs.quantityAvailable).toFixed(2)} MTR`,
                                searchText: `${gs.greige.greigeCode} ${gs.greige.greigeName} ${gs.greige.composition}`,
                              }))}
                              value={item.greigeStockId}
                              onValueChange={(v) => handleLineItemGreigeChange(item.tempId, v)}
                              placeholder="Search greige stock..."
                              searchPlaceholder="Type to search..."
                              emptyText="No greige available"
                            />
                          </div>
                        )}

                        {/* Fabric Stock Selection - Combobox */}
                        {item.stockType === 'FABRIC' && (
                          <div className="space-y-2 md:col-span-2">
                            <Label>
                              Fabric Stock <span className="text-destructive">*</span>
                            </Label>
                            <Combobox
                              options={fabricStockOptions}
                              value={item.fabricStockId}
                              onValueChange={(v) => handleLineItemFabricChange(item.tempId, v)}
                              placeholder="Search fabric stock..."
                              searchPlaceholder="Type to search..."
                              emptyText="No fabric available"
                            />
                          </div>
                        )}

                        {/* General Material Selection - Combobox */}
                        {item.stockType === 'GENERAL' && (
                          <div className="space-y-2 md:col-span-2">
                            <Label>
                              Material <span className="text-destructive">*</span>
                            </Label>
                            <Combobox
                              options={generalMaterialOptions}
                              value={item.materialId}
                              onValueChange={(v) => handleLineItemMaterialChange(item.tempId, v, item.materialType)}
                              placeholder="Search material..."
                              searchPlaceholder="Type to search..."
                              emptyText="No materials available"
                            />
                          </div>
                        )}

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
                          {item.availableQty !== null && Number(item.quantity) > item.availableQty && (
                            <p className="text-xs text-destructive">
                              Exceeds available ({item.availableQty.toFixed(2)})
                            </p>
                          )}
                        </div>

                        {/* Stock Info + Than/Fold fields for fabric/greige */}
                        {item.availableQty !== null && (
                          <div className="md:col-span-3">
                            <Alert className="bg-muted/50 border-muted py-2">
                              <Info className="h-3 w-3" />
                              <AlertDescription className="text-xs">
                                Available: {item.availableQty.toFixed(2)} {item.unit}
                                {item.rate ? ` | Rate: ₹${item.rate.toFixed(2)}/${item.unit}` : ''}
                              </AlertDescription>
                            </Alert>
                          </div>
                        )}

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
                          </>
                        )}
                      </div>
                    )}

                    {/* Item validation indicator */}
                    {item.materialType && (
                      <div className="text-xs">
                        {isLineItemValid(item) ? (
                          <span className="text-green-600">Item valid</span>
                        ) : (
                          <span className="text-muted-foreground">Select material and enter quantity</span>
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
                  Add Another{' '}
                  {challanType === 'OUTWARD' && hasSingleMaterialType
                    ? MATERIAL_TYPE_LABELS[allowedMaterialTypes[0]]
                    : 'Item'}
                </Button>
              </div>

              {/* Remarks */}
              <div className="space-y-2 pt-2">
                <Label>Remarks</Label>
                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  placeholder="Reason for issuance, processing details, etc."
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
          <Button type="submit" disabled={loading || !isFormValid()}>
            {loading ? <ButtonSpinner className="mr-2" /> : <Send className="mr-2 h-4 w-4" />}
            Issue {validItemCount} Item{validItemCount !== 1 ? 's' : ''} via Challan
          </Button>
        </div>
      </form>
    </div>
  );
}
