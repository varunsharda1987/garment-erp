import { useCallback } from 'react';
import { Combobox } from './ui/combobox';
import { searchAgents } from '@/services/agent.service';
import { usePickerOptions, type PickerPage } from '@/hooks/usePickerOptions';
import type { AgentSearchResult } from '@/types/agent.types';
import { toast } from 'sonner';

/** /agents/search returns a plain array; its query schema caps limit at 100. */
const AGENT_PICKER_LIMIT = 100;

interface AgentComboboxProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  agencyId?: string; // Filter agents by agency (for cascading dropdown)
}

export function AgentCombobox({
  value,
  onValueChange,
  placeholder = 'Select agent...',
  className,
  disabled = false,
  agencyId,
}: AgentComboboxProps) {
  const fetch = useCallback(
    async (search: string): Promise<PickerPage<AgentSearchResult>> => {
      const items = await searchAgents({
        search: search || undefined,
        limit: AGENT_PICKER_LIMIT,
        agencyId: agencyId || undefined,
      });
      return { items };
    },
    [agencyId]
  );

  const { options, isLoading, initialLoaded, loadError, load, footer } = usePickerOptions<AgentSearchResult>({
    fetch,
    limit: AGENT_PICKER_LIMIT,
    toOption: (agent) => ({
      value: agent.id,
      label: `${agent.code} - ${agent.name}`,
      searchText: `${agent.code} ${agent.name} ${agent.phone || ''}`,
    }),
    narrowHint: 'type a code, name or phone to narrow',
    onError: (error) => {
      console.error('Failed to load agents:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load agents');
    },
  });

  return (
    <Combobox
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={!initialLoaded ? (loadError ? 'Could not load — open to retry' : 'Loading agents...') : placeholder}
      searchPlaceholder="Search by code, name, phone..."
      emptyText="No agents found."
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
