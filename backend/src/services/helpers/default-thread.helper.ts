// Shared "Default Thread" master — the single legal target for THREAD BOM rows that carry
// no specific thread reference. A style_material_bom row must never be persisted without a
// master FK (103 orphan "Thread (Auto-added)" rows came from exactly that), so every writer
// that can produce a name-only THREAD row resolves it through this helper.
import prisma from '../../config/database';
import { logInfo } from '../../utils/logger';
import { ensureMaterialRecord } from './material-sync.helper';

export const DEFAULT_THREAD_CODE = 'THR-DEFAULT';

/**
 * Find (or create on first use) the shared Default Thread master, guaranteeing its same-ID
 * materials record exists (materials.id === master.id convention). Returns the master id.
 */
export async function getOrCreateDefaultThreadId(tx?: any): Promise<string> {
  const client = tx || prisma;

  let defaultThread = await client.thread_master.findUnique({
    where: { threadCode: DEFAULT_THREAD_CODE },
    select: { id: true },
  });
  if (!defaultThread) {
    try {
      defaultThread = await client.thread_master.create({
        data: {
          threadCode: DEFAULT_THREAD_CODE,
          threadName: 'Default Thread',
          description: 'Shared placeholder thread auto-added to styles saved without a specific thread',
        },
        select: { id: true },
      });
      logInfo(`[DefaultThread] Created shared Default Thread master (${defaultThread.id})`);
    } catch (err: any) {
      // P2002: a concurrent first-use save created it between our find and create
      if (err?.code !== 'P2002') throw err;
      defaultThread = await client.thread_master.findUnique({
        where: { threadCode: DEFAULT_THREAD_CODE },
        select: { id: true },
      });
      if (!defaultThread) throw err;
    }
  }

  await ensureMaterialRecord(defaultThread.id, 'THREAD', tx);
  return defaultThread.id;
}
