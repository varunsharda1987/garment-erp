/**
 * Stock-related constants
 *
 * BUG-GR9 fix: Centralized quality grade default.
 *
 * For services that can use async, prefer:
 *   systemSettingsService.getDefaultQualityGrade()
 *
 * This constant is the synchronous fallback when async is not practical.
 * The actual configured value can be changed via system_settings table
 * using key 'DEFAULT_QUALITY_GRADE'.
 */

/**
 * Default quality grade for all stock types.
 *
 * Valid values: 'A' (Grade A - highest quality), 'B' (Grade B), 'DEFECT' (defective)
 *
 * This constant is used as a fallback when:
 * 1. No quality grade is specified during stock creation
 * 2. The async systemSettingsService.getDefaultQualityGrade() cannot be used
 *
 * To change the default system-wide, update the 'DEFAULT_QUALITY_GRADE'
 * setting in the system_settings table via Admin > System Settings.
 */
export const DEFAULT_QUALITY_GRADE: 'A' | 'B' | 'DEFECT' = 'A';

/**
 * All valid quality grade values.
 * Used for validation and type guards.
 */
export const VALID_QUALITY_GRADES = ['A', 'B', 'DEFECT'] as const;

export type QualityGrade = (typeof VALID_QUALITY_GRADES)[number];

/**
 * Helper to validate if a value is a valid quality grade.
 */
export function isValidQualityGrade(value: unknown): value is QualityGrade {
  return typeof value === 'string' && VALID_QUALITY_GRADES.includes(value as QualityGrade);
}

/**
 * Helper to get a valid quality grade with fallback to default.
 * BUG-GR9 fix: Use this instead of hardcoding '|| "A"' throughout the codebase.
 */
export function getQualityGradeOrDefault(value: string | null | undefined): QualityGrade {
  if (isValidQualityGrade(value)) {
    return value;
  }
  return DEFAULT_QUALITY_GRADE;
}
