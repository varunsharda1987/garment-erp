export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  dataType: string;
  category: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * One row from GET /system-settings/defaults.
 *
 * Deliberately a ROW, not a `Record<KEY, value>`. The API response serializer camelizes
 * object keys, which mangles a SCREAMING_SNAKE map key into `fABRICDEFAULTWASTAGEPERCENT`
 * and silently breaks every lookup. As a row the key is a value and survives intact.
 *
 * There is no hand-maintained list of keys here on purpose — the backend registry
 * (backend/src/config/defaults.registry.ts) is the only place keys are declared, and this
 * endpoint reports all of them.
 */
export interface SystemDefaultRow {
  key: string;
  value: string;
  dataType: 'NUMBER' | 'STRING' | 'BOOLEAN';
  category: string;
  /** Heading this setting is shown under. */
  group: string;
  label: string;
  description: string;
  min: number | null;
  max: number | null;
  /** Suffix shown next to the input, e.g. '%', 'in', 'days'. */
  unit: string | null;
  /** True when a user has changed it from the shipped default. */
  isOverridden: boolean;
  /** The shipped default, so the UI can offer "reset to default". */
  registryValue: string;
}

export interface PaginatedSystemSettings {
  data: SystemSetting[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
