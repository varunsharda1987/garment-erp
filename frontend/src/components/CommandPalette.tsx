import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { usePermissions } from '@/hooks/usePermissions';
import { useUIPreferences } from '@/stores/ui-preferences.store';
import { getNavIconComponent } from '@/config/nav-icons';
import { getAllFlatNavItems } from '@/config/navigation';

export default function CommandPalette() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIPreferences();

  // Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  // Get all navigable items filtered by permission
  const allItems = useMemo(() => {
    return getAllFlatNavItems().filter((item) => !item.permission || can(item.permission));
  }, [can]);

  // Group items by their group name
  const groupedItems = useMemo(() => {
    const groups = new Map<string, typeof allItems>();
    for (const item of allItems) {
      const existing = groups.get(item.group) || [];
      existing.push(item);
      groups.set(item.group, existing);
    }
    return groups;
  }, [allItems]);

  const handleSelect = (path: string) => {
    navigate(path);
    setCommandPaletteOpen(false);
  };

  return (
    <CommandDialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <CommandInput placeholder="Search pages... (type to filter)" />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>No pages found.</CommandEmpty>
        {Array.from(groupedItems.entries()).map(([group, items], groupIndex) => (
          <div key={group}>
            {groupIndex > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {items.map((item) => {
                const Icon = getNavIconComponent(item.iconName);
                return (
                  <CommandItem
                    key={item.path}
                    value={`${item.title} ${item.group} ${item.keywords?.join(' ') || ''}`}
                    onSelect={() => handleSelect(item.path)}
                    className="cursor-pointer"
                  >
                    {Icon && <Icon className="mr-2 h-4 w-4 text-muted-foreground" />}
                    <span>{item.title}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{item.path}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
