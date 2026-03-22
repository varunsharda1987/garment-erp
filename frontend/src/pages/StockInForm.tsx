// Stock IN Form - Create stock receipt with material-type-specific fields
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, X, Info } from 'lucide-react';
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
import { getAllLace } from '../services/lace.service';
import { getAllButtons } from '../services/button.service';
import { getAllThreads } from '../services/thread.service';
import { getAllZippers } from '../services/zipper.service';
import { getAllElastics } from '../services/elastic.service';
import { getAllLabels } from '../services/label.service';
import { getAllPackaging } from '../services/packaging.service';
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

export default function StockInForm() {
  const navigate = useNavigate();

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

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [unifiedMaterials, setUnifiedMaterials] = useState<ExtendedMaterialItem[]>([]);
  const [selectedMaterialType, setSelectedMaterialType] = useState<MaterialType | ''>('');
  const [selectedItem, setSelectedItem] = useState<ExtendedMaterialItem | null>(null);

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
  });

  useEffect(() => {
    loadData();
  }, []);

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
      ]);
      setWarehouses(warehousesData);

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
          label.sizeVariants.forEach((variant: any) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!formData.materialId || !formData.warehouseId || !formData.quantity || !formData.unit) {
      setError('Please fill in all required fields');
      return;
    }

    if (Number(formData.quantity) <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    try {
      setLoading(true);

      let itemType: string | undefined;
      let itemId: string | undefined;
      let materialId: string | undefined;

      if (formData.materialId.includes(':')) {
        const [type, id] = formData.materialId.split(':');
        itemType = type;
        itemId = id;
      } else {
        materialId = formData.materialId;
      }

      // Build remarks with type-specific fields
      let fullRemarks = formData.remarks || '';
      const additionalInfo: string[] = [];
      if (formData.width) additionalInfo.push(`Width: ${formData.width}`);
      if (formData.color) additionalInfo.push(`Color: ${formData.color}`);
      if (formData.lotNumber) additionalInfo.push(`Lot: ${formData.lotNumber}`);
      if (formData.rollNumber) additionalInfo.push(`Roll: ${formData.rollNumber}`);
      if (formData.challanNumber) additionalInfo.push(`Challan: ${formData.challanNumber}`);
      if (formData.supplierInvoice) additionalInfo.push(`Invoice: ${formData.supplierInvoice}`);

      if (additionalInfo.length > 0) {
        fullRemarks = additionalInfo.join(' | ') + (fullRemarks ? ` | ${fullRemarks}` : '');
      }

      await stockMovementService.createStockIn({
        materialId,
        itemType,
        itemId,
        warehouseId: formData.warehouseId,
        quantity: Number(formData.quantity),
        unit: formData.unit as Unit,
        rate: formData.rate ? Number(formData.rate) : undefined,
        referenceType: formData.referenceType || undefined,
        referenceNumber: formData.referenceNumber || undefined,
        remarks: fullRemarks || undefined,
      });

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

  const handleMaterialSelect = (value: string) => {
    // Check if this is a LABEL_VARIANT type (size variant with material)
    const item = unifiedMaterials.find((m) =>
      m.type === 'LABEL_VARIANT' ? m.id === value : `${m.type}:${m.id}` === value
    );

    // For LABEL_VARIANT, store just the material ID; for others, store type:id
    if (item?.type === 'LABEL_VARIANT') {
      handleChange('materialId', item.id); // Direct material ID
    } else {
      handleChange('materialId', value); // type:id format
    }

    setSelectedItem(item || null);
    if (item?.unit) {
      handleChange('unit', item.unit);
    }
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

  // Render selected item details
  const renderItemDetails = () => {
    if (!selectedItem || !selectedItem.rawData) return null;

    const data = selectedItem.rawData;

    switch (selectedItem.type) {
      case 'GREIGE': {
        const greige = data as GreigeMaster;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Composition:</span> {greige.composition}
            </div>
            <div>
              <span className="text-muted-foreground">Width:</span> {greige.greigeWidth}"
            </div>
            <div>
              <span className="text-muted-foreground">Construction:</span> {greige.construction || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Yarn Count:</span> {greige.yarnCount || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Weave:</span> {greige.weaveType || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Shrinkage:</span> {greige.averageShrinkagePercent}%
            </div>
          </div>
        );
      }
      case 'FABRIC': {
        const fabric = data as FabricMaster;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Color:</span> {fabric.colorName || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Width:</span> {fabric.actualWidth}"
            </div>
            <div>
              <span className="text-muted-foreground">Finish:</span> {fabric.finishType || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">GSM:</span> {fabric.actualGSM || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Cutable Width:</span> {fabric.cutableWidth || fabric.actualWidth}"
            </div>
            <div>
              <span className="text-muted-foreground">Cost/Mtr:</span> ₹{fabric.costPerMeter}
            </div>
          </div>
        );
      }
      case 'LACE': {
        const lace = data as Lace;
        // Get price from preferred supplier or greige cost
        const lacePrice = lace.laceSuppliers?.find((s) => s.isPreferred)?.pricePerMeter || lace.costPerMeterGreige;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Type:</span> {lace.laceType || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Width:</span> {lace.width ? `${lace.width}"` : '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Color:</span> {lace.color || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Design:</span> {lace.design || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Composition:</span> {lace.composition || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Price/Mtr:</span> {lacePrice ? `₹${lacePrice}` : '-'}
            </div>
          </div>
        );
      }
      case 'BUTTON': {
        const button = data as ButtonType;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Size:</span> {button.size || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Holes:</span> {button.holes || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Color:</span> {button.color || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Material:</span> {button.material || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Shape:</span> {button.shape || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Price/Gross:</span>{' '}
              {button.pricePerGross ? `₹${button.pricePerGross}` : '-'}
            </div>
          </div>
        );
      }
      case 'THREAD': {
        const thread = data as Thread;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Ply:</span> {thread.ply || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Packaging:</span> {thread.packagingType || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Color:</span> {thread.color || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Cone Size:</span> {thread.coneSize || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Material:</span> {thread.materialComposition || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Price/Cone:</span>{' '}
              {thread.pricePerCone ? `₹${thread.pricePerCone}` : '-'}
            </div>
          </div>
        );
      }
      case 'ZIPPER': {
        const zipper = data as Zipper;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Length:</span> {zipper.length ? `${zipper.length}"` : '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Teeth Type:</span> {zipper.teethType || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Color:</span> {zipper.color || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Slider:</span> {zipper.sliderType || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Brand:</span> {zipper.brand || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Price/Pc:</span>{' '}
              {zipper.pricePerPiece ? `₹${zipper.pricePerPiece}` : '-'}
            </div>
          </div>
        );
      }
      case 'ELASTIC': {
        const elastic = data as Elastic;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Type:</span> {elastic.elasticType || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Width:</span> {elastic.width ? `${elastic.width}mm` : '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Color:</span> {elastic.color || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Stretch:</span>{' '}
              {elastic.stretchPercent ? `${elastic.stretchPercent}%` : '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Composition:</span> {elastic.composition || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Price/Mtr:</span>{' '}
              {elastic.pricePerMeter ? `₹${elastic.pricePerMeter}` : '-'}
            </div>
          </div>
        );
      }
      case 'LABEL': {
        const label = data as LabelType;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Type:</span> {label.labelType || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Size:</span> {label.size || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Material:</span> {label.material || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Print Method:</span> {label.printMethod || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Color:</span> {label.color || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Price/100:</span>{' '}
              {label.pricePerHundred ? `₹${label.pricePerHundred}` : '-'}
            </div>
          </div>
        );
      }
      case 'PACKAGING': {
        const pkg = data as Packaging;
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Type:</span> {pkg.packagingType || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Size:</span> {pkg.size || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Material:</span> {pkg.material || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Thickness:</span> {pkg.thickness || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Print:</span> {pkg.printDetails || '-'}
            </div>
            <div>
              <span className="text-muted-foreground">Price/100:</span>{' '}
              {pkg.pricePerHundred ? `₹${pkg.pricePerHundred}` : '-'}
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  // Render type-specific form fields
  const renderTypeSpecificFields = () => {
    if (!selectedMaterialType) return null;

    switch (selectedMaterialType) {
      case 'GREIGE':
      case 'FABRIC':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="width">Width (inches)</Label>
              <Input
                id="width"
                type="number"
                value={formData.width}
                onChange={(e) => handleChange('width', e.target.value)}
                placeholder="e.g., 44, 58"
                step="0.5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rollNumber">Roll Number(s)</Label>
              <Input
                id="rollNumber"
                value={formData.rollNumber}
                onChange={(e) => handleChange('rollNumber', e.target.value)}
                placeholder="e.g., R001, R002, R003"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lotNumber">Lot/Batch Number</Label>
              <Input
                id="lotNumber"
                value={formData.lotNumber}
                onChange={(e) => handleChange('lotNumber', e.target.value)}
                placeholder="e.g., LOT-2024-001"
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
          </>
        );
      case 'LACE':
      case 'ELASTIC':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="width">Width</Label>
              <Input
                id="width"
                value={formData.width}
                onChange={(e) => handleChange('width', e.target.value)}
                placeholder={selectedMaterialType === 'ELASTIC' ? 'e.g., 25mm' : 'e.g., 2 inches'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                value={formData.color}
                onChange={(e) => handleChange('color', e.target.value)}
                placeholder="e.g., White, Black, Navy"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lotNumber">Lot/Batch Number</Label>
              <Input
                id="lotNumber"
                value={formData.lotNumber}
                onChange={(e) => handleChange('lotNumber', e.target.value)}
                placeholder="e.g., LOT-2024-001"
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
          </>
        );
      case 'BUTTON':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                value={formData.color}
                onChange={(e) => handleChange('color', e.target.value)}
                placeholder="e.g., White, Pearl, Brown"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lotNumber">Lot/Batch Number</Label>
              <Input
                id="lotNumber"
                value={formData.lotNumber}
                onChange={(e) => handleChange('lotNumber', e.target.value)}
                placeholder="e.g., BTN-LOT-001"
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
                placeholder="Supplier invoice number"
              />
            </div>
          </>
        );
      case 'THREAD':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="color">Color / Shade</Label>
              <Input
                id="color"
                value={formData.color}
                onChange={(e) => handleChange('color', e.target.value)}
                placeholder="e.g., White, Black, Navy Blue"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lotNumber">Lot/Dye Lot Number</Label>
              <Input
                id="lotNumber"
                value={formData.lotNumber}
                onChange={(e) => handleChange('lotNumber', e.target.value)}
                placeholder="e.g., DL-2024-001"
              />
              <p className="text-xs text-muted-foreground">Important for color consistency</p>
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
                placeholder="Supplier invoice number"
              />
            </div>
          </>
        );
      case 'ZIPPER':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                value={formData.color}
                onChange={(e) => handleChange('color', e.target.value)}
                placeholder="e.g., Black, Navy, White"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lotNumber">Lot/Batch Number</Label>
              <Input
                id="lotNumber"
                value={formData.lotNumber}
                onChange={(e) => handleChange('lotNumber', e.target.value)}
                placeholder="e.g., ZIP-LOT-001"
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
                placeholder="Supplier invoice number"
              />
            </div>
          </>
        );
      case 'LABEL':
      case 'PACKAGING':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="lotNumber">Lot/Batch Number</Label>
              <Input
                id="lotNumber"
                value={formData.lotNumber}
                onChange={(e) => handleChange('lotNumber', e.target.value)}
                placeholder="e.g., PKG-LOT-001"
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
                placeholder="Supplier invoice number"
              />
            </div>
          </>
        );
      default:
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="lotNumber">Lot/Batch Number</Label>
              <Input
                id="lotNumber"
                value={formData.lotNumber}
                onChange={(e) => handleChange('lotNumber', e.target.value)}
                placeholder="e.g., LOT-2024-001"
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
          </>
        );
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
        <Alert className="mb-4 bg-green-50 text-green-900 border-green-200">
          <AlertDescription>Stock IN created successfully! Redirecting...</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        {/* Step 1: Material Type Selection */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Step 1: Select Material Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {(Object.keys(MATERIAL_TYPE_LABELS) as MaterialType[]).map((type) => {
                const count = unifiedMaterials.filter((m) => m.type === type).length;
                const isSelected = selectedMaterialType === type;
                return (
                  <Button
                    key={type}
                    type="button"
                    variant={isSelected ? 'default' : 'outline'}
                    className={`h-auto py-3 flex flex-col items-center justify-center ${isSelected ? 'ring-2 ring-offset-2' : ''}`}
                    onClick={() => {
                      setSelectedMaterialType(type);
                      setSelectedItem(null);
                      handleChange('materialId', '');
                      handleChange('unit', MATERIAL_TYPE_UNITS[type]);
                      // Reset type-specific fields
                      handleChange('width', '');
                      handleChange('color', '');
                      handleChange('lotNumber', '');
                      handleChange('rollNumber', '');
                      handleChange('challanNumber', '');
                      handleChange('supplierInvoice', '');
                    }}
                  >
                    <span className="font-medium">{MATERIAL_TYPE_LABELS[type]}</span>
                    <span className="text-xs opacity-70">{count} items</span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Select Item (only shown after type selection) */}
        {selectedMaterialType && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Step 2: Select {MATERIAL_TYPE_LABELS[selectedMaterialType]}</CardTitle>
            </CardHeader>
            <CardContent>
              {unifiedMaterials.filter((m) => m.type === selectedMaterialType).length === 0 ? (
                <Alert className="bg-amber-50 text-amber-900 border-amber-200">
                  <AlertDescription>
                    No {MATERIAL_TYPE_LABELS[selectedMaterialType].toLowerCase()} found in the system. Please add items
                    in the <strong>{MATERIAL_TYPE_LABELS[selectedMaterialType]} Master</strong> first before inwarding
                    stock.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <Select value={formData.materialId} onValueChange={handleMaterialSelect}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={`Select ${MATERIAL_TYPE_LABELS[selectedMaterialType].toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent className="max-h-96">
                      {unifiedMaterials
                        .filter((m) => {
                          // Show both LABEL and LABEL_VARIANT types when LABEL is selected
                          if (selectedMaterialType === 'LABEL') {
                            return m.type === 'LABEL' || m.type === 'LABEL_VARIANT';
                          }
                          return m.type === selectedMaterialType;
                        })
                        .map((mat) => {
                          // For LABEL_VARIANT, use material ID directly; for others, use type:id
                          const value = mat.type === 'LABEL_VARIANT' ? mat.id : `${mat.type}:${mat.id}`;
                          return (
                            <SelectItem key={`${mat.type}-${mat.id}`} value={value}>
                              <span className="font-medium">{mat.code}</span>
                              <span className="text-muted-foreground"> - {mat.name}</span>
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>

                  {/* Show item details when selected */}
                  {selectedItem && (
                    <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <Info className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">Item Details</span>
                      </div>
                      {renderItemDetails()}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Stock In Details (only shown after item selection) */}
        {selectedItem && (
          <Card className="mb-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Step 3: Stock In Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Warehouse Selection */}
                <div className="space-y-2">
                  <Label htmlFor="warehouseId">
                    Warehouse <span className="text-red-500">*</span>
                  </Label>
                  <Select value={formData.warehouseId} onValueChange={(value) => handleChange('warehouseId', value)}>
                    <SelectTrigger id="warehouseId">
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((wh) => (
                        <SelectItem key={wh.id} value={wh.id}>
                          {wh.warehouseCode} - {wh.warehouseName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Quantity */}
                <div className="space-y-2">
                  <Label htmlFor="quantity">
                    Quantity <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => handleChange('quantity', e.target.value)}
                    min="0"
                    step="0.01"
                    required
                    placeholder="Enter quantity"
                  />
                </div>

                {/* Unit */}
                <div className="space-y-2">
                  <Label htmlFor="unit">
                    Unit <span className="text-red-500">*</span>
                  </Label>
                  <Select value={formData.unit} onValueChange={(value) => handleChange('unit', value)}>
                    <SelectTrigger id="unit">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedMaterialType &&
                        getUnitsForType(selectedMaterialType).map((unit) => (
                          <SelectItem key={unit.value} value={unit.value}>
                            {unit.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Rate */}
                <div className="space-y-2">
                  <Label htmlFor="rate">Rate per Unit (₹)</Label>
                  <Input
                    id="rate"
                    type="number"
                    value={formData.rate}
                    onChange={(e) => handleChange('rate', e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder="Enter rate"
                  />
                </div>

                {/* Type-specific fields */}
                {renderTypeSpecificFields()}

                {/* Reference Type */}
                <div className="space-y-2">
                  <Label htmlFor="referenceType">Reference Type</Label>
                  <Select
                    value={formData.referenceType}
                    onValueChange={(value) => handleChange('referenceType', value)}
                  >
                    <SelectTrigger id="referenceType">
                      <SelectValue placeholder="Select reference type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="GRN">GRN (Goods Receipt Note)</SelectItem>
                      <SelectItem value="PURCHASE_ORDER">Purchase Order</SelectItem>
                      <SelectItem value="RETURN">Return</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Reference Number */}
                <div className="space-y-2">
                  <Label htmlFor="referenceNumber">Reference Number</Label>
                  <Input
                    id="referenceNumber"
                    value={formData.referenceNumber}
                    onChange={(e) => handleChange('referenceNumber', e.target.value)}
                    placeholder="GRN/PO number"
                  />
                </div>

                {/* Remarks - full width */}
                <div className="space-y-2 md:col-span-2 lg:col-span-3">
                  <Label htmlFor="remarks">Remarks</Label>
                  <Textarea
                    id="remarks"
                    value={formData.remarks}
                    onChange={(e) => handleChange('remarks', e.target.value)}
                    rows={2}
                    placeholder="Any additional notes..."
                  />
                </div>
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
          <Button type="submit" disabled={loading || !selectedItem}>
            {loading ? <ButtonSpinner className="mr-2" /> : <Save className="mr-2 h-4 w-4" />}
            Create Stock IN
          </Button>
        </div>
      </form>
    </div>
  );
}
