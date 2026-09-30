/**
 * Split a job work order made before jobs had lines, whose orders come back as DIFFERENT fabrics, into one
 * line per fabric (2026-09-30). DJ-EBEW-002-001 (SP27CK130 Red, -B Black, -T Teal) and PJ-ESSKY090LS-002
 * (ESSKY090LS Brown, ESSKY092LS Red) were each one line naming the first order's fabric.
 *
 * The grouping, fabric mint, asked width and greige-per-order are exactly MRP's (mrp.service Generate Job Work):
 * a line per {finished fabric, asked width}; each line's greige = its orders' fabric ÷ (1 − their shrinkage).
 * The last line absorbs rounding so the job keeps the greige and fabric totals it was approved with.
 * Only jobs not yet sent (DRAFT / PENDING_APPROVAL / APPROVED) and still on one line are touched.
 *
 *   npx ts-node --files scripts/repair-mixed-jwo-lines.ts            # dry run
 *   npx ts-node --files scripts/repair-mixed-jwo-lines.ts --apply    # writes a snapshot first
 */

import fs from 'fs';
import path from 'path';
import prisma from '../src/config/database';
import {
  FinishedFabricIdentity,
  finishedFabricOutputKey,
  getOrCreateFinishedFabricV2,
  resolveFinishedFabricIdentity,
} from '../src/services/helpers/fabric-identity.helper';
import { impliedShrinkagePercent, syncJwoHeaderFromLines } from '../src/services/helpers/jwo-lines.helper';
import { resolveProcessingShrinkagePercent } from '../src/services/mrp.service';
import { systemSettingsService } from '../src/services/system-settings.service';
import { addCurrency, divideByShrinkage, roundToCent, subtractCurrency, toNumber } from '../src/utils/currency';
import { buyerStyleCode } from '../src/utils/style-code';

const APPLY = process.argv.includes('--apply');
const SNAPSHOT = path.join(__dirname, `repair-mixed-jwo-lines-snapshot-${Date.now()}.json`);
const NOT_SENT = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] as const;

const REQUIREMENT_SELECT = {
  id: true,
  requirementNumber: true,
  colorName: true,
  printingType: true,
  fabricWidth: true,
  shrinkagePercentUsed: true,
  linkedRequirement: { select: { shrinkagePercentUsed: true } },
  materials: { select: { greigeId: true } },
  order_items: { select: { styleId: true, styles: { select: { id: true, styleCode: true, buyerStyleRef: true } } } },
  orders: { select: { orderNumber: true } },
  orderBomItem: {
    select: {
      id: true,
      colorName: true,
      greigeId: true,
      fabricId: true,
      fabricWidthInches: true,
      rateCard: { select: { shrinkagePercent: true } },
      selectedCad: {
        select: {
          id: true,
          styleFabricId: true,
          isCombinedCutting: true,
          patternPart: { select: { id: true, name: true } },
          cadPatternParts: { select: { patternPart: { select: { id: true, name: true, sortOrder: true } } } },
        },
      },
    },
  },
} as const;

const money = (n: number) => toNumber(roundToCent(n));

async function main() {
  const widthDeduction = await systemSettingsService.getCutableWidthDeductionInches();
  const jobs = await prisma.job_work_orders.findMany({
    where: { isActive: true, jwoStatus: { in: [...NOT_SENT] }, fabricType: { not: 'LACE' } },
    include: {
      lines: { orderBy: { lineNo: 'asc' } },
      requirementLinks: { include: { material_requirements: { select: REQUIREMENT_SELECT } } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const snapshot: unknown[] = [];
  let repaired = 0;

  for (const job of jobs) {
    if (job.lines.length !== 1 || job.requirementLinks.length < 2) continue;
    const finishType = job.processType === 'PRINTING' ? 'PRINTED' : 'DYED';

    const outputs = new Map<
      string,
      { identity: FinishedFabricIdentity | null; askedWidth: number | null; links: typeof job.requirementLinks }
    >();
    for (const link of job.requirementLinks) {
      const req = link.material_requirements;
      const cutable =
        req.orderBomItem?.fabricWidthInches != null
          ? Number(req.orderBomItem.fabricWidthInches)
          : req.fabricWidth != null
            ? Number(req.fabricWidth)
            : null;
      const askedWidth = cutable != null ? cutable + widthDeduction : null;
      const identity = await resolveFinishedFabricIdentity({
        requirement: req as never,
        jwo: { sentWidthInches: askedWidth },
        finishType,
      });
      const key = identity ? `${finishedFabricOutputKey(identity)}|${askedWidth ?? ''}` : `requirement:${req.id}`;
      const output = outputs.get(key) ?? { identity, askedWidth, links: [] };
      output.links.push(link);
      outputs.set(key, output);
    }
    if (outputs.size < 2) continue;

    const planned = [...outputs.values()].map((output) => {
      const qtyExpected = money(addCurrency(...output.links.map((l) => Number(l.allocatedQuantity))).toNumber());
      const qtySent = money(
        addCurrency(
          ...output.links.map((l) =>
            roundToCent(
              divideByShrinkage(
                Number(l.allocatedQuantity),
                resolveProcessingShrinkagePercent(l.material_requirements as never)
              )
            )
          )
        ).toNumber()
      );
      const req = output.links[0].material_requirements;
      return {
        output,
        styleId: req.order_items?.styleId ?? null,
        label: [
          req.order_items?.styles ? buyerStyleCode(req.order_items.styles) : null,
          output.identity?.printDesign ?? output.identity?.colorName ?? req.colorName,
        ]
          .filter(Boolean)
          .join(' '),
        colorName: output.identity?.colorName ?? req.colorName ?? null,
        colorMasterId: output.identity?.colorMasterId ?? null,
        sentWidthInches: output.askedWidth,
        qtySent,
        qtyExpected,
      };
    });

    // The job keeps the totals it was approved with: the last line absorbs rounding
    const last = planned[planned.length - 1];
    const sentGap = toNumber(subtractCurrency(Number(job.qtySentMeters), ...planned.map((p) => p.qtySent)));
    const expectedGap =
      job.qtyBillable != null
        ? toNumber(subtractCurrency(Number(job.qtyBillable), ...planned.map((p) => p.qtyExpected)))
        : 0;
    last.qtySent = money(last.qtySent + sentGap);
    last.qtyExpected = money(last.qtyExpected + expectedGap);

    console.log(
      `\n${job.jobWorkNumber} (${job.jwoStatus}) — ${planned.length} fabrics; greige ${Number(job.qtySentMeters)} m, ` +
        `fabric ${Number(job.qtyBillable)} m` +
        (sentGap || expectedGap ? ` (rounding put on the last line: ${sentGap} m greige, ${expectedGap} m fabric)` : '')
    );
    planned.forEach((p, i) =>
      console.log(
        `  line ${i + 1}: ${p.label || 'no style/colour'} — ${p.qtySent} m greige → ${p.qtyExpected} m fabric, ` +
          `asked ${p.sentWidthInches ?? '—'}" — ${p.output.links
            .map((l) => `${l.material_requirements.requirementNumber} (${l.material_requirements.orders?.orderNumber ?? 'no order'})`)
            .join(', ')}`
      )
    );

    snapshot.push({
      job: {
        id: job.id,
        jobWorkNumber: job.jobWorkNumber,
        qtySentMeters: job.qtySentMeters,
        qtyBillable: job.qtyBillable,
        styleId: job.styleId,
        colorName: job.colorName,
        finishedFabricId: job.finishedFabricId,
        sentWidthInches: job.sentWidthInches,
        expectedShrinkage: job.expectedShrinkage,
        remarks: job.remarks,
      },
      lines: job.lines,
      links: job.requirementLinks.map(({ id, requirementId, lineId, allocatedQuantity }) => ({
        id,
        requirementId,
        lineId,
        allocatedQuantity,
      })),
    });

    if (!APPLY) continue;
    fs.writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2));
    await prisma.$transaction(async (tx) => {
      for (const [index, p] of planned.entries()) {
        const minted = p.output.identity
          ? await getOrCreateFinishedFabricV2(p.output.identity, job.createdById, 'AUTO_FROM_MRP_JWO', tx)
          : null;
        const data = {
          styleId: p.styleId,
          colorName: p.colorName,
          colorMasterId: p.colorMasterId,
          finishedFabricId: minted?.fabricId ?? null,
          sentWidthInches: p.sentWidthInches,
          expectedShrinkage: impliedShrinkagePercent(p.qtySent, p.qtyExpected),
          qtySent: p.qtySent,
          qtyExpected: p.qtyExpected,
        };
        const line =
          index === 0
            ? await tx.job_work_order_lines.update({ where: { id: job.lines[0].id }, data })
            : await tx.job_work_order_lines.create({ data: { ...data, jobWorkOrderId: job.id, lineNo: index + 1 } });
        await tx.requirement_jwo_links.updateMany({
          where: { id: { in: p.output.links.map((l) => l.id) } },
          data: { lineId: line.id },
        });
        console.log(`  → line ${index + 1}: ${minted?.fabricName ?? 'fabric named at receipt'}`);
      }
      await syncJwoHeaderFromLines(tx, job.id);
      await tx.job_work_orders.update({
        where: { id: job.id },
        data: {
          remarks: `${job.remarks ?? ''}\n[Lines] Split into ${planned.length} lines, one per fabric (${planned
            .map((p) => p.label)
            .join(', ')}) — repair-mixed-jwo-lines, 2026-09-30`.trim(),
        },
      });
    });
    repaired++;
  }

  console.log(
    `\n${snapshot.length} job(s) bring back more than one fabric${APPLY ? `; ${repaired} split — snapshot ${SNAPSHOT}` : ' (dry run — nothing written)'}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
