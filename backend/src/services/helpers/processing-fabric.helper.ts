/**
 * P2.8 Processing Fabric Helper
 *
 * Finished-fabric get-or-create moved to fabric-identity.helper.ts
 * (getOrCreateFinishedFabricV2 — style-split identity, CAD pattern part, real dye colour).
 * This file keeps only the finish-type resolution shared by the GRN paths.
 */

/**
 * Determine finish type from processor category or requirement printingType.
 */
export function determineFinishType(
  processorCategory: string | null | undefined,
  printingType: string | null | undefined
): 'DYED' | 'PRINTED' {
  // If printingType is set, it's printing
  if (printingType) {
    return 'PRINTED';
  }

  // Check processor category
  if (processorCategory === 'DYEING_PRINTING') {
    // Could be either - default to DYED unless printingType was set
    return 'DYED';
  }

  // Default to DYED for other processing
  return 'DYED';
}
