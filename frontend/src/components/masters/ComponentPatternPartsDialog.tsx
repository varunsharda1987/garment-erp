// Manage which pattern parts are linked to a component master.
// These links drive the "Part" dropdown options in CAD Planning.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { notify } from '../../lib/notify';
import { Plus, Trash2 } from 'lucide-react';
import { getAllPatternParts } from '../../services/patternPart.service';
import {
  addComponentPatternPart,
  getComponentPatternParts,
  removeComponentPatternPart,
  updateComponentPatternPart,
} from '../../services/componentPatternPart.service';
import type { ComponentPatternPart, PatternPart } from '../../types/patternPart.types';

interface ComponentPatternPartsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  componentId: string | null;
  componentName: string;
}

export default function ComponentPatternPartsDialog({
  open,
  onOpenChange,
  componentId,
  componentName,
}: ComponentPatternPartsDialogProps) {
  const [linkedParts, setLinkedParts] = useState<ComponentPatternPart[]>([]);
  const [allParts, setAllParts] = useState<PatternPart[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [partToAdd, setPartToAdd] = useState<string>('');

  const loadLinkedParts = useCallback(async () => {
    if (!componentId) return;
    try {
      setLinkedParts(await getComponentPatternParts(componentId));
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      notify.error(err.response?.data?.message || 'Failed to load linked pattern parts');
    }
  }, [componentId]);

  useEffect(() => {
    if (!open || !componentId) return;
    setLoading(true);
    setPartToAdd('');
    Promise.all([
      loadLinkedParts(),
      getAllPatternParts({ isActive: true, limit: 200 })
        .then((res) => setAllParts(res.data))
        .catch(() => notify.error('Failed to load pattern part master list')),
    ]).finally(() => setLoading(false));
  }, [open, componentId, loadLinkedParts]);

  // Parts not yet linked to this component
  const availableParts = useMemo(() => {
    const linkedIds = new Set(linkedParts.map((lp) => lp.patternPartId));
    return allParts.filter((p) => !linkedIds.has(p.id));
  }, [allParts, linkedParts]);

  const handleAdd = async () => {
    if (!componentId || !partToAdd) return;
    try {
      setSaving(true);
      await addComponentPatternPart(componentId, { patternPartId: partToAdd });
      notify.success('Pattern part added');
      setPartToAdd('');
      await loadLinkedParts();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      notify.error(err.response?.data?.message || 'Failed to add pattern part');
    } finally {
      setSaving(false);
    }
  };

  // Commit quantity on blur (typing per-keystroke would spam the API)
  const handleQuantityBlur = async (cpp: ComponentPatternPart, value: string) => {
    if (!componentId) return;
    const quantity = parseInt(value, 10);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity === cpp.quantity) return;
    try {
      await updateComponentPatternPart(componentId, cpp.patternPartId, { quantity });
      notify.success(`${cpp.patternPart.name}: quantity updated`);
      await loadLinkedParts();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      notify.error(err.response?.data?.message || 'Failed to update quantity');
      await loadLinkedParts();
    }
  };

  const handleRequiredChange = async (cpp: ComponentPatternPart, isRequired: boolean) => {
    if (!componentId) return;
    try {
      await updateComponentPatternPart(componentId, cpp.patternPartId, { isRequired });
      await loadLinkedParts();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      notify.error(err.response?.data?.message || 'Failed to update');
      await loadLinkedParts();
    }
  };

  const handleRemove = async (cpp: ComponentPatternPart) => {
    if (!componentId) return;
    try {
      await removeComponentPatternPart(componentId, cpp.patternPartId);
      notify.success(`${cpp.patternPart.name} removed`);
      await loadLinkedParts();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      notify.error(err.response?.data?.message || 'Failed to remove pattern part');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pattern Parts — {componentName}</DialogTitle>
          <DialogDescription>
            These parts appear in the CAD Planning "Part" dropdown for every style using this component.
          </DialogDescription>
        </DialogHeader>

        {/* Add part */}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Select value={partToAdd} onValueChange={setPartToAdd}>
              <SelectTrigger>
                <SelectValue
                  placeholder={availableParts.length === 0 ? 'All parts already linked' : 'Select a part to add...'}
                />
              </SelectTrigger>
              <SelectContent>
                {availableParts.map((part) => (
                  <SelectItem key={part.id} value={part.id}>
                    {part.name} ({part.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAdd} disabled={!partToAdd || saving}>
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>

        {/* Linked parts table */}
        <div className="border rounded-lg overflow-y-auto flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part</TableHead>
                <TableHead className="w-24">Qty</TableHead>
                <TableHead className="w-24">Required</TableHead>
                <TableHead className="w-16 text-right">Remove</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : linkedParts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No pattern parts linked — the CAD Part dropdown will be empty for this component
                  </TableCell>
                </TableRow>
              ) : (
                linkedParts.map((cpp) => (
                  <TableRow key={cpp.id}>
                    <TableCell>
                      <span className="font-medium">{cpp.patternPart.name}</span>{' '}
                      <Badge variant="outline" className="ml-1">
                        {cpp.patternPart.code}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        className="h-8 w-16"
                        key={`${cpp.id}-${cpp.quantity}`}
                        defaultValue={cpp.quantity}
                        onBlur={(e) => handleQuantityBlur(cpp, e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={cpp.isRequired}
                        onCheckedChange={(checked) => handleRequiredChange(cpp, checked)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleRemove(cpp)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          {linkedParts.length} part(s) linked. Changes apply to CAD Planning dropdowns after page reload.
        </p>
      </DialogContent>
    </Dialog>
  );
}
