import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { customerService } from '@/services/customer.service';
import { getAllOrders, getOrderById } from '@/services/order.service';
import { createInvoice, getInvoiceById, updateInvoice } from '@/services/invoice.service';
import type { Customer } from '@/types/customer.types';
import type { Order } from '@/types/order.types';
import type { InvoiceItemInput } from '@/types/invoice.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import { ArrowLeft, FileText, Plus, Trash2 } from 'lucide-react';

interface InvoiceLineItem extends InvoiceItemInput {
  _key: string; // Unique key for React rendering
}

let lineItemKeyCounter = 0;
function nextKey() {
  return `item-${++lineItemKeyCounter}`;
}

export default function InvoiceForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  // Form state
  const [customerId, setCustomerId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [remarks, setRemarks] = useState('');

  // Line items
  const [items, setItems] = useState<InvoiceLineItem[]>([]);

  // Computed totals (derived from items)
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  useEffect(() => {
    fetchCustomers();
    if (isEditMode && id) {
      fetchInvoice(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEditMode]);

  useEffect(() => {
    if (customerId) {
      fetchCustomerOrders(customerId);
    } else {
      setOrders([]);
      setOrderId('');
    }
  }, [customerId]);

  const fetchCustomers = async () => {
    try {
      const response = await customerService.getAllCustomers({ limit: 100 });
      setCustomers(response.data);
    } catch (err) {
      handleApiError(err, 'Failed to load customers');
    }
  };

  const fetchCustomerOrders = async (custId: string) => {
    try {
      setIsLoadingOrders(true);
      const response = await getAllOrders({
        customerId: custId,
        limit: 100,
      });
      setOrders(response.data);
    } catch (err) {
      handleApiError(err, 'Failed to load orders', false);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const fetchInvoice = async (invoiceId: string) => {
    try {
      setIsLoading(true);
      const invoice = await getInvoiceById(invoiceId);

      setCustomerId(invoice.customerId);
      setOrderId(invoice.orderId);
      setInvoiceDate(invoice.invoiceDate.split('T')[0]);
      setDueDate(invoice.dueDate.split('T')[0]);
      setRemarks(invoice.remarks || '');

      // Load existing invoice items
      if (invoice.invoiceItems && invoice.invoiceItems.length > 0) {
        setItems(
          invoice.invoiceItems.map((item) => ({
            _key: nextKey(),
            styleId: item.styleId || undefined,
            description: item.description,
            hsnCode: item.hsnCode || undefined,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            remarks: item.remarks || undefined,
          }))
        );
      }
    } catch (err) {
      handleApiError(err, 'Failed to load invoice');
      navigate('/invoices');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-populate items from order
  const handleOrderChange = useCallback(
    async (newOrderId: string) => {
      setOrderId(newOrderId);

      if (!newOrderId) {
        setItems([]);
        return;
      }

      // Don't auto-populate in edit mode
      if (isEditMode) return;

      try {
        const order = await getOrderById(newOrderId);
        if (order.orderItems && order.orderItems.length > 0) {
          const newItems: InvoiceLineItem[] = order.orderItems.map((oi) => ({
            _key: nextKey(),
            styleId: oi.styleId,
            description: oi.style ? `${oi.style.styleCode} - ${oi.style.styleName}` : oi.itemDescription || 'Item',
            quantity: oi.totalQuantity,
            unitPrice: Number(oi.unitPrice),
          }));
          setItems(newItems);
        }
      } catch (err) {
        handleApiError(err, 'Failed to load order items', false);
      }
    },
    [isEditMode]
  );

  // Item management
  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        _key: nextKey(),
        description: '',
        quantity: 0,
        unitPrice: 0,
      },
    ]);
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((i) => i._key !== key));
  };

  const updateItem = (key: string, field: keyof InvoiceItemInput, value: string | number) => {
    setItems((prev) => prev.map((item) => (item._key === key ? { ...item, [field]: value } : item)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerId || !orderId || !dueDate) {
      handleApiError(new Error('Please fill in all required fields'), 'Validation Error');
      return;
    }

    if (items.length === 0) {
      handleApiError(new Error('Please add at least one line item'), 'Validation Error');
      return;
    }

    const validItems = items.filter((i) => i.description && i.quantity > 0 && i.unitPrice > 0);
    if (validItems.length === 0) {
      handleApiError(new Error('All line items must have description, quantity, and unit price'), 'Validation Error');
      return;
    }

    const data = {
      customerId,
      orderId,
      invoiceDate,
      dueDate,
      subtotal,
      remarks: remarks.trim() || undefined,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      items: validItems.map(({ _key, ...rest }) => rest),
    };

    try {
      setIsLoading(true);

      if (isEditMode && id) {
        await updateInvoice(id, {
          invoiceDate: data.invoiceDate,
          dueDate: data.dueDate,
          subtotal: data.subtotal,
          remarks: data.remarks,
        });
        handleApiSuccess('Invoice updated', 'Invoice has been successfully updated.');
      } else {
        const invoice = await createInvoice(data);
        handleApiSuccess('Invoice created', `Invoice ${invoice.invoiceNumber} has been successfully created.`);
      }

      navigate('/invoices');
    } catch (err) {
      handleApiError(err, `Failed to ${isEditMode ? 'update' : 'create'} invoice`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/invoices')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isEditMode ? 'Edit Invoice' : 'Create Invoice'}</h1>
            <p className="text-sm text-gray-500">
              {isEditMode ? 'Update invoice details' : 'Generate a new invoice for an order'}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        {/* Customer & Order */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerId">
                  Customer <span className="text-red-500">*</span>
                </Label>
                <Select value={customerId} onValueChange={setCustomerId} disabled={isEditMode}>
                  <SelectTrigger id="customerId">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.billingName || customer.name} ({customer.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="orderId">
                  Order <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={orderId}
                  onValueChange={handleOrderChange}
                  disabled={isEditMode || !customerId || isLoadingOrders}
                >
                  <SelectTrigger id="orderId">
                    <SelectValue placeholder={isLoadingOrders ? 'Loading orders...' : 'Select order'} />
                  </SelectTrigger>
                  <SelectContent>
                    {orders?.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.orderNumber} - {formatCurrency(order.totalAmount, { decimals: 0 })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {customerId && orders.length === 0 && !isLoadingOrders && (
                  <p className="text-xs text-gray-500">No orders found for this customer</p>
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoiceDate">Invoice Date</Label>
                <Input
                  id="invoiceDate"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">
                  Due Date <span className="text-red-500">*</span>
                </Label>
                <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
              </div>
            </div>

            {/* Remarks */}
            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add any additional notes or comments..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No items yet. Select an order to auto-populate items, or add items manually.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Description</TableHead>
                    <TableHead className="w-[15%]">HSN Code</TableHead>
                    <TableHead className="w-[12%] text-right">Qty</TableHead>
                    <TableHead className="w-[15%] text-right">Unit Price (₹)</TableHead>
                    <TableHead className="w-[13%] text-right">Amount (₹)</TableHead>
                    <TableHead className="w-[5%]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const lineTotal = item.quantity * item.unitPrice;
                    return (
                      <TableRow key={item._key}>
                        <TableCell>
                          <Input
                            value={item.description}
                            onChange={(e) => updateItem(item._key, 'description', e.target.value)}
                            placeholder="Item description"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.hsnCode || ''}
                            onChange={(e) => updateItem(item._key, 'hsnCode', e.target.value)}
                            placeholder="HSN"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            value={item.quantity || ''}
                            onChange={(e) => updateItem(item._key, 'quantity', parseInt(e.target.value) || 0)}
                            className="h-8 text-right"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice || ''}
                            onChange={(e) => updateItem(item._key, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="h-8 text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(lineTotal)}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700"
                            onClick={() => removeItem(item._key)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {/* Totals Summary */}
            {items.length > 0 && (
              <div className="flex justify-end mt-4 pt-4 border-t">
                <div className="w-72 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>GST (auto-calculated on save)</span>
                    <span>—</span>
                  </div>
                  <div className="flex justify-between font-semibold text-base pt-2 border-t">
                    <span>Subtotal (excl. tax)</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    GST will be calculated automatically based on HSN codes and customer state.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/invoices')} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || items.length === 0}>
            {isLoading
              ? isEditMode
                ? 'Updating...'
                : 'Creating...'
              : isEditMode
                ? 'Update Invoice'
                : 'Create Invoice'}
          </Button>
        </div>
      </form>
    </div>
  );
}
