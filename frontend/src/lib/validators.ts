import { z } from 'zod';

/**
 * Common Zod validators for reuse across forms
 *
 * Usage:
 * import { validators } from '@/lib/validators';
 *
 * const schema = z.object({
 *   email: validators.email,
 *   phone: validators.phone,
 * });
 */

export const validators = {
  // Required fields
  required: (fieldName: string) => z.string().min(1, `${fieldName} is required`),

  // Email validation
  email: z.string().email('Please enter a valid email address').optional().or(z.literal('')),

  emailRequired: z.string().min(1, 'Email is required').email('Please enter a valid email address'),

  // Phone validation (10 digits)
  phone: z
    .string()
    .max(10, 'Phone number must be maximum 10 digits')
    .regex(/^\d*$/, 'Phone number must contain only digits')
    .optional()
    .or(z.literal('')),

  phoneRequired: z
    .string()
    .min(1, 'Phone number is required')
    .max(10, 'Phone number must be maximum 10 digits')
    .regex(/^\d+$/, 'Phone number must contain only digits'),

  // GST Number validation (15 characters)
  gst: z
    .string()
    .length(15, 'GST number must be exactly 15 characters')
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST number format')
    .optional()
    .or(z.literal('')),

  gstRequired: z
    .string()
    .min(1, 'GST number is required')
    .length(15, 'GST number must be exactly 15 characters')
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GST number format'),

  // PAN validation (10 characters)
  pan: z
    .string()
    .length(10, 'PAN must be exactly 10 characters')
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format')
    .optional()
    .or(z.literal('')),

  panRequired: z
    .string()
    .min(1, 'PAN is required')
    .length(10, 'PAN must be exactly 10 characters')
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'),

  // Date validation
  date: z.string().min(1, 'Date is required'),

  dateOptional: z.string().optional().or(z.literal('')),

  // Number validations
  positiveNumber: z.number().positive('Must be a positive number'),

  positiveInteger: z.number().int('Must be an integer').positive('Must be a positive number'),

  nonNegativeNumber: z.number().min(0, 'Cannot be negative'),

  percentage: z.number().min(0, 'Percentage cannot be less than 0').max(100, 'Percentage cannot be greater than 100'),

  // String validations
  code: z
    .string()
    .min(1, 'Code is required')
    .regex(/^[A-Z0-9-_]+$/, 'Code must contain only uppercase letters, numbers, hyphens, and underscores'),

  codeOptional: z
    .string()
    .regex(/^[A-Z0-9-_]*$/, 'Code must contain only uppercase letters, numbers, hyphens, and underscores')
    .optional()
    .or(z.literal('')),

  // URL validation
  url: z.string().url('Please enter a valid URL').optional().or(z.literal('')),

  urlRequired: z.string().min(1, 'URL is required').url('Please enter a valid URL'),

  // Pincode validation (6 digits)
  pincode: z
    .string()
    .length(6, 'Pincode must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Pincode must contain only digits')
    .optional()
    .or(z.literal('')),

  pincodeRequired: z
    .string()
    .min(1, 'Pincode is required')
    .length(6, 'Pincode must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Pincode must contain only digits'),

  // IFSC Code validation (11 characters)
  ifsc: z
    .string()
    .length(11, 'IFSC code must be exactly 11 characters')
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format')
    .optional()
    .or(z.literal('')),

  ifscRequired: z
    .string()
    .min(1, 'IFSC code is required')
    .length(11, 'IFSC code must be exactly 11 characters')
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format'),

  // Bank Account Number validation
  bankAccount: z
    .string()
    .min(9, 'Account number must be at least 9 digits')
    .max(18, 'Account number must be at most 18 digits')
    .regex(/^\d+$/, 'Account number must contain only digits')
    .optional()
    .or(z.literal('')),

  bankAccountRequired: z
    .string()
    .min(1, 'Account number is required')
    .min(9, 'Account number must be at least 9 digits')
    .max(18, 'Account number must be at most 18 digits')
    .regex(/^\d+$/, 'Account number must contain only digits'),
};

/**
 * Helper to create custom error messages for required fields
 */
export const createRequiredValidator = (fieldName: string) => {
  return z.string().min(1, `${fieldName} is required`);
};

/**
 * Helper to create number range validators
 */
export const createNumberRangeValidator = (min?: number, max?: number, fieldName = 'Value') => {
  let validator = z.number();

  if (min !== undefined) {
    validator = validator.min(min, `${fieldName} must be at least ${min}`);
  }

  if (max !== undefined) {
    validator = validator.max(max, `${fieldName} must be at most ${max}`);
  }

  return validator;
};

/**
 * Helper to create string length validators
 */
export const createLengthValidator = (min?: number, max?: number, fieldName = 'Field') => {
  let validator = z.string();

  if (min !== undefined) {
    validator = validator.min(min, `${fieldName} must be at least ${min} characters`);
  }

  if (max !== undefined) {
    validator = validator.max(max, `${fieldName} must be at most ${max} characters`);
  }

  return validator;
};
