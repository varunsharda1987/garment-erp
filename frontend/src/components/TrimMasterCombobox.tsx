import { useState, useEffect, useCallback } from 'react';
import { Combobox, type ComboboxOption } from './ui/combobox';
import { getAllThreads } from '@/services/thread.service';
import { getAllButtons } from '@/services/button.service';
import { getAllZippers } from '@/services/zipper.service';
import { getAllElastics } from '@/services/elastic.service';
import { getAllLabels } from '@/services/label.service';
import { getAllPackaging } from '@/services/packaging.service';

export interface TrimMasterSelection {
  masterId: string;
  masterName: string;
  masterCode?: string;
  materialType: string;
  // Specific FK field for this type
  threadId?: string;
  buttonId?: string;
  zipperId?: string;
  elasticId?: string;
  labelId?: string;
  packagingId?: string;
  // Price from master record
  unitPrice?: number;
  unit?: string;
}

interface TrimMasterComboboxProps {
  materialType: string;
  value?: string; // Current master ID
  onSelect: (selection: TrimMasterSelection | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  customerId?: string; // For customer-specific label/packaging filtering
}

/** Common shape for trim master items across all material types */
interface TrimMasterItem {
  id: string;
  [key: string]: unknown;
}

/** Query params for trim master fetch functions */
interface TrimMasterQueryParams {
  limit?: number;
  search?: string;
  customerId?: string;
}

/** Response shape from trim master fetch functions */
interface TrimMasterResponse {
  data: TrimMasterItem[];
}

// Helper to safely extract a string field from a trim master item
const getStringField = (item: TrimMasterItem, ...fields: string[]): string => {
  for (const field of fields) {
    const val = item[field];
    if (typeof val === 'string' && val) return val;
  }
  return '';
};

// Helper to safely extract a numeric field from a trim master item
const getNumericField = (item: TrimMasterItem, field: string): number | undefined => {
  const val = item[field];
  if (val !== null && val !== undefined) {
    const num = Number(val);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
};

// Map materialType → service function + name/code field extractors
const MASTER_CONFIG: Record<
  string,
  {
    fetch: (params: TrimMasterQueryParams) => Promise<TrimMasterResponse>;
    getName: (item: TrimMasterItem) => string;
    getCode: (item: TrimMasterItem) => string;
    getPrice: (item: TrimMasterItem) => number | undefined;
    getUnit: () => string;
    idField: keyof TrimMasterSelection;
  }
> = {
  THREAD: {
    fetch: getAllThreads as (params: TrimMasterQueryParams) => Promise<TrimMasterResponse>,
    getName: (item) => getStringField(item, 'threadName', 'name'),
    getCode: (item) => getStringField(item, 'threadCode', 'code'),
    getPrice: (item) => getNumericField(item, 'pricePerCone'),
    getUnit: () => 'LOT',
    idField: 'threadId',
  },
  BUTTON: {
    fetch: getAllButtons as (params: TrimMasterQueryParams) => Promise<TrimMasterResponse>,
    getName: (item) => getStringField(item, 'buttonName', 'name'),
    getCode: (item) => getStringField(item, 'buttonCode', 'code'),
    getPrice: (item) => getNumericField(item, 'pricePerPiece'),
    getUnit: () => 'PCS',
    idField: 'buttonId',
  },
  ZIPPER: {
    fetch: getAllZippers as (params: TrimMasterQueryParams) => Promise<TrimMasterResponse>,
    getName: (item) => getStringField(item, 'zipperName', 'name'),
    getCode: (item) => getStringField(item, 'zipperCode', 'code'),
    getPrice: (item) => getNumericField(item, 'pricePerPiece'),
    getUnit: () => 'PCS',
    idField: 'zipperId',
  },
  ELASTIC: {
    fetch: getAllElastics as (params: TrimMasterQueryParams) => Promise<TrimMasterResponse>,
    getName: (item) => getStringField(item, 'elasticName', 'name'),
    getCode: (item) => getStringField(item, 'elasticCode', 'code'),
    getPrice: (item) => getNumericField(item, 'pricePerMeter'),
    getUnit: () => 'MTR',
    idField: 'elasticId',
  },
  LABEL: {
    fetch: getAllLabels as (params: TrimMasterQueryParams) => Promise<TrimMasterResponse>,
    getName: (item) => getStringField(item, 'labelName', 'name'),
    getCode: (item) => getStringField(item, 'labelCode', 'code'),
    getPrice: (item) => getNumericField(item, 'pricePerPiece'),
    getUnit: () => 'PCS',
    idField: 'labelId',
  },
  PACKAGING: {
    fetch: getAllPackaging as (params: TrimMasterQueryParams) => Promise<TrimMasterResponse>,
    getName: (item) => getStringField(item, 'packagingName', 'name'),
    getCode: (item) => getStringField(item, 'packagingCode', 'code'),
    getPrice: (item) => getNumericField(item, 'pricePerPiece'),
    getUnit: () => 'PCS',
    idField: 'packagingId',
  },
};

export function TrimMasterCombobox({
  materialType,
  value,
  onSelect,
  placeholder,
  className,
  disabled = false,
  customerId,
}: TrimMasterComboboxProps) {
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [rawItems, setRawItems] = useState<TrimMasterItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const config = MASTER_CONFIG[materialType];

  const loadItems = useCallback(
    async (search: string) => {
      if (!config) return;
      try {
        setIsLoading(true);
        const params: TrimMasterQueryParams = { limit: 50, search: search || undefined };
        // Label and Packaging support customer filtering
        if ((materialType === 'LABEL' || materialType === 'PACKAGING') && customerId) {
          params.customerId = customerId;
        }
        const response = await config.fetch(params);
        const items = response.data ?? [];
        setRawItems(items);

        const comboboxOptions: ComboboxOption[] = items.map((item) => ({
          value: item.id,
          label: `${config.getCode(item)} - ${config.getName(item)}`,
          searchText: `${config.getCode(item)} ${config.getName(item)}`,
        }));

        setOptions(comboboxOptions);
        setInitialLoaded(true);
      } catch (error) {
        console.error(`Failed to load ${materialType} masters:`, error);
      } finally {
        setIsLoading(false);
      }
    },
    [materialType, customerId, config]
  );

  useEffect(() => {
    if (config) {
      loadItems('');
    } else {
      setOptions([]);
      setRawItems([]);
      setInitialLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialType, customerId]);

  const handleValueChange = (selectedId: string) => {
    if (!selectedId || !config) {
      onSelect(null);
      return;
    }
    const item = rawItems.find((i) => i.id === selectedId);
    if (!item) {
      onSelect(null);
      return;
    }

    const selection: TrimMasterSelection = {
      masterId: selectedId,
      masterName: config.getName(item),
      masterCode: config.getCode(item),
      materialType,
      unitPrice: config.getPrice(item),
      unit: config.getUnit(),
      // Set the specific FK field
      [config.idField]: selectedId,
    };

    onSelect(selection);
  };

  if (!config) {
    return null; // No combobox for unsupported types
  }

  return (
    <Combobox
      options={options}
      value={value}
      onValueChange={handleValueChange}
      placeholder={!initialLoaded ? 'Loading...' : placeholder || `Select ${materialType.toLowerCase()}...`}
      searchPlaceholder={`Search ${materialType.toLowerCase()}...`}
      emptyText={`No ${materialType.toLowerCase()} masters found. Create one first.`}
      disabled={disabled || !initialLoaded}
      className={className}
      onSearchChange={loadItems}
      isLoading={isLoading}
    />
  );
}
