import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';

interface DebouncedInputProps {
  value: string;
  onChange: (value: string) => void;
  delay?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** If true, also fires onChange immediately on blur (before debounce completes) */
  flushOnBlur?: boolean;
}

/**
 * DebouncedInput - Input that delays onChange calls to prevent lag
 * Uses local state for immediate visual feedback, then debounces the actual onChange
 */
export function DebouncedInput({
  value,
  onChange,
  delay = 300,
  placeholder,
  className,
  disabled,
  flushOnBlur = true, // Default to true to prevent data loss
}: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const onChangeRef = useRef(onChange);
  const initialMountRef = useRef(true);

  // Keep the onChange ref updated
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Sync local value when external value changes (from parent)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounce the onChange callback
  useEffect(() => {
    // Skip on initial mount
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }

    // Don't trigger if values are the same
    if (localValue === value) return;

    const timer = setTimeout(() => {
      onChangeRef.current(localValue);
    }, delay);

    return () => clearTimeout(timer);
  }, [localValue, delay, value]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  }, []);

  // Immediately flush value on blur to prevent data loss when clicking Save
  const handleBlur = useCallback(() => {
    if (flushOnBlur && localValue !== value) {
      onChangeRef.current(localValue);
    }
  }, [flushOnBlur, localValue, value]);

  return (
    <Input
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
    />
  );
}

export default DebouncedInput;
