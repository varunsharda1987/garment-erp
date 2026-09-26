/**
 * One-off repair: give open label / packaging requirements the supplier on their own master page (2026-09-26).
 *
 * MRP took a label size line's supplier from the legacy `label_master.supplierId` column (which the Label
 * page never writes) and a plain label's from `material_suppliers` (a copy holding at most one size per
 * label). So nearly every label requirement sat at "Not Assigned" and blocked bulk PO generation. MRP now
 * reads `label_suppliers` / `packaging_suppliers` through master-supplier.helper; this assigns the open
 * rows it had already planned.
 *
 * Only rows that still need a PO (PO_REQUIRED / PARTIAL_STOCK) and have NO supplier are touched, and only
 * when the master names one (preferred, or its only supplier) — a supplier someone assigned is never
 * replaced. Each --apply appends its snapshot (the ids, all previously unassigned) to the snapshot file.
 *
 * Repair path = the SANCTIONED endpoint, as the admin user against the live API:
 *   POST /mrp/vendor-suggestions/bulk-assign   (the requirements page's Assign Vendors)
 *
 *   npx ts-node scripts/repair-label-requirement-suppliers.ts            (dry run)
 *   npx ts-node scripts/repair-label-requirement-suppliers.ts --apply
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import prisma from '../src/config/database';
import { loadMaterialMasterSuppliers, preferredMasterSupplierId } from '../src/services/helpers/master-supplier.helper';

const APPLY = process.argv.includes('--apply');
const API = process.env.REPAIR_API_BASE || 'http://localhost:5000/api';
const SNAPSHOT = path.join(__dirname, 'repair-label-requirement-suppliers-snapshot.json');

async function main() {
  const reqs = await prisma.material_requirements.findMany({
    where: {
      preferredSupplierId: null,
      requirementType: 'MATERIAL',
      status: { in: ['PO_REQUIRED', 'PARTIAL_STOCK'] },
      materials: { OR: [{ labelId: { not: null } }, { packagingId: { not: null } }] },
    },
    select: { id: true, requirementNumber: true, materialId: true, materials: { select: { code: true } } },
    orderBy: { requirementNumber: 'asc' },
  });
  const links = await loadMaterialMasterSuppliers(reqs.map((r) => r.materialId));
  const supplierNames = new Map(
    (await prisma.suppliers.findMany({ select: { id: true, name: true } })).map((s) => [s.id, s.name])
  );

  const assignments = reqs.flatMap((r) => {
    const supplierId = preferredMasterSupplierId(links.get(r.materialId));
    return supplierId ? [{ requirementId: r.id, supplierId, number: r.requirementNumber, code: r.materials.code }] : [];
  });
  const unassignable = reqs.filter((r) => !assignments.some((a) => a.requirementId === r.id));

  for (const a of assignments) console.log(`  ${a.number}  ${a.code}  →  ${supplierNames.get(a.supplierId)}`);
  console.log(
    `\n${reqs.length} open label/packaging requirement(s) with no supplier; ${assignments.length} can be assigned.` +
      (unassignable.length
        ? ` No supplier on the master page for: ${[...new Set(unassignable.map((r) => r.materials.code))].join(', ')}`
        : '')
  );
  if (assignments.length === 0) return;
  if (!APPLY) {
    console.log('Dry run. Re-run with --apply to assign them via the live API.');
    return;
  }

  const previous = fs.existsSync(SNAPSHOT) ? JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')) : null;
  const runs = previous?.runs ?? [];
  runs.push({ takenAt: new Date().toISOString(), previousSupplierId: null, assignments });
  fs.writeFileSync(SNAPSHOT, JSON.stringify({ runs }, null, 2));
  console.log(`Snapshot written: ${SNAPSHOT}`);

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not in environment — run from backend/ so .env loads.');
  const admin =
    (await prisma.users.findFirst({ where: { email: 'admin@kasya.in' } })) ||
    (await prisma.users.findFirst({ where: { role: 'ADMIN', isActive: true } }));
  if (!admin) throw new Error('No ADMIN user found.');
  const token = jwt.sign({ userId: admin.id, role: admin.role }, secret, { expiresIn: '1h' });

  const res = await fetch(`${API}/mrp/vendor-suggestions/bulk-assign`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assignments: assignments.map(({ requirementId, supplierId }) => ({ requirementId, supplierId })),
    }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`bulk-assign -> HTTP ${res.status}: ${json.message || JSON.stringify(json)}`);

  const nowAssigned = await prisma.material_requirements.count({
    where: { id: { in: assignments.map((a) => a.requirementId) }, preferredSupplierId: { not: null } },
  });
  console.log(`Assigned ${nowAssigned} of ${assignments.length} (acting as ${admin.email}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
