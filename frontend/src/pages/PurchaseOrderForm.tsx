import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getAllSuppliers, getSupplierById } from '@/services/supplier.service';
import { getAllMaterials } from '@/services/material.service';
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
} from '@/types/purchaseOrder.types';
import { Unit as UnitEnum } from '@/types/purchaseOrder.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { Trash2, Plus, Send, Save, ArrowLeft } from 'lucide-react';

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
  materialId: string;
  materialCode: string;
  materialName: string;
  orderedQuantity: string;
  unit: Unit;
  unitPrice: string;
  totalPrice: number;
  remarks: string;
}

export default function PurchaseOrderForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [supplierId, setSupplierId] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState<POItemForm[]>([]);

  // For adding new items
  const [showMaterialPicker, setShowMaterialPicker] = useState(false);
  const [materialSearch, setMaterialSearch] = useState('');

  useEffect(() => {
    fetchSuppliers();
    fetchMaterials();
    if (isEditMode && id) {
      fetchPurchaseOrder(id);
    }
  }, [id, isEditMode]);

  const fetchSuppliers = async () => {
    try {
      const response = await getAllSuppliers({ limit: 200 });
      setSuppliers(response.data);
    } catch (err) {
      handleApiError(err, 'Failed to load suppliers', false);
    }
  };

  const fetchMaterials = async () => {
    try {
      const response = await getAllMaterials({ limit: 500 });
      setMaterials(response.data);
    } catch (err) {
      handleApiError(err, 'Failed to load materials', false);
    }
  };

  const fetchPurchaseOrder = async (poId: string) => {
    try {
      setIsLoading(true);
      const po = await getPurchaseOrderById(poId);

      setSupplierId(po.supplierId);
      if (po.suppliers) {
        setSelectedSupplier(po.suppliers as Supplier);
      }
      setExpectedDeliveryDate(po.expectedDeliveryDate.split('T')[0]);
      setPaymentTerms(po.paymentTerms || '');
      setRemarks(po.remarks || '');

      if (po.purchase_order_items && po.purchase_order_items.length > 0) {
        const loadedItems: POItemForm[] = po.purchase_order_items.map((item, index) => ({
          tempId: `existing-${item.id}-${index}`,
          materialId: item.materialId,
          materialCode: item.materials?.code || '',
          materialName: item.materials?.name || '',
          orderedQuantity: String(item.orderedQuantity),
          unit: item.unit,
          unitPrice: String(item.unitPrice),
          totalPrice: item.totalPrice,
          remarks: item.remarks || '',
        }));
        setItems(loadedItems);
      }
    } catch (err) {
      handleApiError(err, 'Failed to load purchase order');
      navigate('/procurement/purchase-orders');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSupplierChange = async (newSupplierId: string) => {
    setSupplierId(newSupplierId);
    const supplier = suppliers.find((s) => s.id === newSupplierId);
    if (supplier) {
      setSelectedSupplier(supplier);
      if (supplier.paymentTerms && !paymentTerms) {
        setPaymentTerms(supplier.paymentTerms);
      }
    }
  };

  const addItem = (material: Material) => {
    const newItem: POItemForm = {
      tempId: Date.now().toString(),
      materialId: material.id,
      materialCode: material.code,
      materialName: material.name,
      orderedQuantity: '1',
      unit: (material.unit as Unit) || 'PCS',
      unitPrice: String(material.costPerUnit || 0),
      totalPrice: material.costPerUnit || 0,
      remarks: '',
    };
    setItems([...items, newItem]);
    setShowMaterialPicker(false);
    setMaterialSearch('');
  };

  const removeItem = (tempId: string) => {
    setItems(items.filter((item) => item.tempId !== tempId));
  };

  const updateItem = (tempId: string, field: keyof POItemForm, value: string) => {
    setItems(
      items.map((item) => {
        if (item.tempId !== tempId) return item;

        const updatedItem = { ...item, [field]: value };

        // Recalculate total price if quantity or unit price changes
        if (field === 'orderedQuantity' || field === 'unitPrice') {
          const qty = parseFloat(updatedItem.orderedQuantity) || 0;
          const price = parseFloat(updatedItem.unitPrice) || 0;
          updatedItem.totalPrice = qty * price;
        }

        return updatedItem;
      })
    );
  };

  const calculateGrandTotal = () => {
    return items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
  };

  const validateForm = (): boolean => {
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
    for (const item of items) {
      if (!item.materialId) {
        handleApiError(new Error('Please select a material for all items'), 'Validation Error');
        return false;
      }
      if (!item.orderedQuantity || parseFloat(item.orderedQuantity) <= 0) {
        handleApiError(
          new Error(`Please enter valid quantity for ${item.materialName}`),
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
        materialId: item.materialId,
        orderedQuantity: parseFloat(item.orderedQuantity),
        unit: item.unit,
        unitPrice: parseFloat(item.unitPrice),
        remarks: item.remarks || undefined,
      }));

      const data: CreatePurchaseOrderRequest = {
        supplierId,
        expectedDeliveryDate,
        paymentTerms: paymentTerms || undefined,
        remarks: remarks || undefined,
        items: itemsData,
      };

      let savedPO;
      if (isEditMode && id) {
        savedPO = await updatePurchaseOrder(id, {
          supplierId,
          expectedDeliveryDate,
          paymentTerms: paymentTerms || undefined,
          remarks: remarks || undefined,
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

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

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
          <h1 className="text-2xl font-bold">
            {isEditMode ? 'Edit Purchase Order' : 'Create Purchase Order'}
          </h1>
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

      {/* Supplier & Order Info */}
      <Card>
        <CardHeader>
          <CardTitle>Order Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier *</Label>
              <Select value={supplierId} onValueChange={handleSupplierChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name} ({supplier.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Supplier Details</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Contact:</span>
                  <p>{selectedSupplier.contactPerson || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Phone:</span>
                  <p>{selectedSupplier.phone || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Email:</span>
                  <p>{selectedSupplier.email || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Payment Terms:</span>
                  <p>{selectedSupplier.paymentTerms || '-'}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Order Items</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMaterialPicker(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No items added yet. Click "Add Item" to start.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="w-[120px]">Quantity</TableHead>
                  <TableHead className="w-[100px]">Unit</TableHead>
                  <TableHead className="w-[120px]">Unit Price</TableHead>
                  <TableHead className="w-[120px]">Total</TableHead>
                  <TableHead className="w-[150px]">Remarks</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.tempId}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{item.materialCode}</div>
                        <div className="text-sm text-gray-500">{item.materialName}</div>
                      </div>
                    </TableCell>
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
                      <Select
                        value={item.unit}
                        onValueChange={(value) => updateItem(item.tempId, 'unit', value)}
                      >
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
                    <TableCell className="font-medium">
                      {formatCurrency(item.totalPrice)}
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
                        className="text-red-600 hover:text-red-800"
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
                <div className="text-sm text-gray-500">Grand Total</div>
                <div className="text-2xl font-bold">{formatCurrency(calculateGrandTotal())}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
                  <div className="text-center py-4 text-gray-500">No materials found</div>
                ) : (
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
                      {filteredMaterials.slice(0, 50).map((material) => (
                        <TableRow key={material.id}>
                          <TableCell className="font-medium">{material.code}</TableCell>
                          <TableCell>{material.name}</TableCell>
                          <TableCell>{material.materialType}</TableCell>
                          <TableCell>{material.unit || '-'}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => addItem(material)}
                              disabled={items.some((i) => i.materialId === material.id)}
                            >
                              {items.some((i) => i.materialId === material.id) ? 'Added' : 'Add'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
