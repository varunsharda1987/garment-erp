/**
 * Guards the sidebar/command-palette navigation config:
 *  - every referenced icon name resolves in the shared NAV_ICON_MAP
 *    (missing names previously rendered as blank icons, silently)
 *  - no path is registered twice across visible + search-only items
 *  - demoted (search-only) pages stay in the Ctrl+K flat list
 *  - the v0 → v1 ui-preferences migration maps renamed group titles
 */
import { describe, it, expect } from 'vitest';
import {
  TOP_LEVEL_ITEMS,
  NAV_GROUPS,
  SEARCH_ONLY_ITEMS,
  getAllFlatNavItems,
  type NavItem,
  type NavItemOrDivider,
} from '@/config/navigation';
import { NAV_ICON_MAP } from '@/config/nav-icons';
import { hasPermission } from '@/config/permissions.config';
import { migrateUIPreferences } from '@/stores/ui-preferences.store';

function isNavItem(item: NavItemOrDivider): item is NavItem {
  return typeof item !== 'string' && !('type' in item);
}

function collectIconNames(): { name: string; source: string }[] {
  const icons: { name: string; source: string }[] = [];
  for (const item of TOP_LEVEL_ITEMS) {
    icons.push({ name: item.iconName, source: `top-level "${item.title}"` });
  }
  for (const group of NAV_GROUPS) {
    icons.push({ name: group.iconName, source: `group "${group.title}"` });
    for (const item of group.items) {
      if (isNavItem(item)) {
        icons.push({ name: item.iconName, source: `${group.title} > "${item.title}"` });
      }
    }
  }
  for (const item of SEARCH_ONLY_ITEMS) {
    icons.push({ name: item.iconName, source: `search-only "${item.title}"` });
  }
  return icons;
}

describe('navigation config', () => {
  it('references only icons present in the shared NAV_ICON_MAP', () => {
    const missing = collectIconNames().filter(({ name }) => !NAV_ICON_MAP[name]);
    expect(missing, `Unmapped icons: ${missing.map((m) => `${m.name} (${m.source})`).join(', ')}`).toEqual([]);
  });

  it('has no duplicate paths across visible and search-only items', () => {
    // Collect from the RAW sources — getAllFlatNavItems() dedups search-only
    // entries against visible ones, which would mask exactly this mistake
    // (an item left in both lists after a promotion/demotion).
    const paths = [
      ...TOP_LEVEL_ITEMS.map((item) => item.path),
      ...NAV_GROUPS.flatMap((group) => group.items.filter(isNavItem).map((item) => item.path)),
      ...SEARCH_ONLY_ITEMS.map((item) => item.path),
    ];
    const duplicates = paths.filter((path, index) => paths.indexOf(path) !== index);
    expect(duplicates, `Duplicate nav paths: ${[...new Set(duplicates)].join(', ')}`).toEqual([]);
  });

  it('keeps every search-only (demoted) item findable in the flat list', () => {
    const flatPaths = new Set(getAllFlatNavItems().map((item) => item.path));
    for (const item of SEARCH_ONLY_ITEMS) {
      expect(flatPaths.has(item.path), `"${item.title}" (${item.path}) missing from flat nav list`).toBe(true);
    }
  });

  it('every nav item has a non-empty title and path', () => {
    for (const item of getAllFlatNavItems()) {
      expect(item.title.trim().length).toBeGreaterThan(0);
      expect(item.path.startsWith('/'), `"${item.title}" has non-absolute path "${item.path}"`).toBe(true);
    }
  });
});

describe('role-based visibility (mirrors Sidebar filter logic)', () => {
  function visibleItems(role: string, groupTitle: string): string[] {
    const group = NAV_GROUPS.find((g) => g.title === groupTitle);
    if (!group) return [];
    if (group.permission && !hasPermission(role, group.permission)) return [];
    return group.items
      .filter(isNavItem)
      .filter((item) => !item.permission || hasPermission(role, item.permission))
      .map((item) => item.title);
  }

  it('Team & Settings shows only messaging items + Process Guide to non-admin staff', () => {
    for (const role of ['SALES', 'FACTORY_SUPERVISOR', 'MERCHANDISER'] as const) {
      expect(visibleItems(role, 'Team & Settings'), `role ${role}`).toEqual([
        'My WhatsApp',
        'Message Staff',
        'Process Guide',
      ]);
    }
  });

  it('Team & Settings shows the full admin section to ADMIN', () => {
    const items = visibleItems('ADMIN', 'Team & Settings');
    expect(items).toContain('Users');
    expect(items).toContain('Permissions');
    expect(items).toContain('Tally Integration');
    // Tally sub-pages are search-only now — reached via the Tally Tools card
    expect(items).not.toContain('Outstanding Sync');
  });

  it('gated tax pages (search-only) are hidden from SALES but findable by ACCOUNTS', () => {
    const flatFor = (role: string) =>
      getAllFlatNavItems()
        .filter((item) => !item.permission || hasPermission(role, item.permission))
        .map((item) => item.title);
    const sales = flatFor('SALES');
    const accounts = flatFor('ACCOUNTS');
    for (const gated of ['Tax Masters', 'Credit Notes', 'Debit Notes', 'TDS Tracking', 'TCS Tracking']) {
      expect(sales, `SALES should not see ${gated}`).not.toContain(gated);
      expect(accounts, `ACCOUNTS should see ${gated}`).toContain(gated);
    }
    // The hub entry and the ungated pages stay findable by everyone
    for (const open of ['Tax & GST', 'HSN/SAC Codes', 'GST Reports']) {
      expect(sales, `SALES should see ${open}`).toContain(open);
    }
  });

  it('FACTORY_SUPERVISOR keeps a direct Processing Batches entry (its hub is jobWork-gated)', () => {
    const items = visibleItems('FACTORY_SUPERVISOR', 'Manufacturing');
    expect(items).toContain('Processing Batches');
    // ...precisely because the Job Work Dashboard hub is invisible to this role
    expect(items).not.toContain('Job Work Dashboard');
  });

  it('every search-only item is visible to at least one role that can see its hub group', () => {
    // Guard the click-path invariant at the permission level: a SEARCH_ONLY
    // item whose permission passes for a role must not be orphaned by that
    // role losing every sidebar entry in the same domain group.
    const roles = [
      'ADMIN',
      'MERCHANDISER',
      'PRODUCTION_MANAGER',
      'SALES',
      'INVENTORY',
      'ACCOUNTS',
      'QUALITY',
      'PURCHASE',
      'FACTORY_SUPERVISOR',
    ];
    for (const item of SEARCH_ONLY_ITEMS) {
      const group = NAV_GROUPS.find((g) => g.title === item.group);
      for (const role of roles) {
        const canSeeItem = !item.permission || hasPermission(role, item.permission);
        if (!canSeeItem) continue;
        // A role blocked by the GROUP's own gate never had sidebar access to
        // this domain (pre-existing; Ctrl+K-only there is not a regression).
        if (group?.permission && !hasPermission(role, group.permission)) continue;
        const groupVisible = visibleItems(role, item.group).length > 0;
        expect(groupVisible, `${role} can use "${item.title}" but sees nothing in its "${item.group}" group`).toBe(
          true
        );
      }
    }
  });

  it('every demoted page keeps a hub entry visible in the same domain group', () => {
    // Spot-check the absorbers exist as visible items
    const visibleTitles = NAV_GROUPS.flatMap((g) => g.items.filter(isNavItem).map((i) => i.title));
    for (const hub of ['All Masters', 'Tax & GST', 'Tally Integration', 'Job Work Dashboard', 'Embroidery']) {
      expect(visibleTitles, `hub "${hub}" must stay in the sidebar`).toContain(hub);
    }
  });
});

describe('ui-preferences v0 → v1 migration', () => {
  it('maps renamed group titles and dedupes', () => {
    const migrated = migrateUIPreferences(
      {
        expandedGroups: ['Orders & Planning', 'Sales & Billing', 'Manufacturing', 'Design'],
        collapsedSubSections: ['Materials & Masters::Configuration'],
        pinnedItems: ['/inventory/movements/stock-in'],
      },
      0
    );
    expect(migrated.expandedGroups).toEqual(['Orders & Sales', 'Manufacturing', 'Pre-Production']);
    // untouched keys pass through
    expect(migrated.collapsedSubSections).toEqual(['Materials & Masters::Configuration']);
    expect(migrated.pinnedItems).toEqual(['/inventory/movements/stock-in']);
  });

  it('drops the dissolved Process Guide group instead of expanding Team & Settings', () => {
    const migrated = migrateUIPreferences({ expandedGroups: ['Process Guide'] }, 0);
    expect(migrated.expandedGroups).toEqual([]);
  });

  it('maps Messaging and Administration to Team & Settings', () => {
    const migrated = migrateUIPreferences({ expandedGroups: ['Messaging', 'Administration'] }, 0);
    expect(migrated.expandedGroups).toEqual(['Team & Settings']);
  });

  it('passes v1 state through untouched', () => {
    const state = { expandedGroups: ['Orders & Planning'] };
    expect(migrateUIPreferences(state, 1)).toBe(state);
  });

  it('tolerates empty/missing persisted state', () => {
    expect(migrateUIPreferences(undefined, 0).expandedGroups).toEqual([]);
    expect(migrateUIPreferences({}, 0).expandedGroups).toEqual([]);
  });
});
