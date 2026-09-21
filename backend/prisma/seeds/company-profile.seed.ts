/**
 * Company profile seed / backfill.
 *
 * Idempotent and NON-DESTRUCTIVE: it only fills columns that are still NULL. Anything the
 * owner has typed into Settings → Company Profile always wins, so this can be re-run on every
 * deploy without clobbering edits.
 *
 * Why it exists: the company_profile row predates the msmeNumber / tagline / brand-colour
 * columns. Those values lived in company.config.ts, and document-data/company-block.ts used to
 * splice them in at render time. Now that the row is the source of truth, the values have to
 * actually BE in the row — otherwise the Udyam number silently disappears from every invoice.
 *
 *   npx ts-node prisma/seeds/company-profile.seed.ts
 */
import prisma from '../../src/config/database';
import { COMPANY_CONFIG } from '../../src/config/company.config';

const DEFAULT_TAGLINE = 'Proprietorship · Contract & Private Label Manufacturing';

export async function seedCompanyProfile(): Promise<void> {
  const existing = await prisma.company_profile.findUnique({
    where: { gstin: COMPANY_CONFIG.gstin },
  });

  if (!existing) {
    const created = await prisma.company_profile.create({
      data: {
        name: COMPANY_CONFIG.name,
        legalName: COMPANY_CONFIG.name,
        gstin: COMPANY_CONFIG.gstin,
        pan: COMPANY_CONFIG.panNumber ?? null,
        msmeNumber: COMPANY_CONFIG.msmeNumber ?? null,
        cin: COMPANY_CONFIG.cinNumber ?? null,
        stateCode: COMPANY_CONFIG.stateCode,
        stateName: COMPANY_CONFIG.state,
        address: COMPANY_CONFIG.address,
        city: COMPANY_CONFIG.city,
        pincode: COMPANY_CONFIG.pincode,
        phone: COMPANY_CONFIG.phone,
        email: COMPANY_CONFIG.email,
        website: COMPANY_CONFIG.website ?? null,
        tagline: DEFAULT_TAGLINE,
        jurisdiction: 'Subject to Jaipur jurisdiction only.',
        brandColorPrimary: COMPANY_CONFIG.brandColors?.primary ?? null,
        brandColorAccent: COMPANY_CONFIG.brandColors?.accent ?? null,
        brandColorHeader: COMPANY_CONFIG.brandColors?.header ?? null,
        brandColorText: COMPANY_CONFIG.brandColors?.text ?? null,
        brandColorMuted: COMPANY_CONFIG.brandColors?.muted ?? null,
        isActive: true,
        isDefault: true,
      },
    });
    console.log(`Created company profile ${created.name} (${created.gstin})`);
  } else {
    // Fill only what is still NULL — never overwrite an owner's edit.
    const patch: Record<string, unknown> = {};
    const fillIfBlank = (field: string, current: unknown, value: unknown) => {
      if ((current === null || current === undefined || current === '') && value) {
        patch[field] = value;
      }
    };

    fillIfBlank('msmeNumber', existing.msmeNumber, COMPANY_CONFIG.msmeNumber);
    // Lab/TRF contact — only seeded if the split migration left it empty (a brand-new row).
    fillIfBlank('contactPhone', existing.contactPhone, existing.phone);
    fillIfBlank('contactEmail', existing.contactEmail, existing.email);
    fillIfBlank('cin', existing.cin, COMPANY_CONFIG.cinNumber);
    fillIfBlank('pan', existing.pan, COMPANY_CONFIG.panNumber);
    fillIfBlank('phone', existing.phone, COMPANY_CONFIG.phone);
    fillIfBlank('email', existing.email, COMPANY_CONFIG.email);
    fillIfBlank('website', existing.website, COMPANY_CONFIG.website);
    fillIfBlank('tagline', existing.tagline, DEFAULT_TAGLINE);
    fillIfBlank('jurisdiction', existing.jurisdiction, 'Subject to Jaipur jurisdiction only.');
    fillIfBlank('brandColorPrimary', existing.brandColorPrimary, COMPANY_CONFIG.brandColors?.primary);
    fillIfBlank('brandColorAccent', existing.brandColorAccent, COMPANY_CONFIG.brandColors?.accent);
    fillIfBlank('brandColorHeader', existing.brandColorHeader, COMPANY_CONFIG.brandColors?.header);
    fillIfBlank('brandColorText', existing.brandColorText, COMPANY_CONFIG.brandColors?.text);
    fillIfBlank('brandColorMuted', existing.brandColorMuted, COMPANY_CONFIG.brandColors?.muted);

    if (Object.keys(patch).length > 0) {
      await prisma.company_profile.update({ where: { id: existing.id }, data: patch });
      console.log(`Backfilled company profile ${existing.name}: ${Object.keys(patch).join(', ')}`);
    } else {
      console.log(`Company profile ${existing.name} already complete — nothing to backfill`);
    }
  }

  // Link the canonical state row so nothing needs COMPANY_STATE_ID any more.
  const row = await prisma.company_profile.findUnique({ where: { gstin: COMPANY_CONFIG.gstin } });
  if (row && !row.stateId) {
    const state = await prisma.indian_states.findUnique({ where: { stateCode: row.stateCode } });
    if (state) {
      await prisma.company_profile.update({ where: { id: row.id }, data: { stateId: state.id } });
      console.log(`Linked state ${state.stateName} (${state.stateCode})`);
    }
  }

  // Guarantee the invariant every document depends on.
  const defaults = await prisma.company_profile.count({ where: { isDefault: true } });
  if (defaults === 0) {
    const oldest = await prisma.company_profile.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (oldest) {
      await prisma.company_profile.update({ where: { id: oldest.id }, data: { isDefault: true } });
      console.log(`Promoted ${oldest.name} to default entity`);
    }
  }
}

if (require.main === module) {
  seedCompanyProfile()
    .then(() => prisma.$disconnect())
    .catch(async (error) => {
      console.error('Company profile seed failed:', error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
