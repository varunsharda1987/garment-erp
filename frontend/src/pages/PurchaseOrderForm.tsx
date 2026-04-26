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
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { getAllMaterials } from '@/services/material.service';
import { getSupplierById } from '@/services/supplier.service';
import { getAllStyles } from '@/services/style.service';
import { getAllOrders } from '@/services/order.service';
import { cadPlanningService } from '@/services/cad-planning.service';
import type { CADTableData, CADSpreadsheetRow } from '@/types/cad-planning.types';
import {
  createPurchaseOrder,
  getPurchaseOrderById,
  updatePurchaseOrder,
  sendPurchaseOrder,
} from '@/services/purchaseOrder.service';
import type { CreatePurchaseOrderRequest, CreatePurchaseOrderItemRequest, Unit } from '@/types/purchaseOrder.types';
import {
  Unit as UnitEnum,
  PO_CATEGORY_LABELS,
  PO_CATEGORY_COLORS,
  PO_GROUP_CATEGORIES,
} from '@/types/purchaseOrder.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency } from '@/lib/currency';
import { processorRateCardV2Service } from '@/services/processorRateCardV2.service';
import type { GreigeForRateCard, PrintingTypeV2 } from '@/types/processorRateCardV2.types';
import { Trash2, Plus, Send, Save, ArrowLeft } from 'lucide-react';

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

interface Supplier {
  id: string;
  code: string;
  name: string;
  paymentTerms: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
}

interface Material {
  id: string;
  code: string;
  name: string;
  materialType: string;
  unit: string | null;
  costPerUnit: number | null;
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
  if (PO_GROUP_CATEGORIES.processing.includes(category)) return 'METER';
  if (PO_GROUP_CATEGORIES.service.includes(category)) return 'PIECE';
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
  const [paymentTerms, setPaymentTerms] = useState('');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState<POItemForm[]>([]);

  // For material PO item adding
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
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

  // Traceability state (optional links for Manual POs)
  const [styleId, setStyleId] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');
  const [styles, setStyles] = useState<Array<{ id: string; styleCode: string; styleName: string; cadStatus?: string }>>(
    []
  );
  const [orders, setOrders] = useState<Array<{ id: string; orderNumber: string; customerName?: string }>>([]);
  const [isLoadingStyles, setIsLoadingStyles] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  // CAD data for selected style (enables Processing PO creation from approved CAD)
  const [styleCADData, setStyleCADData] = useState<CADTableData | null>(null);
  const [isLoadingCAD, setIsLoadingCAD] = useState(false);

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
          response.data.map((s: { id: string; styleCode: string; styleName: string; cadStatus?: string }) => ({
            id: s.id,
            styleCode: s.styleCode,
            styleName: s.styleName,
            cadStatus: s.cadStatus,
          }))
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

  // Fetch orders (for traceability) - only when authenticated
  useEffect(() => {
    if (!token) return; // Wait for auth
    const fetchOrdersList = async () => {
      setIsLoadingOrders(true);
      try {
        const response = await getAllOrders({ limit: 100 });
        setOrders(
          response.data.map((o: { id: string; orderNumber: string; customer?: { name: string } }) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            customerName: o.customer?.name,
          }))
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
      setPaymentTerms(po.paymentTerms || '');
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
        if (supplier.paymentTerms && !paymentTerms) {
          setPaymentTerms(supplier.paymentTerms);
        }
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

  const updateItem = (tempId: string, field: keyof POItemForm, value: string) => {
    setItems(
      items.map((item) => {
        if (item.tempId !== tempId) return item;

        const updatedItem = { ...item, [field]: value };

        if (field === 'orderedQuantity' || field === 'unitPrice') {
          const qty = parseFloat(updatedItem.orderedQuantity) || 0;
          const price = parseFloat(updatedItem.unitPrice) || 0;
          updatedItem.totalPrice = qty * price;
        }

        return updatedItem;
      })
    );

    // Re-lookup rate when quantity changes for processing items
    if (isProcessing && field === 'orderedQuantity') {
      const item = items.find((i) => i.tempId === tempId);
      if (item?.materialId) {
        const qty = parseFloat(value) || 0;
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
      }));

      const data: CreatePurchaseOrderRequest = {
        supplierId,
        expectedDeliveryDate,
        poCategory: poCategory || undefined,
        paymentTerms: paymentTerms || undefined,
        remarks: remarks || undefined,
        items: itemsData,
        // Optional traceability links
        styleId: styleId || null,
        orderId: orderId || null,
      };

      let savedPO;
      if (isEditMode && id) {
        savedPO = await updatePurchaseOrder(id, {
          supplierId,
          expectedDeliveryDate,
          paymentTerms: paymentTerms || undefined,
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
      </div>

      {/* PO Category & Order Info */}
      <Card>
        <CardHeader>
          <CardTitle>Order Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* PO Category */}
            <div className="space-y-2">
              <Label>PO Category *</Label>
              <Select value={poCategory} onValueChange={handleCategoryChange} disabled={isEditMode}>
                <SelectTrigger>
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

            <div className="space-y-2">
              <Label htmlFor="paymentTerms">Payment Terms</Label>
              <Input
                id="paymentTerms"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="e.g., Net 30"
              />
            </div>
          </div>

          {selectedSupplier && (
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium mb-2">Supplier Details</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Contact:</span>
                  <p>{selectedSupplier.contactPerson || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span>
                  <p>{selectedSupplier.phone || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <p>{selectedSupplier.email || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Payment Terms:</span>
                  <p>{selectedSupplier.paymentTerms || '-'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Traceability Links (Optional) */}
          <div className="mt-4 pt-4 border-t">
            <h4 className="font-medium mb-3 text-sm text-muted-foreground">Traceability (Optional)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Link to Style</Label>
                <Combobox
                  options={styles.map((s) => ({
                    value: s.id,
                    label: `${s.styleCode} - ${s.styleName}`,
                    searchText: `${s.styleCode} ${s.styleName}`,
                  }))}
                  value={styleId}
                  onValueChange={setStyleId}
                  placeholder={isLoadingStyles ? 'Loading styles...' : 'Select style (optional)...'}
                  searchPlaceholder="Search by code or name..."
                  emptyText={isLoadingStyles ? 'Loading...' : 'No styles found.'}
                  disabled={isLoadingStyles}
                />
              </div>
              <div className="space-y-2">
                <Label>Link to Order</Label>
                <Combobox
                  options={orders.map((o) => ({
                    value: o.id,
                    label: `${o.orderNumber}${o.customerName ? ` - ${o.customerName}` : ''}`,
                    searchText: `${o.orderNumber} ${o.customerName || ''}`,
                  }))}
                  value={orderId}
                  onValueChange={setOrderId}
                  placeholder={isLoadingOrders ? 'Loading orders...' : 'Select order (optional)...'}
                  searchPlaceholder="Search by order number..."
                  emptyText={isLoadingOrders ? 'Loading...' : 'No orders found.'}
                  disabled={isLoadingOrders}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Linking to a style or order improves cost tracking and audit trails.
            </p>

            {/* Processing PO from CAD - shown when style has approved CAD with greige */}
            {styleId &&
              !isLoadingCAD &&
              (() => {
                const approvedRows = getApprovedCADRowsWithGreige(styleCADData);
                if (approvedRows.length === 0) return null;

                return (
                  <div className="mt-4 p-3 bg-accent/10 border border-accent/20 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-accent">Processing Available</p>
                        <p className="text-xs text-muted-foreground">
                          This style has {approvedRows.length} approved CAD{approvedRows.length > 1 ? 's' : ''} with
                          greige ready for dyeing/printing.
                        </p>
                      </div>
                      {poCategory !== 'PROCESSING' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Switch to PROCESSING category
                            setPoCategory('PROCESSING');
                            // Clear supplier to let user select processor
                            setSupplierId('');
                            setSelectedSupplier(null);
                            // Clear items
                            setItems([]);
                          }}
                        >
                          Create Processing PO
                        </Button>
                      )}
                    </div>
                    {poCategory === 'PROCESSING' && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        <p className="font-medium mb-1">Available greige fabrics:</p>
                        <ul className="list-disc list-inside">
                          {approvedRows.map((row) => (
                            <li key={row.id}>
                              {row.greigeName} - {row.cutableWidth}" width
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })()}

            {isLoadingCAD && styleId && <p className="text-xs text-muted-foreground mt-2">Loading CAD data...</p>}
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
            {/* Material PO: Quick Add Material */}
            {isMaterial && supplierId && (
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
                    <TableHead className="w-[120px]">Quantity</TableHead>
                    <TableHead className="w-[100px]">Unit</TableHead>
                    <TableHead className="w-[120px]">
                      {isProcessing ? 'Rate/m' : isService ? 'Rate' : 'Unit Price'}
                    </TableHead>
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
                        <Select value={item.unit} onValueChange={(value) => updateItem(item.tempId, 'unit', value)}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.keys(UnitEnum).map((u) => (
                              <SelectItem key={u} value={u}>
                                {u}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                      <TableCell className="font-medium">{formatCurrency(item.totalPrice)}</TableCell>
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

            {/* Grand Total */}
            {items.length > 0 && (
              <div className="flex justify-end mt-4 pt-4 border-t">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Grand Total</div>
                  <div className="text-2xl font-bold">{formatCurrency(calculateGrandTotal())}</div>
                </div>
              </div>
            )}
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
