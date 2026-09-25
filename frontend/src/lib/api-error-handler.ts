import { notify } from './notify';
import { AxiosError } from 'axios';
import { logError } from './logger';

/**
 * Validation error detail structure
 */
export interface ValidationErrorDetail {
  field: string;
  message: string;
}

/**
 * Standard API error response structure
 */
export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, string> | ValidationErrorDetail[];
  statusCode?: number;
}

/**
 * Turn a Zod issue path ("skuOutputs.0.colorId") into something an operator can read
 * ("Color (row 1)"). Array indices become 1-based row numbers, and the trailing "Id" of an FK
 * field is noise on screen — nobody types an id, they pick a colour.
 */
function humanizeFieldPath(path: string): string {
  const segments = path.split('.').filter(Boolean);
  const rows = segments.filter((s) => /^\d+$/.test(s)).map((s) => Number(s) + 1);
  const name = [...segments].reverse().find((s) => !/^\d+$/.test(s));
  if (!name) return path;
  const label =
    name
      .replace(/Id$/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/^./, (c) => c.toUpperCase()) || name;
  return rows.length ? `${label} (row ${rows[rows.length - 1]})` : label;
}

/**
 * Pull the per-field text out of a validation response.
 *
 * `validateBody` answers every rejection with the constant top-level message "Invalid request
 * data" and puts the part that actually tells you what to fix in `details`. Showing only the
 * constant is why rejected saves get reported as "it just doesn't work" — see the
 * /validation-rejections skill, which exists to recover this information from the logs after
 * the fact.
 */
function describeValidationDetails(details: ApiError['details']): string | null {
  if (!details || typeof details !== 'object') return null;

  const pairs = Array.isArray(details)
    ? details
        .filter((d) => d && typeof d.message === 'string' && d.message)
        .map((d) => ({ field: d.field, message: d.message }))
    : Object.entries(details)
        .filter(([, message]) => typeof message === 'string' && message)
        .map(([field, message]) => ({ field, message }));

  if (pairs.length === 0) return null;

  // Three is enough to act on; a wall of text in a toast gets dismissed unread.
  const shown = pairs.slice(0, 3).map((p) => (p.field ? `${humanizeFieldPath(p.field)}: ${p.message}` : p.message));
  const rest = pairs.length - shown.length;
  return shown.join(' · ') + (rest > 0 ? ` · +${rest} more` : '');
}

/**
 * Extract error message from various error formats
 */
export function getErrorMessage(error: unknown): string {
  // Axios error
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as AxiosError<ApiError>;

    // Field-level validation text beats the generic "Invalid request data" it ships alongside.
    const detailText = describeValidationDetails(axiosError.response?.data?.details);
    if (detailText) {
      return detailText;
    }

    // Use the message from the API response
    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message;
    }

    // Fallback to error type
    if (axiosError.response?.data?.error) {
      return axiosError.response.data.error;
    }

    // HTTP status-based messages
    if (axiosError.response?.status) {
      return getStatusMessage(axiosError.response.status);
    }

    // Network error
    if (axiosError.message) {
      return axiosError.message;
    }
  }

  // Standard Error object
  if (error instanceof Error) {
    return error.message;
  }

  // String error
  if (typeof error === 'string') {
    return error;
  }

  // Unknown error format
  return 'An unexpected error occurred';
}

/**
 * Get user-friendly message based on HTTP status code
 */
function getStatusMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Invalid request. Please check your input.';
    case 401:
      return 'You are not authenticated. Please log in.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'This resource already exists or conflicts with existing data.';
    case 422:
      return 'Validation failed. Please check your input.';
    case 429:
      return 'Too many requests. Please try again later.';
    case 500:
      return 'Server error. Please try again later.';
    case 503:
      return 'Service temporarily unavailable. Please try again later.';
    default:
      return `Request failed with status ${status}`;
  }
}

/**
 * Handle API errors and show appropriate toast notifications
 *
 * @param error - The error object
 * @param customMessage - Optional custom error message prefix
 * @param showToast - Whether to show a toast notification (default: true)
 * @returns The error message string
 */
export function handleApiError(error: unknown, customMessage?: string, showToast: boolean = true): string {
  // Skip handling for session expiry - already handled by API interceptor
  if (error instanceof Error && error.message === 'SESSION_EXPIRED') {
    return 'Session expired';
  }

  const errorMessage = getErrorMessage(error);
  const fullMessage = customMessage ? `${customMessage}: ${errorMessage}` : errorMessage;

  if (showToast) {
    // Check if it's a network error
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ERR_NETWORK') {
      notify.error('Network Error', {
        description: 'Unable to connect to the server. Please check your internet connection.',
      });
    } else {
      notify.error('Error', {
        description: fullMessage,
      });
    }
  }

  // Log error to console in development
  if (import.meta.env.DEV) {
    logError('API Error:', error);
  }

  return fullMessage;
}

/**
 * Handle successful API operations with toast
 *
 * @param message - Success message title
 * @param description - Optional description
 */
export function handleApiSuccess(message: string, description?: string) {
  notify.success(message, {
    description,
  });
}

/**
 * Extract validation errors from API response
 * Returns a record of field names to error messages
 */
export function getValidationErrors(error: unknown): Record<string, string> {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as AxiosError<ApiError>;

    if (axiosError.response?.data?.details) {
      const details = axiosError.response.data.details;

      // If details is an object with field errors
      if (typeof details === 'object' && !Array.isArray(details)) {
        return details as Record<string, string>;
      }

      // If details is an array of error objects
      if (Array.isArray(details)) {
        const errors: Record<string, string> = {};
        details.forEach((item: ValidationErrorDetail) => {
          if (item.field && item.message) {
            errors[item.field] = item.message;
          }
        });
        return errors;
      }
    }
  }

  return {};
}

/**
 * Check if error is a specific HTTP status code
 */
export function isErrorStatus(error: unknown, status: number): boolean {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as AxiosError;
    return axiosError.response?.status === status;
  }
  return false;
}

/**
 * Check if error is an authentication error (401)
 */
export function isAuthError(error: unknown): boolean {
  return isErrorStatus(error, 401);
}

/**
 * Check if error is a permission error (403)
 */
export function isPermissionError(error: unknown): boolean {
  return isErrorStatus(error, 403);
}

/**
 * Check if error is a not found error (404)
 */
export function isNotFoundError(error: unknown): boolean {
  return isErrorStatus(error, 404);
}

/**
 * Check if error is a validation error (422)
 */
export function isValidationError(error: unknown): boolean {
  return isErrorStatus(error, 422);
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    return error.code === 'ERR_NETWORK';
  }
  return false;
}

/**
 * True when a failed WRITE may still have been applied: the browser gave up waiting (timeout), no
 * response came back, or the gateway answered 502/503/504 — including the server's own
 * "Response timeout", which it sends while the handler is still running. Never tell the user such a
 * save "failed": on 2026-09-25 that message made them press Receive again, and a stalled server then
 * filed every press (six receipts for one delivery).
 */
export function isOutcomeUnknown(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? (error as { code?: string }).code : undefined;
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || code === 'ERR_NETWORK') return true;
  const axiosError = error as AxiosError;
  if (axiosError.request && !axiosError.response) return true;
  const status = axiosError.response?.status;
  return status === 502 || status === 503 || status === 504;
}
