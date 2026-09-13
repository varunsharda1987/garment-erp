/**
 * The Permissions page, the API guards and the frontend must all speak the same permission keys.
 *
 * The frontend holds no copy of the grants (it receives the user's keys at login), but it does
 * name keys — in ROUTE_PERMISSIONS, in navigation.ts and in PERMISSION_KEYS. A key that exists on
 * one side only is a switch that gates nothing, or a menu entry no switch can ever open. This
 * used to be exactly the state of the app: the frontend had six keys the page could not show.
 */

import fs from 'fs';
import path from 'path';
import { PERMISSIONS, PERMISSION_KEYS, PERMISSION_GROUPS } from '../../config/permissions.config';

const FRONTEND_CONFIG = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'frontend',
  'src',
  'config',
  'permissions.config.ts'
);
const FRONTEND_NAV = path.join(__dirname, '..', '..', '..', '..', 'frontend', 'src', 'config', 'navigation.ts');

function frontendKeysList(): string[] {
  const src = fs.readFileSync(FRONTEND_CONFIG, 'utf8');
  const block = src.match(/PERMISSION_KEYS\s*=\s*\[([\s\S]*?)\]\s*as const/);
  if (!block) throw new Error('frontend permissions.config.ts has no `PERMISSION_KEYS = [...] as const`');
  return [...block[1].matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]);
}

function frontendKeysUsed(): Array<{ key: string; where: string }> {
  const out: Array<{ key: string; where: string }> = [];
  const config = fs.readFileSync(FRONTEND_CONFIG, 'utf8');
  for (const m of config.matchAll(/^\s*'[^']+':\s*'([A-Za-z]+)',?\s*$/gm))
    out.push({ key: m[1], where: 'ROUTE_PERMISSIONS' });
  const nav = fs.readFileSync(FRONTEND_NAV, 'utf8');
  for (const m of nav.matchAll(/permission:\s*'([A-Za-z]+)'/g)) out.push({ key: m[1], where: 'navigation.ts' });
  return out;
}

describe('permission catalogue parity', () => {
  it('frontend PERMISSION_KEYS equals the backend catalogue', () => {
    const frontend = frontendKeysList();
    const backend = [...PERMISSION_KEYS];
    const missingInFrontend = backend.filter((k) => !frontend.includes(k));
    const extraInFrontend = frontend.filter((k) => !(backend as string[]).includes(k));
    expect({ missingInFrontend, extraInFrontend }).toEqual({ missingInFrontend: [], extraInFrontend: [] });
  });

  it('every key the frontend routes or menu name exists in the backend catalogue', () => {
    const unknown = frontendKeysUsed().filter(({ key }) => !(PERMISSION_KEYS as string[]).includes(key));
    expect(unknown).toEqual([]);
  });

  it('every catalogue key sits in exactly one Permissions-page group', () => {
    const grouped = Object.values(PERMISSION_GROUPS).flat();
    const counts = new Map<string, number>();
    for (const k of grouped) counts.set(k, (counts.get(k) ?? 0) + 1);
    const missing = PERMISSION_KEYS.filter((k) => !counts.has(k));
    const duplicated = [...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k);
    const unknown = grouped.filter((k) => !(k in PERMISSIONS));
    expect({ missing, duplicated, unknown }).toEqual({ missing: [], duplicated: [], unknown: [] });
  });

  it('ADMIN is in every default grant (the page shows it as always-on)', () => {
    const withoutAdmin = PERMISSION_KEYS.filter((k) => !(PERMISSIONS[k] as readonly string[]).includes('ADMIN'));
    expect(withoutAdmin).toEqual([]);
  });
});
