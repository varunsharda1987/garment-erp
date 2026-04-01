// Quick Issue Form - Issue materials via challan (Stock Out with proper tracking)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, X, ArrowRightLeft, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/combobox';
import type { ComboboxOption } from '@/components/ui/combobox';
import { ButtonSpinner } from '@/components/LoadingSpinner';
import { PageHeader } from '@/components/PageHeader';
import { challanService } from '../services/challan.service';
import warehouseService from '../services/warehouse.service';
import stockLevelService from '../services/stockLevel.service';
import { getAllSuppliers } from '../services/supplier.service';
import { fabricStockService } from '../services/fabricStock.service';
import { greigeStockService } from '../services/greigeStock.service';
import type { GreigeStockEntry } from '../services/greigeStock.service';
import { SupplierCategory, SupplierCategoryLabels } from '../types/supplier.types';
import type { CreateChallanInput, ChallanType } from '../types/challan.types';
import type { Warehouse, StockLevel } from '../types/inventory-exports';
import { logError } from '../lib/logger';

type StockType = 'GENERAL' | 'FABRIC' | 'GREIGE';

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

export default function StockOutForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [challanType, setChallanType] = useState<ChallanType>('OUTWARD');
  const [stockType, setStockType] = useState<StockType>('GENERAL');
  const [warehouseId, setWarehouseId] = useState('');
  const [warehouseName, setWarehouseName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [remarks, setRemarks] = useState('');

  // Destination
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierCategory, setSupplierCategory] = useState('');
  const [department, setDepartment] = useState('');
  const [customDepartment, setCustomDepartment] = useState('');

  // Material selection
  const [materialId, setMaterialId] = useState('');
  const [materialDescription, setMaterialDescription] = useState('');
  const [fabricStockId, setFabricStockId] = useState('');
  const [greigeStockId, setGreigeStockId] = useState('');
  const [availableQty, setAvailableQty] = useState<number | null>(null);
  const [rate, setRate] = useState<number | null>(null);

  // Data lists
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<ComboboxOption[]>([]);
  const [fabricStocks, setFabricStocks] = useState<FabricStockOption[]>([]);
  const [greigeStocks, setGreigeStocks] = useState<GreigeStockEntry[]>([]);
  const [suppliersRaw, setSuppliersRaw] = useState<{ id: string; name: string; code?: string }[]>([]);

  // Load warehouses on mount
  useEffect(() => {
    loadWarehouses();
  }, []);

  // Load suppliers when OUTWARD selected or category changes
  useEffect(() => {
    if (challanType === 'OUTWARD') {
      loadSuppliers();
    }
  }, [challanType, supplierCategory]);

  // Auto-set stock type based on supplier category
  useEffect(() => {
    if (!supplierCategory) return;
    const categoryToStockType: Record<string, StockType | null> = {
      FABRIC_SUPPLIER: 'FABRIC',
      GREIGE_SUPPLIER: 'GREIGE',
      TRIMS_SUPPLIER: 'GENERAL',
      THREAD_SUPPLIER: 'GENERAL',
      PACKAGING_SUPPLIER: 'GENERAL',
      LACE_SUPPLIER: 'GENERAL',
      MACHINE_PARTS_SUPPLIER: 'GENERAL',
      OTHER_SERVICES: 'GENERAL',
      // Processors — don't auto-set, user picks stock type
      DYEING_PRINTING: null,
      EMBROIDERY: null,
      HAND_WORK: null,
      SMOCKING: null,
      CMT_UNIT: null,
      FINISHING_CONTRACTOR: null,
      STITCHING_CONTRACTOR: null,
      WASHING: null,
      DORI_PIPING_CONTRACTOR: null,
    };
    const mapped = categoryToStockType[supplierCategory];
    if (mapped) {
      setStockType(mapped);
    }
  }, [supplierCategory]);

  // Load stock levels when warehouse changes (for GENERAL stock type)
  useEffect(() => {
    if (warehouseId && stockType === 'GENERAL') {
      loadStockLevels(warehouseId);
    }
  }, [warehouseId, stockType]);

  // Load fabric stock when FABRIC selected
  useEffect(() => {
    if (stockType === 'FABRIC') {
      loadFabricStock();
    }
  }, [stockType]);

  // Load greige stock when GREIGE selected
  useEffect(() => {
    if (stockType === 'GREIGE') {
      loadGreigeStock();
    }
  }, [stockType]);

  // Reset material selection when stock type changes
  useEffect(() => {
    setMaterialId('');
    setFabricStockId('');
    setGreigeStockId('');
    setMaterialDescription('');
    setAvailableQty(null);
    setRate(null);
    setUnit('');
    setQuantity('');
  }, [stockType]);

  const loadWarehouses = async () => {
    try {
      const data = await warehouseService.getAll({ isActive: true });
      setWarehouses(data);
    } catch (err) {
      logError('Failed to load warehouses:', err);
    }
  };

  const loadSuppliers = async () => {
    try {
      const result = await getAllSuppliers({
        category: supplierCategory || undefined,
        limit: 100,
      });
      const data = (result as any).data || [];
      const raw = data.map((s: any) => ({
        id: s.id,
        name: s.name,
        code: s.code,
      }));
      setSuppliersRaw(raw);
      setSupplierOptions(
        raw.map((s: { id: string; name: string; code?: string }) => ({
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
      setStockLevels(data.filter((s) => Number(s.quantity) > 0));
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
      const data = await greigeStockService.listAvailableStock();
      setGreigeStocks(data.filter((g) => Number(g.quantityAvailable) > 0));
    } catch (err) {
      logError('Failed to load greige stock:', err);
    }
  };

  const handleWarehouseChange = (whId: string) => {
    setWarehouseId(whId);
    const wh = warehouses.find((w) => w.id === whId);
    setWarehouseName(wh ? `${wh.warehouseCode} - ${wh.warehouseName}` : '');
    setMaterialId('');
    setMaterialDescription('');
    setAvailableQty(null);
    setRate(null);
    setUnit('');
  };

  const handleMaterialChange = (matId: string) => {
    setMaterialId(matId);
    const stock = stockLevels.find((s) => s.materialId === matId);
    if (stock) {
      setMaterialDescription(`${stock.materials?.code || ''} - ${stock.materials?.name || ''}`);
      setAvailableQty(Number(stock.quantity));
      setRate(Number(stock.valuationRate) || null);
      setUnit(stock.unit);
    }
  };

  const handleFabricStockChange = (fsId: string) => {
    setFabricStockId(fsId);
    const fs = fabricStocks.find((f) => f.id === fsId);
    if (fs) {
      setMaterialDescription(`${fs.fabricCode} - ${fs.fabricName}${fs.colorName ? ` (${fs.colorName})` : ''}`);
      setAvailableQty(fs.quantityAvailable);
      setRate(fs.purchaseCost);
      setUnit('MTR');
    }
  };

  const handleGreigeStockChange = (gsId: string) => {
    setGreigeStockId(gsId);
    const gs = greigeStocks.find((g) => g.id === gsId);
    if (gs) {
      const widthStr = gs.greigeWidth ? ` / ${gs.greigeWidth}"` : '';
      const constructionStr = gs.greige.construction ? ` / ${gs.greige.construction}` : '';
      setMaterialDescription(
        `${gs.greige.greigeCode} - ${gs.greige.greigeName}${constructionStr}${widthStr} (${gs.greige.composition})`
      );
      setAvailableQty(Number(gs.quantityAvailable));
      setRate(Number(gs.purchaseCost || gs.weightedAvgCost) || null);
      setUnit('MTR');
    }
  };

  const handleSupplierChange = (supId: string) => {
    setSupplierId(supId);
    const sup = suppliersRaw.find((s) => s.id === supId);
    setSupplierName(sup?.name || '');
  };

  const getDestinationName = (): string => {
    if (challanType === 'OUTWARD') return supplierName;
    return department === 'OTHER' ? customDepartment : department;
  };

  const getDestinationType = (): string => {
    return challanType === 'OUTWARD' ? 'SUPPLIER' : 'DEPARTMENT';
  };

  const isFormValid = (): boolean => {
    if (!quantity || Number(quantity) <= 0) return false;
    if (!getDestinationName()) return false;

    if (stockType === 'GENERAL') {
      if (!warehouseId || !materialId) return false;
    } else if (stockType === 'FABRIC') {
      if (!fabricStockId) return false;
    } else if (stockType === 'GREIGE') {
      if (!greigeStockId) return false;
    }

    if (availableQty !== null && Number(quantity) > availableQty) return false;

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isFormValid()) {
      setError('Please fill in all required fields and ensure quantity does not exceed available stock');
      return;
    }

    const destinationName = getDestinationName();
    const qty = Number(quantity);

    // Build challan input
    const input: CreateChallanInput = {
      challanType,
      fromType: 'WAREHOUSE',
      fromName: warehouseName || 'Main Store',
      toType: getDestinationType(),
      toId: challanType === 'OUTWARD' ? supplierId : undefined,
      toName: destinationName,
      unit: unit || 'PCS',
      remarks: remarks || undefined,
      items: [],
    };

    // Build item based on stock type
    if (stockType === 'GENERAL') {
      input.items.push({
        itemType: 'TRIM',
        materialId,
        description: materialDescription,
        quantity: qty,
        unit: unit || 'PCS',
        rate: rate || undefined,
      });
    } else if (stockType === 'FABRIC') {
      const fs = fabricStocks.find((f) => f.id === fabricStockId);
      input.items.push({
        itemType: 'FABRIC',
        fabricStockId,
        fabricId: fs?.fabricId,
        description: materialDescription,
        quantity: qty,
        unit: 'MTR',
        rate: rate || undefined,
      });
    } else if (stockType === 'GREIGE') {
      input.items.push({
        itemType: 'GREIGE',
        greigeStockId,
        description: materialDescription,
        quantity: qty,
        unit: 'MTR',
        rate: rate || undefined,
      });
    }

    try {
      setLoading(true);
      const challan = await challanService.quickIssueChallan(input);
      setSuccess(`Challan ${challan.challanNumber} created and issued successfully!`);
      setTimeout(() => navigate(`/challans`), 2000);
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
      <PageHeader title="Quick Issue (Stock Out via Challan)" />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 bg-green-50 text-green-900 border-green-200">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Issue Type */}
              <div className="space-y-2 md:col-span-2">
                <Label>
                  Issue Type <span className="text-red-500">*</span>
                </Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={challanType === 'OUTWARD' ? 'default' : 'outline'}
                    onClick={() => {
                      setChallanType('OUTWARD');
                      setSupplierId('');
                      setSupplierName('');
                    }}
                    className="flex-1"
                  >
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                    Outward (To Supplier / Processor)
                  </Button>
                  <Button
                    type="button"
                    variant={challanType === 'INTERNAL' ? 'default' : 'outline'}
                    onClick={() => {
                      setChallanType('INTERNAL');
                      setDepartment('');
                    }}
                    className="flex-1"
                  >
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    Internal (Dept to Dept)
                  </Button>
                </div>
              </div>

              {/* Destination - Supplier (OUTWARD) */}
              {challanType === 'OUTWARD' && (
                <>
                  <div className="space-y-2">
                    <Label>Supplier Category</Label>
                    <Select
                      value={supplierCategory}
                      onValueChange={(v) => {
                        setSupplierCategory(v === 'ALL' ? '' : v);
                        setSupplierId('');
                        setSupplierName('');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Categories</SelectItem>
                        {Object.entries(SupplierCategoryLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Supplier / Processor <span className="text-red-500">*</span>
                    </Label>
                    <Combobox
                      options={supplierOptions}
                      value={supplierId}
                      onValueChange={handleSupplierChange}
                      placeholder="Select supplier / processor"
                      searchPlaceholder="Type to search suppliers..."
                      emptyText="No suppliers found"
                    />
                  </div>
                </>
              )}

              {/* Destination - Department (INTERNAL) */}
              {challanType === 'INTERNAL' && (
                <div className="space-y-2 md:col-span-2">
                  <Label>
                    Destination: Department <span className="text-red-500">*</span>
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

              {/* Stock Type */}
              <div className="space-y-2">
                <Label>
                  Stock Type <span className="text-red-500">*</span>
                </Label>
                <Select value={stockType} onValueChange={(v) => setStockType(v as StockType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GENERAL">General Material (Trim / Accessory)</SelectItem>
                    <SelectItem value="FABRIC">Fabric</SelectItem>
                    <SelectItem value="GREIGE">Greige</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Warehouse (for General materials) */}
              {stockType === 'GENERAL' && (
                <div className="space-y-2">
                  <Label>
                    Warehouse <span className="text-red-500">*</span>
                  </Label>
                  <Select value={warehouseId} onValueChange={handleWarehouseChange}>
                    <SelectTrigger>
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
              )}

              {/* Material Selection - General */}
              {stockType === 'GENERAL' && (
                <div className="space-y-2 md:col-span-2">
                  <Label>
                    Material <span className="text-red-500">*</span>
                  </Label>
                  <Select value={materialId} onValueChange={handleMaterialChange} disabled={!warehouseId}>
                    <SelectTrigger>
                      <SelectValue placeholder={warehouseId ? 'Select material' : 'Select warehouse first'} />
                    </SelectTrigger>
                    <SelectContent>
                      {stockLevels.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No stock available
                        </SelectItem>
                      ) : (
                        stockLevels.map((stock) => (
                          <SelectItem key={stock.id} value={stock.materialId}>
                            {stock.materials?.code} - {stock.materials?.name}
                            {' (Avail: '}
                            {Number(stock.quantity).toFixed(2)} {stock.unit})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Material Selection - Fabric */}
              {stockType === 'FABRIC' && (
                <div className="space-y-2 md:col-span-2">
                  <Label>
                    Fabric Stock <span className="text-red-500">*</span>
                  </Label>
                  <Select value={fabricStockId} onValueChange={handleFabricStockChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select fabric stock" />
                    </SelectTrigger>
                    <SelectContent>
                      {fabricStocks.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No fabric stock available
                        </SelectItem>
                      ) : (
                        fabricStocks.map((fs) => (
                          <SelectItem key={fs.id} value={fs.id}>
                            {fs.fabricCode} - {fs.fabricName}
                            {fs.colorName ? ` (${fs.colorName})` : ''}
                            {' — Avail: '}
                            {fs.quantityAvailable.toFixed(2)} MTR
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Material Selection - Greige */}
              {stockType === 'GREIGE' && (
                <div className="space-y-2 md:col-span-2">
                  <Label>
                    Greige Stock <span className="text-red-500">*</span>
                  </Label>
                  <Combobox
                    options={greigeStocks.map((gs) => ({
                      value: gs.id,
                      label: `${gs.greige.greigeCode} - ${gs.greige.greigeName}${gs.greige.construction ? ' / ' + gs.greige.construction : ''}${gs.greigeWidth ? ' / ' + gs.greigeWidth + '"' : ''} (${gs.greige.composition}) — ${Number(gs.quantityAvailable).toFixed(2)} MTR${gs.qualityGrade ? ' [' + gs.qualityGrade + ']' : ''}`,
                      searchText: `${gs.greige.greigeCode} ${gs.greige.greigeName} ${gs.greige.composition} ${gs.greige.construction || ''} ${gs.greige.yarnCount || ''}`,
                    }))}
                    value={greigeStockId}
                    onValueChange={handleGreigeStockChange}
                    placeholder="Select greige stock"
                    searchPlaceholder="Type to search greige stock..."
                    emptyText="No greige stock available"
                  />
                </div>
              )}

              {/* Stock Info */}
              {availableQty !== null && (
                <div className="md:col-span-2">
                  <Alert className="bg-blue-50 text-blue-900 border-blue-200">
                    <AlertDescription>
                      Available: {availableQty.toFixed(2)} {unit}
                      {rate ? ` | Rate: ₹${rate.toFixed(2)} per ${unit}` : ''}
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Quantity */}
              <div className="space-y-2">
                <Label>
                  Quantity to Issue <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  min="0"
                  step="0.01"
                  required
                />
                {availableQty !== null && Number(quantity) > availableQty && (
                  <p className="text-sm text-red-500">
                    Exceeds available stock ({availableQty.toFixed(2)} {unit})
                  </p>
                )}
              </div>

              {/* Unit (readonly) */}
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input value={unit} disabled />
                <p className="text-sm text-muted-foreground">Auto-filled from material</p>
              </div>

              {/* Remarks */}
              <div className="space-y-2 md:col-span-2">
                <Label>Remarks</Label>
                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  placeholder="Reason for issuance, processing details, etc."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end md:col-span-2">
                <Button type="button" variant="outline" onClick={() => navigate('/inventory/movements')}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || !isFormValid()}>
                  {loading ? <ButtonSpinner className="mr-2" /> : <Send className="mr-2 h-4 w-4" />}
                  Issue via Challan
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
