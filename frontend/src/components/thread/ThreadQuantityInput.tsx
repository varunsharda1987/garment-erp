/**
 * Thread Quantity Input Component (shadcn/ui)
 *
 * Reusable component for entering thread quantities with:
 * - Radio toggle: Units vs Boxes
 * - Real-time conversion display (units ↔ boxes ↔ meters)
 * - API-driven accurate conversions
 */

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import type { ThreadPly, ThreadPackagingType, ThreadQuantityInput as ThreadQuantityInputType, ThreadQuantityConversion } from '../../types/thread.types';
import { convertThreadQuantity } from '../../services/threadRequirement.service';
import { useDebounce } from '@/hooks/useDebounce';

interface ThreadQuantityInputProps {
  ply: ThreadPly;
  packagingType: ThreadPackagingType;
  value: number;
  inputType: ThreadQuantityInputType;
  onChange: (value: number, inputType: ThreadQuantityInputType) => void;
  disabled?: boolean;
  label?: string;
  error?: string;
}

const ThreadQuantityInput: React.FC<ThreadQuantityInputProps> = ({
  ply,
  packagingType,
  value,
  inputType,
  onChange,
  disabled = false,
  label = 'Quantity',
  error,
}) => {
  const [conversion, setConversion] = useState<ThreadQuantityConversion | null>(null);
  const [loading, setLoading] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);

  // Debounce the value and inputType to avoid excessive API calls
  const debouncedValue = useDebounce(value, 300);
  const debouncedInputType = useDebounce(inputType, 300);

  // Fetch conversion when debounced inputs change
  useEffect(() => {
    const fetchConversion = async () => {
      if (!debouncedValue || debouncedValue <= 0 || !ply || !packagingType) {
        setConversion(null);
        return;
      }

      setLoading(true);
      setConversionError(null);

      try {
        const result = await convertThreadQuantity(ply, packagingType, debouncedInputType, debouncedValue);
        setConversion(result);
      } catch (err: any) {
        console.error('Conversion error:', err);
        setConversionError(err.message || 'Failed to convert quantity');
        setConversion(null);
      } finally {
        setLoading(false);
      }
    };

    fetchConversion();
  }, [debouncedValue, debouncedInputType, ply, packagingType]);

  const handleInputTypeChange = (newType: string) => {
    onChange(value, newType as ThreadQuantityInputType);
  };

  const handleValueChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(event.target.value) || 0;
    onChange(newValue, inputType);
  };

  // Format number with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>{label}</Label>

        {/* Input Type Toggle */}
        <RadioGroup
          value={inputType}
          onValueChange={handleInputTypeChange}
          disabled={disabled}
          className="flex gap-4 mt-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="UNITS" id={`units-${label}`} />
            <Label htmlFor={`units-${label}`} className="font-normal cursor-pointer">
              Units (Spools/Cones)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="BOXES" id={`boxes-${label}`} />
            <Label htmlFor={`boxes-${label}`} className="font-normal cursor-pointer">
              Boxes
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Quantity Input */}
      <div>
        <Label htmlFor={`quantity-${label}`} className="text-sm text-muted-foreground">
          {inputType === 'UNITS' ? 'Number of Units' : 'Number of Boxes'}
        </Label>
        <Input
          id={`quantity-${label}`}
          type="number"
          value={value || ''}
          onChange={handleValueChange}
          disabled={disabled}
          min={0}
          step={inputType === 'UNITS' ? 1 : 0.1}
          className={error ? 'border-red-500' : ''}
        />
        {error && (
          <p className="text-sm text-red-500 mt-1">{error}</p>
        )}
      </div>

      {/* Conversion Display */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Calculating conversion...</span>
        </div>
      )}

      {conversionError && (
        <p className="text-sm text-amber-600">
          ⚠️ {conversionError}
        </p>
      )}

      {conversion && !loading && !conversionError && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4 pb-3">
            <p className="text-sm font-medium text-primary mb-1">Conversion:</p>
            <p className="text-sm text-gray-700">
              <strong>{formatNumber(conversion.totalBoxes)}</strong> boxes ={' '}
              <strong>{formatNumber(conversion.totalUnits)}</strong> units ={' '}
              <strong>{formatNumber(conversion.totalMeters)}</strong> meters
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ThreadQuantityInput;
