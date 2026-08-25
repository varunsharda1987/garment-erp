/**
 * SaleOrderForm - Unified create/edit sheet for sale orders.
 * Opens as a right-side drawer with all fields and items management.
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { CustomerCombobox } from '@/components/CustomerCombobox';
import { StyleCombobox } from '@/components/StyleCombobox';
import { SaleOrderItemsTable } from './SaleOrderItemsTable';
import type { DisplayItem } from './SaleOrderItemsTable';
import type { SaleOrder, CreateSORequest, UpdateSORequest, SOItemInput } from '@/types/saleOrder.types';
import type { Style } from '@/types/style.types';

interface SaleOrderFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateSORequest | UpdateSORequest) => Promise<void>;
  saleOrder?: SaleOrder;
  mode: 'create' | 'edit';
  isSubmitting?: boolean;
}

function toDateInputValue(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export function SaleOrderForm({
  open,
  onOpenChange,
  onSubmit,
  saleOrder,
  mode,
  isSubmitting = false,
}: SaleOrderFormProps) {
  // Form state
  const [customerId, setCustomerId] = useState('');
  const [buyerPoNumber, setBuyerPoNumber] = useState('');
  const [styleId, setStyleId] = useState<string | null>(null);
  const [expectedShipDate, setExpectedShipDate] = useState('');
  const [buyerDeadline, setBuyerDeadline] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState<DisplayItem[]>([]);

  // Populate form when editing
  useEffect(() => {
    if (open && mode === 'edit' && saleOrder) {
      setCustomerId(saleOrder.customerId);
      setBuyerPoNumber(saleOrder.buyerPoNumber || '');
      setStyleId(saleOrder.styleId || null);
      setExpectedShipDate(toDateInputValue(saleOrder.expectedShipDate));
      setBuyerDeadline(toDateInputValue(saleOrder.buyerDeadline));
      setOrderDate(toDateInputValue(saleOrder.orderDate));
      setDeliveryDate(toDateInputValue(saleOrder.deliveryDate));
      setPaymentTerms(saleOrder.paymentTerms || '');
      setDeliveryAddress(saleOrder.deliveryAddress || '');
      setRemarks(saleOrder.remarks || '');
      setItems(
        (saleOrder.items || []).map((item) => ({
          id: item.id,
          styleId: item.styleId,
          colorId: item.colorId || null,
          sizeId: item.sizeId || null,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
          styleCode: item.style?.styleCode,
          styleName: item.style?.styleName,
          colorName: item.color?.colorName,
          sizeName: item.size?.sizeName,
        }))
      );
    } else if (open && mode === 'create') {
      // Reset form for new order
      setCustomerId('');
      setBuyerPoNumber('');
      setStyleId(null);
      setExpectedShipDate('');
      setBuyerDeadline('');
      setOrderDate('');
      setDeliveryDate('');
      setPaymentTerms('');
      setDeliveryAddress('');
      setRemarks('');
      setItems([]);
    }
  }, [open, mode, saleOrder]);

  const handleCustomerChange = useCallback((id: string) => {
    setCustomerId(id);
  }, []);

  const handleStyleChange = useCallback(
    (id: string, style?: Style) => {
      setStyleId(id || null);
      // Optionally auto-populate customer from style if not already set
      if (style?.customerName && !customerId) {
        // Could fetch customer by name here if needed
      }
    },
    [customerId]
  );

  const handleSubmit = async () => {
    if (!customerId) {
      toast.error('Please select a customer');
      return;
    }
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    const itemsPayload: SOItemInput[] = items.map((item) => ({
      styleId: item.styleId,
      colorId: item.colorId || null,
      sizeId: item.sizeId || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));

    if (mode === 'create') {
      const payload: CreateSORequest = {
        customerId,
        buyerPoNumber: buyerPoNumber || undefined,
        styleId: styleId || undefined,
        expectedShipDate: expectedShipDate || undefined,
        buyerDeadline: buyerDeadline || undefined,
        orderDate: orderDate || undefined,
        deliveryDate: deliveryDate || undefined,
        paymentTerms: paymentTerms || undefined,
        deliveryAddress: deliveryAddress || undefined,
        remarks: remarks || undefined,
        items: itemsPayload,
      };
      await onSubmit(payload);
    } else {
      const payload: UpdateSORequest = {
        customerId,
        buyerPoNumber: buyerPoNumber || null,
        styleId: styleId || null,
        expectedShipDate: expectedShipDate || null,
        buyerDeadline: buyerDeadline || null,
        orderDate: orderDate || null,
        deliveryDate: deliveryDate || null,
        paymentTerms: paymentTerms || null,
        deliveryAddress: deliveryAddress || null,
        remarks: remarks || null,
        items: itemsPayload,
      };
      await onSubmit(payload);
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{mode === 'edit' ? 'Edit Sale Order' : 'New Sale Order'}</SheetTitle>
          <SheetDescription>
            {mode === 'edit'
              ? `Update ${saleOrder?.saleOrderNumber || 'sale order'} details and items.`
              : 'Create a new sale order with customer details and line items.'}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Customer Selection */}
          <div className="space-y-2">
            <Label>
              Customer <span className="text-destructive">*</span>
            </Label>
            <CustomerCombobox
              value={customerId}
              onValueChange={handleCustomerChange}
              placeholder="Search customer..."
            />
          </div>

          {/* Buyer PO Number */}
          <div className="space-y-2">
            <Label>Buyer PO Number</Label>
            <Input
              value={buyerPoNumber}
              onChange={(e) => setBuyerPoNumber(e.target.value)}
              placeholder="Buyer's purchase order number"
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">B2B tracking key (House of Kasya PO number)</p>
          </div>

          {/* Primary Style (optional) */}
          <div className="space-y-2">
            <Label>Primary Style</Label>
            <StyleCombobox
              value={styleId || ''}
              onChange={handleStyleChange}
              placeholder="Select primary style (optional)"
              status={null}
            />
            <p className="text-xs text-muted-foreground">For single-style orders. Items can have different styles.</p>
          </div>

          <Separator />

          {/* Dates Section */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Expected Ship Date</Label>
              <Input type="date" value={expectedShipDate} onChange={(e) => setExpectedShipDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Buyer Deadline</Label>
              <Input type="date" value={buyerDeadline} onChange={(e) => setBuyerDeadline(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Order Date</Label>
              <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Delivery Date</Label>
              <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
            </div>
          </div>

          <Separator />

          {/* Items Section */}
          <div className="space-y-2">
            <Label>
              Items <span className="text-destructive">*</span>
            </Label>
            <SaleOrderItemsTable items={items} onChange={setItems} editable={true} />
          </div>

          <Separator />

          {/* Additional Details */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Payment Terms</Label>
              <Input
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="e.g., Net 30, COD"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Delivery Address</Label>
              <Textarea
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Shipping/delivery address"
                rows={2}
                maxLength={500}
              />
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Additional notes..."
                rows={2}
                maxLength={500}
              />
            </div>
          </div>

          {/* Total Summary */}
          {items.length > 0 && (
            <div className="p-4 bg-muted rounded-md">
              <div className="flex justify-between text-lg font-medium">
                <span>Total Amount:</span>
                <span>
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalAmount)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {items.length} item{items.length !== 1 ? 's' : ''} · {items.reduce((sum, i) => sum + i.quantity, 0)} pcs
              </p>
            </div>
          )}
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !customerId || items.length === 0}>
            {isSubmitting ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create Sale Order'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default SaleOrderForm;
