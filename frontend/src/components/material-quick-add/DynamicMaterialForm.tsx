/**
 * DynamicMaterialForm Component (Step 2)
 * Renders type-specific form fields dynamically based on material configuration
 */

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import type { MaterialTypeConfig, MaterialFormData, MaterialFieldConfig } from '../../types/material-quick-add.types';

interface DynamicMaterialFormProps {
  config: MaterialTypeConfig;
  formData: MaterialFormData;
  onChange: (data: MaterialFormData) => void;
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
}

export const DynamicMaterialForm: React.FC<DynamicMaterialFormProps> = ({
  config,
  formData,
  onChange,
  onBack,
  onSave,
  saving,
}) => {
  const handleFieldChange = (fieldName: string, value: string | number | boolean) => {
    onChange({
      ...formData,
      [fieldName]: value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent bubbling to parent form
    onSave();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h3 className="text-lg font-semibold">Add New {config.label}</h3>
      </div>

      {/* Name Field (Optional - Auto-generated if empty) */}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          type="text"
          value={formData.name || ''}
          onChange={(e) => {
            const newName = e.target.value;
            onChange({
              ...formData,
              name: newName,
              _nameManuallyEdited: newName.trim() !== '', // Track manual edit
            });
          }}
          placeholder="Leave empty to auto-generate from attributes"
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          If left empty, name will be auto-generated from selected attributes (e.g., "Black Polyester 4-Hole Button
          15mm")
        </p>
      </div>

      {/* Type-Specific Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {config.fields.map((field) => {
          // Skip color field here, we'll render it separately
          if (field.name === 'color') return null;

          // Check conditional visibility
          if (field.showWhen) {
            const { field: condField, value: condValue, inverse } = field.showWhen;
            const currentValue = formData[condField];

            // For boolean conditions
            if (typeof condValue === 'boolean') {
              const matches = Boolean(currentValue) === condValue;
              if (inverse ? matches : !matches) return null;
            } else {
              // For string conditions
              const matches = currentValue === condValue;
              if (inverse ? matches : !matches) return null;
            }
          }

          return (
            <FormField
              key={field.name}
              field={field}
              value={formData[field.name]}
              onChange={(value) => handleFieldChange(field.name, value)}
            />
          );
        })}
      </div>

      {/* Color Field (Always Last, Full Width) - with conditional visibility support */}
      {(() => {
        const colorField = config.fields.find((f) => f.name === 'color');
        if (!colorField) return null;

        // Check conditional visibility for color field
        if (colorField.showWhen) {
          const { field: condField, value: condValue, inverse } = colorField.showWhen;
          const currentValue = formData[condField];

          if (typeof condValue === 'boolean') {
            const matches = Boolean(currentValue) === condValue;
            if (inverse ? matches : !matches) return null;
          } else {
            const matches = currentValue === condValue;
            if (inverse ? matches : !matches) return null;
          }
        }

        return (
          <div className="space-y-2">
            <Label htmlFor="color">Color</Label>
            <Input
              id="color"
              type="text"
              value={formData.color || ''}
              onChange={(e) => handleFieldChange('color', e.target.value)}
              placeholder="e.g., Black, Navy Blue, Red"
            />
            {colorField.helpText && <p className="text-xs text-muted-foreground">{colorField.helpText}</p>}
          </div>
        );
      })()}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onBack}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Creating...' : 'Create & Add'}
        </Button>
      </div>
    </form>
  );
};

/**
 * FormField Component
 * Renders individual form field based on type
 */
interface FormFieldProps {
  field: MaterialFieldConfig;
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean) => void;
}

const FormField: React.FC<FormFieldProps> = ({ field, value, onChange }) => {
  const renderInput = () => {
    switch (field.type) {
      case 'text':
        return (
          <Input
            id={field.name}
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
          />
        );

      case 'number':
        return (
          <Input
            id={field.name}
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
            placeholder={field.placeholder}
            required={field.required}
          />
        );

      case 'select':
        return (
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger id={field.name}>
              <SelectValue placeholder={field.placeholder || `Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'boolean':
        return (
          <div className="flex items-center space-x-2 h-10">
            <Checkbox
              id={field.name}
              checked={Boolean(value)}
              onCheckedChange={(checked) => onChange(checked === true)}
            />
            <Label htmlFor={field.name} className="text-sm font-normal cursor-pointer">
              {field.label}
            </Label>
          </div>
        );

      default:
        return null;
    }
  };

  // For boolean fields, the label is rendered inline with the checkbox
  if (field.type === 'boolean') {
    return (
      <div className="col-span-full space-y-1">
        {renderInput()}
        {field.helpText && <p className="text-xs text-muted-foreground ml-6">{field.helpText}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {renderInput()}
      {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
    </div>
  );
};
