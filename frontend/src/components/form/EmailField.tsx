import { FormField } from './FormField';

interface EmailFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function EmailField({
  label = 'Email',
  value,
  onChange,
  error,
  required,
  disabled,
  className,
  placeholder = 'example@company.com',
}: EmailFieldProps) {
  return (
    <FormField
      label={label}
      type="email"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      error={error}
      required={required}
      disabled={disabled}
      className={className}
    />
  );
}
