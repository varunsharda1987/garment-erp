/**
 * Cost-sheet versions — cloning an approved sheet into a new PENDING version, inside the caller's
 * transaction (2026-09-26: moved out of style-costing-approval.controller so the Correct CAD flow can make
 * a version server-side, in the same transaction as the rest of a correction).
 */

import { randomUUID } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../../config/database';
import { BusinessError, ConflictError, NotFoundError } from '../../errors';
import { formatDate } from '../../utils/date';
import { styleCodeLabel } from '../../utils/style-code';

/**
 * A replaced version is history: nothing edits, approves, rejects, revokes, deletes, re-versions or builds
 * an order BOM from it. ESSKY092LS v1 (28-Sep) was revoked minutes after its order moved to v2 — the
 * revoke wiped who had approved it — and a New Version from an old sheet would leave two live sheets.
 * Throws COST_SHEET_REPLACED naming the live version; a live (or unknown) sheet passes.
 */
export async function assertCostSheetIsLive(
  id: string,
  db: PrismaClient | Prisma.TransactionClient = prisma
): Promise<void> {
  const sheet = await db.style_costing.findUnique({
    where: { id },
    select: { version: true, supersededById: true, styles: { select: { styleCode: true, buyerStyleRef: true } } },
  });
  if (!sheet?.supersededById) return;

  // Walk to the live end of the chain; the first step is the version that replaced this one
  const chain: Array<{ id: string; version: number; versionDate: Date }> = [];
  let nextId: string | null = sheet.supersededById;
  while (nextId && chain.length < 100) {
    const found: { id: string; version: number; versionDate: Date; supersededById: string | null } | null =
      await db.style_costing.findUnique({
        where: { id: nextId },
        select: { id: true, version: true, versionDate: true, supersededById: true },
      });
    if (!found) break;
    chain.push(found);
    nextId = found.supersededById;
  }
  const replacedOn = chain[0] ? ` on ${formatDate(chain[0].versionDate)}` : '';
  const live = chain[chain.length - 1];
  throw new ConflictError(
    `${styleCodeLabel(sheet.styles)} cost sheet v${sheet.version} was replaced${replacedOn} and is kept as history. ` +
      (live ? `Open v${live.version} to make changes.` : 'Open the current version to make changes.'),
    { code: 'COST_SHEET_REPLACED', liveCostSheetId: live?.id ?? null, liveVersion: live?.version ?? null }
  );
}

/**
 * What a new version does with EVERY cost-sheet column: 'carry' copies the source's value, 'fresh' belongs
 * to this version alone (set in createCostSheetVersionTx, else the column default). The `satisfies` makes a
 * new column a type error until someone decides. The hand-kept copy list this replaced dropped whatever it
 * did not name, and a dropped `purpose` fell to its default COSTING: ESSKY091LS v2 (25-Aug) lost Raw
 * Material and its ₹290 closed cost, and the 28-Sep CAD correction copied that into v3.
 */
export const VERSION_COLUMNS = {
  // identity, lineage and audit of THIS version
  id: 'fresh',
  version: 'fresh',
  versionDate: 'fresh',
  versionReason: 'fresh',
  costVariancePercent: 'fresh',
  notes: 'fresh',
  createdAt: 'fresh',
  updatedAt: 'fresh',
  createdById: 'fresh',
  supersededById: 'fresh',
  lockedForOrders: 'fresh',
  copiedFromCostingId: 'fresh',
  // approvals — a version starts PENDING
  approvalStatus: 'fresh',
  isApproved: 'fresh',
  approvedAt: 'fresh',
  approvedById: 'fresh',
  rejectionNotes: 'fresh',
  closedCostApprovedAt: 'fresh',
  closedCostApprovedById: 'fresh',
  // procurement actuals and variance are recorded against one version
  fabricActual: 'fresh',
  trimsActual: 'fresh',
  cmtActual: 'fresh',
  embroideryActual: 'fresh',
  accessoriesActual: 'fresh',
  totalActual: 'fresh',
  fabricVariance: 'fresh',
  fabricVariancePercent: 'fresh',
  trimsVariance: 'fresh',
  trimsVariancePercent: 'fresh',
  cmtVariance: 'fresh',
  cmtVariancePercent: 'fresh',
  embroideryVariance: 'fresh',
  embroideryVariancePercent: 'fresh',
  accessoriesVariance: 'fresh',
  accessoriesVariancePercent: 'fresh',
  totalVariance: 'fresh',
  totalVariancePercent: 'fresh',
  varianceStatus: 'fresh',
  varianceApprovedBy: 'fresh',
  varianceApprovedAt: 'fresh',
  varianceNotes: 'fresh',

  // what the sheet IS — the same sheet re-issued
  styleId: 'carry',
  purpose: 'carry',
  orderId: 'carry',
  orderItemId: 'carry',
  widthCombinationHash: 'carry',
  widthCombinationDescription: 'carry',
  numberOfComponents: 'carry',
  category: 'carry',
  subCategory: 'carry',
  closedCost: 'carry',
  closedCostCurrency: 'carry',
  closedCostNotes: 'carry',
  // lines and totals
  fabricDetails: 'carry',
  fabricTotal: 'carry',
  trimsDetails: 'carry',
  trimsTotal: 'carry',
  embroideryDetails: 'carry',
  embroideryTotal: 'carry',
  accessoriesDetails: 'carry',
  accessoriesTotal: 'carry',
  laceTotal: 'carry',
  cuttingCost: 'carry',
  stitchingCost: 'carry',
  finishingCost: 'carry',
  buttonAttachmentCost: 'carry',
  handworkCmtCost: 'carry',
  cmtTotal: 'carry',
  cmtCost: 'carry',
  valueLossPercent: 'carry',
  valueLossAmount: 'carry',
  markupPercent: 'carry',
  markupAmount: 'carry',
  subtotal: 'carry',
  totalProductCost: 'carry',
  totalMaterialCost: 'carry',
  printingCost: 'carry',
  totalProcessingCost: 'carry',
  checkingCost: 'carry',
  totalProductionCost: 'carry',
  profitMargin: 'carry',
  totalCostPerPiece: 'carry',
  sellingPricePerPiece: 'carry',
  fabricCost: 'carry',
  trimsCost: 'carry',
  embroideryWork: 'carry',
  handWork: 'carry',
  smockingCost: 'carry',
  dyeingCost: 'carry',
  washingCost: 'carry',
  otherProcessingCost: 'carry',
  packagingCost: 'carry',
  accessoriesCost: 'carry',
  otherMaterialCost: 'carry',
  factoryOverhead: 'carry',
  adminOverhead: 'carry',
  transportCost: 'carry',
  otherOverheads: 'carry',
  profitAmount: 'carry',
  cadFabricConsumption: 'carry',
  cadUnit: 'carry',
  cadWastagePercent: 'carry',
  // budgets and buffers
  fabricBudget: 'carry',
  trimsBudget: 'carry',
  cmtBudget: 'carry',
  embroideryBudget: 'carry',
  accessoriesBudget: 'carry',
  totalBudget: 'carry',
  fabricBufferPercent: 'carry',
  trimsBufferPercent: 'carry',
  cmtBufferPercent: 'carry',
  embroideryBufferPercent: 'carry',
  accessoriesBufferPercent: 'carry',
} as const satisfies Record<Prisma.Style_costingScalarFieldEnum, 'carry' | 'fresh'>;

// Prisma refuses a bare null for a Json column; a missing value leaves it NULL
const JSON_COLUMNS = new Set(
  Prisma.dmmf.datamodel.models
    .find((m) => m.name === 'style_costing')!
    .fields.filter((f) => f.type === 'Json')
    .map((f) => f.name)
);

function carriedColumns(source: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [column, rule] of Object.entries(VERSION_COLUMNS)) {
    if (rule !== 'carry') continue;
    const value = source[column];
    if (value === null && JSON_COLUMNS.has(column)) continue;
    data[column] = value;
  }
  return data;
}

/**
 * Copy the four relational item tables (fabric/trim/accessory/lace) from one cost
 * sheet to another. Order-BOM generation reads ONLY these tables (the JSON detail
 * columns are a display snapshot) — a copied sheet without its item rows produces
 * an empty/broken BOM, so every flow that clones a style_costing row must call this
 * inside the same transaction as the clone.
 */
export async function copyCostSheetItemTables(
  tx: Prisma.TransactionClient,
  sourceCostingId: string,
  targetCostingId: string
): Promise<void> {
  const [fabricItems, trimItems, accessoryItems, laceItems] = await Promise.all([
    tx.style_costing_fabric_items.findMany({ where: { costingId: sourceCostingId } }),
    tx.style_costing_trim_items.findMany({ where: { costingId: sourceCostingId } }),
    tx.style_costing_accessory_items.findMany({ where: { costingId: sourceCostingId } }),
    tx.style_costing_lace_items.findMany({ where: { costingId: sourceCostingId } }),
  ]);

  const reKey = <T extends { id: string; costingId: string; createdAt: Date; updatedAt: Date }>(rows: T[]) =>
    rows.map(({ id: _id, costingId: _costingId, createdAt: _c, updatedAt: _u, ...rest }) => ({
      ...rest,
      id: randomUUID(),
      costingId: targetCostingId,
    }));

  if (fabricItems.length > 0) {
    await tx.style_costing_fabric_items.createMany({ data: reKey(fabricItems) as any });
  }
  if (trimItems.length > 0) {
    await tx.style_costing_trim_items.createMany({ data: reKey(trimItems) as any });
  }
  if (accessoryItems.length > 0) {
    await tx.style_costing_accessory_items.createMany({ data: reKey(accessoryItems) as any });
  }
  if (laceItems.length > 0) {
    await tx.style_costing_lace_items.createMany({ data: reKey(laceItems) as any });
  }
}

/**
 * Clone an APPROVED cost sheet into a new PENDING version and supersede the source, in the caller's
 * transaction. Every 'carry' column in VERSION_COLUMNS is copied; its approvals start empty.
 */
export async function createCostSheetVersionTx(
  tx: Prisma.TransactionClient,
  sourceId: string,
  args: { userId: string; reason: string }
) {
  const sourceCostSheet = await tx.style_costing.findUnique({ where: { id: sourceId } });
  if (!sourceCostSheet) {
    throw new NotFoundError('Cost sheet', sourceId);
  }
  await assertCostSheetIsLive(sourceId, tx);
  // Only approved cost sheets can be versioned
  const isApproved = sourceCostSheet.approvalStatus === 'APPROVED' || sourceCostSheet.isApproved;
  if (!isApproved) {
    throw new BusinessError(
      'Only approved cost sheets can be versioned. Please approve the current version first or update it directly.'
    );
  }
  const versionReason = args.reason.trim();

  // Generate new version ID
  const newVersionId = `CS-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  // Versions are unique per (styleId, purpose, version) and a style can hold several width
  // combinations in one purpose, so source.version + 1 may already be taken — use the next free one.
  const latestInPurpose = await tx.style_costing.findFirst({
    where: { styleId: sourceCostSheet.styleId, purpose: sourceCostSheet.purpose },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const newVersionNumber = Math.max(sourceCostSheet.version, latestInPurpose?.version ?? 0) + 1;

  const created = await tx.style_costing.create({
    data: {
      ...(carriedColumns(sourceCostSheet) as Prisma.style_costingUncheckedCreateInput),
      id: newVersionId,
      version: newVersionNumber,
      versionDate: new Date(),
      versionReason,
      costVariancePercent: 0, // Will be calculated when values are changed
      notes: `Versioned from v${sourceCostSheet.version}. Reason: ${versionReason}`,
      approvalStatus: 'PENDING',
      isApproved: false,
      createdById: args.userId,
    },
    include: {
      styles: {
        select: {
          id: true,
          styleCode: true,
          buyerStyleRef: true,
          styleName: true,
        },
      },
      users_style_costing_createdByIdTousers: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  // Copy the relational item tables — the JSON columns copied above are only a
  // display snapshot; Order-BOM generation reads these tables.
  await copyCostSheetItemTables(tx, sourceCostSheet.id, created.id);

  // Link the old version to this new version (supersededBy relation)
  await tx.style_costing.update({
    where: { id: sourceCostSheet.id },
    data: {
      supersededById: created.id,
      lockedForOrders: true, // Lock the old version
    },
  });

  return { created, source: sourceCostSheet, newVersionNumber };
}
