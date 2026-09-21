import { useCallback, useRef } from 'react';
import { Combobox } from './ui/combobox';
import { processorRateCardV2Service } from '@/services/processorRateCardV2.service';
import { usePickerOptions, type PickerPage } from '@/hooks/usePickerOptions';
import type { GreigeForRateCard } from '@/types/processorRateCardV2.types';
import { toast } from 'sonner';

interface GreigeComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  /**
   * The chosen row, not just its id — callers need `averageShrinkagePercent`, the fallback when
   * the processor holds no rate card for this cloth.
   */
  onGreigeChange?: (greige: GreigeForRateCard | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Picks a greige MASTER (the cloth), not a stock lot.
 *
 * Source is the rate-card module's own `/greiges` list rather than `greigeService.getAll`: it
 * carries `averageShrinkagePercent` in the same row, and it is a GET, so every role that can raise
 * a job work order can read it. (The rate LOOKUP used to be the blocker — `costSheets` is
 * ADMIN/MERCHANDISER/ACCOUNTS while `jobWork` is ADMIN/PRODUCTION_MANAGER/PURCHASE; that guard was
 * lifted off the two lookup routes on 2026-09-21.)
 *
 * The endpoint returns every greige in one response (48 live), so the search is client-side —
 * same shape as WarehouseCombobox.
 */
export function GreigeCombobox({
  value,
  onValueChange,
  onGreigeChange,
  placeholder = 'Select greige...',
  className,
  disabled = false,
}: GreigeComboboxProps) {
  // Keeps the last loaded page so a selection can hand back the whole row.
  const rowsRef = useRef<GreigeForRateCard[]>([]);

  const fetch = useCallback(async (): Promise<PickerPage<GreigeForRateCard>> => {
    const items = await processorRateCardV2Service.getGreigeFabrics();
    rowsRef.current = items;
    return { items, total: items.length };
  }, []);

  const { options, isLoading, initialLoaded, loadError, load, footer } = usePickerOptions<GreigeForRateCard>({
    fetch,
    toOption: (greige) => ({
      value: greige.id,
      label: `${greige.greigeCode} — ${greige.greigeName}`,
      searchText: `${greige.greigeCode} ${greige.greigeName} ${greige.genericGreigeName || ''} ${greige.composition || ''}`,
    }),
    onError: (error) => {
      console.error('Failed to load greige:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load greige');
    },
  });

  return (
    <Combobox
      options={options}
      value={value}
      onValueChange={(next) => {
        onValueChange(next);
        onGreigeChange?.(rowsRef.current.find((g) => g.id === next) ?? null);
      }}
      placeholder={!initialLoaded ? (loadError ? 'Could not load — open to retry' : 'Loading greige...') : placeholder}
      searchPlaceholder="Search by code, name, composition..."
      emptyText="No greige found."
      disabled={disabled}
      className={className}
      onOpenChange={(open) => {
        if (open && !initialLoaded && !isLoading) load('');
      }}
      onSearchChange={load}
      isLoading={isLoading}
      footer={footer}
    />
  );
}
