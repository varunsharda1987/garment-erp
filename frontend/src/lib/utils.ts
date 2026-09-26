import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safe UUID generator that works in non-secure contexts (HTTP over LAN).
 * crypto.randomUUID() requires HTTPS or localhost — this provides a fallback.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Falls through to fallback
    }
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
