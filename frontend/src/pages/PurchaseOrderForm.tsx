import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SupplierCombobox } from '@/components/SupplierCombobox';
import { WarehouseCombobox } from '@/components/WarehouseCombobox';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { getAllMaterials } from '@/services/material.service';
import { getSupplierById } from '@/services/supplier.service';
import { warehouseService } from '@/services/warehouse.service';
import { getAllStyles } from '@/services/style.service';
import { getAllOrders } from '@/services/order.service';
import { cadPlanningService } from '@/services/cad-planning.service';
import { getStyleBOM } from '@/services/style-material-bom.service';
import { greigeService } from '@/services/fabricGreigeService';
import type { GreigeMaster } from '@/types/fabric-greige.types';
import type { CADTableData, CADSpreadsheetRow } from '@/types/cad-planning.types';
import type { StyleBOMResponse, StyleBOMEntry } from '@/types/style-material-bom.types';
import {
  createPurchaseOrder,
  getPurchaseOrderById,
  updatePurchaseOrder,
  sendPurchaseOrder,
} from '@/services/purchaseOrder.service';
import type {
  CreatePurchaseOrderRequest,
  CreatePurchaseOrderItemRequest,
  Unit,
  SupplierSummary,
} from '@/types/purchaseOrder.types';
import { PO_CATEGORY_LABELS, PO_CATEGORY_COLORS, PO_GROUP_CATEGORIES } from '@/types/purchaseOrder.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency } from '@/lib/currency';
import { processorRateCardV2Service } from '@/services/processorRateCardV2.service';
import type { GreigeForRateCard, PrintingTypeV2 } from '@/types/processorRateCardV2.types';
import { Trash2, Plus, Send, Save, ArrowLeft, Lock, X, Info, Eye, Check, FileText, Building2 } from 'lucide-react';
import { COMPANY_CONFIG, getCompanyFullAddress } from '@/config/company.config';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Warehouse } from '@/types/inventory.types';

// ============================================
// PO Category → Supplier Category Mapping
// ============================================

const PO_CATEGORY_TO_SUPPLIER_CATEGORY: Record<string, string | undefined> = {
  FABRIC: 'FABRIC_SUPPLIER',
  GREIGE: 'GREIGE_SUPPLIER',
  TRIMS: 'TRIMS_SUPPLIER',
  LACE: 'LACE_SUPPLIER',
  GREIGE_LACE: 'LACE_SUPPLIER',
  PROCESSING: 'DYEING_PRINTING',
  LACE_PROCESSING: 'DYEING_PRINTING',
  EMBROIDERY_SERVICE: 'EMBROIDERY',
  WASHING_SERVICE: 'WASHING',
  FINISHING_SERVICE: 'FINISHING_CONTRACTOR',
  CUTTING_SERVICE: 'CMT_UNIT',
  STITCHING_SERVICE: 'STITCHING_CONTRACTOR',
  HANDWORK_SERVICE: 'HAND_WORK',
  SMOCKING_SERVICE: 'SMOCKING',
  TRANSPORTATION_SERVICE: 'OTHER_SERVICES',
  GENERAL: undefined,
};

const PO_CATEGORY_TO_SERVICE_TYPE: Record<string, string> = {
  EMBROIDERY_SERVICE: 'EMBROIDERY',
  WASHING_SERVICE: 'WASHING',
  FINISHING_SERVICE: 'FINISHING',
  CUTTING_SERVICE: 'CUTTING',
  STITCHING_SERVICE: 'STITCHING',
  HANDWORK_SERVICE: 'HANDWORK',
  SMOCKING_SERVICE: 'SMOCKING',
  TRANSPORTATION_SERVICE: 'TRANSPORTATION',
  PROCESSING: 'DYEING',
  LACE_PROCESSING: 'DYEING',
};

// PO Category → Material Types mapping
// Used to show materials matching the PO category type (OR-combined with supplier filter)
const PO_CATEGORY_TO_MATERIAL_TYPES: Record<string, string[] | undefined> = {
  GREIGE: ['GREIGE'],
  FABRIC: ['FABRIC'],
  TRIMS: [
    'TRIMS',
    'BUTTON',
    'ZIPPER',
    'ELASTIC',
    'HOOK_EYE',
    'SNAP_BUTTON',
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
  ],
  LACE: ['LACE'],
  GREIGE_LACE: ['LACE'],
  GENERAL: undefined, // no type filter — show all
};

// ============================================
// Types
// ============================================

type Supplier = SupplierSummary;

interface Material {
  id: string;
  code: string;
  name: string;
  materialType: string;
  unit: string | null;
  costPerUnit: number | null;
  hsnCode?: string | null;
  gstRate?: number | null;
}

interface POItemForm {
  tempId: string;
  // Material fields (for material POs)
  materialId?: string;
  materialCode?: string;
  materialName?: string;
  // Service fields (for service/processing POs)
  serviceType?: string;
  serviceDescription?: string;
  // Common
  orderedQuantity: string;
  unit: Unit;
  unitPrice: string;
  totalPrice: number;
  remarks: string;
  // HSN & Tax (for preview/invoice)
  hsnCode?: string;
  gstRate?: number;
  // Source & CAD info
  source?: 'CAD' | 'BOM' | 'MRP' | 'MANUAL';
  cadAverage?: number;
  // Greige-specific
  foldLengthCm?: string; // "L" - fold length in cm
}

// ============================================
// Helpers
// ============================================

function isProcessingCategory(category: string): boolean {
  return PO_GROUP_CATEGORIES.processing.includes(category);
}

function isServiceCategory(category: string): boolean {
  // Pure services only — processing has its own flow
  return PO_GROUP_CATEGORIES.service.includes(category);
}

function isMaterialCategory(category: string): boolean {
  return PO_GROUP_CATEGORIES.material.includes(category);
}

function getDefaultUnit(category: string): Unit {
  // Material categories
  if (category === 'GREIGE' || category === 'FABRIC') return 'METER';
  if (category === 'LACE' || category === 'GREIGE_LACE') return 'METER';
  // Processing categories
  if (PO_GROUP_CATEGORIES.processing.includes(category)) return 'METER';
  // Service categories
  if (PO_GROUP_CATEGORIES.service.includes(category)) return 'PIECE';
  // Default for TRIMS and GENERAL
  return 'PIECE';
}

// Get approved CAD rows that have greige info (for Processing PO creation)
function getApprovedCADRowsWithGreige(cadData: CADTableData | null): CADSpreadsheetRow[] {
  if (!cadData?.cadRows) return [];
  return cadData.cadRows.filter(
    (row) =>
      row.greigeId && row.greigeName && row.approvalStatus === 'APPROVED' && row.purpose === 'RAW_MATERIAL_CALCULATION'
  );
}

// ============================================
// Item Pre-population Helpers
// ============================================

function createGreigeItem(row: CADSpreadsheetRow, calculatedQty: number | null): POItemForm {
  return {
    tempId: Date.now().toString(),
    materialId: row.greigeId || undefined,
    materialCode: undefined,
    materialName: row.greigeName || 'Greige Fabric',
    orderedQuantity: calculatedQty ? String(calculatedQty) : '0',
    unit: 'METER',
    unitPrice: '0',
    totalPrice: 0,
    remarks: `Width: ${row.cutableWidth || '-'}"`,
  };
}

function createProcessingItem(row: CADSpreadsheetRow, calculatedQty: number | null): POItemForm {
  return {
    tempId: Date.now().toString(),
    materialId: row.greigeId || undefined,
    materialCode: undefined,
    materialName: row.greigeName || 'Greige Fabric',
    serviceType: 'DYEING',
    serviceDescription: `Process ${row.greigeName || 'fabric'} (${row.cutableWidth || '-'}" width)`,
    orderedQuantity: calculatedQty ? String(calculatedQty) : '0',
    unit: 'METER',
    unitPrice: '0',
    totalPrice: 0,
    remarks: '',
  };
}

function createTrimItem(bomItem: StyleBOMEntry, calculatedQty: number | null): POItemForm {
  const price = parseFloat(bomItem.unitPrice) || 0;
  const qty = calculatedQty || 0;
  return {
    tempId: Date.now().toString(),
    materialId: undefined, // BOM entry doesn't have materialId, only materialCode
    materialCode: bomItem.materialCode || undefined,
    materialName: bomItem.materialName || 'Material',
    orderedQuantity: calculatedQty ? String(Math.ceil(calculatedQty)) : '0',
    unit: (bomItem.unit as Unit) || 'PIECE',
    unitPrice: String(price),
    totalPrice: qty * price,
    remarks: '',
  };
}

// ============================================
// Component
// ============================================

export default function PurchaseOrderForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [poCategory, setPoCategory] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState<POItemForm[]>([]);
  // Delivery location state (warehouse ID - can be any warehouse including processor locations)
  const [deliveryLocationId, setDeliveryLocationId] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);

  // For material PO item adding
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
  // For PO preview modal
  const [showPreview, setShowPreview] = useState(false);
  const [materialSearch, setMaterialSearch] = useState('');
  const [quickAddMaterialId, setQuickAddMaterialId] = useState('');
  const [materialDisplayLimit, setMaterialDisplayLimit] = useState(50);

  // AbortController for cancelling stale fetch requests
  const fetchAbortControllerRef = useRef<AbortController | null>(null);
  // Track current supplier for race condition protection
  const currentSupplierIdRef = useRef<string>('');

  // Processing PO state
  const [processingType, setProcessingType] = useState<'DYEING' | 'PRINTING'>('DYEING');
  const [printingType, setPrintingType] = useState('');
  const [greigeFabrics, setGreigeFabrics] = useState<GreigeForRateCard[]>([]);
  const [isLoadingGreiges, setIsLoadingGreiges] = useState(false);

  // Manual GREIGE PO state (when no style selected)
  const [greigeMasters, setGreigeMasters] = useState<GreigeMaster[]>([]);
  const [isLoadingGreigeMasters, setIsLoadingGreigeMasters] = useState(false);

  // Traceability state (optional links for Manual POs)
  const [styleId, setStyleId] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');
  const [styles, setStyles] = useState<
    Array<{ id: string; styleCode: string; styleName: string; buyerStyleRef?: string | null; cadStatus?: string }>
  >([]);
  const [orders, setOrders] = useState<
    Array<{
      id: string;
      orderNumber: string;
      customerName?: string;
      styleCodes?: string[];
      buyerStyleRefs?: string[];
    }>
  >([]);
  const [isLoadingStyles, setIsLoadingStyles] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  // CAD data for selected style (enables Processing PO creation from approved CAD)
  const [styleCADData, setStyleCADData] = useState<CADTableData | null>(null);
  const [isLoadingCAD, setIsLoadingCAD] = useState(false);

  // BOM data for selected style (trims, packaging, etc.)
  const [styleBOMData, setStyleBOMData] = useState<StyleBOMResponse | null>(null);
  const [isLoadingBOM, setIsLoadingBOM] = useState(false);

  // Quantity input mode for style materials
  const [quantityMode, setQuantityMode] = useState<'order' | 'direct'>('direct');
  const [orderQuantity, setOrderQuantity] = useState<number>(0);
  const [directQuantity, setDirectQuantity] = useState<number>(0); // Direct quantity in meters/pieces

  // Category lock state - when user clicks a material PO button, category is locked
  const [isCategoryLocked, setIsCategoryLocked] = useState(false);
  const [lockedMaterialName, setLockedMaterialName] = useState<string>('');

  // Auth state for gating API calls
  const token = useAuthStore((state) => state.token);

  const isProcessing = isProcessingCategory(poCategory);
  const isService = isServiceCategory(poCategory);
  const isMaterial = isMaterialCategory(poCategory);

  useEffect(() => {
    if (isEditMode && id) {
      fetchPurchaseOrder(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEditMode]);

  // Fetch styles on mount (for traceability) - only when authenticated
  // Filter to ACTIVE styles only, include cadStatus for Processing PO detection
  useEffect(() => {
    if (!token) return; // Wait for auth
    const fetchStyles = async () => {
      setIsLoadingStyles(true);
      try {
        // Pass status='ACTIVE' to filter out DRAFT styles
        const response = await getAllStyles(1, 500, undefined, undefined, undefined, undefined, 'ACTIVE');
        setStyles(
          response.data.map(
            (s: {
              id: string;
              styleCode: string;
              styleName: string;
              buyerStyleRef?: string | null;
              cadStatus?: string;
            }) => ({
              id: s.id,
              styleCode: s.styleCode,
              styleName: s.styleName,
              buyerStyleRef: s.buyerStyleRef,
              cadStatus: s.cadStatus,
            })
          )
        );
      } catch {
        // Silently fail - styles are optional for traceability
        setStyles([]);
      } finally {
        setIsLoadingStyles(false);
      }
    };
    fetchStyles();
  }, [token]);

  // Fetch CAD data when style is selected (for Processing PO creation from approved CAD)
  useEffect(() => {
    if (!styleId || !token) {
      setStyleCADData(null);
      return;
    }
    const fetchCADData = async () => {
      setIsLoadingCAD(true);
      try {
        const response = await cadPlanningService.getCADTableData(styleId);
        setStyleCADData(response.data);
      } catch {
        // Style may not have CAD data - that's OK
        setStyleCADData(null);
      } finally {
        setIsLoadingCAD(false);
      }
    };
    fetchCADData();
  }, [styleId, token]);

  // Fetch BOM data when style is selected (trims, packaging, etc.)
  useEffect(() => {
    if (!styleId || !token) {
      setStyleBOMData(null);
      return;
    }
    const fetchBOMData = async () => {
      setIsLoadingBOM(true);
      try {
        const response = await getStyleBOM(styleId);
        setStyleBOMData(response);
      } catch {
        // Style may not have BOM data - that's OK
        setStyleBOMData(null);
      } finally {
        setIsLoadingBOM(false);
      }
    };
    fetchBOMData();
  }, [styleId, token]);

  // Fetch orders (for traceability) - only when authenticated
  useEffect(() => {
    if (!token) return; // Wait for auth
    const fetchOrdersList = async () => {
      setIsLoadingOrders(true);
      try {
        const response = await getAllOrders({ limit: 100 });
        setOrders(
          response.data.map(
            (o: {
              id: string;
              orderNumber: string;
              customer?: { name: string };
              orderItems?: Array<{ style?: { styleCode?: string; buyerStyleRef?: string | null } }>;
            }) => {
              // Extract unique style codes from order items
              const styleCodes =
                o.orderItems
                  ?.map((item) => item.style?.styleCode)
                  .filter((code): code is string => !!code)
                  .filter((code, index, self) => self.indexOf(code) === index) || [];

              // Extract unique buyer style refs from order items
              const buyerStyleRefs =
                o.orderItems
                  ?.map((item) => item.style?.buyerStyleRef)
                  .filter((ref): ref is string => !!ref)
                  .filter((ref, index, self) => self.indexOf(ref) === index) || [];

              return {
                id: o.id,
                orderNumber: o.orderNumber,
                customerName: o.customer?.name,
                styleCodes,
                buyerStyleRefs,
              };
            }
          )
        );
      } catch {
        // Silently fail - orders are optional for traceability
        setOrders([]);
      } finally {
        setIsLoadingOrders(false);
      }
    };
    fetchOrdersList();
  }, [token]);

  // Fetch materials when supplier changes (for material POs)
  // Uses OR logic: materials linked to supplier OR matching the PO category's material types
  const fetchMaterials = async (forSupplierId?: string, skipSupplierFilter = false) => {
    // Cancel any previous fetch request to prevent race conditions
    if (fetchAbortControllerRef.current) {
      fetchAbortControllerRef.current.abort();
    }
    fetchAbortControllerRef.current = new AbortController();
    const currentController = fetchAbortControllerRef.current;

    setIsLoadingMaterials(true);
    setMaterialDisplayLimit(50); // Reset pagination when fetching new materials
    try {
      const types = PO_CATEGORY_TO_MATERIAL_TYPES[poCategory];
      const response = await getAllMaterials({
        limit: 500, // Increased limit to get more materials
        supplierId: skipSupplierFilter ? undefined : forSupplierId || undefined,
        materialTypes: types ? types.join(',') : undefined,
      });
      // Only update state if this request wasn't aborted
      if (!currentController.signal.aborted) {
        setMaterials(response.data as unknown as Material[]);
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') return;
      if (!currentController.signal.aborted) {
        handleApiError(err, 'Failed to load materials', false);
      }
    } finally {
      if (!currentController.signal.aborted) {
        setIsLoadingMaterials(false);
      }
    }
  };

  // Fetch greige fabrics for processing POs
  const fetchGreigeFabrics = async () => {
    setIsLoadingGreiges(true);
    try {
      const greiges = await processorRateCardV2Service.getGreigeFabrics();
      setGreigeFabrics(greiges);
    } catch (err) {
      handleApiError(err, 'Failed to load greige fabrics', false);
    } finally {
      setIsLoadingGreiges(false);
    }
  };

  // Fetch greige masters for manual GREIGE POs (when no style selected)
  const fetchGreigeMasters = async () => {
    setIsLoadingGreigeMasters(true);
    try {
      const response = await greigeService.getAll({ limit: 100, isActive: 'true' });
      setGreigeMasters(response.data);
    } catch (err) {
      handleApiError(err, 'Failed to load greige masters', false);
    } finally {
      setIsLoadingGreigeMasters(false);
    }
  };

  // Fetch greige masters when in manual GREIGE mode (no style selected)
  useEffect(() => {
    if ((poCategory === 'GREIGE' || poCategory === 'FABRIC') && !styleId && token) {
      fetchGreigeMasters();
    } else {
      setGreigeMasters([]);
    }
  }, [poCategory, styleId, token]);

  // Fetch warehouse details when delivery location changes
  useEffect(() => {
    const fetchWarehouse = async () => {
      if (!deliveryLocationId) {
        setSelectedWarehouse(null);
        return;
      }
      try {
        const warehouse = await warehouseService.getById(deliveryLocationId);
        setSelectedWarehouse(warehouse);
      } catch (err) {
        console.error('Failed to fetch warehouse:', err);
        setSelectedWarehouse(null);
      }
    };
    fetchWarehouse();
  }, [deliveryLocationId]);

  const fetchPurchaseOrder = async (poId: string) => {
    try {
      setIsLoading(true);
      const po = await getPurchaseOrderById(poId);

      // Set category from loaded PO
      if (po.poCategory) {
        setPoCategory(po.poCategory);
      }

      setSupplierId(po.supplierId);
      if (po.supplier && typeof po.supplier === 'object' && 'id' in po.supplier && 'code' in po.supplier) {
        setSelectedSupplier(po.supplier as Supplier);
      }
      setExpectedDeliveryDate(po.expectedDeliveryDate.split('T')[0]);
      setRemarks(po.remarks || '');

      // Load traceability links
      if (po.styleId) setStyleId(po.styleId);
      if (po.orderId) setOrderId(po.orderId);

      if (po.items && po.items.length > 0) {
        const loadedItems: POItemForm[] = po.items.map((item, index) => ({
          tempId: `existing-${item.id}-${index}`,
          materialId: item.materialId || undefined,
          materialCode: item.materials?.code || '',
          materialName: item.materials?.name || '',
          serviceType: item.serviceType || undefined,
          serviceDescription: item.serviceDescription || '',
          orderedQuantity: String(item.orderedQuantity),
          unit: item.unit,
          unitPrice: String(item.unitPrice),
          totalPrice: item.totalPrice,
          remarks: item.remarks || '',
        }));
        setItems(loadedItems);
      }

      // Fetch materials filtered by supplier for material POs
      if (po.supplierId) {
        fetchMaterials(po.supplierId);
      }
    } catch (err) {
      handleApiError(err, 'Failed to load purchase order');
      navigate('/procurement/purchase-orders');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategoryChange = (newCategory: string) => {
    setPoCategory(newCategory);
    // Reset downstream: supplier, items, materials, processing state
    setSupplierId('');
    setSelectedSupplier(null);
    setItems([]);
    setMaterials([]);
    setQuickAddMaterialId('');
    setProcessingType('DYEING');
    setPrintingType('');
    setGreigeFabrics([]);
    // Reset category lock (manual category selection unlocks it)
    setIsCategoryLocked(false);
    setLockedMaterialName('');
  };

  // Handle clearing the style selection (reset to manual mode)
  const handleClearStyle = () => {
    setStyleId('');
    setStyleCADData(null);
    setStyleBOMData(null);
    setIsCategoryLocked(false);
    setLockedMaterialName('');
    setItems([]);
    setPoCategory('');
    setSupplierId('');
    setSelectedSupplier(null);
    setOrderQuantity(0);
    setQuantityMode('direct');
  };

  // Handle material PO button click - sets category and locks it
  const handleMaterialPOClick = (category: string, item: POItemForm, materialName: string) => {
    setPoCategory(category);
    setIsCategoryLocked(true);
    setLockedMaterialName(materialName);
    setSupplierId('');
    setSelectedSupplier(null);
    setItems([item]);
  };

  const handleSupplierChange = async (newSupplierId: string) => {
    // Update ref immediately for race condition protection
    currentSupplierIdRef.current = newSupplierId;
    setSupplierId(newSupplierId);
    setItems([]);
    setMaterials([]);

    if (!newSupplierId) {
      setSelectedSupplier(null);
      return;
    }

    // Fetch supplier details with race condition protection
    try {
      const supplier = await getSupplierById(newSupplierId);
      // Only update state if this supplier is still the selected one
      if (currentSupplierIdRef.current === newSupplierId) {
        setSelectedSupplier(supplier as unknown as Supplier);
      }
    } catch (err) {
      console.error('Failed to fetch supplier details:', err);
    }

    // Fetch materials filtered by this supplier (for material POs)
    if (isMaterial) {
      fetchMaterials(newSupplierId);
    }

    // Fetch greige fabrics for processing POs
    if (isProcessing) {
      fetchGreigeFabrics();
    }
  };

  // ============================================
  // Material item management
  // ============================================

  const addMaterialItem = (material: Material) => {
    const newItem: POItemForm = {
      tempId: Date.now().toString(),
      materialId: material.id,
      materialCode: material.code,
      materialName: material.name,
      orderedQuantity: '1',
      unit: (material.unit as Unit) || 'PIECE',
      unitPrice: String(material.costPerUnit || 0),
      totalPrice: material.costPerUnit || 0,
      remarks: '',
    };
    setItems([...items, newItem]);
    setShowMaterialPicker(false);
    setMaterialSearch('');
  };

  const handleQuickAddMaterial = (materialId: string) => {
    const material = materials.find((m) => m.id === materialId);
    if (material) {
      addMaterialItem(material);
      setQuickAddMaterialId('');
    }
  };

  // ============================================
  // Service item management
  // ============================================

  const addServiceItem = () => {
    const serviceType = PO_CATEGORY_TO_SERVICE_TYPE[poCategory] || '';
    const defaultUnit = getDefaultUnit(poCategory);
    const newItem: POItemForm = {
      tempId: Date.now().toString(),
      serviceType,
      serviceDescription: '',
      orderedQuantity: '1',
      unit: defaultUnit,
      unitPrice: '0',
      totalPrice: 0,
      remarks: '',
    };
    setItems([...items, newItem]);
  };

  // ============================================
  // ============================================
  // Manual Greige item management (no style selected)
  // ============================================

  const addGreigeMasterItem = (greigeId: string) => {
    const greige = greigeMasters.find((g) => g.id === greigeId);
    if (!greige) return;

    // Allow multiple items with same greige (user might want different quantities at different prices)
    const newItem: POItemForm = {
      tempId: Date.now().toString(),
      materialId: greige.id,
      materialCode: greige.greigeCode,
      materialName: `${greige.greigeName} (${greige.greigeWidth}")`,
      orderedQuantity: '1',
      unit: 'METER',
      unitPrice: greige.costPerMeter ? String(greige.costPerMeter) : '0',
      totalPrice: greige.costPerMeter || 0,
      remarks: `Shrinkage: ${greige.averageShrinkagePercent}%`,
    };
    setItems((prev) => [...prev, newItem]);
  };

  // Processing item management
  // ============================================

  const addProcessingItem = (greigeId: string) => {
    const greige = greigeFabrics.find((g) => g.id === greigeId);
    if (!greige) return;

    // Prevent duplicate greige
    if (items.some((i) => i.materialId === greigeId)) return;

    const newItem: POItemForm = {
      tempId: Date.now().toString(),
      materialId: greige.id,
      materialCode: greige.greigeCode,
      materialName: greige.greigeName,
      serviceType: processingType,
      serviceDescription: '',
      orderedQuantity: '1',
      unit: 'METER',
      unitPrice: '0',
      totalPrice: 0,
      remarks: '',
    };
    setItems((prev) => [...prev, newItem]);

    // Auto-lookup rate from processor rate card
    lookupProcessingRate(newItem.tempId, greige.id, 1);
  };

  const lookupProcessingRate = async (tempId: string, greigeId: string, quantity: number) => {
    if (!supplierId || !greigeId || quantity <= 0) return;
    try {
      const result = await processorRateCardV2Service.lookupRate(
        supplierId,
        processingType,
        greigeId,
        quantity,
        processingType === 'PRINTING' ? (printingType as PrintingTypeV2) : undefined
      );
      if (result && result.ratePerMeter > 0) {
        setItems((prev) =>
          prev.map((item) => {
            if (item.tempId !== tempId) return item;
            const rate = result.ratePerMeter;
            const qty = parseFloat(item.orderedQuantity) || 0;
            return {
              ...item,
              unitPrice: String(rate),
              totalPrice: qty * rate,
            };
          })
        );
      } else {
        // No rate found in rate card - notify user
        handleApiError(
          new Error('No rate found for this processor/greige combination. Please enter the rate manually.'),
          'Rate Lookup',
          false
        );
      }
    } catch (err) {
      // Rate lookup failed - notify user to enter manually
      handleApiError(
        new Error('Could not fetch processor rate. Please enter the rate manually.'),
        'Rate Lookup Failed',
        false
      );
    }
  };

  // ============================================
  // Common item management
  // ============================================

  const removeItem = (tempId: string) => {
    setItems(items.filter((item) => item.tempId !== tempId));
  };

  const updateItem = (tempId: string, field: keyof POItemForm, value: string | number) => {
    setItems(
      items.map((item) => {
        if (item.tempId !== tempId) return item;

        const updatedItem = { ...item, [field]: value };

        if (field === 'orderedQuantity' || field === 'unitPrice') {
          const qty = parseFloat(String(updatedItem.orderedQuantity)) || 0;
          const price = parseFloat(String(updatedItem.unitPrice)) || 0;
          updatedItem.totalPrice = qty * price;
        }

        return updatedItem;
      })
    );

    // Re-lookup rate when quantity changes for processing items
    if (isProcessing && field === 'orderedQuantity') {
      const item = items.find((i) => i.tempId === tempId);
      if (item?.materialId) {
        const qty = parseFloat(String(value)) || 0;
        if (qty > 0) {
          lookupProcessingRate(tempId, item.materialId, qty);
        }
      }
    }
  };

  const calculateGrandTotal = () => {
    return items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  };

  // ============================================
  // Validation & Submit
  // ============================================

  const validateForm = (): boolean => {
    if (!poCategory) {
      handleApiError(new Error('Please select a PO category'), 'Validation Error');
      return false;
    }
    if (!supplierId) {
      handleApiError(new Error('Please select a supplier'), 'Validation Error');
      return false;
    }
    if (!expectedDeliveryDate) {
      handleApiError(new Error('Please enter expected delivery date'), 'Validation Error');
      return false;
    }
    if (items.length === 0) {
      handleApiError(new Error('Please add at least one item'), 'Validation Error');
      return false;
    }
    if (isProcessing && processingType === 'PRINTING' && !printingType) {
      handleApiError(new Error('Please select a printing type'), 'Validation Error');
      return false;
    }
    for (const item of items) {
      if (isMaterial && !item.materialId) {
        handleApiError(new Error('Please select a material for all items'), 'Validation Error');
        return false;
      }
      if (isProcessing && !item.materialId) {
        handleApiError(new Error('Please select a greige fabric for all processing items'), 'Validation Error');
        return false;
      }
      if (isService && !item.serviceDescription?.trim()) {
        handleApiError(new Error('Please enter a description for all service items'), 'Validation Error');
        return false;
      }
      if (!item.orderedQuantity || parseFloat(item.orderedQuantity) <= 0) {
        handleApiError(
          new Error(`Please enter valid quantity for ${item.materialName || item.serviceDescription || 'item'}`),
          'Validation Error'
        );
        return false;
      }
      if (!item.unitPrice || parseFloat(item.unitPrice) <= 0) {
        handleApiError(
          new Error(`Please enter a valid unit price for ${item.materialName || item.serviceDescription || 'item'}`),
          'Validation Error'
        );
        return false;
      }
    }
    return true;
  };

  const handleSave = async (shouldSend: boolean = false) => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const itemsData: CreatePurchaseOrderItemRequest[] = items.map((item) => ({
        materialId: item.materialId || undefined,
        serviceType: item.serviceType || undefined,
        serviceDescription: item.serviceDescription || undefined,
        orderedQuantity: parseFloat(item.orderedQuantity),
        unit: item.unit,
        unitPrice: parseFloat(item.unitPrice),
        remarks: item.remarks || undefined,
        foldLengthCm: item.foldLengthCm ? parseFloat(item.foldLengthCm) : undefined,
      }));

      const data: CreatePurchaseOrderRequest = {
        supplierId,
        expectedDeliveryDate,
        poCategory: poCategory || undefined,
        paymentTerms: selectedSupplier?.paymentTerms || undefined,
        remarks: remarks || undefined,
        items: itemsData,
        // Optional traceability links
        styleId: styleId || null,
        orderId: orderId || null,
        // Delivery location (points to any warehouse, including processor locations)
        deliveryLocationId: deliveryLocationId || null,
      };

      let savedPO;
      if (isEditMode && id) {
        savedPO = await updatePurchaseOrder(id, {
          supplierId,
          expectedDeliveryDate,
          paymentTerms: selectedSupplier?.paymentTerms || undefined,
          remarks: remarks || undefined,
          items: itemsData,
          // Optional traceability links
          styleId: styleId || null,
          orderId: orderId || null,
        });
        handleApiSuccess('Purchase order updated', `PO ${savedPO.poNumber} has been updated.`);
      } else {
        savedPO = await createPurchaseOrder(data);
        handleApiSuccess('Purchase order created', `PO ${savedPO.poNumber} has been created.`);
      }

      if (shouldSend && savedPO) {
        await sendPurchaseOrder(savedPO.id);
        handleApiSuccess('Purchase order sent', `PO ${savedPO.poNumber} has been sent to supplier.`);
      }

      navigate('/procurement/purchase-orders');
    } catch (err) {
      handleApiError(err, 'Failed to save purchase order');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredMaterials = materials.filter(
    (m) =>
      m.code.toLowerCase().includes(materialSearch.toLowerCase()) ||
      m.name.toLowerCase().includes(materialSearch.toLowerCase())
  );

  // Material options for Quick Add Combobox (derived from form's materials state)
  const materialOptions: ComboboxOption[] = materials.map((m) => ({
    value: m.id,
    label: `${m.code} - ${m.name}`,
    searchText: `${m.code} ${m.name} ${m.materialType || ''}`,
  }));

  // Greige options for Processing PO Combobox
  const greigeOptions: ComboboxOption[] = greigeFabrics.map((g) => ({
    value: g.id,
    label: `${g.greigeCode} - ${g.greigeName}`,
    searchText: `${g.greigeCode} ${g.greigeName} ${g.composition || ''} ${g.genericGreigeName || ''}`,
  }));

  // Greige master options for manual GREIGE PO Combobox (when no style selected)
  const greigeMasterOptions: ComboboxOption[] = greigeMasters.map((g) => ({
    value: g.id,
    label: `${g.greigeCode} - ${g.greigeName} (${g.greigeWidth}")`,
    searchText: `${g.greigeCode} ${g.greigeName} ${g.composition || ''} ${g.genericGreigeName || ''} ${g.greigeWidth}`,
  }));

  // Check if we're in manual greige mode (GREIGE category without style)
  const isManualGreigeMode = (poCategory === 'GREIGE' || poCategory === 'FABRIC') && !styleId;

  // ============================================
  // Render
  // ============================================

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">Loading...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/procurement/purchase-orders')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-display font-medium">
            {isEditMode ? 'Edit Purchase Order' : 'Create Purchase Order'}
          </h1>
          {poCategory && (
            <Badge className={PO_CATEGORY_COLORS[poCategory] || 'bg-muted text-foreground'}>
              {PO_CATEGORY_LABELS[poCategory] || poCategory}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/procurement/purchase-orders')}>
            Cancel
          </Button>
        </div>
      </div>

      {/* Style Selection - Prominent, First Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <span className="text-lg">🏷️</span>
              Link to Style
              <Badge variant="outline" className="text-xs font-normal">
                Recommended
              </Badge>
            </CardTitle>
            {styleId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearStyle}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4 mr-1" />
                Clear Style
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Combobox
                options={styles.map((s) => ({
                  value: s.id,
                  label: s.buyerStyleRef
                    ? `${s.styleCode} (${s.buyerStyleRef}) - ${s.styleName}`
                    : `${s.styleCode} - ${s.styleName}`,
                  searchText: `${s.styleCode} ${s.styleName} ${s.buyerStyleRef || ''}`,
                }))}
                value={styleId}
                onValueChange={setStyleId}
                placeholder={isLoadingStyles ? 'Loading styles...' : 'Search and select a style...'}
                searchPlaceholder="Search by code or name..."
                emptyText={isLoadingStyles ? 'Loading...' : 'No styles found.'}
                disabled={isLoadingStyles}
              />
            </div>
            <div className="flex-1">
              <Combobox
                options={orders.map((o) => {
                  const styleDisplay = o.styleCodes?.length ? ` [${o.styleCodes.join(', ')}]` : '';
                  return {
                    value: o.id,
                    label: `${o.orderNumber}${styleDisplay}${o.customerName ? ` - ${o.customerName}` : ''}`,
                    searchText: `${o.orderNumber} ${o.styleCodes?.join(' ') || ''} ${o.buyerStyleRefs?.join(' ') || ''} ${o.customerName || ''}`,
                  };
                })}
                value={orderId}
                onValueChange={setOrderId}
                placeholder={isLoadingOrders ? 'Loading orders...' : 'Link to order (optional)...'}
                searchPlaceholder="Search by order number or style..."
                emptyText={isLoadingOrders ? 'Loading...' : 'No orders found.'}
                disabled={isLoadingOrders}
              />
            </div>
          </div>
          {!styleId && (
            <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
              <Info className="h-4 w-4" />
              <span>Select a style to see required materials and create POs automatically</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Style Materials - Shown when style is selected */}
      {styleId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <span className="text-lg">📦</span>
              Materials Required
              {(isLoadingCAD || isLoadingBOM) && (
                <span className="text-sm font-normal text-muted-foreground">Loading...</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quantity Input - Dual Mode */}
            {!isLoadingCAD && !isLoadingBOM && (
              <>
                <div className="p-3 bg-muted/50 border rounded-lg">
                  <Label className="text-sm font-medium mb-2 block">Calculate Material Quantity</Label>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="qty-direct-top"
                        checked={quantityMode === 'direct'}
                        onChange={() => setQuantityMode('direct')}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="qty-direct-top" className="text-sm cursor-pointer">
                        Enter quantity directly
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="qty-order-top"
                        checked={quantityMode === 'order'}
                        onChange={() => setQuantityMode('order')}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="qty-order-top" className="text-sm cursor-pointer">
                        Calculate from order quantity
                      </Label>
                    </div>
                    {quantityMode === 'direct' && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={directQuantity || ''}
                          onChange={(e) => setDirectQuantity(parseFloat(e.target.value) || 0)}
                          placeholder="Enter quantity"
                          className="w-32"
                        />
                        <span className="text-sm text-muted-foreground">meters (fabric)</span>
                      </div>
                    )}
                    {quantityMode === 'order' && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          value={orderQuantity || ''}
                          onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 0)}
                          placeholder="Order qty (pcs)"
                          className="w-32"
                        />
                        <span className="text-sm text-muted-foreground">pieces</span>
                      </div>
                    )}
                  </div>
                  {quantityMode === 'direct' && directQuantity > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Greige quantity will include shrinkage buffer (typically 5-10% extra)
                    </p>
                  )}
                </div>

                {/* Fabrics & Greige Section */}
                {(() => {
                  const approvedRows = getApprovedCADRowsWithGreige(styleCADData);
                  if (approvedRows.length === 0) return null;

                  // Shrinkage factor for greige (default 8% - can be made configurable)
                  const SHRINKAGE_PERCENT = 8;

                  return (
                    <div className="p-3 border rounded-lg">
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <span className="text-lg">🧵</span> Fabrics & Greige
                        <Badge variant="secondary" className="text-xs">
                          {approvedRows.length} items
                        </Badge>
                      </h4>
                      <div className="space-y-3">
                        {approvedRows.map((row) => {
                          const cadAvg = row.cadAverage || 0;

                          // Calculate fabric quantity based on mode
                          let fabricQty: number | null = null;
                          if (quantityMode === 'order' && orderQuantity > 0) {
                            fabricQty = orderQuantity * cadAvg;
                          } else if (quantityMode === 'direct' && directQuantity > 0) {
                            fabricQty = directQuantity;
                          }

                          // Greige needs shrinkage buffer (more raw material than finished)
                          const greigeQty = fabricQty ? fabricQty * (1 + SHRINKAGE_PERCENT / 100) : null;

                          return (
                            <div key={row.id} className="p-3 bg-muted/30 rounded border">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <p className="font-medium">{row.greigeName}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {row.cutableWidth}" width | CAD: {cadAvg.toFixed(3)} m/pc
                                  </p>
                                  {fabricQty && (
                                    <div className="text-sm mt-1 space-y-0.5">
                                      <p className="text-primary font-medium">
                                        Finished Fabric: {fabricQty.toFixed(2)} meters
                                      </p>
                                      <p className="text-orange-600 font-medium">
                                        Greige (with {SHRINKAGE_PERCENT}% shrinkage): {greigeQty?.toFixed(2)} meters
                                      </p>
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-2 flex-wrap justify-end">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      handleMaterialPOClick(
                                        'GREIGE',
                                        createGreigeItem(row, greigeQty),
                                        row.greigeName || 'Greige'
                                      );
                                    }}
                                  >
                                    GREIGE PO
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      handleMaterialPOClick(
                                        'PROCESSING',
                                        createProcessingItem(row, fabricQty),
                                        row.greigeName || 'Processing'
                                      );
                                    }}
                                  >
                                    PROCESSING PO
                                  </Button>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                Skip GREIGE PO if greige is already in stock or at processor's warehouse
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Trims & Accessories Section */}
                {styleBOMData &&
                  (() => {
                    const allTrims = [
                      ...styleBOMData.materialBOM.garmentTrims,
                      ...styleBOMData.materialBOM.valueAdditions,
                    ];
                    if (allTrims.length === 0) return null;

                    return (
                      <div className="p-3 border rounded-lg">
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <span className="text-lg">🔘</span> Trims & Accessories
                          <Badge variant="secondary" className="text-xs">
                            {allTrims.length} items
                          </Badge>
                        </h4>
                        <div className="space-y-2">
                          {allTrims.map((item: StyleBOMEntry) => {
                            const qtyPerGarment = parseFloat(item.quantityPerGarment) || 0;
                            const calculatedQty =
                              quantityMode === 'order' && orderQuantity > 0
                                ? (orderQuantity * qtyPerGarment).toFixed(0)
                                : null;

                            return (
                              <div
                                key={item.id}
                                className="p-2 bg-muted/30 rounded border flex items-center justify-between gap-4"
                              >
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{item.materialName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.materialCode} | {qtyPerGarment} {item.unit}/garment @{' '}
                                    {formatCurrency(parseFloat(item.unitPrice) || 0)}
                                    {calculatedQty && (
                                      <span className="ml-2 text-primary font-medium">
                                        → {calculatedQty} {item.unit} needed
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const category = item.materialType === 'LACE' ? 'LACE' : 'TRIMS';
                                    const qtyNum = calculatedQty ? parseFloat(calculatedQty) : null;
                                    handleMaterialPOClick(category, createTrimItem(item, qtyNum), item.materialName);
                                  }}
                                >
                                  {item.materialType === 'LACE' ? 'LACE PO' : 'TRIMS PO'}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                {/* Packaging Section */}
                {styleBOMData && styleBOMData.materialBOM.packaging.length > 0 && (
                  <div className="p-3 border rounded-lg">
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <span className="text-lg">📦</span> Packaging
                      <Badge variant="secondary" className="text-xs">
                        {styleBOMData.materialBOM.packaging.length} items
                      </Badge>
                    </h4>
                    <div className="space-y-2">
                      {styleBOMData.materialBOM.packaging.map((item: StyleBOMEntry) => {
                        const qtyPerGarment = parseFloat(item.quantityPerGarment) || 0;
                        const calculatedQty =
                          quantityMode === 'order' && orderQuantity > 0
                            ? (orderQuantity * qtyPerGarment).toFixed(0)
                            : null;

                        return (
                          <div
                            key={item.id}
                            className="p-2 bg-muted/30 rounded border flex items-center justify-between gap-4"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.materialName}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.materialCode} | {qtyPerGarment} {item.unit}/garment
                                {calculatedQty && (
                                  <span className="ml-2 text-primary font-medium">
                                    → {calculatedQty} {item.unit} needed
                                  </span>
                                )}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const qtyNum = calculatedQty ? parseFloat(calculatedQty) : null;
                                handleMaterialPOClick('GENERAL', createTrimItem(item, qtyNum), item.materialName);
                              }}
                            >
                              GENERAL PO
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* No materials found */}
                {!styleCADData?.cadRows?.length && !styleBOMData?.materialBOM && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No material data found for this style. Add CAD planning and BOM data first.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* PO Details */}
      <Card>
        <CardHeader>
          <CardTitle>PO Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* PO Category */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>PO Category *</Label>
                {isCategoryLocked && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          <Lock className="h-3 w-3" />
                          Set by material
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Category was set when you selected "{lockedMaterialName}". Clear style to change.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <Select value={poCategory} onValueChange={handleCategoryChange} disabled={isEditMode || isCategoryLocked}>
                <SelectTrigger className={isCategoryLocked ? 'bg-muted/50' : ''}>
                  <SelectValue placeholder="Select PO category..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Material</SelectLabel>
                    {PO_GROUP_CATEGORIES.material.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {PO_CATEGORY_LABELS[cat] || cat}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Processing</SelectLabel>
                    {PO_GROUP_CATEGORIES.processing.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {PO_CATEGORY_LABELS[cat] || cat}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Service</SelectLabel>
                    {PO_GROUP_CATEGORIES.service.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {PO_CATEGORY_LABELS[cat] || cat}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Supplier — filtered by category */}
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <SupplierCombobox
                value={supplierId}
                onValueChange={handleSupplierChange}
                placeholder={poCategory ? 'Select a supplier...' : 'Select a category first...'}
                disabled={!poCategory}
                categoryFilter={PO_CATEGORY_TO_SUPPLIER_CATEGORY[poCategory]}
              />
            </div>

            {/* Delivery Location */}
            <div className="space-y-2">
              <Label>Delivery Location (Optional)</Label>
              <WarehouseCombobox
                value={deliveryLocationId}
                onValueChange={setDeliveryLocationId}
                placeholder="Select delivery location..."
              />
            </div>

            {/* Process Type — only for Processing POs */}
            {isProcessing && (
              <div className="space-y-2">
                <Label>Process Type *</Label>
                <Select
                  value={processingType}
                  onValueChange={(v: string) => {
                    setProcessingType(v as 'DYEING' | 'PRINTING');
                    setPrintingType('');
                    setItems([]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DYEING">Dyeing</SelectItem>
                    <SelectItem value="PRINTING">Printing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Printing Type — only when Process Type is PRINTING */}
            {isProcessing && processingType === 'PRINTING' && (
              <div className="space-y-2">
                <Label>Printing Type *</Label>
                <Select value={printingType} onValueChange={setPrintingType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select printing type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIGMENT">Pigment</SelectItem>
                    <SelectItem value="PROCIAN">Procian</SelectItem>
                    <SelectItem value="DISCHARGE">Discharge</SelectItem>
                    <SelectItem value="PIGMENT_DISCHARGE">Pigment Discharge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="expectedDeliveryDate">Expected Delivery Date *</Label>
              <Input
                id="expectedDeliveryDate"
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items Card */}
      {poCategory && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{isProcessing ? 'Processing Items' : isService ? 'Service Items' : 'Order Items'}</CardTitle>
            {isMaterial && supplierId && (
              <Button variant="outline" size="sm" onClick={() => setShowMaterialPicker(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Browse All Materials
              </Button>
            )}
            {isService && supplierId && (
              <Button variant="outline" size="sm" onClick={addServiceItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {/* Manual GREIGE PO: Greige Master Picker (when no style selected) */}
            {isManualGreigeMode && supplierId && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <Label className="text-sm font-medium mb-2 block">Add Greige Fabric</Label>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Combobox
                      options={greigeMasterOptions}
                      value=""
                      onValueChange={addGreigeMasterItem}
                      placeholder={isLoadingGreigeMasters ? 'Loading greige masters...' : 'Select greige to add...'}
                      searchPlaceholder="Search by code, name, width, or composition..."
                      emptyText={isLoadingGreigeMasters ? 'Loading...' : 'No greige masters found.'}
                      disabled={isLoadingGreigeMasters}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  You can add multiple different greige types to this PO. Price is pre-filled from master if available.
                </p>
                {items.length > 0 && (
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Focus on the combobox to add another item - it's already cleared after each selection
                      }}
                      className="text-amber-700 border-amber-300 hover:bg-amber-100"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Another Greige Type
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Material PO: Quick Add Material (excludes manual GREIGE mode) */}
            {isMaterial && supplierId && !isManualGreigeMode && (
              <div className="mb-6 p-4 bg-info-muted border border-info/20 rounded-lg">
                <Label className="text-sm font-medium mb-2 block">Quick Add Material</Label>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <Combobox
                      options={materialOptions}
                      value={quickAddMaterialId}
                      onValueChange={handleQuickAddMaterial}
                      placeholder={isLoadingMaterials ? 'Loading materials...' : 'Type to search and add material...'}
                      searchPlaceholder="Search by code or name..."
                      emptyText={isLoadingMaterials ? 'Loading...' : 'No materials found.'}
                      disabled={isLoadingMaterials}
                    />
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setShowMaterialPicker(true)}>
                    Or Browse All
                  </Button>
                </div>
                {materials.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Showing {materials.length} materials matching supplier or{' '}
                    {PO_CATEGORY_LABELS[poCategory] || poCategory} category.
                  </p>
                )}
                {!isLoadingMaterials && materials.length === 0 && (
                  <div className="mt-3 p-3 bg-warning-muted border border-warning/20 rounded text-sm text-warning">
                    <p>No materials found for this supplier or category.</p>
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 h-auto text-warning underline"
                      onClick={() => fetchMaterials(undefined, true)}
                    >
                      Browse all materials instead
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Processing PO: Greige Picker */}
            {isProcessing && supplierId && (
              <div className="mb-6 p-4 bg-accent/10 border border-accent/20 rounded-lg">
                <Label className="text-sm font-medium mb-2 block">Add Greige for Processing</Label>
                <div className="flex-1">
                  <Combobox
                    options={greigeOptions}
                    value=""
                    onValueChange={addProcessingItem}
                    placeholder={isLoadingGreiges ? 'Loading greige fabrics...' : 'Select greige fabric to add...'}
                    searchPlaceholder="Search by code, name, or composition..."
                    emptyText={isLoadingGreiges ? 'Loading...' : 'No greige fabrics found.'}
                    disabled={isLoadingGreiges || (processingType === 'PRINTING' && !printingType)}
                  />
                </div>
                {processingType === 'PRINTING' && !printingType && (
                  <p className="text-xs text-warning mt-2">
                    Please select a Printing Type above before adding greige fabrics.
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Rate will auto-fill from processor rate card when available. You can override manually.
                </p>
              </div>
            )}

            {/* No supplier selected */}
            {!supplierId && (
              <div className="text-center py-8 text-muted-foreground">Please select a supplier to add items.</div>
            )}

            {/* Empty items */}
            {supplierId && items.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No items added yet.{' '}
                {isProcessing
                  ? 'Select a greige fabric above to add processing items.'
                  : isManualGreigeMode
                    ? 'Select greige types above to add them to this PO.'
                    : isService
                      ? 'Click "Add Item" to start.'
                      : 'Use Quick Add or Browse Materials.'}
              </div>
            )}

            {/* Items Table */}
            {items.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isProcessing ? 'Greige Fabric' : isService ? 'Description' : 'Material'}</TableHead>
                    {isProcessing && <TableHead className="w-[200px]">Description</TableHead>}
                    {(poCategory === 'GREIGE' || poCategory === 'FABRIC') && (
                      <TableHead className="w-[100px]">Fold L (cm)</TableHead>
                    )}
                    <TableHead className="w-[120px]">Quantity</TableHead>
                    <TableHead className="w-[100px]">Unit</TableHead>
                    <TableHead className="w-[120px]">
                      {isProcessing ? 'Rate/m' : isService ? 'Rate' : 'Unit Price'}
                    </TableHead>
                    <TableHead className="w-[100px]">Amount</TableHead>
                    <TableHead className="w-[80px]">GST %</TableHead>
                    <TableHead className="w-[100px]">Tax</TableHead>
                    <TableHead className="w-[120px]">Total</TableHead>
                    <TableHead className="w-[150px]">Remarks</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.tempId}>
                      <TableCell>
                        {isProcessing ? (
                          <div>
                            <div className="font-medium">{item.materialCode}</div>
                            <div className="text-sm text-muted-foreground">{item.materialName}</div>
                          </div>
                        ) : isService ? (
                          <Input
                            value={item.serviceDescription || ''}
                            onChange={(e) => updateItem(item.tempId, 'serviceDescription', e.target.value)}
                            placeholder={`${PO_CATEGORY_LABELS[poCategory] || 'Service'} description...`}
                            className="w-full"
                          />
                        ) : (
                          <div>
                            <div className="font-medium">{item.materialCode}</div>
                            <div className="text-sm text-muted-foreground">{item.materialName}</div>
                          </div>
                        )}
                      </TableCell>
                      {isProcessing && (
                        <TableCell>
                          <Input
                            value={item.serviceDescription || ''}
                            onChange={(e) => updateItem(item.tempId, 'serviceDescription', e.target.value)}
                            placeholder="Processing notes..."
                            className="w-full"
                          />
                        </TableCell>
                      )}
                      {(poCategory === 'GREIGE' || poCategory === 'FABRIC') && (
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.foldLengthCm || ''}
                            onChange={(e) => updateItem(item.tempId, 'foldLengthCm', e.target.value)}
                            placeholder="L"
                            className="w-full"
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          value={item.orderedQuantity}
                          onChange={(e) => updateItem(item.tempId, 'orderedQuantity', e.target.value)}
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-medium">
                          {item.unit}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.tempId, 'unitPrice', e.target.value)}
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(item.totalPrice)}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="28"
                          step="0.5"
                          value={item.gstRate ?? 5}
                          onChange={(e) => updateItem(item.tempId, 'gstRate', parseFloat(e.target.value) || 5)}
                          className="w-full text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency((item.totalPrice * (item.gstRate ?? 5)) / 100)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.totalPrice + (item.totalPrice * (item.gstRate ?? 5)) / 100)}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.remarks}
                          onChange={(e) => updateItem(item.tempId, 'remarks', e.target.value)}
                          placeholder="Notes"
                          className="w-full"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.tempId)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Tax Summary & Grand Total */}
            {items.length > 0 && (
              <div className="flex justify-end mt-4 pt-4 border-t">
                <div className="w-72 space-y-2">
                  {(() => {
                    const subtotal = calculateGrandTotal();
                    const totalTax = items.reduce((sum, item) => {
                      const gstRate = item.gstRate ?? 5;
                      return sum + (item.totalPrice * gstRate) / 100;
                    }, 0);
                    const grandTotal = subtotal + totalTax;
                    const avgGstRate =
                      items.length > 0 ? items.reduce((sum, item) => sum + (item.gstRate ?? 5), 0) / items.length : 5;
                    // Check if interstate
                    const supplierStateCode =
                      selectedSupplier?.gstNumbers?.find((g) => g.isPrimary)?.stateCode ||
                      selectedSupplier?.gstNumbers?.[0]?.stateCode;
                    const isInterstate = supplierStateCode && supplierStateCode !== COMPANY_CONFIG.stateCode;

                    return (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span>{formatCurrency(subtotal)}</span>
                        </div>
                        {isInterstate ? (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">IGST ({avgGstRate.toFixed(1)}%):</span>
                            <span>{formatCurrency(totalTax)}</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">CGST ({(avgGstRate / 2).toFixed(1)}%):</span>
                              <span>{formatCurrency(totalTax / 2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">SGST ({(avgGstRate / 2).toFixed(1)}%):</span>
                              <span>{formatCurrency(totalTax / 2)}</span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between pt-2 border-t font-bold text-lg">
                          <span>Grand Total:</span>
                          <span>{formatCurrency(grandTotal)}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Supplier Details - Moved to end for better UX */}
      {selectedSupplier && (
        <Card>
          <CardHeader>
            <CardTitle>Supplier Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block mb-1">Supplier</span>
                <p className="font-medium">
                  {selectedSupplier.code} - {selectedSupplier.name}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Contact Person</span>
                <p>{selectedSupplier.contactPerson || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Phone</span>
                <p>{selectedSupplier.phone || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Email</span>
                <p>{selectedSupplier.email || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Payment Terms</span>
                <p className="font-medium">{selectedSupplier.paymentTerms || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delivery Details */}
      {selectedWarehouse && (
        <Card>
          <CardHeader>
            <CardTitle>Delivery Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block mb-1">Warehouse</span>
                <p className="font-medium">
                  {selectedWarehouse.warehouseCode} - {selectedWarehouse.warehouseName}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Type</span>
                <p>{selectedWarehouse.warehouseType?.replace(/_/g, ' ') || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Contact Person</span>
                <p>{selectedWarehouse.contactPerson || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground block mb-1">Phone</span>
                <p>{selectedWarehouse.contactPhone || '-'}</p>
              </div>
              <div className="col-span-2 md:col-span-4">
                <span className="text-muted-foreground block mb-1">Address</span>
                <p>{selectedWarehouse.address || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Additional notes or instructions..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Form Footer with Action Buttons */}
      <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
        <Button
          variant="outline"
          onClick={() => {
            if (validateForm()) {
              setShowPreview(true);
            }
          }}
        >
          <Eye className="h-4 w-4 mr-2" />
          Preview
        </Button>
        <Button variant="outline" onClick={() => handleSave(false)} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          Save as Draft
        </Button>
        {!isEditMode && (
          <Button onClick={() => handleSave(true)} disabled={isSaving}>
            <Send className="h-4 w-4 mr-2" />
            Save & Send
          </Button>
        )}
      </div>

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Purchase Order Preview
            </DialogTitle>
          </DialogHeader>

          {/* Company & Supplier & Delivery Details - Side by Side */}
          <div className={`grid gap-4 mt-4 ${selectedWarehouse ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {/* Company (Bill From) */}
            <Card className="bg-muted/30">
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  From (Buyer)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1 text-sm">
                <p className="font-semibold text-base">{COMPANY_CONFIG.name}</p>
                <p className="text-muted-foreground">{getCompanyFullAddress()}</p>
                <p className="mt-2">
                  <span className="text-muted-foreground">GSTIN: </span>
                  <span className="font-medium">{COMPANY_CONFIG.gstin}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Phone: </span>
                  {COMPANY_CONFIG.phone}
                </p>
                <p>
                  <span className="text-muted-foreground">Email: </span>
                  {COMPANY_CONFIG.email}
                </p>
              </CardContent>
            </Card>

            {/* Supplier (Bill To) */}
            <Card className="bg-muted/30">
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  To (Supplier)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-1 text-sm">
                <p className="font-semibold text-base">{selectedSupplier?.name || '-'}</p>
                <p className="text-muted-foreground">
                  {selectedSupplier?.address || 'Address not available'}
                  {selectedSupplier?.billingPincode && ` - ${selectedSupplier.billingPincode}`}
                </p>
                <p className="mt-2">
                  <span className="text-muted-foreground">GSTIN: </span>
                  <span className="font-medium">
                    {selectedSupplier?.gstNumbers?.find((g) => g.isPrimary)?.gstNumber ||
                      selectedSupplier?.gstNumbers?.[0]?.gstNumber ||
                      'Not available'}
                  </span>
                </p>
                {selectedSupplier?.phone && (
                  <p>
                    <span className="text-muted-foreground">Phone: </span>
                    {selectedSupplier.phone}
                  </p>
                )}
                {selectedSupplier?.email && (
                  <p>
                    <span className="text-muted-foreground">Email: </span>
                    {selectedSupplier.email}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Deliver To (Warehouse) */}
            {selectedWarehouse && (
              <Card className="bg-muted/30">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Deliver To
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-1 text-sm">
                  <p className="font-semibold text-base">{selectedWarehouse.warehouseName}</p>
                  <p className="text-xs text-muted-foreground">{selectedWarehouse.warehouseCode}</p>
                  <p className="text-muted-foreground mt-1">{selectedWarehouse.address || 'Address not available'}</p>
                  {selectedWarehouse.contactPerson && (
                    <p className="mt-2">
                      <span className="text-muted-foreground">Contact: </span>
                      {selectedWarehouse.contactPerson}
                    </p>
                  )}
                  {selectedWarehouse.contactPhone && (
                    <p>
                      <span className="text-muted-foreground">Phone: </span>
                      {selectedWarehouse.contactPhone}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* PO Details Row */}
          <div className="grid grid-cols-4 gap-4 mt-4 p-3 bg-muted/30 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">Category</p>
              <Badge className={PO_CATEGORY_COLORS[poCategory] || 'bg-muted'}>
                {PO_CATEGORY_LABELS[poCategory] || poCategory}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Delivery Date</p>
              <p className="font-medium">{expectedDeliveryDate || '-'}</p>
            </div>
            {styleId && styles.find((s) => s.id === styleId) && (
              <div>
                <p className="text-xs text-muted-foreground">Style</p>
                <p className="font-medium">{styles.find((s) => s.id === styleId)?.styleCode}</p>
              </div>
            )}
            {selectedSupplier?.paymentTerms && (
              <div>
                <p className="text-xs text-muted-foreground">Payment Terms</p>
                <p className="font-medium">{selectedSupplier.paymentTerms}</p>
              </div>
            )}
          </div>

          {/* Items Table with HSN & Tax */}
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Order Items ({items.length})</h4>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Material / Service</TableHead>
                    <TableHead>HSN/SAC</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">GST %</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const amount = item.totalPrice;
                    const gstRate = item.gstRate || 5; // Default 5% for textiles
                    const taxAmount = (amount * gstRate) / 100;
                    const totalWithTax = amount + taxAmount;
                    return (
                      <TableRow key={item.tempId}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.materialCode || item.serviceType}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.materialName || item.serviceDescription}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{item.hsnCode || '-'}</TableCell>
                        <TableCell className="text-right">{item.orderedQuantity}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell className="text-right">{formatCurrency(parseFloat(item.unitPrice) || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(amount)}</TableCell>
                        <TableCell className="text-right">{gstRate}%</TableCell>
                        <TableCell className="text-right">{formatCurrency(taxAmount)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(totalWithTax)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Tax Summary & Grand Total */}
          <div className="flex justify-end mt-4">
            <div className="w-72 space-y-2">
              {(() => {
                const subtotal = calculateGrandTotal();
                const avgGstRate =
                  items.length > 0 ? items.reduce((sum, item) => sum + (item.gstRate || 5), 0) / items.length : 5;
                const totalTax = (subtotal * avgGstRate) / 100;
                const grandTotal = subtotal + totalTax;
                // Check if interstate (different state codes)
                const supplierStateCode =
                  selectedSupplier?.gstNumbers?.find((g) => g.isPrimary)?.stateCode ||
                  selectedSupplier?.gstNumbers?.[0]?.stateCode;
                const isInterstate = supplierStateCode && supplierStateCode !== COMPANY_CONFIG.stateCode;

                return (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {isInterstate ? (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">IGST ({avgGstRate}%):</span>
                        <span>{formatCurrency(totalTax)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">CGST ({avgGstRate / 2}%):</span>
                          <span>{formatCurrency(totalTax / 2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">SGST ({avgGstRate / 2}%):</span>
                          <span>{formatCurrency(totalTax / 2)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between pt-2 border-t font-bold text-lg">
                      <span>Grand Total:</span>
                      <span>{formatCurrency(grandTotal)}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Remarks */}
          {remarks && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">Remarks</p>
              <p className="text-sm text-muted-foreground">{remarks}</p>
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setShowPreview(false);
                handleSave(true);
              }}
              disabled={isSaving}
            >
              <Check className="h-4 w-4 mr-2" />
              Confirm & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Material Picker Modal */}
      {showMaterialPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Select Material</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowMaterialPicker(false)}>
                ✕
              </Button>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Search materials..."
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
                className="mb-4"
              />
              <div className="max-h-[400px] overflow-y-auto">
                {filteredMaterials.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">No materials found for this supplier</div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMaterials.slice(0, materialDisplayLimit).map((material) => (
                          <TableRow key={material.id}>
                            <TableCell className="font-medium">{material.code}</TableCell>
                            <TableCell>{material.name}</TableCell>
                            <TableCell>{material.materialType}</TableCell>
                            <TableCell>{material.unit || '-'}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                onClick={() => addMaterialItem(material)}
                                disabled={items.some((i) => i.materialId === material.id)}
                              >
                                {items.some((i) => i.materialId === material.id) ? 'Added' : 'Add'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {filteredMaterials.length > materialDisplayLimit && (
                      <div className="flex justify-center py-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMaterialDisplayLimit((prev) => prev + 50)}
                        >
                          Load More ({filteredMaterials.length - materialDisplayLimit} remaining)
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
