/**
 * Resync Script: Component Pattern Parts from Group Tags
 *
 * The group→component pattern-part copy normally happens only when a component
 * master is CREATED. Pattern parts added to a group later (e.g. TIER 1-4,
 * SIDE PANEL, CENTRAL PANEL, BORDER, BOTTOM, DUPATTA added 2026-04-10) never
 * reach existing components, so they can't be selected in the CAD Part dropdown.
 *
 * This script walks ALL active component_masters that have a componentGroupId
 * and creates any component_pattern_parts rows that are missing according to
 * the current pattern_part_groups tags. Existing links are never modified or
 * removed — the script is idempotent.
 *
 * Usage:
 *   npx ts-node scripts/resync-component-pattern-parts.ts --dry-run   # preview only
 *   npx ts-node scripts/resync-component-pattern-parts.ts            # apply
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`🔄 Resync component pattern parts from group tags ${DRY_RUN ? '(DRY RUN — no writes)' : ''}\n`);

  // Build componentGroupId -> pattern parts map from current group tags
  const patternPartGroups = await prisma.pattern_part_groups.findMany({
    include: {
      patternPart: { select: { id: true, code: true, name: true, isActive: true } },
      componentGroup: { select: { code: true } },
    },
  });

  const groupToPartsMap = new Map<string, Array<{ id: string; code: string; name: string }>>();
  patternPartGroups.forEach((ppg) => {
    if (!ppg.patternPart.isActive) return;
    if (!groupToPartsMap.has(ppg.componentGroupId)) {
      groupToPartsMap.set(ppg.componentGroupId, []);
    }
    groupToPartsMap.get(ppg.componentGroupId)!.push({
      id: ppg.patternPart.id,
      code: ppg.patternPart.code,
      name: ppg.patternPart.name,
    });
  });

  console.log(`Loaded ${patternPartGroups.length} group tag(s) across ${groupToPartsMap.size} group(s)\n`);

  const components = await prisma.component_masters.findMany({
    where: { isActive: true, componentGroupId: { not: null } },
    include: {
      componentGroup: { select: { code: true, name: true } },
      patternParts: { select: { patternPartId: true } },
    },
    orderBy: { name: 'asc' },
  });

  let createdCount = 0;
  let skippedComponents = 0;

  for (const component of components) {
    const groupParts = groupToPartsMap.get(component.componentGroupId!) || [];
    const existingIds = new Set(component.patternParts.map((pp) => pp.patternPartId));
    const missing = groupParts.filter((part) => !existingIds.has(part.id));

    if (missing.length === 0) {
      skippedComponents++;
      continue;
    }

    console.log(`${component.name} (${component.componentGroup?.code}): ${missing.length} missing part(s)`);

    for (const part of missing) {
      console.log(`   ${DRY_RUN ? 'would add' : '✓ added'}: ${part.code} (${part.name})`);
      if (!DRY_RUN) {
        await prisma.component_pattern_parts.create({
          data: {
            componentId: component.id,
            patternPartId: part.id,
            quantity: part.code === 'SLEEVE' ? 2 : 1,
            isRequired: part.code === 'ALL_PARTS' || part.code === 'BODY_FRONT' || part.code === 'BODY_BACK',
          },
        });
      }
      createdCount++;
    }
  }

  console.log(
    `\n✅ Done. ${DRY_RUN ? 'Would create' : 'Created'} ${createdCount} link(s); ` +
      `${skippedComponents}/${components.length} component(s) already in sync.`
  );
}

main()
  .catch((e) => {
    console.error('❌ Resync failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
