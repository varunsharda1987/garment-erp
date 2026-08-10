import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIPreferencesState {
  // Sidebar expanded groups
  expandedGroups: string[];
  // Collapsed sub-sections within groups (e.g. "Materials & Masters::Configuration")
  collapsedSubSections: string[];
  // Pinned/favorite navigation paths
  pinnedItems: string[];
  // Command palette open state (not persisted)
  commandPaletteOpen: boolean;

  // Actions
  toggleGroup: (groupTitle: string) => void;
  setExpandedGroups: (groups: string[]) => void;
  toggleSubSection: (key: string) => void;
  isSubSectionCollapsed: (key: string) => boolean;
  togglePin: (path: string) => void;
  isPinned: (path: string) => boolean;
  setCommandPaletteOpen: (open: boolean) => void;
}

const MAX_PINNED_ITEMS = 7;

// v0 → v1 (2026-08 sidebar consolidation): merged groups were renamed, so saved
// expanded-group titles must be mapped or that state silently resets for users.
const GROUP_RENAMES_V1: Record<string, string | null> = {
  'Orders & Planning': 'Orders & Sales',
  'Sales & Billing': 'Orders & Sales',
  Messaging: 'Team & Settings',
  Administration: 'Team & Settings',
  Design: 'Pre-Production',
  // Dropped: the Process Guide group was dissolved into Team & Settings; don't
  // auto-expand the whole admin section just because it was open.
  'Process Guide': null,
};

interface PersistedUIPreferences {
  expandedGroups?: string[];
  collapsedSubSections?: string[];
  pinnedItems?: string[];
}

export function migrateUIPreferences(persisted: unknown, version: number): PersistedUIPreferences {
  const state = (persisted ?? {}) as PersistedUIPreferences;
  if (version >= 1) return state;
  const migrated = (state.expandedGroups ?? [])
    .map((title) => (title in GROUP_RENAMES_V1 ? GROUP_RENAMES_V1[title] : title))
    .filter((title): title is string => title !== null);
  return {
    ...state,
    expandedGroups: [...new Set(migrated)],
  };
}

export const useUIPreferences = create<UIPreferencesState>()(
  persist(
    (set, get) => ({
      expandedGroups: ['Orders & Sales'],
      collapsedSubSections: ['Materials & Masters::Configuration'],
      pinnedItems: [],
      commandPaletteOpen: false,

      toggleGroup: (groupTitle: string) => {
        set((state) => ({
          expandedGroups: state.expandedGroups.includes(groupTitle)
            ? state.expandedGroups.filter((t) => t !== groupTitle)
            : [...state.expandedGroups, groupTitle],
        }));
      },

      setExpandedGroups: (groups: string[]) => {
        set({ expandedGroups: groups });
      },

      toggleSubSection: (key: string) => {
        set((state) => ({
          collapsedSubSections: state.collapsedSubSections.includes(key)
            ? state.collapsedSubSections.filter((k) => k !== key)
            : [...state.collapsedSubSections, key],
        }));
      },

      isSubSectionCollapsed: (key: string) => {
        return get().collapsedSubSections.includes(key);
      },

      togglePin: (path: string) => {
        set((state) => {
          if (state.pinnedItems.includes(path)) {
            return { pinnedItems: state.pinnedItems.filter((p) => p !== path) };
          }
          if (state.pinnedItems.length >= MAX_PINNED_ITEMS) {
            return state; // don't exceed max
          }
          return { pinnedItems: [...state.pinnedItems, path] };
        });
      },

      isPinned: (path: string) => {
        return get().pinnedItems.includes(path);
      },

      setCommandPaletteOpen: (open: boolean) => {
        set({ commandPaletteOpen: open });
      },
    }),
    {
      name: 'ui-preferences',
      version: 1,
      // Persisted shape is the partialized subset; zustand shallow-merges it
      // over defaults on rehydrate, so returning a partial is safe.
      migrate: (persisted, version) => migrateUIPreferences(persisted, version) as UIPreferencesState,
      partialize: (state) => ({
        expandedGroups: state.expandedGroups,
        collapsedSubSections: state.collapsedSubSections,
        pinnedItems: state.pinnedItems,
        // Don't persist commandPaletteOpen
      }),
    }
  )
);
