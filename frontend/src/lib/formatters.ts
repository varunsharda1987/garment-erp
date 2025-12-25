// Formatting utility functions

/**
 * Format material type enum to display name
 */
export function formatMaterialType(type: string): string {
  const mapping: Record<string, string> = {
    'THREAD': 'Thread',
    'BUTTON': 'Button',
    'ZIPPER': 'Zipper',
    'ELASTIC': 'Elastic',
    'LACE': 'Lace',
    'LABEL': 'Label',
    'PACKAGING': 'Packaging',
    'MACHINE_PART': 'Machine Parts',
    'OTHER': 'Other Materials',
    'GREIGE_FABRIC': 'Greige Fabric',
    'FINISHED_FABRIC': 'Finished Fabric',
  };
  return mapping[type] || type;
}
