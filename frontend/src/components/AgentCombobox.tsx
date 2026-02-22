import { useState, useEffect, useCallback } from 'react';
import { Combobox, type ComboboxOption } from './ui/combobox';
import { searchAgents } from '@/services/agent.service';
import { toast } from 'sonner';

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
  placeholder = "Select agent...",
  className,
  disabled = false,
  agencyId,
}: AgentComboboxProps) {
  const [agents, setAgents] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  // Load agents when agencyId changes
  useEffect(() => {
    loadAgents('');
  }, [agencyId]);

  const loadAgents = useCallback(async (search: string) => {
    try {
      setIsLoading(true);
      const agentList = await searchAgents({
        search: search || undefined,
        limit: 50,
        agencyId: agencyId || undefined,
      });

      const agentOptions: ComboboxOption[] = agentList.map((agent) => ({
        value: agent.id,
        label: `${agent.code} - ${agent.name}`,
        searchText: `${agent.code} ${agent.name} ${agent.phone || ''}`,
      }));

      setAgents(agentOptions);
      setInitialLoaded(true);
    } catch (error: any) {
      console.error('Failed to load agents:', error);
      toast.error(error?.message || 'Failed to load agents');
    } finally {
      setIsLoading(false);
    }
  }, [agencyId]);

  return (
    <Combobox
      options={agents}
      value={value}
      onValueChange={onValueChange}
      placeholder={!initialLoaded ? "Loading agents..." : placeholder}
      searchPlaceholder="Search by code, name, phone..."
      emptyText="No agents found."
      disabled={disabled || !initialLoaded}
      className={className}
      onSearchChange={loadAgents}
      isLoading={isLoading}
    />
  );
}
