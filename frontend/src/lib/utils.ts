import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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

/**
 * Convert a camelCase string back to UPPER_SNAKE_CASE.
 * Used to reverse humps.camelizeKeys on enum keys in API responses.
 * e.g. "processing" → "PROCESSING", "embroideryService" → "EMBROIDERY_SERVICE"
 */
export function toUpperSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
}

/**
 * Normalize a Record with camelized enum keys back to UPPER_SNAKE_CASE keys.
 * The backend serializer camelizes ALL object keys, including enum values
 * used as Record keys (e.g. { PROCESSING: 1 } → { processing: 1 }).
 */
export function normalizeEnumRecord(record: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(record).map(([k, v]) => [toUpperSnakeCase(k), v])
  );
}
