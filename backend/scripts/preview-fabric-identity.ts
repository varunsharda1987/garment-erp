/**
 * READ-ONLY preview of the finished-fabric identity a JWO would mint/reuse.
 *   npx ts-node scripts/preview-fabric-identity.ts <jwoId | jobWorkNumber | requirementNumber>
 *
 * Prints the resolved identity (colour, pattern part, styleFabric anchor), the name the
 * convention builds, which dedup branch would fire, and the next fabric code — ZERO writes.
 */
import 'dotenv/config';
import prisma from '../src/config/database';
import {
  buildFinishedFabricName,
  resolveFinishedFabricIdentity,
} from '../src/services/helpers/fabric-identity.helper';
import { determineFinishType } from '../src/services/helpers/processing-fabric.helper';
import { peekNextStyleLinkedFabricCode } from '../src/utils/fabric-code-generator';

const REQ_CHAIN_SELECT = {
  id: true,
  requirementNumber: true,
  colorName: true,
  printingType: true,
  materials: { select: { greigeId: true } },
  order_items: {
    select: {
      styleId: true,
      styles: { select: { id: true, styleCode: true, buyerStyleRef: true } },
    },
  },
  orderBomItem: {
    select: {
      id: true,
      colorName: true,
      greigeId: true,
      fabricId: true,
      selectedCad: {
        select: {
          id: true,
          styleFabricId: true,
          isCombinedCutting: true,
          patternPart: { select: { id: true, name: true } },
          cadPatternParts: {
            select: { patternPart: { select: { id: true, name: true, sortOrder: true } } },
          },
        },
      },
    },
  },
} as const;

async function main() {
  const key = process.argv[2];
  if (!key) {
    console.error('Usage: npx ts-node scripts/preview-fabric-identity.ts <jwoId | jobWorkNumber | requirementNumber>');
    process.exit(1);
  }

  const jwo = await prisma.job_work_orders.findFirst({
    where: { OR: [{ id: key }, { jobWorkNumber: key }] },
    include: {
      greigeStockLot: { select: { id: true, greigeId: true } },
      fabric: { select: { id: true, greigeId: true } },
      style: { select: { id: true, styleCode: true, buyerStyleRef: true } },
      finishedFabric: { select: { id: true, fabricCode: true, fabricName: true } },
      labDip: {
        select: {
          designArtwork: true,
          colorReference: true,
          targetColor: { select: { id: true, colorName: true, colorCode: true } },
        },
      },
      requirementLinks: { take: 1, select: { material_requirements: { select: REQ_CHAIN_SELECT } } },
    },
  });

  let requirement: any = jwo?.requirementLinks?.[0]?.material_requirements ?? null;
  if (!jwo && !requirement) {
    requirement = await prisma.material_requirements.findFirst({
      where: { requirementNumber: key },
      select: REQ_CHAIN_SELECT,
    });
  }
  if (!jwo && !requirement) {
    console.error(`No job_work_orders or material_requirements matched '${key}'`);
    process.exit(1);
  }

  const finishType = jwo
    ? determineFinishType(null, jwo.processType === 'PRINTING' ? 'PIGMENT' : null)
    : determineFinishType(null, requirement?.printingType ?? null);

  const identity = await resolveFinishedFabricIdentity({
    requirement,
    jwo: jwo ?? undefined,
    finishType,
  });

  console.log('=== Fabric Identity Preview (read-only) ===');
  if (jwo) {
    console.log(`JWO:            ${jwo.jobWorkNumber} (${jwo.processType}) — finishedFabricId ${jwo.finishedFabricId ?? 'NULL'}`);
    if (jwo.finishedFabric) {
      console.log(`  already set:  ${jwo.finishedFabric.fabricCode} — ${jwo.finishedFabric.fabricName}`);
    }
  }
  if (requirement) console.log(`Requirement:    ${requirement.requirementNumber ?? requirement.id}`);
  if (!identity) {
    console.log('Identity:       UNRESOLVABLE (no greige lineage) — receipt would log + skip');
    return;
  }

  console.log(`Greige:         ${identity.greigeId} — ${identity.greige.greigeName}`);
  console.log(`Style:          ${identity.styleCode ?? '(none — STK pool)'} (${identity.styleId ?? '-'})`);
  console.log(`Finish:         ${identity.finishType}`);
  console.log(`Colour:         ${identity.colorName ?? '(unknown — segment omitted)'}`);
  console.log(`Print design:   ${identity.printDesign ?? '-'}`);
  console.log(`Pattern part:   ${identity.patternPartName ?? '(none)'} (${identity.patternPartId ?? '-'})`);
  console.log(`styleFabricId:  ${identity.styleFabricId ?? '(none)'}`);
  console.log(`Embroidery:     ${identity.hasEmbroidery ? (identity.embroideryCode ?? 'Embroidery') : 'no'}`);
  console.log(`Name width:     ${identity.nameWidthInches ?? '(none)'}″`);
  console.log('');
  console.log(`NAME:           ${buildFinishedFabricName(identity)}`);
  console.log(`Next code:      ${await peekNextStyleLinkedFabricCode(identity.styleCode ?? undefined)}`);

  // Which dedup branch would fire?
  if (identity.styleFabricId) {
    const sf = await prisma.style_fabrics.findUnique({
      where: { id: identity.styleFabricId },
      select: { fabricId: true, fabric: { select: { fabricCode: true, fabricName: true } } },
    });
    if (sf?.fabricId) {
      console.log(`Dedup:          STYLE_FABRIC anchor → reuses ${sf.fabric?.fabricCode} — ${sf.fabric?.fabricName}`);
      return;
    }
  }
  const tuple = await prisma.fabric_master.findMany({
    where: {
      greigeId: identity.greigeId,
      finishType: identity.finishType,
      isActive: true,
      styleReference: identity.styleCode ?? null,
      colorName: identity.colorName ?? null,
      ...(identity.finishType === 'PRINTED' ? { printDesign: identity.printDesign ?? null } : {}),
    },
    select: { fabricCode: true, fabricName: true, styleFabrics: { select: { id: true } } },
    take: 5,
  });
  const adoptable = tuple.filter(
    (c) => c.styleFabrics.length === 0 || c.styleFabrics.some((s) => s.id === identity.styleFabricId)
  );
  if (adoptable.length > 0) {
    console.log(`Dedup:          TUPLE → would adopt ${adoptable[0].fabricCode} — ${adoptable[0].fabricName}`);
  } else {
    console.log('Dedup:          CREATE (no anchor claim, no adoptable tuple match)');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
