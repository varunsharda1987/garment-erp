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

export interface SystemSettingsDefaults {
  FABRIC_DEFAULT_WASTAGE_PERCENT?: string;
  GREIGE_DEFAULT_WASTAGE_PERCENT?: string;
  LACE_DEFAULT_WASTAGE_PERCENT?: string;
  LABEL_DEFAULT_EXTRA_PERCENT?: string;
  [key: string]: string | undefined;
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
