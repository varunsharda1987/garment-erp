import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { customerService } from '@/services/customer.service';
import { getAllOrders } from '@/services/order.service';
import { createInvoice, getInvoiceById, updateInvoice } from '@/services/invoice.service';
import type { Customer } from '@/types/customer.types';
import type { Order } from '@/types/order.types';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { formatCurrency } from '@/lib/currency';
import { ArrowLeft, FileText } from 'lucide-react';

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
  const [subtotal, setSubtotal] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    fetchCustomers();
    if (isEditMode && id) {
      fetchInvoice(id);
    }
  }, [id, isEditMode]);

  useEffect(() => {
    if (customerId) {
      fetchCustomerOrders(customerId);
    } else {
      setOrders([]);
      setOrderId('');
    }
  }, [customerId]);

  // Auto-calculate total when subtotal or tax changes
  useEffect(() => {
    const sub = parseFloat(subtotal) || 0;
    const tax = parseFloat(taxAmount) || 0;
    setTotalAmount((sub + tax).toFixed(2));
  }, [subtotal, taxAmount]);

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
        status: 'COMPLETED' // Only show completed orders
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
      setSubtotal(invoice.subtotal.toString());
      setTaxAmount(invoice.taxAmount.toString());
      setTotalAmount(invoice.totalAmount.toString());
      setRemarks(invoice.remarks || '');
    } catch (err) {
      handleApiError(err, 'Failed to load invoice');
      navigate('/invoices');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerId || !orderId || !dueDate) {
      handleApiError(new Error('Please fill in all required fields'), 'Validation Error');
      return;
    }

    const data = {
      customerId,
      orderId,
      invoiceDate,
      dueDate,
      subtotal: parseFloat(subtotal) || 0,
      taxAmount: parseFloat(taxAmount) || 0,
      totalAmount: parseFloat(totalAmount) || 0,
      remarks: remarks.trim() || undefined,
    };

    try {
      setIsLoading(true);

      if (isEditMode && id) {
        await updateInvoice(id, {
          invoiceDate: data.invoiceDate,
          dueDate: data.dueDate,
          subtotal: data.subtotal,
          taxAmount: data.taxAmount,
          totalAmount: data.totalAmount,
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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/invoices')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEditMode ? 'Edit Invoice' : 'Create Invoice'}
            </h1>
            <p className="text-sm text-gray-500">
              {isEditMode ? 'Update invoice details' : 'Generate a new invoice for an order'}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Customer Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerId">
                  Customer <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={customerId}
                  onValueChange={setCustomerId}
                  disabled={isEditMode}
                >
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
                  onValueChange={setOrderId}
                  disabled={isEditMode || !customerId || isLoadingOrders}
                >
                  <SelectTrigger id="orderId">
                    <SelectValue placeholder={isLoadingOrders ? "Loading orders..." : "Select order"} />
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
                  <p className="text-xs text-gray-500">No completed orders found for this customer</p>
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
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="subtotal">
                  Subtotal (₹) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="subtotal"
                  type="number"
                  step="0.01"
                  min="0"
                  value={subtotal}
                  onChange={(e) => setSubtotal(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxAmount">Tax Amount (₹)</Label>
                <Input
                  id="taxAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalAmount">
                  Total Amount (₹) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="totalAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="font-semibold"
                />
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
                rows={3}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/invoices')}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Invoice' : 'Create Invoice')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
