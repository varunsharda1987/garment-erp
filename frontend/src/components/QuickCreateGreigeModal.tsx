import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { greigeService } from '../services/fabricGreigeService';
import { notify } from '../lib/notify';
import { logError } from '../lib/logger';
import type { GreigeMaster } from '../types/fabric-greige.types';
import { GenericGreigeSelector } from './GenericGreigeSelector';

interface QuickCreateGreigeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGreigeCreated: (greige: GreigeMaster) => void;
  initialGenericGreigeName?: string;
}

export function QuickCreateGreigeModal({
  isOpen,
  onClose,
  onGreigeCreated,
  initialGenericGreigeName = '',
}: QuickCreateGreigeModalProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    genericGreigeName: initialGenericGreigeName,
    greigeWidth: 48,
    defaultCutableWidth: 44,
    composition: '100% Cotton',
    averageShrinkagePercent: 8,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
  };

  // Auto-calculate defaultCutableWidth when greigeWidth changes
  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const greigeWidth = parseFloat(e.target.value) || 0;
    setFormData((prev) => ({
      ...prev,
      greigeWidth,
      defaultCutableWidth: greigeWidth > 4 ? greigeWidth - 4 : greigeWidth,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.genericGreigeName) {
      notify.error('Please enter a Generic Greige Name');
      return;
    }

    if (!formData.greigeWidth || formData.greigeWidth <= 0) {
      notify.error('Please enter a valid Greige Width');
      return;
    }

    try {
      setSaving(true);

      // Auto-generate greigeCode and greigeName
      const greigeName = `${formData.genericGreigeName} ${formData.greigeWidth}"`;

      const newGreige = await greigeService.create({
        greigeCode: '', // Backend will auto-generate
        greigeName,
        genericGreigeName: formData.genericGreigeName,
        greigeWidth: formData.greigeWidth,
        defaultCutableWidth: formData.defaultCutableWidth,
        composition: formData.composition,
        averageShrinkagePercent: formData.averageShrinkagePercent,
        isActive: true,
        suppliers: [],
      });

      notify.success(`Greige "${newGreige.greigeName}" created successfully`);
      onGreigeCreated(newGreige);
      onClose();

      // Reset form
      setFormData({
        genericGreigeName: '',
        greigeWidth: 48,
        defaultCutableWidth: 44,
        composition: '100% Cotton',
        averageShrinkagePercent: 8,
      });
    } catch (error) {
      logError('Error creating greige:', error);
      notify.error('Failed to create greige');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-success" />
            Quick Create Greige
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Generic Greige Name */}
          <div>
            <Label htmlFor="genericGreigeName">
              Generic Greige Name <span className="text-destructive">*</span>
            </Label>
            <GenericGreigeSelector
              value={formData.genericGreigeName}
              onChange={(value) => setFormData((prev) => ({ ...prev, genericGreigeName: value }))}
              placeholder="e.g., Cambric, Poplin, Net..."
              required
            />
          </div>

          {/* Width Fields - Side by Side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="greigeWidth">
                Greige Width (inches) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="greigeWidth"
                name="greigeWidth"
                type="number"
                value={formData.greigeWidth}
                onChange={handleWidthChange}
                placeholder="48"
                step="0.5"
                min="1"
                required
              />
            </div>
            <div>
              <Label htmlFor="defaultCutableWidth">Cutable Width (inches)</Label>
              <Input
                id="defaultCutableWidth"
                name="defaultCutableWidth"
                type="number"
                value={formData.defaultCutableWidth}
                onChange={handleChange}
                placeholder="44"
                step="0.5"
                min="1"
              />
              <span className="text-xs text-muted-foreground">Default: Width - 4"</span>
            </div>
          </div>

          {/* Composition */}
          <div>
            <Label htmlFor="composition">Composition</Label>
            <Input
              id="composition"
              name="composition"
              type="text"
              value={formData.composition}
              onChange={handleChange}
              placeholder="100% Cotton"
            />
          </div>

          {/* Shrinkage */}
          <div>
            <Label htmlFor="averageShrinkagePercent">Average Shrinkage %</Label>
            <Input
              id="averageShrinkagePercent"
              name="averageShrinkagePercent"
              type="number"
              value={formData.averageShrinkagePercent}
              onChange={handleChange}
              placeholder="8"
              step="0.5"
              min="0"
              max="30"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Creating...' : 'Create Greige'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
