import { UserRole } from '@prisma/client';
import {
  ALL_ROLE_SCOPES,
  SECTION_RENDER_ORDER,
  scopeForRole,
  type AlertKey,
  type SectionKey,
} from '../../config/control-center-panels';

/**
 * Guards on the Control Center's role→panel map.
 *
 * The important one is the subsequence check: the page renders its four blocks in a FIXED order and
 * only varies which appear. That is only correct while every role's `sections` is a subsequence of
 * `SECTION_RENDER_ORDER`. If someone gives a role a genuinely different order, this test fails and
 * tells them the page has to learn to reorder — rather than the config quietly claiming an order
 * the UI ignores.
 */
describe('Control Center role→panel map', () => {
  const ROLES = Object.values(UserRole);

  it('covers every role in the enum', () => {
    for (const role of ROLES) {
      expect(ALL_ROLE_SCOPES[role]).toBeDefined();
    }
    expect(Object.keys(ALL_ROLE_SCOPES).sort()).toEqual([...ROLES].sort());
  });

  it('gives every role a section order that is a subsequence of the page order', () => {
    for (const role of ROLES) {
      const sections = ALL_ROLE_SCOPES[role].sections;
      const positions = sections.map((s) => SECTION_RENDER_ORDER.indexOf(s));

      // No unknown section.
      expect(positions.every((p) => p >= 0)).toBe(true);
      // Strictly ascending === a subsequence of the canonical order.
      const ascending = positions.every((p, i) => i === 0 || p > positions[i - 1]);
      expect({ role, sections, ascending }).toEqual({ role, sections, ascending: true });
    }
  });

  it('never repeats a section or an alert row', () => {
    for (const role of ROLES) {
      const { sections, alerts } = ALL_ROLE_SCOPES[role];
      expect(new Set(sections).size).toBe(sections.length);
      expect(new Set(alerts).size).toBe(alerts.length);
    }
  });

  it('only lists alert rows when the alerts section is shown', () => {
    for (const role of ROLES) {
      const { sections, alerts } = ALL_ROLE_SCOPES[role];
      if (alerts.length > 0) {
        expect({ role, hasAlertsSection: sections.includes('alerts') }).toEqual({
          role,
          hasAlertsSection: true,
        });
      }
    }
  });

  it('falls back to a narrow view for an unknown role rather than to everything', () => {
    const scope = scopeForRole('SOMETHING_THAT_IS_NOT_A_ROLE');
    expect(scope.sections).not.toContain('pipeline' as SectionKey);
    expect(scope.alerts.length).toBeLessThan(7);

    // Same for a missing role (a token predating a rename).
    expect(scopeForRole(undefined).sections).not.toContain('pipeline' as SectionKey);
  });

  describe('the three roles that actually have users', () => {
    it('ADMIN sees everything', () => {
      const scope = scopeForRole(UserRole.ADMIN);
      expect(scope.sections).toEqual(SECTION_RENDER_ORDER);
      expect(scope.alerts).toHaveLength(7);
    });

    it('MERCHANDISER leads with ship-date risk, then the approvals they chase daily', () => {
      const scope = scopeForRole(UserRole.MERCHANDISER);
      expect(scope.sections[0]).toBe('pipeline');
      expect(scope.alerts.slice(0, 2)).toEqual(['overdueLabDips', 'pendingApprovals']);
      // They follow up the floor even though they do not run it — see the file header.
      expect(scope.alerts).toContain('stuckCutting' as AlertKey);
    });

    it('ACCOUNTS gets the documents and the money, not the floor', () => {
      const scope = scopeForRole(UserRole.ACCOUNTS);
      expect(scope.sections).not.toContain('pipeline' as SectionKey);
      expect(scope.alerts).toEqual(['overdueChallans']);
    });
  });
});
