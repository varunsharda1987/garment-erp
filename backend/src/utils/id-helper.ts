/**
 * ID Helper Utilities
 * Handles case-insensitive lookups for custom (non-UUID) IDs
 */

/**
 * Check if a string is a valid UUID format
 */
export function isUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Normalize a custom ID to lowercase for consistent lookups
 * Returns the original ID if it's a UUID (UUIDs are case-insensitive in most DBs)
 */
export function normalizeId(id: string): string {
  if (isUUID(id)) {
    return id;
  }
  return id.toLowerCase();
}

/**
 * Get an array of possible ID variants for case-insensitive lookup
 * Returns [original, lowercase] for non-UUIDs, [original] for UUIDs
 */
export function getIdVariants(id: string): string[] {
  if (isUUID(id)) {
    return [id];
  }
  const lower = id.toLowerCase();
  if (lower === id) {
    return [id];
  }
  return [id, lower];
}
