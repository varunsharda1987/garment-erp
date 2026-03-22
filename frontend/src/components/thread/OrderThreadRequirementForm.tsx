/**
 * Order Thread Requirement Form Component (shadcn/ui)
 *
 * Multi-line thread requirement entry form for orders
 * Features:
 * - Dynamic row addition/removal
 * - Thread selector with dropdown
 * - Package type dropdown per row
 * - ThreadQuantityInput component per row
 * - Order summary (total lines, meters, cost)
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, Save, X, Loader2 } from 'lucide-react';
import type {
  ThreadPly,
  ThreadMaterial,
  ThreadPackagingType,
  ThreadQuantityInput as ThreadQuantityInputType,
} from '../../types/thread.types';
import ThreadQuantityInput from './ThreadQuantityInput';
import {
  createThreadRequirement,
  getThreadRequirements,
  updateThreadRequirement,
  deleteThreadRequirement,
} from '../../services/threadRequirement.service';
import { getAllThreads } from '../../services/thread.service';
import { toast } from 'sonner';

// Label constants
const THREAD_PLY_LABELS: Record<ThreadPly, string> = {
  TWO_PLY: '2-Ply',
  THREE_PLY: '3-Ply',
};

const THREAD_MATERIAL_LABELS: Record<ThreadMaterial, string> = {
  POLYESTER: 'Polyester',
  COTTON: 'Cotton',
};

const THREAD_PACKAGING_LABELS: Record<ThreadPackagingType, string> = {
  CONE: 'Cone',
  TUBE: 'Tube',
  SPOOL: 'Spool',
  CONE_5K: 'Cone (5,000 mtr)',
  CONE_10K: 'Cone (10,000 mtr)',
};

interface ThreadRequirementRow {
  id?: string; // For edits
  threadId: string;
  threadName?: string;
  ply?: ThreadPly;
  materialComposition?: ThreadMaterial;
  colorName?: string;
  packagingType: ThreadPackagingType;
  inputType: ThreadQuantityInputType;
  value: number;
  unitPrice?: number;
  // Computed from ThreadQuantityInput
  totalUnits: number;
  totalBoxes: number;
  totalMeters: number;
  totalCost?: number;
}

interface OrderThreadRequirementFormProps {
  orderId: string;
  onSave?: () => void;
  onCancel?: () => void;
  readOnly?: boolean;
}

const OrderThreadRequirementForm: React.FC<OrderThreadRequirementFormProps> = ({
  orderId,
  onSave,
  onCancel,
  readOnly = false,
}) => {
  const [rows, setRows] = useState<ThreadRequirementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadOptions, setThreadOptions] = useState<
    Array<{
      id: string;
      threadCode: string;
      threadName: string;
      ply: ThreadPly;
      materialComposition: ThreadMaterial;
      colorName: string;
    }>
  >([]);

  // Load thread options from API
  useEffect(() => {
    loadThreadOptions();
  }, []);

  // Load existing requirements
  useEffect(() => {
    loadRequirements();
  }, [orderId]);

  const loadThreadOptions = async () => {
    try {
      const response = await getAllThreads({ limit: 100 }); // Reduced from 1000 for performance

      // Map threads to thread options (filter for threads with new module fields)
      const options = response.data
        .filter((thread) => thread.isActive && thread.ply && thread.materialComposition)
        .map((thread) => ({
          id: thread.id,
          threadCode: thread.threadCode,
          threadName: thread.threadName,
          ply: thread.ply!,
          materialComposition: thread.materialComposition!,
          colorName: thread.color || 'N/A',
        }));

      setThreadOptions(options);
    } catch (err: any) {
      console.error('Failed to load thread options:', err);
      // Don't show error to user - form can still work with empty options
    }
  };

  const loadRequirements = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await getThreadRequirements(orderId);

      // Map to row format
      const loadedRows: ThreadRequirementRow[] = result.requirements.map((req) => ({
        id: req.id,
        threadId: req.threadId,
        threadName: req.threadName,
        ply: req.ply,
        materialComposition: req.materialComposition,
        colorName: req.colorName,
        packagingType: req.packagingType,
        inputType: req.inputType,
        value: req.inputType === 'UNITS' ? req.unitsOrdered || 0 : req.boxesOrdered || 0,
        unitPrice: req.unitPrice ? parseFloat(req.unitPrice.toString()) : undefined,
        totalUnits: parseFloat(req.totalUnits.toString()),
        totalBoxes: parseFloat(req.totalBoxes.toString()),
        totalMeters: parseFloat(req.totalMeters.toString()),
        totalCost: req.totalCost ? parseFloat(req.totalCost.toString()) : undefined,
      }));

      setRows(loadedRows);
    } catch (err: any) {
      console.error('Failed to load requirements:', err);
      setError(err.message || 'Failed to load thread requirements');
    } finally {
      setLoading(false);
    }
  };

  const addRow = () => {
    const newRow: ThreadRequirementRow = {
      threadId: '',
      packagingType: 'SPOOL',
      inputType: 'UNITS',
      value: 0,
      totalUnits: 0,
      totalBoxes: 0,
      totalMeters: 0,
    };
    setRows([...rows, newRow]);
  };

  const removeRow = async (index: number) => {
    const row = rows[index];

    // If row has ID, delete from backend
    if (row.id) {
      try {
        await deleteThreadRequirement(orderId, row.id);
        toast.success('Thread requirement deleted');
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete requirement');
        return;
      }
    }

    setRows(rows.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, updates: Partial<ThreadRequirementRow>) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], ...updates };
    setRows(newRows);
  };

  const handleThreadSelect = (index: number, threadId: string) => {
    if (!threadId) {
      updateRow(index, { threadId: '' });
      return;
    }

    const thread = threadOptions.find((t) => t.id === threadId);
    if (thread) {
      updateRow(index, {
        threadId: thread.id,
        threadName: thread.threadName,
        ply: thread.ply,
        materialComposition: thread.materialComposition,
        colorName: thread.colorName,
      });
    }
  };

  const handleQuantityChange = (index: number, value: number, inputType: ThreadQuantityInputType) => {
    updateRow(index, { value, inputType });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      for (const row of rows) {
        if (!row.threadId) {
          throw new Error('Please select a thread for all rows');
        }

        const data = {
          threadId: row.threadId,
          packagingType: row.packagingType,
          inputType: row.inputType,
          unitsOrdered: row.inputType === 'UNITS' ? row.value : undefined,
          boxesOrdered: row.inputType === 'BOXES' ? row.value : undefined,
          unitPrice: row.unitPrice,
        };

        if (row.id) {
          // Update existing
          await updateThreadRequirement(orderId, row.id, data);
        } else {
          // Create new
          await createThreadRequirement(orderId, data);
        }
      }

      toast.success('Thread requirements saved successfully');
      if (onSave) {
        onSave();
      }
      loadRequirements(); // Reload to get updated data
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Failed to save thread requirements');
      toast.error(err.message || 'Failed to save thread requirements');
    } finally {
      setSaving(false);
    }
  };

  const calculateSummary = () => {
    const totalLineItems = rows.length;
    const totalMeters = rows.reduce((sum, row) => sum + row.totalMeters, 0);
    const totalCost = rows.reduce((sum, row) => sum + (row.totalCost || 0), 0);

    return { totalLineItems, totalMeters, totalCost };
  };

  const summary = calculateSummary();

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span className="text-muted-foreground">Loading thread requirements...</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Thread Requirements for Order: {orderId}</CardTitle>
          {!readOnly && (
            <Button onClick={addRow} disabled={saving} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Thread Line
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead className="min-w-[250px]">Thread</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Ply</TableHead>
                <TableHead>Material</TableHead>
                <TableHead className="min-w-[180px]">Packaging</TableHead>
                <TableHead className="min-w-[300px]">Quantity</TableHead>
                <TableHead className="min-w-[120px]">Unit Price</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                {!readOnly && <TableHead className="w-20">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{index + 1}</TableCell>

                  {/* Thread Selector */}
                  <TableCell>
                    <Select
                      value={row.threadId}
                      onValueChange={(value) => handleThreadSelect(index, value)}
                      disabled={readOnly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select thread" />
                      </SelectTrigger>
                      <SelectContent>
                        {threadOptions.map((thread) => (
                          <SelectItem key={thread.id} value={thread.id}>
                            {thread.threadCode} - {thread.threadName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell>{row.colorName || '-'}</TableCell>
                  <TableCell>{row.ply ? THREAD_PLY_LABELS[row.ply] : '-'}</TableCell>
                  <TableCell>
                    {row.materialComposition ? THREAD_MATERIAL_LABELS[row.materialComposition] : '-'}
                  </TableCell>

                  {/* Packaging Type */}
                  <TableCell>
                    <Select
                      value={row.packagingType}
                      onValueChange={(value) => updateRow(index, { packagingType: value as ThreadPackagingType })}
                      disabled={readOnly}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(THREAD_PACKAGING_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* Quantity Input */}
                  <TableCell>
                    {row.ply && (
                      <ThreadQuantityInput
                        ply={row.ply}
                        packagingType={row.packagingType}
                        value={row.value}
                        inputType={row.inputType}
                        onChange={(val, type) => handleQuantityChange(index, val, type)}
                        disabled={readOnly}
                      />
                    )}
                  </TableCell>

                  {/* Unit Price */}
                  <TableCell>
                    <Input
                      type="number"
                      value={row.unitPrice || ''}
                      onChange={(e) => updateRow(index, { unitPrice: parseFloat(e.target.value) || undefined })}
                      placeholder="₹ 0.00"
                      disabled={readOnly}
                      step={0.01}
                      min={0}
                    />
                  </TableCell>

                  {/* Total Cost */}
                  <TableCell className="text-right">{row.totalCost ? `₹ ${row.totalCost.toFixed(2)}` : '-'}</TableCell>

                  {/* Actions */}
                  {!readOnly && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRow(index)}
                        disabled={saving}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}

              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={readOnly ? 9 : 10} className="h-24 text-center">
                    <p className="text-muted-foreground">
                      No thread requirements added yet. Click "Add Thread Line" to get started.
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
        {rows.length > 0 && (
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex justify-end gap-8">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Line Items</p>
                <p className="text-xl font-semibold">{summary.totalLineItems}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Meters</p>
                <p className="text-xl font-semibold">
                  {summary.totalMeters.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Total Cost</p>
                <p className="text-xl font-semibold">
                  ₹ {summary.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!readOnly && (
          <div className="flex justify-end gap-2 pt-2">
            {onCancel && (
              <Button variant="outline" onClick={onCancel} disabled={saving}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving || rows.length === 0}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Save Requirements
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OrderThreadRequirementForm;
