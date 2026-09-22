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
import { PERMISSION_KEYS, type PermissionKey } from '@/config/permissions.config';
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

describe('permission-based visibility (mirrors Sidebar filter logic)', () => {
  // Visibility depends only on the keys a user holds (granted by the Permissions page and sent
  // on login) — there is no client-side role map any more. Each test states the keys it holds.
  const STAFF_KEYS: PermissionKey[] = ['dashboard', 'processGuide', 'whatsapp', 'messaging'];
  const ADMIN_KEYS: PermissionKey[] = [...PERMISSION_KEYS];

  function visibleItems(granted: readonly PermissionKey[], groupTitle: string): string[] {
    const has = new Set<string>(granted);
    const group = NAV_GROUPS.find((g) => g.title === groupTitle);
    if (!group) return [];
    if (group.permission && !has.has(group.permission)) return [];
    return group.items
      .filter(isNavItem)
      .filter((item) => !item.permission || has.has(item.permission))
      .map((item) => item.title);
  }

  function flatFor(granted: readonly PermissionKey[]): string[] {
    const has = new Set<string>(granted);
    return getAllFlatNavItems()
      .filter((item) => !item.permission || has.has(item.permission))
      .map((item) => item.title);
  }

  it('every key the navigation names is a real Permissions-page key', () => {
    const named = new Set<string>();
    for (const g of NAV_GROUPS) {
      if (g.permission) named.add(g.permission);
      for (const item of g.items) if (isNavItem(item) && item.permission) named.add(item.permission);
    }
    for (const item of [...TOP_LEVEL_ITEMS, ...SEARCH_ONLY_ITEMS]) if (item.permission) named.add(item.permission);
    const unknown = [...named].filter((k) => !(PERMISSION_KEYS as readonly string[]).includes(k));
    expect(unknown, `navigation.ts names keys no switch exists for: ${unknown.join(', ')}`).toEqual([]);
  });

  it('Team & Settings shows only messaging items + Process Guide + Settings to staff without admin keys', () => {
    // Settings carries no `permission` on purpose — it is how every user reaches Change Password
    // (see the comment on the item in navigation.ts). The test used to omit it and was red.
    expect(visibleItems(STAFF_KEYS, 'Team & Settings')).toEqual([
      'My WhatsApp',
      'Message Staff',
      'Process Guide',
      'Settings',
    ]);
  });

  it('Team & Settings shows the full admin section when every key is held', () => {
    const items = visibleItems(ADMIN_KEYS, 'Team & Settings');
    expect(items).toContain('Users');
    expect(items).toContain('Permissions');
    expect(items).toContain('Tally Integration');
    // Tally sub-pages are search-only now — reached via the Tally Tools card
    expect(items).not.toContain('Outstanding Sync');
  });

  it('gated tax pages (search-only) are hidden without the finance keys and findable with them', () => {
    const without = flatFor([...STAFF_KEYS, 'orders', 'invoices']);
    const withFinance = flatFor([...STAFF_KEYS, 'financialMasters', 'creditDebitNotes']);
    for (const gated of ['Tax Masters', 'Credit Notes', 'Debit Notes', 'TDS Tracking', 'TCS Tracking']) {
      expect(without, `should not see ${gated}`).not.toContain(gated);
      expect(withFinance, `should see ${gated}`).toContain(gated);
    }
    // The hub entry and the ungated pages stay findable by everyone
    for (const open of ['Tax & GST', 'HSN/SAC Codes', 'GST Reports']) {
      expect(without, `should see ${open}`).toContain(open);
    }
  });

  it('a shop-floor user keeps a direct Processing Batches entry when the Job Work hub is off', () => {
    const items = visibleItems([...STAFF_KEYS, 'manufacturing', 'processingBatches'], 'Manufacturing');
    expect(items).toContain('Processing Batches');
    // ...precisely because the Job Work Dashboard hub is invisible without jobWork
    expect(items).not.toContain('Job Work Dashboard');
  });

  // Demoted master pages are reached from the "All Masters" hub (see the click-path comments on
  // SEARCH_ONLY_ITEMS) — a user allowed a master page is expected to hold the hub's key too.
  const HUB_KEY_FOR_GROUP: Partial<Record<string, PermissionKey>> = { 'Materials & Masters': 'masterData' };

  it('every search-only item leaves something visible in its hub group for whoever can use it', () => {
    // Guard the click-path invariant at the permission level: a user holding exactly the keys
    // a SEARCH_ONLY item needs (its own, its group's, its hub's) must still see at least one
    // sidebar entry in the same domain group (any larger grant can only show more).
    for (const item of SEARCH_ONLY_ITEMS) {
      const group = NAV_GROUPS.find((g) => g.title === item.group);
      const minimal: PermissionKey[] = [];
      if (item.permission) minimal.push(item.permission);
      if (group?.permission) minimal.push(group.permission);
      const hubKey = HUB_KEY_FOR_GROUP[item.group];
      if (hubKey) minimal.push(hubKey);
      const groupVisible = visibleItems(minimal, item.group).length > 0;
      expect(
        groupVisible,
        `a user who can use "${item.title}" (${minimal.join('+') || 'no key'}) sees nothing in its "${item.group}" group`
      ).toBe(true);
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
