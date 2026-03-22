import { FormField } from './FormField';

interface DateFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  min?: string;
  max?: string;
}

export function DateField({ label, value, onChange, error, required, disabled, className, min, max }: DateFieldProps) {
  return (
    <FormField
      label={label}
      type="text"
      placeholder="YYYY-MM-DD"
      value={value}
      onChange={onChange}
      error={error}
      required={required}
      disabled={disabled}
      className={className}
      min={min}
      max={max}
    />
  );
}
