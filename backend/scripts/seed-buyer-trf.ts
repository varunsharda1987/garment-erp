/**
 * Seed the reference data the Easybuy Test Requirement Form needs.
 *
 * Idempotent — safe to re-run. Every step matches on a natural key and updates in place rather
 * than inserting, because the existing seed-product-categories.ts assigns a fresh uuid per run
 * and would duplicate rows if copied.
 *
 *   cd backend && npx ts-node scripts/seed-buyer-trf.ts
 *   cd backend && npx ts-node scripts/seed-buyer-trf.ts --dry-run
 *
 * Values here were confirmed by the owner on 2026-09-19, except the Intertek address, which is
 * transcribed from the footer of the buyer's own TRF.
 *
 * NOT seeded, on purpose:
 *  - The Easybuy merchandiser (name + email). The current form leaves both blank and the owner
 *    said not to take them from the older forms. Fill it on the customer's Contacts tab; until
 *    then the TRF prints those two boxes as a hand-fill hatch, which is honest.
 *  - greige_master.washCareCode. The codes are per fabric and must not be guessed — fill them
 *    on the greige as TRFs are raised.
 */

import prisma from '../src/config/database';

const DRY_RUN = process.argv.includes('--dry-run');

const log = (step: string, action: string, detail: string) =>
  console.log(`${DRY_RUN ? '[dry-run] ' : ''}${step.padEnd(22)} ${action.padEnd(9)} ${detail}`);

/** A — the garment types Easybuy names on the form that we do not hold as categories. */
async function seedProductCategories() {
  const parent = await prisma.product_category_master.findFirst({ where: { code: 'WW-TOP' } });
  if (!parent) {
    console.error('  ! WW-TOP ("Top") not found — cannot place Tunic under it. Skipping.');
    return;
  }

  // Only Tunic for now (owner, 2026-09-19): Shirt / Dress / Trouser already match existing
  // categories. Add more here as Easybuy uses them.
  const wanted = [{ code: 'WW-TOP-TUN', name: 'Tunic', sortOrder: 1 }];

  for (const w of wanted) {
    const existing = await prisma.product_category_master.findFirst({ where: { code: w.code } });
    if (existing) {
      log('product category', 'exists', `${w.code} "${w.name}"`);
      continue;
    }
    log('product category', 'create', `${w.code} "${w.name}" under ${parent.code} "${parent.name}"`);
    if (DRY_RUN) continue;
    await prisma.product_category_master.create({
      data: {
        code: w.code,
        name: w.name,
        parentId: parent.id,
        level: parent.level + 1,
        sortOrder: w.sortOrder,
        minComponents: 1,
        maxComponents: 1,
      },
    });
  }
}

/**
 * B — the lab. Address and contact are from the footer of the buyer's TRF.
 *
 * testing_labs has NO unique constraint on labCode (only an index), so a plain upsert will not
 * compile and a blind create double-seeds. Match first.
 */
async function seedTestingLab() {
  const LAB_CODE = 'INTERTEK-IN';
  const details = {
    labName: 'Intertek India Pvt. Ltd.',
    address: '17/F, Industrial Suburb, 2nd Stage Industrial Area, Yeshwanthpur',
    city: 'Bangalore',
    state: 'Karnataka',
    pincode: '560022',
    contactPhone: '+91 80 4021 3700',
    contactEmail: 'labtest.india@intertek.com',
    // Express service on the form is 48 hours.
    averageTurnaroundDays: 2,
  };

  const existing = await prisma.testing_labs.findFirst({ where: { labCode: LAB_CODE } });

  let labId = existing?.id;
  if (existing) {
    log('testing lab', 'update', `${LAB_CODE} — refreshing address/contact`);
    if (!DRY_RUN) {
      await prisma.testing_labs.update({ where: { id: existing.id }, data: details });
    }
  } else {
    const anyUser = await prisma.users.findFirst({ where: { isActive: true }, select: { id: true } });
    if (!anyUser) {
      console.error('  ! No active user to own the lab record. Skipping.');
      return;
    }
    log('testing lab', 'create', `${LAB_CODE} "${details.labName}"`);
    if (!DRY_RUN) {
      const created = await prisma.testing_labs.create({
        data: { labCode: LAB_CODE, ...details, createdById: anyUser.id },
      });
      labId = created.id;
    }
  }

  // Make it Easybuy's default so a new TRF picks it up without being told.
  const easybuy = await prisma.customers.findFirst({ where: { name: 'Easybuy' }, select: { id: true, defaultTestingLabId: true } });
  if (easybuy && labId && easybuy.defaultTestingLabId !== labId) {
    log('testing lab', 'link', 'set as Easybuy default testing lab');
    if (!DRY_RUN) {
      await prisma.customers.update({ where: { id: easybuy.id }, data: { defaultTestingLabId: labId } });
    }
  }
}

/** C — our vendor code with Easybuy. 205577 is current; the older 48156 is superseded. */
async function seedCustomerVendorCode() {
  const easybuy = await prisma.customers.findFirst({
    where: { name: 'Easybuy' },
    select: { id: true, vendorCode: true },
  });
  if (!easybuy) {
    console.error('  ! Customer "Easybuy" not found. Skipping vendor code.');
    return;
  }
  if (easybuy.vendorCode === '205577') {
    log('customer', 'exists', 'Easybuy vendor code already 205577');
    return;
  }
  log('customer', 'update', `Easybuy vendor code ${easybuy.vendorCode ?? '(none)'} -> 205577`);
  if (DRY_RUN) return;
  await prisma.customers.update({ where: { id: easybuy.id }, data: { vendorCode: '205577' } });
}

/**
 * D — the person a lab contacts about a TRF.
 *
 * There is no company-profile CRUD screen, so this script is the way to change these until one
 * exists. They are stored rather than hardcoded precisely so they CAN change — the owner's
 * requirement. The accounts-side contact in company.config.ts is a different contact and stays
 * as the invoice fallback.
 */
async function seedCompanyContact() {
  const profile = await prisma.company_profile.findFirst({ where: { isActive: true } });
  if (!profile) {
    console.error('  ! No active company_profile row. Skipping.');
    return;
  }

  const details = {
    contactPerson: 'Khushbu',
    phone: '8387931101',
    email: 'merchant1@kashayafabs.com',
  };

  const unchanged =
    profile.contactPerson === details.contactPerson &&
    profile.phone === details.phone &&
    profile.email === details.email;

  if (unchanged) {
    log('company profile', 'exists', 'TRF contact already set');
    return;
  }
  log('company profile', 'update', `contact -> ${details.contactPerson} / ${details.phone} / ${details.email}`);
  if (DRY_RUN) return;
  await prisma.company_profile.update({ where: { id: profile.id }, data: details });
}

async function main() {
  console.log(`\nSeeding buyer TRF reference data${DRY_RUN ? ' (dry run — nothing will be written)' : ''}\n`);
  await seedProductCategories();
  await seedTestingLab();
  await seedCustomerVendorCode();
  await seedCompanyContact();
  console.log('\nDone.\n');
  console.log('Still to fill by hand (deliberately not seeded):');
  console.log('  - Easybuy merchandiser name + email, on the customer\'s Contacts tab');
  console.log('  - Wash care codes, on each greige (Fabric > Greige)\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
