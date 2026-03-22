/**
 * Unified Notification Service
 *
 * This module provides a centralized notification system using Sonner.
 * Use this instead of directly importing toast from 'sonner' or 'react-hot-toast'.
 *
 * @example
 * import { notify } from '@/lib/notify';
 *
 * notify.success("Record saved successfully");
 * notify.error("Failed to save record");
 * notify.warning("Unsaved changes will be lost");
 * notify.info("Processing your request...");
 * notify.loading("Saving...");
 * notify.promise(saveData(), {
 *   loading: "Saving...",
 *   success: "Saved!",
 *   error: "Failed to save"
 * });
 */

import { toast } from 'sonner';
import type { ExternalToast } from 'sonner';

type ToastOptions = ExternalToast;

interface PromiseOptions<T> {
  loading: string;
  success: string | ((data: T) => string);
  error: string | ((error: unknown) => string);
}

/**
 * Unified notification service
 */
export const notify = {
  /**
   * Show a success notification
   */
  success: (message: string, options?: ToastOptions) => {
    return toast.success(message, options);
  },

  /**
   * Show an error notification
   */
  error: (message: string, options?: ToastOptions) => {
    return toast.error(message, options);
  },

  /**
   * Show a warning notification
   */
  warning: (message: string, options?: ToastOptions) => {
    return toast.warning(message, options);
  },

  /**
   * Show an info notification
   */
  info: (message: string, options?: ToastOptions) => {
    return toast.info(message, options);
  },

  /**
   * Show a loading notification
   * Returns a toast ID that can be used to update/dismiss the toast
   */
  loading: (message: string, options?: ToastOptions) => {
    return toast.loading(message, options);
  },

  /**
   * Show a promise-based notification
   * Automatically shows loading, success, and error states
   */
  promise: <T>(promise: Promise<T>, options: PromiseOptions<T>) => {
    return toast.promise(promise, options);
  },

  /**
   * Dismiss a specific toast by ID, or all toasts if no ID provided
   */
  dismiss: (toastId?: string | number) => {
    toast.dismiss(toastId);
  },

  /**
   * Show a custom message (no icon)
   */
  message: (message: string, options?: ToastOptions) => {
    return toast(message, options);
  },

  /**
   * Update an existing toast
   */
  update: (toastId: string | number, message: string, options?: ToastOptions) => {
    toast.dismiss(toastId);
    return toast(message, { ...options, id: toastId });
  },
};

// Also export toast directly for advanced usage
export { toast };

// Default export for convenience
export default notify;
