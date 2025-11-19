import { FormField } from './FormField';

interface GSTFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function GSTField({
  label = 'GST Number',
  value,
  onChange,
  error,
  required,
  disabled,
  className,
  placeholder = '22AAAAA0000A1Z5',
}: GSTFieldProps) {
  const handleChange = (val: string) => {
    // Convert to uppercase and limit to 15 characters
    const cleaned = val.toUpperCase().slice(0, 15);
    onChange(cleaned);
  };

  return (
    <FormField
      label={label}
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      error={error}
      required={required}
      disabled={disabled}
      className={className}
      maxLength={15}
      helperText="15 character GST number (e.g., 22AAAAA0000A1Z5)"
    />
  );
}
