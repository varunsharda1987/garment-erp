/**
 * What each role sees on the Manufacturing Control Center, and in what order.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────────┐
 * │  THIS IS PRESENTATION, NOT ACCESS CONTROL. Do not "harden" it into a 403.         │
 * └──────────────────────────────────────────────────────────────────────────────────┘
 *
 * `auth.middleware.ts` states the house law: reads stay open to every signed-in user, because pages
 * look things up across modules; what a permission gates is what a user can DO. Nothing here is
 * secret — the owner chose on 2026-09-22 to keep cost and variance figures visible to every role.
 * So both Control Center endpoints stay readable by anyone signed in, and this map only decides
 * what the PAGE puts in front of someone. A future reader who turns this into a permission check
 * will be contradicting that convention.
 *
 * ORDER MATTERS. These are arrays, not sets. For a merchandiser this map is mostly a re-ordering
 * rather than a reduction (see below), and putting the right panel first is most of the value.
 *
 * ── Why the merchandiser sees the factory floor ───────────────────────────────────────────────
 *
 * A garment merchandiser is the buyer's counterpart inside the factory: sampling and approvals,
 * BOM and costing, fabric and trim sourcing, the TNA calendar, and the ship date. They *follow up*
 * production rather than run it — and industry practice is explicit that daily follow-up covers
 * output, rejection rate and any bottleneck at cutting, sewing or finishing, not only the final
 * ex-factory date. A merchandiser who cannot see a stalled cutting batch cannot protect the ship
 * date, which is the one thing they are accountable for.
 *
 * This deliberately diverges from `permissions.config.ts`, whose defaults withhold `manufacturing`,
 * `cutting`, `dyeing`, `challans` and `jobWork` from MERCHANDISER — i.e. it pictures a factory with
 * a PRODUCTION_MANAGER and a FACTORY_SUPERVISOR on staff. This deployment has neither, so if the
 * merchandisers don't watch the floor, nobody does but the owner. **Revisit this map the day a
 * production manager is hired** — that is a one-line change here, which is the whole reason this
 * lives in one config object instead of conditionals sprinkled through the page.
 *
 * Do NOT key any of this off permission keys: `role_permissions` grants `manufacturing` to all nine
 * roles in this deployment, so `hasPermission(role, 'manufacturing')` differentiates nothing.
 *
 * ── One known divergence, deliberate ──────────────────────────────────────────────────────────
 *
 * `services/ai/ai-permission.service.ts` holds an independent matrix saying MERCHANDISER may not
 * read `materialCosts`, `supplierPricing` or `profitMargins`. That would argue for withholding the
 * Variance Watchtower and the vendor table from them. The owner decided on 2026-09-22 that cost and
 * variance stay visible to every role on this page, so they are kept — but placed LAST in the
 * merchandiser's order, since they are the least actionable thing on the page for that role. If the
 * owner ever reverses that decision, this is the line to change.
 */

import { UserRole } from '@prisma/client';

/** The four blocks the page can render. */
export type SectionKey = 'pipeline' | 'alerts' | 'vendors' | 'variance';

/** The rows inside the "Alerts Requiring Action" block. */
export type AlertKey =
  | 'overdueLabDips'
  | 'overdueProcessPOs'
  | 'overdueExternalWork'
  | 'stuckCutting'
  | 'qualityFailures'
  | 'pendingApprovals'
  | 'overdueChallans'
  // A sent PO due within 3 days whose delivery place is still "to be advised" (2026-09-26)
  | 'poDeliveryUndecided';

export interface ControlCenterScope {
  /** Blocks to render, in the order this role should meet them. */
  sections: SectionKey[];
  /** Alert rows to compute and show, in this role's own order of work. */
  alerts: AlertKey[];
}

const ALL_ALERTS: AlertKey[] = [
  'overdueLabDips',
  'overdueProcessPOs',
  'overdueExternalWork',
  'stuckCutting',
  'qualityFailures',
  'pendingApprovals',
  'overdueChallans',
  'poDeliveryUndecided',
];

/**
 * Exhaustive by design: `Record<UserRole, …>` means adding a role to the Prisma enum fails the
 * typecheck here rather than silently falling through to an empty page.
 */
const SCOPE_BY_ROLE: Record<UserRole, ControlCenterScope> = {
  ADMIN: {
    sections: ['pipeline', 'alerts', 'vendors', 'variance'],
    alerts: ALL_ALERTS,
  },

  // Leads on ship-date risk, then the approvals and sampling they chase daily, then material at
  // vendors, then the floor they follow up.
  MERCHANDISER: {
    sections: ['pipeline', 'alerts', 'vendors', 'variance'],
    alerts: [
      'overdueLabDips',
      'pendingApprovals',
      'overdueProcessPOs',
      'overdueExternalWork',
      'qualityFailures',
      'stuckCutting',
      'overdueChallans',
      'poDeliveryUndecided',
    ],
  },

  // The documents and the money. No production noise they cannot act on.
  ACCOUNTS: {
    sections: ['alerts', 'vendors', 'variance'],
    alerts: ['overdueChallans'],
  },

  // No user holds this role yet — sensible default for the day one does.
  PRODUCTION_MANAGER: {
    sections: ['pipeline', 'alerts', 'vendors'],
    alerts: ['stuckCutting', 'overdueProcessPOs', 'overdueExternalWork', 'qualityFailures'],
  },

  // No user yet. The floor only.
  FACTORY_SUPERVISOR: {
    sections: ['pipeline', 'alerts'],
    alerts: ['stuckCutting'],
  },

  // No user yet. Test results and the approvals that depend on them.
  QUALITY: {
    sections: ['alerts'],
    alerts: ['qualityFailures', 'overdueLabDips', 'pendingApprovals'],
  },

  // No user yet. What is out of the building and what is owed back.
  INVENTORY: {
    sections: ['alerts', 'vendors'],
    alerts: ['overdueChallans', 'poDeliveryUndecided'],
  },

  // No user yet. Vendor performance and receipt variance.
  PURCHASE: {
    sections: ['alerts', 'vendors', 'variance'],
    alerts: ['poDeliveryUndecided', 'overdueChallans', 'overdueProcessPOs'],
  },

  // No user yet. Delivery risk only — they answer to the customer, not the floor.
  SALES: {
    sections: ['pipeline'],
    alerts: [],
  },
};

/**
 * The order the page lays sections out in, top to bottom.
 *
 * Every role's `sections` above is a SUBSEQUENCE of this, which is why the page can render in a
 * fixed order and only vary membership. `control-center-panels.test.ts` asserts that, so if a role
 * is ever given a genuinely different order the test fails and tells you the page needs to learn to
 * reorder — rather than the config quietly claiming an order the UI ignores.
 */
export const SECTION_RENDER_ORDER: SectionKey[] = ['pipeline', 'alerts', 'vendors', 'variance'];

/** Every role's scope, for tests and tooling. */
export const ALL_ROLE_SCOPES = SCOPE_BY_ROLE;

/**
 * The Control Center scope for a role. An unknown or missing role (a token from before a role was
 * renamed, say) falls back to the narrowest useful view rather than to everything.
 */
export function scopeForRole(role: UserRole | string | undefined): ControlCenterScope {
  const scope = role ? SCOPE_BY_ROLE[role as UserRole] : undefined;
  return scope ?? { sections: ['alerts'], alerts: ['overdueChallans'] };
}
