/**
 * Toast hook wrapper for Sonner compatibility
 * This provides a shadcn/ui-like toast API using Sonner under the hood
 */

import { toast as sonnerToast } from 'sonner';

interface ToastProps {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
}

interface ToastReturn {
  toast: (props: ToastProps) => void;
  dismiss: (toastId?: string | number) => void;
}

export function useToast(): ToastReturn {
  const toast = (props: ToastProps) => {
    const message = props.title || props.description || '';
    const description = props.title ? props.description : undefined;

    if (props.variant === 'destructive') {
      sonnerToast.error(message, { description, duration: props.duration });
    } else {
      sonnerToast.success(message, { description, duration: props.duration });
    }
  };

  const dismiss = (toastId?: string | number) => {
    sonnerToast.dismiss(toastId);
  };

  return { toast, dismiss };
}

export type { ToastProps };
