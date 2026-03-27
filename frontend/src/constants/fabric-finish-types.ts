/**
 * Shared fabric finish type constants.
 * Used by both Style Form and Fabric Master Form.
 * Values match the Prisma FabricFinishType enum.
 */
export const FABRIC_FINISH_TYPES = [
  { value: 'DYED', label: 'Solid/Dyed' },
  { value: 'PRINTED', label: 'Printed' },
  { value: 'YARN_DYED', label: 'Yarn Dyed' },
  { value: 'RAW', label: 'Raw/Unfinished' },
] as const;

export type FabricFinishType = (typeof FABRIC_FINISH_TYPES)[number]['value'];

export const getFinishTypeLabel = (value: string | null | undefined): string => {
  if (!value) return '';
  return FABRIC_FINISH_TYPES.find((ft) => ft.value === value)?.label || value;
};
