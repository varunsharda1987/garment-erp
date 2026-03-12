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

// Map materialType → service function + name/code field extractors
const MASTER_CONFIG: Record<string, {
  fetch: (params: any) => Promise<any>;
  getName: (item: any) => string;
  getCode: (item: any) => string;
  getPrice: (item: any) => number | undefined;
  getUnit: () => string;
  idField: keyof TrimMasterSelection;
}> = {
  THREAD: {
    fetch: getAllThreads,
    getName: (item) => item.threadName || item.name || '',
    getCode: (item) => item.threadCode || item.code || '',
    getPrice: (item) => item.pricePerCone ? Number(item.pricePerCone) : undefined,
    getUnit: () => 'LOT',
    idField: 'threadId',
  },
  BUTTON: {
    fetch: getAllButtons,
    getName: (item) => item.buttonName || item.name || '',
    getCode: (item) => item.buttonCode || item.code || '',
    getPrice: (item) => item.pricePerPiece ? Number(item.pricePerPiece) : undefined,
    getUnit: () => 'PCS',
    idField: 'buttonId',
  },
  ZIPPER: {
    fetch: getAllZippers,
    getName: (item) => item.zipperName || item.name || '',
    getCode: (item) => item.zipperCode || item.code || '',
    getPrice: (item) => item.pricePerPiece ? Number(item.pricePerPiece) : undefined,
    getUnit: () => 'PCS',
    idField: 'zipperId',
  },
  ELASTIC: {
    fetch: getAllElastics,
    getName: (item) => item.elasticName || item.name || '',
    getCode: (item) => item.elasticCode || item.code || '',
    getPrice: (item) => item.pricePerMeter ? Number(item.pricePerMeter) : undefined,
    getUnit: () => 'MTR',
    idField: 'elasticId',
  },
  LABEL: {
    fetch: getAllLabels,
    getName: (item) => item.labelName || item.name || '',
    getCode: (item) => item.labelCode || item.code || '',
    getPrice: (item) => item.pricePerPiece ? Number(item.pricePerPiece) : undefined,
    getUnit: () => 'PCS',
    idField: 'labelId',
  },
  PACKAGING: {
    fetch: getAllPackaging,
    getName: (item) => item.packagingName || item.name || '',
    getCode: (item) => item.packagingCode || item.code || '',
    getPrice: (item) => item.pricePerPiece ? Number(item.pricePerPiece) : undefined,
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
  const [rawItems, setRawItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const config = MASTER_CONFIG[materialType];

  const loadItems = useCallback(async (search: string) => {
    if (!config) return;
    try {
      setIsLoading(true);
      const params: any = { limit: 50, search: search || undefined };
      // Label and Packaging support customer filtering
      if ((materialType === 'LABEL' || materialType === 'PACKAGING') && customerId) {
        params.customerId = customerId;
      }
      const response = await config.fetch(params);
      const items = response.data || [];
      setRawItems(items);

      const comboboxOptions: ComboboxOption[] = items.map((item: any) => ({
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
  }, [materialType, customerId, config]);

  useEffect(() => {
    if (config) {
      loadItems('');
    } else {
      setOptions([]);
      setRawItems([]);
      setInitialLoaded(true);
    }
  }, [materialType, customerId]);

  const handleValueChange = (selectedId: string) => {
    if (!selectedId || !config) {
      onSelect(null);
      return;
    }
    const item = rawItems.find((i: any) => i.id === selectedId);
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
    };
    // Set the specific FK field
    (selection as any)[config.idField] = selectedId;

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
      placeholder={!initialLoaded ? 'Loading...' : (placeholder || `Select ${materialType.toLowerCase()}...`)}
      searchPlaceholder={`Search ${materialType.toLowerCase()}...`}
      emptyText={`No ${materialType.toLowerCase()} masters found. Create one first.`}
      disabled={disabled || !initialLoaded}
      className={className}
      onSearchChange={loadItems}
      isLoading={isLoading}
    />
  );
}
