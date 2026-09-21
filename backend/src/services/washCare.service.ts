/**
 * Wash-care codes, per BUYER per FABRIC.
 *
 * The same fabric carries different care instructions for different customers (owner,
 * 2026-09-19), so the key is the pair — never the fabric alone. There is deliberately no
 * fabric-level default: a customer with no code recorded gets nothing back, and the Test
 * Requirement Form then prints a hatched blank for someone to complete by hand. On a lab form
 * another customer's code would be a confident wrong answer, which is worse than an empty box.
 */

import prisma from '../config/database';
import { Prisma } from '@prisma/client';
import logger from '../utils/logger';

export interface WashCareRow {
  id: string;
  customerId: string;
  greigeId: string;
  colorId: string | null;
  washCareCode: string;
  notes: string | null;
  customer?: { id: string; name: string; code: string } | null;
  color?: { id: string; colorName: string } | null;
}

class WashCareService {
  /**
   * The code for a customer + fabric, or null.
   *
   * A colour-specific row wins over the colour-blank one. Nothing writes a colour today — the
   * column exists so that if colour turns out to matter it is a row to add, not a migration to
   * run against a live database.
   */
  async resolve(customerId: string, greigeId: string, colorId?: string | null): Promise<WashCareRow | null> {
    const rows = await prisma.customer_fabric_wash_care.findMany({
      where: {
        customerId,
        greigeId,
        isActive: true,
        // `in: [colorId, null]` is not allowed — Prisma's `in` rejects null — so the
        // "this colour, or the colour-blank fallback" case is an explicit OR.
        ...(colorId ? { OR: [{ colorId }, { colorId: null }] } : { colorId: null }),
      },
      // Most specific first: a row naming this colour beats the colour-blank fallback.
      orderBy: [{ colorId: 'desc' }],
      take: 1,
      include: {
        customer: { select: { id: true, name: true, code: true } },
        color: { select: { id: true, colorName: true } },
      },
    });
    return (rows[0] as WashCareRow) ?? null;
  }

  /** Every code recorded against one fabric, for the fabric's own screen. */
  async listForGreige(greigeId: string): Promise<WashCareRow[]> {
    return (await prisma.customer_fabric_wash_care.findMany({
      where: { greigeId, isActive: true },
      include: {
        customer: { select: { id: true, name: true, code: true } },
        color: { select: { id: true, colorName: true } },
      },
      orderBy: [{ customer: { name: 'asc' } }],
    })) as WashCareRow[];
  }

  /**
   * Record a code for a customer + fabric, replacing whatever was there.
   *
   * Used by the fabric screen (explicit) and by the TRF on save (learning as you go), so it has
   * to be an upsert rather than a create — typing the same code on a second TRF must not fail.
   */
  async set(
    input: {
      customerId: string;
      greigeId: string;
      colorId?: string | null;
      washCareCode: string;
      notes?: string | null;
    },
    userId: string
  ): Promise<WashCareRow> {
    const code = input.washCareCode.trim();
    const colorId = input.colorId ?? null;

    const existing = await prisma.customer_fabric_wash_care.findFirst({
      where: { customerId: input.customerId, greigeId: input.greigeId, colorId },
      select: { id: true },
    });

    const data = { washCareCode: code, notes: input.notes ?? null, isActive: true };

    if (existing) {
      return (await prisma.customer_fabric_wash_care.update({
        where: { id: existing.id },
        data,
        include: {
          customer: { select: { id: true, name: true, code: true } },
          color: { select: { id: true, colorName: true } },
        },
      })) as WashCareRow;
    }

    return (await prisma.customer_fabric_wash_care.create({
      data: { customerId: input.customerId, greigeId: input.greigeId, colorId, createdById: userId, ...data },
      include: {
        customer: { select: { id: true, name: true, code: true } },
        color: { select: { id: true, colorName: true } },
      },
    })) as WashCareRow;
  }

  async remove(id: string): Promise<void> {
    await prisma.customer_fabric_wash_care.update({ where: { id }, data: { isActive: false } });
  }

  /**
   * Remember a code typed on a Test Requirement Form.
   *
   * Deliberately best-effort and never throws: this runs as a side effect of saving a form, and
   * failing to remember a code must not fail the save the merchant actually asked for. Skips
   * silently when the form has no fabric attached or the code already matches.
   */
  async rememberFromTrf(
    args: { customerId?: string | null; greigeId?: string | null; washCareCode?: string | null },
    userId: string
  ): Promise<void> {
    const { customerId, greigeId } = args;
    const code = args.washCareCode?.trim();
    if (!customerId || !greigeId || !code) return;

    try {
      const current = await this.resolve(customerId, greigeId, null);
      if (current?.washCareCode === code) return;
      await this.set({ customerId, greigeId, washCareCode: code }, userId);
      logger.info(`Wash care ${code} remembered for customer ${customerId} / greige ${greigeId} from a TRF`);
    } catch (error) {
      logger.warn(
        `Could not remember wash care code from TRF: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export const washCareService = new WashCareService();
export type { Prisma };
