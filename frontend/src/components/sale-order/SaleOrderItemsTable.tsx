/**
 * SaleOrderItemsTable - Editable table for sale order line items.
 * Supports add, edit, and remove operations when in editable mode.
 */

import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SaleOrderItemDialog } from './SaleOrderItemDialog';
import type { SOItemInput } from '@/types/saleOrder.types';

export interface DisplayItem extends SOItemInput {
  id?: string;
  styleName?: string;
  styleCode?: string;
  colorName?: string;
  sizeName?: string;
  totalPrice?: number;
}

interface SaleOrderItemsTableProps {
  items: DisplayItem[];
  onChange: (items: DisplayItem[]) => void;
  editable?: boolean;
}

export function SaleOrderItemsTable({ items, onChange, editable = true }: SaleOrderItemsTableProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
  };

  const totals = useMemo(() => {
    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    return { totalQty, totalAmount };
  }, [items]);

  const handleAddItem = (item: SOItemInput) => {
    const newItem: DisplayItem = {
      ...item,
      totalPrice: item.quantity * item.unitPrice,
    };
    onChange([...items, newItem]);
  };

  const handleAddMultipleItems = (newItems: SOItemInput[]) => {
    const displayItems: DisplayItem[] = newItems.map((item) => ({
      ...item,
      totalPrice: item.quantity * item.unitPrice,
    }));
    onChange([...items, ...displayItems]);
  };

  const handleEditItem = (item: SOItemInput) => {
    if (selectedIndex === null) return;
    const updated = [...items];
    updated[selectedIndex] = {
      ...updated[selectedIndex],
      ...item,
      totalPrice: item.quantity * item.unitPrice,
    };
    onChange(updated);
    setSelectedIndex(null);
  };

  const handleDeleteItem = () => {
    if (selectedIndex === null) return;
    const updated = items.filter((_, i) => i !== selectedIndex);
    onChange(updated);
    setSelectedIndex(null);
    setDeleteDialogOpen(false);
  };

  const openEditDialog = (index: number) => {
    setSelectedIndex(index);
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (index: number) => {
    setSelectedIndex(index);
    setDeleteDialogOpen(true);
  };

  const selectedItem = selectedIndex !== null ? items[selectedIndex] : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {items.length} item{items.length !== 1 ? 's' : ''} · {totals.totalQty} pcs ·{' '}
          {formatCurrency(totals.totalAmount)}
        </div>
        {editable && (
          <Button variant="outline" size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Item
          </Button>
        )}
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Style</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Size</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Total</TableHead>
              {editable && <TableHead className="w-24">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={editable ? 7 : 6} className="text-center py-8 text-muted-foreground">
                  No items added yet
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <TableRow key={item.id || `item-${index}`}>
                  <TableCell>
                    <div className="font-mono text-sm">{item.styleCode || item.styleId.slice(0, 8)}</div>
                    {item.styleName && <div className="text-xs text-muted-foreground">{item.styleName}</div>}
                  </TableCell>
                  <TableCell>{item.colorName || (item.colorId ? item.colorId.slice(0, 8) : 'Any')}</TableCell>
                  <TableCell>{item.sizeName || (item.sizeId ? item.sizeId.slice(0, 8) : 'Size TBD')}</TableCell>
                  <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.totalPrice ?? item.quantity * item.unitPrice)}
                  </TableCell>
                  {editable && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(index)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(index)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Item Dialog */}
      <SaleOrderItemDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSave={handleAddItem}
        onSaveMultiple={handleAddMultipleItems}
        mode="create"
      />

      {/* Edit Item Dialog */}
      <SaleOrderItemDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setSelectedIndex(null);
        }}
        onSave={handleEditItem}
        editItem={selectedItem}
        mode="edit"
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the item from the sale order. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDeleteItem}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default SaleOrderItemsTable;
