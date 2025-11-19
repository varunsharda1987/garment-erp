import { FormField } from './FormField';

interface PhoneFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function PhoneField({
  label = 'Phone Number',
  value,
  onChange,
  error,
  required,
  disabled,
  className,
  placeholder = '9876543210',
}: PhoneFieldProps) {
  const handleChange = (val: string) => {
    // Only allow digits and limit to 10 characters
    const cleaned = val.replace(/\D/g, '').slice(0, 10);
    onChange(cleaned);
  };

  return (
    <FormField
      label={label}
      type="tel"
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      error={error}
      required={required}
      disabled={disabled}
      className={className}
      maxLength={10}
      helperText="Enter 10 digit mobile number"
    />
  );
}
